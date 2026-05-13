/* =========================================================
   Anvil Supply Co. - seed data
   Wholesale/industrial B2B portal demo.
   Exposes window.ANVIL_DATA. All values are fabricated.
   ========================================================= */
(function () {
  'use strict';

  const daysAgo = (n) => new Date(Date.now() - n * 24 * 3600 * 1000).toISOString();

  /* ---- Industries (categories) ---- */
  const INDUSTRIES = [
    { id: 'packaging',   slug: 'packaging',   name: 'Packaging',    blurb: 'Cases, films, tapes, void fill, strap', icon: '📦' },
    { id: 'chemicals',   slug: 'chemicals',   name: 'Chemicals',    blurb: 'Cleaners, lubricants, adhesives, solvents', icon: '🧪' },
    { id: 'parts',       slug: 'parts',       name: 'Spare parts',  blurb: 'Bearings, belts, fasteners, valves',  icon: '🔩' },
    { id: 'consumables', slug: 'consumables', name: 'Consumables',  blurb: 'PPE, gloves, wipes, labels, batteries', icon: '🧤' },
  ];

  /* ---- Manufacturers ---- */
  const MAKERS = ['Anvil Industrial', 'Ironhouse', 'Forge & Co.', 'Beacon Supply', 'Northwall', 'Steelyard', 'Granite Works', 'Coreline'];

  /* ---- Products: 40 SKUs across the 4 industries ---- */
  const SEED_PRODUCTS = [
    // Packaging (10)
    ['Heavy-duty cardboard box, 18x12x12', 'packaging', 'BX-1812', 4.20,  'case of 25', 25,   3, 'corrugated double-wall, kraft brown'],
    ['Heavy-duty cardboard box, 24x18x12', 'packaging', 'BX-2418', 5.80,  'case of 20', 20,   2, 'corrugated double-wall, kraft brown'],
    ['Stretch wrap, 18in x 1500ft, 80ga',  'packaging', 'SW-1880', 14.50, 'roll',       1,    1, 'clear blown stretch film'],
    ['Bubble wrap, 12in x 175ft, 3/16in',  'packaging', 'BW-1217', 21.00, 'roll',       1,    1, 'perforated every 12 inches'],
    ['Packing tape, 2in x 110yd, clear',   'packaging', 'TP-0211', 2.40,  'each',       1,    6, 'acrylic adhesive, 2.0 mil'],
    ['Paper void fill, 15in x 1700ft',     'packaging', 'PV-1517', 38.00, 'roll',       1,    1, '30% recycled kraft'],
    ['Polystrap, 1/2in x 7200ft',          'packaging', 'PS-0572', 92.00, 'coil',       1,    1, 'embossed polypropylene, 600lb break'],
    ['Pallet wrap dispenser, handheld',    'packaging', 'PW-DH01', 28.00, 'each',       1,    1, 'steel handle, ABS core'],
    ['Mailer envelope, 9x12, poly',        'packaging', 'ME-0912', 0.18,  'case of 500', 500, 1, '2.5 mil coextruded'],
    ['Edge protector, 2in V-board',        'packaging', 'EP-02V',  0.75,  'case of 100', 100, 1, 'paperboard 240gsm'],

    // Chemicals (10)
    ['Industrial degreaser, 5L',           'chemicals', 'DG-5L',   28.00, 'jug',        1,    1, 'water-based, biodegradable'],
    ['Citrus solvent, 4L',                 'chemicals', 'CS-4L',   42.00, 'jug',        1,    1, 'd-limonene 95%'],
    ['Lithium grease, 400g',               'chemicals', 'LG-400',  6.40,  'cartridge',  1,    1, 'NLGI grade 2'],
    ['Silicone spray lubricant, 400ml',    'chemicals', 'SL-400',  4.80,  'can',        1,    1, 'food-safe, NSF H1'],
    ['Two-part epoxy, 250g',               'chemicals', 'EP-250',  9.20,  'pack',       1,    1, '5-min cure, structural'],
    ['Threadlocker, medium strength, 50ml','chemicals', 'TL-50M',  11.50, 'bottle',     1,    1, 'blue, removable'],
    ['PB cleaner penetrant, 16oz',         'chemicals', 'PB-16',   6.10,  'can',        1,    1, 'low odor'],
    ['Hand cleaner gel with pumice, 4L',   'chemicals', 'HC-4L',   18.00, 'jug',        1,    1, 'pumice + d-limonene'],
    ['Floor neutralizer, 4L',              'chemicals', 'FN-4L',   16.50, 'jug',        1,    1, 'pH 7.5, low foam'],
    ['Lockout/tagout adhesive labels',     'chemicals', 'LT-LBL',  0.40,  'sheet',      1,    1, 'oil-resistant polyester'],

    // Spare parts (10)
    ['Ball bearing 6204-2RS',              'parts',     'BR-6204', 3.20,  'each',       1,    4, 'sealed, 20mm bore, ABEC-3'],
    ['Ball bearing 6206-2RS',              'parts',     'BR-6206', 4.10,  'each',       1,    4, 'sealed, 30mm bore, ABEC-3'],
    ['V-belt A48',                         'parts',     'VB-A48',  6.80,  'each',       1,    2, 'classical, 48in pitch'],
    ['V-belt B66',                         'parts',     'VB-B66',  9.40,  'each',       1,    2, 'classical, 66in pitch'],
    ['Hex bolt M8x40 zinc, qty 100',       'parts',     'HB-M8',   12.00, 'box',        1,    1, '8.8 grade, zinc plated'],
    ['Hex nut M8 zinc, qty 200',           'parts',     'HN-M8',   7.50,  'box',        1,    1, '8.8 grade, zinc plated'],
    ['Solenoid valve 1/2in NPT, 24VDC',    'parts',     'SV-12N',  38.00, 'each',       1,    1, '2-way normally closed'],
    ['Pressure gauge 0-160 PSI, 2.5in',    'parts',     'PG-160',  14.00, 'each',       1,    1, 'glycerin filled, brass'],
    ['Air cylinder 32mm bore x 100mm',     'parts',     'AC-3210', 42.00, 'each',       1,    1, 'ISO 6432 double-acting'],
    ['Photoelectric sensor M18 diffuse',   'parts',     'PE-M18',  56.00, 'each',       1,    1, 'PNP, 4-pin M12, IP67'],

    // Consumables (10)
    ['Nitrile gloves, 4mil, box of 100',   'consumables', 'GL-NIT', 9.80,  'box',       1,    2, 'powder-free, blue'],
    ['Latex gloves, 5mil, box of 100',     'consumables', 'GL-LTX', 7.40,  'box',       1,    2, 'powder-free, natural'],
    ['Cotton wipers, 25lb compressed',     'consumables', 'WP-CT',  44.00, 'bag',       1,    1, 'white, lint-free'],
    ['Shop towel roll, 12 rolls/case',     'consumables', 'WP-RL',  28.00, 'case',      1,    1, 'blue, perforated'],
    ['Earplugs, NRR 32dB, jar of 200',     'consumables', 'PE-EP',  18.00, 'jar',       1,    1, 'corded, single-use'],
    ['Safety glasses, clear anti-fog',     'consumables', 'PE-SG',  3.20,  'each',      1,    6, 'ANSI Z87.1'],
    ['Floor marking tape, 2in x 36yd',     'consumables', 'TP-FM',  8.60,  'roll',      1,    1, 'yellow PVC, abrasion-resistant'],
    ['Labels, 4x6 thermal, 250 per roll',  'consumables', 'LB-46',  4.80,  'roll',      1,    1, 'direct thermal, perforated'],
    ['AA alkaline batteries, 24-pack',     'consumables', 'BT-AA',  9.20,  'pack',      1,    1, 'industrial grade'],
    ['LED inspection torch, rechargeable', 'consumables', 'LT-IN',  22.00, 'each',      1,    1, '500 lumen, USB-C'],
  ];

  function tierBreaks(unitPrice) {
    return [
      { min: 1,   price: +unitPrice.toFixed(2) },
      { min: 10,  price: +(unitPrice * 0.94).toFixed(2) },
      { min: 50,  price: +(unitPrice * 0.88).toFixed(2) },
      { min: 100, price: +(unitPrice * 0.82).toFixed(2) },
    ];
  }
  function leadTime(industry) {
    return industry === 'chemicals' ? '5-7 business days'
         : industry === 'parts' ? '3-5 business days'
         : industry === 'packaging' ? '2-4 business days'
         : '1-3 business days';
  }
  function stock(seed) {
    const x = (seed * 9301 + 49297) % 233280 / 233280;
    return Math.floor(20 + x * 280);
  }

  const PRODUCTS = SEED_PRODUCTS.map(([name, industry, sku, unit, pack, mult, moqUnits, blurb], idx) => ({
    id: 'sku-' + (idx + 1).toString().padStart(3, '0'),
    sku,
    name,
    industry,
    slug: sku.toLowerCase(),
    manufacturer: MAKERS[idx % MAKERS.length],
    pack_size: pack,
    pack_multiple: mult,
    moq: moqUnits,
    unit_price: unit,
    tier_pricing: tierBreaks(unit),
    stock: stock(idx + 1),
    lead_time: leadTime(industry),
    short_desc: blurb,
    description: `${name}. ${blurb}. Supplied as ${pack}. Minimum order ${moqUnits} ${moqUnits === 1 ? 'unit' : 'units'}. Ships from our central warehouse with ${leadTime(industry)} lead time.`,
    specs: {
      manufacturer: MAKERS[idx % MAKERS.length],
      sku,
      pack_size: pack,
      moq: moqUnits + (moqUnits === 1 ? ' unit' : ' units'),
      lead_time: leadTime(industry),
      ships_from: 'Central DC, Jebel Ali',
      country_of_origin: ['DE','US','CN','IT','AE','TR'][idx % 6],
      hs_code: '8' + (3000 + idx * 13).toString().slice(0, 4) + '.' + (10 + idx % 90),
    },
    tags: idx % 5 === 0 ? ['bestseller'] : idx % 7 === 0 ? ['new'] : [],
    related: [], // filled below
  }));

  // Related: 4 other SKUs in the same industry
  PRODUCTS.forEach(p => {
    p.related = PRODUCTS.filter(o => o.industry === p.industry && o.id !== p.id).slice(0, 4).map(o => o.id);
  });

  /* ---- Customer companies (8) with 2-3 users each ---- */
  const COMPANIES = [
    {
      id: 'co-1', name: 'Acme Demo Industries', slug: 'acme', tier: 'Contract',
      payment_terms: 'Net 30', credit_limit: 50000, open_balance: 12450.20,
      ship_to: [
        { id: 'sa-1', label: 'Acme HQ', line1: '120 Demo Industrial Park', city: 'Dubai', country: 'UAE', default: true },
        { id: 'sa-2', label: 'Acme DC2', line1: 'Warehouse 4, Block B',     city: 'Jebel Ali', country: 'UAE' },
      ],
      users: [
        { id: 'u-1', name: 'Demo Purchaser',  email: 'purchaser@acme.demo', role: 'purchaser' },
        { id: 'u-2', name: 'Demo Approver',   email: 'approver@acme.demo',  role: 'approver' },
        { id: 'u-3', name: 'Sample Viewer',   email: 'viewer@acme.demo',    role: 'viewer' },
      ],
      contract_discount: 0.05,
    },
    {
      id: 'co-2', name: 'Beta Sample Mfg.',     slug: 'beta',  tier: 'Standard',
      payment_terms: 'Net 30', credit_limit: 25000, open_balance: 4810.00,
      ship_to: [{ id: 'sa-3', label: 'Beta Main', line1: '88 Sample Road', city: 'Abu Dhabi', country: 'UAE', default: true }],
      users: [
        { id: 'u-4', name: 'Sample Buyer', email: 'buyer@beta.demo', role: 'purchaser' },
        { id: 'u-5', name: 'Sample Lead',  email: 'lead@beta.demo',  role: 'approver' },
      ],
      contract_discount: 0,
    },
    { id: 'co-3', name: 'Sigma Placeholder Co.',     slug: 'sigma', tier: 'Standard', payment_terms: 'Net 30', credit_limit: 18000, open_balance: 0, ship_to: [{ id: 'sa-4', label: 'Sigma HQ', line1: '4 Placeholder Ave', city: 'Sharjah', country: 'UAE', default: true }], users: [{ id: 'u-6', name: 'Demo Procurement', email: 'proc@sigma.demo', role: 'purchaser' }], contract_discount: 0 },
    { id: 'co-4', name: 'Gamma Industrial Demo',     slug: 'gamma', tier: 'Contract', payment_terms: 'Net 60', credit_limit: 75000, open_balance: 28430.10, ship_to: [{ id: 'sa-5', label: 'Gamma Plant', line1: 'Plant Road, Sector 9', city: 'Dubai', country: 'UAE', default: true }], users: [{ id: 'u-7', name: 'Demo Maintenance', email: 'maint@gamma.demo', role: 'purchaser' }, { id: 'u-8', name: 'Demo Plant Mgr', email: 'pm@gamma.demo', role: 'approver' }], contract_discount: 0.08 },
    { id: 'co-5', name: 'Delta Sample Workshop',     slug: 'delta', tier: 'Standard', payment_terms: 'Advance',  credit_limit: 0,     open_balance: 0,       ship_to: [{ id: 'sa-6', label: 'Delta Workshop', line1: 'Industrial Plot 14', city: 'Ras al Khaimah', country: 'UAE', default: true }], users: [{ id: 'u-9', name: 'Sample Owner', email: 'owner@delta.demo', role: 'purchaser' }], contract_discount: 0 },
    { id: 'co-6', name: 'Omega Placeholder Logistics', slug: 'omega', tier: 'Standard', payment_terms: 'Net 30', credit_limit: 20000, open_balance: 1240.00, ship_to: [{ id: 'sa-7', label: 'Omega DC', line1: 'Logistics City Block 12', city: 'Dubai', country: 'UAE', default: true }], users: [{ id: 'u-10', name: 'Demo Operator', email: 'ops@omega.demo', role: 'purchaser' }], contract_discount: 0 },
    { id: 'co-7', name: 'Kilo Demo Maintenance Co.',   slug: 'kilo',  tier: 'Standard', payment_terms: 'Net 30', credit_limit: 30000, open_balance: 8800.50, ship_to: [{ id: 'sa-8', label: 'Kilo Yard', line1: 'Yard 22, Industrial Area', city: 'Ajman', country: 'UAE', default: true }], users: [{ id: 'u-11', name: 'Sample Foreman', email: 'foreman@kilo.demo', role: 'purchaser' }, { id: 'u-12', name: 'Demo Director', email: 'dir@kilo.demo', role: 'approver' }], contract_discount: 0 },
    { id: 'co-8', name: 'Tau Sample Engineering',      slug: 'tau',   tier: 'Contract', payment_terms: 'Net 30', credit_limit: 40000, open_balance: 0,       ship_to: [{ id: 'sa-9', label: 'Tau HQ', line1: '7 Sample Boulevard', city: 'Dubai', country: 'UAE', default: true }], users: [{ id: 'u-13', name: 'Demo Engineer', email: 'eng@tau.demo', role: 'purchaser' }], contract_discount: 0.05 },
  ];

  const CURRENT_COMPANY = COMPANIES[0];
  const CURRENT_USER = CURRENT_COMPANY.users[0];

  /* ---- Orders (25) ---- */
  const ORDER_STATUSES = ['submitted', 'approved', 'fulfilled', 'shipped', 'delivered', 'cancelled'];
  const ORDERS = [];
  for (let i = 0; i < 25; i++) {
    const co = COMPANIES[i % COMPANIES.length];
    const lineCount = 1 + Math.floor(Math.random() * 4);
    const lines = [];
    let subtotal = 0;
    for (let j = 0; j < lineCount; j++) {
      const p = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
      const qty = p.moq * (1 + Math.floor(Math.random() * 5));
      const tier = p.tier_pricing.slice().reverse().find(t => qty >= t.min);
      const unit_price = tier.price;
      const line_total = +(unit_price * qty).toFixed(2);
      lines.push({ product_id: p.id, sku: p.sku, name: p.name, qty, unit_price, line_total });
      subtotal += line_total;
    }
    const discount = co.contract_discount ? +(subtotal * co.contract_discount).toFixed(2) : 0;
    const freight = subtotal - discount >= 500 ? 0 : 35;
    const tax = +((subtotal - discount) * 0.05).toFixed(2);
    const total = +(subtotal - discount + freight + tax).toFixed(2);
    ORDERS.push({
      id: 'PO-' + (10000 + i + 1),
      number: 'PO-' + (10000 + i + 1),
      company_id: co.id,
      company_name: co.name,
      customer_name: co.users[0].name,
      customer_email: co.users[0].email,
      placed_at: daysAgo(Math.floor(Math.random() * 60) + 1),
      status: ORDER_STATUSES[Math.floor(Math.random() * ORDER_STATUSES.length)],
      lines, subtotal, discount, freight, tax, total,
      payment_terms: co.payment_terms,
      po_number: 'PO-EXT-' + (4200 + i),
      ship_to: co.ship_to[0],
    });
  }

  /* ---- Quotes (5 open) ---- */
  const QUOTES = [
    { id: 'q-1', company_id: 'co-1', company_name: 'Acme Demo Industries', requester: 'Demo Purchaser', requested_at: daysAgo(2), status: 'pending', items_count: 4, notes: 'Quarterly maintenance bundle, please quote freight to Dubai.' },
    { id: 'q-2', company_id: 'co-4', company_name: 'Gamma Industrial Demo', requester: 'Demo Maintenance', requested_at: daysAgo(5), status: 'quoted', items_count: 7, notes: 'Need volume discount for 500 belts and 200 bearings.' },
    { id: 'q-3', company_id: 'co-2', company_name: 'Beta Sample Mfg.', requester: 'Sample Buyer', requested_at: daysAgo(1), status: 'pending', items_count: 2, notes: 'Looking for substitute for SV-12N - any equivalent stocked?' },
    { id: 'q-4', company_id: 'co-7', company_name: 'Kilo Demo Maintenance Co.', requester: 'Sample Foreman', requested_at: daysAgo(8), status: 'accepted', items_count: 3, notes: '' },
    { id: 'q-5', company_id: 'co-3', company_name: 'Sigma Placeholder Co.', requester: 'Demo Procurement', requested_at: daysAgo(11), status: 'expired', items_count: 5, notes: 'Project delayed, please reissue if available.' },
  ];

  /* ---- Invoices (12) ---- */
  const INVOICES = [
    { id: 'INV-2010', company_id: 'co-1', amount: 4250.20, due_at: daysAgo(-12), status: 'open' },
    { id: 'INV-2011', company_id: 'co-1', amount: 8200.00, due_at: daysAgo(7),   status: 'overdue' },
    { id: 'INV-2012', company_id: 'co-4', amount: 12430.10, due_at: daysAgo(-3),  status: 'open' },
    { id: 'INV-2013', company_id: 'co-4', amount: 16000.00, due_at: daysAgo(20),  status: 'overdue' },
    { id: 'INV-2014', company_id: 'co-7', amount: 4400.25,  due_at: daysAgo(-10), status: 'open' },
    { id: 'INV-2015', company_id: 'co-7', amount: 4400.25,  due_at: daysAgo(14),  status: 'overdue' },
    { id: 'INV-2016', company_id: 'co-2', amount: 4810.00,  due_at: daysAgo(-22), status: 'open' },
    { id: 'INV-2017', company_id: 'co-6', amount: 1240.00,  due_at: daysAgo(-5),  status: 'open' },
    { id: 'INV-2018', company_id: 'co-3', amount: 980.00,   due_at: daysAgo(40),  status: 'paid' },
    { id: 'INV-2019', company_id: 'co-8', amount: 6200.00,  due_at: daysAgo(55),  status: 'paid' },
    { id: 'INV-2020', company_id: 'co-5', amount: 320.00,   due_at: daysAgo(80),  status: 'paid' },
    { id: 'INV-2021', company_id: 'co-2', amount: 1980.00,  due_at: daysAgo(120), status: 'paid' },
  ];

  /* ---- Recurring orders (4) ---- */
  const RECURRING = [
    { id: 'rec-1', name: 'Monthly cleaning kit',  frequency: 'monthly',  next_run: daysAgo(-5),  line_count: 6, total: 412.50, active: true },
    { id: 'rec-2', name: 'Weekly PPE replenishment', frequency: 'weekly', next_run: daysAgo(-2),  line_count: 4, total: 188.20, active: true },
    { id: 'rec-3', name: 'Quarterly belts & bearings', frequency: 'quarterly', next_run: daysAgo(-40), line_count: 9, total: 1840.00, active: true },
    { id: 'rec-4', name: 'Adhoc tape order',      frequency: 'monthly',  next_run: daysAgo(-18), line_count: 2, total: 64.80, active: false },
  ];

  window.ANVIL_DATA = {
    brand: {
      name: 'Anvil Supply Co.',
      tagline: 'Industrial supplies, no nonsense.',
      email: 'orders@anvil.demo',
      phone: '+971 4 010 1010',
      free_freight_threshold: 500,
      tax_rate: 0.05,
    },
    industries: INDUSTRIES,
    products: PRODUCTS,
    companies: COMPANIES,
    current_company: CURRENT_COMPANY,
    current_user: CURRENT_USER,
    orders: ORDERS,
    quotes: QUOTES,
    invoices: INVOICES,
    recurring: RECURRING,
  };
})();
