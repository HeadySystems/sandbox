# HEADY_BRAND:BEGIN
# ╔══════════════════════════════════════════════════════════════════╗
# ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
# ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
# ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
# ║  ██║  ██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
# ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
# ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
# ║                                                                  ║
# ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
# ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
# ║  FILE: heady-connectivity-enforcer.ps1                           ║
# ║  LAYER: scripts                                                 ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END

<#
.SYNOPSIS
    Enforces 100% Heady service connectivity with automatic failover
.DESCRIPTION
    This script ensures 100% connectivity to Heady services by:
    - Monitoring critical service endpoints
    - Enforcing automatic failover
    - Providing real-time connectivity status
    - Restarting services when connectivity drops
.PARAMETER Mode
    Operating mode: 'enforce' (default), 'monitor', 'emergency'
.PARAMETER Interval
    Check interval in seconds (default: 30)
.PARAMETER LogLevel
    Logging level: 'info', 'warn', 'error' (default: 'info')
#>

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('enforce', 'monitor', 'emergency')]
    [string]$Mode = 'enforce',
    
    [Parameter(Mandatory=$false)]
    [int]$Interval = 30,
    
    [Parameter(Mandatory=$false)]
    [ValidateSet('info', 'warn', 'error')]
    [string]$LogLevel = 'info'
)

# Heady Service Configuration
$HeadyServices = @{
    'heady_brain' = @{
        Primary = 'https://brain.headysystems.com'
        Fallback = 'https://api.headysystems.com/brain'
        Critical = $true
        Port = 443
    }
    'heady_registry' = @{
        Primary = 'https://headysystems.com/api/registry'
        Fallback = 'https://api.headysystems.com/registry'
        Critical = $true
        Port = 443
    }
    'heady_manager' = @{
        Primary = 'https://headysystems.com/api/manager'
        Fallback = 'https://api.headysystems.com/manager'
        Critical = $true
        Port = 443
    }
    'heady_manager_local' = @{
        Primary = 'http://localhost:3301'
        Fallback = $null
        Critical = $true
        Port = 3301
    }
}

# Connectivity Status
$ConnectivityStatus = @{}
$ServiceHistory = @{}

