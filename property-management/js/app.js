/* app.js - Property Management shared shell + helpers.
 * Exposes window.PMApp (data/api/session/modal/print) and window.PMUI
 * (shell, components, inline-SVG charts). Role pages render against these and
 * hold no business logic (that lives in engine.js / mock-api.js). */
(function () {
  'use strict';
  // Recruiter demo strip, same as the other demos.
  (function () { var s = document.createElement('script'); s.src = '/assets/portfolio-banner.js?v=20260514'; s.async = true; document.head.appendChild(s); })();

  var E = window.PMEngine, D = window.PM_DATA;
  function jget(k, def) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? def : v; } catch (e) { return def; } }
  function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmtDate(iso) { if (!iso) return '-'; return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  function fmtDay(iso) { if (!iso) return '-'; return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }
  function fmtDateTime(iso) { if (!iso) return '-'; return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  function timeAgo(iso) {
    if (!iso) return '';
    var d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (d < 0) { var a = Math.abs(d); if (a < 3600) return 'in ' + Math.floor(a / 60) + 'm'; if (a < 86400) return 'in ' + Math.floor(a / 3600) + 'h'; return 'in ' + Math.floor(a / 86400) + 'd'; }
    if (d < 60) return 'just now'; if (d < 3600) return Math.floor(d / 60) + 'm ago'; if (d < 86400) return Math.floor(d / 3600) + 'h ago'; return Math.floor(d / 86400) + 'd ago';
  }

  function api(path, opts) {
    opts = opts || {};
    return fetch('/property-management/api' + path, {
      method: opts.method || 'GET', headers: { 'Content-Type': 'application/json' },
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) { return r.json().then(function (b) { return { ok: r.ok, status: r.status, body: b }; }); });
  }
  function qs() { var p = {}, s = location.search.slice(1); if (s) s.split('&').forEach(function (kv) { var x = kv.split('='); p[decodeURIComponent(x[0])] = decodeURIComponent(x[1] || ''); }); return p; }

  // ---------- session / persona ----------
  var ROLE_PAGE = { tenant: 'tenant.html', landlord: 'landlord.html', manager: 'manager.html', vendor: 'vendor.html', inspector: 'inspector.html' };
  var ROLE_LABEL = { tenant: 'Tenant', landlord: 'Landlord', manager: 'Property Manager', vendor: 'Vendor', inspector: 'Inspector' };
  function activityCount(map, arr, key) { arr.forEach(function (x) { map[x[key]] = (map[x[key]] || 0) + 1; }); }
  function personas(role) {
    if (role === 'tenant') {
      var acts = {}; activityCount(acts, D.WORK_ORDERS, 'tenant_id'); activityCount(acts, D.VISITORS, 'tenant_id'); activityCount(acts, D.BOOKINGS, 'tenant_id');
      return D.TENANTS.filter(function (t) { return t.current_lease_id; }).sort(function (a, b) { return (acts[b.id] || 0) - (acts[a.id] || 0); }).slice(0, 8)
        .map(function (t) { var u = D.UNITS.filter(function (x) { return x.id === t.current_unit_id; })[0] || {}; return { id: t.id, name: t.name, sub: (u.property_name || '') + ' · ' + (u.unit_no || '') }; });
    }
    if (role === 'landlord') return D.OWNERS.slice().sort(function (a, b) { return D.UNITS.filter(function (u) { return u.owner_id === b.id; }).length - D.UNITS.filter(function (u) { return u.owner_id === a.id; }).length; }).slice(0, 8).map(function (o) { var n = D.UNITS.filter(function (u) { return u.owner_id === o.id; }).length; return { id: o.id, name: o.name, sub: n + ' unit' + (n === 1 ? '' : 's') + ' · ' + o.kind.replace('_', ' ') }; });
    if (role === 'manager') return D.MANAGERS.map(function (m) { return { id: m.id, name: m.name, sub: m.role }; });
    if (role === 'vendor') { var vacts = {}; activityCount(vacts, D.WORK_ORDERS.filter(function (w) { return w.vendor_id; }), 'vendor_id'); return D.VENDORS.slice().sort(function (a, b) { return (vacts[b.id] || 0) - (vacts[a.id] || 0); }).slice(0, 8).map(function (v) { return { id: v.id, name: v.name, sub: v.trades.map(function (t) { return E.label('category', t); }).join(', ') }; }); }
    if (role === 'inspector') { var iacts = {}; activityCount(iacts, D.INSPECTIONS, 'inspector_id'); return D.INSPECTORS.slice().sort(function (a, b) { return (iacts[b.id] || 0) - (iacts[a.id] || 0); }).map(function (i) { return { id: i.id, name: i.name, sub: (i.certifications || []).join(', ') }; }); }
    return [];
  }
  var _session = null;
  function initSession(role) {
    var q = qs();
    var pid = q[role] || (jget('pm.session', {})[role]) || (personas(role)[0] || {}).id;
    var per = personas(role).filter(function (p) { return p.id === pid; })[0] || personas(role)[0];
    var sess = jget('pm.session', {}); sess[role] = per ? per.id : null; jset('pm.session', sess);
    _session = { role: role, id: per ? per.id : null, name: per ? per.name : ROLE_LABEL[role], sub: per ? per.sub : '' };
    return _session;
  }
  function session() { return _session; }
  function switchPersona(role, id) { var sess = jget('pm.session', {}); sess[role] = id; jset('pm.session', sess); location.search = '?' + role + '=' + id; }

  // ---------- modal ----------
  function showModal(opts) {
    var bg = document.createElement('div'); bg.className = 'pm-modal-backdrop';
    bg.innerHTML = '<div class="pm-modal ' + (opts.size ? 'pm-modal--' + opts.size : '') + '">'
      + '<div class="pm-modal-head"><h3>' + escapeHtml(opts.title || '') + '</h3><button class="pm-modal-close" data-close>&times;</button></div>'
      + '<div class="pm-modal-body">' + (opts.body || '') + '</div>'
      + (opts.foot ? '<div class="pm-modal-foot">' + opts.foot + '</div>' : '') + '</div>';
    document.body.appendChild(bg);
    requestAnimationFrame(function () { bg.classList.add('show'); });
    function close() { bg.classList.remove('show'); setTimeout(function () { bg.remove(); }, 180); }
    bg.addEventListener('click', function (e) { if (e.target === bg || (e.target.hasAttribute && e.target.hasAttribute('data-close'))) close(); });
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } });
    if (opts.onMount) opts.onMount(bg.querySelector('.pm-modal'), close);
    return { el: bg, close: close };
  }

  // ---------- printable document (hidden iframe) ----------
  function openPrintDoc(o) {
    var html = '<!doctype html><html><head><meta charset="utf-8"><title>' + escapeHtml(o.title || 'Document') + '</title>'
      + '<style>@page{size:A4;margin:0}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
      + 'body{font-family:"Inter",Arial,sans-serif;color:#1a2233;margin:0}'
      + '.doc{padding:22mm 16mm}'
      + '.lh{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #4f5bd5;padding-bottom:12px;margin-bottom:18px}'
      + '.lh .b{font-family:"Fraunces",Georgia,serif;font-weight:700;font-size:22px;color:#4f5bd5}'
      + '.lh .m{font-size:11px;color:#67708a;text-align:right}'
      + 'h1{font-size:17px;margin:0 0 4px}.sub{color:#67708a;font-size:12px;margin-bottom:16px}'
      + 'table{width:100%;border-collapse:collapse;font-size:12px;margin:10px 0}'
      + 'th,td{text-align:left;padding:7px 8px;border-bottom:1px solid #e6e9f2}'
      + 'th{background:#f4f5fb;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#67708a}'
      + 'tr:nth-child(even) td{background:#fafbff}.r{text-align:right}.tot{font-weight:700}'
      + '.foot{margin-top:24px;padding-top:10px;border-top:1px solid #e6e9f2;font-size:10px;color:#98a0b5}</style></head>'
      + '<body><div class="doc"><div class="lh"><div class="b">Property Management</div>'
      + '<div class="m">' + (o.meta || '') + '<br>Generated ' + new Date().toLocaleString('en-GB', { timeZone: 'Asia/Dubai' }) + ' GST</div></div>'
      + '<h1>' + escapeHtml(o.title || '') + '</h1>' + (o.subtitle ? '<div class="sub">' + escapeHtml(o.subtitle) + '</div>' : '')
      + (o.bodyHtml || '')
      + '<div class="foot">Synthetic demo document - not a financial or legal instrument. All names, figures and dates are fabricated. Property Management portfolio demo, saadm.dev.</div>'
      + '</div></body></html>';
    var f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(f);
    var doc = f.contentWindow.document; doc.open(); doc.write(html); doc.close();
    setTimeout(function () { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) {} setTimeout(function () { f.remove(); }, 800); }, 350);
  }

  window.PMApp = {
    jget: jget, jset: jset, escapeHtml: escapeHtml, fmtDate: fmtDate, fmtDay: fmtDay, fmtDateTime: fmtDateTime, timeAgo: timeAgo,
    api: api, qs: qs, showModal: showModal, openPrintDoc: openPrintDoc,
    initSession: initSession, session: session, personas: personas, switchPersona: switchPersona,
    ROLE_PAGE: ROLE_PAGE, ROLE_LABEL: ROLE_LABEL
  };

  // ================= PMUI: components + shell + charts =================
  function chip(kind, value) { return '<span class="pm-chip pm-chip--' + E.tone(kind, value) + '">' + escapeHtml(E.label(kind, value)) + '</span>'; }
  function kpi(o) {
    return '<div class="pm-stat' + (o.tone ? ' is-' + o.tone : '') + '">'
      + '<div class="pm-stat-label">' + escapeHtml(o.label) + '</div>'
      + '<div class="pm-stat-value">' + o.value + '</div>'
      + (o.sub ? '<div class="pm-stat-sub">' + o.sub + '</div>' : '') + '</div>';
  }
  function avatar(name, hue, size) {
    var initials = String(name || '?').split(' ').map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase();
    return '<span class="pm-avatar" style="--h:' + (hue || 220) + ';width:' + (size || 32) + 'px;height:' + (size || 32) + 'px;font-size:' + Math.round((size || 32) * 0.4) + 'px">' + escapeHtml(initials) + '</span>';
  }
  function empty(msg, icon) { return '<div class="pm-empty"><div class="pm-empty-icon">' + (icon || '&#128203;') + '</div><p>' + escapeHtml(msg) + '</p></div>'; }
  function skeleton(rows) { var h = ''; for (var i = 0; i < (rows || 4); i++) h += '<div class="pm-skel-line"></div>'; return '<div class="pm-skel">' + h + '</div>'; }
  function table(cols, rows, opts) {
    opts = opts || {};
    if (!rows.length) return empty(opts.empty || 'Nothing to show yet.');
    var h = '<div class="pm-table-wrap"><table class="pm-table"><thead><tr>';
    cols.forEach(function (c) { h += '<th' + (c.r ? ' class="r"' : '') + '>' + escapeHtml(c.h) + '</th>'; });
    h += '</tr></thead><tbody>';
    rows.forEach(function (row) {
      h += '<tr' + (opts.rowAttr ? ' ' + opts.rowAttr(row) : '') + '>';
      cols.forEach(function (c) { h += '<td' + (c.r ? ' class="r"' : '') + '>' + (c.cell ? c.cell(row) : escapeHtml(row[c.k])) + '</td>'; });
      h += '</tr>';
    });
    return h + '</tbody></table></div>';
  }

  // charts (inline SVG / css bars, no library)
  function sparkline(vals, o) {
    o = o || {}; var w = o.w || 120, h = o.h || 36, pad = 3;
    var max = Math.max.apply(null, vals) || 1, min = Math.min.apply(null, vals);
    var pts = vals.map(function (v, i) { var x = pad + i * ((w - pad * 2) / (vals.length - 1 || 1)); var y = h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2); return x.toFixed(1) + ',' + y.toFixed(1); });
    return '<svg class="pm-spark" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none"><polyline points="' + pts.join(' ') + '"/></svg>';
  }
  function lineChart(series, key, o) {
    o = o || {}; var w = 560, h = 200, pad = 30;
    var vals = series.map(function (s) { return s[key]; });
    var max = Math.max.apply(null, vals) * 1.1 || 1, min = 0;
    var pts = series.map(function (s, i) { var x = pad + i * ((w - pad * 2) / (series.length - 1 || 1)); var y = h - pad - ((s[key] - min) / (max - min || 1)) * (h - pad * 2); return { x: x, y: y, s: s }; });
    var poly = pts.map(function (p) { return p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' ');
    var area = poly + ' ' + pts[pts.length - 1].x.toFixed(1) + ',' + (h - pad) + ' ' + pad + ',' + (h - pad);
    var svg = '<svg class="pm-line" viewBox="0 0 ' + w + ' ' + h + '" role="img"><line class="ax" x1="' + pad + '" y1="' + (h - pad) + '" x2="' + (w - pad) + '" y2="' + (h - pad) + '"/>'
      + '<polygon class="area" points="' + area + '"/><polyline class="line" points="' + poly + '"/>';
    pts.forEach(function (p, i) { if (i % 2 === 0) svg += '<circle class="dot" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="3"/><text class="lbl" x="' + p.x.toFixed(1) + '" y="' + (h - pad + 14) + '">' + escapeHtml(p.s.month) + '</text>'; });
    return svg + '</svg>';
  }
  function barsH(rows, o) {
    o = o || {}; var max = Math.max.apply(null, rows.map(function (r) { return r.value; })) || 1;
    return '<div class="pm-barsh">' + rows.map(function (r) {
      return '<div class="pm-barh-row"><span class="pm-barh-lbl">' + escapeHtml(r.label) + '</span>'
        + '<span class="pm-barh-track"><span class="pm-barh-fill" style="width:' + Math.max(3, (r.value / max) * 100) + '%;' + (r.color ? 'background:' + r.color : '') + '"></span></span>'
        + '<span class="pm-barh-val">' + (r.display != null ? r.display : r.value) + '</span></div>';
    }).join('') + '</div>';
  }
  function donut(segments, o) {
    o = o || {}; var size = o.size || 132, r = size / 2 - 12, cx = size / 2, cy = size / 2, C = 2 * Math.PI * r;
    var total = segments.reduce(function (a, s) { return a + s.value; }, 0) || 1, off = 0;
    var arcs = segments.map(function (s) { var frac = s.value / total; var dash = frac * C; var el = '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + s.color + '" stroke-width="14" stroke-dasharray="' + dash.toFixed(2) + ' ' + (C - dash).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')"/>'; off += dash; return el; }).join('');
    return '<div class="pm-donut-wrap"><svg class="pm-donut" viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '"><circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="var(--pm-line)" stroke-width="14"/>' + arcs
      + (o.center ? '<text x="' + cx + '" y="' + cy + '" class="pm-donut-c" text-anchor="middle" dominant-baseline="central">' + escapeHtml(o.center) + '</text>' : '') + '</svg>'
      + '<div class="pm-donut-legend">' + segments.map(function (s) { return '<div><i style="background:' + s.color + '"></i>' + escapeHtml(s.label) + ' <b>' + (s.display != null ? s.display : s.value) + '</b></div>'; }).join('') + '</div></div>';
  }

  // ---------- shell ----------
  function mountShell(o) {
    // o: { role, title, nav:[{id,icon,label}], layout:'sidebar'|'mobile', onNav }
    var s = session();
    var body = document.body; body.classList.add('pm', 'pm-role-' + o.role);
    var brand = '<a class="pm-brand" href="index.html"><span class="pm-brand-mark">PM</span><span class="pm-brand-txt">Property Management</span></a>';
    var roleBadge = '<button class="pm-role-badge pm-role-badge--' + o.role + '" id="pm-role-menu">' + escapeHtml(PMApp.ROLE_LABEL[o.role]) + ' <span class="pm-caret">&#9662;</span></button>';
    var bell = '<button class="pm-icon-btn pm-bell" id="pm-bell" aria-label="Notifications">&#128276;<span class="pm-bell-badge" id="pm-bell-badge" hidden>0</span></button>';
    var persona = '<button class="pm-persona" id="pm-persona">' + avatar(s.name, 210, 30) + '<span class="pm-persona-info"><b>' + escapeHtml(s.name) + '</b><small>' + escapeHtml(s.sub || '') + '</small></span></button>';
    var navHtml = o.nav.map(function (n) { return '<a class="pm-nav-item" href="#' + n.id + '" data-nav="' + n.id + '"><span class="pm-nav-ic">' + n.icon + '</span><span class="pm-nav-lb">' + escapeHtml(n.label) + '</span></a>'; }).join('');

    if (o.layout === 'mobile') {
      body.innerHTML = '<div class="pm-app pm-app--mobile">'
        + '<header class="pm-topbar">' + brand + '<div class="pm-topbar-spacer"></div>' + roleBadge + bell + '</header>'
        + '<main class="pm-content" id="pm-content"></main>'
        + '<nav class="pm-bottomnav">' + o.nav.map(function (n) { return '<a href="#' + n.id + '" data-nav="' + n.id + '"><span>' + n.icon + '</span><small>' + escapeHtml(n.label) + '</small></a>'; }).join('') + '</nav>'
        + '</div>';
    } else {
      body.innerHTML = '<div class="pm-app">'
        + '<header class="pm-topbar">' + brand + roleBadge + '<div class="pm-topbar-spacer"></div>' + bell + persona + '</header>'
        + '<aside class="pm-sidenav">' + navHtml + '<div class="pm-sidenav-foot"><button class="pm-btn pm-btn--ghost pm-btn--sm" id="pm-reset">Reset demo</button></div></aside>'
        + '<main class="pm-content" id="pm-content"></main>'
        + '</div>';
    }
    wireBell(o.role, s.id);
    wireRoleMenu(o.role);
    wirePersona(o.role);
    var reset = document.getElementById('pm-reset');
    if (reset) reset.addEventListener('click', function () { api('/reset-demo', { method: 'POST' }).then(function () { location.reload(); }); });
    return document.getElementById('pm-content');
  }
  function setActiveNav(id) { document.querySelectorAll('[data-nav]').forEach(function (a) { a.classList.toggle('is-active', a.getAttribute('data-nav') === id); }); }

  function wireRoleMenu(role) {
    var btn = document.getElementById('pm-role-menu'); if (!btn) return;
    btn.addEventListener('click', function () {
      var items = Object.keys(PMApp.ROLE_PAGE).map(function (r) { return '<a class="pm-menu-item' + (r === role ? ' is-active' : '') + '" href="' + PMApp.ROLE_PAGE[r] + '">' + escapeHtml(PMApp.ROLE_LABEL[r]) + '</a>'; }).join('');
      showModal({ title: 'Switch role', size: 'sm', body: '<div class="pm-menu">' + items + '</div><p class="pm-muted" style="margin-top:10px">Each role is a separate signed-in view of the same portfolio.</p>' });
    });
  }
  function wirePersona(role) {
    var btn = document.getElementById('pm-persona'); if (!btn) return;
    btn.addEventListener('click', function () {
      var list = personas(role).map(function (p) { return '<button class="pm-menu-item" data-persona="' + p.id + '">' + avatar(p.name, 210, 26) + '<span><b>' + escapeHtml(p.name) + '</b><small>' + escapeHtml(p.sub) + '</small></span></button>'; }).join('');
      var mo = showModal({ title: 'Sign in as', size: 'sm', body: '<div class="pm-menu pm-menu--persona">' + list + '</div>' });
      mo.el.querySelectorAll('[data-persona]').forEach(function (b) { b.addEventListener('click', function () { switchPersona(role, b.getAttribute('data-persona')); }); });
    });
  }
  function wireBell(role, id) {
    var btn = document.getElementById('pm-bell'); if (!btn) return;
    function refresh() {
      api('/notifications?role=' + role + (id ? '&id=' + id : '')).then(function (r) {
        var badge = document.getElementById('pm-bell-badge');
        if (badge) { if (r.body.unread > 0) { badge.hidden = false; badge.textContent = r.body.unread; } else badge.hidden = true; }
      });
    }
    btn.addEventListener('click', function () {
      api('/notifications?role=' + role + (id ? '&id=' + id : '')).then(function (r) {
        var items = r.body.items || [];
        var html = items.length ? items.map(function (n) { return '<div class="pm-notif ' + (n.read ? '' : 'is-unread') + '"><b>' + escapeHtml(n.title) + '</b><span>' + escapeHtml(n.body) + '</span><small>' + timeAgo(n.at) + '</small></div>'; }).join('') : empty('No notifications yet.', '&#128276;');
        var mo = showModal({ title: 'Notifications', size: 'sm', body: '<div class="pm-notif-list">' + html + '</div>', foot: '<button class="pm-btn pm-btn--ghost pm-btn--sm" data-markall>Mark all read</button>' });
        mo.el.querySelector('[data-markall]').addEventListener('click', function () { api('/notifications/mark-read', { method: 'POST', body: {} }).then(function () { mo.close(); refresh(); }); });
      });
    });
    refresh();
    window.__pmBellRefresh = refresh;
  }

  window.PMUI = {
    chip: chip, kpi: kpi, avatar: avatar, empty: empty, skeleton: skeleton, table: table,
    sparkline: sparkline, lineChart: lineChart, barsH: barsH, donut: donut,
    mountShell: mountShell, setActiveNav: setActiveNav
  };
})();
