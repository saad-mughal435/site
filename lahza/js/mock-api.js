/* mock-api.js — fetch interceptor for /lahza/api/*. Backs the journal,
 * mood, streak, insights, and settings endpoints using localStorage.
 * Same pattern as sanad/watad mock-api but ~5x simpler — no admin / staff /
 * approvals — this is a single-user app.
 *
 * CRITICAL: every regex route wraps the match assignment in parens:
 *   if ((m = path.match(...)) && method === '...') — the operator-precedence
 * lesson from POS. Avoid the naked `if (m = ... && ...)` form. */
(function () {
  'use strict';
  if (!window.LAHZA_DATA) { console.error('lahza mock-api: LAHZA_DATA not loaded'); return; }

  // ----- localStorage keys --------------------------------------------------
  var LS = {
    entries:  'lahza.entries',
    settings: 'lahza.settings',
    deletedSeed: 'lahza.entries.deletedSeed',  // tombstones for seed entries the user deletes
    histVersion: 'lahza.entries.histVersion'
  };
  var HIST_VERSION = 'v1';

  function jget(k, def) { try { return JSON.parse(localStorage.getItem(k)) || def; } catch (e) { return def; } }
  function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  // History migration — wipe stale entries if the schema version doesn't match.
  (function migrate() {
    var v = jget(LS.histVersion, null);
    if (v !== HIST_VERSION) {
      try { localStorage.removeItem(LS.entries); } catch (e) {}
      jset(LS.histVersion, HIST_VERSION);
    }
  })();

  // ----- Merged views -------------------------------------------------------
  function settings() {
    var saved = jget(LS.settings, null);
    return Object.assign({}, window.LAHZA_DATA.SETTINGS, saved || {});
  }
  function setSettings(patch) {
    var cur = settings();
    var next = Object.assign({}, cur, patch);
    jset(LS.settings, next);
    return next;
  }
  function allEntries() {
    var seed = window.LAHZA_DATA.ENTRIES_SEED.slice();
    var created = jget(LS.entries, []);
    var deletedSeed = new Set(jget(LS.deletedSeed, []));
    var merged = seed.filter(function (e) { return !deletedSeed.has(e.id); }).concat(created);
    merged.sort(function (a, b) { return new Date(b.ts) - new Date(a.ts); });
    return merged;
  }
  function getEntry(id) { return allEntries().find(function (e) { return e.id === id; }) || null; }

  // ----- Streak + insights --------------------------------------------------
  function streak() {
    return window.LahzaApp.computeStreak(allEntries());
  }
  function weeklyMood() {
    var entries = allEntries();
    var byDay = {};
    entries.forEach(function (e) { (byDay[e.date] = byDay[e.date] || []).push(e); });
    var todayMidnight = new Date(); todayMidnight.setHours(0,0,0,0);
    var moodScore = { joyful: 5, energized: 4, calm: 3, neutral: 2, tense: 1, low: 0 };
    var out = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date(todayMidnight.getTime() - i * 86400000);
      var key = d.toISOString().slice(0, 10);
      var list = byDay[key] || [];
      var avg = null;
      if (list.length) {
        var s = list.reduce(function (a, e) { return a + (moodScore[e.mood] || 2); }, 0);
        avg = +(s / list.length).toFixed(2);
      }
      out.push({ date: key, day: d.toLocaleDateString('en', { weekday: 'short' }), score: avg, mood_count: list.length });
    }
    return out;
  }
  function themes() {
    // Tag-frequency analysis, top 5
    var counts = {};
    allEntries().forEach(function (e) {
      (e.tags || []).forEach(function (t) { counts[t] = (counts[t] || 0) + 1; });
    });
    return Object.keys(counts)
      .map(function (t) { return { tag: t, count: counts[t] }; })
      .sort(function (a, b) { return b.count - a.count; })
      .slice(0, 5);
  }

  // ----- Route handler ------------------------------------------------------
  function handle(method, path, body, params) {
    var m;
    body = body || {}; params = params || {};

    /* ===== Settings ===== */
    if (path === '/settings' && method === 'GET')  return { ok: true, settings: settings() };
    if (path === '/settings' && method === 'POST') return { ok: true, settings: setSettings(body) };

    /* ===== Entries ===== */
    if (path === '/entries' && method === 'GET') {
      var rows = allEntries();
      if (params.mood) rows = rows.filter(function (e) { return e.mood === params.mood; });
      if (params.tag)  rows = rows.filter(function (e) { return (e.tags || []).indexOf(params.tag) !== -1; });
      if (params.q) {
        var q = String(params.q).toLowerCase();
        rows = rows.filter(function (e) { return (e.body + ' ' + (e.tags || []).join(' ')).toLowerCase().indexOf(q) !== -1; });
      }
      if (params.limit) rows = rows.slice(0, +params.limit);
      return { ok: true, items: rows };
    }
    if (path === '/entries' && method === 'POST') {
      var now = new Date();
      var newE = {
        id: 'e-' + now.getTime(),
        ts: now.toISOString(),
        date: now.toISOString().slice(0, 10),
        body: String(body.body || '').slice(0, 4000),
        mood: body.mood || 'neutral',
        emotions: body.emotions || [],
        tags: Array.isArray(body.tags) ? body.tags.slice(0, 6) : [],
        prompt: body.prompt || '',
        locale: body.locale || settings().locale || 'en'
      };
      var created = jget(LS.entries, []);
      created.push(newE);
      jset(LS.entries, created);
      return { ok: true, entry: newE };
    }
    if ((m = path.match(/^\/entries\/([^\/]+)$/)) && method === 'GET') {
      var e = getEntry(m[1]);
      return e ? { ok: true, entry: e } : { ok: false, error: 'not_found', status: 404 };
    }
    if ((m = path.match(/^\/entries\/([^\/]+)$/)) && method === 'PUT') {
      var id = m[1];
      var created = jget(LS.entries, []);
      var idx = created.findIndex(function (x) { return x.id === id; });
      if (idx === -1) {
        // Patching a seed entry — clone into created store with the patch applied
        var seed = window.LAHZA_DATA.ENTRIES_SEED.find(function (x) { return x.id === id; });
        if (!seed) return { ok: false, error: 'not_found', status: 404 };
        var deletedSeed = jget(LS.deletedSeed, []);
        if (deletedSeed.indexOf(id) === -1) deletedSeed.push(id);
        jset(LS.deletedSeed, deletedSeed);
        var clone = Object.assign({}, seed, body);
        created.push(clone);
        jset(LS.entries, created);
        return { ok: true, entry: clone };
      }
      created[idx] = Object.assign({}, created[idx], body);
      jset(LS.entries, created);
      return { ok: true, entry: created[idx] };
    }
    if ((m = path.match(/^\/entries\/([^\/]+)$/)) && method === 'DELETE') {
      var id2 = m[1];
      var created2 = jget(LS.entries, []);
      var newList = created2.filter(function (x) { return x.id !== id2; });
      jset(LS.entries, newList);
      // also tombstone if it was a seed entry
      var isSeed = window.LAHZA_DATA.ENTRIES_SEED.some(function (x) { return x.id === id2; });
      if (isSeed) {
        var dl = jget(LS.deletedSeed, []);
        if (dl.indexOf(id2) === -1) dl.push(id2);
        jset(LS.deletedSeed, dl);
      }
      return { ok: true };
    }

    /* ===== Streak + insights + themes ===== */
    if (path === '/streak'        && method === 'GET') return { ok: true, streak: streak() };
    if (path === '/mood/week'     && method === 'GET') return { ok: true, days: weeklyMood() };
    if (path === '/insights/tags' && method === 'GET') return { ok: true, themes: themes() };

    /* ===== Reset demo ===== */
    if (path === '/reset' && method === 'POST') {
      Object.keys(LS).forEach(function (k) { try { localStorage.removeItem(LS[k]); } catch (e) {} });
      return { ok: true };
    }

    return { ok: false, error: 'unknown_route', status: 404 };
  }

  // ----- Fetch intercept ----------------------------------------------------
  var origFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var idx = url.indexOf('/lahza/api');
    // /api/lahza/ai/* is handled by the Worker / LahzaAI engine — pass through.
    if (idx === -1 || url.indexOf('/api/lahza/ai/') !== -1)
      return origFetch ? origFetch(input, init) : Promise.reject(new Error('no fetch'));
    init = init || {};
    var method = (init.method || 'GET').toUpperCase();
    var pathAndQuery = url.slice(idx + '/lahza/api'.length).split('?');
    var path = pathAndQuery[0] || '/';
    var params = {};
    if (pathAndQuery[1]) pathAndQuery[1].split('&').forEach(function (kv) {
      var p = kv.split('='); params[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '');
    });
    var body = {};
    if (init.body) { try { body = JSON.parse(init.body); } catch (e) { body = {}; } }
    var res = handle(method, path, body, params);
    return Promise.resolve({
      ok: !!res.ok,
      status: res.status || (res.ok ? 200 : 400),
      json: function () { return Promise.resolve(res); }
    });
  };

  console.log('Lahza mock-api ready — /lahza/api/* intercepted');
})();
