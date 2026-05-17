/* app.js - Shared helpers for Sanad. Exposes window.SanadApp. */
(function () {
  'use strict';

  // Cross-site portfolio banner (consistent with /b2c/, /pos/ etc.)
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
    if (diff < 60) return diff + 's';
    if (diff < 3600) return Math.floor(diff / 60) + 'm';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd';
    return Math.floor(diff / 604800) + 'w';
  }
  function avatarFor(person) {
    if (person && person.avatar) return person.avatar;
    if (person && person.photo) return person.photo;
    return null;
  }
  function initialsOf(name) {
    return String(name || '?').split(/\s+/).slice(0, 2).map(function (p) { return p[0] || ''; }).join('').toUpperCase();
  }

  function api(path, opts) {
    opts = opts || {};
    var url = (opts.absolute ? '' : '/sanad/api') + path;
    return fetch(url, {
      method: opts.method || 'GET',
      headers: Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {}),
      body: opts.body ? (typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)) : undefined
    }).then(function (r) {
      var ct = r.headers && r.headers.get && r.headers.get('content-type') || '';
      if (ct.indexOf('text/event-stream') !== -1) return { ok: r.ok, status: r.status, stream: r.body, headers: r.headers };
      return r.json().then(function (body) { return { ok: r.ok, status: r.status, body: body }; });
    });
  }

  function qs() {
    var p = {}; var s = window.location.search.slice(1);
    if (!s) return p;
    s.split('&').forEach(function (kv) { var pair = kv.split('='); p[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || ''); });
    return p;
  }

  function showModal(opts) {
    var bg = document.createElement('div');
    bg.className = 'snd-modal-backdrop';
    bg.innerHTML = ''
      + '<div class="snd-modal" style="max-width:' + (opts.size === 'lg' ? '760px' : opts.size === 'sm' ? '420px' : '560px') + ';">'
      +   '<div class="snd-modal-head"><h3>' + escapeHtml(opts.title || '') + '</h3><button class="snd-modal-close" data-modal-close>×</button></div>'
      +   '<div class="snd-modal-body">' + (opts.body || '') + '</div>'
      +   (opts.foot ? '<div class="snd-modal-foot">' + opts.foot + '</div>' : '')
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
    if (opts.onMount) opts.onMount(bg.querySelector('.snd-modal'), close);
    return { el: bg, close: close };
  }

  // tiny markdown renderer: headings, bold, italic, code, lists, links, blockquotes, paragraphs
  function md(src) {
    if (!src) return '';
    var lines = String(src).split(/\r?\n/);
    var out = [];
    var i = 0;
    while (i < lines.length) {
      var ln = lines[i];
      var h = ln.match(/^(#{1,3})\s+(.*)$/);
      if (h) { out.push('<h' + h[1].length + '>' + inline(h[2]) + '</h' + h[1].length + '>'); i++; continue; }
      if (/^```/.test(ln)) {
        var code = []; i++;
        while (i < lines.length && !/^```/.test(lines[i])) { code.push(lines[i]); i++; }
        i++; out.push('<pre><code>' + escapeHtml(code.join('\n')) + '</code></pre>'); continue;
      }
      if (/^\s*-\s+/.test(ln)) {
        var ul = []; while (i < lines.length && /^\s*-\s+/.test(lines[i])) { ul.push('<li>' + inline(lines[i].replace(/^\s*-\s+/, '')) + '</li>'); i++; }
        out.push('<ul>' + ul.join('') + '</ul>'); continue;
      }
      if (/^\s*\d+\.\s+/.test(ln)) {
        var ol = []; while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { ol.push('<li>' + inline(lines[i].replace(/^\s*\d+\.\s+/, '')) + '</li>'); i++; }
        out.push('<ol>' + ol.join('') + '</ol>'); continue;
      }
      if (/^>\s+/.test(ln)) { out.push('<blockquote>' + inline(ln.replace(/^>\s+/, '')) + '</blockquote>'); i++; continue; }
      if (!ln.trim()) { i++; continue; }
      // paragraph (greedy until blank)
      var p = [ln]; i++;
      while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|```|\s*-\s|\s*\d+\.\s|>\s)/.test(lines[i])) { p.push(lines[i]); i++; }
      out.push('<p>' + inline(p.join(' ')) + '</p>');
    }
    return out.join('\n');
    function inline(t) {
      return escapeHtml(t)
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>');
    }
  }

  window.SanadApp = {
    jget: jget, jset: jset,
    escapeHtml: escapeHtml,
    fmtTime: fmtTime, fmtDateTime: fmtDateTime, fmtDate: fmtDate, timeAgo: timeAgo,
    avatarFor: avatarFor, initialsOf: initialsOf,
    api: api, qs: qs, showModal: showModal,
    md: md
  };
})();
