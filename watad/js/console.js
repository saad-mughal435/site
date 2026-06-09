/* console.js - Watad operations console. The centrepiece page.
 *
 * Four regions wired to the live telemetry simulator:
 *  - Top KPI strip (alarms count by severity, kW, avg zone temp, occupancy %, kgCO₂, BACnet status)
 *  - Floor plan (delegates to floorplan.js) with floor switcher
 *  - Alarm queue side panel (Ack / Create-WO / ✦ Explain with AI)
 *  - Bottom trend strip - 3 mini SVG line charts (kW, avg zone temp, alarm count)
 *
 * Sim ticks every 5s → diff-render each region (no flicker). Audio cue +
 * card flash on new alarm. Same proven pattern as pos/js/kitchen.js.
 */
(function () {
  'use strict';
  var D = window.WATAD_DATA;
  var $ = function (id) { return document.getElementById(id); };
  var esc = WatadApp.escapeHtml;

  // Local rolling buffers for the trend strip (last ~12 ticks = ~1 minute)
  var trends = {
    kw:        [],   // {t, v}
    zone_avg:  [],
    alarms:    []
  };
  var TREND_LEN = 60;
  var currentFloorId = 'fl-l1';   // default to L1 office floor
  var seenAlarmIds = new Set();

  // ---------- Mode badge ----------
  WatadAI.health().then(function (h) {
    var el = $('mode-badge'); if (!el) return;
    var nm = h.model.indexOf('haiku') !== -1 ? 'Haiku 4.5' : h.model.indexOf('sonnet') !== -1 ? 'Sonnet 4.6' : 'Opus 4.7';
    el.className = h.live ? 'wtd-mode-badge live' : 'wtd-mode-badge';
    el.textContent = h.live ? 'Live · ' + nm : 'Demo mode';
    el.title = h.live ? 'Connected to Claude via Worker proxy' : 'Running with deterministic mock replies - see watad/README.md for live setup';
  });

  // ---------- Floor tabs ----------
  function renderFloorTabs() {
    var html = D.FLOORS.slice().sort(function (a, b) { return b.level - a.level; }).map(function (f) {
      return '<button class="wtd-floor-tab' + (f.id === currentFloorId ? ' is-active' : '') + '" data-floor="' + f.id + '">' + esc(f.name) + '</button>';
    }).join('');
    $('floor-tabs').innerHTML = html;
    $('floor-tabs').querySelectorAll('[data-floor]').forEach(function (b) {
      b.addEventListener('click', function () {
        currentFloorId = b.getAttribute('data-floor');
        renderFloorTabs();
        WatadFloorPlan.render($('floor-canvas'), currentFloorId);
        updateFloorMeta();
      });
    });
  }
  function updateFloorMeta() {
    var f = D.FLOORS.find(function (x) { return x.id === currentFloorId; });
    if (!f) return;
    var zones = D.ZONES.filter(function (z) { return z.floor_id === currentFloorId; }).length;
    var assets = D.ASSETS.filter(function (a) { return a.floor_id === currentFloorId; }).length;
    $('floor-meta').textContent = zones + ' zones · ' + assets + ' assets · ' + (f.area_sqft / 1000).toFixed(0) + 'k ft²';
  }

  // ---------- KPI strip ----------
  function renderKpis() {
    var sim = window.WatadSim;
    var act = sim ? Object.values(sim.alarmsByPoint || {}) : [];
    var critical = act.filter(function (a) { return a.severity === 'critical'; }).length;
    var urgent = act.filter(function (a) { return a.severity === 'urgent'; }).length;
    var warning = act.filter(function (a) { return a.severity === 'warning'; }).length;
    var info = act.filter(function (a) { return a.severity === 'info'; }).length;

    var mainKwPt = sim && sim.points['as-meter-main.kw'];
    var kw = mainKwPt ? mainKwPt.value : 220;
    var zonePts = sim ? Object.keys(sim.points).filter(function (k) { return /\.zone_temp$/.test(k); }).map(function (k) { return sim.points[k].value; }) : [];
    var avgZone = zonePts.length ? (zonePts.reduce(function (s, v) { return s + v; }, 0) / zonePts.length) : 72;
    var presence = sim ? Object.keys(sim.points).filter(function (k) { return /\.presence$/.test(k); }).map(function (k) { return sim.points[k].value; }) : [];
    var occ = presence.length ? Math.round((presence.filter(Boolean).length / presence.length) * 100) : 60;
    var s = D.SETTINGS;
    var hoursMidnight = (Date.now() - new Date().setHours(0,0,0,0)) / 3600000;
    var kgCO2 = Math.round(kw * hoursMidnight * s.co2_factor);

    var alarmsCls = critical > 0 ? 'is-danger' : urgent > 0 ? 'is-danger' : warning > 0 ? 'is-warn' : 'is-ok';
    var occCls = occ > 75 ? 'is-warn' : 'is-ok';

    $('kpi-strip').innerHTML =
        tile('🔴', 'Active alarms', (critical + urgent + warning + info), (critical ? critical + ' crit · ' : '') + (urgent ? urgent + ' urgent · ' : '') + warning + ' warn · ' + info + ' info', alarmsCls)
      + tile('⚡', 'Real power', kw.toFixed(1) + ' kW', 'main meter · live', '')
      + tile('🌡', 'Avg zone temp', avgZone.toFixed(1) + '°F', 'across ' + zonePts.length + ' zones', avgZone > 76 ? 'is-warn' : avgZone < 68 ? 'is-warn' : 'is-ok')
      + tile('👥', 'Occupancy', occ + '%', presence.length + ' sensors', occCls)
      + tile('🌳', 'Today kgCO₂', kgCO2, 'grid factor ' + s.co2_factor + ' kg/kWh', '');
    // Update the count badge in the alarm side panel + the BACnet pill
    $('alarms-count').textContent = act.length;
  }
  function tile(icon, label, value, sub, cls) {
    return '<div class="wtd-kpi-tile ' + (cls || '') + '">'
      + '<span class="wtd-kpi-tile-icon">' + icon + '</span>'
      + '<div>'
      +   '<div class="wtd-kpi-tile-label">' + esc(label) + '</div>'
      +   '<div class="wtd-kpi-tile-value">' + esc(String(value)) + '</div>'
      +   '<div class="wtd-kpi-tile-sub">' + esc(sub) + '</div>'
      + '</div>'
      + '</div>';
  }

  // ---------- Alarm queue ----------
  function renderAlarms() {
    var sim = window.WatadSim;
    var list = sim ? Object.values(sim.alarmsByPoint || {}) : [];
    // Sort by severity, then age
    list = WatadApp.severitySort(list).sort(function (a, b) {
      var rank = { critical: 0, urgent: 1, warning: 2, info: 3 };
      var sa = rank[a.severity], sb = rank[b.severity];
      if (sa !== sb) return sa - sb;
      return new Date(b.raised_at) - new Date(a.raised_at);
    });
    var assetMap = {}; D.ASSETS.forEach(function (a) { assetMap[a.id] = a; });

    if (!list.length) {
      $('alarms-list').innerHTML = '<div class="wtd-empty" style="padding:40px 20px;"><div class="wtd-empty-mark">✓</div><strong>All clear.</strong><div style="font-size:12px;margin-top:6px;">No active alarms.</div></div>';
      return;
    }
    $('alarms-list').innerHTML = list.map(function (a) {
      var asset = assetMap[a.asset_id] || { name: a.asset_id };
      var isNew = !seenAlarmIds.has(a.id);
      return '<div class="wtd-alarm-card' + (isNew ? ' is-new' : '') + '" data-alarm-id="' + esc(a.id) + '">'
        + '<div class="wtd-alarm-dot ' + a.severity + '"></div>'
        + '<div class="wtd-alarm-body">'
        +   '<div class="wtd-alarm-title">' + esc(a.title) + '</div>'
        +   '<div class="wtd-alarm-meta">' + esc(asset.name) + ' · ' + WatadApp.timeAgo(a.raised_at) + '</div>'
        +   '<div class="wtd-alarm-actions">'
        +     '<button class="wtd-btn wtd-btn--sm" data-ack="' + esc(a.id) + '">Ack</button>'
        +     '<button class="wtd-btn wtd-btn--sm" data-wo="' + esc(a.id) + '">Create WO</button>'
        +     '<button class="wtd-btn wtd-btn--sm" data-ai="' + esc(a.id) + '" title="Explain with AI">✦ Explain</button>'
        +     '<a class="wtd-btn wtd-btn--sm" href="asset.html?id=' + esc(a.asset_id) + '" title="Drill into asset" style="text-decoration:none;">→</a>'
        +   '</div>'
        + '</div>'
        + '</div>';
    }).join('');
    list.forEach(function (a) { seenAlarmIds.add(a.id); });
    // Wire buttons
    $('alarms-list').querySelectorAll('[data-ack]').forEach(function (b) {
      b.addEventListener('click', function () { ackAlarm(b.getAttribute('data-ack')); });
    });
    $('alarms-list').querySelectorAll('[data-wo]').forEach(function (b) {
      b.addEventListener('click', function () { createWoFromAlarm(b.getAttribute('data-wo')); });
    });
    $('alarms-list').querySelectorAll('[data-ai]').forEach(function (b) {
      b.addEventListener('click', function () { explainAlarmModal(b.getAttribute('data-ai')); });
    });
  }
  function ackAlarm(id) {
    WatadApp.api('/alarms/' + id + '/ack', { method: 'POST', body: { ack_by: 'st-rashid' } }).then(function () {
      // The sim doesn't (yet) know about the ack; visually clear from queue.
      if (window.WatadSim && window.WatadSim.alarmsByPoint) {
        Object.keys(window.WatadSim.alarmsByPoint).forEach(function (k) {
          if (window.WatadSim.alarmsByPoint[k].id === id) delete window.WatadSim.alarmsByPoint[k];
        });
      }
      window.toast('Alarm acknowledged', 'success');
      renderAlarms(); renderKpis();
    });
  }
  function createWoFromAlarm(id) {
    var alarm = Object.values((window.WatadSim && window.WatadSim.alarmsByPoint) || {}).find(function (a) { return a.id === id; });
    if (!alarm) return;
    var asset = D.ASSETS.find(function (a) { return a.id === alarm.asset_id; }) || { name: alarm.asset_id };
    WatadApp.showModal({
      title: 'Create work order from alarm',
      body:
        '<div class="wtd-field" style="margin-bottom:10px;"><span>Title</span><input class="wtd-input" id="wo-title" value="' + esc(alarm.title) + '" /></div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">'
        +   '<div class="wtd-field"><span>Asset</span><input class="wtd-input" disabled value="' + esc(asset.name) + '" /></div>'
        +   '<div class="wtd-field"><span>Priority</span><select class="wtd-select" id="wo-prio"><option value="low">Low</option><option value="med">Medium</option><option value="high" selected>High</option><option value="urgent"' + (alarm.severity === 'critical' || alarm.severity === 'urgent' ? ' selected' : '') + '>Urgent</option></select></div>'
        + '</div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">'
        +   '<div class="wtd-field"><span>Assignee</span><select class="wtd-select" id="wo-assignee">'
        +     D.STAFF.filter(function (s) { return s.role !== 'admin'; }).map(function (s) { return '<option value="' + s.id + '">' + esc(s.name) + ' · ' + s.role + '</option>'; }).join('')
        +   '</select></div>'
        +   '<div class="wtd-field"><span>Due in (hours)</span><input class="wtd-input" id="wo-due" type="number" value="' + (alarm.severity === 'critical' ? 1 : alarm.severity === 'urgent' ? 4 : 24) + '" /></div>'
        + '</div>'
        + '<div class="wtd-field"><span>Description</span><textarea class="wtd-textarea" id="wo-desc" rows="3">Alarm: ' + esc(alarm.title) + '\n\nFrom Watad console at ' + new Date().toLocaleString() + '.</textarea></div>',
      foot: '<button class="wtd-btn" data-modal-close>Cancel</button><button class="wtd-btn wtd-btn--primary" id="wo-go">Create work order</button>',
      onMount: function (el, close) {
        el.querySelector('#wo-go').addEventListener('click', function () {
          var due = parseFloat(el.querySelector('#wo-due').value) || 24;
          var body = {
            title: el.querySelector('#wo-title').value.trim(),
            asset_id: alarm.asset_id,
            priority: el.querySelector('#wo-prio').value,
            assignee_id: el.querySelector('#wo-assignee').value,
            description: el.querySelector('#wo-desc').value,
            due: new Date(Date.now() + due * 3600000).toISOString()
          };
          WatadApp.api('/work-orders', { method: 'POST', body: body }).then(function (r) {
            window.toast('Created ' + (r.body.work_order ? r.body.work_order.wo_no : 'work order'), 'success');
            close();
          });
        });
      }
    });
  }
  function explainAlarmModal(id) {
    var alarm = Object.values((window.WatadSim && window.WatadSim.alarmsByPoint) || {}).find(function (a) { return a.id === id; });
    if (!alarm) return;
    var asset = D.ASSETS.find(function (a) { return a.id === alarm.asset_id; }) || {};
    var bodyHtml = '<div class="wtd-ai-panel" id="ai-body"><div class="wtd-ai-loading"></div> Asking AI…</div>'
      + '<div style="font-size:12px;color:var(--wtd-muted);">Alarm: <strong style="color:var(--wtd-ink);">' + esc(alarm.title) + '</strong></div>';
    var m = WatadApp.showModal({
      title: '✦ Explain alarm with AI',
      body: bodyHtml,
      foot: '<button class="wtd-btn" data-modal-close>Close</button><button class="wtd-btn wtd-btn--primary" id="ai-ack">Acknowledge alarm</button>',
      onMount: function (el, close) {
        el.querySelector('#ai-ack').addEventListener('click', function () { ackAlarm(id); close(); });
        WatadAI.explainAlarm({ alarm: alarm, asset: asset }).then(function (r) {
          el.querySelector('#ai-body').innerHTML =
              '<h4>✦ AI explanation ' + (r.fallback ? '<span class="wtd-mode-badge" style="margin-inline-start:8px;font-size:9.5px;padding:1px 8px;">mock</span>' : '<span class="wtd-mode-badge live" style="margin-inline-start:8px;font-size:9.5px;padding:1px 8px;">live</span>') + '</h4>'
            + '<div style="font-size:13.5px;line-height:1.6;white-space:pre-wrap;">' + esc(r.text).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>') + '</div>'
            + '<div style="margin-top:8px;font-size:10.5px;color:var(--wtd-muted);font-family:var(--font-mono);">' + (r.model || '?') + ' · ' + r.latency_ms + 'ms</div>';
        });
      }
    });
  }

  // ---------- Trend strip ----------
  function pushTrend(t, v, buf) {
    buf.push({ t: t, v: v });
    if (buf.length > TREND_LEN) buf.shift();
  }
  function renderTrends() {
    var nowMs = Date.now();
    $('trends-strip').innerHTML =
        trendCard('Real power', 'kW', trends.kw, { yMin: 0 })
      + trendCard('Avg zone temp', '°F', trends.zone_avg, { yMin: 65, yMax: 80, band: [68, 76] })
      + trendCard('Active alarms', '', trends.alarms, { yMin: 0 });
  }
  function trendCard(label, unit, data, opts) {
    var v = data.length ? data[data.length - 1].v : 0;
    var pts = data.map(function (d, i) { return { x: i, y: d.v }; });
    return '<div class="wtd-trend">'
      + '<div class="wtd-trend-head"><span class="wtd-trend-label">' + label + '</span><span class="wtd-trend-value">' + (typeof v === 'number' ? v.toFixed(unit === '' ? 0 : 1) : v) + (unit ? ' ' + unit : '') + '</span></div>'
      + WatadApp.lineChart(pts, Object.assign({ w: 300, h: 70, pad: 6 }, opts || {}))
      + '</div>';
  }

  // ---------- Main render loop ----------
  function fullRender() {
    renderKpis();
    renderAlarms();
    renderTrends();
    WatadFloorPlan.refreshAlarms($('floor-canvas'));
    WatadFloorPlan.refreshTooltips($('floor-canvas'));
  }
  function onTick(ev) {
    if (ev.type === 'tick') {
      // Push trend samples
      var sim = window.WatadSim;
      var kw = sim && sim.points['as-meter-main.kw'] ? sim.points['as-meter-main.kw'].value : 0;
      var zonePts = sim ? Object.keys(sim.points).filter(function (k) { return /\.zone_temp$/.test(k); }).map(function (k) { return sim.points[k].value; }) : [];
      var avgZone = zonePts.length ? (zonePts.reduce(function (s, v) { return s + v; }, 0) / zonePts.length) : 72;
      var alarmCount = sim ? Object.keys(sim.alarmsByPoint || {}).length : 0;
      pushTrend(ev.tickCount, kw, trends.kw);
      pushTrend(ev.tickCount, avgZone, trends.zone_avg);
      pushTrend(ev.tickCount, alarmCount, trends.alarms);
      fullRender();
    } else if (ev.type === 'alarm-new') {
      if (window.WatadAudio) window.WatadAudio.alarm(ev.alarm.severity);
      window.toast('New alarm · ' + ev.alarm.title, ev.alarm.severity === 'critical' ? 'error' : 'warn', 4000);
    }
  }

  // ---------- Init ----------
  function init() {
    // Seed trend buffers with the most recent 12 samples from sim history
    var sim = window.WatadSim;
    if (sim) {
      var kwHist = sim.getHistory('as-meter-main.kw').slice(-TREND_LEN);
      kwHist.forEach(function (s, i) { trends.kw.push({ t: i, v: s.v }); });
      var zonePts = Object.keys(sim.points).filter(function (k) { return /\.zone_temp$/.test(k); });
      var byTick = {};
      zonePts.forEach(function (k) {
        sim.getHistory(k).slice(-TREND_LEN).forEach(function (s, i) {
          if (!byTick[i]) byTick[i] = [];
          byTick[i].push(s.v);
        });
      });
      Object.keys(byTick).forEach(function (i) { trends.zone_avg.push({ t: +i, v: byTick[i].reduce(function (a, b) { return a + b; }, 0) / byTick[i].length }); });
      for (var i = 0; i < TREND_LEN; i++) trends.alarms.push({ t: i, v: Object.keys(sim.alarmsByPoint || {}).length });
    }

    // BACnet status pill - single-sourced from the live data so it never drifts
    var bacnetPill = $('bacnet-pill');
    if (bacnetPill) bacnetPill.textContent = '3 trunks · ' + D.POINTS.length + ' points · gateway online';

    renderFloorTabs();
    updateFloorMeta();
    WatadFloorPlan.render($('floor-canvas'), currentFloorId);
    fullRender();

    if (window.WatadSim) {
      window.WatadSim.subscribe(onTick);
      window.WatadSim.start();
    }
  }

  // The sim must initialise after data + sim scripts load; init when DOM is ready
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
