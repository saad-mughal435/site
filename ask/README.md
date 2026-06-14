# Ask Saad - recruiter AI chatbot

A floating chat widget on the **saadm.dev** homepage and contact page. Recruiters type a question ("Does he know Python?" / "What did he build at Kingsley?" / "Can he relocate?") and get a 2-4 sentence answer grounded in Saad's actual portfolio + experience, with one-click citation chips that drill into the relevant demo / role / FAQ.

This is **a feature on the homepage, not a 9th demo**. The corpus is ~40 pre-chunked documents extracted from the existing homepage content (`HERO_COPY`, `FAQ_ITEMS`, `EXPERIENCE`, `PROJECTS`, `STACK_GROUPS`, About prose, `WhatThisProves`, `SKILLS`). No new prose was authored - the existing site is already rich enough.

## Modes

| Mode | When | Behaviour |
|------|------|-----------|
| **Demo** | Default | Keyword retrieval + a deterministic mock dictionary that returns templated answers built from the top-retrieved doc's body. Mode badge reads **Demo mode**. Every feature works - no key required. |
| **Live** | Cloudflare Worker at `/api/ask/ai/*` deployed AND `LLM_API_KEY` set | Real AI responses, grounded in the same retrieved-top-3 docs via a system-prompt CONTEXT block. Mode badge reads **Live · Fast**. |

Reuses the same `LLM_API_KEY` secret as the Sanad + Watad demos - set once, all three features use it.

## Files

```
ask/
├── README.md                Live-mode setup (this file)
├── css/ask.css              Scoped --ask-* styles for the bubble + window
└── js/
    ├── app.js               window.AskApp - escapeHtml, jget/jset, showModal
    ├── corpus.js            window.AskCorpus - 40 RAG docs + tokenizer
    ├── engine.js            window.AskAI - health, retrieve, answer, mockAnswer
    └── chat.js              window.AskChat - the chat widget UI (lifted from
                             sanad/js/chat.js, trimmed for this use case)
```

## How retrieval works

`AskAI.retrieve(query, k=3)` scores every document by:

```
score = tagOverlap × 2 + titleMatch × 1.5 + min(bodyTokenOverlap, 8) × 1
```

Tags carry the most weight (they're hand-curated per doc), so questions like "does he know Python?" score `lang-stack` highly because `python` is in its tag set. The top 3 docs are passed to AI in a `CONTEXT:` block, each tagged `[doc-id]`. the model is instructed to cite by `[doc-id]` at sentence endings, and the client parses those markers into clickable citation chips.

No embeddings, no vector DB - the corpus is ~5 KB total, simple substring + token-overlap scoring is plenty.

## Live-mode setup (one-time)

The Worker proxy is **not bundled** with this repo (Cloudflare's "Workers with Static Assets" configuration requires a dashboard-side mode switch - see `sanad/README.md` for the documented reference Worker). Once that's in place:

1. Cloudflare → Workers & Pages → site → Settings → Variables and Secrets
2. Add (or reuse) Encrypted Secret: `LLM_API_KEY = <your-api-key>`
3. *(Optional)* Plain text variable: `ASK_DEFAULT_MODEL = fast`
4. Push or trigger a redeploy. The chat's mode badge flips from **Demo mode** to **Live · Fast** automatically.

### Reference Worker handler

Add this branch to your existing `_worker.js` alongside the Sanad and Watad branches:

```js
if (url.pathname.startsWith('/api/ask/ai/')) {
  if (url.pathname === '/api/ask/ai/health') {
    return Response.json({
      ok: true,
      live: !!env.LLM_API_KEY,
      model: env.ASK_DEFAULT_MODEL || 'fast'
    });
  }
  if (url.pathname === '/api/ask/ai/rate') {
    // Analytics no-op - the client also persists to localStorage.
    return Response.json({ ok: true });
  }
  if (!env.LLM_API_KEY) {
    return Response.json({ ok: false, error: 'no_key', fallback: true }, { status: 503 });
  }
  const body = await request.json();
  const r = await fetch('https://api.your-llm-provider.com/v1/chat', {
    method: 'POST',
    headers: {
      'x-api-key': env.LLM_API_KEY,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: body.model || env.ASK_DEFAULT_MODEL || 'fast',
      max_tokens: body.max_tokens || 500,
      system: body.system,
      messages: body.messages,
      stream: !!body.stream
    })
  });
  return new Response(r.body, { status: r.status, headers: r.headers });
}
```

## Cost guardrails (when live)

- **AI Fast** at ~$0.80/M input + ~$4/M output tokens.
- Average `answer` call: ~600 input tokens (system + 3 docs + history) + ~150 output tokens ≈ **$0.0011 / call**.
- System prompt is short and stable - the LLM provider prompt-caching reduces input cost by ~90% on cache hits → **~$0.0002 / cached call**.
- Recommend Worker rate-limit of 30 calls / minute / IP.
- A high-traffic day (~300 visitors, ~3 questions each) costs **~$1**.

## What this proves

Three AI integrations on saadm.dev now, all using the same Cloudflare Worker, same LLM API key, same Live/Mock fallback pattern:

| Demo | What the AI does |
|------|------------------|
| [Sanad](https://saadm.dev/sanad/) | Customer-support copilot - drafts replies, summarises tickets, sentiment, EN↔AR translate, RAG over a 77-article KB |
| [Watad](https://saadm.dev/watad/) | BMS / facilities operations - explains alarms with grounded action + cause, suggests preventive maintenance, optimises setpoints |
| **Ask Saad** (this) | Interviewing the candidate - answers recruiter questions grounded in CV + portfolio, with demo citations |

Three domains, three applications, one engineering foundation. That's the meta-narrative the demos lock in together.
