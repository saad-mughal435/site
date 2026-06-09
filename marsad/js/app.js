/* app.js - Marsad shared helpers. Exposes window.MarsadApp. */
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
  function fmtTime(iso) {
    if (!iso) return '';
    var d = new Date(iso); var hh = String(d.getHours()).padStart(2,'0'); var mm = String(d.getMinutes()).padStart(2,'0');
    return hh + ':' + mm;
  }
  function fmtDateTime(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleString('en', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  function timeAgo(iso) {
    if (!iso) return '';
    var d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (d < 0) {
      var ad = Math.abs(d);
      if (ad < 60) return 'in ' + ad + 's';
      if (ad < 3600) return 'in ' + Math.floor(ad / 60) + 'm';
      if (ad < 86400) return 'in ' + Math.floor(ad / 3600) + 'h';
      return 'in ' + Math.floor(ad / 86400) + 'd';
    }
    if (d < 60) return d + 's ago';
    if (d < 3600) return Math.floor(d / 60) + 'm ago';
    if (d < 86400) return Math.floor(d / 3600) + 'h ago';
    return Math.floor(d / 86400) + 'd ago';
  }
  function fmtMoney(n, currency) {
    if (n == null) return '-';
    return (currency || 'AED') + ' ' + Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function api(path, opts) {
    opts = opts || {};
    var url = (opts.absolute ? '' : '/marsad/api') + path;
    return fetch(url, {
      method: opts.method || 'GET',
      headers: Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {}),
      body: opts.body ? (typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)) : undefined
    }).then(function (r) { return r.json().then(function (body) { return { ok: r.ok, status: r.status, body: body }; }); });
  }

  function qs() {
    var p = {}; var s = window.location.search.slice(1);
    if (!s) return p;
    s.split('&').forEach(function (kv) { var pair = kv.split('='); p[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || ''); });
    return p;
  }

  function showModal(opts) {
    var bg = document.createElement('div');
    bg.className = 'mrs-modal-backdrop';
    bg.innerHTML = ''
      + '<div class="mrs-modal" style="max-width:' + (opts.size === 'lg' ? '780px' : opts.size === 'sm' ? '420px' : '560px') + ';">'
      +   '<div class="mrs-modal-head"><h3>' + escapeHtml(opts.title || '') + '</h3><button class="mrs-modal-close" data-modal-close>×</button></div>'
      +   '<div class="mrs-modal-body">' + (opts.body || '') + '</div>'
      +   (opts.foot ? '<div class="mrs-modal-foot">' + opts.foot + '</div>' : '')
      + '</div>';
    document.body.appendChild(bg);
    requestAnimationFrame(function () { bg.classList.add('show'); });
    function close() { bg.classList.remove('show'); setTimeout(function () { bg.remove(); }, 200); }
    bg.addEventListener('click', function (e) {
      if (e.target === bg) return close();
      if (e.target.hasAttribute && e.target.hasAttribute('data-modal-close')) close();
    });
    function esc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } }
    document.addEventListener('keydown', esc);
    if (opts.onMount) opts.onMount(bg.querySelector('.mrs-modal'), close);
    return { el: bg, close: close };
  }

  var STATUS_LABEL = {
    pending: 'Pending', assigned: 'Assigned', picked_up: 'Picked up',
    in_transit: 'In transit', delivered: 'Delivered', failed: 'Failed'
  };
  var STATUS_COLOR = {
    pending: 'pending', assigned: 'assigned', picked_up: 'in-transit',
    in_transit: 'in-transit', delivered: 'delivered', failed: 'failed'
  };

  window.MarsadApp = {
    jget: jget, jset: jset,
    escapeHtml: escapeHtml,
    fmtTime: fmtTime, fmtDateTime: fmtDateTime, timeAgo: timeAgo, fmtMoney: fmtMoney,
    api: api, qs: qs, showModal: showModal,
    STATUS_LABEL: STATUS_LABEL, STATUS_COLOR: STATUS_COLOR
  };
})();
