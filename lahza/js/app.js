/* app.js — Lahza shared helpers. Exposes window.LahzaApp + window.toast. */
(function () {
  'use strict';

  function jget(k, def) { try { return JSON.parse(localStorage.getItem(k)) || def; } catch (e) { return def; } }
  function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* quota */ } }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function fmtDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  function fmtDateLong(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  function fmtTime(iso) {
    if (!iso) return '';
    var d = new Date(iso); var hh = String(d.getHours()).padStart(2, '0'); var mm = String(d.getMinutes()).padStart(2, '0');
    return hh + ':' + mm;
  }
  function timeAgo(iso) {
    if (!iso) return '';
    var diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return diff + 's ago';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return Math.floor(diff / 604800) + 'w ago';
  }

  function api(path, opts) {
    opts = opts || {};
    var url = (opts.absolute ? '' : '/lahza/api') + path;
    return fetch(url, {
      method: opts.method || 'GET',
      headers: Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {}),
      body: opts.body ? (typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)) : undefined
    }).then(function (r) { return r.json().then(function (body) { return { ok: r.ok, status: r.status, body: body }; }); });
  }

  // Bottom-sheet modal — slides up from the bottom of the phone. Mobile-native feel.
  function showSheet(opts) {
    var backdrop = document.getElementById('sheet-backdrop');
    var sheet = document.getElementById('sheet');
    if (!backdrop || !sheet) return null;
    sheet.innerHTML =
        '<div class="lz-sheet-handle"></div>'
      + (opts.title ? '<h3 style="margin-bottom:10px;">' + escapeHtml(opts.title) + '</h3>' : '')
      + '<div class="lz-sheet-body">' + (opts.body || '') + '</div>'
      + (opts.foot ? '<div class="lz-sheet-foot" style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end;">' + opts.foot + '</div>' : '');
    requestAnimationFrame(function () { backdrop.classList.add('show'); });

    function close() {
      backdrop.classList.remove('show');
      setTimeout(function () { sheet.innerHTML = ''; }, 240);
      backdrop.removeEventListener('click', onBg);
      document.removeEventListener('keydown', onEsc);
    }
    function onBg(e) {
      if (e.target === backdrop) close();
      if (e.target.hasAttribute && e.target.hasAttribute('data-sheet-close')) close();
    }
    function onEsc(e) { if (e.key === 'Escape') close(); }
    backdrop.addEventListener('click', onBg);
    document.addEventListener('keydown', onEsc);

    if (opts.onMount) opts.onMount(sheet, close);
    return { el: sheet, close: close };
  }

  // Toast
  window.toast = function (msg, kind, ms) {
    var stack = document.getElementById('toasts');
    if (!stack) return;
    var t = document.createElement('div');
    t.className = 'lz-toast ' + (kind || '');
    t.textContent = msg;
    stack.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; t.style.transition = 'opacity .25s ease'; }, ms || 2400);
    setTimeout(function () { t.remove(); }, (ms || 2400) + 300);
  };

  // Mood emoji map (used everywhere)
  var MOOD_EMOJI = {
    joyful:    '😊',
    calm:      '🌿',
    energized: '⚡',
    tense:     '😣',
    low:       '🌧',
    neutral:   '😐'
  };
  var MOOD_LABEL = {
    joyful: 'Joyful', calm: 'Calm', energized: 'Energized',
    tense: 'Tense', low: 'Low', neutral: 'Neutral'
  };

  // Compute streak from entries (consecutive days, working back from today)
  function computeStreak(entries) {
    if (!entries || !entries.length) return 0;
    var seenDates = new Set(entries.map(function (e) { return e.date; }));
    var todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);
    var streak = 0;
    for (var i = 0; i < 365; i++) {
      var d = new Date(todayMidnight.getTime() - i * 86400000);
      var key = d.toISOString().slice(0, 10);
      if (seenDates.has(key)) streak++;
      else if (i === 0) continue;  // today might not have an entry yet — don't break streak
      else break;
    }
    return streak;
  }

  // Cross-site portfolio-demo banner (consistent with the other demos)
  (function () { var s = document.createElement('script'); s.src = '/assets/portfolio-banner.js?v=20260514'; s.async = true; document.head.appendChild(s); })();

  window.LahzaApp = {
    jget: jget, jset: jset,
    escapeHtml: escapeHtml,
    fmtDate: fmtDate, fmtDateLong: fmtDateLong, fmtTime: fmtTime, timeAgo: timeAgo,
    api: api,
    showSheet: showSheet,
    MOOD_EMOJI: MOOD_EMOJI,
    MOOD_LABEL: MOOD_LABEL,
    computeStreak: computeStreak
  };
})();
