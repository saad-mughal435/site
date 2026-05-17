/* mock-api.js - Qahwa POS fetch interceptor. Serves /pos/api/* from
   POS_DATA + localStorage. All writes are local-only. */
(function () {
  'use strict';

  if (!window.POS_DATA) { console.error('mock-api: POS_DATA not loaded'); return; }

  // ---------- localStorage keys ----------
  var LS = {
    session:           'pos.session',
    products_created:  'pos.products.created',
    products_edits:    'pos.products.edits',
    products_deleted:  'pos.products.deleted',
    cats_overrides:    'pos.cats.overrides',
    mods_overrides:    'pos.mods.overrides',
    orders_created:    'pos.orders.created',
    orders_edits:      'pos.orders.edits',
    orders_deleted:    'pos.orders.deleted',
    tables_overrides:  'pos.tables.overrides',
    staff_created:     'pos.staff.created',
    staff_edits:       'pos.staff.edits',
    staff_deleted:     'pos.staff.deleted',
    discounts:         'pos.discounts',
    inventory_edits:   'pos.inventory.edits',
    shifts_created:    'pos.shifts.created',
    shifts_edits:      'pos.shifts.edits',
    settings:          'pos.settings.overrides',
    audit:             'pos.audit',
    notifications:     'pos.notifications'
  };
  function jget(k, def) { try { return JSON.parse(localStorage.getItem(k)) || def; } catch (e) { return def; } }
  function jset(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

  // ---------- Merged views ----------
  function products() {
    var seed = window.POS_DATA.PRODUCTS.slice();
    var created = jget(LS.products_created, []);
    var edits = jget(LS.products_edits, {});
    var deleted = jget(LS.products_deleted, []);
    return seed.concat(created).filter(function (p) { return deleted.indexOf(p.id) === -1; })
      .map(function (p) { return edits[p.id] ? Object.assign({}, p, edits[p.id]) : p; });
  }
  function staff() {
    var seed = window.POS_DATA.STAFF.slice();
    var created = jget(LS.staff_created, []);
    var edits = jget(LS.staff_edits, {});
    var deleted = jget(LS.staff_deleted, []);
    return seed.concat(created).filter(function (s) { return deleted.indexOf(s.id) === -1; })
      .map(function (s) { return edits[s.id] ? Object.assign({}, s, edits[s.id]) : s; });
  }
  function orders() {
    var seed = window.POS_DATA.ORDERS.slice();
    var created = jget(LS.orders_created, []);
    var edits = jget(LS.orders_edits, {});
    var deleted = jget(LS.orders_deleted, []);
    return seed.concat(created).filter(function (o) { return deleted.indexOf(o.id) === -1; })
      .map(function (o) { return edits[o.id] ? Object.assign({}, o, edits[o.id]) : o; });
  }
  function tables() {
    var seed = window.POS_DATA.TABLES.slice();
    var ov = jget(LS.tables_overrides, {});
    return seed.map(function (t) { return ov[t.id] ? Object.assign({}, t, ov[t.id]) : t; });
  }
  function shifts() {
    var seed = window.POS_DATA.SHIFTS.slice();
    var created = jget(LS.shifts_created, []);
    var edits = jget(LS.shifts_edits, {});
    return seed.concat(created).map(function (s) { return edits[s.id] ? Object.assign({}, s, edits[s.id]) : s; });
  }
  function discounts() {
    var ov = jget(LS.discounts, null);
    return ov || window.POS_DATA.DISCOUNTS.slice();
  }
  function inventory() {
    var seed = window.POS_DATA.INVENTORY.slice();
    var edits = jget(LS.inventory_edits, {});
    return seed.map(function (i) { return edits[i.id] ? Object.assign({}, i, edits[i.id]) : i; });
  }
  function settings() {
    var ov = jget(LS.settings, {});
    return Object.assign({}, window.POS_DATA.SETTINGS, ov);
  }

  function audit(action, target, details) {
    var log = jget(LS.audit, []);
    var sess = jget(LS.session, null);
    log.unshift({ id: 'a' + Date.now(), when: new Date().toISOString(), actor: sess ? sess.staff_id : 'system', action: action, target: target, details: details || '' });
    jset(LS.audit, log.slice(0, 200));
  }
  function notify(n) {
    var l = jget(LS.notifications, []);
    l.unshift(Object.assign({ id: 'n' + Date.now(), when: Date.now(), unread: true }, n));
    jset(LS.notifications, l.slice(0, 40));
  }

  // ---------- Pricing helpers ----------
  function lineTotal(line) {
    return line.unit_price * line.qty;
  }
  function recompute(order) {
    var sub = (order.lines || []).reduce(function (s, l) { return s + lineTotal(l); }, 0);
    order.subtotal = sub;
    var afterDisc = Math.max(0, sub - (order.discount || 0));
    var vatPct = (settings().vat_pct != null ? settings().vat_pct : 5) / 100;
    order.vat = +(afterDisc * vatPct).toFixed(2);
    order.total = +(afterDisc + order.vat).toFixed(2);
    return order;
  }

  // ---------- Inventory deduction recipes ----------
  // When a product is sold, decrement these ingredients.
  // (Simplified - real product would link recipes to products.)
  var RECIPES = {
    'p-espresso':       [['ing-beans-house', 8], ['ing-cup-8', 1], ['ing-lid', 1]],
    'p-double-espresso':[['ing-beans-house', 16], ['ing-cup-8', 1], ['ing-lid', 1]],
    'p-americano':      [['ing-beans-house', 14], ['ing-cup-12', 1], ['ing-lid', 1]],
    'p-cappuccino':     [['ing-beans-house', 14], ['ing-milk-dairy', 160], ['ing-cup-12', 1], ['ing-lid', 1]],
    'p-latte':          [['ing-beans-house', 14], ['ing-milk-dairy', 220], ['ing-cup-12', 1], ['ing-lid', 1]],
    'p-flat-white':     [['ing-beans-house', 16], ['ing-milk-dairy', 160], ['ing-cup-8', 1], ['ing-lid', 1]],
    'p-mocha':          [['ing-beans-house', 14], ['ing-milk-dairy', 200], ['ing-cup-12', 1], ['ing-lid', 1]],
    'p-iced-latte':     [['ing-beans-house', 14], ['ing-milk-dairy', 200], ['ing-cup-16', 1], ['ing-lid', 1]],
    'p-iced-americano': [['ing-beans-house', 14], ['ing-cup-16', 1], ['ing-lid', 1]],
    'p-cold-brew':      [['ing-beans-house', 24], ['ing-cup-16', 1], ['ing-lid', 1]],
    'p-croissant':      [['ing-croissant', 1], ['ing-napkins', 1]],
    'p-pain-choc':      [['ing-croissant', 1], ['ing-napkins', 1]],
    'p-muffin-blueberry': [['ing-muffin', 1], ['ing-napkins', 1]],
    'p-chocolate-cookie': [['ing-cookie', 1], ['ing-napkins', 1]],
    'p-chicken-club':   [['ing-chicken', 120], ['ing-bread', 2], ['ing-napkins', 2]],
    'p-halloumi':       [['ing-halloumi', 100], ['ing-bread', 2], ['ing-napkins', 2]]
  };
  function deductInventory(order) {
    var ie = jget(LS.inventory_edits, {});
    var seed = window.POS_DATA.INVENTORY;
    (order.lines || []).forEach(function (l) {
      var recipe = RECIPES[l.product_id]; if (!recipe) return;
      recipe.forEach(function (r) {
        var ing = seed.find(function (i) { return i.id === r[0]; }); if (!ing) return;
        var cur = (ie[r[0]] && ie[r[0]].on_hand != null) ? ie[r[0]].on_hand : ing.on_hand;
        ie[r[0]] = Object.assign({}, ie[r[0]] || {}, { on_hand: Math.max(0, cur - r[1] * l.qty) });
      });
      // Modifier-driven extras (oat milk swaps dairy)
      (l.modifiers || []).forEach(function (mid) {
        if (mid === 'milk-oat')    ie['ing-milk-oat'] =    Object.assign({}, ie['ing-milk-oat']    || {}, { on_hand: Math.max(0, ((ie['ing-milk-oat']    && ie['ing-milk-oat'].on_hand)    != null ? ie['ing-milk-oat'].on_hand    : seed.find(function(i){return i.id==='ing-milk-oat';}).on_hand)    - 200 * l.qty) });
        if (mid === 'milk-almond') ie['ing-milk-almond'] = Object.assign({}, ie['ing-milk-almond'] || {}, { on_hand: Math.max(0, ((ie['ing-milk-almond'] && ie['ing-milk-almond'].on_hand) != null ? ie['ing-milk-almond'].on_hand : seed.find(function(i){return i.id==='ing-milk-almond';}).on_hand) - 200 * l.qty) });
        if (mid === 'syr-vanilla')  ie['ing-vanilla']  = Object.assign({}, ie['ing-vanilla']  || {}, { on_hand: Math.max(0, ((ie['ing-vanilla']  && ie['ing-vanilla'].on_hand)  != null ? ie['ing-vanilla'].on_hand  : seed.find(function(i){return i.id==='ing-vanilla';}).on_hand)  - 15 * l.qty) });
        if (mid === 'syr-caramel')  ie['ing-caramel']  = Object.assign({}, ie['ing-caramel']  || {}, { on_hand: Math.max(0, ((ie['ing-caramel']  && ie['ing-caramel'].on_hand)  != null ? ie['ing-caramel'].on_hand  : seed.find(function(i){return i.id==='ing-caramel';}).on_hand)  - 15 * l.qty) });
        if (mid === 'syr-hazelnut') ie['ing-hazelnut'] = Object.assign({}, ie['ing-hazelnut'] || {}, { on_hand: Math.max(0, ((ie['ing-hazelnut'] && ie['ing-hazelnut'].on_hand) != null ? ie['ing-hazelnut'].on_hand : seed.find(function(i){return i.id==='ing-hazelnut';}).on_hand) - 15 * l.qty) });
      });
    });
    jset(LS.inventory_edits, ie);
  }

  // ---------- Route handler ----------
  function handle(method, path, body, params) {
    var m;
    body = body || {}; params = params || {};

    // ----- Auth -----
    if (path === '/auth/staff-login' && method === 'POST') {
      var pin = String(body.pin || '');
      var member = staff().find(function (s) { return s.pin === pin; });
      if (!member) return { ok: false, error: 'invalid_pin', status: 401 };
      jset(LS.session, { staff_id: member.id, role: member.role, started_at: new Date().toISOString() });
      audit('auth.login', member.id, member.role);
      return { ok: true, staff: { id: member.id, name: member.name, role: member.role, photo: member.photo } };
    }
    if (path === '/auth/me' && method === 'GET') {
      var sess = jget(LS.session, null);
      if (!sess) return { ok: false, error: 'not_authenticated', status: 401 };
      var st = staff().find(function (s) { return s.id === sess.staff_id; });
      return { ok: true, session: sess, staff: st ? { id: st.id, name: st.name, role: st.role, photo: st.photo } : null };
    }
    if (path === '/auth/logout' && method === 'POST') {
      localStorage.removeItem(LS.session);
      audit('auth.logout', 'session', '');
      return { ok: true };
    }

    // ----- Catalogue -----
    if (path === '/products' && method === 'GET') {
      var rows = products().filter(function (p) { return p.active; });
      if (params.category) rows = rows.filter(function (p) { return p.category_id === params.category; });
      if (params.q) { var q = String(params.q).toLowerCase(); rows = rows.filter(function (p) { return (p.name + ' ' + p.name_ar).toLowerCase().indexOf(q) !== -1; }); }
      return { ok: true, items: rows };
    }
    if ((m = path.match(/^\/products\/([^\/]+)$/)) && method === 'GET') {
      var p = products().find(function (x) { return x.id === m[1]; });
      if (!p) return { ok: false, error: 'not_found' };
      // Attach modifier groups
      var groups = (p.modifier_group_ids || []).map(function (gid) { return window.POS_DATA.MODIFIER_GROUPS.find(function (g) { return g.id === gid; }); }).filter(Boolean);
      return { ok: true, product: p, modifier_groups: groups };
    }
    if (path === '/categories' && method === 'GET') return { ok: true, items: window.POS_DATA.CATEGORIES };
    if (path === '/modifiers' && method === 'GET')  return { ok: true, items: window.POS_DATA.MODIFIER_GROUPS };

    // ----- Orders -----
    if (path === '/orders' && method === 'POST') {
      var sess1 = jget(LS.session, null);
      var no = 1000 + orders().length + 1;
      var newO = {
        id: 'o-' + Date.now(), order_no: '#' + no,
        table_id: body.table_id || null,
        type: body.type || (body.table_id ? 'dine-in' : 'takeaway'),
        lines: [], subtotal: 0, discount: 0, vat: 0, total: 0, payments: [],
        status: 'open', cashier_id: sess1 ? sess1.staff_id : 'st-cash-1',
        created_at: new Date().toISOString(), completed_at: null
      };
      var oc = jget(LS.orders_created, []); oc.unshift(newO); jset(LS.orders_created, oc);
      audit('order.create', newO.id, newO.type);
      return { ok: true, order: newO };
    }
    if ((m = path.match(/^\/orders\/([^\/]+)$/)) && method === 'GET') {
      var o = orders().find(function (x) { return x.id === m[1] || x.order_no === m[1]; });
      if (!o) return { ok: false, error: 'not_found' };
      return { ok: true, order: o };
    }
    if ((m = path.match(/^\/orders\/([^\/]+)$/)) && method === 'PUT') {
      var oid = m[1];
      var o2 = orders().find(function (x) { return x.id === oid; });
      if (!o2) return { ok: false, error: 'not_found' };
      var edits = jget(LS.orders_edits, {});
      var cur = Object.assign({}, o2, edits[oid] || {});
      // Apply body changes
      if (body.add_line)    cur.lines = (cur.lines || []).concat([body.add_line]);
      if (body.remove_line) cur.lines = (cur.lines || []).filter(function (l) { return l.id !== body.remove_line; });
      if (body.update_qty)  cur.lines = (cur.lines || []).map(function (l) { return l.id === body.update_qty.id ? Object.assign({}, l, { qty: body.update_qty.qty, line_total: l.unit_price * body.update_qty.qty }) : l; });
      if (typeof body.discount === 'number') cur.discount = body.discount;
      if (body.table_id !== undefined) cur.table_id = body.table_id;
      if (body.type) cur.type = body.type;
      recompute(cur);
      edits[oid] = cur; jset(LS.orders_edits, edits);
      return { ok: true, order: cur };
    }
    if ((m = path.match(/^\/orders\/([^\/]+)\/kot$/)) && method === 'POST') {
      var ke = jget(LS.orders_edits, {});
      var ot = orders().find(function (x) { return x.id === m[1]; });
      if (!ot) return { ok: false, error: 'not_found' };
      ke[m[1]] = Object.assign({}, ke[m[1]] || ot, { status: 'kitchen', kot_at: new Date().toISOString() });
      jset(LS.orders_edits, ke);
      audit('order.kot', m[1], '');
      notify({ title: 'New order in kitchen', body: ot.order_no, kind: 'kitchen' });
      return { ok: true };
    }
    if ((m = path.match(/^\/orders\/([^\/]+)\/pay$/)) && method === 'POST') {
      var pe = jget(LS.orders_edits, {});
      var op = orders().find(function (x) { return x.id === m[1] || x.order_no === m[1]; });
      if (!op) return { ok: false, error: 'not_found' };
      var cur2 = Object.assign({}, op, pe[op.id] || {});
      cur2.payments = (cur2.payments || []).concat(body.payments || [{ method: body.method || 'cash', amount: body.amount || cur2.total }]);
      var paidSoFar = cur2.payments.reduce(function (s, p) { return s + (p.amount || 0); }, 0);
      if (paidSoFar >= cur2.total) {
        cur2.status = 'completed';
        cur2.completed_at = new Date().toISOString();
        deductInventory(cur2);
      }
      pe[op.id] = cur2; jset(LS.orders_edits, pe);
      audit('order.pay', op.id, body.method + ' AED ' + (body.amount || cur2.total));
      return { ok: true, order: cur2, change: Math.max(0, (body.amount || 0) - cur2.total) };
    }
    if ((m = path.match(/^\/orders\/([^\/]+)\/refund$/)) && method === 'POST') {
      var re = jget(LS.orders_edits, {});
      re[m[1]] = Object.assign({}, re[m[1]] || {}, { status: 'refunded', refunded_at: new Date().toISOString(), refund_reason: body.reason || '' });
      jset(LS.orders_edits, re);
      audit('order.refund', m[1], body.reason || '');
      return { ok: true };
    }
    if ((m = path.match(/^\/orders\/([^\/]+)\/(hold|resume|void|served)$/)) && method === 'POST') {
      var statusMap = { hold: 'held', resume: 'open', void: 'voided', served: 'served' };
      var he = jget(LS.orders_edits, {});
      he[m[1]] = Object.assign({}, he[m[1]] || {}, { status: statusMap[m[2]] });
      jset(LS.orders_edits, he);
      audit('order.' + m[2], m[1], '');
      return { ok: true };
    }

    // ----- Kitchen -----
    if (path === '/orders/kitchen' && method === 'GET') {
      // 'ready' orders are food-prepped-but-not-handed-over yet; keep them on
      // the KDS so staff can mark them served when the customer collects.
      var inKitchen = orders().filter(function (o) { return o.status === 'kitchen' || o.status === 'ready'; })
        .sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); });
      return { ok: true, items: inKitchen };
    }
    if ((m = path.match(/^\/orders\/([^\/]+)\/item\/([^\/]+)\/ready$/)) && method === 'POST') {
      var ie2 = jget(LS.orders_edits, {});
      var oo = orders().find(function (x) { return x.id === m[1]; });
      if (!oo) return { ok: false, error: 'not_found' };
      var cur3 = Object.assign({}, oo, ie2[m[1]] || {});
      cur3.lines = (cur3.lines || []).map(function (l) { return l.id === m[2] ? Object.assign({}, l, { ready: true }) : l; });
      ie2[m[1]] = cur3; jset(LS.orders_edits, ie2);
      return { ok: true };
    }
    if ((m = path.match(/^\/orders\/([^\/]+)\/ready$/)) && method === 'POST') {
      var rr = jget(LS.orders_edits, {});
      var oR = orders().find(function (x) { return x.id === m[1]; });
      if (!oR) return { ok: false, error: 'not_found' };
      var c4 = Object.assign({}, oR, rr[m[1]] || {});
      c4.lines = (c4.lines || []).map(function (l) { return Object.assign({}, l, { ready: true }); });
      c4.status = 'ready';
      rr[m[1]] = c4; jset(LS.orders_edits, rr);
      audit('order.ready', m[1], '');
      return { ok: true };
    }

    // ----- Tables / shifts / inventory -----
    if (path === '/tables' && method === 'GET') return { ok: true, items: tables() };
    if ((m = path.match(/^\/tables\/([^\/]+)\/(seat|free)$/)) && method === 'PUT') {
      var to = jget(LS.tables_overrides, {});
      to[m[1]] = Object.assign({}, to[m[1]] || {}, { status: m[2] === 'seat' ? 'seated' : 'free' });
      jset(LS.tables_overrides, to);
      return { ok: true };
    }
    if ((m = path.match(/^\/tables\/([^\/]+)\/status$/)) && method === 'PUT') {
      var allowed = ['free','seated','occupied','dirty'];
      if (allowed.indexOf(body.status) === -1) return { ok: false, error: 'invalid_status' };
      var to2 = jget(LS.tables_overrides, {});
      to2[m[1]] = Object.assign({}, to2[m[1]] || {}, { status: body.status });
      jset(LS.tables_overrides, to2);
      audit('table.status', m[1], body.status);
      return { ok: true };
    }
    if (path === '/shifts/current' && method === 'GET') {
      var open = shifts().find(function (s) { return !s.closed_at; });
      return { ok: true, shift: open || null };
    }
    if (path === '/shifts/open' && method === 'POST') {
      var sc = jget(LS.shifts_created, []);
      var newS = { id: 'sh-' + Date.now(), opened_at: new Date().toISOString(), closed_at: null, opened_by: body.opened_by || 'st-manager', opening_count_aed: body.opening_count_aed || 500 };
      sc.unshift(newS); jset(LS.shifts_created, sc);
      audit('shift.open', newS.id, '');
      return { ok: true, shift: newS };
    }
    if (path === '/shifts/close' && method === 'POST') {
      var se = jget(LS.shifts_edits, {});
      var open2 = shifts().find(function (s) { return !s.closed_at; });
      if (!open2) return { ok: false, error: 'no_open_shift' };
      var todaysOrders = orders().filter(function (o) { return o.status === 'completed' && new Date(o.completed_at || o.created_at) >= new Date(open2.opened_at); });
      var sales = todaysOrders.reduce(function (s, o) { return s + o.total; }, 0);
      var cashSales = todaysOrders.reduce(function (s, o) { return s + (o.payments || []).filter(function (p) { return p.method === 'cash'; }).reduce(function (a, p) { return a + (p.amount || 0); }, 0); }, 0);
      var expected = +(open2.opening_count_aed + cashSales).toFixed(2);
      // Use explicit null check so a counted AED 0 (empty drawer) shows the true negative variance.
      var counted = (body.closing_count_aed != null && body.closing_count_aed !== '') ? +body.closing_count_aed : expected;
      var variance = +(counted - expected).toFixed(2);
      se[open2.id] = Object.assign({}, se[open2.id] || {}, {
        closed_at: new Date().toISOString(),
        closing_count_aed: counted,
        expected_aed: expected,
        variance: variance,
        payments_total: +sales.toFixed(2),
        orders_count: todaysOrders.length,
        closed_by: body.closed_by || 'st-manager'
      });
      jset(LS.shifts_edits, se);
      audit('shift.close', open2.id, 'variance ' + variance.toFixed(2));
      return { ok: true, shift: Object.assign({}, open2, se[open2.id]) };
    }
    if (path === '/inventory' && method === 'GET') return { ok: true, items: inventory() };
    if ((m = path.match(/^\/inventory\/([^\/]+)\/adjust$/)) && method === 'POST') {
      var ie3 = jget(LS.inventory_edits, {});
      ie3[m[1]] = Object.assign({}, ie3[m[1]] || {}, { on_hand: body.on_hand });
      jset(LS.inventory_edits, ie3);
      audit('inventory.adjust', m[1], body.on_hand + ' ' + (body.note || ''));
      return { ok: true };
    }
    if (path === '/discounts' && method === 'GET') return { ok: true, items: discounts() };

    /* ================== ADMIN ================== */

    if (path === '/admin/dashboard' && method === 'GET') {
      var all = orders();
      var today = new Date(); today.setHours(0,0,0,0);
      var todayOrders = all.filter(function (o) { return new Date(o.created_at) >= today && (o.status === 'completed' || o.status === 'kitchen' || o.status === 'ready' || o.status === 'served'); });
      var revenue = todayOrders.filter(function (o) { return o.status === 'completed'; }).reduce(function (s, o) { return s + o.total; }, 0);
      var avgTicket = todayOrders.length ? revenue / todayOrders.length : 0;
      var byProduct = {};
      todayOrders.forEach(function (o) { (o.lines || []).forEach(function (l) { byProduct[l.product_id] = (byProduct[l.product_id] || 0) + l.qty; }); });
      var topProducts = Object.keys(byProduct).map(function (id) { var p = products().find(function (x) { return x.id === id; }); return { product: p ? p.name : id, qty: byProduct[id] }; }).sort(function (a, b) { return b.qty - a.qty; }).slice(0, 5);
      var byHour = Array(24).fill(0);
      todayOrders.forEach(function (o) { byHour[new Date(o.created_at).getHours()] += 1; });
      var byPayment = {};
      todayOrders.filter(function (o) { return o.status === 'completed'; }).forEach(function (o) { (o.payments || []).forEach(function (p) { byPayment[p.method] = (byPayment[p.method] || 0) + (p.amount || 0); }); });
      // Weekly bar chart
      var weekly = [];
      for (var d = 6; d >= 0; d--) {
        var dStart = new Date(); dStart.setDate(dStart.getDate() - d); dStart.setHours(0,0,0,0);
        var dEnd = new Date(dStart); dEnd.setDate(dEnd.getDate() + 1);
        var dayOrders = all.filter(function (o) { var c = new Date(o.created_at); return c >= dStart && c < dEnd && o.status === 'completed'; });
        weekly.push({ label: dStart.toLocaleString('en', { weekday: 'short' }), revenue: dayOrders.reduce(function (s, o) { return s + o.total; }, 0) });
      }
      return {
        ok: true,
        kpis: { revenue_today: revenue, orders_today: todayOrders.length, avg_ticket: avgTicket, kitchen_active: all.filter(function (o) { return o.status === 'kitchen'; }).length },
        top_products: topProducts,
        by_hour: byHour,
        by_payment: byPayment,
        weekly: weekly,
        recent: all.slice().sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); }).slice(0, 8)
      };
    }
    if (path === '/admin/orders' && method === 'GET') {
      var rows = orders();
      if (params.status) rows = rows.filter(function (o) { return o.status === params.status; });
      rows.sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
      return { ok: true, items: rows };
    }
    if (path === '/admin/products' && method === 'GET') return { ok: true, items: products() };
    if (path === '/admin/products' && method === 'POST') {
      var nid = 'p-' + Date.now();
      var nP = Object.assign({ id: nid, active: true, modifier_group_ids: [] }, body);
      var pc = jget(LS.products_created, []); pc.unshift(nP); jset(LS.products_created, pc);
      audit('product.create', nid, body.name);
      return { ok: true, product: nP };
    }
    if ((m = path.match(/^\/admin\/products\/([^\/]+)$/))) {
      if (method === 'PUT') {
        var pe2 = jget(LS.products_edits, {});
        pe2[m[1]] = Object.assign({}, pe2[m[1]] || {}, body);
        jset(LS.products_edits, pe2);
        audit('product.update', m[1], '');
        return { ok: true };
      }
      if (method === 'DELETE') {
        var pd = jget(LS.products_deleted, []);
        if (pd.indexOf(m[1]) === -1) pd.push(m[1]);
        jset(LS.products_deleted, pd);
        audit('product.delete', m[1], '');
        return { ok: true };
      }
    }
    if (path === '/admin/products/bulk' && method === 'POST') {
      var ids = body.ids || [];
      var op = body.op;
      var pe3 = jget(LS.products_edits, {});
      var pd2 = jget(LS.products_deleted, []);
      ids.forEach(function (id) {
        if (op === 'delete') { if (pd2.indexOf(id) === -1) pd2.push(id); }
        else if (op === 'activate')   { pe3[id] = Object.assign({}, pe3[id] || {}, { active: true }); }
        else if (op === 'deactivate') { pe3[id] = Object.assign({}, pe3[id] || {}, { active: false }); }
      });
      jset(LS.products_edits, pe3); jset(LS.products_deleted, pd2);
      audit('product.bulk', op, ids.length + ' products');
      return { ok: true };
    }

    if (path === '/admin/staff' && method === 'GET') return { ok: true, items: staff() };
    if (path === '/admin/staff' && method === 'POST') {
      var sid = 'st-' + Date.now();
      var nS = Object.assign({ id: sid, role: 'cashier', pin: String(Math.floor(1000 + Math.random()*9000)) }, body);
      var sc2 = jget(LS.staff_created, []); sc2.unshift(nS); jset(LS.staff_created, sc2);
      audit('staff.create', sid, body.name);
      return { ok: true, staff: nS };
    }
    if ((m = path.match(/^\/admin\/staff\/([^\/]+)$/))) {
      if (method === 'PUT') {
        var se2 = jget(LS.staff_edits, {});
        se2[m[1]] = Object.assign({}, se2[m[1]] || {}, body);
        jset(LS.staff_edits, se2);
        audit('staff.update', m[1], '');
        return { ok: true };
      }
      if (method === 'DELETE') {
        var sd = jget(LS.staff_deleted, []);
        if (sd.indexOf(m[1]) === -1) sd.push(m[1]);
        jset(LS.staff_deleted, sd);
        audit('staff.delete', m[1], '');
        return { ok: true };
      }
    }

    if (path === '/admin/discounts' && method === 'GET') return { ok: true, items: discounts() };
    if (path === '/admin/discounts' && method === 'POST') {
      var cur5 = jget(LS.discounts, null) || window.POS_DATA.DISCOUNTS.slice();
      if (body.action === 'add') { cur5.unshift(Object.assign({ id: 'd-' + Date.now(), active: true }, body.discount)); }
      else if (body.action === 'toggle') { cur5 = cur5.map(function (d) { return d.id === body.id ? Object.assign({}, d, { active: !d.active }) : d; }); }
      else if (body.action === 'remove') { cur5 = cur5.filter(function (d) { return d.id !== body.id; }); }
      jset(LS.discounts, cur5);
      audit('discount.' + body.action, body.id || '', '');
      return { ok: true };
    }

    // ----- Categories admin -----
    if (path === '/admin/categories' && method === 'GET') {
      var co = jget(LS.cats_overrides, { edits: {}, created: [], deleted: [] });
      var rows = window.POS_DATA.CATEGORIES.slice().concat(co.created || [])
        .filter(function (c) { return (co.deleted || []).indexOf(c.id) === -1; })
        .map(function (c) { return co.edits[c.id] ? Object.assign({}, c, co.edits[c.id]) : c; });
      return { ok: true, items: rows };
    }
    if (path === '/admin/categories' && method === 'POST') {
      var co2 = jget(LS.cats_overrides, { edits: {}, created: [], deleted: [] });
      if (body.action === 'add') {
        co2.created = co2.created || [];
        co2.created.push(Object.assign({ id: 'cat-' + Date.now(), icon: '🍽', display_order: 99 }, body.category));
      } else if (body.action === 'update') {
        co2.edits = co2.edits || {};
        co2.edits[body.id] = Object.assign({}, co2.edits[body.id] || {}, body.changes);
      } else if (body.action === 'remove') {
        co2.deleted = co2.deleted || [];
        if (co2.deleted.indexOf(body.id) === -1) co2.deleted.push(body.id);
      }
      jset(LS.cats_overrides, co2);
      audit('category.' + body.action, body.id || '', '');
      return { ok: true };
    }

    // ----- Modifiers admin -----
    if (path === '/admin/modifiers' && method === 'GET') {
      var mo = jget(LS.mods_overrides, { edits: {}, created: [], deleted: [] });
      var mods = window.POS_DATA.MODIFIER_GROUPS.slice().concat(mo.created || [])
        .filter(function (g) { return (mo.deleted || []).indexOf(g.id) === -1; })
        .map(function (g) { return mo.edits[g.id] ? Object.assign({}, g, mo.edits[g.id]) : g; });
      return { ok: true, items: mods };
    }
    if (path === '/admin/modifiers' && method === 'POST') {
      var mo2 = jget(LS.mods_overrides, { edits: {}, created: [], deleted: [] });
      if (body.action === 'add') {
        mo2.created = mo2.created || [];
        mo2.created.push(Object.assign({ id: 'mg-' + Date.now(), type: 'single', required: false, options: [] }, body.group));
      } else if (body.action === 'update') {
        mo2.edits = mo2.edits || {};
        mo2.edits[body.id] = Object.assign({}, mo2.edits[body.id] || {}, body.changes);
      } else if (body.action === 'remove') {
        mo2.deleted = mo2.deleted || [];
        if (mo2.deleted.indexOf(body.id) === -1) mo2.deleted.push(body.id);
      }
      jset(LS.mods_overrides, mo2);
      audit('modifier.' + body.action, body.id || '', '');
      return { ok: true };
    }

    // ----- Live-orders admin override -----
    if ((m = path.match(/^\/admin\/orders\/([^\/]+)\/status$/)) && method === 'POST') {
      var aoe = jget(LS.orders_edits, {});
      aoe[m[1]] = Object.assign({}, aoe[m[1]] || {}, { status: body.status });
      if (body.status === 'completed') aoe[m[1]].completed_at = new Date().toISOString();
      jset(LS.orders_edits, aoe);
      audit('order.status_override', m[1], body.status);
      return { ok: true };
    }

    if (path === '/admin/audit' && method === 'GET') return { ok: true, items: jget(LS.audit, []) };
    if (path === '/admin/settings' && method === 'GET') return { ok: true, settings: settings() };
    if (path === '/admin/settings' && method === 'POST') {
      var so = jget(LS.settings, {});
      jset(LS.settings, Object.assign({}, so, body));
      audit('settings.update', '', JSON.stringify(body));
      return { ok: true };
    }
    if (path === '/admin/reset-demo' && method === 'POST') {
      Object.keys(LS).forEach(function (k) { localStorage.removeItem(LS[k]); });
      return { ok: true };
    }

    return { ok: false, error: 'unknown_route', status: 404 };
  }

  // ---------- Fetch / XHR intercept ----------
  var origFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var idx = url.indexOf('/pos/api');
    if (idx === -1) return origFetch ? origFetch(input, init) : Promise.reject(new Error('no fetch'));
    init = init || {};
    var method = (init.method || 'GET').toUpperCase();
    var pathAndQuery = url.slice(idx + '/pos/api'.length).split('?');
    var path = pathAndQuery[0] || '/';
    var params = {};
    if (pathAndQuery[1]) pathAndQuery[1].split('&').forEach(function (kv) { var p = kv.split('='); params[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ''); });
    var body = {};
    if (init.body) { try { body = JSON.parse(init.body); } catch (e) { body = {}; } }
    var res = handle(method, path, body, params);
    return Promise.resolve({
      ok: !!res.ok, status: res.status || (res.ok ? 200 : 400),
      json: function () { return Promise.resolve(res); }
    });
  };

  console.log('Qahwa POS mock-api ready - /pos/api/* intercepted');
})();
