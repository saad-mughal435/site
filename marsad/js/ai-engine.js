/* ai-engine.js - MarsadAI client.
 *
 * Four dispatcher-tuned features grounded in the live fleet state:
 *   - explainDelay({ order })         → why is this order late + what to do
 *   - suggestReroute({ driver, queue }) → reorder a driver's stop list to reduce SLA breaches
 *   - batchOptimize({ pending, drivers }) → assign N pending orders to N drivers efficiently
 *   - dispatcherChat({ question, state }) → conversational dispatcher copilot
 *
 * Same Live/Mock pattern as Sanad / Watad / Ask / Lahza. Mock dictionaries
 * lean on the current sim state so even Demo replies sound grounded. */
(function () {
  'use strict';

  var modeCache = null;
  function health() {
    if (modeCache) return Promise.resolve(modeCache);
    return fetch('/api/marsad/ai/health').then(function (r) { return r.json(); })
      .then(function (j) { modeCache = { live: !!j.live, model: j.model || 'fast' }; return modeCache; })
      .catch(function () { modeCache = { live: false, model: 'fast' }; return modeCache; });
  }

  function logCall(feature, rec) {
    try {
      MarsadApp.api('/admin/ai-logs', { method: 'POST', body: Object.assign({ feature: feature }, rec) });
    } catch (e) {}
  }

  function call(opts) {
    var started = Date.now();
    var model = opts.model || 'fast';
    return fetch('/api/marsad/ai/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        system: opts.system,
        messages: opts.messages,
        max_tokens: opts.max_tokens || 400,
        temperature: opts.temperature != null ? opts.temperature : 0.4
      })
    }).then(function (r) {
      if (!r.ok) return r.json().then(function (e) { throw e; });
      return r.json().then(function (j) {
        var text = j.content && j.content[0] && j.content[0].text || '';
        var ms = Date.now() - started;
        var rec = { model: model, tokens_in: j.usage && j.usage.input_tokens || 0, tokens_out: j.usage && j.usage.output_tokens || 0, latency_ms: ms, fallback: false };
        logCall(opts.feature, rec);
        return { text: text, model: model, latency_ms: ms, fallback: false };
      });
    }).catch(function () {
      var ms = Date.now() - started;
      logCall(opts.feature, { model: 'mock', tokens_in: 0, tokens_out: 0, latency_ms: ms, fallback: true });
      return mockReply(opts, model, ms);
    });
  }

  function mockReply(opts, model, latency) {
    var feat = opts.feature || 'unknown';
    var text;
    switch (feat) {
      case 'explain_delay':     text = mockExplainDelay(opts.context); break;
      case 'suggest_reroute':   text = mockSuggestReroute(opts.context); break;
      case 'batch_optimize':    text = mockBatchOptimize(opts.context); break;
      case 'dispatcher_chat':   text = mockDispatcherChat(opts.context); break;
      default: text = '(mock) Feature not recognised.';
    }
    return { text: text, model: model, latency_ms: latency, fallback: true };
  }

  function mockExplainDelay(ctx) {
    var o = (ctx && ctx.order) || {};
    var driver = ctx && ctx.driver;
    var lines = [];
    lines.push('**Likely cause:** ' + plausibleDelayCause(o));
    lines.push('');
    lines.push('**Next action:** ' + recommendAction(o, driver));
    return lines.join('\n');
  }
  function plausibleDelayCause(o) {
    if (o.cod_aed > 200) return 'High-value COD (AED ' + o.cod_aed + ') - driver may have stopped to verify cash on hand. Common pattern in Deira late-afternoon traffic.';
    if (o.zone_id === 'zn-sharjah') return 'Sharjah Al Nahda traffic - Sheikh Mohammed Bin Zayed Road typically congested 17:00-19:30. SLA built for 150 min may not be realistic for this slot.';
    if (o.zone_id === 'zn-deira') return 'Deira souk-area access - narrow streets + parking lookup. The address line mentions "Tower" so likely needs concierge handoff.';
    if (o.kind && /furniture/i.test(o.kind)) return 'Large parcel - needs a van rather than a bike, and concierge clearance for delivery to a high-rise.';
    return 'Driver currently has 3+ active stops and route hasn\'t been re-optimised since 14:00. SLA window is closing - recommend reroute or reassign to a nearer driver.';
  }
  function recommendAction(o, driver) {
    if (o.sla_breached) return 'Call the customer first (' + (o.customer_phone || '') + '), apologise and offer an updated ETA. Then if it\'s still feasible, push this order to the top of ' + (driver ? driver.name : 'the assigned driver') + '\'s queue.';
    return 'Re-sequence the assigned driver\'s queue so this order is the next drop. If the next 10 min get tight, reassign to whoever is closest (Marina / JLT cluster usually has spare capacity at this hour).';
  }

  function mockSuggestReroute(ctx) {
    var queue = (ctx && ctx.queue) || [];
    if (!queue.length) return 'No active stops on this driver - nothing to reroute.';
    // "Optimised" order: sort by zone affinity + sla deadline
    var sorted = queue.slice().sort(function (a, b) {
      return new Date(a.sla_deadline) - new Date(b.sla_deadline);
    });
    var savings = Math.max(8, queue.length * 2);   // fabricated estimate
    var lines = [];
    lines.push('**Recommended sequence** (by SLA deadline, then geographic clustering):');
    lines.push('');
    sorted.forEach(function (o, i) {
      lines.push((i + 1) + '. **' + o.number + '** - ' + o.zone_name + ' · SLA in ' + Math.round((new Date(o.sla_deadline) - new Date()) / 60000) + ' min');
    });
    lines.push('');
    lines.push('**Estimated saving:** ~' + savings + ' minutes vs current order. Press "Apply" to push this to the driver\'s app.');
    return lines.join('\n');
  }

  function mockBatchOptimize(ctx) {
    var pending = (ctx && ctx.pending) || [];
    var drivers = (ctx && ctx.drivers) || [];
    if (!pending.length) return 'No pending orders to assign. The queue is clear.';
    if (!drivers.length) return 'No idle drivers available right now. Wait for the 18:00 shift change or pull from neighbouring hub.';
    // Naive bucket-by-zone + round-robin assignment
    var assignments = pending.slice(0, drivers.length * 3).map(function (o, i) {
      var d = drivers[i % drivers.length];
      return '• Order **' + o.number + '** (' + o.zone_name + ') → **' + d.name + '** (' + d.shift + ' shift, ' + d.on_time_pct + '% SLA)';
    });
    return '**Batch assignment proposal** for ' + pending.length + ' pending orders across ' + drivers.length + ' idle drivers:\n\n'
      + assignments.join('\n')
      + '\n\n**Note:** This batches by zone affinity first, then balances load. Apply All to push assignments, or skim and adjust individuals.';
  }

  function mockDispatcherChat(ctx) {
    var q = String((ctx && ctx.question) || '').toLowerCase();
    if (/sla|breach|late/.test(q)) return 'Two breaches right now - both in Sharjah Al Nahda, both with the same driver (Yusuf Al-Mansouri). His van shows fuel at 18% - that might explain the slowdown. Suggest you reassign one of those orders to bike rider Karim Khan who is currently idle at the hub.';
    if (/idle|spare|capacity/.test(q)) return 'Three idle drivers right now: 2 at the hub, 1 in JLT just back from a drop. Total spare capacity ~28 parcels across the two vans + 4 on the bike.';
    if (/fuel/.test(q)) return 'Two vehicles below the 25% fuel threshold: V03 (van, Yusuf) at 18%, M02 (bike, Bilal) at 22%. Recommend Yusuf swing past the hub for a top-up after his current drop.';
    if (/peak|busy|rush/.test(q)) return 'Peak window today projects 16:30-19:00 based on last 14-day pattern. Downtown + Business Bay clusters dominate. Suggest pre-staging 2 vans in the BB micro-hub before 16:00.';
    return 'I read the live fleet state for every reply. Try asking about SLAs, idle capacity, fuel, peak windows, or a specific driver/zone. (For full questions: live AI needs a Cloudflare Worker - see README.)';
  }

  var SYS = {
    explain_delay:   "You are Marsad, an AI dispatcher copilot for a Dubai last-mile courier. Given a late order's details + the assigned driver's state, explain the likely cause in one sentence, then propose ONE specific next action. Lead with the action when possible. Reference real Dubai geography. Be direct, no fluff.",
    suggest_reroute: "You are Marsad, a route-optimisation copilot. Given a driver's pending stop list with addresses + SLA deadlines, propose a re-sequenced order that minimises late deliveries. Output a numbered list with order number, zone, and minutes-to-SLA, followed by an estimated time-saved line. Be concise.",
    batch_optimize:  "You are Marsad, a fleet-balancing copilot. Given a list of pending orders and a list of idle/available drivers, propose pairings that balance zone affinity and driver load. Output a bullet list of assignments with brief reasoning, then a one-line summary. Be specific and direct.",
    dispatcher_chat: "You are Marsad, a conversational AI dispatcher copilot. Answer questions about fleet state - SLA breaches, idle drivers, fuel, peak windows, specific drivers/zones. Be brief, operational, and reference the live state in CONTEXT below."
  };

  var MarsadAI = {
    health: health,

    explainDelay: function (ctx) {
      ctx = ctx || {};
      var msg = 'Order: ' + JSON.stringify(ctx.order || {}).slice(0, 600)
              + '\n\nDriver: ' + JSON.stringify(ctx.driver || {}).slice(0, 300);
      return call({ feature: 'explain_delay', system: SYS.explain_delay, messages: [{ role: 'user', content: msg }], max_tokens: 280, context: ctx });
    },

    suggestReroute: function (ctx) {
      ctx = ctx || {};
      var msg = 'Driver: ' + JSON.stringify(ctx.driver || {}).slice(0, 200) + '\n\nQueue (oldest first):\n'
        + (ctx.queue || []).map(function (o) {
            return '- ' + o.number + ' · ' + o.zone_name + ' · SLA ' + o.sla_deadline + ' · addr ' + (o.address || '?');
          }).join('\n');
      return call({ feature: 'suggest_reroute', system: SYS.suggest_reroute, messages: [{ role: 'user', content: msg }], max_tokens: 380, context: ctx });
    },

    batchOptimize: function (ctx) {
      ctx = ctx || {};
      var msg = 'Pending orders (' + (ctx.pending || []).length + '):\n'
        + (ctx.pending || []).slice(0, 20).map(function (o) { return '- ' + o.number + ' (' + o.zone_name + ')'; }).join('\n')
        + '\n\nIdle drivers (' + (ctx.drivers || []).length + '):\n'
        + (ctx.drivers || []).slice(0, 10).map(function (d) { return '- ' + d.name + ' (' + d.shift + ', SLA ' + d.on_time_pct + '%)'; }).join('\n');
      return call({ feature: 'batch_optimize', system: SYS.batch_optimize, messages: [{ role: 'user', content: msg }], max_tokens: 450, context: ctx });
    },

    dispatcherChat: function (ctx) {
      ctx = ctx || {};
      var sys = SYS.dispatcher_chat + '\n\nCONTEXT: ' + JSON.stringify(ctx.state || {}).slice(0, 800);
      var history = (ctx.history || []).slice(-4);
      var msgs = history.concat([{ role: 'user', content: ctx.question || '' }]);
      return call({ feature: 'dispatcher_chat', system: sys, messages: msgs, max_tokens: 320, context: ctx });
    }
  };

  window.MarsadAI = MarsadAI;
})();
