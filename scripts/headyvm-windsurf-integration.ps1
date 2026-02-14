<#
.SYNOPSIS
    HeadyVM Windsurf Integration Script
    Specialized script for Windsurf + HeadyVM integration

.DESCRIPTION
    This script handles the specific integration between Windsurf IDE and HeadyVM,
    including workspace synchronization, service management, and development workflow.

.PARAMETER Action
    Integration action: 'setup', 'sync', 'start', 'stop', 'status', 'monitor'

.EXAMPLE
    .\headyvm-windsurf-integration.ps1 -Action setup

.EXAMPLE
    .\headyvm-windsurf-integration.ps1 -Action sync

.NOTES
    Designed for seamless Windsurf + HeadyVM development experience
#>

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('setup', 'sync', 'start', 'stop', 'status', 'monitor', 'restart')]
    [string]$Action = 'setup',
    
    [Parameter(Mandatory=$false)]
    [string]$WorkspacePath = "C:\Users\erich\Heady",
    
    [Parameter(Mandatory=$false)]
    [string]$HeadyVMHost = "headyvm.local",
    
    [Parameter(Mandatory=$false)]
    [string]$HeadyVMUser = "heady",
    
    [Parameter(Mandatory=$false)]
    [switch]$Force,
    
    [Parameter(Mandatory=$false)]
    [switch]$Verbose
)

# Configuration
$config = @{
    workspace = $WorkspacePath
    vmHost = $HeadyVMHost
    vmUser = $HeadyVMUser
    services = @(
        @{ name = "heady-manager"; port = 3301; health = "/api/health" }
        @{ name = "heady-buddy"; port = 3000; health = "/health" }
        @{ name = "heady-web"; port = 8080; health = "/api/status" }
    )
    sync = @{
        interval = 30
        exclude = @(
            "node_modules/**"
            ".git/**"
            "dist/**"
            "build/**"
            "*.log"
            ".DS_Store"
            "Thumbs.db"
            ".env*"
            "coverage/**"
            ".nyc_output/**"
            ".vscode/settings.json"
            ".idea/**"
            "*.tmp"
            "*.temp"
            ".cache/**"
        )
    }
}

# Logging
function Write-Log {
    param([string]$Message, [string]$Level = "INFO", [string]$Color = "White")
    $timestamp = Get-Date -Format "HH:mm:ss"
    $icon = switch($Level) {
        "SUCCESS" { "✅" }
        "ERROR" { "❌" }
        "WARNING" { "⚠️" }
        "INFO" { "ℹ️" }
        "DEBUG" { "🐛" }
        default { "•" }
    }
    Write-Host "[$timestamp] $icon $Message" -ForegroundColor $Color
}

# SSH helper
function Invoke-SSH {
    param([string]$Command)
    try {
        $result = ssh $config.vmUser@$config.vmHost $Command 2>&1
        if ($LASTEXITCODE -eq 0) {
            return $result
        } else {
            throw "SSH command failed: $Command"
        }
    }
    catch {
        Write-Log "SSH error: $($_.Exception.Message)" "ERROR" "Red"
        throw
    }
}

