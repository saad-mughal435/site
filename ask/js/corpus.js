/* corpus.js - The RAG knowledge base for Ask Saad.
 *
 * ~40 pre-chunked documents extracted from site/index.html content blocks
 * (HERO_COPY 488-514, FAQ_ITEMS 731-760, EXPERIENCE 835-895, PROJECTS 927-1080,
 *  STACK_GROUPS 695-705, About prose 784-830, WhatThisProves 1153-1177,
 *  SKILLS 1279-1294, Person JSON-LD 42-94, contact.html, watad/WALKTHROUGH.md).
 *
 * Each doc shape:
 *   {
 *     id:    'role-kingsley',     stable identifier - referenced in citations
 *     title: 'Automation Engineer · Kingsley Beverage FZCO',
 *     body:  'Plain-text body (no HTML, no Fragments).',
 *     link:  '/demo.html',        optional - drill-down on citation click
 *     scrollTo: '#projects',      optional - used when no `link`, scrolls
 *                                  the homepage to that anchor
 *     tags:  ['role','current','mes','erp','kingsley']
 *   }
 *
 * The retriever in engine.js scores by tag overlap + title match + body
 * token overlap. Tags carry the most weight, so they should be specific.
 */
(function () {
  'use strict';

  var DOCS = [
    /* ===================== Hero copy (3 variants) ===================== */
    {
      id: 'hero-all',
      title: 'Software for operations · Automation behind it',
      body: "Saad is an Automation & Software Developer focused on ERP systems, dashboards, backend tools, and web applications. He builds software that replaces manual work - spreadsheets, paper logs, copy-paste reports, ticket prep, inventory tracking, admin panels, business workflows. Engineering and IT-infrastructure background, so the systems he builds are practical, reliable, and usable by real teams.",
      scrollTo: '#top',
      tags: ['intro', 'overview', 'role', 'automation', 'developer', 'erp']
    },
    {
      id: 'hero-engineering',
      title: 'Hands on the line · Eyes on the OEE',
      body: "Saad is an Automation Engineer with a software-first approach. He runs and supports Krones beverage production lines, coordinates operators during shifts, troubleshoots production issues, and builds ERP / OEE / reporting tools around the production workflow. His strength is connecting factory operations with practical software systems: dashboards, batch records, downtime tracking, QC workflows, inventory visibility, and management reports.",
      scrollTo: '#about',
      tags: ['intro', 'automation', 'krones', 'engineer', 'oee', 'production', 'factory', 'manufacturing']
    },
    {
      id: 'hero-software',
      title: 'I write code that ends manual work',
      body: "Saad is an Automation & Software Developer focused on ERP systems, dashboards, backend tools, and web applications. He builds software that replaces manual work - spreadsheets, paper logs, copy-paste reports, inventory tracking, admin panels, and business workflows - with automation that runs itself.",
      scrollTo: '#projects',
      tags: ['intro', 'developer', 'software', 'backend', 'python', 'fastapi']
    },

    /* ===================== Identity / FAQ ===================== */
    {
      id: 'faq-who',
      title: 'Who is Muhammad Saad?',
      body: "Muhammad Saad (Saad for short) is an Automation & Software Developer currently based in the UAE and open to relocate worldwide. He builds ERP systems, dashboards, backend tools, admin panels, and web applications in Python, FastAPI, MongoDB, and JavaScript. Engineering background: B.Sc. Electrical Engineering with a Computer Engineering specialization from COMSATS Islamabad. Currently works as Automation Engineer and ERP Developer at Kingsley Beverage FZCO.",
      scrollTo: '#faq',
      tags: ['who', 'identity', 'name', 'background', 'role', 'dubai', 'uae']
    },
    {
      id: 'faq-what',
      title: 'What does Saad work on?',
      body: "The pattern is the same regardless of the project: take something a team is still doing by hand - spreadsheets, paper logs, ticket prep, copy-paste reports, manual reconciliations - and rebuild it as automation that runs itself. Most recently that meant designing and shipping a full-stack MES/ERP from scratch covering production planning, inventory, QC, accounts, and live reporting across 5 departments, plus running the Linux VM, MongoDB, Sage integration, and Cloudflare-fronted nginx behind it.",
      scrollTo: '#faq',
      tags: ['what', 'work', 'projects', 'mes', 'erp', 'kingsley', 'automation']
    },
    {
      id: 'faq-hire',
      title: 'Is Saad available for hire?',
      body: "Yes - open to backend, full-stack, automation, NOC engineering, IT infrastructure, and MES/ERP roles. On-site in the UAE, hybrid, or fully remote. Available immediately. Reach out via the contact form at saadm.dev/contact, email saad@saadm.dev, or WhatsApp +971 50 257 8065.",
      link: '/contact.html',
      tags: ['hire', 'available', 'contact', 'email', 'whatsapp', 'open-to-work', 'remote', 'on-site', 'hybrid']
    },
    {
      id: 'faq-roles',
      title: 'What type of roles is Saad open to?',
      body: "Automation, ERP / MES, manufacturing systems, backend engineering, IT operations, NOC engineering, industrial maintenance, and Python-heavy technical roles. Currently UAE-based; open to relocate worldwide. Open to on-site, hybrid, or fully remote arrangements.",
      scrollTo: '#faq',
      tags: ['roles', 'positions', 'open-to', 'automation', 'backend', 'noc', 'mes', 'erp', 'python']
    },
    {
      id: 'faq-stack',
      title: "Saad's tech stack",
      body: "Python, FastAPI, MongoDB, React, JavaScript (ES6+), Docker, Linux, nginx, Cloudflare, Git, REST APIs, JWT auth, Pandas, OpenPyXL, scikit-learn, Sage Evolution integration, LLM API. Comfortable with the full lifecycle from data-model design through deployment and ops.",
      scrollTo: '#stack',
      tags: ['stack', 'tech', 'python', 'fastapi', 'mongodb', 'react', 'javascript', 'docker', 'linux', 'cloudflare', 'sage', 'llm']
    },
    {
      id: 'faq-location',
      title: 'Where is Saad based?',
      body: "Dubai, United Arab Emirates. Originally from Pakistan; graduated from COMSATS University Islamabad in 2024. Open to relocate worldwide for the right role.",
      scrollTo: '#faq',
      tags: ['location', 'dubai', 'uae', 'pakistan', 'relocate', 'where', 'based']
    },
    {
      id: 'faq-code',
      title: "Can I see Saad's code?",
      body: "Yes - the live MES/ERP walkthrough is at saadm.dev/demo.html and saadm.dev/app (interactive, every value fabricated for privacy, every workflow faithful to the real system). Source for some open work is on GitHub at github.com/saad-mughal435 - including standalone repos for the portfolio demos (kingsley-mes-demo, sanad-copilot, watad-bms, and more).",
      link: '/demo.html',
      tags: ['code', 'github', 'demo', 'source', 'repo', 'open-source']
    },

    /* ===================== Experience (5 roles) ===================== */
    {
      id: 'role-kingsley',
      title: 'Automation & Software Developer · ERP Developer · IT Administrator · Kingsley Beverage FZCO (Jul 2025 - Present)',
      body: "Designed and shipped a full MES/ERP platform from scratch across production planning, inventory, QC, accounts, production reporting, and Sage integration - sole developer, currently running in production. Reduced production reporting time by an estimated ~60% through automated OEE monitoring, batch tracking, PDF reports, and centralised workflows across 5 departments. Administers the underlying stack end-to-end: Linux VM, MongoDB, Sage integration, Cloudflare-fronted nginx, user accounts, backups, and deployment. Runs and supports the Krones beverage production lines (blow molding, filling, Checkmate inspection, Variopac FS packaging, palletizing, PET preform handling) - coordinates operators during shifts, troubleshoots production issues. The Krones machine automation is OEM-locked; the software work focuses on line support and the surrounding ERP / OEE / reporting workflows. Authors SOPs and operator instructions.",
      link: '/demo.html',
      tags: ['role', 'current', 'kingsley', 'mes', 'erp', 'oee', 'sage', 'krones', 'beverage', 'production', 'manufacturing', 'fastapi', 'python', 'mongodb', 'admin', 'sole-developer', 'dubai']
    },
    {
      id: 'role-ptcl-noc',
      title: 'NOC Engineer · PTCL (Jul 2023 - Jul 2025)',
      body: "Backend operations for GPON, PSTN, and broadband network infrastructure at telecom scale. Monitored national network performance via SolarWinds NMS; resolved faults using Huawei and Nokia tooling with minimal subscriber downtime. Managed full incident lifecycle through Oracle CRM; partnered with the switching dept on PSTN migrations completed with zero outages. Built a Python tool that auto-generated PSTN configuration scripts from incoming tickets, removing manual prep work entirely and cutting provisioning time dramatically. Two years total. Based in Rawalpindi, Pakistan.",
      scrollTo: '#experience',
      tags: ['role', 'noc', 'ptcl', 'telecom', 'gpon', 'pstn', 'broadband', 'solarwinds', 'huawei', 'nokia', 'oracle-crm', 'python', 'pakistan', 'infrastructure', 'networks']
    },
    {
      id: 'role-fiverr',
      title: 'Freelance Designer & WordPress Developer · Fiverr (2019 - Jul 2025)',
      body: "Delivered branding, graphics, and custom WordPress builds for international clients. Managed multiple concurrent projects end-to-end - scoping, design, delivery.",
      scrollTo: '#experience',
      tags: ['role', 'freelance', 'fiverr', 'wordpress', 'design', 'remote', 'branding']
    },
    {
      id: 'role-omdena',
      title: 'Machine Learning Intern · Omdena (2023)',
      body: "Contributed to ML models for accessibility (vision-impaired navigation) and environmental monitoring (air-quality forecasting) on global Omdena collaborations. Built Python ML pipelines using scikit-learn, NumPy, Pandas, Jupyter as part of a globally distributed 50+ contributor team - data cleaning, feature engineering, training, evaluation.",
      scrollTo: '#experience',
      tags: ['role', 'omdena', 'ml', 'machine-learning', 'ai', 'scikit-learn', 'pandas', 'numpy', 'jupyter', 'python', 'accessibility', 'air-quality']
    },
    {
      id: 'role-internships',
      title: 'Engineering & Network Internships · Kingsley + PTCL (Jun - Aug 2022 / 2023)',
      body: "Technical Engineering Intern at Kingsley Beverage FZCO (Dubai, summer 2023) - first exposure to Krones machines, authored SOPs, work instructions, and quality manuals, troubleshot and resolved machine faults under supervision. Network Engineering Intern at PTCL (Rawalpindi, summer 2022) - maintained power systems, wireless communication, and switching equipment, contributed to a data centre server migration with minimal disruption.",
      scrollTo: '#experience',
      tags: ['role', 'intern', 'internship', 'kingsley', 'ptcl', 'krones', 'data-center', 'switching', 'pakistan', 'dubai']
    },

    /* ===================== Demos (8 of them) ===================== */
    {
      id: 'demo-kingsley',
      title: 'Kingsley MES / ERP / OEE Platform',
      body: "Internal full-stack operations platform that ends manual workflows across production planning, QC, batch tracking, inventory, dispatch, accounts, and Sage integration. The platform sits around the Krones production line (machine automation is locked OEM; this software digitises the operator-, QC-, stores-, and finance-side workflow). Sole developer, end-to-end, currently running in production. 20+ integrated modules including PPC, job orders, recipes/BOM, QC seam-check, batch & expiry tracking, dispatch, accounts, OEE, GRN, customs, Sage Evolution integration. 6 print-ready PDF templates (performa invoice, packing list, picking sheet, batch report, GRN, recipe sheet) generated server-side from live data. Full-stack ownership: Python/FastAPI service, MongoDB + SQL Server, React/vanilla JS frontends, Docker, Nginx, JWT auth with row-level RBAC. ~60% faster production reporting · 5 departments on one system. The Launch live app demo at /app/ is interactive with the same UI and workflows - fabricated values, faithful structure.",
      link: '/demo.html',
      tags: ['demo', 'kingsley', 'mes', 'erp', 'oee', 'production', 'fastapi', 'mongodb', 'sage', 'pdf', 'docker', 'nginx', 'rbac', 'manufacturing', 'beverage', 'flagship']
    },
    {
      id: 'demo-anvil-b2b',
      title: 'Anvil Supply Co. - B2B wholesale portal',
      body: "A wholesale / industrial portal with tier pricing, MOQs, contract discounts, quote requests, and an approval workflow for large orders. Multi-user accounts with purchaser / approver / viewer roles, recurring orders, statements view, and a data-dense admin panel with quote queue and approval queue. Tier pricing (1/10/50/100), MOQ enforcement, customer contract discounts, quote request workflow + approval workflow for orders over $1,000, bulk SKU paste add. Vanilla JS, mock API, all writes in localStorage.",
      link: '/b2b/',
      tags: ['demo', 'b2b', 'anvil', 'wholesale', 'tier-pricing', 'moq', 'approval', 'quote', 'role-based', 'admin', 'vanilla-js']
    },
    {
      id: 'demo-manzil',
      title: 'Manzil Properties - Dubai real-estate marketplace',
      body: "A Dubai real-estate marketplace demo with 65+ listings across Marina, Downtown, Palm Jumeirah, JBR, Business Bay, DIFC, Arabian Ranches and more. Map-and-list search using Leaflet/OpenStreetMap, agent and agency profiles with verified RERA-style permits, mortgage calculator with full amortisation schedule, comparable-based valuation tool, investment yield calculator, and a 15-section admin SPA. Owner-side: 6-step listing wizard (save-and-resume drafts, map-pin selector, document upload - Emirates ID + Title Deed + DLD permit + NOC + IBAN) feeding an admin verification queue. AED/USD/GBP/EUR currency switcher, EN/AR locale toggle with RTL layout.",
      link: '/property/',
      tags: ['demo', 'manzil', 'real-estate', 'property', 'dubai', 'marketplace', 'leaflet', 'maps', 'mortgage', 'rera', 'ar', 'rtl', 'admin', 'currency']
    },
    {
      id: 'demo-vacation',
      title: 'Vacation Homes - UAE short-stay booking',
      body: "A UAE short-stay booking marketplace demo with 55+ vacation homes across 10 destinations (Dubai Marina, Palm Jumeirah, Hatta Mountains, RAK Beach, Fujairah, Liwa Desert and more). Hand-rolled date-range picker, availability calendar with conflict-check, per-night pricing with weekend surcharge and 5% VAT breakdown. Conflict-check booking flow returns 409 if dates were just taken; UI bounces back with a toast. Host-side: 6-step listing wizard (save-and-resume drafts, map-pin selector, document upload - Emirates ID + ownership + DTCM permit + IBAN) feeding an admin verification queue. 12-section admin SPA + host dashboard.",
      link: '/vacation/',
      tags: ['demo', 'vacation', 'booking', 'short-stay', 'airbnb', 'dubai', 'uae', 'date-picker', 'host', 'admin', 'dtcm', 'verification']
    },
    {
      id: 'demo-pos',
      title: 'Qahwa POS - café & quick-service POS',
      body: "A café and quick-service point-of-sale demo. Touch cashier terminal with PIN auth (4-staff demo set, 60px buttons, tablet-first). Kitchen Display System with 5-second polling, elapsed-time warnings, Web Audio chime on new tickets, mark-ready checkboxes. Payment flows: cash with numpad + change calculator, card with simulated approval, split cash + card. 14-section admin SPA: dashboard with hourly heatmap + weekly bars + top products + payment breakdown, live orders pipeline with refund flow, products CRUD, modifiers, discounts, tables floor plan, staff RBAC, shifts with cash-denomination count + variance + printable Z-report, reports with CSV export, inventory with recipe-based deduction. ~5,000 LOC.",
      link: '/pos/',
      tags: ['demo', 'qahwa', 'pos', 'cafe', 'restaurant', 'kds', 'kitchen-display', 'cashier', 'pin', 'touch', 'rbac', 'z-report', 'web-audio', 'inventory']
    },
    {
      id: 'demo-sanad',
      title: 'Sanad - AI customer-support copilot',
      body: "A SaaS-style helpdesk with an LLM integrated at every touchpoint. Built to demonstrate real LLM wiring end-to-end - system prompts, streaming, prompt caching, server-side key handling via a Cloudflare Worker proxy, graceful mock fallback when the key isn't set, and cost tracking. Agent inbox with AI sidebar (suggested reply with KB citations, summary, sentiment, auto-category, EN↔AR translation). Customer chat widget with RAG-grounded streaming replies. Knowledge base with 77 articles, admin-only AI actions per article (Generate FAQ, Suggest improvements, Translate). 11-section admin SPA including AI Console (model selector Fast / Balanced / Max, editable system prompt, temperature, cache toggles). Live + mock modes - detects LLM_API_KEY via /api/sanad/ai/health.",
      link: '/sanad/',
      tags: ['demo', 'sanad', 'ai', 'llm', 'genai', 'copilot', 'helpdesk', 'rag', 'streaming', 'kb', 'knowledge-base', 'inbox', 'chat', 'mock-fallback', 'live-mode', 'cf-worker']
    },
    {
      id: 'demo-watad',
      title: 'Watad - smart-building / BMS operations console',
      body: "A live operator console for a commercial smart building - the kind of software Imdaad / EFS / Schneider / Honeywell ship to facilities teams. Live SVG floor plan with HVAC, lighting, metering and sensor equipment plotted as icons at absolute pixel coordinates, simulated BACnet/Modbus telemetry stream (5-second tick mutating ~200 points plausibly per asset class + outdoor temp + occupancy), severity-sorted alarm queue with audio cues, predictive-maintenance work orders with signature canvas, ASHRAE 90.1-overlaid energy curves, DEWA DSM demand-response panel, and a 10-section admin SPA. 3 BMS-tuned AI features: Explain alarm, Suggest maintenance, Optimise setpoints - Live AI when configured, deterministic mock otherwise. The first portfolio demo with a real-time data shape - proves Saad can think beyond REST.",
      link: '/watad/',
      tags: ['demo', 'watad', 'bms', 'building', 'facilities', 'scada', 'real-time', 'telemetry', 'bacnet', 'modbus', 'ashrae', 'hvac', 'energy', 'sustainability', 'ai', 'llm', 'imdaad', 'efs', 'schneider', 'honeywell']
    },
    {
      id: 'demo-pebble-b2c',
      title: 'Pebble & Co. - DTC storefront',
      body: "A full direct-to-consumer storefront built end-to-end - storefront, catalog, product detail, cart, multi-step checkout, customer account, and a Shopify-style admin panel with dashboard / orders / products / customers / promotions / analytics. Mock API runs entirely in-browser. 7-section admin with order status overrides + refunds, promo codes (percent / fixed / shipping), and an email log.",
      link: '/b2c/',
      tags: ['demo', 'pebble', 'b2c', 'dtc', 'storefront', 'ecommerce', 'shopify', 'cart', 'checkout', 'admin', 'mock-api']
    },
    {
      id: 'demo-lahza',
      title: 'Lahza - AI journaling + mood-tracking mobile PWA',
      body: "Saad's first mobile-shaped demo and his fourth AI integration. A Progressive Web App for personal journaling: one AI-suggested prompt a day, a few sentences, and AI detects mood + surfaces weekly patterns. Installable on iOS, Android, and desktop via 'Add to Home Screen' - no App Store, no native compilation. On desktop it renders inside a stylised iPhone frame; on mobile it's fullscreen; installed PWA opens as a standalone window with no browser chrome. 4 AI features: suggest prompt (time-of-day + recent-mood aware), detect mood (returns structured JSON), weekly insights (RAG over last 7 entries), AI Coach chat (RAG over last 14 entries with citation chips that open the cited entry in a bottom sheet). 7 views: onboarding, today, compose, journal feed, insights chart, AI Coach, profile. EN + AR locale. Entries stay in localStorage - privacy-by-default. Same Cloudflare Worker pattern as the other AI demos.",
      link: '/lahza/',
      tags: ['demo', 'lahza', 'mobile', 'pwa', 'app', 'journaling', 'wellness', 'mood', 'tracker', 'ai-coach', 'consumer', 'ios', 'android', 'standalone', 'serviceworker', 'manifest', 'rag', 'llm']
    },
    {
      id: 'demo-marsad',
      title: 'Marsad - fleet / logistics dispatcher console',
      body: "A live real-time dispatcher console for a Dubai last-mile courier - the kind of software Aramex, Noon Express, and Talabat run internally. 16 drivers across 3 shifts, 12 vans + 4 motorbikes, 96 in-flight orders across 6 service zones (Marina, JLT, Downtown, Business Bay, Deira, Sharjah Al Nahda). Live Leaflet map with vehicle pins that move every 4 seconds toward their assigned drop-off. Order queue with SLA-breach detection + Web Audio chime. 4 AI dispatcher features: explainDelay (cites real cause), suggestReroute (re-sequences by SLA), batchOptimize (assigns pending across idle drivers), dispatcherChat (conversational copilot grounded in live state). Driver-side simplified view. 9-section admin SPA. Saad's fifth AI integration and his second real-time-data-shape demo. ~4,500 LOC.",
      link: '/marsad/',
      tags: ['demo', 'marsad', 'fleet', 'logistics', 'dispatcher', 'maps', 'leaflet', 'last-mile', 'courier', 'real-time', 'sla', 'aramex', 'noon', 'talabat', 'driver', 'ai-dispatcher', 'llm', 'dubai']
    },
    {
      id: 'demo-nabta',
      title: 'Nabta - UAE HR + payroll SaaS',
      body: "A modern UAE-shaped HRIS. 32 employees across 5 departments with full UAE fields (Emirates ID, passport, visa expiry, IBAN, base + allowances). Leave management with line-manager + HR approval workflow (7 leave types per UAE Labour Law). WPS-compliant payroll runs via Emirates NBD - per-employee breakdown + Generate WPS SIF + Finalize flow, pay-day 28th. Recruitment kanban: 4 open roles, 22 candidates, lead/applied/interview/offer/hired pipeline. Q2-2026 performance review cycle. AI HR policy assistant grounded in 6 HR policies (leave, WPS, visa, gratuity, probation, remote) + UAE Labour Law (Federal Decree-Law No. 33 of 2021). Every AI reply cites by [pol-xxx] with click-to-open citations. Saad's sixth AI integration. Single hash-routed SPA, 9 sections.",
      link: '/nabta/',
      tags: ['demo', 'nabta', 'hr', 'hris', 'payroll', 'wps', 'wage-protection-system', 'uae', 'employees', 'leave', 'recruitment', 'kanban', 'performance', 'reviews', 'policy', 'labour-law', 'b2b', 'saas', 'ai', 'llm', 'rag']
    },

    /* ===================== Open-source repos (3) ===================== */
    {
      id: 'oss-n8n-devtools',
      title: 'n8n-nodes-devtools - open-source n8n automation node (published on npm)',
      body: "An open-source n8n community node Saad built in TypeScript and published to npm as @saadmughal435/n8n-nodes-devtools. It bundles the developer and crypto utilities automation workflows keep reaching for, behind a clean Resource/Operation UI: JWT sign and verify (HS256/384/512 and RS256, checks exp and nbf, with pinnable algorithms), hashing and HMAC (SHA-256/512), UUID and Nano ID generation, JSON to and from CSV, base64, and regex extraction with named groups. Engineered as a real software sample: a programmatic INodeType over a framework-free, fully unit-tested core (20 Jest tests), ESLint with the n8n community rules, and a green lint + build + test GitHub Actions CI. It demonstrates TypeScript, Node.js, SDK / node-API design, clean architecture, testing discipline, CI/CD, and publishing to a package registry - and shows Saad's automation, integration, and security-adjacent (JWT / crypto) skills. Anyone can install it with: npm install @saadmughal435/n8n-nodes-devtools. Yes, Saad has built and published open-source automation tooling.",
      link: 'https://www.npmjs.com/package/@saadmughal435/n8n-nodes-devtools',
      tags: ['project', 'opensource', 'open-source', 'npm', 'package', 'n8n', 'automation', 'workflow', 'node', 'typescript', 'nodejs', 'javascript', 'jwt', 'crypto', 'hmac', 'sha256', 'hashing', 'csv', 'base64', 'regex', 'jest', 'unit-test', 'testing', 'ci', 'github-actions', 'integration', 'sdk']
    },
    {
      id: 'oss-shopfloor-api',
      title: 'ShopFloor API - MES / OEE backend in Java / Spring Boot (open source, live demo)',
      body: "An open-source manufacturing-operations REST backend Saad built in the enterprise Java stack - Spring Boot 3 and Java 21 - taking the same operations domain as his Kingsley MES and rebuilding it the way a Java shop would. Job orders that compute OEE (Availability × Performance × Quality) on close, downtime with root-cause logging, QC holds, and FIFO inventory across stock lots. Layered service architecture, role-based JWT security with operator / QC / manager roles enforced by @PreAuthorize method security, Spring Data JPA over a Flyway-managed PostgreSQL schema (with a self-contained H2 demo profile), OpenAPI / Swagger docs, Docker, and a green GitHub Actions CI (JUnit 5, MockMvc, and a Testcontainers PostgreSQL integration test). Deployed live on Render with an interactive Swagger UI you can log into (manager / password). This is Saad's Java and Spring Boot credential alongside his Python and JavaScript work - yes, Saad knows Java and Spring Boot, and has shipped enterprise-style backend code.",
      link: 'https://github.com/saad-mughal435/shopfloor-api',
      tags: ['project', 'opensource', 'open-source', 'shopfloor', 'java', 'spring', 'spring-boot', 'backend', 'rest', 'api', 'oee', 'mes', 'manufacturing', 'jpa', 'hibernate', 'postgresql', 'flyway', 'jwt', 'security', 'swagger', 'openapi', 'docker', 'junit', 'testcontainers', 'ci', 'enterprise', 'render', 'live']
    },
    {
      id: 'oss-playwright-e2e',
      title: 'playwright-e2e - cross-browser test-automation suite (open source)',
      body: "An open-source Playwright + TypeScript end-to-end test suite Saad built that tests his own portfolio site and the live ShopFloor API. Browser specs cover load smoke, the React render, SEO / JSON-LD, navigation, the contact form, every project demo, and the Lahza PWA; API specs cover JWT auth and read-only domain endpoints. It runs across five browser and device targets - Chromium, Firefox, WebKit, plus Pixel 7 and iPhone 14 emulation - and includes an axe-core WCAG 2.0 / 2.1 A & AA accessibility scan gated on critical and serious issues. Green in GitHub Actions CI on every push, a nightly cron, and manual dispatch, uploading the HTML report, and it doubles as a production uptime check. It demonstrates Saad's QA / SDET capabilities: test automation, cross-browser testing, API testing, accessibility, and continuous integration. Source on GitHub.",
      link: 'https://github.com/saad-mughal435/playwright-e2e',
      tags: ['project', 'opensource', 'open-source', 'playwright', 'testing', 'test-automation', 'qa', 'sdet', 'e2e', 'end-to-end', 'typescript', 'cross-browser', 'api-testing', 'accessibility', 'axe-core', 'a11y', 'wcag', 'ci', 'github-actions', 'chromium', 'firefox', 'webkit', 'mobile', 'quality']
    },

    /* ===================== Stack groups (9 clusters) ===================== */
    {
      id: 'stack-languages',
      title: 'Languages',
      body: "Python (6+ years across uni / internships / production code), JavaScript (ES6+), HTML5, CSS3, SQL, Bash, and a working knowledge of C++.",
      scrollTo: '#stack',
      tags: ['stack', 'languages', 'python', 'javascript', 'html', 'css', 'sql', 'bash', 'c++']
    },
    {
      id: 'stack-web',
      title: 'Web / Frameworks',
      body: "FastAPI for backend services, vanilla JavaScript with ES modules for the portfolio demos, React (learning) for the saadm.dev homepage SPA, JSX via Babel standalone (no build step), Tailwind CSS, responsive design with CSS Grid and Flexbox.",
      scrollTo: '#stack',
      tags: ['stack', 'web', 'frameworks', 'fastapi', 'react', 'javascript', 'jsx', 'tailwind', 'responsive']
    },
    {
      id: 'stack-backend',
      title: 'Backend / APIs',
      body: "REST APIs, JSON, JWT auth, Pydantic for request/response validation, Uvicorn, Motor for async MongoDB, pymongo, pyodbc for SQL Server, asyncio, httpx for outbound HTTP.",
      scrollTo: '#stack',
      tags: ['stack', 'backend', 'apis', 'rest', 'jwt', 'pydantic', 'motor', 'pymongo', 'pyodbc', 'async']
    },
    {
      id: 'stack-databases',
      title: 'Databases',
      body: "MongoDB (the primary data store at Kingsley), SQL Server (used alongside Mongo for Sage Evolution integration), SQLite for tooling. Strong on aggregation pipelines, indexes, and transactions.",
      scrollTo: '#stack',
      tags: ['stack', 'databases', 'mongodb', 'sql-server', 'sqlite', 'aggregation', 'indexes']
    },
    {
      id: 'stack-data',
      title: 'Data / Automation',
      body: "Pandas, NumPy, OpenPyXL, Matplotlib, Excel automation, PDF generation (fpdf, pdfplumber, pypdf). Used heavily in the Kingsley MES/ERP to produce print-ready PDF reports from MongoDB queries.",
      scrollTo: '#stack',
      tags: ['stack', 'data', 'automation', 'pandas', 'numpy', 'openpyxl', 'excel', 'pdf', 'reporting']
    },
    {
      id: 'stack-devops',
      title: 'DevOps / Infrastructure',
      body: "Docker, Docker Compose, Linux (Ubuntu), nginx as reverse proxy, systemd units, cron, SSH, Cloudflare (Pages + Workers), Let's Encrypt for TLS. Runs the Kingsley stack end-to-end - Linux VM, Cloudflare-fronted nginx, backups.",
      scrollTo: '#stack',
      tags: ['stack', 'devops', 'infra', 'infrastructure', 'docker', 'linux', 'nginx', 'cloudflare', 'systemd', 'ssh', 'tls']
    },
    {
      id: 'stack-tooling',
      title: 'Tooling',
      body: "Git, GitHub, GitHub Actions for CI, VS Code, curl, jq, Postman.",
      scrollTo: '#stack',
      tags: ['stack', 'tooling', 'git', 'github', 'github-actions', 'vscode', 'curl', 'jq', 'postman']
    },
    {
      id: 'stack-ai',
      title: 'AI / ML',
      body: "LLM API integration (used in Sanad + Watad portfolio demos with a Cloudflare Worker proxy for server-side key handling, prompt caching, mock fallback, cost tracking). OpenAI API. LangChain (basic). scikit-learn for traditional ML model training during the Omdena ML internship.",
      scrollTo: '#stack',
      tags: ['stack', 'ai', 'ml', 'llm', 'genai', 'openai', 'langchain', 'scikit-learn', 'rag', 'prompt-caching']
    },
    {
      id: 'stack-industrial',
      title: 'Industrial / ERP',
      body: "MES, ERP, Sage Evolution integration, OEE monitoring, production planning, PLC concepts (working knowledge, not deep), Krones beverage-line operation, GPON / PSTN telecom infrastructure.",
      scrollTo: '#stack',
      tags: ['stack', 'industrial', 'erp', 'mes', 'sage', 'oee', 'plc', 'krones', 'gpon', 'pstn', 'manufacturing']
    },

    /* ===================== Mission / What this proves ===================== */
    {
      id: 'proves-operations',
      title: 'I understand production-line operations',
      body: "Machinery, utilities, shift workflows, downtime causes - not only the code that sits above them. Saad runs and supports the Krones beverage lines daily, so when he builds software around production he's building it for workflows he's lived through.",
      scrollTo: '#proves',
      tags: ['mission', 'proves', 'operations', 'production', 'machinery', 'krones']
    },
    {
      id: 'proves-workflows',
      title: 'I design workflows for every role on the plant',
      body: "Operators, QC, stores, finance and management each have different friction points and screens. The Kingsley MES/ERP has separate, role-tailored UI for each of the 5 departments - not one generic admin grid pretending to serve everyone.",
      scrollTo: '#proves',
      tags: ['mission', 'proves', 'workflows', 'rbac', 'role-based', 'ux', 'departments']
    },
    {
      id: 'proves-stack',
      title: 'I connect the whole stack',
      body: "Frontend screens, backend APIs, MongoDB + SQL Server, Sage/ERP data and print-ready PDF reports - end-to-end in one head. No team of five, no separate frontend / backend / devops silos.",
      scrollTo: '#proves',
      tags: ['mission', 'proves', 'full-stack', 'end-to-end', 'sole-developer']
    },
    {
      id: 'proves-paper',
      title: 'I turn paper + Excel into software',
      body: "Saad's job is converting messy spreadsheets and paper logs into structured, audit-able, fast operational tools. Most factories still run on Excel; his MES/ERP at Kingsley replaced that.",
      scrollTo: '#proves',
      tags: ['mission', 'proves', 'paper', 'excel', 'automation', 'digitisation']
    },

    /* ===================== Education ===================== */
    {
      id: 'education',
      title: 'Education',
      body: "B.Sc. Electrical Engineering with a Computer Engineering specialization (4-year programme), COMSATS University Islamabad, graduated 2024. The hardware + software cross-training shows up in the kind of work he does - operations software that talks to plant equipment.",
      scrollTo: '#about',
      tags: ['education', 'university', 'comsats', 'islamabad', 'electrical-engineering', 'computer-engineering', 'degree']
    },

    /* ===================== Contact + availability ===================== */
    {
      id: 'contact',
      title: 'How to reach Saad',
      body: "Email saad@saadm.dev, WhatsApp +971 50 257 8065, LinkedIn at linkedin.com/in/muhammadsaad435, or the contact form at saadm.dev/contact. Replies typically within 24 hours, faster during UAE business hours (Sun-Thu 09:00-18:00 GST). Currently UAE-based, available immediately, open to relocate worldwide.",
      link: '/contact.html',
      tags: ['contact', 'email', 'whatsapp', 'linkedin', 'available', 'immediate', 'relocate', 'uae']
    },

    /* ===================== Quantified impact ===================== */
    {
      id: 'impact-stats',
      title: 'Quantified impact at Kingsley',
      body: "~60% reduction in production reporting time after the MES/ERP launch. 5 departments on one system. 20+ integrated modules. 6 print-ready PDF templates. 7 Krones subsystems supported. 2 years of GPON / PSTN / broadband NOC operations at PTCL. 6+ years writing Python across university, internships, and production code.",
      scrollTo: '#stats',
      tags: ['stats', 'impact', 'metrics', 'numbers', 'kpis', 'kingsley', 'mes', 'erp']
    }
  ];

  // ----- Tokeniser used by the retriever ----------------------------------
  // Drop tokens shorter than 3 chars and a small stop-word set so common
  // English filler ("at", "he", "is", "did", "what") doesn't inflate
  // scores. The remaining tokens are the actual content words.
  var STOPWORDS = new Set([
    'the','and','for','that','with','from','this','about','what','who','when','where','why','how','can','does','did','him','his','she','her','they','them','was','were','are','any','our','out','use','has','have','had','not','its','you','your','will','would','should','could','may','might','also','some','one','two','all','more','than','then','too','very','just','like','into','because','been','being','through','over','under','here','there','their','those','these','tell','show','give','said','says','say','done','know',
    'at','he','is','in','to','of','an','as','it','on','or','by','so','if','do','be','my','me','we','us','am','i'
  ]);
  function tokenize(s) {
    return String(s || '').toLowerCase()
      .replace(/[^a-z0-9+#./_-]/g, ' ')
      .split(/\s+/)
      .filter(function (t) { return t && t.length >= 2 && !STOPWORDS.has(t); });
  }

  // ----- Pre-compute per-doc token sets for fast scoring ------------------
  DOCS.forEach(function (d) {
    d._tagSet = new Set(d.tags || []);
    d._titleTokens = new Set(tokenize(d.title));
    d._bodyTokens = new Set(tokenize(d.body));
  });

  window.AskCorpus = {
    docs: DOCS,
    byId: function (id) { return DOCS.find(function (d) { return d.id === id; }) || null; },
    tokenize: tokenize
  };
})();
