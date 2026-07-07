/* tenant.js - Tenant portal ("Happy Tenant"). Mobile-first resident app.
 * Renders against PMApp/PMUI + PMEngine; all state via the mock API. */
(function () {
  'use strict';
  var E = window.PMEngine, A = window.PMApp, U = window.PMUI;
  var esc = A.escapeHtml;
  var sess = A.initSession('tenant');
  var ctx = { tenant: null, lease: null, unit: null };
  var content;

  var NAV = [
    { id: 'dashboard', icon: '&#127968;', label: 'Home' },
    { id: 'rent', icon: '&#128181;', label: 'Rent' },
    { id: 'maintenance', icon: '&#128295;', label: 'Fix' },
    { id: 'services', icon: '&#127946;', label: 'Services' },
    { id: 'messages', icon: '&#128172;', label: 'Help' }
  ];

  function go(id) { if (location.hash !== '#' + id) location.hash = id; else route(); }
  function loading() { content.innerHTML = U.skeleton(5); }

  function boot() {
    content = U.mountShell({ role: 'tenant', layout: 'mobile', nav: NAV });
    A.api('/tenants/' + sess.id).then(function (r) {
      ctx.tenant = r.body.tenant; ctx.lease = r.body.lease; ctx.unit = r.body.unit;
      window.addEventListener('hashchange', route);
      route();
    });
  }

  function route() {
    var id = (location.hash || '#dashboard').slice(1).split('?')[0];
    U.setActiveNav(NAV.some(function (n) { return n.id === id; }) ? id : 'dashboard');
    var fn = ({ dashboard: dashboard, rent: rent, maintenance: maintenance, services: services, messages: messages, profile: profile })[id] || dashboard;
    fn();
    content.scrollTop = 0;
  }

  // ---------------- Dashboard ----------------
  function dashboard() {
    loading();
    A.api('/dashboard?role=tenant&id=' + sess.id).then(function (r) {
      var d = r.body, lease = d.lease, inv = d.next_invoice;
      var u = ctx.unit || {};
      var leaseCard = lease ? '<div class="pm-card"><div class="pm-card-head"><h3>Your home</h3>' + U.chip('lease', lease.status) + '</div>'
        + '<div style="font-size:15px;font-weight:700">' + esc(u.property_name || '') + ' &middot; ' + esc(u.unit_no || '') + '</div>'
        + '<div class="pm-muted" style="font-size:12.5px;margin:2px 0 10px">' + (u.beds != null ? (u.beds === 0 ? 'Studio' : u.beds + ' bed') : '') + ' &middot; ' + (u.size_sqft || '-') + ' sqft &middot; Ejari ' + esc(lease.ejari_no) + '</div>'
        + '<dl class="pm-kv"><dt>Annual rent</dt><dd>' + E.aed(lease.annual_rent_aed) + '</dd>'
        + '<dt>Lease ends</dt><dd>' + A.fmtDate(lease.end_date) + ' (' + (lease.expiry.days_to_end >= 0 ? 'in ' + lease.expiry.days_to_end + 'd' : 'expired') + ')</dd>'
        + '<dt>Deposit held</dt><dd>' + E.aed(lease.security_deposit_aed) + '</dd></dl></div>' : U.empty('No active lease on file.');

      var rentCard = inv ? '<div class="pm-card" style="border-left:3px solid var(--pm-' + (inv.status === 'overdue' ? 'urgent' : 'warn') + ')">'
        + '<div class="pm-stat-label">Next rent due</div>'
        + '<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:4px">'
        + '<div><div class="pm-stat-value">' + E.aed(inv.amount_aed) + '</div>'
        + '<div class="pm-muted" style="font-size:12px">' + inv.number + ' &middot; due ' + A.fmtDate(inv.due_date) + ' &middot; ' + U.chip('invoice', inv.status) + '</div></div>'
        + '<button class="pm-btn pm-btn--teal" data-pay="' + inv.id + '">Pay now</button></div>'
        + (inv.late_fee_aed ? '<div class="pm-notice" style="margin-top:10px">Late fee accruing: ' + E.aed(inv.late_fee_aed) + '</div>' : '') + '</div>'
        : '<div class="pm-card"><div class="pm-stat-label">Rent</div><p class="pm-muted" style="margin:6px 0 0">You\'re all paid up. Nothing due right now.</p></div>';

      content.innerHTML = '<div class="pm-page-head"><div><h1>Hi, ' + esc((ctx.tenant.name || '').split(' ')[0]) + '</h1><div class="pm-sub">Everything for your home in one place.</div></div></div>'
        + '<div class="pm-grid">' + rentCard + leaseCard
        + '<div class="pm-card"><div class="pm-card-head"><h3>Open requests</h3><a href="#maintenance" class="pm-muted" style="font-size:12px">View all</a></div>'
        + (d.open_work_orders.length ? d.open_work_orders.slice(0, 3).map(woRow).join('') : '<p class="pm-muted" style="font-size:13px;margin:0">No open maintenance requests.</p>') + '</div>'
        + '<div class="pm-card"><h3 style="margin-bottom:10px">Quick actions</h3><div class="pm-quick">'
        + '<button data-pay="' + (inv ? inv.id : '') + '"><span class="ic">&#128179;</span>Pay rent</button>'
        + '<button data-act="report"><span class="ic">&#128295;</span>Report issue</button>'
        + '<button data-act="book"><span class="ic">&#127946;</span>Book amenity</button>'
        + '<button data-act="visitor"><span class="ic">&#128100;</span>Add visitor</button></div></div></div>'
        + '<p class="pm-demo-note">Synthetic demo &middot; no real payments are processed.</p>';

      content.querySelectorAll('[data-pay]').forEach(function (b) { b.addEventListener('click', function () { var id = b.getAttribute('data-pay'); if (id) openPay(id); else go('rent'); }); });
      content.querySelector('[data-act="report"]').addEventListener('click', openReport);
      content.querySelector('[data-act="book"]').addEventListener('click', function () { go('services'); });
      content.querySelector('[data-act="visitor"]').addEventListener('click', function () { go('services'); setTimeout(openVisitor, 60); });
      wireWoRows();
    });
  }

  function woRow(w) {
    var s = w.sla_state || 'ok';
    return '<div class="pm-listrow" data-wo="' + w.id + '" style="cursor:pointer;margin-bottom:6px"><div class="l"><span>&#128295;</span><div><b>' + esc(w.title) + '</b><small>' + w.number + ' &middot; ' + E.label('category', w.category) + '</small></div></div>'
      + '<div style="text-align:right">' + U.chip('wo', w.status) + '<div class="pm-sla ' + s + '" style="margin-top:3px">' + (w.status === 'completed' || w.status === 'closed' || w.status === 'verified' ? '' : E.humanMins(w.sla_mins_left)) + '</div></div></div>';
  }
  function wireWoRows() { content.querySelectorAll('[data-wo]').forEach(function (r) { r.addEventListener('click', function () { openWo(r.getAttribute('data-wo')); }); }); }

  // ---------------- Rent ----------------
  function rent() {
    loading();
    Promise.all([A.api('/invoices?tenant_id=' + sess.id), A.api('/payments?tenant_id=' + sess.id)]).then(function (rs) {
      var invs = rs[0].body.items, pays = rs[1].body.items, totals = rs[0].body.totals;
      var outstanding = invs.filter(function (i) { return i.status === 'due' || i.status === 'overdue' || i.status === 'partially_paid'; }).reduce(function (a, i) { return a + i.outstanding_aed + i.late_fee_aed; }, 0);
      content.innerHTML = '<div class="pm-page-head"><h1>Rent &amp; payments</h1></div>'
        + '<div class="pm-stat-grid">' + U.kpi({ label: 'Outstanding', value: E.aed(outstanding), tone: outstanding ? 'warn' : 'ok' })
        + U.kpi({ label: 'Paid to date', value: E.aed(totals.collected) }) + '</div>'
        + '<div class="pm-card"><div class="pm-card-head"><h3>Rent schedule</h3></div>'
        + U.table([
          { h: 'Invoice', cell: function (i) { return '<b>' + i.number + '</b><br><small class="pm-muted">' + i.installment_no + '/' + i.of + ' &middot; ' + A.fmtDate(i.due_date) + '</small>'; } },
          { h: 'Amount', r: true, cell: function (i) { return E.aed(i.amount_aed) + (i.late_fee_aed ? '<br><small style="color:var(--pm-urgent)">+' + E.aed(i.late_fee_aed) + ' fee</small>' : ''); } },
          { h: 'Status', cell: function (i) { return U.chip('invoice', i.status); } },
          { h: '', r: true, cell: function (i) { return (i.status === 'due' || i.status === 'overdue' || i.status === 'partially_paid') ? '<button class="pm-btn pm-btn--sm pm-btn--teal" data-pay="' + i.id + '">Pay</button>' : (i.status === 'paid' ? '<button class="pm-btn pm-btn--sm pm-btn--ghost" data-receipt="' + i.id + '">Receipt</button>' : ''); } }
        ], invs) + '</div>'
        + '<div class="pm-card"><div class="pm-card-head"><h3>Payment history</h3></div>'
        + (pays.length ? U.table([
          { h: 'Receipt', cell: function (p) { return '<b>' + esc(p.receipt_no || '-') + '</b><br><small class="pm-muted">' + A.fmtDate(p.paid_at) + '</small>'; } },
          { h: 'Method', cell: function (p) { return esc((p.method || '').replace('_', ' ')); } },
          { h: 'Amount', r: true, cell: function (p) { return E.aed(p.amount_aed); } },
          { h: '', r: true, cell: function (p) { return '<button class="pm-btn pm-btn--sm pm-btn--ghost" data-preceipt="' + p.id + '">&#128424;</button>'; } }
        ], pays) : U.empty('No payments yet.')) + '</div>';
      content.querySelectorAll('[data-pay]').forEach(function (b) { b.addEventListener('click', function () { openPay(b.getAttribute('data-pay')); }); });
      content.querySelectorAll('[data-receipt]').forEach(function (b) { b.addEventListener('click', function () { printReceiptForInvoice(b.getAttribute('data-receipt'), invs); }); });
      content.querySelectorAll('[data-preceipt]').forEach(function (b) { b.addEventListener('click', function () { var p = pays.filter(function (x) { return x.id === b.getAttribute('data-preceipt'); })[0]; printReceipt(p, invs.filter(function (i) { return i.id === p.invoice_id; })[0]); }); });
    });
  }

  function openPay(invId) {
    A.api('/invoices?tenant_id=' + sess.id).then(function (r) {
      var inv = r.body.items.filter(function (i) { return i.id === invId; })[0];
      if (!inv) return;
      var total = inv.outstanding_aed + inv.late_fee_aed;
      var body = '<div class="pm-notice" style="margin-bottom:14px">&#128274; Simulated payment - no real money is moved.</div>'
        + '<div class="pm-card" style="box-shadow:none;background:var(--pm-surface-2);margin-bottom:14px"><dl class="pm-kv"><dt>Invoice</dt><dd>' + inv.number + '</dd><dt>Rent</dt><dd>' + E.aed(inv.outstanding_aed) + '</dd>' + (inv.late_fee_aed ? '<dt>Late fee</dt><dd>' + E.aed(inv.late_fee_aed) + '</dd>' : '') + '<dt>Total</dt><dd style="color:var(--pm-primary)">' + E.aed(total) + '</dd></dl></div>'
        + '<div class="pm-field"><label>Payment method</label><div class="pm-filters" id="paym"><button class="pm-filter is-active" data-m="card">Card</button><button class="pm-filter" data-m="direct_debit">Direct debit</button><button class="pm-filter" data-m="bank_transfer">Bank transfer</button></div></div>'
        + '<div id="cardf"><div class="pm-field"><label>Card number</label><input class="pm-input" value="4242 4242 4242 4242" readonly></div><div class="pm-field-row"><div class="pm-field"><label>Expiry</label><input class="pm-input" value="04 / 28" readonly></div><div class="pm-field"><label>CVC</label><input class="pm-input" value="123" readonly></div></div></div>';
      var mo = A.showModal({
        title: 'Pay ' + E.aed(total), size: 'sm', body: body,
        foot: '<button class="pm-btn pm-btn--ghost" data-close>Cancel</button><button class="pm-btn pm-btn--teal" id="dopay">Pay ' + E.aed(total) + '</button>',
        onMount: function (el, close) {
          var method = 'card';
          el.querySelectorAll('#paym .pm-filter').forEach(function (b) { b.addEventListener('click', function () { el.querySelectorAll('#paym .pm-filter').forEach(function (x) { x.classList.remove('is-active'); }); b.classList.add('is-active'); method = b.getAttribute('data-m'); el.querySelector('#cardf').style.display = method === 'card' ? '' : 'none'; }); });
          el.querySelector('#dopay').addEventListener('click', function () {
            var btn = el.querySelector('#dopay'); btn.disabled = true; btn.textContent = 'Processing...';
            setTimeout(function () {
              A.api('/invoices/' + inv.id + '/pay', { method: 'POST', body: { method: method } }).then(function (res) {
                close(); window.toast('Paid ' + E.aed(total) + ' - receipt ready', 'success'); if (window.PMAudio) PMAudio.success(); if (window.__pmBellRefresh) window.__pmBellRefresh();
                printReceipt(res.body.payment, inv); route();
              });
            }, 850);
          });
        }
      });
      void mo;
    });
  }
  function printReceiptForInvoice(invId, invs) { A.api('/payments?tenant_id=' + sess.id).then(function (r) { var p = r.body.items.filter(function (x) { return x.invoice_id === invId; })[0]; printReceipt(p, invs.filter(function (i) { return i.id === invId; })[0]); }); }
  function printReceipt(pay, inv) {
    if (!pay) { window.toast('Receipt unavailable', 'warn'); return; }
    A.openPrintDoc({
      title: 'Rent Receipt', subtitle: (pay.receipt_no || ''), meta: 'Property Management &middot; Receipt',
      bodyHtml: '<table><tr><th>Tenant</th><td>' + esc(ctx.tenant.name) + '</td></tr>'
        + '<tr><th>Unit</th><td>' + esc((ctx.unit || {}).property_name || '') + ' &middot; ' + esc((ctx.unit || {}).unit_no || '') + '</td></tr>'
        + (inv ? '<tr><th>Invoice</th><td>' + inv.number + ' (' + inv.installment_no + '/' + inv.of + ')</td></tr>' : '')
        + '<tr><th>Method</th><td>' + esc((pay.method || '').replace('_', ' ')) + '</td></tr>'
        + '<tr><th>Paid on</th><td>' + A.fmtDate(pay.paid_at) + '</td></tr>'
        + '<tr class="tot"><th>Amount paid</th><td class="r">' + E.aed(pay.amount_aed) + '</td></tr></table>'
    });
  }

  // ---------------- Maintenance ----------------
  function maintenance() {
    loading();
    A.api('/work-orders?tenant_id=' + sess.id).then(function (r) {
      var wos = r.body.items;
      var open = wos.filter(function (w) { return ['submitted', 'triaged', 'assigned', 'scheduled', 'in_progress', 'on_hold'].indexOf(w.status) !== -1; });
      var done = wos.filter(function (w) { return ['completed', 'verified', 'closed', 'cancelled'].indexOf(w.status) !== -1; });
      content.innerHTML = '<div class="pm-page-head"><h1>Maintenance</h1><button class="pm-btn pm-btn--teal pm-btn--sm" id="new-wo">+ New request</button></div>'
        + '<div class="pm-card"><h3 style="margin-bottom:10px">Open (' + open.length + ')</h3>' + (open.length ? open.map(woCard).join('') : '<p class="pm-muted" style="font-size:13px;margin:0">Nothing open - tap New request if something needs fixing.</p>') + '</div>'
        + '<div class="pm-card"><h3 style="margin-bottom:10px">History</h3>' + (done.length ? done.map(woCard).join('') : U.empty('No past requests.')) + '</div>';
      content.querySelector('#new-wo').addEventListener('click', openReport);
      content.querySelectorAll('[data-wo]').forEach(function (c) { c.addEventListener('click', function () { openWo(c.getAttribute('data-wo')); }); });
    });
  }
  var WO_STEPS = ['submitted', 'assigned', 'scheduled', 'in_progress', 'completed', 'closed'];
  function stepper(status) {
    var idx = { submitted: 0, triaged: 0, assigned: 1, scheduled: 2, in_progress: 3, on_hold: 3, completed: 4, verified: 5, closed: 5 }[status];
    if (status === 'cancelled') return '';
    return '<div class="pm-stepper">' + WO_STEPS.map(function (s, i) { return '<div class="pm-step ' + (i < idx ? 'is-done' : i === idx ? 'is-current' : '') + '"></div>'; }).join('') + '</div>';
  }
  function woCard(w) {
    var s = w.sla_state || 'ok', open = ['submitted', 'triaged', 'assigned', 'scheduled', 'in_progress', 'on_hold'].indexOf(w.status) !== -1;
    return '<div class="pm-wo-card ' + (open && s !== 'ok' ? 'is-' + s : '') + '" data-wo="' + w.id + '" style="margin-bottom:8px">'
      + '<div style="display:flex;justify-content:space-between;gap:8px"><div class="pm-wo-title">' + esc(w.title) + '</div>' + U.chip('wo', w.status) + '</div>'
      + '<div class="pm-wo-meta">' + w.number + ' &middot; ' + U.chip('priority', w.priority) + (w.vendor_name ? ' &middot; ' + esc(w.vendor_name) : '') + (open ? ' &middot; <span class="pm-sla ' + s + '">' + E.humanMins(w.sla_mins_left) + '</span>' : '') + '</div>'
      + stepper(w.status) + '</div>';
  }
  function openReport() {
    var cats = window.PM_DATA.ENUMS.WO_CATEGORY;
    var body = '<div class="pm-field"><label>What needs fixing?</label><input class="pm-input" id="wo-title" placeholder="e.g. Kitchen sink leaking"></div>'
      + '<div class="pm-field"><label>Category</label><select class="pm-select" id="wo-cat">' + cats.map(function (c) { return '<option value="' + c + '">' + E.label('category', c) + '</option>'; }).join('') + '</select></div>'
      + '<div class="pm-field"><label>Urgency</label><div class="pm-filters" id="wo-prio"><button class="pm-filter" data-p="low">Low</button><button class="pm-filter is-active" data-p="medium">Medium</button><button class="pm-filter" data-p="high">High</button><button class="pm-filter" data-p="emergency">Emergency</button></div></div>'
      + '<div class="pm-field"><label>Details</label><textarea class="pm-textarea" id="wo-desc" placeholder="Describe the issue and a convenient time..."></textarea></div>'
      + '<div class="pm-field"><label>Photo (simulated)</label><button class="pm-btn pm-btn--ghost pm-btn--sm" id="wo-photo">&#128247; Add photo</button> <span id="wo-photo-n" class="pm-muted" style="font-size:12px"></span></div>';
    var photos = [];
    A.showModal({
      title: 'Report an issue', size: 'sm', body: body,
      foot: '<button class="pm-btn pm-btn--ghost" data-close>Cancel</button><button class="pm-btn pm-btn--teal" id="wo-submit">Submit request</button>',
      onMount: function (el, close) {
        var prio = 'medium';
        el.querySelectorAll('#wo-prio .pm-filter').forEach(function (b) { b.addEventListener('click', function () { el.querySelectorAll('#wo-prio .pm-filter').forEach(function (x) { x.classList.remove('is-active'); }); b.classList.add('is-active'); prio = b.getAttribute('data-p'); }); });
        el.querySelector('#wo-photo').addEventListener('click', function () { photos.push({ id: 'ph' + photos.length, seed: Math.floor(Math.random() * 9999), caption: 'Photo ' + (photos.length + 1) }); el.querySelector('#wo-photo-n').textContent = photos.length + ' attached'; });
        el.querySelector('#wo-submit').addEventListener('click', function () {
          var title = el.querySelector('#wo-title').value.trim(); if (!title) { window.toast('Add a short title', 'warn'); return; }
          A.api('/work-orders', { method: 'POST', body: { unit_id: ctx.unit.id, tenant_id: sess.id, title: title, category: el.querySelector('#wo-cat').value, priority: prio, description: el.querySelector('#wo-desc').value, photos: photos } }).then(function (res) {
            close(); window.toast('Request ' + res.body.work_order.number + ' submitted', 'success'); if (window.__pmBellRefresh) window.__pmBellRefresh();
            go('maintenance');
          });
        });
      }
    });
  }
  function openWo(id) {
    A.api('/work-orders/' + id).then(function (r) {
      var w = r.body.work_order;
      var acts = r.body.actions.tenant;
      var body = '<div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:6px"><b>' + w.number + '</b>' + U.chip('wo', w.status) + '</div>'
        + stepper(w.status)
        + '<dl class="pm-kv" style="margin:10px 0"><dt>Category</dt><dd>' + E.label('category', w.category) + '</dd><dt>Priority</dt><dd>' + U.chip('priority', w.priority) + '</dd>'
        + (w.vendor_name ? '<dt>Assigned to</dt><dd>' + esc(w.vendor_name) + '</dd>' : '') + '<dt>Reported</dt><dd>' + A.fmtDate(w.reported_at) + '</dd>'
        + (['completed', 'verified', 'closed'].indexOf(w.status) === -1 ? '<dt>SLA</dt><dd class="pm-sla ' + w.sla_state + '">' + E.humanMins(w.sla_mins_left) + '</dd>' : '') + '</dl>'
        + '<p style="font-size:13px">' + esc(w.description || '') + '</p>'
        + (w.notes ? '<div class="pm-notice" style="background:var(--pm-ok-soft);color:var(--pm-ok);margin-top:8px">' + esc(w.notes) + '</div>' : '')
        + (w.status === 'completed' ? '<div class="pm-field" style="margin-top:14px"><label>Rate this work</label><div class="pm-stars" id="wo-rate">' + [1, 2, 3, 4, 5].map(function (n) { return '<span class="pm-star" data-n="' + n + '">&#9733;</span>'; }).join('') + '</div></div>' : (w.tenant_rating ? '<div class="pm-muted" style="margin-top:10px;font-size:13px">You rated this ' + w.tenant_rating + '&#9733;</div>' : ''));
      var foot = '';
      acts.forEach(function (a) { if (a.action === 'verify') foot += '<button class="pm-btn pm-btn--teal" data-act="verify">Confirm fixed</button>'; if (a.action === 'reopen') foot += '<button class="pm-btn pm-btn--ghost" data-act="reopen">Reopen</button>'; if (a.action === 'cancel') foot += '<button class="pm-btn pm-btn--ghost" data-act="cancel">Cancel</button>'; });
      var mo = A.showModal({
        title: esc(w.title), size: 'sm', body: body, foot: foot || '<button class="pm-btn pm-btn--ghost" data-close>Close</button>',
        onMount: function (el, close) {
          var rating = 0;
          el.querySelectorAll('#wo-rate .pm-star').forEach(function (st) { st.addEventListener('click', function () { rating = +st.getAttribute('data-n'); el.querySelectorAll('#wo-rate .pm-star').forEach(function (x, i) { x.classList.toggle('on', i < rating); }); }); });
          el.querySelectorAll('[data-act]').forEach(function (b) {
            b.addEventListener('click', function () {
              var act = b.getAttribute('data-act');
              A.api('/work-orders/' + id + '/transition', { method: 'POST', body: { action: act, role: 'tenant' } }).then(function () {
                if (act === 'verify' && rating) A.api('/work-orders/' + id + '/rate', { method: 'POST', body: { rating: rating } });
                close(); window.toast(act === 'verify' ? 'Thanks - marked as fixed' : 'Updated', 'success'); route();
              });
            });
          });
        }
      });
      void mo;
    });
  }

  // ---------------- Services (lease/docs + amenities + visitors) ----------------
  function services() {
    loading();
    Promise.all([A.api('/leases?tenant_id=' + sess.id), A.api('/amenities?property_id=' + ctx.unit.property_id), A.api('/bookings?tenant_id=' + sess.id), A.api('/visitors?tenant_id=' + sess.id), A.api('/documents?tenant_id=' + sess.id)]).then(function (rs) {
      var lease = rs[0].body.items[0], amens = rs[1].body.items, bookings = rs[2].body.items, visitors = rs[3].body.items, docs = rs[4].body.items;
      content.innerHTML = '<div class="pm-page-head"><h1>Services</h1></div>'
        + '<div class="pm-card"><div class="pm-card-head"><h3>Amenities</h3></div><div class="pm-quick">'
        + amens.map(function (a) { return '<button data-amen="' + a.id + '"><span class="ic">' + amenIcon(a.key) + '</span>' + esc(a.name) + '</button>'; }).join('') + '</div>'
        + (bookings.filter(function (b) { return b.status !== 'cancelled'; }).length ? '<h4 style="font-size:12px;color:var(--pm-muted);margin:14px 0 6px;text-transform:uppercase;letter-spacing:.04em">Your bookings</h4>' + bookings.filter(function (b) { return b.status !== 'cancelled'; }).slice(0, 5).map(function (b) { return '<div class="pm-listrow" style="margin-bottom:6px"><div class="l"><span>' + amenIcon('') + '</span><div><b>' + esc(b.amenity_name) + '</b><small>' + A.fmtDate(b.date) + ' &middot; ' + b.slot_start + '-' + b.slot_end + '</small></div></div>' + U.chip('booking', b.status) + '</div>'; }).join('') : '') + '</div>'
        + '<div class="pm-card"><div class="pm-card-head"><h3>Visitors</h3><button class="pm-btn pm-btn--sm pm-btn--teal" id="add-visitor">+ Pass</button></div>'
        + (visitors.length ? visitors.slice(0, 6).map(function (v) { return '<div class="pm-listrow" data-vis="' + v.id + '" style="cursor:pointer;margin-bottom:6px"><div class="l"><span>&#128100;</span><div><b>' + esc(v.visitor_name) + '</b><small>' + esc(v.purpose) + ' &middot; ' + A.fmtDateTime(v.expected_at) + '</small></div></div>' + U.chip('visitor', v.status) + '</div>'; }).join('') : '<p class="pm-muted" style="font-size:13px;margin:0">No visitor passes yet.</p>') + '</div>'
        + '<div class="pm-card"><div class="pm-card-head"><h3>Lease &amp; documents</h3></div>'
        + (lease ? '<dl class="pm-kv" style="margin-bottom:10px"><dt>Contract</dt><dd>' + U.chip('lease', lease.status) + '</dd><dt>Term</dt><dd>' + A.fmtDate(lease.start_date) + ' - ' + A.fmtDate(lease.end_date) + '</dd><dt>Ejari</dt><dd class="pm-mono">' + esc(lease.ejari_no) + '</dd><dt>Cheques</dt><dd>' + lease.cheque_count + '/year</dd></dl>' : '')
        + '<div class="pm-list">' + (docs.length ? docs.map(function (dc) { return '<div class="pm-listrow"><div class="l"><span>&#128196;</span><div><b>' + esc(dc.name) + '</b><small>' + esc(dc.type.replace(/_/g, ' ')) + ' &middot; ' + dc.size_kb + ' KB</small></div></div><button class="pm-btn pm-btn--sm pm-btn--ghost" data-doc="' + dc.id + '">Open</button></div>'; }).join('') : U.empty('No documents shared yet.')) + '</div></div>';
      content.querySelectorAll('[data-amen]').forEach(function (b) { b.addEventListener('click', function () { openBook(amens.filter(function (a) { return a.id === b.getAttribute('data-amen'); })[0], bookings); }); });
      content.querySelector('#add-visitor').addEventListener('click', openVisitor);
      content.querySelectorAll('[data-vis]').forEach(function (b) { b.addEventListener('click', function () { showPass(visitors.filter(function (v) { return v.id === b.getAttribute('data-vis'); })[0]); }); });
      content.querySelectorAll('[data-doc]').forEach(function (b) { b.addEventListener('click', function () { var dc = docs.filter(function (d) { return d.id === b.getAttribute('data-doc'); })[0]; A.openPrintDoc({ title: dc.name.replace('.pdf', ''), subtitle: dc.type.replace(/_/g, ' '), meta: 'Document', bodyHtml: '<p>This is a sample ' + esc(dc.type.replace(/_/g, ' ')) + ' generated for the demo. In a live system the stored PDF would render here.</p><table><tr><th>Tenant</th><td>' + esc(ctx.tenant.name) + '</td></tr><tr><th>Unit</th><td>' + esc((ctx.unit || {}).property_name) + ' &middot; ' + esc((ctx.unit || {}).unit_no) + '</td></tr>' + (lease ? '<tr><th>Ejari</th><td>' + esc(lease.ejari_no) + '</td></tr>' : '') + '</table>' }); }); });
    });
  }
  function amenIcon(k) { return ({ pool: '&#127946;', gym: '&#127947;', hall: '&#127881;', padel: '&#127934;', bbq: '&#127830;' })[k] || '&#127968;'; }
  function openBook(amen, bookings) {
    if (!amen) return;
    var today = new Date();
    var days = []; for (var i = 0; i < 7; i++) { var d = new Date(today.getTime() + i * 86400000); days.push(d.toISOString().slice(0, 10)); }
    var oh = parseInt(amen.open), ch = parseInt(amen.close), step = amen.slot_minutes / 60;
    var body = '<div class="pm-field"><label>Date</label><div class="pm-filters" id="bk-days">' + days.map(function (d, i) { return '<button class="pm-filter ' + (i === 0 ? 'is-active' : '') + '" data-d="' + d + '">' + new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }) + '</button>'; }).join('') + '</div></div>'
      + '<div class="pm-field"><label>Time slot</label><div class="pm-slots" id="bk-slots"></div></div>'
      + '<div class="pm-field"><label>Party size</label><input class="pm-input" id="bk-size" type="number" value="2" min="1" max="' + amen.capacity + '"></div>';
    A.showModal({
      title: 'Book ' + esc(amen.name), size: 'sm', body: body,
      foot: '<button class="pm-btn pm-btn--ghost" data-close>Cancel</button><button class="pm-btn pm-btn--teal" id="bk-confirm">Confirm booking</button>',
      onMount: function (el, close) {
        var date = days[0], slot = null;
        function renderSlots() {
          var taken = {}; bookings.forEach(function (b) { if (b.amenity_id === amen.id && b.date === date) taken[b.slot_start] = (taken[b.slot_start] || 0) + 1; });
          var html = '';
          for (var h = oh; h + step <= ch; h += step) { var ss = String(Math.floor(h)).padStart(2, '0') + ':' + (h % 1 ? '30' : '00'); var full = (taken[ss] || 0) >= amen.capacity; html += '<div class="pm-slot ' + (full ? 'is-full' : '') + (slot === ss ? ' is-selected' : '') + '" data-s="' + ss + '">' + ss + '</div>'; }
          el.querySelector('#bk-slots').innerHTML = html;
          el.querySelectorAll('#bk-slots .pm-slot:not(.is-full)').forEach(function (s) { s.addEventListener('click', function () { slot = s.getAttribute('data-s'); renderSlots(); }); });
        }
        renderSlots();
        el.querySelectorAll('#bk-days .pm-filter').forEach(function (b) { b.addEventListener('click', function () { el.querySelectorAll('#bk-days .pm-filter').forEach(function (x) { x.classList.remove('is-active'); }); b.classList.add('is-active'); date = b.getAttribute('data-d'); slot = null; renderSlots(); }); });
        el.querySelector('#bk-confirm').addEventListener('click', function () {
          if (!slot) { window.toast('Pick a time slot', 'warn'); return; }
          var eh = (parseInt(slot) + step); var se = String(Math.floor(eh)).padStart(2, '0') + ':' + (eh % 1 ? '30' : '00');
          A.api('/bookings', { method: 'POST', body: { amenity_id: amen.id, unit_id: ctx.unit.id, tenant_id: sess.id, date: date, slot_start: slot, slot_end: se, party_size: +el.querySelector('#bk-size').value } }).then(function () { close(); window.toast(amen.name + ' booked', 'success'); if (window.PMAudio) PMAudio.success(); route(); });
        });
      }
    });
  }
  function openVisitor() {
    var body = '<div class="pm-field"><label>Visitor name</label><input class="pm-input" id="v-name" placeholder="Guest name"></div>'
      + '<div class="pm-field"><label>Purpose</label><select class="pm-select" id="v-purpose"><option value="guest">Guest</option><option value="delivery">Delivery</option><option value="contractor">Contractor</option><option value="cleaner">Cleaner</option><option value="ride_hail">Ride-hail</option></select></div>'
      + '<div class="pm-field"><label>Vehicle plate (optional)</label><input class="pm-input" id="v-plate" placeholder="DXB A 12345"></div>'
      + '<div class="pm-field"><label>Expected</label><input class="pm-input" id="v-when" type="datetime-local"></div>';
    A.showModal({
      title: 'Register visitor', size: 'sm', body: body,
      foot: '<button class="pm-btn pm-btn--ghost" data-close>Cancel</button><button class="pm-btn pm-btn--teal" id="v-go">Create pass</button>',
      onMount: function (el, close) {
        el.querySelector('#v-go').addEventListener('click', function () {
          var name = el.querySelector('#v-name').value.trim(); if (!name) { window.toast('Enter a name', 'warn'); return; }
          var when = el.querySelector('#v-when').value; when = when ? new Date(when).toISOString() : new Date().toISOString();
          A.api('/visitors', { method: 'POST', body: { unit_id: ctx.unit.id, tenant_id: sess.id, visitor_name: name, purpose: el.querySelector('#v-purpose').value, vehicle_plate: el.querySelector('#v-plate').value, expected_at: when } }).then(function (res) { close(); showPass(res.body.visitor); if (window.__pmBellRefresh) window.__pmBellRefresh(); });
        });
      }
    });
  }
  function showPass(v) {
    if (!v) return;
    A.showModal({
      title: 'Visitor pass', size: 'sm',
      body: '<div style="text-align:center"><div style="font-size:15px;font-weight:700">' + esc(v.visitor_name) + '</div>'
        + '<div class="pm-muted" style="font-size:12px;margin-bottom:12px">' + esc(v.purpose) + (v.vehicle_plate ? ' &middot; ' + esc(v.vehicle_plate) : '') + '</div>'
        + qr(v.pass_code) + '<div class="pm-mono" style="font-weight:700;font-size:18px;margin-top:10px">' + esc(v.pass_code) + '</div>'
        + '<div class="pm-muted" style="font-size:12px">Valid until ' + A.fmtDateTime(v.valid_until) + '</div>'
        + '<div class="pm-notice" style="justify-content:center;margin-top:12px">Demo pass - show at the gate</div></div>',
      foot: '<button class="pm-btn pm-btn--ghost" data-close>Close</button><button class="pm-btn pm-btn--teal" id="pass-print">Print pass</button>',
      onMount: function (el, close) { el.querySelector('#pass-print').addEventListener('click', function () { A.openPrintDoc({ title: 'Visitor Gate Pass', subtitle: v.pass_code, meta: 'Access', bodyHtml: '<table><tr><th>Visitor</th><td>' + esc(v.visitor_name) + '</td></tr><tr><th>Unit</th><td>' + esc((ctx.unit || {}).property_name) + ' &middot; ' + esc((ctx.unit || {}).unit_no) + '</td></tr><tr><th>Purpose</th><td>' + esc(v.purpose) + '</td></tr><tr><th>Valid until</th><td>' + A.fmtDateTime(v.valid_until) + '</td></tr><tr class="tot"><th>Pass code</th><td class="r">' + esc(v.pass_code) + '</td></tr></table>' }); void close; }); }
    });
  }
  function qr(code) {
    // deterministic pseudo-QR from the pass code (decorative, not scannable)
    var seed = 0; for (var i = 0; i < code.length; i++) seed = (seed * 31 + code.charCodeAt(i)) >>> 0;
    function nx() { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; }
    var n = 11, cells = '';
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
      var corner = (x < 3 && y < 3) || (x > n - 4 && y < 3) || (x < 3 && y > n - 4);
      var on = corner ? ((x === 0 || x === n - 1 || y === 0 || y === n - 1 || (x >= 1 && x <= 1 && y >= 1) ) ? true : (x < 3 && y < 3)) : nx() > 0.5;
      if (corner) on = !((x % 2 === 1) && (y % 2 === 1)) && (x <= 2 || x >= n - 3) ? true : on;
      if (on) cells += '<rect x="' + x + '" y="' + y + '" width="1" height="1"/>';
    }
    return '<svg viewBox="0 0 ' + n + ' ' + n + '" width="132" height="132" style="background:#fff;border:1px solid var(--pm-line);border-radius:10px;padding:8px" shape-rendering="crispEdges"><g fill="#141b2e">' + cells + '</g></svg>';
  }

  // ---------------- Messages / help desk ----------------
  function messages() {
    loading();
    A.api('/tickets?opened_by=' + sess.id).then(function (r) {
      var tks = r.body.items;
      content.innerHTML = '<div class="pm-page-head"><h1>Help desk</h1><button class="pm-btn pm-btn--sm pm-btn--teal" id="new-tk">+ New</button></div>'
        + '<div class="pm-card"><div class="pm-card-head"><h3>Your tickets</h3></div>'
        + (tks.length ? '<div class="pm-list">' + tks.map(function (t) { return '<div class="pm-listrow" data-tk="' + t.id + '" style="cursor:pointer"><div class="l"><span>&#128172;</span><div><b>' + esc(t.subject) + '</b><small>' + t.number + ' &middot; ' + esc(t.category) + ' &middot; ' + A.timeAgo(t.opened_at) + '</small></div></div>' + U.chip('ticket', t.status) + '</div>'; }).join('') + '</div>' : U.empty('No tickets yet. Message the team if you need anything.')) + '</div>';
      content.querySelector('#new-tk').addEventListener('click', openTicket);
      content.querySelectorAll('[data-tk]').forEach(function (b) { b.addEventListener('click', function () { openThread(b.getAttribute('data-tk')); }); });
    });
  }
  function openTicket() {
    var body = '<div class="pm-field"><label>Subject</label><input class="pm-input" id="tk-sub" placeholder="How can we help?"></div>'
      + '<div class="pm-field"><label>Category</label><select class="pm-select" id="tk-cat"><option value="billing">Billing</option><option value="lease">Lease</option><option value="complaint">Complaint</option><option value="amenity">Amenity</option><option value="access">Access</option><option value="general">General</option></select></div>'
      + '<div class="pm-field"><label>Message</label><textarea class="pm-textarea" id="tk-msg"></textarea></div>';
    A.showModal({
      title: 'New ticket', size: 'sm', body: body, foot: '<button class="pm-btn pm-btn--ghost" data-close>Cancel</button><button class="pm-btn pm-btn--teal" id="tk-go">Open ticket</button>',
      onMount: function (el, close) {
        el.querySelector('#tk-go').addEventListener('click', function () {
          var sub = el.querySelector('#tk-sub').value.trim(); if (!sub) { window.toast('Add a subject', 'warn'); return; }
          A.api('/tickets', { method: 'POST', body: { subject: sub, category: el.querySelector('#tk-cat').value, opened_by: sess.id, opened_role: 'tenant', unit_id: ctx.unit.id, message: el.querySelector('#tk-msg').value } }).then(function (res) { close(); window.toast('Ticket ' + res.body.ticket.number + ' opened', 'success'); route(); });
        });
      }
    });
  }
  function openThread(id) {
    A.api('/tickets/' + id).then(function (r) {
      var t = r.body.ticket, msgs = r.body.messages;
      var bubbles = msgs.map(function (m) { var mine = m.sender_role === 'tenant'; return '<div style="display:flex;justify-content:' + (mine ? 'flex-end' : 'flex-start') + ';margin-bottom:8px"><div style="max-width:78%;padding:9px 12px;border-radius:12px;font-size:13px;background:' + (mine ? 'var(--pm-primary)' : 'var(--pm-surface-2)') + ';color:' + (mine ? '#fff' : 'var(--pm-ink)') + '">' + esc(m.body) + '<div style="font-size:10px;opacity:.7;margin-top:3px">' + A.timeAgo(m.sent_at) + '</div></div></div>'; }).join('');
      A.showModal({
        title: t.subject, size: 'sm',
        body: '<div style="margin-bottom:10px">' + U.chip('ticket', t.status) + ' <span class="pm-muted" style="font-size:12px">' + t.number + '</span></div><div style="max-height:40vh;overflow:auto;margin-bottom:12px">' + bubbles + '</div><div class="pm-field"><textarea class="pm-textarea" id="th-reply" placeholder="Type a reply..."></textarea></div>',
        foot: '<button class="pm-btn pm-btn--ghost" data-close>Close</button><button class="pm-btn pm-btn--teal" id="th-send">Send</button>',
        onMount: function (el, close) {
          el.querySelector('#th-send').addEventListener('click', function () {
            var body = el.querySelector('#th-reply').value.trim(); if (!body) return;
            A.api('/tickets/' + id + '/reply', { method: 'POST', body: { sender_id: sess.id, sender_role: 'tenant', body: body } }).then(function () { close(); window.toast('Sent', 'success'); });
          });
        }
      });
    });
  }

  // ---------------- Profile ----------------
  function profile() {
    var t = ctx.tenant, u = ctx.unit || {};
    content.innerHTML = '<div class="pm-page-head"><h1>Profile</h1></div>'
      + '<div class="pm-card"><div style="display:flex;gap:12px;align-items:center;margin-bottom:12px">' + U.avatar(t.name, t.avatar_hue, 48) + '<div><div style="font-weight:700">' + esc(t.name) + '</div><div class="pm-muted" style="font-size:12px">' + esc(u.property_name || '') + ' &middot; ' + esc(u.unit_no || '') + '</div></div></div>'
      + '<dl class="pm-kv"><dt>Email</dt><dd>' + esc(t.email) + '</dd><dt>Phone</dt><dd>' + esc(t.phone) + '</dd><dt>Emirates ID</dt><dd class="pm-mono">' + esc(t.emirates_id) + '</dd><dt>Nationality</dt><dd>' + esc(t.nationality) + '</dd><dt>KYC</dt><dd>' + (t.kyc_verified ? U.chip('lease', 'active') : U.chip('invoice', 'due')) + '</dd></dl></div>'
      + '<div class="pm-card"><h3 style="margin-bottom:8px">Demo</h3><p class="pm-muted" style="font-size:13px;margin:0 0 12px">Reset clears any changes you made (payments, requests, bookings) back to the seeded state.</p><button class="pm-btn pm-btn--ghost" id="reset2">Reset demo data</button></div>';
    content.querySelector('#reset2').addEventListener('click', function () { A.api('/reset-demo', { method: 'POST' }).then(function () { location.reload(); }); });
  }

  // add profile to bottom nav via topbar persona? expose via hash
  boot();
})();
