<#
.SYNOPSIS
    HeadyVM Quick Start Script
    One-click setup for HeadyVM + Windsurf development

.DESCRIPTION
    This script provides a quick start experience for HeadyVM development
    with Windsurf IDE integration. Perfect for new setups or quick resets.

.EXAMPLE
    .\headyvm-quick-start.ps1

.NOTES
    This script will:
    1. Set up HeadyVM configuration
    2. Configure Windsurf integration
    3. Start all services
    4. Perform initial sync
    5. Open Windsurf with the workspace
#>

param(
    [Parameter(Mandatory=$false)]
    [string]$WorkspacePath = "C:\Users\erich\Heady",
    
    [Parameter(Mandatory=$false)]
    [string]$HeadyVMHost = "headyvm.local",
    
    [Parameter(Mandatory=$false)]
    [string]$HeadyVMUser = "heady",
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipWindsurf,
    
    [Parameter(Mandatory=$false)]
    [switch]$Force
)

# Colorful logging
function Write-Step {
    param([string]$Message, [string]$Color = "Cyan")
    Write-Host "🔸 $Message" -ForegroundColor $Color
}

function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠️ $Message" -ForegroundColor Yellow
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ️ $Message" -ForegroundColor White
}

# Progress indicator
function Show-Progress {
    param(
        [string]$Activity,
        [string]$Status,
        [int]$PercentComplete
    )
    
    Write-Progress -Activity $Activity -Status $Status -PercentComplete $PercentComplete
}

# Check prerequisites
function Test-QuickStartPrerequisites {
    Write-Step "Checking prerequisites..."
    
    # Check if workspace exists
    if (-not (Test-Path $WorkspacePath)) {
        Write-Error "Workspace path not found: $WorkspacePath"
        return $false
    }
    
    # Check if HeadyVM is reachable
    try {
        Test-NetConnection -ComputerName $HeadyVMHost -Port 22 -WarningAction SilentlyContinue | Out-Null
        Write-Success "HeadyVM is reachable"
    }
    catch {
        Write-Error "Cannot connect to HeadyVM at $HeadyVMHost"
        Write-Info "Make sure HeadyVM is running and SSH is enabled"
        return $false
    }
    
    # Check if required scripts exist
    $requiredScripts = @(
        "headyvm-setup.ps1",
        "headyvm-windsurf-integration.ps1",
        "headyvm-sync.ps1"
    )
    
    foreach ($script in $requiredScripts) {
        $scriptPath = Join-Path $WorkspacePath "scripts\$script"
        if (-not (Test-Path $scriptPath)) {
            Write-Error "Required script not found: $script"
            return $false
        }
    }
    
    Write-Success "Prerequisites check passed"
    return $true
}

# Quick setup
function Invoke-QuickSetup {
    Write-Step "Running HeadyVM quick setup..."
    Show-Progress "HeadyVM Setup" "Configuring HeadyVM..." 10
    
    try {
        $setupScript = Join-Path $WorkspacePath "scripts\headyvm-setup.ps1"
        & $setupScript -Mode config-only -WorkspacePath $WorkspacePath -HeadyVMHost $HeadyVMHost -HeadyVMUser $HeadyVMUser -Force:$Force
        
        Show-Progress "HeadyVM Setup" "HeadyVM configured" 30
        Write-Success "HeadyVM configuration completed"
    }
    catch {
        Write-Error "HeadyVM setup failed: $($_.Exception.Message)"
        return $false
    }
    
    return $true
}

# Windsurf integration
function Invoke-WindsurfIntegration {
    if ($SkipWindsurf) {
        Write-Warning "Skipping Windsurf integration"
        return $true
    }
    
    Write-Step "Setting up Windsurf integration..."
    Show-Progress "Windsurf Integration" "Configuring Windsurf..." 40
    
    try {
        $integrationScript = Join-Path $WorkspacePath "scripts\headyvm-windsurf-integration.ps1"
        & $integrationScript -Action setup -WorkspacePath $WorkspacePath -HeadyVMHost $HeadyVMHost -HeadyVMUser $HeadyVMUser -Force:$Force
        
        Show-Progress "Windsurf Integration" "Windsurf configured" 60
        Write-Success "Windsurf integration completed"
    }
    catch {
        Write-Error "Windsurf integration failed: $($_.Exception.Message)"
        return $false
    }
    
    return $true
}

