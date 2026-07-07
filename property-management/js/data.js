/* data.js - Property Management demo seed. Exposes window.PM_DATA.
 *
 * A fictional Dubai community-management operator ("Property Management").
 * One synthetic portfolio drives five role portals (tenant / landlord /
 * manager / vendor / inspector). Everything is generated from a deterministic
 * RNG so first paint is fully populated and identical on every load.
 *
 * All names, Emirates IDs, IBANs, cheque numbers, DEWA premises, Ejari
 * numbers, phone numbers and figures are FABRICATED. Currency is AED. UAE
 * conventions are modelled (Ejari tenancy registration, post-dated cheques,
 * DEWA utilities, RERA rent index, 5% security deposit) but no real entity,
 * property or person is represented. */
(function () {
  'use strict';

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var rand = mulberry32(20260707);
  function rnd(a, b) { return a + (b - a) * rand(); }
  function irnd(a, b) { return Math.floor(rnd(a, b + 1)); }
  function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }
  function chance(p) { return rand() < p; }
  function pad(n, w) { return String(n).padStart(w || 4, '0'); }
  var DAY = 86400000;
  // Fixed "now" reference for deterministic due-date math relative to load time.
  function dayISO(offsetDays) { return new Date(Date.now() + offsetDays * DAY).toISOString(); }
  function dateOnly(offsetDays) { return new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10); }

  var ENUMS = {
    UNIT_STATUS: ['occupied', 'vacant', 'notice', 'under_maintenance', 'reserved'],
    LEASE_STATUS: ['active', 'upcoming', 'expiring', 'renewal_offered', 'expired', 'renewed', 'terminated'],
    INVOICE_STATUS: ['upcoming', 'due', 'paid', 'partially_paid', 'overdue', 'cancelled'],
    WO_STATUS: ['submitted', 'triaged', 'assigned', 'scheduled', 'in_progress', 'on_hold', 'completed', 'verified', 'closed', 'cancelled'],
    WO_PRIORITY: ['emergency', 'high', 'medium', 'low'],
    WO_CATEGORY: ['ac_hvac', 'plumbing', 'electrical', 'appliance', 'carpentry', 'pest', 'cleaning', 'elevator', 'general'],
    BOOKING_STATUS: ['requested', 'confirmed', 'cancelled', 'completed'],
    VISITOR_STATUS: ['expected', 'checked_in', 'checked_out', 'expired'],
    TICKET_STATUS: ['open', 'in_progress', 'waiting', 'resolved', 'closed'],
    INSPECTION_STATUS: ['assigned', 'in_progress', 'submitted', 'approved', 'returned'],
    INSPECTION_TYPE: ['move_in', 'move_out', 'periodic', 'snagging']
  };

  // SLA target hours by work-order priority.
  var SLA_HOURS = { emergency: 4, high: 24, medium: 48, low: 120 };

  var SETTINGS = {
    company_name: 'Property Management',
    tagline: 'One platform. Every stakeholder.',
    currency: 'AED',
    locale: 'en-AE',
    timezone: 'Asia/Dubai',
    mgmt_fee_pct: 5,
    vat_pct: 5,
    grace_period_days: 5,
    late_fee_pct_per_month: 2,
    security_deposit_unfurnished_pct: 5,
    security_deposit_furnished_pct: 10,
    landlord_approval_threshold_aed: 2500,
    sla_hours: SLA_HOURS,
    seed_version: '20260707a'
  };

  // ===================== COMMUNITIES =====================
  var COMMUNITIES = [
    { id: 'cmn-marina', name: 'Dubai Marina', emirate: 'Dubai', lat: 25.0805, lng: 55.1403, avg_yield_pct: 6.1 },
    { id: 'cmn-jlt', name: 'Jumeirah Lakes Towers', emirate: 'Dubai', lat: 25.0693, lng: 55.1440, avg_yield_pct: 6.6 },
    { id: 'cmn-bb', name: 'Business Bay', emirate: 'Dubai', lat: 25.1857, lng: 55.2650, avg_yield_pct: 6.4 },
    { id: 'cmn-downtown', name: 'Downtown Dubai', emirate: 'Dubai', lat: 25.1954, lng: 55.2748, avg_yield_pct: 5.2 },
    { id: 'cmn-jvc', name: 'Jumeirah Village Circle', emirate: 'Dubai', lat: 25.0590, lng: 55.2090, avg_yield_pct: 7.4 },
    { id: 'cmn-hills', name: 'Dubai Hills Estate', emirate: 'Dubai', lat: 25.1120, lng: 55.2480, avg_yield_pct: 5.8 }
  ];

  var AMENITY_CATALOG = [
    { key: 'pool', name: 'Rooftop Pool', slot_minutes: 60, capacity: 12, open: '06:00', close: '22:00' },
    { key: 'gym', name: 'Fitness Centre', slot_minutes: 60, capacity: 8, open: '05:00', close: '23:00' },
    { key: 'hall', name: 'Community Hall', slot_minutes: 120, capacity: 40, open: '09:00', close: '22:00' },
    { key: 'padel', name: 'Padel Court', slot_minutes: 60, capacity: 4, open: '07:00', close: '22:00' },
    { key: 'bbq', name: 'BBQ Deck', slot_minutes: 120, capacity: 15, open: '10:00', close: '22:00' }
  ];

  // ===================== NAME POOLS =====================
  var FIRST = ['Layla', 'Omar', 'Aisha', 'Yusuf', 'Fatima', 'Khalid', 'Mariam', 'Rashid', 'Noor', 'Bilal', 'Hana', 'Tariq', 'Sara', 'Adel', 'Zainab', 'Imran', 'Dana', 'Waleed', 'Reem', 'Faisal', 'Huda', 'Nasser', 'Salma', 'Kareem', 'Lina', 'Hassan', 'Maya', 'Samir', 'Rania', 'Ali', 'Priya', 'Arjun', 'Mei', 'John', 'Elena', 'Sofia'];
  var LAST = ['Al-Mansoori', 'Haddad', 'Al-Rashid', 'Khan', 'Al-Falasi', 'Mughal', 'Hariri', 'Nasser', 'Saleh', 'Bin Saif', 'Iqbal', 'Al-Marri', 'Farooq', 'Sultan', 'Aziz', 'Rahman', 'Menon', 'Kapoor', 'Chen', 'Smith', 'Petrova', 'Costa'];
  var NATIONALITY = ['UAE', 'India', 'Pakistan', 'UK', 'Egypt', 'Lebanon', 'Jordan', 'Philippines', 'Syria', 'Canada', 'China', 'Russia'];
  var BANKS = ['Emirates NBD', 'ADCB', 'Mashreq', 'FAB', 'Dubai Islamic Bank', 'RAKBANK'];

  function fullName() { return pick(FIRST) + ' ' + pick(LAST); }
  function phone() { return '+9715' + irnd(0, 9) + ' ' + irnd(100, 999) + ' ' + irnd(1000, 9999); }
  function email(name, dom) { return name.toLowerCase().replace(/[^a-z]+/g, '.') + '@' + (dom || 'example.ae'); }
  function emiratesId() { return '784-' + irnd(1970, 2000) + '-' + pad(irnd(1000000, 9999999), 7) + '-' + irnd(0, 9); }
  function iban() { return 'AE' + irnd(10, 99) + ' 0' + irnd(100, 999) + ' ' + pad(irnd(1000, 9999), 4) + ' ' + pad(irnd(1000, 9999), 4) + ' ' + pad(irnd(100, 999), 3); }
  function makani() { return irnd(1000, 3999) + ' ' + irnd(10000, 99999); }

  // ===================== PROPERTIES =====================
  var PROP_NAMES = [
    'Marina Crest Tower', 'Lakeside Residences', 'Bay Square One', 'Boulevard Point',
    'Circle Gardens', 'Hillside Villas', 'Marina Vista', 'Canal Heights', 'The Address Court', 'Green Court'
  ];
  var TYPES = ['residential_tower', 'residential_tower', 'residential_tower', 'villa_community', 'mixed_use', 'commercial'];
  var UNIT_PLAN = [
    { type: 'studio', beds: 0, baths: 1, sqft: [380, 520], rent: [42000, 62000] },
    { type: '1BR', beds: 1, baths: 1, sqft: [650, 900], rent: [60000, 95000] },
    { type: '2BR', beds: 2, baths: 2, sqft: [1000, 1400], rent: [95000, 150000] },
    { type: '3BR', beds: 3, baths: 3, sqft: [1500, 2100], rent: [150000, 230000] }
  ];
  var VILLA_PLAN = [
    { type: 'villa_3BR', beds: 3, baths: 4, sqft: [2400, 3000], rent: [200000, 260000] },
    { type: 'villa_4BR', beds: 4, baths: 5, sqft: [3200, 4000], rent: [260000, 360000] }
  ];

  var MANAGERS = [];
  var MGR_ROLES = ['Senior Property Manager', 'Property Manager', 'Property Manager', 'Leasing Officer', 'Accounts', 'Facilities Lead'];
  for (var mi = 0; mi < 6; mi++) {
    var mn = fullName();
    MANAGERS.push({ id: 'mgr-' + pad(mi + 1, 2), name: mn, role: MGR_ROLES[mi], email: email(mn, 'propmgmt.ae'), phone: phone(), rera_no: 'RERA-' + irnd(10000, 99999), avatar_hue: irnd(0, 360), active: true });
  }
  var CURRENT_MANAGER = MANAGERS[0];

  var OWNERS = [];
  var OWNER_KINDS = ['individual', 'individual', 'individual', 'individual', 'overseas_investor', 'corporate', 'reit'];
  for (var oi = 0; oi < 22; oi++) {
    var kind = pick(OWNER_KINDS);
    var oname = kind === 'reit' ? pick(['Falcon Capital REIT', 'Gulf Yield REIT', 'Emirates Income REIT']) : kind === 'corporate' ? (pick(['Zenith', 'Oryx', 'Vantage', 'Meridian']) + ' Holdings LLC') : fullName();
    OWNERS.push({
      id: 'own-' + pad(oi + 1, 3), kind: kind, name: oname,
      email: email(oname, 'owner.ae'), phone: phone(),
      emirates_id: kind === 'overseas_investor' ? null : emiratesId(),
      nationality: pick(NATIONALITY), residency: kind === 'overseas_investor' ? 'non_resident' : 'resident',
      iban: iban(), bank: pick(BANKS), mgmt_fee_pct: pick([5, 5, 5, 6, 4.5]),
      onboarded_at: dayISO(-irnd(120, 900))
    });
  }

  var VENDOR_DEFS = [
    { name: 'CoolAir Technical Services LLC', trades: ['ac_hvac'] },
    { name: 'FlowRight Plumbing LLC', trades: ['plumbing'] },
    { name: 'Voltix Electrical Works', trades: ['electrical'] },
    { name: 'HomeFix Handyman Services', trades: ['carpentry', 'general', 'appliance'] },
    { name: 'PestGuard Pest Control', trades: ['pest'] },
    { name: 'ShinePro Cleaning', trades: ['cleaning'] },
    { name: 'LiftTech Elevator Co.', trades: ['elevator'] },
    { name: 'AquaCare Plumbing & Sanitary', trades: ['plumbing', 'general'] },
    { name: 'BrightSpark Electricals', trades: ['electrical', 'appliance'] },
    { name: 'Emirates Facilities Group', trades: ['general', 'carpentry', 'cleaning'] }
  ];
  var VENDORS = VENDOR_DEFS.map(function (v, i) {
    return {
      id: 'ven-' + pad(i + 1, 2), name: v.name, trades: v.trades,
      trade_license: 'DED-' + irnd(600000, 899999), contact_name: fullName(),
      email: email(v.name.split(' ')[0], 'vendor.ae'), phone: phone(),
      sla_hours: pick([4, 24, 24, 48]), rating: +rnd(3.4, 4.9).toFixed(1),
      jobs_completed: irnd(40, 600), hourly_rate_aed: irnd(90, 260), status: 'active'
    };
  });

  var INSPECTORS = [];
  for (var ii = 0; ii < 3; ii++) {
    var inn = fullName();
    INSPECTORS.push({ id: 'insp-' + pad(ii + 1, 2), name: inn, email: email(inn, 'propmgmt.ae'), phone: phone(), certifications: pick([['Snagging'], ['Move-in/out'], ['Snagging', 'Handover']]), avatar_hue: irnd(0, 360) });
  }

  var PROPERTIES = [], UNITS = [], AMENITIES = [];
  var unitSeq = 0;
  for (var pi = 0; pi < 8; pi++) {
    var cmn = COMMUNITIES[pi % COMMUNITIES.length];
    var ptype = pi < 5 ? 'residential_tower' : pi === 5 ? 'villa_community' : pi === 6 ? 'mixed_use' : 'commercial';
    var floors = ptype === 'villa_community' ? null : irnd(12, 42);
    var totalUnits = ptype === 'villa_community' ? irnd(10, 18) : irnd(14, 26);
    var mgr = pick(MANAGERS);
    var prop = {
      id: 'prop-' + pad(pi + 1, 2), name: PROP_NAMES[pi], community_id: cmn.id, community_name: cmn.name,
      type: ptype, floors: floors, total_units: totalUnits,
      year_built: irnd(2010, 2023), manager_id: mgr.id,
      lat: +(cmn.lat + rnd(-0.008, 0.008)).toFixed(5), lng: +(cmn.lng + rnd(-0.008, 0.008)).toFixed(5),
      makani: makani(), valuation_aed: 0, service_charge_aed_year: irnd(18, 45) * 1000,
      amenity_keys: ptype === 'commercial' ? ['gym'] : ['pool', 'gym', 'hall'].concat(chance(0.5) ? ['padel'] : []).concat(chance(0.5) ? ['bbq'] : [])
    };
    // amenities per property
    prop.amenity_keys.forEach(function (k) {
      var cat = AMENITY_CATALOG.filter(function (a) { return a.key === k; })[0];
      AMENITIES.push({ id: 'amn-' + prop.id + '-' + k, property_id: prop.id, key: k, name: cat.name, slot_minutes: cat.slot_minutes, capacity: cat.capacity, open: cat.open, close: cat.close });
    });
    // units
    var plans = ptype === 'villa_community' ? VILLA_PLAN : UNIT_PLAN;
    var propValue = 0;
    for (var ui = 0; ui < totalUnits; ui++) {
      unitSeq++;
      var plan = pick(plans);
      var sqft = irnd(plan.sqft[0], plan.sqft[1]);
      var rent = Math.round(irnd(plan.rent[0], plan.rent[1]) / 1000) * 1000;
      var floor = floors ? irnd(1, floors) : null;
      var unitNo = ptype === 'villa_community' ? ('Villa ' + (ui + 1)) : (String(floor) + pad(irnd(1, 12), 2));
      var owner = pick(OWNERS);
      var furnished = chance(0.4);
      var valuation = Math.round(rent / (cmn.avg_yield_pct / 100) / 10000) * 10000;
      propValue += valuation;
      UNITS.push({
        id: 'unit-' + pad(unitSeq, 4), property_id: prop.id, property_name: prop.name, community_name: cmn.name,
        owner_id: owner.id, unit_no: unitNo, type: plan.type, beds: plan.beds, baths: plan.baths,
        size_sqft: sqft, floor: floor, market_rent_aed: rent, furnished: furnished,
        valuation_aed: valuation, view: pick(['Marina', 'Community', 'Pool', 'Boulevard', 'Park', 'Skyline']),
        parking: plan.beds >= 2 ? 2 : 1, dewa_premise: irnd(3200000, 3299999), status: 'vacant', current_lease_id: null, current_tenant_id: null
      });
    }
    prop.valuation_aed = propValue;
    PROPERTIES.push(prop);
  }

  // ===================== TENANTS + LEASES + INVOICES =====================
  var TENANTS = [], LEASES = [], INVOICES = [], PAYMENTS = [], DEPOSITS = [];
  var leaseSeq = 0, invSeq = 0, paySeq = 0, tenantSeq = 0;

  // Occupancy target ~84%: assign leases to a subset of units.
  UNITS.forEach(function (u) {
    var roll = rand();
    if (roll < 0.84) u.status = 'occupied';
    else if (roll < 0.90) u.status = 'notice';
    else if (roll < 0.965) u.status = 'vacant';
    else if (roll < 0.99) u.status = 'under_maintenance';
    else u.status = 'reserved';
  });

  function makeLeaseForUnit(u, opts) {
    opts = opts || {};
    leaseSeq++;
    tenantSeq++;
    var tname = fullName();
    var tenant = {
      id: 'ten-' + pad(tenantSeq, 3), name: tname, email: email(tname, 'resident.ae'), phone: phone(),
      emirates_id: emiratesId(), nationality: pick(NATIONALITY),
      company: chance(0.15) ? (pick(['Techno', 'Delta', 'Prime']) + ' FZ-LLC') : null,
      current_unit_id: u.id, current_lease_id: null, kyc_verified: chance(0.85),
      reliability: +rnd(3.2, 5).toFixed(1), avatar_hue: irnd(0, 360), created_at: dayISO(-irnd(30, 700))
    };
    var owner = OWNERS.filter(function (o) { return o.id === u.owner_id; })[0];
    var annual = u.market_rent_aed + (chance(0.4) ? irnd(-6, 6) * 1000 : 0);
    var cheques = pick([1, 2, 4, 4, 6, 12]);
    var startOffset = opts.startOffset != null ? opts.startOffset : -irnd(30, 330);
    var deposit = Math.round(annual * (u.furnished ? 0.10 : 0.05));
    var lease = {
      id: 'lease-' + pad(leaseSeq, 4), unit_id: u.id, property_id: u.property_id, property_name: u.property_name,
      tenant_id: tenant.id, owner_id: u.owner_id, manager_id: pick(MANAGERS).id,
      status: 'active', annual_rent_aed: annual, security_deposit_aed: deposit, cheque_count: cheques,
      payment_method: pick(['cheque', 'cheque', 'direct_debit', 'bank_transfer']),
      start_date: dateOnly(startOffset), end_date: dateOnly(startOffset + 365),
      ejari_no: pad(irnd(100000000, 999999999), 9) + irnd(1000, 9999), ejari_registered: chance(0.9),
      contract_type: 'new', commission_aed: Math.round(annual * 0.05), notice_given: u.status === 'notice',
      created_at: dayISO(startOffset)
    };
    // lifecycle status
    var daysToEnd = startOffset + 365;
    if (daysToEnd <= 0) lease.status = 'expired';
    else if (u.status === 'notice') lease.status = 'terminated';
    else if (daysToEnd <= 60) lease.status = chance(0.5) ? 'renewal_offered' : 'expiring';
    else lease.status = 'active';

    tenant.current_lease_id = lease.id;
    u.current_lease_id = lease.id;
    u.current_tenant_id = tenant.id;
    TENANTS.push(tenant);
    LEASES.push(lease);

    // deposit record
    DEPOSITS.push({ id: 'dep-' + lease.id, lease_id: lease.id, unit_id: u.id, tenant_id: tenant.id, held_aed: deposit, status: 'held', return_draft: null });

    // invoice schedule (per cheque)
    var per = Math.round(annual / cheques);
    for (var c = 0; c < cheques; c++) {
      invSeq++;
      var dueOffset = startOffset + Math.round((365 / cheques) * c);
      var inv = {
        id: 'inv-' + pad(invSeq, 5), number: 'INV-' + pad(invSeq, 5), lease_id: lease.id, unit_id: u.id,
        tenant_id: tenant.id, owner_id: u.owner_id, property_id: u.property_id,
        installment_no: c + 1, of: cheques, due_date: dateOnly(dueOffset),
        amount_aed: c === cheques - 1 ? (annual - per * (cheques - 1)) : per,
        amount_paid_aed: 0, status: 'upcoming', method: lease.payment_method,
        cheque_no: lease.payment_method === 'cheque' ? pad(irnd(100000, 999999), 6) : null,
        cheque_bank: lease.payment_method === 'cheque' ? pick(BANKS) : null, created_at: dayISO(dueOffset - 14)
      };
      // resolve state by due date
      if (dueOffset > SETTINGS.grace_period_days) inv.status = 'upcoming';
      else if (dueOffset >= -SETTINGS.grace_period_days && dueOffset <= SETTINGS.grace_period_days) inv.status = chance(0.8) ? 'paid' : 'due';
      else {
        // past due - large single/two-cheque leases almost always clear, keeping
        // amount-weighted collection realistic (~85%).
        var r2 = rand();
        var payProb = cheques <= 2 ? 0.97 : 0.91;
        if (r2 < payProb) inv.status = 'paid';
        else if (r2 < payProb + 0.055) inv.status = 'overdue';
        else inv.status = 'partially_paid';
      }
      if (inv.status === 'paid') { inv.amount_paid_aed = inv.amount_aed; }
      if (inv.status === 'partially_paid') { inv.amount_paid_aed = Math.round(inv.amount_aed * rnd(0.3, 0.7)); }
      if (inv.status === 'paid' || inv.status === 'partially_paid') {
        paySeq++;
        var bounced = chance(0.015);
        PAYMENTS.push({
          id: 'pay-' + pad(paySeq, 5), invoice_id: inv.id, lease_id: lease.id, tenant_id: tenant.id,
          amount_aed: inv.amount_paid_aed, method: inv.method,
          reference: inv.cheque_no || ('TXN' + irnd(100000, 999999)), status: bounced ? 'bounced' : 'cleared',
          paid_at: dayISO(dueOffset + irnd(-2, 3)), recorded_by: pick(MANAGERS).id
        });
        if (bounced) { inv.status = 'overdue'; inv.amount_paid_aed = 0; }
      }
      INVOICES.push(inv);
    }
    return lease;
  }

  UNITS.forEach(function (u) {
    if (u.status === 'occupied' || u.status === 'notice') makeLeaseForUnit(u);
  });
  // A few upcoming leases on reserved units
  UNITS.filter(function (u) { return u.status === 'reserved'; }).forEach(function (u) {
    var l = makeLeaseForUnit(u, { startOffset: irnd(5, 40) });
    l.status = 'upcoming';
  });

  // ===================== WORK ORDERS =====================
  var WORK_ORDERS = [], woSeq = 0;
  var WO_TITLES = {
    ac_hvac: ['AC not cooling', 'AC leaking water', 'Thermostat not responding', 'Noisy AC unit'],
    plumbing: ['Kitchen sink leaking', 'Low water pressure', 'Toilet not flushing', 'Blocked drain'],
    electrical: ['Power socket dead', 'Lights flickering', 'Tripping breaker', 'Doorbell not working'],
    appliance: ['Oven not heating', 'Dishwasher not draining', 'Washing machine error', 'Fridge not cooling'],
    carpentry: ['Cabinet door loose', 'Wardrobe hinge broken', 'Door not closing', 'Skirting damaged'],
    pest: ['Ants in kitchen', 'Cockroach sighting', 'Pest control request'],
    cleaning: ['Deep clean request', 'Balcony cleaning', 'Post-renovation clean'],
    elevator: ['Elevator making noise', 'Elevator button stuck', 'Elevator inspection'],
    general: ['General maintenance', 'Paint touch-up', 'Handle replacement', 'Silicone re-seal']
  };
  var occLeases = LEASES.filter(function (l) { return l.status === 'active' || l.status === 'expiring' || l.status === 'renewal_offered'; });
  for (var w = 0; w < 90; w++) {
    woSeq++;
    var lease = pick(occLeases);
    if (!lease) break;
    var unit = UNITS.filter(function (x) { return x.id === lease.unit_id; })[0];
    var cat = pick(ENUMS.WO_CATEGORY);
    var prio = pick(['emergency', 'high', 'medium', 'medium', 'low', 'low']);
    var status;
    var r3 = rand();
    if (r3 < 0.12) status = 'submitted';
    else if (r3 < 0.20) status = 'triaged';
    else if (r3 < 0.34) status = 'assigned';
    else if (r3 < 0.44) status = 'scheduled';
    else if (r3 < 0.60) status = 'in_progress';
    else if (r3 < 0.66) status = 'on_hold';
    else if (r3 < 0.74) status = 'completed';
    else if (r3 < 0.82) status = 'verified';
    else if (r3 < 0.97) status = 'closed';
    else status = 'cancelled';
    var vendor = null;
    if (['assigned', 'scheduled', 'in_progress', 'on_hold', 'completed', 'verified', 'closed'].indexOf(status) !== -1) {
      var cands = VENDORS.filter(function (v) { return v.trades.indexOf(cat) !== -1; });
      vendor = (cands.length ? pick(cands) : pick(VENDORS));
    }
    var slaH = SLA_HOURS[prio];
    var closed = ['completed', 'verified', 'closed'].indexOf(status) !== -1;
    var open = ['submitted', 'triaged', 'assigned', 'scheduled', 'in_progress', 'on_hold'].indexOf(status) !== -1;
    var slaDays = slaH / 24;
    // Open orders are reported recently so most sit within SLA (~15% breach); closed ones are older.
    var reportedOffset = open ? (chance(0.15) ? -(slaDays + rnd(0.2, 2.5)) : -rnd(0, slaDays * 0.8)) : -rnd(2, 45);
    var reportedAt = dayISO(reportedOffset);
    var cost = closed ? irnd(120, 3200) : (['assigned', 'scheduled', 'in_progress', 'on_hold'].indexOf(status) !== -1 && chance(0.5) ? irnd(150, 2800) : null);
    var wo = {
      id: 'wo-' + pad(woSeq, 4), number: 'WO-' + pad(woSeq, 5), unit_id: lease.unit_id, property_id: lease.property_id,
      property_name: lease.property_name, unit_no: unit ? unit.unit_no : '', tenant_id: lease.tenant_id,
      category: cat, priority: prio, title: pick(WO_TITLES[cat]),
      description: 'Reported by resident. ' + pick(['Please attend at earliest.', 'Issue started yesterday.', 'Recurring problem.', 'Needs urgent attention.', 'Convenient time: evenings.']),
      status: status, vendor_id: vendor ? vendor.id : null, assigned_by: vendor ? pick(MANAGERS).id : null,
      raised_by: chance(0.8) ? 'tenant' : 'pm', sla_hours: slaH, reported_at: reportedAt,
      sla_deadline: dayISO(reportedOffset + slaH / 24),
      assigned_at: vendor ? dayISO(reportedOffset + rnd(0.1, 1)) : null,
      resolved_at: closed ? dayISO(reportedOffset + (chance(0.85) ? rnd(0.2, slaDays * 0.85) : slaDays + rnd(0.3, 3))) : null,
      cost_aed: cost, approval_needed: (cost || 0) > SETTINGS.landlord_approval_threshold_aed,
      approval_status: (cost || 0) > SETTINGS.landlord_approval_threshold_aed ? pick(['pending', 'approved']) : 'not_required',
      tenant_rating: status === 'verified' || status === 'closed' ? irnd(3, 5) : null,
      photos: chance(0.5) ? [{ id: 'ph-' + woSeq + '-1', seed: irnd(1, 9999), caption: 'Reported issue' }] : [],
      notes: closed ? pick(['Replaced faulty part.', 'Cleared blockage, tested OK.', 'Re-wired and verified.', 'Serviced and cleaned.']) : ''
    };
    WORK_ORDERS.push(wo);
  }

  // ===================== BOOKINGS + VISITORS =====================
  var BOOKINGS = [], bkSeq = 0, VISITORS = [], vsSeq = 0;
  var activeTenants = TENANTS.filter(function (t) { return t.current_lease_id; });
  for (var b = 0; b < 40; b++) {
    bkSeq++;
    var t = pick(activeTenants);
    var u2 = UNITS.filter(function (x) { return x.id === t.current_unit_id; })[0];
    var propAmens = AMENITIES.filter(function (a) { return a.property_id === (u2 && u2.property_id); });
    if (!propAmens.length) continue;
    var am = pick(propAmens);
    var dayOff = irnd(-5, 12);
    var startH = irnd(6, 20);
    BOOKINGS.push({
      id: 'bk-' + pad(bkSeq, 4), amenity_id: am.id, amenity_name: am.name, property_id: am.property_id,
      unit_id: t.current_unit_id, tenant_id: t.id, date: dateOnly(dayOff),
      slot_start: pad(startH, 2) + ':00', slot_end: pad(startH + (am.slot_minutes / 60), 2) + ':00',
      party_size: irnd(1, 6), status: dayOff < 0 ? 'completed' : pick(['confirmed', 'confirmed', 'requested']), created_at: dayISO(dayOff - 1)
    });
  }
  for (var v = 0; v < 30; v++) {
    vsSeq++;
    var t2 = pick(activeTenants);
    var vOff = irnd(-4, 6);
    VISITORS.push({
      id: 'vis-' + pad(vsSeq, 4), unit_id: t2.current_unit_id, tenant_id: t2.id,
      property_id: (UNITS.filter(function (x) { return x.id === t2.current_unit_id; })[0] || {}).property_id,
      visitor_name: fullName(), purpose: pick(['guest', 'delivery', 'contractor', 'ride_hail', 'cleaner']),
      vehicle_plate: chance(0.6) ? ('DXB ' + pick(['A', 'B', 'C', 'F', 'K']) + ' ' + irnd(1000, 99999)) : null,
      expected_at: dayISO(vOff), valid_until: dayISO(vOff + 1),
      status: vOff < -1 ? 'checked_out' : vOff < 0 ? 'checked_in' : 'expected',
      pass_code: 'VP-' + irnd(1000, 9999), approved_by: chance(0.5) ? 'auto' : pick(MANAGERS).id
    });
  }

  // ===================== TICKETS + THREADS =====================
  var TICKETS = [], tkSeq = 0, THREADS = [], MESSAGES = [], thSeq = 0, msgSeq = 0;
  var TICKET_SUBJECTS = ['Question about my rent invoice', 'Request copy of tenancy contract', 'Noise complaint from neighbour', 'Parking access not working', 'Cooling charges query', 'Move-out process question', 'Gym access card issue', 'Water bill clarification'];
  for (var tk = 0; tk < 34; tk++) {
    tkSeq++;
    var tt = pick(activeTenants);
    var st = pick(['open', 'open', 'in_progress', 'waiting', 'resolved', 'closed']);
    THREADS.push({ id: 'thr-' + pad(thSeq + 1, 3), scope: 'ticket', ticket_id: 'tkt-' + pad(tkSeq, 4), participants: [tt.id, CURRENT_MANAGER.id] });
    thSeq++;
    var openedOff = -irnd(0, 30);
    TICKETS.push({
      id: 'tkt-' + pad(tkSeq, 4), number: 'TKT-' + pad(tkSeq, 5), subject: pick(TICKET_SUBJECTS),
      category: pick(['billing', 'lease', 'complaint', 'amenity', 'access', 'general']), priority: pick(['high', 'medium', 'medium', 'low']),
      status: st, opened_by: tt.id, opened_role: 'tenant', unit_id: tt.current_unit_id,
      assigned_to: st === 'open' ? null : pick(MANAGERS).id, thread_id: 'thr-' + pad(thSeq, 3),
      opened_at: dayISO(openedOff), resolved_at: (st === 'resolved' || st === 'closed') ? dayISO(openedOff + rnd(0.5, 4)) : null
    });
    msgSeq++;
    MESSAGES.push({ id: 'msg-' + pad(msgSeq, 5), thread_id: 'thr-' + pad(thSeq, 3), sender_id: tt.id, sender_role: 'tenant', body: 'Hi, ' + pick(['could you help with this?', 'please advise.', 'when can this be resolved?']), sent_at: dayISO(openedOff), read: st !== 'open' });
    if (st !== 'open') {
      msgSeq++;
      MESSAGES.push({ id: 'msg-' + pad(msgSeq, 5), thread_id: 'thr-' + pad(thSeq, 3), sender_id: CURRENT_MANAGER.id, sender_role: 'pm', body: pick(['Thanks for reaching out — looking into it now.', 'Noted, our team will follow up shortly.', 'This has been logged, we will update you.']), sent_at: dayISO(openedOff + 0.2), read: true });
    }
  }

  // ===================== INSPECTIONS =====================
  var INSPECTIONS = [], insSeq = 0;
  var ROOM_TEMPLATES = ['Entrance', 'Living Room', 'Kitchen', 'Master Bedroom', 'Bathroom', 'Balcony'];
  var ITEM_TEMPLATES = ['Walls & Paint', 'Flooring', 'Ceiling', 'Windows & Doors', 'Fixtures', 'Electrical points'];
  function buildRooms() {
    return ROOM_TEMPLATES.map(function (rn, ri) {
      return {
        id: 'room-' + ri, name: rn, order: ri,
        items: ITEM_TEMPLATES.map(function (it, ti) {
          var rated = chance(0.7);
          return { id: 'it-' + ri + '-' + ti, label: it, rating: rated ? irnd(3, 5) : null, baseline_rating: null, notes: '', action_required: false, cost_estimate: 0, photos: [] };
        })
      };
    });
  }
  for (var ins = 0; ins < 16; ins++) {
    insSeq++;
    var lz = pick(LEASES);
    var uz = UNITS.filter(function (x) { return x.id === lz.unit_id; })[0];
    var itype = pick(ENUMS.INSPECTION_TYPE);
    var istatus = pick(['assigned', 'assigned', 'in_progress', 'submitted', 'approved']);
    var schedOff = istatus === 'assigned' ? irnd(1, 10) : -irnd(0, 20);
    INSPECTIONS.push({
      id: 'insp-o-' + pad(insSeq, 3), ref: 'INS-' + pad(insSeq, 5), type: itype, status: istatus,
      property_id: lz.property_id, property_name: lz.property_name, unit_id: lz.unit_id, unit_no: uz ? uz.unit_no : '',
      lease_id: lz.id, tenant_id: lz.tenant_id, inspector_id: pick(INSPECTORS).id,
      scheduled_at: dayISO(schedOff), started_at: istatus !== 'assigned' ? dayISO(schedOff + 0.1) : null,
      submitted_at: (istatus === 'submitted' || istatus === 'approved') ? dayISO(schedOff + 0.3) : null,
      approved_at: istatus === 'approved' ? dayISO(schedOff + 1) : null,
      rooms: buildRooms(), overall_rating: (istatus === 'submitted' || istatus === 'approved') ? +rnd(3.4, 4.8).toFixed(1) : null,
      summary_notes: '', signatures: {}, report_ref: null
    });
  }

  // ===================== DOCUMENTS + NOTIFICATIONS =====================
  var DOCUMENTS = [], docSeq = 0;
  LEASES.slice(0, 60).forEach(function (l) {
    docSeq++;
    DOCUMENTS.push({ id: 'doc-' + pad(docSeq, 4), type: 'ejari_certificate', name: 'Ejari Certificate - ' + l.ejari_no + '.pdf', entity_type: 'lease', entity_id: l.id, tenant_id: l.tenant_id, owner_id: l.owner_id, size_kb: irnd(80, 260), uploaded_at: l.created_at });
    docSeq++;
    DOCUMENTS.push({ id: 'doc-' + pad(docSeq, 4), type: 'tenancy_contract', name: 'Tenancy Contract - ' + l.id + '.pdf', entity_type: 'lease', entity_id: l.id, tenant_id: l.tenant_id, owner_id: l.owner_id, size_kb: irnd(120, 420), uploaded_at: l.created_at });
  });

  var NOTIFICATIONS = [];

  window.PM_DATA = {
    ENUMS: ENUMS, SETTINGS: SETTINGS, SLA_HOURS: SLA_HOURS, AMENITY_CATALOG: AMENITY_CATALOG,
    COMMUNITIES: COMMUNITIES, PROPERTIES: PROPERTIES, UNITS: UNITS, AMENITIES: AMENITIES,
    OWNERS: OWNERS, TENANTS: TENANTS, MANAGERS: MANAGERS, VENDORS: VENDORS, INSPECTORS: INSPECTORS,
    LEASES: LEASES, INVOICES: INVOICES, PAYMENTS: PAYMENTS, DEPOSITS: DEPOSITS,
    WORK_ORDERS: WORK_ORDERS, BOOKINGS: BOOKINGS, VISITORS: VISITORS,
    TICKETS: TICKETS, THREADS: THREADS, MESSAGES: MESSAGES,
    INSPECTIONS: INSPECTIONS, DOCUMENTS: DOCUMENTS, NOTIFICATIONS: NOTIFICATIONS,
    CURRENT_MANAGER: CURRENT_MANAGER,
    ROOM_TEMPLATES: ROOM_TEMPLATES, ITEM_TEMPLATES: ITEM_TEMPLATES
  };
})();
