/* app.js - Nabta helpers + admin SPA shell + sections.
 * Single-file approach since the demo is one SPA. */
(function () {
  'use strict';
  (function () { var s = document.createElement('script'); s.src = '/assets/portfolio-banner.js?v=20260514'; s.async = true; document.head.appendChild(s); })();

  function jget(k, def) { try { return JSON.parse(localStorage.getItem(k)) || def; } catch (e) { return def; } }
  function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmtDate(iso) { if (!iso) return ''; return new Date(iso).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' }); }
  function fmtDateTime(iso) { if (!iso) return ''; return new Date(iso).toLocaleString('en', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  function fmtMoney(n) { if (n == null) return '-'; return 'AED ' + Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
  function api(path, opts) {
    opts = opts || {};
    var url = (opts.absolute ? '' : '/nabta/api') + path;
    return fetch(url, {
      method: opts.method || 'GET',
      headers: Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {}),
      body: opts.body ? (typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)) : undefined
    }).then(function (r) { return r.json().then(function (body) { return { ok: r.ok, status: r.status, body: body }; }); });
  }
  function showModal(opts) {
    var bg = document.createElement('div');
    bg.className = 'nbt-modal-backdrop';
    bg.innerHTML = ''
      + '<div class="nbt-modal" style="max-width:' + (opts.size === 'lg' ? '780px' : '520px') + ';">'
      +   '<div class="nbt-modal-head"><h3>' + escapeHtml(opts.title || '') + '</h3><button class="nbt-modal-close" data-modal-close aria-label="Close">×</button></div>'
      +   '<div class="nbt-modal-body">' + (opts.body || '') + '</div>'
      +   (opts.foot ? '<div class="nbt-modal-foot">' + opts.foot + '</div>' : '')
      + '</div>';
    document.body.appendChild(bg);
    requestAnimationFrame(function () { bg.classList.add('show'); });
    function close() { bg.classList.remove('show'); setTimeout(function () { bg.remove(); }, 200); }
    bg.addEventListener('click', function (e) {
      if (e.target === bg) return close();
      if (e.target.hasAttribute && e.target.hasAttribute('data-modal-close')) close();
    });
    if (opts.onMount) opts.onMount(bg.querySelector('.nbt-modal'), close);
    return { el: bg, close: close };
  }

  window.toast = function (msg, kind, ms) {
    var stack = document.getElementById('nbt-toasts');
    if (!stack) { stack = document.createElement('div'); stack.id = 'nbt-toasts'; stack.className = 'nbt-toasts'; document.body.appendChild(stack); }
    var t = document.createElement('div'); t.className = 'nbt-toast ' + (kind || ''); t.textContent = msg;
    stack.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; t.style.transition = 'opacity .25s'; }, ms || 2500);
    setTimeout(function () { t.remove(); }, (ms || 2500) + 300);
  };

  window.NabtaApp = {
    jget: jget, jset: jset,
    escapeHtml: escapeHtml, fmtDate: fmtDate, fmtDateTime: fmtDateTime, fmtMoney: fmtMoney,
    api: api, showModal: showModal
  };
})();
