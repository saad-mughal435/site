/* app.js - Shared helpers for Watad. Exposes window.WatadApp. */
(function () {
  'use strict';
  (function () { var s = document.createElement('script'); s.src = '/assets/portfolio-banner.js?v=20260514'; s.async = true; document.head.appendChild(s); })();

  function jget(k, def) { try { return JSON.parse(localStorage.getItem(k)) || def; } catch (e) { return def; } }
  function jset(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function fmtTime(iso) {
    if (!iso) return '';
    var d = new Date(iso); var hh = String(d.getHours()).padStart(2, '0'); var mm = String(d.getMinutes()).padStart(2, '0');
    return hh + ':' + mm;
  }
  function fmtDateTime(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleString('en', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  function fmtDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function timeAgo(iso) {
    if (!iso) return '';
    var diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 0) return 'in ' + timeAgo(new Date(Date.now() - Math.abs(diff) * 1000).toISOString());
    if (diff < 60) return diff + 's ago';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return Math.floor(diff / 604800) + 'w ago';
  }
  function fmtUnit(value, unit, places) {
    if (value == null) return '-';
    if (places == null) places = (unit === 'kWh' || unit === 'V') ? 0 : 1;
    return Number(value).toFixed(places) + (unit ? (' ' + unit) : '');
  }
  function severitySort(arr) {
    var rank = { critical: 0, urgent: 1, warning: 2, info: 3 };
    return arr.slice().sort(function (a, b) { return (rank[a.severity] || 9) - (rank[b.severity] || 9); });
  }

  function api(path, opts) {
    opts = opts || {};
    var url = (opts.absolute ? '' : '/watad/api') + path;
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
    bg.className = 'wtd-modal-backdrop';
    bg.innerHTML = ''
      + '<div class="wtd-modal" style="max-width:' + (opts.size === 'lg' ? '760px' : opts.size === 'sm' ? '420px' : '560px') + ';">'
      +   '<div class="wtd-modal-head"><h3>' + escapeHtml(opts.title || '') + '</h3><button class="wtd-modal-close" data-modal-close>×</button></div>'
      +   '<div class="wtd-modal-body">' + (opts.body || '') + '</div>'
      +   (opts.foot ? '<div class="wtd-modal-foot">' + opts.foot + '</div>' : '')
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
    if (opts.onMount) opts.onMount(bg.querySelector('.wtd-modal'), close);
    return { el: bg, close: close };
  }

  // SVG line chart helper - pure SVG, no library. Returns an SVG string.
  // points: array of {x, y} in data space. xRange/yRange: [min, max].
  // w/h: pixel dimensions. opts: { line, area, grid, band }.
  function lineChart(points, opts) {
    opts = opts || {};
    var w = opts.w || 300, h = opts.h || 80;
    var pad = opts.pad || 4;
    if (!points.length) return '<svg viewBox="0 0 ' + w + ' ' + h + '" class="wtd-trend-svg"></svg>';
    var xs = points.map(function (p) { return p.x; });
    var ys = points.map(function (p) { return p.y; });
    var xMin = opts.xMin != null ? opts.xMin : Math.min.apply(null, xs);
    var xMax = opts.xMax != null ? opts.xMax : Math.max.apply(null, xs);
    var yMin = opts.yMin != null ? opts.yMin : Math.min.apply(null, ys);
    var yMax = opts.yMax != null ? opts.yMax : Math.max.apply(null, ys);
    var ySpan = Math.max(0.001, yMax - yMin);
    var xSpan = Math.max(0.001, xMax - xMin);
    function px(x) { return pad + ((x - xMin) / xSpan) * (w - pad * 2); }
    function py(y) { return h - pad - ((y - yMin) / ySpan) * (h - pad * 2); }
    var path = points.map(function (p, i) { return (i === 0 ? 'M' : 'L') + px(p.x).toFixed(1) + ',' + py(p.y).toFixed(1); }).join(' ');
    var areaPath = path + ' L' + px(xMax).toFixed(1) + ',' + (h - pad) + ' L' + px(xMin).toFixed(1) + ',' + (h - pad) + ' Z';
    var band = '';
    if (opts.band) {
      var by1 = py(opts.band[1]), by2 = py(opts.band[0]);
      band = '<rect class="wtd-svg-band" x="' + pad + '" y="' + by1 + '" width="' + (w - pad * 2) + '" height="' + (by2 - by1) + '"/>';
    }
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" class="wtd-trend-svg">'
      + band
      + (opts.area !== false ? '<path class="wtd-svg-area" d="' + areaPath + '"/>' : '')
      + '<path class="wtd-svg-line" d="' + path + '"/>'
      + '</svg>';
  }

  window.WatadApp = {
    jget: jget, jset: jset,
    escapeHtml: escapeHtml,
    fmtTime: fmtTime, fmtDateTime: fmtDateTime, fmtDate: fmtDate, timeAgo: timeAgo,
    fmtUnit: fmtUnit, severitySort: severitySort,
    api: api, qs: qs, showModal: showModal,
    lineChart: lineChart
  };
})();
