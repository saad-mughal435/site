/* inbox.js - Agent inbox for Sanad.
   Three columns: conversation list (left), thread (centre), AI Copilot
   sidebar (right). Search + filter chips on the list. Reply composer
   with internal-note toggle. AI sidebar produces reply suggestions,
   summaries, sentiment, category, translate. */
(function () {
  'use strict';
  var esc = SanadApp.escapeHtml;
  var md = SanadApp.md;
  var initials = SanadApp.initialsOf;
  var $ = function (id) { return document.getElementById(id); };

  var state = {
    filter: 'all',
    q: '',
    activeId: null,
    conv: null,                // {conversation, messages}
    composer: '',
    isInternal: false,
    ai: { reply: null, summary: null, sentiment: null, category: null },
    translated: null,          // last AI translation of customer's latest msg
    showTranslated: false
  };

  // ---------- Mode badge ----------
  function renderModeBadge() {
    SanadAI.health().then(function (h) {
      var el = $('mode-badge');
      var modelName = h.model.indexOf('haiku') !== -1 ? 'Haiku 4.5'
                    : h.model.indexOf('sonnet') !== -1 ? 'Sonnet 4.6'
                    : h.model.indexOf('opus') !== -1 ? 'Opus 4.7' : h.model;
      if (h.live) {
        el.className = 'snd-mode-badge live';
        el.textContent = 'Live · ' + modelName;
        el.title = 'Connected to Claude via the Worker proxy. Each call costs ~$0.001.';
      } else {
        el.className = 'snd-mode-badge';
        el.textContent = 'Demo mode';
        el.title = 'No Worker / API key configured. Showing deterministic mock replies. See sanad/README.md to enable live mode.';
      }
    });
  }

  // ---------- List ----------
  var FILTERS = [
    { id: 'all',        label: 'All' },
    { id: 'open',       label: 'Open' },
    { id: 'pending',    label: 'Pending' },
    { id: 'snoozed',    label: 'Snoozed' },
    { id: 'closed',     label: 'Closed' },
    { id: 'escalated',  label: 'Escalated' }
  ];
  function renderFilters() {
    $('cv-filters').innerHTML = FILTERS.map(function (f) {
      return '<button class="snd-inbox-filter' + (state.filter === f.id ? ' is-active' : '') + '" data-f="' + f.id + '">' + f.label + '</button>';
    }).join('');
    $('cv-filters').querySelectorAll('[data-f]').forEach(function (b) {
      b.addEventListener('click', function () { state.filter = b.getAttribute('data-f'); renderFilters(); loadList(); });
    });
  }
  function loadList() {
    var qParts = ['?'];
    if (state.filter !== 'all') qParts.push('status=' + state.filter);
    if (state.q) qParts.push('q=' + encodeURIComponent(state.q));
    SanadApp.api('/conversations' + qParts.join('&').replace('?&', '?')).then(function (r) {
      renderList(r.body.items);
    });
  }
  function renderList(rows) {
    var custMap = {};
    window.SANAD_DATA.CUSTOMERS.forEach(function (c) { custMap[c.id] = c; });
    var el = $('cv-list');
    if (!rows.length) {
      el.innerHTML = '<div class="snd-empty"><div class="snd-empty-mark">📭</div>No conversations match.</div>';
      return;
    }
    el.innerHTML = rows.map(function (c) {
      var cu = custMap[c.customer_id] || { name: '?' };
      var avatarStyle = cu.avatar ? 'background-image:url(' + cu.avatar + ');' : '';
      return '<div class="snd-conv' + (state.activeId === c.id ? ' is-active' : '') + '" data-id="' + c.id + '">'
        + '<div class="snd-conv-avatar" style="' + avatarStyle + '">' + (cu.avatar ? '' : initials(cu.name)) + '</div>'
        + '<div class="snd-conv-body">'
        +   '<div class="snd-conv-head">'
        +     '<span class="snd-conv-name">' + esc(cu.name) + '</span>'
        +     '<span class="snd-conv-time">' + SanadApp.timeAgo(c.last_message_at) + '</span>'
        +   '</div>'
        +   '<div class="snd-conv-preview">' + esc(c.subject) + ' · ' + esc((c.preview || '').slice(0, 60)) + '</div>'
        + '</div>'
        + '<div class="snd-conv-meta">'
        +   (c.unread_count ? '<span class="snd-conv-unread">' + c.unread_count + '</span>' : '')
        +   '<span class="snd-conv-sent-dot ' + (c.sentiment || 'neu') + '" title="Sentiment: ' + (c.sentiment || 'neu') + '"></span>'
        + '</div>'
        + '</div>';
    }).join('');
    el.querySelectorAll('[data-id]').forEach(function (el2) {
      el2.addEventListener('click', function () { openConv(el2.getAttribute('data-id')); });
    });
  }

  // ---------- Thread ----------
  function openConv(id) {
    state.activeId = id;
    state.composer = '';
    state.isInternal = false;
    state.ai = { reply: null, summary: null, sentiment: null, category: null };
    state.translated = null; state.showTranslated = false;
    // Refresh the list to show the active highlight
    var actives = document.querySelectorAll('.snd-conv.is-active');
    actives.forEach(function (a) { a.classList.remove('is-active'); });
    var el = document.querySelector('[data-id="' + id + '"]');
    if (el) el.classList.add('is-active');

    SanadApp.api('/conversations/' + id).then(function (r) {
      if (!r.body.ok) { renderEmpty('Conversation not found'); return; }
      state.conv = r.body;
      renderThread();
      runAI();
    });
  }
  function renderEmpty(msg) {
    $('thread').innerHTML = '<div class="snd-thread-empty"><div style="font-size:42px;opacity:.3;margin-bottom:10px;">💬</div>' + esc(msg || 'Select a conversation from the list to begin.') + '</div>';
    $('ai-cards').innerHTML = '<div class="snd-empty"><div class="snd-empty-mark">✦</div>AI suggestions will appear here once you open a conversation.</div>';
  }
  function renderThread() {
    var c = state.conv.conversation;
    var msgs = state.conv.messages.slice();
    var custMap = {}; window.SANAD_DATA.CUSTOMERS.forEach(function (x) { custMap[x.id] = x; });
    var agMap = {}; window.SANAD_DATA.AGENTS.forEach(function (x) { agMap[x.id] = x; });
    var cu = custMap[c.customer_id] || { name: '?' };

    // Group by day
    var byDay = {};
    msgs.forEach(function (m) {
      var d = new Date(m.created_at).toDateString();
      (byDay[d] = byDay[d] || []).push(m);
    });
    var dayKeys = Object.keys(byDay);

    var lastInBoundIdx = -1;
    for (var i = msgs.length - 1; i >= 0; i--) if (msgs[i].author_type === 'customer') { lastInBoundIdx = i; break; }

    $('thread').innerHTML =
      '<div class="snd-thread-head">'
      +   '<div class="snd-conv-avatar" style="width:40px;height:40px;' + (cu.avatar ? 'background-image:url(' + cu.avatar + ');' : '') + '">' + (cu.avatar ? '' : initials(cu.name)) + '</div>'
      +   '<div class="snd-thread-customer" style="flex:1;min-width:0;">'
      +     '<div>'
      +       '<div class="snd-thread-customer-name">' + esc(cu.name) + ' <span class="snd-priority ' + c.priority + '" style="margin-inline-start:6px;">' + c.priority + '</span></div>'
      +       '<div class="snd-thread-customer-sub">' + esc(cu.email) + ' · ' + (cu.tier || 'free') + ' · joined ' + SanadApp.fmtDate(cu.joined_at) + (c.locale === 'ar' ? ' · 🌐 العربية' : '') + '</div>'
      +     '</div>'
      +   '</div>'
      +   '<div class="snd-thread-actions">'
      +     '<span class="snd-chip ' + c.status + '">' + c.status + '</span>'
      +     '<button class="snd-btn snd-btn--sm" id="t-snooze">Snooze</button>'
      +     '<button class="snd-btn snd-btn--sm" id="t-close">' + (c.status === 'closed' ? 'Reopen' : 'Close') + '</button>'
      +   '</div>'
      + '</div>'
      + '<div class="snd-thread-body" id="t-body">'
      +   dayKeys.map(function (day) {
            return '<div class="snd-day-sep">' + SanadApp.fmtDate(byDay[day][0].created_at) + '</div>'
              + byDay[day].map(function (m, mIdx) {
                  var isOut = m.author_type === 'agent' || m.author_type === 'ai';
                  var person = isOut ? (agMap[m.author_id] || { name: 'Agent' }) : cu;
                  var avatarStyle = person.photo || person.avatar ? 'background-image:url(' + (person.photo || person.avatar) + ');' : '';
                  var body = m.body;
                  var showTranslated = (m === msgs[lastInBoundIdx]) && state.showTranslated && state.translated;
                  if (showTranslated) body = state.translated + '\n\n— translated from ' + (c.locale === 'ar' ? 'Arabic' : c.locale);
                  return '<div class="snd-msg' + (isOut ? ' out' : '') + '">'
                    + '<div class="snd-msg-avatar" style="' + avatarStyle + '">' + ((person.photo || person.avatar) ? '' : initials(person.name)) + '</div>'
                    + '<div>'
                    +   (m.author_type === 'ai' ? '<span class="snd-msg-ai-tag">AI</span>' : '')
                    +   '<div class="snd-msg-bubble' + (m.internal_note ? ' internal' : '') + '">' + esc(body).replace(/\n/g, '<br/>') + '</div>'
                    +   '<div class="snd-msg-time">' + esc(person.name) + ' · ' + SanadApp.fmtTime(m.created_at) + (m.internal_note ? ' · 🔒 internal note' : '') + '</div>'
                    + '</div>'
                    + '</div>';
                }).join('');
          }).join('')
      + '</div>'
      + composerHtml();

    wireThread();
    setTimeout(function () { var b = $('t-body'); if (b) b.scrollTop = b.scrollHeight; }, 10);
  }
  function composerHtml() {
    return '<div class="snd-composer">'
      + '<div class="snd-composer-bar">'
      +   '<button id="cb-internal" class="' + (state.isInternal ? 'is-active' : '') + '" title="Mark next message as an internal note">🔒 Internal note</button>'
      +   '<button id="cb-kb" title="Insert a knowledge-base link">📎 KB</button>'
      +   '<span style="margin-inline-start:auto;font-size:11px;color:var(--snd-muted);">⌘ + Enter to send</span>'
      + '</div>'
      + '<div class="snd-composer-box' + (state.isInternal ? ' internal' : '') + '">'
      +   '<textarea class="snd-composer-input" id="cb-input" placeholder="' + (state.isInternal ? 'Internal note (not sent to customer)…' : 'Write a reply…') + '" rows="2">' + esc(state.composer) + '</textarea>'
      +   '<button class="snd-composer-send" id="cb-send" ' + (state.composer.trim() ? '' : 'disabled') + '>Send</button>'
      + '</div>'
      + '</div>';
  }
  function wireThread() {
    var inp = $('cb-input');
    inp.addEventListener('input', function () {
      state.composer = inp.value;
      $('cb-send').disabled = !state.composer.trim();
    });
    inp.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); send(); }
    });
    $('cb-internal').addEventListener('click', function () {
      state.isInternal = !state.isInternal; renderThread(); $('cb-input').focus();
    });
    $('cb-kb').addEventListener('click', function () { insertKBLink(); });
    $('cb-send').addEventListener('click', send);
    $('t-close').addEventListener('click', function () { toggleClose(); });
    $('t-snooze').addEventListener('click', function () { snooze(); });
  }
  function send() {
    var body = state.composer.trim();
    if (!body) return;
    SanadApp.api('/conversations/' + state.activeId + '/messages', {
      method: 'POST',
      body: { author_type: 'agent', author_id: 'ag-fatima', body: body, internal_note: state.isInternal }
    }).then(function () {
      state.composer = '';
      // Auto-translate the reply back to customer's locale before sending (optional)
      if (state.conv.conversation.locale === 'ar' && !state.isInternal && !/^\(/.test(body)) {
        SanadAI.translate(body, 'ar').then(function (t) {
          window.toast('Reply auto-translated to Arabic', 'success');
        });
      }
      openConv(state.activeId);
    });
  }
  function toggleClose() {
    var newStatus = state.conv.conversation.status === 'closed' ? 'open' : 'closed';
    SanadApp.api('/conversations/' + state.activeId + '/status', { method: 'POST', body: { status: newStatus } })
      .then(function () { window.toast('Status → ' + newStatus, 'success'); openConv(state.activeId); loadList(); });
  }
  function snooze() {
    SanadApp.api('/conversations/' + state.activeId + '/status', { method: 'POST', body: { status: 'snoozed' } })
      .then(function () { window.toast('Snoozed', 'success'); openConv(state.activeId); loadList(); });
  }
  function insertKBLink() {
    SanadApp.api('/articles').then(function (r) {
      var arts = r.body.items.slice(0, 30);
      var body = '<div class="snd-field"><span>Pick an article</span><select class="snd-select" id="kb-pick">'
        + arts.map(function (a) { return '<option value="' + a.id + '">' + esc(a.title) + '</option>'; }).join('')
        + '</select></div>';
      SanadApp.showModal({
        title: 'Insert KB link', body: body,
        foot: '<button class="snd-btn" data-modal-close>Cancel</button><button class="snd-btn snd-btn--primary" id="kb-go">Insert</button>',
        onMount: function (el, close) {
          el.querySelector('#kb-go').addEventListener('click', function () {
            var pick = el.querySelector('#kb-pick').value;
            var art = arts.find(function (a) { return a.id === pick; });
            state.composer = (state.composer + ' ' + art.title + ' — /kb/' + art.slug).trim();
            renderThread(); close();
          });
        }
      });
    });
  }

  // ---------- AI sidebar ----------
  function runAI() {
    var conv = state.conv;
    renderAI();
    SanadAI.replySuggestion(conv).then(function (r) { state.ai.reply = r; renderAI(); });
    SanadAI.summarize(conv).then(function (r) { state.ai.summary = r; renderAI(); });
    var lastCu = lastCustomerMsg(conv.messages);
    if (lastCu) {
      SanadAI.sentiment(lastCu).then(function (r) { state.ai.sentiment = r; renderAI(); });
      SanadAI.categorize(lastCu).then(function (r) { state.ai.category = r; renderAI(); });
    }
  }
  function lastCustomerMsg(msgs) {
    for (var i = msgs.length - 1; i >= 0; i--) if (msgs[i].author_type === 'customer') return msgs[i].body;
    return null;
  }
  function renderAI() {
    var ai = state.ai;
    var conv = state.conv && state.conv.conversation;
    if (!conv) { renderEmpty('Select a conversation from the list to begin.'); return; }
    var catMap = {}; window.SANAD_DATA.CATEGORIES.forEach(function (c) { catMap[c.id] = c; });
    var html = '';

    // Reply
    html += '<div class="snd-ai-card">'
      + '<div class="snd-ai-card-head"><span class="snd-icon">✦</span>Suggested reply'
      +   (ai.reply ? '' : '<span class="snd-ai-loading"></span>')
      +   (ai.reply && ai.reply.fallback ? '<span class="snd-mode-badge" style="margin-inline-start:auto;padding:1px 8px;font-size:9.5px;">mock</span>' : '')
      + '</div>';
    if (ai.reply) {
      html += '<div class="snd-ai-reply">' + esc(ai.reply.text) + '</div>';
      if (ai.reply.citations && ai.reply.citations.length) {
        html += '<div class="snd-ai-actions">' + ai.reply.citations.map(function (c) { return '<a class="snd-ai-cite" href="kb.html#/article/' + (c.id || '') + '" target="_blank">📎 ' + esc(c.title) + '</a>'; }).join('') + '</div>';
      }
      html += '<div class="snd-ai-actions">'
        + '<button class="snd-btn snd-btn--sm snd-btn--primary" id="ai-insert">Insert</button>'
        + '<button class="snd-btn snd-btn--sm" id="ai-regen">Regenerate</button>'
        + '</div>';
    }
    html += '</div>';

    // Summary (only when thread > 4 msgs)
    if (state.conv.messages.length >= 4) {
      html += '<div class="snd-ai-card">'
        + '<div class="snd-ai-card-head"><span class="snd-icon">📝</span>Summary' + (ai.summary ? '' : '<span class="snd-ai-loading"></span>') + '</div>'
        + (ai.summary ? '<div class="snd-ai-card-body">' + esc(ai.summary.summary) + '</div>'
            + '<div style="margin-top:6px;">' + (ai.summary.topics || []).map(function (t) { return '<span class="snd-topic-tag">' + esc(t) + '</span>'; }).join('') + '</div>'
          : '')
        + '</div>';
    }

    // Sentiment
    html += '<div class="snd-ai-card">'
      + '<div class="snd-ai-card-head"><span class="snd-icon">😊</span>Sentiment' + (ai.sentiment ? '' : '<span class="snd-ai-loading"></span>') + '</div>';
    if (ai.sentiment) {
      var lbl = { pos: '😊 Positive', neu: '😐 Neutral', neg: '😟 Negative' }[ai.sentiment.label] || ai.sentiment.label;
      var pct = Math.abs(ai.sentiment.score) * 100;
      var col = ai.sentiment.label === 'pos' ? 'var(--snd-pos)' : ai.sentiment.label === 'neg' ? 'var(--snd-neg)' : 'var(--snd-neu)';
      html += '<div class="snd-ai-card-body">' + lbl + ' <span style="color:var(--snd-muted);font-family:var(--font-mono);font-size:11.5px;">' + ai.sentiment.score.toFixed(2) + '</span>'
        + '<div class="snd-sent-bar"><div class="snd-sent-bar-fill" style="width:' + pct.toFixed(0) + '%;background:' + col + ';"></div></div>'
        + '</div>';
    }
    html += '</div>';

    // Category
    html += '<div class="snd-ai-card">'
      + '<div class="snd-ai-card-head"><span class="snd-icon">🏷</span>Category' + (ai.category ? '' : '<span class="snd-ai-loading"></span>') + '</div>';
    if (ai.category) {
      var cat = catMap[ai.category.category_id] || { name: ai.category.category_id, icon: '?', color: '#94a3b8' };
      html += '<div class="snd-ai-card-body"><span class="snd-topic-tag" style="background:' + cat.color + '22;color:' + cat.color + ';">' + cat.icon + ' ' + esc(cat.name) + '</span> <span style="color:var(--snd-muted);font-family:var(--font-mono);font-size:11.5px;">conf ' + (ai.category.confidence * 100).toFixed(0) + '%</span></div>';
    }
    html += '</div>';

    // Translate (only when customer locale != en)
    if (conv.locale === 'ar') {
      html += '<div class="snd-ai-card">'
        + '<div class="snd-ai-card-head"><span class="snd-icon">🌐</span>Translate</div>'
        + '<div class="snd-ai-card-body">Customer is writing in Arabic.</div>'
        + '<div class="snd-ai-actions"><button class="snd-btn snd-btn--sm" id="ai-translate">' + (state.showTranslated ? 'Show original' : 'Show English') + '</button></div>'
        + '</div>';
    }

    // Quick actions
    html += '<div class="snd-ai-card">'
      + '<div class="snd-ai-card-head"><span class="snd-icon">⚡</span>Quick actions</div>'
      + '<div class="snd-ai-actions">'
      +   '<button class="snd-btn snd-btn--sm" id="ai-escalate">Escalate</button>'
      +   '<button class="snd-btn snd-btn--sm" id="ai-snooze-1h">Snooze 1h</button>'
      +   '<button class="snd-btn snd-btn--sm snd-btn--mint" id="ai-close-resolved">Mark resolved</button>'
      + '</div>'
      + '</div>';

    $('ai-cards').innerHTML = html;

    if (ai.reply) {
      var ins = $('ai-insert');
      var reg = $('ai-regen');
      if (ins) ins.addEventListener('click', function () { state.composer = ai.reply.text; renderThread(); });
      if (reg) reg.addEventListener('click', function () {
        state.ai.reply = null; renderAI();
        SanadAI.replySuggestion(state.conv).then(function (r) { state.ai.reply = r; renderAI(); });
      });
    }
    var tr = $('ai-translate');
    if (tr) tr.addEventListener('click', function () {
      var lastCu = lastCustomerMsg(state.conv.messages);
      if (!state.translated) {
        SanadAI.translate(lastCu, 'en').then(function (t) { state.translated = t.translated; state.showTranslated = true; renderThread(); renderAI(); });
      } else {
        state.showTranslated = !state.showTranslated; renderThread(); renderAI();
      }
    });
    var esc1 = $('ai-escalate');
    if (esc1) esc1.addEventListener('click', function () {
      SanadApp.api('/conversations/' + state.activeId, { method: 'PUT', body: { priority: 'urgent', status: 'escalated' } })
        .then(function () { window.toast('Escalated', 'warn'); openConv(state.activeId); loadList(); });
    });
    var sn1 = $('ai-snooze-1h');
    if (sn1) sn1.addEventListener('click', snooze);
    var rs = $('ai-close-resolved');
    if (rs) rs.addEventListener('click', function () {
      SanadApp.api('/conversations/' + state.activeId + '/status', { method: 'POST', body: { status: 'closed' } })
        .then(function () { window.toast('Marked resolved', 'success'); openConv(state.activeId); loadList(); });
    });
  }

  // ---------- Init ----------
  $('cv-search').addEventListener('input', function (e) {
    state.q = e.target.value;
    clearTimeout(window.__sndSearch);
    window.__sndSearch = setTimeout(loadList, 200);
  });
  renderFilters();
  loadList();
  renderEmpty();
  renderModeBadge();
})();