# Start services
function Start-Services {
    Write-Step "Starting HeadyVM services..."
    Show-Progress "Services" "Starting services..." 70
    
    try {
        $integrationScript = Join-Path $WorkspacePath "scripts\headyvm-windsurf-integration.ps1"
        & $integrationScript -Action start -WorkspacePath $WorkspacePath -HeadyVMHost $HeadyVMHost -HeadyVMUser $HeadyVMUser
        
        Show-Progress "Services" "Services started" 80
        Write-Success "HeadyVM services started"
    }
    catch {
        Write-Error "Failed to start services: $($_.Exception.Message)"
        return $false
    }
    
    return $true
}

# Initial sync
function Invoke-InitialSync {
    Write-Step "Performing initial workspace sync..."
    Show-Progress "Sync" "Syncing workspace..." 85
    
    try {
        $syncScript = Join-Path $WorkspacePath "scripts\headyvm-sync.ps1"
        & $syncScript -Action sync -Force:$Force
        
        Show-Progress "Sync" "Workspace synced" 90
        Write-Success "Initial sync completed"
    }
    catch {
        Write-Error "Initial sync failed: $($_.Exception.Message)"
        return $false
    }
    
    return $true
}

# Open Windsurf
function Open-Windsurf {
    if ($SkipWindsurf) {
        Write-Warning "Skipping Windsurf launch"
        return $true
    }
    
    Write-Step "Opening Windsurf..."
    Show-Progress "Windsurf" "Launching Windsurf..." 95
    
    try {
        # Check if Windsurf is installed
        $windsurfCmd = Get-Command "windsurf" -ErrorAction SilentlyContinue
        if ($windsurfCmd) {
            Start-Process "windsurf" -ArgumentList $WorkspacePath
            Write-Success "Windsurf launched"
        } else {
            Write-Warning "Windsurf not found in PATH"
            Write-Info "Please install Windsurf or launch it manually"
            Write-Info "Workspace path: $WorkspacePath"
        }
        
        Show-Progress "Windsurf" "Windsurf ready" 100
    }
    catch {
        Write-Error "Failed to launch Windsurf: $($_.Exception.Message)"
        return $false
    }
    
    return $true
}

# Final verification
function Test-Setup {
    Write-Step "Verifying setup..."
    
    # Check HeadyVM connectivity
    try {
        $response = Invoke-WebRequest -Uri "http://$HeadyVMHost:3301/api/health" -TimeoutSec 10
        if ($response.StatusCode -eq 200) {
            Write-Success "HeadyVM is responding"
        } else {
            Write-Warning "HeadyVM returned status $($response.StatusCode)"
        }
    }
    catch {
        Write-Error "HeadyVM is not responding"
        return $false
    }
    
    # Check sync status
    try {
        $syncScript = Join-Path $WorkspacePath "scripts\headyvm-sync.ps1"
        & $syncScript -Action status | Out-Null
        Write-Success "Sync is working"
    }
    catch {
        Write-Warning "Sync may have issues"
    }
    
    # Check configuration files
    $configFiles = @(
        ".windsurf/headyvm-workspace.json",
        ".windsurf/headyvm-config.json",
        ".windsurf/sync-exclude.txt"
    )
    
    foreach ($file in $configFiles) {
        $filePath = Join-Path $WorkspacePath $file
        if (Test-Path $filePath) {
            Write-Success "Configuration file exists: $file"
        } else {
            Write-Warning "Configuration file missing: $file"
        }
    }
    
    return $true
}

