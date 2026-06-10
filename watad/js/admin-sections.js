/* admin-sections.js - Watad admin section renderers.
   Each function on window.WatadAdmin receives a host element to paint into. */
(function () {
  'use strict';
  var D = window.WATAD_DATA;
  var esc = WatadApp.escapeHtml;
  var fmtDt = WatadApp.fmtDateTime;
  var fmtDate = WatadApp.fmtDate;

  if (window.WatadSim && !window.WatadSim.started) window.WatadSim.start();

  function csvDownload(filename, lines) {
    var blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  var Admin = {};

  /* =================================================================== Dashboard */
  Admin.dashboard = function (host) {
    WatadApp.api('/admin/dashboard').then(function (r) {
      var d = r.body;
      var maxW = Math.max.apply(null, d.weekly_kwh.map(function (w) { return w.kwh; }).concat([1]));
      var maxH = Math.max.apply(null, d.by_hour.concat([1]));
      var heatLevel = function (v) { if (v === 0) return ''; var p = v / maxH; return p > 0.75 ? 'h-4' : p > 0.5 ? 'h-3' : p > 0.25 ? 'h-2' : 'h-1'; };
      var assetMap = {}; D.ASSETS.forEach(function (a) { assetMap[a.id] = a; });
      host.innerHTML =
          '<div class="wtd-kpi-grid">'
        +   '<div class="wtd-kpi"><div class="wtd-kpi-label">Alarms - critical</div><div class="wtd-kpi-value" style="color:var(--wtd-red);">' + (d.kpis.alarms.critical || 0) + '</div></div>'
        +   '<div class="wtd-kpi"><div class="wtd-kpi-label">Alarms - urgent</div><div class="wtd-kpi-value" style="color:var(--wtd-sev-urgent);">' + (d.kpis.alarms.urgent || 0) + '</div></div>'
        +   '<div class="wtd-kpi"><div class="wtd-kpi-label">Alarms - warning</div><div class="wtd-kpi-value" style="color:var(--wtd-amber);">' + (d.kpis.alarms.warning || 0) + '</div></div>'
        +   '<div class="wtd-kpi"><div class="wtd-kpi-label">Live power</div><div class="wtd-kpi-value">' + d.kpis.kw_now + ' kW</div><div class="wtd-kpi-sub">main meter</div></div>'
        +   '<div class="wtd-kpi"><div class="wtd-kpi-label">Avg zone temp</div><div class="wtd-kpi-value">' + d.kpis.avg_zone_f + '°F</div></div>'
        +   '<div class="wtd-kpi"><div class="wtd-kpi-label">Occupancy</div><div class="wtd-kpi-value">' + d.kpis.occupancy_pct + '%</div></div>'
        + '</div>'

        + '<div class="wtd-mt-3" style="display:grid;grid-template-columns:1.5fr 1fr;gap:18px;">'
        +   '<div class="wtd-card">'
        +     '<h3 style="margin-bottom:16px;">Last 7 days · total kWh</h3>'
        +     '<div class="wtd-bars">' + d.weekly_kwh.map(function (w) { var h = Math.max(6, (w.kwh / maxW) * 165); return '<div class="bar" style="height:' + h + 'px;"><span>' + (w.kwh / 1000).toFixed(1) + 'k</span></div>'; }).join('') + '</div>'
        +     '<div class="wtd-bars-labels">' + d.weekly_kwh.map(function (w) { return '<span>' + esc(w.label) + '</span>'; }).join('') + '</div>'
        +   '</div>'
        +   '<div class="wtd-card">'
        +     '<h3 style="margin-bottom:10px;">Top alarming assets</h3>'
        +     (d.top_alarming.length
              ? '<table class="wtd-table">' + d.top_alarming.map(function (t, i) {
                  return '<tr><td style="font-family:var(--font-mono);color:var(--wtd-muted-light);width:24px;">' + (i + 1) + '</td><td><strong>' + esc(t.asset.name) + '</strong></td><td style="text-align:right;font-family:var(--font-mono);font-weight:700;">' + t.count + '</td></tr>';
                }).join('') + '</table>'
              : '<div class="wtd-table-empty">No alarms recorded.</div>')
        +   '</div>'
        + '</div>'

        + '<div class="wtd-mt-3 wtd-card">'
        +   '<h3 style="margin-bottom:12px;">Alarms by hour of day</h3>'
        +   '<div class="wtd-heatmap">'
        +     '<div></div>' + d.by_hour.map(function (_, h) { return '<div style="font-size:9.5px;color:var(--wtd-muted-light);text-align:center;font-family:var(--font-mono);">' + h + '</div>'; }).join('')
        +     '<div style="color:var(--wtd-muted-light);padding:2px 4px;align-self:center;font-family:var(--font-mono);font-size:10px;">all-time</div>'
        +     d.by_hour.map(function (v) { return '<div class="wtd-heat-cell ' + heatLevel(v) + '" title="' + v + ' alarms"></div>'; }).join('')
        +   '</div>'
        + '</div>'

        + '<div class="wtd-mt-3 wtd-panel">'
        +   '<div class="wtd-panel-head"><h3>Recent alarms</h3><a href="#alarms" style="font-size:13px;">All →</a></div>'
        +   '<table class="wtd-table">'
        +     '<thead><tr><th>Title</th><th>Asset</th><th>Severity</th><th>Raised</th><th>Status</th></tr></thead>'
        +     '<tbody>' + (d.recent_alarms.length
                ? d.recent_alarms.map(function (a) {
                    var asset = assetMap[a.asset_id] || { name: a.asset_id };
                    var status = a.cleared_at ? 'cleared' : a.acknowledged_at ? 'ack' : 'open';
                    return '<tr><td>' + esc(a.title) + '</td><td style="font-size:12px;">' + esc(asset.name) + '</td><td><span class="wtd-chip ' + a.severity + '">' + a.severity + '</span></td><td>' + fmtDt(a.raised_at) + '</td><td><span class="wtd-chip ' + (status === 'cleared' ? 'ok' : status === 'open' ? 'urgent' : 'warning') + '">' + status + '</span></td></tr>';
                  }).join('')
                : '<tr><td colspan="5" class="wtd-table-empty">No alarms.</td></tr>')
        +   '</tbody></table>'
        + '</div>';
    });
  };

  /* =================================================================== Assets */
  Admin.assets = function (host) {
    var state = { type: 'all', floor: 'all', q: '' };
    function paint() {
      WatadApp.api('/assets').then(function (r) {
        var rows = r.body.items;
        var types = ['all'].concat(Array.from(new Set(rows.map(function (a) { return a.type; })))).sort();
        if (state.type !== 'all')  rows = rows.filter(function (a) { return a.type === state.type; });
        if (state.floor !== 'all') rows = rows.filter(function (a) { return a.floor_id === state.floor; });
        if (state.q) rows = rows.filter(function (a) { return a.name.toLowerCase().indexOf(state.q.toLowerCase()) !== -1; });
        var floorMap = {}; D.FLOORS.forEach(function (f) { floorMap[f.id] = f; });
        host.innerHTML =
            '<div class="wtd-flex" style="margin-bottom:14px;">'
          +   '<select class="wtd-select" id="ast-type" style="max-width:160px;">'
          +     types.map(function (t) { return '<option value="' + t + '"' + (state.type === t ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('')
          +   '</select>'
          +   '<select class="wtd-select" id="ast-floor" style="max-width:200px;">'
          +     '<option value="all">All floors</option>'
          +     D.FLOORS.map(function (f) { return '<option value="' + f.id + '"' + (state.floor === f.id ? ' selected' : '') + '>' + esc(f.name) + '</option>'; }).join('')
          +   '</select>'
          +   '<input class="wtd-input" id="ast-q" placeholder="Search…" style="max-width:240px;" value="' + esc(state.q) + '"/>'
          +   '<span class="wtd-text-muted" style="font-size:13px;">' + rows.length + ' assets</span>'
          + '</div>'
          + '<div class="wtd-panel"><table class="wtd-table">'
          + '<thead><tr><th>Name</th><th>Type</th><th>Floor</th><th>Model</th><th>Firmware</th><th>Install</th><th>Controller</th><th></th></tr></thead>'
          + '<tbody>' + (rows.length ? rows.map(function (a) {
              var f = floorMap[a.floor_id] || { name: '-' };
              return '<tr>'
                + '<td style="font-weight:600;">' + esc(a.name) + '</td>'
                + '<td><span class="wtd-chip">' + esc(a.type) + '</span></td>'
                + '<td style="font-size:12px;">' + esc(f.name) + '</td>'
                + '<td style="font-size:12px;font-family:var(--font-mono);">' + esc(a.model || '-') + '</td>'
                + '<td style="font-size:11.5px;font-family:var(--font-mono);">' + esc(a.firmware || '-') + '</td>'
                + '<td style="font-size:11.5px;font-family:var(--font-mono);">' + esc(a.install_date || '-') + '</td>'
                + '<td style="font-size:11.5px;font-family:var(--font-mono);color:var(--wtd-muted-light);">' + esc(a.controller_id || '-') + '</td>'
                + '<td><a class="wtd-btn wtd-btn--sm" href="asset.html?id=' + esc(a.id) + '" target="_blank">Open</a></td>'
                + '</tr>';
            }).join('') : '<tr><td colspan="8" class="wtd-table-empty">No assets match.</td></tr>')
          + '</tbody></table></div>';
        document.getElementById('ast-type').addEventListener('change', function (e) { state.type = e.target.value; paint(); });
        document.getElementById('ast-floor').addEventListener('change', function (e) { state.floor = e.target.value; paint(); });
        var q = document.getElementById('ast-q');
        q.addEventListener('input', function (e) { state.q = e.target.value; clearTimeout(window.__astQ); window.__astQ = setTimeout(paint, 200); });
      });
    }
    paint();
  };

  /* =================================================================== Points */
  Admin.points = function (host) {
    var state = { asset: 'all', q: '' };
    function paint() {
      WatadApp.api('/points').then(function (r) {
        var rows = r.body.items;
        if (state.asset !== 'all') rows = rows.filter(function (p) { return p.asset_id === state.asset; });
        if (state.q) rows = rows.filter(function (p) { return p.name.toLowerCase().indexOf(state.q.toLowerCase()) !== -1; });
        rows = rows.slice(0, 200);
        var assetMap = {}; D.ASSETS.forEach(function (a) { assetMap[a.id] = a; });
        var sim = window.WatadSim;
        host.innerHTML =
            '<div class="wtd-flex" style="margin-bottom:14px;">'
          +   '<select class="wtd-select" id="pt-asset" style="max-width:280px;">'
          +     '<option value="all">All assets</option>'
          +     D.ASSETS.map(function (a) { return '<option value="' + a.id + '"' + (state.asset === a.id ? ' selected' : '') + '>' + esc(a.name) + '</option>'; }).join('')
          +   '</select>'
          +   '<input class="wtd-input" id="pt-q" placeholder="Search…" style="max-width:240px;" value="' + esc(state.q) + '"/>'
          +   '<span class="wtd-text-muted" style="font-size:13px;">' + rows.length + ' / ' + r.body.items.length + ' points</span>'
          + '</div>'
          + '<div class="wtd-panel"><table class="wtd-table">'
          + '<thead><tr><th>Point</th><th>Asset</th><th>Kind</th><th style="text-align:right;">Setpoint</th><th style="text-align:right;">Hi-alarm</th><th style="text-align:right;">Lo-alarm</th><th style="text-align:right;">Current</th></tr></thead>'
          + '<tbody>' + rows.map(function (p) {
              var asset = assetMap[p.asset_id] || { name: p.asset_id };
              var snap = sim && sim.getPoint(p.id);
              return '<tr>'
                + '<td><strong>' + esc(p.name) + '</strong> <span style="color:var(--wtd-muted-light);font-family:var(--font-mono);font-size:11px;">' + esc(p.id) + '</span></td>'
                + '<td style="font-size:12px;">' + esc(asset.name) + '</td>'
                + '<td><span class="wtd-chip">' + esc(p.kind) + '</span></td>'
                + '<td style="text-align:right;font-family:var(--font-mono);">' + (p.setpoint != null ? p.setpoint + ' ' + (p.unit || '') : '-') + '</td>'
                + '<td style="text-align:right;font-family:var(--font-mono);color:var(--wtd-amber);">' + (p.hi_alarm != null ? p.hi_alarm + ' ' + (p.unit || '') : '-') + '</td>'
                + '<td style="text-align:right;font-family:var(--font-mono);color:var(--wtd-blue);">' + (p.lo_alarm != null ? p.lo_alarm + ' ' + (p.unit || '') : '-') + '</td>'
                + '<td style="text-align:right;font-family:var(--font-mono);font-weight:700;color:var(--wtd-card-ink);">' + (snap ? WatadApp.fmtUnit(snap.value, p.unit) : '-') + '</td>'
                + '</tr>';
            }).join('')
          + '</tbody></table></div>';
        document.getElementById('pt-asset').addEventListener('change', function (e) { state.asset = e.target.value; paint(); });
        var q = document.getElementById('pt-q');
        q.addEventListener('input', function (e) { state.q = e.target.value; clearTimeout(window.__ptQ); window.__ptQ = setTimeout(paint, 200); });
      });
    }
    paint();
  };

  /* =================================================================== Alarms */
  Admin.alarms = function (host) {
    var state = { status: 'all', severity: 'all' };
    function paint() {
      WatadApp.api('/alarms').then(function (r) {
        var rows = r.body.items;
        if (state.status === 'active')   rows = rows.filter(function (a) { return !a.cleared_at; });
        if (state.status === 'cleared')  rows = rows.filter(function (a) { return a.cleared_at; });
        if (state.severity !== 'all') rows = rows.filter(function (a) { return a.severity === state.severity; });
        var assetMap = {}; D.ASSETS.forEach(function (a) { assetMap[a.id] = a; });
        host.innerHTML =
            '<div class="wtd-flex" style="margin-bottom:14px;">'
          +   ['all','active','cleared'].map(function (s) { return '<button class="wtd-btn wtd-btn--sm ' + (state.status === s ? 'wtd-btn--primary' : '') + '" data-status="' + s + '">' + s + '</button>'; }).join('')
          +   '<span style="margin-inline-start:20px;font-size:11.5px;color:var(--wtd-muted-light);">Severity:</span>'
          +   ['all','critical','urgent','warning','info'].map(function (s) { return '<button class="wtd-btn wtd-btn--sm ' + (state.severity === s ? 'wtd-btn--primary' : '') + '" data-sev="' + s + '">' + s + '</button>'; }).join('')
          +   '<span class="wtd-text-muted" style="font-size:13px;margin-inline-start:auto;">' + rows.length + ' alarms</span>'
          + '</div>'
          + '<div class="wtd-panel"><table class="wtd-table">'
          + '<thead><tr><th>Severity</th><th>Title</th><th>Asset</th><th>Raised</th><th>Acked</th><th>Cleared</th></tr></thead>'
          + '<tbody>' + rows.map(function (a) {
              var asset = assetMap[a.asset_id] || { name: a.asset_id };
              return '<tr>'
                + '<td><span class="wtd-chip ' + a.severity + '">' + a.severity + '</span></td>'
                + '<td><strong>' + esc(a.title) + '</strong></td>'
                + '<td style="font-size:12px;">' + esc(asset.name) + '</td>'
                + '<td style="font-family:var(--font-mono);font-size:11.5px;">' + fmtDt(a.raised_at) + '</td>'
                + '<td style="font-family:var(--font-mono);font-size:11.5px;color:var(--wtd-muted-light);">' + (a.acknowledged_at ? fmtDt(a.acknowledged_at) : '-') + '</td>'
                + '<td style="font-family:var(--font-mono);font-size:11.5px;color:' + (a.cleared_at ? 'var(--wtd-green-2)' : 'var(--wtd-muted-light)') + ';">' + (a.cleared_at ? fmtDt(a.cleared_at) : '-') + '</td>'
                + '</tr>';
            }).join('')
          + '</tbody></table></div>';
        host.querySelectorAll('[data-status]').forEach(function (b) { b.addEventListener('click', function () { state.status = b.getAttribute('data-status'); paint(); }); });
        host.querySelectorAll('[data-sev]').forEach(function (b) { b.addEventListener('click', function () { state.severity = b.getAttribute('data-sev'); paint(); }); });
      });
    }
    paint();
  };

  /* =================================================================== Schedules */
  Admin.schedules = function (host) {
    WatadApp.api('/schedules').then(function (r) {
      var rows = r.body.items;
      host.innerHTML =
          '<div class="wtd-panel"><table class="wtd-table">'
        + '<thead><tr><th>Schedule</th><th>Sun</th><th>Mon</th><th>Tue</th><th>Wed</th><th>Thu</th><th>Fri</th><th>Sat</th></tr></thead>'
        + '<tbody>' + rows.map(function (s) {
            return '<tr>'
              + '<td><strong>' + esc(s.name) + '</strong> <span style="color:var(--wtd-muted-light);font-family:var(--font-mono);font-size:11px;">' + esc(s.id) + '</span></td>'
              + ['sun','mon','tue','wed','thu','fri','sat'].map(function (d) {
                  var w = s[d] || [];
                  if (!w.length) return '<td style="color:var(--wtd-muted-light);font-family:var(--font-mono);font-size:11px;">-</td>';
                  return '<td style="font-family:var(--font-mono);font-size:11px;">' + w.map(function (x) { return esc(x[0] + '-' + x[1]); }).join(' / ') + '</td>';
                }).join('')
              + '</tr>';
          }).join('')
        + '</tbody></table></div>';
    });
  };

  /* =================================================================== Work orders (admin lens) */
  Admin.workorders = function (host) {
    host.innerHTML = '<div class="wtd-card" style="text-align:center;padding:40px;"><h3 style="margin-bottom:6px;">Work orders module</h3><p class="wtd-text-muted" style="margin:0 0 14px;">Open the full work-orders page for filtering, drill-in, comments and signature capture.</p><a class="wtd-btn wtd-btn--primary" href="workorders.html" target="_blank">Open work orders ↗</a></div>';
    WatadApp.api('/work-orders').then(function (r) {
      var rows = r.body.items;
      var byStatus = {}; rows.forEach(function (w) { byStatus[w.status] = (byStatus[w.status] || 0) + 1; });
      host.innerHTML +=
          '<div class="wtd-mt-3 wtd-kpi-grid">'
        + Object.keys(byStatus).map(function (s) { return '<div class="wtd-kpi"><div class="wtd-kpi-label">' + esc(s) + '</div><div class="wtd-kpi-value">' + byStatus[s] + '</div></div>'; }).join('')
        + '</div>';
    });
  };

  /* =================================================================== Staff */
  Admin.staff = function (host) {
    var PERMS = {
      operator: ['View console + dashboards', 'Acknowledge alarms', 'Create work orders', 'View energy + reports'],
      tech:     ['All operator permissions', 'Edit + close work orders', 'Manual override setpoints (with audit)', 'Adjust schedules'],
      admin:    ['All technician permissions', 'CRUD assets + points', 'Manage alarm rules', 'Configure AI Console + integrations', 'Edit settings + audit access']
    };
    host.innerHTML =
        '<div class="wtd-panel" style="margin-bottom:18px;"><table class="wtd-table">'
      + '<thead><tr><th></th><th>Name</th><th>Role</th><th>Shift</th><th>Online</th></tr></thead>'
      + '<tbody>' + D.STAFF.map(function (s) {
          return '<tr>'
            + '<td><span style="display:inline-block;width:32px;height:32px;border-radius:999px;background-image:url(' + s.photo + ');background-size:cover;"></span></td>'
            + '<td><strong>' + esc(s.name) + '</strong></td>'
            + '<td><span class="wtd-chip ' + (s.role === 'admin' ? 'completed' : s.role === 'tech' ? 'warning' : 'info') + '">' + s.role + '</span></td>'
            + '<td style="font-size:12px;">' + esc(s.shift) + '</td>'
            + '<td>' + (s.online ? '<span style="color:var(--wtd-green-2);font-size:13px;">● online</span>' : '<span class="wtd-text-muted">offline</span>') + '</td>'
            + '</tr>';
        }).join('')
      + '</tbody></table></div>'
      + '<div class="wtd-card"><h3 style="margin-bottom:10px;">Permission matrix</h3>'
      + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;">'
      + Object.keys(PERMS).map(function (role) {
          return '<div><div class="wtd-kpi-label">' + role + '</div><ul style="margin:8px 0 0;padding-inline-start:18px;font-size:13px;line-height:1.7;">' + PERMS[role].map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul></div>';
        }).join('')
      + '</div></div>';
  };

  /* =================================================================== AI Console */
  Admin.ai_console = function (host) {
    WatadApp.api('/admin/settings').then(function (r) {
      var s = r.body.settings;
      var models = [
        ['fast', 'Fast', 'Fastest · cheapest (~$0.001/call)'],
        ['balanced',         'Balanced', 'Balanced · ~10× the cost'],
        ['max',           'Max',   'Highest quality · ~30× the cost']
      ];
      host.innerHTML =
          '<div class="wtd-card" style="margin-bottom:18px;">'
        +   '<h3 style="margin-bottom:14px;">Model</h3>'
        +   '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">'
        +     models.map(function (m) {
                var on = s.model === m[0];
                return '<label style="display:block;padding:14px;border-radius:10px;border:2px solid ' + (on ? 'var(--wtd-cyan)' : 'var(--wtd-line-light-2)') + ';cursor:pointer;background:' + (on ? 'rgba(34,211,238,.06)' : 'white') + ';">'
                  + '<input type="radio" name="model" value="' + m[0] + '" ' + (on ? 'checked' : '') + ' style="display:none;"/>'
                  + '<div style="font-weight:700;font-size:14px;">' + esc(m[1]) + '</div>'
                  + '<div style="font-size:11.5px;color:var(--wtd-muted-light);margin-top:4px;">' + esc(m[2]) + '</div>'
                  + '</label>';
              }).join('')
        +   '</div>'
        + '</div>'
        + '<div class="wtd-card" style="margin-bottom:18px;">'
        +   '<h3 style="margin-bottom:6px;">System prompt</h3>'
        +   '<p class="wtd-text-muted" style="font-size:13px;margin:0 0 10px;">Applied on every AI call. Cached with <code>cache_control: ephemeral</code> when live.</p>'
        +   '<textarea class="wtd-textarea" id="sys-prompt" rows="5">' + esc(s.system_prompt) + '</textarea>'
        + '</div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:18px;">'
        +   '<div class="wtd-card"><h4 style="margin-bottom:8px;">Temperature</h4><input class="wtd-input" type="number" step="0.05" min="0" max="1" id="temp" value="' + s.temperature + '"/></div>'
        +   '<div class="wtd-card"><h4 style="margin-bottom:8px;">Max tokens</h4><input class="wtd-input" type="number" step="50" min="50" max="2000" id="maxt" value="' + s.max_tokens + '"/></div>'
        +   '<div class="wtd-card"><h4 style="margin-bottom:8px;">Prompt cache</h4><select class="wtd-select" id="cache"><option value="true"' + (s.cache_enabled ? ' selected' : '') + '>Enabled</option><option value="false"' + (!s.cache_enabled ? ' selected' : '') + '>Disabled</option></select></div>'
        + '</div>'
        + '<div class="wtd-flex">'
        +   '<button class="wtd-btn wtd-btn--primary" id="save-ai">Save AI settings</button>'
        +   '<button class="wtd-btn" id="test-ai" style="margin-inline-start:auto;">Test with sample alarm</button>'
        + '</div>'
        + '<div id="test-out" style="margin-top:14px;"></div>';
      document.getElementById('save-ai').addEventListener('click', function () {
        var body = {
          model: document.querySelector('input[name="model"]:checked').value,
          system_prompt: document.getElementById('sys-prompt').value,
          temperature: parseFloat(document.getElementById('temp').value) || 0.4,
          max_tokens: parseInt(document.getElementById('maxt').value, 10) || 600,
          cache_enabled: document.getElementById('cache').value === 'true'
        };
        WatadApp.api('/admin/settings', { method: 'POST', body: body }).then(function () { window.toast('AI settings saved', 'success'); });
      });
      document.getElementById('test-ai').addEventListener('click', function () {
        document.getElementById('test-out').innerHTML = '<div class="wtd-empty"><span class="wtd-ai-loading"></span> Generating sample alarm explanation…</div>';
        var sampleAlarm = { title: 'CH-1 condenser temp high (94.2°F)', severity: 'urgent', point_id: 'as-chiller-1.cond_temp' };
        var sampleAsset = D.ASSETS.find(function (a) { return a.id === 'as-chiller-1'; });
        WatadAI.explainAlarm({ alarm: sampleAlarm, asset: sampleAsset }).then(function (r) {
          document.getElementById('test-out').innerHTML =
              '<div class="wtd-card"><div style="font-size:11px;color:var(--wtd-muted-light);text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin-bottom:8px;">Sample alarm explanation ' + (r.fallback ? '<span class="wtd-mode-badge" style="margin-inline-start:6px;font-size:9.5px;padding:1px 8px;">mock</span>' : '<span class="wtd-mode-badge live" style="margin-inline-start:6px;font-size:9.5px;padding:1px 8px;">live</span>') + '</div>'
            + '<div style="white-space:pre-wrap;font-size:14px;line-height:1.6;">' + esc(r.text).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>') + '</div>'
            + '<div style="margin-top:10px;font-size:11.5px;color:var(--wtd-muted-light);font-family:var(--font-mono);">' + (r.model || '?') + ' · ' + r.latency_ms + 'ms</div>'
            + '</div>';
        });
      });
    });
  };

  /* =================================================================== Integrations */
  Admin.integrations = function (host) {
    function paint() {
      WatadApp.api('/integrations').then(function (r) {
        var rows = r.body.items;
        host.innerHTML =
            '<p class="wtd-text-muted" style="margin-top:0;font-size:14px;">Connect Watad to the building protocols and back-office systems your facilities team already uses.</p>'
          + '<div style="display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));">'
          + rows.map(function (i) {
              var connected = i.status === 'connected';
              return '<div class="wtd-card">'
                + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">'
                +   '<span style="font-size:24px;">' + esc(i.icon || '🔗') + '</span>'
                +   '<div style="flex:1;"><div style="font-weight:700;">' + esc(i.name) + '</div><div style="font-size:11.5px;color:var(--wtd-muted-light);">' + (connected ? 'Connected ' + fmtDate(i.connected_at) : 'Not connected') + '</div></div>'
                +   (connected ? '<span class="wtd-chip ok">●</span>' : '<span class="wtd-chip">○</span>')
                + '</div>'
                + (i.details ? '<div style="font-size:12px;color:var(--wtd-muted-light);margin-bottom:10px;">' + esc(i.details) + '</div>' : '')
                + '<button class="wtd-btn wtd-btn--sm wtd-btn--block" data-int="' + esc(i.id) + '">' + (connected ? 'Disconnect' : 'Connect') + '</button>'
                + '</div>';
            }).join('') + '</div>';
        host.querySelectorAll('[data-int]').forEach(function (b) {
          b.addEventListener('click', function () {
            WatadApp.api('/integrations/' + b.getAttribute('data-int'), { method: 'POST' }).then(function () { window.toast('Toggled (demo)', 'success'); paint(); });
          });
        });
      });
    }
    paint();
  };

  /* =================================================================== Settings + reset */
  Admin.settings = function (host) {
    WatadApp.api('/admin/settings').then(function (r) {
      var s = r.body.settings;
      host.innerHTML =
          '<div class="wtd-card" style="margin-bottom:14px;">'
        + '<h3 style="margin-bottom:14px;">Building</h3>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">'
        +   '<div class="wtd-field"><span>Name</span><input class="wtd-input" id="set-name" value="' + esc(s.business_name) + '"/></div>'
        +   '<div class="wtd-field"><span>Address</span><input class="wtd-input" id="set-addr" value="' + esc(s.address) + '"/></div>'
        +   '<div class="wtd-field"><span>Business hours</span><input class="wtd-input" id="set-hours" value="' + esc(s.business_hours) + '"/></div>'
        +   '<div class="wtd-field"><span>Time zone</span><input class="wtd-input" id="set-tz" value="' + esc(s.timezone) + '"/></div>'
        + '</div></div>'
        + '<div class="wtd-card" style="margin-bottom:14px;">'
        + '<h3 style="margin-bottom:14px;">Energy</h3>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;">'
        +   '<div class="wtd-field"><span>Currency</span><input class="wtd-input" id="set-cur" value="' + esc(s.currency) + '"/></div>'
        +   '<div class="wtd-field"><span>Tariff (per kWh)</span><input class="wtd-input" type="number" step="0.01" id="set-tariff" value="' + s.energy_tariff + '"/></div>'
        +   '<div class="wtd-field"><span>CO₂ factor (kg/kWh)</span><input class="wtd-input" type="number" step="0.001" id="set-co2" value="' + s.co2_factor + '"/></div>'
        +   '<div class="wtd-field"><span>Units</span><select class="wtd-select" id="set-units"><option value="imperial"' + (s.units === 'imperial' ? ' selected' : '') + '>Imperial (°F)</option><option value="metric"' + (s.units === 'metric' ? ' selected' : '') + '>Metric (°C)</option></select></div>'
        +   '<div class="wtd-field"><span>ASHRAE low (°F)</span><input class="wtd-input" type="number" id="set-aslo" value="' + s.ashrae_band_low + '"/></div>'
        +   '<div class="wtd-field"><span>ASHRAE high (°F)</span><input class="wtd-input" type="number" id="set-ashi" value="' + s.ashrae_band_high + '"/></div>'
        + '</div></div>'
        + '<div class="wtd-flex">'
        +   '<button class="wtd-btn wtd-btn--primary" id="set-save">Save settings</button>'
        +   '<button class="wtd-btn wtd-btn--danger" id="set-reset" style="margin-inline-start:auto;">Reset demo data</button>'
        + '</div>';
      document.getElementById('set-save').addEventListener('click', function () {
        var body = {
          business_name: document.getElementById('set-name').value,
          address: document.getElementById('set-addr').value,
          business_hours: document.getElementById('set-hours').value,
          timezone: document.getElementById('set-tz').value,
          currency: document.getElementById('set-cur').value,
          energy_tariff: parseFloat(document.getElementById('set-tariff').value),
          co2_factor: parseFloat(document.getElementById('set-co2').value),
          units: document.getElementById('set-units').value,
          ashrae_band_low: parseFloat(document.getElementById('set-aslo').value),
          ashrae_band_high: parseFloat(document.getElementById('set-ashi').value)
        };
        WatadApp.api('/admin/settings', { method: 'POST', body: body }).then(function () { window.toast('Saved', 'success'); });
      });
      document.getElementById('set-reset').addEventListener('click', function () {
        if (!confirm('Wipe all local edits, alarms, work orders, settings? Seed data will reload.')) return;
        WatadApp.api('/admin/reset-demo', { method: 'POST' }).then(function () { window.toast('Demo reset', 'warn'); setTimeout(function () { location.reload(); }, 600); });
      });
    });
  };

  /* =================================================================== Audit log */
  Admin.audit = function (host) {
    WatadApp.api('/admin/audit').then(function (r) {
      var rows = r.body.items;
      var staffMap = {}; D.STAFF.forEach(function (s) { staffMap[s.id] = s.name; });
      host.innerHTML =
          '<div class="wtd-flex" style="margin-bottom:12px;"><span class="wtd-text-muted">' + rows.length + ' entries</span><button class="wtd-btn wtd-btn--sm" id="au-csv" style="margin-inline-start:auto;">Export CSV</button></div>'
        + '<div class="wtd-panel"><table class="wtd-table">'
        + '<thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>'
        + '<tbody>' + (rows.length ? rows.map(function (a) {
            return '<tr><td style="font-family:var(--font-mono);font-size:12px;">' + fmtDt(a.when) + '</td><td>' + esc(staffMap[a.actor] || a.actor) + '</td><td style="font-family:var(--font-mono);font-size:12px;color:var(--wtd-cyan-3);">' + esc(a.action) + '</td><td style="font-family:var(--font-mono);font-size:12px;">' + esc(a.target) + '</td><td style="font-size:12.5px;color:var(--wtd-muted-light);">' + esc(a.details) + '</td></tr>';
          }).join('') : '<tr><td colspan="5" class="wtd-table-empty">No audit entries yet. Do something in the admin to populate this log.</td></tr>')
        + '</tbody></table></div>';
      document.getElementById('au-csv').addEventListener('click', function () {
        var lines = ['when,actor,action,target,details'];
        rows.forEach(function (a) { lines.push([a.when, staffMap[a.actor] || a.actor, a.action, a.target, '"' + (a.details || '').replace(/"/g, '""') + '"'].join(',')); });
        csvDownload('watad-audit-' + new Date().toISOString().slice(0,10) + '.csv', lines);
        window.toast('Exported ' + rows.length + ' entries', 'success');
      });
    });
  };

  window.WatadAdmin = Admin;
})();
