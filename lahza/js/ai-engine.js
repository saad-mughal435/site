/* ai-engine.js — Lahza AI client.
 *
 * Same Live/Mock pattern as Sanad / Watad / Ask Saad. Four features:
 *   - suggestPrompt({ time_of_day, recent_mood, day_of_week })
 *   - detectMood({ entry_text, locale })
 *   - weeklyInsights({ entries })
 *   - coachChat({ question, history, entries })
 *
 * Live mode calls /api/lahza/ai/* on the same Cloudflare Worker that powers
 * Sanad/Watad/Ask. Mock mode runs a deterministic, mood-aware dictionary so
 * Demo mode never feels broken. */
(function () {
  'use strict';

  var modeCache = null;
  function health() {
    if (modeCache) return Promise.resolve(modeCache);
    return fetch('/api/lahza/ai/health').then(function (r) { return r.json(); })
      .then(function (j) { modeCache = { live: !!j.live, model: j.model || 'claude-haiku-4-5-20251001' }; return modeCache; })
      .catch(function () { modeCache = { live: false, model: 'claude-haiku-4-5-20251001' }; return modeCache; });
  }

  function call(opts) {
    var started = Date.now();
    var model = opts.model || 'claude-haiku-4-5-20251001';
    var payload = {
      model: model,
      system: opts.system,
      messages: opts.messages,
      max_tokens: opts.max_tokens || 350,
      temperature: opts.temperature != null ? opts.temperature : 0.5
    };
    return fetch('/api/lahza/ai/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) {
      if (!r.ok) return r.json().then(function (e) { throw e; });
      return r.json().then(function (j) {
        var text = j.content && j.content[0] && j.content[0].text || '';
        return { text: text, model: model, latency_ms: Date.now() - started, fallback: false };
      });
    }).catch(function () {
      return mockReply(opts, model, Date.now() - started);
    });
  }

  // =================== Mock dictionaries ===================
  function mockReply(opts, model, latency) {
    var feat = opts.feature || 'unknown';
    var text;
    switch (feat) {
      case 'suggestPrompt':   text = mockSuggestPrompt(opts.context); break;
      case 'detectMood':      text = mockDetectMood(opts.context); break;
      case 'weeklyInsights':  text = mockWeeklyInsights(opts.context); break;
      case 'coachChat':       text = mockCoachChat(opts.context); break;
      default: text = "(mock) Feature not recognised.";
    }
    return { text: text, model: model, latency_ms: latency, fallback: true };
  }

  function mockSuggestPrompt(ctx) {
    var c = ctx || {};
    var pools = {
      morning: ["What's one thing worth your full attention today?", "What's your energy actually pointed at this morning?", "If today went well, what would have changed?"],
      afternoon: ["What surprised you so far?", "Where did your morning leak away?", "What's the one thing left worth doing today?"],
      evening: ["What landed today? What didn't?", "Whose name keeps coming back to you?", "What's something small that worked?"],
      night: ["What can you put down before sleep?", "Name one thing today that wasn't your fault.", "What did today teach you that yesterday didn't?"]
    };
    var moodPools = {
      low:        ["Take a smaller step than usual — what's it look like?", "What helped, even slightly?"],
      tense:      ["What's one thing you can stop carrying tonight?", "Where did the pressure actually come from?"],
      joyful:     ["What made today land? Be specific.", "How can you make tomorrow rhyme with today?"],
      energized:  ["What was the cheapest source of that lift?", "Which momentum is worth protecting?"],
      calm:       ["What did you let go of, even briefly?", "Where did the quiet come from?"],
      neutral:    ["What did you notice today that you usually wouldn't?", "What's worth a second look from today?"]
    };
    var hr = (c.hour != null) ? c.hour : new Date().getHours();
    var tod = hr < 11 ? 'morning' : hr < 16 ? 'afternoon' : hr < 21 ? 'evening' : 'night';
    var pool;
    if (c.recent_mood && moodPools[c.recent_mood] && Math.random() < 0.5) pool = moodPools[c.recent_mood];
    else pool = pools[tod];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function mockDetectMood(ctx) {
    var t = String((ctx && ctx.entry_text) || '').toLowerCase();
    // Heuristic mood detection — same surface shape as a live call returns
    var mood = 'neutral', emotions = ['neutral'];
    if (/great|happy|joy|wonderful|amazing|grateful|loved|win|landed|shipped|surprised/.test(t)) {
      mood = 'joyful'; emotions = ['gratitude', 'joy'];
    } else if (/calm|quiet|peace|rest|ease|content|gentle|soft/.test(t)) {
      mood = 'calm'; emotions = ['ease', 'contentment'];
    } else if (/energy|focused|momentum|deadlift|gym|pb|drive|shipped|deep work|crushed/.test(t)) {
      mood = 'energized'; emotions = ['drive', 'focus'];
    } else if (/stress|tense|anxious|worried|pressure|deadline|frustrat|snap|argued|behind/.test(t)) {
      mood = 'tense'; emotions = ['pressure', 'frustration'];
    } else if (/tired|exhausted|low|sad|heavy|skipped|couldn'?t|drained|lonely|down/.test(t)) {
      mood = 'low'; emotions = ['fatigue', 'sadness'];
    }
    // Return a JSON-shaped string so the caller can parse it (same as Live would)
    return JSON.stringify({ mood: mood, confidence: 0.7, emotions: emotions });
  }

  function mockWeeklyInsights(ctx) {
    var entries = (ctx && ctx.entries) || [];
    if (entries.length < 3) {
      return "Not enough entries this week to spot a pattern yet. Aim for 3-4 more — the chart needs a few dots before it tells a story.";
    }
    var byMood = {};
    entries.forEach(function (e) { byMood[e.mood] = (byMood[e.mood] || 0) + 1; });
    var topMood = Object.keys(byMood).sort(function (a, b) { return byMood[b] - byMood[a]; })[0];
    var tagCounts = {};
    entries.forEach(function (e) { (e.tags || []).forEach(function (t) { tagCounts[t] = (tagCounts[t] || 0) + 1; }); });
    var topTags = Object.keys(tagCounts).sort(function (a, b) { return tagCounts[b] - tagCounts[a]; }).slice(0, 3);
    var moodPhrase = { joyful: 'an overall lift', calm: 'mostly steady', energized: 'high-momentum', tense: 'pressured', low: 'heavy', neutral: 'flat' }[topMood] || 'mixed';
    return "This week was **" + moodPhrase + "** — " + entries.length + " entries, with " + topMood + " leading the mood spread. "
      + (topTags.length ? "Recurring threads: " + topTags.map(function (t) { return '**' + t + '**'; }).join(', ') + ". " : "")
      + (byMood.low ? "There were " + byMood.low + " low day(s) — worth noticing what came before them. " : "")
      + (byMood.energized ? "The energised days look like good signal — try to spot what cheap thing reliably triggers them." : "");
  }

  function mockCoachChat(ctx) {
    var entries = (ctx && ctx.entries) || [];
    var q = String((ctx && ctx.question) || '').toLowerCase();
    if (!entries.length) {
      return "I don't have any entries yet to ground my answer in. Write one or two short entries first and I'll be useful.";
    }
    // Find 1-2 entries that touch the keywords in the question
    var qTokens = q.split(/\s+/).filter(function (t) { return t.length > 3; });
    var scored = entries.map(function (e) {
      var body = (e.body + ' ' + (e.tags || []).join(' ')).toLowerCase();
      var hits = qTokens.reduce(function (s, t) { return s + (body.indexOf(t) !== -1 ? 1 : 0); }, 0);
      return { e: e, score: hits };
    }).sort(function (a, b) { return b.score - a.score; }).slice(0, 2);
    var picks = scored.filter(function (s) { return s.score > 0; });
    if (!picks.length) {
      // No keyword match — fall back to the most recent 2 entries
      picks = entries.slice(0, 2).map(function (e) { return { e: e, score: 0 }; });
    }
    var cites = picks.map(function (s) { return '[' + s.e.id + ']'; }).join(' ');
    // Lightly question-shaped lead
    var lead = '';
    if (/why/.test(q)) lead = 'Looking at what you wrote, ';
    else if (/what.+pattern|recur|theme/.test(q)) lead = 'A theme that keeps coming up: ';
    else if (/should i|how do i/.test(q)) lead = 'Based on what you\'ve told me about yourself, ';
    var sample = picks[0].e.body.slice(0, 90);
    return lead + "you mentioned this: \"" + sample + (picks[0].e.body.length > 90 ? "…\"" : "\"") + " — that's where I'd start. " + cites + " If you want, write one sentence about what you noticed today and I'll have more to work with.";
  }

  // =================== System prompts ===================
  var SYS = {
    suggestPrompt: "You are Lahza, a personal journaling companion. Generate ONE short, specific journaling prompt (max 12 words, no quote marks, no headers). Adapt to time of day and recent mood. Avoid clichés like 'reflect on your feelings'. Direct, warm, and curious.",
    detectMood: "You are Lahza's mood detection engine. Read the journal entry and return JSON ONLY (no prose, no markdown) in this exact shape: {\"mood\":\"<one of: calm,joyful,tense,low,energized,neutral>\",\"confidence\":<0..1>,\"emotions\":[\"<1-3 specific emotions>\"]}",
    weeklyInsights: "You are Lahza, summarising the user's last 7 journal entries. Surface 1-2 recurring themes, 1 win, 1 concern. Cite specific phrases from the entries to ground the analysis. Warm, not clinical. Max 100 words. Plain prose with **bold** for the key terms.",
    coachChat: "You are Lahza's AI Coach. Answer the user's question grounded in their own journal CONTEXT below. Cite by [entry-id] at the end of any sentence that uses a specific entry. If the answer isn't in CONTEXT, say so warmly and suggest a journaling prompt instead. Max 4 sentences. Direct, warm voice — not therapist-ish.\n\nCONTEXT:"
  };

  // =================== Public API ===================
  var LahzaAI = {
    health: health,

    suggestPrompt: function (ctx) {
      ctx = ctx || {};
      var userMsg = 'Generate ONE prompt for: time=' + (ctx.hour != null ? ctx.hour : new Date().getHours())
        + ', recent_mood=' + (ctx.recent_mood || 'unknown')
        + ', day=' + (ctx.day_of_week || new Date().toLocaleDateString('en', { weekday: 'long' }));
      return call({
        feature: 'suggestPrompt',
        system: SYS.suggestPrompt,
        messages: [{ role: 'user', content: userMsg }],
        max_tokens: 40,
        temperature: 0.8,
        context: ctx
      }).then(function (r) {
        // Strip surrounding quotes if Claude adds them
        return { text: r.text.replace(/^["'`]|["'`]$/g, '').trim(), model: r.model, latency_ms: r.latency_ms, fallback: r.fallback };
      });
    },

    detectMood: function (ctx) {
      ctx = ctx || {};
      return call({
        feature: 'detectMood',
        system: SYS.detectMood,
        messages: [{ role: 'user', content: 'Entry: ' + (ctx.entry_text || '').slice(0, 1200) }],
        max_tokens: 120,
        temperature: 0.1,
        context: ctx
      }).then(function (r) {
        // Parse the JSON the model returns. Defensive: if it's not JSON,
        // fall back to neutral.
        try {
          var clean = r.text.replace(/```json|```/g, '').trim();
          var parsed = JSON.parse(clean);
          return Object.assign({ confidence: 0.6, emotions: [] }, parsed, {
            model: r.model, latency_ms: r.latency_ms, fallback: r.fallback
          });
        } catch (e) {
          return { mood: 'neutral', confidence: 0.3, emotions: ['neutral'], model: r.model, latency_ms: r.latency_ms, fallback: r.fallback };
        }
      });
    },

    weeklyInsights: function (ctx) {
      ctx = ctx || {};
      var entries = ctx.entries || [];
      var body = 'Last ' + entries.length + ' entries:\n\n' + entries.map(function (e) {
        return '[' + e.date + ' · ' + e.mood + '] ' + e.body;
      }).join('\n');
      return call({
        feature: 'weeklyInsights',
        system: SYS.weeklyInsights,
        messages: [{ role: 'user', content: body }],
        max_tokens: 250,
        temperature: 0.4,
        context: ctx
      });
    },

    coachChat: function (ctx) {
      ctx = ctx || {};
      var entries = (ctx.entries || []).slice(0, 14);
      var ctxBlock = entries.map(function (e) {
        return '[' + e.id + '] (' + e.date + ' · ' + e.mood + ') ' + e.body;
      }).join('\n\n');
      var sys = SYS.coachChat + '\n\n' + ctxBlock;
      var history = (ctx.history || []).slice(-4);
      var messages = history.concat([{ role: 'user', content: ctx.question || '' }]);
      return call({
        feature: 'coachChat',
        system: sys,
        messages: messages,
        max_tokens: 300,
        temperature: 0.6,
        context: ctx
      });
    }
  };

  window.LahzaAI = LahzaAI;
})();
