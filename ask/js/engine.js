/* engine.js - The Ask Saad AI client.
 *
 * Lifted from sanad/js/ai-engine.js, renamed SanadAI → AskAI, with one
 * recruiter-grounded feature: `answer({question, history})` that retrieves
 * top-K docs from AskCorpus and asks Claude to reply grounded in them.
 * Same Live/Mock pattern - calls a Cloudflare Worker proxy at
 * /api/ask/ai/* when configured, falls back to a deterministic mock
 * dictionary otherwise. Reuses the same ANTHROPIC_API_KEY secret as Sanad.
 *
 * Exposes window.AskAI.
 */
(function () {
  'use strict';

  var modeCache = null;
  function health() {
    if (modeCache) return Promise.resolve(modeCache);
    return fetch('/api/ask/ai/health').then(function (r) { return r.json(); })
      .then(function (j) { modeCache = { live: !!j.live, model: j.model || 'claude-haiku-4-5-20251001' }; return modeCache; })
      .catch(function () { modeCache = { live: false, model: 'claude-haiku-4-5-20251001' }; return modeCache; });
  }

  // ==================== Retrieval ====================
  // tagOverlap × 2 + titleMatch × 1.5 + bodyTokenOverlap × 1
  function retrieve(query, k) {
    k = k || 3;
    var qTokens = window.AskCorpus.tokenize(query);
    var qSet = new Set(qTokens);
    if (!qTokens.length) return [];

    var scored = window.AskCorpus.docs.map(function (d) {
      var tagHits = 0;
      qTokens.forEach(function (t) { if (d._tagSet.has(t)) tagHits++; });
      var titleHits = 0;
      d._titleTokens.forEach(function (t) { if (qSet.has(t)) titleHits++; });
      var bodyHits = 0;
      d._bodyTokens.forEach(function (t) { if (qSet.has(t)) bodyHits++; });
      var score = tagHits * 2 + titleHits * 1.5 + Math.min(bodyHits, 8) * 1;
      return { doc: d, score: score, tagHits: tagHits };
    });
    scored.sort(function (a, b) { return b.score - a.score; });
    var top = scored.filter(function (s) { return s.score > 0; }).slice(0, k);
    return top.map(function (s) {
      return { id: s.doc.id, title: s.doc.title, body: s.doc.body, link: s.doc.link, scrollTo: s.doc.scrollTo, score: s.score };
    });
  }

  // ==================== Logging ====================
  function logCall(feature, payload) {
    try {
      var key = 'ask.ai.log';
      var log = JSON.parse(localStorage.getItem(key) || '[]');
      log.unshift(Object.assign({ id: 'al-' + Date.now(), at: new Date().toISOString(), feature: feature }, payload));
      localStorage.setItem(key, JSON.stringify(log.slice(0, 200)));
    } catch (e) { /* quota / private mode */ }
  }

  // ==================== Live call ====================
  function callClaude(opts) {
    var started = Date.now();
    var payload = {
      model: opts.model || 'claude-haiku-4-5-20251001',
      system: opts.system,
      messages: opts.messages,
      max_tokens: opts.max_tokens || 500,
      temperature: opts.temperature != null ? opts.temperature : 0.4
    };
    return fetch('/api/ask/ai/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) {
      if (!r.ok) return r.json().then(function (e) { throw e; });
      return r.json().then(function (j) {
        var text = j.content && j.content[0] && j.content[0].text || '';
        var ms = Date.now() - started;
        var rec = { model: payload.model, tokens_in: (j.usage && j.usage.input_tokens) || 0, tokens_out: (j.usage && j.usage.output_tokens) || 0, latency_ms: ms, fallback: false };
        rec.cost_usd = +((rec.tokens_in * 0.0000008) + (rec.tokens_out * 0.000004)).toFixed(5);
        logCall(opts.feature || 'answer', rec);
        return { text: text, model: payload.model, latency_ms: ms, fallback: false, usage: j.usage };
      });
    });
  }

  // ==================== Mock fallback ====================
  // Keyed dictionary keyed by tags from the top retrieved doc. If the top
  // doc is recognised, return a templated answer that *uses* that doc's
  // body and embeds the [doc-id] citation marker so the client renders
  // citation chips identically to live mode.
  function mockAnswer(question, retrieved) {
    var q = (question || '').toLowerCase();

    // Out-of-scope guard rail - same shape as Live would produce
    if (!retrieved.length || retrieved[0].score < 1.5) {
      return "I'm not sure that's in my notes about Saad. The best move is to email him directly at saad@saadm.dev - he typically replies within 24 hours. [contact]";
    }

    // Pick the top doc as the citation anchor; mention the second + third
    // briefly if their score is close to the first.
    var top = retrieved[0];
    var supports = retrieved.slice(1).filter(function (r) { return r.score >= top.score * 0.5; });
    var extraIds = supports.map(function (r) { return '[' + r.id + ']'; }).join(' ');

    // Lightly question-aware preambles
    var lead = '';
    if (/can\s+he|is\s+he\s+(available|open)|relocate|remote|hire|hiring/.test(q)) lead = 'Yes - ';
    else if (/^(does|do|did)\s+he/.test(q)) lead = 'Yes - ';
    else if (/^(what|tell|show|describe|explain)/.test(q)) lead = '';
    else if (/^(who|where|when|why|how)/.test(q)) lead = '';

    // Short, citation-bearing reply built from the top doc's body. Trim
    // the doc body to ~2 sentences to keep replies tight.
    var bodySentences = top.body.split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, 2).join(' ');
    var reply = lead + bodySentences + ' [' + top.id + ']' + (extraIds ? ' ' + extraIds : '');

    // Heuristic: append a follow-up nudge if the question reads transactional
    if (/hire|interview|relocate|available|salary|when|start/.test(q)) {
      reply += ' If you want to chat directly, the contact form is at /contact.html. [contact]';
    }
    return reply;
  }

  // ==================== Public API ====================
  var SYS_PROMPT_TMPL = [
    "You are Ask Saad - an AI assistant for visitors browsing Muhammad Saad's portfolio at saadm.dev.",
    "Saad is an Automation & Software Developer based in Dubai, open to relocate worldwide.",
    "",
    "Answer the visitor's question concisely (2-4 short sentences, no headers, no lists unless they specifically asked for one).",
    "Cite the relevant documents from CONTEXT below by placing their [doc-id] at the end of any sentence that uses them.",
    "Do NOT invent facts not in CONTEXT - if the answer isn't there, say so politely and suggest emailing saad@saadm.dev.",
    "Don't address the visitor by name. Refer to Muhammad Saad as 'Saad' (not 'Mr. Saad' or 'Muhammad').",
    "",
    "CONTEXT:"
  ].join('\n');

  function buildSystemPrompt(retrieved) {
    var ctx = retrieved.map(function (d) {
      return '[' + d.id + '] TITLE: ' + d.title + '\nBODY: ' + d.body;
    }).join('\n\n');
    return SYS_PROMPT_TMPL + '\n\n' + ctx;
  }

  var AskAI = {
    health: health,
    retrieve: retrieve,

    answer: function (ctx) {
      // ctx = { question, history? }
      var started = Date.now();
      var retrieved = retrieve(ctx.question, 3);
      var citations = retrieved.map(function (d) { return { id: d.id, title: d.title, link: d.link, scrollTo: d.scrollTo }; });

      var history = (ctx.history || []).slice(-4).map(function (m) {
        return { role: m.role, content: String(m.content || '').slice(0, 600) };
      });
      var messages = history.concat([{ role: 'user', content: ctx.question }]);

      return callClaude({
        feature: 'answer',
        system: buildSystemPrompt(retrieved),
        messages: messages,
        max_tokens: 350,
        temperature: 0.4
      }).then(function (r) {
        return { text: r.text, citations: citations, model: r.model, latency_ms: r.latency_ms, fallback: false };
      }).catch(function () {
        var text = mockAnswer(ctx.question, retrieved);
        var ms = Date.now() - started;
        logCall('answer', { model: 'mock', tokens_in: 0, tokens_out: 0, latency_ms: ms, fallback: true, cost_usd: 0 });
        return { text: text, citations: citations, model: 'mock-dictionary', latency_ms: ms, fallback: true };
      });
    },

    rateMessage: function (rating, context) {
      logCall('rate', { rating: rating, context: context || {} });
      // Best-effort fire-and-forget to the Worker; OK if it 404s in mock mode.
      return fetch('/api/ask/ai/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: rating, feature: (context && context.feature) || 'answer', model: (context && context.model) || 'unknown', fallback: !!(context && context.fallback), at: new Date().toISOString() })
      }).catch(function () {});
    }
  };

  window.AskAI = AskAI;
})();
