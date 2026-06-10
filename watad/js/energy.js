/* energy.js - Watad energy dashboard.
 *  - KPI tiles (today kWh, kgCO₂, cost AED, peak kW, vs-yesterday)
 *  - 30-day daily bar chart with ASHRAE 90.1 reference band
 *  - Sub-meter table (% of total + trend arrow)
 *  - Demand-response event schedule (fabricated DEWA DSM windows)
 *  - AI panel: optimise setpoints
 */
(function () {
  'use strict';
  var D = window.WATAD_DATA;
  var $ = function (id) { return document.getElementById(id); };
  var esc = WatadApp.escapeHtml;

  if (window.WatadSim && !window.WatadSim.started) window.WatadSim.start();

  // Mode badge
  WatadAI.health().then(function (h) {
    var el = $('mode-badge'); if (!el) return;
    var nm = h.model.indexOf("fast") !== -1 ? 'Fast' : h.model.indexOf("balanced") !== -1 ? 'Balanced' : 'Max';
    el.className = h.live ? 'wtd-mode-badge live' : 'wtd-mode-badge';
    el.textContent = h.live ? 'Live · ' + nm : 'Demo mode';
  });

  function load() {
    WatadApp.api('/energy/history').then(function (r) {
      var rows = r.body.items;
      renderKpis(rows);
      renderDemandChart(rows);
      renderMeterTable(rows);
      renderDr();
    });
  }

  function renderKpis(rows) {
    var s = D.SETTINGS;
    var today = new Date().toISOString().slice(0, 10);
    var yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    var totalToday = rows.filter(function (r) { return r.date === today; }).reduce(function (s, r) { return s + r.kwh; }, 0);
    var totalY = rows.filter(function (r) { return r.date === yesterday; }).reduce(function (s, r) { return s + r.kwh; }, 0);
    var deltaPct = totalY ? ((totalToday - totalY) / totalY) * 100 : 0;
    var totalMonth = rows.reduce(function (s, r) { return s + r.kwh; }, 0);
    var cost = totalToday * s.energy_tariff;
    var kgCO2 = totalToday * s.co2_factor;
    var peakKw = Math.max.apply(null, rows.filter(function (r) { return r.date === today; }).map(function (r) { return r.peak_kw; }).concat([0]));

    $('kpis').innerHTML =
        kpi('Today kWh', totalToday.toFixed(0), (deltaPct >= 0 ? '+' : '') + deltaPct.toFixed(1) + '% vs yesterday', deltaPct > 5 ? 'is-warn' : deltaPct < -5 ? 'is-ok' : '')
      + kpi('Cost today', 'AED ' + cost.toFixed(0), 'tariff ' + s.energy_tariff + ' /kWh', '')
      + kpi('kgCO₂ today', kgCO2.toFixed(0), 'grid factor ' + s.co2_factor + ' kg/kWh', '')
      + kpi('Peak kW today', peakKw.toFixed(0), '', '')
      + kpi('30-day total', (totalMonth / 1000).toFixed(1) + ' MWh', 'across ' + rows.filter(function (r) { return r.date === today; }).length + ' meters', '');
  }
  function kpi(label, value, sub, cls) {
    return '<div class="wtd-kpi ' + (cls || '') + '">'
      + '<div class="wtd-kpi-label">' + esc(label) + '</div>'
      + '<div class="wtd-kpi-value">' + esc(String(value)) + '</div>'
      + (sub ? '<div class="wtd-kpi-sub">' + esc(sub) + '</div>' : '')
      + '</div>';
  }

  function renderDemandChart(rows) {
    var byDay = {};
    rows.forEach(function (r) { byDay[r.date] = (byDay[r.date] || 0) + r.kwh; });
    var days = Object.keys(byDay).sort();
    var maxDay = Math.max.apply(null, days.map(function (d) { return byDay[d]; }));
    var avgDay = days.reduce(function (s, d) { return s + byDay[d]; }, 0) / days.length;
    // ASHRAE 90.1 reference band: 75-95% of average is "in target"
    var bandLo = avgDay * 0.75, bandHi = avgDay * 0.95;
    var w = 1000, h = 240, pad = 36;
    var bw = (w - pad * 2) / days.length - 3;
    var bars = days.map(function (d, i) {
      var v = byDay[d];
      var hh = Math.max(2, (v / maxDay) * (h - pad * 2));
      var x = pad + i * ((w - pad * 2) / days.length);
      var y = h - pad - hh;
      var col = v > bandHi ? '#fbbf24' : v < bandLo ? '#4ade80' : '#22d3ee';
      return '<rect x="' + x + '" y="' + y + '" width="' + bw + '" height="' + hh + '" fill="' + col + '" rx="2"/>';
    }).join('');
    // ASHRAE band overlay (translucent green)
    var bandY1 = h - pad - (bandHi / maxDay) * (h - pad * 2);
    var bandY2 = h - pad - (bandLo / maxDay) * (h - pad * 2);
    var bandRect = '<rect x="' + pad + '" y="' + bandY1 + '" width="' + (w - pad * 2) + '" height="' + (bandY2 - bandY1) + '" fill="rgba(74,222,128,0.12)"/>';
    // Y-axis labels
    var yLabels = '';
    for (var i = 0; i <= 4; i++) {
      var v = (maxDay * i) / 4;
      var y = h - pad - (v / maxDay) * (h - pad * 2);
      yLabels += '<text x="' + (pad - 6) + '" y="' + (y + 4) + '" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="10" fill="#5b6b85">' + v.toFixed(0) + '</text>';
      yLabels += '<line x1="' + pad + '" y1="' + y + '" x2="' + (w - pad) + '" y2="' + y + '" stroke="rgba(15,26,48,0.08)" stroke-width="0.5"/>';
    }
    // X-axis date labels (every 5th day)
    var xLabels = days.map(function (d, i) {
      if (i % 5 !== 0 && i !== days.length - 1) return '';
      var x = pad + i * ((w - pad * 2) / days.length) + bw / 2;
      return '<text x="' + x + '" y="' + (h - pad + 14) + '" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10" fill="#5b6b85">' + d.slice(5) + '</text>';
    }).join('');
    $('demand-chart').innerHTML =
        '<svg viewBox="0 0 ' + w + ' ' + h + '" style="display:block;width:100%;height:auto;">'
      + bandRect + yLabels + bars + xLabels
      + '<text x="' + (w / 2) + '" y="14" text-anchor="middle" font-family="Inter, sans-serif" font-size="10.5" fill="#4ade80" font-weight="700">ASHRAE 90.1 target band</text>'
      + '</svg>';
  }

  function renderMeterTable(rows) {
    var today = new Date().toISOString().slice(0, 10);
    var yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    var meterMap = {}; D.ASSETS.filter(function (a) { return a.type === 'meter'; }).forEach(function (m) { meterMap[m.id] = m; });
    var todayByMeter = {}, yByMeter = {};
    rows.forEach(function (r) {
      if (r.date === today) todayByMeter[r.meter_id] = r.kwh;
      if (r.date === yesterday) yByMeter[r.meter_id] = r.kwh;
    });
    var total = Object.values(todayByMeter).reduce(function (s, v) { return s + v; }, 0) || 1;
    var sorted = Object.keys(todayByMeter).map(function (id) {
      var t = todayByMeter[id]; var y = yByMeter[id] || t;
      return { id: id, kwh: t, pct: (t / total) * 100, delta: y ? ((t - y) / y) * 100 : 0 };
    }).sort(function (a, b) { return b.kwh - a.kwh; });
    $('meter-table').innerHTML =
        '<table class="wtd-table"><thead><tr><th>Meter</th><th style="text-align:right;">kWh today</th><th style="text-align:right;">% of total</th><th style="text-align:right;">vs yesterday</th></tr></thead><tbody>'
      + sorted.map(function (s) {
          var m = meterMap[s.id] || { name: s.id };
          var deltaIcon = s.delta > 5 ? '🔺' : s.delta < -5 ? '🔻' : '-';
          var deltaCol = s.delta > 5 ? 'var(--wtd-amber)' : s.delta < -5 ? 'var(--wtd-green-2)' : 'var(--wtd-muted-light)';
          return '<tr>'
            + '<td><strong>' + esc(m.name) + '</strong></td>'
            + '<td style="text-align:right;font-family:var(--font-mono);font-weight:700;">' + s.kwh.toFixed(0) + '</td>'
            + '<td style="text-align:right;font-family:var(--font-mono);">' + s.pct.toFixed(1) + '%</td>'
            + '<td style="text-align:right;font-family:var(--font-mono);color:' + deltaCol + ';">' + deltaIcon + ' ' + (s.delta >= 0 ? '+' : '') + s.delta.toFixed(1) + '%</td>'
            + '</tr>';
        }).join('')
      + '</tbody></table>';
  }

  function renderDr() {
    // Fabricated DEWA DSM windows
    var rows = [
      { window: 'Sun 14:00-17:00', tariff_credit: 'AED 0.18/kWh', projected_curtailment: '120 kWh', opted_in: true },
      { window: 'Mon 14:00-17:00', tariff_credit: 'AED 0.18/kWh', projected_curtailment: '120 kWh', opted_in: true },
      { window: 'Tue 14:00-17:00', tariff_credit: 'AED 0.18/kWh', projected_curtailment: '120 kWh', opted_in: false },
      { window: 'Wed 14:00-17:00', tariff_credit: 'AED 0.18/kWh', projected_curtailment: '120 kWh', opted_in: true },
      { window: 'Thu 14:00-17:00', tariff_credit: 'AED 0.18/kWh', projected_curtailment: '120 kWh', opted_in: true }
    ];
    $('dr-table').innerHTML =
        '<thead><tr><th>Window</th><th>Tariff credit</th><th>Projected curtailment</th><th>Opt-in</th></tr></thead><tbody>'
      + rows.map(function (r, i) {
          return '<tr><td>' + esc(r.window) + '</td><td style="font-family:var(--font-mono);">' + esc(r.tariff_credit) + '</td><td style="font-family:var(--font-mono);">' + esc(r.projected_curtailment) + '</td><td>'
            + '<label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-size:12.5px;"><input type="checkbox" data-dr-i="' + i + '" ' + (r.opted_in ? 'checked' : '') + '/> ' + (r.opted_in ? 'Enrolled' : 'Decline') + '</label>'
            + '</td></tr>';
        }).join('')
      + '</tbody>';
    document.querySelectorAll('[data-dr-i]').forEach(function (cb) {
      cb.addEventListener('change', function () { window.toast('DR enrolment updated (demo)', 'success'); });
    });
  }

  $('ai-optimize').addEventListener('click', function () {
    $('ai-out').innerHTML = '<div style="font-size:12.5px;color:var(--wtd-muted-light);"><span class="wtd-ai-loading"></span> Analysing occupancy + outdoor temp + setpoints…</div>';
    var sim = window.WatadSim;
    var presence = sim ? Object.keys(sim.points).filter(function (k) { return /\.presence$/.test(k); }).map(function (k) { return sim.points[k].value; }) : [];
    var occ = presence.length ? Math.round((presence.filter(Boolean).length / presence.length) * 100) : 60;
    var od = sim ? sim.outdoor_temp_f : 92;
    var spSample = D.POINTS.filter(function (p) { return /\.zone_sp$/.test(p.id); }).slice(0, 6).map(function (p) { return { id: p.id, sp: p.setpoint }; });
    WatadAI.optimizeSetpoints({ occupancy_pct: occ, outdoor_temp_f: od, current_setpoints: spSample }).then(function (r) {
      $('ai-out').innerHTML =
          '<div style="font-size:13.5px;line-height:1.6;white-space:pre-wrap;color:var(--wtd-card-ink-2);">' + esc(r.text).replace(/\*\*([^*]+)\*\*/g, '<strong style="color:var(--wtd-card-ink);">$1</strong>') + '</div>'
        + '<div style="margin-top:8px;font-size:10.5px;color:var(--wtd-muted-light);font-family:var(--font-mono);">' + (r.fallback ? 'mock' : 'live') + ' · ' + (r.model || '?') + ' · ' + r.latency_ms + 'ms</div>';
    });
  });

  load();
})();
