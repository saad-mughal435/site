/* data.js — Lahza seed.
 * Generates 14 days of fabricated journal entries from a deterministic
 * seeded RNG so a first-time visitor sees a populated mood chart, journal
 * feed, and insights view immediately — no waiting 14 days to feel "lived
 * in". Entries describe a generic Dubai-based knowledge worker's life
 * (work, gym, family, weather) — intentionally NOT Saad's actual life. */
(function () {
  'use strict';

  // Deterministic RNG so the seed is stable across page reloads but varied
  // enough to feel real. We never use Math.random() in the seed itself.
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var rand = mulberry32(20260520);
  function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }

  // Pools — fabricated, generic, no real names/places beyond Dubai context
  var PROMPTS = [
    "What surprised you today?",
    "Where did your energy go?",
    "One small win from today.",
    "Something you'd do differently.",
    "A conversation that stuck with you.",
    "What needed your attention but didn't get it?",
    "What did you notice that you usually wouldn't?",
    "A moment you wish lasted longer.",
    "What pulled you back to the present?",
    "Something you're grateful for right now.",
    "What's one decision you can make easier tomorrow?",
    "Who or what shifted your mood today?"
  ];

  var ARABIC_PROMPTS = [
    "ما الذي فاجأك اليوم؟",
    "أين ذهبت طاقتك اليوم؟",
    "إنجاز صغير اليوم.",
    "شيء كنت ستفعله بشكل مختلف.",
    "محادثة بقيت في ذهنك."
  ];

  // Body fragments, mood-aware. Each line is a short journal-style sentence.
  var BODY_BY_MOOD = {
    joyful: [
      "Closed the proposal early — felt light all afternoon.",
      "Met up with old friends near Marina. Forgot how much I miss them.",
      "Cooked properly for the first time in weeks. The mess was worth it.",
      "A small thing made the whole day work — a clean inbox at 5pm.",
      "Walked back from the office through the park. Took the long way on purpose."
    ],
    calm: [
      "Quiet morning. Coffee before the messages started.",
      "Phone stayed face down for two hours. The world managed without me.",
      "Read instead of scrolling. Shoulders unlocked by chapter three.",
      "Sat through the call without rehearsing my next line. Easier than expected.",
      "Long shower, no music, no podcast. First time in months."
    ],
    energized: [
      "Gym at 6am. Hit a new PB on the deadlift. Whole day felt downhill from there.",
      "Two hours of deep work before standup. Shipped the migration.",
      "Walked to lunch instead of getting it delivered. Sun, salt, energy.",
      "Said yes to the side project. Then mapped the first week in one sitting.",
      "Finished the gym session strong, came home, started the chapter I'd been putting off."
    ],
    tense: [
      "Deadline moved up. Spent the afternoon negotiating scope instead of writing.",
      "Two browser tabs open with conflicting feedback. Decision deferred to tomorrow.",
      "Couldn't get into flow until 4pm. The morning leaked away in meetings.",
      "Snapped at a friend over voice notes. Apologised in the evening but it sat with me.",
      "Traffic worse than usual. Got home tired before the day really started."
    ],
    low: [
      "Body wasn't with it today. Got the minimum done, then closed the laptop early.",
      "Skipped the gym. Don't know why — just couldn't get out the door.",
      "Read three messages I didn't reply to. They'll still be there tomorrow.",
      "Quiet without being restful. The kind of quiet that needs a phone call.",
      "Heavy without a reason I can point at. Going to bed early."
    ],
    neutral: [
      "Standard day. Nothing rose, nothing fell.",
      "Wrapped the week. The TODO list looks the same length as Monday.",
      "Cleaned the desk between meetings. Found three pens I'd forgotten about.",
      "Watched the sunset from the balcony for five minutes. Then back to it.",
      "Family group chat quiet for once. Took the silence as a win."
    ]
  };

  var TAG_POOL = ['work', 'gym', 'family', 'sleep', 'reading', 'travel', 'food', 'weather', 'health', 'focus', 'errands', 'rest'];

  var MOODS = ['joyful', 'calm', 'energized', 'tense', 'low', 'neutral'];

  // Bias mood distribution so weekends skew calm/energized, weekdays skew
  // tense/neutral, plus a few low days for realism.
  function moodForDayOfWeek(dow, i) {
    // dow: 0=Sun..6=Sat. Pull-toward-pool varies by day.
    var pools = {
      0: ['calm', 'joyful', 'energized', 'neutral'],         // Sun (UAE work-week start, but easing in)
      1: ['energized', 'neutral', 'tense'],                  // Mon
      2: ['tense', 'neutral', 'energized'],                  // Tue — usually hardest day
      3: ['neutral', 'tense', 'calm', 'low'],                // Wed
      4: ['calm', 'joyful', 'energized'],                    // Thu (UAE Fri-eve mood)
      5: ['calm', 'joyful', 'low'],                          // Fri (weekend)
      6: ['calm', 'joyful', 'energized', 'neutral']          // Sat
    };
    var pool = pools[dow] || MOODS;
    // 1 in ~10 entries: insert a neutral entry to prevent the chart from
    // looking suspiciously varied.
    if (i % 9 === 0) return 'neutral';
    return pool[Math.floor(rand() * pool.length)];
  }

  function generateEntries(daysBack) {
    var entries = [];
    var todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);
    for (var i = daysBack; i >= 0; i--) {
      var day = new Date(todayMidnight.getTime() - i * 86400000);
      // ~85% of days have an entry — the rest are gaps, which is realistic
      if (rand() < 0.15 && i !== 0) continue;
      var dow = day.getDay();
      var mood = moodForDayOfWeek(dow, i);
      var hour = 20 + Math.floor(rand() * 3);
      var minute = Math.floor(rand() * 60);
      var ts = new Date(day.getTime() + hour * 3600000 + minute * 60000);
      var body = pick(BODY_BY_MOOD[mood] || BODY_BY_MOOD.neutral);
      var tagCount = 1 + Math.floor(rand() * 2);
      var tags = [];
      while (tags.length < tagCount) {
        var t = pick(TAG_POOL);
        if (tags.indexOf(t) === -1) tags.push(t);
      }
      entries.push({
        id: 'e-' + ts.getTime(),
        ts: ts.toISOString(),
        date: day.toISOString().slice(0, 10),
        body: body,
        mood: mood,
        emotions: emotionsForMood(mood),
        tags: tags,
        prompt: pick(PROMPTS),
        locale: 'en'
      });
    }
    // Sort newest first
    entries.sort(function (a, b) { return new Date(b.ts) - new Date(a.ts); });
    return entries;
  }

  function emotionsForMood(mood) {
    var bank = {
      joyful:    ['gratitude', 'joy', 'connection'],
      calm:      ['ease', 'gratitude', 'contentment'],
      energized: ['drive', 'focus', 'satisfaction'],
      tense:     ['pressure', 'frustration', 'urgency'],
      low:       ['fatigue', 'sadness', 'detachment'],
      neutral:   ['neutral']
    };
    var pool = bank[mood] || bank.neutral;
    return pool.slice(0, 1 + Math.floor(rand() * 2));
  }

  // ====== Seed data ======
  var SETTINGS = {
    locale: 'en',                    // 'en' or 'ar'
    theme: 'auto',                   // 'auto' / 'dark' / 'light'
    reminder_time: '21:00',
    goal: 'Once a day, anytime',
    onboarded: false,
    model: 'claude-haiku-4-5-20251001',
    privacy_note: 'Entries are stored only in your browser. They never leave your device unless you enable Live AI mode (which sends only the active question to the Claude API via a Cloudflare Worker proxy).'
  };

  var ENTRIES = generateEntries(14);

  // ====== Expose ======
  window.LAHZA_DATA = {
    SETTINGS: SETTINGS,
    ENTRIES_SEED: ENTRIES,
    PROMPTS: PROMPTS,
    ARABIC_PROMPTS: ARABIC_PROMPTS,
    MOODS: MOODS,
    TAG_POOL: TAG_POOL,
    BODY_BY_MOOD: BODY_BY_MOOD
  };
})();
