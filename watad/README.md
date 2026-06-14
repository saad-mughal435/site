# Watad - smart-building / BMS operations console

A live operator console for a commercial smart building. Live SVG floor plan
plotting equipment as icons, simulated BACnet/Modbus telemetry stream,
severity-sorted alarm queue with audio cues, predictive-maintenance work
orders, ASHRAE-overlaid energy curves, and an AI copilot trained on BMS
patterns (explain alarm, suggest preventive maintenance, optimise setpoints).

Built to demonstrate the intersection of **electrical engineering + operations
software** - the exact gap UAE facilities-management (Imdaad / EFS / Farnek),
building-automation (Schneider / Honeywell / Siemens), and data-centre
operations (Khazna) recruiters hire for.

## Modes

| Mode | When | Behaviour |
| --- | --- | --- |
| **Demo** | Default | Telemetry simulator + deterministic mock AI replies. Every feature works realistically. Topbar shows **Demo mode**. |
| **Live** | Cloudflare Worker at `/api/watad/ai/*` deployed AND `LLM_API_KEY` set | Real AI responses (Fast default). Topbar shows **Live · Fast**. |

Re-uses the same `LLM_API_KEY` secret as the Sanad demo - set once,
both demos use it.

## Files

```
watad/
├── index.html                 Landing
├── console.html               Operations console (the centrepiece)
├── asset.html                 Asset detail drill-in
├── workorders.html            Work-orders module
├── energy.html                Energy dashboard
├── admin.html                 Admin SPA (11 sections)
├── 404.html                   Branded not-found
├── css/watad.css              Design system - dark navy + electric cyan
└── js/
    ├── data.js                Seed: building + 4 floors + 24 zones + 48
    │                          assets + 182 points + 30 alarms + 15 WOs
    ├── telemetry-sim.js       The real-time data engine - 5s tick,
    │                          plausible value mutation per asset class,
    │                          alarm raise/clear, 288-sample history buffer
    │                          per point from a seeded RNG
    ├── mock-api.js            Fetch interceptor for /watad/api/*
    ├── ai-engine.js           WatadAI - 3 BMS features (explainAlarm,
    │                          suggestMaintenance, optimizeSetpoints).
    │                          Live + mock fallback.
    ├── app.js                 Shared helpers (window.WatadApp)
    ├── notifications.js       Toast stack + Web Audio alarm chime
    ├── floorplan.js           SVG floor plan renderer (equipment icons +
    │                          alarm pulse + click-to-drill)
    ├── console.js             Ops console page logic
    ├── asset.js               Asset detail page logic
    ├── workorders.js          Work-orders module
    ├── energy.js              Energy dashboard
    ├── admin.js               Admin SPA shell
    └── admin-sections.js      11 admin section renderers
```

## Live-mode setup (one-time)

The Worker proxy is **not bundled** with this repo (Cloudflare's
"Workers with Static Assets" configuration requires a dashboard-side mode
switch that hasn't been toggled yet - see `sanad/README.md` for the
documented reference Worker that handles both `/api/sanad/ai/*` and
`/api/watad/ai/*`). Once that's in place:

1. Cloudflare → Workers & Pages → site → Settings → Variables and Secrets
2. Add (or reuse) Encrypted Secret: `LLM_API_KEY = <your-api-key>`
3. *(Optional)* Plain text variable: `WATAD_DEFAULT_MODEL = fast`
4. Push or trigger a redeploy. Watad's topbar flips from **Demo mode** to
   **Live · Fast** automatically.

Reference Worker handler for the proxy:

```js
// inside _worker.js fetch() handler, alongside the Sanad branch:
if (url.pathname.startsWith('/api/watad/ai/')) {
  if (url.pathname === '/api/watad/ai/health') {
    return Response.json({ ok: true, live: !!env.LLM_API_KEY,
      model: env.WATAD_DEFAULT_MODEL || 'fast' });
  }
  if (!env.LLM_API_KEY)
    return Response.json({ ok: false, error: 'no_key', fallback: true }, { status: 503 });
  const body = await request.json();
  const r = await fetch('https://api.your-llm-provider.com/v1/chat', {
    method: 'POST',
    headers: {
      'x-api-key': env.LLM_API_KEY,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: body.model || env.WATAD_DEFAULT_MODEL || 'fast',
      max_tokens: body.max_tokens || 600,
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
- `explain_alarm` ≈ $0.001/call.
- `suggest_maintenance` ≈ $0.003/call (longer context).
- `optimize_setpoints` ≈ $0.005/call.
- Rate-limit 20 calls/min per IP in the Worker.
- Prompt caching enabled by default (~90% cost savings on repeat system-prompt).
