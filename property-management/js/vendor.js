/* vendor.js - Vendor field app. Mobile-first work-order worklist that drives
 * the maintenance state machine from the vendor side. Thin renderer over the
 * shared engine + mock API. */
(function () {
  'use strict';
  var E = window.PMEngine, A = window.PMApp, U = window.PMUI, esc = A.escapeHtml;
  var sess = A.initSession('vendor');
  var content;
  var NAV = [
    { id: 'jobs', icon: '&#128295;', label: 'Jobs' },
    { id: 'history', icon: '&#9989;', label: 'Done' },
    { id: 'profile', icon: '&#128100;', label: 'Profile' }
  ];

  function loading() { content.innerHTML = U.skeleton(5); }
  function boot() { content = U.mountShell({ role: 'vendor', layout: 'mobile', nav: NAV }); window.addEventListener('hashchange', route); route(); }
  function route() {
    var id = (location.hash || '#jobs').slice(1).split('?')[0];
    if (!NAV.some(function (n) { return n.id === id; })) id = 'jobs';
    U.setActiveNav(id);
    ({ jobs: jobs, history: history, profile: profile })[id]();
    content.scrollTop = 0;
  }

  function jobs() {
    loading();
    A.api('/dashboard?role=vendor&id=' + sess.id).then(function (r) {
      var d = r.body, wos = d.work_orders;
      var open = wos.filter(function (w) { return ['assigned', 'scheduled', 'in_progress', 'on_hold'].indexOf(w.status) !== -1; }).sort(function (a, b) { return new Date(a.sla_deadline) - new Date(b.sla_deadline); });
      var earnings = wos.filter(function (w) { return ['completed', 'verified', 'closed'].indexOf(w.status) !== -1; }).reduce(function (a, w) { return a + (w.cost_aed || 0); }, 0);
      content.innerHTML = '<div class="pm-page-head"><div><h1>' + esc(d.vendor.name.split(' ')[0]) + '</h1><div class="pm-sub">' + d.vendor.rating + '&#9733; · ' + d.vendor.trades.map(function (t) { return E.label('category', t); }).join(', ') + '</div></div></div>'
        + '<div class="pm-stat-grid">' + U.kpi({ label: 'Open jobs', value: open.length, tone: 'info' }) + U.kpi({ label: 'SLA breaches', value: open.filter(function (w) { return w.sla_state === 'breach'; }).length, tone: 'urgent' }) + U.kpi({ label: 'Earnings', value: E.aedShort(earnings), tone: 'ok' }) + '</div>'
        + '<div class="pm-card"><h3 style="margin-bottom:10px">Your jobs (' + open.length + ')</h3>' + (open.length ? open.map(jobCard).join('') : U.empty('No open jobs right now.', '&#128295;')) + '</div>';
      wire();
    });
  }
  function history() {
    loading();
    A.api('/dashboard?role=vendor&id=' + sess.id).then(function (r) {
      var wos = r.body.work_orders.filter(function (w) { return ['completed', 'verified', 'closed'].indexOf(w.status) !== -1; });
      content.innerHTML = '<div class="pm-page-head"><h1>Completed</h1></div><div class="pm-card">' + (wos.length ? wos.map(jobCard).join('') : U.empty('No completed jobs yet.')) + '</div>';
      wire();
    });
  }
  function profile() {
    A.api('/vendors/' + sess.id).then(function (r) {
      var v = r.body.vendor, st = r.body.stats;
      content.innerHTML = '<div class="pm-page-head"><h1>Profile</h1></div>'
        + '<div class="pm-card"><div style="display:flex;gap:12px;align-items:center;margin-bottom:12px">' + U.avatar(v.name, 12, 46) + '<div><div style="font-weight:700">' + esc(v.name) + '</div><div class="pm-muted" style="font-size:12px">' + v.rating + '&#9733; · ' + v.jobs_completed + ' jobs done</div></div></div>'
        + '<dl class="pm-kv"><dt>Trades</dt><dd>' + v.trades.map(function (t) { return E.label('category', t); }).join(', ') + '</dd><dt>Trade licence</dt><dd class="pm-mono">' + esc(v.trade_license) + '</dd><dt>SLA</dt><dd>' + v.sla_hours + 'h</dd><dt>Rate</dt><dd>' + E.aed(v.hourly_rate_aed) + '/hr</dd><dt>Active jobs</dt><dd>' + st.open + '</dd></dl></div>';
    });
  }
  function jobCard(w) {
    var s = w.sla_state || 'ok', open = ['assigned', 'scheduled', 'in_progress', 'on_hold'].indexOf(w.status) !== -1;
    return '<div class="pm-wo-card ' + (open && s !== 'ok' ? 'is-' + s : '') + '" data-wo="' + w.id + '" style="margin-bottom:8px">'
      + '<div style="display:flex;justify-content:space-between;gap:8px"><div class="pm-wo-title">' + esc(w.title) + '</div>' + U.chip('wo', w.status) + '</div>'
      + '<div class="pm-wo-meta">' + w.number + ' · ' + U.chip('priority', w.priority) + ' · ' + E.label('category', w.category) + '</div>'
      + '<div class="pm-wo-meta" style="margin-top:4px">' + esc(w.property_name) + ' · ' + esc(w.unit_no) + (open ? ' · <span class="pm-sla ' + s + '">' + E.humanMins(w.sla_mins_left) + '</span>' : (w.cost_aed ? ' · ' + E.aed(w.cost_aed) : '')) + '</div></div>';
  }
  function wire() { content.querySelectorAll('[data-wo]').forEach(function (c) { c.addEventListener('click', function () { openJob(c.getAttribute('data-wo')); }); }); }

  function openJob(id) {
    A.api('/work-orders/' + id).then(function (r) {
      var w = r.body.work_order, acts = r.body.actions.vendor, tenant = r.body.tenant;
      var body = '<div style="display:flex;justify-content:space-between;margin-bottom:8px"><b>' + w.number + '</b>' + U.chip('wo', w.status) + '</div>'
        + '<dl class="pm-kv" style="margin-bottom:12px"><dt>Location</dt><dd>' + esc(w.property_name) + ' · ' + esc(w.unit_no) + '</dd><dt>Category</dt><dd>' + E.label('category', w.category) + '</dd><dt>Priority</dt><dd>' + U.chip('priority', w.priority) + '</dd>' + (tenant ? '<dt>Resident</dt><dd>' + esc(tenant.name) + '</dd><dt>Contact</dt><dd><a href="tel:' + esc(tenant.phone) + '" style="color:var(--pm-primary)">' + esc(tenant.phone) + '</a></dd>' : '') + (['completed', 'verified', 'closed'].indexOf(w.status) === -1 ? '<dt>SLA</dt><dd class="pm-sla ' + w.sla_state + '">' + E.humanMins(w.sla_mins_left) + '</dd>' : '') + '</dl>'
        + '<p style="font-size:13px">' + esc(w.description) + '</p>'
        + (w.status === 'in_progress' ? '<div class="pm-field" style="margin-top:12px"><label>Work notes</label><textarea class="pm-textarea" id="j-notes" placeholder="What did you do?"></textarea></div><div class="pm-field"><label>Cost (AED)</label><input class="pm-input" id="j-cost" type="number" placeholder="e.g. 450"></div>' : '');
      var foot = '';
      acts.forEach(function (a) {
        var cls = (a.action === 'complete' || a.action === 'start') ? 'pm-btn--teal' : 'pm-btn--ghost';
        foot += '<button class="pm-btn ' + cls + '" data-act="' + a.action + '">' + a.label + '</button>';
      });
      var mo = A.showModal({
        title: esc(w.title), size: 'sm', body: body, foot: foot || '<button class="pm-btn pm-btn--ghost" data-close>Close</button>',
        onMount: function (el, close) {
          el.querySelectorAll('[data-act]').forEach(function (b) {
            b.addEventListener('click', function () {
              var act = b.getAttribute('data-act');
              var payload = { action: act, role: 'vendor' };
              if (act === 'complete') { payload.cost_aed = +(el.querySelector('#j-cost') ? el.querySelector('#j-cost').value : 0) || 0; payload.notes = el.querySelector('#j-notes') ? el.querySelector('#j-notes').value : ''; }
              if (act === 'schedule') payload.scheduled_for = new Date(Date.now() + 86400000).toISOString();
              if (act === 'hold') payload.reason = 'awaiting_parts';
              A.api('/work-orders/' + id + '/transition', { method: 'POST', body: payload }).then(function (res) {
                close();
                window.toast(act === 'complete' ? 'Job completed' : act === 'start' ? 'Work started' : 'Updated', 'success');
                if (act === 'complete' && window.PMAudio) PMAudio.success();
                if (window.__pmBellRefresh) window.__pmBellRefresh();
                route();
              });
            });
          });
        }
      });
      void mo;
    });
  }

  boot();
})();
