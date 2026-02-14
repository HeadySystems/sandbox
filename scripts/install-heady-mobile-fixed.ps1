# HEADY_BRAND:BEGIN
# ╔══════════════════════════════════════════════════════════════════╗
# ║  Heady Project: Mobile App Installation Script                   ║
# ║  "Install HeadyBuddy and HeadyWeb on OnePlus Open"              ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END

param(
    [switch]$Force,
    [switch]$Debug
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

function Test-Prerequisites {
    Write-Status "Checking prerequisites..." "Info"
    
    # Check Android SDK
    $sdkPath = $env:ANDROID_HOME
    if (-not $sdkPath) {
        $sdkPath = "$env:LOCALAPPDATA\Android\Sdk"
    }
    
    if (-not (Test-Path $sdkPath)) {
        Write-Status "Android SDK not found at $sdkPath" "Error"
        Write-Status "Please install Android Studio and set up Android SDK" "Error"
        return $false
    }
    
    Write-Status "✓ Android SDK found at $sdkPath" "Success"
    
    # Check ADB
    $adbPath = Join-Path $sdkPath "platform-tools\adb.exe"
    if (-not (Test-Path $adbPath)) {
        Write-Status "ADB not found at $adbPath" "Error"
        return $false
    }
    
    Write-Status "✓ ADB found" "Success"
    
    # Check Java
    try {
        $javaVersion = & java -version 2>&1
        Write-Status "✓ Java available" "Success"
    } catch {
        Write-Status "Java not found or not in PATH" "Error"
        return $false
    }
    
    # Check device connection
    $devices = & $adbPath devices
    $connectedDevices = @($devices | Where-Object { $_ -match "\tdevice$" })
    
    if ($connectedDevices.Count -eq 0) {
        Write-Status "No Android devices connected" "Warning"
        Write-Status "Please connect your OnePlus Open via USB with debugging enabled" "Warning"
        return $false
    }
    
    Write-Status "✓ Found $($connectedDevices.Count) connected device(s)" "Success"
    
    return $true
}

function Build-HeadyBuddy {
    Write-Status "Building HeadyBuddy Mobile..." "Info"
    
    $buddyPath = "C:\Users\erich\Heady\headybuddy-mobile"
    
    if (-not (Test-Path $buddyPath)) {
        Write-Status "HeadyBuddy Mobile source not found" "Error"
        return $false
    }
    
    Push-Location $buddyPath
    
    try {
        Write-Status "Running Gradle build..." "Info"
        
        # Use gradlew-fixed.bat
        $buildResult = & .\gradlew-fixed.bat assembleDebug
        
        if ($LASTEXITCODE -eq 0) {
            Write-Status "✓ HeadyBuddy build completed" "Success"
            
            $apkPath = "app\build\outputs\apk\debug\app-debug.apk"
            if (Test-Path $apkPath) {
                Write-Status "✓ APK generated: $apkPath" "Success"
                return $apkPath
            } else {
                Write-Status "APK not found at expected location" "Error"
                return $false
            }
        } else {
            Write-Status "HeadyBuddy build failed" "Error"
            return $false
        }
    } finally {
        Pop-Location
    }
}

function Build-HeadyWeb {
    Write-Status "Building HeadyWeb Mobile..." "Info"
    
    $webPath = "C:\Users\erich\Heady\apps\mobile\HeadyWeb"
    
    if (-not (Test-Path $webPath)) {
        Write-Status "HeadyWeb source not found" "Error"
        return $false
    }
    
    Push-Location $webPath
    
    try {
        Write-Status "Installing dependencies..." "Info"
        & npm install
        
        if ($LASTEXITCODE -ne 0) {
            Write-Status "npm install failed" "Error"
            return $false
        }
        
        Write-Status "Building Android APK..." "Info"
        
        # For React Native, we need to use Metro bundler and then build
        $buildResult = & npx react-native build-android --mode=debug
        
        if ($LASTEXITCODE -eq 0) {
            Write-Status "✓ HeadyWeb build completed" "Success"
            
            # React Native APK location
            $apkPath = "android\app\build\outputs\apk\debug\app-debug.apk"
            if (Test-Path $apkPath) {
                Write-Status "✓ APK generated: $apkPath" "Success"
                return $apkPath
            } else {
                Write-Status "APK not found at expected location, checking alternative paths..." "Warning"
                $altPaths = @(
                    "android\app\build\outputs\apk\debug\app-debug.apk",
                    "node_modules\react-native\android\app\build\outputs\apk\debug\app-debug.apk"
                )
                
                foreach ($path in $altPaths) {
                    if (Test-Path $path) {
                        Write-Status "✓ APK found at: $path" "Success"
                        return $path
                    }
                }
                
                Write-Status "HeadyWeb APK not found" "Error"
                return $false
            }
        } else {
            Write-Status "HeadyWeb build failed" "Error"
            return $false
        }
    } finally {
        Pop-Location
    }
}

function Install-APK {
    param([string]$ApkPath, [string]$AppName)
    
    $sdkPath = $env:ANDROID_HOME
    if (-not $sdkPath) {
        $sdkPath = "$env:LOCALAPPDATA\Android\Sdk"
    }
    
    $adbPath = Join-Path $sdkPath "platform-tools\adb.exe"
    
    Write-Status "Installing $AppName..." "Info"
    
    try {
        $installResult = & $adbPath install -r $ApkPath
        
        if ($LASTEXITCODE -eq 0) {
            Write-Status "✓ $AppName installed successfully" "Success"
            return $true
        } else {
            Write-Status "Failed to install $AppName" "Error"
            return $false
        }
    } catch {
        Write-Status "Error installing $AppName: $($_.Exception.Message)" "Error"
        return $false
    }
}

function Set-BatteryOptimization {
    Write-Status "Battery Optimization Setup Required" "Warning"
    Write-Status "For HeadyBuddy to work reliably:" "Info"
    Write-Status "1. Open Settings → Battery → Battery Optimization" "White"
    Write-Status "2. Find HeadyBuddy → Don't Optimize" "White"
    Write-Status "3. Settings → Apps → HeadyBuddy → Battery → Allow Background Activity" "White"
    Write-Status "4. Lock HeadyBuddy in Recent Apps (swipe down on card)" "White"
}

# Main execution
try {
    Write-Status "=== Heady Mobile App Installation ===" "Success"
    Write-Status "Installing HeadyBuddy and HeadyWeb on OnePlus Open" "Info"
    Write-Status ""
    
    if (-not (Test-Prerequisites)) {
        Write-Status "Prerequisites not met. Please fix issues and retry." "Error"
        exit 1
    }
    
    Write-Status ""
    Write-Status "=== Building Applications ===" "Success"
    
    # Build HeadyBuddy
    $buddyApk = Build-HeadyBuddy
    if (-not $buddyApk) {
        Write-Status "Failed to build HeadyBuddy" "Error"
        exit 1
    }
    
    # Build HeadyWeb
    $webApk = Build-HeadyWeb
    if (-not $webApk) {
        Write-Status "Failed to build HeadyWeb" "Warning"
        Write-Status "Continuing with HeadyBuddy only..." "Info"
    }
    
    Write-Status ""
    Write-Status "=== Installing Applications ===" "Success"
    
    # Install HeadyBuddy
    $buddyInstalled = Install-APK $buddyApk "HeadyBuddy"
    if (-not $buddyInstalled) {
        Write-Status "Failed to install HeadyBuddy" "Error"
        exit 1
    }
    
    # Install HeadyWeb if built successfully
    if ($webApk) {
        $webInstalled = Install-APK $webApk "HeadyWeb"
        if ($webInstalled) {
            Write-Status "✓ Both apps installed successfully" "Success"
        } else {
            Write-Status "HeadyWeb installation failed, but HeadyBuddy is installed" "Warning"
        }
    }
    
    Write-Status ""
    Write-Status "=== Post-Installation Setup ===" "Success"
    
    Set-BatteryOptimization
    
    Write-Status ""
    Write-Status "=== Installation Complete ===" "Success"
    Write-Status "✓ HeadyBuddy Mobile installed on your device" "Success"
    if ($webApk -and $webInstalled) {
        Write-Status "✓ HeadyWeb Mobile installed on your device" "Success"
    }
    Write-Status ""
    Write-Status "Next steps:" "Info"
    Write-Status "1. Open HeadyBuddy on your phone" "White"
    Write-Status "2. Grant required permissions (overlay, notifications)" "White"
    Write-Status "3. Configure battery optimization as shown above" "White"
    Write-Status "4. Enjoy your always-on AI companion!" "White"
    
} catch {
    Write-Status "Installation failed: $($_.Exception.Message)" "Error"
    Write-Status "Stack trace: $($_.ScriptStackTrace)" "Error"
    exit 1
}
