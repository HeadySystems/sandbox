# HEADY_BRAND:BEGIN
# ╔══════════════════════════════════════════════════════════════════╗
# ║  Heady Project: Simple Mobile App Installer                     ║
# ║  "Install HeadyBuddy and HeadyWeb on Android Device"           ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END

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

# Check device connection
Write-Status "=== Heady Mobile App Installation ===" "Success"
Write-Status "Checking for connected Android devices..." "Info"

$devices = adb devices
$connectedDevices = @($devices | Where-Object { $_ -match "\tdevice$" })

if ($connectedDevices.Count -eq 0) {
    Write-Status "No Android devices connected!" "Error"
    Write-Status "Please:" "Info"
    Write-Status "1. Connect your phone via USB" "White"
    Write-Status "2. Enable USB debugging in Developer Options" "White"
    Write-Status "3. Allow USB debugging authorization on phone" "White"
    Write-Status "4. Run this script again" "White"
    exit 1
}

Write-Status "Found $($connectedDevices.Count) connected device(s)" "Success"

# Build HeadyBuddy
Write-Status ""
Write-Status "=== Building HeadyBuddy ===" "Success"

$buddyPath = "C:\Users\erich\Heady\headybuddy-mobile"
if (-not (Test-Path $buddyPath)) {
    Write-Status "HeadyBuddy source not found!" "Error"
    exit 1
}

Push-Location $buddyPath
try {
    Write-Status "Running Gradle build..." "Info"
    & .\gradlew-fixed.bat assembleDebug
    
    if ($LASTEXITCODE -eq 0) {
        $apkPath = "app\build\outputs\apk\debug\app-debug.apk"
        if (Test-Path $apkPath) {
            Write-Status "✓ HeadyBuddy APK built successfully" "Success"
            $buddyApk = (Resolve-Path $apkPath).Path
        } else {
            Write-Status "APK not found after build!" "Error"
            exit 1
        }
    } else {
        Write-Status "HeadyBuddy build failed!" "Error"
        exit 1
    }
} finally {
    Pop-Location
}

# Install HeadyBuddy
Write-Status ""
Write-Status "=== Installing HeadyBuddy ===" "Success"

Write-Status "Installing HeadyBuddy to device..." "Info"
$installResult = adb install -r $buddyApk

if ($LASTEXITCODE -eq 0) {
    Write-Status "✓ HeadyBuddy installed successfully!" "Success"
} else {
    Write-Status "HeadyBuddy installation failed!" "Error"
    exit 1
}

# Check HeadyWeb
Write-Status ""
Write-Status "=== Checking HeadyWeb ===" "Info"

$webPath = "C:\Users\erich\Heady\apps\mobile\HeadyWeb"
if (Test-Path $webPath) {
    Write-Status "HeadyWeb source found, but React Native builds require additional setup" "Warning"
    Write-Status "Skipping HeadyWeb for now (requires Metro bundler configuration)" "Info"
} else {
    Write-Status "HeadyWeb source not found" "Warning"
}

Write-Status ""
Write-Status "=== Installation Complete ===" "Success"
Write-Status "✓ HeadyBuddy Mobile installed on your device!" "Success"
Write-Status ""
Write-Status "Next steps on your phone:" "Info"
Write-Status "1. Find and open HeadyBuddy app" "White"
Write-Status "2. Grant permissions when prompted" "White"
Write-Status "3. Configure battery optimization:" "White"
Write-Status "   Settings → Battery → Battery Optimization → HeadyBuddy → Don't Optimize" "White"
Write-Status "4. Lock app in Recent Apps for background operation" "White"
Write-Status ""
Write-Status "Enjoy your always-on AI companion!" "Success"