# Setup Windsurf integration
function Set-WindsurfSetup {
    Write-Log "Setting up Windsurf + HeadyVM integration..." "INFO"
    
    # Create Windsurf workspace configuration
    $windsurfConfig = @{
        version = "2.0"
        name = "Heady Systems Development"
        description = "Heady Systems development workspace with HeadyVM integration"
        
        workspace = @{
            path = $config.workspace
            type = "heady-systems"
            remote = @{
                enabled = $true
                host = $config.vmHost
                user = $config.vmUser
                path = "/home/$($config.vmUser)/heady-sync"
            }
        }
        
        services = $config.services | ForEach-Object {
            @{
                name = $_.name
                localPort = $_.port
                remoteUrl = "http://$($config.vmHost):$($_.port)"
                healthEndpoint = $_.health
                autoStart = $true
                monitoring = $true
            }
        }
        
        sync = @{
            enabled = $true
            interval = $config.sync.interval
            direction = "bidirectional"
            exclude = $config.sync.exclude
            conflictResolution = "local-wins"
            compression = $true
            encryption = $true
        }
        
        development = @{
            hotReload = $true
            autoSave = $true
            debugMode = $false
            logs = @{
                level = "info"
                file = "heady-windsurf.log"
                maxSize = "10MB"
                maxFiles = 5
            }
        }
        
        monitoring = @{
            enabled = $true
            metrics = @("cpu", "memory", "disk", "network")
            alerts = @{
                cpuThreshold = 80
                memoryThreshold = 85
                diskThreshold = 90
            }
        }
    }
    
    # Save configuration
    $configDir = Join-Path $config.workspace ".windsurf"
    if (-not (Test-Path $configDir)) {
        New-Item -ItemType Directory -Path $configDir -Force | Out-Null
    }
    
    $configFile = Join-Path $configDir "headyvm-workspace.json"
    $windsurfConfig | ConvertTo-Json -Depth 10 | Set-Content $configFile
    
    Write-Log "Windsurf configuration saved to $configFile" "SUCCESS" "Green"
    
    # Create Windsurf launch configuration
    $launchConfig = @{
        version = "0.2.0"
        configurations = @(
            @{
                name = "Launch HeadyManager on HeadyVM"
                type = "node"
                request = "launch"
                program = "$($config.workspace)/heady-manager.js"
                cwd = $config.workspace
                env = @{
                    NODE_ENV = "development"
                    HEADY_VM_MODE = "true"
                    HEADY_WINDSURF = "true"
                }
                console = "integratedTerminal"
                remote = @{
                    host = $config.vmHost
                    user = $config.vmUser
                    workspace = "/home/$($config.vmUser)/heady-sync"
                }
            }
            @{
                name = "Debug HeadyBuddy on HeadyVM"
                type = "node"
                request = "attach"
                address = $config.vmHost
                port = 9229
                localRoot = $config.workspace
                remoteRoot = "/home/$($config.vmUser)/heady-sync"
            }
        )
    }
    
    $launchFile = Join-Path $configDir ".vscode/launch.json"
    $vscodeDir = Split-Path $launchFile -Parent
    if (-not (Test-Path $vscodeDir)) {
        New-Item -ItemType Directory -Path $vscodeDir -Force | Out-Null
    }
    
    $launchConfig | ConvertTo-Json -Depth 10 | Set-Content $launchFile
    
    Write-Log "Launch configuration created" "SUCCESS" "Green"
    
    # Create tasks configuration
    $tasksConfig = @{
        version = "2.0.0"
        tasks = @(
            @{
                label = "Sync to HeadyVM"
                type = "shell"
                command = "powershell"
                args = @(
                    "-ExecutionPolicy", "Bypass",
                    "-File", (Join-Path $config.workspace "scripts/headyvm-sync.ps1"),
                    "-Action", "sync"
                )
                group = "build"
                presentation = @{
                    echo = $true
                    reveal = "always"
                    focus = $false
                    panel = "shared"
                }
            }
            @{
                label = "Start HeadyVM Services"
                type = "shell"
                command = "ssh"
                args = @("$($config.vmUser)@$($config.vmHost)", "systemctl start heady-manager")
                group = "build"
                presentation = @{
                    echo = $true
                    reveal = "always"
                    focus = $false
                    panel = "shared"
                }
            }
            @{
                label = "Check HeadyVM Status"
                type = "shell"
                command = "ssh"
                args = @("$($config.vmUser)@$($config.vmHost)", "systemctl status heady-manager")
                group = "build"
                presentation = @{
                    echo = $true
                    reveal = "always"
                    focus = $false
                    panel = "shared"
                }
            }
        )
    }
    
    $tasksFile = Join-Path $configDir ".vscode/tasks.json"
    $tasksConfig | ConvertTo-Json -Depth 10 | Set-Content $tasksFile
    
    Write-Log "Tasks configuration created" "SUCCESS" "Green"
    
    # Create exclude file for sync
    $excludeFile = Join-Path $configDir "sync-exclude.txt"
    $config.sync.exclude | Set-Content $excludeFile
    
    Write-Log "Sync exclusion file created" "SUCCESS" "Green"
}

