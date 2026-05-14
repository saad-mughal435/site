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

Write-Host "Checking auth + scopes..." -ForegroundColor Cyan
$status = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: gh not authenticated. Run:  gh auth login" -ForegroundColor Red
    exit 1
}
# Require the `user` scope — without it, PATCH /user and /user/social_accounts return 404.
if ($status -notmatch "(?ms)Token scopes:.*\buser\b") {
    Write-Host ""
    Write-Host "ERROR: gh is authenticated but missing the 'user' scope." -ForegroundColor Red
    Write-Host "Editing your profile (bio/URL/company/location/social accounts) needs it." -ForegroundColor Red
    Write-Host ""
    Write-Host "Run this to add it (approves a browser prompt), then re-run this script:" -ForegroundColor Yellow
    Write-Host "  gh auth refresh -h github.com -s user" -ForegroundColor Yellow
    exit 2
}

# --------------------- Patch the user profile ---------------------
Write-Host ""
Write-Host "Updating profile fields..." -ForegroundColor Cyan

$null = gh api user `
    --method PATCH `
    -f "name=$name" `
    -f "bio=$bio" `
    -f "blog=$url" `
    -f "company=$company" `
    -f "location=$location" `
    -F "hireable=$hireable" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  [ok] name, bio, blog, company, location, hireable" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] PATCH /user failed (exit $LASTEXITCODE) — output above" -ForegroundColor Red
    exit 3
}

# --------------------- Social accounts ---------------------
Write-Host ""
Write-Host "Setting social accounts..." -ForegroundColor Cyan

# Clear existing first to avoid duplicates
$existing = gh api /user/social_accounts 2>$null | ConvertFrom-Json
if ($existing) {
    $existingUrls = @($existing | ForEach-Object { $_.url })
    if ($existingUrls.Count -gt 0) {
        $delPayload = @{ account_urls = $existingUrls } | ConvertTo-Json -Compress
        $null = $delPayload | gh api --method DELETE /user/social_accounts --input - 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  [warn] couldn't clear existing accounts (exit $LASTEXITCODE) — continuing" -ForegroundColor Yellow
        }
    }
}

# Add the configured set
$addPayload = @{ account_urls = $socialAccounts } | ConvertTo-Json -Compress
$null = $addPayload | gh api --method POST /user/social_accounts --input - 2>&1
if ($LASTEXITCODE -eq 0) {
    foreach ($u in $socialAccounts) { Write-Host "  [ok] $u" -ForegroundColor Green }
} else {
    Write-Host "  [FAIL] POST /user/social_accounts failed (exit $LASTEXITCODE) — output above" -ForegroundColor Red
    exit 4
}

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
