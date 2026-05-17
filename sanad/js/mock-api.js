/* mock-api.js - Sanad fetch interceptor for /sanad/api/*. Serves
   conversations / messages / articles / agents / customers / categories /
   settings / audit from SANAD_DATA + localStorage. All writes are local-only.
   AI calls go to /api/sanad/ai/* and are handled by ai-engine.js (Worker proxy
   with mock fallback) — those bypass this shim. */
(function () {
  'use strict';
  if (!window.SANAD_DATA) { console.error('mock-api: SANAD_DATA not loaded'); return; }

  // ---------- localStorage keys ----------
  var LS = {
    conv_created:   'sanad.conv.created',
    conv_edits:     'sanad.conv.edits',
    conv_deleted:   'sanad.conv.deleted',
    msg_created:    'sanad.msg.created',
    art_created:    'sanad.art.created',
    art_edits:      'sanad.art.edits',
    art_deleted:    'sanad.art.deleted',
    cat_overrides:  'sanad.cat.overrides',
    agent_edits:    'sanad.agent.edits',
    cust_edits:     'sanad.cust.edits',
    settings:       'sanad.settings.overrides',
    audit:          'sanad.audit',
    notifications:  'sanad.notif',
    helpful_votes:  'sanad.kb.votes',
    ai_log_extra:   'sanad.ai.log'
  };
  function jget(k, def) { try { return JSON.parse(localStorage.getItem(k)) || def; } catch (e) { return def; } }
  function jset(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

  // ---------- Merged views ----------
  function conversations() {
    var seed = window.SANAD_DATA.CONVERSATIONS.slice();
    var created = jget(LS.conv_created, []);
    var edits = jget(LS.conv_edits, {});
    var deleted = jget(LS.conv_deleted, []);
    return seed.concat(created).filter(function (c) { return deleted.indexOf(c.id) === -1; })
      .map(function (c) { return edits[c.id] ? Object.assign({}, c, edits[c.id]) : c; });
  }
  function messages() {
    var seed = window.SANAD_DATA.MESSAGES.slice();
    var created = jget(LS.msg_created, []);
    return seed.concat(created);
  }
  function articles() {
    var seed = window.SANAD_DATA.ARTICLES.slice();
    var created = jget(LS.art_created, []);
    var edits = jget(LS.art_edits, {});
    var deleted = jget(LS.art_deleted, []);
    return seed.concat(created).filter(function (a) { return deleted.indexOf(a.id) === -1; })
      .map(function (a) { return edits[a.id] ? Object.assign({}, a, edits[a.id]) : a; });
  }
  function categories() {
    var ov = jget(LS.cat_overrides, { edits: {}, created: [], deleted: [] });
    var seed = window.SANAD_DATA.CATEGORIES.slice();
    return seed.concat(ov.created || []).filter(function (c) { return (ov.deleted || []).indexOf(c.id) === -1; })
      .map(function (c) { return (ov.edits || {})[c.id] ? Object.assign({}, c, ov.edits[c.id]) : c; });
  }
  function agents() {
    var seed = window.SANAD_DATA.AGENTS.slice();
    var edits = jget(LS.agent_edits, {});
    return seed.map(function (a) { return edits[a.id] ? Object.assign({}, a, edits[a.id]) : a; });
  }
  function customers() {
    var seed = window.SANAD_DATA.CUSTOMERS.slice();
    var edits = jget(LS.cust_edits, {});
    return seed.map(function (c) { return edits[c.id] ? Object.assign({}, c, edits[c.id]) : c; });
  }
  function settings() {
    var ov = jget(LS.settings, {});
    return Object.assign({}, window.SANAD_DATA.SETTINGS, ov);
  }
  function aiLogs() {
    return window.SANAD_DATA.AI_LOGS.slice().concat(jget(LS.ai_log_extra, []));
  }

  function audit(action, target, details) {
    var log = jget(LS.audit, []);
    log.unshift({ id: 'a' + Date.now(), when: new Date().toISOString(), actor: 'ag-fatima', action: action, target: target, details: details || '' });
    jset(LS.audit, log.slice(0, 200));
  }

  // ---------- Route handler ----------
  function handle(method, path, body, params) {
    var m;
    body = body || {}; params = params || {};

    /* ===== CONVERSATIONS ===== */
    if (path === '/conversations' && method === 'GET') {
      var rows = conversations();
      if (params.status && params.status !== 'all') rows = rows.filter(function (c) { return c.status === params.status; });
      if (params.assignee === 'me')          rows = rows.filter(function (c) { return c.assignee_id === 'ag-fatima'; });
      if (params.assignee === 'unassigned')  rows = rows.filter(function (c) { return !c.assignee_id; });
      if (params.category) rows = rows.filter(function (c) { return c.category_id === params.category; });
      if (params.q) {
        var q = String(params.q).toLowerCase();
        rows = rows.filter(function (c) { return (c.subject + ' ' + c.preview).toLowerCase().indexOf(q) !== -1; });
      }
      rows.sort(function (a, b) { return new Date(b.last_message_at) - new Date(a.last_message_at); });
      return { ok: true, items: rows };
    }
    if (path === '/conversations' && method === 'POST') {
      // Create from chat-widget handoff or new ticket
      var sess = jget(LS.notifications, []);
      var id = 'cv-' + Date.now();
      var newC = Object.assign({
        id: id,
        status: 'open',
        priority: 'med',
        sentiment: 'neu',
        locale: 'en',
        channel: 'chat',
        assignee_id: null,
        created_at: new Date().toISOString(),
        last_message_at: new Date().toISOString(),
        unread_count: 1,
        closed_at: null,
        preview: (body.first_message || body.subject || '').slice(0, 140)
      }, body);
      delete newC.first_message;
      var cc = jget(LS.conv_created, []); cc.unshift(newC); jset(LS.conv_created, cc);
      // also push the first message if provided
      if (body.first_message) {
        var mc = jget(LS.msg_created, []);
        mc.push({
          id: 'msg-' + id + '-0',
          conversation_id: id,
          author_type: 'customer',
          author_id: body.customer_id || 'cu-1',
          body: body.first_message,
          internal_note: false,
          created_at: new Date().toISOString()
        });
        jset(LS.msg_created, mc);
      }
      audit('conversation.create', id, newC.subject || '');
      return { ok: true, conversation: newC };
    }
    if ((m = path.match(/^\/conversations\/([^\/]+)$/)) && method === 'GET') {
      var c = conversations().find(function (x) { return x.id === m[1]; });
      if (!c) return { ok: false, error: 'not_found', status: 404 };
      var msgs = messages().filter(function (x) { return x.conversation_id === c.id; }).sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); });
      return { ok: true, conversation: c, messages: msgs };
    }
    if ((m = path.match(/^\/conversations\/([^\/]+)$/)) && method === 'PUT') {
      var cid = m[1];
      var ce = jget(LS.conv_edits, {});
      ce[cid] = Object.assign({}, ce[cid] || {}, body);
      jset(LS.conv_edits, ce);
      audit('conversation.update', cid, JSON.stringify(body).slice(0, 80));
      var updated = conversations().find(function (x) { return x.id === cid; });
      return { ok: true, conversation: updated };
    }
    if ((m = path.match(/^\/conversations\/([^\/]+)\/status$/)) && method === 'POST') {
      var ce2 = jget(LS.conv_edits, {});
      ce2[m[1]] = Object.assign({}, ce2[m[1]] || {}, { status: body.status });
      if (body.status === 'closed') ce2[m[1]].closed_at = new Date().toISOString();
      jset(LS.conv_edits, ce2);
      audit('conversation.status', m[1], body.status);
      return { ok: true };
    }
    if ((m = path.match(/^\/conversations\/([^\/]+)\/assign$/)) && method === 'POST') {
      var ce3 = jget(LS.conv_edits, {});
      ce3[m[1]] = Object.assign({}, ce3[m[1]] || {}, { assignee_id: body.assignee_id || null });
      jset(LS.conv_edits, ce3);
      audit('conversation.assign', m[1], body.assignee_id || 'unassigned');
      return { ok: true };
    }
    if ((m = path.match(/^\/conversations\/([^\/]+)\/messages$/)) && method === 'POST') {
      var convId = m[1];
      var mid = 'msg-' + convId + '-' + Date.now();
      var nMsg = {
        id: mid,
        conversation_id: convId,
        author_type: body.author_type || 'agent',
        author_id: body.author_id || 'ag-fatima',
        body: body.body || '',
        internal_note: !!body.internal_note,
        created_at: new Date().toISOString()
      };
      var mc2 = jget(LS.msg_created, []); mc2.push(nMsg); jset(LS.msg_created, mc2);
      // Update conversation last_message_at + status flip from open→pending if agent replied
      var ce4 = jget(LS.conv_edits, {});
      var patch = { last_message_at: nMsg.created_at, unread_count: 0 };
      var cur = conversations().find(function (x) { return x.id === convId; });
      if (cur && nMsg.author_type === 'agent' && !nMsg.internal_note && cur.status === 'open') patch.status = 'pending';
      if (cur && nMsg.author_type === 'customer' && cur.status === 'pending') { patch.status = 'open'; patch.unread_count = 1; }
      patch.preview = nMsg.body.slice(0, 140);
      ce4[convId] = Object.assign({}, ce4[convId] || {}, patch);
      jset(LS.conv_edits, ce4);
      return { ok: true, message: nMsg };
    }

    /* ===== ARTICLES (KB) ===== */
    if (path === '/articles' && method === 'GET') {
      var rows2 = articles();
      if (params.category) rows2 = rows2.filter(function (a) { return a.category_id === params.category; });
      if (params.q) {
        var q2 = String(params.q).toLowerCase();
        rows2 = rows2.filter(function (a) { return (a.title + ' ' + a.body_md).toLowerCase().indexOf(q2) !== -1; });
      }
      rows2.sort(function (a, b) { return new Date(b.published_at) - new Date(a.published_at); });
      return { ok: true, items: rows2 };
    }
    if ((m = path.match(/^\/articles\/([^\/]+)$/)) && method === 'GET') {
      var art = articles().find(function (x) { return x.id === m[1] || x.slug === m[1]; });
      if (!art) return { ok: false, error: 'not_found', status: 404 };
      return { ok: true, article: art };
    }
    if (path === '/articles' && method === 'POST') {
      var aid = 'kb-' + Date.now();
      var nA = Object.assign({
        id: aid,
        slug: (body.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        views: 0, helpful_up: 0, helpful_down: 0,
        published_at: new Date().toISOString(),
        author_id: 'ag-fatima'
      }, body);
      var ac = jget(LS.art_created, []); ac.unshift(nA); jset(LS.art_created, ac);
      audit('article.create', aid, body.title);
      return { ok: true, article: nA };
    }
    if ((m = path.match(/^\/articles\/([^\/]+)$/)) && method === 'PUT') {
      var ae = jget(LS.art_edits, {});
      ae[m[1]] = Object.assign({}, ae[m[1]] || {}, body);
      jset(LS.art_edits, ae);
      audit('article.update', m[1], '');
      return { ok: true };
    }
    if ((m = path.match(/^\/articles\/([^\/]+)$/)) && method === 'DELETE') {
      var ad = jget(LS.art_deleted, []);
      if (ad.indexOf(m[1]) === -1) ad.push(m[1]);
      jset(LS.art_deleted, ad);
      audit('article.delete', m[1], '');
      return { ok: true };
    }
    if ((m = path.match(/^\/articles\/([^\/]+)\/helpful$/)) && method === 'POST') {
      var v = jget(LS.helpful_votes, {});
      v[m[1]] = (v[m[1]] || 0) + (body.up ? 1 : -1);
      jset(LS.helpful_votes, v);
      return { ok: true };
    }

    /* ===== CATEGORIES ===== */
    if (path === '/categories' && method === 'GET') return { ok: true, items: categories() };
    if (path === '/categories' && method === 'POST') {
      var co = jget(LS.cat_overrides, { edits: {}, created: [], deleted: [] });
      if (body.action === 'add')    { co.created = co.created || []; co.created.push(Object.assign({ id: 'cat-' + Date.now(), color: '#94a3b8', icon: '💬' }, body.category)); }
      else if (body.action === 'update') { co.edits = co.edits || {}; co.edits[body.id] = Object.assign({}, co.edits[body.id] || {}, body.changes); }
      else if (body.action === 'remove') { co.deleted = co.deleted || []; if (co.deleted.indexOf(body.id) === -1) co.deleted.push(body.id); }
      jset(LS.cat_overrides, co);
      audit('category.' + body.action, body.id || '', '');
      return { ok: true };
    }

    /* ===== AGENTS / CUSTOMERS ===== */
    if (path === '/agents' && method === 'GET') return { ok: true, items: agents() };
    if ((m = path.match(/^\/agents\/([^\/]+)$/)) && method === 'PUT') {
      var ae2 = jget(LS.agent_edits, {});
      ae2[m[1]] = Object.assign({}, ae2[m[1]] || {}, body);
      jset(LS.agent_edits, ae2);
      audit('agent.update', m[1], '');
      return { ok: true };
    }
    if (path === '/customers' && method === 'GET') {
      var rows3 = customers();
      if (params.q) {
        var q3 = String(params.q).toLowerCase();
        rows3 = rows3.filter(function (c) { return (c.name + ' ' + c.email).toLowerCase().indexOf(q3) !== -1; });
      }
      return { ok: true, items: rows3 };
    }
    if ((m = path.match(/^\/customers\/([^\/]+)$/)) && method === 'GET') {
      var cu = customers().find(function (x) { return x.id === m[1]; });
      if (!cu) return { ok: false, error: 'not_found', status: 404 };
      var convs = conversations().filter(function (c) { return c.customer_id === cu.id; });
      return { ok: true, customer: cu, conversations: convs };
    }

    /* ===== ADMIN ===== */
    if (path === '/admin/dashboard' && method === 'GET') {
      var all = conversations();
      var today = new Date(); today.setHours(0,0,0,0);
      var todayConvs = all.filter(function (c) { return new Date(c.created_at) >= today; });
      var openCount = all.filter(function (c) { return c.status === 'open' || c.status === 'escalated'; }).length;
      var pendingCount = all.filter(function (c) { return c.status === 'pending'; }).length;
      var closedToday = all.filter(function (c) { return c.status === 'closed' && c.closed_at && new Date(c.closed_at) >= today; }).length;
      // AI-resolved: closed without an agent message (mock metric)
      var aiResolvedPct = Math.round(28 + Math.random() * 8);
      var avgFirstMin = 22;
      var sentSplit = { pos: 0, neu: 0, neg: 0 };
      all.forEach(function (c) { sentSplit[c.sentiment] = (sentSplit[c.sentiment] || 0) + 1; });
      var byHour = Array(24).fill(0);
      todayConvs.forEach(function (c) { byHour[new Date(c.created_at).getHours()] += 1; });
      var weekly = [];
      for (var d = 6; d >= 0; d--) {
        var dStart = new Date(); dStart.setDate(dStart.getDate() - d); dStart.setHours(0,0,0,0);
        var dEnd = new Date(dStart); dEnd.setDate(dEnd.getDate() + 1);
        var dayConvs = all.filter(function (c) { var ct = new Date(c.created_at); return ct >= dStart && ct < dEnd; });
        weekly.push({ label: dStart.toLocaleString('en', { weekday: 'short' }), count: dayConvs.length });
      }
      var costToday = aiLogs().filter(function (l) { return new Date(l.at) >= today; }).reduce(function (s, l) { return s + l.cost_usd; }, 0);
      return {
        ok: true,
        kpis: {
          open: openCount,
          pending: pendingCount,
          closed_today: closedToday,
          ai_resolved_pct: aiResolvedPct,
          avg_first_min: avgFirstMin,
          ai_cost_today: +costToday.toFixed(3)
        },
        sentiment: sentSplit,
        by_hour: byHour,
        weekly: weekly,
        recent: all.slice().sort(function (a, b) { return new Date(b.last_message_at) - new Date(a.last_message_at); }).slice(0, 8)
      };
    }

    /* ===== SETTINGS / AUDIT / AI LOGS ===== */
    if (path === '/admin/settings' && method === 'GET') return { ok: true, settings: settings() };
    if (path === '/admin/settings' && method === 'POST') {
      var so = jget(LS.settings, {});
      jset(LS.settings, Object.assign({}, so, body));
      audit('settings.update', '', JSON.stringify(body).slice(0, 80));
      return { ok: true };
    }
    if (path === '/admin/audit' && method === 'GET') return { ok: true, items: jget(LS.audit, []) };
    if (path === '/admin/ai-logs' && method === 'GET') {
      var rows4 = aiLogs().slice().sort(function (a, b) { return new Date(b.at) - new Date(a.at); });
      if (params.limit) rows4 = rows4.slice(0, +params.limit);
      return { ok: true, items: rows4 };
    }
    if (path === '/admin/ai-logs' && method === 'POST') {
      // Used by ai-engine.js to log a call. Persists in localStorage.
      var ex = jget(LS.ai_log_extra, []);
      ex.unshift(Object.assign({ id: 'ail-' + Date.now(), at: new Date().toISOString() }, body));
      jset(LS.ai_log_extra, ex.slice(0, 100));
      return { ok: true };
    }
    if (path === '/admin/ai-logs/rate' && method === 'POST') {
      // 👍/👎 feedback on an AI suggestion. Logged as its own entry so the
      // analytics tab can compute a satisfaction rate per feature/model.
      var rx = jget(LS.ai_log_extra, []);
      rx.unshift({
        id: 'air-' + Date.now(),
        at: body.at || new Date().toISOString(),
        feature: body.feature || 'reply',
        model: body.model || 'unknown',
        rating: body.rating,
        fallback: !!body.fallback,
        kind: 'rating'
      });
      jset(LS.ai_log_extra, rx.slice(0, 200));
      audit('ai.rate', body.feature || 'reply', body.rating);
      return { ok: true };
    }
    if (path === '/integrations' && method === 'GET') return { ok: true, items: window.SANAD_DATA.INTEGRATIONS };

    if (path === '/admin/reset-demo' && method === 'POST') {
      Object.keys(LS).forEach(function (k) { localStorage.removeItem(LS[k]); });
      return { ok: true };
    }

    return { ok: false, error: 'unknown_route', status: 404 };
  }

  // ---------- Fetch intercept ----------
  var origFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var idx = url.indexOf('/sanad/api');
    // /api/sanad/ai/* is handled by the Worker / ai-engine; pass through.
    if (idx === -1 || url.indexOf('/api/sanad/ai/') !== -1)
      return origFetch ? origFetch(input, init) : Promise.reject(new Error('no fetch'));
    init = init || {};
    var method = (init.method || 'GET').toUpperCase();
    var pathAndQuery = url.slice(idx + '/sanad/api'.length).split('?');
    var path = pathAndQuery[0] || '/';
    var params = {};
    if (pathAndQuery[1]) pathAndQuery[1].split('&').forEach(function (kv) { var p = kv.split('='); params[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ''); });
    var body = {};
    if (init.body) { try { body = JSON.parse(init.body); } catch (e) { body = {}; } }
    var res = handle(method, path, body, params);
    return Promise.resolve({
      ok: !!res.ok, status: res.status || (res.ok ? 200 : 400),
      json: function () { return Promise.resolve(res); }
    });
  };

  console.log('Sanad mock-api ready - /sanad/api/* intercepted');
})();
