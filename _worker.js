/* _worker.js - Cloudflare Worker entry for saadm.dev.
 *
 * Purpose: serve the Sanad demo's AI proxy at /api/sanad/ai/* so the
 * Anthropic API key stays server-side. Every other request falls through
 * to env.ASSETS.fetch() and is served as a static asset, identical to the
 * previous deployment.
 *
 * Bindings (configure in Cloudflare dashboard or wrangler.jsonc):
 *   env.ASSETS              auto-bound by Workers Builds (assets.directory)
 *   env.ANTHROPIC_API_KEY   secret — required for live mode
 *   env.SANAD_DEFAULT_MODEL plain text — optional, defaults to Haiku 4.5
 *
 * When ANTHROPIC_API_KEY isn't set, the /call endpoint returns 503 with
 * {fallback:true} so the client falls back to its deterministic mock.
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const RATE_PER_MIN = 20;
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const ALLOWED_MODELS = [
  'claude-haiku-4-5-20251001',
  'claude-sonnet-4-6',
  'claude-opus-4-7'
];

// In-memory rate limit. Resets per Worker isolate so it's "best-effort", not
// auth-grade. For real abuse protection use a Durable Object or KV namespace.
const rate = new Map();

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/api/sanad/ai/health') return jsonResponse(health(env));

    if (path.startsWith('/api/sanad/ai/')) {
      if (request.method === 'OPTIONS') return preflight();
      const limited = rateLimit(request);
      if (limited) return limited;
      try {
        return await handleAI(request, env);
      } catch (e) {
        return jsonResponse({ ok: false, error: 'proxy_error', fallback: true, message: String(e && e.message || e) }, 502);
      }
    }

    // Anything else → static asset.
    return env.ASSETS.fetch(request);
  }
};

function health(env) {
  return {
    ok: true,
    live: !!env.ANTHROPIC_API_KEY,
    model: env.SANAD_DEFAULT_MODEL || DEFAULT_MODEL,
    allowed_models: ALLOWED_MODELS,
    rate_per_min: RATE_PER_MIN
  };
}

async function handleAI(request, env) {
  if (!env.ANTHROPIC_API_KEY) {
    return jsonResponse({ ok: false, error: 'no_key', fallback: true }, 503);
  }
  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
  }

  let body;
  try { body = await request.json(); }
  catch (e) { return jsonResponse({ ok: false, error: 'bad_json' }, 400); }

  const model = ALLOWED_MODELS.indexOf(body.model) !== -1
    ? body.model
    : (env.SANAD_DEFAULT_MODEL || DEFAULT_MODEL);
  const maxTokens = clampInt(body.max_tokens, 32, 2000, 800);
  const temperature = typeof body.temperature === 'number'
    ? Math.max(0, Math.min(1, body.temperature)) : 0.4;
  const stream = !!body.stream;

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return jsonResponse({ ok: false, error: 'no_messages' }, 400);
  }

  const payload = {
    model: model,
    max_tokens: maxTokens,
    temperature: temperature,
    system: body.system,           // pass through (string or array w/ cache_control)
    messages: body.messages,
    stream: stream
  };

  const upstream = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (stream) {
    // Pipe SSE straight through to the client.
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') || 'text/event-stream',
        'cache-control': 'no-cache',
        ...corsHeaders()
      }
    });
  }

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') || 'application/json',
      ...corsHeaders()
    }
  });
}

function rateLimit(request) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const minute = Math.floor(Date.now() / 60000);
  const key = ip + ':' + minute;
  const n = (rate.get(key) || 0) + 1;
  rate.set(key, n);
  // Garbage-collect stale buckets occasionally.
  if (rate.size > 500) {
    for (const k of rate.keys()) {
      const m = parseInt(k.split(':')[1], 10);
      if (m !== minute) rate.delete(k);
      if (rate.size <= 200) break;
    }
  }
  if (n > RATE_PER_MIN) {
    return jsonResponse({ ok: false, error: 'rate_limited', retry_after: 60 }, 429);
  }
  return null;
}

function preflight() {
  return new Response(null, { status: 204, headers: {
    ...corsHeaders(),
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-allow-methods': 'GET, POST, OPTIONS'
  }});
}

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-expose-headers': 'content-type'
  };
}

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'content-type': 'application/json', ...corsHeaders() }
  });
}

function clampInt(v, lo, hi, def) {
  const n = parseInt(v, 10);
  if (isNaN(n)) return def;
  return Math.max(lo, Math.min(hi, n));
}
