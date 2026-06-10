# Lahza - AI journaling + mood-tracking PWA

A mobile-first **Progressive Web App** for personal journaling: a daily AI-suggested prompt, a few sentences, and the model surfaces the patterns across the week. Installable on iOS, Android, and desktop via "Add to Home Screen" - no App Store, no native code.

Part of the [saadm.dev](https://saadm.dev/) portfolio. Live at <https://saadm.dev/lahza/>.

## What's inside

- **Onboarding** - 3 swipeable cards on first visit (welcome → goal → reminder time)
- **Today** - AI-suggested journal prompt + streak ring + quick recent-entries strip
- **Compose** - full-screen writing view with mood emoji picker, tag chips, prompt-cycling
- **Journal feed** - chronological cards with mood dots, search, filter by mood/tag
- **Insights** - 7-day mood line chart + theme tags + AI weekly summary card
- **AI Coach** - chat grounded in the user's last 14 entries via RAG, citation chips that open the cited entry in a bottom sheet
- **Profile** - streak, total entries, language (EN/AR), theme, reset-demo

## How it behaves on the site

- **Desktop visit:** the app renders inside a stylised iPhone frame centred on a soft gradient backdrop. Visitor interacts with the simulated phone screen.
- **Mobile visit:** fullscreen, edge-to-edge, looks native inside the browser tab.
- **Installed PWA:** opens in a standalone window with no browser chrome. Indistinguishable from a native app at a glance.

Same fetch interceptor pattern as the other demos (`mock-api.js` shims `/lahza/api/*` to localStorage). Same Live/Mock fallback for AI calls (`/api/lahza/ai/*` → Cloudflare Worker → AI, or deterministic mock dictionary if no Worker is configured).

## Privacy

**Entries stay on the device.** They live in your browser's `localStorage` and never leave it - except when Live AI mode is configured, in which case the **active question** is sent to the LLM API via a Cloudflare Worker proxy (the entry text is included as context for that single call, then discarded). Settings → Reset demo wipes everything.

## Live-mode setup (optional)

The Worker proxy is not bundled with this repo. To enable real AI responses:

1. Cloudflare → Workers & Pages → site → Settings → Variables and Secrets.
2. Add (or reuse) Encrypted Secret: `LLM_API_KEY` (value set in the dashboard - never in code or this README).
3. *(Optional)* Plain text variable: `LAHZA_DEFAULT_MODEL` (defaults to `fast`).
4. The Worker needs to handle `/api/lahza/ai/*`. If the existing Worker already routes Sanad and Watad, append the snippet below as a parallel branch and redeploy.

### Reference Worker handler

Add this branch to your existing `_worker.js`:

```js
if (url.pathname.startsWith('/api/lahza/ai/')) {
  if (url.pathname === '/api/lahza/ai/health') {
    return Response.json({
      ok: true,
      live: !!env.LLM_API_KEY,
      model: env.LAHZA_DEFAULT_MODEL || 'fast'
    });
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
      model: body.model || env.LAHZA_DEFAULT_MODEL || 'fast',
      max_tokens: body.max_tokens || 500,
      system: body.system,
      messages: body.messages
    })
  });
  return new Response(r.body, { status: r.status, headers: r.headers });
}
```

The secret value lives in Cloudflare's encrypted store, never in this repo, never on the client.

## Cost guardrails (when live)

- `detectMood` ~$0.0004/call (short input, short output)
- `suggestPrompt` ~$0.0002/call
- `weeklyInsights` ~$0.0012/call (7 entries × ~80 tokens of context)
- `coachChat` ~$0.0008/call

A visitor playing with the demo for 5 min triggers ~6 calls = **~$0.004 / visitor**. Set a Worker rate-limit of 30 calls/min/IP to cap blast radius.

## Files

```
lahza/
├── index.html                The single-page app shell
├── manifest.webmanifest      PWA manifest (name, icons, scope=/lahza/, display=standalone)
├── sw.js                     Service worker (cache-first static, network-first HTML+AI)
├── README.md                 This file
├── icons/
│   ├── icon.svg              Vector icon (favicon + manifest "any")
│   ├── icon-192.png          PWA icon 192×192
│   ├── icon-512.png          PWA icon 512×512
│   └── icon-maskable-512.png Maskable icon for Android home-screen
├── css/lahza.css             Design system - warm-dusk palette, mood scale, phone-frame chrome
└── js/
    ├── data.js               Seed: 14 days of fabricated entries, mood pools, tag pool
    ├── mock-api.js           Fetch interceptor for /lahza/api/* (entries/streak/mood/insights/settings)
    ├── app.js                window.LahzaApp helpers (jget/jset, fmtDate, showSheet, toast, MOOD_*, computeStreak)
    ├── ai-engine.js          window.LahzaAI - health, suggestPrompt, detectMood, weeklyInsights, coachChat
    ├── router.js             Hash-routed view switcher + bottom tab bar + onboarding gate
    └── views/
        ├── onboarding.js     3-card swipe onboarding
        ├── today.js          Today view: AI prompt + streak + recent strip
        ├── compose.js        Full-screen writing modal
        ├── journal.js        Chronological entry feed + filters
        ├── insights.js       Weekly chart + themes + AI weekly summary
        ├── coach.js          AI Coach chat with citation chips
        └── profile.js        Streak, language, theme, reset-demo
```

## Local development

```bash
cd site
python -m http.server 8000
# open http://127.0.0.1:8000/lahza/
```

The service worker requires `https://` or `localhost` to register. On `127.0.0.1`, it works. PWA install prompts (Chrome / Edge) fire after a brief engagement period - refresh, click around, the install icon appears in the address bar.

## What it proves

This is the **first mobile-shaped demo** in the saadm.dev portfolio (the other eight are desktop-first dashboards / marketplaces / admin SPAs). It's also the fourth AI integration in the portfolio after Sanad (customer support), Watad (industrial operations), and Ask Saad (recruiter Q&A) - same Cloudflare Worker, same encrypted-secret pattern, four products.

Four domains, one engineering foundation.
