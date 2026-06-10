/* ai-engine.js - Nabta AI Policy Assistant.
 *
 * One core feature: policyChat({ question, history }) - RAG over the
 * 6 HR policies + UAE Labour Law facts, returns a grounded answer with
 * [pol-xxx] citation chips. Same Live/Mock fallback pattern. */
(function () {
  'use strict';
  var modeCache = null;
  function health() {
    if (modeCache) return Promise.resolve(modeCache);
    return fetch('/api/nabta/ai/health').then(function (r) { return r.json(); })
      .then(function (j) { modeCache = { live: !!j.live, model: j.model || 'fast' }; return modeCache; })
      .catch(function () { modeCache = { live: false, model: 'fast' }; return modeCache; });
  }

  function retrieve(query, policies) {
    var q = String(query || '').toLowerCase();
    var tokens = q.split(/\s+/).filter(function (t) { return t.length > 2; });
    var scored = policies.map(function (p) {
      var body = (p.title + ' ' + p.body).toLowerCase();
      var hits = tokens.reduce(function (s, t) { return s + (body.indexOf(t) !== -1 ? 1 : 0); }, 0);
      return { p: p, score: hits };
    }).sort(function (a, b) { return b.score - a.score; });
    return scored.filter(function (s) { return s.score > 0; }).slice(0, 3).map(function (s) { return s.p; });
  }

  function call(opts) {
    var started = Date.now();
    var model = opts.model || 'fast';
    return fetch('/api/nabta/ai/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        system: opts.system,
        messages: opts.messages,
        max_tokens: opts.max_tokens || 350,
        temperature: opts.temperature != null ? opts.temperature : 0.3
      })
    }).then(function (r) {
      if (!r.ok) return r.json().then(function (e) { throw e; });
      return r.json().then(function (j) {
        var text = j.content && j.content[0] && j.content[0].text || '';
        return { text: text, model: model, latency_ms: Date.now() - started, fallback: false };
      });
    }).catch(function () {
      return { text: mockReply(opts), model: model, latency_ms: Date.now() - started, fallback: true };
    });
  }

  function mockReply(opts) {
    var q = String((opts && opts.context && opts.context.question) || '').toLowerCase();
    var retrieved = (opts && opts.context && opts.context.retrieved) || [];
    // Keyword-driven replies grounded in retrieved policies
    if (/leave|annual leave|sick leave|carry over/.test(q)) {
      return "Annual leave at Sila is **30 calendar days** per year, vesting monthly, with up to 15 days carryable into the next year. Sick leave is 15 days fully paid + 30 half-paid per UAE Labour Law. Submit via the Leave module - line manager + HR approval. [pol-leave]";
    }
    if (/wps|salary|payroll|pay day|sif/.test(q)) {
      return "WPS is processed via Emirates NBD on the **28th** of each month (or the last working day before). SIF file is generated on the **26th** by Finance. Bonuses run separately on the 15th of the following month. Mismatch tolerance: AED 1 per employee. [pol-wps]";
    }
    if (/visa|residency|noc|transfer/.test(q)) {
      return "Visa renewals are initiated by HR **60 days** before expiry; the AED 850 fee is covered by Finance. NOC for transfers is issued by the HR director on request. New hires on a visa transfer must serve their existing notice and arrange an entry permit before joining. [pol-visa]";
    }
    if (/gratuity|end of service|eosb|severance/.test(q)) {
      return "End-of-service gratuity follows UAE Labour Law (Federal Decree-Law No. 33 of 2021): **21 days** of basic salary per year for the first 5 years, then **30 days** per year thereafter, capped at 2 years' total salary. Calculated on basic salary only - allowances are excluded. Payable within 14 days of last working day. [pol-gratuity]";
    }
    if (/probation|new hire/.test(q)) {
      return "Probation is **6 months**. Notice during probation is 14 days from either side; after confirmation, notice rises to 30 days (60 days for managers and above). Probation can be extended once by 3 months with HR director approval. [pol-probation]";
    }
    if (/remote|hybrid|home office/.test(q)) {
      return "Default hybrid: **3 office + 2 remote** days per week. Fully remote requires VP + HR sign-off and is restricted to specific roles (engineering ICs, customer success, design). Minimum 4-hour overlap with GST. Home-office equipment expensed up to AED 2,500. [pol-remote]";
    }
    if (retrieved.length) {
      var top = retrieved[0];
      return "Looking at our **" + top.title.toLowerCase() + "** policy: " + top.body.split('.')[0] + ". [" + top.id + "] For the full details, open the linked policy or ask HR directly.";
    }
    return "I don't have a clear policy on that one in my knowledge base. Best to ask HR directly (hr@sila.demo) - they'll pull the current procedure and reply within a business day.";
  }

  var SYS_TMPL = [
    "You are Nabta, an HR policy AI assistant for Sila Trading FZ-LLC, a UAE-based company.",
    "Answer the visitor's question based on the COMPANY POLICIES below + UAE Labour Law (Federal Decree-Law No. 33 of 2021).",
    "Cite specific policies by their [pol-xxx] id at the end of any sentence that uses them.",
    "Be precise about numbers, dates, and procedures - don't generalise.",
    "If the policies are silent on the topic, say so plainly and recommend asking HR (hr@sila.demo).",
    "Keep replies under 80 words. Direct, professional voice.",
    "",
    "COMPANY POLICIES:"
  ].join('\n');

  var NabtaAI = {
    health: health,
    policyChat: function (ctx) {
      ctx = ctx || {};
      var policies = (window.NABTA_DATA && window.NABTA_DATA.POLICIES) || [];
      var retrieved = retrieve(ctx.question, policies);
      var ctxBlock = retrieved.map(function (p) { return '[' + p.id + '] ' + p.title + ': ' + p.body; }).join('\n\n');
      var sys = SYS_TMPL + '\n\n' + ctxBlock;
      var history = (ctx.history || []).slice(-4);
      var messages = history.concat([{ role: 'user', content: ctx.question || '' }]);
      return call({
        feature: 'policy_chat',
        system: sys,
        messages: messages,
        max_tokens: 320,
        context: Object.assign({ retrieved: retrieved }, ctx)
      }).then(function (r) {
        // Citations are parsed client-side from the [pol-xxx] markers in r.text
        var citedIds = [];
        String(r.text || '').replace(/\[(pol-[a-z0-9-]+)\]/g, function (mm, id) { citedIds.push(id); return ''; });
        var seen = new Set();
        var unique = citedIds.filter(function (id) { if (seen.has(id)) return false; seen.add(id); return true; });
        var citations = unique.map(function (id) {
          var p = policies.find(function (x) { return x.id === id; });
          return p ? { id: p.id, title: p.title } : null;
        }).filter(Boolean);
        return Object.assign({}, r, { citations: citations });
      });
    }
  };

  window.NabtaAI = NabtaAI;
})();
