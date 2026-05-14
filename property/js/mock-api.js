/* mock-api.js — Intercepts fetch to /property/api/* and serves from MANZIL_DATA + localStorage.
   Implements the full Manzil API surface (customer + admin). All writes are local-only. */
(function () {
  'use strict';

  if (!window.MANZIL_DATA) {
    console.error('mock-api: MANZIL_DATA not loaded — include data.js first');
    return;
  }

  // ---------- localStorage keys ----------
  var LS = {
    user:               'manzil.user',
    favorites:          'manzil.favorites',
    compare:            'manzil.compare',
    saved_searches:     'manzil.saved_searches',
    mortgage_scenarios: 'manzil.mortgage_scenarios',
    inquiries_created:  'manzil.inquiries.created',
    inquiries_status:   'manzil.inquiries.status',
    inquiries_notes:    'manzil.inquiries.notes',
    inquiries_assign:   'manzil.inquiries.assign',
    inquiries_score:    'manzil.inquiries.score',
    inquiries_history:  'manzil.inquiries.history',
    viewings_created:   'manzil.viewings.created',
    viewings_status:    'manzil.viewings.status',
    listings_created:   'manzil.listings.created',
    listings_edits:     'manzil.listings.edits',
    listings_deleted:   'manzil.listings.deleted',
    agents_created:     'manzil.agents.created',
    agents_edits:       'manzil.agents.edits',
    agents_deleted:     'manzil.agents.deleted',
    agencies_created:   'manzil.agencies.created',
    agencies_edits:     'manzil.agencies.edits',
    agencies_deleted:   'manzil.agencies.deleted',
    customers_edits:    'manzil.customers.edits',
    promotions:         'manzil.promotions',
    banners:            'manzil.banners',
    content_areas:      'manzil.content.areas',
    moderation:         'manzil.moderation',
    settings:           'manzil.settings.overrides',
    audit:              'manzil.audit'
  };

  function jget(k, def) { try { return JSON.parse(localStorage.getItem(k)) || def; } catch (e) { return def; } }
  function jset(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

  // ---------- Initial demo user ----------
  function getUser() {
    var u = jget(LS.user, null);
    if (!u) {
      u = window.MANZIL_DATA.CUSTOMERS[0]; // Demo Customer
      jset(LS.user, u);
    }
    return u;
  }

  // ---------- Merged view of collections (seed + overrides) ----------
  function listings() {
    var seed = window.MANZIL_DATA.LISTINGS.slice();
    var created = jget(LS.listings_created, []);
    var edits = jget(LS.listings_edits, {});
    var deleted = jget(LS.listings_deleted, []);
    var merged = seed.concat(created).filter(function (l) { return deleted.indexOf(l.id) === -1; });
    return merged.map(function (l) { return edits[l.id] ? Object.assign({}, l, edits[l.id]) : l; });
  }
  function agents() {
    var seed = window.MANZIL_DATA.AGENTS.slice();
    var created = jget(LS.agents_created, []);
    var edits = jget(LS.agents_edits, {});
    var deleted = jget(LS.agents_deleted, []);
    return seed.concat(created).filter(function (a) { return deleted.indexOf(a.id) === -1; })
      .map(function (a) { return edits[a.id] ? Object.assign({}, a, edits[a.id]) : a; });
  }
  function agencies() {
    var seed = window.MANZIL_DATA.AGENCIES.slice();
    var created = jget(LS.agencies_created, []);
    var edits = jget(LS.agencies_edits, {});
    var deleted = jget(LS.agencies_deleted, []);
    return seed.concat(created).filter(function (g) { return deleted.indexOf(g.id) === -1; })
      .map(function (g) { return edits[g.id] ? Object.assign({}, g, edits[g.id]) : g; });
  }
  function inquiries() {
    var seed = window.MANZIL_DATA.INQUIRIES.slice();
    var created = jget(LS.inquiries_created, []);
    var status = jget(LS.inquiries_status, {});
    var notes  = jget(LS.inquiries_notes, {});
    var assign = jget(LS.inquiries_assign, {});
    var score  = jget(LS.inquiries_score, {});
    var hist   = jget(LS.inquiries_history, {});
    return seed.concat(created).map(function (q) {
      var copy = Object.assign({}, q);
      if (status[q.id]) copy.status = status[q.id];
      if (notes[q.id])  copy.notes  = (q.notes || []).concat(notes[q.id]);
      if (assign[q.id]) copy.agent_id = assign[q.id];
      copy.lead_score = score[q.id] != null ? score[q.id] : (q.lead_score != null ? q.lead_score : computeAutoScore(copy));
      copy.history = hist[q.id] || [];
      return copy;
    });
  }
  // Heuristic auto-score for inquiries that haven't been manually scored.
  // 1 = cold, 5 = hot. Looks at status + how recent + whether they sent a viewing.
  function computeAutoScore(q) {
    var s = 3;
    if (q.kind === 'viewing') s += 1;
    if (q.status === 'scheduled' || q.status === 'negotiating') s += 1;
    if (q.status === 'won') s = 5;
    if (q.status === 'lost') s = 1;
    var ageDays = (Date.now() - new Date(q.created_at).getTime()) / 86400000;
    if (ageDays > 30) s -= 1;
    return Math.max(1, Math.min(5, s));
  }
  function viewings() {
    var seed = window.MANZIL_DATA.VIEWINGS.slice();
    var created = jget(LS.viewings_created, []);
    var status = jget(LS.viewings_status, {});
    return seed.concat(created).map(function (v) {
      var copy = Object.assign({}, v);
      if (status[v.id]) copy.status = status[v.id];
      return copy;
    });
  }
  function customers() {
    var seed = window.MANZIL_DATA.CUSTOMERS.slice();
    var edits = jget(LS.customers_edits, {});
    return seed.map(function (c) { return edits[c.id] ? Object.assign({}, c, edits[c.id]) : c; });
  }

  // ---------- Audit log helper ----------
  function audit(action, target, details) {
    var log = jget(LS.audit, []);
    log.unshift({ id: 'AU' + Date.now(), action: action, target: target, details: details || '', when: new Date().toISOString(), actor: getUser().name || 'Demo Admin' });
    jset(LS.audit, log.slice(0, 200));
  }

  // ---------- Filtering helpers ----------
  function filterListings(params) {
    var rows = listings();
    if (params.q) {
      var q = String(params.q).toLowerCase();
      rows = rows.filter(function (l) { return (l.title + ' ' + (l.address || '') + ' ' + l.type).toLowerCase().indexOf(q) !== -1; });
    }
    if (params.transaction) rows = rows.filter(function (l) { return l.transaction === params.transaction; });
    if (params.type)        rows = rows.filter(function (l) { return l.type === params.type; });
    if (params.area)        rows = rows.filter(function (l) { return l.area_id === params.area; });
    if (params.beds) {
      var b = params.beds;
      rows = rows.filter(function (l) {
        if (b === 'studio') return l.beds === 0;
        if (b === '4+')     return l.beds >= 4;
        return l.beds === Number(b);
      });
    }
    if (params.baths)         rows = rows.filter(function (l) { return l.baths >= Number(params.baths); });
    if (params.price_min)     rows = rows.filter(function (l) { return l.price_aed >= Number(params.price_min); });
    if (params.price_max)     rows = rows.filter(function (l) { return l.price_aed <= Number(params.price_max); });
    if (params.sqft_min)      rows = rows.filter(function (l) { return l.sqft >= Number(params.sqft_min); });
    if (params.sqft_max)      rows = rows.filter(function (l) { return l.sqft <= Number(params.sqft_max); });
    if (params.furnished === 'true')  rows = rows.filter(function (l) { return !!l.furnished; });
    if (params.furnished === 'false') rows = rows.filter(function (l) { return !l.furnished; });
    if (params.completion)    rows = rows.filter(function (l) { return l.completion_status === params.completion; });
    if (params.verified === 'true') rows = rows.filter(function (l) { return l.verified; });
    if (params.amenities) {
      var list = String(params.amenities).split(',').filter(Boolean);
      if (list.length) rows = rows.filter(function (l) { return list.every(function (a) { return (l.amenities || []).indexOf(a) !== -1; }); });
    }
    if (params.posted) {
      var days = ({ '1d': 1, '7d': 7, '30d': 30 })[params.posted];
      if (days) rows = rows.filter(function (l) { return (Date.now() - new Date(l.listed_at).getTime()) <= days * 86400000; });
    }
    if (params.status) rows = rows.filter(function (l) { return l.status === params.status; });
    else rows = rows.filter(function (l) { return l.status === 'active'; });

    // Sort
    var sort = params.sort || 'featured';
    if (sort === 'newest')    rows.sort(function (a, b) { return new Date(b.listed_at) - new Date(a.listed_at); });
    else if (sort === 'price_asc')  rows.sort(function (a, b) { return a.price_aed - b.price_aed; });
    else if (sort === 'price_desc') rows.sort(function (a, b) { return b.price_aed - a.price_aed; });
    else if (sort === 'featured')   rows.sort(function (a, b) { return (b.featured ? 1 : 0) - (a.featured ? 1 : 0); });
    return rows;
  }

  // ---------- Route handler ----------
  function handle(method, path, body, params) {
    // -------- Auth / account --------
    if (path === '/account') return { ok: true, user: getUser() };
    if (path === '/auth/login') { jset(LS.user, body.user || getUser()); return { ok: true }; }
    if (path === '/auth/logout') { localStorage.removeItem(LS.user); return { ok: true }; }

    // -------- Listings public --------
    if (path === '/listings') {
      var rows = filterListings(params || {});
      var page = Math.max(1, Number(params.page || 1));
      var size = Math.max(1, Number(params.page_size || 12));
      var total = rows.length;
      var paged = rows.slice((page - 1) * size, page * size);
      return { ok: true, total: total, page: page, page_size: size, items: paged };
    }
    if (path === '/listings/featured') {
      return { ok: true, items: listings().filter(function (l) { return l.featured && l.status === 'active'; }).slice(0, 8) };
    }
    if (path === '/listings/trending') {
      return { ok: true, items: listings().filter(function (l) { return l.premium && l.status === 'active'; }).slice(0, 6) };
    }
    if (path === '/listings/recent') {
      return { ok: true, items: listings().filter(function (l) { return l.status === 'active'; }).sort(function (a, b) { return new Date(b.listed_at) - new Date(a.listed_at); }).slice(0, 8) };
    }
    var m;
    if (m = path.match(/^\/listings\/([^\/]+)$/)) {
      var key = m[1];
      var l = listings().find(function (x) { return x.id === key || x.slug === key; });
      if (!l) return { ok: false, error: 'not_found' };
      var similar = listings().filter(function (x) { return x.id !== l.id && x.area_id === l.area_id && x.status === 'active'; }).slice(0, 4);
      return { ok: true, listing: l, similar: similar };
    }

    // -------- Areas --------
    if (path === '/areas') return { ok: true, items: window.MANZIL_DATA.AREAS };
    if (m = path.match(/^\/areas\/([^\/]+)$/)) {
      var a = window.MANZIL_DATA.AREAS.find(function (x) { return x.slug === m[1] || x.id === m[1]; });
      if (!a) return { ok: false, error: 'not_found' };
      var top = listings().filter(function (l) { return l.area_id === a.id && l.status === 'active'; }).slice(0, 8);
      return { ok: true, area: a, top_listings: top };
    }

    // -------- Agents / agencies --------
    if (path === '/agents') return { ok: true, items: agents() };
    if (m = path.match(/^\/agents\/([^\/]+)$/)) {
      var ag = agents().find(function (x) { return x.id === m[1]; });
      if (!ag) return { ok: false, error: 'not_found' };
      var agLst = listings().filter(function (l) { return l.agent_id === ag.id && l.status === 'active'; });
      var agRev = window.MANZIL_DATA.REVIEWS.filter(function (r) { return r.agent_id === ag.id; });
      return { ok: true, agent: ag, listings: agLst, reviews: agRev };
    }
    if (path === '/agencies') return { ok: true, items: agencies() };
    if (m = path.match(/^\/agencies\/([^\/]+)$/)) {
      var g = agencies().find(function (x) { return x.id === m[1]; });
      if (!g) return { ok: false, error: 'not_found' };
      var gAgents = agents().filter(function (x) { return x.agency_id === g.id; });
      var gLst = listings().filter(function (l) { return l.agency_id === g.id && l.status === 'active'; });
      return { ok: true, agency: g, agents: gAgents, listings: gLst };
    }

    // -------- Favorites --------
    if (path === '/favorites' && method === 'GET') {
      var ids = jget(LS.favorites, []);
      return { ok: true, items: listings().filter(function (l) { return ids.indexOf(l.id) !== -1; }) };
    }
    if (path === '/favorites' && method === 'POST') {
      var ids2 = jget(LS.favorites, []);
      if (body.action === 'add' && ids2.indexOf(body.id) === -1) ids2.push(body.id);
      else if (body.action === 'remove') ids2 = ids2.filter(function (x) { return x !== body.id; });
      jset(LS.favorites, ids2);
      return { ok: true, items: ids2 };
    }

    // -------- Saved searches --------
    if (path === '/saved-searches' && method === 'GET') {
      return { ok: true, items: jget(LS.saved_searches, []) };
    }
    if (path === '/saved-searches' && method === 'POST') {
      var ss = jget(LS.saved_searches, []);
      if (body.action === 'add') ss.unshift({ id: 's' + Date.now(), q: body.q, params: body.params || {}, when: new Date().toISOString(), alerts: !!body.alerts });
      else if (body.action === 'remove') ss = ss.filter(function (x) { return x.id !== body.id; });
      else if (body.action === 'toggle_alert') ss = ss.map(function (x) { return x.id === body.id ? Object.assign({}, x, { alerts: !x.alerts }) : x; });
      jset(LS.saved_searches, ss);
      return { ok: true, items: ss };
    }

    // -------- Compare --------
    if (path === '/compare' && method === 'GET') {
      var ids3 = jget('manzil.compare', []);
      return { ok: true, items: listings().filter(function (l) { return ids3.indexOf(l.id) !== -1; }) };
    }
    if (path === '/compare' && method === 'POST') {
      var ids4 = jget('manzil.compare', []);
      if (body.action === 'add' && ids4.length < 3 && ids4.indexOf(body.id) === -1) ids4.push(body.id);
      else if (body.action === 'remove') ids4 = ids4.filter(function (x) { return x !== body.id; });
      else if (body.action === 'clear') ids4 = [];
      jset('manzil.compare', ids4);
      return { ok: true, items: ids4 };
    }

    // -------- Mortgage scenarios --------
    if (path === '/mortgage-scenarios' && method === 'GET') {
      return { ok: true, items: jget(LS.mortgage_scenarios, []) };
    }
    if (path === '/mortgage-scenarios' && method === 'POST') {
      var ms = jget(LS.mortgage_scenarios, []);
      if (body.action === 'add') ms.unshift({ id: 'm' + Date.now(), label: body.label || 'Scenario', price: body.price, down: body.down, rate: body.rate, years: body.years, when: new Date().toISOString() });
      else if (body.action === 'remove') ms = ms.filter(function (x) { return x.id !== body.id; });
      jset(LS.mortgage_scenarios, ms);
      return { ok: true, items: ms };
    }

    // -------- Inquiries / Viewings (customer side) --------
    if (path === '/inquiries' && method === 'POST') {
      var iq = Object.assign({}, body, {
        id: 'I' + Date.now(),
        customer_id: getUser().id, status: 'new',
        messages: [{ from: 'customer', body: body.message || 'Interested in this property.', when: new Date().toISOString() }],
        notes: [], created_at: new Date().toISOString()
      });
      var ic = jget(LS.inquiries_created, []);
      ic.unshift(iq); jset(LS.inquiries_created, ic);
      audit('inquiry.create', iq.id, body.kind);
      return { ok: true, inquiry: iq };
    }
    if (path === '/viewings' && method === 'POST') {
      var vw = Object.assign({}, body, {
        id: 'V' + Date.now(),
        customer_id: getUser().id, status: 'pending',
        duration_min: 30, notes: '', created_at: new Date().toISOString()
      });
      var vc = jget(LS.viewings_created, []);
      vc.unshift(vw); jset(LS.viewings_created, vc);
      // Also create a parallel inquiry
      var iq2 = { id: 'I' + Date.now(), listing_id: body.listing_id, agent_id: body.agent_id, customer_id: getUser().id, status: 'scheduled', kind: 'viewing', name: getUser().name, email: getUser().email, phone: body.phone, message: 'Viewing scheduled', messages: [], notes: [], created_at: new Date().toISOString() };
      var ic2 = jget(LS.inquiries_created, []); ic2.unshift(iq2); jset(LS.inquiries_created, ic2);
      audit('viewing.create', vw.id, body.scheduled_at);
      return { ok: true, viewing: vw };
    }
    if (path === '/inquiries' && method === 'GET') {
      var u = getUser();
      var mine = inquiries().filter(function (q) { return q.customer_id === u.id; });
      return { ok: true, items: mine };
    }
    if (path === '/viewings' && method === 'GET') {
      var u2 = getUser();
      var mine2 = viewings().filter(function (v) { return v.customer_id === u2.id; });
      return { ok: true, items: mine2 };
    }

    // -------- Notifications --------
    if (path === '/notifications' && method === 'GET') {
      return { ok: true, items: JSON.parse(localStorage.getItem('manzil.notifications') || '[]') };
    }
    if (path === '/notifications' && method === 'POST') {
      if (body.action === 'mark_all_read') {
        var list = JSON.parse(localStorage.getItem('manzil.notifications') || '[]').map(function (n) { n.unread = false; return n; });
        localStorage.setItem('manzil.notifications', JSON.stringify(list));
      } else if (body.action === 'push') {
        var list2 = JSON.parse(localStorage.getItem('manzil.notifications') || '[]');
        list2.unshift({ id: 'n' + Date.now(), title: body.title, body: body.body, when: Date.now(), unread: true });
        localStorage.setItem('manzil.notifications', JSON.stringify(list2.slice(0, 30)));
      }
      return { ok: true };
    }

    // ================== ADMIN ==================

    // -------- Dashboard --------
    if (path === '/admin/dashboard') {
      var all = listings();
      var active = all.filter(function (l) { return l.status === 'active'; });
      var iqs = inquiries();
      var newLeads = iqs.filter(function (q) { return q.status === 'new'; });
      var last7 = iqs.filter(function (q) { return (Date.now() - new Date(q.created_at).getTime()) < 7 * 86400000; });
      var byStatus = {};
      iqs.forEach(function (q) { byStatus[q.status] = (byStatus[q.status] || 0) + 1; });
      // Mock monthly views
      var monthly = [];
      for (var i = 11; i >= 0; i--) {
        var d = new Date(); d.setMonth(d.getMonth() - i);
        var label = d.toLocaleString('en', { month: 'short' });
        monthly.push({ label: label, views: 8000 + ((i * 1737) % 5000), leads: 80 + ((i * 41) % 60) });
      }
      // Conversion: leads / views * 100
      var totalViews = monthly.reduce(function (s, m) { return s + m.views; }, 0);
      var totalLeads = monthly.reduce(function (s, m) { return s + m.leads; }, 0);
      var conv = ((totalLeads / totalViews) * 100).toFixed(2);
      var top = active.slice().sort(function (a, b) { return b.price_aed - a.price_aed; }).slice(0, 5);
      var recent = iqs.slice().sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); }).slice(0, 6);
      var expiring = all.filter(function (l) { return l.status === 'active' && (Date.now() - new Date(l.listed_at).getTime()) > 60 * 86400000; }).slice(0, 5);
      return {
        ok: true,
        kpis: {
          active_listings: active.length,
          new_leads_7d: last7.length,
          monthly_views: monthly[monthly.length - 1].views,
          conversion_pct: conv
        },
        monthly: monthly,
        by_status: byStatus,
        top_listings: top,
        recent_inquiries: recent,
        expiring: expiring,
        alerts: [
          { kind: 'verify', msg: '3 agents requested verification', count: 3 },
          { kind: 'report', msg: '2 listings reported by users', count: 2 },
          { kind: 'expire', msg: expiring.length + ' listings near expiry', count: expiring.length }
        ]
      };
    }

    // -------- Listings admin CRUD --------
    if (path === '/admin/listings' && method === 'GET') {
      var rows = listings();
      if (params.status) rows = rows.filter(function (l) { return l.status === params.status; });
      if (params.q) {
        var q = String(params.q).toLowerCase();
        rows = rows.filter(function (l) { return (l.title + ' ' + l.address).toLowerCase().indexOf(q) !== -1; });
      }
      return { ok: true, items: rows };
    }
    if (path === '/admin/listings' && method === 'POST') {
      var nid = 'L' + Date.now();
      var spec = Object.assign({
        id: nid, slug: (body.title || 'new').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) + '-' + nid.slice(-4),
        photos: (body.photos && body.photos.length) ? body.photos : [window.MANZIL_DATA.PHOTO_POOL[0]],
        listed_at: new Date().toISOString(), status: body.status || 'active',
        featured: !!body.featured, verified: body.verified !== false, premium: !!body.premium,
        transaction: body.transaction || 'buy', completion_status: body.completion_status || 'ready',
        title_ar: body.title, description_ar: body.description,
        amenities: body.amenities || []
      }, body);
      var lc = jget(LS.listings_created, []); lc.unshift(spec); jset(LS.listings_created, lc);
      audit('listing.create', nid, body.title);
      return { ok: true, listing: spec };
    }
    if (m = path.match(/^\/admin\/listings\/([^\/]+)$/)) {
      if (method === 'GET') {
        var l = listings().find(function (x) { return x.id === m[1]; });
        return l ? { ok: true, listing: l } : { ok: false, error: 'not_found' };
      }
      if (method === 'PUT') {
        var edits = jget(LS.listings_edits, {});
        edits[m[1]] = Object.assign({}, edits[m[1]] || {}, body);
        jset(LS.listings_edits, edits);
        audit('listing.update', m[1], '');
        return { ok: true };
      }
      if (method === 'DELETE') {
        var del = jget(LS.listings_deleted, []);
        if (del.indexOf(m[1]) === -1) del.push(m[1]);
        jset(LS.listings_deleted, del);
        audit('listing.delete', m[1], '');
        return { ok: true };
      }
    }
    if (path === '/admin/listings/bulk' && method === 'POST') {
      var ids = body.ids || [];
      var op = body.op;
      var edits2 = jget(LS.listings_edits, {});
      var del2 = jget(LS.listings_deleted, []);
      ids.forEach(function (id) {
        if (op === 'delete') { if (del2.indexOf(id) === -1) del2.push(id); }
        else {
          edits2[id] = edits2[id] || {};
          if (op === 'publish')   edits2[id].status = 'active';
          if (op === 'unpublish') edits2[id].status = 'draft';
          if (op === 'feature')   edits2[id].featured = true;
          if (op === 'unfeature') edits2[id].featured = false;
          if (op === 'verify')    edits2[id].verified = true;
          if (op === 'unverify')  edits2[id].verified = false;
        }
      });
      jset(LS.listings_edits, edits2);
      jset(LS.listings_deleted, del2);
      audit('listing.bulk', op, ids.length + ' listings');
      return { ok: true };
    }

    // -------- Inquiries admin --------
    if (path === '/admin/inquiries' && method === 'GET') {
      var rows = inquiries();
      if (params.status) rows = rows.filter(function (q) { return q.status === params.status; });
      rows.sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
      return { ok: true, items: rows };
    }
    if (m = path.match(/^\/admin\/inquiries\/([^\/]+)$/) && method === 'PUT') {
      var status = jget(LS.inquiries_status, {});
      var notes  = jget(LS.inquiries_notes, {});
      var assign = jget(LS.inquiries_assign, {});
      var score  = jget(LS.inquiries_score, {});
      var hist   = jget(LS.inquiries_history, {});
      hist[m[1]] = hist[m[1]] || [];
      var now = new Date().toISOString();
      if (body.status)  {
        var prev = status[m[1]];
        status[m[1]] = body.status;
        hist[m[1]].push({ kind: 'status_change', from: prev || 'new', to: body.status, when: now });
      }
      if (body.note)    {
        notes[m[1]] = notes[m[1]] || []; notes[m[1]].push({ author: 'admin', body: body.note, when: now });
        hist[m[1]].push({ kind: 'note', body: body.note, when: now });
      }
      if (body.agent_id) {
        assign[m[1]] = body.agent_id;
        hist[m[1]].push({ kind: 'assign', agent_id: body.agent_id, when: now });
      }
      if (body.lead_score != null) {
        score[m[1]] = Number(body.lead_score);
        hist[m[1]].push({ kind: 'score', value: Number(body.lead_score), when: now });
      }
      jset(LS.inquiries_status, status); jset(LS.inquiries_notes, notes); jset(LS.inquiries_assign, assign);
      jset(LS.inquiries_score, score); jset(LS.inquiries_history, hist);
      audit('inquiry.update', m[1], JSON.stringify(body));
      return { ok: true };
    }

    // -------- Viewings admin --------
    if (path === '/admin/viewings' && method === 'GET') {
      var rows = viewings();
      if (params.status) rows = rows.filter(function (v) { return v.status === params.status; });
      rows.sort(function (a, b) { return new Date(a.scheduled_at) - new Date(b.scheduled_at); });
      return { ok: true, items: rows };
    }
    if (m = path.match(/^\/admin\/viewings\/([^\/]+)$/) && method === 'PUT') {
      var st = jget(LS.viewings_status, {});
      st[m[1]] = body.status;
      jset(LS.viewings_status, st);
      audit('viewing.update', m[1], body.status);
      return { ok: true };
    }

    // -------- Agents admin --------
    if (path === '/admin/agents' && method === 'GET') {
      return { ok: true, items: agents() };
    }
    if (path === '/admin/agents' && method === 'POST') {
      var aid = 'ag' + Date.now();
      var nag = Object.assign({
        id: aid, photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80&auto=format&fit=crop&crop=faces',
        languages: ['English'], specialisation: 'Residential', years_exp: 1, rating: 4.5, deals_closed: 0,
        phone: '', email: '', whatsapp: '', bio: ''
      }, body);
      var ac = jget(LS.agents_created, []); ac.unshift(nag); jset(LS.agents_created, ac);
      audit('agent.create', aid, body.name);
      return { ok: true, agent: nag };
    }
    if (m = path.match(/^\/admin\/agents\/([^\/]+)$/)) {
      if (method === 'GET') {
        var ag = agents().find(function (x) { return x.id === m[1]; });
        return ag ? { ok: true, agent: ag } : { ok: false };
      }
      if (method === 'PUT') {
        var e = jget(LS.agents_edits, {});
        e[m[1]] = Object.assign({}, e[m[1]] || {}, body);
        jset(LS.agents_edits, e);
        audit('agent.update', m[1], '');
        return { ok: true };
      }
      if (method === 'DELETE') {
        var d = jget(LS.agents_deleted, []);
        if (d.indexOf(m[1]) === -1) d.push(m[1]);
        jset(LS.agents_deleted, d);
        audit('agent.delete', m[1], '');
        return { ok: true };
      }
    }

    // -------- Agencies admin --------
    if (path === '/admin/agencies' && method === 'GET') {
      return { ok: true, items: agencies() };
    }
    if (path === '/admin/agencies' && method === 'POST') {
      var gid = 'g-' + Date.now();
      var ng = Object.assign({ id: gid, license_no: 'RERA-' + Date.now().toString().slice(-4), founded: new Date().getFullYear(), specialties: [], agents_ids: [] }, body);
      var gc = jget(LS.agencies_created, []); gc.unshift(ng); jset(LS.agencies_created, gc);
      audit('agency.create', gid, body.name);
      return { ok: true, agency: ng };
    }
    if (m = path.match(/^\/admin\/agencies\/([^\/]+)$/)) {
      if (method === 'PUT') {
        var ge = jget(LS.agencies_edits, {});
        ge[m[1]] = Object.assign({}, ge[m[1]] || {}, body);
        jset(LS.agencies_edits, ge);
        audit('agency.update', m[1], '');
        return { ok: true };
      }
      if (method === 'DELETE') {
        var gd = jget(LS.agencies_deleted, []);
        if (gd.indexOf(m[1]) === -1) gd.push(m[1]);
        jset(LS.agencies_deleted, gd);
        audit('agency.delete', m[1], '');
        return { ok: true };
      }
    }

    // -------- Customers admin --------
    if (path === '/admin/customers' && method === 'GET') {
      return { ok: true, items: customers().map(function (c) {
        var iqCount = inquiries().filter(function (q) { return q.customer_id === c.id; }).length;
        return Object.assign({}, c, { inquiries_count: iqCount });
      }) };
    }
    if (m = path.match(/^\/admin\/customers\/([^\/]+)$/) && method === 'PUT') {
      var ce = jget(LS.customers_edits, {});
      ce[m[1]] = Object.assign({}, ce[m[1]] || {}, body);
      jset(LS.customers_edits, ce);
      audit('customer.update', m[1], '');
      return { ok: true };
    }

    // -------- Analytics --------
    if (path === '/admin/analytics') {
      var areaStats = window.MANZIL_DATA.AREAS.map(function (a) {
        var lst = listings().filter(function (l) { return l.area_id === a.id && l.status === 'active'; });
        var avg = lst.length ? Math.round(lst.reduce(function (s, l) { return s + (l.price_aed / l.sqft); }, 0) / lst.length) : 0;
        return { area: a.name, listings: lst.length, avg_aed_sqft: avg };
      }).sort(function (a, b) { return b.listings - a.listings; });
      var sources = [
        { source: 'Organic search', leads: 132 },
        { source: 'Featured listings', leads: 88 },
        { source: 'Saved-search alerts', leads: 54 },
        { source: 'Agent direct', leads: 41 },
        { source: 'Newsletter', leads: 23 }
      ];
      var funnel = [
        { step: 'Impressions',  v: 124000 },
        { step: 'Listing views', v: 28400 },
        { step: 'Inquiries',     v: 1640 },
        { step: 'Viewings',      v: 412 },
        { step: 'Closed',        v: 78 }
      ];
      var trend = [];
      for (var i = 29; i >= 0; i--) {
        trend.push({ day: i, views: 800 + ((i * 173) % 600) });
      }
      return { ok: true, views_trend: trend, leads_by_source: sources, top_areas: areaStats.slice(0, 10), funnel: funnel };
    }

    // -------- Promotions / Banners --------
    if (path === '/admin/promotions' && method === 'GET') {
      var promos = jget(LS.promotions, [
        { id: 'p1', name: 'Featured Marina collection', listings: ['L001','L002','L003'], active: true, starts: '2026-05-01', ends: '2026-06-30' },
        { id: 'p2', name: 'Off-plan Q4 push',           listings: [], active: false, starts: '2026-09-01', ends: '2026-12-31' }
      ]);
      jset(LS.promotions, promos);
      return { ok: true, items: promos };
    }
    if (path === '/admin/promotions' && method === 'POST') {
      var pr = jget(LS.promotions, []);
      if (body.action === 'add') pr.unshift({ id: 'p' + Date.now(), name: body.name, listings: body.listings || [], active: !!body.active, starts: body.starts, ends: body.ends });
      else if (body.action === 'toggle') pr = pr.map(function (p) { return p.id === body.id ? Object.assign({}, p, { active: !p.active }) : p; });
      else if (body.action === 'remove') pr = pr.filter(function (p) { return p.id !== body.id; });
      jset(LS.promotions, pr);
      audit('promotion', body.action, body.name || body.id);
      return { ok: true, items: pr };
    }
    if (path === '/admin/banners' && method === 'GET') {
      var bn = jget(LS.banners, [
        { id: 'b1', title: 'Discover Palm Jumeirah', subtitle: 'Beachfront villas from AED 15M', cta: 'Explore', url: 'areas.html?slug=palm-jumeirah', active: true },
        { id: 'b2', title: 'Off-plan handover Q4',   subtitle: 'Lock in pre-launch prices',     cta: 'Browse',  url: 'search.html?transaction=off-plan', active: true }
      ]);
      jset(LS.banners, bn);
      return { ok: true, items: bn };
    }
    if (path === '/admin/banners' && method === 'POST') {
      var bb = jget(LS.banners, []);
      if (body.action === 'add') bb.unshift({ id: 'b' + Date.now(), title: body.title, subtitle: body.subtitle, cta: body.cta || 'Open', url: body.url || '#', active: true });
      else if (body.action === 'toggle') bb = bb.map(function (b) { return b.id === body.id ? Object.assign({}, b, { active: !b.active }) : b; });
      else if (body.action === 'remove') bb = bb.filter(function (b) { return b.id !== body.id; });
      jset(LS.banners, bb);
      audit('banner', body.action, body.title || body.id);
      return { ok: true, items: bb };
    }

    // -------- Content (area-guide CMS) --------
    if (path === '/admin/content/areas' && method === 'GET') {
      return { ok: true, overrides: jget(LS.content_areas, {}) };
    }
    if (path === '/admin/content/areas' && method === 'POST') {
      var ca = jget(LS.content_areas, {});
      ca[body.area_id] = { blurb: body.blurb, schools: body.schools, malls: body.malls };
      jset(LS.content_areas, ca);
      audit('content.areas', body.area_id, '');
      return { ok: true };
    }

    // -------- Moderation --------
    if (path === '/admin/moderation' && method === 'GET') {
      var reports = jget(LS.moderation, [
        { id: 'mod1', listing_id: 'L004', reason: 'Photo appears duplicated', severity: 'medium', reported_at: new Date(Date.now() - 86400000).toISOString(), status: 'open' },
        { id: 'mod2', listing_id: 'L011', reason: 'Price seems unusually high', severity: 'low',    reported_at: new Date(Date.now() - 2 * 86400000).toISOString(), status: 'open' },
        { id: 'mod3', listing_id: 'L020', reason: 'Description text in non-English language only', severity: 'low', reported_at: new Date(Date.now() - 3 * 86400000).toISOString(), status: 'resolved' }
      ]);
      jset(LS.moderation, reports);
      return { ok: true, items: reports };
    }
    if (path === '/admin/moderation' && method === 'POST') {
      var rr = jget(LS.moderation, []);
      rr = rr.map(function (r) { return r.id === body.id ? Object.assign({}, r, { status: body.status }) : r; });
      jset(LS.moderation, rr);
      audit('moderation', body.id, body.status);
      return { ok: true, items: rr };
    }

    // -------- Settings --------
    if (path === '/admin/settings' && method === 'GET') {
      return { ok: true, settings: jget(LS.settings, { currencies: window.MANZIL_DATA.CURRENCIES, default_currency: 'AED', commission_pct: 2.0, rera_fee_pct: 4.0, contact_email: 'demo@manzil.ae' }) };
    }
    if (path === '/admin/settings' && method === 'POST') {
      var s = jget(LS.settings, {});
      Object.assign(s, body);
      jset(LS.settings, s);
      audit('settings.update', '', '');
      return { ok: true, settings: s };
    }

    // -------- Audit --------
    if (path === '/admin/audit') return { ok: true, items: jget(LS.audit, []) };

    return { ok: false, error: 'no_handler', path: path, method: method };
  }

  // ---------- Parse URL into path + params ----------
  function parseUrl(u) {
    var s = u.indexOf('/property/api');
    if (s === -1) return null;
    var rest = u.slice(s + '/property/api'.length);
    var q = rest.indexOf('?');
    var path = q === -1 ? rest : rest.slice(0, q);
    var params = {};
    if (q !== -1) {
      rest.slice(q + 1).split('&').forEach(function (kv) {
        if (!kv) return;
        var p = kv.split('=');
        params[decodeURIComponent(p[0])] = decodeURIComponent((p[1] || '').replace(/\+/g, ' '));
      });
    }
    return { path: path, params: params };
  }

  // ---------- Fetch shim ----------
  var origFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : input.url;
    if (url.indexOf('/property/api') === -1) return origFetch(input, init);
    var pu = parseUrl(url);
    var method = (init && init.method) || (typeof input !== 'string' && input.method) || 'GET';
    var body = null;
    try { body = init && init.body ? JSON.parse(init.body) : null; } catch (e) { body = null; }
    var res = handle(method.toUpperCase(), pu.path, body || {}, pu.params || {});
    return Promise.resolve({
      ok: !!res.ok,
      status: res.ok ? 200 : 404,
      json: function () { return Promise.resolve(res); },
      text: function () { return Promise.resolve(JSON.stringify(res)); }
    });
  };

  // Seed initial demo notifications / banners on first load
  if (!jget(LS.banners, null)) {
    jset(LS.banners, [
      { id: 'b1', title: 'Discover Palm Jumeirah', subtitle: 'Beachfront villas from AED 15M', cta: 'Explore', url: 'areas.html?slug=palm-jumeirah', active: true },
      { id: 'b2', title: 'Off-plan handover Q4',   subtitle: 'Lock in pre-launch prices',     cta: 'Browse',  url: 'search.html?transaction=off-plan', active: true }
    ]);
  }

  console.log('Manzil mock-api ready — fetch intercepted for /property/api/*');
})();
