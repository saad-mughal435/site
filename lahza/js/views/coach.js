/* coach.js — AI Coach chat. RAG over the user's last 14 entries. Citation
 * chips [entry-id] open the cited entry in a bottom sheet. */
(function () {
  'use strict';
  window.LahzaViews = window.LahzaViews || {};
  var esc = function (s) { return LahzaApp.escapeHtml(s); };

  var HIST_KEY = 'lahza.coach.history';
  var HIST_VERSION_KEY = 'lahza.coach.histVersion';
  var HIST_VERSION = 'v1';

  var STARTERS = [
    "What kept showing up this week?",
    "Why was the last hard day hard?",
    "What pattern do you see in my energised days?",
    "What's one thing I should pay more attention to?"
  ];

  function loadHist() {
    if (LahzaApp.jget(HIST_VERSION_KEY, null) !== HIST_VERSION) {
      try { localStorage.removeItem(HIST_KEY); } catch (e) {}
      LahzaApp.jset(HIST_VERSION_KEY, HIST_VERSION);
      return [];
    }
    return LahzaApp.jget(HIST_KEY, []);
  }
  function saveHist(h) { LahzaApp.jset(HIST_KEY, h); }

  var state = { history: loadHist(), entries: [], typing: false };

  window.LahzaViews.coach = function (app) {
    LahzaApp.api('/entries').then(function (r) {
      state.entries = r.body.items || [];
      render(app);
    });
  };

  function render(app) {
    var greetingHtml = !state.history.length
      ? '<div class="lz-ai-panel" style="margin-bottom:14px;">'
        + '<div class="lz-ai-panel-head">✦ Coach</div>'
        + '<div class="lz-ai-panel-body" style="font-size:14px;">Hi. I read your last 14 entries before each reply. Ask me something specific — I\'ll cite the entries I lean on.</div>'
        + '<div style="margin-top:10px;display:flex;flex-direction:column;gap:6px;">'
        + STARTERS.map(function (q) { return '<button class="lz-prompt-chip" data-starter="' + esc(q) + '" style="text-align:start;justify-content:flex-start;">' + esc(q) + '</button>'; }).join('')
        + '</div></div>'
      : '';

    var msgsHtml = state.history.map(function (m, idx) {
      if (m.role === 'user') {
        return '<div class="lz-msg out"><div class="lz-msg-bubble">' + esc(m.content) + '</div></div>';
      }
      var bubble = renderAssistantBubble(m, idx);
      return '<div class="lz-msg"><div class="lz-msg-avatar">L</div><div style="min-width:0;flex:1;">' + bubble + '</div></div>';
    }).join('');

    var typingHtml = state.typing
      ? '<div class="lz-msg"><div class="lz-msg-avatar">L</div><div class="lz-msg-bubble" style="font-size:13px;color:var(--lz-muted);">…</div></div>'
      : '';

    app.innerHTML =
        '<div class="lz-topbar"><div class="lz-topbar-title">AI Coach</div></div>'
      + '<div class="lz-view" style="padding-bottom:140px;">'
      +   greetingHtml
      +   msgsHtml
      +   typingHtml
      + '</div>'
      + '<div style="position:absolute;bottom:var(--lz-tabbar-h);left:0;right:0;padding:10px 14px;background:var(--lz-bg-2);border-top:1px solid var(--lz-line);z-index:35;">'
      +   '<div style="display:flex;gap:8px;align-items:flex-end;">'
      +     '<textarea class="lz-textarea" id="coach-input" rows="1" placeholder="Ask the Coach…" style="min-height:36px;max-height:100px;padding:8px 12px;"></textarea>'
      +     '<button class="lz-btn lz-btn--primary" id="coach-send" style="padding:8px 14px;min-width:48px;">↑</button>'
      +   '</div>'
      + '</div>';

    wire(app);
    var view = app.querySelector('.lz-view');
    if (view) view.scrollTop = view.scrollHeight;
  }

  function renderAssistantBubble(m, idx) {
    var citationMap = {};
    state.entries.forEach(function (e) { citationMap[e.id] = e; });

    var citedIds = [];
    var stripped = String(m.content || '').replace(/\[([a-z0-9-]+)\]/g, function (mm, id) {
      if (citationMap[id]) { citedIds.push(id); return ''; }
      return '';
    }).replace(/\s+([.,!?])/g, '$1').trim();

    var cites = '';
    if (citedIds.length) {
      // De-dupe in order
      var seen = new Set();
      var unique = citedIds.filter(function (id) { if (seen.has(id)) return false; seen.add(id); return true; });
      cites = '<div class="lz-cites">' + unique.map(function (id) {
        var e = citationMap[id];
        var label = e ? LahzaApp.fmtDate(e.ts) : id;
        return '<a class="lz-cite" data-cite="' + esc(id) + '">📎 ' + esc(label) + '</a>';
      }).join('') + '</div>';
    }

    return '<div class="lz-msg-bubble">' + esc(stripped) + '</div>' + cites
      + (m.model ? '<div style="font-size:9.5px;color:var(--lz-muted);font-family:var(--lz-font-mono);margin-top:3px;">' + esc(m.model) + (m.fallback ? ' · mock' : '') + (m.latency_ms ? ' · ' + m.latency_ms + 'ms' : '') + '</div>' : '');
  }

  function wire(app) {
    var input = document.getElementById('coach-input');
    var send = document.getElementById('coach-send');

    if (input) {
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(app); }
      });
    }
    if (send) send.addEventListener('click', function () { doSend(app); });

    // Starter chips
    app.querySelectorAll('[data-starter]').forEach(function (b) {
      b.addEventListener('click', function () {
        input.value = b.getAttribute('data-starter');
        doSend(app);
      });
    });

    // Citation chips
    app.querySelectorAll('[data-cite]').forEach(function (c) {
      c.addEventListener('click', function () { openEntrySheet(c.getAttribute('data-cite')); });
    });
  }

  function doSend(app) {
    var input = document.getElementById('coach-input');
    if (!input) return;
    var q = (input.value || '').trim();
    if (!q) return;
    input.value = '';
    state.history.push({ role: 'user', content: q });
    state.typing = true;
    saveHist(state.history);
    render(app);

    LahzaAI.coachChat({
      question: q,
      history: state.history.slice(-6, -1),
      entries: state.entries.slice(0, 14)
    }).then(function (r) {
      state.typing = false;
      state.history.push({
        role: 'assistant',
        content: r.text,
        model: r.model,
        latency_ms: r.latency_ms,
        fallback: r.fallback
      });
      saveHist(state.history);
      render(app);
    }).catch(function () {
      state.typing = false;
      state.history.push({ role: 'assistant', content: 'Something went wrong. Try again in a moment.', model: 'error', fallback: true });
      saveHist(state.history);
      render(app);
    });
  }

  function openEntrySheet(id) {
    LahzaApp.api('/entries/' + encodeURIComponent(id)).then(function (r) {
      if (!r.body.ok) { window.toast('Entry not found', 'warn'); return; }
      var e = r.body.entry;
      LahzaApp.showSheet({
        title: LahzaApp.fmtDateLong(e.ts),
        body:
            '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">'
          +   '<span style="font-size:24px;">' + (LahzaApp.MOOD_EMOJI[e.mood] || '😐') + '</span>'
          +   '<span class="lz-mood-chip"><span class="lz-mood-dot ' + esc(e.mood) + '"></span>' + esc(LahzaApp.MOOD_LABEL[e.mood] || e.mood) + '</span>'
          + '</div>'
          + '<p style="font-size:14.5px;line-height:1.65;white-space:pre-wrap;color:var(--lz-ink);">' + esc(e.body) + '</p>'
      });
    });
  }
})();
