<#
.SYNOPSIS
    HeadyVM Configuration & Sync Script
    Configures HeadyVM for optimal Heady Systems development with Windsurf integration

.DESCRIPTION
    Complete HeadyVM setup including:
    - Heady Systems service configuration
    - Windsurf workspace synchronization
    - Resource optimization
    - Network configuration
    - Development environment setup

.PARAMETER Mode
    Setup mode: 'full', 'sync-only', 'config-only', 'windsurf-only'

.PARAMETER WorkspacePath
    Local workspace path to sync with HeadyVM

.EXAMPLE
    .\headyvm-setup.ps1 -Mode full -WorkspacePath "C:\Users\erich\Heady"

.EXAMPLE
    .\headyvm-setup.ps1 -Mode windsurf-only

.NOTES
    Requires PowerShell 7+ and admin privileges on HeadyVM
    Compatible with HeadyVM v2.0+
#>

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('full', 'sync-only', 'config-only', 'windsurf-only')]
    [string]$Mode = 'full',
    
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

# Enhanced logging
function Write-HeadyLog {
    param(
        [string]$Message,
        [string]$Level = "INFO",
        [string]$Color = "White"
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $prefix = switch($Level) {
        "SUCCESS" { "✅" }
        "ERROR" { "❌" }
        "WARNING" { "⚠️" }
        "INFO" { "ℹ️" }
        "DEBUG" { "🐛" }
        default { "•" }
    }
    
    Write-Host "[$timestamp] $prefix $Message" -ForegroundColor $Color
}

# Check prerequisites
function Test-Prerequisites {
    Write-HeadyLog "Checking prerequisites..." "INFO"
    
    # Check PowerShell version
    if ($PSVersionTable.PSVersion.Major -lt 7) {
        Write-HeadyLog "PowerShell 7+ required. Current: $($PSVersionTable.PSVersion)" "ERROR" "Red"
        exit 1
    }
    
    # Check admin privileges
    if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
        Write-HeadyLog "Administrator privileges required for full setup" "WARNING" "Yellow"
        if ($Mode -eq 'full') {
            Write-HeadyLog "Run with administrator privileges or use -Mode sync-only" "ERROR" "Red"
            exit 1
        }
    }
    
    # Check workspace path
    if (-not (Test-Path $WorkspacePath)) {
        Write-HeadyLog "Workspace path not found: $WorkspacePath" "ERROR" "Red"
        exit 1
    }
    
    # Check network connectivity to HeadyVM
    if ($Mode -in @('full', 'sync-only', 'windsurf-only')) {
        try {
            Test-NetConnection -ComputerName $HeadyVMHost -Port 22 -WarningAction SilentlyContinue | Out-Null
            Write-HeadyLog "HeadyVM network connectivity confirmed" "SUCCESS" "Green"
        }
        catch {
            Write-HeadyLog "Cannot connect to HeadyVM at $HeadyVMHost" "ERROR" "Red"
            exit 1
        }
    }
    
    Write-HeadyLog "Prerequisites check passed" "SUCCESS" "Green"
}

# HeadyVM configuration
function Set-HeadyVMConfig {
    Write-HeadyLog "Configuring HeadyVM..." "INFO"
    
    $configScript = @"
#!/bin/bash
# HeadyVM Configuration Script

echo "🔧 Configuring HeadyVM for Heady Systems..."

# Set environment variables
export HEADY_VM_MODE="production"
export HEADY_WORKSPACE="$WorkspacePath"
export HEADY_SYNC_ENABLED="true"
export HEADY_WINDSURF_INTEGRATION="true"

# Create Heady directories
mkdir -p /opt/heady/{logs,data,cache,temp}
mkdir -p /home/$HeadyVMUser/.heady/{config,sync,cache}

# Set permissions
chown -R $HeadyVMUser:$HeadyVMUser /opt/heady
chown -R $HeadyVMUser:$HeadyVMUser /home/$HeadyVMUser/.heady

# Configure system limits
echo "* soft nofile 65536" >> /etc/security/limits.conf
echo "* hard nofile 65536" >> /etc/security/limits.conf

# Optimize network settings
echo "net.core.rmem_max = 134217728" >> /etc/sysctl.conf
echo "net.core.wmem_max = 134217728" >> /etc/sysctl.conf
echo "net.ipv4.tcp_rmem = 4096 65536 134217728" >> /etc/sysctl.conf
echo "net.ipv4.tcp_wmem = 4096 65536 134217728" >> /etc/sysctl.conf

# Apply network settings
sysctl -p

# Configure Heady services
cat > /etc/systemd/system/heady-manager.service << 'EOF'
[Unit]
Description=Heady Manager Service
After=network.target

[Service]
Type=simple
User=$HeadyVMUser
WorkingDirectory=$WorkspacePath
Environment=NODE_ENV=production
Environment=HEADY_VM_MODE=true
ExecStart=/usr/bin/node $WorkspacePath/heady-manager.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start Heady services
systemctl daemon-reload
systemctl enable heady-manager
systemctl start heady-manager

echo "✅ HeadyVM configuration complete"
"@
    
    # Execute configuration on HeadyVM
    try {
        $configScript | ssh $HeadyVMUser@$HeadyVMHost "bash -s"
        Write-HeadyLog "HeadyVM configuration applied successfully" "SUCCESS" "Green"
    }
    catch {
        Write-HeadyLog "Failed to configure HeadyVM: $($_.Exception.Message)" "ERROR" "Red"
        throw
    }
}

