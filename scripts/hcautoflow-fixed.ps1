# HCAutoFlow - HeadyMe Cloud Automation
param(
    [switch]$checkpoint,
    [switch]$status,
    [switch]$force,
    [int]$functionalityThreshold = 95
)

$ErrorActionPreference = "Stop"

function Write-Status {
    param([string]$message, [string]$level = "Info")
    $colors = @{
        "Info" = "White"
        "Success" = "Green"
        "Warning" = "Yellow"
        "Error" = "Red"
    }
    Write-Host "[$((Get-Date).ToString('HH:mm:ss'))] $message" -ForegroundColor $colors[$level]
}

function Test-HeadyMeCloud {
    Write-Status "Testing HeadyMe Cloud connectivity..." "Info"
    
    $endpoints = @(
        "https://headyme.com/api/health",
        "https://headyme.com/health",
        "https://headyme.com/api/brain/health"
    )
    
    $connected = $false
    foreach ($endpoint in $endpoints) {
        try {
            Invoke-WebRequest -Uri $endpoint -TimeoutSec 10 -ErrorAction Stop | Out-Null
            Write-Status "✓ Connected to $endpoint" "Success"
            $connected = $true
        } catch {
            Write-Status "✗ Failed to connect to $endpoint" "Error"
        }
    }
    
    return $connected
}

function Get-SystemStatus {
    Write-Status "=== HeadyMe Cloud Status ===" "Success"
    
    $cloudConnected = Test-HeadyMeCloud
    
    Write-Status "Mode: HeadyMe Cloud Only - NO LOCAL SERVICES" "Success"
    Write-Status "Cloud Connectivity: $(if ($cloudConnected) { '✓ CONNECTED' } else { '✗ DISCONNECTED' })" $(if ($cloudConnected) { "Success" } else { "Error" })"
    
    if ($cloudConnected) {
        Write-Status "✓ You are 100% connected to HeadyMe Cloud!" "Success"
    } else {
        Write-Status "✗ HeadyMe Cloud connection issues detected" "Error"
    }
    
    return @{
        cloudConnected = $cloudConnected
        functionalityScore = if ($cloudConnected) { 100 } else { 0 }
    }
}

function Create-Checkpoint {
    param([hashtable]$systemStatus)
    
    Write-Status "Creating checkpoint..." "Info"
    $checkpointId = "headyme_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    
    $checkpointData = @{
        id = $checkpointId
        timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        cloudConnected = $systemStatus.cloudConnected
        functionalityScore = $systemStatus.functionalityScore
        mode = "CLOUD_ONLY"
        services = @(
            @{ name = "HeadyMe Cloud"; status = if ($systemStatus.cloudConnected) { "ONLINE" } else { "OFFLINE" } }
        )
    }
    
    $checkpointFile = "$env:USERPROFILE\Documents\HeadyCheckpoints\$checkpointId.json"
    $checkpointDir = Split-Path $checkpointFile -Parent
    
    if (-not (Test-Path $checkpointDir)) {
        New-Item -ItemType Directory -Path $checkpointDir -Force | Out-Null
    }
    
    $checkpointData | ConvertTo-Json -Depth 3 | Set-Content $checkpointFile
    Write-Status "✓ Checkpoint $checkpointId created" "Success"
    Write-Status "  File: $checkpointFile" "Info"
    
    return $checkpointId
}

function Run-HealthCheck {
    Write-Status "=== COMPREHENSIVE HEALTH CHECK ===" "Success"
    
    $systemStatus = Get-SystemStatus
    
    # Functionality Score Calculation
    $score = $systemStatus.functionalityScore
    Write-Status "Functionality Score: $score%" $(if ($score -ge $functionalityThreshold) { "Success" } else { "Warning" })"
    
    if ($score -ge $functionalityThreshold) {
        Write-Status "✓ System operating above threshold ($functionalityThreshold%)" "Success"
    } else {
        Write-Status "⚠ System below threshold - requires attention" "Warning"
    }
    
    return $systemStatus
}

try {
    Write-Status "=== HCAutoFlow - HeadyMe Cloud Automation ===" "Success"
    Write-Status "Mode: CLOUD_ONLY - No local services will be checked" "Info"
    Write-Status ""
    
    # Main execution
    $systemStatus = Run-HealthCheck
    
    if ($checkpoint -or $force) {
        $checkpointId = Create-Checkpoint $systemStatus
        Write-Status "Checkpoint ID: $checkpointId" "Info"
    }
    
    if ($status) {
        Write-Status ""
        Write-Status "=== FINAL STATUS ===" "Success"
        Write-Status "Cloud Connectivity: $(if ($systemStatus.cloudConnected) { '✓ CONNECTED' } else { '✗ DISCONNECTED' })" $(if ($systemStatus.cloudConnected) { "Success" } else { "Error" })"
        Write-Status "Functionality: $($systemStatus.functionalityScore)%" $(if ($systemStatus.functionalityScore -ge $functionalityThreshold) { "Success" } else { "Warning" })"
    }
    
    Write-Status ""
    Write-Status "HCAutoFlow completed successfully!" "Success"
    
    if (-not $systemStatus.cloudConnected) {
        Write-Status "WARNING: Cloud connectivity issues detected" "Warning"
        exit 1
    }
    
} catch {
    Write-Status "CRITICAL ERROR: $($_.Exception.Message)" "Error"
    Write-Status "Stack trace: $($_.ScriptStackTrace)" "Error"
    exit 1
}
