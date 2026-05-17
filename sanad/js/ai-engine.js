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
    var raw = (q || '').trim();
    q = raw.toLowerCase();
    // Short or greeting-only customer messages → an opener, not a canned policy reply.
    if (/^(hi+|hello+|hey+|hola|salam|salaam|good\s+(morning|afternoon|evening))[\s!.?]*$/i.test(raw))
      return "Hi! Thanks for reaching out. Happy to help with whatever you need. Could you share a bit more detail about what brought you to us today?";
    if (raw.length > 0 && raw.length < 8 && !/refund|crash|bug|down/.test(q))
      return "Thanks for the message! Could you give me a bit more detail so I can give you a useful answer?";
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
    var raw = (q || '').trim();
    q = raw.toLowerCase();
    // Greetings + small talk — keep it warm, then nudge toward a real question.
    if (/^(hi+|hello+|hey+|hola|salam|salaam|assalam|yo|sup|howdy|good\s+(morning|afternoon|evening|day))[\s!.?]*$/i.test(raw))
      return "👋 Hey! I'm happy to help. Most folks ask me about **billing & refunds**, **account access** (password reset, SSO, 2FA), or **technical setup** (API, webhooks, integrations). What's on your mind?";
    if (/^(thanks|thank\s*you|thx|ty|cheers|appreciate|brilliant|perfect|great)[\s!.]*$/i.test(raw))
      return "You're welcome! Anything else I can help with?";
    if (/^(yes|yeah|yep|sure|please|ok|okay)[\s!.]*$/i.test(raw))
      return "Got it. Could you share a bit more detail about what you're stuck on? The more specific the question, the better the answer.";
    if (/^(no|nope|nah|not really)[\s!.]*$/i.test(raw))
      return "No worries. I'm here if you change your mind — just type a question or click *Open a ticket* to reach a human.";
    if (/^bye|^goodbye|^see\s*ya|^later/i.test(raw))
      return "Take care! ☕ Come back any time.";
    if (/are\s+you\s+(a\s+)?(human|real|bot|ai|robot)/i.test(raw))
      return "I'm an AI assistant powered by Claude. I can answer most questions instantly, and if I can't, I'll connect you with a human agent — just tap *Open a ticket*.";
    if (/who\s+are\s+you|what\s+are\s+you|what\s+can\s+you\s+do/i.test(raw))
      return "I'm Sanad — the AI support copilot for this demo. I'm trained on our knowledge base so I can answer most billing, account, and technical questions. For anything I'm not sure about, I'll point you to a human.";
    if (/help/i.test(raw) && raw.length < 20)
      return "Sure — what can I help with? Common topics:\n\n- **Billing** — refunds, invoices, payment methods\n- **Account** — password reset, 2FA, SSO, team invites\n- **Technical** — API, webhooks, integrations, embedding the widget\n\nOr describe your issue in your own words and I'll do my best.";

    // Intent matches — give a real answer with KB citation
    if (/password|reset|forgot/.test(q)) return "To reset your password, click **Forgot password** on the login screen. We'll email a reset link valid for 30 minutes. If it doesn't arrive, check spam — corporate email gateways sometimes block our sender.\n\n[cite:Resetting your password]";
    if (/2fa|two.factor|recovery|authenticator/.test(q)) return "Use one of your recovery codes on the 2FA prompt — click **Use recovery code**. If you've lost them, contact support and we'll verify your identity via email and reset 2FA within ~10 minutes during business hours.\n\n[cite:Recovering 2FA access]";
    if (/sso|saml|okta|azure|google.?workspace|onelogin/.test(q)) return "SSO is available on Business and above. Set it up under **Settings → Security → SSO**. We support Okta, Azure AD / Entra ID, Google Workspace, OneLogin, and any SAML 2.0 IdP. Group claims auto-provision users to roles.\n\n[cite:Setting up SSO with SAML]";
    if (/webhook|signature|hmac/.test(q)) return "Compute HMAC-SHA256 of the **raw** request body (not parsed JSON) using your signing key, and compare it constant-time to the `Sanad-Signature` header. In Express, use `express.raw()` on the webhook route, not `express.json()`.\n\n[cite:Webhook signature verification]";
    if (/refund|money back|cancel.*subscription|cancel.*plan/.test(q)) return "Refunds are no-questions-asked within 14 days of any new subscription. Reply to your purchase receipt with the word **refund**, or email billing@sanad.app — we process within 2 business days, hitting your card in 3-5 business days.\n\n[cite:Refund policy]";
    if (/invoice|receipt|tax|trn|vat/.test(q)) return "Download PDF invoices going back 24 months from **Settings → Billing → Invoices**. UAE VAT (5%) is itemised; add your TRN under Settings → Billing → Tax info and it'll appear on all future invoices.\n\n[cite:Understanding your invoice]";
    if (/upgrade|downgrade|change.*plan|switch.*plan|annual|monthly/.test(q)) return "Change plans from **Settings → Billing → Change plan**. Upgrades take effect immediately with prorated charges; downgrades take effect at the end of your current cycle. Annual saves 20% vs monthly.\n\n[cite:Upgrading or downgrading your plan]";
    if (/api|rate.?limit|429|sdk/.test(q)) return "Authenticate with a Bearer token from **Settings → Developers → API keys**. Limits: Free 100/min, Pro 500/min, Business 2000/min. 429 responses include a `Retry-After` header — respect it.\n\n[cite:API quickstart]";
    if (/embed|widget|install|script.*tag/.test(q)) return "Drop the widget into any page with `<script src=\"https://widget.sanad.app/embed.js\" data-workspace=\"ws_xxx\" async></script>`. Call `window.Sanad('identify', {...})` to thread messages for logged-in users.\n\n[cite:Embedding the chat widget]";
    if (/import|migrate|csv|intercom|zendesk|helpscout|front/.test(q)) return "Use **Admin → Import → From other tool**. We support Intercom, Zendesk, Help Scout, Front, and Freshdesk. Conversations, contacts, tags, and articles all come over. Agent assignments map by email.\n\n[cite:Importing from Intercom / Zendesk]";
    if (/slack|integration/.test(q)) return "Reconnect Slack via **Settings → Integrations → Slack**. The legacy tokens were deprecated this quarter, so existing connections need re-auth with the new OAuth scopes.";
    if (/data.?residency|gdpr|pdpl|compliance|where.*data/.test(q)) return "We host in eu-fra, us-east, and ap-bom. For UAE PDPL compliance ap-bom is the right region. Region migration takes ~30 min and is one-time.\n\n[cite:Data residency]";
    if (/(invite|add).*team|seat|user.*limit/.test(q)) return "Invite from **Settings → Team → Invite**. Up to 50 emails at once, or paste a comma-separated list. Roles: Admin, Agent, Viewer. Viewer is free; Admin and Agent count toward your seat limit.\n\n[cite:Inviting teammates]";
    if (/dark mode|theme/.test(q)) return "Dark mode for the admin is on the Q3 roadmap. The customer widget already follows the system theme. I'll +1 your vote internally — it bumps the priority.";
    if (/non.?profit|charity|education|discount/.test(q)) return "Yes! We offer **50% off Pro** for verified non-profits and education institutions. Send your registration document to support@sanad.app and we'll apply the credit within one business day.";
    if (/مرحبا|اهلا|سلام|شكرا/.test(raw))
      return "أهلاً بك! يسعدني مساعدتك. يمكنني الإجابة عن أسئلة الفوترة، الحساب، أو التقنية. ما الذي تحتاجه؟";

    // Final catch-all — warmer than the original "no article" line
    return "Hmm, I'm not 100% sure I have a doc for that exactly. Could you rephrase or give me a bit more detail? Otherwise tap *Open a ticket* and a human will pick it up.";
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

  /* ===================================================================
     Local AI (in-browser, real open-source LLM)
     ===================================================================
     Loads Qwen 2.5 0.5B Instruct from HuggingFace via transformers.js on
     demand. The download is ~280MB at q4 quantization; cached in the
     browser's Cache API so subsequent visits are instant. Pure ES module
     import, lazy — nothing is downloaded until the user toggles it on.
     Falls back to the mock dictionary if transformers.js fails to load
     (e.g. WASM blocked, ad-block on CDN). */
  var TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.5';
  var LOCAL_MODEL = 'onnx-community/Qwen2.5-0.5B-Instruct';
  var Local = {
    ready: false,
    loading: false,
    progress: {},          // file -> percent
    generator: null,
    TextStreamer: null,
    err: null,

    async load(onEvent) {
      if (this.ready || this.loading) return;
      this.loading = true; this.err = null;
      try {
        var mod = await import(/* @vite-ignore */ TRANSFORMERS_URL);
        // Prefer WebGPU when available; transformers.js falls back to WASM.
        var device = (typeof navigator !== 'undefined' && navigator.gpu) ? 'webgpu' : 'wasm';
        var self = this;
        this.generator = await mod.pipeline('text-generation', LOCAL_MODEL, {
          dtype: 'q4',
          device: device,
          progress_callback: function (data) {
            if (data && data.file) self.progress[data.file] = data.progress || 0;
            if (typeof onEvent === 'function') onEvent(data);
          }
        });
        this.TextStreamer = mod.TextStreamer;
        this.ready = true;
        this.loading = false;
        return { device: device };
      } catch (e) {
        this.err = e;
        this.loading = false;
        if (typeof onEvent === 'function') onEvent({ status: 'error', message: String(e && e.message || e) });
        throw e;
      }
    },

    async generate(opts) {
      // opts = { system, messages, max_new_tokens?, onToken? }
      if (!this.ready) throw new Error('local-not-ready');
      var msgs = [{ role: 'system', content: opts.system }].concat(opts.messages);
      var streamer = null;
      if (opts.onToken && this.TextStreamer) {
        streamer = new this.TextStreamer(this.generator.tokenizer, {
          skip_prompt: true,
          skip_special_tokens: true,
          callback_function: opts.onToken
        });
      }
      var started = Date.now();
      var out = await this.generator(msgs, {
        max_new_tokens: opts.max_new_tokens || 200,
        do_sample: false,
        streamer: streamer
      });
      var text = '';
      if (out && out[0] && out[0].generated_text) {
        var gen = out[0].generated_text;
        if (typeof gen === 'string') text = gen;
        else if (Array.isArray(gen)) {
          var last = gen[gen.length - 1];
          text = last && last.content ? last.content : '';
        }
      }
      return { text: text.trim(), latency_ms: Date.now() - started };
    }
  };

  var SanadAI = {
    health: health,
    local: Local,
    preferLocal: false,        // set by chat.js when user enables local mode

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
      // opts = { question, history?, stream?, onToken? }
      // Smaller KB context for local (token-budget) than for hosted Claude.
      var localCtx = KB.slice(0, 8).map(function (a) { return '## ' + a.title + '\n' + (a.body_md || '').slice(0, 350); }).join('\n\n');
      var kbCtx = KB.slice(0, 20).map(function (a) { return '## ' + a.title + '\n' + (a.body_md || '').slice(0, 800); }).join('\n\n');
      var msgs = (opts.history || []).slice(-6).map(function (h) { return { role: h.role, content: h.content }; });
      msgs.push({ role: 'user', content: opts.question });

      // 1) Local mode wins when ready
      if (SanadAI.preferLocal && Local.ready) {
        var started = Date.now();
        return Local.generate({
          system: SYS.kb_answer + '\n\n[Knowledge base]\n' + localCtx,
          messages: msgs,
          max_new_tokens: 220,
          onToken: opts.onToken
        }).then(function (r) {
          logCall('kb_answer', { feature: 'kb_answer', model: LOCAL_MODEL, tokens_in: 0, tokens_out: 0, latency_ms: r.latency_ms, fallback: false, cost_usd: 0, local: true });
          return { text: stripCites(r.text), citations: kbCitations(r.text), model: LOCAL_MODEL, latency_ms: r.latency_ms, fallback: false, local: true };
        }).catch(function (e) {
          // Local blew up → fall through to mock
          var ms = Date.now() - started;
          return mockReply({ feature: 'kb_answer', messages: msgs }, LOCAL_MODEL, ms);
        }).then(function (r) {
          if (r && r.local) return r;
          return { text: stripCites(r.text), citations: kbCitations(r.text), model: r.model, latency_ms: r.latency_ms, fallback: r.fallback };
        });
      }

      // 2) Otherwise: hosted call (Worker proxy) with mock fallback
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
