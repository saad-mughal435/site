# LLM Gateway - browser demo

A watchable walkthrough of the request pipeline used by
[llm-gateway](https://github.com/saad-mughal435/llm-gateway), a production LLM gateway written in
Python/FastAPI. The service puts one API in front of any provider and handles the parts that
actually bite in production: routing, retries with exponential backoff, circuit breaking, provider
failover, response caching, tool calling, JSON-schema-constrained output with a repair loop,
per-key rate limiting, budgets, structured logging and cost accounting.

Part of the [saadm.dev](https://saadm.dev/) portfolio. Live at <https://saadm.dev/llm-gateway/>.

## What this is, and what it is not

This page is a **client-side reimplementation of the gateway's control flow**. It calls no language
model, holds no API key, and makes no network request of any kind. Providers, latencies, token
counts, prices, failures and cooldowns are simulated deterministically in the browser, so the
mechanics - backoff timing, breaker transitions, cache hits, repair rounds, budget refusal - can be
watched as they happen at zero cost.

Every figure shown on the page is synthetic. The Python service linked above is the real
implementation; this is a teaching model of its pipeline, not a client for it.

## Pipeline stages and what they map to

The stage list rendered in the pipeline panel follows the order the Python request handler runs in.

| Stage | Production concern |
| --- | --- |
| Authenticate | API-key lookup, key-scoped policy and quota |
| Rate limit | Per-key token bucket; sheds load before any provider cost is incurred |
| Budget check | Hard spend ceiling per key/period; refuses rather than overspends |
| Cache lookup | Hash of prompt + model + options; avoids paying twice for the same request |
| Route | Provider/model selection from the routing table for the requested alias |
| Attempt | The provider call, with per-attempt timeout and error classification |
| Retry | Exponential backoff with jitter on retryable classes only (never on 4xx like bad_request) |
| Circuit breaker | Failure counting per provider; opens to stop hammering a sick dependency, half-opens to probe |
| Failover | Next healthy provider in the chain when the primary is open or exhausted |
| Tool loop | Tool-call detection, tool execution, result fed back for a second turn |
| Schema validation | JSON-schema check on the completion; invalid output triggers a bounded repair round |
| Cache write | Successful responses stored for later hits |
| Accounting | Prompt/completion tokens priced per provider, added to spend and to cache savings |
| Log | One structured JSON line per request with request id, provider, outcome, latency and cost |

## Scenarios

Each scenario button sets the controls and sends a request; you can also drive the controls and the
fault-injection selector by hand.

| Scenario | What it demonstrates |
| --- | --- |
| `happy` | The clean path end to end: route, call, price, cache, log |
| `retry` | A transient failure recovered by backoff, with the delay of each attempt shown |
| `failover` | The primary provider stays down, so the request lands on the secondary |
| `circuit` | Repeated failures trip the breaker open; later requests skip that provider until it half-opens |
| `cache` | The same request twice - second one is served from cache with no tokens and no spend |
| `tools` | A tool call is emitted, executed locally, and the result returned for the final answer |
| `schema-repair` | The first completion violates the JSON schema and is repaired within the retry budget |
| `ratelimit` | The token bucket is exhausted and the gateway returns 429 before spending anything |
| `budget` | The spend ceiling is reached and further requests are refused rather than billed |

## Files

```
llm-gateway/
├── index.html          Single page: controls, pipeline, providers, stats, ledger, response, log
├── css/gateway.css     Design system - dark + light via [data-theme], tabular figures
└── js/
    ├── engine.js       window.GatewayEngine + window.GATEWAY_SCENARIOS - the simulated
    │                   pipeline; emits stage/log/provider/attempt/usage/done/error events
    └── app.js          DOM wiring only - renders engine events into the panels
```

## Running it

No build step and no dependencies. Open `index.html` directly, or serve the folder with any static
server:

```sh
python -m http.server 8080     # then http://localhost:8080/llm-gateway/
```

The demo honours the site theme (`localStorage` key `theme`, falling back to
`prefers-color-scheme`) and `prefers-reduced-motion`.
