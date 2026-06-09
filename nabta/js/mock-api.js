/* mock-api.js - Nabta fetch interceptor for /nabta/api/*. localStorage-backed
 * with seed merge. Regex routes wrapped in parens (POS lesson). */
(function () {
  'use strict';
  if (!window.NABTA_DATA) { console.error('mock-api: NABTA_DATA not loaded'); return; }

  var LS = {
    employee_edits: 'nabta.employee.edits',
    leave_edits:    'nabta.leave.edits',
    leave_created:  'nabta.leave.created',
    candidate_edits:'nabta.candidate.edits',
    payroll_edits:  'nabta.payroll.edits',
    settings:       'nabta.settings',
    audit:          'nabta.audit',
    ai_log:         'nabta.ai.log'
  };
  function jget(k, def) { try { return JSON.parse(localStorage.getItem(k)) || def; } catch (e) { return def; } }
  function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  function employees() {
    var e = jget(LS.employee_edits, {});
    return window.NABTA_DATA.EMPLOYEES.map(function (x) { return e[x.id] ? Object.assign({}, x, e[x.id]) : x; });
  }
  function leave() {
    var e = jget(LS.leave_edits, {});
    var created = jget(LS.leave_created, []);
    return window.NABTA_DATA.LEAVE.concat(created).map(function (x) { return e[x.id] ? Object.assign({}, x, e[x.id]) : x; });
  }
  function candidates() {
    var e = jget(LS.candidate_edits, {});
    return window.NABTA_DATA.CANDIDATES.map(function (x) { return e[x.id] ? Object.assign({}, x, e[x.id]) : x; });
  }
  function payrolls() {
    var e = jget(LS.payroll_edits, {});
    return window.NABTA_DATA.PAYROLL_RUNS.map(function (x) { return e[x.id] ? Object.assign({}, x, e[x.id]) : x; });
  }
  function settings() {
    var s = jget(LS.settings, {});
    return Object.assign({}, window.NABTA_DATA.SETTINGS, s);
  }
  function auditLog() {
    return jget(LS.audit, window.NABTA_DATA.AUDIT_SEED.slice());
  }
  function audit(action, target, details) {
    var log = auditLog();
    log.unshift({ id: 'a-' + Date.now(), when: new Date().toISOString(), actor: 'em-017', action: action, target: target, details: details || '' });
    jset(LS.audit, log.slice(0, 200));
  }

  function dashboardKpis() {
    var emps = employees();
    var active = emps.filter(function (e) { return e.status === 'active'; }).length;
    var probation = emps.filter(function (e) { return e.status === 'probation'; }).length;
    var pendingLeave = leave().filter(function (l) { return l.status === 'pending'; }).length;
    var openRoles = (window.NABTA_DATA.ROLES_OPEN || []).filter(function (r) { return r.status === 'open'; }).length;
    var nextPayroll = payrolls().find(function (p) { return p.status === 'draft'; }) || payrolls()[0];
    var visaExpiring = emps.filter(function (e) {
      var days = (new Date(e.visa_expires) - new Date()) / 86400000;
      return days > 0 && days < 60;
    }).length;
    return {
      employees: emps.length,
      active: active,
      probation: probation,
      pending_leave: pendingLeave,
      open_roles: openRoles,
      visa_expiring_60d: visaExpiring,
      next_payroll_label: nextPayroll ? nextPayroll.label : '-',
      next_payroll_total: nextPayroll ? nextPayroll.net_total : 0
    };
  }

  function handle(method, path, body, params) {
    var m;
    body = body || {}; params = params || {};

    /* ===== Company ===== */
    if (path === '/company'  && method === 'GET') return { ok: true, company: window.NABTA_DATA.COMPANY };
    if (path === '/departments' && method === 'GET') return { ok: true, items: window.NABTA_DATA.DEPTS };

    /* ===== Employees ===== */
    if (path === '/employees' && method === 'GET') {
      var rows = employees();
      if (params.dept) rows = rows.filter(function (e) { return e.dept_id === params.dept; });
      if (params.status) rows = rows.filter(function (e) { return e.status === params.status; });
      if (params.q) {
        var q = String(params.q).toLowerCase();
        rows = rows.filter(function (e) { return (e.name + ' ' + e.title + ' ' + e.email).toLowerCase().indexOf(q) !== -1; });
      }
      return { ok: true, items: rows };
    }
    if ((m = path.match(/^\/employees\/([^\/]+)$/)) && method === 'GET') {
      var e = employees().find(function (x) { return x.id === m[1]; });
      return e ? { ok: true, employee: e } : { ok: false, error: 'not_found', status: 404 };
    }
    if ((m = path.match(/^\/employees\/([^\/]+)$/)) && method === 'PUT') {
      var ee = jget(LS.employee_edits, {});
      ee[m[1]] = Object.assign({}, ee[m[1]] || {}, body);
      jset(LS.employee_edits, ee);
      audit('employee.update', m[1], JSON.stringify(body).slice(0, 80));
      return { ok: true };
    }

    /* ===== Leave ===== */
    if (path === '/leave' && method === 'GET') {
      var rows2 = leave();
      if (params.status) rows2 = rows2.filter(function (l) { return l.status === params.status; });
      if (params.employee) rows2 = rows2.filter(function (l) { return l.employee_id === params.employee; });
      return { ok: true, items: rows2 };
    }
    if (path === '/leave' && method === 'POST') {
      var emp = employees().find(function (x) { return x.id === body.employee_id; });
      var newLeave = Object.assign({
        id: 'lv-' + Date.now(),
        number: 'LV-' + Math.floor(300 + Math.random() * 700),
        employee_name: emp ? emp.name : 'Unknown',
        status: 'pending',
        submitted_at: new Date().toISOString()
      }, body);
      var c = jget(LS.leave_created, []); c.unshift(newLeave); jset(LS.leave_created, c);
      audit('leave.submit', newLeave.id, body.type + ' · ' + body.days + ' days');
      return { ok: true, leave: newLeave };
    }
    if ((m = path.match(/^\/leave\/([^\/]+)\/approve$/)) && method === 'POST') {
      var le = jget(LS.leave_edits, {});
      le[m[1]] = Object.assign({}, le[m[1]] || {}, { status: 'approved', approved_at: new Date().toISOString(), approved_by: 'em-017' });
      jset(LS.leave_edits, le);
      audit('leave.approve', m[1], '');
      return { ok: true };
    }
    if ((m = path.match(/^\/leave\/([^\/]+)\/reject$/)) && method === 'POST') {
      var le2 = jget(LS.leave_edits, {});
      le2[m[1]] = Object.assign({}, le2[m[1]] || {}, { status: 'rejected', notes: body.notes || '' });
      jset(LS.leave_edits, le2);
      audit('leave.reject', m[1], body.notes || '');
      return { ok: true };
    }

    /* ===== Payroll ===== */
    if (path === '/payroll' && method === 'GET') return { ok: true, items: payrolls() };
    if ((m = path.match(/^\/payroll\/([^\/]+)$/)) && method === 'GET') {
      var p = payrolls().find(function (x) { return x.id === m[1]; });
      if (!p) return { ok: false, error: 'not_found', status: 404 };
      // Per-employee breakdown for the current payroll
      var rows3 = employees().filter(function (e) { return e.status !== 'notice'; }).map(function (e) {
        return {
          employee_id: e.id, employee_name: e.name, dept_id: e.dept_id,
          base: e.base_salary_aed, allowances: e.allowances_aed,
          gross: e.total_salary_aed, deductions: Math.round(e.total_salary_aed * 0.02),
          net: e.total_salary_aed - Math.round(e.total_salary_aed * 0.02),
          iban: e.iban
        };
      });
      return { ok: true, run: p, breakdown: rows3 };
    }
    if ((m = path.match(/^\/payroll\/([^\/]+)\/finalize$/)) && method === 'POST') {
      var pe = jget(LS.payroll_edits, {});
      pe[m[1]] = Object.assign({}, pe[m[1]] || {}, { status: 'paid', paid_at: new Date().toISOString(), wps_sif_generated: true, wps_acknowledged: true });
      jset(LS.payroll_edits, pe);
      audit('payroll.finalize', m[1], 'WPS SIF generated');
      return { ok: true };
    }

    /* ===== Recruitment ===== */
    if (path === '/roles' && method === 'GET')      return { ok: true, items: window.NABTA_DATA.ROLES_OPEN };
    if (path === '/candidates' && method === 'GET') {
      var rows4 = candidates();
      if (params.stage) rows4 = rows4.filter(function (c) { return c.stage === params.stage; });
      if (params.role)  rows4 = rows4.filter(function (c) { return c.role_id === params.role; });
      return { ok: true, items: rows4 };
    }
    if ((m = path.match(/^\/candidates\/([^\/]+)\/stage$/)) && method === 'POST') {
      var ce = jget(LS.candidate_edits, {});
      ce[m[1]] = Object.assign({}, ce[m[1]] || {}, { stage: body.stage });
      jset(LS.candidate_edits, ce);
      audit('candidate.stage', m[1], body.stage);
      return { ok: true };
    }

    /* ===== Performance reviews ===== */
    if (path === '/reviews' && method === 'GET') return { ok: true, items: window.NABTA_DATA.REVIEWS };

    /* ===== Policies (KB for AI assistant) ===== */
    if (path === '/policies' && method === 'GET') return { ok: true, items: window.NABTA_DATA.POLICIES };
    if ((m = path.match(/^\/policies\/([^\/]+)$/)) && method === 'GET') {
      var pol = window.NABTA_DATA.POLICIES.find(function (x) { return x.id === m[1]; });
      return pol ? { ok: true, policy: pol } : { ok: false, error: 'not_found', status: 404 };
    }

    /* ===== Dashboard ===== */
    if (path === '/dashboard' && method === 'GET') {
      var kpis = dashboardKpis();
      var recent = leave().sort(function (a, b) { return new Date(b.submitted_at) - new Date(a.submitted_at); }).slice(0, 6);
      var dh = (window.NABTA_DATA.DEPTS || []).map(function (d) {
        return { dept: d, count: employees().filter(function (e) { return e.dept_id === d.id; }).length };
      });
      return { ok: true, kpis: kpis, recent_leave: recent, dept_headcount: dh };
    }

    /* ===== Settings + Audit ===== */
    if (path === '/settings' && method === 'GET') return { ok: true, settings: settings() };
    if (path === '/settings' && method === 'POST') {
      var s = jget(LS.settings, {});
      jset(LS.settings, Object.assign({}, s, body));
      audit('settings.update', '', JSON.stringify(body).slice(0, 80));
      return { ok: true };
    }
    if (path === '/audit' && method === 'GET') return { ok: true, items: auditLog() };

    if (path === '/ai-logs' && method === 'GET') return { ok: true, items: jget(LS.ai_log, []) };
    if (path === '/ai-logs' && method === 'POST') {
      var l = jget(LS.ai_log, []);
      l.unshift(Object.assign({ id: 'al-' + Date.now(), at: new Date().toISOString() }, body));
      jset(LS.ai_log, l.slice(0, 200));
      return { ok: true };
    }

    if (path === '/reset' && method === 'POST') {
      Object.keys(LS).forEach(function (k) { try { localStorage.removeItem(LS[k]); } catch (e) {} });
      return { ok: true };
    }

    return { ok: false, error: 'unknown_route', status: 404 };
  }

  var origFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var idx = url.indexOf('/nabta/api');
    if (idx === -1 || url.indexOf('/api/nabta/ai/') !== -1)
      return origFetch ? origFetch(input, init) : Promise.reject(new Error('no fetch'));
    init = init || {};
    var method = (init.method || 'GET').toUpperCase();
    var pq = url.slice(idx + '/nabta/api'.length).split('?');
    var path = pq[0] || '/';
    var params = {};
    if (pq[1]) pq[1].split('&').forEach(function (kv) { var p = kv.split('='); params[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ''); });
    var body = {};
    if (init.body) { try { body = JSON.parse(init.body); } catch (e) { body = {}; } }
    var res = handle(method, path, body, params);
    return Promise.resolve({ ok: !!res.ok, status: res.status || (res.ok ? 200 : 400), json: function () { return Promise.resolve(res); } });
  };
  console.log('Nabta mock-api ready');
})();
