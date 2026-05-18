/* workorders.js - Watad work-orders module.
 * Filter chips, table, create-WO modal, drill-in modal with comments
 * timeline + signature-capture canvas, status pipeline.
 */
(function () {
  'use strict';
  var D = window.WATAD_DATA;
  var $ = function (id) { return document.getElementById(id); };
  var esc = WatadApp.escapeHtml;

  var state = { filter: 'all', q: '' };
  var FILTERS = [
    { id: 'all',         label: 'All' },
    { id: 'open',        label: 'Open' },
    { id: 'in-progress', label: 'In progress' },
    { id: 'on-hold',     label: 'On hold' },
    { id: 'completed',   label: 'Completed' },
    { id: 'cancelled',   label: 'Cancelled' }
  ];

  function load() {
    WatadApp.api('/work-orders').then(function (r) {
      var rows = r.body.items;
      var counts = { all: rows.length };
      FILTERS.forEach(function (f) { if (f.id !== 'all') counts[f.id] = rows.filter(function (w) { return w.status === f.id; }).length; });
      if (state.filter !== 'all') rows = rows.filter(function (w) { return w.status === state.filter; });
      if (state.q) {
        var q = state.q.toLowerCase();
        rows = rows.filter(function (w) { return (w.title + ' ' + (w.description || '')).toLowerCase().indexOf(q) !== -1; });
      }
      renderFilters(counts);
      renderTable(rows);
    });
  }

  function renderFilters(counts) {
    $('wo-filters').innerHTML =
        FILTERS.map(function (f) {
          var on = state.filter === f.id;
          return '<button class="wtd-btn wtd-btn--sm' + (on ? ' wtd-btn--primary' : '') + '" data-fil="' + f.id + '">' + esc(f.label) + ' <span style="opacity:.65;">(' + (counts[f.id] || 0) + ')</span></button>';
        }).join('')
      + '<input class="wtd-input" id="wo-search" placeholder="Search…" style="max-width:240px;margin-inline-start:auto;" value="' + esc(state.q) + '" />';
    $('wo-filters').querySelectorAll('[data-fil]').forEach(function (b) {
      b.addEventListener('click', function () { state.filter = b.getAttribute('data-fil'); load(); });
    });
    var s = document.getElementById('wo-search');
    s.addEventListener('input', function (e) {
      state.q = e.target.value;
      clearTimeout(window.__woSearch);
      window.__woSearch = setTimeout(load, 200);
    });
  }
  function renderTable(rows) {
    var assetMap = {}; D.ASSETS.forEach(function (a) { assetMap[a.id] = a; });
    var staffMap = {}; D.STAFF.forEach(function (s) { staffMap[s.id] = s; });
    $('wo-panel').innerHTML =
        '<table class="wtd-table">'
      +   '<thead><tr><th>WO#</th><th>Title</th><th>Asset</th><th>Priority</th><th>Assignee</th><th>Created</th><th>Due</th><th>Status</th><th></th></tr></thead>'
      +   '<tbody>' + (rows.length ? rows.map(function (w) {
            var asset = assetMap[w.asset_id];
            var st = staffMap[w.assignee_id] || { name: '—' };
            return '<tr>'
              + '<td style="font-family:var(--font-mono);font-weight:700;">' + esc(w.wo_no) + '</td>'
              + '<td>' + esc(w.title) + '</td>'
              + '<td style="font-size:12px;">' + (asset ? esc(asset.name) : '—') + '</td>'
              + '<td><span class="wtd-priority ' + w.priority + '">' + w.priority + '</span></td>'
              + '<td style="font-size:12px;">' + esc(st.name) + '</td>'
              + '<td style="font-family:var(--font-mono);font-size:11.5px;">' + WatadApp.fmtDate(w.created_at) + '</td>'
              + '<td style="font-family:var(--font-mono);font-size:11.5px;">' + (w.due ? WatadApp.fmtDate(w.due) : '—') + '</td>'
              + '<td><span class="wtd-chip ' + w.status + '">' + w.status + '</span></td>'
              + '<td><button class="wtd-btn wtd-btn--sm" data-open-id="' + esc(w.id) + '">Open</button></td>'
              + '</tr>';
          }).join('') : '<tr><td colspan="9" class="wtd-table-empty">No work orders match.</td></tr>')
      +   '</tbody></table>';
    $('wo-panel').querySelectorAll('[data-open-id]').forEach(function (b) {
      b.addEventListener('click', function () { openWoModal(b.getAttribute('data-open-id')); });
    });
  }

  function openWoModal(id) {
    WatadApp.api('/work-orders/' + id).then(function (r) {
      if (!r.body || !r.body.ok) return;
      var w = r.body.work_order;
      var asset = D.ASSETS.find(function (a) { return a.id === w.asset_id; });
      var staffMap = {}; D.STAFF.forEach(function (s) { staffMap[s.id] = s; });
      var statuses = ['open','in-progress','on-hold','completed','cancelled'];
      var body =
          '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:14px;font-size:13px;">'
        +   '<div><div style="font-size:11px;color:var(--wtd-muted-light);text-transform:uppercase;letter-spacing:.06em;font-weight:700;">WO#</div><div style="font-family:var(--font-mono);font-weight:700;font-size:14px;">' + esc(w.wo_no) + '</div></div>'
        +   '<div><div style="font-size:11px;color:var(--wtd-muted-light);text-transform:uppercase;letter-spacing:.06em;font-weight:700;">Asset</div><div>' + (asset ? esc(asset.name) : '—') + '</div></div>'
        +   '<div><div style="font-size:11px;color:var(--wtd-muted-light);text-transform:uppercase;letter-spacing:.06em;font-weight:700;">Priority</div><div><span class="wtd-priority ' + w.priority + '">' + w.priority + '</span></div></div>'
        + '</div>'
        + '<div style="margin-bottom:14px;"><strong>' + esc(w.title) + '</strong>'
        + '<div style="margin-top:6px;color:var(--wtd-muted-light);font-size:13px;line-height:1.55;">' + esc(w.description || '').replace(/\n/g,'<br/>') + '</div></div>'
        + (w.parts && w.parts.length ? '<div style="margin-bottom:12px;font-size:12.5px;"><strong>Parts:</strong> ' + w.parts.map(esc).join(', ') + '</div>' : '')
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">'
        +   '<div class="wtd-field"><span>Status</span><select class="wtd-select" id="wo-status">'
        +     statuses.map(function (s) { return '<option value="' + s + '"' + (s === w.status ? ' selected' : '') + '>' + s + '</option>'; }).join('')
        +   '</select></div>'
        +   '<div class="wtd-field"><span>Assignee</span><select class="wtd-select" id="wo-assignee">'
        +     D.STAFF.map(function (s) { return '<option value="' + s.id + '"' + (s.id === w.assignee_id ? ' selected' : '') + '>' + esc(s.name) + ' · ' + s.role + '</option>'; }).join('')
        +   '</select></div>'
        + '</div>'
        + '<div style="margin-bottom:14px;"><div style="font-size:12px;color:var(--wtd-muted-light);text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin-bottom:6px;">Comments</div>'
        + '<div id="wo-comments" style="max-height:200px;overflow:auto;border:1px solid var(--wtd-line-light);border-radius:8px;padding:10px;background:var(--wtd-bg-light);">'
        + ((w.comments || []).length === 0
            ? '<div class="wtd-text-muted" style="font-size:12px;">No comments yet.</div>'
            : (w.comments || []).map(function (c) {
                return '<div style="padding:8px 0;border-bottom:1px solid var(--wtd-line-light);">'
                  + '<div style="font-size:11px;color:var(--wtd-muted-light);font-family:var(--font-mono);">' + esc((staffMap[c.by] || { name: c.by }).name) + ' · ' + WatadApp.fmtDateTime(c.at) + '</div>'
                  + '<div style="font-size:13px;margin-top:4px;">' + esc(c.body) + '</div>'
                  + '</div>';
              }).join(''))
        + '</div>'
        + '<div style="display:flex;gap:8px;margin-top:8px;"><input class="wtd-input" id="wo-comment-new" placeholder="Add a comment…"/><button class="wtd-btn" id="wo-comment-add">Add</button></div>'
        + '</div>'
        + '<div style="margin-bottom:6px;"><div style="font-size:12px;color:var(--wtd-muted-light);text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin-bottom:6px;">Technician signature (sign on completion)</div>'
        + '<canvas id="wo-sig" width="500" height="100" style="border:1px solid var(--wtd-line-light);border-radius:8px;background:white;width:100%;cursor:crosshair;touch-action:none;"></canvas>'
        + '<button class="wtd-btn wtd-btn--sm" id="wo-sig-clear" style="margin-top:6px;">Clear</button>'
        + '</div>';
      WatadApp.showModal({
        title: 'Work order',
        size: 'lg',
        body: body,
        foot: '<button class="wtd-btn wtd-btn--danger" id="wo-delete">Delete</button>'
            + '<button class="wtd-btn" data-modal-close style="margin-inline-start:auto;">Close</button>'
            + '<button class="wtd-btn wtd-btn--primary" id="wo-save">Save changes</button>',
        onMount: function (el, close) {
          // Save changes
          el.querySelector('#wo-save').addEventListener('click', function () {
            var body = {
              status: el.querySelector('#wo-status').value,
              assignee_id: el.querySelector('#wo-assignee').value
            };
            WatadApp.api('/work-orders/' + id, { method: 'PUT', body: body }).then(function () {
              window.toast('Saved', 'success'); close(); load();
            });
          });
          el.querySelector('#wo-delete').addEventListener('click', function () {
            if (!confirm('Delete this work order?')) return;
            WatadApp.api('/work-orders/' + id, { method: 'DELETE' }).then(function () {
              window.toast('Deleted', 'warn'); close(); load();
            });
          });
          el.querySelector('#wo-comment-add').addEventListener('click', function () {
            var v = el.querySelector('#wo-comment-new').value.trim();
            if (!v) return;
            WatadApp.api('/work-orders/' + id + '/comments', { method: 'POST', body: { by: 'st-rashid', body: v } }).then(function () {
              el.querySelector('#wo-comment-new').value = '';
              // Re-open to refresh comments
              close(); setTimeout(function () { openWoModal(id); }, 50);
            });
          });
          // Signature capture
          var canvas = el.querySelector('#wo-sig');
          var ctx = canvas.getContext('2d');
          ctx.strokeStyle = '#0f1a30'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          var drawing = false, lastX = 0, lastY = 0;
          function pos(e) {
            var rect = canvas.getBoundingClientRect();
            var p = e.touches ? e.touches[0] : e;
            return { x: (p.clientX - rect.left) * (canvas.width / rect.width), y: (p.clientY - rect.top) * (canvas.height / rect.height) };
          }
          function start(e) { drawing = true; var p = pos(e); lastX = p.x; lastY = p.y; e.preventDefault(); }
          function move(e) { if (!drawing) return; var p = pos(e); ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(p.x, p.y); ctx.stroke(); lastX = p.x; lastY = p.y; e.preventDefault(); }
          function end() { drawing = false; }
          canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', move); canvas.addEventListener('mouseup', end); canvas.addEventListener('mouseleave', end);
          canvas.addEventListener('touchstart', start); canvas.addEventListener('touchmove', move); canvas.addEventListener('touchend', end);
          el.querySelector('#wo-sig-clear').addEventListener('click', function () { ctx.clearRect(0, 0, canvas.width, canvas.height); });
        }
      });
    });
  }

  function newWoModal(prefillAssetId) {
    WatadApp.showModal({
      title: 'New work order',
      body:
          '<div class="wtd-field" style="margin-bottom:10px;"><span>Title</span><input class="wtd-input" id="nw-title" placeholder="What needs doing?"/></div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">'
        +   '<div class="wtd-field"><span>Asset</span><select class="wtd-select" id="nw-asset">'
        +     '<option value="">(none — site-wide)</option>'
        +     D.ASSETS.map(function (a) { return '<option value="' + a.id + '"' + (a.id === prefillAssetId ? ' selected' : '') + '>' + esc(a.name) + '</option>'; }).join('')
        +   '</select></div>'
        +   '<div class="wtd-field"><span>Priority</span><select class="wtd-select" id="nw-prio"><option value="low">Low</option><option value="med" selected>Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></div>'
        + '</div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">'
        +   '<div class="wtd-field"><span>Assignee</span><select class="wtd-select" id="nw-assignee">'
        +     D.STAFF.map(function (s) { return '<option value="' + s.id + '">' + esc(s.name) + ' · ' + s.role + '</option>'; }).join('')
        +   '</select></div>'
        +   '<div class="wtd-field"><span>Due in (hours)</span><input class="wtd-input" type="number" id="nw-due" value="24"/></div>'
        + '</div>'
        + '<div class="wtd-field"><span>Description</span><textarea class="wtd-textarea" id="nw-desc" rows="3"></textarea></div>',
      foot: '<button class="wtd-btn" data-modal-close>Cancel</button><button class="wtd-btn wtd-btn--primary" id="nw-go">Create</button>',
      onMount: function (el, close) {
        el.querySelector('#nw-go').addEventListener('click', function () {
          var title = el.querySelector('#nw-title').value.trim();
          if (!title) return window.toast('Title required', 'error');
          var due = parseFloat(el.querySelector('#nw-due').value) || 24;
          var body = {
            title: title,
            asset_id: el.querySelector('#nw-asset').value || null,
            priority: el.querySelector('#nw-prio').value,
            assignee_id: el.querySelector('#nw-assignee').value,
            description: el.querySelector('#nw-desc').value,
            due: new Date(Date.now() + due * 3600000).toISOString()
          };
          WatadApp.api('/work-orders', { method: 'POST', body: body }).then(function (r) {
            window.toast('Created ' + (r.body.work_order ? r.body.work_order.wo_no : ''), 'success');
            close(); load();
          });
        });
      }
    });
  }

  $('wo-new').addEventListener('click', function () { newWoModal(); });

  // Deep-link: workorders.html#new=<asset_id> opens the new-WO modal pre-filled
  var hash = location.hash || '';
  var newM = hash.match(/^#new=(.+)$/);
  if (newM) setTimeout(function () { newWoModal(newM[1]); }, 100);

  load();
})();
