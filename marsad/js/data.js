/* data.js - Marsad fleet dispatcher seed.
 *
 * Fictional last-mile courier business serving Dubai + Sharjah. Seed
 * generated from a deterministic RNG so first-paint maps are populated:
 *   - 1 distribution hub (Al Quoz Industrial 4)
 *   - 16 drivers across 3 shifts
 *   - 12 vans + 4 motorbikes
 *   - 6 service zones (Marina, JLT, Downtown, Business Bay, Deira, Sharjah Al Nahda)
 *   - 96 orders in mixed states (pending / assigned / picked-up / in-transit / delivered / failed)
 *   - 90-day delivery history per driver for analytics
 *
 * Coordinates are real lat/lng around Dubai so Leaflet draws something
 * recognisable. Customers, products, and driver names are fabricated. */
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
  var rand = mulberry32(20260521);
  function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }
  function isoAgo(min) { return new Date(Date.now() - min * 60000).toISOString(); }
  function nowIso() { return new Date().toISOString(); }

  // ===================== HUB + ZONES =====================
  // Hub: Al Quoz Industrial 4 (real coords). All routes radiate from here.
  var HUB = { id: 'hub-1', name: 'Al Quoz Industrial 4 · Distribution Hub', lat: 25.1340, lng: 55.2255 };

  var ZONES = [
    { id: 'zn-marina',    name: 'Dubai Marina',      lat: 25.0820, lng: 55.1410, color: '#22d3ee', sla_min: 90 },
    { id: 'zn-jlt',       name: 'JLT',               lat: 25.0700, lng: 55.1430, color: '#4ade80', sla_min: 90 },
    { id: 'zn-downtown',  name: 'Downtown',          lat: 25.1972, lng: 55.2744, color: '#a78bfa', sla_min: 60 },
    { id: 'zn-bb',        name: 'Business Bay',      lat: 25.1865, lng: 55.2700, color: '#fb923c', sla_min: 60 },
    { id: 'zn-deira',     name: 'Deira',             lat: 25.2700, lng: 55.3200, color: '#f472b6', sla_min: 120 },
    { id: 'zn-sharjah',   name: 'Sharjah · Al Nahda',lat: 25.3070, lng: 55.3700, color: '#facc15', sla_min: 150 }
  ];

  // ===================== STAFF / DRIVERS =====================
  var FIRST = ['Yusuf', 'Hassan', 'Imran', 'Khalid', 'Rashid', 'Adel', 'Tariq', 'Wael', 'Ziad', 'Anas', 'Karim', 'Bilal', 'Nasser', 'Fadi', 'Omar', 'Marwan'];
  var LAST  = ['Al-Mansouri', 'Bin Saif', 'Al-Rashid', 'Al-Falasi', 'Khan', 'Mughal', 'Hussain', 'Mahmood', 'Iqbal', 'Saleem', 'Yousaf', 'Latif'];
  var SHIFTS = ['day', 'evening', 'night'];

  var DRIVERS = [];
  for (var i = 0; i < 16; i++) {
    var fn = FIRST[i % FIRST.length];
    var ln = LAST[i % LAST.length];
    var rating = +(4.4 + rand() * 0.6).toFixed(2);     // 4.40-5.00
    var done90 = Math.floor(120 + rand() * 280);       // last-90-day deliveries
    DRIVERS.push({
      id: 'dr-' + String(i + 1).padStart(3, '0'),
      name: fn + ' ' + ln,
      phone: '+9715' + (10 + Math.floor(rand() * 90)) + Math.floor(rand() * 9000000),
      shift: SHIFTS[i % 3],
      vehicle_id: null,                               // assigned below
      rating: rating,
      done_90d: done90,
      on_time_pct: +(82 + rand() * 14).toFixed(1),
      status: i < 12 ? 'on_route' : i < 14 ? 'idle' : 'off_shift',
      online: i < 14,
      home_zone: ZONES[i % ZONES.length].id
    });
  }

  // ===================== VEHICLES =====================
  // 12 vans + 4 motorbikes. Each assigned to a driver (some idle/off-shift).
  var VEHICLES = [];
  for (var v = 0; v < 16; v++) {
    var type = v < 12 ? 'van' : 'bike';
    var capacity = type === 'van' ? 28 : 4;
    var vehicleId = 'veh-' + (type === 'van' ? 'V' : 'M') + String(v + 1).padStart(2, '0');
    var driverId = DRIVERS[v].id;
    DRIVERS[v].vehicle_id = vehicleId;
    // Position: drivers "on_route" are scattered across Dubai near their zones;
    // idle drivers cluster at the hub.
    var d = DRIVERS[v];
    var nearZone = ZONES.find(function (z) { return z.id === d.home_zone; }) || ZONES[0];
    var lat = (d.status === 'on_route')
      ? nearZone.lat + (rand() - 0.5) * 0.025
      : HUB.lat + (rand() - 0.5) * 0.004;
    var lng = (d.status === 'on_route')
      ? nearZone.lng + (rand() - 0.5) * 0.030
      : HUB.lng + (rand() - 0.5) * 0.004;
    VEHICLES.push({
      id: vehicleId,
      reg: 'DXB ' + (10000 + Math.floor(rand() * 89999)),
      type: type,
      capacity: capacity,
      driver_id: driverId,
      lat: lat,
      lng: lng,
      heading: Math.floor(rand() * 360),
      speed_kmh: d.status === 'on_route' ? Math.floor(20 + rand() * 35) : 0,
      fuel_pct: Math.floor(35 + rand() * 60),
      odo_km: Math.floor(45000 + rand() * 80000),
      last_ping: nowIso()
    });
  }

  // ===================== CUSTOMERS =====================
  var CUSTOMER_FIRST = ['Layla', 'Noura', 'Maryam', 'Sara', 'Hind', 'Aisha', 'Ali', 'Faisal', 'Sultan', 'Saif', 'Mohammed', 'Hamad', 'Mariam', 'Reem', 'Khalid', 'Ahmed'];
  var CUSTOMER_LAST  = ['Demo', 'Sample', 'Placeholder', 'Example', 'Test'];
  var CUSTOMERS = [];
  for (var c = 0; c < 24; c++) {
    var cf = CUSTOMER_FIRST[c % CUSTOMER_FIRST.length];
    var cl = CUSTOMER_LAST[c % CUSTOMER_LAST.length];
    CUSTOMERS.push({
      id: 'cu-' + String(c + 1).padStart(3, '0'),
      name: cf + ' ' + cl,
      phone: '+9715' + (50 + Math.floor(rand() * 9)) + Math.floor(rand() * 9000000),
      zone_id: ZONES[c % ZONES.length].id,
      orders_total: Math.floor(2 + rand() * 28)
    });
  }

  // ===================== ORDERS =====================
  // 96 orders in mixed states. Coordinates are around each zone's center
  // (clustered, so the map shows clear hotspots).
  var ORDER_STATUSES = ['pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'failed'];
  // Distribution: pending 12, assigned 18, picked_up 14, in_transit 20, delivered 28, failed 4 = 96
  var STATUS_DIST = [
    ['pending',    12],
    ['assigned',   18],
    ['picked_up',  14],
    ['in_transit', 20],
    ['delivered',  28],
    ['failed',      4]
  ];
  var PARCEL_KINDS = ['Small parcel', 'Document', 'Medium box', 'Cold-chain bag', 'Fragile box', 'Furniture (large)', 'Electronics'];

  var ORDERS = [];
  var orderSerial = 11000;
  STATUS_DIST.forEach(function (pair) {
    var status = pair[0];
    var count  = pair[1];
    for (var k = 0; k < count; k++) {
      var cust = CUSTOMERS[Math.floor(rand() * CUSTOMERS.length)];
      var zone = ZONES.find(function (z) { return z.id === cust.zone_id; });
      var lat = zone.lat + (rand() - 0.5) * 0.020;
      var lng = zone.lng + (rand() - 0.5) * 0.025;
      var placedAgo = Math.floor(rand() * 480);   // 0-8h ago
      var driver = null;
      if (status !== 'pending' && status !== 'failed') {
        // Pick an on_route driver
        driver = DRIVERS.filter(function (d) { return d.status === 'on_route'; })[Math.floor(rand() * 12)];
      }
      if (status === 'failed') {
        driver = DRIVERS[Math.floor(rand() * DRIVERS.length)];
      }
      var weight = +(0.2 + rand() * 14).toFixed(2);
      var slaDeadline = new Date(Date.now() - placedAgo * 60000 + zone.sla_min * 60000).toISOString();
      var slaBreached = (status === 'in_transit' || status === 'assigned' || status === 'pending')
        && new Date(slaDeadline) < new Date();
      ORDERS.push({
        id: 'or-' + String(orderSerial),
        number: 'MAR-' + String(orderSerial++),
        customer_id: cust.id,
        customer_name: cust.name,
        customer_phone: cust.phone,
        zone_id: zone.id,
        zone_name: zone.name,
        dropoff_lat: lat,
        dropoff_lng: lng,
        address: pseudoAddress(zone, lat, lng),
        kind: pick(PARCEL_KINDS),
        weight_kg: weight,
        cod_aed: rand() < 0.4 ? Math.floor(80 + rand() * 320) : 0,
        status: status,
        driver_id: driver ? driver.id : null,
        placed_at: isoAgo(placedAgo),
        sla_deadline: slaDeadline,
        sla_breached: slaBreached,
        delivered_at: status === 'delivered' ? isoAgo(Math.max(0, placedAgo - Math.floor(45 + rand() * 60))) : null,
        failed_reason: status === 'failed' ? pick(['Customer not home', 'Wrong address', 'Refused delivery', 'Damaged in transit']) : null,
        notes: rand() < 0.25 ? pick(['Leave with concierge', 'Call before delivery', 'Gift - please be quick', 'Apartment 2103']) : ''
      });
    }
  });

  // Sort by placed_at desc
  ORDERS.sort(function (a, b) { return new Date(b.placed_at) - new Date(a.placed_at); });

  function pseudoAddress(zone, lat, lng) {
    var buildings = ['Tower', 'Plaza', 'Heights', 'Residences', 'Avenue', 'Mall', 'Marina Walk', 'View'];
    var num = Math.floor(2 + rand() * 80);
    return num + ' ' + zone.name + ' ' + pick(buildings);
  }

  // ===================== 90-DAY ANALYTICS =====================
  // Per-day delivery count + average minutes-late, for the admin Analytics view.
  var ANALYTICS_HISTORY = [];
  var today = new Date(); today.setHours(0, 0, 0, 0);
  for (var d = 89; d >= 0; d--) {
    var day = new Date(today.getTime() - d * 86400000);
    var dow = day.getDay();
    var weekendFactor = (dow === 5 || dow === 6) ? 1.25 : 1;  // Fri-Sat busier in UAE
    var base = 80;
    var deliveries = Math.round(base * weekendFactor * (0.85 + rand() * 0.30));
    var failed = Math.round(deliveries * (0.02 + rand() * 0.04));
    var avg_min = +((22 + rand() * 18)).toFixed(1);
    var slaPct = +(85 + rand() * 12).toFixed(1);
    ANALYTICS_HISTORY.push({
      date: day.toISOString().slice(0, 10),
      day_label: day.toLocaleDateString('en', { weekday: 'short' }),
      deliveries: deliveries,
      failed: failed,
      avg_delivery_min: avg_min,
      on_time_pct: slaPct
    });
  }

  // ===================== INTEGRATIONS =====================
  var INTEGRATIONS = [
    { id: 'int-shopify',  name: 'Shopify',           status: 'connected',    connected_at: isoAgo(60 * 24 * 300), icon: '🛍',  details: 'Auto-pull new orders every 2 min · 1,420 orders YTD' },
    { id: 'int-trello',   name: 'Trello Boards',     status: 'connected',    connected_at: isoAgo(60 * 24 * 90),  icon: '📋', details: 'Mirror dispatcher board into Trello for ops oversight' },
    { id: 'int-twilio',   name: 'Twilio SMS',        status: 'connected',    connected_at: isoAgo(60 * 24 * 200), icon: '💬', details: 'Customer pickup + delivery notifications' },
    { id: 'int-googlemaps', name: 'Google Maps API', status: 'connected',    connected_at: isoAgo(60 * 24 * 200), icon: '🗺',  details: 'Route optimization · geocoding · ETA' },
    { id: 'int-stripe',   name: 'Stripe',            status: 'disconnected', connected_at: null,                  icon: '💳', details: 'Optional · COD reconciliation' },
    { id: 'int-quickbooks', name: 'QuickBooks',      status: 'disconnected', connected_at: null,                  icon: '📊', details: 'Optional · driver settlements + invoices' }
  ];

  // ===================== SETTINGS =====================
  var SETTINGS = {
    business_name: 'Marsad Logistics',
    hub_name: HUB.name,
    timezone: 'Asia/Dubai',
    currency: 'AED',
    sla_default_min: 90,
    cod_max_aed: 500,
    fuel_alert_pct: 25,
    rate_per_delivery_aed: 18,
    incentive_per_delivery_aed: 3,
    cod_commission_pct: 1.5,
    model: 'fast',
    temperature: 0.4,
    system_prompt: "You are Marsad, an AI dispatcher copilot for a last-mile courier in Dubai. Be concise, direct, and operational. Always lead with the action."
  };

  // ===================== EXPOSE =====================
  window.MARSAD_DATA = {
    HUB: HUB,
    ZONES: ZONES,
    DRIVERS: DRIVERS,
    VEHICLES: VEHICLES,
    CUSTOMERS: CUSTOMERS,
    ORDERS: ORDERS,
    ANALYTICS_HISTORY: ANALYTICS_HISTORY,
    INTEGRATIONS: INTEGRATIONS,
    SETTINGS: SETTINGS,
    ORDER_STATUSES: ORDER_STATUSES
  };
})();
