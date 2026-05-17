# Create 7 GitHub Projects (v2) boards — one per demo — pre-populated
# with realistic Done / In Progress / Todo items so the Projects tab
# on the profile reads like real engineering work, not an empty
# template.
#
# Boards created (under user 'saad-mughal435'):
#   - Kingsley MES/ERP - roadmap
#   - Pebble & Co. - storefront backlog
#   - Anvil Supply Co. - wholesale portal
#   - Manzil Properties - marketplace roadmap
#   - Vacation Homes - booking marketplace
#   - Qahwa POS - café POS roadmap
#   - Sanad - AI support copilot roadmap
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
    },
    @{
        title = "Vacation Homes - booking marketplace"
        description = "UAE short-stay booking marketplace demo. 56 stays across 10 destinations, hand-rolled date-range picker, 6-step host onboarding wizard with document upload, admin verification queue, 12-section admin SPA. Live at saadm.dev/vacation/."
        items = @(
            @{ s="Done"; t="56 stays across 10 destinations"; b="Dubai Marina, Palm Jumeirah, Hatta Mountains, RAK Beach, Fujairah, Liwa Desert, Al Ain, Sharjah, Abu Dhabi, Ras Al Khaimah." },
            @{ s="Done"; t="Hand-rolled date-range picker"; b="No library. Availability calendar with blocked / booked / available states, multi-month view, keyboard nav." },
            @{ s="Done"; t="Conflict-checked booking flow"; b="POST /bookings returns 409 if dates were taken since the picker loaded; UI bounces back with a toast and refreshes availability." },
            @{ s="Done"; t="Per-night pricing breakdown"; b="Nightly subtotal × nights + weekend surcharge + cleaning + 10% service fee + 5% VAT, itemised at checkout." },
            @{ s="Done"; t="6-step host onboarding wizard"; b="Save-and-resume drafts in localStorage, map-pin selector (Leaflet lazy-loaded), document upload (Emirates ID + Title Deed + DTCM permit + IBAN, base64 thumbnails)." },
            @{ s="Done"; t="Admin verification queue"; b="New section: pending hosts table, drawer with document previews, approve / request-changes / reject buttons. Listings stay off-market until host is live." },
            @{ s="Done"; t="12-section admin SPA"; b="Dashboard, listings (CRUD+bulk+CSV), bookings, hosts (Superhost verify), guests, reviews, payments/payouts, promotions, destinations, settings, audit, verifications." },
            @{ s="Done"; t="EN / AR locale + 4 currencies"; b="Full RTL flip; AED/USD/GBP/EUR switcher persists across pages; prices reformat at the boundary." },
            @{ s="In Progress"; t="iCal sync with Airbnb / Booking.com"; b="Two-way calendar import + export so hosts can cross-list without double-booking." },
            @{ s="Todo"; t="Channel manager (push to OTAs)"; b="Outbound push to Airbnb / Booking.com / Expedia from the host dashboard." },
            @{ s="Todo"; t="Smart-lock integration"; b="Auto-generate guest-specific PIN codes for confirmed bookings, valid only during stay window." },
            @{ s="Todo"; t="Cleaner / handyman dispatch"; b="Assign cleanings between bookings, push to assigned cleaner with check-in time." }
        )
    },
    @{
        title = "Qahwa POS - café POS roadmap"
        description = "Café & quick-service point-of-sale demo. Touch cashier terminal with PIN auth, kitchen display system, modifier-driven menus, shift cash reconciliation, 14-section admin SPA. Live at saadm.dev/pos/."
        items = @(
            @{ s="Done"; t="Touch cashier terminal with PIN lock"; b="4-staff demo set (1234 manager / 5678 supervisor / 1111+2222 cashiers). 60px buttons, ≥16px text — built for tablets." },
            @{ s="Done"; t="Category grid + modifier modal"; b="49 products in 8 categories. Modal asks Size / Milk / Syrup / Extras with per-option price deltas + live line-total preview." },
            @{ s="Done"; t="Payment flows (cash / card / split)"; b="Cash with numpad + change calculator, card with simulated approval, split cash + card with live total-covered indicator." },
            @{ s="Done"; t="Kitchen Display System"; b="5-second polling, elapsed-time warnings (amber >5min, red >8min), per-line ready checkboxes, Web Audio chime on new ticket, mark-all-served." },
            @{ s="Done"; t="14-section admin SPA"; b="Dashboard with hourly heatmap + weekly bars + top products + payment breakdown, live orders, products CRUD+bulk, categories, modifiers, discounts, tables, staff RBAC, shifts, reports, inventory, receipt template, settings, audit." },
            @{ s="Done"; t="Shift cash reconciliation + Z-report"; b="Open/close shift with cash-denomination count form, variance = counted − expected, printable Z-report." },
            @{ s="Done"; t="Inventory deduction via recipes"; b="Each product links to ingredients (espresso → 8g beans + cup + lid); decrements stock on payment; low-stock alerts on dashboard." },
            @{ s="Done"; t="Order state machine"; b="open → kitchen → ready → served → completed, plus refunded / held / voided. Status pill in cart header." },
            @{ s="In Progress"; t="Receipt printer integration"; b="ESC/POS over Bluetooth for Star TSP143 — currently uses window.print() as fallback." },
            @{ s="Todo"; t="Customer-facing ordering tablet"; b="Self-order kiosk variant that runs the same modifier modal end-to-end." },
            @{ s="Todo"; t="Loyalty stamps + redemption"; b="10 stamps = 1 free drink. Customer-side phone-number lookup at checkout." },
            @{ s="Todo"; t="WPS-compliant payroll export"; b="Tip pool + hourly wage export to bank-ready SIF file for UAE payroll." }
        )
    },
    @{
        title = "Sanad - AI support copilot roadmap"
        description = "AI customer-support copilot. SaaS-style helpdesk with Claude woven into every screen. Agent inbox with AI sidebar (reply / summary / sentiment / category / EN↔AR translate), RAG chat, 11-section admin with model selector + editable system prompt. Live at saadm.dev/sanad/."
        items = @(
            @{ s="Done"; t="Agent inbox with AI Copilot sidebar"; b="Six AI cards per conversation: suggested reply with KB citations + Insert button, summary with topic tags, sentiment with confidence bar, auto-category with confidence, EN↔AR translate toggle, quick actions." },
            @{ s="Done"; t="Customer chat widget with RAG"; b="Streaming-typewriter replies grounded in knowledge base, clickable citation chips that open a side drawer, 'Talk to a human' creates a real ticket in the agent inbox." },
            @{ s="Done"; t="Knowledge base with admin AI actions"; b="77 articles in 6 categories, tiny custom markdown renderer. Per-article: Generate FAQ, Suggest improvements, Translate to Arabic. 'Find gaps' clusters recent tickets and proposes new articles." },
            @{ s="Done"; t="11-section admin SPA"; b="Dashboard, conversations, KB CRUD, categories, agents (permission matrix), customers, AI Console (model selector + editable system prompt + test-with-sample), analytics with fallback rate + latency + cost + CSV export, integrations, settings, audit log." },
            @{ s="Done"; t="Live + mock modes"; b="Auto-detects via /api/sanad/ai/health. Worker proxy keeps the Anthropic key server-side. Falls back to a deterministic pattern-matched dictionary when no key is set so the demo never breaks for visitors." },
            @{ s="Done"; t="Cost + fallback tracking"; b="Every AI call logged with feature, model, tokens, latency, cost, fallback bool. Analytics tab surfaces it; AI cost ticker on the dashboard." },
            @{ s="In Progress"; t="Cloudflare Worker proxy"; b="The _worker.js entry was rejected twice by CF Workers Builds (auto-detect fails with assets.directory: '.'). README has the copy-pasteable worker + dashboard steps for manual enable." },
            @{ s="Todo"; t="Prompt-version history with diff"; b="Track edits to system prompt over time, compare versions side-by-side, one-click revert." },
            @{ s="Todo"; t="Embeddings + true RAG"; b="Replace the pass-the-whole-KB approach with sentence-bge embeddings + a top-k retriever for larger KBs." },
            @{ s="Todo"; t="Multi-workspace + multi-tenant"; b="Each workspace gets isolated data, prompt, branding, and Anthropic-key scoping." },
            @{ s="Todo"; t="Webhook + Linear + Slack triggers"; b="On status-change, post to a connected channel; on 'urgent' label, create a Linear issue."}
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
