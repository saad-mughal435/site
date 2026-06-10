/* ai-engine.js - The Watad AI client.
 * Lifted from sanad/js/ai-engine.js, renamed SanadAI → WatadAI, with three
 * BMS-specialised feature cases: explain_alarm, suggest_maintenance,
 * optimize_setpoints. Same Live/Mock pattern - calls Cloudflare Worker proxy
 * at /api/watad/ai/* when configured, falls back to a deterministic mock
 * dictionary otherwise. Re-uses the same LLM_API_KEY secret as Sanad.
 *
 * Every call is logged to /watad/api/admin/ai-logs (which writes to
 * localStorage) so the admin analytics tab can track usage + cost +
 * fallback rate.
 */
(function () {
  'use strict';

  var modeCache = null;
  function health() {
    if (modeCache) return Promise.resolve(modeCache);
    return fetch('/api/watad/ai/health').then(function (r) { return r.json(); })
      .then(function (j) { modeCache = { live: !!j.live, model: j.model || 'fast' }; return modeCache; })
      .catch(function () { modeCache = { live: false, model: 'fast' }; return modeCache; });
  }

  function logCall(feature, payload) {
    return WatadApp.api('/admin/ai-logs', { method: 'POST', body: payload }).catch(function () {});
  }
  function settings() {
    return WatadApp.api('/admin/settings').then(function (r) { return (r.body && r.body.settings) || {}; });
  }

  function call(opts) {
    var started = Date.now();
    return settings().then(function (s) {
      var model = opts.model || s.model || 'fast';
      var payload = {
        model: model,
        system: opts.system,
        messages: opts.messages,
        max_tokens: opts.max_tokens || s.max_tokens || 600,
        temperature: s.temperature != null ? s.temperature : 0.4
      };
      return fetch('/api/watad/ai/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (r) {
        if (!r.ok) return r.json().then(function (e) { throw e; });
        return r.json().then(function (j) {
          var text = j.content && j.content[0] && j.content[0].text || '';
          var ms = Date.now() - started;
          var rec = { feature: opts.feature, model: model, tokens_in: (j.usage && j.usage.input_tokens) || 0, tokens_out: (j.usage && j.usage.output_tokens) || 0, latency_ms: ms, fallback: false };
          rec.cost_usd = +((rec.tokens_in * 0.0000008) + (rec.tokens_out * 0.000004)).toFixed(5);
          logCall(opts.feature, rec);
          return { text: text, model: model, latency_ms: ms, fallback: false, usage: j.usage };
        });
      }).catch(function () {
        var ms = Date.now() - started;
        logCall(opts.feature, { feature: opts.feature, model: model, tokens_in: 0, tokens_out: 0, latency_ms: ms, fallback: true, cost_usd: 0 });
        return mockReply(opts, model, ms);
      });
    });
  }

  function mockReply(opts, model, latency_ms) {
    var feat = opts.feature || 'unknown';
    var text = '';
    switch (feat) {
      case 'explain_alarm':       text = mockExplainAlarm(opts.context); break;
      case 'suggest_maintenance': text = mockSuggestMaintenance(opts.context); break;
      case 'optimize_setpoints':  text = mockOptimizeSetpoints(opts.context); break;
      default:                    text = '(mock) Feature not recognised in mock mode.';
    }
    return { text: text, model: model, latency_ms: latency_ms, fallback: true };
  }

  // ===================== Mock dictionaries =====================
  function mockExplainAlarm(ctx) {
    var a = (ctx && ctx.alarm) || {};
    var asset = (ctx && ctx.asset) || {};
    var t = (a.title || '').toLowerCase();
    if (/condenser.*temp.*(high|critical|94|95)/.test(t) || /cond_temp/.test(a.point_id || '')) {
      return "**Action:** Dispatch a technician to CH-1 within the hour to confirm condenser-water flow and basin condition.\n\n**Likely cause:** Condenser-side approach has widened - most often refrigerant overcharge, condenser-coil fouling, or low CT basin level reducing heat rejection. Cross-check CT-1 fan VFD speed and basin temp. If both look normal, prioritise the chiller-side: schedule an oil-sample analysis and check for non-condensables.";
    }
    if (/filter.*(dp|delta)/.test(t) || /filter_dp/.test(a.point_id || '')) {
      return "**Action:** Schedule pre-filter replacement on " + (asset.name || 'this AHU') + " within the next 24-48 hours.\n\n**Likely cause:** Pre-filter loading has crossed 1.5 inWC ΔP - expected at this service interval. Replace MERV-13 cartridges (typically 4 panels per bank), log baseline ΔP after, and update the asset's PM-next-due date.";
    }
    if (/co2/.test(t) || /co2/.test(a.point_id || '')) {
      return "**Action:** Confirm the OA damper on the serving AHU is modulating to its high-occupancy demand setpoint, and bump the FCU valve out of dead-band.\n\n**Likely cause:** Demand-controlled ventilation isn't responding to the occupied load. Check the AHU's OA setpoint vs the zone CO₂ reset, and verify the FCU isn't satisfied (zone-temp at setpoint but ventilation undersupplied).";
    }
    if (/zone.*temp/.test(t) || /zone_temp/.test(a.point_id || '')) {
      return "**Action:** Send a tech to inspect the FCU coil and valve actuator on " + (asset.name || 'this zone') + ".\n\n**Likely cause:** Zone temp drifting 6°F+ above setpoint usually means a stuck valve actuator, blocked filter on the FCU, or a CHW supply issue at the riser. Start by manually stroking the valve and verifying CHWS at the floor.";
    }
    if (/power factor|pf/.test(t)) {
      return "**Action:** No immediate equipment risk - schedule a power-factor correction review with the electrical contractor.\n\n**Likely cause:** Reactive load has increased, dragging PF below 0.85. Common drivers are unloaded motors or lighting drivers at low dim levels. Consider sizing a small capacitor bank or VFD review.";
    }
    if (/basin.*temp/.test(t) || /basin_temp/.test(a.point_id || '')) {
      return "**Action:** Critical - investigate CT-1 immediately. Reduce chiller load if possible while diagnosing.\n\n**Likely cause:** Basin > 90°F suggests fan failure, scale on fill, or low water flow over the deck. Inspect the VFD/contactor first, then verify spray nozzles aren't fouled.";
    }
    if (/trip|fault.*code|f12/.test(t)) {
      return "**Action:** Bring CH-1 online to cover load. Lock-out CH-2 and pull the fault history from the Trane controller.\n\n**Likely cause:** Fault code F12 on a Trane RTAC typically maps to a high-pressure cutout. Check head-pressure trends 10 minutes prior to trip, condenser water quality, and the discharge-line filter for debris.";
    }
    return "**Action:** Acknowledge and dispatch a Tier-2 technician to inspect on site within the SLA window.\n\n**Likely cause:** Insufficient telemetry context here to localise the root cause. Pull the last 60 minutes of trend on the related points and correlate with any recent setpoint changes or maintenance events.";
  }

  function mockSuggestMaintenance(ctx) {
    var asset = (ctx && ctx.asset) || {};
    var type = asset.type || 'unknown';
    if (type === 'chiller') {
      return "**Suggested preventive tasks (priority order):**\n\n1. **Annual oil-sample analysis** - High. Trane recommends 12-month interval; ours is ~13 months overdue. Schedule with vendor lab, ~AED 600.\n2. **Condenser-coil chemical clean** - Medium. The high-condenser-temp alarms in the last 30 days correlate with seasonal fouling. ~AED 2,400, 4-hour evening window.\n3. **Eddy-current tube inspection** - Low. Recommended every 5 years; due in 18 months but worth pre-booking to lock in vendor calendar.";
    }
    if (type === 'ahu') {
      return "**Suggested preventive tasks (priority order):**\n\n1. **Belt + pulley inspection** - High. Two filter ΔP alarms in 30 days suggest belt slip is masking pre-filter loading. 30 min, in-house.\n2. **Coil fin straightening + clean** - Medium. SAT delta-T has narrowed by ~1.5°F over the quarter. ~AED 800, 2-hour window.\n3. **VFD parameter re-tune** - Low. Fan VFD speed signal is noisy. 15 min during next scheduled downtime.";
    }
    if (type === 'fcu') {
      return "**Suggested preventive tasks (priority order):**\n\n1. **Valve actuator stroke test + grease** - High. Zone-temp drift > 6°F three times in 30 days. 20 min per unit.\n2. **Coil flush + filter** - Medium. Quarterly task - last done 4 months ago. 45 min.\n3. **Thermostat calibration** - Low. Compare zone sensor against handheld; offset > 1°F warrants recalibration.";
    }
    if (type === 'meter') {
      return "**Suggested preventive tasks (priority order):**\n\n1. **CT (current-transformer) verification** - Medium. Annual cross-check against a clamp meter. 30 min.\n2. **Firmware update** - Low. Schneider released 4.3 with security fixes; schedule with vendor window.";
    }
    if (type === 'light') {
      return "**Suggested preventive tasks (priority order):**\n\n1. **Driver / power-supply audit** - Medium. Look for failing drivers; replace any showing >5% flicker.\n2. **Scene + schedule re-commissioning** - Low. Re-validate occupancy + daylight setpoints quarterly.";
    }
    return "**Suggested preventive tasks:**\n\n1. **Visual inspection + cleaning** - Medium.\n2. **Calibration check against handheld reference** - Low.\n3. **Firmware/driver audit** - Low.";
  }

  function mockOptimizeSetpoints(ctx) {
    var occ = (ctx && ctx.occupancy_pct) || 60;
    var od = (ctx && ctx.outdoor_temp_f) || 92;
    var unoccupiedHint = occ < 30 ? "occupancy is low across L1/L2 - opportunity for setback" : "occupancy is normal";
    return "**Setpoint suggestions** (estimated savings vs current schedule):\n\n"
      + "1. **Bump unoccupied-zone CSP from 75°F → 78°F** during 19:00-06:00 - " + unoccupiedHint + ". Stays inside ASHRAE 55 night setback comfort window. **Est. saving: 38 kWh/day (~AED 12/day, ~AED 4,400/yr).**\n\n"
      + "2. **Pre-cool L1/L2 by 1°F from 06:00-07:00** to coast through the morning ramp at lower compressor lift. With outdoor at " + od.toFixed(0) + "°F this morning, CH-1 lift is high. **Est. saving: 22 kWh/day (~AED 7/day, ~AED 2,600/yr).**\n\n"
      + "3. **Reset CHWS from 44°F → 45°F** between 11:00-15:00 when load profile is steady. Trane curves show ~1.6% kW reduction per °F reset, with no impact on zone comfort given current ΔT margins. **Est. saving: 18 kWh/day (~AED 6/day, ~AED 2,100/yr).**\n\n"
      + "**Total annual saving: ~AED 9,100** with zero capex. I recommend implementing #1 immediately and trialling #2-#3 in a 2-week A/B against the prior month.";
  }

  // ===================== Public API =====================
  var SYS = {
    explain_alarm: "You are Watad, an AI copilot for facilities operators of a commercial smart building. Given an active alarm and the asset's recent point readings, write a concise explanation in TWO paragraphs: (1) **Action:** what the operator should do next (lead with this). (2) **Likely cause:** the most plausible root cause, citing specific point values + units. Be technically precise, action-oriented, and brief.",
    suggest_maintenance: "You are Watad, a reliability-engineering copilot. Given an asset (type + age + recent alarm history + runtime hours), propose 2-3 preventive maintenance tasks ranked by priority (High/Medium/Low). For each: a one-line description, why it matters now, and rough effort/cost estimate in AED. Be specific to the asset type (chiller, AHU, FCU, meter, lighting). Format as a numbered list with bold task names.",
    optimize_setpoints: "You are Watad, an energy-management copilot. Given the current building snapshot (occupancy %, outdoor temp, current zone setpoints, recent kW), propose 2-3 setpoint or schedule changes that reduce kWh while keeping zones inside ASHRAE 55 comfort band (typically 68-76°F). For each: the change, the estimated daily kWh + AED saving (use AED 0.32/kWh), and an A/B test recommendation. Lead with the highest-impact suggestion."
  };

  var WatadAI = {
    health: health,

    explainAlarm: function (ctx) {
      // ctx = { alarm, asset, recent_points? }
      var ctxText = '';
      try { ctxText = 'Alarm: ' + JSON.stringify(ctx.alarm) + '\n\nAsset: ' + JSON.stringify(ctx.asset); } catch (e) {}
      return call({
        feature: 'explain_alarm',
        system: SYS.explain_alarm,
        messages: [{ role: 'user', content: ctxText }],
        max_tokens: 350,
        context: ctx
      }).then(function (r) {
        return { text: r.text, model: r.model, latency_ms: r.latency_ms, fallback: r.fallback };
      });
    },

    suggestMaintenance: function (ctx) {
      // ctx = { asset, alarm_history?, runtime_hours?, install_date? }
      var ctxText = '';
      try {
        ctxText = 'Asset: ' + JSON.stringify(ctx.asset)
          + '\n\nRecent alarms (last 30d): ' + JSON.stringify((ctx.alarm_history || []).slice(0, 8))
          + '\n\nInstall date: ' + (ctx.asset && ctx.asset.install_date) + ', runtime hrs: ' + (ctx.runtime_hours || 'unknown');
      } catch (e) {}
      return call({
        feature: 'suggest_maintenance',
        system: SYS.suggest_maintenance,
        messages: [{ role: 'user', content: ctxText }],
        max_tokens: 500,
        context: ctx
      }).then(function (r) {
        return { text: r.text, model: r.model, latency_ms: r.latency_ms, fallback: r.fallback };
      });
    },

    optimizeSetpoints: function (ctx) {
      // ctx = { occupancy_pct, outdoor_temp_f, current_setpoints?, recent_kw? }
      var ctxText = '';
      try {
        ctxText = 'Building snapshot:\n'
          + '- Occupancy: ' + (ctx.occupancy_pct || 'unknown') + '%\n'
          + '- Outdoor temp: ' + (ctx.outdoor_temp_f || 'unknown') + '°F\n'
          + '- Current zone setpoints (sample): ' + JSON.stringify((ctx.current_setpoints || []).slice(0, 6)) + '\n'
          + '- Recent kW: ' + (ctx.recent_kw || 'unknown');
      } catch (e) {}
      return call({
        feature: 'optimize_setpoints',
        system: SYS.optimize_setpoints,
        messages: [{ role: 'user', content: ctxText }],
        max_tokens: 600,
        context: ctx
      }).then(function (r) {
        return { text: r.text, model: r.model, latency_ms: r.latency_ms, fallback: r.fallback };
      });
    },

    rateMessage: function (rating, context) {
      return WatadApp.api('/admin/ai-logs/rate', {
        method: 'POST',
        body: {
          rating: rating,
          feature: (context && context.feature) || 'unknown',
          model: (context && context.model) || 'unknown',
          fallback: !!(context && context.fallback),
          at: new Date().toISOString()
        }
      }).catch(function () {});
    }
  };

  window.WatadAI = WatadAI;
})();
