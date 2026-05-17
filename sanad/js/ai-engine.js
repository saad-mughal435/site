/* ai-engine.js - The Sanad AI client.
   - Calls the Cloudflare Worker proxy at /api/sanad/ai/* when live.
   - Falls back to a deterministic mock dictionary when the Worker is
     unreachable or the ANTHROPIC_API_KEY secret isn't configured.
   - Each feature builds its own feature-specific system prompt and posts
     {model, system, messages, max_tokens, stream?} to the proxy.
   - Logs every call to /sanad/api/admin/ai-logs (which writes to localStorage)
     so the admin dashboard can track usage, latency, and fallback rate.
   Exposes window.SanadAI. */
(function () {
  'use strict';

  var KB = window.SANAD_DATA ? window.SANAD_DATA.ARTICLES : [];

  // Mode is detected once per page load via /health and cached.
  var modeCache = null;
  function health() {
    if (modeCache) return Promise.resolve(modeCache);
    return fetch('/api/sanad/ai/health').then(function (r) { return r.json(); })
      .then(function (j) { modeCache = { live: !!j.live, model: j.model || 'claude-haiku-4-5-20251001' }; return modeCache; })
      .catch(function () { modeCache = { live: false, model: 'claude-haiku-4-5-20251001' }; return modeCache; });
  }

  function logCall(feature, payload) {
    return SanadApp.api('/admin/ai-logs', { method: 'POST', body: payload }).catch(function () {});
  }

  function settings() {
    return SanadApp.api('/admin/settings').then(function (r) { return (r.body && r.body.settings) || {}; });
  }

  // Call the proxy. Returns either {text, usage, fallback:false, model, latency_ms}
  // or {text, fallback:true, latency_ms} when proxy is down/no-key.
  function call(opts) {
    // opts = { feature, system, messages, max_tokens?, stream?, model? }
    var started = Date.now();
    return settings().then(function (s) {
      var model = opts.model || s.model || 'claude-haiku-4-5-20251001';
      var payload = {
        model: model,
        system: opts.system,
        messages: opts.messages,
        max_tokens: opts.max_tokens || s.max_tokens || 800,
        temperature: s.temperature != null ? s.temperature : 0.4,
        stream: !!opts.stream
      };
      return fetch('/api/sanad/ai/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (r) {
        if (!r.ok) return r.json().then(function (e) { throw e; });
        if (opts.stream) return { stream: r.body, model: model, status: r.status };
        return r.json().then(function (j) {
          var text = j.content && j.content[0] && j.content[0].text || '';
          var ms = Date.now() - started;
          var rec = { feature: opts.feature, model: model, tokens_in: (j.usage && j.usage.input_tokens) || 0, tokens_out: (j.usage && j.usage.output_tokens) || 0, latency_ms: ms, fallback: false };
          rec.cost_usd = +((rec.tokens_in * 0.0000008) + (rec.tokens_out * 0.000004)).toFixed(5);
          logCall(opts.feature, rec);
          return { text: text, model: model, latency_ms: ms, fallback: false, usage: j.usage };
        });
      }).catch(function (err) {
        // Worker unreachable, no key, or transport error → mock
        var ms = Date.now() - started;
        logCall(opts.feature, { feature: opts.feature, model: model, tokens_in: 0, tokens_out: 0, latency_ms: ms, fallback: true, cost_usd: 0 });
        return mockReply(opts, model, ms);
      });
    });
  }

  // ===================== Mock dictionary =====================
  // Pattern-matches on the user's latest message + the feature to produce
  // realistic-feeling responses. Used whenever the Worker is unavailable.
  function mockReply(opts, model, latency_ms) {
    var feat = opts.feature || 'reply';
    var userMsg = '';
    if (opts.messages && opts.messages.length) {
      var last = opts.messages[opts.messages.length - 1];
      userMsg = typeof last.content === 'string' ? last.content : (last.content && last.content[0] && last.content[0].text) || '';
    }
    var text = '';
    switch (feat) {
      case 'reply':       text = mockReplyText(userMsg); break;
      case 'summary':     text = mockSummary(opts); break;
      case 'category':    text = mockCategory(userMsg); break;
      case 'sentiment':   text = mockSentiment(userMsg); break;
      case 'kb_answer':   text = mockKbAnswer(userMsg); break;
      case 'translate':   text = mockTranslate(userMsg, opts.to); break;
      case 'faq':         text = mockFAQ(opts); break;
      case 'gaps':        text = mockGaps(opts); break;
      default:            text = "(mock reply)\nI couldn't classify this request, so I'd recommend escalating to a human agent.";
    }
    return { text: text, model: model, latency_ms: latency_ms, fallback: true };
  }

  function mockReplyText(q) {
    q = (q || '').toLowerCase();
    if (/password|reset|login/.test(q)) return "Sorry for the trouble. Try the password reset link from the login screen — it sometimes lands in spam. If it doesn't arrive within 60 seconds, I can manually trigger one via our backup provider. What email address is on your account?\n\n[cite:Resetting your password]";
    if (/refund|cancel|charge|billing|invoice|payment/.test(q)) return "I can look into that right away. Could you share the transaction date and the last 4 digits of the card? Per our refund policy, anything within 14 days is eligible no-questions-asked.\n\n[cite:Refund policy]";
    if (/webhook|signature|hmac|api/.test(q)) return "That sounds like the classic 'parsed JSON instead of raw body' issue. Make sure you're computing the HMAC over the raw request body and using constant-time comparison. Express in particular needs `express.raw()` instead of `express.json()` on the webhook route.\n\n[cite:Webhook signature verification]";
    if (/rate.?limit|429/.test(q)) return "Pro is capped at 500 req/min. If you're doing a bulk backfill I can temporarily raise it to 2,000 req/min for 48 hours. Just confirm the workspace ID and a window when the spike will happen.\n\n[cite:API quickstart]";
    if (/sso|saml|okta|azure/.test(q)) return "SSO is available on Business. Setup takes ~10 minutes via Settings → Security → SSO. I can hop on a 15-min call to walk through the SAML claims and group provisioning if it'd help.\n\n[cite:Setting up SSO with SAML]";
    if (/slack|integration/.test(q)) return "Slack's legacy tokens were deprecated this quarter. Reconnect via Settings → Integrations → Slack — it'll re-auth with the new OAuth scopes and start posting again within a minute.";
    if (/dark mode|theme/.test(q)) return "Dark mode for the admin panel is on the Q3 roadmap. I'll +1 your vote, which bumps the priority. In the meantime, the customer widget already follows the system theme.";
    if (/mobile|crash|ios|android/.test(q)) return "Apologies for that crash. A fix is shipping in the next build (~30 min). As a workaround, swipe down from the home screen or use the web app. I'll DM you when the update is live.";
    if (/import|csv|migrate/.test(q)) return "Bulk CSV import is in Admin → Import → CSV, up to 50k rows. The matcher needs an email column. Want our template? I can pre-fill it with your column headers if you send me a sample.";
    if (/data residency|gdpr|pdpl|compliance/.test(q)) return "We host in eu-fra, us-east, and ap-bom. For UAE PDPL compliance ap-bom is the right region. A region migration takes ~30 minutes and is one-time. Want me to schedule it?\n\n[cite:Data residency]";
    if (/مرحبا|شكرا|كلمة المرور/.test(q)) return "أهلاً بك. يمكنني مساعدتك في ذلك. هل يمكنك إعطائي المزيد من التفاصيل أو رقم حسابك؟";
    return "Thanks for reaching out. I want to make sure I give you the right answer — could you share a bit more detail about what you're trying to do? In the meantime I'll loop in a human agent if it's urgent.";
  }
  function mockSummary(opts) {
    var thread = (opts.context && opts.context.thread) || '';
    if (/password|reset/.test(thread)) return "Customer can't reset their password — emails not arriving. AI offered backup-provider reset. Pending customer confirmation.\nTopics: password, account-recovery, deliverability";
    if (/refund|charge.*twice|duplicate/.test(thread)) return "Customer was double-charged for their July invoice. Refund of the duplicate has been initiated; will arrive in 3-5 business days.\nTopics: billing, duplicate-charge, refund";
    if (/webhook|signature/.test(thread)) return "Customer's webhook verification was failing because their framework was re-serializing the request body. Resolved by using raw-body middleware.\nTopics: webhook, signature, express";
    return "Customer reached out with a support question; an agent has responded and is awaiting follow-up.\nTopics: general, awaiting-customer";
  }
  function mockCategory(q) {
    q = (q || '').toLowerCase();
    if (/password|sso|account|email|login/.test(q)) return 'cat-account|0.92';
    if (/refund|charge|invoice|billing|payment|cancel/.test(q)) return 'cat-billing|0.94';
    if (/webhook|api|integration|rate.?limit|signature/.test(q)) return 'cat-tech|0.91';
    if (/crash|bug|broken|not working|error/.test(q)) return 'cat-bug|0.87';
    if (/feature|request|wish|please add|roadmap/.test(q)) return 'cat-feature|0.85';
    return 'cat-general|0.65';
  }
  function mockSentiment(q) {
    q = (q || '').toLowerCase();
    if (/angry|frustrat|unacceptable|terrible|hate|worst|cancel/.test(q)) return '-0.72|neg';
    if (/thank|appreciate|love|great|perfect|amazing|brilliant/.test(q)) return '+0.81|pos';
    if (/cannot|unable|broken|not working|failed/.test(q)) return '-0.25|neg';
    return '0.05|neu';
  }
  function mockKbAnswer(q) {
    q = (q || '').toLowerCase();
    if (/password|reset/.test(q)) return "To reset your password, click **Forgot password** on the login screen. We'll email a reset link (valid 30 min). Check spam if it doesn't arrive.\n\n[cite:Resetting your password]";
    if (/2fa|two.factor|recovery/.test(q)) return "Use one of your recovery codes on the 2FA prompt — click **Use recovery code**. If you've lost them, contact support and we'll verify identity via email.\n\n[cite:Recovering 2FA access]";
    if (/sso|saml/.test(q)) return "SSO is on Business and above. Configure under Settings → Security → SSO. We support Okta, Azure AD, Google Workspace and any SAML 2.0 IdP.\n\n[cite:Setting up SSO with SAML]";
    if (/webhook|signature/.test(q)) return "Compute HMAC-SHA256 of the **raw** body (not parsed JSON) with your signing key and compare constant-time to the `Sanad-Signature` header.\n\n[cite:Webhook signature verification]";
    if (/refund/.test(q)) return "Refunds are no-questions-asked within 14 days. Email billing@sanad.app or reply to your receipt with the word *refund*.\n\n[cite:Refund policy]";
    return "I couldn't find an exact article for that. Would you like me to connect you with a human agent?";
  }
  function mockTranslate(text, to) {
    if (to === 'ar') return "(ترجمة تجريبية) " + text;
    if (to === 'en') return "(demo translation) " + text;
    return text;
  }
  function mockFAQ(opts) {
    var t = (opts.context && opts.context.article && opts.context.article.title) || 'this article';
    return "Q: " + t + " — what's covered?\nA: This article explains the steps end-to-end with screenshots.\n\nQ: How long does it take?\nA: About 5 minutes for first-time users.\n\nQ: What if I get stuck?\nA: Contact support — we respond within one hour on Business tier.";
  }
  function mockGaps() {
    return "1. **Webhook retry behavior** — 4 recent tickets asked about expected retry windows; we don't have a dedicated article.\n2. **Importing from Front** — we list Intercom/Zendesk/HelpScout/Front but the Front-specific quirks aren't documented.\n3. **Slack token migration** — 6 customers hit the legacy-token deprecation; an article would prevent future tickets.";
  }

  // ===================== Public API =====================
  function lastCustomerText(conv) {
    if (!conv || !conv.messages) return '';
    for (var i = conv.messages.length - 1; i >= 0; i--) {
      if (conv.messages[i].author_type === 'customer') return conv.messages[i].body;
    }
    return '';
  }
  function buildThread(conv) {
    if (!conv || !conv.messages) return '';
    return conv.messages.slice(-8).map(function (m) { return (m.author_type === 'customer' ? 'CUSTOMER' : 'AGENT') + ': ' + m.body; }).join('\n\n');
  }
  function kbCitations(text) {
    // Extracts [cite:Title] markers and returns matching article ids.
    var refs = [];
    String(text).replace(/\[cite:([^\]]+)\]/g, function (_, t) {
      var hit = KB.find(function (a) { return a.title.toLowerCase() === t.toLowerCase(); });
      if (hit) refs.push({ id: hit.id, title: hit.title });
      else refs.push({ id: null, title: t });
    });
    return refs;
  }
  function stripCites(text) { return String(text).replace(/\s*\[cite:[^\]]+\]/g, ''); }

  var SYS = {
    reply: "You are Sanad, a customer-support copilot. Read the conversation and draft a concise, friendly reply (2-4 sentences). Cite knowledge-base articles by appending [cite:Article Title]. If you'd escalate to a human, say so explicitly. Match the customer's tone.",
    summary: "You are Sanad. Summarize the conversation in two sentences, then list 2-4 topic tags on a new line as 'Topics: a, b, c'.",
    category: "You are Sanad. Read the customer's first message and reply with exactly: <category_id>|<confidence 0..1>. Categories are: cat-account, cat-billing, cat-tech, cat-feature, cat-bug, cat-general. No other text.",
    sentiment: "You are Sanad. Read the customer's latest message and reply with exactly: <score -1..+1>|<label pos|neu|neg>. No other text.",
    kb_answer: "You are Sanad, answering a customer's question using the provided knowledge base. Be concise (3-5 sentences). When you use an article, append [cite:Article Title]. If no article covers it, say so and offer human handoff.",
    translate: "Translate the user's text to the requested language. Preserve meaning, tone, and any product names. Output only the translation.",
    faq: "You are Sanad. Given the article, generate 4-5 frequently-asked questions and short answers grounded in the article content. Format: Q: ...\\nA: ...\\n\\n",
    gaps: "You are Sanad. Given recent support tickets and the current knowledge base, identify 3-5 article gaps — topics customers ask about that aren't well documented. Output a numbered markdown list with the suggested title in bold and why it's needed."
  };

  var SanadAI = {
    health: health,

    replySuggestion: function (conv) {
      var thread = buildThread(conv);
      var p = "Conversation so far:\n\n" + thread + "\n\nDraft the next reply from the support agent.";
      return call({
        feature: 'reply',
        system: SYS.reply + '\n\n[KB titles available]\n' + KB.slice(0, 30).map(function (a) { return '- ' + a.title; }).join('\n'),
        messages: [{ role: 'user', content: p }],
        max_tokens: 400
      }).then(function (r) {
        return { text: stripCites(r.text), citations: kbCitations(r.text), model: r.model, latency_ms: r.latency_ms, fallback: r.fallback };
      });
    },

    summarize: function (conv) {
      var thread = buildThread(conv);
      return call({
        feature: 'summary',
        system: SYS.summary,
        messages: [{ role: 'user', content: thread }],
        max_tokens: 200,
        context: { thread: thread }
      }).then(function (r) {
        var lines = r.text.split('\n').filter(function (l) { return l.trim(); });
        var topicsLine = lines.find(function (l) { return /^topics:/i.test(l); }) || '';
        var summary = lines.filter(function (l) { return l !== topicsLine; }).join(' ');
        var topics = topicsLine.replace(/^topics:\s*/i, '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        return { summary: summary, topics: topics, model: r.model, latency_ms: r.latency_ms, fallback: r.fallback };
      });
    },

    categorize: function (firstMsg) {
      return call({
        feature: 'category',
        system: SYS.category,
        messages: [{ role: 'user', content: firstMsg }],
        max_tokens: 30
      }).then(function (r) {
        var parts = r.text.trim().split('|');
        return { category_id: (parts[0] || 'cat-general').trim(), confidence: parseFloat(parts[1]) || 0.5, model: r.model, latency_ms: r.latency_ms, fallback: r.fallback };
      });
    },

    sentiment: function (msg) {
      return call({
        feature: 'sentiment',
        system: SYS.sentiment,
        messages: [{ role: 'user', content: msg }],
        max_tokens: 20
      }).then(function (r) {
        var parts = r.text.trim().split('|');
        var score = parseFloat(parts[0]) || 0;
        return { score: score, label: (parts[1] || (score > 0.2 ? 'pos' : score < -0.2 ? 'neg' : 'neu')).trim(), model: r.model, latency_ms: r.latency_ms, fallback: r.fallback };
      });
    },

    kbAnswer: function (opts) {
      // opts = { question, history?, stream? }
      var kbCtx = KB.slice(0, 20).map(function (a) { return '## ' + a.title + '\n' + (a.body_md || '').slice(0, 800); }).join('\n\n');
      var msgs = (opts.history || []).slice(-6).map(function (h) { return { role: h.role, content: h.content }; });
      msgs.push({ role: 'user', content: opts.question });
      return call({
        feature: 'kb_answer',
        system: SYS.kb_answer + '\n\n[Knowledge base]\n' + kbCtx,
        messages: msgs,
        max_tokens: 400,
        stream: !!opts.stream
      }).then(function (r) {
        if (r.stream) return r;  // caller handles streaming
        return { text: stripCites(r.text), citations: kbCitations(r.text), model: r.model, latency_ms: r.latency_ms, fallback: r.fallback };
      });
    },

    translate: function (text, to) {
      return call({
        feature: 'translate',
        system: SYS.translate,
        messages: [{ role: 'user', content: "Translate to " + (to === 'ar' ? 'Arabic' : 'English') + ":\n\n" + text }],
        max_tokens: 400,
        to: to
      }).then(function (r) {
        return { translated: r.text, model: r.model, latency_ms: r.latency_ms, fallback: r.fallback };
      });
    },

    generateFAQ: function (article) {
      return call({
        feature: 'faq',
        system: SYS.faq,
        messages: [{ role: 'user', content: "# " + article.title + "\n\n" + (article.body_md || '') }],
        max_tokens: 600,
        context: { article: article }
      }).then(function (r) {
        var faqs = [];
        var blocks = r.text.split(/\n\n+/);
        blocks.forEach(function (b) {
          var qm = b.match(/^Q:\s*(.+)$/m);
          var am = b.match(/^A:\s*([\s\S]+)$/m);
          if (qm && am) faqs.push({ q: qm[1].trim(), a: am[1].trim() });
        });
        return { faqs: faqs, model: r.model, latency_ms: r.latency_ms, fallback: r.fallback };
      });
    },

    findKbGaps: function () {
      // Pass recent ticket subjects + current KB titles to the model.
      return SanadApp.api('/conversations').then(function (rr) {
        var subjects = (rr.body.items || []).slice(0, 30).map(function (c) { return '- ' + c.subject; }).join('\n');
        var kbList = KB.slice(0, 40).map(function (a) { return '- ' + a.title; }).join('\n');
        return call({
          feature: 'gaps',
          system: SYS.gaps,
          messages: [{ role: 'user', content: "Recent tickets:\n" + subjects + "\n\nCurrent KB:\n" + kbList }],
          max_tokens: 500
        });
      }).then(function (r) {
        return { suggestions_md: r.text, model: r.model, latency_ms: r.latency_ms, fallback: r.fallback };
      });
    }
  };

  window.SanadAI = SanadAI;
})();
