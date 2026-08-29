/* app.js - DOM wiring for the LLM gateway browser demo.
 *
 * This file owns every DOM read and write on the page. It holds no pipeline
 * logic: the simulated gateway lives in engine.js and speaks to this file only
 * through the event stream passed to `onEvent`, plus three pull-style accessors
 * (`stats()`, `providers()`, `reset()`).
 *
 * Two rules shape the code below.
 *
 * 1. Nothing here throws into the engine. `onEvent` is called synchronously
 *    from inside `send()`, so an exception in a renderer would surface as a
 *    failed request and lie about what the pipeline did. Every handler is
 *    wrapped, and every element lookup tolerates a missing id: one markup
 *    change should degrade one panel, not blank the page.
 *
 * 2. Everything interpolated into markup is escaped. The data is local and
 *    synthetic, but treating it as untrusted is the habit worth showing - the
 *    `html` tagged template escapes every value unless it is explicitly marked
 *    as trusted markup (only the icon constants defined in this file are).
 */
(function () {
  'use strict';

  var VERSION = '1.0.0';
  var THEME_KEY = 'theme';
  var LOG_LINE_CAP = 200;
  var PIPELINE_ROW_CAP = 240;

  /* Used only when the prompt box is empty at send time, so a scenario click
   * never produces an empty request the viewer cannot interpret. */
  var DEFAULT_PROMPT =
    'Summarise what a circuit breaker protects against in an API gateway, in two sentences.';

  /* Upper bound on a scenario's `runs`, and the pause between sequential
   * requests so the viewer registers the divider before the next one starts. */
  var MAX_RUNS = 20;
  var RUN_GAP_MS = 220;

  var STATUS_WORD = {
    run: 'running',
    ok: 'ok',
    skip: 'skipped',
    fail: 'failed',
    warn: 'warning'
  };

  var CIRCUIT_LABEL = {
    closed: 'closed',
    open: 'open',
    half_open: 'half-open'
  };

  var CIRCUIT_HINT = {
    closed: 'Passing traffic normally.',
    open: 'Failing fast without calling the provider.',
    half_open: 'Letting a single probe request through.'
  };

  /* Statuses that mean a stage is finished. 'run' is in-progress and 'warn' is
   * in-progress-with-a-problem (backing off before a retry), so neither ends a
   * stage's row. */
  var TERMINAL_STATUS = { ok: true, fail: true, skip: true };

  var state = {
    engine: null,
    ready: false,
    busy: false,
    runSeq: 0,
    stages: new Map(),
    currentStageKey: null,
    run: null,
    plan: { total: 1, index: 0, label: null },
    defaults: null,
    panelSnapshots: new Map(),
    cooldownTimer: 0
  };

  /* ------------------------------------------------------------------ *
   * Escaping and small markup helpers
   * ------------------------------------------------------------------ */

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* Marker for markup that is a literal in this file and therefore trusted.
   * Nothing derived from engine output is ever wrapped in it. */
  function Trusted(markup) {
    this.markup = String(markup);
  }
  function trusted(markup) {
    return new Trusted(markup);
  }

  /* Tagged template: every `${value}` is escaped unless it is Trusted. */
  function html(strings) {
    var out = strings[0];
    for (var i = 1; i < arguments.length; i++) {
      var value = arguments[i];
      out += (value instanceof Trusted ? value.markup : escapeHtml(value)) + strings[i];
    }
    return out;
  }

  function element(markup) {
    var tpl = document.createElement('template');
    tpl.innerHTML = String(markup).trim();
    return tpl.content.firstElementChild;
  }

  function icon(paths) {
    return trusted(
      '<svg class="gw-icon" viewBox="0 0 16 16" width="14" height="14" fill="none" ' +
        'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" ' +
        'stroke-linejoin="round" aria-hidden="true" focusable="false">' +
        paths +
        '</svg>'
    );
  }

  var ICONS = {
    run: icon('<path d="M8 2.8a5.2 5.2 0 1 1-5.2 5.2" opacity=".9"/>'),
    ok: icon('<path d="M3.2 8.4l3.1 3.1 6.5-6.9"/>'),
    fail: icon('<path d="M4.2 4.2l7.6 7.6M11.8 4.2l-7.6 7.6"/>'),
    skip: icon('<path d="M3.4 8h9.2"/>'),
    warn: icon('<path d="M8 3.2v5.3"/><path d="M8 11.6h.01"/>')
  };

  function iconFor(status) {
    return ICONS[status] || ICONS.run;
  }

  /* ------------------------------------------------------------------ *
   * Element access - a missing id warns once and is then ignored
   * ------------------------------------------------------------------ */

  var warned = new Set();

  function el(id) {
    var node = document.getElementById(id);
    if (!node && !warned.has(id)) {
      warned.add(id);
      console.warn('[llm-gateway demo] missing element #' + id + ' - that panel is disabled.');
    }
    return node;
  }

  function all(selector) {
    return Array.prototype.slice.call(document.querySelectorAll(selector));
  }

  /* ------------------------------------------------------------------ *
   * Formatting - figures are tabular in CSS, so widths must stay stable
   * ------------------------------------------------------------------ */

  function isNum(value) {
    return typeof value === 'number' && isFinite(value);
  }

  function num(value, fallback) {
    return isNum(value) ? value : fallback === undefined ? 0 : fallback;
  }

  function fmtInt(value) {
    return num(value).toLocaleString('en-GB', { maximumFractionDigits: 0 });
  }

  function fmtMs(ms) {
    var value = num(ms);
    if (value < 1000) return Math.round(value) + ' ms';
    return (value / 1000).toFixed(value < 10000 ? 2 : 1) + ' s';
  }

  function fmtUsd(value) {
    var amount = num(value);
    return '$' + amount.toFixed(Math.abs(amount) >= 10 ? 2 : 4);
  }

  function fmtPct(value) {
    var rate = num(value);
    return rate.toFixed(rate > 0 && rate < 10 ? 1 : 0) + '%';
  }

  function pad(value, width) {
    return String(value).padStart(width, '0');
  }

  function clockTime(date) {
    var d = date || new Date();
    return pad(d.getHours(), 2) + ':' + pad(d.getMinutes(), 2) + ':' + pad(d.getSeconds(), 2);
  }

  function clockTimeMs(date) {
    var d = date || new Date();
    return clockTime(d) + '.' + pad(d.getMilliseconds(), 3);
  }

  function titleise(value) {
    var text = String(value == null ? '' : value).replace(/[_-]+/g, ' ').trim();
    if (!text) return 'Stage';
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  /* Tolerant field read: the engine mirrors the Python wire contract, which is
   * snake_case, but a camelCase spelling should not break the ledger. */
  function pick(obj, names, fallback) {
    if (!obj || typeof obj !== 'object') return fallback;
    for (var i = 0; i < names.length; i++) {
      var value = obj[names[i]];
      if (value !== undefined && value !== null) return value;
    }
    return fallback;
  }

  function safeStringify(value, indent) {
    var seen = new WeakSet();
    try {
      return JSON.stringify(
        value,
        function (key, val) {
          if (typeof val === 'object' && val !== null) {
            if (seen.has(val)) return '[circular]';
            seen.add(val);
          }
          if (typeof val === 'function') return '[function]';
          if (typeof val === 'undefined') return null;
          return val;
        },
        indent || 0
      );
    } catch (err) {
      return String(value);
    }
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /* ------------------------------------------------------------------ *
   * Scrolling
   * ------------------------------------------------------------------ */

  /* The scroll container is not always the element being written to: a tbody
   * scrolls inside its table's wrapper, a list inside its panel. Walk a few
   * levels up rather than assuming a particular layout. */
  function scrollerFor(node) {
    var current = node;
    for (var depth = 0; current && depth < 4; depth++) {
      if (current.scrollHeight > current.clientHeight + 2) return current;
      current = current.parentElement;
    }
    return null;
  }

  function scrollToEnd(node) {
    var scroller = scrollerFor(node);
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }

  /* Only follow the log if the viewer has not scrolled up to read something. */
  function nearBottom(node) {
    var scroller = scrollerFor(node);
    if (!scroller) return true;
    return scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 48;
  }

  /* ------------------------------------------------------------------ *
   * Status line
   * ------------------------------------------------------------------ */

  function setStatus(text, tone) {
    var node = el('gw-status');
    if (!node) return;
    if (!node.hasAttribute('aria-live')) node.setAttribute('aria-live', 'polite');
    node.textContent = text;
    node.setAttribute('data-tone', tone || 'info');
  }

  /* ------------------------------------------------------------------ *
   * Controls
   * ------------------------------------------------------------------ */

  var CONTROL_IDS = {
    prompt: 'gw-prompt',
    model: 'gw-model',
    cache: 'gw-cache',
    tools: 'gw-tools',
    schema: 'gw-schema',
    fallback: 'gw-fallback',
    inject: 'gw-inject'
  };

  var CHECKBOX_KEYS = ['cache', 'tools', 'schema', 'fallback'];

  function readControls() {
    var opts = {};
    Object.keys(CONTROL_IDS).forEach(function (key) {
      var node = document.getElementById(CONTROL_IDS[key]);
      if (!node) return;
      opts[key] = CHECKBOX_KEYS.indexOf(key) === -1 ? node.value : !!node.checked;
    });
    if (typeof opts.prompt === 'string') opts.prompt = opts.prompt.trim();
    return opts;
  }

  function applyControls(partial) {
    if (!partial) return;
    Object.keys(partial).forEach(function (key) {
      var id = CONTROL_IDS[key];
      if (!id) return;
      var node = document.getElementById(id);
      if (!node) return;
      var value = partial[key];
      if (CHECKBOX_KEYS.indexOf(key) !== -1) {
        node.checked = !!value;
        return;
      }
      if (node.tagName === 'SELECT') {
        var known = Array.prototype.some.call(node.options, function (option) {
          return option.value === String(value);
        });
        if (!known) {
          console.warn('[llm-gateway demo] #' + id + ' has no option "' + value + '"');
          return;
        }
      }
      node.value = value == null ? '' : String(value);
    });
  }

  function controlsForScenario(overrides) {
    /* Scenario buttons are meant to be reproducible, so they start from the
     * page's own initial control values rather than from whatever the previous
     * scenario left behind. The prompt is the exception: a prompt the viewer
     * typed is kept unless the scenario supplies its own. */
    var base = Object.assign({}, state.defaults || {});
    var typed = readControls().prompt;
    if (typed) base.prompt = typed;
    return Object.assign(base, overrides || {});
  }

  function setBusy(busy) {
    state.busy = busy;
    var send = el('gw-send');
    if (send) {
      send.disabled = busy;
      send.setAttribute('aria-busy', busy ? 'true' : 'false');
      send.setAttribute('data-busy', busy ? 'true' : 'false');
    }
    var reset = document.getElementById('gw-reset');
    if (reset) reset.disabled = busy;
    all('.gw-scenario').forEach(function (button) {
      button.disabled = busy;
    });
  }

  function markActiveScenario(name) {
    all('.gw-scenario').forEach(function (button) {
      var active = !!name && button.getAttribute('data-scenario') === name;
      button.setAttribute('data-active', active ? 'true' : 'false');
      button.classList.toggle('is-active', active);
    });
  }

  /* ------------------------------------------------------------------ *
   * Panels: snapshot the author's placeholder markup so reset can restore it
   * ------------------------------------------------------------------ */

  var PANEL_IDS = ['gw-pipeline', 'gw-providers', 'gw-stats', 'gw-ledger', 'gw-response', 'gw-log'];

  function snapshotPanels() {
    PANEL_IDS.forEach(function (id) {
      var node = document.getElementById(id);
      if (node) state.panelSnapshots.set(id, node.innerHTML);
    });
  }

  function restorePanel(id) {
    var node = document.getElementById(id);
    if (!node) return;
    /* The only innerHTML assignment from a non-escaped source in this file, and
     * the source is the page's own authored markup captured at load. */
    node.innerHTML = state.panelSnapshots.has(id) ? state.panelSnapshots.get(id) : '';
  }

  /* Panels may ship with an authored "nothing yet" placeholder row. */
  function clearEmptyState(host) {
    if (!host) return;
    Array.prototype.forEach.call(host.querySelectorAll('[data-empty]'), function (node) {
      node.remove();
    });
  }

  /* ------------------------------------------------------------------ *
   * Pipeline
   * ------------------------------------------------------------------ */

  function clearPipeline() {
    var host = el('gw-pipeline');
    state.stages.clear();
    state.currentStageKey = null;
    if (host) host.textContent = '';
  }

  function trimPipeline(host) {
    while (host.children.length > PIPELINE_ROW_CAP) {
      host.removeChild(host.firstElementChild);
    }
  }

  function appendRunMarker(index, total) {
    var host = el('gw-pipeline');
    if (!host) return;
    host.appendChild(
      element(html`
        <li class="gw-run-marker" data-kind="marker">
          <span class="gw-run-marker-text">Request ${index} of ${total}</span>
        </li>`)
    );
    scrollToEnd(host);
  }

  function createStage(key, id, name) {
    var li = element(html`
      <li class="gw-stage" data-stage="${id}" data-status="run">
        <div class="gw-stage-row">
          <span class="gw-stage-icon" aria-hidden="true">${ICONS.run}</span>
          <span class="gw-stage-name">${name}</span>
          <span class="gw-stage-state">running</span>
          <span class="gw-stage-ms"></span>
        </div>
        <p class="gw-stage-detail" hidden></p>
        <ul class="gw-attempts" hidden></ul>
      </li>`);
    var entry = {
      key: key,
      li: li,
      status: 'run',
      startedAt: now(),
      iconEl: li.querySelector('.gw-stage-icon'),
      nameEl: li.querySelector('.gw-stage-name'),
      stateEl: li.querySelector('.gw-stage-state'),
      msEl: li.querySelector('.gw-stage-ms'),
      detailEl: li.querySelector('.gw-stage-detail'),
      attemptsEl: li.querySelector('.gw-attempts')
    };
    state.stages.set(key, entry);
    return entry;
  }

  function now() {
    return window.performance && performance.now ? performance.now() : Date.now();
  }

  function updateStage(entry, evt) {
    var status = STATUS_WORD[evt.status] ? evt.status : 'run';
    entry.status = status;
    entry.li.setAttribute('data-status', status);
    if (entry.iconEl) {
      entry.iconEl.textContent = '';
      entry.iconEl.appendChild(element(iconFor(status).markup));
    }
    if (entry.nameEl && evt.name) entry.nameEl.textContent = evt.name;
    if (entry.stateEl) entry.stateEl.textContent = STATUS_WORD[status];

    if (entry.detailEl) {
      var detail = evt.detail == null ? '' : String(evt.detail);
      entry.detailEl.textContent = detail;
      entry.detailEl.hidden = !detail;
    }

    if (entry.msEl) {
      if (status === 'run') {
        entry.msEl.textContent = '';
      } else {
        var ms = isNum(evt.ms) ? evt.ms : now() - entry.startedAt;
        entry.msEl.textContent = fmtMs(ms);
      }
    }
  }

  function onStage(evt) {
    var host = el('gw-pipeline');
    if (!host) return;

    var id = String(evt.id == null ? evt.name || 'stage' : evt.id);
    var key = state.runSeq + '::' + id;
    var entry = state.stages.get(key);

    /* A stage that genuinely restarts after finishing - a second routing pass
     * after failover - gets its own row instead of overwriting the record of
     * the first pass.
     *
     * Only a TERMINAL status counts as finished. The engine drives retries and
     * the schema repair loop as run -> warn -> run on one stage id, with the
     * individual tries nested underneath; treating 'warn' as terminal here
     * spawned an orphan row per retry, each left showing "running" forever. */
    if (entry && evt.status === 'run' && TERMINAL_STATUS[entry.status]) {
      var n = 2;
      while (state.stages.has(key + '#' + n)) n++;
      key = key + '#' + n;
      entry = null;
    }

    if (!entry) {
      entry = createStage(key, id, evt.name || titleise(id));
      host.appendChild(entry.li);
      trimPipeline(host);
      if (state.run) state.run.stageCount += 1;
    }

    updateStage(entry, evt);
    if (evt.status === 'run') state.currentStageKey = key;
    scrollToEnd(host);
  }

  function currentStage() {
    var entry = state.currentStageKey ? state.stages.get(state.currentStageKey) : null;
    if (entry) return entry;

    /* An attempt arriving before any stage still has to land somewhere. */
    var host = el('gw-pipeline');
    if (!host) return null;
    var key = state.runSeq + '::__attempts';
    entry = state.stages.get(key);
    if (!entry) {
      entry = createStage(key, 'attempt', 'Provider attempts');
      host.appendChild(entry.li);
    }
    state.currentStageKey = key;
    return entry;
  }

  function onAttempt(evt) {
    var entry = currentStage();
    if (!entry || !entry.attemptsEl) return;

    var attemptNo = num(evt.retryIndex, 0) + 1;
    var outcome = String(evt.outcome == null ? 'unknown' : evt.outcome);
    var target = [evt.provider, evt.model].filter(Boolean).join(' · ');
    var delay = num(evt.delayMs, 0);

    var li = element(html`
      <li class="gw-attempt" data-outcome="${outcome}">
        <span class="gw-attempt-n">attempt ${attemptNo}</span>
        <span class="gw-attempt-target">${target}</span>
        <span class="gw-attempt-outcome">${outcome.replace(/_/g, ' ')}</span>
      </li>`);

    if (delay > 0) {
      li.appendChild(
        element(html`<span class="gw-attempt-delay">backoff ${fmtMs(delay)}</span>`)
      );
    }
    if (evt.error) {
      li.appendChild(element(html`<span class="gw-attempt-error">${evt.error}</span>`));
    }

    entry.attemptsEl.hidden = false;
    entry.attemptsEl.appendChild(li);

    if (state.run) {
      state.run.attempts += 1;
      if (evt.provider) state.run.provider = String(evt.provider);
      if (evt.model) state.run.model = String(evt.model);
    }
    scrollToEnd(el('gw-pipeline'));
  }

  /* ------------------------------------------------------------------ *
   * Providers
   * ------------------------------------------------------------------ */

  function providerCard(provider) {
    var circuit = String(pick(provider, ['circuit'], 'closed'));
    var label = CIRCUIT_LABEL[circuit] || circuit.replace(/_/g, ' ');
    var hint = CIRCUIT_HINT[circuit] || '';
    var failures = num(pick(provider, ['failures'], 0));
    var cooldown = num(pick(provider, ['cooldownMs', 'cooldown_ms'], 0));

    var card = element(html`
      <article class="gw-prov" data-state="${circuit}">
        <div class="gw-prov-head">
          <span class="gw-prov-name">${pick(provider, ['name'], 'provider')}</span>
          <span class="gw-prov-state" data-state="${circuit}" title="${hint}">${label}</span>
        </div>
        <p class="gw-prov-model">${pick(provider, ['model'], '')}</p>
        <dl class="gw-prov-meta">
          <div class="gw-prov-metric">
            <dt>Failures</dt>
            <dd>${fmtInt(failures)}</dd>
          </div>
          <div class="gw-prov-metric">
            <dt>Cooldown</dt>
            <dd class="gw-prov-cool">${cooldown > 0 ? fmtMs(cooldown) : '—'}</dd>
          </div>
        </dl>
      </article>`);

    if (cooldown > 0) {
      var cool = card.querySelector('.gw-prov-cool');
      cool.setAttribute('data-cooldown', String(cooldown));
      cool.setAttribute('data-at', String(Date.now()));
    }
    return card;
  }

  function renderProviders(list) {
    var host = el('gw-providers');
    if (!host) return;
    var providers = Array.isArray(list) ? list : [];

    host.textContent = '';
    providers.forEach(function (provider) {
      var card = providerCard(provider);
      /* Keep the markup valid whichever container the page uses. */
      if (host.tagName === 'UL' || host.tagName === 'OL') {
        var li = document.createElement('li');
        li.className = 'gw-prov-item';
        li.appendChild(card);
        host.appendChild(li);
      } else {
        host.appendChild(card);
      }
    });
    startCooldownTicker();
  }

  function startCooldownTicker() {
    var host = document.getElementById('gw-providers');
    if (!host || !host.querySelector('[data-cooldown]')) {
      stopCooldownTicker();
      return;
    }
    if (state.cooldownTimer) return;
    /* A number counting down four times a second is motion of a sort; slow it
     * right down when the viewer has asked for less of it. */
    state.cooldownTimer = window.setInterval(tickCooldowns, reducedMotion() ? 1000 : 250);
  }

  function stopCooldownTicker() {
    if (state.cooldownTimer) {
      window.clearInterval(state.cooldownTimer);
      state.cooldownTimer = 0;
    }
  }

  function tickCooldowns() {
    var host = document.getElementById('gw-providers');
    if (!host) {
      stopCooldownTicker();
      return;
    }
    var live = 0;
    all('#gw-providers [data-cooldown]').forEach(function (node) {
      var total = Number(node.getAttribute('data-cooldown')) || 0;
      var at = Number(node.getAttribute('data-at')) || 0;
      var left = Math.max(0, total - (Date.now() - at));
      node.textContent = left > 0 ? fmtMs(left) : '—';
      if (left > 0) live += 1;
      else node.removeAttribute('data-cooldown');
    });
    if (!live) stopCooldownTicker();
  }

  function refreshProviders() {
    if (!state.engine || typeof state.engine.providers !== 'function') return;
    try {
      renderProviders(state.engine.providers());
    } catch (err) {
      console.warn('[llm-gateway demo] providers() failed', err);
    }
  }

  /* ------------------------------------------------------------------ *
   * Stats
   * ------------------------------------------------------------------ */

  function currentStats() {
    if (!state.engine || typeof state.engine.stats !== 'function') return {};
    try {
      return state.engine.stats() || {};
    } catch (err) {
      console.warn('[llm-gateway demo] stats() failed', err);
      return {};
    }
  }

  /* Prefer the counts over the reported rate so the headline figure can never
   * disagree with the hit/miss line printed beneath it. Fall back to the
   * engine's own `hitRate`, accepting either a fraction or a percentage. */
  function hitRatePct(stats, hits, lookups) {
    if (lookups > 0) return fmtPct((hits / lookups) * 100);
    if (!isNum(stats.hitRate)) return '—';
    return fmtPct(stats.hitRate <= 1 ? stats.hitRate * 100 : stats.hitRate);
  }

  function statTile(labelText, valueText, subText) {
    return element(html`
      <div class="gw-stat">
        <dt class="gw-stat-label">${labelText}</dt>
        <dd class="gw-stat-value">
          <span class="gw-stat-figure">${valueText}</span>
          ${subText ? trusted(html`<span class="gw-stat-sub">${subText}</span>`) : ''}
        </dd>
      </div>`);
  }

  function renderStats() {
    var host = el('gw-stats');
    if (!host) return;
    var s = currentStats();

    var hits = num(s.cacheHits, 0);
    var misses = num(s.cacheMisses, 0);
    var lookups = hits + misses;
    var prompt = num(s.promptTokens, 0);
    var completion = num(s.completionTokens, 0);
    var total = num(s.totalTokens, prompt + completion);
    var spend = num(s.spendUsd, 0);
    var budget = num(s.budgetUsd, 0);

    var tiles = [
      statTile('Requests', fmtInt(s.requests), 'served by the gateway'),
      statTile(
        'Cache hit rate',
        hitRatePct(s, hits, lookups),
        fmtInt(hits) + ' hit / ' + fmtInt(misses) + ' miss'
      ),
      statTile(
        'Tokens',
        fmtInt(total),
        fmtInt(prompt) + ' prompt / ' + fmtInt(completion) + ' completion'
      ),
      statTile('Spend', fmtUsd(spend), budget > 0 ? 'of ' + fmtUsd(budget) + ' budget' : 'simulated'),
      statTile('Saved by cache', fmtUsd(s.savedUsd), 'avoided upstream cost')
    ];

    host.textContent = '';
    if (host.tagName === 'DL') {
      tiles.forEach(function (tile) {
        host.appendChild(tile);
      });
    } else {
      var dl = document.createElement('dl');
      dl.className = 'gw-stat-grid';
      tiles.forEach(function (tile) {
        dl.appendChild(tile);
      });
      host.appendChild(dl);
    }
  }

  /* ------------------------------------------------------------------ *
   * Ledger
   * ------------------------------------------------------------------ */

  function appendLedgerRow(row) {
    var host = el('gw-ledger');
    if (!host) return;
    clearEmptyState(host);

    var failed = !!row.failed;
    var tr = element(html`
      <tr class="gw-led-row" data-outcome="${failed ? 'failed' : 'ok'}">
        <td class="gw-led-time">${row.time}</td>
        <td class="gw-led-model">${row.model || '—'}</td>
        <td class="gw-led-provider">${row.provider || '—'}</td>
        <td class="gw-led-num">${row.tokens}</td>
        <td class="gw-led-num">${row.cost}</td>
        <td class="gw-led-cached">${row.cached ? 'hit' : 'miss'}</td>
        <td class="gw-led-outcome">
          <span class="gw-tag" data-tone="${failed ? 'bad' : 'ok'}">${row.outcome}</span>
        </td>
      </tr>`);

    host.appendChild(tr);
    scrollToEnd(host);
  }

  /* ------------------------------------------------------------------ *
   * Response and log
   * ------------------------------------------------------------------ */

  function renderResponse(value) {
    var host = el('gw-response');
    if (!host) return;
    host.textContent = safeStringify(value, 2);
    host.scrollTop = 0;
  }

  function fieldsText(fields) {
    if (fields == null) return '';
    if (typeof fields !== 'object') return String(fields);
    if (!Object.keys(fields).length) return '';
    var text = safeStringify(fields, 0);
    return text.length > 260 ? text.slice(0, 257) + '…' : text;
  }

  function appendLog(evt) {
    var host = el('gw-log');
    if (!host) return;

    var level = ['info', 'warn', 'error'].indexOf(evt.level) === -1 ? 'info' : evt.level;
    var stick = nearBottom(host);
    var time = clockTimeMs();
    var fields = fieldsText(evt.fields);
    /* A <pre> log panel only admits phrasing content, so the line element has
     * to be a span with an explicit newline after it. */
    var isPre = host.tagName === 'PRE';
    var line = document.createElement(isPre ? 'span' : 'div');
    line.className = 'gw-log-line';
    line.setAttribute('data-level', level);
    line.appendChild(element(html`<span class="gw-log-time">${time}</span>`));
    line.appendChild(element(html`<span class="gw-log-level">${level}</span>`));
    line.appendChild(
      element(html`<span class="gw-log-msg">${evt.msg == null ? '' : evt.msg}</span>`)
    );
    if (fields) {
      line.appendChild(element(html`<span class="gw-log-fields">${fields}</span>`));
    }

    host.appendChild(line);
    if (isPre) host.appendChild(document.createTextNode('\n'));

    while (host.querySelectorAll('.gw-log-line').length > LOG_LINE_CAP) {
      var first = host.querySelector('.gw-log-line');
      if (!first) break;
      var next = first.nextSibling;
      first.remove();
      if (isPre && next && next.nodeType === 3) next.remove();
    }
    if (stick) scrollToEnd(host);
  }

  /* ------------------------------------------------------------------ *
   * Event dispatch
   * ------------------------------------------------------------------ */

  function onEvent(evt) {
    if (!evt || typeof evt !== 'object') return;
    try {
      switch (evt.type) {
        case 'stage':
          onStage(evt);
          break;
        case 'attempt':
          onAttempt(evt);
          break;
        case 'provider':
          renderProviders(evt.providers);
          break;
        case 'usage':
          onUsage(evt);
          break;
        case 'log':
          /* Every log line carries the id of the request that produced it, and
           * the first line of a request arrives before its first stage - which
           * makes this the point at which one request's rows end and the next
           * one's begin. */
          noteRequest(pick(evt.fields, ['request_id', 'requestId'], ''));
          appendLog(evt);
          break;
        case 'done':
          onDone(evt);
          break;
        case 'error':
          onError(evt);
          break;
        default:
          break;
      }
    } catch (err) {
      /* Never let a rendering fault propagate back into the pipeline. */
      console.error('[llm-gateway demo] failed to render event', evt, err);
    }
  }

  function onUsage(evt) {
    if (state.run) {
      state.run.usage = {
        promptTokens: num(evt.promptTokens, 0),
        completionTokens: num(evt.completionTokens, 0),
        costUsd: num(evt.costUsd, 0),
        cached: !!evt.cached
      };
      state.run.cached = !!evt.cached;
    }
    renderStats();
  }

  /* A normal completion reads as "ok"; anything else keeps the finish reason
   * the pipeline actually reported (tool_calls, length, content_filter). */
  function outcomeLabel(response) {
    var reason = String(pick(response, ['finish_reason', 'finishReason'], '') || '');
    return !reason || reason === 'stop' ? 'ok' : reason;
  }

  function ledgerFromRun(response) {
    var run = state.run || {};
    var usage = run.usage;
    var tokens = usage
      ? usage.promptTokens + usage.completionTokens
      : num(
          pick(pick(response, ['usage'], {}), ['total_tokens', 'totalTokens'], 0),
          0
        );
    var cost = usage ? usage.costUsd : num(pick(response, ['cost_usd', 'costUsd'], 0), 0);
    var cached = usage ? usage.cached : !!pick(response, ['cached'], false);

    return {
      time: clockTime(),
      model: pick(response, ['model'], run.model || ''),
      provider: pick(response, ['provider'], run.provider || ''),
      tokens: fmtInt(tokens),
      cost: fmtUsd(cost),
      cached: cached,
      outcome: outcomeLabel(response),
      failed: false
    };
  }

  function onDone(evt) {
    var response = evt.response;
    renderResponse(response);
    if (state.run && !state.run.ledgerDone) {
      state.run.ledgerDone = true;
      appendLedgerRow(ledgerFromRun(response));
    }
    renderStats();
    refreshProviders();
  }

  function errorBody(err) {
    var body = { code: 'gateway_error', detail: 'The request failed.' };
    if (err && typeof err === 'object') {
      if (err.code) body.code = String(err.code);
      if (err.detail) body.detail = String(err.detail);
      else if (err.message) body.detail = String(err.message);
      if (isNum(err.status)) body.status = err.status;
      var requestId = pick(err, ['requestId', 'request_id'], '');
      if (requestId) body.requestId = String(requestId);
      var retryAfter = pick(err, ['retryAfterMs', 'retry_after_ms'], null);
      if (isNum(retryAfter)) body.retryAfterMs = retryAfter;
    } else if (err != null) {
      body.detail = String(err);
    }
    return body;
  }

  /* The gateway answers a failure with an RFC 7807 problem document, so the
   * response panel shows one. Only fields the engine actually reported are
   * included, renamed to the snake_case the success body already uses. */
  function problemDocument(body) {
    var problem = { status: num(body.status, 502), code: body.code, detail: body.detail };
    if (body.requestId) problem.instance = body.requestId;
    if (isNum(body.retryAfterMs)) problem.retry_after_ms = body.retryAfterMs;
    return problem;
  }

  function onError(evt) {
    var body = errorBody(evt);
    var code = body.code;
    var detail = body.detail;

    renderResponse(problemDocument(body));
    setStatus('Request refused: ' + code + ' — ' + detail, 'bad');

    /* Make the failure legible in the pipeline even if the engine did not close
     * the last stage, and record it in the ledger like any other outcome. */
    onStage({ id: 'failed', name: 'Request failed', status: 'fail', detail: code + ': ' + detail });

    if (state.run && !state.run.ledgerDone) {
      state.run.ledgerDone = true;
      var run = state.run;
      var usage = run.usage;
      appendLedgerRow({
        time: clockTime(),
        model: run.model || '',
        provider: run.provider || '',
        tokens: fmtInt(usage ? usage.promptTokens + usage.completionTokens : 0),
        cost: fmtUsd(usage ? usage.costUsd : 0),
        cached: false,
        outcome: code,
        failed: true
      });
    }
    renderStats();
    refreshProviders();
  }

  /* ------------------------------------------------------------------ *
   * Running requests
   * ------------------------------------------------------------------ */

  /* Status lines read as "<scenario> — <what is happening>" during a scenario,
   * and as a plain sentence for a hand-driven send. */
  function announce(sentence, tone) {
    var label = state.plan.label;
    setStatus(
      label ? label + ' — ' + sentence : sentence.charAt(0).toUpperCase() + sentence.slice(1),
      tone
    );
  }

  /* Open a fresh bucket for one request: its own stage rows, its own attempt
   * and usage tallies, its own ledger line. */
  function openRun(requestId, opts) {
    state.runSeq += 1;
    state.stages.clear();
    state.currentStageKey = null;
    state.run = {
      seq: state.runSeq,
      requestId: requestId || '',
      model: (opts && opts.model) || (state.run && state.run.model) || '',
      provider: '',
      attempts: 0,
      stageCount: 0,
      usage: null,
      cached: false,
      ledgerDone: false
    };
    state.plan.index += 1;
    if (state.plan.total > 1) {
      appendRunMarker(state.plan.index, state.plan.total);
      announce('request ' + state.plan.index + ' of ' + state.plan.total, 'info');
    }
  }

  /* Requests are attributed by the id the engine stamps on every log line
   * rather than by when send() was called. A burst is issued without awaiting -
   * so the rate limiter judges the calls as one burst - but the engine still
   * runs them one at a time, and this is what keeps each one's stages, tokens
   * and ledger row in its own bucket. */
  function noteRequest(requestId) {
    if (!requestId || !state.run) return;
    if (state.run.requestId === requestId) return;
    if (!state.run.requestId && !state.run.stageCount) {
      state.run.requestId = requestId;
      return;
    }
    openRun(requestId, null);
  }

  function sendOnce(opts) {
    try {
      return Promise.resolve(state.engine.send(opts));
    } catch (err) {
      /* A synchronous throw from send() must still land in the rejection path,
       * or the run never settles and the controls stay disabled. */
      return Promise.reject(err);
    }
  }

  function settleRequest(err) {
    /* An engine that rejects without emitting an 'error' event still has to
     * produce a visible failure and a ledger line. */
    if (err && state.run && !state.run.ledgerDone) onError(errorBody(err));
  }

  /* One user action. `runs` and `burst` come from the scenario definition: the
   * engine decides how many requests its own point needs, and whether they have
   * to arrive together. */
  function run(opts, meta) {
    if (state.busy || !state.ready) return Promise.resolve();
    var settings = meta || {};
    var total = Math.max(1, Math.min(Math.round(num(settings.runs, 1)), MAX_RUNS));
    var label = settings.label || null;

    setBusy(true);
    clearPipeline();
    state.plan = { total: total, index: 0, label: label };
    openRun(null, opts);

    var failures = 0;
    var finished = 0;

    function record(err) {
      finished += 1;
      if (err) failures += 1;
      settleRequest(err);
    }

    var work;
    if (settings.burst) {
      /* Fire them all now: the engine stamps arrival at call time, which is the
       * only way the token bucket sees a burst rather than a trickle. */
      var pending = [];
      for (var i = 0; i < total; i++) {
        pending.push(
          sendOnce(opts).then(
            function () {
              record(null);
            },
            function (err) {
              record(err);
            }
          )
        );
      }
      work = Promise.all(pending);
    } else {
      work = (function next(index) {
        if (index >= total) return Promise.resolve();
        return sendOnce(opts)
          .then(
            function () {
              record(null);
            },
            function (err) {
              record(err);
            }
          )
          .then(function () {
            if (index + 1 >= total) return;
            return sleep(RUN_GAP_MS).then(function () {
              return next(index + 1);
            });
          });
      })(0);
    }

    return work
      .then(function () {
        if (failures === 0) {
          announce('completed ' + finished + (finished === 1 ? ' request.' : ' requests.'), 'ok');
        } else if (failures < finished) {
          announce(
            finished + ' requests, ' + failures + ' refused by the gateway.',
            'warn'
          );
        }
        /* A run that failed outright keeps the error line onError already set. */
      })
      .catch(function (err) {
        console.error('[llm-gateway demo] run failed', err);
        setStatus('The demo run stopped unexpectedly. See the browser console.', 'bad');
      })
      .then(function () {
        /* Always re-enable the controls: a rejected request must never leave
         * the page stuck with a disabled send button. */
        setBusy(false);
        renderStats();
        refreshProviders();
      });
  }

  function handleSend() {
    var opts = readControls();
    if (!opts.prompt) {
      opts.prompt = DEFAULT_PROMPT;
      applyControls({ prompt: DEFAULT_PROMPT });
    }
    markActiveScenario(null);
    setStatus('Sending request through the simulated pipeline.', 'info');
    return run(opts, { runs: 1 });
  }

  function runScenario(name) {
    var scenarios = window.GATEWAY_SCENARIOS || {};
    var def = scenarios[name];
    if (!def) {
      console.warn('[llm-gateway demo] unknown scenario "' + name + '"');
      setStatus('Scenario "' + name + '" is not defined; running the current controls.', 'warn');
      return handleSend();
    }

    var opts = controlsForScenario(def.controls);
    if (!opts.prompt) opts.prompt = DEFAULT_PROMPT;
    applyControls(opts);
    markActiveScenario(name);
    setStatus(def.blurb || def.label || name, 'info');
    /* `runs`, `burst` and `budgetUsd` are engine-level keys rather than page
     * controls. They stay on the options object - send() honours the budget
     * override and ignores the rest - and drive the sequencing here. */
    return run(opts, { runs: opts.runs, burst: opts.burst, label: def.label || name });
  }

  function handleReset() {
    if (state.busy) return;
    stopCooldownTicker();
    try {
      state.engine.reset();
    } catch (err) {
      console.error('[llm-gateway demo] reset() failed', err);
    }
    state.stages.clear();
    state.currentStageKey = null;
    state.run = null;
    state.runSeq = 0;
    state.plan = { total: 1, index: 0, label: null };
    PANEL_IDS.forEach(restorePanel);
    markActiveScenario(null);
    renderStats();
    refreshProviders();
    setStatus('Cache, circuit breakers, counters and ledger cleared.', 'info');
  }

  /* ------------------------------------------------------------------ *
   * Theme
   * ------------------------------------------------------------------ */

  function readStoredTheme() {
    try {
      var value = window.localStorage.getItem(THEME_KEY);
      return value === 'dark' || value === 'light' ? value : null;
    } catch (err) {
      return null;
    }
  }

  function storeTheme(theme) {
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch (err) {
      /* Private mode or file:// - the toggle still works for this page view. */
    }
  }

  function prefersDark() {
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  function applyTheme(theme) {
    var value = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', value);
    var button = document.getElementById('gw-theme');
    if (button) {
      var next = value === 'dark' ? 'light' : 'dark';
      var text = 'Switch to ' + next + ' theme';
      button.setAttribute('aria-label', text);
      button.setAttribute('title', text);
      button.setAttribute('data-theme-state', value);
      var label = button.querySelector('[data-theme-label]');
      if (label) label.textContent = next;
    }
    return value;
  }

  function setTheme(theme) {
    var value = applyTheme(theme);
    storeTheme(value);
    return value;
  }

  function initTheme() {
    applyTheme(readStoredTheme() || (prefersDark() ? 'dark' : 'light'));

    var button = document.getElementById('gw-theme');
    if (button) {
      button.addEventListener('click', function () {
        var current = document.documentElement.getAttribute('data-theme');
        setTheme(current === 'dark' ? 'light' : 'dark');
      });
    }

    if (window.matchMedia) {
      var media = window.matchMedia('(prefers-color-scheme: dark)');
      var onChange = function (evt) {
        if (!readStoredTheme()) applyTheme(evt.matches ? 'dark' : 'light');
      };
      if (media.addEventListener) media.addEventListener('change', onChange);
      else if (media.addListener) media.addListener(onChange);
    }

    /* Keep the page in step when the theme is changed in another tab. */
    window.addEventListener('storage', function (evt) {
      if (evt.key === THEME_KEY && (evt.newValue === 'dark' || evt.newValue === 'light')) {
        applyTheme(evt.newValue);
      }
    });
  }

  /* ------------------------------------------------------------------ *
   * Wiring
   * ------------------------------------------------------------------ */

  function disableControls() {
    Object.keys(CONTROL_IDS).forEach(function (key) {
      var node = document.getElementById(CONTROL_IDS[key]);
      if (node) node.disabled = true;
    });
    ['gw-send', 'gw-reset'].forEach(function (id) {
      var node = document.getElementById(id);
      if (node) node.disabled = true;
    });
    all('.gw-scenario').forEach(function (button) {
      button.disabled = true;
    });
  }

  function bindControls() {
    var send = el('gw-send');
    if (send) {
      send.addEventListener('click', function (evt) {
        evt.preventDefault();
        handleSend();
      });
    }

    var reset = el('gw-reset');
    if (reset) {
      reset.addEventListener('click', function (evt) {
        evt.preventDefault();
        handleReset();
      });
    }

    all('.gw-scenario').forEach(function (button) {
      button.addEventListener('click', function (evt) {
        evt.preventDefault();
        runScenario(button.getAttribute('data-scenario'));
      });
    });

    /* Ctrl/Cmd + Enter sends from the prompt box, as in most chat consoles. */
    var prompt = el('gw-prompt');
    if (prompt) {
      prompt.addEventListener('keydown', function (evt) {
        if (evt.key === 'Enter' && (evt.metaKey || evt.ctrlKey)) {
          evt.preventDefault();
          handleSend();
        }
      });
    }

    /* A form wrapper must not navigate away on submit. */
    var form = send && send.form;
    if (form) {
      form.addEventListener('submit', function (evt) {
        evt.preventDefault();
        handleSend();
      });
    }
  }

  function init() {
    initTheme();
    snapshotPanels();

    if (typeof window.GatewayEngine !== 'function') {
      console.error('[llm-gateway demo] window.GatewayEngine is missing - engine.js did not load.');
      setStatus('The demo engine did not load. Reload the page to try again.', 'bad');
      disableControls();
      return;
    }

    try {
      state.engine = new window.GatewayEngine({ onEvent: onEvent });
    } catch (err) {
      console.error('[llm-gateway demo] could not construct GatewayEngine', err);
      setStatus('The demo engine failed to start. See the browser console.', 'bad');
      disableControls();
      return;
    }

    state.ready = true;
    state.defaults = readControls();
    bindControls();
    renderStats();
    refreshProviders();
    setStatus('Ready. Pick a scenario, or edit the controls and send a request.', 'info');
  }

  window.GatewayDemo = {
    version: VERSION,
    escapeHtml: escapeHtml,
    send: handleSend,
    runScenario: runScenario,
    reset: handleReset,
    setTheme: setTheme,
    get engine() {
      return state.engine;
    },
    get busy() {
      return state.busy;
    },
    get reducedMotion() {
      return reducedMotion();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
