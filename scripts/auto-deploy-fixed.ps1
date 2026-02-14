<# HEADY_BRAND:BEGIN
<# ╔══════════════════════════════════════════════════════════════════╗
<# ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
<# ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
<# ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
<# ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
<# ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
<# ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
<# ║                                                                  ║
<# ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
<# ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
<# ║  FILE: scripts/auto-deploy-fixed.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
# HEADY_BRAND:BEGIN
# ╔══════════════════════════════════════════════════════════════════╗
# ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
# ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
# ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
# ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
# ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
# ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
# ║                                                                  ║
# ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
# ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
# ║  FILE: scripts/auto-deploy-fixed.ps1                              ║
# ║  LAYER: automation                                                  ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END

# HeadyWeb Auto-Deploy Script - Fixed Version
# Deploy HeadyWeb with dual-engine architecture to production

param(
    [Parameter(Mandatory=$false)]
    [string]$Version = "1.0.0-beta",
    
    [Parameter(Mandatory=$false)]
    [string]$Environment = "production",
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipTests,
    
    [Parameter(Mandatory=$false)]
    [switch]$Force
)

Write-Host "🚀 HeadyWeb Auto-Deploy Starting..." -ForegroundColor Cyan
Write-Host "Version: $Version" -ForegroundColor Green
Write-Host "Environment: $Environment" -ForegroundColor Green

# Validate environment
if (-not (Test-Path "apps/headyweb")) {
    Write-Error "❌ HeadyWeb directory not found. Please run from project root."
    exit 1
}

# Check if HeadyWeb is built
if (-not (Test-Path "apps/headyweb/dist")) {
    Write-Host "🔨 Building HeadyWeb..." -ForegroundColor Yellow
    
    try {
        Set-Location "apps/headyweb"
        npm run build
        if ($LASTEXITCODE -ne 0) {
            throw "Build failed"
        }
        Write-Host "✅ Build completed" -ForegroundColor Green
    } catch {
        Write-Error "❌ Build failed: $_"
        exit 1
    } finally {
        Set-Location $PSScriptRoot
    }
}

# Create deployment package
Write-Host "📦 Creating deployment package..." -ForegroundColor Yellow

$deployDir = "deployments/headyweb-$Version"
if (Test-Path $deployDir) {
    Remove-Item -Recurse -Force $deployDir
}
New-Item -ItemType Directory -Path $deployDir -Force | Out-Null

# Copy built files
Copy-Item -Recurse "apps/headyweb/dist\*" "$deployDir/" -Force
Copy-Item "apps/headyweb/package.json" "$deployDir/" -Force
Copy-Item "apps/headyweb/index.html" "$deployDir/" -Force

# Create deployment metadata
$deployMetadata = @{
    version = $Version
    environment = $Environment
    timestamp = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")
    features = @(
        "dual-engine",
        "quantum-acceleration", 
        "ai-enhanced-rendering",
        "sacred-geometry-ui",
        "comet-experimental",
        "chromium-beta"
    )
    engines = @{
        comet = "beta-experimental"
        chromium = "beta-latest"
    }
    buildInfo = @{
        nodeVersion = (node --version)
        platform = $PSVersionTable.PSVersion.Platform
        architecture = $env:PROCESSOR_ARCHITECTURE
    }
}

$deployMetadata | ConvertTo-Json -Depth 4 | Out-File "$deployDir/deploy-metadata.json" -Encoding UTF8

# Create deployment script
$deployScript = @"
# HeadyWeb Deployment Script
Write-Host "🌟 Starting HeadyWeb v$deployMetadata.version"
Write-Host "Features: $($deployMetadata.features -join ', ')"
Write-Host "Engines: Comet $($deployMetadata.engines.comet) + Chromium $($deployMetadata.engines.chromium)"

# Start HeadyWeb
if (Test-Path "dist/main.js") {
    Write-Host "🚀 Launching HeadyWeb..."
    node dist/main.js
} else {
    Write-Warning "⚠️ Main executable not found"
}
"@

$deployScript | Out-File "$deployDir/deploy.sh" -Encoding UTF8

# Create README for deployment
$deployReadme = @"
# HeadyWeb Deployment

## Version: $Version
## Environment: $Environment
## Deployed: $(Get-Date)

### Features
- Dual-engine architecture (Comet + Chromium)
- Quantum computing acceleration
- AI-enhanced rendering
- Sacred Geometry UI
- WebGPU and experimental APIs

