/* app.js - Tiny helper shim for Ask Saad. Exposes window.AskApp.
 * Lifted from sanad/js/app.js so chat.js doesn't have to import SanadApp
 * across demos. Only the helpers chat.js actually needs are included. */
(function () {
  'use strict';

  function jget(k, def) { try { return JSON.parse(localStorage.getItem(k)) || def; } catch (e) { return def; } }
  function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* quota */ } }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function showModal(opts) {
    var bg = document.createElement('div');
    bg.className = 'ask-modal-backdrop';
    bg.innerHTML = ''
      + '<div class="ask-modal" style="max-width:' + (opts.size === 'lg' ? '720px' : '480px') + ';">'
      +   '<div class="ask-modal-head"><h3>' + escapeHtml(opts.title || '') + '</h3><button class="ask-modal-close" data-modal-close aria-label="Close">×</button></div>'
      +   '<div class="ask-modal-body">' + (opts.body || '') + '</div>'
      +   (opts.foot ? '<div class="ask-modal-foot">' + opts.foot + '</div>' : '')
      + '</div>';
    document.body.appendChild(bg);
    requestAnimationFrame(function () { bg.classList.add('show'); });
    function close() { bg.classList.remove('show'); setTimeout(function () { bg.remove(); }, 200); }
    bg.addEventListener('click', function (e) {
      if (e.target === bg) return close();
      if (e.target.hasAttribute && e.target.hasAttribute('data-modal-close')) close();
    });
    function escKey(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escKey); } }
    document.addEventListener('keydown', escKey);
    if (opts.onMount) opts.onMount(bg.querySelector('.ask-modal'), close);
    return { el: bg, close: close };
  }

  // tiny toast - only loaded if not already present (the demo pages provide it,
  // the homepage doesn't).
  if (!window.toast) {
    window.toast = function (msg, kind, ms) {
      var stack = document.getElementById('ask-toast-stack');
      if (!stack) {
        stack = document.createElement('div');
        stack.id = 'ask-toast-stack';
        stack.style.cssText = 'position:fixed;bottom:84px;right:20px;z-index:2147483647;display:flex;flex-direction:column;gap:8px;max-width:300px;pointer-events:none;';
        document.body.appendChild(stack);
      }
      var t = document.createElement('div');
      t.textContent = msg;
      t.style.cssText = 'background:#0f1a30;color:#e6eef9;border:1px solid rgba(34,211,238,.4);padding:10px 14px;border-radius:10px;font-size:13px;box-shadow:0 4px 16px rgba(2,10,24,.45);font-family:Inter,system-ui,sans-serif;pointer-events:auto;';
      if (kind === 'success') t.style.borderColor = 'rgba(74,222,128,.6)';
      else if (kind === 'warn') t.style.borderColor = 'rgba(251,191,36,.6)';
      else if (kind === 'error') t.style.borderColor = 'rgba(239,68,68,.6)';
      stack.appendChild(t);
      setTimeout(function () { t.style.opacity = '0'; t.style.transform = 'translateY(10px)'; t.style.transition = 'all .25s ease'; }, ms || 2500);
      setTimeout(function () { t.remove(); }, (ms || 2500) + 300);
    };
  }

  window.AskApp = { jget: jget, jset: jset, escapeHtml: escapeHtml, showModal: showModal };
})();
