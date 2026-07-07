/* inspector.js - Inspector app. Mobile-first room-by-room inspections
 * (move-in / move-out / periodic / snagging) that submit a report feeding
 * deposit reconciliation. Thin renderer over the shared engine + mock API. */
(function () {
  'use strict';
  var E = window.PMEngine, A = window.PMApp, U = window.PMUI, esc = A.escapeHtml;
  var sess = A.initSession('inspector');
  var content;
  var COND = { 5: 'Excellent', 4: 'Good', 3: 'Fair', 2: 'Poor', 1: 'Damaged' };
  var NAV = [
    { id: 'today', icon: '&#128203;', label: 'Inspections' },
    { id: 'history', icon: '&#9989;', label: 'Done' },
    { id: 'profile', icon: '&#128100;', label: 'Profile' }
  ];

  function loading() { content.innerHTML = U.skeleton(5); }
  function boot() { content = U.mountShell({ role: 'inspector', layout: 'mobile', nav: NAV }); window.addEventListener('hashchange', route); route(); }
  function route() {
    var id = (location.hash || '#today').slice(1).split('?')[0];
    if (!NAV.some(function (n) { return n.id === id; })) id = 'today';
    U.setActiveNav(id);
    ({ today: today, history: history, profile: profile })[id]();
    content.scrollTop = 0;
  }

  function today() {
    loading();
    A.api('/dashboard?role=inspector&id=' + sess.id).then(function (r) {
      var d = r.body, list = d.inspections.filter(function (x) { return x.status === 'assigned' || x.status === 'in_progress'; });
      content.innerHTML = '<div class="pm-page-head"><div><h1>' + esc(d.inspector.name.split(' ')[0]) + '</h1><div class="pm-sub">' + list.length + ' inspection' + (list.length === 1 ? '' : 's') + ' to run</div></div></div>'
        + '<div class="pm-card">' + (list.length ? list.map(inspCard).join('') : U.empty('Nothing scheduled. Enjoy the break.', '&#128203;')) + '</div>';
      wire();
    });
  }
  function history() {
    loading();
    A.api('/inspections?inspector_id=' + sess.id).then(function (r) {
      var done = r.body.items.filter(function (x) { return x.status === 'submitted' || x.status === 'approved'; });
      content.innerHTML = '<div class="pm-page-head"><h1>Completed</h1></div><div class="pm-card">' + (done.length ? done.map(inspCard).join('') : U.empty('No completed inspections yet.')) + '</div>';
      wire();
    });
  }
  function profile() {
    var ins = window.PM_DATA.INSPECTORS.filter(function (x) { return x.id === sess.id; })[0] || {};
    content.innerHTML = '<div class="pm-page-head"><h1>Profile</h1></div><div class="pm-card"><div style="display:flex;gap:12px;align-items:center;margin-bottom:12px">' + U.avatar(ins.name, ins.avatar_hue, 46) + '<div><div style="font-weight:700">' + esc(ins.name) + '</div><div class="pm-muted" style="font-size:12px">Certified inspector</div></div></div><dl class="pm-kv"><dt>Email</dt><dd>' + esc(ins.email) + '</dd><dt>Phone</dt><dd>' + esc(ins.phone) + '</dd><dt>Certifications</dt><dd>' + (ins.certifications || []).join(', ') + '</dd></dl></div>';
  }
  function inspCard(x) {
    return '<div class="pm-wo-card" data-insp="' + x.id + '" style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;gap:8px"><div class="pm-wo-title">' + E.label('inspection_type', x.type) + ' inspection</div>' + U.chip('inspection', x.status) + '</div>'
      + '<div class="pm-wo-meta">' + x.ref + ' · ' + esc(x.property_name) + ' · ' + esc(x.unit_no) + '</div>'
      + '<div class="pm-wo-meta" style="margin-top:4px">Scheduled ' + A.fmtDateTime(x.scheduled_at) + (x.overall_rating ? ' · ' + x.overall_rating + '&#9733;' : '') + '</div></div>';
  }
  function wire() { content.querySelectorAll('[data-insp]').forEach(function (c) { c.addEventListener('click', function () { openInspection(c.getAttribute('data-insp')); }); }); }

  function openInspection(id) {
    A.api('/inspections/' + id).then(function (r) {
      var ins = r.body.inspection;
      if (ins.status === 'assigned') return startModal(ins);
      if (ins.status === 'in_progress') return checklistModal(ins);
      return summaryModal(ins, r.body.deductions);
    });
  }
  function startModal(ins) {
    A.showModal({
      title: E.label('inspection_type', ins.type) + ' inspection', size: 'sm',
      body: '<dl class="pm-kv" style="margin-bottom:12px"><dt>Ref</dt><dd>' + ins.ref + '</dd><dt>Property</dt><dd>' + esc(ins.property_name) + ' · ' + esc(ins.unit_no) + '</dd><dt>Type</dt><dd>' + E.label('inspection_type', ins.type) + '</dd><dt>Scheduled</dt><dd>' + A.fmtDateTime(ins.scheduled_at) + '</dd></dl><p class="pm-muted" style="font-size:13px">You\'ll walk ' + ins.rooms.length + ' rooms and rate each item\'s condition.</p>',
      foot: '<button class="pm-btn pm-btn--ghost" data-close>Later</button><button class="pm-btn" style="background:var(--pm-violet)" id="i-start">Start inspection</button>',
      onMount: function (el, close) { el.querySelector('#i-start').addEventListener('click', function () { A.api('/inspections/' + ins.id + '/start', { method: 'POST', body: {} }).then(function () { close(); A.api('/inspections/' + ins.id).then(function (r) { checklistModal(r.body.inspection); }); }); }); }
    });
  }
  function checklistModal(ins) {
    var rooms = JSON.parse(JSON.stringify(ins.rooms));
    function roomHtml(room, ri) {
      return '<div class="pm-card" style="box-shadow:none;background:var(--pm-surface-2);margin-bottom:10px"><h4 style="font-size:13px;margin-bottom:8px">' + esc(room.name) + '</h4>'
        + room.items.map(function (it, ti) {
          return '<div style="padding:8px 0;border-top:1px solid var(--pm-line)" data-item="' + ri + '-' + ti + '"><div style="font-size:12.5px;font-weight:600;margin-bottom:5px">' + esc(it.label) + '</div>'
            + '<div class="pm-filters" data-rate>' + [5, 4, 3, 2, 1].map(function (n) { return '<button class="pm-filter ' + (it.rating === n ? 'is-active' : '') + '" data-r="' + n + '">' + COND[n] + '</button>'; }).join('') + '</div>'
            + '<div style="display:flex;gap:6px;margin-top:6px;align-items:center"><label style="font-size:11px;display:flex;align-items:center;gap:4px"><input type="checkbox" data-issue ' + (it.action_required ? 'checked' : '') + '> Needs action</label>'
            + '<input class="pm-input" data-cost placeholder="Cost AED" type="number" value="' + (it.cost_estimate || '') + '" style="width:110px;padding:5px 8px;font-size:12px;display:' + (it.action_required ? 'block' : 'none') + '"></div></div>';
        }).join('') + '</div>';
    }
    var body = '<div class="pm-notice" style="margin-bottom:12px">Rate each item. Flag anything needing action - move-out items feed the deposit return.</div><div id="ins-rooms">' + rooms.map(roomHtml).join('') + '</div>'
      + '<div class="pm-field"><label>Summary notes</label><textarea class="pm-textarea" id="ins-notes">' + esc(ins.summary_notes || '') + '</textarea></div>';
    var mo = A.showModal({
      title: ins.ref + ' · ' + esc(ins.unit_no), size: 'lg', body: body,
      foot: '<button class="pm-btn pm-btn--ghost" id="ins-save">Save draft</button><button class="pm-btn" style="background:var(--pm-violet)" id="ins-submit">Sign &amp; submit</button>',
      onMount: function (el, close) {
        el.querySelectorAll('[data-item]').forEach(function (itEl) {
          itEl.querySelectorAll('[data-rate] .pm-filter').forEach(function (b) { b.addEventListener('click', function () { itEl.querySelectorAll('[data-rate] .pm-filter').forEach(function (x) { x.classList.remove('is-active'); }); b.classList.add('is-active'); }); });
          var chk = itEl.querySelector('[data-issue]'), cost = itEl.querySelector('[data-cost]');
          chk.addEventListener('change', function () { cost.style.display = chk.checked ? 'block' : 'none'; });
        });
        function collect() {
          el.querySelectorAll('[data-item]').forEach(function (itEl) {
            var key = itEl.getAttribute('data-item').split('-'), ri = +key[0], ti = +key[1];
            var active = itEl.querySelector('[data-rate] .pm-filter.is-active');
            rooms[ri].items[ti].rating = active ? +active.getAttribute('data-r') : rooms[ri].items[ti].rating;
            rooms[ri].items[ti].action_required = itEl.querySelector('[data-issue]').checked;
            rooms[ri].items[ti].cost_estimate = +itEl.querySelector('[data-cost]').value || 0;
          });
        }
        el.querySelector('#ins-save').addEventListener('click', function () { collect(); A.api('/inspections/' + ins.id + '/save', { method: 'POST', body: { rooms: rooms, summary_notes: el.querySelector('#ins-notes').value } }).then(function () { window.toast('Draft saved', 'success'); }); });
        el.querySelector('#ins-submit').addEventListener('click', function () {
          collect();
          if (!E.inspectionComplete(rooms)) { window.toast('Rate every item before submitting', 'warn'); return; }
          A.api('/inspections/' + ins.id + '/submit', { method: 'POST', body: { rooms: rooms, summary_notes: el.querySelector('#ins-notes').value, signatures: { inspector: { name: sess.name, signed_at: new Date().toISOString() } } } }).then(function () {
            close(); window.toast('Inspection submitted', 'success'); if (window.PMAudio) PMAudio.success(); if (window.__pmBellRefresh) window.__pmBellRefresh();
            A.api('/inspections/' + ins.id).then(function (r) { summaryModal(r.body.inspection, r.body.deductions); });
          });
        });
      }
    });
    void mo;
  }
  function summaryModal(ins, deductions) {
    var totalDeduct = (deductions || []).reduce(function (a, d) { return a + d.amount_aed; }, 0);
    var body = '<div style="display:flex;justify-content:space-between;margin-bottom:10px"><b>' + ins.ref + '</b>' + U.chip('inspection', ins.status) + '</div>'
      + '<dl class="pm-kv" style="margin-bottom:12px"><dt>Type</dt><dd>' + E.label('inspection_type', ins.type) + '</dd><dt>Unit</dt><dd>' + esc(ins.property_name) + ' · ' + esc(ins.unit_no) + '</dd><dt>Overall</dt><dd>' + (ins.overall_rating || '-') + '&#9733;</dd>' + (ins.report_ref ? '<dt>Report</dt><dd class="pm-mono">' + ins.report_ref + '</dd>' : '') + '</dl>'
      + (deductions && deductions.length ? '<h4 style="font-size:13px;margin:0 0 6px">Deposit deductions</h4>' + U.table([{ h: 'Item', cell: function (d) { return esc(d.room) + ' · ' + esc(d.item); } }, { h: 'Amount', r: true, cell: function (d) { return E.aed(d.amount_aed); } }], deductions) + '<div class="pm-listrow" style="margin-top:8px"><div class="l"><b>Total deductions</b></div><b>' + E.aed(totalDeduct) + '</b></div>' : '<p class="pm-muted" style="font-size:13px">No deposit deductions - unit in good condition.</p>');
    A.showModal({
      title: E.label('inspection_type', ins.type) + ' report', size: 'sm', body: body,
      foot: '<button class="pm-btn pm-btn--ghost" data-close>Close</button><button class="pm-btn" style="background:var(--pm-violet)" id="ins-print">Print report</button>',
      onMount: function (el, close) {
        el.querySelector('#ins-print').addEventListener('click', function () {
          var rows = '';
          ins.rooms.forEach(function (room) { room.items.forEach(function (it) { rows += '<tr><td>' + esc(room.name) + '</td><td>' + esc(it.label) + '</td><td>' + (it.rating ? COND[it.rating] : '-') + '</td><td>' + (it.action_required ? 'Action · ' + E.aed(it.cost_estimate) : 'OK') + '</td></tr>'; }); });
          A.openPrintDoc({
            title: E.label('inspection_type', ins.type) + ' Inspection Report', subtitle: ins.ref + ' · ' + ins.property_name + ' · ' + ins.unit_no, meta: 'Inspection · ' + (ins.report_ref || ''),
            bodyHtml: '<table><tr><th>Overall condition</th><td>' + (ins.overall_rating || '-') + ' / 5</td></tr><tr><th>Inspector</th><td>' + esc(sess.name) + '</td></tr></table>'
              + '<h1 style="font-size:14px;margin-top:14px">Condition checklist</h1><table><tr><th>Room</th><th>Item</th><th>Condition</th><th>Action</th></tr>' + rows + '</table>'
              + (deductions && deductions.length ? '<h1 style="font-size:14px;margin-top:14px">Deposit deductions</h1><table><tr><th>Item</th><th class="r">AED</th></tr>' + deductions.map(function (d) { return '<tr><td>' + esc(d.room) + ' · ' + esc(d.item) + '</td><td class="r">' + d.amount_aed.toLocaleString() + '</td></tr>'; }).join('') + '<tr class="tot"><td>Total deductions</td><td class="r">' + totalDeduct.toLocaleString() + '</td></tr></table>' : '')
          });
          void close;
        });
      }
    });
  }

  boot();
})();
