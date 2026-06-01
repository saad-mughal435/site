/* chat.js - Ask Saad chat widget.
 *
 * Lifted from sanad/js/chat.js, trimmed for the homepage use case:
 * floating bubble + chat window only (no full-screen view, no local-Qwen
 * toggle, no "talk to a human" handoff). Adds [doc-id] parsing for
 * citation chips that drill into the relevant demo / section / source.
 *
 * Appends #ask-bubble and #ask-window to document.body once (sits as a
 * sibling of #root so it never collides with the React tree). Persists
 * history under ask.chat.* with a HIST_VERSION key for safe schema migration.
 */
(function () {
  'use strict';
  var esc = AskApp.escapeHtml;

  // ----- History persistence -----------------------------------------------
  var HIST_VERSION = 'v1';
  var HIST_VERSION_KEY = 'ask.chat.histVersion';
  var HIST_KEY = 'ask.chat.history';
  var OPEN_KEY = 'ask.chat.wasOpen';

  var state = {
    open: false,
    history: [],
    typing: false,
    generating: false,
    pendingMode: null
  };

  function loadHist() {
    var stored = AskApp.jget(HIST_VERSION_KEY, null);
    if (stored !== HIST_VERSION) {
      try { localStorage.removeItem(HIST_KEY); } catch (e) {}
      AskApp.jset(HIST_VERSION_KEY, HIST_VERSION);
      state.history = [];
      return;
    }
    state.history = AskApp.jget(HIST_KEY, []);
  }
  function saveHist() { AskApp.jset(HIST_KEY, state.history); }

  // ----- Render --------------------------------------------------------------
  var STARTERS = [
    "Does he know Python?",
    "What did he build at Kingsley?",
    "Can he relocate?",
    "Tell me about the Watad demo"
  ];

  function greetingHtml() {
    return ''
      + '<div class="ask-greeting-strip">'
      +   "👋 Hi! I'm <strong>Ask Saad</strong> — an AI grounded in Saad's portfolio, CV, and demos. "
      +   "Ask me anything about his experience, skills, or projects. Each answer cites where it came from."
      + '</div>';
  }

  function startersHtml() {
    return '<div class="ask-starters">'
      + STARTERS.map(function (q) { return '<button class="ask-starter" data-starter="' + esc(q) + '">' + esc(q) + '</button>'; }).join('')
      + '</div>';
  }

  // Parse [doc-id] markers out of the assistant's text and replace with
  // sup-style anchor spans we can render as chips below the bubble.
  function renderAssistantText(text, citationMap) {
    var cited = {};
    var stripped = String(text || '').replace(/\[([a-z0-9-]+)\]/g, function (m, id) {
      if (citationMap[id]) cited[id] = true;
      return '';
    }).replace(/\s+([.,!?])/g, '$1').trim();
    // Return both the cleaned text and the ordered list of citations that appeared.
    return {
      html: esc(stripped).replace(/\n/g, '<br/>'),
      cited: Object.keys(cited)
    };
  }

  function renderMsg(m, mIdx, citationMap) {
    var isUser = m.role === 'user';
    if (isUser) {
      return '<div class="ask-msg out">'
        + '<div class="ask-bubble-msg">' + esc(m.content).replace(/\n/g, '<br/>') + '</div>'
        + '<div class="ask-msg-avatar">You</div>'
        + '</div>';
    }
    if (m.greeting) {
      return greetingHtml() + (state.history.length === 1 ? startersHtml() : '');
    }
    var parsed = renderAssistantText(m.content || '', citationMap || {});
    var citeRow = '';
    var pickFrom = (m.citations && m.citations.length) ? m.citations : [];
    // If the assistant text contained explicit [doc-id]s, restrict to those;
    // otherwise show all retrieved citations (mock mode may include them all).
    if (parsed.cited.length) {
      pickFrom = pickFrom.filter(function (c) { return parsed.cited.indexOf(c.id) !== -1; });
    }
    if (pickFrom.length) {
      citeRow = '<div class="ask-cites">'
        + pickFrom.map(function (c) { return '<button type="button" class="ask-cite" data-cite="' + esc(c.id) + '">📎 ' + esc(c.title) + '</button>'; }).join('')
        + '</div>';
    }
    var rated = m.rating;
    var feedback = ''
      + '<div class="ask-feedback">'
      +   '<button class="up' + (rated === 'up' ? ' on' : '') + '" data-mrate="up" data-midx="' + mIdx + '" title="Helpful">👍</button>'
      +   '<button class="down' + (rated === 'down' ? ' on' : '') + '" data-mrate="down" data-midx="' + mIdx + '" title="Not helpful">👎</button>'
      + '</div>';
    var meta = m.model ? '<div class="ask-meta-line">' + esc(m.model) + (m.fallback ? ' · mock' : '') + (m.latency_ms ? ' · ' + m.latency_ms + 'ms' : '') + '</div>' : '';
    return '<div class="ask-msg">'
      + '<div class="ask-msg-avatar">S</div>'
      + '<div style="min-width:0;">'
      +   '<div class="ask-bubble-msg">' + parsed.html + '</div>'
      +   citeRow
      +   feedback
      +   meta
      + '</div>'
      + '</div>';
  }

  function ensureGreet() {
    if (!state.history.length) {
      state.history.push({ role: 'assistant', greeting: true });
      saveHist();
    }
  }

  function render() {
    var win = document.getElementById('ask-window');
    if (!win) return;

    // Citation lookup map keyed by doc-id (from corpus)
    var citationMap = {};
    window.AskCorpus.docs.forEach(function (d) { citationMap[d.id] = { id: d.id, title: d.title, link: d.link, scrollTo: d.scrollTo }; });

    var msgsHtml = state.history.map(function (m, i) {
      // Inject citations from the message into the lookup too (in case they
      // weren't in the corpus, e.g. for future remote docs).
      if (m.citations) m.citations.forEach(function (c) { if (!citationMap[c.id]) citationMap[c.id] = c; });
      return renderMsg(m, i, citationMap);
    }).join('');

    var typingHtml = state.typing
      ? '<div class="ask-msg"><div class="ask-msg-avatar">S</div><div class="ask-typing"><span></span><span></span><span></span></div></div>'
      : '';

    win.innerHTML =
        '<div class="ask-head">'
      +   '<div class="ask-avatar">S</div>'
      +   '<div class="ask-head-info">'
      +     '<div class="name">Ask Saad</div>'
      +     '<div class="sub">AI · grounded in his portfolio</div>'
      +   '</div>'
      +   '<span class="ask-mode-badge" id="ask-mode-badge" title="Loading mode…">…</span>'
      +   '<button class="ask-close" id="ask-close" aria-label="Close chat">×</button>'
      + '</div>'
      + '<div class="ask-body" id="ask-body">' + msgsHtml + typingHtml + '</div>'
      + '<div class="ask-foot">'
      +   '<div class="ask-foot-reset"><a id="ask-reset">Start over</a> · powered by Claude · saad@saadm.dev</div>'
      +   '<div class="ask-input-row">'
      +     '<textarea class="ask-input" id="ask-input" placeholder="Ask anything about Saad…" rows="1"' + (state.generating ? ' disabled' : '') + '></textarea>'
      +     '<button class="ask-send" id="ask-send" aria-label="Send" disabled>↑</button>'
      +   '</div>'
      + '</div>';

    wire();
    var body = document.getElementById('ask-body');
    if (body) body.scrollTop = body.scrollHeight;

    // Refresh mode badge
    AskAI.health().then(function (h) {
      var el = document.getElementById('ask-mode-badge');
      if (!el) return;
      var nm = h.model.indexOf('haiku') !== -1 ? 'Haiku 4.5' : h.model.indexOf('sonnet') !== -1 ? 'Sonnet 4.6' : 'Opus 4.7';
      el.className = h.live ? 'ask-mode-badge live' : 'ask-mode-badge';
      el.textContent = h.live ? 'Live · ' + nm : 'Demo mode';
      el.title = h.live ? 'Real Claude responses via Worker proxy' : 'Pattern-matched mock replies — see ask/README.md';
    });
  }

  function wire() {
    var inp = document.getElementById('ask-input');
    var send = document.getElementById('ask-send');
    var close = document.getElementById('ask-close');
    var reset = document.getElementById('ask-reset');

    if (inp) {
      inp.addEventListener('input', function () {
        send.disabled = !inp.value.trim();
        // Auto-grow textarea up to max-height (CSS limits to 120px)
        inp.style.height = 'auto';
        inp.style.height = Math.min(120, inp.scrollHeight) + 'px';
      });
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
      });
    }
    if (send) send.addEventListener('click', doSend);
    if (close) close.addEventListener('click', function () { closeWin(); });
    if (reset) reset.addEventListener('click', function (e) {
      e.preventDefault();
      state.history = [];
      saveHist();
      ensureGreet();
      render();
    });

    // Starter chips
    document.querySelectorAll('[data-starter]').forEach(function (b) {
      b.addEventListener('click', function () {
        var q = b.getAttribute('data-starter');
        inp.value = q;
        send.disabled = false;
        doSend();
      });
    });

    // Citation chips: open link if present, else smooth-scroll, else show source modal
    document.querySelectorAll('[data-cite]').forEach(function (cit) {
      cit.addEventListener('click', function (e) {
        e.preventDefault();
        var id = cit.getAttribute('data-cite');
        openCitation(id);
      });
    });

    // 👍/👎 feedback
    document.querySelectorAll('[data-mrate]').forEach(function (b) {
      b.addEventListener('click', function () {
        var idx = +b.getAttribute('data-midx');
        var rating = b.getAttribute('data-mrate');
        if (!state.history[idx]) return;
        // Toggle: clicking same rating unsets it
        if (state.history[idx].rating === rating) state.history[idx].rating = null;
        else state.history[idx].rating = rating;
        saveHist();
        AskAI.rateMessage(rating, { feature: 'answer', model: state.history[idx].model || 'unknown', fallback: !!state.history[idx].fallback });
        if (window.toast) window.toast(rating === 'up' ? 'Thanks — logged as helpful' : 'Logged as not helpful', rating === 'up' ? 'success' : 'warn', 1800);
        render();
      });
    });
  }

  function openCitation(id) {
    var doc = window.AskCorpus.byId(id);
    if (!doc) { if (window.toast) window.toast('Source not found', 'warn'); return; }
    if (doc.link) {
      // External-style link: open the demo / page in a new tab
      window.open(doc.link, '_blank', 'noopener');
      return;
    }
    if (doc.scrollTo) {
      // Internal anchor on the homepage — resolve the target BEFORE closing the
      // chat so a missing anchor degrades to the modal fallback below instead of
      // silently closing the window with nothing to scroll to.
      var el = document.querySelector(doc.scrollTo);
      if (el) {
        closeWin();
        setTimeout(function () {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 220);
        return;
      }
      // else fall through to the modal fallback below
    }
    // Fallback: show the doc body in a modal
    AskApp.showModal({
      title: '📎 ' + doc.title,
      body: '<p style="font-size:13.5px;line-height:1.65;color:var(--ask-ink-2);margin:0;">' + esc(doc.body) + '</p>',
      foot: '<button class="ask-modal-close" data-modal-close style="background:linear-gradient(135deg,var(--ask-cyan),var(--ask-cyan-2));color:white;padding:6px 14px;border-radius:6px;font-weight:600;font-size:13px;">Close</button>'
    });
  }

  // ----- Send a question ---------------------------------------------------
  function doSend() {
    var inp = document.getElementById('ask-input');
    if (!inp) return;
    var v = inp.value.trim();
    if (!v) return;
    inp.value = '';
    inp.style.height = 'auto';
    state.history.push({ role: 'user', content: v });
    state.typing = true;
    state.generating = true;
    saveHist();
    render();

    var historyForApi = state.history.slice(-6, -1);

    AskAI.answer({ question: v, history: historyForApi }).then(function (r) {
      var fullText = r.text || '';
      state.typing = false;
      state.history.push({
        role: 'assistant',
        content: '',
        citations: r.citations || [],
        model: r.model || 'mock',
        fallback: !!r.fallback,
        latency_ms: r.latency_ms,
        rating: null
      });
      saveHist();
      render();
      typewriter(fullText, function (curr) {
        state.history[state.history.length - 1].content = curr;
        render();
      }, function () {
        state.generating = false;
        saveHist();
        render();
        // Announce the completed answer once into the stable live region.
        var live = document.getElementById('ask-live');
        if (live) live.textContent = String(fullText).replace(/\[([a-z0-9-]+)\]/g, '').replace(/\s+([.,!?])/g, '$1').trim();
      });
    }).catch(function (err) {
      console.error('AskAI.answer failed', err);
      state.typing = false;
      state.generating = false;
      var errMsg = "Sorry, something went wrong — please try again or email saad@saadm.dev directly.";
      state.history.push({ role: 'assistant', content: errMsg, citations: [], model: 'error', fallback: true });
      saveHist();
      render();
      // Announce the failure so screen-reader users aren't left waiting silently.
      var live = document.getElementById('ask-live');
      if (live) live.textContent = errMsg;
    });
  }

  function typewriter(text, onTick, onDone) {
    var i = 0;
    var step = Math.max(2, Math.floor(text.length / 70));
    var t = setInterval(function () {
      i += step;
      if (i >= text.length) { onTick(text); clearInterval(t); onDone && onDone(); return; }
      onTick(text.slice(0, i));
    }, 22);
  }

  // ----- Open / close -------------------------------------------------------
  function openWin() {
    state.open = true;
    AskApp.jset(OPEN_KEY, true);
    var win = document.getElementById('ask-window');
    var bub = document.getElementById('ask-bubble');
    if (!win || !bub) return;
    ensureGreet();
    win.classList.add('open');
    // Flag the open chat on <body> so the host page can hide other
    // bottom-right fixed controls (e.g. .back-to-top) while the window is up.
    document.body.classList.add('ask-open');
    bub.setAttribute('aria-expanded', 'true');
    render();
    setTimeout(function () {
      var inp = document.getElementById('ask-input');
      if (inp) inp.focus();
    }, 220);
  }
  function closeWin() {
    state.open = false;
    AskApp.jset(OPEN_KEY, false);
    var win = document.getElementById('ask-window');
    var bub = document.getElementById('ask-bubble');
    if (win) win.classList.remove('open');
    document.body.classList.remove('ask-open');
    if (bub) bub.setAttribute('aria-expanded', 'false');
  }

  // ----- Mount once on DOM ready -------------------------------------------
  function mount() {
    if (document.getElementById('ask-bubble')) return;  // already mounted

    var bubble = document.createElement('button');
    bubble.id = 'ask-bubble';
    bubble.className = 'ask-bubble';
    bubble.setAttribute('aria-label', 'Open Ask Saad chat');
    bubble.setAttribute('aria-expanded', 'false');
    bubble.innerHTML = '<span aria-hidden="true">✦</span><span class="ask-bubble-pulse" aria-hidden="true"></span>';
    document.body.appendChild(bubble);

    var win = document.createElement('div');
    win.id = 'ask-window';
    win.className = 'ask-window';
    win.setAttribute('role', 'dialog');
    win.setAttribute('aria-label', 'Ask Saad chat');
    document.body.appendChild(win);

    // Stable, persistent, off-screen live region. render() rewrites the whole
    // #ask-window every tick, so a live region inside it would never announce
    // (and would re-announce on every typewriter tick). This node is created
    // once and we write the final answer text into it exactly once on done.
    var live = document.createElement('div');
    live.id = 'ask-live';
    live.setAttribute('role', 'status');
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('aria-atomic', 'true');
    live.style.cssText = 'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);border:0;white-space:nowrap;';
    document.body.appendChild(live);

    bubble.addEventListener('click', function () { state.open ? closeWin() : openWin(); });

    loadHist();

    // Expose a tiny API so the hero CTA pill + contact-page button can open
    // the chat and optionally pre-fill the input.
    window.AskChat = {
      open: function (prefill) {
        openWin();
        if (prefill) {
          setTimeout(function () {
            var inp = document.getElementById('ask-input');
            if (inp) {
              inp.value = prefill;
              inp.dispatchEvent(new Event('input'));
              inp.focus();
            }
          }, 260);
        }
      },
      close: closeWin
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
