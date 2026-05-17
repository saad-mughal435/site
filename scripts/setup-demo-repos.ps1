# Mirror each demo folder into its own standalone GitHub repo.
#
# Creates (or refreshes) seven public repos:
#   - kingsley-mes-demo       <-  site/app/
#   - pebble-storefront       <-  site/b2c/
#   - anvil-wholesale         <-  site/b2b/
#   - manzil-marketplace      <-  site/property/
#   - vacation-homes-demo     <-  site/vacation/
#   - qahwa-pos-demo          <-  site/pos/
#   - sanad-copilot           <-  site/sanad/
#
# Each one uses `git subtree split` so only commits that touched that
# subfolder land in the new repo (preserves history, no portfolio bloat).
# Idempotent: if a repo already exists, the script force-pushes the
# latest split. Safe to re-run after any update.
#
# Prereqs:
#   1) gh CLI installed + 'user' + 'repo' scopes
#         winget install GitHub.cli
#         gh auth refresh -h github.com -s repo,user
#   2) Working tree clean (no uncommitted changes in site/).
#
# Run:  pwsh -File site\scripts\setup-demo-repos.ps1

$ErrorActionPreference = "Stop"
$user = "saad-mughal435"

# Find the site/ repo root regardless of cwd.
$siteRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

# --------------------- Demo map ---------------------
$demos = @(
    @{
        prefix      = "app"
        repo        = "kingsley-mes-demo"
        description = "Disconnected walkthrough of the production MES/ERP I built at Kingsley Beverage FZCO — 20+ modules, OEE, QC, Sage integration, 6 PDF templates. Runs in-browser via fetch interceptor."
        homepage    = "https://saadm.dev/app/"
        topics      = @("mes","erp","oee","manufacturing","fastapi","mongodb","sage","portfolio")
    },
    @{
        prefix      = "b2c"
        repo        = "pebble-storefront"
        description = "Pebble & Co. — DTC e-commerce storefront demo with Shopify-style admin. Catalog, cart, multi-step checkout, customer account, 7-section admin SPA."
        homepage    = "https://saadm.dev/b2c/"
        topics      = @("ecommerce","storefront","dtc","admin-panel","javascript","mock-api","portfolio")
    },
    @{
        prefix      = "b2b"
        repo        = "anvil-wholesale"
        description = "Anvil Supply Co. — B2B wholesale portal demo with tier pricing, MOQs, contract discounts, quote workflow, and approval routing for orders over `$1k."
        homepage    = "https://saadm.dev/b2b/"
        topics      = @("b2b","wholesale","quote-workflow","approval","tier-pricing","javascript","portfolio")
    },
    @{
        prefix      = "property"
        repo        = "manzil-marketplace"
        description = "Manzil Properties — Dubai real-estate marketplace demo. 65 listings across 15 communities, map+list search (Leaflet), mortgage/valuation/yield calculators, 13-section admin SPA."
        homepage    = "https://saadm.dev/property/"
        topics      = @("real-estate","marketplace","leaflet","dubai","mortgage-calculator","admin-spa","portfolio")
    },
    @{
        prefix      = "vacation"
        repo        = "vacation-homes-demo"
        description = "Vacation Homes — UAE short-stay booking marketplace demo. 56 stays across 10 destinations, hand-rolled date-range picker, conflict-checked bookings, 6-step host onboarding wizard with document upload, admin verification queue, 12-section admin SPA."
        homepage    = "https://saadm.dev/vacation/"
        topics      = @("short-stay","booking","marketplace","date-picker","leaflet","host-onboarding","verification-queue","admin-spa","portfolio")
    },
    @{
        prefix      = "pos"
        repo        = "qahwa-pos-demo"
        description = "Qahwa POS — café & quick-service point-of-sale demo. Touch cashier terminal with PIN auth, kitchen display system with audio chime, modifier-driven menus, shift cash reconciliation with Z-reports, 14-section admin SPA."
        homepage    = "https://saadm.dev/pos/"
        topics      = @("pos","point-of-sale","cafe","kitchen-display","kds","touch-ui","shift-reconciliation","z-report","admin-spa","portfolio")
    },
    @{
        prefix      = "sanad"
        repo        = "sanad-copilot"
        description = "Sanad — AI customer-support copilot demo. SaaS-style helpdesk with Claude integrated at every touchpoint: agent inbox with AI sidebar (suggested reply with KB citations, summary, sentiment, EN↔AR translate), RAG chat widget with streaming, 11-section admin with model selector + editable system prompt. Live + mock-fallback modes."
        homepage    = "https://saadm.dev/sanad/"
        topics      = @("ai","claude","anthropic","customer-support","copilot","rag","streaming","cloudflare-workers","helpdesk","admin-spa","portfolio")
    }
)

