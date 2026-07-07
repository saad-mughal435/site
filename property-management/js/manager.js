/* manager.js - Property Manager console. Hash-routed sidebar SPA that is the
 * operational hub across every entity. Thin renderer over PMApp/PMUI/PMEngine +
 * the mock API - it holds no business rules. */
(function () {
  'use strict';
  var E = window.PMEngine, A = window.PMApp, U = window.PMUI, esc = A.escapeHtml;
  var sess = A.initSession('manager');
  var content;

  var NAV = [
    { id: 'overview', icon: '&#128202;', label: 'Overview' },
    { id: 'properties', icon: '&#127970;', label: 'Properties' },
    { id: 'tenants', icon: '&#128101;', label: 'Tenants' },
    { id: 'leases', icon: '&#128196;', label: 'Leases' },
    { id: 'collection', icon: '&#128181;', label: 'Rent collection' },
    { id: 'maintenance', icon: '&#128295;', label: 'Maintenance' },
    { id: 'approvals', icon: '&#9989;', label: 'Approvals' },
    { id: 'helpdesk', icon: '&#127903;', label: 'Help desk' },
    { id: 'reports', icon: '&#128200;', label: 'Reports' }
  ];

  function head(title, sub, actions) { return '<div class="pm-page-head"><div><h1>' + esc(title) + '</h1>' + (sub ? '<div class="pm-sub">' + esc(sub) + '</div>' : '') + '</div>' + (actions ? '<div class="pm-btn-row">' + actions + '</div>' : '') + '</div>'; }
  function loading() { content.innerHTML = U.skeleton(6); }

  function boot() { content = U.mountShell({ role: 'manager', layout: 'sidebar', nav: NAV }); window.addEventListener('hashchange', route); route(); }
  function route() {
    var id = (location.hash || '#overview').slice(1).split('?')[0];
    if (!NAV.some(function (n) { return n.id === id; })) id = 'overview';
    U.setActiveNav(id);
    ({ overview: overview, properties: properties, tenants: tenants, leases: leases, collection: collection, maintenance: maintenance, approvals: approvals, helpdesk: helpdesk, reports: reports })[id]();
    content.scrollTop = 0;
  }

  // ---------------- Overview ----------------
  function overview() {
    loading();
    Promise.all([A.api('/dashboard?role=manager'), A.api('/analytics/arrears'), A.api('/leases?expiring_in_days=90')]).then(function (rs) {
      var d = rs[0].body, k = d.kpis, ag = rs[1].body.buckets, exp = rs[2].body.items;
      var agMax = Math.max(ag['0-30'], ag['31-60'], ag['61-90'], ag['90+'], 1);
      content.innerHTML = head('Overview', 'Portfolio at a glance - ' + esc(d.manager.name))
        + '<div class="pm-stat-grid">'
        + U.kpi({ label: 'Occupancy', value: E.pct(k.occupancy_pct), tone: 'ok' })
        + U.kpi({ label: 'Collection rate', value: E.pct(k.collection_rate), tone: k.collection_rate >= 85 ? 'ok' : 'warn' })
        + U.kpi({ label: 'Open work orders', value: k.open_work_orders, tone: 'info' })
        + U.kpi({ label: 'SLA breaches', value: k.sla_breaches, tone: k.sla_breaches ? 'urgent' : 'ok' })
        + U.kpi({ label: 'Arrears', value: E.aedShort(k.arrears_aed), tone: 'warn' })
        + U.kpi({ label: 'Leases expiring 90d', value: k.expiring_leases, tone: 'info' }) + '</div>'
        + '<div class="pm-cols-3"><div class="pm-card"><div class="pm-card-head"><h3>Recent maintenance</h3><a class="pm-muted" href="#maintenance" style="font-size:12px">Board &rarr;</a></div>'
        + U.table([
          { h: 'Order', cell: function (w) { return '<b>' + w.number + '</b><br><small class="pm-muted">' + esc(w.title) + '</small>'; } },
          { h: 'Property', cell: function (w) { return esc(w.property_name) + ' · ' + esc(w.unit_no); } },
          { h: 'Priority', cell: function (w) { return U.chip('priority', w.priority); } },
          { h: 'Status', cell: function (w) { return U.chip('wo', w.status); } }
        ], d.recent_wos) + '</div>'
        + '<div class="pm-card"><div class="pm-card-head"><h3>Arrears aging</h3></div>'
        + U.barsH([
          { label: '0-30 days', value: ag['0-30'], display: E.aedShort(ag['0-30']), color: 'var(--pm-warn)' },
          { label: '31-60 days', value: ag['31-60'], display: E.aedShort(ag['31-60']), color: 'var(--pm-warn)' },
          { label: '61-90 days', value: ag['61-90'], display: E.aedShort(ag['61-90']), color: 'var(--pm-urgent)' },
          { label: '90+ days', value: ag['90+'], display: E.aedShort(ag['90+']), color: 'var(--pm-urgent)' }
        ]) + '<div style="margin-top:14px"><div class="pm-card-head"><h3 style="font-size:14px">Expiring soon</h3></div>'
        + (exp.slice(0, 5).map(function (l) { return '<div class="pm-listrow" style="margin-bottom:6px"><div class="l"><div><b>' + esc(l.property_name) + '</b><small>' + esc(l.tenant_name) + ' · ends ' + A.fmtDate(l.end_date) + '</small></div></div><span class="pm-chip pm-chip--' + (l.expiry.days_to_end <= 30 ? 'urgent' : 'warn') + '">' + l.expiry.days_to_end + 'd</span></div>'; }).join('') || '<p class="pm-muted" style="font-size:13px">None.</p>') + '</div></div></div>';
      content.querySelectorAll('#maintenance');
    });
  }

  // ---------------- Properties ----------------
  function properties() {
    loading();
    A.api('/properties').then(function (r) {
      var props = r.body.items;
      content.innerHTML = head('Properties & units', props.length + ' managed assets')
        + '<div class="pm-card">' + U.table([
          { h: 'Property', cell: function (p) { return '<b>' + esc(p.name) + '</b><br><small class="pm-muted">' + esc(p.community_name) + '</small>'; } },
          { h: 'Type', cell: function (p) { return esc(p.type.replace(/_/g, ' ')); } },
          { h: 'Units', r: true, cell: function (p) { return p.total_units; } },
          { h: 'Occupancy', cell: function (p) { return '<div style="display:flex;align-items:center;gap:8px"><div class="pm-barh-track" style="width:90px"><span class="pm-barh-fill" style="width:' + p.occupancy_pct + '%"></span></div><span>' + E.pct(p.occupancy_pct, 0) + '</span></div>'; } },
          { h: '', r: true, cell: function (p) { return '<button class="pm-btn pm-btn--sm pm-btn--ghost" data-prop="' + p.id + '">Units</button>'; } }
        ], props) + '</div>';
      content.querySelectorAll('[data-prop]').forEach(function (b) { b.addEventListener('click', function () { openProperty(b.getAttribute('data-prop')); }); });
    });
  }
  function openProperty(id) {
    A.api('/properties/' + id).then(function (r) {
      var p = r.body.property, units = r.body.units;
      A.showModal({
        title: esc(p.name), size: 'lg',
        body: '<div class="pm-stat-grid" style="margin-bottom:12px">' + U.kpi({ label: 'Units', value: p.total_units }) + U.kpi({ label: 'Occupied', value: p.occupancy.occupied, tone: 'ok' }) + U.kpi({ label: 'Vacant', value: p.occupancy.vacant, tone: 'warn' }) + U.kpi({ label: 'Valuation', value: E.aedShort(p.valuation_aed) }) + '</div>'
          + U.table([
            { h: 'Unit', cell: function (u) { return '<b>' + esc(u.unit_no) + '</b>'; } },
            { h: 'Type', cell: function (u) { return esc(u.type); } },
            { h: 'Rent', r: true, cell: function (u) { return E.aed(u.market_rent_aed); } },
            { h: 'Status', cell: function (u) { return U.chip('unit', u.status); } }
          ], units)
      });
    });
  }

  // ---------------- Tenants ----------------
  function tenants() {
    var stateQ = '';
    loading();
    function paint() {
      A.api('/tenants' + (stateQ ? '?q=' + encodeURIComponent(stateQ) : '')).then(function (r) {
        var ts = r.body.items;
        content.innerHTML = head('Tenants', ts.length + ' residents')
          + '<div class="pm-toolbar"><input class="pm-search" id="t-q" placeholder="Search tenants..." value="' + esc(stateQ) + '"></div>'
          + '<div class="pm-card">' + U.table([
            { h: 'Tenant', cell: function (t) { return '<div style="display:flex;gap:9px;align-items:center">' + U.avatar(t.name, t.avatar_hue, 30) + '<div><b>' + esc(t.name) + '</b><br><small class="pm-muted">' + esc(t.nationality) + '</small></div></div>'; } },
            { h: 'Unit', cell: function (t) { return esc(t.property_name || '-') + ' · ' + esc(t.unit_no || ''); } },
            { h: 'Reliability', cell: function (t) { return '<span class="pm-chip pm-chip--' + (t.reliability >= 4.3 ? 'ok' : t.reliability >= 3.7 ? 'warn' : 'urgent') + '">' + t.reliability + '&#9733;</span>'; } },
            { h: 'KYC', cell: function (t) { return t.kyc_verified ? U.chip('lease', 'active') : U.chip('invoice', 'due'); } },
            { h: '', r: true, cell: function (t) { return '<button class="pm-btn pm-btn--sm pm-btn--ghost" data-t="' + t.id + '">View</button>'; } }
          ], ts) + '</div>';
        var q = content.querySelector('#t-q'); var tmr;
        q.addEventListener('input', function () { clearTimeout(tmr); tmr = setTimeout(function () { stateQ = q.value; paint(); }, 250); });
        content.querySelectorAll('[data-t]').forEach(function (b) { b.addEventListener('click', function () { openTenant(b.getAttribute('data-t')); }); });
      });
    }
    paint();
  }
  function openTenant(id) {
    A.api('/tenants/' + id).then(function (r) {
      var t = r.body.tenant, lease = r.body.lease, unit = r.body.unit, inv = r.body.invoices, wos = r.body.work_orders, tks = r.body.tickets;
      var outstanding = inv.filter(function (i) { return i.status === 'overdue' || i.status === 'due'; }).reduce(function (a, i) { return a + i.outstanding_aed; }, 0);
      A.showModal({
        title: esc(t.name), size: 'lg',
        body: '<div class="pm-stat-grid" style="margin-bottom:12px">' + U.kpi({ label: 'Unit', value: esc((unit || {}).unit_no || '-') }) + U.kpi({ label: 'Annual rent', value: lease ? E.aedShort(lease.annual_rent_aed) : '-' }) + U.kpi({ label: 'Outstanding', value: E.aedShort(outstanding), tone: outstanding ? 'warn' : 'ok' }) + U.kpi({ label: 'Reliability', value: t.reliability + '&#9733;' }) + '</div>'
          + '<dl class="pm-kv" style="margin-bottom:14px"><dt>Email</dt><dd>' + esc(t.email) + '</dd><dt>Phone</dt><dd>' + esc(t.phone) + '</dd><dt>Emirates ID</dt><dd class="pm-mono">' + esc(t.emirates_id) + '</dd>' + (lease ? '<dt>Ejari</dt><dd class="pm-mono">' + esc(lease.ejari_no) + '</dd><dt>Lease ends</dt><dd>' + A.fmtDate(lease.end_date) + '</dd>' : '') + '</dl>'
          + '<h4 style="font-size:13px;margin:0 0 6px">Recent invoices</h4>' + U.table([{ h: 'Invoice', cell: function (i) { return i.number; } }, { h: 'Due', cell: function (i) { return A.fmtDate(i.due_date); } }, { h: 'Amount', r: true, cell: function (i) { return E.aed(i.amount_aed); } }, { h: 'Status', cell: function (i) { return U.chip('invoice', i.status); } }], inv.slice(0, 4))
          + '<h4 style="font-size:13px;margin:14px 0 6px">Open work orders (' + wos.filter(function (w) { return ['completed', 'verified', 'closed', 'cancelled'].indexOf(w.status) === -1; }).length + ') · Tickets (' + tks.length + ')</h4>'
      });
    });
  }

  // ---------------- Leases ----------------
  function leases() {
    var win = '';
    loading();
    function paint() {
      A.api('/leases' + (win ? '?expiring_in_days=' + win : '')).then(function (r) {
        var ls = r.body.items;
        content.innerHTML = head('Leases', ls.length + ' matching')
          + '<div class="pm-toolbar"><div class="pm-filters" id="l-win">' + ['', '30', '60', '90'].map(function (w) { return '<button class="pm-filter ' + (win === w ? 'is-active' : '') + '" data-w="' + w + '">' + (w ? 'Expiring ' + w + 'd' : 'All') + '</button>'; }).join('') + '</div></div>'
          + '<div class="pm-card">' + U.table([
            { h: 'Unit', cell: function (l) { return '<b>' + esc(l.property_name) + '</b><br><small class="pm-muted">' + esc(l.tenant_name) + '</small>'; } },
            { h: 'Rent', r: true, cell: function (l) { return E.aed(l.annual_rent_aed); } },
            { h: 'Cheques', r: true, cell: function (l) { return l.cheque_count; } },
            { h: 'Ends', cell: function (l) { return A.fmtDate(l.end_date) + ' <small class="pm-muted">(' + (l.expiry.days_to_end >= 0 ? l.expiry.days_to_end + 'd' : 'exp') + ')</small>'; } },
            { h: 'Status', cell: function (l) { return U.chip('lease', l.status); } },
            { h: '', r: true, cell: function (l) { return '<button class="pm-btn pm-btn--sm pm-btn--ghost" data-l="' + l.id + '">Manage</button>'; } }
          ], ls) + '</div>';
        content.querySelectorAll('#l-win .pm-filter').forEach(function (b) { b.addEventListener('click', function () { win = b.getAttribute('data-w'); paint(); }); });
        content.querySelectorAll('[data-l]').forEach(function (b) { b.addEventListener('click', function () { openLease(b.getAttribute('data-l')); }); });
      });
    }
    paint();
  }
  function openLease(id) {
    A.api('/leases/' + id).then(function (r) {
      var l = r.body.lease;
      A.showModal({
        title: 'Lease ' + esc(l.id.replace('lease-', '#')), size: 'sm',
        body: '<dl class="pm-kv" style="margin-bottom:14px"><dt>Tenant</dt><dd>' + esc(l.tenant_name) + '</dd><dt>Unit</dt><dd>' + esc((l.unit || {}).unit_no) + '</dd><dt>Annual rent</dt><dd>' + E.aed(l.annual_rent_aed) + '</dd><dt>Term</dt><dd>' + A.fmtDate(l.start_date) + ' - ' + A.fmtDate(l.end_date) + '</dd><dt>Status</dt><dd>' + U.chip('lease', l.status) + '</dd></dl>'
          + '<div class="pm-field"><label>New annual rent (renewal)</label><input class="pm-input" id="ren-rent" type="number" value="' + Math.round(l.annual_rent_aed * 1.05) + '"></div>',
        foot: '<button class="pm-btn pm-btn--danger" id="l-term">Terminate</button><button class="pm-btn pm-btn--teal" id="l-renew">Renew</button>',
        onMount: function (el, close) {
          el.querySelector('#l-renew').addEventListener('click', function () { A.api('/leases/' + id + '/renew', { method: 'POST', body: { annual_rent_aed: +el.querySelector('#ren-rent').value } }).then(function () { close(); window.toast('Lease renewed', 'success'); route(); }); });
          el.querySelector('#l-term').addEventListener('click', function () { A.api('/leases/' + id + '/terminate', { method: 'POST', body: { reason: 'manager' } }).then(function () { close(); window.toast('Lease terminated', 'warn'); route(); }); });
        }
      });
    });
  }

  // ---------------- Collection ----------------
  function collection() {
    var f = '';
    loading();
    function paint() {
      Promise.all([A.api('/invoices' + (f ? '?status=' + f : '')), A.api('/analytics/arrears'), A.api('/analytics/collections')]).then(function (rs) {
        var invs = rs[0].body.items.slice(0, 60), totals = rs[2].body.stats, ag = rs[1].body.buckets;
        content.innerHTML = head('Rent collection', E.pct(totals.rate) + ' collected · ' + E.aed(totals.outstanding) + ' outstanding')
          + '<div class="pm-stat-grid">' + U.kpi({ label: 'Billed (to date)', value: E.aedShort(totals.billed) }) + U.kpi({ label: 'Collected', value: E.aedShort(totals.collected), tone: 'ok' }) + U.kpi({ label: 'Outstanding', value: E.aedShort(totals.outstanding), tone: 'warn' }) + U.kpi({ label: 'Collection rate', value: E.pct(totals.rate), tone: totals.rate >= 85 ? 'ok' : 'warn' }) + '</div>'
          + '<div class="pm-cols-3"><div class="pm-card"><div class="pm-toolbar"><div class="pm-filters" id="c-f">' + ['', 'due', 'overdue', 'paid'].map(function (s) { return '<button class="pm-filter ' + (f === s ? 'is-active' : '') + '" data-s="' + s + '">' + (s ? E.label('invoice', s) : 'All') + '</button>'; }).join('') + '</div></div>'
          + U.table([
            { h: 'Invoice', cell: function (i) { return '<b>' + i.number + '</b><br><small class="pm-muted">' + A.fmtDate(i.due_date) + '</small>'; } },
            { h: 'Tenant', cell: function (i) { var t = window.PM_DATA.TENANTS.filter(function (x) { return x.id === i.tenant_id; })[0]; return esc(t ? t.name : '-'); } },
            { h: 'Amount', r: true, cell: function (i) { return E.aed(i.amount_aed); } },
            { h: 'Status', cell: function (i) { return U.chip('invoice', i.status) + (i.days_overdue ? ' <small class="pm-muted">' + i.days_overdue + 'd</small>' : ''); } },
            { h: '', r: true, cell: function (i) { return (i.status === 'due' || i.status === 'overdue') ? '<button class="pm-btn pm-btn--sm pm-btn--ghost" data-mark="' + i.id + '">Mark paid</button>' : ''; } }
          ], invs) + '</div>'
          + '<div class="pm-card"><div class="pm-card-head"><h3>Arrears aging</h3></div>' + U.barsH([{ label: '0-30 days', value: ag['0-30'], display: E.aedShort(ag['0-30']), color: 'var(--pm-warn)' }, { label: '31-60 days', value: ag['31-60'], display: E.aedShort(ag['31-60']), color: 'var(--pm-warn)' }, { label: '61-90 days', value: ag['61-90'], display: E.aedShort(ag['61-90']), color: 'var(--pm-urgent)' }, { label: '90+ days', value: ag['90+'], display: E.aedShort(ag['90+']), color: 'var(--pm-urgent)' }]) + '</div></div>';
        content.querySelectorAll('#c-f .pm-filter').forEach(function (b) { b.addEventListener('click', function () { f = b.getAttribute('data-s'); paint(); }); });
        content.querySelectorAll('[data-mark]').forEach(function (b) { b.addEventListener('click', function () { A.api('/invoices/' + b.getAttribute('data-mark') + '/pay', { method: 'POST', body: { method: 'bank_transfer' } }).then(function () { window.toast('Recorded as paid', 'success'); paint(); }); }); });
      });
    }
    paint();
  }

  // ---------------- Maintenance (kanban) ----------------
  var COLS = [
    { key: 'new', label: 'New', statuses: ['submitted', 'triaged'] },
    { key: 'assigned', label: 'Assigned', statuses: ['assigned'] },
    { key: 'scheduled', label: 'Scheduled', statuses: ['scheduled'] },
    { key: 'in_progress', label: 'In progress', statuses: ['in_progress'] },
    { key: 'on_hold', label: 'On hold', statuses: ['on_hold'] },
    { key: 'done', label: 'Completed', statuses: ['completed', 'verified', 'closed'] }
  ];
  function maintenance() {
    var prio = '';
    loading();
    function paint() {
      A.api('/work-orders' + (prio ? '?priority=' + prio : '')).then(function (r) {
        var wos = r.body.items;
        content.innerHTML = head('Maintenance board', wos.filter(function (w) { return ['completed', 'verified', 'closed', 'cancelled'].indexOf(w.status) === -1; }).length + ' open')
          + '<div class="pm-toolbar"><div class="pm-filters" id="m-p">' + ['', 'emergency', 'high', 'medium', 'low'].map(function (p) { return '<button class="pm-filter ' + (prio === p ? 'is-active' : '') + '" data-p="' + p + '">' + (p ? E.label('priority', p) : 'All') + '</button>'; }).join('') + '</div></div>'
          + '<div class="pm-board">' + COLS.map(function (col) {
            var items = wos.filter(function (w) { return col.statuses.indexOf(w.status) !== -1; });
            return '<div class="pm-board-col"><div class="pm-col-head">' + col.label + '<span class="pm-col-count">' + items.length + '</span></div>' + items.slice(0, 40).map(woCard).join('') + '</div>';
          }).join('') + '</div>';
        content.querySelectorAll('#m-p .pm-filter').forEach(function (b) { b.addEventListener('click', function () { prio = b.getAttribute('data-p'); paint(); }); });
        content.querySelectorAll('[data-wo]').forEach(function (c) { c.addEventListener('click', function () { openWo(c.getAttribute('data-wo'), paint); }); });
      });
    }
    paint();
  }
  function woCard(w) {
    var s = w.sla_state || 'ok', open = ['completed', 'verified', 'closed', 'cancelled'].indexOf(w.status) === -1;
    return '<div class="pm-wo-card ' + (open && s !== 'ok' ? 'is-' + s : '') + '" data-wo="' + w.id + '">'
      + '<div class="pm-wo-title">' + esc(w.title) + '</div>'
      + '<div class="pm-wo-meta">' + w.number + ' · ' + U.chip('priority', w.priority) + '</div>'
      + '<div class="pm-wo-meta" style="margin-top:5px">' + esc(w.property_name) + ' · ' + esc(w.unit_no) + (w.vendor_name ? ' · ' + esc(w.vendor_name) : '') + '</div>'
      + (open ? '<div class="pm-sla ' + s + '" style="margin-top:5px">' + E.humanMins(w.sla_mins_left) + '</div>' : '') + '</div>';
  }
  function openWo(id, done) {
    Promise.all([A.api('/work-orders/' + id), A.api('/vendors')]).then(function (rs) {
      var w = rs[0].body.work_order, acts = rs[0].body.actions.manager, vendors = rs[1].body.items;
      var cands = vendors.filter(function (v) { return v.trades.indexOf(w.category) !== -1; }); if (!cands.length) cands = vendors;
      var body = '<div style="display:flex;justify-content:space-between;margin-bottom:8px"><b>' + w.number + '</b>' + U.chip('wo', w.status) + '</div>'
        + '<dl class="pm-kv" style="margin-bottom:12px"><dt>Property</dt><dd>' + esc(w.property_name) + ' · ' + esc(w.unit_no) + '</dd><dt>Category</dt><dd>' + E.label('category', w.category) + '</dd><dt>Priority</dt><dd>' + U.chip('priority', w.priority) + '</dd>' + (w.vendor_name ? '<dt>Vendor</dt><dd>' + esc(w.vendor_name) + '</dd>' : '') + (['completed', 'verified', 'closed'].indexOf(w.status) === -1 ? '<dt>SLA</dt><dd class="pm-sla ' + w.sla_state + '">' + E.humanMins(w.sla_mins_left) + '</dd>' : '') + (w.cost_aed ? '<dt>Cost</dt><dd>' + E.aed(w.cost_aed) + '</dd>' : '') + '</dl>'
        + '<p style="font-size:13px">' + esc(w.description) + '</p>'
        + (w.status === 'submitted' || w.status === 'triaged' ? '<div class="pm-field" style="margin-top:12px"><label>Assign vendor</label><select class="pm-select" id="wo-vendor">' + cands.map(function (v) { return '<option value="' + v.id + '">' + esc(v.name) + ' (' + v.rating + '&#9733;)</option>'; }).join('') + '</select></div>' : '');
      var foot = '';
      if (w.status === 'submitted' || w.status === 'triaged') foot += '<button class="pm-btn pm-btn--teal" id="wo-assign">Assign</button>';
      acts.forEach(function (a) { if (['hold', 'resume', 'close', 'cancel'].indexOf(a.action) !== -1) foot += '<button class="pm-btn pm-btn--ghost" data-act="' + a.action + '">' + a.label + '</button>'; });
      var mo = A.showModal({
        title: esc(w.title), size: 'sm', body: body, foot: foot || '<button class="pm-btn pm-btn--ghost" data-close>Close</button>',
        onMount: function (el, close) {
          var as = el.querySelector('#wo-assign'); if (as) as.addEventListener('click', function () { A.api('/work-orders/' + id + '/assign', { method: 'POST', body: { vendor_id: el.querySelector('#wo-vendor').value } }).then(function () { close(); window.toast('Vendor assigned', 'success'); if (done) done(); }); });
          el.querySelectorAll('[data-act]').forEach(function (b) { b.addEventListener('click', function () { A.api('/work-orders/' + id + '/transition', { method: 'POST', body: { action: b.getAttribute('data-act'), role: 'manager', reason: 'manager' } }).then(function () { close(); window.toast('Updated', 'success'); if (done) done(); }); }); });
        }
      });
      void mo;
    });
  }

  // ---------------- Approvals ----------------
  function approvals() {
    loading();
    A.api('/approvals').then(function (r) {
      var items = r.body.items;
      content.innerHTML = head('Approvals', items.length + ' awaiting action')
        + '<div class="pm-card">' + (items.length ? '<div class="pm-list">' + items.map(function (it) { return '<div class="pm-listrow"><div class="l"><span>' + (it.kind === 'wo_cost' ? '&#128176;' : it.kind === 'inspection' ? '&#128269;' : '&#127946;') + '</span><div><b>' + esc(it.title) + '</b><small>' + esc(it.subtitle) + '</small></div></div><div class="pm-btn-row"><button class="pm-btn pm-btn--sm pm-btn--teal" data-ok="' + it.endpoint + '">Approve</button></div></div>'; }).join('') + '</div>' : U.empty('Nothing awaiting approval - all clear.', '&#9989;')) + '</div>';
      content.querySelectorAll('[data-ok]').forEach(function (b) { b.addEventListener('click', function () { A.api(b.getAttribute('data-ok'), { method: 'POST', body: { decision: 'approve' } }).then(function () { window.toast('Approved', 'success'); approvals(); }); }); });
    });
  }

  // ---------------- Help desk ----------------
  function helpdesk() {
    var f = '';
    loading();
    function paint() {
      A.api('/tickets' + (f ? '?status=' + f : '')).then(function (r) {
        var tks = r.body.items;
        content.innerHTML = head('Help desk', tks.length + ' tickets')
          + '<div class="pm-toolbar"><div class="pm-filters" id="h-f">' + ['', 'open', 'in_progress', 'resolved'].map(function (s) { return '<button class="pm-filter ' + (f === s ? 'is-active' : '') + '" data-s="' + s + '">' + (s ? E.label('ticket', s) : 'All') + '</button>'; }).join('') + '</div></div>'
          + '<div class="pm-card">' + U.table([
            { h: 'Ticket', cell: function (t) { return '<b>' + t.number + '</b><br><small class="pm-muted">' + esc(t.subject) + '</small>'; } },
            { h: 'From', cell: function (t) { return esc(t.opener_name); } },
            { h: 'Category', cell: function (t) { return esc(t.category); } },
            { h: 'Age', cell: function (t) { return A.timeAgo(t.opened_at); } },
            { h: 'Status', cell: function (t) { return U.chip('ticket', t.status); } },
            { h: '', r: true, cell: function (t) { return '<button class="pm-btn pm-btn--sm pm-btn--ghost" data-tk="' + t.id + '">Open</button>'; } }
          ], tks) + '</div>';
        content.querySelectorAll('#h-f .pm-filter').forEach(function (b) { b.addEventListener('click', function () { f = b.getAttribute('data-s'); paint(); }); });
        content.querySelectorAll('[data-tk]').forEach(function (b) { b.addEventListener('click', function () { openTicket(b.getAttribute('data-tk'), paint); }); });
      });
    }
    paint();
  }
  function openTicket(id, done) {
    A.api('/tickets/' + id).then(function (r) {
      var t = r.body.ticket, msgs = r.body.messages;
      var bubbles = msgs.map(function (m) { var pm = m.sender_role === 'pm'; return '<div style="display:flex;justify-content:' + (pm ? 'flex-end' : 'flex-start') + ';margin-bottom:8px"><div style="max-width:78%;padding:9px 12px;border-radius:12px;font-size:13px;background:' + (pm ? 'var(--pm-primary)' : 'var(--pm-surface-2)') + ';color:' + (pm ? '#fff' : 'var(--pm-ink)') + '">' + esc(m.body) + '</div></div>'; }).join('');
      A.showModal({
        title: esc(t.subject), size: 'sm',
        body: '<div style="margin-bottom:10px">' + U.chip('ticket', t.status) + ' <span class="pm-muted" style="font-size:12px">' + t.number + ' · from ' + esc(t.opener_name) + '</span></div><div style="max-height:36vh;overflow:auto;margin-bottom:12px">' + bubbles + '</div><div class="pm-field"><textarea class="pm-textarea" id="tk-reply" placeholder="Reply to resident..."></textarea></div>',
        foot: '<button class="pm-btn pm-btn--ghost" id="tk-resolve">Resolve</button><button class="pm-btn pm-btn--teal" id="tk-send">Reply</button>',
        onMount: function (el, close) {
          el.querySelector('#tk-send').addEventListener('click', function () { var b = el.querySelector('#tk-reply').value.trim(); if (!b) return; A.api('/tickets/' + id + '/reply', { method: 'POST', body: { sender_id: sess.id, sender_role: 'pm', body: b } }).then(function () { close(); window.toast('Reply sent', 'success'); if (done) done(); }); });
          el.querySelector('#tk-resolve').addEventListener('click', function () { A.api('/tickets/' + id + '/transition', { method: 'POST', body: { status: 'resolved' } }).then(function () { close(); window.toast('Ticket resolved', 'success'); if (done) done(); }); });
        }
      });
    });
  }

  // ---------------- Reports ----------------
  function reports() {
    loading();
    A.api('/owners').then(function (r) {
      var owners = r.body.items;
      content.innerHTML = head('Reports', 'Printable statements & summaries')
        + '<div class="pm-grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">'
        + '<div class="pm-card"><h3>Owner statement</h3><p class="pm-muted" style="font-size:13px;margin:6px 0 12px">Monthly collection, fees &amp; net payout for an owner.</p><div class="pm-field"><select class="pm-select" id="rp-owner">' + owners.map(function (o) { return '<option value="' + o.id + '">' + esc(o.name) + '</option>'; }).join('') + '</select></div><button class="pm-btn" id="rp-stmt">Generate &amp; print</button></div>'
        + '<div class="pm-card"><h3>Rent roll</h3><p class="pm-muted" style="font-size:13px;margin:6px 0 12px">All active leases with annual rent &amp; standing.</p><button class="pm-btn pm-btn--ghost" id="rp-roll">Print rent roll</button></div>'
        + '<div class="pm-card"><h3>Arrears summary</h3><p class="pm-muted" style="font-size:13px;margin:6px 0 12px">Aging buckets across the portfolio.</p><button class="pm-btn pm-btn--ghost" id="rp-arr">Print arrears</button></div></div>';
      content.querySelector('#rp-stmt').addEventListener('click', function () { printOwnerStatement(content.querySelector('#rp-owner').value); });
      content.querySelector('#rp-roll').addEventListener('click', printRentRoll);
      content.querySelector('#rp-arr').addEventListener('click', printArrears);
    });
  }
  function printOwnerStatement(ownerId) {
    Promise.all([A.api('/owners/' + ownerId), A.api('/invoices?owner_id=' + ownerId)]).then(function (rs) {
      var o = rs[0].body.owner, units = rs[0].body.units, roi = rs[0].body.roi, invs = rs[1].body.items;
      var collected = invs.reduce(function (a, i) { return a + (i.amount_paid_aed || 0); }, 0);
      var mgmtFee = Math.round(collected * (o.mgmt_fee_pct / 100));
      var expenses = roi.reduce(function (a, r) { return a + Math.round(r.annual_rent_aed * 0.03); }, 0);
      var net = collected - mgmtFee - expenses;
      A.openPrintDoc({
        title: 'Owner Statement', subtitle: o.name + ' · ' + o.iban, meta: 'Statement · ' + new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
        bodyHtml: '<table><tr><th>Owner</th><td>' + esc(o.name) + '</td></tr><tr><th>Units</th><td>' + units.length + '</td></tr><tr><th>IBAN</th><td>' + esc(o.iban) + '</td></tr></table>'
          + '<h1 style="font-size:14px;margin-top:16px">Statement</h1><table><tr><th>Line</th><th class="r">Amount (AED)</th></tr>'
          + '<tr><td>Rent collected</td><td class="r">' + collected.toLocaleString() + '</td></tr>'
          + '<tr><td>Management fee (' + o.mgmt_fee_pct + '%)</td><td class="r">-' + mgmtFee.toLocaleString() + '</td></tr>'
          + '<tr><td>Maintenance &amp; service charges</td><td class="r">-' + expenses.toLocaleString() + '</td></tr>'
          + '<tr class="tot"><td>Net payable to owner</td><td class="r">' + net.toLocaleString() + '</td></tr></table>'
      });
    });
  }
  function printRentRoll() {
    A.api('/leases?status=active').then(function (r) {
      var ls = r.body.items;
      A.openPrintDoc({ title: 'Rent Roll', subtitle: ls.length + ' active leases', meta: 'Rent roll', bodyHtml: '<table><tr><th>Property</th><th>Tenant</th><th class="r">Annual rent</th><th>Cheques</th><th>Ends</th></tr>' + ls.slice(0, 60).map(function (l) { return '<tr><td>' + esc(l.property_name) + '</td><td>' + esc(l.tenant_name) + '</td><td class="r">' + l.annual_rent_aed.toLocaleString() + '</td><td>' + l.cheque_count + '</td><td>' + A.fmtDate(l.end_date) + '</td></tr>'; }).join('') + '</table>' });
    });
  }
  function printArrears() {
    A.api('/analytics/arrears').then(function (r) {
      var ag = r.body.buckets;
      A.openPrintDoc({ title: 'Arrears Summary', subtitle: 'Aging analysis', meta: 'Arrears', bodyHtml: '<table><tr><th>Bucket</th><th class="r">Amount (AED)</th></tr>' + Object.keys(ag).map(function (k) { return '<tr><td>' + k + ' days</td><td class="r">' + Math.round(ag[k]).toLocaleString() + '</td></tr>'; }).join('') + '<tr class="tot"><td>Total outstanding</td><td class="r">' + Math.round(ag['0-30'] + ag['31-60'] + ag['61-90'] + ag['90+']).toLocaleString() + '</td></tr></table>' });
    });
  }

  boot();
})();
