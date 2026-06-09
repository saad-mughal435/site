/* sections.js - Nabta SPA shell + 9 section renderers. Hash-routed. */
(function () {
  'use strict';
  var D = window.NABTA_DATA;
  var App = window.NabtaApp;
  var esc = App.escapeHtml;
  var $ = function (id) { return document.getElementById(id); };

  var NAV = [
    { group: 'Operate',  items: [
      { id: 'dashboard', icon: '📊', label: 'Dashboard' },
      { id: 'leave',     icon: '🏖', label: 'Leave' },
      { id: 'payroll',   icon: '💰', label: 'Payroll' }
    ]},
    { group: 'People',   items: [
      { id: 'employees',   icon: '👥', label: 'Employees' },
      { id: 'recruit',     icon: '🎯', label: 'Recruitment' },
      { id: 'performance', icon: '⭐', label: 'Performance' }
    ]},
    { group: 'Knowledge',items: [
      { id: 'policies',   icon: '📚', label: 'Policies' },
      { id: 'ai_chat',    icon: '✦',  label: 'AI assistant' }
    ]},
    { group: 'Setup',    items: [
      { id: 'settings', icon: '⚙', label: 'Settings' },
      { id: 'audit',    icon: '🗂', label: 'Audit log' }
    ]}
  ];

  function currentRoute() { return (location.hash || '#dashboard').replace('#', '') || 'dashboard'; }
  function labelOf(id) {
    var lbl;
    NAV.forEach(function (g) { g.items.forEach(function (it) { if (it.id === id) lbl = it.label; }); });
    return lbl || 'Section';
  }

  function renderSide() {
    var cur = currentRoute();
    var html = '<a class="nbt-brand" href="index.html"><span class="nbt-brand-mark">N</span> Nabta</a>'
      + '<div class="nbt-co-pill"><span style="font-size:11px;color:var(--nbt-muted);text-transform:uppercase;letter-spacing:.06em;font-weight:700;">Workspace</span><br/><span style="font-weight:600;">' + esc(D.COMPANY.name) + '</span></div>';
    NAV.forEach(function (g) {
      html += '<div class="nbt-side-group">' + g.group + '</div>';
      g.items.forEach(function (it) {
        html += '<a class="nbt-side-link' + (it.id === cur ? ' active' : '') + '" href="#' + it.id + '">'
          + '<span class="nbt-side-icon">' + it.icon + '</span><span>' + it.label + '</span></a>';
      });
    });
    $('side').innerHTML = html;
  }
  function renderTop() {
    var t = $('top');
    t.innerHTML = '<div style="font-weight:700;font-size:15px;">' + esc(labelOf(currentRoute())) + '</div>'
      + '<div style="margin-inline-start:auto;display:flex;align-items:center;gap:10px;">'
      +   '<a href="/" style="font-size:13px;color:var(--nbt-muted);">← saadm.dev</a>'
      +   '<span class="nbt-mode-badge" id="mode-badge">…</span>'
      +   '<span style="display:flex;align-items:center;gap:6px;padding:4px 10px;background:var(--nbt-bg-light-2);border-radius:999px;font-size:12px;color:var(--nbt-card-ink);">'
      +     '<span style="width:24px;height:24px;border-radius:999px;background:linear-gradient(135deg,var(--nbt-emerald),var(--nbt-emerald-2));color:white;display:grid;place-items:center;font-weight:700;font-size:10px;">LH</span>'
      +     'Layla Hassan · HR Director'
      +   '</span>'
      + '</div>';
    NabtaAI.health().then(function (h) {
      var el = $('mode-badge');
      var nm = h.model.indexOf('haiku') !== -1 ? 'Haiku 4.5' : h.model.indexOf('sonnet') !== -1 ? 'Sonnet 4.6' : 'Opus 4.7';
      el.className = h.live ? 'nbt-mode-badge live' : 'nbt-mode-badge';
      el.textContent = h.live ? 'Live · ' + nm : 'Demo mode';
    });
  }
  function render() {
    renderSide(); renderTop();
    var host = $('content');
    host.innerHTML = '<div class="nbt-loading"><span></span><span></span><span></span></div>';
    var fn = Sections[currentRoute()];
    if (fn) fn(host);
    else host.innerHTML = '<div class="nbt-card">Section not implemented.</div>';
  }

  var Sections = {};

  // =================== Dashboard ===================
  Sections.dashboard = function (host) {
    App.api('/dashboard').then(function (r) {
      var d = r.body;
      var k = d.kpis;
      var deptHtml = (d.dept_headcount || []).map(function (x) {
        return '<div class="nbt-dept-row"><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:' + x.dept.color + ';"></span> <strong>' + esc(x.dept.name) + '</strong><span style="margin-inline-start:auto;font-family:var(--nbt-mono);font-weight:700;">' + x.count + '</span></div>';
      }).join('');
      var leaveHtml = (d.recent_leave || []).map(function (l) {
        return '<tr><td><strong>' + esc(l.employee_name) + '</strong></td><td>' + esc(l.type) + '</td><td>' + esc(l.start_date) + ' → ' + esc(l.end_date) + '</td><td>' + l.days + ' days</td><td><span class="nbt-chip ' + l.status + '">' + esc(l.status) + '</span></td></tr>';
      }).join('');
      host.innerHTML =
          '<div class="nbt-kpi-grid">'
        +   kpi('Employees', k.employees, k.active + ' active · ' + k.probation + ' on probation')
        +   kpi('Pending leave', k.pending_leave, 'awaiting approval', k.pending_leave > 0 ? 'warn' : 'ok')
        +   kpi('Open roles', k.open_roles, 'in recruitment')
        +   kpi('Visas expiring (60d)', k.visa_expiring_60d, 'renew via Finance', k.visa_expiring_60d > 0 ? 'warn' : 'ok')
        +   kpi('Next payroll', k.next_payroll_label, App.fmtMoney(k.next_payroll_total) + ' net')
        + '</div>'
        + '<div style="display:grid;grid-template-columns:1fr 1.5fr;gap:18px;margin-top:18px;">'
        +   '<div class="nbt-card"><h3 style="margin-bottom:10px;">Headcount by department</h3>' + deptHtml + '</div>'
        +   '<div class="nbt-card"><h3 style="margin-bottom:10px;">Recent leave activity</h3>'
        +     '<table class="nbt-table"><thead><tr><th>Employee</th><th>Type</th><th>Dates</th><th>Days</th><th>Status</th></tr></thead><tbody>' + leaveHtml + '</tbody></table>'
        +   '</div>'
        + '</div>';
    });
  };
  function kpi(label, value, sub, kind) {
    return '<div class="nbt-kpi is-' + (kind || 'ok') + '">'
      + '<div class="nbt-kpi-label">' + esc(label) + '</div>'
      + '<div class="nbt-kpi-value">' + esc(String(value)) + '</div>'
      + '<div class="nbt-kpi-sub">' + esc(sub) + '</div>'
      + '</div>';
  }

  // =================== Employees ===================
  Sections.employees = function (host) {
    var state = { dept: 'all', status: 'all', q: '' };
    function paint() {
      var params = [];
      if (state.dept !== 'all') params.push('dept=' + state.dept);
      if (state.status !== 'all') params.push('status=' + state.status);
      if (state.q) params.push('q=' + encodeURIComponent(state.q));
      App.api('/employees' + (params.length ? '?' + params.join('&') : '')).then(function (r) {
        var rows = r.body.items || [];
        var deptMap = {}; D.DEPTS.forEach(function (x) { deptMap[x.id] = x; });
        var bodyHtml = rows.map(function (e) {
          var d = deptMap[e.dept_id] || { name: '?', color: '#888' };
          return '<tr style="cursor:pointer;" data-emp="' + esc(e.id) + '">'
            + '<td><span class="nbt-avatar" style="background:linear-gradient(135deg,' + d.color + ',var(--nbt-emerald-2));">' + esc(e.photo_initials) + '</span></td>'
            + '<td><strong>' + esc(e.name) + '</strong><br/><small style="color:var(--nbt-muted);">' + esc(e.email) + '</small></td>'
            + '<td>' + esc(e.title) + '</td>'
            + '<td><span style="display:inline-block;width:8px;height:8px;border-radius:3px;background:' + d.color + ';"></span> ' + esc(d.name) + '</td>'
            + '<td style="font-size:12px;">' + esc(e.nationality) + '</td>'
            + '<td>' + esc(e.hire_date) + '</td>'
            + '<td style="text-align:right;font-family:var(--nbt-mono);">' + App.fmtMoney(e.total_salary_aed) + '</td>'
            + '<td><span class="nbt-chip ' + e.status + '">' + esc(e.status) + '</span></td>'
            + '</tr>';
        }).join('');
        host.innerHTML =
            '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;align-items:center;">'
          +   '<select class="nbt-input nbt-input--sm" id="emp-dept" aria-label="Filter by department" style="max-width:180px;">'
          +     '<option value="all">All departments</option>'
          +     D.DEPTS.map(function (x) { return '<option value="' + x.id + '"' + (state.dept === x.id ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('')
          +   '</select>'
          +   '<select class="nbt-input nbt-input--sm" id="emp-status" aria-label="Filter by status" style="max-width:140px;">'
          +     ['all','active','probation','notice'].map(function (s) { return '<option value="' + s + '"' + (state.status === s ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('')
          +   '</select>'
          +   '<input class="nbt-input nbt-input--sm" id="emp-q" aria-label="Search employees" placeholder="Search…" style="max-width:240px;" value="' + esc(state.q) + '"/>'
          +   '<span style="margin-inline-start:auto;color:var(--nbt-muted);font-size:13px;">' + rows.length + ' employees</span>'
          + '</div>'
          + '<div class="nbt-panel"><table class="nbt-table">'
          + '<thead><tr><th></th><th>Name</th><th>Title</th><th>Department</th><th>Nationality</th><th>Hired</th><th style="text-align:right;">Salary</th><th>Status</th></tr></thead>'
          + '<tbody>' + bodyHtml + '</tbody></table></div>';
        $('emp-dept').addEventListener('change', function (e) { state.dept = e.target.value; paint(); });
        $('emp-status').addEventListener('change', function (e) { state.status = e.target.value; paint(); });
        var q = $('emp-q'); q.addEventListener('input', function (e) { state.q = e.target.value; clearTimeout(window.__nbtQ); window.__nbtQ = setTimeout(paint, 200); });
        host.querySelectorAll('[data-emp]').forEach(function (row) {
          row.addEventListener('click', function () { openEmployeeModal(row.getAttribute('data-emp')); });
        });
      });
    }
    paint();
  };

  function openEmployeeModal(id) {
    App.api('/employees/' + encodeURIComponent(id)).then(function (r) {
      if (!r.body.ok) return;
      var e = r.body.employee;
      var deptMap = {}; D.DEPTS.forEach(function (x) { deptMap[x.id] = x; });
      var dept = deptMap[e.dept_id] || {};
      App.showModal({
        title: e.name,
        size: 'lg',
        body:
            '<div style="display:flex;gap:14px;align-items:center;margin-bottom:14px;">'
          +   '<span class="nbt-avatar" style="background:linear-gradient(135deg,' + (dept.color || '#888') + ',var(--nbt-emerald-2));width:48px;height:48px;font-size:16px;">' + esc(e.photo_initials) + '</span>'
          +   '<div><div style="font-weight:700;font-size:16px;">' + esc(e.title) + '</div><div style="font-size:13px;color:var(--nbt-muted);">' + esc(dept.name) + ' · ' + esc(e.nationality) + '</div></div>'
          +   '<span class="nbt-chip ' + e.status + '" style="margin-inline-start:auto;">' + esc(e.status) + '</span>'
          + '</div>'
          + '<div class="nbt-meta-grid">'
          +   '<div><span>Email</span><strong>' + esc(e.email) + '</strong></div>'
          +   '<div><span>Phone</span><strong>' + esc(e.phone) + '</strong></div>'
          +   '<div><span>Hire date</span><strong>' + esc(e.hire_date) + '</strong></div>'
          +   '<div><span>Visa expires</span><strong>' + esc(e.visa_expires) + '</strong></div>'
          +   '<div><span>Emirates ID</span><strong style="font-family:var(--nbt-mono);font-size:12px;">' + esc(e.emirates_id) + '</strong></div>'
          +   '<div><span>Passport</span><strong style="font-family:var(--nbt-mono);font-size:12px;">' + esc(e.passport) + '</strong></div>'
          +   '<div><span>IBAN</span><strong style="font-family:var(--nbt-mono);font-size:11px;">' + esc(e.iban) + '</strong></div>'
          +   '<div><span>Base salary</span><strong>' + App.fmtMoney(e.base_salary_aed) + '</strong></div>'
          +   '<div><span>Allowances</span><strong>' + App.fmtMoney(e.allowances_aed) + '</strong></div>'
          +   '<div><span>Total</span><strong style="color:var(--nbt-emerald);">' + App.fmtMoney(e.total_salary_aed) + '</strong></div>'
          + '</div>'
          + '<h4 style="margin:18px 0 8px;">Leave balance</h4>'
          + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px;">'
          +   '<div class="nbt-card"><div style="color:var(--nbt-muted);font-size:11px;text-transform:uppercase;font-weight:700;">Annual leave</div><div style="font-size:18px;font-weight:700;color:var(--nbt-emerald);">' + (e.annual_leave_total - e.annual_leave_taken) + ' / ' + e.annual_leave_total + ' days</div></div>'
          +   '<div class="nbt-card"><div style="color:var(--nbt-muted);font-size:11px;text-transform:uppercase;font-weight:700;">Sick leave</div><div style="font-size:18px;font-weight:700;color:var(--nbt-emerald);">' + (e.sick_leave_total - e.sick_leave_taken) + ' / ' + e.sick_leave_total + ' days</div></div>'
          + '</div>',
        foot: '<button class="nbt-btn" data-modal-close>Close</button>'
      });
    });
  }

  // =================== Leave ===================
  Sections.leave = function (host) {
    var state = { status: 'all' };
    function paint() {
      App.api('/leave' + (state.status !== 'all' ? '?status=' + state.status : '')).then(function (r) {
        var rows = r.body.items || [];
        var chips = ['all','pending','approved','rejected','taken'].map(function (s) {
          return '<button class="nbt-chip' + (state.status === s ? ' active' : '') + '" data-s="' + s + '">' + esc(s) + '</button>';
        }).join('');
        var bodyHtml = rows.map(function (l) {
          var actions = l.status === 'pending'
            ? '<button class="nbt-btn nbt-btn--sm nbt-btn--primary" data-act="approve" data-id="' + esc(l.id) + '">Approve</button> <button class="nbt-btn nbt-btn--sm" data-act="reject" data-id="' + esc(l.id) + '">Reject</button>'
            : '';
          return '<tr>'
            + '<td style="font-family:var(--nbt-mono);font-weight:700;">' + esc(l.number || l.id) + '</td>'
            + '<td>' + esc(l.employee_name) + '</td>'
            + '<td>' + esc(l.type) + '</td>'
            + '<td style="font-family:var(--nbt-mono);font-size:12px;">' + esc(l.start_date) + ' → ' + esc(l.end_date) + '</td>'
            + '<td style="text-align:right;font-family:var(--nbt-mono);">' + l.days + ' days</td>'
            + '<td><span class="nbt-chip ' + l.status + '">' + esc(l.status) + '</span></td>'
            + '<td>' + actions + '</td>'
            + '</tr>';
        }).join('');
        host.innerHTML =
            '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;align-items:center;">'
          +   chips
          +   '<button class="nbt-btn nbt-btn--primary" id="new-leave" style="margin-inline-start:auto;">+ New leave request</button>'
          + '</div>'
          + '<div class="nbt-panel"><table class="nbt-table">'
          + '<thead><tr><th>#</th><th>Employee</th><th>Type</th><th>Dates</th><th>Days</th><th>Status</th><th></th></tr></thead>'
          + '<tbody>' + bodyHtml + '</tbody></table></div>';
        host.querySelectorAll('[data-s]').forEach(function (b) { b.addEventListener('click', function () { state.status = b.getAttribute('data-s'); paint(); }); });
        host.querySelectorAll('[data-act="approve"]').forEach(function (b) {
          b.addEventListener('click', function () {
            App.api('/leave/' + b.getAttribute('data-id') + '/approve', { method: 'POST' }).then(function () { window.toast('Approved', 'success'); paint(); });
          });
        });
        host.querySelectorAll('[data-act="reject"]').forEach(function (b) {
          b.addEventListener('click', function () {
            App.api('/leave/' + b.getAttribute('data-id') + '/reject', { method: 'POST', body: { notes: 'Not enough notice' } }).then(function () { window.toast('Rejected', 'warn'); paint(); });
          });
        });
        $('new-leave').addEventListener('click', openNewLeaveModal);
      });
    }
    paint();

    function openNewLeaveModal() {
      App.api('/employees').then(function (r) {
        var emps = r.body.items || [];
        var modal = App.showModal({
          title: 'New leave request',
          body:
              '<div class="nbt-field"><span>Employee</span><select class="nbt-input" id="nl-emp">'
            +   emps.map(function (e) { return '<option value="' + e.id + '">' + esc(e.name) + '</option>'; }).join('')
            +   '</select></div>'
            + '<div class="nbt-field"><span>Type</span><select class="nbt-input" id="nl-type">'
            +   D.LEAVE_TYPES.map(function (t) { return '<option>' + esc(t) + '</option>'; }).join('')
            +   '</select></div>'
            + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">'
            +   '<div class="nbt-field"><span>Start</span><input class="nbt-input" type="date" id="nl-start"/></div>'
            +   '<div class="nbt-field"><span>End</span><input class="nbt-input" type="date" id="nl-end"/></div>'
            + '</div>'
            + '<div class="nbt-field"><span>Reason</span><textarea class="nbt-input" id="nl-reason" rows="3"></textarea></div>',
          foot: '<button class="nbt-btn" data-modal-close>Cancel</button><button class="nbt-btn nbt-btn--primary" id="nl-go">Submit</button>',
          onMount: function (el, close) {
            el.querySelector('#nl-go').addEventListener('click', function () {
              var emp = el.querySelector('#nl-emp').value;
              var type = el.querySelector('#nl-type').value;
              var start = el.querySelector('#nl-start').value;
              var end = el.querySelector('#nl-end').value;
              if (!start || !end) { window.toast('Pick dates', 'error'); return; }
              var days = Math.max(1, Math.round((new Date(end) - new Date(start)) / 86400000) + 1);
              App.api('/leave', { method: 'POST', body: {
                employee_id: emp, type: type, start_date: start, end_date: end, days: days,
                reason: el.querySelector('#nl-reason').value
              }}).then(function () { window.toast('Submitted', 'success'); close(); paint(); });
            });
          }
        });
      });
    }
  };

  // =================== Payroll ===================
  Sections.payroll = function (host) {
    App.api('/payroll').then(function (r) {
      var rows = r.body.items || [];
      var bodyHtml = rows.map(function (p) {
        var wpsBadge = p.wps_sif_generated ? '<span class="nbt-chip approved">SIF · sent</span>' : '<span class="nbt-chip pending">SIF · not yet</span>';
        return '<tr style="cursor:pointer;" data-pay="' + esc(p.id) + '">'
          + '<td><strong>' + esc(p.label) + '</strong></td>'
          + '<td>' + p.employees_count + '</td>'
          + '<td style="text-align:right;font-family:var(--nbt-mono);">' + App.fmtMoney(p.gross_total) + '</td>'
          + '<td style="text-align:right;font-family:var(--nbt-mono);color:var(--nbt-amber);">−' + App.fmtMoney(p.deductions) + '</td>'
          + '<td style="text-align:right;font-family:var(--nbt-mono);font-weight:700;color:var(--nbt-emerald);">' + App.fmtMoney(p.net_total) + '</td>'
          + '<td>' + wpsBadge + '</td>'
          + '<td><span class="nbt-chip ' + p.status + '">' + esc(p.status) + '</span></td>'
          + '</tr>';
      }).join('');
      host.innerHTML =
          '<div style="margin-bottom:14px;color:var(--nbt-muted);font-size:13px;">Payroll runs flow through UAE WPS (Wage Protection System) via ' + esc(D.COMPANY.bank) + '. SIF file generated on the 26th, payment processed on the 28th.</div>'
        + '<div class="nbt-panel"><table class="nbt-table">'
        + '<thead><tr><th>Month</th><th>Employees</th><th style="text-align:right;">Gross</th><th style="text-align:right;">Deductions</th><th style="text-align:right;">Net</th><th>WPS</th><th>Status</th></tr></thead>'
        + '<tbody>' + bodyHtml + '</tbody></table></div>';
      host.querySelectorAll('[data-pay]').forEach(function (row) {
        row.addEventListener('click', function () { openPayrollModal(row.getAttribute('data-pay')); });
      });
    });
  };
  function openPayrollModal(id) {
    App.api('/payroll/' + encodeURIComponent(id)).then(function (r) {
      if (!r.body.ok) return;
      var p = r.body.run;
      var br = r.body.breakdown || [];
      var rowsHtml = br.slice(0, 20).map(function (b) {
        return '<tr><td>' + esc(b.employee_name) + '</td><td style="font-family:var(--nbt-mono);font-size:11px;">' + esc(b.iban.slice(0, 12)) + '…</td>'
          + '<td style="text-align:right;font-family:var(--nbt-mono);">' + App.fmtMoney(b.base) + '</td>'
          + '<td style="text-align:right;font-family:var(--nbt-mono);">' + App.fmtMoney(b.allowances) + '</td>'
          + '<td style="text-align:right;font-family:var(--nbt-mono);color:var(--nbt-amber);">−' + App.fmtMoney(b.deductions) + '</td>'
          + '<td style="text-align:right;font-family:var(--nbt-mono);font-weight:700;color:var(--nbt-emerald);">' + App.fmtMoney(b.net) + '</td></tr>';
      }).join('');
      var foot = p.status === 'draft'
        ? '<button class="nbt-btn" data-modal-close>Close</button><button class="nbt-btn nbt-btn--primary" id="finalize">Generate WPS SIF + Finalize</button>'
        : '<button class="nbt-btn" data-modal-close>Close</button>';
      var modal = App.showModal({
        title: p.label + ' · Payroll',
        size: 'lg',
        body:
            '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:14px;margin-bottom:14px;">'
          +   '<div><div style="font-size:11px;color:var(--nbt-muted);text-transform:uppercase;font-weight:700;">Employees</div><div style="font-size:18px;font-weight:700;">' + p.employees_count + '</div></div>'
          +   '<div><div style="font-size:11px;color:var(--nbt-muted);text-transform:uppercase;font-weight:700;">Gross</div><div style="font-size:18px;font-weight:700;font-family:var(--nbt-mono);">' + App.fmtMoney(p.gross_total) + '</div></div>'
          +   '<div><div style="font-size:11px;color:var(--nbt-muted);text-transform:uppercase;font-weight:700;">Deductions</div><div style="font-size:18px;font-weight:700;font-family:var(--nbt-mono);color:var(--nbt-amber);">' + App.fmtMoney(p.deductions) + '</div></div>'
          +   '<div><div style="font-size:11px;color:var(--nbt-muted);text-transform:uppercase;font-weight:700;">Net</div><div style="font-size:18px;font-weight:700;font-family:var(--nbt-mono);color:var(--nbt-emerald);">' + App.fmtMoney(p.net_total) + '</div></div>'
          + '</div>'
          + '<h4 style="margin:0 0 8px;">Per-employee breakdown</h4>'
          + '<table class="nbt-table" style="font-size:12px;"><thead><tr><th>Employee</th><th>IBAN</th><th style="text-align:right;">Base</th><th style="text-align:right;">Allow.</th><th style="text-align:right;">Dedn.</th><th style="text-align:right;">Net</th></tr></thead><tbody>' + rowsHtml + '</tbody></table>',
        foot: foot,
        onMount: function (el, close) {
          var fb = el.querySelector('#finalize');
          if (fb) fb.addEventListener('click', function () {
            App.api('/payroll/' + encodeURIComponent(id) + '/finalize', { method: 'POST' }).then(function () {
              window.toast('WPS SIF generated · payroll finalized (demo)', 'success', 3500);
              close();
              Sections.payroll(document.getElementById('content'));
            });
          });
        }
      });
    });
  }

  // =================== Recruitment (kanban) ===================
  Sections.recruit = function (host) {
    Promise.all([App.api('/candidates'), App.api('/roles')]).then(function (rs) {
      var cands = rs[0].body.items || [];
      var roles = rs[1].body.items || [];
      var stages = D.STAGES.filter(function (s) { return s !== 'rejected'; });
      var columnsHtml = stages.map(function (s) {
        var col = cands.filter(function (c) { return c.stage === s; });
        var cards = col.map(function (c) {
          return '<div class="nbt-kanban-card" data-cand="' + esc(c.id) + '">'
            + '<div style="font-weight:700;font-size:13.5px;">' + esc(c.name) + '</div>'
            + '<div style="font-size:11.5px;color:var(--nbt-muted);">' + esc(c.role_title) + '</div>'
            + '<div style="display:flex;gap:6px;margin-top:6px;font-size:11px;color:var(--nbt-muted-light);">'
            +   '<span>⭐ ' + c.rating + '</span><span>· ' + c.years_exp + 'y</span><span>· ' + esc(c.source) + '</span>'
            + '</div>'
            + '<div style="margin-top:6px;font-size:11px;color:var(--nbt-card-ink);">Expected: <strong>' + App.fmtMoney(c.expected_salary_aed) + '</strong></div>'
            + '</div>';
        }).join('') || '<div style="padding:14px;text-align:center;color:var(--nbt-muted);font-size:12px;">Empty</div>';
        return '<div class="nbt-kanban-col"><h4 style="margin-bottom:8px;text-transform:capitalize;">' + esc(s) + ' <span style="color:var(--nbt-muted);font-weight:400;">· ' + col.length + '</span></h4>' + cards + '</div>';
      }).join('');
      var rolesHtml = roles.map(function (r) {
        var d = D.DEPTS.find(function (x) { return x.id === r.dept_id; }) || { name: '?', color: '#888' };
        return '<div class="nbt-role"><div><strong>' + esc(r.title) + '</strong><br/><small style="color:var(--nbt-muted);">' + esc(d.name) + ' · ' + esc(r.remote) + '</small></div><div style="text-align:right;"><div style="font-size:12px;color:var(--nbt-card-ink);">' + esc(r.salary_range) + '</div></div></div>';
      }).join('');
      host.innerHTML =
          '<div class="nbt-card" style="margin-bottom:14px;"><h3 style="margin-bottom:10px;">Open roles (' + roles.length + ')</h3>' + rolesHtml + '</div>'
        + '<div class="nbt-kanban">' + columnsHtml + '</div>';
    });
  };

  // =================== Performance ===================
  Sections.performance = function (host) {
    var rows = D.REVIEWS;
    var bodyHtml = rows.map(function (r) {
      return '<tr><td><strong>' + esc(r.employee_name) + '</strong></td>'
        + '<td>' + esc(r.cycle) + '</td>'
        + '<td><span class="nbt-chip ' + r.status + '">' + esc(r.status.replace(/_/g, ' ')) + '</span></td>'
        + '<td style="text-align:right;font-family:var(--nbt-mono);font-weight:700;">' + (r.rating || '-') + '</td>'
        + '<td style="text-align:right;font-family:var(--nbt-mono);">' + (r.goals_met_pct ? r.goals_met_pct + '%' : '-') + '</td>'
        + '<td>' + (r.submitted_at ? App.fmtDate(r.submitted_at) : '-') + '</td>'
        + '</tr>';
    }).join('');
    host.innerHTML =
        '<div style="margin-bottom:14px;color:var(--nbt-muted);font-size:13px;">Q2-2026 cycle in progress. Reviews due by end of month.</div>'
      + '<div class="nbt-panel"><table class="nbt-table">'
      + '<thead><tr><th>Employee</th><th>Cycle</th><th>Status</th><th style="text-align:right;">Rating</th><th style="text-align:right;">Goals met</th><th>Submitted</th></tr></thead>'
      + '<tbody>' + bodyHtml + '</tbody></table></div>';
  };

  // =================== Policies ===================
  Sections.policies = function (host) {
    App.api('/policies').then(function (r) {
      var rows = r.body.items || [];
      host.innerHTML = rows.map(function (p) {
        return '<div class="nbt-card" style="margin-bottom:12px;">'
          + '<h3 style="margin-bottom:8px;">' + esc(p.title) + ' <small style="font-family:var(--nbt-mono);color:var(--nbt-muted);font-weight:400;font-size:11px;">[' + p.id + ']</small></h3>'
          + '<p style="margin:0;font-size:14px;line-height:1.65;color:var(--nbt-card-ink-2);">' + esc(p.body) + '</p>'
          + '</div>';
      }).join('') + '<div style="margin-top:14px;padding:14px;background:var(--nbt-emerald-bg);border:1px solid var(--nbt-emerald-line);border-radius:10px;font-size:13px;color:var(--nbt-emerald-dark);">✦ Use the <strong>AI assistant</strong> to ask questions about these policies - Claude grounds every answer in this knowledge base + UAE Labour Law and cites which policy it leaned on.</div>';
    });
  };

  // =================== AI assistant ===================
  Sections.ai_chat = function (host) {
    var history = NabtaApp.jget('nabta.ai.history', []);
    function paint() {
      var msgsHtml = history.map(function (m) {
        if (m.role === 'user') {
          return '<div class="nbt-msg out"><div class="nbt-bubble">' + esc(m.content) + '</div></div>';
        }
        var cites = (m.citations || []).map(function (c) {
          return '<a class="nbt-cite" data-pol="' + esc(c.id) + '">📎 ' + esc(c.title) + '</a>';
        }).join('');
        var bodyStripped = String(m.content || '').replace(/\[pol-[a-z0-9-]+\]/g, '').replace(/\s+([.,])/g, '$1').trim();
        return '<div class="nbt-msg"><div class="nbt-msg-avatar">N</div><div style="min-width:0;flex:1;">'
          + '<div class="nbt-bubble">' + esc(bodyStripped).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>') + '</div>'
          + (cites ? '<div class="nbt-cites">' + cites + '</div>' : '')
          + '</div></div>';
      }).join('');
      var greetingHtml = !history.length
        ? '<div style="padding:24px;background:linear-gradient(135deg,rgba(52,211,153,0.10),rgba(110,142,255,0.06));border:1px solid var(--nbt-emerald-line);border-radius:14px;margin-bottom:16px;">'
          + '<h3 style="color:var(--nbt-emerald);margin-bottom:6px;">✦ Hi, I\'m Nabta\'s policy assistant</h3>'
          + '<p style="margin:0 0 12px;color:var(--nbt-card-ink-2);font-size:13.5px;">Ask me anything about Sila Trading HR policies + UAE Labour Law. I cite the specific policy in every answer.</p>'
          + '<div style="display:flex;gap:6px;flex-wrap:wrap;">'
          +   ['How many annual leave days do I get?','When is payroll processed via WPS?','How does end-of-service gratuity work?','Tell me about the probation policy.','Can I work fully remote?'].map(function (q) { return '<button class="nbt-chip" data-q="' + esc(q) + '">' + esc(q) + '</button>'; }).join('')
          + '</div></div>'
        : '';
      host.innerHTML =
          '<div style="display:flex;flex-direction:column;height:calc(100vh - 130px);max-height:720px;">'
        +   '<div id="thread" style="flex:1;overflow-y:auto;padding-bottom:14px;">' + greetingHtml + msgsHtml + '</div>'
        +   '<div style="display:flex;gap:8px;padding-top:10px;border-top:1px solid var(--nbt-line-light);">'
        +     '<input class="nbt-input" id="ai-input" aria-label="Ask the policy assistant" placeholder="Ask about leave, payroll, visa, gratuity, probation, remote work…"/>'
        +     '<button class="nbt-btn nbt-btn--primary" id="ai-send" aria-label="Send message">↑</button>'
        +   '</div>'
        + '</div>';
      var thread = $('thread'); if (thread) thread.scrollTop = thread.scrollHeight;
      $('ai-send').addEventListener('click', send);
      $('ai-input').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); send(); } });
      host.querySelectorAll('[data-q]').forEach(function (b) {
        b.addEventListener('click', function () { $('ai-input').value = b.getAttribute('data-q'); send(); });
      });
      host.querySelectorAll('[data-pol]').forEach(function (c) {
        c.addEventListener('click', function () {
          App.api('/policies/' + c.getAttribute('data-pol')).then(function (r) {
            if (!r.body.ok) return;
            var p = r.body.policy;
            App.showModal({ title: '📎 ' + p.title, body: '<p style="font-size:14px;line-height:1.65;color:var(--nbt-card-ink-2);">' + esc(p.body) + '</p>', foot: '<button class="nbt-btn" data-modal-close>Close</button>' });
          });
        });
      });
    }
    function send() {
      var input = $('ai-input');
      var q = (input.value || '').trim();
      if (!q) return;
      input.value = '';
      history.push({ role: 'user', content: q });
      NabtaApp.jset('nabta.ai.history', history);
      paint();
      NabtaAI.policyChat({ question: q, history: history.slice(-6, -1) }).then(function (r) {
        history.push({ role: 'assistant', content: r.text, citations: r.citations || [], model: r.model, latency_ms: r.latency_ms, fallback: r.fallback });
        NabtaApp.jset('nabta.ai.history', history);
        paint();
      });
    }
    paint();
  };

  // =================== Settings ===================
  Sections.settings = function (host) {
    App.api('/settings').then(function (r) {
      var s = r.body.settings;
      host.innerHTML =
          '<div class="nbt-card" style="margin-bottom:14px;"><h3 style="margin-bottom:14px;">Company</h3>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">'
        + '<div class="nbt-field"><span>Company name</span><input class="nbt-input" id="st-name" value="' + esc(s.company_name) + '"/></div>'
        + '<div class="nbt-field"><span>WPS employer code</span><input class="nbt-input" id="st-wps" value="' + esc(s.wps_employer_code) + '"/></div>'
        + '<div class="nbt-field"><span>Currency</span><input class="nbt-input" id="st-cur" value="' + esc(s.currency) + '"/></div>'
        + '<div class="nbt-field"><span>Pay day (of month)</span><input class="nbt-input" type="number" id="st-pd" value="' + s.pay_day + '"/></div>'
        + '</div></div>'
        + '<div class="nbt-card" style="margin-bottom:14px;"><h3 style="margin-bottom:14px;">Leave</h3>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">'
        + '<div class="nbt-field"><span>Annual leave (days/year)</span><input class="nbt-input" type="number" id="st-al" value="' + s.annual_leave_days + '"/></div>'
        + '<div class="nbt-field"><span>Sick leave (days/year)</span><input class="nbt-input" type="number" id="st-sl" value="' + s.sick_leave_days + '"/></div>'
        + '</div></div>'
        + '<div class="nbt-card" style="margin-bottom:14px;"><h3 style="margin-bottom:14px;">Probation</h3>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">'
        + '<div class="nbt-field"><span>Probation (months)</span><input class="nbt-input" type="number" id="st-pm" value="' + s.probation_months + '"/></div>'
        + '<div class="nbt-field"><span>Notice after probation (days)</span><input class="nbt-input" type="number" id="st-nd" value="' + s.notice_days_after_probation + '"/></div>'
        + '</div></div>'
        + '<div style="display:flex;gap:8px;">'
        + '<button class="nbt-btn nbt-btn--primary" id="st-save">Save settings</button>'
        + '<button class="nbt-btn" id="st-reset" style="margin-inline-start:auto;color:var(--nbt-amber);border-color:rgba(245,158,11,0.4);">Reset demo</button>'
        + '</div>';
      $('st-save').addEventListener('click', function () {
        App.api('/settings', { method: 'POST', body: {
          company_name: $('st-name').value, wps_employer_code: $('st-wps').value, currency: $('st-cur').value,
          pay_day: +$('st-pd').value, annual_leave_days: +$('st-al').value, sick_leave_days: +$('st-sl').value,
          probation_months: +$('st-pm').value, notice_days_after_probation: +$('st-nd').value
        }}).then(function () { window.toast('Settings saved', 'success'); });
      });
      $('st-reset').addEventListener('click', function () {
        if (!confirm('Wipe all local edits?')) return;
        try { localStorage.removeItem('nabta.ai.history'); } catch (e) {}
        App.api('/reset', { method: 'POST' }).then(function () { window.toast('Demo reset', 'warn'); setTimeout(function () { location.reload(); }, 500); });
      });
    });
  };

  // =================== Audit ===================
  Sections.audit = function (host) {
    App.api('/audit').then(function (r) {
      var rows = r.body.items || [];
      var empMap = {}; D.EMPLOYEES.forEach(function (e) { empMap[e.id] = e.name; });
      var bodyHtml = rows.map(function (a) {
        return '<tr><td style="font-family:var(--nbt-mono);font-size:12px;">' + esc(App.fmtDateTime(a.when)) + '</td>'
          + '<td>' + esc(empMap[a.actor] || a.actor) + '</td>'
          + '<td style="font-family:var(--nbt-mono);color:var(--nbt-emerald);">' + esc(a.action) + '</td>'
          + '<td style="font-family:var(--nbt-mono);font-size:12px;">' + esc(a.target) + '</td>'
          + '<td style="font-size:12.5px;color:var(--nbt-muted-light);">' + esc(a.details) + '</td></tr>';
      }).join('');
      host.innerHTML = '<div class="nbt-panel"><table class="nbt-table">'
        + '<thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>'
        + '<tbody>' + bodyHtml + '</tbody></table></div>';
    });
  };

  window.NabtaSections = Sections;
  window.addEventListener('hashchange', render);
  document.addEventListener('DOMContentLoaded', render);
})();