# --------------------- Prereq checks ---------------------
Write-Host "Checking gh CLI..." -ForegroundColor Cyan
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: gh not installed. Run:  winget install GitHub.cli" -ForegroundColor Red
    exit 1
}
gh auth status 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: gh not authenticated. Run:  gh auth login" -ForegroundColor Red
    exit 1
}

# Working tree must be clean — subtree split picks up tracked content.
Push-Location $siteRoot
$dirty = git status --porcelain
Pop-Location
if ($dirty) {
    Write-Host "ERROR: site/ has uncommitted changes. Commit them first." -ForegroundColor Red
    Write-Host $dirty -ForegroundColor Red
    exit 1
}

# --------------------- Main loop ---------------------
foreach ($d in $demos) {
    $prefix = $d.prefix
    $repo   = $d.repo
    $url    = "https://github.com/$user/$repo.git"

    Write-Host ""
    Write-Host "=== $repo  <-  site/$prefix/  ===" -ForegroundColor Cyan

    # 1. Ensure the repo exists.
    gh api "/repos/$user/$repo" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [info] creating repo..." -ForegroundColor Yellow
        gh repo create "$user/$repo" `
            --public `
            --description $d.description `
            --homepage $d.homepage `
            --disable-wiki 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  [FAIL] could not create repo" -ForegroundColor Red
            continue
        }
        # Add topics
        foreach ($t in $d.topics) {
            gh api -X PUT "/repos/$user/$repo/topics" -f "names[]=$t" 2>&1 | Out-Null
        }
        # Set topics in one shot (replaces existing)
        $topicArgs = @("-X","PUT","/repos/$user/$repo/topics")
        foreach ($t in $d.topics) { $topicArgs += @("-f","names[]=$t") }
        gh api @topicArgs 2>&1 | Out-Null
        Write-Host "  [ok] created + topics set" -ForegroundColor Green
    } else {
        Write-Host "  [info] repo already exists — will force-push latest split" -ForegroundColor Yellow
        # Refresh description/homepage/topics on every run so they stay current
        gh repo edit "$user/$repo" --description $d.description --homepage $d.homepage 2>&1 | Out-Null
        $topicArgs = @("-X","PUT","/repos/$user/$repo/topics")
        foreach ($t in $d.topics) { $topicArgs += @("-f","names[]=$t") }
        gh api @topicArgs 2>&1 | Out-Null
    }

    # 2. Subtree split → temporary branch
    $tempBranch = "subtree-split-$prefix"
    Push-Location $siteRoot
    Write-Host "  [info] splitting site/$prefix/ history..." -ForegroundColor Yellow
    git branch -D $tempBranch 2>&1 | Out-Null  # remove if leftover from a previous run
    git subtree split --prefix=$prefix -b $tempBranch | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [FAIL] subtree split failed" -ForegroundColor Red
        Pop-Location
        continue
    }

    # 3. Force-push to the new repo's main
    Write-Host "  [info] pushing to $url..." -ForegroundColor Yellow
    git push --force $url "$tempBranch`:main" 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [ok] pushed -> https://github.com/$user/$repo" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] push failed" -ForegroundColor Red
    }

    # 4. Clean up the temp branch locally
    git branch -D $tempBranch 2>&1 | Out-Null
    Pop-Location
}

# --------------------- Done ---------------------
Write-Host ""
Write-Host "All done. Your standalone demo repos:" -ForegroundColor Green
foreach ($d in $demos) {
    Write-Host "  https://github.com/$user/$($d.repo)" -ForegroundColor Green
}
Write-Host ""
Write-Host "Last step (UI only): pin them on your profile." -ForegroundColor Yellow
Write-Host "  https://github.com/$user" -ForegroundColor Yellow
Write-Host "  -> 'Customize your pins' -> tick site, saad-mughal435, and the 4 demo repos" -ForegroundColor Yellow
