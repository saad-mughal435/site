# Sanad — AI customer-support copilot demo

A SaaS-style helpdesk with **Claude** integrated at every touchpoint:
suggested replies, summaries, sentiment analysis, auto-categorization, RAG
chat with knowledge-base citations, and translation (EN ↔ AR).

The demo works in two modes:

| Mode | When | Behaviour |
| --- | --- | --- |
| **Live** | `ANTHROPIC_API_KEY` is set on the Cloudflare Worker | Calls real Claude (Haiku 4.5 by default). Topbar shows **Live · Haiku 4.5**. |
| **Demo** | No key configured, Worker unreachable, or rate-limited | Falls back to a deterministic pattern-matched response dictionary. Topbar shows **Demo mode**. Every feature still works. |

The site visitor never sees the demo break either way.

## Enable live mode

1. Cloudflare dashboard → **Workers & Pages → site → Settings → Variables and Secrets**
2. Add an Encrypted Secret:
   - `ANTHROPIC_API_KEY = sk-ant-...`
3. *(Optional)* Add a Plain text variable:
   - `SANAD_DEFAULT_MODEL = claude-haiku-4-5-20251001`
4. Push or trigger a redeploy. Within ~60 seconds the topbar badge will flip
   from **Demo mode** to **Live · Haiku 4.5** automatically.

## Cost guardrails

- Default model is **Claude Haiku 4.5** (~$0.80 per 1M input tokens,
  ~$4.00 per 1M output). A typical suggested reply is ~500 input +
  150 output tokens ≈ **$0.001 per call**.
- The Worker rate-limits to **20 calls per minute per IP**. A 429 response
  pushes the client into mock mode for that call.
- Prompt caching can be enabled by sending the system prompt as a content
  array with `cache_control: { type: 'ephemeral' }` — saves ~90% on repeat
  invocations.
- Admins can switch the live model to **Sonnet 4.6** or **Opus 4.7** from
  the in-app **AI Console**.

## Local development

```bash
# Mock mode only (no Worker, no key required):
python -m http.server 8000
# then open http://127.0.0.1:8000/sanad/

# Live mode (requires wrangler):
npx wrangler dev   # reads .dev.vars
```

Copy `.dev.vars.example` to `.dev.vars` and fill in your local key. Never
commit `.dev.vars` — it's already in `.gitignore`.

## Files

```
sanad/
├── index.html                 Landing
├── inbox.html                 Agent inbox (the centrepiece)
├── chat.html                  Customer chat widget preview
├── kb.html                    Knowledge base
├── admin.html                 Admin SPA
├── 404.html                   Branded not-found
├── css/sanad.css              Design system (slate + violet + mint)
└── js/
    ├── data.js                Seed: 24 customers, 8 agents, 80 conversations,
    │                          ~600 messages, 77 KB articles
    ├── mock-api.js            Fetch interceptor for /sanad/api/*
    ├── ai-engine.js           AI client (live + mock fallback)
    ├── app.js                 Shared helpers (window.SanadApp)
    ├── notifications.js       Toast stack
    ├── inbox.js               Agent inbox
    ├── chat.js                Customer chat widget
    ├── kb.js                  Knowledge base
    ├── admin.js               Admin SPA shell
    └── admin-sections.js      Admin sections
```

The Worker entry point lives at `site/_worker.js` (one directory up) and
handles only `/api/sanad/ai/*` — everything else is passed through to the
existing static-asset deployment.
