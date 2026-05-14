# Create + push the GitHub Profile README repo.
# Creates github.com/saad-mughal435/saad-mughal435 (the magic same-name repo
# whose README appears at the top of your GitHub profile page) and pushes
# scripts/profile-readme/README.md into it.
#
# Prereqs:
#   1) GitHub CLI installed:   winget install GitHub.cli
#   2) Authenticated:          gh auth login
#
# Run:  pwsh -File site\scripts\setup-profile-readme.ps1
#
# Safe to re-run — if the repo already exists, the script just updates
# the README in place.

$ErrorActionPreference = "Stop"

$user = "saad-mughal435"
$repo = "saad-mughal435"
$source = Join-Path $PSScriptRoot "profile-readme\README.md"
$workdir = Join-Path $env:TEMP "manzil-profile-readme"

if (-not (Test-Path $source)) {
    Write-Host "ERROR: README source not found at $source" -ForegroundColor Red
    exit 1
}

Write-Host "Checking gh CLI..." -ForegroundColor Cyan
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: gh CLI not installed. Run:  winget install GitHub.cli" -ForegroundColor Red
    exit 1
}

gh auth status 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: gh not authenticated. Run:  gh auth login" -ForegroundColor Red
    exit 1
}

# --------------------- Check if repo exists ---------------------
Write-Host ""
Write-Host "Checking if profile-README repo exists..." -ForegroundColor Cyan
gh api "/repos/$user/$repo" 2>&1 | Out-Null
$exists = ($LASTEXITCODE -eq 0)

# --------------------- Prepare workdir ---------------------
if (Test-Path $workdir) {
    Remove-Item -Recurse -Force $workdir
}
New-Item -ItemType Directory -Path $workdir | Out-Null

if ($exists) {
    Write-Host "  [info] repo exists — cloning to update" -ForegroundColor Yellow
    git clone "https://github.com/$user/$repo.git" $workdir 2>&1 | Out-Null
} else {
    Write-Host "  [info] creating new repo..." -ForegroundColor Cyan
    gh repo create "$user/$repo" `
        --public `
        --description "Profile README for saad-mughal435 — Electrical & Automation Engineer, ERP/OEE Developer. UAE-based, open to relocate worldwide." `
        --homepage "https://saadm.dev" `
        --confirm 2>&1 | Out-Null
    git init $workdir | Out-Null
    Push-Location $workdir
    git branch -M main
    git remote add origin "https://github.com/$user/$repo.git"
    Pop-Location
}

# --------------------- Copy README + push ---------------------
Copy-Item -Force $source (Join-Path $workdir "README.md")

Push-Location $workdir
git add README.md
$msg = if ($exists) { "docs: refresh profile README" } else { "docs: initial profile README" }
git commit -m $msg --allow-empty 2>&1 | Out-Null
git push -u origin main 2>&1 | Out-Null
Pop-Location

Write-Host ""
Write-Host "Profile README live at:" -ForegroundColor Green
Write-Host "  https://github.com/$user" -ForegroundColor Green
Write-Host "  https://github.com/$user/$repo" -ForegroundColor Green
Write-Host ""
Write-Host "It may take 30-60s for GitHub's CDN to render the new README on your profile page." -ForegroundColor Yellow
