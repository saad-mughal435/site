/* data.js - Watad seed data
   Boulevard Tower B, Downtown Dubai (fictional). 4 floors × ~6 zones,
   ~50 assets, ~200 telemetry points, 30 alarms, 15 work orders. */
(function () {
  'use strict';

  function pp(id) { return 'https://images.unsplash.com/photo-' + id + '?w=120&q=80&auto=format&fit=crop&crop=faces'; }
  function isoAgo(minutes) { return new Date(Date.now() - minutes * 60000).toISOString(); }

  // ===================== BUILDING + FLOORS =====================
  var BUILDING = {
    id: 'bld-1',
    name: 'Boulevard Tower B',
    address: 'Boulevard Plaza, Downtown Dubai',
    area_sqft: 220000,
    lat: 25.197197, lng: 55.274376,
    occupancy_target: 1800,
    construction_year: 2018
  };

  var FLOORS = [
    { id: 'fl-roof', building_id: 'bld-1', level: 99, name: 'Roof / MEP', area_sqft: 14000 },
    { id: 'fl-l2',   building_id: 'bld-1', level: 2,  name: 'Level 2',    area_sqft: 62000 },
    { id: 'fl-l1',   building_id: 'bld-1', level: 1,  name: 'Level 1',    area_sqft: 62000 },
    { id: 'fl-gnd',  building_id: 'bld-1', level: 0,  name: 'Ground',     area_sqft: 32000 }
  ];

  // ===================== ZONES =====================
  // 6-8 zones per office floor, named after a tenant or function.
  var ZONES = [];
  // Ground (4 zones)
  ['Main Lobby', 'Café & Retail', 'Reception', 'Parking Entry'].forEach(function (n, i) {
    ZONES.push({ id: 'zn-gnd-' + (i + 1), floor_id: 'fl-gnd', name: n, area_sqft: [9000, 4500, 3500, 15000][i], schedule_id: 'sch-public' });
  });
  // L1 (8 zones)
  ['Acme Capital · East', 'Acme Capital · West', 'Nour Legal', 'Khaleej Consulting', 'Open Office', 'Boardroom Suite', 'Pantry & Break', 'Server Room'].forEach(function (n, i) {
    ZONES.push({ id: 'zn-l1-' + (i + 1), floor_id: 'fl-l1', name: n, area_sqft: [8000, 8000, 6500, 5500, 12000, 4500, 3500, 1500][i], schedule_id: i === 7 ? 'sch-24x7' : 'sch-business' });
  });
  // L2 (8 zones)
  ['Mirage Studios', 'Liwa Analytics', 'Burj Equities', 'Saif Trading', 'Open Office', 'Training Suite', 'Pantry & Break', 'IT Closet'].forEach(function (n, i) {
    ZONES.push({ id: 'zn-l2-' + (i + 1), floor_id: 'fl-l2', name: n, area_sqft: [7000, 7500, 6800, 6200, 13000, 5500, 3500, 1200][i], schedule_id: i === 7 ? 'sch-24x7' : 'sch-business' });
  });
  // Roof (4 zones)
  ['Chiller Plant', 'Cooling Tower Deck', 'AHU Plant Room', 'Electrical Room'].forEach(function (n, i) {
    ZONES.push({ id: 'zn-roof-' + (i + 1), floor_id: 'fl-roof', name: n, area_sqft: [3500, 4500, 3000, 1500][i], schedule_id: 'sch-24x7' });
  });

  // ===================== SCHEDULES =====================
  var SCHEDULES = [
    { id: 'sch-business', name: 'Business hours (Sun–Thu)', mon: [['07:00','19:00']], tue: [['07:00','19:00']], wed: [['07:00','19:00']], thu: [['07:00','19:00']], fri: [], sat: [], sun: [['07:00','19:00']] },
    { id: 'sch-public',   name: 'Public spaces (Sat–Thu)',  mon: [['06:00','22:00']], tue: [['06:00','22:00']], wed: [['06:00','22:00']], thu: [['06:00','22:00']], fri: [['14:00','22:00']], sat: [['08:00','22:00']], sun: [['06:00','22:00']] },
    { id: 'sch-24x7',     name: '24x7 (critical zones)',    mon: [['00:00','24:00']], tue: [['00:00','24:00']], wed: [['00:00','24:00']], thu: [['00:00','24:00']], fri: [['00:00','24:00']], sat: [['00:00','24:00']], sun: [['00:00','24:00']] },
    { id: 'sch-cleaning', name: 'After-hours cleaning',     mon: [['19:00','22:00']], tue: [['19:00','22:00']], wed: [['19:00','22:00']], thu: [['19:00','22:00']], fri: [], sat: [], sun: [['19:00','22:00']] }
  ];

  // ===================== ASSETS =====================
  // Coordinates are absolute pixels on a 900×540 floor canvas. Each floor has
  // its own coordinate system. Walls are drawn by the SVG background, equipment
  // overlays at these positions.
  var ASSETS = [];
  function addAsset(spec) { ASSETS.push(spec); }

  // ---------- Roof ----------
  addAsset({ id: 'as-chiller-1', type: 'chiller', name: 'CH-1 · 250 TR', floor_id: 'fl-roof', zone_id: 'zn-roof-1', x: 180, y: 200, model: 'Trane RTAC 250', firmware: '4.2.1', install_date: '2018-09-12', controller_id: 'ctrl-bacnet-1', rated_kw: 175 });
  addAsset({ id: 'as-chiller-2', type: 'chiller', name: 'CH-2 · 250 TR', floor_id: 'fl-roof', zone_id: 'zn-roof-1', x: 320, y: 200, model: 'Trane RTAC 250', firmware: '4.2.1', install_date: '2018-09-12', controller_id: 'ctrl-bacnet-1', rated_kw: 175 });
  addAsset({ id: 'as-ct-1',      type: 'cooling-tower', name: 'CT-1', floor_id: 'fl-roof', zone_id: 'zn-roof-2', x: 480, y: 180, model: 'BAC VTL-475', firmware: '—', install_date: '2018-09-12', controller_id: 'ctrl-bacnet-1', rated_kw: 30 });
  addAsset({ id: 'as-ct-2',      type: 'cooling-tower', name: 'CT-2', floor_id: 'fl-roof', zone_id: 'zn-roof-2', x: 600, y: 180, model: 'BAC VTL-475', firmware: '—', install_date: '2018-09-12', controller_id: 'ctrl-bacnet-1', rated_kw: 30 });
  addAsset({ id: 'as-ahu-roof',  type: 'ahu',     name: 'AHU-R · Penthouse', floor_id: 'fl-roof', zone_id: 'zn-roof-3', x: 720, y: 340, model: 'Daikin Vento 20', firmware: '3.1.0', install_date: '2018-10-04', controller_id: 'ctrl-bacnet-1', rated_kw: 25 });
  addAsset({ id: 'as-meter-main', type: 'meter',  name: 'Main kWh Meter', floor_id: 'fl-roof', zone_id: 'zn-roof-4', x: 820, y: 380, model: 'Schneider ION9000', firmware: '5.2', install_date: '2018-09-12', controller_id: 'ctrl-modbus-1' });
  addAsset({ id: 'as-meter-chiller', type: 'meter', name: 'Chiller Plant kWh', floor_id: 'fl-roof', zone_id: 'zn-roof-4', x: 820, y: 440, model: 'Schneider PM5100', firmware: '4.1', install_date: '2018-09-12', controller_id: 'ctrl-modbus-1' });

  // ---------- Level 2 ----------
  addAsset({ id: 'as-ahu-l2',  type: 'ahu', name: 'AHU-L2 · Main', floor_id: 'fl-l2', zone_id: 'zn-l2-1', x: 100, y: 100, model: 'Daikin Vento 16', firmware: '3.1.0', install_date: '2018-10-08', controller_id: 'ctrl-bacnet-2', rated_kw: 18 });
  // 8 FCUs spread across the 8 zones
  var l2_fcu_coords = [[200, 160], [380, 160], [560, 160], [740, 160], [200, 320], [380, 320], [560, 380], [740, 380]];
  l2_fcu_coords.forEach(function (p, i) {
    addAsset({ id: 'as-fcu-l2-' + (i + 1), type: 'fcu', name: 'FCU-L2-' + String(i + 1).padStart(2, '0'), floor_id: 'fl-l2', zone_id: 'zn-l2-' + (i + 1), x: p[0], y: p[1], model: 'Carrier 42CE', firmware: '2.4', install_date: '2018-10-15', controller_id: 'ctrl-bacnet-2', rated_kw: 1.8 });
  });
  // 3 lighting circuits on L2
  addAsset({ id: 'as-light-l2-east', type: 'light', name: 'LTG-L2-East', floor_id: 'fl-l2', zone_id: 'zn-l2-5', x: 280, y: 420, model: 'Lutron Quantum', firmware: '6.0', install_date: '2018-10-22', controller_id: 'ctrl-dali-1', rated_kw: 6.5 });
  addAsset({ id: 'as-light-l2-west', type: 'light', name: 'LTG-L2-West', floor_id: 'fl-l2', zone_id: 'zn-l2-5', x: 460, y: 420, model: 'Lutron Quantum', firmware: '6.0', install_date: '2018-10-22', controller_id: 'ctrl-dali-1', rated_kw: 6.0 });
  addAsset({ id: 'as-light-l2-pant', type: 'light', name: 'LTG-L2-Pantry', floor_id: 'fl-l2', zone_id: 'zn-l2-7', x: 640, y: 460, model: 'Lutron Quantum', firmware: '6.0', install_date: '2018-10-22', controller_id: 'ctrl-dali-1', rated_kw: 1.5 });
  // 2 sub-meters on L2
  addAsset({ id: 'as-meter-l2-tenant',  type: 'meter', name: 'L2 Tenant kWh',     floor_id: 'fl-l2', zone_id: 'zn-l2-8', x: 840, y: 460, model: 'Schneider PM2200', firmware: '3.2', install_date: '2018-10-30', controller_id: 'ctrl-modbus-1' });
  addAsset({ id: 'as-meter-l2-hvac',    type: 'meter', name: 'L2 HVAC kWh',       floor_id: 'fl-l2', zone_id: 'zn-l2-8', x: 840, y: 500, model: 'Schneider PM2200', firmware: '3.2', install_date: '2018-10-30', controller_id: 'ctrl-modbus-1' });
  // 2 occupancy sensors on L2
  addAsset({ id: 'as-occ-l2-east', type: 'sensor-occ', name: 'Occ-L2-East', floor_id: 'fl-l2', zone_id: 'zn-l2-5', x: 300, y: 280, model: 'Steinel HF-360',  firmware: '1.1', install_date: '2018-11-02', controller_id: 'ctrl-bacnet-2' });
  addAsset({ id: 'as-occ-l2-west', type: 'sensor-occ', name: 'Occ-L2-West', floor_id: 'fl-l2', zone_id: 'zn-l2-5', x: 500, y: 280, model: 'Steinel HF-360',  firmware: '1.1', install_date: '2018-11-02', controller_id: 'ctrl-bacnet-2' });
  addAsset({ id: 'as-co2-l2-board', type: 'sensor-co2', name: 'CO₂-L2-Boardroom', floor_id: 'fl-l2', zone_id: 'zn-l2-6', x: 660, y: 280, model: 'Vaisala GMW90', firmware: '2.0', install_date: '2018-11-02', controller_id: 'ctrl-bacnet-2' });

  // ---------- Level 1 (mirrors L2 layout for clarity) ----------
  addAsset({ id: 'as-ahu-l1',  type: 'ahu', name: 'AHU-L1 · Main', floor_id: 'fl-l1', zone_id: 'zn-l1-1', x: 100, y: 100, model: 'Daikin Vento 16', firmware: '3.1.0', install_date: '2018-10-08', controller_id: 'ctrl-bacnet-2', rated_kw: 18 });
  var l1_fcu_coords = [[200, 160], [380, 160], [560, 160], [740, 160], [200, 320], [380, 320], [560, 380], [740, 380]];
  l1_fcu_coords.forEach(function (p, i) {
    addAsset({ id: 'as-fcu-l1-' + (i + 1), type: 'fcu', name: 'FCU-L1-' + String(i + 1).padStart(2, '0'), floor_id: 'fl-l1', zone_id: 'zn-l1-' + (i + 1), x: p[0], y: p[1], model: 'Carrier 42CE', firmware: '2.4', install_date: '2018-10-15', controller_id: 'ctrl-bacnet-2', rated_kw: 1.8 });
  });
  addAsset({ id: 'as-light-l1-east', type: 'light', name: 'LTG-L1-East', floor_id: 'fl-l1', zone_id: 'zn-l1-5', x: 280, y: 420, model: 'Lutron Quantum', firmware: '6.0', install_date: '2018-10-22', controller_id: 'ctrl-dali-1', rated_kw: 6.5 });
  addAsset({ id: 'as-light-l1-west', type: 'light', name: 'LTG-L1-West', floor_id: 'fl-l1', zone_id: 'zn-l1-5', x: 460, y: 420, model: 'Lutron Quantum', firmware: '6.0', install_date: '2018-10-22', controller_id: 'ctrl-dali-1', rated_kw: 6.0 });
  addAsset({ id: 'as-meter-l1-tenant', type: 'meter', name: 'L1 Tenant kWh', floor_id: 'fl-l1', zone_id: 'zn-l1-8', x: 840, y: 460, model: 'Schneider PM2200', firmware: '3.2', install_date: '2018-10-30', controller_id: 'ctrl-modbus-1' });
  addAsset({ id: 'as-meter-l1-hvac',   type: 'meter', name: 'L1 HVAC kWh',   floor_id: 'fl-l1', zone_id: 'zn-l1-8', x: 840, y: 500, model: 'Schneider PM2200', firmware: '3.2', install_date: '2018-10-30', controller_id: 'ctrl-modbus-1' });
  addAsset({ id: 'as-occ-l1-east', type: 'sensor-occ', name: 'Occ-L1-East', floor_id: 'fl-l1', zone_id: 'zn-l1-5', x: 300, y: 280, model: 'Steinel HF-360', firmware: '1.1', install_date: '2018-11-02', controller_id: 'ctrl-bacnet-2' });
  addAsset({ id: 'as-occ-l1-west', type: 'sensor-occ', name: 'Occ-L1-West', floor_id: 'fl-l1', zone_id: 'zn-l1-5', x: 500, y: 280, model: 'Steinel HF-360', firmware: '1.1', install_date: '2018-11-02', controller_id: 'ctrl-bacnet-2' });

  // ---------- Ground ----------
  addAsset({ id: 'as-ahu-gnd', type: 'ahu', name: 'AHU-G · Lobby', floor_id: 'fl-gnd', zone_id: 'zn-gnd-1', x: 120, y: 140, model: 'Daikin Vento 24', firmware: '3.1.0', install_date: '2018-10-08', controller_id: 'ctrl-bacnet-2', rated_kw: 28 });
  ['Lobby N', 'Lobby S', 'Café', 'Reception'].forEach(function (n, i) {
    addAsset({ id: 'as-fcu-gnd-' + (i + 1), type: 'fcu', name: 'FCU-G-' + String(i + 1).padStart(2, '0') + ' · ' + n, floor_id: 'fl-gnd', zone_id: 'zn-gnd-' + Math.ceil((i + 1) / 2), x: [260, 460, 620, 760][i], y: [200, 200, 280, 340][i], model: 'Carrier 42CE', firmware: '2.4', install_date: '2018-10-15', controller_id: 'ctrl-bacnet-2', rated_kw: 2.4 });
  });
  addAsset({ id: 'as-light-gnd-lobby', type: 'light', name: 'LTG-G-Lobby', floor_id: 'fl-gnd', zone_id: 'zn-gnd-1', x: 360, y: 420, model: 'Lutron Quantum', firmware: '6.0', install_date: '2018-10-22', controller_id: 'ctrl-dali-1', rated_kw: 8.0 });
  addAsset({ id: 'as-light-gnd-cafe',  type: 'light', name: 'LTG-G-Café',  floor_id: 'fl-gnd', zone_id: 'zn-gnd-2', x: 580, y: 420, model: 'Lutron Quantum', firmware: '6.0', install_date: '2018-10-22', controller_id: 'ctrl-dali-1', rated_kw: 4.5 });
  addAsset({ id: 'as-meter-gnd', type: 'meter', name: 'Ground kWh', floor_id: 'fl-gnd', zone_id: 'zn-gnd-4', x: 840, y: 460, model: 'Schneider PM2200', firmware: '3.2', install_date: '2018-10-30', controller_id: 'ctrl-modbus-1' });
  addAsset({ id: 'as-occ-gnd-lobby', type: 'sensor-occ', name: 'Occ-G-Lobby', floor_id: 'fl-gnd', zone_id: 'zn-gnd-1', x: 360, y: 320, model: 'Steinel HF-360', firmware: '1.1', install_date: '2018-11-02', controller_id: 'ctrl-bacnet-2' });

  // ===================== POINTS =====================
  // Each asset gets 2-6 telemetry points depending on type.
  var POINTS = [];
  function addPoint(p) { POINTS.push(p); }

  ASSETS.forEach(function (a) {
    if (a.type === 'chiller') {
      addPoint({ id: a.id + '.status',       asset_id: a.id, name: 'Run status',        kind: 'binary',    unit: '',     setpoint: null, hi_alarm: null, lo_alarm: null });
      addPoint({ id: a.id + '.chws',         asset_id: a.id, name: 'CHWS temp',         kind: 'analog',    unit: '°F',   setpoint: 44,   hi_alarm: 50,   lo_alarm: 38 });
      addPoint({ id: a.id + '.chwr',         asset_id: a.id, name: 'CHWR temp',         kind: 'analog',    unit: '°F',   setpoint: 54,   hi_alarm: 60,   lo_alarm: null });
      addPoint({ id: a.id + '.cond_temp',    asset_id: a.id, name: 'Condenser temp',    kind: 'analog',    unit: '°F',   setpoint: 85,   hi_alarm: 95,   lo_alarm: null });
      addPoint({ id: a.id + '.load',         asset_id: a.id, name: 'Load',              kind: 'analog',    unit: '%',    setpoint: null, hi_alarm: 95,   lo_alarm: null });
      addPoint({ id: a.id + '.power',        asset_id: a.id, name: 'Power',             kind: 'analog',    unit: 'kW',   setpoint: null, hi_alarm: 200,  lo_alarm: null });
    } else if (a.type === 'cooling-tower') {
      addPoint({ id: a.id + '.fan_speed',    asset_id: a.id, name: 'Fan speed',         kind: 'analog',    unit: '%',    setpoint: null, hi_alarm: null, lo_alarm: null });
      addPoint({ id: a.id + '.basin_temp',   asset_id: a.id, name: 'Basin temp',        kind: 'analog',    unit: '°F',   setpoint: 78,   hi_alarm: 88,   lo_alarm: null });
      addPoint({ id: a.id + '.makeup_flow',  asset_id: a.id, name: 'Makeup water flow', kind: 'analog',    unit: 'gpm',  setpoint: null, hi_alarm: null, lo_alarm: null });
    } else if (a.type === 'ahu') {
      addPoint({ id: a.id + '.status',       asset_id: a.id, name: 'Run status',        kind: 'binary',    unit: '',     setpoint: null, hi_alarm: null, lo_alarm: null });
      addPoint({ id: a.id + '.sat',          asset_id: a.id, name: 'Supply air temp',   kind: 'analog',    unit: '°F',   setpoint: 55,   hi_alarm: 65,   lo_alarm: 48 });
      addPoint({ id: a.id + '.rat',          asset_id: a.id, name: 'Return air temp',   kind: 'analog',    unit: '°F',   setpoint: null, hi_alarm: null, lo_alarm: null });
      addPoint({ id: a.id + '.filter_dp',    asset_id: a.id, name: 'Filter ΔP',         kind: 'analog',    unit: 'inWC', setpoint: null, hi_alarm: 1.5,  lo_alarm: null });
      addPoint({ id: a.id + '.fan_vfd',      asset_id: a.id, name: 'Fan VFD speed',     kind: 'analog',    unit: '%',    setpoint: null, hi_alarm: null, lo_alarm: null });
      addPoint({ id: a.id + '.power',        asset_id: a.id, name: 'Power',             kind: 'analog',    unit: 'kW',   setpoint: null, hi_alarm: a.rated_kw * 1.2, lo_alarm: null });
    } else if (a.type === 'fcu') {
      addPoint({ id: a.id + '.status',       asset_id: a.id, name: 'Run status',        kind: 'binary',    unit: '',     setpoint: null, hi_alarm: null, lo_alarm: null });
      addPoint({ id: a.id + '.zone_temp',    asset_id: a.id, name: 'Zone temp',         kind: 'analog',    unit: '°F',   setpoint: 72,   hi_alarm: 78,   lo_alarm: 66 });
      addPoint({ id: a.id + '.zone_sp',      asset_id: a.id, name: 'Zone setpoint',     kind: 'analog',    unit: '°F',   setpoint: 72,   hi_alarm: null, lo_alarm: null });
      addPoint({ id: a.id + '.valve',        asset_id: a.id, name: 'CHW valve',         kind: 'analog',    unit: '%',    setpoint: null, hi_alarm: null, lo_alarm: null });
    } else if (a.type === 'light') {
      addPoint({ id: a.id + '.status',       asset_id: a.id, name: 'On/Off',            kind: 'binary',    unit: '',     setpoint: null, hi_alarm: null, lo_alarm: null });
      addPoint({ id: a.id + '.level',        asset_id: a.id, name: 'Dim level',         kind: 'analog',    unit: '%',    setpoint: null, hi_alarm: null, lo_alarm: null });
      addPoint({ id: a.id + '.power',        asset_id: a.id, name: 'Power',             kind: 'analog',    unit: 'kW',   setpoint: null, hi_alarm: a.rated_kw * 1.1, lo_alarm: null });
    } else if (a.type === 'meter') {
      addPoint({ id: a.id + '.kw',           asset_id: a.id, name: 'Real power',        kind: 'analog',    unit: 'kW',   setpoint: null, hi_alarm: null, lo_alarm: null });
      addPoint({ id: a.id + '.kwh',          asset_id: a.id, name: 'kWh accumulator',   kind: 'analog',    unit: 'kWh',  setpoint: null, hi_alarm: null, lo_alarm: null });
      addPoint({ id: a.id + '.pf',           asset_id: a.id, name: 'Power factor',      kind: 'analog',    unit: '',     setpoint: null, hi_alarm: null, lo_alarm: 0.85 });
      addPoint({ id: a.id + '.voltage',      asset_id: a.id, name: 'Voltage',           kind: 'analog',    unit: 'V',    setpoint: null, hi_alarm: 420,  lo_alarm: 380 });
    } else if (a.type === 'sensor-occ') {
      addPoint({ id: a.id + '.presence',     asset_id: a.id, name: 'Presence',          kind: 'binary',    unit: '',     setpoint: null, hi_alarm: null, lo_alarm: null });
      addPoint({ id: a.id + '.count',        asset_id: a.id, name: 'People count',      kind: 'analog',    unit: 'ppl',  setpoint: null, hi_alarm: null, lo_alarm: null });
    } else if (a.type === 'sensor-co2') {
      addPoint({ id: a.id + '.co2',          asset_id: a.id, name: 'CO₂',               kind: 'analog',    unit: 'ppm',  setpoint: null, hi_alarm: 1000, lo_alarm: null });
    }
  });

  // ===================== STAFF =====================
  var STAFF = [
    { id: 'st-layla',  name: 'Layla Hassan',      role: 'admin',    photo: pp('1573497019940-1c28c88b4f3e'), online: true,  shift: 'day' },
    { id: 'st-rashid', name: 'Rashid Bin Hamad',  role: 'operator', photo: pp('1500648767791-00dcc994a43e'), online: true,  shift: 'day' },
    { id: 'st-amani',  name: 'Amani Khaled',      role: 'operator', photo: pp('1494790108377-be9c29b29330'), online: true,  shift: 'evening' },
    { id: 'st-omar',   name: 'Omar Al-Suwaidi',   role: 'tech',     photo: pp('1507003211169-0a1dd7228f2d'), online: false, shift: 'on-call' },
    { id: 'st-noura',  name: 'Noura Al-Falasi',   role: 'tech',     photo: pp('1438761681033-6461ffad8d80'), online: true,  shift: 'day' },
    { id: 'st-saif',   name: 'Saif Al-Nahyan',    role: 'tech',     photo: pp('1539571696357-5a69c17a67c6'), online: true,  shift: 'day' }
  ];

  // ===================== ALARMS =====================
  // 30 alarms across states: 8 active critical/urgent, 5 active warning,
  // 17 historical (acknowledged or cleared).
  var ALARMS = [];
  function addAlarm(spec) { ALARMS.push(spec); }
  var ALARM_ID = 1;
  function alarmId() { return 'al-' + String(ALARM_ID++).padStart(4, '0'); }

  // 8 active critical / urgent
  addAlarm({ id: alarmId(), asset_id: 'as-chiller-1', point_id: 'as-chiller-1.cond_temp', severity: 'urgent',   title: 'CH-1 condenser temp high (94.2°F)',  raised_at: isoAgo(8),   acknowledged_at: null, cleared_at: null });
  addAlarm({ id: alarmId(), asset_id: 'as-ahu-l2',    point_id: 'as-ahu-l2.filter_dp',     severity: 'warning',  title: 'AHU-L2 filter ΔP exceeded (1.62 inWC)', raised_at: isoAgo(14),  acknowledged_at: null, cleared_at: null });
  addAlarm({ id: alarmId(), asset_id: 'as-fcu-l2-3',  point_id: 'as-fcu-l2-3.zone_temp',  severity: 'warning',  title: 'L2-Nour Legal · zone temp drift (78.4°F)', raised_at: isoAgo(22),  acknowledged_at: null, cleared_at: null });
  addAlarm({ id: alarmId(), asset_id: 'as-co2-l2-board', point_id: 'as-co2-l2-board.co2', severity: 'urgent',  title: 'L2 Boardroom CO₂ over 1000 ppm', raised_at: isoAgo(6),   acknowledged_at: null, cleared_at: null });
  addAlarm({ id: alarmId(), asset_id: 'as-meter-main', point_id: 'as-meter-main.pf',      severity: 'warning',  title: 'Main meter power factor low (0.81)',  raised_at: isoAgo(45),  acknowledged_at: null, cleared_at: null });
  addAlarm({ id: alarmId(), asset_id: 'as-ct-1',      point_id: 'as-ct-1.basin_temp',     severity: 'critical', title: 'CT-1 basin temp critical (91°F)',    raised_at: isoAgo(3),   acknowledged_at: null, cleared_at: null });
  addAlarm({ id: alarmId(), asset_id: 'as-fcu-l1-7',  point_id: 'as-fcu-l1-7.zone_temp',  severity: 'warning',  title: 'L1 Pantry zone temp drift (79.1°F)',  raised_at: isoAgo(35),  acknowledged_at: null, cleared_at: null });
  addAlarm({ id: alarmId(), asset_id: 'as-chiller-2', point_id: 'as-chiller-2.status',    severity: 'urgent',   title: 'CH-2 trip — fault code F12',         raised_at: isoAgo(2),   acknowledged_at: null, cleared_at: null });

  // 5 active info / warning
  addAlarm({ id: alarmId(), asset_id: 'as-ahu-l1',    point_id: 'as-ahu-l1.filter_dp',    severity: 'info',     title: 'AHU-L1 filter approaching replacement window', raised_at: isoAgo(180), acknowledged_at: isoAgo(90),  cleared_at: null });
  addAlarm({ id: alarmId(), asset_id: 'as-ahu-gnd',   point_id: 'as-ahu-gnd.sat',         severity: 'info',     title: 'AHU-G supply air temp drift', raised_at: isoAgo(220), acknowledged_at: isoAgo(180), cleared_at: null });
  addAlarm({ id: alarmId(), asset_id: 'as-light-l2-east', point_id: 'as-light-l2-east.power', severity: 'info', title: 'L2 East lighting on after hours', raised_at: isoAgo(260), acknowledged_at: isoAgo(240), cleared_at: null });
  addAlarm({ id: alarmId(), asset_id: 'as-meter-chiller', point_id: 'as-meter-chiller.kw', severity: 'warning', title: 'Chiller plant kW high for outside conditions', raised_at: isoAgo(75), acknowledged_at: null, cleared_at: null });
  addAlarm({ id: alarmId(), asset_id: 'as-occ-l1-east',  point_id: 'as-occ-l1-east.presence', severity: 'info', title: 'L1 East occupancy after-hours detected', raised_at: isoAgo(110), acknowledged_at: isoAgo(95), cleared_at: null });

  // 17 historical (cleared)
  for (var h = 0; h < 17; h++) {
    var ageHrs = 1 + h;
    addAlarm({
      id: alarmId(),
      asset_id: pickAsset(h),
      point_id: null,
      severity: ['info','warning','urgent'][h % 3],
      title: ['CHWS deviation cleared', 'Filter ΔP cleared after replacement', 'Setpoint override cleared', 'Lighting after-hours cleared', 'Zone temp recovered', 'Occupancy after-hours cleared'][h % 6],
      raised_at: isoAgo(60 * ageHrs + 40),
      acknowledged_at: isoAgo(60 * ageHrs + 30),
      cleared_at: isoAgo(60 * ageHrs)
    });
  }
  function pickAsset(i) {
    var pool = ['as-chiller-1','as-ahu-l1','as-ahu-l2','as-fcu-l1-2','as-fcu-l2-4','as-ahu-gnd','as-light-l2-east'];
    return pool[i % pool.length];
  }

  // ===================== WORK ORDERS =====================
  var WORK_ORDERS = [];
  var WO_ID = 1001;
  function woNo() { return 'WO-' + (WO_ID++); }

  WORK_ORDERS.push({ id: 'wo-1', wo_no: woNo(), title: 'Replace CH-1 condenser fan motor bearing', asset_id: 'as-chiller-1', priority: 'urgent', assignee_id: 'st-omar', status: 'in-progress', created_at: isoAgo(120), due: isoAgo(-240), description: 'High condenser temp alarm correlates with bearing vibration. Order bearing kit 42-118 and schedule overnight.', parts: ['Bearing kit 42-118', 'Synthetic grease'], comments: [{ at: isoAgo(110), by: 'st-omar', body: 'Parts on order, ETA tomorrow 09:00.' }, { at: isoAgo(60), by: 'st-omar', body: 'Bearing kit received. Scheduled overnight.' }] });
  WORK_ORDERS.push({ id: 'wo-2', wo_no: woNo(), title: 'Replace AHU-L2 pre-filter set', asset_id: 'as-ahu-l2', priority: 'high', assignee_id: 'st-noura', status: 'open', created_at: isoAgo(30), due: isoAgo(-720), description: 'Filter ΔP above 1.5 inWC. Replace MERV-13 pre-filters (4×) and log baseline ΔP after.', parts: ['MERV-13 24x24x4 (×4)'], comments: [] });
  WORK_ORDERS.push({ id: 'wo-3', wo_no: woNo(), title: 'Investigate CT-1 basin temp critical', asset_id: 'as-ct-1', priority: 'urgent', assignee_id: 'st-saif', status: 'open', created_at: isoAgo(2), due: isoAgo(-60), description: 'Basin > 90°F — possible fan VFD fault or water level sensor drift. Inspect on site.', parts: [], comments: [] });
  WORK_ORDERS.push({ id: 'wo-4', wo_no: woNo(), title: 'L2 Boardroom CO₂ — verify ventilation valve', asset_id: 'as-co2-l2-board', priority: 'high', assignee_id: 'st-rashid', status: 'open', created_at: isoAgo(6), due: isoAgo(-180), description: 'CO₂ over 1000 ppm during meeting hours. Confirm OA damper modulating and FCU not in dead-band.', parts: [], comments: [] });
  WORK_ORDERS.push({ id: 'wo-5', wo_no: woNo(), title: 'PM — Chiller annual oil sample CH-2', asset_id: 'as-chiller-2', priority: 'med', assignee_id: 'st-omar', status: 'in-progress', created_at: isoAgo(60 * 6), due: isoAgo(-60 * 24), description: 'Annual oil sample for trending. Drop sample at Trane lab.', parts: ['Oil sample bottle ×2'], comments: [{ at: isoAgo(60 * 5), by: 'st-omar', body: 'Sample drawn, courier pickup tomorrow.' }] });
  WORK_ORDERS.push({ id: 'wo-6', wo_no: woNo(), title: 'PM — Replace AHU-L1 pre-filters', asset_id: 'as-ahu-l1', priority: 'med', assignee_id: 'st-noura', status: 'in-progress', created_at: isoAgo(60 * 24), due: isoAgo(-60 * 48), description: 'Scheduled quarterly filter change.', parts: ['MERV-13 24x24x4 (×4)'], comments: [] });
  WORK_ORDERS.push({ id: 'wo-7', wo_no: woNo(), title: 'Tighten L1 Lighting east contactor', asset_id: 'as-light-l1-east', priority: 'low', assignee_id: 'st-noura', status: 'open', created_at: isoAgo(60 * 8), due: isoAgo(-60 * 72), description: 'Slight overheating reported at panel. Tighten lugs and torque-mark.', parts: [], comments: [] });
  WORK_ORDERS.push({ id: 'wo-8', wo_no: woNo(), title: 'Recalibrate Occ-L2-East sensor', asset_id: 'as-occ-l2-east', priority: 'low', assignee_id: 'st-saif', status: 'open', created_at: isoAgo(60 * 14), due: isoAgo(-60 * 168), description: 'False-positives after-hours.', parts: [], comments: [] });
  WORK_ORDERS.push({ id: 'wo-9', wo_no: woNo(), title: 'Software update Schneider PM5100', asset_id: 'as-meter-chiller', priority: 'low', assignee_id: 'st-layla', status: 'in-progress', created_at: isoAgo(60 * 20), due: isoAgo(-60 * 96), description: 'Firmware 4.1 → 4.3 (security fixes). Schedule with vendor.', parts: [], comments: [{ at: isoAgo(60 * 18), by: 'st-layla', body: 'Vendor confirmed Saturday 02:00.' }] });
  WORK_ORDERS.push({ id: 'wo-10', wo_no: woNo(), title: 'PM — CT-1 water treatment cycle', asset_id: 'as-ct-1', priority: 'med', assignee_id: 'st-omar', status: 'in-progress', created_at: isoAgo(60 * 30), due: isoAgo(-60 * 24), description: 'Monthly cooling-tower water treatment service.', parts: ['Treatment chemicals'], comments: [] });
  // Completed
  WORK_ORDERS.push({ id: 'wo-11', wo_no: woNo(), title: 'Replace AHU-G belt', asset_id: 'as-ahu-gnd', priority: 'med', assignee_id: 'st-saif', status: 'completed', created_at: isoAgo(60 * 96), due: isoAgo(60 * 48), description: 'Worn belt — replaced with OEM part.', parts: ['V-belt A52'], comments: [{ at: isoAgo(60 * 50), by: 'st-saif', body: 'Belt replaced and tensioned. Logged.' }] });
  WORK_ORDERS.push({ id: 'wo-12', wo_no: woNo(), title: 'Replace FCU-L1-04 valve actuator', asset_id: 'as-fcu-l1-2', priority: 'med', assignee_id: 'st-noura', status: 'completed', created_at: isoAgo(60 * 168), due: isoAgo(60 * 120), description: 'Stuck actuator on FCU. Belimo replacement installed.', parts: ['Belimo TR24-3'], comments: [{ at: isoAgo(60 * 125), by: 'st-noura', body: 'Replaced and commissioned.' }] });
  WORK_ORDERS.push({ id: 'wo-13', wo_no: woNo(), title: 'Recommission lighting schedules — Ramadan hours', asset_id: 'as-light-gnd-lobby', priority: 'low', assignee_id: 'st-layla', status: 'completed', created_at: isoAgo(60 * 240), due: isoAgo(60 * 200), description: 'Adjust lobby lighting schedule for Ramadan operating hours.', parts: [], comments: [{ at: isoAgo(60 * 210), by: 'st-layla', body: 'Schedules pushed, verified next morning.' }] });
  WORK_ORDERS.push({ id: 'wo-14', wo_no: woNo(), title: 'Tag-out / lock-out training refresher', asset_id: null, priority: 'med', assignee_id: 'st-layla', status: 'completed', created_at: isoAgo(60 * 300), due: isoAgo(60 * 250), description: 'Annual LOTO refresher for technician team.', parts: [], comments: [{ at: isoAgo(60 * 260), by: 'st-layla', body: 'All techs signed off.' }] });
  WORK_ORDERS.push({ id: 'wo-15', wo_no: woNo(), title: 'BACnet IP — replace failed switch port', asset_id: null, priority: 'high', assignee_id: 'st-omar', status: 'completed', created_at: isoAgo(60 * 50), due: isoAgo(60 * 40), description: 'Port 14 on trunk-2 switch failed; replaced patch and tested all 87 devices.', parts: ['Cat6 patch 5m'], comments: [{ at: isoAgo(60 * 42), by: 'st-omar', body: 'All devices re-registered.' }] });

  // ===================== INTEGRATIONS =====================
  var INTEGRATIONS = [
    { id: 'int-bacnet',   name: 'BACnet IP Gateway',   status: 'connected',    connected_at: isoAgo(60 * 24 * 200), icon: '🔌', details: '3 trunks · 87 devices · 198 points' },
    { id: 'int-modbus',   name: 'Modbus TCP',          status: 'connected',    connected_at: isoAgo(60 * 24 * 200), icon: '⚡', details: '1 gateway · 12 devices · 48 points (meters)' },
    { id: 'int-dali',     name: 'DALI Lighting',       status: 'connected',    connected_at: isoAgo(60 * 24 * 200), icon: '💡', details: '1 router · 6 zones · 48 fixtures' },
    { id: 'int-mqtt',     name: 'MQTT Broker',         status: 'disconnected', connected_at: null, icon: '📡', details: 'Edge IoT broker for occupancy + air-quality sensors' },
    { id: 'int-maximo',   name: 'IBM Maximo CMMS',     status: 'connected',    connected_at: isoAgo(60 * 24 * 90),  icon: '🛠', details: 'Work orders sync, asset register' },
    { id: 'int-servicenow', name: 'ServiceNow',        status: 'disconnected', connected_at: null, icon: '🎫', details: 'Optional: tenant ticket integration' }
  ];

  // ===================== ENERGY HISTORY =====================
  // Per-meter daily kWh, last 30 days, synthesised at load.
  function rand(seed) { var x = Math.sin(seed) * 10000; return x - Math.floor(x); }
  var ENERGY_HISTORY = [];
  var meterAssets = ASSETS.filter(function (a) { return a.type === 'meter'; });
  for (var d = 29; d >= 0; d--) {
    var day = new Date(); day.setDate(day.getDate() - d); day.setHours(0,0,0,0);
    meterAssets.forEach(function (m, i) {
      var base = m.id === 'as-meter-main' ? 1800 : m.id === 'as-meter-chiller' ? 1100 : 280;
      var dayOfWeek = day.getDay();
      var weekendFactor = (dayOfWeek === 5 || dayOfWeek === 6) ? 0.55 : 1;
      var noise = 0.85 + rand(d * 7 + i) * 0.3;
      ENERGY_HISTORY.push({
        meter_id: m.id,
        date: day.toISOString().slice(0, 10),
        kwh: +(base * weekendFactor * noise).toFixed(1),
        peak_kw: +((base / 24) * (1.6 + rand(d * 13 + i) * 0.4)).toFixed(1)
      });
    });
  }

  // ===================== SETTINGS =====================
  var SETTINGS = {
    business_name: 'Boulevard Tower B · Facilities',
    address: 'Boulevard Plaza, Downtown Dubai',
    business_hours: 'Sun–Thu · 07:00–19:00 GST',
    timezone: 'Asia/Dubai',
    units: 'imperial',           // imperial (°F, inWC, gpm) or metric
    currency: 'AED',
    energy_tariff: 0.32,         // AED per kWh
    co2_factor: 0.4032,           // kgCO₂ per kWh (UAE grid average 2024)
    ashrae_band_low: 68,
    ashrae_band_high: 76,
    model: 'claude-haiku-4-5-20251001',
    temperature: 0.4,
    max_tokens: 600,
    cache_enabled: true,
    system_prompt: "You are Watad, an AI copilot for facilities operators of a commercial smart building. Be concise, technically precise, and always action-oriented. Lead with the action when relevant. Cite specific point values + units when explaining alarms.",
    audio_alarms: true
  };

  // ===================== EXPOSE =====================
  window.WATAD_DATA = {
    BUILDING: BUILDING,
    FLOORS: FLOORS,
    ZONES: ZONES,
    SCHEDULES: SCHEDULES,
    ASSETS: ASSETS,
    POINTS: POINTS,
    ALARMS: ALARMS,
    WORK_ORDERS: WORK_ORDERS,
    STAFF: STAFF,
    INTEGRATIONS: INTEGRATIONS,
    ENERGY_HISTORY: ENERGY_HISTORY,
    SETTINGS: SETTINGS
  };
})();