# Sync workspace
function Invoke-WorkspaceSync {
    Write-Log "Starting workspace sync..." "INFO"
    
    $syncScript = Join-Path $config.workspace "scripts/headyvm-sync.ps1"
    if (-not (Test-Path $syncScript)) {
        Write-Log "Sync script not found. Run setup first." "ERROR" "Red"
        return
    }
    
    try {
        & $syncScript -Action sync -Force:$Force
        Write-Log "Workspace sync completed" "SUCCESS" "Green"
    }
    catch {
        Write-Log "Sync failed: $($_.Exception.Message)" "ERROR" "Red"
    }
}

# Start HeadyVM services
function Start-HeadyVMServices {
    Write-Log "Starting HeadyVM services..." "INFO"
    
    foreach ($service in $config.services) {
        try {
            Invoke-SSH "systemctl start $($service.name)"
            Write-Log "Started $($service.name)" "SUCCESS" "Green"
        }
        catch {
            Write-Log "Failed to start $($service.name): $($_.Exception.Message)" "ERROR" "Red"
        }
    }
    
    # Wait for services to be ready
    Write-Log "Waiting for services to be ready..." "INFO"
    Start-Sleep -Seconds 5
    
    # Check service health
    foreach ($service in $config.services) {
        try {
            $response = Invoke-WebRequest -Uri "http://$($config.vmHost):$($service.port)$($service.health)" -TimeoutSec 10
            if ($response.StatusCode -eq 200) {
                Write-Log "$($service.name): HEALTHY" "SUCCESS" "Green"
            } else {
                Write-Log "$($service.name): UNHEALTHY ($($response.StatusCode))" "WARNING" "Yellow"
            }
        }
        catch {
            Write-Log "$($service.name): NOT RESPONDING" "ERROR" "Red"
        }
    }
}

# Stop HeadyVM services
function Stop-HeadyVMServices {
    Write-Log "Stopping HeadyVM services..." "INFO"
    
    foreach ($service in $config.services) {
        try {
            Invoke-SSH "systemctl stop $($service.name)"
            Write-Log "Stopped $($service.name)" "SUCCESS" "Green"
        }
        catch {
            Write-Log "Failed to stop $($service.name): $($_.Exception.Message)" "ERROR" "Red"
        }
    }
}

# Check status
function Get-HeadyVMStatus {
    Write-Log "Checking HeadyVM status..." "INFO"
    
    # System status
    try {
        $uptime = Invoke-SSH "uptime -p"
        $memory = Invoke-SSH "free -h | grep Mem"
        $disk = Invoke-SSH "df -h / | tail -1"
        
        Write-Log "System Status:" "INFO" "Cyan"
        Write-Log "  Uptime: $uptime" "INFO"
        Write-Log "  Memory: $memory" "INFO"
        Write-Log "  Disk: $disk" "INFO"
    }
    catch {
        Write-Log "Failed to get system status: $($_.Exception.Message)" "ERROR" "Red"
    }
    
    # Service status
    Write-Log "Service Status:" "INFO" "Cyan"
    foreach ($service in $config.services) {
        try {
            $status = Invoke-SSH "systemctl is-active $($service.name)"
            $enabled = Invoke-SSH "systemctl is-enabled $($service.name)"
            
            $statusColor = switch($status) {
                "active" { "Green" }
                "inactive" { "Yellow" }
                "failed" { "Red" }
                default { "White" }
            }
            
            Write-Log "  $($service.name): $status ($enabled)" "INFO" $statusColor
        }
        catch {
            Write-Log "  $($service.name): UNKNOWN" "ERROR" "Red"
        }
    }
    
    # Network status
    Write-Log "Network Status:" "INFO" "Cyan"
    foreach ($service in $config.services) {
        try {
            $response = Invoke-WebRequest -Uri "http://$($config.vmHost):$($service.port)$($service.health)" -TimeoutSec 5
            if ($response.StatusCode -eq 200) {
                Write-Log "  $($service.name) ($($service.port)): RESPONDING" "SUCCESS" "Green"
            } else {
                Write-Log "  $($service.name) ($($service.port)): ERROR ($($response.StatusCode))" "WARNING" "Yellow"
            }
        }
        catch {
            Write-Log "  $($service.name) ($($service.port)): NOT RESPONDING" "ERROR" "Red"
        }
    }
}

