/* app.js - Shared helpers for Qahwa POS */
(function () {
  'use strict';
  // Cross-site portfolio banner loader (consistent with /b2c/, /b2b/, /property/, /vacation/)
  (function () { var s = document.createElement('script'); s.src = '/assets/portfolio-banner.js?v=20260514'; s.async = true; document.head.appendChild(s); })();

  function jget(k, def) { try { return JSON.parse(localStorage.getItem(k)) || def; } catch (e) { return def; } }
  function jset(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmtMoney(n) { return 'AED ' + (Math.round((n || 0) * 100) / 100).toFixed(2); }
  function fmtTime(iso) {
    if (!iso) return '';
    var d = new Date(iso); var hh = String(d.getHours()).padStart(2, '0'); var mm = String(d.getMinutes()).padStart(2, '0');
    return hh + ':' + mm;
  }
  function fmtDateTime(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return d.toLocaleString('en', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  function timeAgo(iso) {
    if (!iso) return '';
    var diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return diff + 's ago';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    return Math.floor(diff / 86400) + 'd ago';
  }
  function elapsed(iso) {
    if (!iso) return '0:00';
    var diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    var m = Math.floor(diff / 60); var s = diff % 60;
    return m + ':' + String(s).padStart(2, '0');
  }
  function api(path, opts) {
    opts = opts || {};
    return fetch('/pos/api' + path, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) { return r.json().then(function (body) { return { ok: r.ok, body: body }; }); });
  }
  function qs() {
    var p = {}; var s = window.location.search.slice(1);
    if (!s) return p;
    s.split('&').forEach(function (kv) { var pair = kv.split('='); p[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || ''); });
    return p;
  }
  function showModal(opts) {
    var bg = document.createElement('div');
    bg.className = 'pos-modal-backdrop';
    bg.innerHTML = ''
      + '<div class="pos-modal" style="max-width:' + (opts.size === 'lg' ? '760px' : '560px') + ';">'
      +   '<div class="pos-modal-head"><h3>' + escapeHtml(opts.title || '') + '</h3><button class="pos-modal-close" data-modal-close>×</button></div>'
      +   '<div class="pos-modal-body">' + (opts.body || '') + '</div>'
      +   (opts.foot ? '<div class="pos-modal-foot">' + opts.foot + '</div>' : '')
      + '</div>';
    document.body.appendChild(bg);
    requestAnimationFrame(function () { bg.classList.add('show'); });
    function close() { bg.classList.remove('show'); setTimeout(function () { bg.remove(); }, 200); }
    bg.addEventListener('click', function (e) {
      if (e.target === bg) return close();
      if (e.target.hasAttribute && e.target.hasAttribute('data-modal-close')) close();
    });
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } });
    if (opts.onMount) opts.onMount(bg.querySelector('.pos-modal'), close);
    return { el: bg, close: close };
  }

  window.PosApp = {
    jget: jget, jset: jset,
    escapeHtml: escapeHtml,
    fmtMoney: fmtMoney, fmtTime: fmtTime, fmtDateTime: fmtDateTime,
    timeAgo: timeAgo, elapsed: elapsed,
    api: api, qs: qs, showModal: showModal
  };
})();
