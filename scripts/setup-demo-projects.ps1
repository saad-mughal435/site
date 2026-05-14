# Create 4 GitHub Projects (v2) boards — one per demo — pre-populated
# with realistic Done / In Progress / Todo items so the Projects tab
# on the profile reads like real engineering work, not an empty
# template.
#
# Boards created (under user 'saad-mughal435'):
#   - Kingsley MES/ERP - roadmap
#   - Pebble & Co. - storefront backlog
#   - Anvil Supply Co. - wholesale portal
#   - Manzil Properties - marketplace roadmap
#
# Prereqs:
#   1) gh CLI installed:  winget install GitHub.cli
#   2) 'project' scope:   gh auth refresh -h github.com -s project
#
# Run:  pwsh -File site\scripts\setup-demo-projects.ps1
#
# Idempotent: if a board with the same title already exists, the
# script skips it. To rebuild from scratch, delete the board in the
# GitHub UI first.

$ErrorActionPreference = "Stop"
$owner = "@me"   # resolves to the authenticated user

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

# Probe for project scope by attempting a harmless query
$null = gh project list --owner $owner --limit 1 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: gh is missing the 'project' scope (Projects v2 needs it)." -ForegroundColor Red
    Write-Host "Fix with one command + browser approval:" -ForegroundColor Yellow
    Write-Host "  gh auth refresh -h github.com -s project" -ForegroundColor Yellow
    exit 2
}

