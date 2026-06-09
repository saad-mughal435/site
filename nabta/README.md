# Nabta - HR + payroll SaaS for UAE companies

A modern UAE-shaped HRIS demo. 32 employees across 5 departments, leave management with approval workflow, WPS-compliant payroll runs, recruitment kanban, performance reviews, and a Claude-powered HR policy assistant grounded in the company handbook + UAE Labour Law.

Part of the [saadm.dev](https://saadm.dev/) portfolio. Live at <https://saadm.dev/nabta/>.

## What's inside

- **Dashboard** - KPIs (employees, pending leave, open roles, visa renewals, next payroll), recent leave activity, headcount by department
- **Employees** - 32 employees with UAE-specific fields (Emirates ID, passport, visa expiry, IBAN, base + allowances). Filter by department / status. Drill into a profile sheet.
- **Leave** - 7 leave types · 18 in-flight requests · pending → approved / rejected workflow · line-manager + HR sign-off
- **Payroll** - 6 months of historical WPS runs + current draft. Per-employee breakdown (base + allowances − deductions = net). "Generate WPS SIF + Finalize" flow.
- **Recruitment** - kanban: lead / applied / interview / offer / hired. 4 open roles · 22 candidates · source + rating + expected salary tracking.
- **Performance** - Q2-2026 review cycle. 12 reviews across status (not started / in progress / submitted). Rating + goals-met %.
- **Policies** - 6 HR policies (leave, WPS, visa, gratuity, probation, remote) + UAE Labour Law context. Used as the RAG corpus for the AI assistant.
- **AI policy assistant** - Claude grounded in the 6 policies + UAE Labour Law. Every answer cites the policy it leans on with `[pol-xxx]` chips that open the source. Live + mock fallback.
- **Settings + Audit** - company settings (pay day, WPS code, leave caps, probation), audit log with action history.

## Live-mode setup (optional)

Same Cloudflare Worker + Anthropic key as the other AI demos. Set once, all six AI integrations across the portfolio use it.

1. Cloudflare → Workers & Pages → site → Settings → Variables and Secrets.
2. Confirm `ANTHROPIC_API_KEY` is set (value lives in the encrypted secret store - never in this repo).
3. *(Optional)* `NABTA_DEFAULT_MODEL` (defaults to `claude-haiku-4-5-20251001`).
4. Extend the existing Worker with a `/api/nabta/ai/*` branch - same shape as the Sanad / Watad / Ask / Lahza / Marsad handlers.

### Reference Worker handler

```js
if (url.pathname.startsWith('/api/nabta/ai/')) {
  if (url.pathname === '/api/nabta/ai/health') {
    return Response.json({
      ok: true,
      live: !!env.ANTHROPIC_API_KEY,
      model: env.NABTA_DEFAULT_MODEL || 'claude-haiku-4-5-20251001'
    });
  }
  if (!env.ANTHROPIC_API_KEY) {
    return Response.json({ ok: false, error: 'no_key', fallback: true }, { status: 503 });
  }
  const body = await request.json();
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: body.model || env.NABTA_DEFAULT_MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: body.max_tokens || 500,
      system: body.system,
      messages: body.messages
    })
  });
  return new Response(r.body, { status: r.status, headers: r.headers });
}
```

The key value lives only in Cloudflare's encrypted secret store - never in code, never in this README, never in commits.

## Cost guardrails (when live)

The policy assistant uses a focused RAG retrieve (top-3 of 6 policies) + a short system prompt. Average call:

- ~700 input tokens (system + 3 retrieved policies + 1-2 history turns + question)
- ~120 output tokens
- ≈ $0.0010 / call with Haiku 4.5
- With prompt caching: ≈ $0.0002 / call on cache hit (the system prompt + policy corpus are stable, perfect for caching)

A visitor playing with the demo for 5 min triggers ~6 calls = **~$0.006 / visitor**. Worker rate-limit 30 calls/min/IP.

## Files

```
nabta/
├── index.html       Landing page
├── app.html         The SPA shell - hash-routed (9 sections)
├── 404.html
├── README.md
├── css/nabta.css    Design system - emerald + cream light theme
└── js/
    ├── data.js      Seed: 32 employees · 18 leaves · 7 payroll runs · 22 candidates · 6 policies
    ├── mock-api.js  Fetch interceptor for /nabta/api/*
    ├── ai-engine.js NabtaAI policyChat with retrieve + [pol-xxx] citation parsing
    ├── app.js       NabtaApp helpers (api, showModal, fmt, escapeHtml, toast)
    └── sections.js  9 section renderers (dashboard, employees, leave, payroll, recruit,
                     performance, policies, ai_chat, settings, audit)
```

## What it proves

Adds a **B2B SaaS** shape to the portfolio that's deliberately UAE-shaped (WPS / Emirates ID / Federal Decree-Law No. 33 of 2021) - the kind of software every Dubai / Abu Dhabi mid-size company actually runs but typically buys (Bayzat, GulfTalent, Zimyo) rather than builds. Now sits alongside Marsad (logistics) as the second B2B vertical demo and brings the AI integration count to six.
