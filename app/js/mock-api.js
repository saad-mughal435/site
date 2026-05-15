/*
 * mock-api.js - disconnected backend for the standalone demo.
 *
 * Wraps window.fetch + XMLHttpRequest. Every /api/* and /auth/* request is
 * intercepted and answered locally with rich placeholder data. No request
 * ever leaves the browser.
 *
 * Every sidebar menu has populated data so the app feels alive end-to-end.
 */

(function () {
  'use strict';

  const log = (...a) => console.debug('[mock-api]', ...a);

  /* =========================================================
     0. Auto-admin login - set tokens BEFORE the app boots
     ========================================================= */
  const ADMIN_USER = {
    _id: 'demo-admin-1', id: 'demo-admin-1',
    username: 'demo.admin', email: 'admin@demoplant.local',
    full_name: 'Demo Admin', role: 'admin',
    is_active: true, permissions: ['*'],
    allowed_menus: null,
    created_at: '2026-01-01T00:00:00Z',
  };
  const ADMIN_TOKEN = 'demo.admin.jwt.placeholder.token';

  try {
    localStorage.setItem('demoplant_auth_token', ADMIN_TOKEN);
    localStorage.setItem('demoplant_current_user', JSON.stringify(ADMIN_USER));
    localStorage.setItem('auth_token', ADMIN_TOKEN);
    localStorage.setItem('current_user', JSON.stringify(ADMIN_USER));
  } catch (_) {}

  const today = new Date('2026-05-13');
  const iso = (d) => new Date(d).toISOString();
  const todayISO = iso(today);
  const ymd = (d) => new Date(d).toISOString().slice(0, 10);
  const daysAgo = (n) => { const x = new Date(today); x.setDate(x.getDate() - n); return iso(x); };
  const oid = (p='') => p + Math.random().toString(36).slice(2, 10);

  /* =========================================================
     1. Seed garbage data
     ========================================================= */

  // ---- Recipes ----
  // Names include "bottle"/"can"/"pet" (filter categories) and "Xml"/"2.5l"
  // (so getBottleSizeInfo can derive perCase + sizeMl for the volume toggle).
  // Ingredients are PER CASE so calculator math feels sensible: 200 cases
  // of 500 mL bottles ≈ 2400 L water (~12 L/case × 200).
  const RECIPES = [
    {
      _id: 'rec-1', id: 'rec-1',
      recipe_name: 'Demo Bottle 500ml', code: 'REC-A1', name: 'Demo Bottle 500ml',
      product_code: 'FG-500ML', product_name: 'Sample Beverage 500 mL',
      version: 1, status: 'released', uom: 'case', batch_size_l: 12, base_qty: 1, gtin: '1234567890017',
      ingredients: [
        { rm_code: 'RM-WATER',   description: 'Demo Water',         qty: 11.28, uom: 'L', recipe_qty: 11.28, required_qty: 11.28 },
        { rm_code: 'RM-SUGAR',   description: 'Demo Sugar',         qty: 0.60,  uom: 'kg', recipe_qty: 0.60, required_qty: 0.60 },
        { rm_code: 'RM-FLAVOR',  description: 'Demo Flavor X',      qty: 0.12,  uom: 'L', recipe_qty: 0.12, required_qty: 0.12 },
        { rm_code: 'RM-CO2',     description: 'Demo CO2',           qty: 0.04,  uom: 'kg', recipe_qty: 0.04, required_qty: 0.04 },
        { rm_code: 'RM-PREFORM', description: 'PET preform 500 mL', qty: 24,    uom: 'pcs', recipe_qty: 24, required_qty: 24 },
        { rm_code: 'RM-CAP',     description: 'Bottle cap',         qty: 24,    uom: 'pcs', recipe_qty: 24, required_qty: 24 },
        { rm_code: 'RM-LABEL',   description: 'Shrink label 500 mL',qty: 24,    uom: 'pcs', recipe_qty: 24, required_qty: 24 },
        { rm_code: 'RM-CARTON',  description: 'Demo Carton',        qty: 1,     uom: 'pcs', recipe_qty: 1,  required_qty: 1 },
      ],
      items: [],
    },
    {
      _id: 'rec-2', id: 'rec-2',
      recipe_name: 'Demo Bottle 1000ml', code: 'REC-B2', name: 'Demo Bottle 1000ml',
      product_code: 'FG-1L', product_name: 'Sample Beverage 1 L',
      version: 1, status: 'released', uom: 'case', batch_size_l: 24, base_qty: 1, gtin: '1234567890024',
      ingredients: [
        { rm_code: 'RM-WATER',   description: 'Demo Water',          qty: 22.08, uom: 'L',  recipe_qty: 22.08, required_qty: 22.08 },
        { rm_code: 'RM-SUGAR',   description: 'Demo Sugar',          qty: 1.68,  uom: 'kg', recipe_qty: 1.68, required_qty: 1.68 },
        { rm_code: 'RM-FLAVOR',  description: 'Demo Flavor Y',       qty: 0.24,  uom: 'L',  recipe_qty: 0.24, required_qty: 0.24 },
        { rm_code: 'RM-CO2',     description: 'Demo CO2',            qty: 0.12,  uom: 'kg', recipe_qty: 0.12, required_qty: 0.12 },
        { rm_code: 'RM-PREFORM-1L', description: 'PET preform 1 L',  qty: 24,    uom: 'pcs', recipe_qty: 24,  required_qty: 24 },
        { rm_code: 'RM-CAP',     description: 'Bottle cap',          qty: 24,    uom: 'pcs', recipe_qty: 24,  required_qty: 24 },
        { rm_code: 'RM-LABEL-1L',description: 'Shrink label 1 L',    qty: 24,    uom: 'pcs', recipe_qty: 24,  required_qty: 24 },
        { rm_code: 'RM-CARTON',  description: 'Demo Carton',         qty: 1,     uom: 'pcs', recipe_qty: 1,   required_qty: 1 },
      ],
      items: [],
    },
    {
      _id: 'rec-3', id: 'rec-3',
      recipe_name: 'Demo Bottle 250ml', code: 'REC-C3', name: 'Demo Bottle 250ml',
      product_code: 'FG-250ML', product_name: 'Sample Beverage 250 mL',
      version: 1, status: 'released', uom: 'case', batch_size_l: 6, base_qty: 1, gtin: '1234567890031',
      ingredients: [
        { rm_code: 'RM-WATER',   description: 'Demo Water',          qty: 5.76, uom: 'L',  recipe_qty: 5.76, required_qty: 5.76 },
        { rm_code: 'RM-SUGAR',   description: 'Demo Sugar',          qty: 0.18, uom: 'kg', recipe_qty: 0.18, required_qty: 0.18 },
        { rm_code: 'RM-FLAVOR',  description: 'Demo Flavor Z',       qty: 0.06, uom: 'L',  recipe_qty: 0.06, required_qty: 0.06 },
        { rm_code: 'RM-CO2',     description: 'Demo CO2',            qty: 0.02, uom: 'kg', recipe_qty: 0.02, required_qty: 0.02 },
        { rm_code: 'RM-PREFORM-250', description: 'PET preform 250 mL', qty: 24, uom: 'pcs', recipe_qty: 24, required_qty: 24 },
        { rm_code: 'RM-CAP',     description: 'Bottle cap',          qty: 24,   uom: 'pcs', recipe_qty: 24,  required_qty: 24 },
        { rm_code: 'RM-LABEL-250',description: 'Shrink label 250 mL',qty: 24,   uom: 'pcs', recipe_qty: 24,  required_qty: 24 },
        { rm_code: 'RM-CARTON',  description: 'Demo Carton',         qty: 1,    uom: 'pcs', recipe_qty: 1,   required_qty: 1 },
      ],
      items: [],
    },
    {
      _id: 'rec-4', id: 'rec-4',
      recipe_name: 'Demo Can 330ml', code: 'REC-D4', name: 'Demo Can 330ml',
      product_code: 'FG-330ML', product_name: 'Sample Beverage 330 mL Can',
      version: 1, status: 'released', uom: 'case', batch_size_l: 7.92, base_qty: 1, gtin: '1234567890048',
      ingredients: [
        { rm_code: 'RM-WATER',   description: 'Demo Water',          qty: 7.20, uom: 'L',  recipe_qty: 7.20, required_qty: 7.20 },
        { rm_code: 'RM-SUGAR',   description: 'Demo Sugar',          qty: 0.42, uom: 'kg', recipe_qty: 0.42, required_qty: 0.42 },
        { rm_code: 'RM-FLAVOR',  description: 'Demo Flavor X',       qty: 0.08, uom: 'L',  recipe_qty: 0.08, required_qty: 0.08 },
        { rm_code: 'RM-CO2',     description: 'Demo CO2',            qty: 0.03, uom: 'kg', recipe_qty: 0.03, required_qty: 0.03 },
        { rm_code: 'RM-CAN-330', description: 'Aluminum can 330 mL', qty: 24,   uom: 'pcs', recipe_qty: 24,  required_qty: 24 },
        { rm_code: 'RM-CARTON',  description: 'Demo Carton',         qty: 1,    uom: 'pcs', recipe_qty: 1,   required_qty: 1 },
      ],
      items: [],
    },
    {
      _id: 'rec-5', id: 'rec-5',
      recipe_name: 'Demo PET 2.5L', code: 'REC-E5', name: 'Demo PET 2.5L',
      product_code: 'FG-PET', product_name: 'Sample Beverage 2.5 L PET',
      version: 1, status: 'released', uom: 'case', batch_size_l: 15, base_qty: 1, gtin: '1234567890055',
      ingredients: [
        { rm_code: 'RM-WATER',   description: 'Demo Water',          qty: 14.10, uom: 'L',  recipe_qty: 14.10, required_qty: 14.10 },
        { rm_code: 'RM-SUGAR',   description: 'Demo Sugar',          qty: 1.05,  uom: 'kg', recipe_qty: 1.05,  required_qty: 1.05 },
        { rm_code: 'RM-FLAVOR',  description: 'Demo Flavor Y',       qty: 0.15,  uom: 'L',  recipe_qty: 0.15,  required_qty: 0.15 },
        { rm_code: 'RM-CO2',     description: 'Demo CO2',            qty: 0.07,  uom: 'kg', recipe_qty: 0.07,  required_qty: 0.07 },
        { rm_code: 'RM-PREFORM-1L', description: 'PET preform 2.5 L',qty: 6,     uom: 'pcs', recipe_qty: 6,    required_qty: 6 },
        { rm_code: 'RM-CAP',     description: 'PET cap',             qty: 6,     uom: 'pcs', recipe_qty: 6,    required_qty: 6 },
        { rm_code: 'RM-LABEL-1L',description: 'PET label 2.5 L',     qty: 6,     uom: 'pcs', recipe_qty: 6,    required_qty: 6 },
        { rm_code: 'RM-CARTON',  description: 'Demo Carton',         qty: 1,     uom: 'pcs', recipe_qty: 1,    required_qty: 1 },
      ],
      items: [],
    },
    {
      _id: 'rec-6', id: 'rec-6',
      recipe_name: 'Demo Can 250ml', code: 'REC-F6', name: 'Demo Can 250ml',
      product_code: 'FG-CAN-250', product_name: 'Sample Beverage 250 mL Can',
      version: 1, status: 'released', uom: 'case', batch_size_l: 6, base_qty: 1, gtin: '1234567890062',
      ingredients: [
        { rm_code: 'RM-WATER',   description: 'Demo Water',          qty: 5.52, uom: 'L',  recipe_qty: 5.52, required_qty: 5.52 },
        { rm_code: 'RM-SUGAR',   description: 'Demo Sugar',          qty: 0.30, uom: 'kg', recipe_qty: 0.30, required_qty: 0.30 },
        { rm_code: 'RM-FLAVOR',  description: 'Demo Flavor Z',       qty: 0.06, uom: 'L',  recipe_qty: 0.06, required_qty: 0.06 },
        { rm_code: 'RM-CO2',     description: 'Demo CO2',            qty: 0.02, uom: 'kg', recipe_qty: 0.02, required_qty: 0.02 },
        { rm_code: 'RM-CAN-250', description: 'Aluminum can 250 mL', qty: 24,   uom: 'pcs', recipe_qty: 24,  required_qty: 24 },
        { rm_code: 'RM-CARTON',  description: 'Demo Carton',         qty: 1,    uom: 'pcs', recipe_qty: 1,   required_qty: 1 },
      ],
      items: [],
    },
  ];
  // populate "items" alias used by some modules
  RECIPES.forEach(r => { r.items = r.ingredients.map(i => ({ ...i })); });

  // ---- Inventory: 12 RMs + 3 FGs, three RMs flagged short ----
  // Realistic per-SKU unit costs in AED. stock_value / transaction_value
  // / ave_unit_cost are derived so every screen shows believable money.
  const INVENTORY = [
    { item_code: 'RM-WATER',      description: 'Demo Water',           category: 'RM', uom: 'L',   on_hand: 28000,  reserved: 4500,   reorder_point: 8000,   unit_cost: 0.012, ave_unit_cost: 0.012, stock_value: 336,    transaction_value: 336 },
    { item_code: 'RM-SUGAR',      description: 'Demo Sugar',           category: 'RM', uom: 'kg',  on_hand: 3200,   reserved: 850,    reorder_point: 4000,   unit_cost: 4.20,  ave_unit_cost: 4.15,  stock_value: 13440,  transaction_value: 13440, short: true },
    { item_code: 'RM-FLAVOR',     description: 'Demo Flavor X',        category: 'RM', uom: 'L',   on_hand: 320,    reserved: 90,     reorder_point: 400,    unit_cost: 28.50, ave_unit_cost: 28.10, stock_value: 9120,   transaction_value: 9120,  short: true },
    { item_code: 'RM-CO2',        description: 'Demo CO2',             category: 'RM', uom: 'kg',  on_hand: 8400,   reserved: 950,    reorder_point: 3000,   unit_cost: 1.85,  ave_unit_cost: 1.80,  stock_value: 15540,  transaction_value: 15540 },
    { item_code: 'RM-PREFORM',    description: 'PET preform 500 mL',   category: 'RM', uom: 'pcs', on_hand: 480000, reserved: 120000, reorder_point: 150000, unit_cost: 0.18,  ave_unit_cost: 0.175, stock_value: 86400,  transaction_value: 86400 },
    { item_code: 'RM-PREFORM-1L', description: 'PET preform 1 L',      category: 'RM', uom: 'pcs', on_hand: 180000, reserved: 60000,  reorder_point: 80000,  unit_cost: 0.28,  ave_unit_cost: 0.275, stock_value: 50400,  transaction_value: 50400 },
    { item_code: 'RM-PREFORM-250',description: 'PET preform 250 mL',   category: 'RM', uom: 'pcs', on_hand: 70000,  reserved: 22000,  reorder_point: 100000, unit_cost: 0.11,  ave_unit_cost: 0.105, stock_value: 7700,   transaction_value: 7700,  short: true },
    { item_code: 'RM-CAP',        description: 'Bottle cap',           category: 'RM', uom: 'pcs', on_hand: 510000, reserved: 110000, reorder_point: 250000, unit_cost: 0.045, ave_unit_cost: 0.043, stock_value: 22950,  transaction_value: 22950 },
    { item_code: 'RM-LABEL',      description: 'Shrink label 500 mL',  category: 'RM', uom: 'pcs', on_hand: 470000, reserved: 90000,  reorder_point: 200000, unit_cost: 0.038, ave_unit_cost: 0.036, stock_value: 17860,  transaction_value: 17860 },
    { item_code: 'RM-LABEL-1L',   description: 'Shrink label 1 L',     category: 'RM', uom: 'pcs', on_hand: 170000, reserved: 38000,  reorder_point: 80000,  unit_cost: 0.052, ave_unit_cost: 0.050, stock_value: 8840,   transaction_value: 8840 },
    { item_code: 'RM-LABEL-250',  description: 'Shrink label 250 mL',  category: 'RM', uom: 'pcs', on_hand: 130000, reserved: 12000,  reorder_point: 70000,  unit_cost: 0.025, ave_unit_cost: 0.024, stock_value: 3250,   transaction_value: 3250 },
    { item_code: 'RM-CARTON',     description: 'Demo Carton',          category: 'RM', uom: 'pcs', on_hand: 24000,  reserved: 4800,   reorder_point: 12000,  unit_cost: 1.85,  ave_unit_cost: 1.80,  stock_value: 44400,  transaction_value: 44400 },
    { item_code: 'FG-500ML',      description: 'Sample Beverage 500 mL', category: 'FG', uom: 'case', on_hand: 3850, reserved: 980,  reorder_point: 1500, unit_cost: 14.40, ave_unit_cost: 14.10, stock_value: 55440, transaction_value: 55440 },
    { item_code: 'FG-1L',         description: 'Sample Beverage 1 L',    category: 'FG', uom: 'case', on_hand: 1620, reserved: 420,  reorder_point: 1000, unit_cost: 19.20, ave_unit_cost: 19.00, stock_value: 31104, transaction_value: 31104 },
    { item_code: 'FG-250ML',      description: 'Sample Beverage 250 mL', category: 'FG', uom: 'case', on_hand: 2240, reserved: 480,  reorder_point: 900,  unit_cost: 9.60,  ave_unit_cost: 9.45,  stock_value: 21504, transaction_value: 21504 },
  ];

  // ---- Inventory transactions log (GRN view) - synthesise 80 entries ----
  function genInventoryTxns() {
    const out = [];
    const reasons = ['GRN', 'Production OUT', 'Production IN', 'Dispatch', 'Adjustment', 'Transfer'];
    for (let i = 0; i < 80; i++) {
      const it = INVENTORY[i % INVENTORY.length];
      const reason = reasons[i % reasons.length];
      const isIn = ['GRN', 'Production IN'].includes(reason);
      // Scale qty by UOM so a "GRN" of preforms isn't 5 pcs.
      const scale = it.uom === 'pcs' ? 1000 : (it.uom === 'L' ? 50 : 1);
      const qty = ((Math.floor(Math.random() * 80) + 5) * scale) * (isIn ? 1 : -1);
      const txnValue = Math.round(Math.abs(qty) * it.unit_cost * 100) / 100;
      out.push({
        _id: oid('txn-'), id: oid('id-'),
        date: daysAgo(i % 30),
        item_code: it.item_code,
        description: it.description,
        category: it.category,
        reason,
        document_no: `${reason.slice(0,3).toUpperCase()}-${1000 + i}`,
        supplier: isIn && reason === 'GRN' ? ['Demo Supplier Co','Acme Materials','Placeholder Supply'][i % 3] : '',
        warehouse: ['WH-MAIN','WH-PROD','WH-DISPATCH'][i % 3],
        qty,
        qty_in: isIn ? Math.abs(qty) : 0,
        qty_out: !isIn ? Math.abs(qty) : 0,
        uom: it.uom,
        unit_cost: it.unit_cost,
        transaction_value: txnValue,
        total_qty_in_value: isIn ? txnValue : 0,
        total_qty_out_value: !isIn ? txnValue : 0,
      });
    }
    return out;
  }
  const INVENTORY_TXNS = genInventoryTxns();

  // ---- Customers - 14 records, mix of UAE / Export / inactive ----
  const CUSTOMER_NAMES = [
    'Demo Customer Ltd', 'Acme Beverages', 'Placeholder FZE', 'Sample Distrib Co',
    'Test Trader LLC',   'Sigma Foodstuff', 'Demo Retail Group', 'Beta Wholesale Co',
    'Sample Hospitality LLC', 'Demo Cafeterias', 'Placeholder Hypermart', 'Alpha Catering',
    'Gamma Logistics FZE', 'Sample Hotels Group',
  ];
  const CUSTOMERS = CUSTOMER_NAMES.map((name, i) => ({
    _id: 'c-' + (i+1),
    code: 'CUST-' + String(i+1).padStart(3,'0'),
    customer_code: 'CUST-' + String(i+1).padStart(3,'0'),
    name,
    address: `Plot ${i*3+1}, Demo ${['Trade Zone','Industrial Area','Logistics Park','FZ Block','South Zone'][i%5]}, ${['Dubai','Sharjah','Ajman','Abu Dhabi','Fujairah'][i%5]}`,
    customer_ref: 'CR-' + String(i+1).padStart(4,'0'),
    market: i % 4 === 0 ? 'EXPORT' : 'UAE',
    payment_terms: ['Net 30','Net 45','Net 60','Advance'][i % 4],
    contact_person: ['Alex','Sam','Pat','Casey','Jordan','Riley','Morgan','Taylor'][i % 8] + ' Demo',
    email: name.toLowerCase().replace(/[^a-z0-9]+/g,'').slice(0,12) + '@demoplant.local',
    phone: '+000-' + String(100 + i).padStart(4,'0'),
    trn: '1' + String(i).padStart(14,'0'),
    active: i !== 4 && i !== 10,  // two inactives for realism
    // Credit limit tiers 50k-500k AED; balance ~30-70% of limit for variety.
    credit_limit: [150000, 250000, 100000, 400000, 80000, 200000, 350000, 120000, 180000, 90000, 500000, 220000, 160000, 280000][i],
    balance:      [ 48200, 167400,  31900, 215000, 12300,  62500, 198200,  41700,  74100, 28800, 312000,  87600,  54900,  93400][i],
  }));

  // ---- Suppliers - 8 records ----
  const SUPPLIER_NAMES = [
    'Demo Supplier Co', 'Acme Materials', 'Placeholder Supply', 'Sample Packaging LLC',
    'Sigma Ingredients', 'Beta Logistics', 'Demo Chemicals', 'Gamma Flexibles',
  ];
  const SUP_MAT_GROUPS = [
    ['RM-SUGAR','RM-WATER'],
    ['RM-FLAVOR','RM-PREFORM','RM-PREFORM-1L'],
    ['RM-CAP','RM-LABEL','RM-CARTON'],
    ['RM-LABEL','RM-LABEL-1L','RM-LABEL-250'],
    ['RM-SUGAR','RM-FLAVOR'],
    ['RM-PREFORM-250','RM-CARTON'],
    ['RM-CO2'],
    ['RM-CAP','RM-PREFORM'],
  ];
  const SUPPLIERS = SUPPLIER_NAMES.map((name, i) => ({
    _id: 's-' + (i+1),
    supplier_code: 'SUP-' + String(i+1).padStart(3,'0'),
    code: 'SUP-' + String(i+1).padStart(3,'0'),
    name,
    contact_person: ['Alex','Sam','Pat','Casey','Jordan','Riley','Morgan','Taylor'][i % 8] + ' Demo',
    email: name.toLowerCase().replace(/[^a-z0-9]+/g,'').slice(0,12) + '@demoplant.local',
    phone: '+000-' + String(200 + i).padStart(4,'0'),
    address: `Demo ${['Industrial','Trade','FZ','Logistics'][i%4]} Block ${i+1}`,
    payment_terms: ['Net 30','Net 60','Advance','Net 45'][i % 4],
    lead_time_days: [3, 5, 7, 10, 2, 14, 4, 6][i],
    materials: SUP_MAT_GROUPS[i],
    status: i === 2 ? 'inactive' : 'active',
    active: i !== 2,
    rating: ['A','A','B','A','C','B','A','B'][i],
    total_orders: 8 + i * 3,
    on_time_pct: 95 - (i * 3),
  }));

  // ---- Job orders - 16 records across all statuses ----
  const PRODUCTS = [
    { code: 'FG-500ML', name: 'Sample Beverage 500 mL', recipe: 'REC-A1' },
    { code: 'FG-1L',    name: 'Sample Beverage 1 L',    recipe: 'REC-B2' },
    { code: 'FG-250ML', name: 'Sample Beverage 250 mL', recipe: 'REC-C3' },
  ];
  const JO_STATUSES = ['draft','pending','processed','in_production','completed','draft','pending','processed','in_production','completed','draft','pending','processed','in_production','completed','closed'];
  const JOB_ORDERS = JO_STATUSES.map((status, i) => {
    const p = PRODUCTS[i % 3];
    const c = CUSTOMERS[i % CUSTOMERS.length];
    return {
      _id: 'jo-' + (i+1), id: 'jo-' + (i+1),
      jo_number: 'JO-DEMO-' + String(i+1).padStart(4,'0'),
      summary_ref: 'JO-DEMO-' + String(i+1).padStart(4,'0'),
      customer_id: c._id, customer_name: c.name, customer: c.name,
      product_code: p.code, product_name: p.name,
      qty: 40 + (i * 10), uom: 'case',
      status,
      line: ['Line A', 'Line B', 'Line C'][i % 3],
      recipe_code: p.recipe, recipe_name: p.recipe,
      planned_start: daysAgo(i % 10),
      // Cost of goods for this batch - qty × FG unit_cost (use 500ml as the proxy).
      total_cost: Math.round((40 + (i*10)) * 14.40), unit_cost: 14.40,
      source: i % 2 === 0 ? 'po_processing' : 'manual',
      po_number: 'PO-IN-' + String(1001 + i).padStart(4,'0'),
      order_type: c.market === 'EXPORT' ? 'export' : 'local',
      market: c.market,
      created_at: daysAgo(i % 10),
      demo_mode: true,
    };
  });

  // ---- Production batches - 12 records ----
  const PB_STATUSES = ['closed','in_progress','closed','planned','closed','closed','closed','in_progress','closed','planned','closed','closed'];
  const PRODUCTION_BATCHES = PB_STATUSES.map((status, i) => {
    const p = PRODUCTS[i % 3];
    const planned = 40 + i * 15;
    const produced = status === 'planned' ? 0 : (status === 'in_progress' ? Math.floor(planned * 0.55) : Math.floor(planned * 0.97));
    const rejected = produced > 0 ? Math.max(1, Math.floor(produced * 0.02)) : 0;
    return {
      _id: 'pb-' + (i+1), id: 'pb-' + (i+1),
      batch_no: 'DEMO-' + String(1001 + i).padStart(4,'0'),
      batch_number: 'DEMO-' + String(1001 + i).padStart(4,'0'),
      jo_number: 'JO-DEMO-' + String((i % JOB_ORDERS.length) + 1).padStart(4,'0'),
      recipe_name: p.recipe, recipe_code: p.recipe,
      product_code: p.code, product_name: p.name,
      planned_qty: planned, actual_produced: produced, qty_produced: produced, qty_rejected: rejected,
      yield_percent: planned > 0 ? Math.round((produced / planned) * 100) : 0,
      oee_pct: status === 'planned' ? 0 : (70 + (i*2) % 25),
      status,
      mfg_date: daysAgo(i),
      line: ['Line A', 'Line B', 'Line C'][i % 3],
      total_cost: produced, raw_material_cost: produced,
      sage_status: ['draft','','posted','','draft','posted','','posted','draft','','posted','draft'][i],
    };
  });

  // ---- Production control reports - 14 records (2 weeks); mix of pending/completed ----
  function genProductionReports() {
    const reports = [];
    // 4 pending (so post-push flow has rows to click), 8 completed, 2 partial
    const statuses = ['pending','pending','pending','pending','completed','completed','completed','completed','completed','completed','partial','partial','completed','completed'];
    for (let i = 0; i < 14; i++) {
      const dayBack = i;
      const status = statuses[i];
      const planned = 200 - i * 10;
      const actual = status === 'pending' ? 0 : (status === 'partial' ? Math.floor(planned * 0.6) : Math.floor(planned * 0.93));
      reports.push({
        _id: 'pcr-' + (1000 + i), id: 'pcr-' + (1000 + i),
        report_date: ymd(daysAgo(dayBack)),
        production_date: ymd(daysAgo(dayBack)),
        line: i % 2 === 0 ? 'Line A' : 'Line B',
        product_code: ['FG-500ML','FG-1L','FG-250ML'][i % 3],
        product_name: PRODUCTS[i % 3].name,
        recipe_name: ['REC-A1','REC-B2','REC-C3'][i % 3],
        batch_no: `DEMO-${(1000 + i).toString().padStart(4,'0')}`,
        production_batch_id: `DEMO-${(1000 + i).toString().padStart(4,'0')}`,
        packaging_type: i % 2 === 0 ? 'PET' : 'CAN',
        planned_qty: planned,
        actual_qty: actual,
        rejects: status === 'pending' ? 0 : (4 + i),
        oee_pct: status === 'pending' ? 0 : (80 - i * 2),
        status,
        downtime_minutes: status === 'pending' ? 0 : (12 + i * 3),
        downtime_entries: status === 'pending' ? [] : [
          { reason: 'Mechanical', minutes: 6 + i, notes: 'Demo conveyor jam' },
          { reason: 'Material',   minutes: 5,     notes: 'RM hold' },
        ],
        operator: 'demo.user',
        supervisor: 'demo.admin',
        notes: status === 'pending' ? '' : 'Demo report - placeholder values only.',
        raw_material_cost: actual,
        created_at: daysAgo(dayBack),
      });
    }
    return reports;
  }
  const PRODUCTION_REPORTS = genProductionReports();
  // In-memory store for reports created during the demo session (e.g. push-to-production)
  const DYNAMIC_REPORTS = [];

  // ---- Quotations - 12 records ----
  const QT_STATUSES = ['draft','sent','sent','accepted','accepted','expired','sent','accepted','draft','sent','rejected','accepted'];
  const QUOTATIONS = QT_STATUSES.map((status, i) => {
    const c = CUSTOMERS[i % CUSTOMERS.length];
    // Subtotal scaled by items_count (1-4) × 4500-12000 AED per line.
    const items = 1 + (i % 4);
    const subtotal = items * (4500 + ((i * 1700) % 7500));
    const vat = Math.round(subtotal * 0.05);
    const total = subtotal + vat;
    return {
      _id: 'q-' + (i+1),
      quotation_number: 'QT-2026-' + String(i+1).padStart(4,'0'),
      quote_number: 'QT-2026-' + String(i+1).padStart(4,'0'),
      number: 'QT-2026-' + String(i+1).padStart(4,'0'),
      date: daysAgo(i),
      customer_id: c._id, customer_name: c.name, customer: c.name,
      items_count: items,
      subtotal, vat_amount: vat, line_total: total, total, grand_total: total,
      status,
      valid_until: daysAgo(-30 + i),
      notes: 'Demo quotation #' + (i+1),
    };
  });
  // ---- Proforma invoices - 10 records ----
  const PI_STATUSES = ['issued','paid','issued','overdue','paid','issued','paid','issued','draft','paid'];
  const PROFORMA_INVOICES = PI_STATUSES.map((status, i) => {
    const c = CUSTOMERS[i % CUSTOMERS.length];
    const subtotal = 8500 + ((i * 2300) % 22000);
    const vat = Math.round(subtotal * 0.05);
    const total = subtotal + vat;
    return {
      _id: 'p-' + (i+1),
      pi_number: 'PI-2026-' + String(i+1).padStart(4,'0'),
      number: 'PI-2026-' + String(i+1).padStart(4,'0'),
      date: daysAgo(i),
      customer_id: c._id, customer_name: c.name, customer: c.name,
      subtotal, vat_amount: vat, total, grand_total: total,
      status,
      jo_ref: 'JO-DEMO-' + String(i+1).padStart(4,'0'),
    };
  });

  // ---- Sage entries / drafts - 10 drafts + 10 posted ----
  const SAGE_MODULES = ['JL','AP','AR','JL','AP','JL','AR','JL','AR','AP'];
  const SAGE_ENTRY_TYPES = ['Production batch close','Supplier payment','Customer invoice','Production batch close','Supplier payment','Production batch close','Customer receipt','Production batch close','Customer invoice','Supplier payment'];
  const SAGE_DRAFT_STATUSES = ['draft','draft','approved','posted','draft','approved','draft','posted','draft','approved'];
  const SAGE_DRAFTS = SAGE_DRAFT_STATUSES.map((status, i) => {
    // Balanced debit/credit pairs spanning 28k-185k AED for varied batches.
    const total = 28000 + ((i * 19700) % 158000);
    return {
      sage_batch_id: 'SGE-2026-05-' + String(13-i).padStart(2,'0') + '-' + ((i%3)+1),
      _id: 'sg-' + (i+1),
      batch_id: 'SGE-2026-05-' + String(13-i).padStart(2,'0') + '-' + ((i%3)+1),
      period: ymd(daysAgo(i)),
      module: SAGE_MODULES[i],
      entry_type: SAGE_ENTRY_TYPES[i],
      source_doc: i % 2 === 0 ? `DEMO-${1001+i}` : `BPV-${String(i+1).padStart(4,'0')}`,
      debit_total: total, credit_total: total,
      status,
      entries_count: 2 + ((i*2) % 4),
      created_at: daysAgo(i),
      created_by: 'demo.admin',
    };
  });
  const SAGE_POSTED = Array.from({length:10}, (_, i) => {
    const total = 32000 + ((i * 21300) % 142000);
    return {
      sage_batch_id: 'SGE-2026-05-' + String(3-i+i*0).padStart(2,'0') + '-OLD-' + (i+1),
      _id: 'sgp-' + (i+1),
      period: ymd(daysAgo(3 + i)),
      module: SAGE_MODULES[i],
      entry_type: SAGE_ENTRY_TYPES[i],
      source_doc: 'DEMO-' + String(900 + i).padStart(4,'0'),
      debit_total: total, credit_total: total,
      status: 'posted',
      posted_at: daysAgo(3 + i),
    };
  });

  function sageDraftDetail(batchId) {
    const header = SAGE_DRAFTS.find(d => d.sage_batch_id === batchId || d.batch_id === batchId || d._id === batchId) || SAGE_DRAFTS[0];
    // Split the batch debit/credit total across two debit lines and two credit lines.
    const total = header.debit_total || 50000;
    const a = Math.round(total * 0.62);
    const b = total - a;
    return {
      ...header,
      lines: [
        { line: 1, account: '5000', account_name: 'Demo COGS',           description: header.entry_type, debit: a, credit: 0 },
        { line: 2, account: '1300', account_name: 'Demo Inventory',      description: header.entry_type, debit: 0, credit: a },
        { line: 3, account: '2100', account_name: 'Demo AP - Supplier',  description: header.entry_type, debit: b, credit: 0 },
        { line: 4, account: '1010', account_name: 'Demo Bank Account',   description: header.entry_type, debit: 0, credit: b },
      ],
    };
  }

  // ---- Accounting - drafts (12) / cashbook (15) / AR (10) / AP (8) ----
  const AD_MODULES = ['CB','AR','AP','CB','AR','AP','CB','AR','AP','CB','AR','AP'];
  const AD_STATUSES = ['pending','pending','approved','posted','pending','approved','pending','posted','pending','approved','posted','pending'];
  const ACCOUNTING_DRAFTS = AD_MODULES.map((mod, i) => {
    // Varied amounts 6500-78000 AED depending on row.
    const amt = 6500 + ((i * 8400) % 71500);
    return {
      _id: 'ad-' + (i+1),
      draft_number: `${mod}-2026-${String(i+1).padStart(4,'0')}`,
      module: mod,
      date: daysAgo(i),
      description: mod === 'CB' ? 'Demo bank/cash entry' : (mod === 'AR' ? 'Customer receipt' : 'Vendor payment'),
      payee: mod === 'AR' ? CUSTOMERS[i % CUSTOMERS.length].name : SUPPLIERS[i % SUPPLIERS.length].name,
      bank_account: i % 4 === 3 ? 'CASH-1' : 'BANK-DEMO',
      tr_code: mod === 'AR' ? 'TR-02' : (mod === 'AP' ? 'TR-01' : 'TR-03'),
      amount: amt, debit: mod === 'AR' ? 0 : amt, credit: mod === 'AR' ? amt : 0,
      status: AD_STATUSES[i],
      files: [],
      project: i % 2 === 0 ? 'PRJ-DEMO' : 'PRJ-EXP',
    };
  });
  // Running balance for the cashbook so the trail looks coherent.
  let _cb_balance = 245000;
  const ACCOUNTING_CASHBOOK = Array.from({length:15}, (_, i) => {
    const amt = 1200 + ((i * 6700) % 42000);
    const isDebit = i % 2 === 0;
    _cb_balance += isDebit ? amt : -amt;
    return {
      _id: 'cb-' + (i+1),
      date: daysAgo(i),
      description: ['Opening balance','Customer receipt','Supplier payment','Bank transfer','Petty cash expense','Customer receipt','Bank charges','Supplier payment','Refund','Customer receipt','Bank deposit','Supplier payment','Customer receipt','Bank transfer','Adjustment'][i],
      debit: isDebit ? amt : 0,
      credit: isDebit ? 0 : amt,
      balance: _cb_balance,
      ref: ['OB-001','AR-2026-0001','AP-2026-0001','BT-001','PC-001','AR-2026-0002','BC-001','AP-2026-0002','RF-001','AR-2026-0003','BD-001','AP-2026-0003','AR-2026-0004','BT-002','ADJ-001'][i],
    };
  });
  const ACCOUNTING_AR = Array.from({length:10}, (_, i) => {
    const dueDays = -30 + i * 7;
    const status = dueDays < 0 ? (i % 3 === 0 ? 'paid' : 'overdue') : 'open';
    const amt = 12500 + ((i * 9700) % 84000);
    return {
      _id: 'ar-' + (i+1),
      customer: CUSTOMERS[i % CUSTOMERS.length].name,
      customer_id: CUSTOMERS[i % CUSTOMERS.length]._id,
      invoice_number: 'PI-2026-' + String(i+1).padStart(4,'0'),
      date: daysAgo(30 - dueDays),
      due_date: daysAgo(-dueDays),
      amount: amt, balance: status === 'paid' ? 0 : amt,
      status,
      aging_bucket: status === 'paid' ? null : (dueDays < -60 ? '90+' : (dueDays < -30 ? '61-90' : (dueDays < 0 ? '31-60' : '0-30'))),
    };
  });
  const ACCOUNTING_AP = Array.from({length:8}, (_, i) => {
    const dueDays = -20 + i * 7;
    const status = dueDays < 0 ? (i % 3 === 0 ? 'paid' : 'overdue') : 'open';
    const amt = 8400 + ((i * 7200) % 56000);
    return {
      _id: 'ap-' + (i+1),
      vendor: SUPPLIERS[i % SUPPLIERS.length].name,
      vendor_id: SUPPLIERS[i % SUPPLIERS.length]._id,
      invoice_number: 'INV-SUP-' + String(i+1).padStart(4,'0'),
      date: daysAgo(20 - dueDays),
      due_date: daysAgo(-dueDays),
      amount: amt, balance: status === 'paid' ? 0 : amt,
      status,
      aging_bucket: status === 'paid' ? null : (dueDays < -60 ? '90+' : (dueDays < -30 ? '61-90' : (dueDays < 0 ? '31-60' : '0-30'))),
    };
  });

  // ---- Dispatch - richer ----
  const DISPATCH_PENDING = Array.from({length:6}, (_, i) => ({
    _id: 'dp-' + (i+1),
    reservation_id: 'res-' + (i+1),
    jo_number: 'JO-DEMO-' + String(i+1).padStart(4,'0'),
    product_code: PRODUCTS[i % 3].code,
    product: PRODUCTS[i % 3].name,
    cases: 20 + i * 10,
    customer: CUSTOMERS[i % CUSTOMERS.length].name,
    customer_id: CUSTOMERS[i % CUSTOMERS.length]._id,
    destination: `${CUSTOMERS[i % CUSTOMERS.length].name} · ${['Dubai','Sharjah','Ajman','Abu Dhabi','Fujairah'][i%5]}`,
    priority: ['high','normal','normal','low','high','normal'][i],
  }));
  const DISPATCH_ACTIVE = Array.from({length:4}, (_, i) => ({
    _id: 'da-' + (i+1),
    da_number: 'DA-2026-' + String(i+1).padStart(4,'0'),
    date: todayISO,
    vehicle: 'DEMO-T' + (i+1),
    driver: 'Driver ' + ['One','Two','Three','Four'][i],
    customer: CUSTOMERS[i % CUSTOMERS.length].name,
    cases: 25 + i * 15,
    status: ['loading','in_transit','at_customer','in_transit'][i],
  }));
  const DISPATCH_HISTORY = Array.from({length:14}, (_, i) => ({
    _id: 'dh-' + (i+1),
    da_number: 'DA-2026-' + String(9990 - i).padStart(4,'0'),
    date: daysAgo(i+1),
    vehicle: 'DEMO-T' + ((i%4) + 1),
    driver: 'Driver ' + ['One','Two','Three','Four'][i % 4],
    customer: CUSTOMERS[i % CUSTOMERS.length].name,
    cases: 30 + (i*8) % 120,
    status: 'delivered',
    delivered_at: daysAgo(i+1),
  }));

  // ---- QC batches - 12 records ----
  const QC_VERDICTS = ['PASS','REVIEW','PASS','HOLD','PASS','PASS','PASS','REVIEW','PASS','PASS','REVIEW','PASS'];
  const QC_STATUSES = ['approved','pending','approved','rejected','approved','approved','approved','pending','approved','approved','pending','approved'];
  const QC_BATCHES = QC_VERDICTS.map((verdict, i) => ({
    _id: 'qc-' + (i+1),
    batch_no: 'DEMO-' + String(1001 + i).padStart(4,'0'),
    batch: 'DEMO-' + String(1001 + i).padStart(4,'0'),
    product: PRODUCTS[i % 3].name,
    product_code: PRODUCTS[i % 3].code,
    recipe: PRODUCTS[i % 3].recipe,
    date: daysAgo(i),
    verdict,
    approver: i % 2 === 0 ? 'demo.qc' : 'demo.admin',
    status: QC_STATUSES[i],
    sample_size: 24 + ((i * 6) % 36),  // 24-60 bottles drawn per batch
    notes: verdict === 'HOLD' ? 'Demo - held for retest' : '',
  }));

  // ---- Forecast (6 SKUs with realistic spread; 4 in shortfall) ----
  const FORECAST = [
    { sku: 'FG-500ML', product_code: 'FG-500ML', product_name: 'Sample Beverage 500 mL', recipe_name: 'REC-A1', last_month: 800, forecast: 1000, bookings: 920, stock_on_hand: 220, coverage_pct: 22, shortfall: 700, qty: 0 },
    { sku: 'FG-1L',    product_code: 'FG-1L',    product_name: 'Sample Beverage 1 L',    recipe_name: 'REC-B2', last_month: 320, forecast: 400,  bookings: 380, stock_on_hand: 95,  coverage_pct: 24, shortfall: 285, qty: 0 },
    { sku: 'FG-250ML', product_code: 'FG-250ML', product_name: 'Sample Beverage 250 mL', recipe_name: 'REC-C3', last_month: 600, forecast: 650,  bookings: 600, stock_on_hand: 140, coverage_pct: 22, shortfall: 460, qty: 0 },
    { sku: 'FG-330ML', product_code: 'FG-330ML', product_name: 'Sample Beverage 330 mL Can', recipe_name: 'REC-A1', last_month: 220, forecast: 250, bookings: 180, stock_on_hand: 280, coverage_pct: 112, shortfall: 0, qty: 0 },
    { sku: 'FG-PET',   product_code: 'FG-PET',   product_name: 'Sample Beverage 2 L PET',    recipe_name: 'REC-B2', last_month: 90,  forecast: 110, bookings: 100, stock_on_hand: 30,  coverage_pct: 27, shortfall: 80,  qty: 0 },
    { sku: 'FG-MULTI', product_code: 'FG-MULTI', product_name: 'Sample Beverage Multipack', recipe_name: 'REC-C3', last_month: 60,  forecast: 80,  bookings: 70,  stock_on_hand: 90,  coverage_pct: 112, shortfall: 0, qty: 0 },
  ];

  // ---- Customs / FTA - 12 declarations across types and months ----
  const CD_TYPES = ['EX','IM','TS','EXPORT','EX','IM','TS','EXPORT','EX','IM','TS','EXPORT'];
  const CD_STATUSES = ['draft','submitted','accepted','draft','accepted','accepted','accepted','submitted','draft','accepted','accepted','draft'];
  const CUSTOMS_DECLARATIONS = CD_TYPES.map((type, i) => {
    const monthsBack = Math.floor(i / 4);
    const month = 5 - monthsBack;
    // Customs values 35k-220k AED, 5% duty applies on import-type rows only.
    const customVal = 35000 + ((i * 18400) % 185000);
    const duty = type === 'EXPORT' ? 0 : Math.round(customVal * 0.05);
    const totalVal = customVal + duty;
    return {
      _id: 'cd-' + (i+1),
      declaration_number: `${type}-2026-${String(month).padStart(2,'0')}-${(i%4)+1}`,
      declaration_type: type,
      month, year: 2026,
      period: `2026-${String(month).padStart(2,'0')}`,
      status: CD_STATUSES[i],
      items_count: 1 + (i % 5),
      total_value: totalVal, duty_5_percent: duty, custom_value: customVal,
      files: [],
      created_at: daysAgo(monthsBack * 30 + i),
    };
  });
  const FTA_TRANSFERS = Array.from({length:10}, (_, i) => {
    // Transfers of 40-220 cases, valued at the FG ave_unit_cost.
    const fg = INVENTORY.find(x => x.item_code === PRODUCTS[i % 3].code) || INVENTORY[12];
    const qty = 40 + ((i * 27) % 180);
    return {
      date: ymd(daysAgo(i)),
      product: PRODUCTS[i % 3].name,
      product_code: PRODUCTS[i % 3].code,
      from_wh: ['WH-MAIN','WH-MAIN','WH-PROD','WH-MAIN','WH-MAIN'][i % 5],
      to_wh: ['WH-EXPORT','WH-DISPATCH','WH-MAIN','WH-EXPORT','WH-DISPATCH'][i % 5],
      qty, value: Math.round(qty * (fg.unit_cost || 14.40)),
      hs_code: '2202.10',
      document_no: 'TS-' + String(1000+i),
    };
  });

  // ---- Sugar Dissolver - richer ----
  const SUGAR_PENDING = Array.from({length:5}, (_, i) => {
    // Sugar dissolution batches: 320-680 kg planned, only the in-progress one has partial.
    const planned = 320 + i * 90;
    return {
      _id: 'sd-' + (i+1),
      batch_no: 'DEMO-' + String(1001 + i).padStart(4,'0'),
      recipe_name: PRODUCTS[i % 3].recipe,
      planned_qty: planned,
      dissolved_qty: i === 0 ? Math.round(planned * 0.42) : 0,
      status: i === 0 ? 'in_progress' : 'pending',
      date: daysAgo(i),
      operator: 'demo.user',
    };
  });
  const SUGAR_ISSUANCES = Array.from({length:12}, (_, i) => ({
    _id: 'sdi-' + (i+1),
    issuance_number: 'SDI-2026-' + String(i+1).padStart(4,'0'),
    batch_no: 'DEMO-' + String(900 + i).padStart(4,'0'),
    recipe_name: PRODUCTS[i % 3].recipe,
    qty: 280 + ((i * 47) % 420),
    uom: 'kg',
    date: daysAgo(i + 2),
    operator: 'demo.user',
    status: 'issued',
  }));

  // ---- Mixing tanks ----
  const TANK_KEYS = ['Tank-1', 'Tank-2', 'Tank-3', 'Tank-4'];
  function tankCipHistory(tankKey) {
    return [
      { _id: oid('cip-'), entry_id: oid('e-'), tank: tankKey, started_at: daysAgo(1), ended_at: daysAgo(1), operator: 'demo.user', steps: [
        { step: 'Pre-rinse',     duration_min: 5, temperature_c: 25, ok: true },
        { step: 'Caustic',       duration_min: 15, temperature_c: 80, ok: true },
        { step: 'Inter-rinse',   duration_min: 5, temperature_c: 30, ok: true },
        { step: 'Acid',          duration_min: 10, temperature_c: 60, ok: true },
        { step: 'Final rinse',   duration_min: 5, temperature_c: 25, ok: true },
      ], status: 'completed', result: 'pass' },
      { _id: oid('cip-'), entry_id: oid('e-'), tank: tankKey, started_at: daysAgo(3), ended_at: daysAgo(3), operator: 'demo.user', status: 'completed', result: 'pass' },
    ];
  }
  function rmInspection(batchNo) {
    return {
      batch_no: batchNo, recipe_name: 'REC-A1', date: todayISO, inspector: 'demo.qc',
      items: [
        { rm_code: 'RM-WATER',  description: 'Demo Water',   qty: 1800, uom: 'L',  ok: true, notes: '' },
        { rm_code: 'RM-SUGAR',  description: 'Demo Sugar',   qty: 420,  uom: 'kg', ok: true, notes: '' },
        { rm_code: 'RM-FLAVOR', description: 'Demo Flavor X',qty: 35,   uom: 'L',  ok: true, notes: '' },
      ],
      verdict: 'PASS',
    };
  }
  function mixingOpsHistory(apiType) {
    return [
      { _id: oid('mo-'), entry_id: oid('e-'), op_type: apiType, date: todayISO,   operator: 'demo.user', batch_no: 'DEMO-0001', notes: 'Demo ' + apiType + ' record', completed: true },
      { _id: oid('mo-'), entry_id: oid('e-'), op_type: apiType, date: daysAgo(1), operator: 'demo.user', batch_no: 'DEMO-0002', notes: 'Demo ' + apiType + ' record', completed: true },
    ];
  }
  function mixingUtilities(docType) {
    return [
      { _id: oid('mu-'), entry_id: oid('e-'), doc_type: docType, date: todayISO,   created_by: 'demo.user', notes: 'Demo ' + docType + ' entry', status: 'submitted' },
      { _id: oid('mu-'), entry_id: oid('e-'), doc_type: docType, date: daysAgo(2), created_by: 'demo.user', notes: 'Demo ' + docType + ' entry', status: 'submitted' },
    ];
  }

  // ---- RM Orders - 10 records across full lifecycle ----
  const RMO_STATUSES = ['draft','draft','lpo','lpo','partially_received','partially_received','received','received','received','draft'];
  const RM_ORDERS = RMO_STATUSES.map((status, i) => {
    const itemsCount = 1 + (i % 4);
    const totalQty = 1500 + ((i * 1850) % 9500);
    // ~3.50 AED weighted-average across mixed RM lines.
    const totalValue = Math.round(totalQty * 3.50);
    return {
      _id: 'rmo-' + (i+1),
      order_number: 'RMO-2026-' + String(i+1).padStart(4,'0'),
      date: daysAgo(i),
      supplier: SUPPLIERS[i % SUPPLIERS.length].name,
      supplier_id: SUPPLIERS[i % SUPPLIERS.length]._id,
      items_count: itemsCount,
      total_qty: totalQty,
      total_value: totalValue,
      status,
      created_by: 'demo.admin',
      expected_delivery: daysAgo(-(SUPPLIERS[i % SUPPLIERS.length].lead_time_days)),
    };
  });
  const RM_CRITICAL = INVENTORY.filter(i => i.short).map(i => {
    const suggested = i.reorder_point * 2 - i.on_hand;
    return {
      item_code: i.item_code, description: i.description, on_hand: i.on_hand, reorder_point: i.reorder_point,
      suggested_qty: suggested, supplier: 'Demo Supplier Co', lead_time_days: 3, uom: i.uom,
      unit_cost: i.unit_cost,
      total_cost: Math.round(suggested * i.unit_cost * 100) / 100,
      severity: 'high',
    };
  });

  // ---- Allocations / Job-orders flow ----
  const ALLOCATIONS_PENDING = [
    { _id: 'aloc-1', jo_number: 'JO-DEMO-0001', child_id: 'jo-1', allocation_priority: 'high',   stock_qty: 60, to_produce_qty: 140, market: 'UAE',    active: true,  parent_id: 'parent-1' },
    { _id: 'aloc-2', jo_number: 'JO-DEMO-0004', child_id: 'jo-4', allocation_priority: 'normal', stock_qty: 30, to_produce_qty: 30,  market: 'UAE',    active: true,  parent_id: 'parent-2' },
    { _id: 'aloc-3', jo_number: 'JO-DEMO-0005', child_id: 'jo-5', allocation_priority: 'low',    stock_qty: 0,  to_produce_qty: 40,  market: 'EXPORT', active: false, parent_id: 'parent-3' },
  ];

  // ---- Stock reservations ----
  const STOCK_RESERVATIONS = [
    { _id: 'sr-1', jo_number: 'JO-DEMO-0001', product_code: 'FG-500ML', qty: 60, status: 'active', created_at: todayISO },
    { _id: 'sr-2', jo_number: 'JO-DEMO-0002', product_code: 'FG-1L',    qty: 25, status: 'active', created_at: todayISO },
    { _id: 'sr-3', jo_number: 'JO-DEMO-0003', product_code: 'FG-250ML', qty: 120,status: 'consumed', created_at: daysAgo(2) },
  ];
  const STOCK_RES_TOTALS = INVENTORY.filter(i=>i.category==='FG').reduce((m,i)=>{ m[i.item_code]= i.reserved; return m; }, {});

  // ---- Price list ----
  // Selling prices use a 1.55x cost-plus markup; unit_price tracks selling_price.
  const PRICE_LIST = INVENTORY.filter(i => i.category === 'FG').map(i => {
    const sell = Math.round(i.unit_cost * 1.55 * 100) / 100;
    return {
      item_code: i.item_code, description: i.description, uom: i.uom,
      unit_price: sell, selling_price: sell, cost_price: i.unit_cost,
      gtin: '1234567890123',
      last_updated: todayISO,
    };
  });

  // ---- Recipe item map ----
  const RECIPE_ITEM_MAP = {
    'FG-500ML': 'REC-A1', 'FG-1L': 'REC-B2', 'FG-250ML': 'REC-C3',
  };

  // ---- GL Sales (analytics input) ----
  function genGLSales(type) {
    return Array.from({length:10}, (_,i) => {
      const code = ['FG-500ML','FG-1L','FG-250ML'][i % 3];
      const fg = INVENTORY.find(x => x.item_code === code) || INVENTORY[12];
      const sell = fg.unit_cost * 1.55;
      const qty = 80 + ((i * 37) % 320);
      const value = Math.round(qty * sell);
      return {
        date: ymd(daysAgo(i)),
        product: code,
        qty, transaction_value: value,
        total_qty_in_value: type === 'in' ? value : 0,
        total_qty_out_value: type === 'out' ? value : 0,
      };
    });
  }

  // ---- Reception ----
  const RECEPTION_VISITORS = Array.from({length:8}, (_, i) => ({
    _id: 'rv-' + (i+1),
    date: daysAgo(i),
    name: 'Demo Visitor ' + (i+1),
    company: CUSTOMERS[i % CUSTOMERS.length].name,
    purpose: ['Meeting','Inspection','Delivery','Audit','Demo','Interview','Maintenance','Vendor visit'][i],
    badge_no: 'B-' + String(i+1).padStart(3,'0'),
    signed_in: daysAgo(i),
    signed_out: i % 2 === 0 ? daysAgo(i) : '',
    photo_front_id: 'demo-photo-' + (i+1),
    photo_back_id: 'demo-photo-' + (i+1) + 'b',
  }));
  const RECEPTION_COURIERS = Array.from({length:6}, (_, i) => ({
    _id: 'rc-' + (i+1),
    date: daysAgo(i),
    courier: ['Demo Express','Sample Logistics','Placeholder Courier'][i % 3],
    tracking_no: '1Z000DEMO' + (i+1),
    sender: SUPPLIERS[i % SUPPLIERS.length].name,
    recipient: ['Demo Admin','demo.qc','demo.user','demo.accountant'][i % 4],
    signed_by: 'demo.user',
    notes: ['Sample parts','QC reagents','Documents','Spare parts','Inventory items','Office supplies'][i],
  }));

  // ---- Analytics ----
  function analyticsSummary(days) {
    return {
      days: Number(days || 7),
      total_production: 540 + Number(days || 7) * 10,
      total_dispatched: 380 + Number(days || 7) * 5,
      total_received:   620,
      oee_avg: 76,
      categories: [
        { category: 'FG-500ML', qty: 320, value: 1 },
        { category: 'FG-1L',    qty: 95,  value: 1 },
        { category: 'FG-250ML', qty: 140, value: 1 },
      ],
      trend: Array.from({length:Number(days || 7)},(_,i)=>({
        date: ymd(daysAgo(i)),
        production: 60 + (i*7)%40,
        dispatch:   45 + (i*5)%35,
      })).reverse(),
    };
  }

  // ---- Sage agent ----
  const SAGE_AGENT_HEALTH = {
    status: 'disconnected', healthy: false, ok: false,
    message: 'Demo mode - Sage agent not configured for this disconnected demo.',
    demo_mode: true, last_seen: null,
  };

  // ---- Company settings (for invoice templates etc.) ----
  const COMPANY_SETTINGS = {
    company_name: 'Demo Plant LLC', address: 'Plot 1, Demo Industrial Area, Dubai, UAE',
    trn: '100000000000003', phone: '+000-DEMO', email: 'info@demoplant.local',
    bank_name: 'Bank Demo', bank_account: 'AE000000000000000000001', swift: 'DEMOEDUM',
  };

  // ---- Document links ----
  const DOCUMENT_LINKS = [
    { _id: 'dl-1', parent_id: 'jo-1', parent_type: 'summary_sheet', child_id: 'jo-1', child_type: 'job_order', child_label: 'JO-DEMO-0001 · Sample Beverage 500 mL' },
    { _id: 'dl-2', parent_id: 'jo-2', parent_type: 'summary_sheet', child_id: 'jo-2', child_type: 'job_order', child_label: 'JO-DEMO-0002 · Sample Beverage 1 L' },
  ];

  // ---- Item lookup table ----
  const ITEM_LOOKUP = INVENTORY.reduce((m, i) => { m[i.item_code] = { ...i }; return m; }, {});

  // ---- Sage entries items ----
  const SAGE_ENTRY_ITEMS = INVENTORY.map(i => ({
    code: i.item_code, description: i.description, uom: i.uom,
    ave_unit_cost: i.ave_unit_cost, unit_cost: i.unit_cost,
  }));

  /* =========================================================
     2. Tiny placeholder PDF (returned for /pdf endpoints)
     ========================================================= */
  const PLACEHOLDER_PDF_BASE64 =
    'JVBERi0xLjQKJcOkw7zDtsOfCjEgMCBvYmoKPDwKL1R5cGUgL0NhdGFsb2cKL1BhZ2VzIDIg' +
    'MCBSCj4+CmVuZG9iagoyIDAgb2JqCjw8Ci9UeXBlIC9QYWdlcwovS2lkcyBbMyAwIFJdCi9D' +
    'b3VudCAxCj4+CmVuZG9iagozIDAgb2JqCjw8Ci9UeXBlIC9QYWdlCi9QYXJlbnQgMiAwIFIK' +
    'L01lZGlhQm94IFswIDAgNTk1IDg0Ml0KL0NvbnRlbnRzIDQgMCBSCi9SZXNvdXJjZXMgPDwK' +
    'L0ZvbnQgPDwKL0YxIDUgMCBSCj4+Cj4+Cj4+CmVuZG9iago0IDAgb2JqCjw8Ci9MZW5ndGgg' +
    'MTQwCj4+CnN0cmVhbQpCVAovRjEgMjQgVGYKMTAwIDcwMCBUZAooREVNTyBNT0RFKSBUagow' +
    'IC0zMCBUZAovRjEgMTYgVGYKKHBsYWNlaG9sZGVyIGRvY3VtZW50KSBUago wIC00MCBUZAov' +
    'RjEgMTAgVGYKKHRoZSByZWFsIHN5c3RlbSBnZW5lcmF0ZXMgYSByaWNoIFBERikgVGoKRVQK' +
    'ZW5kc3RyZWFtCmVuZG9iago1IDAgb2JqCjw8Ci9UeXBlIC9Gb250Ci9TdWJ0eXBlIC9UeXBl' +
    'MQovQmFzZUZvbnQgL0hlbHZldGljYQo+PgplbmRvYmoKeHJlZgowIDYKMDAwMDAwMDAwMCA2' +
    'NTUzNSBmCjAwMDAwMDAwMDkgMDAwMDAgbgowMDAwMDAwMDU4IDAwMDAwIG4KMDAwMDAwMDEx' +
    'NSAwMDAwMCBuCjAwMDAwMDAyMjcgMDAwMDAgbgowMDAwMDAwNDE2IDAwMDAwIG4KdHJhaWxl' +
    'cgo8PAovU2l6ZSA2Ci9Sb290IDEgMCBSCj4+CnN0YXJ0eHJlZgo0OTMKJSVFT0YK';

  function placeholderPdfBlob() {
    const bin = atob(PLACEHOLDER_PDF_BASE64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: 'application/pdf' });
  }

  /* =========================================================
     3. Routing
     ========================================================= */
  function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  }
  function blobResponse(blob, status = 200) {
    return new Response(blob, { status, headers: { 'Content-Type': blob.type } });
  }
  function isPdfPath(p) {
    return /\/pdf(\b|$)|\.pdf(\?|$)|\/excel|voucher-pdf|\/picking-sheet|\/stock-requisition-pdf/i.test(p);
  }

  function pathOf(url) {
    try { return new URL(url, window.location.href).pathname; } catch (_) { return url.split('?')[0]; }
  }
  function queryOf(url) {
    try { return Object.fromEntries(new URL(url, window.location.href).searchParams.entries()); } catch (_) { return {}; }
  }

  function route(url, method, payload) {
    const path = pathOf(url).replace(/^\/api/, '');
    const query = queryOf(url);

    // -------- AUTH --------
    if (path === '/auth/login')   return jsonResponse({ access_token: ADMIN_TOKEN, token_type: 'bearer', user: ADMIN_USER });
    if (path === '/auth/me' || path === '/auth/current' || path === '/auth/profile') return jsonResponse(ADMIN_USER);
    if (path === '/auth/logout')  return jsonResponse({ success: true });
    if (path === '/auth/users') {
      if (method === 'GET') return jsonResponse([
        ADMIN_USER,
        { _id: 'u-2', username: 'demo.supervisor', role: 'supervisor', email: 'sup@demoplant.local', full_name: 'Demo Supervisor', is_active: true, allowed_menus: null },
        { _id: 'u-3', username: 'demo.qc',         role: 'quality_control', email: 'qc@demoplant.local', full_name: 'Demo QC',     is_active: true, allowed_menus: null },
        { _id: 'u-4', username: 'demo.accountant', role: 'accountant',  email: 'acc@demoplant.local',full_name: 'Demo Accountant', is_active: true, allowed_menus: null },
        { _id: 'u-5', username: 'demo.operator',   role: 'mixing_area', email: 'op@demoplant.local', full_name: 'Demo Operator',   is_active: true, allowed_menus: null },
      ]);
    }
    if (path.startsWith('/auth/users/')) {
      if (path.endsWith('/reset-password')) return jsonResponse({ success: true, temporary_password: 'demo-1234' });
      return jsonResponse({ success: true });
    }

    // -------- DASHBOARD --------
    if (path === '/dashboard/stats') {
      return jsonResponse({
        active_jos: JOB_ORDERS.filter(j => ['in_production','processed','pending'].includes(j.status)).length,
        oee_pct: 78, units_this_shift: 200,
        qc_pending: QC_BATCHES.filter(b => b.status === 'pending').length,
        open_pos_value: 1, downtime_min: 12,
        production_trend: [40,55,42,70,48,62,80],
        recent_activity: [
          { time: todayISO,   tag: 'PROD', message: 'Batch DEMO-0001 closed on Line A' },
          { time: todayISO,   tag: 'QC',   message: 'Sample passed for DEMO-0001' },
          { time: daysAgo(0.01), tag: 'INV', message: 'RM-SUGAR received · qty 1' },
        ],
      });
    }

    // -------- ANALYTICS --------
    if (path === '/analytics/summary') return jsonResponse(analyticsSummary(query.days));

    // -------- RECIPES --------
    if (path === '/recipes' || path === '/recipes/') {
      if (method === 'GET') return jsonResponse({ recipes: RECIPES });
      return jsonResponse({ success: true, _id: oid('rec-'), demo_mode: true });
    }
    if (path.startsWith('/recipes/')) {
      const name = decodeURIComponent(path.split('/')[2]);
      const r = RECIPES.find(x => x.recipe_name === name || x.code === name || x._id === name);
      return jsonResponse(r || RECIPES[0]);
    }
    if (path === '/recipe-item-map') return jsonResponse(RECIPE_ITEM_MAP);
    if (path === '/picking-sheet')        return blobResponse(placeholderPdfBlob());
    if (path === '/picking-sheet-excel')  return blobResponse(placeholderPdfBlob());
    if (path === '/validate-custom') return jsonResponse({ valid: true, warnings: [], cost: 1 });
    if (path.startsWith('/item-lookup/')) {
      const code = decodeURIComponent(path.split('/')[2]);
      return jsonResponse(ITEM_LOOKUP[code] || { item_code: code, description: 'Demo item', uom: 'pcs', ave_unit_cost: 1 });
    }

    // -------- CALCULATOR --------
    if (path === '/calculate' && method === 'POST') {
      const body = payload || {};
      const recipe = RECIPES.find(r =>
        r._id === body.recipe_id || r.code === body.recipe_code ||
        r.recipe_name === body.recipe_name || r.name === body.recipe_name
      ) || RECIPES[0];
      // Calculator may send target_qty + unit. Convert to a scale factor against the recipe base.
      const target = Number(body.target_qty || body.batch_size_l || body.scale || body.qty || 1);
      const unit = (body.unit || 'cases').toLowerCase();
      const baseQty = recipe.base_qty || 1;
      // Treat the target as a multiplier - keep math simple, garbage-data appropriate.
      const scale = target / baseQty;
      const items = recipe.ingredients.map(ing => {
        const required = +(ing.qty * scale).toFixed(4);
        const stock = (INVENTORY.find(i => i.item_code === ing.rm_code) || {}).on_hand || 0;
        const remaining = +(stock - required).toFixed(4);
        return {
          // Calculator UI keys on item_code + description, with unit_cost / sage_qty / to_order / remaining.
          item_code: ing.rm_code,
          rm_code: ing.rm_code,
          description: ing.description,
          uom: ing.uom,
          unit_cost: (INVENTORY.find(x => x.item_code === ing.rm_code) || {}).unit_cost || 1,
          calculated_qty: required,
          required_qty: required,
          base_qty: ing.qty,
          scaled_qty: required,
          recipe_qty: ing.qty,
          sage_qty: stock,
          to_order: remaining < 0 ? +Math.abs(remaining).toFixed(4) : 0,
          remaining,
          short: remaining < 0,
        };
      });
      return jsonResponse({
        recipe_code: recipe.code,
        recipe_name: recipe.recipe_name,
        product_name: recipe.product_name,
        product_code: recipe.product_code,
        target_qty: target, unit, batch_size_l: target,
        items,
        any_short: items.some(i => i.short),
        total_cost: items.reduce((s, i) => s + (i.unit_cost * i.calculated_qty), 0),
      });
    }
    if (path === '/calculate-pdf' || path === '/calculate-picking-sheet') return blobResponse(placeholderPdfBlob());

    // -------- INVENTORY --------
    if (path === '/inventory') return jsonResponse(INVENTORY);
    if (path === '/finished-goods-inventory') {
      const fg = INVENTORY.filter(i => i.category === 'FG');
      return jsonResponse(fg);
    }
    if (path.startsWith('/finished-goods-inventory/')) {
      const code = decodeURIComponent(path.split('/')[2]);
      const it = INVENTORY.find(i => i.item_code === code) || INVENTORY.find(i=>i.category==='FG');
      return jsonResponse({ ...it, summary: { available: it.on_hand - it.reserved, reserved: it.reserved, on_hand: it.on_hand } });
    }
    if (path === '/et-inventory') return jsonResponse(INVENTORY);

    // -------- INVENTORY TRANSACTIONS / GRN --------
    if (path === '/inventory-transactions') {
      return jsonResponse({ items: INVENTORY_TXNS, total: INVENTORY_TXNS.length, total_in_value: INVENTORY_TXNS.reduce((s,t)=>s+t.total_qty_in_value,0), total_out_value: INVENTORY_TXNS.reduce((s,t)=>s+t.total_qty_out_value,0) });
    }
    if (path === '/inventory-transactions/sync')          return jsonResponse({ success: true, synced: INVENTORY_TXNS.length });
    if (path === '/inventory-transactions/force-full-sync')return jsonResponse({ success: true, synced: INVENTORY_TXNS.length });
    if (path === '/inventory-transactions/sync-status')   return jsonResponse({ status: 'idle', last_sync: todayISO, demo_mode: true });
    if (path === '/gl-sales')                             return jsonResponse(genGLSales(query.type));

    // -------- JOB ORDERS --------
    if (path === '/job-orders' || path === '/job-orders/') {
      if (method === 'GET') {
        let out = JOB_ORDERS.slice();
        if (query.status) out = out.filter(j => j.status === query.status);
        if (query.source) out = out.filter(j => j.source === query.source);
        return jsonResponse(out);
      }
      return jsonResponse({ success: true, _id: oid('jo-'), jo_number: 'JO-DEMO-' + Math.floor(1000+Math.random()*9000), demo_mode: true });
    }
    if (path === '/job-orders/untyped') return jsonResponse([JOB_ORDERS[4]]);
    if (path === '/job-orders/pending-pdf') return jsonResponse(JOB_ORDERS.filter(j => j.status === 'pending'));
    if (path === '/job-orders/status-list') return jsonResponse([
      { status: 'draft',         count: 1 },
      { status: 'pending',       count: 1 },
      { status: 'processed',     count: 1 },
      { status: 'in_production', count: 1 },
      { status: 'completed',     count: 1 },
    ]);
    if (path === '/job-order-groups' || path === '/job-order-groups/') {
      return jsonResponse(JOB_ORDERS.map(j => ({
        _id: 'grp-' + j._id, summary_ref: j.jo_number, parent_id: 'p-' + j._id,
        customer_name: j.customer_name, customer: j.customer_name, status: j.status,
        children: [{ ...j, product_code: j.product_code, qty: j.qty, status: j.status }],
        po_number: j.po_number,
        order_type: j.order_type,
      })));
    }
    if (path.startsWith('/job-orders/')) {
      // e.g. /job-orders/{id}, /job-orders/{id}/process, etc.
      const parts = path.split('/');
      const id = decodeURIComponent(parts[2] || '');
      const jo = JOB_ORDERS.find(j => j._id === id || j.jo_number === id || j.summary_ref === id);
      if (parts[3] && (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE')) {
        return jsonResponse({ success: true, demo_mode: true });
      }
      if (parts[3] === 'type' && method === 'GET') return jsonResponse({ order_type: jo?.order_type || 'local' });
      return jsonResponse(jo || JOB_ORDERS[0]);
    }
    if (path === '/po-number-check') return jsonResponse({ exists: false });
    if (path === '/admin/reset-jo-counter') return jsonResponse({ success: true, new_counter: 1000 });

    // -------- ALLOCATIONS / FLOW --------
    if (path === '/allocations/pending')    return jsonResponse(ALLOCATIONS_PENDING);
    if (path === '/document-links')         return jsonResponse(DOCUMENT_LINKS);
    if (path.startsWith('/document-links/'))return jsonResponse({ success: true });

    // -------- STOCK RESERVATIONS --------
    if (path === '/stock-reservations') return jsonResponse(STOCK_RESERVATIONS);
    if (path === '/stock-reservations/totals') return jsonResponse(STOCK_RES_TOTALS);
    if (path.startsWith('/stock-reservations/')) return jsonResponse({ success: true });

    // -------- PRODUCTION BATCHES --------
    if (path === '/production-batches') {
      if (method === 'GET') return jsonResponse({ batches: PRODUCTION_BATCHES, total: PRODUCTION_BATCHES.length });
      return jsonResponse({ success: true, _id: oid('pb-'), batch_no: 'DEMO-' + Math.floor(1000+Math.random()*9000), demo_mode: true });
    }
    if (path === '/production-batch') {
      if (method === 'GET') return jsonResponse(PRODUCTION_BATCHES);
      return jsonResponse({ success: true, _id: oid('pb-'), batch_no: 'DEMO-' + Math.floor(1000+Math.random()*9000), demo_mode: true });
    }
    if (path.startsWith('/production-batch/')) {
      const parts = path.split('/');
      const id = parts[2];
      const batch = PRODUCTION_BATCHES.find(b => b._id === id || b.batch_no === id) || PRODUCTION_BATCHES[0];
      if (parts[3] === 'raw-materials') {
        // Allocated / used quantities scale with the batch's planned qty.
        const scale = (batch.planned_qty || 50) * 1.2;
        return jsonResponse({
          batch_no: batch.batch_no,
          items: RECIPES[0].ingredients.map(i => ({
            ...i,
            allocated_qty: +(i.qty * scale).toFixed(2),
            used_qty: +(i.qty * scale * 0.96).toFixed(2),
            returned_qty: +(i.qty * scale * 0.04).toFixed(2),
          })),
        });
      }
      if (parts[3] === 'ingredient-batch-numbers' && method === 'GET') {
        return jsonResponse(RECIPES[0].ingredients.map(i => ({ rm_code: i.rm_code, batch_number: 'B-' + Math.floor(1000+Math.random()*9000) })));
      }
      if (parts[3] === 'picking-sheet-data') {
        const scale = (batch.planned_qty || 50) * 1.2;
        return jsonResponse({
          batch_no: batch.batch_no, recipe_name: batch.recipe_name, product_name: batch.product_name,
          planned_qty: batch.planned_qty,
          items: RECIPES[0].ingredients.map(i => {
            const inv = INVENTORY.find(x => x.item_code === i.rm_code) || {};
            const uc = inv.unit_cost || 0;
            const requiredQty = +(i.qty * scale).toFixed(2);
            return { ...i, item_code: i.rm_code, unit_cost: uc, required_qty: requiredQty, total_cost: +(requiredQty * uc).toFixed(2) };
          }),
        });
      }
      return jsonResponse(batch);
    }

    // -------- PRODUCTION CONTROL REPORTS --------
    if (path === '/production-control-reports') {
      if (method === 'GET') {
        let out = DYNAMIC_REPORTS.concat(PRODUCTION_REPORTS);
        if (query.status) out = out.filter(r => r.status === query.status);
        return jsonResponse({ reports: out, total: out.length });
      }
      // POST → persist a new pending PCR so the user can drill in immediately
      const body = payload || {};
      const newPcr = {
        _id: 'pcr-new-' + Math.random().toString(36).slice(2,7),
        id: 'pcr-new-' + Math.random().toString(36).slice(2,7),
        report_date: ymd(today),
        production_date: body.production_date || ymd(today),
        line: 'Line A',
        product_code: body.product_code || 'FG-500ML',
        product_name: body.product_name || 'Sample Beverage',
        recipe_name: body.recipe_name || 'REC-A1',
        batch_no: body.batch_no || ('DEMO-' + Math.floor(1000+Math.random()*9000)),
        production_batch_id: body.production_batch_id || body.batch_no,
        packaging_type: body.packaging_type || 'PET',
        planned_qty: body.planned_qty || 1,
        actual_qty: 0, rejects: 0, oee_pct: 0,
        status: 'pending',
        downtime_minutes: 0, downtime_entries: [],
        operator: 'demo.user', supervisor: 'demo.admin', notes: '',
        raw_material_cost: body.raw_material_cost || 1,
        created_at: todayISO,
      };
      DYNAMIC_REPORTS.unshift(newPcr);
      return jsonResponse(newPcr);
    }
    if (path.startsWith('/production-control-reports/batch-history/')) {
      const batch = decodeURIComponent(path.split('/')[3]);
      const all = DYNAMIC_REPORTS.concat(PRODUCTION_REPORTS);
      return jsonResponse({ reports: all.filter(r => r.batch_no === batch) });
    }
    if (path.startsWith('/production-control-reports/')) {
      const parts = path.split('/');
      const id = parts[2];
      if (parts[3] === 'pdf' || parts[3] === 'pdf-combined') return blobResponse(placeholderPdfBlob());
      if (parts[3] === 'reset') return jsonResponse({ success: true });
      if (parts[3] && method !== 'GET') return jsonResponse({ success: true });
      const all = DYNAMIC_REPORTS.concat(PRODUCTION_REPORTS);
      return jsonResponse(all.find(r => r._id === id) || all[0]);
    }

    // -------- DISPATCH --------
    if (path === '/dispatch/pending-items') return jsonResponse(DISPATCH_PENDING);
    if (path === '/dispatch/active')        return jsonResponse(DISPATCH_ACTIVE);
    if (path === '/dispatch/history')       return jsonResponse(DISPATCH_HISTORY);
    if (path.startsWith('/dispatch/items/') || path.startsWith('/dispatch/'))
      return jsonResponse({ success: true, demo_mode: true });

    // -------- CUSTOMERS --------
    if (path === '/customers') return jsonResponse(CUSTOMERS);
    if (path.startsWith('/customers/')) return jsonResponse({ success: true });

    // -------- SUPPLIERS --------
    if (path === '/suppliers') {
      const onlyActive = query.active_only === 'true';
      return jsonResponse(onlyActive ? SUPPLIERS.filter(s => s.active) : SUPPLIERS);
    }
    if (path.startsWith('/suppliers/')) return jsonResponse({ success: true });

    // -------- QUOTATIONS / PROFORMA --------
    if (path === '/quotations')           return jsonResponse(QUOTATIONS);
    if (path === '/proforma-invoices' || path === '/proforma') return jsonResponse(PROFORMA_INVOICES);
    if (path.startsWith('/quotations/'))  return jsonResponse({ success: true });
    if (path === '/company-settings')     return jsonResponse(COMPANY_SETTINGS);
    if (path === '/price-list' || path.startsWith('/price-list'))
      return jsonResponse(PRICE_LIST);
    if (path === '/price-list/sync-from-inventory') return jsonResponse({ success: true, synced: PRICE_LIST.length });

    // -------- FORECAST --------
    if (path === '/forecast-report' && method === 'POST')
      return jsonResponse({ items: FORECAST, products: FORECAST, generated_at: todayISO, total_shortfall: FORECAST.reduce((s,f)=>s+f.shortfall,0) });
    if (path === '/past-forecast-report' && method === 'POST')
      return jsonResponse({ items: FORECAST, products: FORECAST, period: '2026-04' });
    if (path === '/past-forecast-transactions')
      return jsonResponse({ items: INVENTORY_TXNS.slice(0, 12), total: 12 });

    // -------- ACCOUNTING --------
    if (path === '/accounting/gl-accounts')    return jsonResponse([
      { code: '1000', account: '1000', name: 'Cash on hand' },
      { code: '1010', account: '1010', name: 'Bank Demo · ****0001' },
      { code: '1300', account: '1300', name: 'Demo Inventory' },
      { code: '2100', account: '2100', name: 'Demo AP - Supplier' },
      { code: '4000', account: '4000', name: 'Demo Revenue' },
      { code: '5000', account: '5000', name: 'Demo COGS' },
    ]);
    if (path === '/accounting/clients')        return jsonResponse(CUSTOMERS);
    if (path === '/accounting/vendors')        return jsonResponse(SUPPLIERS);
    if (path === '/accounting/bank-accounts')  return jsonResponse([
      { code: 'BANK-DEMO', name: 'Bank Demo · ****0001', balance: 387450 },
      { code: 'CASH-1',    name: 'Petty Cash',           balance: 4280 },
    ]);
    if (path === '/accounting/cb-tr-codes')    return jsonResponse([
      { code: 'TR-01', name: 'Supplier payment' },
      { code: 'TR-02', name: 'Customer receipt' },
      { code: 'TR-03', name: 'Petty cash expense' },
      { code: 'TR-04', name: 'Bank transfer' },
    ]);
    if (path === '/accounting/projects')       return jsonResponse([
      { code: 'PRJ-DEMO', name: 'Demo Project' },
      { code: 'PRJ-EXP',  name: 'Demo Expansion' },
    ]);
    if (path === '/accounting/cashbook')       return jsonResponse(ACCOUNTING_CASHBOOK);
    if (path === '/accounting/ar')             return jsonResponse(ACCOUNTING_AR);
    if (path === '/accounting/ap')             return jsonResponse(ACCOUNTING_AP);
    if (path === '/accounting/drafts') {
      const mod = query.module;
      return jsonResponse(mod ? ACCOUNTING_DRAFTS.filter(d => d.module === mod) : ACCOUNTING_DRAFTS);
    }
    if (path === '/accounting/pending-drafts') return jsonResponse(ACCOUNTING_DRAFTS.filter(d => d.status === 'pending'));
    if (path.startsWith('/accounting/aging/')) return jsonResponse({
      buckets: [
        { bucket: '0-30',  amount: 184600, count: 7 },
        { bucket: '31-60', amount:  72400, count: 4 },
        { bucket: '61-90', amount:  38200, count: 2 },
        { bucket: '90+',   amount:  12800, count: 1 },
      ],
    });
    if (path.startsWith('/accounting/vat/')) return jsonResponse({
      summary: { net: 482300, vat: 24115, total: 506415, output_vat: 31420, input_vat: 7305 },
      rows: [
        { date: ymd(today),       kind: 'output', ref: 'PI-2026-0001', net: 18400, vat: 920, total: 19320 },
        { date: ymd(daysAgo(1)),  kind: 'input',  ref: 'INV-SUP-0001', net:  4200, vat: 210, total:  4410 },
        { date: ymd(daysAgo(2)),  kind: 'output', ref: 'PI-2026-0002', net: 26800, vat:1340, total: 28140 },
        { date: ymd(daysAgo(4)),  kind: 'input',  ref: 'INV-SUP-0002', net:  9650, vat: 483, total: 10133 },
        { date: ymd(daysAgo(6)),  kind: 'output', ref: 'PI-2026-0003', net: 14200, vat: 710, total: 14910 },
      ],
    });
    if (path.startsWith('/accounting/drafts/')) {
      const parts = path.split('/');
      const id = parts[3];
      if (parts[4] === 'files') return jsonResponse({ files: [] });
      if (parts[4] === 'post' || parts[4] === 'reject') return jsonResponse({ success: true });
      return jsonResponse(ACCOUNTING_DRAFTS.find(d => d._id === id) || ACCOUNTING_DRAFTS[0]);
    }
    if (path.startsWith('/accounting/files/')) return jsonResponse({ success: true });

    // -------- SAGE --------
    if (path === '/sage/drafts')       return jsonResponse(SAGE_DRAFTS);
    if (path === '/sage/posted')       return jsonResponse(SAGE_POSTED);
    if (path === '/sage/poll')         return jsonResponse({ success: true, polled: 0, demo_mode: true });
    if (path === '/sage/agent-health') return jsonResponse(SAGE_AGENT_HEALTH);
    if (path.startsWith('/sage/draft-status/')) {
      const bn = decodeURIComponent(path.split('/')[2]);
      return jsonResponse({ batch_no: bn, status: 'draft', sage_batch_id: SAGE_DRAFTS[0].sage_batch_id });
    }
    if (path.startsWith('/sage/draft/')) {
      const parts = path.split('/');
      const id = parts[3];
      if (parts[4] === 'approve' || parts[4] === 'reject') return jsonResponse({ success: true });
      return jsonResponse(sageDraftDetail(id));
    }
    if (path === '/sage/draft')           return jsonResponse({ success: true, sage_batch_id: 'SGE-' + Math.floor(Math.random()*1e6) });
    if (path === '/sage/reset-production-batch-link') return jsonResponse({ success: true });
    if (path.startsWith('/sage/draft-pdf/')) return blobResponse(placeholderPdfBlob());

    // -------- SAGE ENTRIES --------
    if (path === '/sage-entries' || path === '/sage-entries/') {
      if (method === 'GET') return jsonResponse(SAGE_DRAFTS);
      return jsonResponse({ success: true, sage_batch_id: 'SGE-' + Math.floor(Math.random()*1e6) });
    }
    if (path === '/sage-entries/items')              return jsonResponse(SAGE_ENTRY_ITEMS);
    if (path === '/sage-entries/transaction-codes')  return jsonResponse([
      { code: 'IN-PROD', name: 'Inventory in - production' },
      { code: 'OUT-PROD',name: 'Inventory out - production' },
      { code: 'GRN',     name: 'Goods receipt' },
      { code: 'DISP',    name: 'Dispatch' },
      { code: 'ADJ',     name: 'Adjustment' },
    ]);
    if (path === '/sage-entries/sage-drafts')        return jsonResponse(SAGE_DRAFTS);
    if (path.startsWith('/sage-entries/')) {
      const parts = path.split('/');
      const id = parts[2];
      if (parts[3] === 'approve' || method === 'DELETE' || method === 'PUT') return jsonResponse({ success: true });
      return jsonResponse(sageDraftDetail(id));
    }

    // -------- CUSTOMS / FTA --------
    if (path === '/customs/declarations') {
      if (method === 'GET') {
        let out = CUSTOMS_DECLARATIONS.slice();
        if (query.declaration_type) out = out.filter(d => d.declaration_type === query.declaration_type);
        return jsonResponse(out);
      }
      return jsonResponse({ success: true, _id: oid('cd-'), demo_mode: true });
    }
    if (path.startsWith('/customs/declarations/')) {
      const parts = path.split('/');
      const id = parts[3];
      if (parts[4] === 'files') return jsonResponse({ files: [] });
      if (parts[4] && parts[4].startsWith('generate')) return blobResponse(placeholderPdfBlob());
      return jsonResponse(CUSTOMS_DECLARATIONS.find(d => d._id === id) || CUSTOMS_DECLARATIONS[0]);
    }
    if (path === '/customs/ts-items')              return jsonResponse(FTA_TRANSFERS);
    if (path === '/customs/product-master')        return jsonResponse(PRICE_LIST);
    if (path === '/customs/product-master/seed')   return jsonResponse({ success: true, seeded: PRICE_LIST.length });
    if (path.startsWith('/customs/fta/'))          return jsonResponse({ rows: FTA_TRANSFERS, generated_at: todayISO });
    if (path.startsWith('/customs/files/'))        return jsonResponse({ success: true });

    // -------- RM ORDERS --------
    if (path === '/rm-orders') {
      if (method === 'GET') {
        let out = RM_ORDERS.slice();
        if (query.status) out = out.filter(o => o.status === query.status);
        return jsonResponse(out);
      }
      return jsonResponse({ success: true, _id: oid('rmo-'), order_number: 'RMO-' + Math.floor(1000+Math.random()*9000), demo_mode: true });
    }
    if (path === '/rm-orders/dashboard') return jsonResponse({
      open_orders: RM_ORDERS.filter(o => o.status !== 'received').length,
      received_orders: RM_ORDERS.filter(o => o.status === 'received').length,
      critical_materials: RM_CRITICAL.length,
      total_value: RM_ORDERS.reduce((s,o)=>s+o.total_value,0),
    });
    if (path === '/rm-orders/critical-materials') return jsonResponse(RM_CRITICAL);
    if (path === '/rm-orders/search-materials')   return jsonResponse(INVENTORY.filter(i=>i.category==='RM').slice(0, 8));
    if (path === '/rm-orders/grn-documents')      return jsonResponse([
      { _id: oid('grndoc-'), grn_number: 'GRN-2026-0001', order_number: 'RMO-2026-0003', supplier: 'Demo Supplier Co',   date: daysAgo(1), items: 2, value: 18450 },
      { _id: oid('grndoc-'), grn_number: 'GRN-2026-0002', order_number: 'RMO-2026-0004', supplier: 'Placeholder Supply', date: daysAgo(5), items: 1, value:  6280 },
    ]);
    if (path.startsWith('/rm-orders/')) {
      const parts = path.split('/');
      const id = parts[2];
      if (parts[3] === 'approve' || parts[3] === 'reject' || parts[3] === 'receive' || method === 'DELETE') return jsonResponse({ success: true });
      if (parts[3] === 'pdf') return blobResponse(placeholderPdfBlob());
      if (parts[3] === 'grn') return blobResponse(placeholderPdfBlob());
      return jsonResponse({
        ...(RM_ORDERS.find(o => o._id === id) || RM_ORDERS[0]),
        items: [
          { rm_code: 'RM-SUGAR',  description: 'Demo Sugar',    qty: 2400, uom: 'kg', unit_cost: 4.20,  total_cost: 10080 },
          { rm_code: 'RM-FLAVOR', description: 'Demo Flavor X', qty:  180, uom: 'L',  unit_cost: 28.50, total_cost:  5130 },
        ],
      });
    }

    // -------- MIXING TANKS / CIP --------
    if (path === '/mixing/cip/pending') return jsonResponse(TANK_KEYS.slice(0, 2).map(t => ({ tank: t, status: 'awaiting', priority: 'normal' })));
    if (path.startsWith('/mixing/tanks/')) {
      const parts = path.split('/');
      const tank = decodeURIComponent(parts[3]);
      if (parts[4] === 'cip' && parts[5] === 'history' && parts[6]) {
        // single entry
        return jsonResponse(tankCipHistory(tank)[0]);
      }
      if (parts[4] === 'cip' && parts[5] === 'history') return jsonResponse(tankCipHistory(tank));
      if (parts[4] === 'cip' && method === 'GET')       return jsonResponse({ tank, current_state: 'idle', last_cip: daysAgo(1) });
      if (parts[4] === 'cip' && method === 'POST')      return jsonResponse({ success: true, entry_id: oid('e-') });
      if (parts[4] === 'cip' && parts[5] === 'pdf')     return blobResponse(placeholderPdfBlob());
    }
    if (path.startsWith('/mixing/raw-material-inspection/')) {
      const bn = decodeURIComponent(path.split('/')[3]);
      if (path.endsWith('/pdf')) return blobResponse(placeholderPdfBlob());
      return jsonResponse(rmInspection(bn));
    }
    if (path.startsWith('/mixing/ops/')) {
      const parts = path.split('/');
      const opType = parts[3];
      if (parts[4] === 'history' && parts[5]) {
        if (path.endsWith('/pdf')) return blobResponse(placeholderPdfBlob());
        if (method === 'DELETE' || method === 'PUT') return jsonResponse({ success: true });
        return jsonResponse(mixingOpsHistory(opType)[0]);
      }
      if (parts[4] === 'history') {
        if (method === 'GET') return jsonResponse(mixingOpsHistory(opType));
        return jsonResponse({ success: true, entry_id: oid('e-') });
      }
    }

    // -------- MIXING UTILITIES --------
    if (path.startsWith('/mixing-utilities/')) {
      const parts = path.split('/');
      const docType = parts[2];
      if (parts[3]) {
        if (path.endsWith('/pdf')) return blobResponse(placeholderPdfBlob());
        if (method === 'DELETE') return jsonResponse({ success: true });
        return jsonResponse(mixingUtilities(docType)[0]);
      }
      return jsonResponse(mixingUtilities(docType));
    }

    // -------- QC --------
    if (path === '/qc/batches' || path === '/qc/batches/') {
      if (method === 'GET') return jsonResponse({ batches: QC_BATCHES });
      // POST batch (e.g. ensure) - return success
      return jsonResponse({ success: true, batch_no: (payload && payload.batch_no) || ('DEMO-' + Math.floor(Math.random()*9000)), demo_mode: true });
    }
    if (path === '/qc/batches/ensure') {
      const body = payload || {};
      const batchNo = body.batch_no || ('DEMO-' + Math.floor(Math.random()*9000));
      return jsonResponse({ batch_no: batchNo, ensured: true, demo_mode: true });
    }
    if (path === '/qc/config' || path === '/qc/menu-config' || path === '/qc/menu-schema') return jsonResponse({
      sections: ['batch_record','mixing','sample','seam','tank_cip','qc_report','filler_mixer_cip'],
      role_overrides: {},
    });
    if (path === '/qc/qc-report/default-uv') return jsonResponse({ uv: { min: 0, max: 0, default: 0 }, demo_mode: true });

    if (path.startsWith('/qc/batches/')) {
      const parts = path.split('/');
      const bn = decodeURIComponent(parts[3] || '');
      const section = parts[4];
      if (isPdfPath(path)) return blobResponse(placeholderPdfBlob());
      const batch = QC_BATCHES.find(b => b.batch_no === bn) || QC_BATCHES[0];

      // Common per-section reads
      if (section === 'qc-report' || section === 'qc_report') {
        return jsonResponse({
          batch_no: bn, recipe: batch.recipe, product: batch.product, date: batch.date,
          data: {
            checks: [
              { name: 'Brix',          uom: 'degBx',    min: 10, max: 14, measured: 12, result: 'PASS' },
              { name: 'pH',            uom: '',         min: 3.0, max: 4.0, measured: 3.5, result: 'PASS' },
              { name: 'Net content',   uom: 'mL',       min: 495, max: 505, measured: 500, result: 'PASS' },
              { name: 'Cap torque',    uom: 'lb-in',    min: 8, max: 12, measured: 10, result: 'PASS' },
              { name: 'Seam thickness',uom: 'mm',       min: 0.1, max: 0.5, measured: 0.3, result: 'PASS' },
              { name: 'Carbonation',   uom: 'vol',      min: 2.0, max: 4.0, measured: 3.0, result: batch.verdict === 'REVIEW' ? 'REVIEW' : 'PASS' },
              { name: 'Microbiology',  uom: 'cfu/mL',   min: 0, max: 10, measured: 0, result: 'PASS' },
            ],
            verdict: batch.verdict, status: batch.status, approver: batch.approver,
          },
        });
      }
      if (section === 'cover-page') {
        return jsonResponse({ batch_no: bn, data: { product_name: batch.product, recipe_name: batch.recipe, mfg_date: batch.date, best_before: ymd(daysAgo(-365)), batch_size: 2400 } });
      }
      if (section === 'mixing') {
        return jsonResponse({ batch_no: bn, data: { mixing_steps: [
          { step: 1, ingredient: 'Demo Water',  qty: 1800, uom: 'L',  time: '08:00', operator: 'demo.user', ok: true },
          { step: 2, ingredient: 'Demo Sugar',  qty:  420, uom: 'kg', time: '08:10', operator: 'demo.user', ok: true },
          { step: 3, ingredient: 'Demo Flavor', qty:   35, uom: 'L',  time: '08:20', operator: 'demo.user', ok: true },
        ] } });
      }
      if (section === 'tank-cip') {
        return jsonResponse({ batch_no: bn, data: { tank: 'Tank-1', steps: [
          { step: 'Pre-rinse',   ok: true, duration_min: 5 },
          { step: 'Caustic',     ok: true, duration_min: 15 },
          { step: 'Inter-rinse', ok: true, duration_min: 5 },
          { step: 'Acid',        ok: true, duration_min: 10 },
          { step: 'Final rinse', ok: true, duration_min: 5 },
        ] } });
      }
      if (section === 'filler-mixer-cip') {
        return jsonResponse({ batch_no: bn, data: { steps: [
          { step: 'Filler CIP', ok: true },
          { step: 'Mixer CIP',  ok: true },
        ] } });
      }
      if (section === 'seam') {
        return jsonResponse({ batch_no: bn, data: { checks: [
          { sample: 1, thickness_mm: 0.3, depth_mm: 3.0, ok: true },
          { sample: 2, thickness_mm: 0.3, depth_mm: 3.0, ok: true },
        ] } });
      }
      if (section === 'sample' || section === 'batch-record' || section === 'batch_record') {
        return jsonResponse({ batch_no: bn, data: { taken_at: todayISO, taken_by: 'demo.qc', notes: 'Demo sample data' } });
      }
      if (section === 'picking-sheet-url') {
        return jsonResponse({ batch_no: bn, url: '/api/qc/batches/' + encodeURIComponent(bn) + '/picking-sheet/pdf' });
      }
      if (section === 'identifiers' && method === 'PUT') return jsonResponse({ success: true, batch_no: bn });
      if (section === 'documents' && parts[5] === 'generate') return jsonResponse({ success: true, generated: ['cover_page','mixing','seam','qc_report'] });

      // No section specified → return the batch
      if (!section) return jsonResponse(batch);

      // PUT for any section → success
      if (method === 'PUT' || method === 'POST') return jsonResponse({ success: true, batch_no: bn, section });

      return jsonResponse({ batch_no: bn, section, data: {}, demo: true });
    }
    if (path.startsWith('/qc/')) {
      if (isPdfPath(path)) return blobResponse(placeholderPdfBlob());
      return jsonResponse({ data: {}, demo_mode: true });
    }

    // -------- SUGAR DISSOLVER --------
    if (path === '/sugar-dissolver/pending-sugar') return jsonResponse(SUGAR_PENDING);
    if (path === '/sugar-dissolver/issuances')     return jsonResponse(SUGAR_ISSUANCES);
    if (path === '/sugar-dissolver/pdf')           return blobResponse(placeholderPdfBlob());
    if (path.startsWith('/sugar-dissolver/issuances/') && path.endsWith('/pdf')) return blobResponse(placeholderPdfBlob());

    // -------- REPORTING --------
    if (path === '/reporting/product-gtin-details') return jsonResponse(RECIPES.map(r => ({ recipe_name: r.recipe_name, product_code: r.product_code, product_name: r.product_name, gtin: r.gtin })));
    if (path === '/reporting/product-gtin-details/pdf') return blobResponse(placeholderPdfBlob());

    // -------- RECEPTION --------
    if (path === '/reception/visitors') return jsonResponse(RECEPTION_VISITORS);
    if (path === '/reception/couriers') return jsonResponse(RECEPTION_COURIERS);
    if (path.startsWith('/reception/photos/')) {
      // return a tiny inline SVG portrait so the UI shows something
      const svg = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="160" height="200" viewBox="0 0 160 200"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7c9cff"/><stop offset="100%" stop-color="#5eead4"/></linearGradient></defs><rect width="160" height="200" fill="url(#g)"/><circle cx="80" cy="78" r="36" fill="#0a0d12" opacity=".7"/><ellipse cx="80" cy="170" rx="56" ry="40" fill="#0a0d12" opacity=".7"/><text x="80" y="195" text-anchor="middle" fill="#fff" font-family="monospace" font-size="11">DEMO PHOTO</text></svg>';
      return new Response(svg, { status: 200, headers: { 'Content-Type': 'image/svg+xml' } });
    }
    if (path.startsWith('/reception/export/')) return blobResponse(placeholderPdfBlob());
    if (path.startsWith('/reception/')) return jsonResponse({ success: true });

    // -------- PDF DOCUMENTS --------
    if (path === '/pdf-documents') return jsonResponse(
      Array.from({length: 18}, (_, i) => ({
        _id: 'pdfdoc-' + (i+1),
        filename: ['Job Order','Picking Sheet','QC Report','Sage Batch','Performa Invoice','Delivery Advice','Mixing Ops','RM Order'][i % 8] + ' DEMO-' + String(1000+i),
        doc_type: ['job_order','picking_sheet','qc_report','sage_batch','proforma_invoice','dispatch','mixing_ops','rm_order'][i % 8],
        size_kb: 60 + (i*7) % 80,
        created_at: daysAgo(i % 14),
        created_by: 'demo.admin',
        ref_id: 'DEMO-' + String(1001+i),
      }))
    );
    if (path === '/pdf-documents/merge-download')   return blobResponse(placeholderPdfBlob());
    if (path.startsWith('/pdf-documents/'))         return blobResponse(placeholderPdfBlob());

    // -------- DIRECT PDF GENERATORS --------
    if (path === '/job-order-pdf' || path === '/proforma-invoice-pdf' || path === '/calculate-pdf')
      return blobResponse(placeholderPdfBlob());

    // -------- PO upload / extraction --------
    if (path === '/extract-po-for-editing')         return jsonResponse({
      customer: 'Demo Customer Ltd', po_number: 'PO-IN-' + Math.floor(1000+Math.random()*9000),
      items: [{ product_code: 'FG-500ML', description: 'Sample Beverage 500 mL', qty: 240, unit: 'case' }],
    });
    if (path === '/upload-po')                      return jsonResponse({ success: true, _id: oid('po-') });

    // -------- DEFAULTS --------
    if (isPdfPath(path) && method === 'GET') return blobResponse(placeholderPdfBlob());
    if (method === 'GET') {
      // list vs item heuristic
      const tail = path.split('/').pop() || '';
      if (/^[a-f0-9-]{6,}$/i.test(tail) || /^[A-Z]+-\d+$/.test(tail)) return jsonResponse({ _id: tail, demo: true });
      return jsonResponse([]);
    }
    return jsonResponse({ success: true, _id: oid('demo-'), demo_mode: true });
  }

  /* =========================================================
     4. fetch() shim
     ========================================================= */
  const realFetch = window.fetch.bind(window);
  function shouldIntercept(url) {
    if (!url) return false;
    if (url.startsWith('blob:') || url.startsWith('data:')) return false;
    const p = pathOf(url);
    // Let static QC assets fall through to the real HTTP server
    if (p.startsWith('/api/qc/assets/'))     return false;
    if (p.startsWith('/app/api/qc/assets/')) return false;
    if (url.startsWith('/api/') || url.startsWith('/auth/')) return true;
    try {
      const u = new URL(url, window.location.href);
      if (u.origin === window.location.origin) return u.pathname.startsWith('/api/') || u.pathname.startsWith('/auth/');
    } catch (_) {}
    return false;
  }
  window.fetch = async function patchedFetch(input, init = {}) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const method = (init.method || (input && input.method) || 'GET').toUpperCase();

    if (!shouldIntercept(url)) {
      if (/^https?:\/\//.test(url)) {
        log('blocked external fetch:', url);
        return jsonResponse({ blocked: true, demo_mode: true });
      }
      return realFetch(input, init);
    }
    if (isPdfPath(url) && method === 'GET') return blobResponse(placeholderPdfBlob());

    let payload = null;
    if (init.body) { try { payload = typeof init.body === 'string' ? JSON.parse(init.body) : null; } catch (_) {} }

    log(method, url, payload ? '[body]' : '');
    return route(url, method, payload);
  };

  /* =========================================================
     5. XHR shim (some libs still use it)
     ========================================================= */
  const RealXHR = window.XMLHttpRequest;
  function MockXHR() {
    const xhr = new RealXHR();
    let _url = '', _method = 'GET';
    const open = xhr.open;
    xhr.open = function (method, url, ...rest) {
      _method = (method || 'GET').toUpperCase();
      _url = url;
      if (shouldIntercept(url)) {
        log('XHR intercept ->', _method, url);
        Object.defineProperty(xhr, 'readyState', { configurable: true, get: () => 4 });
        Object.defineProperty(xhr, 'status',     { configurable: true, get: () => 200 });
        xhr.send = function () {
          let payload = null;
          try { payload = arguments[0] ? JSON.parse(arguments[0]) : null; } catch (_) {}
          const resp = route(_url, _method, payload);
          resp.text().then(t => {
            Object.defineProperty(xhr, 'responseText', { configurable: true, get: () => t });
            Object.defineProperty(xhr, 'response',     { configurable: true, get: () => t });
            if (typeof xhr.onreadystatechange === 'function') xhr.onreadystatechange();
            if (typeof xhr.onload === 'function') xhr.onload();
          });
        };
        return;
      }
      return open.call(xhr, method, url, ...rest);
    };
    return xhr;
  }
  window.XMLHttpRequest = MockXHR;

  log('mock-api installed · admin auto-login · network blocked · ' + INVENTORY.length + ' inventory + ' + JOB_ORDERS.length + ' JOs + ' + RECIPES.length + ' recipes seeded');
})();