# Display next steps
function Show-NextSteps {
    Write-Step "Setup completed! 🎉" "Green"
    Write-Host ""
    Write-Host "📋 Next Steps:" -ForegroundColor Cyan
    Write-Host "1. Windsurf should now be open with your workspace" -ForegroundColor White
    Write-Host "2. Use the integrated terminal to run commands" -ForegroundColor White
    Write-Host "3. Check service status: .\scripts\headyvm-windsurf-integration.ps1 -Action status" -ForegroundColor White
    Write-Host "4. Sync changes: .\scripts\headyvm-sync.ps1 -Action sync" -ForegroundColor White
    Write-Host "5. Monitor HeadyVM: .\scripts\headyvm-windsurf-integration.ps1 -Action monitor" -ForegroundColor White
    Write-Host ""
    Write-Host "🔧 Useful Commands:" -ForegroundColor Cyan
    Write-Host "• Sync workspace: .\scripts\headyvm-sync.ps1 -Action sync" -ForegroundColor Gray
    Write-Host "• Check status: .\scripts\headyvm-windsurf-integration.ps1 -Action status" -ForegroundColor Gray
    Write-Host "• Start services: .\scripts\headyvm-windsurf-integration.ps1 -Action start" -ForegroundColor Gray
    Write-Host "• Stop services: .\scripts\headyvm-windsurf-integration.ps1 -Action stop" -ForegroundColor Gray
    Write-Host "• Monitor: .\scripts\headyvm-windsurf-integration.ps1 -Action monitor" -ForegroundColor Gray
    Write-Host ""
    Write-Host "🌐 Access Points:" -ForegroundColor Cyan
    Write-Host "• Heady Manager: http://$HeadyVMHost:3301" -ForegroundColor White
    Write-Host "• Health Check: http://$HeadyVMHost:3301/api/health" -ForegroundColor White
    Write-Host "• Brain API: http://$HeadyVMHost:3301/api/brain/health" -ForegroundColor White
    Write-Host ""
    Write-Host "📚 Documentation:" -ForegroundColor Cyan
    Write-Host "• HeadyVM Guide: $WorkspacePath\docs\HeadyVM-Guide.md" -ForegroundColor Gray
    Write-Host "• Windsurf Integration: $WorkspacePath\docs\Windsurf-Integration.md" -ForegroundColor Gray
    Write-Host "• Troubleshooting: $WorkspacePath\docs\HeadyVM-Troubleshooting.md" -ForegroundColor Gray
}

# Main execution
function Main {
    Clear-Host
    Write-Host "🚀 HeadyVM Quick Start" -ForegroundColor Cyan
    Write-Host "====================" -ForegroundColor Cyan
    Write-Host "Workspace: $WorkspacePath" -ForegroundColor White
    Write-Host "HeadyVM: $HeadyVMHost" -ForegroundColor White
    Write-Host ""
    
    $progress = 0
    
    # Step 1: Check prerequisites
    if (-not (Test-QuickStartPrerequisites)) {
        Write-Host ""
        Write-Error "Prerequisites check failed. Please resolve the issues above and try again."
        exit 1
    }
    $progress = 10
    
    # Step 2: Quick setup
    if (-not (Invoke-QuickSetup)) {
        Write-Host ""
        Write-Error "Setup failed. Please check the error messages above."
        exit 1
    }
    $progress = 30
    
    # Step 3: Windsurf integration
    if (-not (Invoke-WindsurfIntegration)) {
        Write-Host ""
        Write-Error "Windsurf integration failed."
        exit 1
    }
    $progress = 60
    
    # Step 4: Start services
    if (-not (Start-Services)) {
        Write-Host ""
        Write-Error "Service startup failed."
        exit 1
    }
    $progress = 80
    
    # Step 5: Initial sync
    if (-not (Invoke-InitialSync)) {
        Write-Host ""
        Write-Error "Initial sync failed."
        exit 1
    }
    $progress = 90
    
    # Step 6: Open Windsurf
    if (-not (Open-Windsurf)) {
        Write-Warning "Windsurf launch failed, but setup is complete"
    }
    $progress = 100
    
    # Step 7: Final verification
    Write-Host ""
    if (Test-Setup) {
        Show-NextSteps
        Write-Host ""
        Write-Success "HeadyVM Quick Start completed successfully! 🎉"
    } else {
        Write-Warning "Setup completed with some issues. Check the warnings above."
    }
}

# Error handling
trap {
    Write-Host ""
    Write-Error "An unexpected error occurred: $($_.Exception.Message)"
    Write-Host ""
    Write-Info "Please check:"
    Write-Info "• HeadyVM is running and accessible"
    Write-Info "• SSH keys are properly configured"
    Write-Info "• Workspace path is correct"
    Write-Info "• Required scripts are present"
    exit 1
}

# Execute main function
try {
    Main
}
catch {
    Write-Host ""
    Write-Error "Quick start failed: $($_.Exception.Message)"
    exit 1
}
