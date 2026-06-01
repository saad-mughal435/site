/* admin-sections.js — Marsad admin section renderers. */
(function () {
  'use strict';
  var D = window.MARSAD_DATA;
  var esc = MarsadApp.escapeHtml;
  var fmtDt = MarsadApp.fmtDateTime;
  var Admin = {};

  // =================== Dashboard ===================
  Admin.dashboard = function (host) {
    MarsadApp.api('/admin/dashboard').then(function (r) {
      var d = r.body;
      var k = d.kpis;
      var zonesHtml = (d.top_zones || []).map(function (t, i) {
        return '<tr><td style="font-family:var(--mrs-mono);color:var(--mrs-muted);width:24px;">' + (i + 1) + '</td><td><strong>' + esc(t.zone.name) + '</strong></td><td style="text-align:right;font-family:var(--mrs-mono);">' + t.count + '</td></tr>';
      }).join('');
      var leadHtml = (d.leaderboard || []).map(function (drv, i) {
        return '<tr><td style="font-family:var(--mrs-mono);color:var(--mrs-muted);width:24px;">' + (i + 1) + '</td><td>' + esc(drv.name) + '</td><td style="text-align:right;font-family:var(--mrs-mono);color:var(--mrs-mint);">' + drv.on_time_pct + '%</td></tr>';
      }).join('');
      var recentHtml = (d.recent_orders || []).map(function (o) {
        return '<tr><td><strong>' + esc(o.number) + '</strong></td><td>' + esc(o.customer_name) + '</td><td>' + esc(o.zone_name) + '</td><td><span class="mrs-chip ' + MarsadApp.STATUS_COLOR[o.status] + '">' + MarsadApp.STATUS_LABEL[o.status] + '</span></td><td style="font-family:var(--mrs-mono);font-size:11.5px;">' + esc(fmtDt(o.placed_at)) + '</td></tr>';
      }).join('');

      host.innerHTML =
          '<div class="mrs-kpi-grid">'
        +   kpi('Pending', k.pending, 'awaiting assign')
        +   kpi('In-flight', k.in_flight, 'on the road')
        +   kpi('Delivered today', k.delivered_today, 'since 00:00')
        +   kpi('SLA breaches', k.sla_breaches, k.sla_breaches ? 'investigate' : 'all clear', k.sla_breaches > 0 ? 'danger' : 'ok')
        +   kpi('On-time', k.on_time_pct + '%', 'last 24h', k.on_time_pct < 90 ? 'warn' : 'ok')
        +   kpi('Online drivers', k.online_drivers, k.total_vehicles + ' vehicles')
        + '</div>'
        + '<div style="display:grid;grid-template-columns:1.5fr 1fr;gap:14px;margin-top:18px;">'
        +   '<div class="mrs-card"><h3 style="margin-bottom:10px;">Top zones today</h3><table class="mrs-table">' + zonesHtml + '</table></div>'
        +   '<div class="mrs-card"><h3 style="margin-bottom:10px;">Driver leaderboard</h3><table class="mrs-table">' + leadHtml + '</table></div>'
        + '</div>'
        + '<div class="mrs-card" style="margin-top:14px;">'
        +   '<h3 style="margin-bottom:10px;">Recent orders</h3>'
        +   '<table class="mrs-table"><thead><tr><th>#</th><th>Customer</th><th>Zone</th><th>Status</th><th>Placed</th></tr></thead><tbody>' + recentHtml + '</tbody></table>'
        + '</div>';
    });
  };
  function kpi(label, value, sub, kind) {
    return '<div class="mrs-kpi-card is-' + (kind || 'ok') + '">'
      + '<div class="mrs-kpi-label">' + esc(label) + '</div>'
      + '<div class="mrs-kpi-value">' + esc(String(value)) + '</div>'
      + '<div class="mrs-kpi-sub">' + esc(sub) + '</div>'
      + '</div>';
  }

  // =================== Orders ===================
  Admin.orders = function (host) {
    var state = { status: 'all', q: '' };
    function paint() {
      var params = [];
      if (state.status !== 'all') params.push('status=' + encodeURIComponent(state.status));
      if (state.q) params.push('q=' + encodeURIComponent(state.q));
      MarsadApp.api('/orders' + (params.length ? '?' + params.join('&') : '')).then(function (r) {
        var rows = r.body.items || [];
        var driverMap = {}; D.DRIVERS.forEach(function (d) { driverMap[d.id] = d; });

        var filterChipsHtml = ['all','pending','assigned','in_transit','delivered','failed'].map(function (s) {
          return '<button class="mrs-chip' + (state.status === s ? ' active' : '') + '" data-s="' + s + '">' + esc(MarsadApp.STATUS_LABEL[s] || s) + '</button>';
        }).join('');

        var bodyHtml = rows.length === 0
          ? '<tr><td colspan="7" style="text-align:center;color:var(--mrs-muted);padding:30px;">No orders match.</td></tr>'
          : rows.slice(0, 50).map(function (o) {
              var dr = driverMap[o.driver_id];
              var slaMin = Math.round((new Date(o.sla_deadline) - new Date()) / 60000);
              var slaTxt = o.sla_breached ? '<span class="mrs-sla breach">BREACH</span>' : (slaMin > 0 ? slaMin + ' min' : 'past');
              return '<tr>'
                + '<td style="font-family:var(--mrs-mono);font-weight:700;">' + esc(o.number) + '</td>'
                + '<td>' + esc(o.customer_name) + (o.cod_aed ? '<br/><small style="color:var(--mrs-amber);">COD ' + MarsadApp.fmtMoney(o.cod_aed) + '</small>' : '') + '</td>'
                + '<td style="font-size:12px;">' + esc(o.zone_name) + '</td>'
                + '<td style="font-size:12px;">' + (dr ? esc(dr.name) : '<em>—</em>') + '</td>'
                + '<td><span class="mrs-chip ' + MarsadApp.STATUS_COLOR[o.status] + '">' + esc(MarsadApp.STATUS_LABEL[o.status]) + '</span></td>'
                + '<td style="font-family:var(--mrs-mono);font-size:11.5px;">' + slaTxt + '</td>'
                + '<td style="font-family:var(--mrs-mono);font-size:11.5px;">' + esc(fmtDt(o.placed_at)) + '</td>'
                + '</tr>';
            }).join('');

        host.innerHTML =
            '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;align-items:center;">'
          +   filterChipsHtml
          +   '<input class="mrs-input mrs-input--sm" id="ord-q" placeholder="Search…" style="max-width:240px;margin-inline-start:auto;" value="' + esc(state.q) + '"/>'
          +   '<span style="font-size:12.5px;color:var(--mrs-muted);">' + rows.length + ' orders</span>'
          + '</div>'
          + '<div class="mrs-panel">'
          +   '<table class="mrs-table">'
          +     '<thead><tr><th>#</th><th>Customer</th><th>Zone</th><th>Driver</th><th>Status</th><th>SLA</th><th>Placed</th></tr></thead>'
          +     '<tbody>' + bodyHtml + '</tbody>'
          +   '</table>'
          + '</div>';
        host.querySelectorAll('[data-s]').forEach(function (b) {
          b.addEventListener('click', function () { state.status = b.getAttribute('data-s'); paint(); });
        });
        var q = host.querySelector('#ord-q');
        q.addEventListener('input', function (e) { state.q = e.target.value; clearTimeout(window.__mrsQ); window.__mrsQ = setTimeout(paint, 200); });
      });
    }
    paint();
  };

  // =================== Drivers ===================
  Admin.drivers = function (host) {
    MarsadApp.api('/drivers').then(function (r) {
      var rows = r.body.items || [];
      var bodyHtml = rows.map(function (d) {
        var sla = d.on_time_pct >= 92 ? 'var(--mrs-mint)' : d.on_time_pct >= 86 ? 'var(--mrs-amber)' : 'var(--mrs-coral)';
        return '<tr>'
          + '<td><span class="mrs-avatar">' + esc(initials(d.name)) + '</span></td>'
          + '<td><strong>' + esc(d.name) + '</strong></td>'
          + '<td>' + esc(d.shift) + '</td>'
          + '<td style="font-size:12px;font-family:var(--mrs-mono);">' + esc(d.phone) + '</td>'
          + '<td><span class="mrs-chip ' + d.status + '">' + esc(d.status.replace(/_/g, ' ')) + '</span></td>'
          + '<td style="text-align:right;font-family:var(--mrs-mono);">' + d.done_90d + '</td>'
          + '<td style="text-align:right;font-family:var(--mrs-mono);color:' + sla + ';">' + d.on_time_pct + '%</td>'
          + '<td style="text-align:right;font-family:var(--mrs-mono);">★ ' + d.rating + '</td>'
          + '</tr>';
      }).join('');

      host.innerHTML =
          '<div class="mrs-panel"><table class="mrs-table">'
        +   '<thead><tr><th></th><th>Name</th><th>Shift</th><th>Phone</th><th>Status</th><th>Done (90d)</th><th>SLA %</th><th>Rating</th></tr></thead>'
        +   '<tbody>' + bodyHtml + '</tbody>'
        + '</table></div>';
    });
  };
  function initials(n) { return String(n || '?').split(/\s+/).slice(0,2).map(function (x) { return x[0] || ''; }).join('').toUpperCase(); }

  // =================== Vehicles ===================
  Admin.vehicles = function (host) {
    MarsadApp.api('/vehicles').then(function (r) {
      var rows = r.body.items || [];
      var driverMap = {}; D.DRIVERS.forEach(function (d) { driverMap[d.id] = d; });
      var bodyHtml = rows.map(function (v) {
        var dr = driverMap[v.driver_id];
        var fuelCls = v.fuel_pct < 25 ? 'is-danger' : v.fuel_pct < 50 ? 'is-warn' : 'is-ok';
        return '<tr>'
          + '<td style="font-family:var(--mrs-mono);font-weight:700;">' + esc(v.reg) + '</td>'
          + '<td><span class="mrs-chip">' + esc(v.type) + '</span></td>'
          + '<td style="text-align:right;">' + v.capacity + '</td>'
          + '<td>' + (dr ? esc(dr.name) : '<em>—</em>') + '</td>'
          + '<td style="text-align:right;font-family:var(--mrs-mono);">' + Math.round(v.speed_kmh || 0) + ' km/h</td>'
          + '<td style="text-align:right;"><span class="mrs-fuel ' + fuelCls + '">' + Math.round(v.fuel_pct || 0) + '%</span></td>'
          + '<td style="text-align:right;font-family:var(--mrs-mono);font-size:12px;">' + esc(v.odo_km.toLocaleString()) + ' km</td>'
          + '<td style="font-family:var(--mrs-mono);font-size:11.5px;">' + MarsadApp.fmtTime(v.last_ping) + '</td>'
          + '</tr>';
      }).join('');

      host.innerHTML =
          '<div class="mrs-panel"><table class="mrs-table">'
        +   '<thead><tr><th>Reg</th><th>Type</th><th>Capacity</th><th>Driver</th><th>Speed</th><th>Fuel</th><th>Odometer</th><th>Last ping</th></tr></thead>'
        +   '<tbody>' + bodyHtml + '</tbody>'
        + '</table></div>';
    });
  };

  // =================== Zones ===================
  Admin.zones = function (host) {
    MarsadApp.api('/zones').then(function (r) {
      var zones = r.body.items || [];
      MarsadApp.api('/orders').then(function (or) {
        var ords = or.body.items || [];
        var counts = {};
        ords.forEach(function (o) { counts[o.zone_id] = (counts[o.zone_id] || 0) + 1; });
        var bodyHtml = zones.map(function (z) {
          return '<tr>'
            + '<td><span style="display:inline-block;width:14px;height:14px;border-radius:4px;background:' + z.color + ';"></span></td>'
            + '<td><strong>' + esc(z.name) + '</strong></td>'
            + '<td>' + z.sla_min + ' min</td>'
            + '<td style="text-align:right;font-family:var(--mrs-mono);">' + (counts[z.id] || 0) + '</td>'
            + '</tr>';
        }).join('');

        host.innerHTML =
            '<div class="mrs-panel"><table class="mrs-table">'
          +   '<thead><tr><th></th><th>Zone</th><th>SLA</th><th>Today\'s orders</th></tr></thead>'
          +   '<tbody>' + bodyHtml + '</tbody>'
          + '</table></div>';
      });
    });
  };

  // =================== Integrations ===================
  Admin.integrations = function (host) {
    function paint() {
      MarsadApp.api('/integrations').then(function (r) {
        var rows = r.body.items || [];
        host.innerHTML = '<div style="display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));">'
          + rows.map(function (i) {
              var on = i.status === 'connected';
              return '<div class="mrs-card">'
                + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">'
                +   '<span style="font-size:24px;">' + esc(i.icon || '🔗') + '</span>'
                +   '<div style="flex:1;"><div style="font-weight:700;">' + esc(i.name) + '</div><div style="font-size:11.5px;color:var(--mrs-muted);">' + (on ? 'Connected' : 'Not connected') + '</div></div>'
                +   (on ? '<span class="mrs-chip ok">●</span>' : '<span class="mrs-chip">○</span>')
                + '</div>'
                + (i.details ? '<div style="font-size:12px;color:var(--mrs-muted);margin-bottom:10px;">' + esc(i.details) + '</div>' : '')
                + '<button class="mrs-btn mrs-btn--sm" style="width:100%;" data-int="' + esc(i.id) + '">' + (on ? 'Disconnect' : 'Connect') + '</button>'
                + '</div>';
            }).join('') + '</div>';
        host.querySelectorAll('[data-int]').forEach(function (b) {
          b.addEventListener('click', function () {
            MarsadApp.api('/integrations/' + b.getAttribute('data-int'), { method: 'POST' }).then(function () {
              window.toast('Toggled (demo)', 'success'); paint();
            });
          });
        });
      });
    }
    paint();
  };

  // =================== AI Console ===================
  Admin.ai_console = function (host) {
    MarsadApp.api('/admin/settings').then(function (r) {
      var s = r.body.settings;
      var models = [
        ['claude-haiku-4-5-20251001', 'Haiku 4.5', 'Fastest · cheapest'],
        ['claude-sonnet-4-6',         'Sonnet 4.6', 'Balanced'],
        ['claude-opus-4-8',           'Opus 4.8',   'Highest quality']
      ];
      host.innerHTML =
          '<div class="mrs-card" style="margin-bottom:14px;"><h3 style="margin-bottom:14px;">Model</h3>'
        + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">'
        + models.map(function (m) {
            var on = s.model === m[0];
            return '<label style="display:block;padding:14px;border-radius:10px;border:2px solid ' + (on ? 'var(--mrs-coral)' : 'var(--mrs-line-2)') + ';cursor:pointer;background:' + (on ? 'rgba(255,115,115,0.06)' : 'var(--mrs-surface)') + ';">'
              + '<input type="radio" name="m" value="' + m[0] + '"' + (on ? ' checked' : '') + ' style="display:none;"/>'
              + '<div style="font-weight:700;font-size:14px;">' + esc(m[1]) + '</div>'
              + '<div style="font-size:11.5px;color:var(--mrs-muted);margin-top:4px;">' + esc(m[2]) + '</div>'
              + '</label>';
          }).join('')
        + '</div></div>'
        + '<div class="mrs-card" style="margin-bottom:14px;"><h3 style="margin-bottom:6px;">System prompt</h3>'
        + '<textarea class="mrs-input" id="sysp" rows="4">' + esc(s.system_prompt) + '</textarea>'
        + '</div>'
        + '<div style="display:flex;gap:8px;">'
        + '<button class="mrs-btn mrs-btn--primary" id="save-ai">Save settings</button>'
        + '<button class="mrs-btn" id="test-ai" style="margin-inline-start:auto;">Test with sample</button>'
        + '</div>'
        + '<div id="test-out" style="margin-top:14px;"></div>';
      document.getElementById('save-ai').addEventListener('click', function () {
        var model = (document.querySelector('input[name="m"]:checked') || {}).value;
        MarsadApp.api('/admin/settings', { method: 'POST', body: { model: model, system_prompt: document.getElementById('sysp').value } }).then(function () { window.toast('Saved', 'success'); });
      });
      document.getElementById('test-ai').addEventListener('click', function () {
        document.getElementById('test-out').innerHTML = '<div class="mrs-ai-panel"><span class="mrs-ai-loading"></span> Sample dispatcher question…</div>';
        MarsadAI.dispatcherChat({ question: 'Any breaches right now?', state: {} }).then(function (r) {
          document.getElementById('test-out').innerHTML =
              '<div class="mrs-card"><h4>Sample response ' + (r.fallback ? '<span class="mrs-mode-badge" style="font-size:9.5px;">mock</span>' : '<span class="mrs-mode-badge live" style="font-size:9.5px;">live</span>') + '</h4>'
            + '<div style="white-space:pre-wrap;font-size:13.5px;line-height:1.6;">' + esc(r.text) + '</div></div>';
        });
      });
    });
  };

  // =================== Settings ===================
  Admin.settings = function (host) {
    MarsadApp.api('/admin/settings').then(function (r) {
      var s = r.body.settings;
      host.innerHTML =
          '<div class="mrs-card" style="margin-bottom:14px;"><h3 style="margin-bottom:14px;">Business</h3>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">'
        + '<div class="mrs-field"><span>Business name</span><input class="mrs-input" id="set-name" value="' + esc(s.business_name) + '"/></div>'
        + '<div class="mrs-field"><span>Hub</span><input class="mrs-input" id="set-hub" value="' + esc(s.hub_name) + '"/></div>'
        + '<div class="mrs-field"><span>Currency</span><input class="mrs-input" id="set-cur" value="' + esc(s.currency) + '"/></div>'
        + '<div class="mrs-field"><span>Default SLA (min)</span><input class="mrs-input" type="number" id="set-sla" value="' + s.sla_default_min + '"/></div>'
        + '<div class="mrs-field"><span>COD max (AED)</span><input class="mrs-input" type="number" id="set-cod" value="' + s.cod_max_aed + '"/></div>'
        + '<div class="mrs-field"><span>Fuel alert below (%)</span><input class="mrs-input" type="number" id="set-fuel" value="' + s.fuel_alert_pct + '"/></div>'
        + '</div></div>'
        + '<div class="mrs-card" style="margin-bottom:14px;"><h3 style="margin-bottom:14px;">Driver compensation</h3>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">'
        + '<div class="mrs-field"><span>Rate per delivery (AED)</span><input class="mrs-input" type="number" id="set-rate" value="' + s.rate_per_delivery_aed + '"/></div>'
        + '<div class="mrs-field"><span>Incentive (AED)</span><input class="mrs-input" type="number" id="set-inc" value="' + s.incentive_per_delivery_aed + '"/></div>'
        + '</div></div>'
        + '<div style="display:flex;gap:8px;">'
        + '<button class="mrs-btn mrs-btn--primary" id="set-save">Save settings</button>'
        + '<button class="mrs-btn" id="set-reset" style="margin-inline-start:auto;color:var(--mrs-coral);border-color:rgba(255,115,115,0.4);">Reset demo data</button>'
        + '</div>';
      document.getElementById('set-save').addEventListener('click', function () {
        MarsadApp.api('/admin/settings', { method: 'POST', body: {
          business_name: document.getElementById('set-name').value,
          hub_name: document.getElementById('set-hub').value,
          currency: document.getElementById('set-cur').value,
          sla_default_min: +document.getElementById('set-sla').value,
          cod_max_aed: +document.getElementById('set-cod').value,
          fuel_alert_pct: +document.getElementById('set-fuel').value,
          rate_per_delivery_aed: +document.getElementById('set-rate').value,
          incentive_per_delivery_aed: +document.getElementById('set-inc').value
        }}).then(function () { window.toast('Saved', 'success'); });
      });
      document.getElementById('set-reset').addEventListener('click', function () {
        if (!confirm('Wipe all local edits + restart the sim from seed?')) return;
        MarsadApp.api('/admin/reset-demo', { method: 'POST' }).then(function () { window.toast('Demo reset', 'warn'); setTimeout(function () { location.reload(); }, 500); });
      });
    });
  };

  // =================== Audit log ===================
  Admin.audit = function (host) {
    MarsadApp.api('/admin/audit').then(function (r) {
      var rows = r.body.items || [];
      host.innerHTML =
          '<div style="display:flex;align-items:center;margin-bottom:10px;"><span style="color:var(--mrs-muted);">' + rows.length + ' entries</span></div>'
        + '<div class="mrs-panel"><table class="mrs-table">'
        + '<thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>'
        + '<tbody>'
        + (rows.length === 0
            ? '<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--mrs-muted);">No audit entries yet. Do something in the admin to populate this log.</td></tr>'
            : rows.map(function (a) {
                return '<tr><td style="font-family:var(--mrs-mono);font-size:12px;">' + esc(fmtDt(a.when)) + '</td>'
                  + '<td>' + esc(a.actor) + '</td>'
                  + '<td style="font-family:var(--mrs-mono);color:var(--mrs-coral);">' + esc(a.action) + '</td>'
                  + '<td style="font-family:var(--mrs-mono);">' + esc(a.target) + '</td>'
                  + '<td style="font-size:12.5px;color:var(--mrs-muted);">' + esc(a.details) + '</td></tr>';
              }).join(''))
        + '</tbody></table></div>';
    });
  };

  window.MarsadAdmin = Admin;
})();
