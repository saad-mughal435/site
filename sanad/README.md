# Sanad — AI customer-support copilot demo

A SaaS-style helpdesk with **Claude** integrated at every touchpoint:
suggested replies, summaries, sentiment analysis, auto-categorization, RAG
chat with knowledge-base citations, and translation (EN ↔ AR).

## Modes

| Mode | When | Behaviour |
| --- | --- | --- |
| **Demo** | Default | Falls back to a deterministic pattern-matched response dictionary. Every feature works realistically. Topbar shows **Demo mode**. |
| **Live** | A Cloudflare Worker proxy at `/api/sanad/ai/*` is deployed AND `ANTHROPIC_API_KEY` is set | Real Claude responses (Haiku 4.5 default). Topbar shows **Live · Haiku 4.5**. |

The site visitor never sees the demo break either way. Out of the box,
this repo ships in **Demo mode** only.

## Enabling live mode (one-time setup)

The Worker proxy is **not bundled with this repo**. The Cloudflare
"Workers with Static Assets" config we deploy under requires a manual
dashboard switch to accept a `_worker.js` entry point alongside
`assets.directory: "."`, which Saad hasn't toggled yet.

Once Saad enables that, the steps are:

1. Drop the proxy in. A minimal reference implementation:
   ```js
   // _worker.js
   export default {
     async fetch(request, env) {
       const url = new URL(request.url);
       if (url.pathname === '/api/sanad/ai/health') {
         return Response.json({ ok: true, live: !!env.ANTHROPIC_API_KEY,
           model: env.SANAD_DEFAULT_MODEL || 'claude-haiku-4-5-20251001' });
       }
       if (url.pathname.startsWith('/api/sanad/ai/')) {
         if (!env.ANTHROPIC_API_KEY)
           return Response.json({ ok: false, error: 'no_key', fallback: true }, { status: 503 });
         const body = await request.json();
         const r = await fetch('https://api.anthropic.com/v1/messages', {
           method: 'POST',
           headers: {
             'x-api-key': env.ANTHROPIC_API_KEY,
             'anthropic-version': '2023-06-01',
             'content-type': 'application/json'
           },
           body: JSON.stringify({
             model: body.model || env.SANAD_DEFAULT_MODEL || 'claude-haiku-4-5-20251001',
             max_tokens: body.max_tokens || 800,
             system: body.system,
             messages: body.messages,
             stream: !!body.stream
           })
         });
         return new Response(r.body, { status: r.status, headers: r.headers });
       }
       return env.ASSETS.fetch(request);
     }
   };
   ```
2. Cloudflare dashboard → **Workers & Pages → site → Settings → Variables and Secrets**
   - Add Encrypted Secret: `ANTHROPIC_API_KEY = sk-ant-...`
   - *(Optional)* Plain text: `SANAD_DEFAULT_MODEL = claude-haiku-4-5-20251001`
3. Push or trigger a redeploy. The topbar badge flips to **Live · Haiku 4.5**.

## Cost guardrails (when live)

- **Claude Haiku 4.5** at ~$0.80 input / $4.00 output per 1M tokens. A
  suggested reply ≈ 500 in + 150 out tokens ≈ **$0.001 per call**.
- Add a rate limit (e.g. 20 req/min per IP) in the Worker to cap abuse.
- Switch to **Sonnet 4.6** or **Opus 4.7** from the in-app **AI Console**.
- Prompt caching: send the system prompt as a content array with
  `cache_control: { type: 'ephemeral' }` to save ~90% on repeats.

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
    │                          227 messages, 77 KB articles
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
