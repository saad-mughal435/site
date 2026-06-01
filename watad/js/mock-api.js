/* mock-api.js - Watad fetch interceptor for /watad/api/*. Serves
   building topology / assets / points / alarms / work orders / staff /
   schedules / integrations / settings / audit from WATAD_DATA + localStorage.
   AI calls go to /api/watad/ai/* and pass through to the Worker / ai-engine.

   CRITICAL: every regex route wraps the match assignment in parens:
   `if ((m = path.match(...)) && method === '...')`. The naked form
   `if (m = ... && ...)` parses as `m = (match && method)` → m becomes
   true/false/null → m[1] is undefined → silent 404. POS lost a week to
   this; Watad will not. */
(function () {
  'use strict';
  if (!window.WATAD_DATA) { console.error('mock-api: WATAD_DATA not loaded'); return; }

  // ---------- localStorage keys ----------
  var LS = {
    asset_edits:    'watad.asset.edits',
    point_edits:    'watad.point.edits',
    alarm_acks:     'watad.alarm.acks',
    alarm_extra:    'watad.alarm.extra',         // alarms raised by the simulator
    wo_created:     'watad.wo.created',
    wo_edits:       'watad.wo.edits',
    wo_deleted:     'watad.wo.deleted',
    sched_overrides:'watad.sched.overrides',
    integ_overrides:'watad.integ.overrides',
    settings:       'watad.settings.overrides',
    audit:          'watad.audit',
    ai_log_extra:   'watad.ai.log'
  };
  function jget(k, def) { try { return JSON.parse(localStorage.getItem(k)) || def; } catch (e) { return def; } }
  function jset(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

  // ---------- Merged views ----------
  function building()    { return window.WATAD_DATA.BUILDING; }
  function floors()      { return window.WATAD_DATA.FLOORS.slice(); }
  function zones()       { return window.WATAD_DATA.ZONES.slice(); }
  function schedules() {
    var ov = jget(LS.sched_overrides, {});
    return window.WATAD_DATA.SCHEDULES.map(function (s) { return ov[s.id] ? Object.assign({}, s, ov[s.id]) : s; });
  }
  function assets() {
    var edits = jget(LS.asset_edits, {});
    return window.WATAD_DATA.ASSETS.map(function (a) { return edits[a.id] ? Object.assign({}, a, edits[a.id]) : a; });
  }
  function points() {
    var edits = jget(LS.point_edits, {});
    return window.WATAD_DATA.POINTS.map(function (p) { return edits[p.id] ? Object.assign({}, p, edits[p.id]) : p; });
  }
  function alarms() {
    var seed = window.WATAD_DATA.ALARMS.slice();
    var extra = jget(LS.alarm_extra, []);
    var acks = jget(LS.alarm_acks, {});
    return seed.concat(extra).map(function (a) {
      var override = acks[a.id];
      if (override) return Object.assign({}, a, override);
      return a;
    });
  }
  function workOrders() {
    var seed = window.WATAD_DATA.WORK_ORDERS.slice();
    var created = jget(LS.wo_created, []);
    var edits = jget(LS.wo_edits, {});
    var deleted = jget(LS.wo_deleted, []);
    return seed.concat(created).filter(function (w) { return deleted.indexOf(w.id) === -1; })
      .map(function (w) { return edits[w.id] ? Object.assign({}, w, edits[w.id]) : w; });
  }
  function staff() { return window.WATAD_DATA.STAFF.slice(); }
  function integrations() {
    var ov = jget(LS.integ_overrides, {});
    return window.WATAD_DATA.INTEGRATIONS.map(function (i) { return ov[i.id] ? Object.assign({}, i, ov[i.id]) : i; });
  }
  function settings() {
    var ov = jget(LS.settings, {});
    return Object.assign({}, window.WATAD_DATA.SETTINGS, ov);
  }
  function energyHistory() { return window.WATAD_DATA.ENERGY_HISTORY.slice(); }
  function audit(action, target, details) {
    var log = jget(LS.audit, []);
    log.unshift({ id: 'a' + Date.now() + Math.random().toString(36).slice(2, 5), when: new Date().toISOString(), actor: 'st-rashid', action: action, target: target, details: details || '' });
    jset(LS.audit, log.slice(0, 200));
  }

  // ---------- Dashboard KPI computation ----------
  function dashboardKpis() {
    var sim = window.WatadSim || null;     // sim might not be loaded on every page
    var act = alarms().filter(function (a) { return !a.cleared_at; });
    var critical = act.filter(function (a) { return a.severity === 'critical'; }).length;
    var urgent = act.filter(function (a) { return a.severity === 'urgent'; }).length;
    var warning = act.filter(function (a) { return a.severity === 'warning'; }).length;
    var info = act.filter(function (a) { return a.severity === 'info'; }).length;

    // Current kW + zone temp + occupancy snapshots — use sim if available,
    // else fall back to plausible static numbers from seed.
    var s = settings();
    var kw, avgZone, occPct, kgCO2;
    if (sim && sim.points) {
      var mainKw = sim.points['as-meter-main.kw'];
      kw = mainKw ? mainKw.value : 220;
      var zoneTemps = Object.keys(sim.points).filter(function (k) { return /\.zone_temp$/.test(k); }).map(function (k) { return sim.points[k].value; });
      avgZone = zoneTemps.length ? (zoneTemps.reduce(function (s,v){return s+v;}, 0) / zoneTemps.length) : 72;
      var presence = Object.keys(sim.points).filter(function (k) { return /\.presence$/.test(k); }).map(function (k) { return sim.points[k].value; });
      occPct = presence.length ? Math.round((presence.filter(Boolean).length / presence.length) * 100) : 60;
    } else {
      kw = 220; avgZone = 72.4; occPct = 62;
    }
    // Today's kgCO2 — accumulator from sim or estimated from kw × hours since midnight
    var hoursSinceMidnight = (Date.now() - new Date().setHours(0,0,0,0)) / 3600000;
    var todayKwh = kw * hoursSinceMidnight;
    kgCO2 = todayKwh * s.co2_factor;

    return {
      alarms: { critical: critical, urgent: urgent, warning: warning, info: info, total: act.length },
      kw_now: +kw.toFixed(1),
      avg_zone_f: +avgZone.toFixed(1),
      occupancy_pct: occPct,
      today_kgco2: +kgCO2.toFixed(0),
      bacnet_status: { trunks: 3, points: points().length, gateway_ok: true }
    };
  }

  // ---------- Route handler ----------
  function handle(method, path, body, params) {
    var m;
    body = body || {}; params = params || {};

    /* ===== BUILDING + TOPOLOGY ===== */
    if (path === '/building'  && method === 'GET') return { ok: true, building: building() };
    if (path === '/floors'    && method === 'GET') return { ok: true, items: floors() };
    if (path === '/zones'     && method === 'GET') {
      var z = zones();
      if (params.floor) z = z.filter(function (x) { return x.floor_id === params.floor; });
      return { ok: true, items: z };
    }
    if (path === '/schedules' && method === 'GET') return { ok: true, items: schedules() };
    if ((m = path.match(/^\/schedules\/([^\/]+)$/)) && method === 'PUT') {
      var so = jget(LS.sched_overrides, {});
      so[m[1]] = Object.assign({}, so[m[1]] || {}, body);
      jset(LS.sched_overrides, so);
      audit('schedule.update', m[1], '');
      return { ok: true };
    }

    /* ===== ASSETS ===== */
    if (path === '/assets' && method === 'GET') {
      var rows = assets();
      if (params.floor) rows = rows.filter(function (a) { return a.floor_id === params.floor; });
      if (params.type)  rows = rows.filter(function (a) { return a.type === params.type; });
      if (params.zone)  rows = rows.filter(function (a) { return a.zone_id === params.zone; });
      return { ok: true, items: rows };
    }
    if ((m = path.match(/^\/assets\/([^\/]+)$/)) && method === 'GET') {
      var aid = m[1];
      var a = assets().find(function (x) { return x.id === aid; });
      if (!a) return { ok: false, error: 'not_found', status: 404 };
      var pts = points().filter(function (p) { return p.asset_id === aid; });
      var als = alarms().filter(function (x) { return x.asset_id === aid; });
      var wos = workOrders().filter(function (w) { return w.asset_id === aid; });
      return { ok: true, asset: a, points: pts, alarms: als, work_orders: wos };
    }
    if ((m = path.match(/^\/assets\/([^\/]+)$/)) && method === 'PUT') {
      var ae = jget(LS.asset_edits, {});
      ae[m[1]] = Object.assign({}, ae[m[1]] || {}, body);
      jset(LS.asset_edits, ae);
      audit('asset.update', m[1], JSON.stringify(body).slice(0, 80));
      return { ok: true };
    }

    /* ===== POINTS ===== */
    if (path === '/points' && method === 'GET') {
      var rows2 = points();
      if (params.asset) rows2 = rows2.filter(function (p) { return p.asset_id === params.asset; });
      return { ok: true, items: rows2 };
    }
    if ((m = path.match(/^\/points\/([^\/]+)$/)) && method === 'PUT') {
      var pe = jget(LS.point_edits, {});
      pe[m[1]] = Object.assign({}, pe[m[1]] || {}, body);
      jset(LS.point_edits, pe);
      // Inform the simulator so the new setpoint takes effect on next tick.
      if (window.WatadSim && body.setpoint != null) window.WatadSim.setPoint(m[1], { setpoint: body.setpoint });
      audit('point.setpoint', m[1], 'sp=' + body.setpoint);
      return { ok: true };
    }

    /* ===== ALARMS ===== */
    if (path === '/alarms' && method === 'GET') {
      var rows3 = alarms();
      if (params.status === 'active')   rows3 = rows3.filter(function (a) { return !a.cleared_at; });
      if (params.status === 'open')     rows3 = rows3.filter(function (a) { return !a.acknowledged_at && !a.cleared_at; });
      if (params.status === 'cleared')  rows3 = rows3.filter(function (a) { return !!a.cleared_at; });
      if (params.severity) rows3 = rows3.filter(function (a) { return a.severity === params.severity; });
      if (params.asset)    rows3 = rows3.filter(function (a) { return a.asset_id === params.asset; });
      rows3.sort(function (a, b) {
        var sevRank = { critical: 0, urgent: 1, warning: 2, info: 3 };
        var sa = sevRank[a.severity] || 9, sb = sevRank[b.severity] || 9;
        if (sa !== sb) return sa - sb;
        return new Date(b.raised_at) - new Date(a.raised_at);
      });
      return { ok: true, items: rows3 };
    }
    if ((m = path.match(/^\/alarms\/([^\/]+)\/ack$/)) && method === 'POST') {
      var ackMap = jget(LS.alarm_acks, {});
      ackMap[m[1]] = Object.assign({}, ackMap[m[1]] || {}, {
        acknowledged_at: new Date().toISOString(),
        ack_by: body.ack_by || 'st-rashid',
        ack_note: body.note || ''
      });
      jset(LS.alarm_acks, ackMap);
      audit('alarm.ack', m[1], body.note || '');
      return { ok: true };
    }
    if ((m = path.match(/^\/alarms\/([^\/]+)\/clear$/)) && method === 'POST') {
      var ackMap2 = jget(LS.alarm_acks, {});
      ackMap2[m[1]] = Object.assign({}, ackMap2[m[1]] || {}, {
        cleared_at: new Date().toISOString(),
        cleared_by: body.cleared_by || 'st-rashid'
      });
      jset(LS.alarm_acks, ackMap2);
      audit('alarm.clear', m[1], '');
      return { ok: true };
    }
    // Internal endpoint the simulator uses to push a new alarm into the
    // persistent stream so it survives the page-reload cycle.
    if (path === '/alarms/_sim_raise' && method === 'POST') {
      var x = jget(LS.alarm_extra, []);
      x.push(body);
      jset(LS.alarm_extra, x);
      return { ok: true };
    }
    if (path === '/alarms/_sim_clear' && method === 'POST') {
      // mark cleared via the acks map
      var ackMap3 = jget(LS.alarm_acks, {});
      ackMap3[body.id] = Object.assign({}, ackMap3[body.id] || {}, { cleared_at: new Date().toISOString(), cleared_by: 'sim' });
      jset(LS.alarm_acks, ackMap3);
      return { ok: true };
    }

    /* ===== WORK ORDERS ===== */
    if (path === '/work-orders' && method === 'GET') {
      var rows4 = workOrders();
      if (params.status) rows4 = rows4.filter(function (w) { return w.status === params.status; });
      if (params.asset)  rows4 = rows4.filter(function (w) { return w.asset_id === params.asset; });
      if (params.q) { var q = String(params.q).toLowerCase(); rows4 = rows4.filter(function (w) { return (w.title + ' ' + (w.description || '')).toLowerCase().indexOf(q) !== -1; }); }
      rows4.sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
      return { ok: true, items: rows4 };
    }
    if (path === '/work-orders' && method === 'POST') {
      var nid = 'wo-' + Date.now();
      var maxNo = workOrders().reduce(function (m2, w) { var n = parseInt((w.wo_no || '').replace(/[^0-9]/g, ''), 10) || 0; return n > m2 ? n : m2; }, 1000);
      var nW = Object.assign({
        id: nid,
        wo_no: 'WO-' + (maxNo + 1),
        status: 'open',
        priority: 'med',
        created_at: new Date().toISOString(),
        comments: [],
        parts: []
      }, body);
      var c = jget(LS.wo_created, []); c.unshift(nW); jset(LS.wo_created, c);
      audit('wo.create', nid, body.title || '');
      return { ok: true, work_order: nW };
    }
    if ((m = path.match(/^\/work-orders\/([^\/]+)$/)) && method === 'GET') {
      var w0 = workOrders().find(function (x) { return x.id === m[1]; });
      if (!w0) return { ok: false, error: 'not_found', status: 404 };
      return { ok: true, work_order: w0 };
    }
    if ((m = path.match(/^\/work-orders\/([^\/]+)$/)) && method === 'PUT') {
      var we = jget(LS.wo_edits, {});
      we[m[1]] = Object.assign({}, we[m[1]] || {}, body);
      jset(LS.wo_edits, we);
      audit('wo.update', m[1], JSON.stringify(body).slice(0, 80));
      return { ok: true };
    }
    if ((m = path.match(/^\/work-orders\/([^\/]+)$/)) && method === 'DELETE') {
      var wd = jget(LS.wo_deleted, []);
      if (wd.indexOf(m[1]) === -1) wd.push(m[1]);
      jset(LS.wo_deleted, wd);
      audit('wo.delete', m[1], '');
      return { ok: true };
    }
    if ((m = path.match(/^\/work-orders\/([^\/]+)\/comments$/)) && method === 'POST') {
      var we2 = jget(LS.wo_edits, {});
      var cur = workOrders().find(function (x) { return x.id === m[1]; });
      if (!cur) return { ok: false, error: 'not_found', status: 404 };
      var existing = (we2[m[1]] && we2[m[1]].comments) || cur.comments || [];
      existing = existing.concat([{ at: new Date().toISOString(), by: body.by || 'st-rashid', body: body.body || '' }]);
      we2[m[1]] = Object.assign({}, we2[m[1]] || {}, { comments: existing });
      jset(LS.wo_edits, we2);
      audit('wo.comment', m[1], (body.body || '').slice(0, 80));
      return { ok: true };
    }

    /* ===== STAFF + INTEGRATIONS ===== */
    if (path === '/staff' && method === 'GET') return { ok: true, items: staff() };
    if (path === '/integrations' && method === 'GET') return { ok: true, items: integrations() };
    if ((m = path.match(/^\/integrations\/([^\/]+)$/)) && method === 'POST') {
      var io = jget(LS.integ_overrides, {});
      var cur2 = integrations().find(function (x) { return x.id === m[1]; });
      if (!cur2) return { ok: false, error: 'not_found', status: 404 };
      var newStatus = cur2.status === 'connected' ? 'disconnected' : 'connected';
      io[m[1]] = { status: newStatus, connected_at: newStatus === 'connected' ? new Date().toISOString() : null };
      jset(LS.integ_overrides, io);
      audit('integration.' + (newStatus === 'connected' ? 'connect' : 'disconnect'), m[1], '');
      return { ok: true };
    }

    /* ===== ENERGY ===== */
    if (path === '/energy/history' && method === 'GET') {
      var rows5 = energyHistory();
      if (params.meter) rows5 = rows5.filter(function (r) { return r.meter_id === params.meter; });
      if (params.from)  rows5 = rows5.filter(function (r) { return r.date >= params.from; });
      return { ok: true, items: rows5 };
    }

    /* ===== ADMIN ===== */
    if (path === '/admin/dashboard' && method === 'GET') {
      var kpis = dashboardKpis();
      var recentAlarms = alarms().sort(function (a, b) { return new Date(b.raised_at) - new Date(a.raised_at); }).slice(0, 8);
      // Top-5 alarming assets by raise count
      var byAsset = {};
      alarms().forEach(function (a) { byAsset[a.asset_id] = (byAsset[a.asset_id] || 0) + 1; });
      var assetMap = {}; assets().forEach(function (a) { assetMap[a.id] = a; });
      var topAlarming = Object.keys(byAsset)
        .map(function (id) { return { asset: assetMap[id] || { name: id }, count: byAsset[id] }; })
        .sort(function (a, b) { return b.count - a.count; })
        .slice(0, 5);
      // 7-day energy total per day across all meters
      var byDay = {};
      energyHistory().forEach(function (r) { byDay[r.date] = (byDay[r.date] || 0) + r.kwh; });
      var dayKeys = Object.keys(byDay).sort().slice(-7);
      var weekly = dayKeys.map(function (k) {
        var d = new Date(k + 'T00:00:00');
        return { label: d.toLocaleString('en', { weekday: 'short' }), kwh: byDay[k] };
      });
      // Hour-of-day alarm heatmap
      var byHour = Array(24).fill(0);
      alarms().forEach(function (a) { byHour[new Date(a.raised_at).getHours()]++; });
      return {
        ok: true,
        kpis: kpis,
        recent_alarms: recentAlarms,
        top_alarming: topAlarming,
        weekly_kwh: weekly,
        by_hour: byHour
      };
    }
    if (path === '/admin/audit' && method === 'GET') return { ok: true, items: jget(LS.audit, []) };
    if (path === '/admin/settings' && method === 'GET') return { ok: true, settings: settings() };
    if (path === '/admin/settings' && method === 'POST') {
      var so2 = jget(LS.settings, {});
      jset(LS.settings, Object.assign({}, so2, body));
      audit('settings.update', '', JSON.stringify(body).slice(0, 80));
      return { ok: true };
    }
    if (path === '/admin/ai-logs' && method === 'GET') {
      var rows6 = jget(LS.ai_log_extra, []).slice();
      if (params.limit) rows6 = rows6.slice(0, +params.limit);
      return { ok: true, items: rows6 };
    }
    if (path === '/admin/ai-logs' && method === 'POST') {
      var ex = jget(LS.ai_log_extra, []);
      ex.unshift(Object.assign({ id: 'ail-' + Date.now(), at: new Date().toISOString() }, body));
      jset(LS.ai_log_extra, ex.slice(0, 200));
      return { ok: true };
    }
    if (path === '/admin/ai-logs/rate' && method === 'POST') {
      var rx = jget(LS.ai_log_extra, []);
      rx.unshift({
        id: 'air-' + Date.now(),
        at: body.at || new Date().toISOString(),
        feature: body.feature || 'unknown',
        model: body.model || 'unknown',
        rating: body.rating,
        fallback: !!body.fallback,
        kind: 'rating'
      });
      jset(LS.ai_log_extra, rx.slice(0, 200));
      audit('ai.rate', body.feature || 'unknown', body.rating);
      return { ok: true };
    }
    if (path === '/admin/reset-demo' && method === 'POST') {
      Object.keys(LS).forEach(function (k) { localStorage.removeItem(LS[k]); });
      if (window.WatadSim && window.WatadSim.reset) window.WatadSim.reset();
      return { ok: true };
    }

    return { ok: false, error: 'unknown_route', status: 404 };
  }

  // ---------- Fetch intercept ----------
  var origFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var idx = url.indexOf('/watad/api');
    // /api/watad/ai/* is handled by the Worker / ai-engine; pass through.
    if (idx === -1 || url.indexOf('/api/watad/ai/') !== -1)
      return origFetch ? origFetch(input, init) : Promise.reject(new Error('no fetch'));
    init = init || {};
    var method = (init.method || 'GET').toUpperCase();
    var pathAndQuery = url.slice(idx + '/watad/api'.length).split('?');
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
})();
