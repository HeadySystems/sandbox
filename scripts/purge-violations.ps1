#!/usr/bin/env pwsh
# PURGE ALL VIOLATIONS - localhost, 127.0.0.1, .onrender.com, heady.internal, heady.local, .internal.

Write-Host "🔥 PURGING ALL FORBIDDEN REFERENCES..." -ForegroundColor Red

$patterns = @(
    @{ Old = "localhost"; New = "api.headysystems.com" },
    @{ Old = "127.0.0.1"; New = "api.headysystems.com" },
    @{ Old = ".onrender.com"; New = ".headysystems.com" },
    @{ Old = "heady.internal"; New = "headysystems.com" },
    @{ Old = "heady.local"; New = "headysystems.com" },
    @{ Old = ".internal."; New = ".headysystems.com" }
)

$extensions = @("*.yaml", "*.yml", "*.js", "*.ts", "*.json", "*.jsx", "*.tsx", "*.md", "*.html", "*.css", "*.conf", "*.toml", "*.env*", "*.ps1", "*.sh", "*.py")

$files = Get-ChildItem -Path "c:\Users\erich\Heady" -Recurse -Include $extensions -ErrorAction SilentlyContinue | 
    Where-Object { -not $_.FullName.Contains("node_modules") -and 
                  -not $_.FullName.Contains(".git\") -and 
                  -not $_.FullName.Contains("dist\") -and 
                  -not $_.FullName.Contains("AndroidSDK") -and
                  -not $_.FullName.Contains("build\") -and
                  -not $_.FullName.Contains("out\") }

$totalChanges = 0

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
    if (-not $content) { continue }
    
    $originalContent = $content
    $fileChanges = 0
    
    foreach ($pattern in $patterns) {
        if ($content -match [regex]::Escape($pattern.Old)) {
            $content = $content -replace [regex]::Escape($pattern.Old), $pattern.New
            $count = ($originalContent | Select-String -Pattern ([regex]::Escape($pattern.Old)) -AllMatches).Matches.Count
            $fileChanges += $count
            Write-Host "  [$($file.Name)] Replaced $count occurrences of '$($pattern.Old)' -> '$($pattern.New)'" -ForegroundColor Yellow
        }
    }
    
    if ($fileChanges -gt 0) {
        Set-Content $file.FullName -Value $content -NoNewline -ErrorAction SilentlyContinue
        $totalChanges += $fileChanges
    }
}

Write-Host "`n✅ PURGE COMPLETE. Total replacements: $totalChanges" -ForegroundColor Green
Write-Host "🔥 All forbidden references have been eliminated." -ForegroundColor Red
