/* mock-api.js - Property Management fetch interceptor for
 * /property-management/api/*.
 *
 * The only module that persists state (localStorage `pm.*` deltas) and routes
 * requests. Reads PM_DATA seed, overlays deltas, calls PMEngine for all domain
 * rules, appends an audit trail and emits notifications on mutation. Returns a
 * synthetic Response so it never touches the network.
 *
 * CRITICAL: every parameterised regex route wraps the match assignment in
 * parens - the operator-precedence lesson carried over from the other demos. */
(function () {
  'use strict';
  if (!window.PM_DATA) { console.error('[mock] PM_DATA not loaded'); return; }
  if (!window.PMEngine) { console.error('[mock] PMEngine not loaded'); return; }
  var D = window.PM_DATA, E = window.PMEngine, S = D.SETTINGS;

  function jget(k, def) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? def : v; } catch (e) { return def; } }
  function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function uid(p) { return p + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }
  function nowIso() { return new Date().toISOString(); }

  // Seed-version guard: wipe stale pm.* deltas when the seed changes shape.
  (function () {
    var vk = 'pm.seed_version';
    if (localStorage.getItem(vk) !== S.seed_version) {
      Object.keys(localStorage).forEach(function (k) { if (k.indexOf('pm.') === 0) localStorage.removeItem(k); });
      try { localStorage.setItem(vk, S.seed_version); } catch (e) {}
    }
  })();

  // Generic delta store over a seed array.
  function mkStore(seedArr, name) {
    var kc = 'pm.' + name + '.created', ke = 'pm.' + name + '.edits', kd = 'pm.' + name + '.deleted';
    return {
      all: function () {
        var created = jget(kc, []), edits = jget(ke, {}), deleted = jget(kd, []);
        var dset = {}; deleted.forEach(function (id) { dset[id] = 1; });
        return seedArr.concat(created).filter(function (x) { return !dset[x.id]; })
          .map(function (x) { return edits[x.id] ? Object.assign({}, x, edits[x.id]) : x; });
      },
      get: function (id) { return this.all().filter(function (x) { return x.id === id; })[0]; },
      create: function (obj) { var c = jget(kc, []); c.unshift(obj); jset(kc, c); return obj; },
      update: function (id, patch) { var e = jget(ke, {}); e[id] = Object.assign({}, e[id] || {}, patch); jset(ke, e); return this.get(id); },
      remove: function (id) { var d = jget(kd, []); if (d.indexOf(id) < 0) { d.push(id); jset(kd, d); } }
    };
  }

  var store = {
    units: mkStore(D.UNITS, 'units'),
    leases: mkStore(D.LEASES, 'leases'),
    invoices: mkStore(D.INVOICES, 'invoices'),
    payments: mkStore(D.PAYMENTS, 'payments'),
    deposits: mkStore(D.DEPOSITS, 'deposits'),
    workorders: mkStore(D.WORK_ORDERS, 'workorders'),
    bookings: mkStore(D.BOOKINGS, 'bookings'),
    visitors: mkStore(D.VISITORS, 'visitors'),
    tickets: mkStore(D.TICKETS, 'tickets'),
    threads: mkStore(D.THREADS, 'threads'),
    messages: mkStore(D.MESSAGES, 'messages'),
    inspections: mkStore(D.INSPECTIONS, 'inspections'),
    documents: mkStore(D.DOCUMENTS, 'documents')
  };

  function audit(action, target, details) {
    var log = jget('pm.audit', []);
    log.unshift({ id: uid('a'), at: nowIso(), actor: 'system', action: action, target: target, details: details || '' });
    jset('pm.audit', log.slice(0, 250));
  }
  function notify(n) {
    var log = jget('pm.notifications', []);
    n.id = uid('ntf'); n.at = nowIso(); n.read = false;
    log.unshift(n);
    jset('pm.notifications', log.slice(0, 120));
    if (n.channels && n.channels.indexOf('email') !== -1) {
      var em = jget('pm.email_log', []);
      em.unshift({ id: uid('em'), to_role: n.audience_role, subject: n.title, body: n.body, at: n.at });
      jset('pm.email_log', em.slice(0, 120));
    }
    return n;
  }
  function notifications() { return jget('pm.notifications', []).concat(D.NOTIFICATIONS); }

  // ---------- lookups ----------
  function propName(id) { var p = D.PROPERTIES.filter(function (x) { return x.id === id; })[0]; return p ? p.name : ''; }
  function tenantName(id) { var t = D.TENANTS.filter(function (x) { return x.id === id; })[0]; return t ? t.name : ''; }
  function unitOf(id) { return store.units.get(id); }
  function vendorName(id) { var v = D.VENDORS.filter(function (x) { return x.id === id; })[0]; return v ? v.name : ''; }

  // ---------- derived / analytics ----------
  function occupancy(propId) {
    var units = store.units.all().filter(function (u) { return !propId || u.property_id === propId; });
    var occ = units.filter(function (u) { return u.status === 'occupied'; }).length;
    var total = units.length || 1;
    return { total: units.length, occupied: occ, vacant: units.filter(function (u) { return u.status === 'vacant'; }).length, notice: units.filter(function (u) { return u.status === 'notice'; }).length, pct: +(100 * occ / total).toFixed(1) };
  }
  function maintenanceStats(scope) {
    var wos = store.workorders.all();
    if (scope && scope.property_id) wos = wos.filter(function (w) { return w.property_id === scope.property_id; });
    if (scope && scope.vendor_id) wos = wos.filter(function (w) { return w.vendor_id === scope.vendor_id; });
    var open = wos.filter(function (w) { return ['submitted', 'triaged', 'assigned', 'scheduled', 'in_progress', 'on_hold'].indexOf(w.status) !== -1; });
    var resolved = wos.filter(function (w) { return ['completed', 'verified', 'closed'].indexOf(w.status) !== -1; });
    var breaches = open.filter(function (w) { return E.slaState(w).breached; }).length;
    var onTime = resolved.filter(function (w) { return !w.resolved_at || new Date(w.resolved_at).getTime() <= new Date(w.sla_deadline).getTime(); }).length;
    var byCat = {};
    wos.forEach(function (w) { byCat[w.category] = (byCat[w.category] || 0) + 1; });
    return { total: wos.length, open: open.length, in_progress: wos.filter(function (w) { return w.status === 'in_progress'; }).length, resolved: resolved.length, sla_breaches: breaches, sla_compliance: resolved.length ? +(100 * onTime / resolved.length).toFixed(1) : 100, by_category: byCat };
  }
  function roiFor(filter) {
    var units = store.units.all();
    if (filter && filter.owner_id) units = units.filter(function (u) { return u.owner_id === filter.owner_id; });
    if (filter && filter.property_id) units = units.filter(function (u) { return u.property_id === filter.property_id; });
    var leases = store.leases.all();
    return D.PROPERTIES.filter(function (p) { return units.some(function (u) { return u.property_id === p.id; }); }).map(function (p) {
      var pu = units.filter(function (u) { return u.property_id === p.id; });
      var val = pu.reduce(function (a, u) { return a + u.valuation_aed; }, 0);
      var rent = pu.reduce(function (a, u) {
        var l = leases.filter(function (x) { return x.unit_id === u.id && ['active', 'expiring', 'renewal_offered'].indexOf(x.status) !== -1; })[0];
        return a + (l ? l.annual_rent_aed : 0);
      }, 0);
      var expenses = rent * (S.mgmt_fee_pct / 100) + p.service_charge_aed_year;
      var noi = rent - expenses;
      var cmn = D.COMMUNITIES.filter(function (c) { return c.id === p.community_id; })[0] || {};
      return { property_id: p.id, name: p.name, valuation_aed: val, annual_rent_aed: rent, gross_yield_pct: val ? +(100 * rent / val).toFixed(1) : 0, net_yield_pct: val ? +(100 * noi / val).toFixed(1) : 0, noi_aed: noi, benchmark_pct: cmn.avg_yield_pct || 0 };
    });
  }
  function monthlySeries(months) {
    // synthetic-but-deterministic collection/occupancy trend for charts
    var out = [];
    var invs = store.invoices.all();
    for (var i = months - 1; i >= 0; i--) {
      var d = new Date(); d.setMonth(d.getMonth() - i);
      var lab = d.toLocaleString('en', { month: 'short' });
      var base = 70 + ((i * 7) % 18);
      out.push({ month: lab, collection_pct: Math.min(98, base + 8), occupancy_pct: 80 + ((i * 5) % 12), income: 900000 + (i % 6) * 40000, expense: 240000 + (i % 4) * 20000 });
    }
    return out;
  }

  // ---------- work-order helpers ----------
  function decorateWO(w) {
    var s = E.slaState(w);
    return Object.assign({}, w, { sla_breached: s.breached, sla_state: s.state, sla_mins_left: s.mins_left, vendor_name: w.vendor_id ? vendorName(w.vendor_id) : null, tenant_name: tenantName(w.tenant_id) });
  }
  function decorateInvoice(inv) {
    var st = E.invoiceStatus(inv);
    return Object.assign({}, inv, { status: st, outstanding_aed: E.invoiceOutstanding(inv), late_fee_aed: Math.round(E.lateFee(inv)), days_overdue: E.daysOverdue(inv) });
  }

  function applyWoTransition(wo, action, body, role) {
    var to = E.woTargetState(wo, action);
    if (!to || !E.woCanTransition(wo, action, role || 'manager')) return { ok: false, error: 'invalid_transition', status: 400 };
    var patch = { status: to };
    var t = tenantName(wo.tenant_id);
    if (action === 'assign' && body.vendor_id) { patch.vendor_id = body.vendor_id; patch.assigned_at = nowIso(); patch.assigned_by = body.by || D.CURRENT_MANAGER.id; }
    if (action === 'schedule' && body.scheduled_for) patch.scheduled_for = body.scheduled_for;
    if (action === 'complete') { patch.resolved_at = nowIso(); if (body.cost_aed != null) patch.cost_aed = +body.cost_aed; if (body.notes) patch.notes = body.notes; }
    if (action === 'hold' && body.reason) patch.hold_reason = body.reason;
    if (action === 'close') patch.resolved_at = wo.resolved_at || nowIso();
    if (body.cost_aed != null && action !== 'complete') { patch.cost_aed = +body.cost_aed; patch.approval_needed = +body.cost_aed > S.landlord_approval_threshold_aed; }
    store.workorders.update(wo.id, patch);
    audit('wo.' + action, wo.id, to);
    // notifications by transition
    var nmap = {
      triage: { role: 'tenant', title: 'Request under review', body: wo.number + ' is being triaged.', ch: ['bell'] },
      assign: { role: 'tenant', title: 'Technician assigned', body: wo.number + ' assigned to ' + (body.vendor_id ? vendorName(body.vendor_id) : 'a vendor') + '.', ch: ['bell', 'email'] },
      start: { role: 'tenant', title: 'Work started', body: 'Work has started on ' + wo.number + '.', ch: ['bell'] },
      complete: { role: 'tenant', title: 'Work completed', body: wo.number + ' completed - please rate it.', ch: ['toast', 'bell', 'email'] },
      verify: { role: 'manager', title: 'Work verified', body: wo.number + ' verified by resident.', ch: ['bell'] },
      close: { role: 'manager', title: 'Work order closed', body: wo.number + ' has been closed.', ch: ['bell'] }
    };
    if (nmap[action]) notify({ type: 'wo_' + action, kind: 'info', title: nmap[action].title, body: nmap[action].body, audience_role: nmap[action].role, audience_id: nmap[action].role === 'tenant' ? wo.tenant_id : null, channels: nmap[action].ch, entity_type: 'work_order', entity_id: wo.id });
    return { ok: true, work_order: decorateWO(store.workorders.get(wo.id)) };
  }

  // =====================================================================
  function handle(method, path, body, params) {
    var m;
    body = body || {}; params = params || {};

    // ----- meta -----
    if (path === '/settings' && method === 'GET') return { ok: true, settings: S };
    if (path === '/reset-demo' && method === 'POST') {
      Object.keys(localStorage).forEach(function (k) { if (k.indexOf('pm.') === 0 && k !== 'pm.seed_version') localStorage.removeItem(k); });
      return { ok: true };
    }

    // ----- reference -----
    if (path === '/communities' && method === 'GET') return { ok: true, items: D.COMMUNITIES };
    if (path === '/properties' && method === 'GET') {
      var props = D.PROPERTIES.slice();
      if (params.community_id) props = props.filter(function (p) { return p.community_id === params.community_id; });
      if (params.q) { var pq = params.q.toLowerCase(); props = props.filter(function (p) { return (p.name + p.community_name).toLowerCase().indexOf(pq) !== -1; }); }
      props = props.map(function (p) { var oc = occupancy(p.id); return Object.assign({}, p, { occupancy_pct: oc.pct, occupied: oc.occupied, vacant: oc.vacant }); });
      return { ok: true, items: props };
    }
    if ((m = path.match(/^\/properties\/([^\/]+)$/)) && method === 'GET') {
      var p = D.PROPERTIES.filter(function (x) { return x.id === m[1]; })[0];
      if (!p) return { ok: false, error: 'not_found', status: 404 };
      var pUnits = store.units.all().filter(function (u) { return u.property_id === p.id; });
      return { ok: true, property: Object.assign({}, p, { occupancy: occupancy(p.id) }), units: pUnits };
    }
    if (path === '/units' && method === 'GET') {
      var us = store.units.all();
      if (params.property_id) us = us.filter(function (u) { return u.property_id === params.property_id; });
      if (params.owner_id) us = us.filter(function (u) { return u.owner_id === params.owner_id; });
      if (params.status) us = us.filter(function (u) { return u.status === params.status; });
      if (params.q) { var uq = params.q.toLowerCase(); us = us.filter(function (u) { return (u.unit_no + u.property_name).toLowerCase().indexOf(uq) !== -1; }); }
      return { ok: true, items: us };
    }
    if ((m = path.match(/^\/units\/([^\/]+)$/)) && method === 'GET') {
      var u = store.units.get(m[1]); if (!u) return { ok: false, error: 'not_found', status: 404 };
      var lease = store.leases.all().filter(function (l) { return l.id === u.current_lease_id; })[0];
      var wos = store.workorders.all().filter(function (w) { return w.unit_id === u.id; }).map(decorateWO);
      return { ok: true, unit: u, lease: lease || null, work_orders: wos };
    }
    if ((m = path.match(/^\/units\/([^\/]+)\/assign$/)) && method === 'POST') {
      store.units.update(m[1], { status: 'occupied', current_tenant_id: body.tenant_id || null });
      audit('unit.assign', m[1], body.tenant_id || ''); return { ok: true };
    }
    if (path === '/amenities' && method === 'GET') {
      var am = D.AMENITIES.slice();
      if (params.property_id) am = am.filter(function (a) { return a.property_id === params.property_id; });
      return { ok: true, items: am };
    }

    // ----- people -----
    if (path === '/owners' && method === 'GET') return { ok: true, items: D.OWNERS };
    if ((m = path.match(/^\/owners\/([^\/]+)$/)) && method === 'GET') {
      var o = D.OWNERS.filter(function (x) { return x.id === m[1]; })[0]; if (!o) return { ok: false, status: 404, error: 'not_found' };
      var oUnits = store.units.all().filter(function (u) { return u.owner_id === o.id; });
      var oLeases = store.leases.all().filter(function (l) { return l.owner_id === o.id; });
      return { ok: true, owner: o, units: oUnits, leases: oLeases, roi: roiFor({ owner_id: o.id }) };
    }
    if (path === '/tenants' && method === 'GET') {
      var ts = D.TENANTS.slice();
      if (params.q) { var tq = params.q.toLowerCase(); ts = ts.filter(function (t) { return t.name.toLowerCase().indexOf(tq) !== -1; }); }
      return { ok: true, items: ts.map(function (t) { var u2 = store.units.get(t.current_unit_id) || {}; return Object.assign({}, t, { unit_no: u2.unit_no, property_name: u2.property_name }); }) };
    }
    if ((m = path.match(/^\/tenants\/([^\/]+)$/)) && method === 'GET') {
      var t = D.TENANTS.filter(function (x) { return x.id === m[1]; })[0]; if (!t) return { ok: false, status: 404, error: 'not_found' };
      var tl = store.leases.all().filter(function (l) { return l.tenant_id === t.id; })[0];
      var tinv = store.invoices.all().filter(function (iv) { return iv.tenant_id === t.id; }).map(decorateInvoice);
      var twos = store.workorders.all().filter(function (w) { return w.tenant_id === t.id; }).map(decorateWO);
      var ttk = store.tickets.all().filter(function (tk) { return tk.opened_by === t.id; });
      return { ok: true, tenant: t, lease: tl || null, unit: store.units.get(t.current_unit_id) || null, invoices: tinv, work_orders: twos, tickets: ttk };
    }
    if (path === '/managers' && method === 'GET') return { ok: true, items: D.MANAGERS };
    if (path === '/vendors' && method === 'GET') {
      var vs = D.VENDORS.slice();
      if (params.trade) vs = vs.filter(function (v) { return v.trades.indexOf(params.trade) !== -1; });
      return { ok: true, items: vs.map(function (v) { return Object.assign({}, v, { active_jobs: store.workorders.all().filter(function (w) { return w.vendor_id === v.id && ['assigned', 'scheduled', 'in_progress', 'on_hold'].indexOf(w.status) !== -1; }).length }); }) };
    }
    if ((m = path.match(/^\/vendors\/([^\/]+)$/)) && method === 'GET') {
      var v = D.VENDORS.filter(function (x) { return x.id === m[1]; })[0]; if (!v) return { ok: false, status: 404, error: 'not_found' };
      var vwos = store.workorders.all().filter(function (w) { return w.vendor_id === v.id; }).map(decorateWO);
      return { ok: true, vendor: v, work_orders: vwos, stats: maintenanceStats({ vendor_id: v.id }) };
    }
    if (path === '/inspectors' && method === 'GET') return { ok: true, items: D.INSPECTORS };

    // ----- leasing -----
    if (path === '/leases' && method === 'GET') {
      var ls = store.leases.all();
      if (params.status) ls = ls.filter(function (l) { return l.status === params.status; });
      if (params.property_id) ls = ls.filter(function (l) { return l.property_id === params.property_id; });
      if (params.tenant_id) ls = ls.filter(function (l) { return l.tenant_id === params.tenant_id; });
      if (params.owner_id) ls = ls.filter(function (l) { return l.owner_id === params.owner_id; });
      if (params.expiring_in_days) { var days = +params.expiring_in_days; ls = ls.filter(function (l) { var e = E.leaseExpiry(l); return e.days_to_end >= 0 && e.days_to_end <= days; }); }
      ls = ls.map(function (l) { return Object.assign({}, l, { tenant_name: tenantName(l.tenant_id), expiry: E.leaseExpiry(l) }); });
      return { ok: true, items: ls };
    }
    if ((m = path.match(/^\/leases\/([^\/]+)$/)) && method === 'GET') {
      var l = store.leases.get(m[1]); if (!l) return { ok: false, status: 404, error: 'not_found' };
      var linv = store.invoices.all().filter(function (iv) { return iv.lease_id === l.id; }).map(decorateInvoice);
      var ldoc = store.documents.all().filter(function (dc) { return dc.entity_id === l.id; });
      return { ok: true, lease: Object.assign({}, l, { tenant_name: tenantName(l.tenant_id), unit: store.units.get(l.unit_id), expiry: E.leaseExpiry(l) }), invoices: linv, documents: ldoc };
    }
    if ((m = path.match(/^\/leases\/([^\/]+)\/renew$/)) && method === 'POST') {
      var lr = store.leases.get(m[1]); if (!lr) return { ok: false, status: 404 };
      store.leases.update(lr.id, { status: 'renewed', annual_rent_aed: body.annual_rent_aed || lr.annual_rent_aed });
      audit('lease.renew', lr.id, ''); notify({ type: 'lease_renewal_due', kind: 'success', title: 'Lease renewed', body: 'Your lease has been renewed.', audience_role: 'tenant', audience_id: lr.tenant_id, channels: ['bell', 'email'], entity_type: 'lease', entity_id: lr.id });
      return { ok: true };
    }
    if ((m = path.match(/^\/leases\/([^\/]+)\/terminate$/)) && method === 'POST') {
      var lt = store.leases.get(m[1]); if (!lt) return { ok: false, status: 404 };
      store.leases.update(lt.id, { status: 'terminated' }); store.units.update(lt.unit_id, { status: 'vacant', current_lease_id: null, current_tenant_id: null });
      audit('lease.terminate', lt.id, body.reason || ''); return { ok: true };
    }

    // ----- billing -----
    if (path === '/invoices' && method === 'GET') {
      var invs = store.invoices.all();
      if (params.tenant_id) invs = invs.filter(function (iv) { return iv.tenant_id === params.tenant_id; });
      if (params.lease_id) invs = invs.filter(function (iv) { return iv.lease_id === params.lease_id; });
      if (params.property_id) invs = invs.filter(function (iv) { return iv.property_id === params.property_id; });
      if (params.owner_id) invs = invs.filter(function (iv) { return iv.owner_id === params.owner_id; });
      invs = invs.map(decorateInvoice);
      if (params.status) invs = invs.filter(function (iv) { return iv.status === params.status; });
      invs.sort(function (a, b) { return new Date(a.due_date) - new Date(b.due_date); });
      var totals = E.collectionStats(store.invoices.all().filter(function (iv) { return !params.tenant_id || iv.tenant_id === params.tenant_id; }));
      return { ok: true, items: invs, totals: totals };
    }
    if ((m = path.match(/^\/invoices\/([^\/]+)\/pay$/)) && method === 'POST') {
      var inv = store.invoices.get(m[1]); if (!inv) return { ok: false, status: 404 };
      var amt = body.amount_aed != null ? +body.amount_aed : E.invoiceOutstanding(inv);
      var paidNow = (inv.amount_paid_aed || 0) + amt;
      store.invoices.update(inv.id, { amount_paid_aed: paidNow, method: body.method || inv.method, status: paidNow >= inv.amount_aed ? 'paid' : 'partially_paid' });
      var pay = store.payments.create({ id: uid('pay'), invoice_id: inv.id, lease_id: inv.lease_id, tenant_id: inv.tenant_id, amount_aed: amt, method: body.method || inv.method, reference: body.reference || ('TXN' + Math.floor(Math.random() * 1e6)), status: 'cleared', paid_at: nowIso(), receipt_no: 'RCPT-' + new Date().getFullYear() + '-' + Math.floor(Math.random() * 1e5) });
      audit('invoice.pay', inv.id, E.aed(amt));
      notify({ type: 'rent_paid', kind: 'success', title: 'Payment received', body: 'Rent payment of ' + E.aed(amt) + ' received for ' + inv.number + '.', audience_role: 'tenant', audience_id: inv.tenant_id, channels: ['toast', 'bell', 'email'], entity_type: 'invoice', entity_id: inv.id });
      notify({ type: 'rent_paid', kind: 'info', title: 'Rent collected', body: tenantName(inv.tenant_id) + ' paid ' + E.aed(amt) + ' (' + inv.number + ').', audience_role: 'manager', channels: ['bell'], entity_type: 'invoice', entity_id: inv.id });
      return { ok: true, payment: pay, invoice: decorateInvoice(store.invoices.get(inv.id)) };
    }
    if (path === '/payments' && method === 'GET') {
      var pays = store.payments.all();
      if (params.tenant_id) pays = pays.filter(function (p2) { return p2.tenant_id === params.tenant_id; });
      if (params.lease_id) pays = pays.filter(function (p2) { return p2.lease_id === params.lease_id; });
      pays.sort(function (a, b) { return new Date(b.paid_at) - new Date(a.paid_at); });
      return { ok: true, items: pays };
    }

    // ----- maintenance -----
    if (path === '/work-orders' && method === 'GET') {
      var wos = store.workorders.all().map(decorateWO);
      if (params.tenant_id) wos = wos.filter(function (w) { return w.tenant_id === params.tenant_id; });
      if (params.vendor_id) wos = wos.filter(function (w) { return w.vendor_id === params.vendor_id; });
      if (params.property_id) wos = wos.filter(function (w) { return w.property_id === params.property_id; });
      if (params.status) wos = wos.filter(function (w) { return w.status === params.status; });
      if (params.priority) wos = wos.filter(function (w) { return w.priority === params.priority; });
      if (params.open === 'true') wos = wos.filter(function (w) { return ['submitted', 'triaged', 'assigned', 'scheduled', 'in_progress', 'on_hold'].indexOf(w.status) !== -1; });
      wos.sort(function (a, b) { return new Date(b.reported_at) - new Date(a.reported_at); });
      return { ok: true, items: wos };
    }
    if ((m = path.match(/^\/work-orders\/([^\/]+)$/)) && method === 'GET') {
      var w = store.workorders.get(m[1]); if (!w) return { ok: false, status: 404 };
      return { ok: true, work_order: decorateWO(w), unit: store.units.get(w.unit_id), tenant: D.TENANTS.filter(function (t) { return t.id === w.tenant_id; })[0], actions: { tenant: E.woActions(w, 'tenant'), manager: E.woActions(w, 'manager'), vendor: E.woActions(w, 'vendor') } };
    }
    if (path === '/work-orders' && method === 'POST') {
      var wSeq = 'WO-' + (10000 + store.workorders.all().length);
      var slaH = S.sla_hours[body.priority] || 48;
      var unit = store.units.get(body.unit_id) || {};
      var nw = store.workorders.create({
        id: uid('wo'), number: wSeq, unit_id: body.unit_id, property_id: unit.property_id, property_name: unit.property_name, unit_no: unit.unit_no,
        tenant_id: body.tenant_id, category: body.category || 'general', priority: body.priority || 'medium', title: body.title || 'Maintenance request',
        description: body.description || '', status: 'submitted', vendor_id: null, raised_by: body.raised_by || 'tenant', sla_hours: slaH,
        reported_at: nowIso(), sla_deadline: new Date(Date.now() + slaH * 3600000).toISOString(), assigned_at: null, resolved_at: null, cost_aed: null,
        approval_needed: false, approval_status: 'not_required', tenant_rating: null, photos: body.photos || [], notes: ''
      });
      audit('wo.create', nw.id, nw.title);
      notify({ type: 'wo_created', kind: 'info', title: 'New maintenance request', body: nw.number + ' - ' + nw.title + ' (' + E.label('priority', nw.priority) + ')', audience_role: 'manager', channels: ['toast', 'bell'], entity_type: 'work_order', entity_id: nw.id });
      return { ok: true, work_order: decorateWO(nw) };
    }
    if ((m = path.match(/^\/work-orders\/([^\/]+)\/transition$/)) && method === 'POST') {
      var wt = store.workorders.get(m[1]); if (!wt) return { ok: false, status: 404 };
      return applyWoTransition(wt, body.action, body, body.role || 'manager');
    }
    if ((m = path.match(/^\/work-orders\/([^\/]+)\/assign$/)) && method === 'POST') {
      var wa = store.workorders.get(m[1]); if (!wa) return { ok: false, status: 404 };
      if (wa.status === 'submitted') applyWoTransition(store.workorders.get(wa.id), 'triage', {}, 'manager');
      return applyWoTransition(store.workorders.get(wa.id), 'assign', body, 'manager');
    }
    if ((m = path.match(/^\/work-orders\/([^\/]+)\/rate$/)) && method === 'POST') {
      var wr = store.workorders.get(m[1]); if (!wr) return { ok: false, status: 404 };
      store.workorders.update(wr.id, { tenant_rating: +body.rating });
      audit('wo.rate', wr.id, body.rating + '★'); return { ok: true };
    }

    // ----- resident services -----
    if (path === '/bookings' && method === 'GET') {
      var bks = store.bookings.all();
      if (params.tenant_id) bks = bks.filter(function (b2) { return b2.tenant_id === params.tenant_id; });
      if (params.property_id) bks = bks.filter(function (b2) { return b2.property_id === params.property_id; });
      bks.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
      return { ok: true, items: bks };
    }
    if (path === '/bookings' && method === 'POST') {
      var am2 = D.AMENITIES.filter(function (a) { return a.id === body.amenity_id; })[0] || {};
      var nb = store.bookings.create({ id: uid('bk'), amenity_id: body.amenity_id, amenity_name: am2.name, property_id: am2.property_id, unit_id: body.unit_id, tenant_id: body.tenant_id, date: body.date, slot_start: body.slot_start, slot_end: body.slot_end, party_size: body.party_size || 1, status: 'confirmed', created_at: nowIso() });
      audit('booking.create', nb.id, am2.name);
      notify({ type: 'booking_confirmed', kind: 'success', title: 'Booking confirmed', body: am2.name + ' on ' + body.date + ' at ' + body.slot_start, audience_role: 'tenant', audience_id: body.tenant_id, channels: ['toast', 'bell'], entity_type: 'booking', entity_id: nb.id });
      return { ok: true, booking: nb };
    }
    if ((m = path.match(/^\/bookings\/([^\/]+)\/cancel$/)) && method === 'POST') { store.bookings.update(m[1], { status: 'cancelled' }); return { ok: true }; }
    if (path === '/visitors' && method === 'GET') {
      var vis = store.visitors.all();
      if (params.tenant_id) vis = vis.filter(function (x) { return x.tenant_id === params.tenant_id; });
      if (params.property_id) vis = vis.filter(function (x) { return x.property_id === params.property_id; });
      vis.sort(function (a, b) { return new Date(b.expected_at) - new Date(a.expected_at); });
      return { ok: true, items: vis };
    }
    if (path === '/visitors' && method === 'POST') {
      var u3 = store.units.get(body.unit_id) || {};
      var nv = store.visitors.create({ id: uid('vis'), unit_id: body.unit_id, tenant_id: body.tenant_id, property_id: u3.property_id, visitor_name: body.visitor_name, purpose: body.purpose || 'guest', vehicle_plate: body.vehicle_plate || null, expected_at: body.expected_at || nowIso(), valid_until: body.valid_until || new Date(Date.now() + 86400000).toISOString(), status: 'expected', pass_code: 'VP-' + Math.floor(1000 + Math.random() * 9000), approved_by: 'auto' });
      audit('visitor.create', nv.id, body.visitor_name);
      notify({ type: 'visitor_registered', kind: 'info', title: 'Visitor pass created', body: 'Pass ' + nv.pass_code + ' for ' + body.visitor_name, audience_role: 'tenant', audience_id: body.tenant_id, channels: ['toast', 'bell'], entity_type: 'visitor', entity_id: nv.id });
      return { ok: true, visitor: nv };
    }
    if ((m = path.match(/^\/visitors\/([^\/]+)\/revoke$/)) && method === 'POST') { store.visitors.update(m[1], { status: 'expired' }); return { ok: true }; }

    // ----- comms / tickets -----
    if (path === '/tickets' && method === 'GET') {
      var tks = store.tickets.all();
      if (params.opened_by) tks = tks.filter(function (tk) { return tk.opened_by === params.opened_by; });
      if (params.status) tks = tks.filter(function (tk) { return tk.status === params.status; });
      tks = tks.map(function (tk) { return Object.assign({}, tk, { opener_name: tenantName(tk.opened_by) }); });
      tks.sort(function (a, b) { return new Date(b.opened_at) - new Date(a.opened_at); });
      return { ok: true, items: tks };
    }
    if ((m = path.match(/^\/tickets\/([^\/]+)$/)) && method === 'GET') {
      var tk = store.tickets.get(m[1]); if (!tk) return { ok: false, status: 404 };
      var msgs = store.messages.all().filter(function (mm) { return mm.thread_id === tk.thread_id; }).sort(function (a, b) { return new Date(a.sent_at) - new Date(b.sent_at); });
      return { ok: true, ticket: Object.assign({}, tk, { opener_name: tenantName(tk.opened_by) }), messages: msgs };
    }
    if (path === '/tickets' && method === 'POST') {
      var thId = uid('thr');
      var ntk = store.tickets.create({ id: uid('tkt'), number: 'TKT-' + (10000 + store.tickets.all().length), subject: body.subject, category: body.category || 'general', priority: body.priority || 'medium', status: 'open', opened_by: body.opened_by, opened_role: body.opened_role || 'tenant', unit_id: body.unit_id || null, thread_id: thId, opened_at: nowIso(), resolved_at: null });
      store.messages.create({ id: uid('msg'), thread_id: thId, sender_id: body.opened_by, sender_role: body.opened_role || 'tenant', body: body.message || body.subject, sent_at: nowIso(), read: false });
      audit('ticket.create', ntk.id, body.subject);
      notify({ type: 'ticket_created', kind: 'info', title: 'New help-desk ticket', body: ntk.number + ' - ' + body.subject, audience_role: 'manager', channels: ['toast', 'bell'], entity_type: 'ticket', entity_id: ntk.id });
      return { ok: true, ticket: ntk };
    }
    if ((m = path.match(/^\/tickets\/([^\/]+)\/reply$/)) && method === 'POST') {
      var trk = store.tickets.get(m[1]); if (!trk) return { ok: false, status: 404 };
      store.messages.create({ id: uid('msg'), thread_id: trk.thread_id, sender_id: body.sender_id, sender_role: body.sender_role || 'pm', body: body.body, sent_at: nowIso(), read: false });
      if (body.sender_role === 'pm') { store.tickets.update(trk.id, { status: 'in_progress', assigned_to: body.sender_id }); notify({ type: 'ticket_reply', kind: 'info', title: 'Reply to your ticket', body: trk.number + ': ' + body.body.slice(0, 60), audience_role: 'tenant', audience_id: trk.opened_by, channels: ['bell', 'email'], entity_type: 'ticket', entity_id: trk.id }); }
      return { ok: true };
    }
    if ((m = path.match(/^\/tickets\/([^\/]+)\/transition$/)) && method === 'POST') {
      store.tickets.update(m[1], { status: body.status, resolved_at: (body.status === 'resolved' || body.status === 'closed') ? nowIso() : null });
      audit('ticket.' + body.status, m[1], ''); return { ok: true };
    }

    // ----- inspections -----
    if (path === '/inspections' && method === 'GET') {
      var insp = store.inspections.all();
      if (params.inspector_id) insp = insp.filter(function (x) { return x.inspector_id === params.inspector_id; });
      if (params.status) insp = insp.filter(function (x) { return x.status === params.status; });
      if (params.property_id) insp = insp.filter(function (x) { return x.property_id === params.property_id; });
      insp.sort(function (a, b) { return new Date(b.scheduled_at) - new Date(a.scheduled_at); });
      return { ok: true, items: insp };
    }
    if ((m = path.match(/^\/inspections\/([^\/]+)$/)) && method === 'GET') {
      var ip = store.inspections.get(m[1]); if (!ip) return { ok: false, status: 404 };
      return { ok: true, inspection: ip, deductions: E.depositDeductions(ip) };
    }
    if ((m = path.match(/^\/inspections\/([^\/]+)\/start$/)) && method === 'POST') { store.inspections.update(m[1], { status: 'in_progress', started_at: nowIso() }); return { ok: true }; }
    if ((m = path.match(/^\/inspections\/([^\/]+)\/save$/)) && method === 'POST') { store.inspections.update(m[1], { rooms: body.rooms, summary_notes: body.summary_notes || '' }); return { ok: true }; }
    if ((m = path.match(/^\/inspections\/([^\/]+)\/submit$/)) && method === 'POST') {
      var isp = store.inspections.get(m[1]); if (!isp) return { ok: false, status: 404 };
      var overall = E.inspectionOverall(body.rooms || isp.rooms);
      store.inspections.update(isp.id, { rooms: body.rooms || isp.rooms, status: 'submitted', submitted_at: nowIso(), overall_rating: overall, signatures: body.signatures || isp.signatures, report_ref: 'RPT-' + Math.floor(10000 + Math.random() * 89999) });
      audit('inspection.submit', isp.id, 'rating=' + overall);
      notify({ type: 'inspection_submitted', kind: 'info', title: 'Inspection submitted', body: (isp.ref) + ' submitted for review (' + overall + '★).', audience_role: 'manager', channels: ['bell'], entity_type: 'inspection', entity_id: isp.id });
      return { ok: true };
    }
    if ((m = path.match(/^\/inspections\/([^\/]+)\/approve$/)) && method === 'POST') { store.inspections.update(m[1], { status: 'approved', approved_at: nowIso() }); audit('inspection.approve', m[1], ''); return { ok: true }; }
    if ((m = path.match(/^\/inspections\/([^\/]+)\/return$/)) && method === 'POST') { store.inspections.update(m[1], { status: 'returned' }); return { ok: true }; }
    if (path === '/inspections' && method === 'POST') {
      var un = store.units.get(body.unit_id) || {};
      var ni = store.inspections.create({ id: uid('insp'), ref: 'INS-' + (10000 + store.inspections.all().length), type: body.type || 'periodic', status: 'assigned', property_id: un.property_id, property_name: un.property_name, unit_id: body.unit_id, unit_no: un.unit_no, lease_id: un.current_lease_id, tenant_id: un.current_tenant_id, inspector_id: body.inspector_id || D.INSPECTORS[0].id, scheduled_at: body.scheduled_at || nowIso(), started_at: null, submitted_at: null, approved_at: null, rooms: buildRoomsSeed(), overall_rating: null, summary_notes: '', signatures: {}, report_ref: null });
      audit('inspection.create', ni.id, ni.type); return { ok: true, inspection: ni };
    }

    // ----- documents -----
    if (path === '/documents' && method === 'GET') {
      var docs = store.documents.all();
      if (params.tenant_id) docs = docs.filter(function (d2) { return d2.tenant_id === params.tenant_id; });
      if (params.owner_id) docs = docs.filter(function (d2) { return d2.owner_id === params.owner_id; });
      if (params.type) docs = docs.filter(function (d2) { return d2.type === params.type; });
      return { ok: true, items: docs };
    }

    // ----- approvals -----
    if (path === '/approvals' && method === 'GET') {
      var items = [];
      store.workorders.all().filter(function (w) { return w.approval_needed && w.approval_status === 'pending'; }).forEach(function (w) {
        if (params.owner_id) { var un2 = store.units.get(w.unit_id); if (!un2 || un2.owner_id !== params.owner_id) return; }
        items.push({ kind: 'wo_cost', id: w.id, title: 'Approve ' + E.aed(w.cost_aed) + ' - ' + w.title, subtitle: w.property_name + ' · ' + w.unit_no, amount_aed: w.cost_aed, endpoint: '/work-orders/' + w.id + '/approve-cost' });
      });
      store.inspections.all().filter(function (x) { return x.status === 'submitted'; }).forEach(function (x) { items.push({ kind: 'inspection', id: x.id, title: 'Review inspection ' + x.ref, subtitle: x.property_name + ' · ' + x.unit_no, endpoint: '/inspections/' + x.id + '/approve' }); });
      store.bookings.all().filter(function (b3) { return b3.status === 'requested'; }).forEach(function (b3) { items.push({ kind: 'booking', id: b3.id, title: 'Amenity booking - ' + b3.amenity_name, subtitle: b3.date + ' ' + b3.slot_start, endpoint: '/bookings/' + b3.id + '/confirm' }); });
      return { ok: true, items: items };
    }
    if ((m = path.match(/^\/work-orders\/([^\/]+)\/approve-cost$/)) && method === 'POST') { store.workorders.update(m[1], { approval_status: body.decision === 'reject' ? 'rejected' : 'approved' }); audit('wo.cost_' + (body.decision || 'approve'), m[1], ''); return { ok: true }; }
    if ((m = path.match(/^\/bookings\/([^\/]+)\/confirm$/)) && method === 'POST') { store.bookings.update(m[1], { status: 'confirmed' }); return { ok: true }; }

    // ----- notifications -----
    if (path === '/notifications' && method === 'GET') {
      var ns = notifications();
      if (params.role) ns = ns.filter(function (n) { return !n.audience_role || n.audience_role === params.role; });
      if (params.id) ns = ns.filter(function (n) { return !n.audience_id || n.audience_id === params.id; });
      return { ok: true, items: ns.slice(0, 60), unread: ns.filter(function (n) { return !n.read; }).length };
    }
    if (path === '/notifications/mark-read' && method === 'POST') {
      var log = jget('pm.notifications', []);
      log.forEach(function (n) { if (!body.id || n.id === body.id) n.read = true; });
      jset('pm.notifications', log); return { ok: true };
    }
    if (path === '/email-log' && method === 'GET') return { ok: true, items: jget('pm.email_log', []) };
    if (path === '/audit' && method === 'GET') return { ok: true, items: jget('pm.audit', []).slice(0, +(params.limit || 100)) };

    // ----- dashboards -----
    if (path === '/dashboard' && method === 'GET') return dashboard(params.role, params.id);
    if (path === '/analytics/collections' && method === 'GET') return { ok: true, stats: E.collectionStats(store.invoices.all().filter(function (iv) { return !params.property_id || iv.property_id === params.property_id; })), series: monthlySeries(12) };
    if (path === '/analytics/occupancy' && method === 'GET') return { ok: true, overall: occupancy(), by_property: D.PROPERTIES.map(function (p) { return { property_id: p.id, name: p.name, occupancy_pct: occupancy(p.id).pct }; }) };
    if (path === '/analytics/arrears' && method === 'GET') return { ok: true, buckets: E.agingBuckets(store.invoices.all()) };
    if (path === '/analytics/maintenance' && method === 'GET') return { ok: true, stats: maintenanceStats(params.property_id ? { property_id: params.property_id } : null) };
    if (path === '/analytics/roi' && method === 'GET') return { ok: true, items: roiFor(params.owner_id ? { owner_id: params.owner_id } : null), series: monthlySeries(12) };

    return { ok: false, error: 'unknown_route', status: 404 };
  }

  function buildRoomsSeed() {
    return D.ROOM_TEMPLATES.map(function (rn, ri) {
      return { id: 'room-' + ri, name: rn, order: ri, items: D.ITEM_TEMPLATES.map(function (it, ti) { return { id: 'it-' + ri + '-' + ti, label: it, rating: null, baseline_rating: null, notes: '', action_required: false, cost_estimate: 0, photos: [] }; }) };
    });
  }

  function dashboard(role, id) {
    var invs = store.invoices.all();
    var coll = E.collectionStats(invs);
    var occ = occupancy();
    var maint = maintenanceStats();
    if (role === 'tenant') {
      var t = D.TENANTS.filter(function (x) { return x.id === id; })[0] || D.TENANTS.filter(function (x) { return x.current_lease_id; })[0];
      var lease = store.leases.all().filter(function (l) { return l.tenant_id === t.id; })[0];
      var myInv = invs.filter(function (iv) { return iv.tenant_id === t.id; }).map(decorateInvoice);
      var nextDue = myInv.filter(function (iv) { return iv.status === 'due' || iv.status === 'upcoming' || iv.status === 'overdue'; }).sort(function (a, b) { return new Date(a.due_date) - new Date(b.due_date); })[0];
      var myWo = store.workorders.all().filter(function (w) { return w.tenant_id === t.id && ['submitted', 'triaged', 'assigned', 'scheduled', 'in_progress', 'on_hold'].indexOf(w.status) !== -1; }).map(decorateWO);
      return { ok: true, role: 'tenant', tenant: t, lease: lease ? Object.assign({}, lease, { unit: store.units.get(lease.unit_id), expiry: E.leaseExpiry(lease) }) : null, next_invoice: nextDue || null, open_work_orders: myWo, outstanding_aed: myInv.reduce(function (a, iv) { return a + (iv.status === 'overdue' || iv.status === 'due' ? iv.outstanding_aed : 0); }, 0) };
    }
    if (role === 'landlord') {
      var owner = D.OWNERS.filter(function (x) { return x.id === id; })[0] || D.OWNERS[0];
      var roi = roiFor({ owner_id: owner.id });
      var oUnits = store.units.all().filter(function (u) { return u.owner_id === owner.id; });
      var portVal = oUnits.reduce(function (a, u) { return a + u.valuation_aed; }, 0);
      var oInv = invs.filter(function (iv) { return iv.owner_id === owner.id; });
      var oColl = E.collectionStats(oInv);
      var rentRoll = roi.reduce(function (a, r) { return a + r.annual_rent_aed; }, 0);
      return { ok: true, role: 'landlord', owner: owner, portfolio_value: portVal, monthly_income: Math.round(rentRoll / 12), occupancy: occupancy(), collection: oColl, roi: roi, net_yield: roi.length ? +(roi.reduce(function (a, r) { return a + r.net_yield_pct; }, 0) / roi.length).toFixed(1) : 0, units: oUnits.length };
    }
    if (role === 'vendor') {
      var ven = D.VENDORS.filter(function (x) { return x.id === id; })[0] || D.VENDORS[0];
      var vwos = store.workorders.all().filter(function (w) { return w.vendor_id === ven.id; }).map(decorateWO);
      return { ok: true, role: 'vendor', vendor: ven, work_orders: vwos, stats: maintenanceStats({ vendor_id: ven.id }) };
    }
    if (role === 'inspector') {
      var insp = D.INSPECTORS.filter(function (x) { return x.id === id; })[0] || D.INSPECTORS[0];
      var mine = store.inspections.all().filter(function (x) { return x.inspector_id === insp.id; });
      return { ok: true, role: 'inspector', inspector: insp, inspections: mine, pending: mine.filter(function (x) { return x.status === 'assigned' || x.status === 'in_progress'; }).length };
    }
    // manager (default)
    var expiring = store.leases.all().filter(function (l) { var e = E.leaseExpiry(l); return e.days_to_end >= 0 && e.days_to_end <= 90; }).length;
    var arrears = E.agingBuckets(invs);
    var arrearsTotal = arrears['0-30'] + arrears['31-60'] + arrears['61-90'] + arrears['90+'];
    return {
      ok: true, role: 'manager', manager: D.CURRENT_MANAGER,
      kpis: { occupancy_pct: occ.pct, collection_rate: coll.rate, open_work_orders: maint.open, sla_breaches: maint.sla_breaches, arrears_aed: Math.round(arrearsTotal), expiring_leases: expiring },
      recent_wos: store.workorders.all().map(decorateWO).sort(function (a, b) { return new Date(b.reported_at) - new Date(a.reported_at); }).slice(0, 6),
      audit: jget('pm.audit', []).slice(0, 8)
    };
  }

  // Fetch intercept
  var origFetch = window.fetch ? window.fetch.bind(window) : null;
  var BASE = '/property-management/api';
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var idx = url.indexOf(BASE);
    if (idx === -1) return origFetch ? origFetch(input, init) : Promise.reject(new Error('no fetch'));
    init = init || {};
    var method = (init.method || 'GET').toUpperCase();
    var pq = url.slice(idx + BASE.length).split('?');
    var path = pq[0] || '/';
    var params = {};
    if (pq[1]) pq[1].split('&').forEach(function (kv) { var p = kv.split('='); params[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ''); });
    var body = {};
    if (init.body) { try { body = JSON.parse(init.body); } catch (e) { body = {}; } }
    var res;
    try { res = handle(method, path, body, params); }
    catch (e) { console.error('[mock] route error', path, e); res = { ok: false, error: 'server_error', status: 500 }; }
    return Promise.resolve({ ok: !!res.ok, status: res.status || (res.ok ? 200 : 400), json: function () { return Promise.resolve(res); } });
  };
})();