### Quick Start
\`\`\`bash
./deploy.sh
\`\`\`

### Architecture
- **Comet Engine**: Experimental features, WebGPU, quantum acceleration
- **Chromium Beta**: Stable foundation, extensions, developer tools
- **Engine Router**: Intelligent switching based on content analysis
- **Sacred Geometry UI**: Organic, breathing interfaces

### Configuration
- Edit \`deploy-metadata.json\` for custom settings
- Environment variables in \`.env\` file
- Engine preferences in \`config/engine-config.json\`
"@

$deployReadme | Out-File "$deployDir/README.md" -Encoding UTF8

# Create systemd service (Linux)
if ($IsLinux) {
    $systemdService = @"
[Unit]
Description=HeadyWeb Browser
After=network.target

[Service]
Type=simple
User=heady
WorkingDirectory=$deployDir
ExecStart=/usr/bin/node $deployDir/main.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
"@
    
    $systemdService | Out-File "$deployDir/headyweb.service" -Encoding UTF8

# Create Windows service
if ($IsWindows) {
    $nssmPath = "nssm.exe"
    if (Get-Command $nssmPath -ErrorAction SilentlyContinue) {
        Write-Host "🔧 Creating Windows service..." -ForegroundColor Yellow
        
        $serviceArgs = @(
            "install", "HeadyWeb", "HeadyWeb Browser",
            "$deployDir\main.js",
            "node", "$deployDir\main.js"
        )
        
        & $nssmPath $serviceArgs
        Write-Host "✅ Windows service created" -ForegroundColor Green
    }
}

# Health check
Write-Host "🔍 Performing health check..." -ForegroundColor Yellow

$healthChecks = @(
    { Name = "Build Directory", Check = { Test-Path "$deployDir" } }
    { Name = "Main Executable", Check = { Test-Path "$deployDir/main.js" } }
    { Name = "Package Config", Check = { Test-Path "$deployDir/package.json" } }
    { Name = "Index HTML", Check = { Test-Path "$deployDir/index.html" } }
    { Name = "Metadata", Check = { Test-Path "$deployDir/deploy-metadata.json" } }
)

$allHealthy = $true
foreach ($check in $healthChecks) {
    if ($check.Check.Invoke()) {
        Write-Host "✅ $($check.Name)" -ForegroundColor Green
    } else {
        Write-Host "❌ $($check.Name)" -ForegroundColor Red
        $allHealthy = $false
    }
}

if (-not $allHealthy) {
    Write-Error "❌ Health check failed"
    exit 1
}

# Create deployment archive
Write-Host "📦 Creating deployment archive..." -ForegroundColor Yellow

$archiveName = "headyweb-$Version-$Environment.zip"
$archivePath = "deployments/$archiveName"

if (Test-Path $archivePath) {
    Remove-Item $archivePath -Force
}

Compress-Archive -Path $deployDir -DestinationPath $archivePath

# Calculate checksum
$checksum = (Get-FileHash $archivePath -Algorithm SHA256).Hash
$checksum | Out-File "$archivePath.sha256" -Encoding UTF8

Write-Host "✅ Deployment package created: $archiveName" -ForegroundColor Green
Write-Host "🔐 Checksum: $checksum" -ForegroundColor Cyan

# Update deployment registry
Write-Host "📋 Updating deployment registry..." -ForegroundColor Yellow

$registryPath = "deployments/latest.json"
$registryEntry = @{
    application = "HeadyWeb"
    version = $Version
    environment = $Environment
    timestamp = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")
    archive = $archiveName
    checksum = $checksum
    size = (Get-Item $archivePath).Length
    metadata = $deployMetadata
}

$registryEntry | ConvertTo-Json -Depth 4 | Out-File $registryPath -Encoding UTF8

# Success
Write-Host "🎉 Auto-deploy completed successfully!" -ForegroundColor Green
Write-Host "📦 Package: $archiveName" -ForegroundColor Cyan
Write-Host "📂 Registry: $registryPath" -ForegroundColor Cyan
Write-Host "🔐 Checksum: $checksum" -ForegroundColor Cyan

Write-Host "`n🚀 Ready to deploy HeadyWeb with:" -ForegroundColor Yellow
Write-Host "  • Dual-engine architecture" -ForegroundColor White
Write-Host "  • Quantum computing acceleration" -ForegroundColor White  
Write-Host "  • AI-enhanced rendering" -ForegroundColor White
Write-Host "  • Sacred Geometry UI" -ForegroundColor White
Write-Host "  • WebGPU and experimental APIs" -ForegroundColor White

exit 0
