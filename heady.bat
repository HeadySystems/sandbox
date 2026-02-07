@echo off
REM Heady Master Control Script
REM Unified command interface for all Heady operations

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║           HEADY MASTER CONTROL                               ║
echo ║           SACRED GEOMETRY ∞ LIVE PRODUCTION                  ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

if "%1"=="" goto show_help
if "%1"=="help" goto show_help
if "%1"=="status" goto show_status
if "%1"=="sync" goto do_sync
if "%1"=="build" goto do_build
if "%1"=="install" goto do_install
if "%1"=="migrate" goto do_migrate
if "%1"=="monitor" goto do_monitor
if "%1"=="alert" goto do_alert
if "%1"=="layers" goto do_layers
if "%1"=="domains" goto do_domains
goto show_help

:show_help
echo Usage: heady [command] [options]
echo.
echo Commands:
echo   status      Show system status across all devices
echo   sync        Sync to all devices (E:, F:, etc.)
echo   build       Run HCFP clean build from scratch
echo   install     Install all extensions (browsers, IDEs)
echo   migrate     Migrate localhost to internal domains
echo   monitor     Start observability dashboard
echo   alert       Send test alert
echo   layers      Show/switch Heady cloud layers
echo   domains     Configure internal DNS domains
echo.
echo Examples:
echo   heady status
echo   heady sync
echo   heady build
echo   heady install
echo   heady monitor
echo.
goto end

:show_status
echo [*] Checking Heady system status...
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0\device-management.ps1" -Action status
goto end

:do_sync
echo [*] Syncing Heady to all devices...
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0\device-management.ps1" -Action sync
goto end

:do_build
echo [*] Running HCFP clean build...
echo.
echo This will rebuild everything from scratch.
echo.
powershell -ExecutionPolicy Bypass -Command "& {node scripts/localhost-to-domain.js migrate distribution}"
echo.
echo Build complete. Check logs for details.
goto end

:do_install
echo [*] Installing Heady extensions...
echo.
call "%~dp0\install-extensions.bat"
goto end

:do_migrate
echo [*] Migrating localhost to internal domains...
echo.
node "%~dp0\localhost-to-domain.js" migrate distribution
echo.
echo Migration complete. Run 'heady domains' to update hosts file.
goto end

:do_monitor
echo [*] Starting Heady observability dashboard...
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0\observability.ps1" -Action dashboard
goto end

:do_alert
echo [*] Sending test alert...
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0\observability.ps1" -Action alert -Message "Test alert from Heady Master Control" -Severity info
goto end

:do_layers
echo [*] Heady Cloud Layers...
echo.
if exist "%~dp0\heady-layer.ps1" (
    powershell -ExecutionPolicy Bypass -File "%~dp0\heady-layer.ps1" status
) else (
    echo Layer switcher not found. Check scripts directory.
)
goto end

:do_domains
echo [*] Configuring internal DNS domains...
echo.
echo Adding Heady internal domains to hosts file...
echo.
node "%~dp0\localhost-to-domain.js" hosts > "%TEMP%\heady-hosts.txt"
echo Generated hosts entries at: %TEMP%\heady-hosts.txt
echo.
echo To apply, run as Administrator:
echo   type %TEMP%\heady-hosts.txt ^>^> C:\Windows\System32\drivers\etc\hosts
echo.
echo Or manually copy the entries to your hosts file.
echo.
type "%TEMP%\heady-hosts.txt"
goto end

:end
echo.
