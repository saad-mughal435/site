/* landlord.js - Landlord / Owner portal ("Happy Landlord"). Investor view of
 * returns and oversight. Read-mostly: the only writes are cost approvals.
 * Thin renderer over the shared engine + mock API. */
(function () {
  'use strict';
  var E = window.PMEngine, A = window.PMApp, U = window.PMUI, esc = A.escapeHtml;
  var sess = A.initSession('landlord');
  var content;

  var NAV = [
    { id: 'overview', icon: '&#128202;', label: 'Portfolio' },
    { id: 'properties', icon: '&#127970;', label: 'Performance' },
    { id: 'financials', icon: '&#128179;', label: 'Financials' },
    { id: 'collection', icon: '&#128181;', label: 'Rent status' },
    { id: 'approvals', icon: '&#9989;', label: 'Approvals' },
    { id: 'analytics', icon: '&#128200;', label: 'Analytics' }
  ];

  function head(title, sub) { return '<div class="pm-page-head"><div><h1>' + esc(title) + '</h1>' + (sub ? '<div class="pm-sub">' + esc(sub) + '</div>' : '') + '</div></div>'; }
  function loading() { content.innerHTML = U.skeleton(6); }
  function boot() { content = U.mountShell({ role: 'landlord', layout: 'sidebar', nav: NAV }); window.addEventListener('hashchange', route); route(); }
  function route() {
    var id = (location.hash || '#overview').slice(1).split('?')[0];
    if (!NAV.some(function (n) { return n.id === id; })) id = 'overview';
    U.setActiveNav(id);
    ({ overview: overview, properties: properties, financials: financials, collection: collection, approvals: approvals, analytics: analytics })[id]();
    content.scrollTop = 0;
  }

  function overview() {
    loading();
    Promise.all([A.api('/dashboard?role=landlord&id=' + sess.id), A.api('/analytics/collections')]).then(function (rs) {
      var d = rs[0].body, roi = d.roi, series = rs[1].body.series;
      content.innerHTML = head('Portfolio', d.owner.name + ' · ' + d.units + ' unit' + (d.units === 1 ? '' : 's'))
        + '<div class="pm-stat-grid">'
        + U.kpi({ label: 'Portfolio value', value: E.aedShort(d.portfolio_value) })
        + U.kpi({ label: 'Monthly income', value: E.aedShort(d.monthly_income), tone: 'ok' })
        + U.kpi({ label: 'Occupancy', value: E.pct(d.occupancy.pct), tone: 'ok' })
        + U.kpi({ label: 'Net yield', value: E.pct(d.net_yield), tone: 'info' })
        + U.kpi({ label: 'Collection rate', value: E.pct(d.collection.rate), tone: d.collection.rate >= 85 ? 'ok' : 'warn' })
        + U.kpi({ label: 'Collected (to date)', value: E.aedShort(d.collection.collected) }) + '</div>'
        + '<div class="pm-cols"><div class="pm-card"><div class="pm-card-head"><h3>Property returns</h3></div>'
        + U.table([
          { h: 'Property', cell: function (r) { return '<b>' + esc(r.name) + '</b>'; } },
          { h: 'Value', r: true, cell: function (r) { return E.aedShort(r.valuation_aed); } },
          { h: 'Rent/yr', r: true, cell: function (r) { return E.aedShort(r.annual_rent_aed); } },
          { h: 'Net yield', r: true, cell: function (r) { return '<span class="pm-chip pm-chip--' + (r.net_yield_pct >= r.benchmark_pct ? 'ok' : 'warn') + '">' + E.pct(r.net_yield_pct) + '</span>'; } }
        ], roi) + '</div>'
        + '<div class="pm-card"><div class="pm-card-head"><h3>Collection trend (12 mo)</h3></div>' + U.lineChart(series, 'collection_pct') + '<p class="pm-muted" style="font-size:11px;text-align:center;margin-top:6px">% of billed rent collected</p></div></div>'
        + '<p class="pm-demo-note">All figures synthetic - demonstration portfolio.</p>';
    });
  }

  function properties() {
    loading();
    A.api('/analytics/roi?owner_id=' + sess.id).then(function (r) {
      var roi = r.body.items;
      content.innerHTML = head('Property performance', 'Per-asset returns vs community benchmark')
        + '<div class="pm-grid" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">'
        + roi.map(function (p) {
          var noi = p.noi_aed, exp = p.annual_rent_aed - noi;
          return '<div class="pm-card"><div class="pm-card-head"><h3 style="font-size:15px">' + esc(p.name) + '</h3><span class="pm-chip pm-chip--' + (p.net_yield_pct >= p.benchmark_pct ? 'ok' : 'warn') + '">' + E.pct(p.net_yield_pct) + ' net</span></div>'
            + '<dl class="pm-kv"><dt>Valuation</dt><dd>' + E.aed(p.valuation_aed) + '</dd><dt>Annual rent</dt><dd>' + E.aed(p.annual_rent_aed) + '</dd><dt>Expenses</dt><dd>' + E.aed(exp) + '</dd><dt>NOI</dt><dd>' + E.aed(noi) + '</dd><dt>Gross yield</dt><dd>' + E.pct(p.gross_yield_pct) + '</dd><dt>Benchmark</dt><dd>' + E.pct(p.benchmark_pct) + '</dd></dl></div>';
        }).join('') + '</div>';
    });
  }

  function financials() {
    loading();
    Promise.all([A.api('/owners/' + sess.id), A.api('/invoices?owner_id=' + sess.id), A.api('/analytics/roi?owner_id=' + sess.id)]).then(function (rs) {
      var o = rs[0].body.owner, units = rs[0].body.units, invs = rs[1].body.items, roi = rs[2].body.items;
      var collected = invs.reduce(function (a, i) { return a + (i.amount_paid_aed || 0); }, 0);
      var mgmtFee = Math.round(collected * (o.mgmt_fee_pct / 100));
      var serviceCharge = roi.reduce(function (a, r) { return a + Math.round(r.annual_rent_aed * 0.03); }, 0);
      var maintenance = Math.round(collected * 0.02);
      var net = collected - mgmtFee - serviceCharge - maintenance;
      content.innerHTML = head('Financials', 'Income statement & owner statement')
        + '<div class="pm-cols"><div class="pm-card"><div class="pm-card-head"><h3>Income statement (YTD)</h3></div>'
        + '<table class="pm-table"><tbody>'
        + row('Rent collected', collected, '') + row('Management fee (' + o.mgmt_fee_pct + '%)', -mgmtFee, 'urgent') + row('Service charges', -serviceCharge, 'urgent') + row('Maintenance', -maintenance, 'urgent')
        + '<tr style="font-weight:700;border-top:2px solid var(--pm-line-2)"><td>Net operating income</td><td class="r">' + E.aed(net) + '</td></tr></tbody></table>'
        + '<button class="pm-btn" id="fin-stmt" style="margin-top:14px">&#128424; Print owner statement</button></div>'
        + '<div class="pm-card"><div class="pm-card-head"><h3>Rent roll (' + units.length + ' units)</h3></div>'
        + U.table([
          { h: 'Unit', cell: function (u) { return '<b>' + esc(u.unit_no) + '</b><br><small class="pm-muted">' + esc(u.property_name) + '</small>'; } },
          { h: 'Rent/yr', r: true, cell: function (u) { return E.aed(u.market_rent_aed); } },
          { h: 'Status', cell: function (u) { return U.chip('unit', u.status); } }
        ], units) + '</div></div>';
      content.querySelector('#fin-stmt').addEventListener('click', function () {
        A.openPrintDoc({
          title: 'Owner Statement', subtitle: o.name + ' · ' + o.iban, meta: 'Statement',
          bodyHtml: '<table><tr><th>Owner</th><td>' + esc(o.name) + '</td></tr><tr><th>Units</th><td>' + units.length + '</td></tr><tr><th>IBAN</th><td>' + esc(o.iban) + '</td></tr></table>'
            + '<h1 style="font-size:14px;margin-top:16px">Statement</h1><table><tr><th>Line</th><th class="r">AED</th></tr>'
            + '<tr><td>Rent collected</td><td class="r">' + collected.toLocaleString() + '</td></tr><tr><td>Management fee</td><td class="r">-' + mgmtFee.toLocaleString() + '</td></tr><tr><td>Service charges</td><td class="r">-' + serviceCharge.toLocaleString() + '</td></tr><tr><td>Maintenance</td><td class="r">-' + maintenance.toLocaleString() + '</td></tr>'
            + '<tr class="tot"><td>Net payable to owner</td><td class="r">' + net.toLocaleString() + '</td></tr></table>'
        });
      });
    });
  }
  function row(label, amt, tone) { return '<tr><td>' + esc(label) + '</td><td class="r"' + (tone ? ' style="color:var(--pm-' + tone + ')"' : '') + '>' + (amt < 0 ? '-' + E.aed(-amt) : E.aed(amt)) + '</td></tr>'; }

  function collection() {
    loading();
    A.api('/invoices?owner_id=' + sess.id).then(function (r) {
      var invs = r.body.items, totals = r.body.totals;
      var overdue = invs.filter(function (i) { return i.status === 'overdue'; });
      content.innerHTML = head('Rent status', 'View-only - your property manager handles collections')
        + '<div class="pm-notice" style="margin-bottom:16px">&#128065; View-only. Collections are managed by your property manager.</div>'
        + '<div class="pm-stat-grid">' + U.kpi({ label: 'Collected', value: E.aedShort(totals.collected), tone: 'ok' }) + U.kpi({ label: 'Outstanding', value: E.aedShort(totals.outstanding), tone: 'warn' }) + U.kpi({ label: 'Overdue invoices', value: overdue.length, tone: overdue.length ? 'urgent' : 'ok' }) + '</div>'
        + '<div class="pm-card"><div class="pm-card-head"><h3>Invoices</h3></div>' + U.table([
          { h: 'Invoice', cell: function (i) { return '<b>' + i.number + '</b><br><small class="pm-muted">' + A.fmtDate(i.due_date) + '</small>'; } },
          { h: 'Tenant', cell: function (i) { var t = window.PM_DATA.TENANTS.filter(function (x) { return x.id === i.tenant_id; })[0]; return esc(t ? t.name : '-'); } },
          { h: 'Amount', r: true, cell: function (i) { return E.aed(i.amount_aed); } },
          { h: 'Status', cell: function (i) { return U.chip('invoice', i.status); } }
        ], invs.slice(0, 40)) + '</div>';
    });
  }

  function approvals() {
    loading();
    A.api('/approvals?owner_id=' + sess.id).then(function (r) {
      var items = r.body.items.filter(function (it) { return it.kind === 'wo_cost'; });
      content.innerHTML = head('Cost approvals', 'Work above ' + E.aed(window.PM_DATA.SETTINGS.landlord_approval_threshold_aed) + ' needs your sign-off')
        + '<div class="pm-card">' + (items.length ? '<div class="pm-list">' + items.map(function (it) { return '<div class="pm-listrow"><div class="l"><span>&#128176;</span><div><b>' + esc(it.title) + '</b><small>' + esc(it.subtitle) + '</small></div></div><div class="pm-btn-row"><button class="pm-btn pm-btn--sm pm-btn--ghost" data-x="' + it.endpoint + '" data-d="reject">Reject</button><button class="pm-btn pm-btn--sm pm-btn--teal" data-x="' + it.endpoint + '" data-d="approve">Approve</button></div></div>'; }).join('') + '</div>' : U.empty('Nothing needs your approval - all clear.', '&#9989;')) + '</div>';
      content.querySelectorAll('[data-x]').forEach(function (b) { b.addEventListener('click', function () { A.api(b.getAttribute('data-x'), { method: 'POST', body: { decision: b.getAttribute('data-d') } }).then(function () { window.toast(b.getAttribute('data-d') === 'approve' ? 'Approved' : 'Rejected', b.getAttribute('data-d') === 'approve' ? 'success' : 'warn'); approvals(); }); }); });
    });
  }

  function analytics() {
    loading();
    Promise.all([A.api('/analytics/collections'), A.api('/analytics/roi?owner_id=' + sess.id), A.api('/analytics/occupancy')]).then(function (rs) {
      var series = rs[0].body.series, roi = rs[1].body.items;
      var maxYield = Math.max.apply(null, roi.map(function (r) { return r.net_yield_pct; })) || 1;
      content.innerHTML = head('Analytics', 'Portfolio trends (synthetic)')
        + '<div class="pm-cols"><div class="pm-card"><div class="pm-card-head"><h3>Collection rate</h3></div>' + U.lineChart(series, 'collection_pct') + '</div>'
        + '<div class="pm-card"><div class="pm-card-head"><h3>Occupancy trend</h3></div>' + U.lineChart(series, 'occupancy_pct') + '</div></div>'
        + '<div class="pm-cols"><div class="pm-card"><div class="pm-card-head"><h3>Income vs expense (monthly)</h3></div>' + U.barsH(series.slice(-6).map(function (s) { return { label: s.month, value: s.income, display: E.aedShort(s.income), color: 'var(--pm-teal)' }; })) + '</div>'
        + '<div class="pm-card"><div class="pm-card-head"><h3>Net yield by property</h3></div>' + U.barsH(roi.map(function (r) { return { label: r.name, value: r.net_yield_pct, display: E.pct(r.net_yield_pct), color: r.net_yield_pct >= r.benchmark_pct ? 'var(--pm-ok)' : 'var(--pm-warn)' }; })) + '</div></div>';
      void maxYield;
    });
  }

  boot();
})();
