# Marsad - fleet / logistics dispatcher console

A real-time dispatcher console for a Dubai last-mile courier. 16 drivers, 12 vans + 4 motorbikes, 96 in-flight orders across 6 service zones. Live Leaflet map with vehicle pins that tick every 4 seconds toward their next drop-off, severity-sorted order queue with SLA breach detection + audio cues, AI dispatcher copilot.

Part of the [saadm.dev](https://saadm.dev/) portfolio. Live at <https://saadm.dev/marsad/>.

## What's inside

- **Dispatcher console** (`console.html`) - live Leaflet map + KPI strip + order queue + driver list + AI batch-assign + dispatcher chat
- **Driver view** (`driver.html`) - simplified UI for a single driver: current job, route, COD pill, complete / handover, today's earnings
- **Admin SPA** (`admin.html`) - 9 sections: Dashboard, Orders, Drivers, Vehicles, Zones, Integrations, AI Console, Settings, Audit log
- **AI features**: 3 wired into the UI - `explainDelay`, `batchOptimize`, `dispatcherChat` - plus a `suggestReroute` helper (mock + system prompt ready, not yet surfaced in the UI). Live AI when a Cloudflare Worker is configured; deterministic mock otherwise.

## How it behaves on the site

`saadm.dev/marsad/` is a regular static folder served by Cloudflare Pages. No iframe, no separate domain, no app store. Open from the saadm.dev homepage card → `console.html` in a new tab. The page mounts a real Leaflet map (dark Carto tiles) centred on Dubai, places the hub + 96 order pins + 16 vehicle markers, then starts ticking. Vehicles inch toward their assigned drop-offs; when a vehicle gets within ~120m of its target, the order flips to "delivered" and a chime plays.

The fleet simulator state lives in memory only - no localStorage persistence for vehicle positions (they'd be wrong on next visit anyway). Order edits + driver assignments DO persist to localStorage so the admin actions stick across reloads.

## Live-mode setup (optional)

Same secret as Sanad/Watad/Ask/Lahza - set once, all five features use it.

1. Cloudflare → Workers & Pages → site → Settings → Variables and Secrets
2. Confirm `LLM_API_KEY` is set (added during Sanad's live-mode setup - value lives in CF's encrypted store).
3. *(Optional)* Plain variable: `MARSAD_DEFAULT_MODEL` (defaults to `fast`).
4. Extend the existing Worker with a `/api/marsad/ai/*` branch - see snippet below.

### Reference Worker handler

```js
if (url.pathname.startsWith('/api/marsad/ai/')) {
  if (url.pathname === '/api/marsad/ai/health') {
    return Response.json({
      ok: true,
      live: !!env.LLM_API_KEY,
      model: env.MARSAD_DEFAULT_MODEL || 'fast'
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
      model: body.model || env.MARSAD_DEFAULT_MODEL || 'fast',
      max_tokens: body.max_tokens || 500,
      system: body.system,
      messages: body.messages
    })
  });
  return new Response(r.body, { status: r.status, headers: r.headers });
}
```

The key value never lives in this repo - only in Cloudflare's encrypted secret store.

## Cost guardrails (when live)

- `explain_delay` ≈ $0.0006/call
- `suggest_reroute` ≈ $0.0010/call (longer prompt, includes queue list)
- `batch_optimize` ≈ $0.0014/call (longest - pending list + driver list)
- `dispatcher_chat` ≈ $0.0007/call

A visitor playing with the demo for 5 min triggers ~8 calls = **~$0.007 / visitor**. Worker rate-limit 30 calls/min/IP.

## Files

```
marsad/
├── index.html             Landing page
├── console.html           Dispatcher console (the centrepiece)
├── driver.html            Driver-side view
├── admin.html             Admin SPA shell
├── 404.html
├── README.md
├── css/marsad.css         Design system - deep navy + warm orange + electric cyan
└── js/
    ├── data.js            Seed: hub, 16 drivers, 16 vehicles, 24 customers, 96 orders
    ├── fleet-sim.js       Real-time vehicle simulator - 4s tick, subscriber pattern
    ├── mock-api.js        Fetch interceptor for /marsad/api/*
    ├── ai-engine.js       window.MarsadAI - 4 dispatcher-tuned AI features
    ├── app.js             window.MarsadApp - helpers
    ├── notifications.js   Toast stack + Web Audio cues
    ├── map.js             Leaflet wrapper - vehicle/order/hub markers + route layer
    ├── console.js         Dispatcher console
    ├── driver.js          Driver view
    ├── admin.js           Admin SPA shell
    └── admin-sections.js  9 admin section renderers
```

## What it proves

Adds a **maps + real-time** shape to the portfolio that's distinct from Watad's BMS console. The whole industry of last-mile couriers in Dubai (Aramex, Noon Express, Talabat, Careem) runs on software that looks roughly like this - Onfleet, Bringg, Locus. The five AI integrations across the portfolio now span: customer support (Sanad), facilities operations (Watad), recruiter Q&A (Ask Saad), personal wellness (Lahza), and last-mile dispatch (Marsad).