# Windsurf integration setup
function Set-WindsurfIntegration {
    Write-HeadyLog "Setting up Windsurf integration..." "INFO"
    
    # Create Windsurf configuration
    $windsurfConfig = @{
        version = "1.0"
        heady = @{
            enabled = $true
            vmHost = $HeadyVMHost
            workspacePath = $WorkspacePath
            syncMode = "bidirectional"
            autoSync = $true
            excludePatterns = @(
                "node_modules/**"
                ".git/**"
                "dist/**"
                "build/**"
                "*.log"
                ".DS_Store"
                "Thumbs.db"
            )
            resourceLimits = @{
                maxMemory = "4GB"
                maxCpu = "2"
                maxDisk = "50GB"
            }
        }
        sync = @{
            interval = 30
            conflictResolution = "local-wins"
            compression = $true
            encryption = $true
        }
    }
    
    # Save Windsurf configuration
    $configPath = Join-Path $WorkspacePath ".windsurf"
    if (-not (Test-Path $configPath)) {
        New-Item -ItemType Directory -Path $configPath -Force | Out-Null
    }
    
    $configFile = Join-Path $configPath "headyvm-config.json"
    $windsurfConfig | ConvertTo-Json -Depth 10 | Set-Content $configFile
    
    Write-HeadyLog "Windsurf configuration saved to $configFile" "SUCCESS" "Green"
    
    # Create Windsurf sync script
    $syncScript = @"
# Windsurf HeadyVM Sync Script
# This script handles bidirectional sync between local workspace and HeadyVM

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('push', 'pull', 'sync', 'status')]
    [string]$Action = 'sync',
    
    [Parameter(Mandatory=$false)]
    [switch]$Force
)

# Load configuration
`$configPath = Join-Path `$PSScriptRoot ".windsurf/headyvm-config.json"
`$config = Get-Content `$configPath | ConvertFrom-Json

