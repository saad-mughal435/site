# Configure GitHub profile fields professionally.
# One-time script — sets bio, URL, company, location, hireable, social accounts.
#
# Prereqs:
#   1) GitHub CLI installed:   winget install GitHub.cli
#   2) Authenticated:          gh auth login
#
# Run:  pwsh -File site\scripts\setup-github-profile.ps1
#
# Note: profile picture and pronouns aren't reliably settable via the
# REST API — those are documented in the script output as manual steps.

$ErrorActionPreference = "Stop"

# --------------------- Field values (edit if needed) ---------------------
$name        = "Muhammad Saad"
$bio         = "Electrical & Automation Engineer · ERP/OEE Developer · Full-Stack. UAE-based, open to relocate worldwide."
$url         = "https://saadm.dev"
$company     = "Kingsley Beverage FZCO"
$location    = "Dubai, UAE · Open to relocate worldwide"
$hireable    = $true

$socialAccounts = @(
    "https://www.linkedin.com/in/muhammadsaad435/",
    "https://saadm.dev"
)

# --------------------- Prereq checks ---------------------
Write-Host "Checking gh CLI..." -ForegroundColor Cyan
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: gh CLI not installed. Run:  winget install GitHub.cli" -ForegroundColor Red
    exit 1
}

Write-Host "Checking auth..." -ForegroundColor Cyan
gh auth status 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: gh not authenticated. Run:  gh auth login" -ForegroundColor Red
    exit 1
}

# --------------------- Patch the user profile ---------------------
Write-Host ""
Write-Host "Updating profile fields..." -ForegroundColor Cyan

gh api user `
    --method PATCH `
    -f "name=$name" `
    -f "bio=$bio" `
    -f "blog=$url" `
    -f "company=$company" `
    -f "location=$location" `
    -F "hireable=$hireable" | Out-Null

Write-Host "  [ok] name, bio, blog, company, location, hireable" -ForegroundColor Green

# --------------------- Social accounts ---------------------
Write-Host ""
Write-Host "Setting social accounts..." -ForegroundColor Cyan

# Clear existing first to avoid duplicates
$existing = gh api /user/social_accounts 2>$null | ConvertFrom-Json
if ($existing) {
    $existingUrls = @($existing | ForEach-Object { $_.url })
    if ($existingUrls.Count -gt 0) {
        $payload = @{ account_urls = $existingUrls } | ConvertTo-Json -Compress
        $payload | gh api --method DELETE /user/social_accounts --input - | Out-Null
    }
}

# Add the configured set
$addPayload = @{ account_urls = $socialAccounts } | ConvertTo-Json -Compress
$addPayload | gh api --method POST /user/social_accounts --input - | Out-Null

foreach ($u in $socialAccounts) { Write-Host "  [ok] $u" -ForegroundColor Green }

# --------------------- Done ---------------------
Write-Host ""
Write-Host "Profile fields updated. Verify at:" -ForegroundColor Green
Write-Host "  https://github.com/saad-mughal435" -ForegroundColor Green
Write-Host ""
Write-Host "Manual finishing touches (UI only — can't be set via API):" -ForegroundColor Yellow
Write-Host "  - Profile picture:  https://github.com/settings/profile" -ForegroundColor Yellow
Write-Host "                      (upload site/saad.png from this repo)"
Write-Host "  - Pronouns:         same page, dropdown — your choice, or leave 'Don't specify'"
Write-Host "  - Pin repositories: from your profile -> Customize your pins"
Write-Host "                      Suggested: site (portfolio source)"
Write-Host ""
