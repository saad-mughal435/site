/* admin-sections.js - Sanad admin section renderers.
   Each function on window.SanadAdmin receives a host element to paint into. */
(function () {
  'use strict';
  var esc = SanadApp.escapeHtml;
  var fmtDt = SanadApp.fmtDateTime;
  var fmtDate = SanadApp.fmtDate;

  function chip(status) {
    var labels = { open: 'Open', pending: 'Pending', snoozed: 'Snoozed', closed: 'Closed', escalated: 'Escalated' };
    return '<span class="snd-chip ' + esc(status) + '">' + esc(labels[status] || status) + '</span>';
  }
  function csvDownload(filename, rows) {
    var blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  var Admin = {};

  /* ===================================================================
     Dashboard
     =================================================================== */
  Admin.dashboard = function (host) {
    SanadApp.api('/admin/dashboard').then(function (r) {
      var d = r.body;
      var hourMax = Math.max.apply(null, d.by_hour.concat([1]));
      var weekMax = Math.max.apply(null, d.weekly.map(function (w) { return w.count; }).concat([1]));
      var heatLevel = function (v) {
        if (v === 0) return '';
        var p = v / hourMax;
        return p > 0.75 ? 'h-4' : p > 0.5 ? 'h-3' : p > 0.25 ? 'h-2' : 'h-1';
      };
      var sent = d.sentiment;
      var sentTotal = (sent.pos || 0) + (sent.neu || 0) + (sent.neg || 0) || 1;

      host.innerHTML =
        '<div class="snd-kpi-grid">'
        + '<div class="snd-kpi"><div class="snd-kpi-label">Open</div><div class="snd-kpi-value">' + d.kpis.open + '</div><div class="snd-kpi-sub">includes escalated</div></div>'
        + '<div class="snd-kpi"><div class="snd-kpi-label">Pending customer</div><div class="snd-kpi-value">' + d.kpis.pending + '</div></div>'
        + '<div class="snd-kpi"><div class="snd-kpi-label">Closed today</div><div class="snd-kpi-value">' + d.kpis.closed_today + '</div></div>'
        + '<div class="snd-kpi"><div class="snd-kpi-label">AI-resolved</div><div class="snd-kpi-value" style="color:var(--snd-mint-2);">' + d.kpis.ai_resolved_pct + '%</div><div class="snd-kpi-sub">closed without agent reply</div></div>'
        + '<div class="snd-kpi"><div class="snd-kpi-label">Avg first response</div><div class="snd-kpi-value">' + d.kpis.avg_first_min + ' min</div></div>'
        + '<div class="snd-kpi"><div class="snd-kpi-label">AI cost today</div><div class="snd-kpi-value">$' + d.kpis.ai_cost_today.toFixed(3) + '</div><div class="snd-kpi-sub">across ' + d.kpis.open + ' active conversations</div></div>'
        + '</div>'

        + '<div class="snd-mt-3" style="display:grid;grid-template-columns:1.5fr 1fr;gap:18px;">'
        +   '<div class="snd-card">'
        +     '<h3 style="margin-bottom:18px;">Last 7 days · conversations</h3>'
        +     '<div class="snd-bars">'
        +       d.weekly.map(function (w) { var h = Math.max(6, (w.count / weekMax) * 165); return '<div class="bar" style="height:' + h + 'px;"><span>' + w.count + '</span></div>'; }).join('')
        +     '</div>'
        +     '<div class="snd-bars-labels">' + d.weekly.map(function (w) { return '<span>' + esc(w.label) + '</span>'; }).join('') + '</div>'
        +   '</div>'
        +   '<div class="snd-card">'
        +     '<h3 style="margin-bottom:14px;">Sentiment split</h3>'
        +     ['pos','neu','neg'].map(function (k) {
                var labels = { pos: '😊 Positive', neu: '😐 Neutral', neg: '😟 Negative' };
                var colors = { pos: 'var(--snd-pos)', neu: 'var(--snd-neu)', neg: 'var(--snd-neg)' };
                var p = ((sent[k] || 0) / sentTotal * 100).toFixed(1);
                return '<div style="margin-bottom:10px;"><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;"><span>' + labels[k] + '</span><span style="font-family:var(--font-mono);">' + (sent[k] || 0) + ' · ' + p + '%</span></div><div style="height:8px;background:var(--snd-bg-light);border-radius:4px;overflow:hidden;"><div style="width:' + p + '%;height:100%;background:' + colors[k] + ';"></div></div></div>';
              }).join('')
        +   '</div>'
        + '</div>'

        + '<div class="snd-mt-3 snd-card">'
        +   '<h3 style="margin-bottom:14px;">Conversations created today · by hour</h3>'
        +   '<div class="snd-heatmap">'
        +     '<div></div>' + d.by_hour.map(function (_, h) { return '<div style="font-size:9.5px;color:var(--snd-muted-light);text-align:center;font-family:var(--font-mono);">' + h + '</div>'; }).join('')
        +     '<div style="color:var(--snd-muted-light);padding:2px 4px;align-self:center;font-family:var(--font-mono);font-size:10px;">today</div>'
        +     d.by_hour.map(function (v) { return '<div class="snd-heat-cell ' + heatLevel(v) + '" title="' + v + ' conversations"></div>'; }).join('')
        +   '</div>'
        + '</div>'

        + '<div class="snd-mt-3 snd-panel">'
        +   '<div class="snd-panel-head"><h3>Recent conversations</h3><a href="#conversations" style="font-size:13px;">View all →</a></div>'
        +   '<table class="snd-table">'
        +     '<thead><tr><th>Subject</th><th>Status</th><th>Sentiment</th><th>Channel</th><th>Last activity</th></tr></thead>'
        +     '<tbody>' + (d.recent.length ? d.recent.map(function (c) {
                var sd = { pos: '😊', neu: '😐', neg: '😟' }[c.sentiment] || '·';
                return '<tr><td style="font-weight:600;">' + esc(c.subject) + '</td><td>' + chip(c.status) + '</td><td style="text-align:center;">' + sd + '</td><td style="font-size:12px;color:var(--snd-muted-light);">' + esc(c.channel) + '</td><td>' + fmtDt(c.last_message_at) + '</td></tr>';
              }).join('') : '<tr><td colspan="5" class="snd-table-empty">No conversations yet.</td></tr>')
        +   '</tbody></table>'
        + '</div>';
    });
  };

  /* ===================================================================
     Conversations
     =================================================================== */
  Admin.conversations = function (host) {
    var state = { filter: 'all' };
    function paint() {
      SanadApp.api('/conversations').then(function (r) {
        var rows = r.body.items;
        var counts = { all: rows.length };
        ['open','pending','snoozed','closed','escalated'].forEach(function (s) { counts[s] = rows.filter(function (c) { return c.status === s; }).length; });
        if (state.filter !== 'all') rows = rows.filter(function (c) { return c.status === state.filter; });
        var custMap = {}; window.SANAD_DATA.CUSTOMERS.forEach(function (c) { custMap[c.id] = c; });
        var agMap = {}; window.SANAD_DATA.AGENTS.forEach(function (a) { agMap[a.id] = a; });
        var catMap = {}; window.SANAD_DATA.CATEGORIES.forEach(function (c) { catMap[c.id] = c; });
        host.innerHTML =
          '<div class="snd-flex" style="margin-bottom:14px;">'
          + ['all','open','pending','snoozed','closed','escalated'].map(function (s) {
              return '<button class="snd-btn snd-btn--sm ' + (state.filter === s ? 'snd-btn--primary' : '') + '" data-fil="' + s + '">' + s + ' (' + (counts[s] || 0) + ')</button>';
            }).join('')
          + '</div>'
          + '<div class="snd-panel">'
          +   '<table class="snd-table">'
          +     '<thead><tr><th>Subject</th><th>Customer</th><th>Category</th><th>Status</th><th>Assignee</th><th>Updated</th><th></th></tr></thead>'
          +     '<tbody>' + (rows.length ? rows.map(function (c) {
                  var cu = custMap[c.customer_id] || { name: '—' };
                  var cat = catMap[c.category_id] || { name: '—' };
                  var ag = agMap[c.assignee_id] || null;
                  return '<tr>'
                    + '<td><div style="font-weight:600;">' + esc(c.subject) + '</div><div style="font-size:11.5px;color:var(--snd-muted-light);">' + esc((c.preview || '').slice(0, 90)) + '</div></td>'
                    + '<td>' + esc(cu.name) + '</td>'
                    + '<td><span class="snd-topic-tag" style="background:' + cat.color + '22;color:' + cat.color + ';">' + (cat.icon || '') + ' ' + esc(cat.name) + '</span></td>'
                    + '<td>' + chip(c.status) + '</td>'
                    + '<td style="font-size:12.5px;">' + (ag ? esc(ag.name) : '<span class="snd-text-muted">unassigned</span>') + '</td>'
                    + '<td>' + fmtDt(c.last_message_at) + '</td>'
                    + '<td><a class="snd-btn snd-btn--sm" href="inbox.html#" target="_blank" onclick="event.preventDefault();window.open(\'inbox.html\',\'_blank\');">Open</a></td>'
                    + '</tr>';
                }).join('') : '<tr><td colspan="7" class="snd-table-empty">No conversations match.</td></tr>')
          +   '</tbody></table>'
          + '</div>';
        host.querySelectorAll('[data-fil]').forEach(function (b) {
          b.addEventListener('click', function () { state.filter = b.getAttribute('data-fil'); paint(); });
        });
      });
    }
    paint();
  };

  /* ===================================================================
     Knowledge base (admin view)
     =================================================================== */
  Admin.kb = function (host) {
    function paint() {
      Promise.all([SanadApp.api('/articles'), SanadApp.api('/categories')]).then(function (rs) {
        var arts = rs[0].body.items;
        var cats = rs[1].body.items;
        var catMap = {}; cats.forEach(function (c) { catMap[c.id] = c; });
        host.innerHTML =
          '<div class="snd-flex" style="margin-bottom:14px;">'
          +   '<button class="snd-btn snd-btn--primary" id="kb-new">+ New article</button>'
          +   '<button class="snd-btn" id="kb-gaps" style="margin-inline-start:auto;">✦ Find gaps with AI</button>'
          + '</div>'
          + '<div class="snd-panel">'
          +   '<table class="snd-table">'
          +     '<thead><tr><th>Title</th><th>Category</th><th style="text-align:right;">Views</th><th style="text-align:right;">Helpful</th><th>Published</th><th></th></tr></thead>'
          +     '<tbody>' + arts.map(function (a) {
                  var cat = catMap[a.category_id] || { name: '—', icon: '' };
                  var score = (a.helpful_up || 0) - (a.helpful_down || 0);
                  return '<tr>'
                    + '<td style="font-weight:600;">' + esc(a.title) + '</td>'
                    + '<td><span class="snd-topic-tag" style="background:' + cat.color + '22;color:' + cat.color + ';">' + cat.icon + ' ' + esc(cat.name) + '</span></td>'
                    + '<td style="text-align:right;font-family:var(--font-mono);">' + a.views + '</td>'
                    + '<td style="text-align:right;font-family:var(--font-mono);color:' + (score > 0 ? 'var(--snd-mint-2)' : 'var(--snd-muted-light)') + ';">' + (score > 0 ? '+' : '') + score + '</td>'
                    + '<td>' + fmtDate(a.published_at) + '</td>'
                    + '<td><a class="snd-btn snd-btn--sm" href="kb.html#/article/' + esc(a.slug) + '" target="_blank">Open</a></td>'
                    + '</tr>';
                }).join('')
          +   '</tbody></table>'
          + '</div>';
        document.getElementById('kb-new').addEventListener('click', function () { editArticle(null, cats, paint); });
        document.getElementById('kb-gaps').addEventListener('click', function () {
          SanadApp.showModal({
            title: '✦ Find gaps in the knowledge base',
            size: 'lg',
            body: '<div id="gap-body"><div class="snd-empty"><div class="snd-ai-loading"></div> Analyzing recent tickets vs current KB…</div></div>',
            foot: '<button class="snd-btn" data-modal-close>Close</button>',
            onMount: function (el) {
              SanadAI.findKbGaps().then(function (r) {
                el.querySelector('#gap-body').innerHTML =
                  (r.fallback ? '<div class="snd-mode-badge" style="margin-bottom:10px;">mock — enable live AI for real analysis</div>' : '')
                  + '<div style="font-size:14px;">' + SanadApp.md(r.suggestions_md) + '</div>';
              });
            }
          });
        });
      });
    }
    paint();
  };
  function editArticle(art, cats, refresh) {
    var isNew = !art;
    var f = art || { title: '', category_id: cats[0].id, body_md: '' };
    SanadApp.showModal({
      title: isNew ? 'New article' : 'Edit ' + (f.title || ''),
      size: 'lg',
      body:
        '<div class="snd-field" style="margin-bottom:10px;"><span>Title</span><input class="snd-input" id="a-title" value="' + esc(f.title) + '"/></div>'
        + '<div class="snd-field" style="margin-bottom:10px;"><span>Category</span><select class="snd-select" id="a-cat">'
        +   cats.map(function (c) { return '<option value="' + c.id + '"' + (c.id === f.category_id ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('')
        + '</select></div>'
        + '<div class="snd-field"><span>Body (Markdown)</span><textarea class="snd-textarea" id="a-body" rows="14">' + esc(f.body_md) + '</textarea></div>',
      foot: (isNew ? '' : '<button class="snd-btn snd-btn--danger" id="a-del">Delete</button>')
        + '<button class="snd-btn" data-modal-close style="margin-inline-start:auto;">Cancel</button>'
        + '<button class="snd-btn snd-btn--primary" id="a-save">Save</button>',
      onMount: function (el, close) {
        el.querySelector('#a-save').addEventListener('click', function () {
          var body = {
            title: el.querySelector('#a-title').value.trim(),
            category_id: el.querySelector('#a-cat').value,
            body_md: el.querySelector('#a-body').value
          };
          if (!body.title) return window.toast('Title required', 'error');
          var req = isNew
            ? SanadApp.api('/articles', { method: 'POST', body: body })
            : SanadApp.api('/articles/' + art.id, { method: 'PUT', body: body });
          req.then(function () { window.toast('Saved', 'success'); close(); refresh(); });
        });
        var del = el.querySelector('#a-del');
        if (del) del.addEventListener('click', function () {
          if (!confirm('Delete this article?')) return;
          SanadApp.api('/articles/' + art.id, { method: 'DELETE' }).then(function () { window.toast('Deleted', 'warn'); close(); refresh(); });
        });
      }
    });
  }

  /* ===================================================================
     Categories
     =================================================================== */
  Admin.categories = function (host) {
    function paint() {
      SanadApp.api('/categories').then(function (r) {
        var rows = r.body.items;
        host.innerHTML =
          '<div class="snd-flex" style="margin-bottom:14px;"><button class="snd-btn snd-btn--primary" id="c-new" style="margin-inline-start:auto;">+ New category</button></div>'
          + '<div class="snd-panel"><table class="snd-table">'
          +   '<thead><tr><th>Icon</th><th>Name</th><th>Color</th><th>Auto-tag</th><th></th></tr></thead>'
          +   '<tbody>' + rows.map(function (c) {
                return '<tr>'
                  + '<td style="font-size:20px;">' + esc(c.icon || '📄') + '</td>'
                  + '<td style="font-weight:600;">' + esc(c.name) + '</td>'
                  + '<td><span style="display:inline-block;width:16px;height:16px;border-radius:4px;background:' + c.color + ';vertical-align:middle;"></span> <span style="font-family:var(--font-mono);font-size:12px;">' + esc(c.color) + '</span></td>'
                  + '<td>' + (c.auto_tag ? '<span class="snd-chip closed">✓ enabled</span>' : '<span class="snd-chip snoozed">off</span>') + '</td>'
                  + '<td><button class="snd-btn snd-btn--sm" data-edit="' + c.id + '">Edit</button> <button class="snd-btn snd-btn--sm snd-btn--danger" data-del="' + c.id + '">Delete</button></td>'
                  + '</tr>';
              }).join('')
          + '</tbody></table></div>';
        document.getElementById('c-new').addEventListener('click', function () { editCat(null, paint); });
        host.querySelectorAll('[data-edit]').forEach(function (b) {
          b.addEventListener('click', function () { editCat(rows.find(function (c) { return c.id === b.getAttribute('data-edit'); }), paint); });
        });
        host.querySelectorAll('[data-del]').forEach(function (b) {
          b.addEventListener('click', function () {
            if (!confirm('Delete category? Articles in this category will keep their tag but it will be empty.')) return;
            SanadApp.api('/categories', { method: 'POST', body: { action: 'remove', id: b.getAttribute('data-del') } })
              .then(function () { window.toast('Deleted', 'warn'); paint(); });
          });
        });
      });
    }
    paint();
  };
  function editCat(c, refresh) {
    var isNew = !c;
    var f = c || { name: '', icon: '💬', color: '#94a3b8', auto_tag: false };
    SanadApp.showModal({
      title: isNew ? 'New category' : 'Edit ' + f.name,
      body:
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">'
        + '<div class="snd-field"><span>Name</span><input class="snd-input" id="cf-name" value="' + esc(f.name) + '"/></div>'
        + '<div class="snd-field"><span>Icon (emoji)</span><input class="snd-input" id="cf-icon" value="' + esc(f.icon) + '"/></div>'
        + '<div class="snd-field"><span>Color (hex)</span><input class="snd-input" id="cf-color" value="' + esc(f.color) + '"/></div>'
        + '<div class="snd-field"><span>Auto-tag with AI</span><select class="snd-select" id="cf-auto"><option value="true"' + (f.auto_tag ? ' selected' : '') + '>Yes</option><option value="false"' + (!f.auto_tag ? ' selected' : '') + '>No</option></select></div>'
        + '</div>',
      foot: '<button class="snd-btn" data-modal-close style="margin-inline-start:auto;">Cancel</button><button class="snd-btn snd-btn--primary" id="cf-save">Save</button>',
      onMount: function (el, close) {
        el.querySelector('#cf-save').addEventListener('click', function () {
          var data = {
            name: el.querySelector('#cf-name').value.trim(),
            icon: el.querySelector('#cf-icon').value.trim() || '💬',
            color: el.querySelector('#cf-color').value.trim() || '#94a3b8',
            auto_tag: el.querySelector('#cf-auto').value === 'true'
          };
          if (!data.name) return window.toast('Name required', 'error');
          SanadApp.api('/categories', { method: 'POST', body: isNew ? { action: 'add', category: data } : { action: 'update', id: c.id, changes: data } })
            .then(function () { window.toast('Saved', 'success'); close(); refresh(); });
        });
      }
    });
  }

  /* ===================================================================
     Agents
     =================================================================== */
  Admin.agents = function (host) {
    SanadApp.api('/agents').then(function (r) {
      var rows = r.body.items;
      var PERMS = {
        agent:      ['Read + reply to conversations', 'Apply tags + categories', 'Snooze tickets', 'Use AI Copilot'],
        lead:       ['All agent permissions', 'Reassign tickets', 'Edit KB articles', 'View analytics'],
        admin:      ['All lead permissions', 'Edit categories + workflows', 'Manage agents + roles', 'Configure AI Console', 'Access audit log']
      };
      host.innerHTML =
        '<div class="snd-panel" style="margin-bottom:18px;"><table class="snd-table">'
        +   '<thead><tr><th></th><th>Name</th><th>Role</th><th>Online</th><th>CSAT</th></tr></thead>'
        +   '<tbody>' + rows.map(function (a) {
              return '<tr>'
                + '<td><span class="snd-conv-avatar" style="width:30px;height:30px;background-image:url(' + a.photo + ');background-size:cover;"></span></td>'
                + '<td style="font-weight:600;">' + esc(a.name) + '</td>'
                + '<td><span class="snd-chip ' + (a.role === 'admin' ? 'closed' : a.role === 'lead' ? 'open' : 'snoozed') + '">' + a.role + '</span></td>'
                + '<td>' + (a.online ? '<span style="color:var(--snd-mint-2);font-size:13px;">● online</span>' : '<span class="snd-text-muted">offline</span>') + '</td>'
                + '<td style="font-family:var(--font-mono);font-weight:700;">' + a.csat.toFixed(1) + ' / 5</td>'
                + '</tr>';
            }).join('')
        + '</tbody></table></div>'
        + '<div class="snd-card"><h3 style="margin-bottom:10px;">Permission matrix</h3>'
        + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;">'
        +   Object.keys(PERMS).map(function (role) {
              return '<div><div class="snd-kpi-label">' + role + '</div><ul style="margin:8px 0 0;padding-inline-start:18px;font-size:13px;line-height:1.7;">' + PERMS[role].map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul></div>';
            }).join('')
        + '</div></div>';
    });
  };

  /* ===================================================================
     Customers
     =================================================================== */
  Admin.customers = function (host) {
    var state = { q: '' };
    function paint() {
      SanadApp.api('/customers' + (state.q ? '?q=' + encodeURIComponent(state.q) : '')).then(function (r) {
        var rows = r.body.items;
        host.innerHTML =
          '<div class="snd-flex" style="margin-bottom:14px;">'
          +   '<input class="snd-input" id="cu-q" placeholder="Search customers…" style="max-width:280px;" value="' + esc(state.q) + '"/>'
          +   '<span class="snd-text-muted" style="font-size:13px;">' + rows.length + ' customers</span>'
          + '</div>'
          + '<div class="snd-panel"><table class="snd-table">'
          +   '<thead><tr><th></th><th>Name</th><th>Email</th><th>Tier</th><th>Locale</th><th style="text-align:right;">LTV</th><th>Joined</th></tr></thead>'
          +   '<tbody>' + rows.map(function (c) {
                return '<tr>'
                  + '<td><span class="snd-conv-avatar" style="width:28px;height:28px;background-image:url(' + c.avatar + ');background-size:cover;"></span></td>'
                  + '<td style="font-weight:600;">' + esc(c.name) + '</td>'
                  + '<td style="font-size:12.5px;color:var(--snd-muted-light);">' + esc(c.email) + '</td>'
                  + '<td><span class="snd-topic-tag">' + esc(c.tier) + '</span></td>'
                  + '<td style="font-family:var(--font-mono);">' + esc(c.locale) + '</td>'
                  + '<td style="text-align:right;font-family:var(--font-mono);font-weight:700;">$' + c.ltv + '</td>'
                  + '<td>' + fmtDate(c.joined_at) + '</td>'
                  + '</tr>';
              }).join('')
          + '</tbody></table></div>';
        document.getElementById('cu-q').addEventListener('input', function (e) {
          state.q = e.target.value;
          clearTimeout(window.__cuS);
          window.__cuS = setTimeout(paint, 200);
        });
      });
    }
    paint();
  };

  /* ===================================================================
     AI Console
     =================================================================== */
  Admin.ai_console = function (host) {
    SanadApp.api('/admin/settings').then(function (r) {
      var s = r.body.settings;
      var models = [
        ['claude-haiku-4-5-20251001', 'Haiku 4.5', 'Fastest · cheapest (~$0.001/call)'],
        ['claude-sonnet-4-6',         'Sonnet 4.6', 'Balanced · ~10× the cost'],
        ['claude-opus-4-7',           'Opus 4.7',   'Highest quality · ~30× the cost']
      ];
      host.innerHTML =
        '<div class="snd-card" style="margin-bottom:18px;">'
        +   '<h3 style="margin-bottom:14px;">Model</h3>'
        +   '<div style="display:grid;gap:10px;grid-template-columns:repeat(3,1fr);">'
        +     models.map(function (m) {
                var on = s.model === m[0];
                return '<label style="display:block;padding:14px;border-radius:10px;border:2px solid ' + (on ? 'var(--snd-primary)' : 'var(--snd-line-light-2)') + ';cursor:pointer;background:' + (on ? 'rgba(139,92,246,.06)' : 'white') + ';">'
                  + '<input type="radio" name="model" value="' + m[0] + '" ' + (on ? 'checked' : '') + ' style="display:none;"/>'
                  + '<div style="font-weight:700;font-size:14px;">' + esc(m[1]) + '</div>'
                  + '<div style="font-size:11.5px;color:var(--snd-muted-light);margin-top:4px;">' + esc(m[2]) + '</div>'
                  + '</label>';
              }).join('')
        +   '</div>'
        + '</div>'

        + '<div class="snd-card" style="margin-bottom:18px;">'
        +   '<h3 style="margin-bottom:6px;">System prompt</h3>'
        +   '<p class="snd-text-muted" style="font-size:13px;margin:0 0 10px;">Applied as the system message on every AI call. Cached with <code>cache_control: ephemeral</code> when sent live.</p>'
        +   '<textarea class="snd-textarea" id="sys-prompt" rows="6">' + esc(s.system_prompt) + '</textarea>'
        + '</div>'

        + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:18px;">'
        +   '<div class="snd-card"><h4 style="margin-bottom:8px;">Temperature</h4><input class="snd-input" type="number" id="temp" step="0.05" min="0" max="1" value="' + s.temperature + '"/><div class="snd-text-muted" style="font-size:11.5px;margin-top:4px;">0 = deterministic · 1 = creative</div></div>'
        +   '<div class="snd-card"><h4 style="margin-bottom:8px;">Max tokens</h4><input class="snd-input" type="number" id="maxt" step="50" min="32" max="2000" value="' + s.max_tokens + '"/></div>'
        +   '<div class="snd-card"><h4 style="margin-bottom:8px;">Prompt cache</h4><select class="snd-select" id="cache"><option value="true"' + (s.cache_enabled ? ' selected' : '') + '>Enabled (recommended)</option><option value="false"' + (!s.cache_enabled ? ' selected' : '') + '>Disabled</option></select></div>'
        + '</div>'

        + '<div class="snd-flex">'
        +   '<button class="snd-btn snd-btn--primary" id="save-ai">Save AI settings</button>'
        +   '<button class="snd-btn" id="test-ai" style="margin-inline-start:auto;">Test with sample</button>'
        + '</div>'
        + '<div id="test-out" style="margin-top:14px;"></div>';

      document.querySelectorAll('input[name="model"]').forEach(function (el) {
        el.addEventListener('change', function () {});
      });
      document.getElementById('save-ai').addEventListener('click', function () {
        var model = document.querySelector('input[name="model"]:checked').value;
        var body = {
          model: model,
          system_prompt: document.getElementById('sys-prompt').value,
          temperature: parseFloat(document.getElementById('temp').value) || 0.4,
          max_tokens: parseInt(document.getElementById('maxt').value, 10) || 800,
          cache_enabled: document.getElementById('cache').value === 'true'
        };
        SanadApp.api('/admin/settings', { method: 'POST', body: body }).then(function () { window.toast('AI settings saved', 'success'); });
      });
      document.getElementById('test-ai').addEventListener('click', function () {
        document.getElementById('test-out').innerHTML = '<div class="snd-empty"><div class="snd-ai-loading"></div> Generating a sample reply…</div>';
        var sampleConv = { conversation: { id: 'test', locale: 'en' }, messages: [
          { author_type: 'customer', body: "Hi, can you help me reset my password? The email never arrives." }
        ] };
        SanadAI.replySuggestion(sampleConv).then(function (r) {
          document.getElementById('test-out').innerHTML = '<div class="snd-card">'
            + '<div style="font-size:11px;color:var(--snd-muted-light);text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin-bottom:8px;">Sample reply ' + (r.fallback ? '<span class="snd-mode-badge" style="margin-inline-start:6px;font-size:9.5px;padding:1px 8px;">mock</span>' : '<span class="snd-mode-badge live" style="margin-inline-start:6px;font-size:9.5px;padding:1px 8px;">live</span>') + '</div>'
            + '<div style="white-space:pre-wrap;font-size:14px;line-height:1.6;">' + esc(r.text) + '</div>'
            + '<div style="margin-top:10px;font-size:11.5px;color:var(--snd-muted-light);font-family:var(--font-mono);">' + r.model + ' · ' + r.latency_ms + 'ms</div>'
            + '</div>';
        });
      });
    });
  };

  /* ===================================================================
     Analytics
     =================================================================== */
  Admin.analytics = function (host) {
    Promise.all([SanadApp.api('/conversations'), SanadApp.api('/admin/ai-logs')]).then(function (rs) {
      var convs = rs[0].body.items;
      var logs = rs[1].body.items;
      var byCat = {}, byDay = {}, byFeature = {};
      convs.forEach(function (c) {
        byCat[c.category_id] = (byCat[c.category_id] || 0) + 1;
        var dk = new Date(c.created_at).toISOString().slice(0, 10);
        byDay[dk] = (byDay[dk] || 0) + 1;
      });
      // Split log entries: regular AI calls vs user-feedback ratings
      var callLogs = logs.filter(function (l) { return l.kind !== 'rating'; });
      var ratings = logs.filter(function (l) { return l.kind === 'rating'; });
      callLogs.forEach(function (l) { byFeature[l.feature] = (byFeature[l.feature] || 0) + 1; });
      var catMap = {}; window.SANAD_DATA.CATEGORIES.forEach(function (c) { catMap[c.id] = c; });
      var dayKeys = Object.keys(byDay).sort().slice(-14);
      var maxDay = Math.max.apply(null, dayKeys.map(function (k) { return byDay[k]; }).concat([1]));
      var totalCat = Object.values(byCat).reduce(function (s, v) { return s + v; }, 0) || 1;
      var fallbackCount = callLogs.filter(function (l) { return l.fallback; }).length;
      var fallbackPct = ((fallbackCount / (callLogs.length || 1)) * 100).toFixed(1);
      var avgLatency = callLogs.length ? Math.round(callLogs.reduce(function (s, l) { return s + (l.latency_ms || 0); }, 0) / callLogs.length) : 0;
      var totalCost = callLogs.reduce(function (s, l) { return s + (l.cost_usd || 0); }, 0);
      // Satisfaction: % thumbs-up among ratings, per-feature
      var ups = ratings.filter(function (r) { return r.rating === 'up'; }).length;
      var downs = ratings.filter(function (r) { return r.rating === 'down'; }).length;
      var satPct = ratings.length ? Math.round((ups / ratings.length) * 100) : null;
      var byFeatureSat = {};
      ratings.forEach(function (r) {
        if (!byFeatureSat[r.feature]) byFeatureSat[r.feature] = { up: 0, down: 0 };
        byFeatureSat[r.feature][r.rating] = (byFeatureSat[r.feature][r.rating] || 0) + 1;
      });

      host.innerHTML =
        '<div class="snd-kpi-grid" style="margin-bottom:18px;">'
        +   '<div class="snd-kpi"><div class="snd-kpi-label">Conversations (all time)</div><div class="snd-kpi-value">' + convs.length + '</div></div>'
        +   '<div class="snd-kpi"><div class="snd-kpi-label">AI calls</div><div class="snd-kpi-value">' + callLogs.length + '</div></div>'
        +   '<div class="snd-kpi"><div class="snd-kpi-label">Satisfaction (👍/👎)</div><div class="snd-kpi-value" style="color:' + (satPct == null ? 'var(--snd-muted-light)' : satPct > 70 ? 'var(--snd-mint-2)' : satPct > 40 ? 'var(--snd-amber)' : 'var(--snd-rose)') + ';">' + (satPct == null ? '—' : satPct + '%') + '</div><div class="snd-kpi-sub">' + ups + ' up · ' + downs + ' down</div></div>'
        +   '<div class="snd-kpi"><div class="snd-kpi-label">Fallback rate</div><div class="snd-kpi-value" style="color:' + (fallbackPct > 30 ? 'var(--snd-amber)' : 'var(--snd-mint-2)') + ';">' + fallbackPct + '%</div><div class="snd-kpi-sub">mock vs live</div></div>'
        +   '<div class="snd-kpi"><div class="snd-kpi-label">Avg latency</div><div class="snd-kpi-value">' + avgLatency + ' ms</div></div>'
        +   '<div class="snd-kpi"><div class="snd-kpi-label">Total cost (mock $)</div><div class="snd-kpi-value">$' + totalCost.toFixed(3) + '</div></div>'
        + '</div>'

        + '<div class="snd-card" style="margin-bottom:18px;">'
        +   '<h3 style="margin-bottom:14px;">Daily conversation volume (last 14d)</h3>'
        +   '<div class="snd-bars">' + dayKeys.map(function (k) { var h = Math.max(6, (byDay[k] / maxDay) * 165); return '<div class="bar" style="height:' + h + 'px;"><span>' + byDay[k] + '</span></div>'; }).join('') + '</div>'
        +   '<div class="snd-bars-labels">' + dayKeys.map(function (k) { return '<span>' + k.slice(5) + '</span>'; }).join('') + '</div>'
        + '</div>'

        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;">'
        +   '<div class="snd-card">'
        +     '<h3 style="margin-bottom:10px;">By category</h3>'
        +     Object.keys(byCat).map(function (id) {
                var cat = catMap[id] || { name: id, color: '#94a3b8', icon: '' };
                var p = (byCat[id] / totalCat * 100).toFixed(1);
                return '<div style="margin-bottom:10px;"><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;"><span>' + cat.icon + ' ' + esc(cat.name) + '</span><span style="font-family:var(--font-mono);">' + byCat[id] + ' · ' + p + '%</span></div><div style="height:8px;background:var(--snd-bg-light);border-radius:4px;overflow:hidden;"><div style="width:' + p + '%;height:100%;background:' + cat.color + ';"></div></div></div>';
              }).join('')
        +   '</div>'
        +   '<div class="snd-card">'
        +     '<h3 style="margin-bottom:10px;">AI calls by feature</h3>'
        +     '<table class="snd-table"><thead><tr><th>Feature</th><th style="text-align:right;">Calls</th><th style="text-align:right;">Sat.</th></tr></thead><tbody>' + Object.keys(byFeature).map(function (f) {
                var s = byFeatureSat[f];
                var sat = s ? Math.round(s.up / (s.up + s.down) * 100) + '%' : '—';
                return '<tr><td style="font-weight:600;">' + esc(f) + '</td><td style="text-align:right;font-family:var(--font-mono);">' + byFeature[f] + '</td><td style="text-align:right;font-family:var(--font-mono);color:' + (s ? (s.up >= s.down ? 'var(--snd-mint-2)' : 'var(--snd-rose)') : 'var(--snd-muted-light)') + ';">' + sat + '</td></tr>';
              }).join('') + '</tbody></table>'
        +   '</div>'
        + '</div>'

        + '<div class="snd-mt-3"><button class="snd-btn" id="rep-csv">Export conversations CSV</button></div>';

      document.getElementById('rep-csv').addEventListener('click', function () {
        var custMap = {}; window.SANAD_DATA.CUSTOMERS.forEach(function (c) { custMap[c.id] = c; });
        var lines = ['id,subject,customer,category,status,priority,sentiment,locale,channel,created_at'];
        convs.forEach(function (c) {
          lines.push([c.id, '"' + (c.subject || '').replace(/"/g, '""') + '"', (custMap[c.customer_id] || {}).name || '', c.category_id, c.status, c.priority, c.sentiment, c.locale, c.channel, c.created_at].join(','));
        });
        csvDownload('sanad-conversations-' + new Date().toISOString().slice(0,10) + '.csv', lines);
        window.toast('Exported ' + convs.length + ' conversations', 'success');
      });
    });
  };

  /* ===================================================================
     Integrations
     =================================================================== */
  Admin.integrations = function (host) {
    SanadApp.api('/integrations').then(function (r) {
      var rows = r.body.items;
      host.innerHTML =
        '<p class="snd-text-muted" style="margin-top:0;font-size:14px;">Connect Sanad to the tools your team already uses. (Demo: connect buttons are stubs.)</p>'
        + '<div style="display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));">'
        + rows.map(function (i) {
            var connected = i.status === 'connected';
            return '<div class="snd-card">'
              + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">'
              +   '<span style="font-size:24px;">' + esc(i.icon || '🔗') + '</span>'
              +   '<div style="flex:1;"><div style="font-weight:700;">' + esc(i.name) + '</div><div style="font-size:11.5px;color:var(--snd-muted-light);">' + (connected ? 'Connected ' + fmtDate(i.connected_at) : 'Not connected') + '</div></div>'
              +   (connected ? '<span class="snd-chip closed">●</span>' : '<span class="snd-chip snoozed">○</span>')
              + '</div>'
              + '<button class="snd-btn snd-btn--sm snd-btn--block" data-int="' + i.id + '">' + (connected ? 'Disconnect' : 'Connect') + '</button>'
              + '</div>';
          }).join('') + '</div>';
      host.querySelectorAll('[data-int]').forEach(function (b) {
        b.addEventListener('click', function () { window.toast((b.textContent.indexOf('Connect') !== -1 ? 'Connect' : 'Disconnect') + ' flow (demo stub)', 'success'); });
      });
    });
  };

  /* ===================================================================
     Settings
     =================================================================== */
  Admin.settings = function (host) {
    SanadApp.api('/admin/settings').then(function (r) {
      var s = r.body.settings;
      host.innerHTML =
        '<div class="snd-card" style="margin-bottom:14px;">'
        + '<h3 style="margin-bottom:14px;">Business</h3>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">'
        +   '<div class="snd-field"><span>Business name</span><input class="snd-input" id="b-name" value="' + esc(s.business_name) + '"/></div>'
        +   '<div class="snd-field"><span>Support email</span><input class="snd-input" id="b-email" value="' + esc(s.support_email) + '"/></div>'
        +   '<div class="snd-field" style="grid-column:1/-1;"><span>Business hours</span><input class="snd-input" id="b-hours" value="' + esc(s.business_hours) + '"/></div>'
        + '</div></div>'

        + '<div class="snd-card" style="margin-bottom:14px;">'
        + '<h3 style="margin-bottom:14px;">Chat widget</h3>'
        + '<div class="snd-field" style="margin-bottom:10px;"><span>Greeting message</span><textarea class="snd-textarea" id="b-greet" rows="2">' + esc(s.greeting) + '</textarea></div>'
        + '<div class="snd-field"><span>Human handoff keywords (comma-separated)</span><input class="snd-input" id="b-handoff" value="' + esc((s.human_handoff_keywords || []).join(', ')) + '"/></div>'
        + '</div>'

        + '<div class="snd-flex">'
        +   '<button class="snd-btn snd-btn--primary" id="s-save">Save settings</button>'
        +   '<button class="snd-btn snd-btn--danger" id="s-reset" style="margin-inline-start:auto;">Reset demo data</button>'
        + '</div>';
      document.getElementById('s-save').addEventListener('click', function () {
        var body = {
          business_name: document.getElementById('b-name').value,
          support_email: document.getElementById('b-email').value,
          business_hours: document.getElementById('b-hours').value,
          greeting: document.getElementById('b-greet').value,
          human_handoff_keywords: document.getElementById('b-handoff').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean)
        };
        SanadApp.api('/admin/settings', { method: 'POST', body: body }).then(function () { window.toast('Saved', 'success'); });
      });
      document.getElementById('s-reset').addEventListener('click', function () {
        if (!confirm('Wipe all local edits, conversations, articles, settings? Seed data will reload.')) return;
        SanadApp.api('/admin/reset-demo', { method: 'POST' }).then(function () { window.toast('Demo reset', 'warn'); setTimeout(function () { location.reload(); }, 600); });
      });
    });
  };

  /* ===================================================================
     Audit log
     =================================================================== */
  Admin.audit = function (host) {
    SanadApp.api('/admin/audit').then(function (r) {
      var rows = r.body.items;
      var agMap = {}; window.SANAD_DATA.AGENTS.forEach(function (a) { agMap[a.id] = a.name; });
      host.innerHTML =
        '<div class="snd-flex" style="margin-bottom:12px;"><span class="snd-text-muted">' + rows.length + ' entries</span><button class="snd-btn snd-btn--sm" id="au-csv" style="margin-inline-start:auto;">Export CSV</button></div>'
        + '<div class="snd-panel"><table class="snd-table">'
        + '<thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>'
        + '<tbody>' + (rows.length ? rows.map(function (a) {
            return '<tr><td style="font-family:var(--font-mono);font-size:12px;">' + fmtDt(a.when) + '</td><td>' + esc(agMap[a.actor] || a.actor) + '</td><td style="font-family:var(--font-mono);font-size:12px;color:var(--snd-primary);">' + esc(a.action) + '</td><td style="font-family:var(--font-mono);font-size:12px;">' + esc(a.target) + '</td><td style="font-size:12.5px;color:var(--snd-muted-light);">' + esc(a.details) + '</td></tr>';
          }).join('') : '<tr><td colspan="5" class="snd-table-empty">No audit entries yet. Do something in the admin to populate this log.</td></tr>')
        + '</tbody></table></div>';
      document.getElementById('au-csv').addEventListener('click', function () {
        var lines = ['when,actor,action,target,details'];
        rows.forEach(function (a) { lines.push([a.when, agMap[a.actor] || a.actor, a.action, a.target, '"' + (a.details || '').replace(/"/g, '""') + '"'].join(',')); });
        csvDownload('sanad-audit-' + new Date().toISOString().slice(0,10) + '.csv', lines);
        window.toast('Exported ' + rows.length + ' entries', 'success');
      });
    });
  };

  window.SanadAdmin = Admin;
})();