function Write-HeadyLog {
    param(
        [string]$Message,
        [string]$Level = 'info'
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $color = switch ($Level) {
        'info' { 'Green' }
        'warn' { 'Yellow' }
        'error' { 'Red' }
        default { 'White' }
    }
    
    Write-Host "[$timestamp] [$($Level.ToUpper())] $Message" -ForegroundColor $color
}

function Test-HeadyService {
    param(
        [string]$ServiceName,
        [hashtable]$ServiceConfig
    )
    
    $endpoints = @($ServiceConfig.Primary)
    if ($ServiceConfig.Fallback) {
        $endpoints += $ServiceConfig.Fallback
    }
    
    foreach ($endpoint in $endpoints) {
        try {
            $uri = [System.Uri]$endpoint
            $result = Test-NetConnection -ComputerName $uri.Host -Port $uri.Port -WarningAction SilentlyContinue
            
            if ($result.TcpTestSucceeded) {
                return @{
                    Success = $true
                    Endpoint = $endpoint
                    ResponseTime = if ($result.PingReplyDetails) { $result.PingReplyDetails.RoundtripTime } else { 0 }
                }
            }
        } catch {
            Write-HeadyLog "Failed to test $ServiceName at $endpoint : $($_.Exception.Message)" 'warn'
        }
    }
    
    return @{
        Success = $false
        Endpoint = $null
        ResponseTime = 0
        Error = 'All endpoints failed'
    }
}

function Get-ServiceStatus {
    $status = @{}
    
    foreach ($service in $HeadyServices.GetEnumerator()) {
        $result = Test-HeadyService -ServiceName $service.Key -ServiceConfig $service.Value
        
        $status[$service.Key] = @{
            Connected = $result.Success
            Endpoint = $result.Endpoint
            ResponseTime = $result.ResponseTime
            Critical = $service.Value.Critical
            LastCheck = Get-Date
            Error = if ($result.Error) { $result.Error } else { $null }
        }
        
        # Update history
        if (-not $ServiceHistory.ContainsKey($service.Key)) {
            $ServiceHistory[$service.Key] = @()
        }
        $ServiceHistory[$service.Key] += @{
            Timestamp = Get-Date
            Connected = $result.Success
            Endpoint = $result.Endpoint
        }
        
        # Keep only last 100 entries
        if ($ServiceHistory[$service.Key].Count -gt 100) {
            $ServiceHistory[$service.Key] = $ServiceHistory[$service.Key][-100..-1]
        }
    }
    
    return $status
}

function Enforce-Connectivity {
    param([hashtable]$Status)
    
    $criticalServices = $Status.GetEnumerator() | Where-Object { $_.Value.Critical }
    $connectedCritical = $criticalServices | Where-Object { $_.Value.Connected }
    $disconnectedCritical = $criticalServices | Where-Object { -not $_.Value.Connected }
    
    if ($disconnectedCritical.Count -gt 0) {
        Write-HeadyLog "CRITICAL: $($disconnectedCritical.Count) critical services disconnected!" 'error'
        
        foreach ($service in $disconnectedCritical) {
            Write-HeadyLog "DISCONNECTED: $($service.Key) - $($service.Value.Error)" 'error'
            
            # Attempt recovery based on service
            switch ($service.Key) {
                'heady_manager_local' {
                    Write-HeadyLog "Attempting to restart local Heady Manager..." 'warn'
                    try {
                        Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
                        Start-Sleep -Seconds 2
                        Start-Process -FilePath "node" -ArgumentList "heady-manager.js" -WorkingDirectory $PSScriptRoot\.. -WindowStyle Hidden
                        Write-HeadyLog "Local Heady Manager restart initiated" 'info'
                    } catch {
                        Write-HeadyLog "Failed to restart local Heady Manager: $($_.Exception.Message)" 'error'
                    }
                }
                default {
                    Write-HeadyLog "Remote service $($service.Key) - manual intervention may be required" 'warn'
                }
            }
        }
        
        return $false
    } else {
        Write-HeadyLog "All $($connectedCritical.Count) critical services connected" 'info'
        return $true
    }
}

function Show-ConnectivityReport {
    param([hashtable]$Status)
    
    Write-Host "`n" + ("="*80) -ForegroundColor Cyan
    Write-Host "HEADY CONNECTIVITY STATUS REPORT" -ForegroundColor Cyan
    Write-Host ("="*80) -ForegroundColor Cyan
    
    $totalServices = $Status.Count
    $connectedServices = ($Status.GetEnumerator() | Where-Object { $_.Value.Connected }).Count
    $criticalServices = ($Status.GetEnumerator() | Where-Object { $_.Value.Critical }).Count
    $connectedCritical = ($Status.GetEnumerator() | Where-Object { $_.Value.Critical -and $_.Value.Connected }).Count
    
    Write-Host "`nOVERALL STATUS:" -ForegroundColor Yellow
    Write-Host "  Total Services: $totalServices"
    Write-Host "  Connected: $connectedServices/$totalServices ($([math]::Round($connectedServices/$totalServices*100,1))%)"
    Write-Host "  Critical Services: $connectedCritical/$criticalServices ($([math]::Round($connectedCritical/$criticalServices*100,1))%)"
    
    Write-Host "`nSERVICE DETAILS:" -ForegroundColor Yellow
    foreach ($service in $Status.GetEnumerator() | Sort-Object Key) {
        $status = if ($service.Value.Connected) { "✅ CONNECTED" } else { "❌ DISCONNECTED" }
        $critical = if ($service.Value.Critical) { " [CRITICAL]" } else { "" }
        $endpoint = if ($service.Value.Endpoint) { " -> $($service.Value.Endpoint)" } else { " -> NO ENDPOINT" }
        $responseTime = if ($service.Value.ResponseTime -gt 0) { " ($($service.Value.ResponseTime)ms)" } else { "" }
        
        Write-Host "  $($service.Key)$critical : $status$endpoint$responseTime"
        
        if ($service.Value.Error) {
            Write-Host "    Error: $($service.Value.Error)" -ForegroundColor Red
        }
    }
    
    Write-Host "`n" + ("="*80) -ForegroundColor Cyan
}

# Main execution loop
Write-HeadyLog "Starting Heady Connectivity Enforcer in $Mode mode" 'info'
Write-HeadyLog "Check interval: $Interval seconds" 'info'

while ($true) {
    try {
        $status = Get-ServiceStatus
        $ConnectivityStatus = $status
        
        if ($Mode -eq 'enforce') {
            $enforced = Enforce-Connectivity -Status $status
            if (-not $enforced) {
                Write-HeadyLog "Connectivity enforcement failed - continuing monitoring" 'warn'
            }
        }
        
        Show-ConnectivityReport -Status $status
        
        # Check if we should exit
        if ($Host.UI.RawUI.KeyAvailable) {
            $key = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
            if ($key.VirtualKeyCode -eq 27) { # ESC key
                Write-HeadyLog "Exiting Heady Connectivity Enforcer" 'info'
                break
            }
        }
        
        Start-Sleep -Seconds $Interval
        
    } catch {
        Write-HeadyLog "Error in main loop: $($_.Exception.Message)" 'error'
        Start-Sleep -Seconds 5
    }
}
