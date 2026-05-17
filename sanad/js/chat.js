/* chat.js - Customer chat widget for Sanad.
   Two render modes: embedded bubble + full-screen. AI streams replies
   with knowledge-base citations. "Talk to a human" creates a real
   ticket in the agent inbox. */
(function () {
  'use strict';
  var esc = SanadApp.escapeHtml;
  var $ = function (id) { return document.getElementById(id); };

  var state = {
    open: false,
    mode: 'embedded',   // 'embedded' | 'full'
    history: [],        // [{role: 'user'|'assistant', content: '...'}]
    typing: false,
    rated: false
  };

  // Persist history across reloads for realism
  var HIST_KEY = 'sanad.chat.history';
  function loadHist() { state.history = SanadApp.jget(HIST_KEY, []); }
  function saveHist() { SanadApp.jset(HIST_KEY, state.history); }

  // ---------- Mode badge ----------
  SanadAI.health().then(function (h) {
    var el = $('mode-badge');
    if (!el) return;
    var name = h.model.indexOf('haiku') !== -1 ? 'Haiku 4.5' : h.model.indexOf('sonnet') !== -1 ? 'Sonnet 4.6' : 'Opus 4.7';
    el.className = h.live ? 'snd-mode-badge live' : 'snd-mode-badge';
    el.textContent = h.live ? 'Live · ' + name : 'Demo mode';
    el.title = h.live ? 'Real Claude responses' : 'Pattern-matched mock replies';
  });

  // ---------- Render chat window ----------
  function greet() {
    var s = window.SANAD_DATA.SETTINGS;
    return { role: 'assistant', content: s.greeting || "👋 Hi! How can I help today?", greeting: true };
  }
  function ensureGreet() {
    if (!state.history.length) { state.history.push(greet()); saveHist(); }
  }
  function renderChat(hostId) {
    ensureGreet();
    var msgsHtml = state.history.map(function (m) {
      var isUser = m.role === 'user';
      return '<div class="snd-chat-msg' + (isUser ? ' out' : '') + '">'
        + (isUser ? '' : '<div class="snd-msg-avatar" style="background:linear-gradient(135deg,var(--snd-primary),var(--snd-mint-2));display:grid;place-items:center;color:white;font-weight:800;font-size:11px;">S</div>')
        + '<div>'
        +   '<div class="snd-chat-msg-bubble">' + esc(m.content).replace(/\n/g, '<br/>') + '</div>'
        +   (m.citations && m.citations.length ? '<div style="margin-top:4px;">' + m.citations.map(function (c) { return '<a class="snd-ai-cite" data-cite="' + (c.id || '') + '">📎 ' + esc(c.title) + '</a>'; }).join(' ') + '</div>' : '')
        + '</div>'
        + (isUser ? '<div class="snd-msg-avatar" style="background:var(--snd-surface-2);display:grid;place-items:center;color:var(--snd-ink);font-weight:700;font-size:11px;">You</div>' : '')
        + '</div>';
    }).join('');
    var typingHtml = state.typing ? '<div class="snd-chat-msg"><div class="snd-msg-avatar" style="background:linear-gradient(135deg,var(--snd-primary),var(--snd-mint-2));"></div><div class="snd-chat-typing"><span></span><span></span><span></span></div></div>' : '';
    var ratedHtml = state.rated ? '<div style="text-align:center;padding:10px;font-size:12px;color:var(--snd-mint);">Thanks for the feedback!</div>' : '';
    var ratePromptHtml = (state.history.length >= 4 && !state.rated) ? '<div style="text-align:center;padding:8px;font-size:11.5px;color:var(--snd-muted);">Was this helpful? <button class="snd-btn snd-btn--sm" data-rate="up">👍</button> <button class="snd-btn snd-btn--sm" data-rate="down">👎</button></div>' : '';

    var host = $(hostId);
    if (!host) return;
    host.innerHTML =
      '<div class="snd-chat-head">'
      +   '<div class="snd-msg-avatar" style="background:linear-gradient(135deg,var(--snd-primary),var(--snd-mint-2));display:grid;place-items:center;color:white;font-weight:800;width:32px;height:32px;font-size:14px;">S</div>'
      +   '<div class="snd-chat-head-info">'
      +     '<div class="name">Sanad assistant</div>'
      +     '<div class="sub">Usually replies in seconds · powered by Claude</div>'
      +   '</div>'
      +   (state.mode === 'embedded' ? '<button class="snd-modal-close" id="chat-close" style="color:var(--snd-muted);">×</button>' : '')
      + '</div>'
      + '<div class="snd-chat-body" id="chat-body">' + msgsHtml + typingHtml + '</div>'
      + ratePromptHtml + ratedHtml
      + '<div class="snd-chat-handoff">Want a human? <a href="#" id="chat-handoff">Open a ticket</a> · <a href="#" id="chat-reset">Start over</a></div>'
      + '<div class="snd-chat-foot">'
      +   '<div class="snd-chat-input-row">'
      +     '<textarea class="snd-chat-input" id="chat-input" placeholder="Type a message…" rows="1"></textarea>'
      +     '<button class="snd-chat-send" id="chat-send" disabled>➤</button>'
      +   '</div>'
      + '</div>';

    wireChat(hostId);
    var body = $('chat-body'); if (body) body.scrollTop = body.scrollHeight;
  }
  function wireChat(hostId) {
    var inp = $('chat-input'); var send = $('chat-send');
    if (inp) {
      inp.addEventListener('input', function () { send.disabled = !inp.value.trim(); });
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
      });
    }
    if (send) send.addEventListener('click', doSend);
    var close = $('chat-close');
    if (close) close.addEventListener('click', function () { state.open = false; closeWin(); });
    var ho = $('chat-handoff');
    if (ho) ho.addEventListener('click', function (e) { e.preventDefault(); handoff(); });
    var rs = $('chat-reset');
    if (rs) rs.addEventListener('click', function (e) { e.preventDefault(); state.history = []; state.rated = false; saveHist(); renderChat(hostId); });
    document.querySelectorAll('[data-rate]').forEach(function (b) {
      b.addEventListener('click', function () { state.rated = true; renderChat(hostId); window.toast('Thanks!', 'success'); });
    });
    document.querySelectorAll('[data-cite]').forEach(function (cit) {
      cit.addEventListener('click', function (e) { e.preventDefault(); openDrawer(cit.getAttribute('data-cite')); });
    });
  }

  function doSend() {
    var inp = $('chat-input');
    var v = inp.value.trim();
    if (!v) return;
    inp.value = '';
    state.history.push({ role: 'user', content: v });
    state.typing = true;
    saveHist();
    rerender();

    // KB-grounded reply via AI engine. We use the non-stream API for simplicity
    // in mock mode (mocks are instant); for live mode the engine still uses
    // non-stream by default which is fine for the demo length.
    SanadAI.kbAnswer({ question: v, history: state.history.slice(-6, -1) }).then(function (r) {
      // Realistic typewriter effect
      var fullText = r.text || '';
      state.typing = false;
      state.history.push({ role: 'assistant', content: '', citations: r.citations || [] });
      saveHist();
      rerender();
      typewriter(fullText, function (curr) {
        state.history[state.history.length - 1].content = curr;
        rerender();
      }, function () {
        saveHist();
      });
    });
  }
  function typewriter(text, onTick, onDone) {
    var i = 0;
    var step = Math.max(2, Math.floor(text.length / 60));
    var t = setInterval(function () {
      i += step;
      if (i >= text.length) { onTick(text); clearInterval(t); onDone && onDone(); return; }
      onTick(text.slice(0, i));
    }, 24);
  }
  function rerender() { renderChat(state.mode === 'embedded' ? 'chat-win-embedded' : 'chat-win-full'); }

  function openDrawer(id) {
    if (!id) return window.toast('No matching article', 'warn');
    SanadApp.api('/articles/' + id).then(function (r) {
      if (!r.body.ok) return window.toast('Article not found', 'warn');
      $('drawer-title').textContent = r.body.article.title;
      $('drawer-body').innerHTML = SanadApp.md(r.body.article.body_md);
      $('kb-drawer').classList.add('open');
    });
  }
  $('drawer-close').addEventListener('click', function () { $('kb-drawer').classList.remove('open'); });

  function handoff() {
    var v = ($('chat-input') ? $('chat-input').value.trim() : '') || (state.history.length ? state.history[state.history.length - 1].content : 'Customer requested human support');
    SanadApp.api('/conversations', {
      method: 'POST',
      body: {
        subject: 'From chat widget: ' + v.slice(0, 60),
        customer_id: 'cu-1',
        category_id: 'cat-general',
        first_message: v,
        channel: 'chat'
      }
    }).then(function (r) {
      window.toast('Ticket created. An agent will reply shortly.', 'success', 3500);
      state.history.push({ role: 'assistant', content: "I've handed you off to our team. Someone will reply within our business hours (Sun–Thu 09:00–18:00 GST). You'll get an email at the address on file." });
      saveHist(); rerender();
    });
  }

  // ---------- Open/close window ----------
  function openWin() {
    state.open = true;
    if (state.mode === 'embedded') {
      $('chat-win-embedded').classList.add('open');
      renderChat('chat-win-embedded');
    } else {
      renderChat('chat-win-full');
    }
  }
  function closeWin() {
    $('chat-win-embedded').classList.remove('open');
  }

  // ---------- View switcher ----------
  $('view-embed').addEventListener('click', function () {
    state.mode = 'embedded';
    $('view-embedded').style.display = '';
    $('view-fullscreen').style.display = 'none';
    $('view-embed').classList.add('snd-btn--primary');
    $('view-full').classList.remove('snd-btn--primary');
  });
  $('view-full').addEventListener('click', function () {
    state.mode = 'full';
    $('view-embedded').style.display = 'none';
    $('view-fullscreen').style.display = '';
    $('view-full').classList.add('snd-btn--primary');
    $('view-embed').classList.remove('snd-btn--primary');
    renderChat('chat-win-full');
  });
  $('bubble').addEventListener('click', function () { state.open ? closeWin() : openWin(); state.open = !state.open ? false : true; });

  // ---------- Init ----------
  loadHist();
  $('view-full').classList.add('snd-btn--primary');
  // Default: start in full-screen view so visitors see the chat immediately
  $('view-full').click();
})();
