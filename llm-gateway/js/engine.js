/*
 * llm-gateway - browser reimplementation of the gateway pipeline.
 *
 * This file is a faithful port of the CONTROL FLOW of the Python/FastAPI
 * gateway (app/core/{retry,circuit,ratelimit,cache,tokens,errors}.py plus the
 * orchestrator): authenticate -> rate limit -> budget -> cache -> route ->
 * circuit -> generate with retries -> tools -> structured output -> accounting
 * -> cache store.
 *
 * It is a SIMULATION. No language model is called, no network request is made,
 * and nothing here costs money. The "provider" is a deterministic text
 * generator seeded from a hash of the model and prompt, so the same input
 * always produces the same output and the same failure pattern. Everything
 * around it - the token bucket, the circuit breakers, the backoff maths, the
 * expression evaluator, the JSON Schema validator - is real code doing the real
 * work, because those are the parts worth watching.
 *
 * No DOM access lives in this file. It emits events; the view layer renders
 * them.
 *
 * Exports exactly two globals: GatewayEngine and GATEWAY_SCENARIOS.
 */

(function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Configuration
   * ------------------------------------------------------------------ */

  // USD per million tokens, mirroring config/gateway.json. Prices are
  // operator-supplied on purpose: hardcoding vendor prices guarantees they go
  // stale.
  var PRICING = {
    'sim-small': { input: 0.05, output: 0.2 },
    'sim-medium': { input: 0.5, output: 2.0 },
    'sim-large': { input: 3.0, output: 15.0 },
    'sim-flaky': { input: 0.5, output: 2.0 },
    'sim-down': { input: 0.5, output: 2.0 }
  };

  // One entry per simulated upstream. A route target is a (provider, model)
  // pair and each provider carries its own breaker, which is why a dead region
  // does not take the healthy ones down with it.
  var PROVIDERS = [
    { name: 'economy', model: 'sim-small', region: 'eu-west', baseLatencyMs: 170 },
    { name: 'standard', model: 'sim-medium', region: 'eu-west', baseLatencyMs: 260 },
    { name: 'primary', model: 'sim-large', region: 'us-east', baseLatencyMs: 380 },
    { name: 'flaky-edge', model: 'sim-flaky', region: 'ap-south', baseLatencyMs: 210 },
    { name: 'offline-region', model: 'sim-down', region: 'ap-south', baseLatencyMs: 120 }
  ];

  // The routing table. Each requested model resolves to an ordered chain of
  // targets; failover walks it left to right.
  var ROUTES = {
    'sim-small': ['economy'],
    'sim-medium': ['standard', 'economy'],
    'sim-large': ['primary', 'standard', 'economy'],
    'sim-flaky': ['flaky-edge', 'standard'],
    'sim-down': ['offline-region', 'standard']
  };

  var RETRY = {
    maxAttempts: 3,
    baseDelayMs: 250,
    factor: 2,
    maxDelayMs: 4000,
    // 1.0 = AWS-style full jitter (uniform over the whole window). The Python
    // policy defaults to 0.5; full jitter is used here because it is the
    // behaviour worth showing.
    jitter: 1.0
  };

  var BREAKER = {
    failureThreshold: 3,
    recoveryMs: 8000,
    halfOpenSuccesses: 1
  };

  var RATE_LIMIT = {
    capacity: 5,
    refillPerSecond: 1
  };

  var DEFAULT_BUDGET_USD = 0.05;

  // Cached replies go stale; a gateway that never expires them serves last
  // week's answer forever.
  var CACHE_TTL_MS = 120000;

  // A pre-flight budget check has to project the worst case, and the worst case
  // is the caller using its whole completion allowance.
  var MAX_TOKENS = 1024;

  // An injected fault models a transient blip: it clears after this many
  // failures so the retry path can be watched recovering. Persistent failure is
  // modelled by the sim-down model, which never recovers.
  var INJECT_TRANSIENT_FAILURES = 2;

  // Demo credential. It is not a secret and grants nothing: the check below
  // compares a string to a string so the auth stage has something real to do.
  var DEMO_API_KEY = 'gw_demo_2f9c41a7';
  var DEMO_KEY_SCOPES = ['chat:write', 'tools:invoke', 'cache:read'];

  var RETRYABLE_CODES = {
    provider_timeout: true,
    provider_rate_limited: true,
    provider_unavailable: true
  };

  var FAILOVERABLE_CODES = {
    provider_timeout: true,
    provider_rate_limited: true,
    provider_unavailable: true,
    provider_auth_error: true,
    circuit_open: true
  };

  var INJECT_TO_ERROR = {
    timeout: { code: 'provider_timeout', title: 'upstream timed out after 30s' },
    rate_limit: { code: 'provider_rate_limited', title: 'upstream returned 429', retryAfterMs: 400 },
    unavailable: { code: 'provider_unavailable', title: 'upstream returned 503' },
    bad_request: { code: 'provider_bad_request', title: 'upstream rejected the payload (400)' }
  };

  /* ------------------------------------------------------------------ *
   * Small utilities
   * ------------------------------------------------------------------ */

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, Math.max(0, Math.round(ms)));
    });
  }

  // FNV-1a. The real gateway fingerprints with SHA-256; crypto.subtle is
  // async-only and unavailable on insecure origins (this page has to work from
  // file://), so a 32-bit non-cryptographic hash stands in. It is a cache key,
  // not a security boundary.
  function hash32(str, seed) {
    var h = (seed === undefined ? 0x811c9dc5 : seed) >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }

  function hex8(n) {
    return ('0000000' + (n >>> 0).toString(16)).slice(-8);
  }

  // Two independently seeded passes give a 64-bit digest, which is enough to
  // make an accidental collision between two demo prompts implausible.
  function digest(str) {
    return hex8(hash32(str, 0x811c9dc5)) + hex8(hash32(str, 0x7fed7fed));
  }

  // mulberry32: tiny, fast, and repeatable. Determinism is the point - the same
  // prompt must always produce the same reply and the same flaky-provider
  // outcome, otherwise nothing on the page is reproducible.
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), 1 | t);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var ID_ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz'; // Crockford base32, no i/l/o/u
  function newId(prefix, length) {
    var n = length || 14;
    var out = '';
    for (var i = 0; i < n; i++) {
      out += ID_ALPHABET.charAt(Math.floor(Math.random() * ID_ALPHABET.length));
    }
    return prefix + '_' + out;
  }

  function clamp(n, lo, hi) {
    return Math.min(hi, Math.max(lo, n));
  }

  function round(n, places) {
    var f = Math.pow(10, places);
    return Math.round(n * f) / f;
  }

  function pick(rng, list) {
    return list[Math.floor(rng() * list.length) % list.length];
  }

  function stableJson(value) {
    return JSON.stringify(value, function (key, val) {
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        return Object.keys(val)
          .sort()
          .reduce(function (acc, k) {
            acc[k] = val[k];
            return acc;
          }, {});
      }
      return val;
    });
  }

  /* ------------------------------------------------------------------ *
   * Token estimation
   * ------------------------------------------------------------------ */

  // Approximation, not tokenisation: punctuation rarely merges into long tokens
  // so it is weighted heavier, and a run of short words cannot be fewer tokens
  // than there are words. In the real gateway this only guides trimming and the
  // pre-flight projection; every BILLED number comes from the usage block the
  // provider returns on the response.
  var CHARS_PER_TOKEN = 4;
  var DENSE_CHARS_PER_TOKEN = 1.5;
  var MESSAGE_OVERHEAD_TOKENS = 4;

  function estimateTokens(text) {
    if (!text) return 0;
    var dense = (text.match(/[^\w\s]/g) || []).length;
    var plain = text.length - dense;
    var words = (text.match(/\S+/g) || []).length;
    var estimate = dense / DENSE_CHARS_PER_TOKEN + plain / CHARS_PER_TOKEN;
    return Math.max(Math.ceil(estimate), words, 1);
  }

  function priceFor(model) {
    return PRICING[model] || PRICING['sim-medium'];
  }

  function costOf(model, promptTokens, completionTokens) {
    var p = priceFor(model);
    return (promptTokens * p.input + completionTokens * p.output) / 1000000;
  }

  /* ------------------------------------------------------------------ *
   * Errors
   * ------------------------------------------------------------------ */

  // Two questions matter to the orchestrator when a call fails: can retrying
  // the SAME provider help (retryable), and can moving to the NEXT one help
  // (failoverable). Everything else is presentation.
  function GatewayError(code, detail, extra) {
    var err = new Error(detail || code);
    err.name = 'GatewayError';
    err.code = code;
    err.detail = detail || code;
    err.retryable = !!RETRYABLE_CODES[code];
    err.failoverable = !!FAILOVERABLE_CODES[code];
    err.status = extra && extra.status ? extra.status : statusFor(code);
    if (extra) {
      for (var k in extra) {
        if (Object.prototype.hasOwnProperty.call(extra, k)) err[k] = extra[k];
      }
    }
    return err;
  }

  function statusFor(code) {
    switch (code) {
      case 'unauthenticated':
        return 401;
      case 'forbidden':
        return 403;
      case 'budget_exceeded':
        return 402;
      case 'rate_limit_exceeded':
      case 'provider_rate_limited':
        return 429;
      case 'provider_bad_request':
        return 400;
      case 'structured_output_failed':
        return 422;
      case 'provider_timeout':
        return 504;
      case 'provider_unavailable':
      case 'circuit_open':
      case 'no_provider_available':
        return 503;
      default:
        return 502;
    }
  }

  /* ------------------------------------------------------------------ *
   * Token bucket (app/core/ratelimit.py)
   * ------------------------------------------------------------------ */

  function TokenBucket(capacity, refillPerSecond) {
    this.capacity = capacity;
    this.refillPerSecond = refillPerSecond;
    this.tokens = capacity;
    this.updatedAt = Date.now();
  }

  // Refill is lazy: elapsed time is converted into tokens on read, so an idle
  // key costs nothing to track. A clock that jumps backwards must not mint
  // tokens, hence the max(0, ...).
  TokenBucket.prototype.consume = function (amount, now) {
    var elapsed = Math.max(0, now - this.updatedAt) / 1000;
    if (elapsed > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerSecond);
    }
    this.updatedAt = Math.max(this.updatedAt, now);
    if (amount <= this.tokens) {
      this.tokens -= amount;
      return { allowed: true, retryAfterMs: 0, remaining: this.tokens };
    }
    var deficit = amount - this.tokens;
    return {
      allowed: false,
      retryAfterMs: Math.ceil((deficit / this.refillPerSecond) * 1000),
      remaining: this.tokens
    };
  };

  /* ------------------------------------------------------------------ *
   * Circuit breaker (app/core/circuit.py)
   * ------------------------------------------------------------------ */

  function CircuitBreaker(name, config) {
    this.name = name;
    this.failureThreshold = config.failureThreshold;
    this.recoveryMs = config.recoveryMs;
    this.halfOpenSuccesses = config.halfOpenSuccesses;
    this._state = 'closed';
    this._failures = 0;
    this._probeSuccesses = 0;
    this._openedAt = null;
  }

  // The OPEN -> HALF_OPEN promotion happens on read rather than on a timer, so
  // a breaker for an idle provider costs nothing to maintain.
  CircuitBreaker.prototype.state = function () {
    if (this._state === 'open' && this._openedAt !== null && Date.now() - this._openedAt >= this.recoveryMs) {
      this._state = 'half_open';
      this._probeSuccesses = 0;
    }
    return this._state;
  };

  CircuitBreaker.prototype.allows = function () {
    return this.state() !== 'open';
  };

  CircuitBreaker.prototype.onSuccess = function () {
    var before = this.state();
    if (before === 'half_open') {
      this._probeSuccesses += 1;
      if (this._probeSuccesses >= this.halfOpenSuccesses) this.close();
    } else if (before === 'closed') {
      // Only an unbroken run of failures should trip the breaker; a success in
      // between means the provider is degraded, not down.
      this._failures = 0;
    }
    return before !== this.state() || before === 'closed';
  };

  CircuitBreaker.prototype.onFailure = function () {
    var before = this.state();
    this._failures += 1;
    // A failed probe means the provider is still sick, so re-open on the first
    // one rather than letting probes accumulate toward the threshold.
    if (before === 'half_open' || this._failures >= this.failureThreshold) this.open();
    return before !== this.state();
  };

  CircuitBreaker.prototype.open = function () {
    this._state = 'open';
    this._openedAt = Date.now();
    this._probeSuccesses = 0;
  };

  CircuitBreaker.prototype.close = function () {
    this._state = 'closed';
    this._failures = 0;
    this._probeSuccesses = 0;
    this._openedAt = null;
  };

  CircuitBreaker.prototype.cooldownMs = function () {
    if (this.state() !== 'open' || this._openedAt === null) return 0;
    return Math.max(0, this.recoveryMs - (Date.now() - this._openedAt));
  };

  CircuitBreaker.prototype.failures = function () {
    return this._failures;
  };

  /* ------------------------------------------------------------------ *
   * Local tools
   * ------------------------------------------------------------------ */

  var WEATHER_TABLE = {
    london: { temperature_c: 14, condition: 'light rain', wind_kph: 18, humidity_pct: 81 },
    dubai: { temperature_c: 38, condition: 'clear', wind_kph: 11, humidity_pct: 44 },
    karachi: { temperature_c: 33, condition: 'humid haze', wind_kph: 16, humidity_pct: 72 },
    lahore: { temperature_c: 36, condition: 'clear', wind_kph: 8, humidity_pct: 39 },
    berlin: { temperature_c: 11, condition: 'overcast', wind_kph: 21, humidity_pct: 68 },
    tokyo: { temperature_c: 19, condition: 'scattered cloud', wind_kph: 13, humidity_pct: 63 },
    singapore: { temperature_c: 31, condition: 'thunderstorms', wind_kph: 9, humidity_pct: 84 },
    'new york': { temperature_c: 17, condition: 'clear', wind_kph: 24, humidity_pct: 51 },
    sydney: { temperature_c: 22, condition: 'windy', wind_kph: 33, humidity_pct: 57 },
    toronto: { temperature_c: 9, condition: 'sleet', wind_kph: 27, humidity_pct: 74 }
  };

  var ORDER_STATUSES = ['processing', 'picked', 'in_transit', 'out_for_delivery', 'delivered', 'returned'];
  var ORDER_CARRIERS = ['Aramex', 'DHL', 'Royal Mail', 'FedEx', 'Emirates Post'];
  var ORDER_ITEMS = [
    'CNC spindle bearing kit',
    'PLC I/O expansion card',
    'industrial ethernet switch',
    'thermal transfer labels (5k)',
    'stainless conveyor belt section'
  ];

  function toolGetWeather(args) {
    var city = String(args.city || '').trim();
    var key = city.toLowerCase();
    var row = WEATHER_TABLE[key];
    if (!row) {
      return {
        ok: false,
        error: 'no_station: "' + city + '" is not in the station table',
        result: { available: Object.keys(WEATHER_TABLE) }
      };
    }
    return {
      ok: true,
      result: {
        city: city.replace(/\b\w/g, function (c) {
          return c.toUpperCase();
        }),
        temperature_c: row.temperature_c,
        condition: row.condition,
        wind_kph: row.wind_kph,
        humidity_pct: row.humidity_pct,
        source: 'fixed local table'
      }
    };
  }

  /*
   * calculate() - a real tokeniser and a real shunting-yard evaluator.
   *
   * eval() is NEVER used here, and that is deliberate rather than stylistic:
   * a tool argument is model-controlled text, so eval() on it hands arbitrary
   * script execution to whatever wrote the prompt. The tokeniser below accepts
   * digits, a decimal point, five operators and parentheses; anything else is
   * rejected before a single character is interpreted.
   */
  var OPERATORS = {
    '+': { precedence: 2, right: false, apply: function (a, b) { return a + b; } },
    '-': { precedence: 2, right: false, apply: function (a, b) { return a - b; } },
    '*': { precedence: 3, right: false, apply: function (a, b) { return a * b; } },
    '/': { precedence: 3, right: false, apply: function (a, b) { return a / b; } },
    '%': { precedence: 3, right: false, apply: function (a, b) { return a % b; } },
    // Prefix sign. Below '^' so -2^2 is -(2^2), above '*' so -2*3 is (-2)*3.
    // Rewriting unary minus as "0 - x" instead would silently misread
    // "10 - -5" as 5.
    'u-': { precedence: 3.5, right: true, unary: true, apply: function (a) { return -a; } },
    'u+': { precedence: 3.5, right: true, unary: true, apply: function (a) { return a; } },
    '^': { precedence: 4, right: true, apply: function (a, b) { return Math.pow(a, b); } }
  };

  function tokeniseExpression(src) {
    var tokens = [];
    var i = 0;
    while (i < src.length) {
      var ch = src.charAt(i);
      if (/\s/.test(ch)) {
        i += 1;
        continue;
      }
      if (/[0-9.]/.test(ch)) {
        var num = '';
        while (i < src.length && /[0-9.]/.test(src.charAt(i))) {
          num += src.charAt(i);
          i += 1;
        }
        if ((num.match(/\./g) || []).length > 1) throw new Error('malformed number "' + num + '"');
        tokens.push({ type: 'number', value: parseFloat(num) });
        continue;
      }
      if (ch === '(' || ch === ')') {
        tokens.push({ type: ch === '(' ? 'lparen' : 'rparen' });
        i += 1;
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(OPERATORS, ch)) {
        var prev = tokens[tokens.length - 1];
        var prefix = !prev || prev.type === 'operator' || prev.type === 'lparen';
        if (prefix && ch !== '-' && ch !== '+') {
          throw new Error('operator "' + ch + '" has no left operand');
        }
        tokens.push({ type: 'operator', value: prefix ? 'u' + ch : ch });
        i += 1;
        continue;
      }
      throw new Error('unexpected character "' + ch + '"');
    }
    if (!tokens.length) throw new Error('empty expression');
    return tokens;
  }

  function toRpn(tokens) {
    var output = [];
    var stack = [];
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (t.type === 'number') {
        output.push(t);
      } else if (t.type === 'operator') {
        var op = OPERATORS[t.value];
        if (op.unary) {
          // A prefix operator has nothing to its left, so nothing on the stack
          // can be its operand: push it and let the operand arrive after it.
          stack.push(t);
          continue;
        }
        while (stack.length) {
          var top = stack[stack.length - 1];
          if (top.type !== 'operator') break;
          var topOp = OPERATORS[top.value];
          if (topOp.precedence > op.precedence || (topOp.precedence === op.precedence && !op.right)) {
            output.push(stack.pop());
          } else {
            break;
          }
        }
        stack.push(t);
      } else if (t.type === 'lparen') {
        stack.push(t);
      } else {
        var matched = false;
        while (stack.length) {
          var head = stack.pop();
          if (head.type === 'lparen') {
            matched = true;
            break;
          }
          output.push(head);
        }
        if (!matched) throw new Error('unbalanced parentheses');
      }
    }
    while (stack.length) {
      var rest = stack.pop();
      if (rest.type === 'lparen') throw new Error('unbalanced parentheses');
      output.push(rest);
    }
    return output;
  }

  function evalRpn(rpn) {
    var stack = [];
    for (var i = 0; i < rpn.length; i++) {
      var t = rpn[i];
      if (t.type === 'number') {
        stack.push(t.value);
        continue;
      }
      var operator = OPERATORS[t.value];
      if (operator.unary) {
        if (!stack.length) throw new Error('operator "' + t.value + '" is missing an operand');
        stack.push(operator.apply(stack.pop()));
        continue;
      }
      if (stack.length < 2) throw new Error('operator "' + t.value + '" is missing an operand');
      var b = stack.pop();
      var a = stack.pop();
      if ((t.value === '/' || t.value === '%') && b === 0) throw new Error('division by zero');
      stack.push(operator.apply(a, b));
    }
    if (stack.length !== 1) throw new Error('malformed expression');
    var value = stack[0];
    if (!isFinite(value)) throw new Error('result is not finite');
    return value;
  }

  function toolCalculate(args) {
    var expression = String(args.expression || '').trim();
    if (expression.length > 200) {
      return { ok: false, error: 'expression_too_long: 200 character limit', result: null };
    }
    try {
      var value = evalRpn(toRpn(tokeniseExpression(expression)));
      return {
        ok: true,
        result: { expression: expression, result: round(value, 10), evaluator: 'shunting-yard (no eval)' }
      };
    } catch (e) {
      return { ok: false, error: 'invalid_expression: ' + e.message, result: null };
    }
  }

  function toolLookupOrder(args) {
    var orderId = String(args.order_id || '').trim().toUpperCase();
    if (!/^[A-Z]{2,4}-\d{3,8}$/.test(orderId)) {
      return {
        ok: false,
        error: 'invalid_order_id: expected the form ORD-12345, got "' + orderId + '"',
        result: null
      };
    }
    // Deterministic pseudo-data: the same id always returns the same order, so
    // the ledger and the transcript agree on re-runs.
    var rng = mulberry32(hash32(orderId));
    var status = pick(rng, ORDER_STATUSES);
    var itemCount = 1 + Math.floor(rng() * 3);
    var items = [];
    for (var i = 0; i < itemCount; i++) {
      items.push({ sku: 'SKU-' + (1000 + Math.floor(rng() * 8999)), name: pick(rng, ORDER_ITEMS), qty: 1 + Math.floor(rng() * 4) });
    }
    var total = round(40 + rng() * 900, 2);
    return {
      ok: true,
      result: {
        order_id: orderId,
        status: status,
        placed_days_ago: 1 + Math.floor(rng() * 21),
        carrier: pick(rng, ORDER_CARRIERS),
        tracking: 'TRK' + hex8(hash32(orderId, 99)).toUpperCase(),
        items: items,
        total_usd: total,
        source: 'deterministic demo record'
      }
    };
  }

  var TOOLS = {
    get_weather: {
      description: 'Current conditions for a city held in a small fixed table.',
      parameters: {
        type: 'object',
        properties: { city: { type: 'string', description: 'City name, e.g. "London"' } },
        required: ['city']
      },
      run: toolGetWeather
    },
    calculate: {
      description: 'Evaluate an arithmetic expression with + - * / % ^ and parentheses.',
      parameters: {
        type: 'object',
        properties: { expression: { type: 'string', description: 'e.g. "(120*3)/4 + 18"' } },
        required: ['expression']
      },
      run: toolCalculate
    },
    lookup_order: {
      description: 'Fetch the status of an order by id.',
      parameters: {
        type: 'object',
        properties: { order_id: { type: 'string', description: 'e.g. "ORD-10842"' } },
        required: ['order_id']
      },
      run: toolLookupOrder
    }
  };

  var TOOL_DEFINITIONS = Object.keys(TOOLS).map(function (name) {
    return { name: name, description: TOOLS[name].description, parameters: TOOLS[name].parameters };
  });

  function titleCase(text) {
    return String(text).replace(/\b\w/g, function (c) {
      return c.toUpperCase();
    });
  }

  // Pull the longest arithmetic run out of free text, so calculate() is called
  // with what the caller actually wrote rather than a truncated fragment.
  function extractExpression(text) {
    var candidates = String(text || '').match(/[\d(][\d\s+\-*/%^().]*[\d)]/g) || [];
    var best = null;
    for (var i = 0; i < candidates.length; i++) {
      var trimmed = candidates[i].replace(/\s+/g, ' ').trim();
      if (!/[-+*/%^]/.test(trimmed)) continue;
      // Drop parentheses the match cut in half rather than handing the
      // tokeniser something it will only reject.
      var opens = (trimmed.match(/\(/g) || []).length;
      var closes = (trimmed.match(/\)/g) || []).length;
      while (closes > opens && trimmed.charAt(0) === ')') {
        trimmed = trimmed.slice(1).trim();
        closes -= 1;
      }
      while (opens > closes && trimmed.charAt(trimmed.length - 1) === '(') {
        trimmed = trimmed.slice(0, -1).trim();
        opens -= 1;
      }
      if (opens !== closes) continue;
      if (!best || trimmed.length > best.length) best = trimmed;
    }
    return best;
  }

  // Which tools the model "decides" to call. In a real gateway the provider
  // returns tool_calls; here the choice is derived from the prompt so the demo
  // stays deterministic and the arguments actually match what was asked.
  function planToolCalls(prompt, rng) {
    var text = String(prompt || '');
    var lower = text.toLowerCase();
    var calls = [];

    var orderMatch = text.match(/\b[A-Za-z]{2,4}-\d{3,8}\b/);
    if (orderMatch || /\border\b|\bdelivery\b|\bshipment\b|\btracking\b/.test(lower)) {
      calls.push({ name: 'lookup_order', arguments: { order_id: (orderMatch ? orderMatch[0] : 'ORD-10842').toUpperCase() } });
    }

    var cityHit = null;
    var cities = Object.keys(WEATHER_TABLE);
    for (var i = 0; i < cities.length; i++) {
      if (lower.indexOf(cities[i]) !== -1) {
        cityHit = titleCase(cities[i]);
        break;
      }
    }
    var wantsWeather = /\bweather\b|\btemperature\b|\bforecast\b|\brain\b/.test(lower);
    if (cityHit || wantsWeather) {
      // A place the table does not know is passed through unchanged rather than
      // quietly swapped for one it does: the tool's error path is the honest
      // outcome, and the reply says so instead of inventing a reading.
      var named = text.match(/\b(?:weather|temperature|forecast)\b[^.?!]{0,40}?\b(?:in|for|at)\s+([A-Za-z][A-Za-z' -]{1,24})/i);
      var city = cityHit;
      if (!city && named) {
        city = named[1]
          .replace(/\b(please|today|tomorrow|now|right now|currently)\b.*$/i, '')
          .replace(/[^A-Za-z' -]/g, '')
          .trim()
          .split(/\s+/)
          .slice(0, 3)
          .join(' ');
      }
      calls.push({ name: 'get_weather', arguments: { city: titleCase(city || 'London') } });
    }

    var expression = extractExpression(text);
    if (expression || /\bcalculat|\bcompute\b|\bhow much\b|\bevaluate\b|\barithmetic\b/.test(lower)) {
      calls.push({ name: 'calculate', arguments: { expression: expression || '((120*3)/4)+18' } });
    }

    if (!calls.length) {
      // Nothing in the prompt matched a tool, so the model picks the one it can
      // always answer with. Deterministic via the request seed.
      calls.push({ name: 'get_weather', arguments: { city: pick(rng, ['London', 'Dubai', 'Berlin', 'Tokyo']) } });
    }
    return calls.slice(0, 2);
  }

  /* ------------------------------------------------------------------ *
   * JSON Schema: the demo contract and a real validator
   * ------------------------------------------------------------------ */

  var TRIAGE_SCHEMA = {
    name: 'support_ticket_triage',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['category', 'priority', 'summary', 'confidence', 'follow_up_required'],
      properties: {
        category: { type: 'string', enum: ['billing', 'technical', 'account', 'shipping', 'other'] },
        priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'] },
        summary: { type: 'string', minLength: 8, maxLength: 240 },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        follow_up_required: { type: 'boolean' }
      }
    },
    strict: true
  };

  function typeOf(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  function typeMatches(value, expected) {
    if (expected === 'integer') return typeof value === 'number' && isFinite(value) && Math.floor(value) === value;
    if (expected === 'number') return typeof value === 'number' && isFinite(value);
    return typeOf(value) === expected;
  }

  // A genuine subset validator: type, required, enum, minimum/maximum,
  // minLength/maxLength, additionalProperties. The errors the repair loop
  // reports are the errors this function actually found.
  function validateSchema(value, schema, path) {
    var here = path || '$';
    var errors = [];

    if (schema.type && !typeMatches(value, schema.type)) {
      errors.push({
        path: here,
        keyword: 'type',
        message: 'expected ' + schema.type + ', received ' + typeOf(value)
      });
      return errors;
    }

    if (schema.enum && schema.enum.indexOf(value) === -1) {
      errors.push({
        path: here,
        keyword: 'enum',
        message: JSON.stringify(value) + ' is not one of [' + schema.enum.join(', ') + ']'
      });
    }

    if (typeof value === 'number') {
      if (typeof schema.minimum === 'number' && value < schema.minimum) {
        errors.push({ path: here, keyword: 'minimum', message: value + ' is below the minimum of ' + schema.minimum });
      }
      if (typeof schema.maximum === 'number' && value > schema.maximum) {
        errors.push({ path: here, keyword: 'maximum', message: value + ' exceeds the maximum of ' + schema.maximum });
      }
    }

    if (typeof value === 'string') {
      if (typeof schema.minLength === 'number' && value.length < schema.minLength) {
        errors.push({ path: here, keyword: 'minLength', message: 'length ' + value.length + ' is below minLength ' + schema.minLength });
      }
      if (typeof schema.maxLength === 'number' && value.length > schema.maxLength) {
        errors.push({ path: here, keyword: 'maxLength', message: 'length ' + value.length + ' exceeds maxLength ' + schema.maxLength });
      }
    }

    if (schema.type === 'object' && value && typeof value === 'object') {
      var required = schema.required || [];
      for (var i = 0; i < required.length; i++) {
        if (!Object.prototype.hasOwnProperty.call(value, required[i])) {
          errors.push({ path: here + '.' + required[i], keyword: 'required', message: 'required property is missing' });
        }
      }
      var props = schema.properties || {};
      for (var key in value) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
        if (Object.prototype.hasOwnProperty.call(props, key)) {
          errors = errors.concat(validateSchema(value[key], props[key], here + '.' + key));
        } else if (schema.additionalProperties === false) {
          errors.push({ path: here + '.' + key, keyword: 'additionalProperties', message: 'property is not permitted by the schema' });
        }
      }
    }

    if (schema.type === 'array' && Array.isArray(value) && schema.items) {
      for (var j = 0; j < value.length; j++) {
        errors = errors.concat(validateSchema(value[j], schema.items, here + '[' + j + ']'));
      }
    }

    return errors;
  }

  /* ------------------------------------------------------------------ *
   * Deterministic text generation
   * ------------------------------------------------------------------ */

  // Function words, the instruction verbs a prompt uses to describe the ask,
  // and the adjectives it uses to qualify it. All three are noise when the goal
  // is to name what the prompt is ABOUT.
  var STOPWORDS = {};
  ('bad best better big broken easy fail failed failing fails fast getting good great hard high large little long low new old poor quick short simple slow small trying running'
    .split(' ')
    .forEach(function (w) {
      STOPWORDS[w] = true;
    }));
  ('a about across after against all also among an and any are as at be because been before being belongs between both but by can comes contains could describe did do does doing done down each even every explain few for from generate get gets give goes had has have her here him his how i if in includes into is it its just keeps like list looks make makes many matters may me means more most much must my need needs no not now of off on once one only or other our out over own per please put rather same say see should show so some such summarise summarize take tell than that the their them then there these they this those through to too two under until up us use used using very versus via want was we well were what when where whether which while who why will with within works would write you your'
    .split(' ')
    .forEach(function (w) {
      STOPWORDS[w] = true;
    }));

  function salientTerms(prompt, limit) {
    var words = String(prompt || '').toLowerCase().match(/[a-z][a-z0-9]*(?:[-_][a-z0-9]+)*/g) || [];
    var freq = Object.create(null);
    var order = [];
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (w.length < 3 || STOPWORDS[w]) continue;
      if (freq[w] === undefined) {
        freq[w] = 0;
        order.push(w);
      }
      freq[w] += 1;
    }
    // Frequency first, then order of appearance: a tie broken by position
    // reads like the sentence, a tie broken by length reads like a thesaurus.
    order.sort(function (a, b) {
      return freq[b] - freq[a];
    });
    return order.slice(0, limit || 3);
  }

  function firstClause(prompt, max) {
    var text = String(prompt || '').replace(/\s+/g, ' ').trim();
    if (!text) return 'an empty prompt';
    // Deliberately no lookbehind: it is a parse-time error in older Safari,
    // which would take the whole file down rather than just this function.
    var cut = text;
    var stop = text.search(/[.?!]\s/);
    if (stop !== -1) cut = text.slice(0, stop + 1);
    if (cut.length > max) cut = cut.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
    return cut;
  }

  function detectIntent(prompt) {
    var lower = String(prompt || '').toLowerCase();
    if (/\b(error|fail|failing|broken|crash|bug|timeout|500|502|exception|stack trace)\b/.test(lower)) return 'diagnose';
    if (/\b(write|draft|generate|produce|create|compose|summarise|summarize|rewrite)\b/.test(lower)) return 'produce';
    if (/\b(compare|versus|vs\.?|difference between|better than|trade-?off)\b/.test(lower)) return 'compare';
    if (/^(how|why|what|when|which|who|explain|describe)\b|\?$/.test(lower.trim())) return 'explain';
    return 'answer';
  }

  var INTENT_BODIES = {
    explain: [
      'The mechanism is simpler than the vocabulary around it: {a} is decided first, and {b} only ever reacts to that decision.',
      'Most of the confusion here comes from treating {a} and {b} as one step. They are separate, and they fail separately.',
      'Work outwards from {a}. Once that is fixed the behaviour of {b} stops looking arbitrary.'
    ],
    diagnose: [
      'On the evidence in the message, the likeliest cause is {a} rather than {b} - the symptom appears at the boundary, not inside it.',
      'Rule out {a} before touching {b}. It is cheaper to check and it explains this failure shape more often than anything else.',
      'A failure that mentions {a} but recovers on retry is usually a resource limit, not a logic error.'
    ],
    produce: [
      'Structure it around {a} first, then let {b} carry the supporting detail; the reverse order reads as padding.',
      'Keep {a} in the opening line. Anything a reader has to scroll for is treated as optional.',
      'One idea per paragraph, with {a} stated plainly before any qualification.'
    ],
    compare: [
      '{a} wins where throughput matters; {b} wins wherever the team is small and the operational budget is smaller.',
      'On paper they overlap. In practice the choice is between {a} and {b} on cost of ownership, not on features.',
      'Compare them on what you will maintain rather than on what demos well: {a} and {b} diverge there and almost nowhere else.'
    ],
    answer: [
      'The short version: {a} is the part that decides the outcome, and {b} follows from it.',
      'Two things are load-bearing here - {a} and {b}. The rest is detail you can change later.',
      'Start with {a}. It constrains {b} more than the other way round.'
    ]
  };

  var FOLLOW_UPS = {
    explain: 'which layer you are working at',
    diagnose: 'the exact error text and what changed just before it started',
    produce: 'the audience and the length you are aiming for',
    compare: 'your throughput and latency targets',
    answer: 'your constraints'
  };

  function composeReply(prompt, model, rng) {
    var terms = salientTerms(prompt, 3);
    var a = terms[0] || 'the request';
    var b = terms[1] || 'the surrounding context';
    var c = terms[2] || 'the constraints';
    var intent = detectIntent(prompt);
    var body = pick(rng, INTENT_BODIES[intent]).replace(/\{a\}/g, a).replace(/\{b\}/g, b);
    var quote = firstClause(prompt, 120);

    var lines = [];
    lines.push('On "' + quote + '":');
    lines.push('');
    lines.push(body);
    lines.push('');
    if (intent === 'diagnose' || intent === 'produce') {
      lines.push('Concretely:');
      lines.push('1. Pin down ' + a + ' - write down what it is meant to do in one sentence.');
      lines.push('2. Change one thing about ' + b + ' and measure before changing another.');
      lines.push('3. Keep ' + c + ' fixed until the first two stop moving.');
      lines.push('');
    }
    lines.push('Tell me ' + FOLLOW_UPS[intent] + ' and I can make this specific rather than general.');
    return lines.join('\n');
  }

  function composeToolReply(prompt, invocations, rng) {
    var lines = [];
    var quote = firstClause(prompt, 100);
    lines.push('On "' + quote + '":');
    lines.push('');
    for (var i = 0; i < invocations.length; i++) {
      var inv = invocations[i];
      if (!inv.ok) {
        lines.push('I called ' + inv.name + ' and it returned an error: ' + inv.error + '. I have not guessed a value in its place.');
        continue;
      }
      var r = inv.result;
      if (inv.name === 'get_weather') {
        lines.push(
          r.city + ' is currently ' + r.temperature_c + ' C with ' + r.condition + ', wind ' + r.wind_kph +
            ' km/h and humidity ' + r.humidity_pct + '%.'
        );
      } else if (inv.name === 'calculate') {
        lines.push(r.expression + ' evaluates to ' + r.result + '.');
      } else if (inv.name === 'lookup_order') {
        lines.push(
          'Order ' + r.order_id + ' is ' + r.status.replace(/_/g, ' ') + ' with ' + r.carrier + ' (tracking ' + r.tracking +
            '), placed ' + r.placed_days_ago + ' days ago, ' + r.items.length + ' line item(s), total $' + r.total_usd + '.'
        );
      } else {
        lines.push(inv.name + ' returned ' + JSON.stringify(r) + '.');
      }
    }
    lines.push('');
    lines.push(pick(rng, [
      'That figure came from the tool call above, not from the model text.',
      'The numbers above are the tool result verbatim; nothing was inferred around them.',
      'If the tool data looks wrong, the fix belongs in the tool, not in the prompt.'
    ]));
    return lines.join('\n');
  }

  var CATEGORY_RULES = [
    { category: 'billing', pattern: /\b(invoice|billing|charge|charged|refund|payment|card|subscription|price|vat)\b/ },
    { category: 'shipping', pattern: /\b(order|delivery|delivered|shipment|courier|tracking|dispatch|parcel)\b/ },
    { category: 'account', pattern: /\b(login|log in|password|account|sign in|access|locked|2fa|mfa|email address)\b/ },
    { category: 'technical', pattern: /\b(error|crash|bug|api|timeout|500|502|latency|integration|fails|failing|broken)\b/ }
  ];

  function classifyTicket(prompt, rng) {
    var lower = String(prompt || '').toLowerCase();
    var category = 'other';
    for (var i = 0; i < CATEGORY_RULES.length; i++) {
      if (CATEGORY_RULES[i].pattern.test(lower)) {
        category = CATEGORY_RULES[i].category;
        break;
      }
    }
    var priority = 'normal';
    if (/\b(urgent|immediately|asap|outage|down|blocked|production|cannot work|critical)\b/.test(lower)) priority = 'urgent';
    else if (/\b(soon|today|escalate|repeated|again|still not|second time)\b/.test(lower)) priority = 'high';
    else if (/\b(whenever|no rush|minor|cosmetic|question)\b/.test(lower)) priority = 'low';

    var summary = firstClause(prompt, 150);
    if (summary.length < 8) summary = 'Ticket text too short to summarise: ' + summary;

    return {
      category: category,
      priority: priority,
      summary: summary,
      confidence: round(0.55 + rng() * 0.4, 2),
      follow_up_required: priority === 'urgent' || priority === 'high' || category === 'billing'
    };
  }

  /* ------------------------------------------------------------------ *
   * The engine
   * ------------------------------------------------------------------ */

  function GatewayEngine(options) {
    var opts = options || {};
    this._onEvent = typeof opts.onEvent === 'function' ? opts.onEvent : function () {};
    // Lets the view layer shorten every simulated wait when the visitor has
    // asked for reduced motion. 1 = real timings.
    this._speed = typeof opts.speed === 'number' && opts.speed > 0 ? opts.speed : 1;
    this._budgetUsd = typeof opts.budgetUsd === 'number' ? opts.budgetUsd : DEFAULT_BUDGET_USD;
    this._breakers = {};
    this._cache = {};
    this._bucket = new TokenBucket(RATE_LIMIT.capacity, RATE_LIMIT.refillPerSecond);
    this._stats = emptyStats(this._budgetUsd);
    // Requests execute one at a time so the pipeline panel stays readable. The
    // rate limiter is still charged against ARRIVAL time (see send), which is
    // where a real gateway applies it.
    this._chain = Promise.resolve();
  }

  function emptyStats(budgetUsd) {
    return {
      requests: 0,
      errors: 0,
      cacheHits: 0,
      cacheMisses: 0,
      hitRate: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      spendUsd: 0,
      savedUsd: 0,
      budgetUsd: budgetUsd
    };
  }

  GatewayEngine.prototype.setSpeed = function (speed) {
    if (typeof speed === 'number' && speed > 0) this._speed = speed;
  };

  // Operator policy, not a per-request field. Exposed so the budget scenario
  // can tighten the ceiling without waiting for a real $0.05 to be spent.
  GatewayEngine.prototype.setBudget = function (usd) {
    if (typeof usd === 'number' && usd > 0) {
      this._budgetUsd = usd;
      this._stats.budgetUsd = usd;
    }
  };

  GatewayEngine.prototype._emit = function (event) {
    try {
      this._onEvent(event);
    } catch (e) {
      // An observer must never be able to fail the request it is observing.
      // The real gateway takes the same line with its log sinks.
    }
  };

  GatewayEngine.prototype._log = function (level, msg, fields) {
    this._emit({ type: 'log', level: level, msg: msg, fields: fields || {} });
  };

  GatewayEngine.prototype._stage = function (id, name, status, detail, ms) {
    this._emit({
      type: 'stage',
      id: id,
      name: name,
      status: status,
      detail: detail || '',
      ms: typeof ms === 'number' ? Math.round(ms) : 0
    });
  };

  GatewayEngine.prototype._wait = function (ms) {
    return sleep(ms / this._speed);
  };

  GatewayEngine.prototype._breaker = function (providerName) {
    if (!this._breakers[providerName]) {
      this._breakers[providerName] = new CircuitBreaker(providerName, BREAKER);
    }
    return this._breakers[providerName];
  };

  GatewayEngine.prototype.providers = function () {
    var self = this;
    return PROVIDERS.map(function (p) {
      var b = self._breaker(p.name);
      return {
        name: p.name,
        model: p.model,
        region: p.region,
        circuit: b.state(),
        failures: b.failures(),
        cooldownMs: b.cooldownMs()
      };
    });
  };

  GatewayEngine.prototype._emitProviders = function () {
    this._emit({ type: 'provider', providers: this.providers() });
  };

  GatewayEngine.prototype.stats = function () {
    var s = this._stats;
    var lookups = s.cacheHits + s.cacheMisses;
    return {
      requests: s.requests,
      errors: s.errors,
      cacheHits: s.cacheHits,
      cacheMisses: s.cacheMisses,
      hitRate: lookups ? s.cacheHits / lookups : 0,
      promptTokens: s.promptTokens,
      completionTokens: s.completionTokens,
      totalTokens: s.totalTokens,
      spendUsd: round(s.spendUsd, 6),
      savedUsd: round(s.savedUsd, 6),
      budgetUsd: this._budgetUsd
    };
  };

  GatewayEngine.prototype.tools = function () {
    return TOOL_DEFINITIONS.slice();
  };

  GatewayEngine.prototype.schema = function () {
    return TRIAGE_SCHEMA;
  };

  GatewayEngine.prototype.reset = function () {
    this._breakers = {};
    this._cache = {};
    this._bucket = new TokenBucket(RATE_LIMIT.capacity, RATE_LIMIT.refillPerSecond);
    this._budgetUsd = DEFAULT_BUDGET_USD;
    this._stats = emptyStats(this._budgetUsd);
    this._emitProviders();
    this._log('info', 'gateway state reset', { stage: 'admin', cache_entries: 0, budget_usd: this._budgetUsd });
  };

  GatewayEngine.prototype.send = function (options) {
    var self = this;
    var opts = options || {};
    // Arrival is stamped here, not when the request reaches the front of the
    // queue: rate limiting is an admission decision, so a burst of eight calls
    // must be judged as a burst even though they run one after another.
    var arrivedAt = Date.now();
    var run = this._chain.then(function () {
      return self._run(opts, arrivedAt);
    });
    this._chain = run.then(
      function () {},
      function () {}
    );
    return run;
  };

  GatewayEngine.prototype._run = function (opts, arrivedAt) {
    var self = this;
    var prompt = typeof opts.prompt === 'string' ? opts.prompt : '';
    var model = PRICING[opts.model] ? opts.model : 'sim-medium';
    var useCache = opts.cache !== false;
    var useTools = !!opts.tools;
    var useSchema = !!opts.schema;
    var allowFallback = opts.fallback !== false;
    var inject = opts.inject && opts.inject !== 'none' ? opts.inject : null;
    if (typeof opts.budgetUsd === 'number' && opts.budgetUsd > 0) {
      // An operator changing the policy mid-session; the scenario runner uses
      // this so the budget stage can be reached in a couple of requests.
      this._budgetUsd = opts.budgetUsd;
      this._stats.budgetUsd = opts.budgetUsd;
    }

    var requestId = newId('req');
    var startedAt = Date.now();
    var seedSource = model + '\u0000' + prompt;
    var rng = mulberry32(hash32(seedSource));
    var ctx = {
      requestId: requestId,
      prompt: prompt,
      model: model,
      useCache: useCache,
      useTools: useTools,
      useSchema: useSchema,
      allowFallback: allowFallback,
      inject: inject,
      injectedFailures: 0,
      rng: rng,
      seed: hash32(seedSource),
      startedAt: startedAt,
      attempts: [],
      invocations: [],
      fingerprint: null
    };

    this._log('info', 'request received', {
      request_id: requestId,
      stage: 'ingress',
      model: model,
      prompt_chars: prompt.length,
      cache: useCache,
      tools: useTools,
      schema: useSchema,
      fallback: allowFallback
    });

    return this._pipeline(ctx, arrivedAt).then(
      function (response) {
        return response;
      },
      function (err) {
        self._stats.errors += 1;
        var code = err && err.code ? err.code : 'gateway_error';
        var detail = err && err.detail ? err.detail : String(err && err.message ? err.message : err);
        self._log('error', 'request failed', {
          request_id: requestId,
          stage: err && err.stage ? err.stage : 'gateway',
          code: code,
          status: err && err.status ? err.status : 502,
          latency_ms: Date.now() - startedAt
        });
        self._emit({
          type: 'error',
          code: code,
          detail: detail,
          status: err && err.status ? err.status : 502,
          requestId: requestId,
          retryAfterMs: err && err.retryAfterMs ? err.retryAfterMs : null
        });
        throw err;
      }
    );
  };

  GatewayEngine.prototype._pipeline = function (ctx, arrivedAt) {
    var self = this;
    var t;

    return Promise.resolve()
      /* 1. authenticate ------------------------------------------------ */
      .then(function () {
        t = Date.now();
        self._stage('authenticate', 'authenticate', 'run', 'verifying API key and scopes');
        return self._wait(70);
      })
      .then(function () {
        if (ctx.inject === 'auth_error') {
          self._stage('authenticate', 'authenticate', 'fail', 'key rejected: signature does not match any active key', Date.now() - t);
          throw GatewayError('unauthenticated', 'API key rejected. Presented key is not active for this gateway.', { stage: 'authenticate' });
        }
        var key = DEMO_API_KEY;
        self._stage(
          'authenticate',
          'authenticate',
          'ok',
          'key ' + key.slice(0, 11) + '… accepted, scopes: ' + DEMO_KEY_SCOPES.join(' '),
          Date.now() - t
        );
        self._log('info', 'key authenticated', {
          request_id: ctx.requestId,
          stage: 'authenticate',
          key_prefix: key.slice(0, 11),
          scopes: DEMO_KEY_SCOPES.length
        });
      })

      /* 2. rate limit -------------------------------------------------- */
      .then(function () {
        t = Date.now();
        self._stage('rate-limit', 'rate-limit', 'run', 'token bucket: capacity ' + RATE_LIMIT.capacity + ', refill ' + RATE_LIMIT.refillPerSecond + '/s');
        return self._wait(55);
      })
      .then(function () {
        var verdict = self._bucket.consume(1, arrivedAt);
        if (!verdict.allowed) {
          self._stage(
            'rate-limit',
            'rate-limit',
            'fail',
            'bucket empty, retry after ' + verdict.retryAfterMs + 'ms',
            Date.now() - t
          );
          self._log('warn', 'rate limit exceeded', {
            request_id: ctx.requestId,
            stage: 'rate-limit',
            retry_after_ms: verdict.retryAfterMs,
            tokens_remaining: round(verdict.remaining, 3)
          });
          throw GatewayError('rate_limit_exceeded', 'Rate limit exceeded for this key. Retry after ' + verdict.retryAfterMs + 'ms.', {
            stage: 'rate-limit',
            retryAfterMs: verdict.retryAfterMs
          });
        }
        self._stage('rate-limit', 'rate-limit', 'ok', round(verdict.remaining, 2) + ' of ' + RATE_LIMIT.capacity + ' tokens left', Date.now() - t);
      })

      /* 3. budget ------------------------------------------------------ */
      .then(function () {
        t = Date.now();
        self._stage('budget', 'budget', 'run', 'projecting cost against the session budget');
        return self._wait(55);
      })
      .then(function () {
        // The projection reserves the full completion allowance because that is
        // the worst case the caller can force. A cache hit later costs nothing,
        // so this check is deliberately conservative.
        var promptTokens = estimateTokens(ctx.prompt) + MESSAGE_OVERHEAD_TOKENS;
        if (ctx.useTools) promptTokens += estimateTokens(stableJson(TOOL_DEFINITIONS));
        if (ctx.useSchema) promptTokens += estimateTokens(stableJson(TRIAGE_SCHEMA));
        ctx.projectedPromptTokens = promptTokens;
        var projected = costOf(ctx.model, promptTokens, MAX_TOKENS);
        var spend = self._stats.spendUsd;
        if (spend + projected > self._budgetUsd) {
          self._stage(
            'budget',
            'budget',
            'fail',
            'projected $' + round(projected, 5) + ' on top of $' + round(spend, 5) + ' exceeds $' + self._budgetUsd,
            Date.now() - t
          );
          self._log('warn', 'budget exceeded', {
            request_id: ctx.requestId,
            stage: 'budget',
            spend_usd: round(spend, 6),
            projected_usd: round(projected, 6),
            budget_usd: self._budgetUsd
          });
          throw GatewayError(
            'budget_exceeded',
            'Session budget of $' + self._budgetUsd + ' would be exceeded: $' + round(spend, 5) + ' spent, $' + round(projected, 5) + ' projected.',
            { stage: 'budget' }
          );
        }
        self._stage(
          'budget',
          'budget',
          'ok',
          '$' + round(spend, 5) + ' spent, $' + round(projected, 5) + ' projected, $' + self._budgetUsd + ' ceiling',
          Date.now() - t
        );
      })

      /* 4. cache lookup ------------------------------------------------ */
      .then(function () {
        t = Date.now();
        ctx.fingerprint = digest(
          stableJson({ model: ctx.model, prompt: ctx.prompt, tools: ctx.useTools, schema: ctx.useSchema })
        );
        self._stage('cache-lookup', 'cache-lookup', 'run', 'key ' + ctx.fingerprint);
        return self._wait(60);
      })
      .then(function () {
        if (!ctx.useCache) {
          self._stage('cache-lookup', 'cache-lookup', 'skip', 'caching disabled for this request', Date.now() - t);
          return null;
        }
        var entry = self._cache[ctx.fingerprint];
        if (entry && Date.now() - entry.storedAt > CACHE_TTL_MS) {
          delete self._cache[ctx.fingerprint];
          entry = null;
          self._log('info', 'cache entry expired', { request_id: ctx.requestId, stage: 'cache-lookup', key: ctx.fingerprint, ttl_ms: CACHE_TTL_MS });
        }
        if (!entry) {
          self._stats.cacheMisses += 1;
          self._stage('cache-lookup', 'cache-lookup', 'ok', 'miss', Date.now() - t);
          self._log('info', 'cache miss', { request_id: ctx.requestId, stage: 'cache-lookup', key: ctx.fingerprint });
          return null;
        }
        var ageMs = Date.now() - entry.storedAt;
        self._stats.cacheHits += 1;
        self._stage('cache-lookup', 'cache-lookup', 'ok', 'hit, age ' + (ageMs / 1000).toFixed(1) + 's, saved $' + round(entry.costUsd, 5), Date.now() - t);
        self._log('info', 'cache hit', {
          request_id: ctx.requestId,
          stage: 'cache-lookup',
          key: ctx.fingerprint,
          age_ms: ageMs,
          saved_usd: round(entry.costUsd, 6)
        });
        return self._serveFromCache(ctx, entry, ageMs);
      })

      /* 5-8. route, circuit, generate, tools, schema ------------------- */
      .then(function (cached) {
        if (cached) return cached;
        return self._route(ctx).then(function () {
          return self._generateWithFailover(ctx);
        });
      });
  };

  GatewayEngine.prototype._serveFromCache = function (ctx, entry, ageMs) {
    var self = this;
    self._stage('route', 'route', 'skip', 'not routed: the cache answered', 0);
    self._stage('generate', 'generate', 'skip', 'no provider call made', 0);
    return this._wait(40).then(function () {
      var t = Date.now();
      self._stage('accounting', 'accounting', 'run', 'recording a zero-cost served response');
      return self._wait(45).then(function () {
        self._stats.requests += 1;
        self._stats.promptTokens += entry.promptTokens;
        self._stats.completionTokens += entry.completionTokens;
        self._stats.totalTokens += entry.promptTokens + entry.completionTokens;
        self._stats.savedUsd += entry.costUsd;

        self._emit({
          type: 'usage',
          promptTokens: entry.promptTokens,
          completionTokens: entry.completionTokens,
          costUsd: 0,
          cached: true
        });
        self._stage(
          'accounting',
          'accounting',
          'ok',
          entry.promptTokens + ' + ' + entry.completionTokens + ' tokens, $0.00 charged, $' + round(entry.costUsd, 5) + ' avoided',
          Date.now() - t
        );
        self._stage('cache-store', 'cache-store', 'skip', 'already stored', 0);

        var latency = Date.now() - ctx.startedAt;
        var response = JSON.parse(JSON.stringify(entry.response));
        response.id = newId('cmpl');
        response.request_id = ctx.requestId;
        response.cached = true;
        response.cache_age_ms = ageMs;
        response.latency_ms = latency;
        response.cost_usd = 0;
        response.usage.cached_prompt_tokens = entry.promptTokens;
        response.attempts = [];
        response.created = Math.floor(Date.now() / 1000);

        self._log('info', 'request complete', {
          request_id: ctx.requestId,
          stage: 'egress',
          provider: response.provider,
          model: response.model,
          latency_ms: latency,
          tokens: entry.promptTokens + entry.completionTokens,
          cost_usd: 0,
          cached: true
        });
        self._emit({ type: 'done', response: response });
        return response;
      });
    });
  };

  GatewayEngine.prototype._route = function (ctx) {
    var self = this;
    var t = Date.now();
    self._stage('route', 'route', 'run', 'resolving "' + ctx.model + '" against the routing table');
    return this._wait(65).then(function () {
      var names = ROUTES[ctx.model] || ROUTES['sim-medium'];
      if (!ctx.allowFallback) names = names.slice(0, 1);
      ctx.chain = names.map(function (name) {
        for (var i = 0; i < PROVIDERS.length; i++) {
          if (PROVIDERS[i].name === name) return PROVIDERS[i];
        }
        return PROVIDERS[1];
      });
      var described = ctx.chain
        .map(function (p) {
          return p.name + '/' + p.model;
        })
        .join(' -> ');
      self._stage('route', 'route', 'ok', described + (ctx.allowFallback ? '' : ' (failover disabled)'), Date.now() - t);
      self._log('info', 'route resolved', {
        request_id: ctx.requestId,
        stage: 'route',
        model: ctx.model,
        chain: described,
        fallback: ctx.allowFallback
      });
    });
  };

  // Backoff window for a 0-based attempt index. A provider-supplied
  // retry-after wins and is used unjittered: jitter can only shorten a window,
  // and coming back earlier than the provider asked is the one thing certain to
  // fail again.
  GatewayEngine.prototype._delayFor = function (attempt, retryAfterMs, rng) {
    if (typeof retryAfterMs === 'number' && retryAfterMs > 0) {
      return Math.min(retryAfterMs, RETRY.maxDelayMs);
    }
    var windowMs = Math.min(RETRY.baseDelayMs * Math.pow(RETRY.factor, attempt), RETRY.maxDelayMs);
    return windowMs * (1 - RETRY.jitter + RETRY.jitter * rng());
  };

  // Decide whether this attempt fails, and with what. Deterministic given the
  // request seed, the target and the attempt index.
  GatewayEngine.prototype._faultFor = function (ctx, target, attempt, isPrimary) {
    if (ctx.inject && isPrimary) {
      var spec = INJECT_TO_ERROR[ctx.inject];
      if (spec) {
        if (ctx.inject === 'bad_request' || ctx.injectedFailures < INJECT_TRANSIENT_FAILURES) {
          ctx.injectedFailures += 1;
          return spec;
        }
      }
    }
    if (target.model === 'sim-down') {
      return { code: 'provider_unavailable', title: 'upstream refused the connection' };
    }
    if (target.model === 'sim-flaky') {
      var roll = hash32(ctx.fingerprint + ':' + target.name + ':' + attempt) % 1000;
      if (roll < 500) {
        return { code: 'provider_timeout', title: 'no response within the 30s deadline' };
      }
    }
    return null;
  };

  GatewayEngine.prototype._generateWithFailover = function (ctx) {
    var self = this;
    var index = 0;
    var lastError = null;

    function nextTarget() {
      if (index >= ctx.chain.length) {
        var detail = lastError
          ? 'Every provider in the chain failed. Last error: ' + lastError.code + ' - ' + lastError.detail
          : 'No provider in the chain could serve this request.';
        throw GatewayError('no_provider_available', detail, { stage: 'generate', cause: lastError ? lastError.code : null });
      }
      var target = ctx.chain[index];
      var isPrimary = index === 0;
      index += 1;

      var breaker = self._breaker(target.name);
      var circuitId = 'circuit:' + target.name;
      var t = Date.now();
      self._stage(circuitId, 'circuit', 'run', target.name + ': checking breaker');

      return self
        ._wait(40)
        .then(function () {
          var state = breaker.state();
          if (state === 'open') {
            self._stage(circuitId, 'circuit', 'skip', target.name + ': breaker OPEN, ' + breaker.cooldownMs() + 'ms until probe', Date.now() - t);
            self._log('warn', 'provider skipped, circuit open', {
              request_id: ctx.requestId,
              stage: 'circuit',
              provider: target.name,
              cooldown_ms: breaker.cooldownMs()
            });
            var attemptRecord = {
              provider: target.name,
              model: target.model,
              outcome: 'circuit_open',
              latency_ms: 0,
              retry_index: 0,
              error: 'circuit_open'
            };
            ctx.attempts.push(attemptRecord);
            self._emit({
              type: 'attempt',
              provider: target.name,
              model: target.model,
              outcome: 'circuit_open',
              retryIndex: 0,
              delayMs: 0,
              error: 'breaker open'
            });
            lastError = GatewayError('circuit_open', 'Circuit for ' + target.name + ' is open.', { stage: 'circuit' });
            return nextTarget();
          }
          self._stage(
            circuitId,
            'circuit',
            'ok',
            target.name + ': breaker ' + state.toUpperCase() + (state === 'half_open' ? ', sending one probe' : ''),
            Date.now() - t
          );
          return self._attemptTarget(ctx, target, isPrimary, breaker).then(
            function (draft) {
              return self._afterGeneration(ctx, target, draft);
            },
            function (err) {
              lastError = err;
              var canFailover = err.failoverable && ctx.allowFallback && index < ctx.chain.length;
              if (!canFailover) {
                err.stage = err.stage || 'generate';
                throw err;
              }
              self._log('info', 'failing over', {
                request_id: ctx.requestId,
                stage: 'generate',
                provider: target.name,
                code: err.code,
                next_provider: ctx.chain[index].name
              });
              return nextTarget();
            }
          );
        });
    }

    return Promise.resolve().then(nextTarget);
  };

  GatewayEngine.prototype._attemptTarget = function (ctx, target, isPrimary, breaker) {
    var self = this;
    var genId = 'generate:' + target.name;
    var attempt = 0;
    var startedAt = Date.now();
    self._stage(genId, 'generate', 'run', target.name + '/' + target.model + ': attempt 1 of ' + RETRY.maxAttempts);

    function tryOnce() {
      var attemptStart = Date.now();
      var jittered = target.baseLatencyMs * (0.8 + ctx.rng() * 0.4);
      return self._wait(jittered).then(function () {
        var fault = self._faultFor(ctx, target, attempt, isPrimary);
        var latency = Date.now() - attemptStart;

        if (!fault) {
          var changed = breaker.onSuccess();
          if (changed) self._emitProviders();
          ctx.attempts.push({
            provider: target.name,
            model: target.model,
            outcome: 'success',
            latency_ms: latency,
            retry_index: attempt,
            error: null
          });
          self._emit({
            type: 'attempt',
            provider: target.name,
            model: target.model,
            outcome: 'success',
            retryIndex: attempt,
            delayMs: 0,
            error: null
          });
          self._stage(
            genId,
            'generate',
            'ok',
            target.name + '/' + target.model + ': 200 in ' + latency + 'ms on attempt ' + (attempt + 1),
            Date.now() - startedAt
          );
          self._log('info', 'provider call succeeded', {
            request_id: ctx.requestId,
            stage: 'generate',
            provider: target.name,
            model: target.model,
            latency_ms: latency,
            retry_index: attempt
          });
          return { target: target, latencyMs: latency };
        }

        var err = GatewayError(fault.code, target.name + ': ' + fault.title, {
          stage: 'generate',
          provider: target.name,
          retryAfterMs: fault.retryAfterMs || null
        });
        var opened = breaker.onFailure();
        self._emitProviders();
        if (opened) {
          self._log('error', 'circuit opened', {
            request_id: ctx.requestId,
            stage: 'circuit',
            provider: target.name,
            failures: breaker.failures(),
            cooldown_ms: BREAKER.recoveryMs
          });
        }

        var outcome = fault.code === 'provider_timeout' ? 'timeout' : fault.code === 'provider_rate_limited' ? 'rate_limited' : 'error';
        var retriesLeft = RETRY.maxAttempts - attempt - 1;
        var willRetry = err.retryable && retriesLeft > 0;
        var delay = willRetry ? self._delayFor(attempt, fault.retryAfterMs, ctx.rng) : 0;

        ctx.attempts.push({
          provider: target.name,
          model: target.model,
          outcome: outcome,
          latency_ms: latency,
          retry_index: attempt,
          error: fault.code
        });
        self._emit({
          type: 'attempt',
          provider: target.name,
          model: target.model,
          outcome: outcome,
          retryIndex: attempt,
          delayMs: Math.round(delay),
          error: fault.code
        });
        self._log(willRetry ? 'warn' : 'error', willRetry ? 'attempt failed, backing off' : 'attempt failed, no retries left', {
          request_id: ctx.requestId,
          stage: 'generate',
          provider: target.name,
          model: target.model,
          code: fault.code,
          latency_ms: latency,
          retry_index: attempt,
          backoff_ms: Math.round(delay),
          retryable: err.retryable
        });

        if (!willRetry) {
          self._stage(
            genId,
            'generate',
            'fail',
            target.name + ': ' + fault.code + ' after ' + (attempt + 1) + ' attempt' + (attempt ? 's' : '') + (err.retryable ? '' : ' (not retryable)'),
            Date.now() - startedAt
          );
          throw err;
        }

        self._stage(
          genId,
          'generate',
          'warn',
          target.name + ': ' + fault.code + ', backing off ' + Math.round(delay) + 'ms' + (fault.retryAfterMs ? ' (retry-after honoured)' : ' (full jitter)'),
          Date.now() - startedAt
        );
        attempt += 1;
        return self._wait(delay).then(function () {
          self._stage(genId, 'generate', 'run', target.name + '/' + target.model + ': attempt ' + (attempt + 1) + ' of ' + RETRY.maxAttempts);
          return tryOnce();
        });
      });
    }

    return tryOnce();
  };

  GatewayEngine.prototype._afterGeneration = function (ctx, target, draft) {
    var self = this;
    ctx.provider = target.name;
    ctx.servedModel = target.model;
    ctx.providerLatencyMs = draft.latencyMs;

    return this._runTools(ctx, target)
      .then(function () {
        return self._runSchema(ctx, target);
      })
      .then(function () {
        return self._account(ctx, target);
      });
  };

  /* ------------------------------------------------------------------ *
   * Tool loop
   * ------------------------------------------------------------------ */

  GatewayEngine.prototype._runTools = function (ctx, target) {
    var self = this;
    if (!ctx.useTools) {
      self._stage('tools', 'tools', 'skip', 'no tools exposed on this request', 0);
      ctx.completionText = composeReply(ctx.prompt, ctx.model, ctx.rng);
      ctx.finishReason = 'stop';
      return Promise.resolve();
    }

    var planned = planToolCalls(ctx.prompt, ctx.rng);
    var t = Date.now();
    self._stage(
      'tools',
      'tools',
      'run',
      TOOL_DEFINITIONS.length + ' tools offered; model asked for ' + planned.map(function (c) { return c.name; }).join(', ')
    );

    return this._wait(target.baseLatencyMs * 0.45)
      .then(function () {
        self._stage(
          'tools',
          'tools',
          'ok',
          'turn 1 finished with finish_reason=tool_calls (' + planned.length + ' call' + (planned.length === 1 ? '' : 's') + ')',
          Date.now() - t
        );
        self._log('info', 'model requested tool calls', {
          request_id: ctx.requestId,
          stage: 'tools',
          provider: target.name,
          tool_calls: planned.length
        });

        var sequence = Promise.resolve();
        planned.forEach(function (call, i) {
          sequence = sequence.then(function () {
            var stageId = 'tool:' + call.name + ':' + (i + 1);
            var callStart = Date.now();
            self._stage(stageId, 'tools', 'run', call.name + '(' + stableJson(call.arguments) + ')');
            return self._wait(45).then(function () {
              var outcome = TOOLS[call.name].run(call.arguments);
              var invocation = {
                id: newId('call', 10),
                name: call.name,
                arguments: call.arguments,
                result: outcome.result,
                ok: outcome.ok,
                error: outcome.ok ? null : outcome.error,
                latency_ms: Date.now() - callStart
              };
              ctx.invocations.push(invocation);
              self._stage(
                stageId,
                'tools',
                outcome.ok ? 'ok' : 'warn',
                call.name + ' -> ' + (outcome.ok ? summariseToolResult(call.name, outcome.result) : outcome.error),
                Date.now() - callStart
              );
              self._log(outcome.ok ? 'info' : 'warn', 'tool executed', {
                request_id: ctx.requestId,
                stage: 'tools',
                tool: call.name,
                ok: outcome.ok,
                latency_ms: invocation.latency_ms
              });
            });
          });
        });
        return sequence;
      })
      .then(function () {
        var t2 = Date.now();
        self._stage('tools:answer', 'tools', 'run', 'feeding tool results back for turn 2');
        return self._wait(target.baseLatencyMs * 0.5).then(function () {
          ctx.completionText = composeToolReply(ctx.prompt, ctx.invocations, ctx.rng);
          ctx.finishReason = 'stop';
          self._stage('tools:answer', 'tools', 'ok', 'turn 2 answered using ' + ctx.invocations.length + ' tool result(s)', Date.now() - t2);
        });
      });
  };

  function summariseToolResult(name, result) {
    if (!result) return 'no result';
    if (name === 'get_weather') return result.temperature_c + ' C, ' + result.condition;
    if (name === 'calculate') return String(result.result);
    if (name === 'lookup_order') return result.status + ', ' + result.carrier;
    return stableJson(result).slice(0, 60);
  }

  /* ------------------------------------------------------------------ *
   * Structured output with a bounded repair loop
   * ------------------------------------------------------------------ */

  GatewayEngine.prototype._runSchema = function (ctx, target) {
    var self = this;
    if (!ctx.useSchema) {
      self._stage('schema', 'schema', 'skip', 'response_format=text', 0);
      return Promise.resolve();
    }

    var t = Date.now();
    self._stage('schema', 'schema', 'run', 'response_format=json_schema (' + TRIAGE_SCHEMA.name + ', strict)');

    return this._wait(target.baseLatencyMs * 0.55).then(function () {
      var valid = classifyTicket(ctx.prompt, ctx.rng);
      // Models get strict schemas wrong often enough that a gateway which does
      // not check is a gateway that ships malformed JSON downstream. Whether
      // this particular draft is faulty is decided by the request seed, so the
      // same prompt always behaves the same way.
      var faulty = hash32(ctx.fingerprint + ':draft') % 100 < 40;
      var draft = faulty
        ? {
            category: 'billing_issue', // not in the enum
            priority: valid.priority,
            summary: valid.summary,
            confidence: round(1 + ctx.rng() * 0.3, 2), // above the maximum of 1
            follow_up_required: valid.follow_up_required
          }
        : valid;

      var errors = validateSchema(draft, TRIAGE_SCHEMA.schema);
      ctx.schemaAttempts = 1;

      if (!errors.length) {
        ctx.parsed = draft;
        ctx.completionText = JSON.stringify(draft, null, 2);
        ctx.finishReason = 'stop';
        self._stage('schema', 'schema', 'ok', 'draft validated against ' + TRIAGE_SCHEMA.name + ' on the first pass', Date.now() - t);
        self._log('info', 'structured output validated', {
          request_id: ctx.requestId,
          stage: 'schema',
          schema: TRIAGE_SCHEMA.name,
          repair_rounds: 0
        });
        return;
      }

      var rendered = errors
        .map(function (e) {
          return e.path + ': ' + e.keyword + ' - ' + e.message;
        })
        .join(' | ');
      self._stage('schema', 'schema', 'warn', 'draft rejected: ' + rendered, Date.now() - t);
      self._log('warn', 'structured output failed validation', {
        request_id: ctx.requestId,
        stage: 'schema',
        schema: TRIAGE_SCHEMA.name,
        violations: errors.length,
        errors: errors.map(function (e) {
          return e.path + '/' + e.keyword;
        })
      });

      var t2 = Date.now();
      self._stage('schema:repair', 'schema', 'run', 'repair round 1 of 1: errors returned to the model verbatim');
      return self._wait(target.baseLatencyMs * 0.45).then(function () {
        // The repair turn sends the validator output back as the correction
        // instruction. One bounded round: an unbounded loop is how a gateway
        // turns one bad response into an unbounded bill.
        var repaired = valid;
        var repairErrors = validateSchema(repaired, TRIAGE_SCHEMA.schema);
        ctx.schemaAttempts = 2;
        if (repairErrors.length) {
          self._stage('schema:repair', 'schema', 'fail', 'repair still invalid: ' + repairErrors.length + ' violation(s)', Date.now() - t2);
          throw GatewayError('structured_output_failed', 'Model could not produce schema-valid output after 1 repair round.', { stage: 'schema' });
        }
        ctx.parsed = repaired;
        ctx.completionText = JSON.stringify(repaired, null, 2);
        ctx.finishReason = 'stop';
        ctx.repairRounds = 1;
        self._stage('schema:repair', 'schema', 'ok', 'repaired output validates: category and confidence corrected', Date.now() - t2);
        self._log('info', 'structured output repaired', {
          request_id: ctx.requestId,
          stage: 'schema',
          schema: TRIAGE_SCHEMA.name,
          repair_rounds: 1
        });
      });
    });
  };

  /* ------------------------------------------------------------------ *
   * Accounting and cache store
   * ------------------------------------------------------------------ */

  GatewayEngine.prototype._account = function (ctx, target) {
    var self = this;
    var t = Date.now();
    self._stage('accounting', 'accounting', 'run', 'estimating usage and pricing it at ' + target.model + ' rates');

    return this._wait(50)
      .then(function () {
        // Estimated, not measured. A real gateway bills from the usage block the
        // provider returns on the response; this demo has no provider to ask,
        // so it uses the same ~4-chars-per-token heuristic the Python code uses
        // for pre-flight projection only.
        var promptTokens = estimateTokens(ctx.prompt) + MESSAGE_OVERHEAD_TOKENS;
        if (ctx.useTools) promptTokens += estimateTokens(stableJson(TOOL_DEFINITIONS));
        if (ctx.useSchema) promptTokens += estimateTokens(stableJson(TRIAGE_SCHEMA));

        var completionTokens = estimateTokens(ctx.completionText);
        for (var i = 0; i < ctx.invocations.length; i++) {
          // The tool-call turn and the tool results are billed completion and
          // prompt tokens respectively; both cross the wire.
          completionTokens += estimateTokens(stableJson(ctx.invocations[i].arguments)) + 5;
          promptTokens += estimateTokens(stableJson(ctx.invocations[i].result || {}));
        }
        if (ctx.repairRounds) {
          completionTokens += Math.round(completionTokens * 0.9); // the rejected draft was paid for too
        }

        var price = priceFor(target.model);
        var cost = costOf(target.model, promptTokens, completionTokens);

        ctx.usage = {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: promptTokens + completionTokens,
          cached_prompt_tokens: 0
        };
        ctx.costUsd = round(cost, 6);

        self._stats.requests += 1;
        self._stats.promptTokens += promptTokens;
        self._stats.completionTokens += completionTokens;
        self._stats.totalTokens += promptTokens + completionTokens;
        self._stats.spendUsd += cost;

        self._emit({
          type: 'usage',
          promptTokens: promptTokens,
          completionTokens: completionTokens,
          costUsd: ctx.costUsd,
          cached: false
        });
        self._stage(
          'accounting',
          'accounting',
          'ok',
          promptTokens + ' in + ' + completionTokens + ' out = $' + round(cost, 6) + ' at $' + price.input + '/$' + price.output + ' per Mtok',
          Date.now() - t
        );
        self._log('info', 'usage recorded', {
          request_id: ctx.requestId,
          stage: 'accounting',
          provider: target.name,
          model: target.model,
          tokens: promptTokens + completionTokens,
          cost_usd: ctx.costUsd,
          spend_usd: round(self._stats.spendUsd, 6)
        });
      })
      .then(function () {
        return self._store(ctx, target);
      });
  };

  GatewayEngine.prototype._store = function (ctx, target) {
    var self = this;
    var latency = Date.now() - ctx.startedAt;
    var response = {
      id: newId('cmpl'),
      request_id: ctx.requestId,
      simulated: true,
      simulation_note: 'Generated in the browser by a deterministic simulator. No language model was called.',
      model: target.model,
      requested_model: ctx.model,
      provider: target.name,
      created: Math.floor(Date.now() / 1000),
      message: {
        role: 'assistant',
        content: ctx.completionText,
        tool_calls: ctx.invocations.map(function (inv) {
          return { id: inv.id, name: inv.name, arguments: inv.arguments };
        })
      },
      finish_reason: ctx.finishReason || 'stop',
      usage: ctx.usage,
      cost_usd: ctx.costUsd,
      cached: false,
      latency_ms: latency,
      provider_latency_ms: ctx.providerLatencyMs,
      attempts: ctx.attempts,
      tool_invocations: ctx.invocations,
      parsed: ctx.parsed === undefined ? null : ctx.parsed,
      schema: ctx.useSchema ? TRIAGE_SCHEMA.name : null,
      repair_rounds: ctx.repairRounds || 0
    };

    var t = Date.now();
    if (!ctx.useCache) {
      self._stage('cache-store', 'cache-store', 'skip', 'caching disabled for this request', 0);
      return finish();
    }

    self._stage('cache-store', 'cache-store', 'run', 'storing under ' + ctx.fingerprint);
    return this._wait(40).then(function () {
      self._cache[ctx.fingerprint] = {
        storedAt: Date.now(),
        response: response,
        promptTokens: ctx.usage.prompt_tokens,
        completionTokens: ctx.usage.completion_tokens,
        costUsd: ctx.costUsd
      };
      self._stage('cache-store', 'cache-store', 'ok', 'stored, ttl ' + CACHE_TTL_MS / 1000 + 's, ' + Object.keys(self._cache).length + ' entries held', Date.now() - t);
      self._log('info', 'response cached', {
        request_id: ctx.requestId,
        stage: 'cache-store',
        key: ctx.fingerprint,
        ttl_ms: CACHE_TTL_MS
      });
      return finish();
    });

    function finish() {
      self._log('info', 'request complete', {
        request_id: ctx.requestId,
        stage: 'egress',
        provider: target.name,
        model: target.model,
        latency_ms: Date.now() - ctx.startedAt,
        tokens: ctx.usage.total_tokens,
        cost_usd: ctx.costUsd,
        cached: false
      });
      response.latency_ms = Date.now() - ctx.startedAt;
      self._emit({ type: 'done', response: response });
      return response;
    }
  };

  /* ------------------------------------------------------------------ *
   * Scenarios
   * ------------------------------------------------------------------ */

  /*
   * Each entry is { label, blurb, controls }.
   *
   * `controls` is a partial of the send options and maps one-to-one onto the
   * page controls (prompt, model, cache, tools, schema, fallback, inject), so
   * `gw.send(scenario.controls)` works as-is - unknown keys are ignored.
   * Three keys are engine-level rather than DOM-level:
   *   runs       - how many times to fire the request to make the point
   *   burst      - fire the runs without awaiting, so they arrive together
   *   budgetUsd  - operator budget override, honoured by send() and by
   *                setBudget(); without it the ceiling stays at $0.05 and the
   *                budget scenario needs far more requests to reach it.
   */
  var GATEWAY_SCENARIOS = {
    happy: {
      label: 'Happy path',
      blurb: 'One clean request end to end: auth, limits, budget, cache miss, one provider call, accounting, cache store.',
      controls: {
        prompt: 'Explain why a gateway should own retries instead of leaving them to each client.',
        model: 'sim-medium',
        cache: true,
        tools: false,
        schema: false,
        fallback: true,
        inject: 'none',
        runs: 1
      }
    },
    retry: {
      label: 'Retry with backoff',
      blurb: 'The upstream times out twice. Watch the exponential backoff with full jitter, then a success on the third attempt.',
      controls: {
        prompt: 'Summarise the trade-off between retrying a request and failing fast.',
        model: 'sim-medium',
        cache: false,
        tools: false,
        schema: false,
        fallback: true,
        inject: 'timeout',
        runs: 1
      }
    },
    failover: {
      label: 'Provider failover',
      blurb: 'The primary region is refusing connections. Retries are exhausted, the breaker trips, and the request lands on the next provider in the chain.',
      controls: {
        prompt: 'What belongs in a routing table for a multi-provider LLM gateway?',
        model: 'sim-down',
        cache: false,
        tools: false,
        schema: false,
        fallback: true,
        inject: 'none',
        runs: 1
      }
    },
    circuit: {
      label: 'Circuit breaker',
      blurb: 'Failover is disabled, so the dead provider absorbs a full retry budget. Three consecutive failures open its breaker and the next requests are refused in microseconds instead.',
      controls: {
        prompt: 'Why does a circuit breaker make a dead provider cheap rather than merely visible?',
        model: 'sim-down',
        cache: false,
        tools: false,
        schema: false,
        fallback: false,
        inject: 'none',
        runs: 3
      }
    },
    cache: {
      label: 'Cache hit',
      blurb: 'The same prompt sent twice. The second request never reaches a provider: it is fingerprinted, matched, and served at zero cost.',
      controls: {
        prompt: 'List the fields that should and should not go into a response cache key.',
        model: 'sim-large',
        cache: true,
        tools: false,
        schema: false,
        fallback: true,
        inject: 'none',
        runs: 2
      }
    },
    tools: {
      label: 'Tool calling',
      blurb: 'Two model turns with real work in between: the model asks for a tool, the gateway runs it locally, and the answer is built from the result.',
      controls: {
        prompt: 'What is the weather in Dubai, and what is (120*3)/4 + 18?',
        model: 'sim-medium',
        cache: false,
        tools: true,
        schema: false,
        fallback: true,
        inject: 'none',
        runs: 1
      }
    },
    'schema-repair': {
      label: 'Schema repair',
      blurb: 'Strict JSON output. The first draft breaks the category enum and pushes confidence above 1; the validator says exactly where, and one repair round fixes it.',
      controls: {
        // The seed for this exact prompt lands in the faulty-draft band, so the
        // repair round always runs. Change the wording and the draft may well
        // validate first time.
        prompt: 'Invoice 4417 was charged twice this morning. The duplicate payment has not been refunded and our month-end close is blocked.',
        model: 'sim-medium',
        cache: false,
        tools: false,
        schema: true,
        fallback: true,
        inject: 'none',
        runs: 1
      }
    },
    ratelimit: {
      label: 'Rate limit',
      blurb: 'A burst of eight requests against a bucket holding five tokens that refills at one per second. The overflow is rejected with a retry-after.',
      controls: {
        prompt: 'Ping.',
        model: 'sim-small',
        cache: false,
        tools: false,
        schema: false,
        fallback: true,
        inject: 'none',
        runs: 8,
        burst: true
      }
    },
    budget: {
      label: 'Budget stop',
      blurb: 'Expensive model, caching off, and a tightened ceiling. The pre-flight projection reserves the full completion allowance, so the gateway stops before the spend happens rather than after.',
      controls: {
        prompt:
          'Draft a detailed migration plan for moving a production workload from a single LLM provider to a gateway with two upstreams, covering routing, retries, cost controls, structured output, and rollback. Include the questions to answer before the first request is proxied, and note where the plan is likely to be wrong.',
        model: 'sim-large',
        cache: false,
        tools: false,
        schema: false,
        fallback: true,
        inject: 'none',
        budgetUsd: 0.02,
        runs: 4
      }
    }
  };

  /* ------------------------------------------------------------------ */

  var root = typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this;
  root.GatewayEngine = GatewayEngine;
  root.GATEWAY_SCENARIOS = GATEWAY_SCENARIOS;
})();
