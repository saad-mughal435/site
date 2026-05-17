/* kb.js - Knowledge base for Sanad.
   Sidebar category list, main article view rendered from markdown,
   helpful-vote widget, AI actions (Generate FAQ / Suggest improvements
   / Translate) gated behind an admin-only flag. Routes via hash:
   #/ → list all, #/category/{id} → filter, #/article/{slug} → view. */
(function () {
  'use strict';
  var esc = SanadApp.escapeHtml;
  var $ = function (id) { return document.getElementById(id); };

  // Treat the demo viewer as admin so AI actions show. In a real product
  // you'd gate on a real auth flag.
  var IS_ADMIN = true;

  var state = { q: '', cats: [], arts: [], curCat: null, curArt: null };

  function loadAll() {
    return Promise.all([SanadApp.api('/categories'), SanadApp.api('/articles')]).then(function (rs) {
      state.cats = rs[0].body.items;
      state.arts = rs[1].body.items;
    });
  }
  function renderSide() {
    var html = '<div class="snd-kb-side-head">📚 Help center</div>';
    html += '<a class="snd-kb-cat-link' + (!state.curCat ? ' active' : '') + '" href="#/">All articles</a>';
    state.cats.forEach(function (c) {
      var count = state.arts.filter(function (a) { return a.category_id === c.id; }).length;
      html += '<a class="snd-kb-cat-link' + (state.curCat === c.id ? ' active' : '') + '" href="#/category/' + c.id + '">' + (c.icon || '📄') + ' ' + esc(c.name) + ' <span style="color:var(--snd-muted-light);font-size:11.5px;">(' + count + ')</span></a>';
    });
    $('kb-side').innerHTML = html;
  }

  function renderList() {
    var rows = state.arts.slice();
    if (state.curCat) rows = rows.filter(function (a) { return a.category_id === state.curCat; });
    if (state.q) {
      var q = state.q.toLowerCase();
      rows = rows.filter(function (a) { return (a.title + ' ' + a.body_md).toLowerCase().indexOf(q) !== -1; });
    }
    var cat = state.curCat ? state.cats.find(function (c) { return c.id === state.curCat; }) : null;
    var heading = cat ? esc(cat.name) : state.q ? 'Results for "' + esc(state.q) + '"' : 'All articles';
    var html = '<h1>' + heading + '</h1>'
      + '<p class="snd-text-muted">' + rows.length + ' article' + (rows.length === 1 ? '' : 's') + (cat ? ' in ' + esc(cat.name) : '') + '</p>'
      + '<div style="margin-top:24px;display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));">'
      + (rows.length ? rows.map(function (a) {
          var cat2 = state.cats.find(function (c) { return c.id === a.category_id; });
          return '<a href="#/article/' + a.slug + '" class="snd-card" style="text-decoration:none;display:block;transition:transform .12s ease;">'
            + '<div style="font-size:11px;color:var(--snd-muted-light);text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin-bottom:6px;">' + (cat2 ? esc(cat2.name) : '') + '</div>'
            + '<div style="font-weight:700;color:var(--snd-card-ink);font-size:15px;margin-bottom:6px;">' + esc(a.title) + '</div>'
            + '<div style="font-size:12.5px;color:var(--snd-muted-light);">' + a.views + ' views · ' + (a.helpful_up - a.helpful_down) + ' helpful</div>'
            + '</a>';
        }).join('') : '<div class="snd-empty"><div class="snd-empty-mark">🔍</div>No articles match.</div>')
      + '</div>';
    $('kb-main').innerHTML = html;
  }

  function renderArticle(slug) {
    var art = state.arts.find(function (a) { return a.slug === slug || a.id === slug; });
    if (!art) { $('kb-main').innerHTML = '<div class="snd-empty"><div class="snd-empty-mark">📄</div>Article not found.</div>'; return; }
    var cat = state.cats.find(function (c) { return c.id === art.category_id; });
    var html = '<a href="#/' + (cat ? 'category/' + cat.id : '') + '" style="font-size:13px;">← Back</a>'
      + '<article class="snd-kb-article" style="margin-top:14px;">'
      +   '<h1>' + esc(art.title) + '</h1>'
      +   '<div class="snd-kb-article-meta">' + (cat ? esc(cat.name) + ' · ' : '') + 'Published ' + SanadApp.fmtDate(art.published_at) + ' · ' + art.views + ' views</div>'
      +   SanadApp.md(art.body_md)
      +   '<div class="snd-helpful">'
      +     '<span>Was this article helpful?</span>'
      +     '<button class="snd-btn snd-btn--sm" data-vote="up">👍 ' + art.helpful_up + '</button>'
      +     '<button class="snd-btn snd-btn--sm" data-vote="down">👎 ' + art.helpful_down + '</button>'
      +   '</div>'
      + '</article>';

    if (IS_ADMIN) {
      html += '<div class="snd-card snd-mt-3" style="background:linear-gradient(135deg,rgba(139,92,246,.04),rgba(52,211,153,.04));border-color:rgba(139,92,246,.25);">'
        + '<h3 style="margin-bottom:6px;">✦ AI actions</h3>'
        + '<p class="snd-text-muted" style="font-size:13px;margin:0 0 10px;">Admin-only. Generate derived content from this article using Claude (or the mock if no key is set).</p>'
        + '<div class="snd-flex">'
        +   '<button class="snd-btn snd-btn--primary" id="ai-faq">Generate FAQ</button>'
        +   '<button class="snd-btn" id="ai-improve">Suggest improvements</button>'
        +   '<button class="snd-btn" id="ai-translate">Translate to Arabic</button>'
        + '</div>'
        + '<div id="ai-result" style="margin-top:14px;"></div>'
        + '</div>';
    }
    $('kb-main').innerHTML = html;

    document.querySelectorAll('[data-vote]').forEach(function (b) {
      b.addEventListener('click', function () {
        var up = b.getAttribute('data-vote') === 'up';
        SanadApp.api('/articles/' + art.id + '/helpful', { method: 'POST', body: { up: up } }).then(function () {
          window.toast('Thanks for the feedback!', 'success');
        });
      });
    });
    if (IS_ADMIN) {
      $('ai-faq').addEventListener('click', function () {
        $('ai-result').innerHTML = '<div class="snd-empty"><div class="snd-ai-loading"></div> Generating FAQs…</div>';
        SanadAI.generateFAQ(art).then(function (r) {
          $('ai-result').innerHTML = '<h4>FAQs ' + (r.fallback ? '<span class="snd-mode-badge" style="margin-inline-start:6px;font-size:9.5px;padding:1px 8px;">mock</span>' : '') + '</h4>'
            + (r.faqs && r.faqs.length
                ? r.faqs.map(function (f) { return '<div style="margin-top:10px;"><strong>' + esc(f.q) + '</strong><br/><span style="color:var(--snd-card-ink-2);">' + esc(f.a) + '</span></div>'; }).join('')
                : '<div class="snd-text-muted">No FAQs generated.</div>');
        });
      });
      $('ai-improve').addEventListener('click', function () {
        $('ai-result').innerHTML = '<div class="snd-empty"><div class="snd-ai-loading"></div> Reading the article…</div>';
        // We don't have a dedicated method, so we ask the kb_answer feature for improvements
        SanadAI.kbAnswer({ question: 'Suggest 3 concrete improvements to make this article clearer and more useful: "' + art.title + '"\n\n' + art.body_md }).then(function (r) {
          $('ai-result').innerHTML = '<h4>Suggested improvements ' + (r.fallback ? '<span class="snd-mode-badge" style="margin-inline-start:6px;font-size:9.5px;padding:1px 8px;">mock</span>' : '') + '</h4>'
            + '<div style="white-space:pre-wrap;color:var(--snd-card-ink-2);font-size:14px;">' + esc(r.text) + '</div>';
        });
      });
      $('ai-translate').addEventListener('click', function () {
        $('ai-result').innerHTML = '<div class="snd-empty"><div class="snd-ai-loading"></div> Translating…</div>';
        SanadAI.translate(art.body_md, 'ar').then(function (r) {
          $('ai-result').innerHTML = '<h4>Arabic translation ' + (r.fallback ? '<span class="snd-mode-badge" style="margin-inline-start:6px;font-size:9.5px;padding:1px 8px;">mock</span>' : '') + '</h4>'
            + '<div style="white-space:pre-wrap;direction:rtl;text-align:right;color:var(--snd-card-ink-2);font-size:14px;">' + esc(r.translated) + '</div>';
        });
      });
    }
  }

  // ---------- Router ----------
  function route() {
    var h = location.hash || '#/';
    var slugMatch = h.match(/^#\/article\/(.+)$/);
    var catMatch = h.match(/^#\/category\/(.+)$/);
    if (slugMatch) {
      state.curArt = slugMatch[1]; state.curCat = null;
      renderSide(); renderArticle(state.curArt);
    } else if (catMatch) {
      state.curCat = catMatch[1]; state.curArt = null;
      renderSide(); renderList();
    } else {
      state.curCat = null; state.curArt = null;
      renderSide(); renderList();
    }
  }

  // ---------- Init ----------
  $('kb-search').addEventListener('input', function (e) {
    state.q = e.target.value;
    if (state.curArt) { location.hash = '#/'; return; }
    clearTimeout(window.__kbS);
    window.__kbS = setTimeout(renderList, 200);
  });
  window.addEventListener('hashchange', route);
  loadAll().then(route);
})();
