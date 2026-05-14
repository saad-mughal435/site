# Configure github.com/saad-mughal435/site repo metadata.
# One-time script — sets About description, website, topics, and home branch.
#
# Prereqs:
#   1) GitHub CLI installed:   winget install GitHub.cli
#   2) Authenticated:          gh auth login
#
# Run:  pwsh -File scripts\setup-github-repo.ps1

$repo = "saad-mughal435/site"
$description = "Portfolio for Muhammad Saad — Electrical & Automation Engineer · ERP/OEE Developer · Full-Stack. UAE-based, open to relocate worldwide. Four interactive demos + structured data + branded 404."
$homepage = "https://saadm.dev"

# Repo topics — these surface in search and on the profile.
$topics = @(
    "portfolio",
    "personal-website",
    "developer-portfolio",
    "react",
    "python",
    "fastapi",
    "mongodb",
    "automation-engineer",
    "erp",
    "mes",
    "oee",
    "manufacturing-software",
    "uae-developer",
    "open-to-relocate",
    "cloudflare-pages"
)

Write-Host "Checking gh CLI..." -ForegroundColor Cyan
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: gh CLI not installed. Run:  winget install GitHub.cli" -ForegroundColor Red
    exit 1
}

Write-Host "Checking auth..." -ForegroundColor Cyan
$auth = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: gh not authenticated. Run:  gh auth login" -ForegroundColor Red
    exit 1
}

Write-Host "Setting About / Description..." -ForegroundColor Cyan
gh repo edit $repo --description $description

Write-Host "Setting Homepage URL..." -ForegroundColor Cyan
gh repo edit $repo --homepage $homepage

Write-Host "Setting topics..." -ForegroundColor Cyan
$topicArgs = $topics | ForEach-Object { "--add-topic"; $_ }
gh repo edit $repo @topicArgs

Write-Host ""
Write-Host "Done. Verify at:" -ForegroundColor Green
Write-Host "  https://github.com/$repo" -ForegroundColor Green
