/* mock-api.js - Marsad fetch interceptor for /marsad/api/*.
 *
 * Backs the dispatcher console + driver view + admin SPA. Reads from
 * MARSAD_DATA seed + MarsadSim live state (for vehicle positions and
 * order status) + localStorage overrides (admin edits, assignments,
 * notes, audit, settings overrides).
 *
 * CRITICAL: every regex route wraps the match assignment in parens -
 * the operator-precedence lesson from POS/Watad. */
(function () {
  'use strict';
  if (!window.MARSAD_DATA) { console.error('mock-api: MARSAD_DATA not loaded'); return; }

  var LS = {
    order_edits:    'marsad.order.edits',
    order_created:  'marsad.order.created',
    driver_edits:   'marsad.driver.edits',
    integ_overrides:'marsad.integ.overrides',
    settings:       'marsad.settings.overrides',
    audit:          'marsad.audit',
    ai_log_extra:   'marsad.ai.log'
  };
  function jget(k, def) { try { return JSON.parse(localStorage.getItem(k)) || def; } catch (e) { return def; } }
  function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  function hub() { return window.MARSAD_DATA.HUB; }
  function zones() { return window.MARSAD_DATA.ZONES.slice(); }
  function drivers() {
    var e = jget(LS.driver_edits, {});
    return window.MARSAD_DATA.DRIVERS.map(function (d) { return e[d.id] ? Object.assign({}, d, e[d.id]) : d; });
  }
  function vehicles() {
    // Merge static vehicles with the sim's live positions if available.
    var sim = window.MarsadSim;
    return window.MARSAD_DATA.VEHICLES.map(function (v) {
      if (sim && sim.vehicles && sim.vehicles[v.id]) {
        var live = sim.vehicles[v.id];
        return Object.assign({}, v, { lat: live.lat, lng: live.lng, heading: live.heading, speed_kmh: live.speed_kmh, fuel_pct: live.fuel_pct, last_ping: live.last_ping });
      }
      return v;
    });
  }
  function customers() { return window.MARSAD_DATA.CUSTOMERS.slice(); }
  function orders() {
    var seed = window.MARSAD_DATA.ORDERS.slice();
    var sim = window.MarsadSim;
    var edits = jget(LS.order_edits, {});
    var created = jget(LS.order_created, []);
    var merged = seed.concat(created).map(function (o) {
      var live = sim && sim.orders && sim.orders[o.id];
      var withLive = live ? Object.assign({}, o, { status: live.status, driver_id: live.driver_id, delivered_at: live.delivered_at, sla_breached: live.sla_breached, sla_warn: live.sla_warn }) : o;
      return edits[o.id] ? Object.assign({}, withLive, edits[o.id]) : withLive;
    });
    return merged;
  }
  function integrations() {
    var ov = jget(LS.integ_overrides, {});
    return window.MARSAD_DATA.INTEGRATIONS.map(function (i) { return ov[i.id] ? Object.assign({}, i, ov[i.id]) : i; });
  }
  function settings() {
    var ov = jget(LS.settings, {});
    return Object.assign({}, window.MARSAD_DATA.SETTINGS, ov);
  }
  function audit(action, target, details) {
    var log = jget(LS.audit, []);
    log.unshift({ id: 'a' + Date.now() + Math.random().toString(36).slice(2, 5), when: new Date().toISOString(), actor: 'st-dispatcher', action: action, target: target, details: details || '' });
    jset(LS.audit, log.slice(0, 200));
  }

  function dashboardKpis() {
    var ords = orders();
    var pending = ords.filter(function (o) { return o.status === 'pending'; }).length;
    var inFlight = ords.filter(function (o) { return ['assigned', 'picked_up', 'in_transit'].indexOf(o.status) !== -1; }).length;
    var deliveredToday = ords.filter(function (o) {
      if (o.status !== 'delivered' || !o.delivered_at) return false;
      var today = new Date(); today.setHours(0, 0, 0, 0);
      return new Date(o.delivered_at) >= today;
    }).length;
    var slaBreaches = ords.filter(function (o) { return o.sla_breached && o.status !== 'delivered'; }).length;
    var totalOrders = ords.filter(function (o) { return o.status === 'delivered' || o.sla_breached !== null; }).length || 1;
    var onTimePct = ords.length ? +(100 * (1 - slaBreaches / totalOrders)).toFixed(1) : 100;
    var onlineDrivers = drivers().filter(function (d) { return d.online; }).length;
    return {
      pending: pending,
      in_flight: inFlight,
      delivered_today: deliveredToday,
      sla_breaches: slaBreaches,
      on_time_pct: onTimePct,
      online_drivers: onlineDrivers,
      total_vehicles: vehicles().length
    };
  }

  function handle(method, path, body, params) {
    var m;
    body = body || {}; params = params || {};

    /* ===== topology ===== */
    if (path === '/hub'    && method === 'GET') return { ok: true, hub: hub() };
    if (path === '/zones'  && method === 'GET') return { ok: true, items: zones() };
    if (path === '/drivers' && method === 'GET') {
      var ds = drivers();
      if (params.status) ds = ds.filter(function (d) { return d.status === params.status; });
      return { ok: true, items: ds };
    }
    if ((m = path.match(/^\/drivers\/([^\/]+)$/)) && method === 'GET') {
      var d = drivers().find(function (x) { return x.id === m[1]; });
      return d ? { ok: true, driver: d } : { ok: false, error: 'not_found', status: 404 };
    }
    if ((m = path.match(/^\/drivers\/([^\/]+)$/)) && method === 'PUT') {
      var de = jget(LS.driver_edits, {});
      de[m[1]] = Object.assign({}, de[m[1]] || {}, body);
      jset(LS.driver_edits, de);
      audit('driver.update', m[1], JSON.stringify(body).slice(0, 80));
      return { ok: true };
    }
    if (path === '/vehicles' && method === 'GET') return { ok: true, items: vehicles() };
    if (path === '/customers' && method === 'GET') return { ok: true, items: customers() };

    /* ===== orders ===== */
    if (path === '/orders' && method === 'GET') {
      var rows = orders();
      if (params.status) rows = rows.filter(function (o) { return o.status === params.status; });
      if (params.zone)   rows = rows.filter(function (o) { return o.zone_id === params.zone; });
      if (params.driver) rows = rows.filter(function (o) { return o.driver_id === params.driver; });
      if (params.q) {
        var q = String(params.q).toLowerCase();
        rows = rows.filter(function (o) { return (o.number + ' ' + o.customer_name + ' ' + o.address).toLowerCase().indexOf(q) !== -1; });
      }
      if (params.limit) rows = rows.slice(0, +params.limit);
      return { ok: true, items: rows };
    }
    if ((m = path.match(/^\/orders\/([^\/]+)$/)) && method === 'GET') {
      var o = orders().find(function (x) { return x.id === m[1]; });
      return o ? { ok: true, order: o } : { ok: false, error: 'not_found', status: 404 };
    }
    if ((m = path.match(/^\/orders\/([^\/]+)$/)) && method === 'PUT') {
      var oe = jget(LS.order_edits, {});
      oe[m[1]] = Object.assign({}, oe[m[1]] || {}, body);
      jset(LS.order_edits, oe);
      // Mirror into the sim's order copy so the live state stays in sync.
      if (window.MarsadSim && window.MarsadSim.orders && window.MarsadSim.orders[m[1]]) {
        Object.assign(window.MarsadSim.orders[m[1]], body);
      }
      audit('order.update', m[1], JSON.stringify(body).slice(0, 100));
      return { ok: true };
    }
    if ((m = path.match(/^\/orders\/([^\/]+)\/assign$/)) && method === 'POST') {
      var orderId = m[1];
      var driverId = body.driver_id;
      var oe2 = jget(LS.order_edits, {});
      oe2[orderId] = Object.assign({}, oe2[orderId] || {}, { driver_id: driverId, status: 'assigned' });
      jset(LS.order_edits, oe2);
      if (window.MarsadSim && window.MarsadSim.orders && window.MarsadSim.orders[orderId]) {
        window.MarsadSim.orders[orderId].driver_id = driverId;
        window.MarsadSim.orders[orderId].status = 'assigned';
        // Set as next target for the driver if their vehicle has nothing assigned.
        var veh = Object.values(window.MarsadSim.vehicles).find(function (v) { return v.driver_id === driverId; });
        if (veh && !veh.target_order_id) veh.target_order_id = orderId;
      }
      audit('order.assign', orderId, 'driver=' + driverId);
      return { ok: true };
    }

    /* ===== Analytics ===== */
    if (path === '/analytics/daily' && method === 'GET') return { ok: true, items: window.MARSAD_DATA.ANALYTICS_HISTORY };

    /* ===== Admin ===== */
    if (path === '/admin/dashboard' && method === 'GET') {
      var kpis = dashboardKpis();
      var recent = orders().slice(0, 8);
      // Top zones by order volume today
      var byZone = {};
      orders().forEach(function (o) { byZone[o.zone_id] = (byZone[o.zone_id] || 0) + 1; });
      var topZones = Object.keys(byZone).map(function (z) {
        var zn = zones().find(function (x) { return x.id === z; }) || { name: z };
        return { zone: zn, count: byZone[z] };
      }).sort(function (a, b) { return b.count - a.count; }).slice(0, 5);
      // Driver leaderboard
      var leaderboard = drivers()
        .slice()
        .sort(function (a, b) { return b.on_time_pct - a.on_time_pct; })
        .slice(0, 5);
      return { ok: true, kpis: kpis, recent_orders: recent, top_zones: topZones, leaderboard: leaderboard };
    }
    if (path === '/admin/audit' && method === 'GET') return { ok: true, items: jget(LS.audit, []) };
    if (path === '/admin/settings' && method === 'GET') return { ok: true, settings: settings() };
    if (path === '/admin/settings' && method === 'POST') {
      var so = jget(LS.settings, {});
      jset(LS.settings, Object.assign({}, so, body));
      audit('settings.update', '', JSON.stringify(body).slice(0, 80));
      return { ok: true };
    }
    if (path === '/admin/ai-logs' && method === 'GET') {
      var rows2 = jget(LS.ai_log_extra, []).slice();
      if (params.limit) rows2 = rows2.slice(0, +params.limit);
      return { ok: true, items: rows2 };
    }
    if (path === '/admin/ai-logs' && method === 'POST') {
      var ex = jget(LS.ai_log_extra, []);
      ex.unshift(Object.assign({ id: 'ail-' + Date.now(), at: new Date().toISOString() }, body));
      jset(LS.ai_log_extra, ex.slice(0, 200));
      return { ok: true };
    }
    if (path === '/integrations' && method === 'GET') return { ok: true, items: integrations() };
    if ((m = path.match(/^\/integrations\/([^\/]+)$/)) && method === 'POST') {
      var io = jget(LS.integ_overrides, {});
      var cur = integrations().find(function (x) { return x.id === m[1]; });
      if (!cur) return { ok: false, error: 'not_found', status: 404 };
      var ns = cur.status === 'connected' ? 'disconnected' : 'connected';
      io[m[1]] = { status: ns, connected_at: ns === 'connected' ? new Date().toISOString() : null };
      jset(LS.integ_overrides, io);
      audit('integration.' + (ns === 'connected' ? 'connect' : 'disconnect'), m[1], '');
      return { ok: true };
    }
    if (path === '/admin/reset-demo' && method === 'POST') {
      Object.keys(LS).forEach(function (k) { try { localStorage.removeItem(LS[k]); } catch (e) {} });
      if (window.MarsadSim && window.MarsadSim.reset) window.MarsadSim.reset();
      return { ok: true };
    }

    return { ok: false, error: 'unknown_route', status: 404 };
  }

  // Fetch intercept
  var origFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var idx = url.indexOf('/marsad/api');
    if (idx === -1 || url.indexOf('/api/marsad/ai/') !== -1)
      return origFetch ? origFetch(input, init) : Promise.reject(new Error('no fetch'));
    init = init || {};
    var method = (init.method || 'GET').toUpperCase();
    var pq = url.slice(idx + '/marsad/api'.length).split('?');
    var path = pq[0] || '/';
    var params = {};
    if (pq[1]) pq[1].split('&').forEach(function (kv) { var p = kv.split('='); params[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ''); });
    var body = {};
    if (init.body) { try { body = JSON.parse(init.body); } catch (e) { body = {}; } }
    var res = handle(method, path, body, params);
    return Promise.resolve({ ok: !!res.ok, status: res.status || (res.ok ? 200 : 400), json: function () { return Promise.resolve(res); } });
  };

})();
