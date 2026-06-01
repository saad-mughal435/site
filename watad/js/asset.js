/* asset.js - Watad asset detail page.
 * URL: asset.html?id=as-xxx
 *  - Header: asset name, type chip, location, status, last-comm
 *  - 24h trend chart (multi-point overlay)
 *  - Active + recent alarms
 *  - Related work orders
 *  - Manual override panel
 *  - Asset metadata grid
 *  - AI panel: "Suggest maintenance"
 */
(function () {
  'use strict';
  var D = window.WATAD_DATA;
  var $ = function (id) { return document.getElementById(id); };
  var esc = WatadApp.escapeHtml;
  var qs = WatadApp.qs();
  var assetId = qs.id || 'as-chiller-1';

  // Ensure sim is running so we have current values
  if (window.WatadSim && !window.WatadSim.started) window.WatadSim.start();

  function load() {
    WatadApp.api('/assets/' + assetId).then(function (r) {
      if (!r.body || !r.body.ok) { $('asset-head').innerHTML = '<strong style="color:var(--wtd-red);">Asset not found.</strong>'; return; }
      var asset = r.body.asset;
      var pts = r.body.points;
      var alms = r.body.alarms;
      var wos = r.body.work_orders;
      var floor = D.FLOORS.find(function (f) { return f.id === asset.floor_id; });
      var zone = D.ZONES.find(function (z) { return z.id === asset.zone_id; });

      // ----- Header -----
      var active = alms.filter(function (a) { return !a.cleared_at; });
      var sev = active.length ? active.sort(function (a, b) { var r = { critical: 0, urgent: 1, warning: 2, info: 3 }; return r[a.severity] - r[b.severity]; })[0].severity : 'ok';
      var statusLabel = active.length ? sev.toUpperCase() + ' · ' + active.length + ' active' : 'NORMAL';
      $('asset-head').innerHTML =
          '<div style="display:flex;align-items:center;gap:14px;">'
        +   '<div style="font-size:28px;">' + ({ chiller: '❄', 'cooling-tower': '🌀', ahu: '⬛', fcu: '◯', light: '⊕', meter: '⚡', 'sensor-occ': '⊙', 'sensor-co2': 'CO₂' }[asset.type] || '?') + '</div>'
        +   '<div>'
        +     '<h2 style="margin:0;color:var(--wtd-ink);">' + esc(asset.name) + '</h2>'
        +     '<div style="font-size:12.5px;color:var(--wtd-muted);font-family:var(--font-mono);margin-top:4px;">'
        +       esc(asset.type) + ' · ' + esc(floor ? floor.name : '?') + (zone ? ' / ' + esc(zone.name) : '') + ' · ' + esc(asset.model || '—') + ' · firmware ' + esc(asset.firmware || '—')
        +     '</div>'
        +   '</div>'
        + '</div>'
        + '<span class="wtd-chip ' + (sev === 'ok' ? 'ok' : sev) + '" style="margin-inline-start:auto;">' + statusLabel + '</span>'
        + '<span style="font-size:11px;color:var(--wtd-muted);font-family:var(--font-mono);">last comm · ' + WatadApp.fmtTime(new Date().toISOString()) + '</span>';

      // ----- Main column -----
      var html = '';

      // 24h trend chart (multi-point overlay)
      html += '<div class="wtd-card-dark">'
        + '<div class="wtd-card-dark-head">📈 Last 24 hours · ' + pts.length + ' point' + (pts.length === 1 ? '' : 's') + '</div>'
        + multiTrendSvg(pts)
        + '</div>';

      // Active + recent alarms
      html += '<div class="wtd-card-dark">'
        + '<div class="wtd-card-dark-head">🔔 Alarms (' + alms.length + ')</div>'
        + (alms.length === 0
            ? '<div class="wtd-text-muted" style="font-size:13px;">No alarms recorded for this asset.</div>'
            : '<table class="wtd-table" style="color:var(--wtd-ink-2);"><thead><tr><th style="background:transparent;color:var(--wtd-muted);border-color:var(--wtd-line);">Severity</th><th style="background:transparent;color:var(--wtd-muted);border-color:var(--wtd-line);">Title</th><th style="background:transparent;color:var(--wtd-muted);border-color:var(--wtd-line);">Raised</th><th style="background:transparent;color:var(--wtd-muted);border-color:var(--wtd-line);">Status</th><th style="background:transparent;color:var(--wtd-muted);border-color:var(--wtd-line);"></th></tr></thead><tbody>'
              + WatadApp.severitySort(alms).slice(0, 10).map(function (a) {
                  var status = a.cleared_at ? 'cleared' : a.acknowledged_at ? 'acknowledged' : 'open';
                  return '<tr style="border-color:var(--wtd-line);">'
                    + '<td style="border-color:var(--wtd-line);"><span class="wtd-chip ' + a.severity + '">' + a.severity + '</span></td>'
                    + '<td style="border-color:var(--wtd-line);color:var(--wtd-ink);">' + esc(a.title) + '</td>'
                    + '<td style="border-color:var(--wtd-line);font-family:var(--font-mono);font-size:11.5px;">' + WatadApp.timeAgo(a.raised_at) + '</td>'
                    + '<td style="border-color:var(--wtd-line);font-size:11.5px;">' + status + '</td>'
                    + '<td style="border-color:var(--wtd-line);">' + (status === 'open' ? '<button class="wtd-btn wtd-btn--sm" data-ack-id="' + esc(a.id) + '">Ack</button>' : '') + '</td>'
                    + '</tr>';
                }).join('')
              + '</tbody></table>')
        + '</div>';

      // Related work orders
      html += '<div class="wtd-card-dark">'
        + '<div class="wtd-card-dark-head">🛠 Work orders (' + wos.length + ')</div>'
        + (wos.length === 0
            ? '<div class="wtd-text-muted" style="font-size:13px;">No work orders linked to this asset.</div>'
            : '<table class="wtd-table" style="color:var(--wtd-ink-2);"><thead><tr><th style="background:transparent;color:var(--wtd-muted);border-color:var(--wtd-line);">WO#</th><th style="background:transparent;color:var(--wtd-muted);border-color:var(--wtd-line);">Title</th><th style="background:transparent;color:var(--wtd-muted);border-color:var(--wtd-line);">Priority</th><th style="background:transparent;color:var(--wtd-muted);border-color:var(--wtd-line);">Status</th><th style="background:transparent;color:var(--wtd-muted);border-color:var(--wtd-line);">Created</th></tr></thead><tbody>'
              + wos.map(function (w) {
                  return '<tr style="border-color:var(--wtd-line);">'
                    + '<td style="border-color:var(--wtd-line);font-family:var(--font-mono);font-size:11.5px;">' + esc(w.wo_no) + '</td>'
                    + '<td style="border-color:var(--wtd-line);color:var(--wtd-ink);">' + esc(w.title) + '</td>'
                    + '<td style="border-color:var(--wtd-line);"><span class="wtd-priority ' + w.priority + '">' + w.priority + '</span></td>'
                    + '<td style="border-color:var(--wtd-line);"><span class="wtd-chip ' + w.status + '">' + w.status + '</span></td>'
                    + '<td style="border-color:var(--wtd-line);font-family:var(--font-mono);font-size:11.5px;">' + WatadApp.fmtDate(w.created_at) + '</td>'
                    + '</tr>';
                }).join('')
              + '</tbody></table>')
        + '<div style="margin-top:10px;"><a class="wtd-btn wtd-btn--sm" href="workorders.html#new=' + esc(asset.id) + '">+ New work order</a></div>'
        + '</div>';

      // Metadata
      html += '<div class="wtd-card-dark">'
        + '<div class="wtd-card-dark-head">🏷 Asset metadata</div>'
        + '<div class="wtd-meta-grid">'
        +   '<div class="wtd-meta-row"><span>ID</span><span>' + esc(asset.id) + '</span></div>'
        +   '<div class="wtd-meta-row"><span>Type</span><span>' + esc(asset.type) + '</span></div>'
        +   '<div class="wtd-meta-row"><span>Model</span><span>' + esc(asset.model || '—') + '</span></div>'
        +   '<div class="wtd-meta-row"><span>Firmware</span><span>' + esc(asset.firmware || '—') + '</span></div>'
        +   '<div class="wtd-meta-row"><span>Install date</span><span>' + esc(asset.install_date || '—') + '</span></div>'
        +   '<div class="wtd-meta-row"><span>Floor</span><span>' + esc(floor ? floor.name : '—') + '</span></div>'
        +   '<div class="wtd-meta-row"><span>Zone</span><span>' + esc(zone ? zone.name : '—') + '</span></div>'
        +   '<div class="wtd-meta-row"><span>Controller</span><span>' + esc(asset.controller_id || '—') + '</span></div>'
        +   (asset.rated_kw ? '<div class="wtd-meta-row"><span>Rated kW</span><span>' + asset.rated_kw + '</span></div>' : '')
        + '</div>'
        + '</div>';

      $('asset-main').innerHTML = html;

      // ----- Side column -----
      $('asset-side').innerHTML =
          '<div class="wtd-ai-panel">'
        +   '<h4>✦ AI suggested maintenance</h4>'
        +   '<p style="font-size:12px;color:var(--wtd-muted);margin:0 0 10px;">Reads recent alarms + runtime to propose preventive tasks.</p>'
        +   '<button class="wtd-btn wtd-btn--primary wtd-btn--block" id="ai-suggest">Suggest now</button>'
        +   '<div id="ai-suggest-out" style="margin-top:10px;"></div>'
        + '</div>'
        + '<div class="wtd-card-dark">'
        +   '<div class="wtd-card-dark-head">⚙ Manual override</div>'
        +   '<p style="font-size:11.5px;color:var(--wtd-muted);margin:0 0 10px;">Operator-only. Changes audit-logged.</p>'
        +   renderOverridePanel(asset, pts)
        + '</div>'
        + '<div class="wtd-card-dark">'
        +   '<div class="wtd-card-dark-head">📍 Live point readings</div>'
        +   renderLivePoints(pts)
        + '</div>';

      // ----- Wire interactions -----
      var aiBtn = $('ai-suggest');
      if (aiBtn) aiBtn.addEventListener('click', function () {
        $('ai-suggest-out').innerHTML = '<div style="padding:8px 0;font-size:12px;color:var(--wtd-muted);"><span class="wtd-ai-loading"></span> Analysing alarm history + runtime…</div>';
        WatadAI.suggestMaintenance({ asset: asset, alarm_history: alms.slice(0, 8) }).then(function (r) {
          $('ai-suggest-out').innerHTML = '<div style="font-size:13px;line-height:1.6;white-space:pre-wrap;color:var(--wtd-ink-2);">' + esc(r.text).replace(/\*\*([^*]+)\*\*/g, '<strong style="color:var(--wtd-ink);">$1</strong>') + '</div>'
            + '<div style="margin-top:6px;font-size:10.5px;color:var(--wtd-muted);font-family:var(--font-mono);">' + (r.fallback ? 'mock' : 'live') + ' · ' + (r.model || '?') + ' · ' + r.latency_ms + 'ms</div>';
        });
      });
      document.querySelectorAll('[data-ack-id]').forEach(function (b) {
        b.addEventListener('click', function () {
          WatadApp.api('/alarms/' + b.getAttribute('data-ack-id') + '/ack', { method: 'POST', body: {} }).then(function () {
            window.toast('Acknowledged', 'success'); load();
          });
        });
      });
      document.querySelectorAll('[data-sp-id]').forEach(function (inp) {
        inp.addEventListener('change', function () {
          var pid = inp.getAttribute('data-sp-id');
          var v = parseFloat(inp.value);
          if (isNaN(v)) return;
          WatadApp.api('/points/' + pid, { method: 'PUT', body: { setpoint: v } }).then(function () {
            window.toast('Setpoint updated · audited', 'success'); load();
          });
        });
      });
      document.querySelectorAll('[data-status-id]').forEach(function (sel) {
        sel.addEventListener('change', function () {
          window.toast('Override sent (demo)', 'success');
        });
      });
    });
  }

  function multiTrendSvg(pts) {
    // Show up to 4 analog points overlaid. Sim history is 288 samples per point.
    var analog = pts.filter(function (p) { return p.kind === 'analog'; }).slice(0, 4);
    if (!analog.length) return '<div class="wtd-text-muted" style="font-size:12px;">No analog points to chart.</div>';
    var sim = window.WatadSim;
    if (!sim) return '<div class="wtd-text-muted" style="font-size:12px;">Sim not loaded.</div>';
    var w = 800, h = 200, pad = 30;
    // Pre-collect data + global y range
    var seriesData = analog.map(function (p) {
      var hist = sim.getHistory(p.id);
      return { point: p, samples: hist };
    }).filter(function (s) { return s.samples.length; });
    if (!seriesData.length) return '<div class="wtd-text-muted" style="font-size:12px;">No history yet.</div>';
    var allYs = []; seriesData.forEach(function (s) { s.samples.forEach(function (x) { allYs.push(x.v); }); });
    var yMin = Math.min.apply(null, allYs) - 0.5;
    var yMax = Math.max.apply(null, allYs) + 0.5;
    var tMin = Math.min.apply(null, seriesData[0].samples.map(function (x) { return x.t; }));
    var tMax = Math.max.apply(null, seriesData[0].samples.map(function (x) { return x.t; }));
    var colors = ['#22d3ee', '#4ade80', '#fbbf24', '#a78bfa'];

    var paths = seriesData.map(function (s, i) {
      var c = colors[i % colors.length];
      var d = s.samples.map(function (sm, j) {
        var x = pad + ((sm.t - tMin) / Math.max(1, tMax - tMin)) * (w - pad * 2);
        var y = h - pad - ((sm.v - yMin) / Math.max(0.01, yMax - yMin)) * (h - pad * 2);
        return (j === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
      }).join(' ');
      return '<path d="' + d + '" stroke="' + c + '" stroke-width="1.4" fill="none"/>';
    }).join('');

    // y-axis labels
    var yLabels = '';
    for (var yL = 0; yL <= 3; yL++) {
      var yv = yMin + (yMax - yMin) * (yL / 3);
      var yp = h - pad - ((yv - yMin) / (yMax - yMin)) * (h - pad * 2);
      yLabels += '<text x="' + (pad - 4) + '" y="' + (yp + 3) + '" fill="rgba(184,197,221,0.55)" font-family="JetBrains Mono, monospace" font-size="9" text-anchor="end">' + yv.toFixed(1) + '</text>';
      yLabels += '<line x1="' + pad + '" y1="' + yp + '" x2="' + (w - pad) + '" y2="' + yp + '" stroke="rgba(120,200,255,0.08)" stroke-width="0.5"/>';
    }
    var legend = '<div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:8px;font-size:11px;color:var(--wtd-muted);font-family:var(--font-mono);">'
      + seriesData.map(function (s, i) {
          var snap = sim.getPoint(s.point.id);
          return '<span style="display:inline-flex;align-items:center;gap:6px;"><span style="width:10px;height:2px;background:' + colors[i % colors.length] + ';"></span>' + esc(s.point.name) + ' <strong style="color:var(--wtd-ink);">' + (snap ? snap.value.toFixed(1) : '—') + ' ' + esc(s.point.unit || '') + '</strong></span>';
        }).join('')
      + '</div>';
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" style="display:block;width:100%;height:200px;">'
      + yLabels
      + paths
      + '</svg>'
      + legend;
  }

  function renderOverridePanel(asset, pts) {
    // Show the writable points (setpoint-bearing) for FCU/AHU/etc.
    var sp = pts.filter(function (p) { return p.setpoint != null && /\.zone_sp$|\.zone_temp$|\.sat$|\.chws$/.test(p.id); });
    if (!sp.length) return '<div class="wtd-text-muted" style="font-size:12px;">No overridable setpoints exposed by this asset.</div>';
    return sp.map(function (p) {
      var unit = p.unit || '';
      return '<div class="wtd-field" style="margin-bottom:10px;"><span>' + esc(p.name) + ' (' + esc(unit) + ')</span>'
        + '<input class="wtd-input" type="number" step="0.5" value="' + p.setpoint + '" data-sp-id="' + esc(p.id) + '" /></div>';
    }).join('')
    + (asset.type === 'fcu' || asset.type === 'ahu' ? '<div class="wtd-field" style="margin-bottom:10px;"><span>Override status</span><select class="wtd-select" data-status-id="' + esc(asset.id) + '"><option value="auto">Auto (schedule)</option><option value="on">Force ON</option><option value="off">Force OFF</option></select></div>' : '');
  }

  function renderLivePoints(pts) {
    var sim = window.WatadSim;
    return '<table class="wtd-table" style="font-size:11.5px;color:var(--wtd-ink-2);"><tbody>'
      + pts.map(function (p) {
          var snap = sim && sim.getPoint(p.id);
          var v = snap ? WatadApp.fmtUnit(snap.value, p.unit) : '—';
          var ts = snap ? WatadApp.fmtTime(snap.ts) : '';
          return '<tr style="border-color:var(--wtd-line);"><td style="border-color:var(--wtd-line);padding:6px 8px;">' + esc(p.name) + '</td><td style="border-color:var(--wtd-line);padding:6px 8px;font-family:var(--font-mono);color:var(--wtd-ink);text-align:right;">' + v + '</td><td style="border-color:var(--wtd-line);padding:6px 8px;color:var(--wtd-muted);font-family:var(--font-mono);text-align:right;">' + ts + '</td></tr>';
        }).join('')
      + '</tbody></table>';
  }

  // Initial load + soft-refresh live point readings every 5s without a full reload
  load();
  setInterval(function () {
    var sim = window.WatadSim;
    if (!sim) return;
    // Re-render the live points block in place
    WatadApp.api('/assets/' + assetId).then(function (r) {
      if (!r.body || !r.body.ok) return;
      var pts = r.body.points;
      var side = $('asset-side');
      if (!side) return;
      var card = side.querySelectorAll('.wtd-card-dark');
      var lastCard = card[card.length - 1];
      if (lastCard) lastCard.innerHTML = '<div class="wtd-card-dark-head">📍 Live point readings</div>' + renderLivePoints(pts);
    });
  }, 5000);
})();