# --------------------- Project definitions ---------------------
$projects = @(
    @{
        title = "Kingsley MES/ERP - roadmap"
        description = "Production MES/ERP for an automated beverage plant. Built solo as Automation Engineer at Kingsley Beverage FZCO. Live walkthrough at saadm.dev/app/."
        items = @(
            @{ s="Done"; t="Production planning module"; b="Plan job orders, schedule lines, integrate with recipe BOM, finalise day-batch schedules." },
            @{ s="Done"; t="Inventory module (raw materials + finished goods)"; b="Real-time stock levels, batch lookup, barcode scan support, low-stock alerts." },
            @{ s="Done"; t="Quality control workflow"; b="Seam check entries, drop tests, lab results, daily QC log, sign-off chain." },
            @{ s="Done"; t="OEE monitoring dashboard"; b="Live availability x performance x quality math across lines, downtime cause breakdown." },
            @{ s="Done"; t="Sage Evolution accounting integration"; b="Two-way sync of customer/supplier ledgers, journal entries, invoice posting." },
            @{ s="Done"; t="6 PDF document templates"; b="Performa invoice, packing list, picking sheet, batch report, GRN, recipe sheet — auto-generated and print-ready." },
            @{ s="Done"; t="Recipe and BOM management"; b="Multi-level BOM, ingredient yields, batch number traceability." },
            @{ s="Done"; t="Goods receipt notes (GRN)"; b="Supplier delivery capture, batch-level tracking, automatic stock-add." },
            @{ s="Done"; t="Auth + role-based access"; b="JWT auth, 4 roles (admin, operator, viewer, finance), row-level permissions." },
            @{ s="In Progress"; t="Real-time line status via WebSockets"; b="Push downtime alerts to operator dashboards within 2s of trigger event." },
            @{ s="In Progress"; t="Mobile-responsive operator view"; b="Tablet-first redesign for floor operators logging downtime / batch data." },
            @{ s="Todo"; t="Predictive maintenance ML model"; b="Flag equipment likely to fail in next 7 days from historical downtime patterns." },
            @{ s="Todo"; t="Energy consumption tracking"; b="Per-line kWh integration with utility meter API." },
            @{ s="Todo"; t="Multi-plant rollout"; b="Generalise from single-site to 3-plant deployment with central reporting." }
        )
    },
    @{
        title = "Pebble & Co. - storefront backlog"
        description = "DTC e-commerce storefront demo with Shopify-style admin. Live at saadm.dev/b2c/."
        items = @(
            @{ s="Done"; t="Product catalog with filters"; b="24 SKUs across 4 categories, search, featured carousels, related-product cross-sell." },
            @{ s="Done"; t="Multi-step checkout flow"; b="Address -> shipping -> payment -> review -> confirm. Validates each step before advancing." },
            @{ s="Done"; t="Customer account dashboard"; b="Orders, addresses, wishlist, loyalty points, password / email update." },
            @{ s="Done"; t="Shopify-style admin SPA"; b="7 sections: dashboard, orders, products, customers, promotions, banners, settings + audit." },
            @{ s="Done"; t="Promo codes (percent / fixed / shipping)"; b="Code editor in admin, validation at checkout, expiry + min-subtotal rules." },
            @{ s="Done"; t="Email log"; b="Every transactional email rendered in-app and available in admin." },
            @{ s="Done"; t="Mock API + localStorage state"; b="fetch + XHR shim handling 25+ endpoints, all writes persisted in browser." },
            @{ s="Done"; t="Order status overrides + refunds"; b="Admin can override status (paid -> shipped -> delivered -> refunded) with print packing slip." },
            @{ s="In Progress"; t="Wishlist sync across devices"; b="Persist wishlist server-side once real auth is wired in." },
            @{ s="Todo"; t="Subscription products"; b="Recurring orders with monthly/weekly cadence and pause/resume controls." },
            @{ s="Todo"; t="Multi-currency price display"; b="Geo-detect and show local-currency pricing with daily FX refresh." },
            @{ s="Todo"; t="Live payment integration (Stripe)"; b="Replace mocked payment with Stripe Elements + Payment Intents." }
        )
    },
    @{
        title = "Anvil Supply Co. - wholesale portal"
        description = "B2B wholesale portal demo with tier pricing, MOQs, approval workflow. Live at saadm.dev/b2b/."
        items = @(
            @{ s="Done"; t="Tier pricing (1 / 10 / 50 / 100)"; b="Auto-applied unit price based on quantity bracket; visible price-break table on product page." },
            @{ s="Done"; t="MOQ + credit-limit enforcement"; b="Block orders below minimum order quantity or over customer credit limit at cart add and checkout." },
            @{ s="Done"; t="Customer-specific contract discounts"; b="Per-customer markdown layer applied on top of tier price." },
            @{ s="Done"; t="Quote request (RFQ) workflow"; b="Buyer submits RFQ, admin manually prices, one-click convert to order." },
            @{ s="Done"; t="Order approval queue (>`$1k)"; b="Orders over `$1k route to customer's approver before fulfilment; admin sees pending queue." },
            @{ s="Done"; t="Multi-user accounts with roles"; b="Purchaser / approver / viewer roles per customer organisation." },
            @{ s="Done"; t="Bulk SKU paste add"; b="Paste multiline CSV-style SKU+qty list straight into cart." },
            @{ s="Done"; t="Account dashboard"; b="Orders, quotes, invoices, recurring orders, users + roles, ship-to addresses." },
            @{ s="In Progress"; t="Recurring order schedules"; b="Monthly / weekly auto-reorder for standing customers, with pause and skip-next." },
            @{ s="Todo"; t="QuickBooks API integration"; b="Push invoices and payment receipts to customer's QuickBooks Online tenant." },
            @{ s="Todo"; t="Multi-warehouse fulfilment routing"; b="Pick best warehouse per line item to minimise shipping cost / time." },
            @{ s="Todo"; t="Statement view + PDF export"; b="Monthly / quarterly account statement per customer with downloadable PDF." }
        )
    },
    @{
        title = "Manzil Properties - marketplace roadmap"
        description = "Dubai real-estate marketplace demo with map+list search, mortgage / valuation / yield tools, 13-section admin SPA. Live at saadm.dev/property/."
        items = @(
            @{ s="Done"; t="65 listings across 15 Dubai communities"; b="Marina, Downtown, Palm, JBR, Business Bay, DIFC, JLT, Arabian Ranches, Emirates Hills, Springs, Meadows, Dubai Hills, DAMAC Hills, Mirdif, Al Barsha." },
            @{ s="Done"; t="Map + list search (Leaflet + OSM)"; b="Price-pinned markers, list-hover sync, cluster on zoom-out, deep-link by area." },
            @{ s="Done"; t="Property detail with gallery lightbox"; b="Keyboard nav (left/right/Esc), floor plan SVG, embedded location map, similar listings, mortgage widget." },
            @{ s="Done"; t="Mortgage calculator with amortisation"; b="Year-by-year schedule, principal vs interest split, save scenarios to dashboard." },
            @{ s="Done"; t="Comparable-based valuation tool"; b="Median AED/ft^2 across matching listings, low/mid/high range, confidence read." },
            @{ s="Done"; t="Investment yield calculator"; b="Gross + net yield, year-by-year cash flow with rent growth, 5/10-year total return on cash invested." },
            @{ s="Done"; t="13-section admin SPA"; b="Dashboard, listings, inquiries, viewings, agents, agencies, customers, analytics, promotions, content, moderation, settings, audit." },
            @{ s="Done"; t="Lead scoring (1-5) on inquiries"; b="Auto-score from status x kind x recency, manual override, hot/warm/cold inbox filter." },
            @{ s="Done"; t="Activity timeline per inquiry"; b="Unified chronological feed of received / messages / replies / notes / status changes / score changes." },
            @{ s="Done"; t="CSV bulk import for listings"; b="Quoted-comma parser, preview rows with column validation, batch POST to admin API." },
            @{ s="Done"; t="Print-as-brochure for listing detail"; b="A4 layout: cover image, key facts, description, amenities, floor plan, agent contact card." },
            @{ s="Done"; t="EN / AR locale with RTL flip"; b="Full layout mirror, translated nav/CTAs/area names, AED/USD/GBP/EUR currency switcher." },
            @{ s="In Progress"; t="Virtual tour player UI"; b="360 photo placeholder with hotspot navigation between rooms." },
            @{ s="In Progress"; t="Saved-search email alerts"; b="Notify customer when a new listing matches their saved query." },
            @{ s="Todo"; t="Off-plan handover timeline view"; b="Per-developer roadmap of upcoming launches with Q1/Q2/Q3/Q4 milestones." },
            @{ s="Todo"; t="Lender comparison page"; b="Side-by-side mortgage rates from UAE banks (Emirates NBD, ADCB, FAB, Mashreq, etc.)." },
            @{ s="Todo"; t="DLD / property tax calculator"; b="Itemised upfront costs (4% DLD, 2% commission, 0.25% fees, NOC, valuation)." },
            @{ s="Todo"; t="Mobile app (PWA)"; b="Add-to-homescreen, offline cache of saved listings, push notifications for alerts." }
        )
    }
)

