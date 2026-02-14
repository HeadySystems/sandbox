# HeadyVM Auto-Deploy Script
# Simplified deployment for HeadyVM migration

param(
    [switch]$Force,
    [switch]$SkipTests,
    [string]$Mode = "production"
)

Write-Host "🚀 HeadyVM Auto-Deploy Starting..." -ForegroundColor Cyan
Write-Host "Mode: $Mode" -ForegroundColor Yellow

# Check git status
$status = git status --porcelain
if ($status -and -not $Force) {
    Write-Warning "Working directory not clean. Use -Force to deploy anyway."
    exit 1
}

# Stage and commit changes
Write-Host "📝 Staging changes..." -ForegroundColor Green
git add .windsurf/
git add deployments/
git add configs/

if ($status) {
    git commit -m "HeadyVM migration preparation - updated .windsurf cloud configs"
    Write-Host "✅ Changes committed" -ForegroundColor Green
}

# Push to remotes
Write-Host "📤 Pushing to remotes..." -ForegroundColor Green
git push origin main
git push heady-sys main
git push heady-me main

# Trigger deployment
Write-Host "🔄 Triggering HeadyVM deployment..." -ForegroundColor Green
$body = @{
    mode = $Mode
    force = $Force.IsPresent
    skip_tests = $SkipTests.IsPresent
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "https://headysystems.com/api/deploy" -Method POST -Body $body -ContentType "application/json"
    Write-Host "✅ Deployment triggered: $($response.deployment_id)" -ForegroundColor Green
    Write-Host "📊 Status: $($response.status)" -ForegroundColor Yellow
} catch {
    Write-Warning "Deployment trigger failed: $($_.Exception.Message)"
    Write-Host "🔗 Manual deployment may be required at: https://headysystems.com/deploy" -ForegroundColor Cyan
}

Write-Host "🎉 HeadyVM Auto-Deploy Complete!" -ForegroundColor Green
Write-Host "📱 Monitor deployment at: https://headysystems.com/status" -ForegroundColor Cyan