# Monitor HeadyVM
function Start-HeadyVMMonitor {
    Write-Log "Starting HeadyVM monitoring..." "INFO"
    Write-Log "Press Ctrl+C to stop monitoring" "INFO"
    
    try {
        while ($true) {
            Clear-Host
            Write-Log "=== HeadyVM Monitor ===" "INFO" "Cyan"
            Write-Log "Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" "INFO"
            Write-Log ""
            
            # System metrics
            try {
                $cpu = Invoke-SSH "top -bn1 | grep 'Cpu(s)' | awk '{print \$2}' | cut -d'%' -f1"
                $mem = Invoke-SSH "free | grep Mem | awk '{printf(\"%.1f\", \$3/\$2 * 100.0)}'"
                $disk = Invoke-SSH "df -h / | awk 'NR==2 {print \$5}' | cut -d'%' -f1"
                
                Write-Log "System Metrics:" "INFO" "Cyan"
                Write-Log "  CPU: ${cpu}% $(if ([double]$cpu -gt 80) { Write-Host "⚠️" -ForegroundColor Yellow } else { Write-Host "✅" -ForegroundColor Green })"
                Write-Log "  Memory: ${mem}% $(if ([double]$mem -gt 85) { Write-Host "⚠️" -ForegroundColor Yellow } else { Write-Host "✅" -ForegroundColor Green })"
                Write-Log "  Disk: ${disk}% $(if ([int]$disk -gt 90) { Write-Host "⚠️" -ForegroundColor Yellow } else { Write-Host "✅" -ForegroundColor Green })"
            }
            catch {
                Write-Log "Failed to get system metrics" "ERROR" "Red"
            }
            
            Write-Log ""
            
            # Service status
            Write-Log "Services:" "INFO" "Cyan"
            foreach ($service in $config.services) {
                try {
                    $status = Invoke-SSH "systemctl is-active $($service.name)"
                    $icon = switch($status) {
                        "active" { "✅" }
                        "inactive" { "⏸️" }
                        "failed" { "❌" }
                        default { "❓" }
                    }
                    Write-Log "  $icon $($service.name): $status" "INFO"
                }
                catch {
                    Write-Log "  ❓ $($service.name): UNKNOWN" "ERROR"
                }
            }
            
            Write-Log ""
            Write-Log "Next update in 30 seconds..." "INFO" "Gray"
            
            Start-Sleep -Seconds 30
        }
    }
    catch {
        Write-Log "Monitoring stopped" "INFO"
    }
}

# Restart services
function Restart-HeadyVMServices {
    Write-Log "Restarting HeadyVM services..." "INFO"
    
    Stop-HeadyVMServices
    Start-Sleep -Seconds 2
    Start-HeadyVMServices
}

# Main execution
function Main {
    Write-Log "🚀 HeadyVM Windsurf Integration" "INFO" "Cyan"
    Write-Log "Action: $Action" "INFO"
    Write-Log "Workspace: $($config.workspace)" "INFO"
    Write-Log "HeadyVM: $($config.vmHost)" "INFO"
    Write-Log ""
    
    try {
        switch ($Action) {
            'setup' {
                Set-WindsurfSetup
                Write-Log ""
                Write-Log "Setup completed! Next steps:" "SUCCESS" "Green"
                Write-Log "1. Open Windsurf and load the workspace" "INFO"
                Write-Log "2. Run: .\scripts\headyvm-windsurf-integration.ps1 -Action start" "INFO"
                Write-Log "3. Run: .\scripts\headyvm-windsurf-integration.ps1 -Action sync" "INFO"
            }
            
            'sync' {
                Invoke-WorkspaceSync
            }
            
            'start' {
                Start-HeadyVMServices
            }
            
            'stop' {
                Stop-HeadyVMServices
            }
            
            'status' {
                Get-HeadyVMStatus
            }
            
            'monitor' {
                Start-HeadyVMMonitor
            }
            
            'restart' {
                Restart-HeadyVMServices
            }
        }
        
        Write-Log ""
        Write-Log "✅ Action '$Action' completed" "SUCCESS" "Green"
    }
    catch {
        Write-Log ""
        Write-Log "❌ Action '$Action' failed: $($_.Exception.Message)" "ERROR" "Red"
        exit 1
    }
}

# Execute main function
Main