# --------------------- Main loop ---------------------
foreach ($p in $projects) {
    Write-Host ""
    Write-Host "=== $($p.title) ===" -ForegroundColor Cyan

    # Check if a project with this title already exists
    $existing = gh project list --owner $owner --limit 50 --format json 2>$null | ConvertFrom-Json
    $found = $null
    if ($existing -and $existing.projects) {
        $found = $existing.projects | Where-Object { $_.title -eq $p.title } | Select-Object -First 1
    }
    if ($found) {
        Write-Host "  [skip] already exists (project #$($found.number)) — delete in GitHub UI to rebuild" -ForegroundColor Yellow
        continue
    }

    # Create the project
    Write-Host "  [info] creating project..." -ForegroundColor Yellow
    $created = gh project create --owner $owner --title $p.title --format json | ConvertFrom-Json
    $projNumber = $created.number
    $projId = $created.id
    Write-Host "  [ok] project #$projNumber created" -ForegroundColor Green

    # Set description
    $null = gh project edit --owner $owner --number $projNumber --description $p.description 2>&1

    # Discover the Status field + its option IDs
    $fields = gh project field-list --owner $owner --number $projNumber --format json | ConvertFrom-Json
    $statusField = $fields.fields | Where-Object { $_.name -eq "Status" } | Select-Object -First 1
    if (-not $statusField) {
        Write-Host "  [warn] no Status field on this project — items will be created without status" -ForegroundColor Yellow
    }
    $optMap = @{}
    if ($statusField -and $statusField.options) {
        foreach ($o in $statusField.options) { $optMap[$o.name] = $o.id }
    }

    # Add items
    $done = 0
    foreach ($it in $p.items) {
        $itemJson = gh project item-create $projNumber --owner $owner --title $it.t --body $it.b --format json | ConvertFrom-Json
        # Move to target status (default-created status is "Todo")
        if ($statusField -and $optMap.ContainsKey($it.s) -and $it.s -ne "Todo") {
            $null = gh project item-edit `
                --id $itemJson.id `
                --project-id $projId `
                --field-id $statusField.id `
                --single-select-option-id $optMap[$it.s] 2>&1
        }
        $done++
        Write-Host ("    [{0,2}/{1,2}] [{2,-11}] {3}" -f $done, $p.items.Count, $it.s, $it.t) -ForegroundColor Gray
    }
    Write-Host "  [ok] $done items added" -ForegroundColor Green
    Write-Host "  -> $($created.url)" -ForegroundColor Green
}

Write-Host ""
Write-Host "All done. View your project boards:" -ForegroundColor Green
Write-Host "  https://github.com/saad-mughal435?tab=projects" -ForegroundColor Green