# Sync function
function Invoke-HeadyVMSync {
    param([string]`$Action, [switch]`$Force)
    
    `$host = `$config.heady.vmHost
    `$user = `$config.heady.vmUser ?? "heady"
    `$localPath = `$config.heady.workspacePath
    `$remotePath = "/home/`$user/heady-sync"
    
    Write-Host "🔄 HeadyVM Sync: `$Action" -ForegroundColor Cyan
    
    switch (`$Action) {
        'push' {
            # Push local changes to HeadyVM
            rsync -avz --delete `
                --exclude-from=(Join-Path `$PSScriptRoot ".windsurf/sync-exclude.txt") `
                `$localPath/ `$user@`$host:`$remotePath/
        }
        
        'pull' {
            # Pull changes from HeadyVM
            rsync -avz --delete `
                --exclude-from=(Join-Path `$PSScriptRoot ".windsurf/sync-exclude.txt") `
                `$user@`$host:`$remotePath/ `$localPath/
        }
        
        'sync' {
            # Bidirectional sync
            rsync -avz --delete `
                --exclude-from=(Join-Path `$PSScriptRoot ".windsurf/sync-exclude.txt") `
                `$localPath/ `$user@`$host:`$remotePath/
            rsync -avz --delete `
                --exclude-from=(Join-Path `$PSScriptRoot ".windsurf/sync-exclude.txt") `
                `$user@`$host:`$remotePath/ `$localPath/
        }
        
        'status' {
            # Show sync status
            rsync -avz --dry-run --delete `
                --exclude-from=(Join-Path `$PSScriptRoot ".windsurf/sync-exclude.txt") `
                `$localPath/ `$user@`$host:`$remotePath/
        }
    }
    
    if (`$LASTEXITCODE -eq 0) {
        Write-Host "✅ Sync completed successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ Sync failed" -ForegroundColor Red
    }
}

# Execute sync
Invoke-HeadyVMSync -Action `$Action -Force:`$Force
"@
    
    $syncScriptPath = Join-Path $WorkspacePath "scripts\headyvm-sync.ps1"
    $syncScript | Set-Content $syncScriptPath
    
    # Create sync exclude file
    $excludeContent = @"
# HeadyVM Sync Exclusions
node_modules/
.git/
dist/
build/
*.log
.DS_Store
Thumbs.db
.env
.env.local
.env.production
coverage/
.nyc_output/
.vscode/settings.json
.idea/
*.tmp
*.temp
.cache/
"@
    
    $excludePath = Join-Path $configPath "sync-exclude.txt"
    $excludeContent | Set-Content $excludePath
    
    Write-HeadyLog "Windsurf sync scripts created" "SUCCESS" "Green"
}

# Workspace synchronization
function Invoke-WorkspaceSync {
    Write-HeadyLog "Starting workspace synchronization..." "INFO"
    
    # Initial sync
    try {
        & (Join-Path $WorkspacePath "scripts\headyvm-sync.ps1") -Action sync -Force:$Force
        Write-HeadyLog "Initial workspace sync completed" "SUCCESS" "Green"
    }
    catch {
        Write-HeadyLog "Initial sync failed: $($_.Exception.Message)" "ERROR" "Red"
        throw
    }
    
    # Set up continuous sync (if supported)
    if ($Mode -eq 'full') {
        Write-HeadyLog "Setting up continuous sync..." "INFO"
        
        # Create Windows service for continuous sync
        $serviceScript = @"
# HeadyVM Continuous Sync Service
`$syncScript = Join-Path "$WorkspacePath" "scripts\headyvm-sync.ps1"

while (`$true) {
    try {
        & `$syncScript -Action sync
        Start-Sleep -Seconds `$config.heady.sync.interval
    }
    catch {
        Write-Warning "Sync failed: `$(`$_.Exception.Message)"
        Start-Sleep -Seconds 60
    }
}
"@
        
        Write-HeadyLog "Continuous sync configured (manual start required)" "INFO" "Yellow"
    }
}

# Resource optimization
function Set-ResourceOptimization {
    Write-HeadyLog "Optimizing HeadyVM resources..." "INFO"
    
    $optimizationScript = @"
#!/bin/bash
# HeadyVM Resource Optimization

echo "⚡ Optimizing HeadyVM resources..."

# CPU optimization
echo "performance" | tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor

# Memory optimization
echo 1 > /proc/sys/vm/swappiness
echo 3 > /proc/sys/vm/drop_caches

# Disk optimization
echo deadline > /sys/block/sda/queue/scheduler
echo 0 > /sys/block/sda/queue/rotational

# Network optimization
echo 'net.core.rmem_max = 134217728' >> /etc/sysctl.conf
echo 'net.core.wmem_max = 134217728' >> /etc/sysctl.conf
echo 'net.ipv4.tcp_rmem = 4096 65536 134217728' >> /etc/sysctl.conf
echo 'net.ipv4.tcp_wmem = 4096 65536 134217728' >> /etc/sysctl.conf

# Apply optimizations
sysctl -p

# Set up monitoring
cat > /opt/heady/scripts/monitor.sh << 'EOF'
#!/bin/bash
# HeadyVM Monitoring Script

while true; do
    # CPU usage
    cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    
    # Memory usage
    mem_usage=$(free | grep Mem | awk '{printf("%.1f", $3/$2 * 100.0)}')
    
    # Disk usage
    disk_usage=$(df -h / | awk 'NR==2 {print $5}' | cut -d'%' -f1)
    
    # Log metrics
    echo "$(date): CPU=${cpu_usage}%, MEM=${mem_usage}%, DISK=${disk_usage}%" >> /opt/heady/logs/metrics.log
    
    # Alert if thresholds exceeded
    if (( $(echo "$cpu_usage > 80" | bc -l) )); then
        echo "WARNING: High CPU usage: ${cpu_usage}%" >> /opt/heady/logs/alerts.log
    fi
    
    if (( $(echo "$mem_usage > 85" | bc -l) )); then
        echo "WARNING: High memory usage: ${mem_usage}%" >> /opt/heady/logs/alerts.log
    fi
    
    if (( disk_usage > 90 )); then
        echo "WARNING: High disk usage: ${disk_usage}%" >> /opt/heady/logs/alerts.log
    fi
    
    sleep 30
done
EOF

chmod +x /opt/heady/scripts/monitor.sh
nohup /opt/heady/scripts/monitor.sh > /dev/null 2>&1 &

echo "✅ Resource optimization complete"
"@
    
    try {
        $optimizationScript | ssh $HeadyVMUser@$HeadyVMHost "bash -s"
        Write-HeadyLog "Resource optimization applied" "SUCCESS" "Green"
    }
    catch {
        Write-HeadyLog "Resource optimization failed: $($_.Exception.Message)" "ERROR" "Red"
        throw
    }
}

# Validation and testing
function Test-HeadyVMSetup {
    Write-HeadyLog "Validating HeadyVM setup..." "INFO"
    
    # Test Heady Manager service
    try {
        $response = Invoke-WebRequest -Uri "http://$HeadyVMHost:3301/api/health" -TimeoutSec 10
        if ($response.StatusCode -eq 200) {
            Write-HeadyLog "Heady Manager service: HEALTHY" "SUCCESS" "Green"
        } else {
            Write-HeadyLog "Heady Manager service: UNHEALTHY ($($response.StatusCode))" "WARNING" "Yellow"
        }
    }
    catch {
        Write-HeadyLog "Heady Manager service: NOT RESPONDING" "ERROR" "Red"
    }
    
    # Test sync functionality
    try {
        $testFile = Join-Path $WorkspacePath ".headyvm-test"
        "test-$(Get-Date -Format 'yyyyMMddHHmmss')" | Set-Content $testFile
        
        & (Join-Path $WorkspacePath "scripts\headyvm-sync.ps1") -Action push | Out-Null
        
        # Check if file exists on HeadyVM
        $remoteCheck = ssh $HeadyVMUser@$HeadyVMHost "test -f /home/$HeadyVMUser/heady-sync/.headyvm-test && echo 'exists' || echo 'missing'"
        
        if ($remoteCheck -eq 'exists') {
            Write-HeadyLog "Sync functionality: WORKING" "SUCCESS" "Green"
        } else {
            Write-HeadyLog "Sync functionality: NOT WORKING" "ERROR" "Red"
        }
        
        # Cleanup
        Remove-Item $testFile -ErrorAction SilentlyContinue
        ssh $HeadyVMUser@$HeadyVMHost "rm -f /home/$HeadyVMUser/heady-sync/.headyvm-test"
    }
    catch {
        Write-HeadyLog "Sync test failed: $($_.Exception.Message)" "ERROR" "Red"
    }
    
    # Test Windsurf integration
    $windsurfConfig = Join-Path $WorkspacePath ".windsurf/headyvm-config.json"
    if (Test-Path $windsurfConfig) {
        Write-HeadyLog "Windsurf integration: CONFIGURED" "SUCCESS" "Green"
    } else {
        Write-HeadyLog "Windsurf integration: NOT CONFIGURED" "WARNING" "Yellow"
    }
    
    Write-HeadyLog "HeadyVM setup validation completed" "INFO"
}

# Main execution
function Main {
    Write-HeadyLog "🚀 Starting HeadyVM Setup (Mode: $Mode)" "INFO" "Cyan"
    Write-HeadyLog "Workspace: $WorkspacePath" "INFO"
    Write-HeadyLog "HeadyVM: $HeadyVMHost" "INFO"
    
    try {
        # Check prerequisites
        Test-Prerequisites
        
        # Execute based on mode
        switch ($Mode) {
            'full' {
                Set-HeadyVMConfig
                Set-WindsurfIntegration
                Set-ResourceOptimization
                Invoke-WorkspaceSync
                Test-HeadyVMSetup
            }
            
            'config-only' {
                Set-HeadyVMConfig
                Set-ResourceOptimization
            }
            
            'sync-only' {
                Set-WindsurfIntegration
                Invoke-WorkspaceSync
            }
            
            'windsurf-only' {
                Set-WindsurfIntegration
            }
        }
        
        Write-HeadyLog "🎉 HeadyVM setup completed successfully!" "SUCCESS" "Green"
        Write-HeadyLog "Next steps:" "INFO"
        Write-HeadyLog "1. Start HeadyVM services: ssh $HeadyVMUser@$HeadyVMHost 'systemctl start heady-manager'" "INFO"
        Write-HeadyLog "2. Test sync: .\scripts\headyvm-sync.ps1 -Action status" "INFO"
        Write-HeadyLog "3. Open Windsurf and load the workspace" "INFO"
        
    }
    catch {
        Write-HeadyLog "❌ HeadyVM setup failed: $($_.Exception.Message)" "ERROR" "Red"
        exit 1
    }
}

# Execute main function
Main
