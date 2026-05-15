/* admin-sections.js - All 13 admin sections under window.ManzilAdmin */
(function () {
  'use strict';

  var esc = ManzilApp.escapeHtml;
  var fmtDate = ManzilApp.fmtDate;
  var fmtDT = ManzilApp.fmtDateTime;
  var fmtAED = function (n) { return 'AED ' + Math.round(n).toLocaleString(); };
  var d = window.MANZIL_DATA;

  // ---------- Modal helpers ----------
  function modal(opts) { return ManzilApp.showModal(opts); }
  function formModal(opts) {
    var fields = opts.fields || [];
    var body = fields.map(function (f) {
      if (f.type === 'select') {
        return '<label class="m-field"><span>' + f.label + '</span><select class="m-select" id="ff-' + f.name + '">'
          + f.options.map(function (o) {
              var v = typeof o === 'object' ? o.value : o;
              var lab = typeof o === 'object' ? o.label : o;
              return '<option value="' + esc(v) + '"' + (f.value === v ? ' selected' : '') + '>' + esc(lab) + '</option>';
            }).join('')
          + '</select></label>';
      }
      if (f.type === 'textarea') {
        return '<label class="m-field"><span>' + f.label + '</span><textarea class="m-textarea" id="ff-' + f.name + '" rows="' + (f.rows || 3) + '">' + esc(f.value || '') + '</textarea></label>';
      }
      if (f.type === 'checkbox') {
        return '<label class="m-field" style="flex-direction:row;align-items:center;gap:8px;"><input type="checkbox" id="ff-' + f.name + '"' + (f.value ? ' checked' : '') + ' /><span>' + f.label + '</span></label>';
      }
      if (f.type === 'multi-select') {
        return '<div class="m-field"><span>' + f.label + '</span><div class="m-pills" id="ff-' + f.name + '">'
          + f.options.map(function (o) {
              var sel = (f.value || []).indexOf(o.value) !== -1;
              return '<button type="button" class="m-pill' + (sel ? ' active' : '') + '" data-v="' + esc(o.value) + '">' + esc(o.label) + '</button>';
            }).join('')
          + '</div></div>';
      }
      if (f.type === 'image-url-list') {
        return '<label class="m-field"><span>' + f.label + ' (one URL per line)</span><textarea class="m-textarea" id="ff-' + f.name + '" rows="4" placeholder="https://...">' + esc((f.value || []).join('\n')) + '</textarea></label>';
      }
      return '<label class="m-field"><span>' + f.label + '</span><input class="m-input" id="ff-' + f.name + '" type="' + (f.type || 'text') + '"' + (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') + ' value="' + esc(f.value == null ? '' : f.value) + '" /></label>';
    }).join('');
    var m = modal({
      title: opts.title,
      body: '<form id="ff-form" onsubmit="event.preventDefault()">' + body + '</form>',
      size: opts.size || 'lg',
      foot: '<button class="m-btn" data-modal-close>Cancel</button><button class="m-btn m-btn--primary" id="ff-submit">' + (opts.submitLabel || 'Save') + '</button>'
    });
    setTimeout(function () {
      // wire multi-select pills
      fields.forEach(function (f) {
        if (f.type === 'multi-select') {
          m.el.querySelectorAll('#ff-' + f.name + ' [data-v]').forEach(function (b) {
            b.addEventListener('click', function () { b.classList.toggle('active'); });
          });
        }
      });
      m.el.querySelector('#ff-submit').addEventListener('click', function () {
        var out = {};
        fields.forEach(function (f) {
          var el = m.el.querySelector('#ff-' + f.name);
          if (!el) return;
          if (f.type === 'checkbox') out[f.name] = el.checked;
          else if (f.type === 'multi-select') {
            out[f.name] = Array.prototype.slice.call(el.querySelectorAll('.m-pill.active')).map(function (b) { return b.getAttribute('data-v'); });
          }
          else if (f.type === 'image-url-list') out[f.name] = el.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
          else out[f.name] = el.value;
        });
        opts.onSubmit(out, m.close);
      });
    }, 0);
  }

  function confirmDel(label, fn) {
    modal({
      title: 'Confirm delete',
      body: '<p>Delete <strong>' + esc(label) + '</strong>? This action will be logged in the audit trail.</p>',
      foot: '<button class="m-btn" data-modal-close>Cancel</button><button class="m-btn m-btn--primary" style="background:var(--manzil-rose);" id="cdel">Delete</button>',
      onMount: function (h, close) { h.querySelector('#cdel').addEventListener('click', function () { fn(); close(); }); }
    });
  }

  function downloadCsv(rows, filename) {
    if (!rows.length) { window.toast('Nothing to export'); return; }
    var keys = Object.keys(rows[0]);
    var csv = keys.join(',') + '\n' + rows.map(function (r) {
      return keys.map(function (k) { var v = r[k]; if (v == null) return ''; v = String(v).replace(/"/g, '""'); return /[,"\n]/.test(v) ? '"' + v + '"' : v; }).join(',');
    }).join('\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    window.toast('CSV exported', 'success');
  }

  // ====================== 1. DASHBOARD ======================
  function dashboard(host) {
    ManzilApp.api('/admin/dashboard').then(function (r) {
      var k = r.kpis;
      var maxView = Math.max.apply(null, r.monthly.map(function (m) { return m.views; }));
      var html = ''
        + '<h2>Dashboard</h2>'
        + '<p class="m-text-muted">Live snapshot of the marketplace.</p>'
        + '<div class="m-kpi-grid m-mt-2">'
        +   '<div class="m-kpi"><div class="m-kpi-label">Active listings</div><div class="m-kpi-value">' + k.active_listings + '</div><div class="m-kpi-delta up">+5 this week</div></div>'
        +   '<div class="m-kpi"><div class="m-kpi-label">New leads (7d)</div><div class="m-kpi-value">' + k.new_leads_7d + '</div><div class="m-kpi-delta up">+12% vs prev</div></div>'
        +   '<div class="m-kpi"><div class="m-kpi-label">Monthly views</div><div class="m-kpi-value">' + k.monthly_views.toLocaleString() + '</div><div class="m-kpi-delta up">↑ 8.4%</div></div>'
        +   '<div class="m-kpi"><div class="m-kpi-label">Conversion %</div><div class="m-kpi-value">' + k.conversion_pct + '%</div><div class="m-kpi-delta down">↓ 0.2pp</div></div>'
        + '</div>'

        + '<div class="m-grid m-grid-2 m-mt-3">'
        +   '<div class="m-panel">'
        +     '<div class="m-panel-head"><h3>Monthly views & leads</h3><span class="m-text-muted" style="font-size:12px;">Last 12 months</span></div>'
        +     '<div class="m-bars">' + r.monthly.map(function (m) {
                var h = Math.max(8, (m.views / maxView) * 160);
                return '<div class="bar" style="height:' + h + 'px;"><span class="v">' + (m.views / 1000).toFixed(1) + 'k</span></div>';
              }).join('') + '</div>'
        +     '<div class="m-bars-labels">' + r.monthly.map(function (m) { return '<span>' + m.label + '</span>'; }).join('') + '</div>'
        +   '</div>'

        +   '<div class="m-panel">'
        +     '<div class="m-panel-head"><h3>Inquiries by status</h3><a class="m-text-muted" href="#inquiries" style="font-size:12px;">View all →</a></div>'
        +     '<div class="m-funnel">'
        +       Object.keys(r.by_status).map(function (s) {
                  var n = r.by_status[s];
                  var total = Object.values(r.by_status).reduce(function (a, b) { return a + b; }, 0);
                  return '<div class="m-funnel-row"><div class="lbl">' + s + '</div><div class="bar" style="width:' + Math.max(5, (n / total) * 100) + '%;">' + n + '</div></div>';
                }).join('')
        +     '</div>'
        +   '</div>'
        + '</div>'

        + '<div class="m-grid m-grid-2 m-mt-3">'
        +   '<div class="m-panel">'
        +     '<div class="m-panel-head"><h3>Top performing listings</h3><a class="m-text-muted" href="#listings" style="font-size:12px;">All listings →</a></div>'
        +     '<table class="m-table"><thead><tr><th>Title</th><th>Price</th><th>Type</th></tr></thead><tbody>'
        +       r.top_listings.map(function (l) { return '<tr><td>' + esc(l.title) + '</td><td>' + fmtAED(l.price_aed) + '</td><td>' + l.type + '</td></tr>'; }).join('')
        +     '</tbody></table>'
        +   '</div>'
        +   '<div class="m-panel">'
        +     '<div class="m-panel-head"><h3>Recent inquiries</h3><a class="m-text-muted" href="#inquiries" style="font-size:12px;">All →</a></div>'
        +     '<table class="m-table"><thead><tr><th>From</th><th>Kind</th><th>Status</th><th>When</th></tr></thead><tbody>'
        +       r.recent_inquiries.map(function (q) { return '<tr><td>' + esc(q.name) + '</td><td>' + q.kind + '</td><td><span class="m-chip ' + q.status + '">' + q.status + '</span></td><td>' + ManzilApp.relDate(q.created_at) + '</td></tr>'; }).join('')
        +     '</tbody></table>'
        +   '</div>'
        + '</div>'

        + '<div class="m-grid m-grid-2 m-mt-3">'
        +   '<div class="m-panel">'
        +     '<div class="m-panel-head"><h3>System alerts</h3></div>'
        +     r.alerts.map(function (al) { return '<div style="padding:8px 0;border-bottom:1px solid var(--manzil-line);">⚠️ ' + esc(al.msg) + '</div>'; }).join('')
        +   '</div>'
        +   '<div class="m-panel">'
        +     '<div class="m-panel-head"><h3>Listings near expiry</h3></div>'
        +     (r.expiring.length ? r.expiring.map(function (l) { return '<div style="padding:6px 0;display:flex;justify-content:space-between;"><span>' + esc(l.title) + '</span><span class="m-text-muted">' + ManzilApp.relDate(l.listed_at) + '</span></div>'; }).join('') : '<div class="m-text-muted">None.</div>')
        +   '</div>'
        + '</div>';

      host.innerHTML = html;
    });
  }

  // ====================== 2. LISTINGS ======================
  function listings(host) {
    var statusFilter = '';
    var qStr = '';
    function refresh() {
      var qs = {};
      if (statusFilter) qs.status = statusFilter;
      if (qStr) qs.q = qStr;
      ManzilApp.api('/admin/listings' + ManzilApp.buildQs(qs)).then(function (r) {
        var rows = r.items;
        document.getElementById('lst-count').textContent = rows.length + ' listings';
        document.getElementById('lst-tbody').innerHTML = rows.length ? rows.map(function (l) {
          var ag = d.AGENTS.find(function (x) { return x.id === l.agent_id; }) || {};
          var area = d.AREAS.find(function (x) { return x.id === l.area_id; }) || {};
          return '<tr>'
            + '<td><input type="checkbox" class="lst-check" value="' + l.id + '"></td>'
            + '<td><img src="' + l.photos[0] + '" alt="" style="width:54px;height:36px;object-fit:cover;border-radius:4px;" /></td>'
            + '<td><strong>' + esc(l.title) + '</strong><div class="m-text-muted" style="font-size:11px;">' + l.id + ' · ' + area.name + '</div></td>'
            + '<td>' + fmtAED(l.price_aed) + '</td>'
            + '<td>' + (l.beds || 'Studio') + 'BR · ' + l.baths + 'B</td>'
            + '<td>' + l.type + '</td>'
            + '<td><span class="m-chip ' + l.status + '">' + l.status + '</span>' + (l.featured ? ' <span class="m-chip" style="background:var(--manzil-accent);color:white;">⭐</span>' : '') + '</td>'
            + '<td>' + esc(ag.name || '') + '</td>'
            + '<td class="m-table-actions">'
            +   '<button class="m-btn m-btn--ghost m-btn--sm" onclick="ManzilAdminActions.editListing(\'' + l.id + '\')">Edit</button>'
            +   '<button class="m-btn m-btn--ghost m-btn--sm" onclick="ManzilAdminActions.deleteListing(\'' + l.id + '\',\'' + esc(l.title) + '\')">×</button>'
            + '</td>'
            + '</tr>';
        }).join('') : '<tr><td colspan="9" class="m-table-empty">No listings match.</td></tr>';
      });
    }

    host.innerHTML = ''
      + '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;"><h2 style="margin:0;">Listings</h2>'
      +   '<div class="m-flex-wrap">'
      +     '<button class="m-btn m-btn--primary m-btn--sm" onclick="ManzilAdminActions.newListing()">+ New listing</button>'
      +     '<button class="m-btn m-btn--gold m-btn--sm" onclick="ManzilAdminActions.bulkImport()">⤒ Bulk import CSV</button>'
      +     '<button class="m-btn m-btn--ghost m-btn--sm" onclick="ManzilAdminActions.bulk(\'publish\')">▶ Publish</button>'
      +     '<button class="m-btn m-btn--ghost m-btn--sm" onclick="ManzilAdminActions.bulk(\'unpublish\')">⏸ Unpublish</button>'
      +     '<button class="m-btn m-btn--ghost m-btn--sm" onclick="ManzilAdminActions.bulk(\'feature\')">⭐ Feature</button>'
      +     '<button class="m-btn m-btn--ghost m-btn--sm" onclick="ManzilAdminActions.bulk(\'verify\')">✓ Verify</button>'
      +     '<button class="m-btn m-btn--ghost m-btn--sm" onclick="ManzilAdminActions.bulk(\'delete\')">× Delete</button>'
      +     '<button class="m-btn m-btn--ghost m-btn--sm" onclick="ManzilAdminActions.exportListings()">⤓ CSV</button>'
      +   '</div>'
      + '</div>'
      + '<div class="m-flex-wrap m-mt-2">'
      +   '<input id="lst-q" class="m-input" placeholder="Search title or address" style="max-width:280px;" />'
      +   '<select id="lst-status" class="m-select">'
      +     '<option value="">All statuses</option><option value="active">Active</option><option value="draft">Draft</option><option value="pending">Pending</option><option value="sold">Sold</option><option value="rented">Rented</option><option value="expired">Expired</option>'
      +   '</select>'
      +   '<span id="lst-count" class="m-text-muted" style="margin-inline-start:auto;font-size:13px;"></span>'
      + '</div>'
      + '<div class="m-panel m-mt-2" style="padding:0;overflow:auto;">'
      +   '<table class="m-table"><thead><tr><th><input type="checkbox" id="lst-all" /></th><th>Photo</th><th>Title</th><th>Price</th><th>Beds/Baths</th><th>Type</th><th>Status</th><th>Agent</th><th></th></tr></thead><tbody id="lst-tbody"></tbody></table>'
      + '</div>';

    document.getElementById('lst-q').addEventListener('input', ManzilApp.debounce(function (e) { qStr = e.target.value; refresh(); }, 200));
    document.getElementById('lst-status').addEventListener('change', function (e) { statusFilter = e.target.value; refresh(); });
    document.getElementById('lst-all').addEventListener('change', function (e) {
      document.querySelectorAll('.lst-check').forEach(function (c) { c.checked = e.target.checked; });
    });
    refresh();

    window.ManzilAdminActions = window.ManzilAdminActions || {};
    window.ManzilAdminActions.exportListings = function () {
      ManzilApp.api('/admin/listings').then(function (r) {
        downloadCsv(r.items.map(function (l) {
          var ag = d.AGENTS.find(function (x) { return x.id === l.agent_id; }) || {};
          return { id: l.id, title: l.title, status: l.status, price_aed: l.price_aed, beds: l.beds, baths: l.baths, sqft: l.sqft, type: l.type, area: (d.AREAS.find(function(a){return a.id===l.area_id;})||{}).name, agent: ag.name, listed_at: l.listed_at };
        }), 'manzil-listings.csv');
      });
    };
    window.ManzilAdminActions.newListing = function () {
      var f = {
        fields: [
          { name: 'title', label: 'Title', value: '' },
          { name: 'transaction', label: 'Transaction', type: 'select', options: ['buy','rent','off-plan'] },
          { name: 'type', label: 'Type', type: 'select', options: ['apartment','villa','townhouse','penthouse','studio','office'] },
          { name: 'area_id', label: 'Area', type: 'select', options: d.AREAS.map(function (a) { return { value: a.id, label: a.name }; }) },
          { name: 'agent_id', label: 'Agent', type: 'select', options: d.AGENTS.map(function (a) { return { value: a.id, label: a.name }; }) },
          { name: 'price_aed', label: 'Price (AED)', type: 'number' },
          { name: 'beds', label: 'Beds', type: 'number', value: 1 },
          { name: 'baths', label: 'Baths', type: 'number', value: 1 },
          { name: 'sqft', label: 'Size (ft²)', type: 'number' },
          { name: 'address', label: 'Address' },
          { name: 'completion_status', label: 'Completion', type: 'select', options: ['ready','off-plan'] },
          { name: 'furnished', label: 'Furnished', type: 'checkbox' },
          { name: 'featured', label: 'Featured', type: 'checkbox' },
          { name: 'verified', label: 'Verified', type: 'checkbox', value: true },
          { name: 'amenities', label: 'Amenities', type: 'multi-select', options: d.AMENITIES.slice(0, 18).map(function (a) { return { value: a.id, label: a.icon + ' ' + a.label }; }) },
          { name: 'photos', label: 'Photo URLs', type: 'image-url-list', value: [] },
          { name: 'description', label: 'Description', type: 'textarea' },
          { name: 'status', label: 'Status', type: 'select', options: ['active','draft','pending'], value: 'active' }
        ],
        title: 'New listing',
        onSubmit: function (body, close) {
          ['price_aed','beds','baths','sqft'].forEach(function (k) { body[k] = Number(body[k] || 0); });
          ManzilApp.api('/admin/listings', { method: 'POST', body: body }).then(function () {
            window.toast('Listing created', 'success'); close(); refresh();
          });
        }
      };
      formModal(f);
    };
    window.ManzilAdminActions.editListing = function (id) {
      ManzilApp.api('/admin/listings/' + id).then(function (r) {
        var l = r.listing;
        formModal({
          title: 'Edit listing - ' + l.id,
          fields: [
            { name: 'title', label: 'Title', value: l.title },
            { name: 'price_aed', label: 'Price (AED)', type: 'number', value: l.price_aed },
            { name: 'status', label: 'Status', type: 'select', options: ['active','draft','pending','sold','rented','expired'], value: l.status },
            { name: 'featured', label: 'Featured', type: 'checkbox', value: l.featured },
            { name: 'verified', label: 'Verified', type: 'checkbox', value: l.verified },
            { name: 'description', label: 'Description', type: 'textarea', value: l.description }
          ],
          onSubmit: function (body, close) {
            body.price_aed = Number(body.price_aed);
            ManzilApp.api('/admin/listings/' + id, { method: 'PUT', body: body }).then(function () {
              window.toast('Updated', 'success'); close(); refresh();
            });
          }
        });
      });
    };
    window.ManzilAdminActions.deleteListing = function (id, label) {
      confirmDel(label, function () {
        ManzilApp.api('/admin/listings/' + id, { method: 'DELETE' }).then(function () {
          window.toast('Deleted', 'success'); refresh();
        });
      });
    };
    window.ManzilAdminActions.bulk = function (op) {
      var ids = Array.prototype.slice.call(document.querySelectorAll('.lst-check:checked')).map(function (c) { return c.value; });
      if (!ids.length) { window.toast('Select rows first'); return; }
      ManzilApp.api('/admin/listings/bulk', { method: 'POST', body: { op: op, ids: ids } }).then(function () {
        window.toast(op + ' applied to ' + ids.length, 'success'); refresh();
      });
    };

    // ---------- Bulk CSV import ----------
    window.ManzilAdminActions.bulkImport = function () {
      var sample = ''
        + 'title,transaction,type,area_id,agent_id,price_aed,beds,baths,sqft,address,furnished,featured,verified\n'
        + 'Ocean Heights - 2BR Marina View,buy,apartment,a-marina,ag01,1850000,2,3,1240,Marina Walk,false,true,true\n'
        + 'Reem Townhouse - 4BR Family,buy,townhouse,a-ranches,ag13,4200000,4,5,3100,Reem 5,false,false,true\n'
        + 'Burj Vista 2 - 1BR Furnished,rent,apartment,a-downtown,ag06,140000,1,2,820,Downtown Blvd,true,false,true\n';
      ManzilApp.showModal({
        title: 'Bulk import listings from CSV',
        size: 'xl',
        body: ''
          + '<p style="font-size:13px;color:var(--manzil-muted);">Paste CSV rows below. First row is the header. Required columns: <strong>title, transaction, type, area_id, agent_id, price_aed, beds, baths, sqft</strong>. Optional: address, furnished, featured, verified, completion_status, description.</p>'
          + '<textarea id="csv-text" class="m-textarea" rows="10" style="font-family:var(--font-mono);font-size:12px;">' + sample + '</textarea>'
          + '<div class="m-flex m-mt-2"><button class="m-btn m-btn--ghost m-btn--sm" id="csv-preview">Preview rows</button><button class="m-btn m-btn--primary m-btn--sm" id="csv-import">Import</button></div>'
          + '<div id="csv-out" class="m-mt-2"></div>',
        foot: '<button class="m-btn" data-modal-close>Close</button>',
        onMount: function (h, close) {
          function parse() {
            var txt = h.querySelector('#csv-text').value.trim();
            var lines = txt.split(/\r?\n/).filter(Boolean);
            if (lines.length < 2) return { rows: [], errors: ['Need at least a header + one data row.'] };
            var header = splitCsv(lines[0]);
            var errors = [];
            var rows = [];
            for (var i = 1; i < lines.length; i++) {
              var fields = splitCsv(lines[i]);
              var row = {};
              for (var k = 0; k < header.length; k++) row[header[k]] = fields[k];
              ['title','transaction','type','area_id','agent_id','price_aed','beds','baths','sqft'].forEach(function (k) {
                if (!row[k]) errors.push('Row ' + i + ': missing ' + k);
              });
              ['price_aed','beds','baths','sqft'].forEach(function (k) {
                if (row[k] != null && row[k] !== '') row[k] = Number(row[k]);
              });
              ['furnished','featured','verified'].forEach(function (k) {
                if (row[k] != null && row[k] !== '') row[k] = String(row[k]).toLowerCase() === 'true';
              });
              rows.push(row);
            }
            return { rows: rows, errors: errors };
          }
          function splitCsv(line) {
            var out = []; var cur = ''; var inQuote = false;
            for (var i = 0; i < line.length; i++) {
              var ch = line[i];
              if (ch === '"') { inQuote = !inQuote; continue; }
              if (ch === ',' && !inQuote) { out.push(cur.trim()); cur = ''; continue; }
              cur += ch;
            }
            out.push(cur.trim());
            return out;
          }
          h.querySelector('#csv-preview').addEventListener('click', function () {
            var p = parse();
            var out = h.querySelector('#csv-out');
            if (p.errors.length) {
              out.innerHTML = '<div style="background:rgba(217,107,92,.10);padding:10px;border-radius:8px;color:var(--manzil-rose-2);font-size:12px;"><strong>Validation issues:</strong><ul style="margin:6px 0 0 16px;">' + p.errors.slice(0, 12).map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul></div>';
              return;
            }
            out.innerHTML = '<div style="font-size:13px;"><strong>' + p.rows.length + ' rows parsed.</strong> Sample:</div>'
              + '<table class="m-table m-mt-1"><thead><tr><th>Title</th><th>Tx</th><th>Type</th><th>Area</th><th>Agent</th><th>Price</th><th>Beds</th></tr></thead><tbody>'
              + p.rows.slice(0, 5).map(function (r) {
                  return '<tr><td>' + esc(r.title) + '</td><td>' + esc(r.transaction) + '</td><td>' + esc(r.type) + '</td><td>' + esc(r.area_id) + '</td><td>' + esc(r.agent_id) + '</td><td>' + (r.price_aed || 0).toLocaleString() + '</td><td>' + (r.beds || 0) + '</td></tr>';
                }).join('')
              + '</tbody></table>';
          });
          h.querySelector('#csv-import').addEventListener('click', function () {
            var p = parse();
            if (p.errors.length) { window.toast('Fix validation errors first', 'error'); return; }
            if (!p.rows.length) { window.toast('No rows to import'); return; }
            var done = 0, total = p.rows.length;
            p.rows.forEach(function (row) {
              ManzilApp.api('/admin/listings', { method: 'POST', body: row }).then(function () {
                done++;
                if (done === total) {
                  window.toast('Imported ' + total + ' listings', 'success');
                  close(); refresh();
                }
              });
            });
          });
        }
      });
    };
  }

  // ====================== 3. INQUIRIES ======================
  function inquiries(host) {
    var statusFilter = '';
    var scoreFilter = ''; // '', 'hot' (4-5), 'warm' (3), 'cold' (1-2)
    var activeId = null;

    function scoreClass(s) { return s >= 4 ? 'hot' : s === 3 ? 'warm' : 'cold'; }
    function scoreLabel(s) { return s >= 4 ? '🔥 hot' : s === 3 ? '◐ warm' : '🧊 cold'; }
    function scoreBg(s) {
      if (s >= 4) return 'background:rgba(217,107,92,.18);color:var(--manzil-rose-2)';
      if (s === 3) return 'background:rgba(201,160,73,.20);color:var(--manzil-accent-2)';
      return 'background:rgba(58,123,213,.18);color:var(--manzil-sky-2)';
    }

    function refresh() {
      var qs = {};
      if (statusFilter) qs.status = statusFilter;
      ManzilApp.api('/admin/inquiries' + ManzilApp.buildQs(qs)).then(function (r) {
        var rows = r.items;
        if (scoreFilter) {
          rows = rows.filter(function (q) {
            var s = q.lead_score || 3;
            if (scoreFilter === 'hot')  return s >= 4;
            if (scoreFilter === 'warm') return s === 3;
            if (scoreFilter === 'cold') return s <= 2;
            return true;
          });
        }
        document.getElementById('iq-count').textContent = rows.length + ' inquiries';
        document.getElementById('iq-list').innerHTML = rows.length ? rows.map(function (q) {
          var l = d.LISTINGS.find(function (x) { return x.id === q.listing_id; }) || {};
          var s = q.lead_score || 3;
          return '<div class="m-inbox-item' + (q.id === activeId ? ' active' : '') + '" data-id="' + q.id + '">'
            + '<div class="name">' + esc(q.name || 'Anonymous')
            +   ' <span class="m-chip ' + q.status + '" style="margin-inline-start:6px;">' + q.status + '</span>'
            +   ' <span class="m-chip" style="' + scoreBg(s) + '">' + scoreLabel(s) + '</span>'
            + '</div>'
            + '<div class="preview m-truncate">' + esc(l.title || '-') + ' · ' + q.kind + '</div>'
            + '<div class="when">' + ManzilApp.relDate(q.created_at) + '</div>'
            + '</div>';
        }).join('') : '<div class="m-empty"><p>No inquiries match.</p></div>';
        document.querySelectorAll('#iq-list [data-id]').forEach(function (el) {
          el.addEventListener('click', function () { activeId = el.getAttribute('data-id'); refresh(); openDetail(); });
        });
        if (activeId) openDetail();
      });
    }

    function openDetail() {
      ManzilApp.api('/admin/inquiries').then(function (r) {
        var q = r.items.find(function (x) { return x.id === activeId; });
        if (!q) return;
        var l = d.LISTINGS.find(function (x) { return x.id === q.listing_id; }) || {};
        var ag = d.AGENTS.find(function (x) { return x.id === q.agent_id; }) || {};
        var pipe = ['new','contacted','scheduled','negotiating','won','lost'];
        var idx = pipe.indexOf(q.status);
        var score = q.lead_score || 3;

        // Build the unified activity timeline.
        var events = [];
        events.push({ when: q.created_at, icon: '📩', title: 'Inquiry received', body: 'Via ' + q.kind + (q.message ? ': ' + q.message : '') });
        (q.messages || []).forEach(function (m) {
          events.push({ when: m.when, icon: m.from === 'agent' ? '📤' : '💬', title: m.from === 'agent' ? 'Agent replied' : 'Customer message', body: m.body });
        });
        (q.notes || []).forEach(function (n) {
          events.push({ when: n.when, icon: '📝', title: 'Internal note', body: n.body, internal: true });
        });
        (q.history || []).forEach(function (h) {
          if (h.kind === 'status_change') events.push({ when: h.when, icon: '🔄', title: 'Status changed', body: h.from + ' → ' + h.to });
          else if (h.kind === 'assign')   events.push({ when: h.when, icon: '👤', title: 'Reassigned', body: 'To ' + ((d.AGENTS.find(function (a) { return a.id === h.agent_id; }) || {}).name || h.agent_id) });
          else if (h.kind === 'score')    events.push({ when: h.when, icon: '🌡', title: 'Lead score updated', body: 'Set to ' + h.value + '/5' });
        });
        events.sort(function (a, b) { return new Date(b.when) - new Date(a.when); });

        document.getElementById('iq-detail').innerHTML = ''
          + '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;">'
          +   '<div><h3 style="margin:0;">' + esc(q.name) + '</h3>'
          +   '<div class="m-text-muted" style="font-size:12px;">' + esc(q.email || '') + ' · ' + esc(q.phone || '') + '</div></div>'
          +   '<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">'
          +     '<select class="m-select" id="iq-status">' + pipe.map(function (s) { return '<option value="' + s + '"' + (s === q.status ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>'
          +     '<select class="m-select" id="iq-assign">' + d.AGENTS.map(function (a) { return '<option value="' + a.id + '"' + (a.id === q.agent_id ? ' selected' : '') + '>' + a.name + '</option>'; }).join('') + '</select>'
          +   '</div>'
          + '</div>'

          + '<div class="m-mt-2" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'
          +   '<span class="m-text-muted" style="font-size:12px;">Lead score:</span>'
          +   [1,2,3,4,5].map(function (n) {
              return '<button type="button" class="m-btn m-btn--sm' + (n === score ? '' : ' m-btn--ghost') + '" data-score="' + n + '" style="' + (n === score ? scoreBg(n) : '') + '">' + n + '</button>';
            }).join('')
          +   '<span style="margin-inline-start:6px;font-size:12px;font-weight:600;color:' + (score >= 4 ? 'var(--manzil-rose-2)' : score === 3 ? 'var(--manzil-accent-2)' : 'var(--manzil-sky-2)') + ';">' + scoreLabel(score) + '</span>'
          + '</div>'

          + '<div class="m-pipeline m-mt-2">' + pipe.map(function (s, i) {
              var cls = i === idx ? 'active' : (i < idx ? 'done' : '');
              return '<div class="m-pipe-step ' + cls + '">' + s + '</div>';
            }).join('') + '</div>'

          + '<div class="m-mt-2" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:10px;background:#fafaf6;border-radius:8px;font-size:13px;">'
          +   '<div><strong>Listing:</strong><br/><a href="listing.html?id=' + q.listing_id + '" target="_blank" rel="noopener">' + esc(l.title || '-') + '</a><br/><span class="m-text-muted">' + fmtAED(l.price_aed || 0) + '</span></div>'
          +   '<div><strong>Agent:</strong><br/>' + esc(ag.name || '-') + '<br/><span class="m-text-muted">' + esc(ag.specialisation || '') + '</span></div>'
          + '</div>'

          + '<div class="m-mt-3"><strong style="font-size:14px;">Activity timeline</strong><div style="margin-top:8px;border-inline-start:2px solid var(--manzil-line);padding-inline-start:14px;display:grid;gap:10px;max-height:280px;overflow-y:auto;">'
          +   events.map(function (ev) {
              return '<div style="position:relative;font-size:13px;">'
                + '<span style="position:absolute;inset-inline-start:-23px;top:2px;width:18px;height:18px;background:white;border:2px solid var(--manzil-primary);border-radius:999px;display:grid;place-items:center;font-size:10px;">' + ev.icon + '</span>'
                + '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;">'
                +   '<strong>' + esc(ev.title) + '</strong>'
                +   '<span class="m-text-muted" style="font-size:11px;font-family:var(--font-mono);">' + ManzilApp.relDate(ev.when) + '</span>'
                + '</div>'
                + '<div class="' + (ev.internal ? 'm-text-muted' : '') + '" style="margin-top:2px;font-size:12px;">' + esc(ev.body) + '</div>'
                + '</div>';
            }).join('')
          + '</div></div>'

          + '<div class="m-flex m-mt-3"><input class="m-input" id="iq-note" placeholder="Add an internal note..." style="flex:1;" /><button class="m-btn m-btn--primary m-btn--sm" id="iq-note-add">Save note</button></div>'

          + '<div class="m-mt-2" style="display:flex;gap:8px;flex-wrap:wrap;">'
          +   '<a class="m-btn m-btn--ghost m-btn--sm" href="mailto:' + esc(q.email || '') + '?subject=' + encodeURIComponent('Re: ' + (l.title || 'your inquiry')) + '">✉ Email customer</a>'
          +   '<a class="m-btn m-btn--ghost m-btn--sm" href="tel:' + esc(q.phone || '') + '">📞 Call</a>'
          +   (q.phone ? '<a class="m-btn m-btn--ghost m-btn--sm" href="https://wa.me/' + (q.phone || '').replace(/[^0-9]/g,'') + '" target="_blank" rel="noopener">💬 WhatsApp</a>' : '')
          + '</div>';

        document.getElementById('iq-status').addEventListener('change', function (e) {
          ManzilApp.api('/admin/inquiries/' + q.id, { method: 'PUT', body: { status: e.target.value } }).then(function () { window.toast('Status updated', 'success'); refresh(); openDetail(); });
        });
        document.getElementById('iq-assign').addEventListener('change', function (e) {
          ManzilApp.api('/admin/inquiries/' + q.id, { method: 'PUT', body: { agent_id: e.target.value } }).then(function () { window.toast('Reassigned', 'success'); refresh(); openDetail(); });
        });
        document.getElementById('iq-note-add').addEventListener('click', function () {
          var v = document.getElementById('iq-note').value.trim();
          if (!v) return;
          ManzilApp.api('/admin/inquiries/' + q.id, { method: 'PUT', body: { note: v } }).then(function () { window.toast('Note saved', 'success'); refresh(); openDetail(); });
        });
        document.querySelectorAll('#iq-detail [data-score]').forEach(function (b) {
          b.addEventListener('click', function () {
            var v = Number(b.getAttribute('data-score'));
            ManzilApp.api('/admin/inquiries/' + q.id, { method: 'PUT', body: { lead_score: v } }).then(function () { window.toast('Lead scored ' + v + '/5', 'success'); refresh(); openDetail(); });
          });
        });
      });
    }

    host.innerHTML = ''
      + '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;"><h2 style="margin:0;">Inquiries</h2>'
      +   '<div class="m-flex-wrap">'
      +     '<select id="iq-filter" class="m-select"><option value="">All statuses</option><option value="new">New</option><option value="contacted">Contacted</option><option value="scheduled">Scheduled</option><option value="negotiating">Negotiating</option><option value="won">Won</option><option value="lost">Lost</option></select>'
      +     '<select id="iq-score" class="m-select"><option value="">Any score</option><option value="hot">🔥 Hot (4–5)</option><option value="warm">◐ Warm (3)</option><option value="cold">🧊 Cold (1–2)</option></select>'
      +     '<span id="iq-count" class="m-text-muted" style="font-size:13px;align-self:center;"></span>'
      +     '<button class="m-btn m-btn--ghost m-btn--sm" onclick="ManzilAdminActions.exportInquiries()">⤓ CSV</button>'
      +   '</div>'
      + '</div>'
      + '<div class="m-inbox m-mt-2">'
      +   '<div class="m-inbox-list" id="iq-list"></div>'
      +   '<div class="m-inbox-detail" id="iq-detail"><div class="m-empty"><p>Select an inquiry on the left to see its timeline and reply tools.</p></div></div>'
      + '</div>';

    document.getElementById('iq-filter').addEventListener('change', function (e) { statusFilter = e.target.value; refresh(); });
    document.getElementById('iq-score').addEventListener('change', function (e) { scoreFilter = e.target.value; refresh(); });
    refresh();

    window.ManzilAdminActions = window.ManzilAdminActions || {};
    window.ManzilAdminActions.exportInquiries = function () {
      ManzilApp.api('/admin/inquiries').then(function (r) {
        downloadCsv(r.items.map(function (q) {
          var l = d.LISTINGS.find(function (x) { return x.id === q.listing_id; }) || {};
          return { id: q.id, listing: l.title || q.listing_id, kind: q.kind, status: q.status, name: q.name, email: q.email, phone: q.phone, created_at: q.created_at };
        }), 'manzil-inquiries.csv');
      });
    };
  }

  // ====================== 4. VIEWINGS ======================
  function viewings(host) {
    function refresh() {
      ManzilApp.api('/admin/viewings').then(function (r) {
        var rows = r.items;
        // Build calendar grid for current month
        var now = new Date(); now.setDate(1);
        var year = now.getFullYear(); var month = now.getMonth();
        var firstDay = new Date(year, month, 1).getDay();
        var daysInMonth = new Date(year, month + 1, 0).getDate();
        var dayCells = [];
        for (var i = 0; i < firstDay; i++) dayCells.push({ num: '', events: [] });
        for (var dx = 1; dx <= daysInMonth; dx++) {
          var dt = new Date(year, month, dx);
          var evs = rows.filter(function (v) { var x = new Date(v.scheduled_at); return x.getFullYear() === year && x.getMonth() === month && x.getDate() === dx; });
          dayCells.push({ num: dx, events: evs });
        }

        document.getElementById('vw-cal').innerHTML = ''
          + '<div class="m-cal">'
          +   ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(function (d) { return '<div style="text-align:center;font-size:11px;color:var(--manzil-muted);padding:4px 0;">' + d + '</div>'; }).join('')
          +   dayCells.map(function (c) {
                if (!c.num) return '<div class="m-cal-day" style="visibility:hidden;"></div>';
                return '<div class="m-cal-day' + (c.events.length ? ' has-events' : '') + '">'
                  + '<div class="num">' + c.num + '</div>'
                  + c.events.slice(0, 2).map(function (v) {
                      var l = d.LISTINGS.find(function (x) { return x.id === v.listing_id; }) || {};
                      return '<div class="ev" title="' + esc(l.title || '') + '">' + new Date(v.scheduled_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) + '</div>';
                    }).join('')
                  + (c.events.length > 2 ? '<div class="m-text-muted" style="font-size:9px;">+' + (c.events.length - 2) + '</div>' : '')
                  + '</div>';
              }).join('')
          + '</div>';

        document.getElementById('vw-tbody').innerHTML = rows.length ? rows.map(function (v) {
          var l = d.LISTINGS.find(function (x) { return x.id === v.listing_id; }) || {};
          var ag = d.AGENTS.find(function (x) { return x.id === v.agent_id; }) || {};
          return '<tr>'
            + '<td>' + fmtDT(v.scheduled_at) + '</td>'
            + '<td>' + esc(l.title || '') + '</td>'
            + '<td>' + esc(ag.name || '') + '</td>'
            + '<td><span class="m-chip ' + v.status + '">' + v.status + '</span></td>'
            + '<td class="m-table-actions">'
            +   '<button class="m-btn m-btn--ghost m-btn--sm" onclick="ManzilAdminActions.viewingStatus(\'' + v.id + '\',\'confirmed\')">✓ Confirm</button>'
            +   '<button class="m-btn m-btn--ghost m-btn--sm" onclick="ManzilAdminActions.viewingStatus(\'' + v.id + '\',\'done\')">Done</button>'
            +   '<button class="m-btn m-btn--ghost m-btn--sm" onclick="ManzilAdminActions.viewingStatus(\'' + v.id + '\',\'cancelled\')">× Cancel</button>'
            + '</td>'
            + '</tr>';
        }).join('') : '<tr><td colspan="5" class="m-table-empty">No viewings scheduled.</td></tr>';
      });
    }

    host.innerHTML = ''
      + '<h2>Viewings</h2>'
      + '<div class="m-grid m-grid-2 m-mt-2">'
      +   '<div class="m-panel"><h3 style="margin-top:0;">Calendar - ' + new Date().toLocaleString('en', { month: 'long', year: 'numeric' }) + '</h3><div id="vw-cal"></div></div>'
      +   '<div class="m-panel" style="padding:0;overflow:auto;"><div style="padding:16px;"><h3 style="margin:0;">Schedule</h3></div><table class="m-table"><thead><tr><th>When</th><th>Listing</th><th>Agent</th><th>Status</th><th></th></tr></thead><tbody id="vw-tbody"></tbody></table></div>'
      + '</div>';
    refresh();

    window.ManzilAdminActions = window.ManzilAdminActions || {};
    window.ManzilAdminActions.viewingStatus = function (id, st) {
      ManzilApp.api('/admin/viewings/' + id, { method: 'PUT', body: { status: st } }).then(function () { window.toast('Updated', 'success'); refresh(); });
    };
  }

  // ====================== 5. AGENTS ======================
  function agents(host) {
    function refresh() {
      ManzilApp.api('/admin/agents').then(function (r) {
        var rows = r.items;
        document.getElementById('ag-tbody').innerHTML = rows.length ? rows.map(function (a) {
          var ag = d.AGENCIES.find(function (x) { return x.id === a.agency_id; }) || {};
          var lst = d.LISTINGS.filter(function (l) { return l.agent_id === a.id && l.status === 'active'; }).length;
          return '<tr>'
            + '<td><img src="' + a.photo_url + '" alt="" style="width:36px;height:36px;object-fit:cover;border-radius:999px;" /></td>'
            + '<td><strong>' + esc(a.name) + '</strong><div class="m-text-muted" style="font-size:11px;">' + a.id + '</div></td>'
            + '<td>' + esc(ag.name || '') + '</td>'
            + '<td>' + esc(a.specialisation || '') + '</td>'
            + '<td>' + (a.languages || []).join(', ') + '</td>'
            + '<td>' + a.years_exp + ' yrs</td>'
            + '<td>' + a.rating + ' <span style="color:var(--manzil-accent)">★</span></td>'
            + '<td>' + lst + ' active</td>'
            + '<td class="m-table-actions"><button class="m-btn m-btn--ghost m-btn--sm" onclick="ManzilAdminActions.editAgent(\'' + a.id + '\')">Edit</button><button class="m-btn m-btn--ghost m-btn--sm" onclick="ManzilAdminActions.deleteAgent(\'' + a.id + '\',\'' + esc(a.name) + '\')">×</button></td>'
            + '</tr>';
        }).join('') : '<tr><td colspan="9" class="m-table-empty">No agents.</td></tr>';
      });
    }

    host.innerHTML = ''
      + '<div style="display:flex;justify-content:space-between;align-items:center;"><h2>Agents</h2>'
      +   '<div><button class="m-btn m-btn--primary m-btn--sm" onclick="ManzilAdminActions.newAgent()">+ New agent</button> '
      +   '<button class="m-btn m-btn--ghost m-btn--sm" onclick="ManzilAdminActions.exportAgents()">⤓ CSV</button></div>'
      + '</div>'
      + '<div class="m-panel m-mt-2" style="padding:0;overflow:auto;">'
      +   '<table class="m-table"><thead><tr><th></th><th>Name</th><th>Agency</th><th>Specialisation</th><th>Languages</th><th>Experience</th><th>Rating</th><th>Listings</th><th></th></tr></thead><tbody id="ag-tbody"></tbody></table>'
      + '</div>';
    refresh();

    window.ManzilAdminActions = window.ManzilAdminActions || {};
    window.ManzilAdminActions.exportAgents = function () {
      ManzilApp.api('/admin/agents').then(function (r) {
        downloadCsv(r.items.map(function (a) {
          var ag = d.AGENCIES.find(function (x) { return x.id === a.agency_id; }) || {};
          return { id: a.id, name: a.name, agency: ag.name, specialisation: a.specialisation, languages: (a.languages||[]).join('|'), years_exp: a.years_exp, rating: a.rating, deals: a.deals_closed, email: a.email };
        }), 'manzil-agents.csv');
      });
    };
    window.ManzilAdminActions.newAgent = function () {
      formModal({
        title: 'New agent',
        fields: [
          { name: 'name', label: 'Full name' },
          { name: 'agency_id', label: 'Agency', type: 'select', options: d.AGENCIES.map(function (g) { return { value: g.id, label: g.name }; }) },
          { name: 'specialisation', label: 'Specialisation' },
          { name: 'years_exp', label: 'Years experience', type: 'number', value: 3 },
          { name: 'rating', label: 'Rating (0–5)', type: 'number', value: 4.5 },
          { name: 'phone', label: 'Phone' },
          { name: 'email', label: 'Email' },
          { name: 'bio', label: 'Bio', type: 'textarea' }
        ],
        onSubmit: function (body, close) {
          body.years_exp = Number(body.years_exp); body.rating = Number(body.rating);
          body.languages = ['English'];
          ManzilApp.api('/admin/agents', { method: 'POST', body: body }).then(function () { window.toast('Agent created', 'success'); close(); refresh(); });
        }
      });
    };
    window.ManzilAdminActions.editAgent = function (id) {
      ManzilApp.api('/admin/agents/' + id).then(function (r) {
        var a = r.agent;
        formModal({
          title: 'Edit ' + a.name,
          fields: [
            { name: 'name', label: 'Full name', value: a.name },
            { name: 'specialisation', label: 'Specialisation', value: a.specialisation },
            { name: 'years_exp', label: 'Years experience', type: 'number', value: a.years_exp },
            { name: 'rating', label: 'Rating', type: 'number', value: a.rating },
            { name: 'bio', label: 'Bio', type: 'textarea', value: a.bio || '' }
          ],
          onSubmit: function (body, close) {
            body.years_exp = Number(body.years_exp); body.rating = Number(body.rating);
            ManzilApp.api('/admin/agents/' + id, { method: 'PUT', body: body }).then(function () { window.toast('Updated', 'success'); close(); refresh(); });
          }
        });
      });
    };
    window.ManzilAdminActions.deleteAgent = function (id, label) {
      confirmDel(label, function () {
        ManzilApp.api('/admin/agents/' + id, { method: 'DELETE' }).then(function () { window.toast('Deleted', 'success'); refresh(); });
      });
    };
  }

  // ====================== 6. AGENCIES ======================
  function agencies(host) {
    function refresh() {
      ManzilApp.api('/admin/agencies').then(function (r) {
        document.getElementById('ag2-grid').innerHTML = r.items.map(function (g) {
          var a = d.AGENTS.filter(function (x) { return x.agency_id === g.id; }).length;
          var l = d.LISTINGS.filter(function (x) { return x.agency_id === g.id && x.status === 'active'; }).length;
          return '<div class="m-card" style="padding:16px;">'
            + '<h3 style="margin:0 0 4px;">' + esc(g.name) + '</h3>'
            + '<div class="m-text-muted" style="font-size:12px;">Permit ' + esc(g.license_no) + ' · Since ' + g.founded + '</div>'
            + '<div class="m-flex-wrap m-mt-1">' + (g.specialties || []).map(function (s) { return '<span class="m-chip">' + esc(s) + '</span>'; }).join('') + '</div>'
            + '<div class="m-flex-wrap m-mt-1"><span class="m-chip">' + a + ' agents</span><span class="m-chip">' + l + ' listings</span></div>'
            + '<div class="m-mt-2"><button class="m-btn m-btn--ghost m-btn--sm" onclick="ManzilAdminActions.editAgency(\'' + g.id + '\')">Edit</button> <button class="m-btn m-btn--ghost m-btn--sm" onclick="ManzilAdminActions.deleteAgency(\'' + g.id + '\',\'' + esc(g.name) + '\')">× Delete</button></div>'
            + '</div>';
        }).join('');
      });
    }

    host.innerHTML = ''
      + '<div style="display:flex;justify-content:space-between;align-items:center;"><h2>Agencies</h2>'
      +   '<button class="m-btn m-btn--primary m-btn--sm" onclick="ManzilAdminActions.newAgency()">+ New agency</button>'
      + '</div>'
      + '<div class="m-grid m-grid-3 m-mt-2" id="ag2-grid"></div>';
    refresh();

    window.ManzilAdminActions = window.ManzilAdminActions || {};
    window.ManzilAdminActions.newAgency = function () {
      formModal({
        title: 'New agency',
        fields: [
          { name: 'name', label: 'Agency name' },
          { name: 'license_no', label: 'Permit number', value: 'RERA-' + Math.floor(Math.random() * 9000 + 1000) },
          { name: 'founded', label: 'Founded year', type: 'number', value: new Date().getFullYear() },
          { name: 'specialties', label: 'Specialties (comma)', placeholder: 'Marina, JBR' }
        ],
        onSubmit: function (body, close) {
          body.founded = Number(body.founded);
          body.specialties = (body.specialties || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
          ManzilApp.api('/admin/agencies', { method: 'POST', body: body }).then(function () { window.toast('Created', 'success'); close(); refresh(); });
        }
      });
    };
    window.ManzilAdminActions.editAgency = function (id) {
      ManzilApp.api('/admin/agencies').then(function (r) {
        var g = r.items.find(function (x) { return x.id === id; }); if (!g) return;
        formModal({
          title: 'Edit ' + g.name,
          fields: [
            { name: 'name', label: 'Name', value: g.name },
            { name: 'license_no', label: 'Permit', value: g.license_no },
            { name: 'founded', label: 'Founded', type: 'number', value: g.founded },
            { name: 'specialties', label: 'Specialties (comma)', value: (g.specialties || []).join(', ') }
          ],
          onSubmit: function (body, close) {
            body.founded = Number(body.founded);
            body.specialties = (body.specialties || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
            ManzilApp.api('/admin/agencies/' + id, { method: 'PUT', body: body }).then(function () { window.toast('Updated', 'success'); close(); refresh(); });
          }
        });
      });
    };
    window.ManzilAdminActions.deleteAgency = function (id, label) {
      confirmDel(label, function () {
        ManzilApp.api('/admin/agencies/' + id, { method: 'DELETE' }).then(function () { window.toast('Deleted', 'success'); refresh(); });
      });
    };
  }

  // ====================== 7. CUSTOMERS ======================
  function customers(host) {
    ManzilApp.api('/admin/customers').then(function (r) {
      host.innerHTML = ''
        + '<div style="display:flex;justify-content:space-between;align-items:center;"><h2>Customers</h2>'
        +   '<button class="m-btn m-btn--ghost m-btn--sm" onclick="ManzilAdminActions.exportCustomers()">⤓ CSV</button>'
        + '</div>'
        + '<div class="m-panel m-mt-2" style="padding:0;overflow:auto;">'
        +   '<table class="m-table"><thead><tr><th>Name</th><th>Email</th><th>Joined</th><th>Locale</th><th>Favorites</th><th>Searches</th><th>Inquiries</th><th>Segment</th></tr></thead><tbody>'
        +     r.items.map(function (c) {
                var inq = c.inquiries_count || 0;
                var seg = inq >= 4 ? 'VIP' : inq >= 1 ? 'returning' : 'new';
                return '<tr><td>' + esc(c.name) + '</td><td>' + esc(c.email) + '</td><td>' + esc(c.joined) + '</td><td>' + c.locale.toUpperCase() + '</td><td>' + (c.favorites || []).length + '</td><td>' + (c.saved_searches || []).length + '</td><td>' + inq + '</td><td><span class="m-chip">' + seg + '</span></td></tr>';
              }).join('')
        +   '</tbody></table>'
        + '</div>';
      window.ManzilAdminActions = window.ManzilAdminActions || {};
      window.ManzilAdminActions.exportCustomers = function () {
        downloadCsv(r.items.map(function (c) {
          return { id: c.id, name: c.name, email: c.email, joined: c.joined, locale: c.locale, currency: c.currency, favorites: (c.favorites||[]).length, saved_searches: (c.saved_searches||[]).length, inquiries: c.inquiries_count || 0 };
        }), 'manzil-customers.csv');
      };
    });
  }

  // ====================== 8. ANALYTICS ======================
  function analytics(host) {
    ManzilApp.api('/admin/analytics').then(function (r) {
      var maxView = Math.max.apply(null, r.views_trend.map(function (t) { return t.views; }));
      var maxSrc = Math.max.apply(null, r.leads_by_source.map(function (s) { return s.leads; }));
      // line chart points
      var W = 600, H = 220, pad = 30;
      var pts = r.views_trend.map(function (t, i) {
        var x = pad + i * ((W - pad * 2) / (r.views_trend.length - 1));
        var y = H - pad - ((t.views / maxView) * (H - pad * 2));
        return x + ',' + y;
      });
      var areaPts = pts.concat([
        (pad + (r.views_trend.length - 1) * ((W - pad * 2) / (r.views_trend.length - 1))) + ',' + (H - pad),
        pad + ',' + (H - pad)
      ]);

      host.innerHTML = ''
        + '<h2>Analytics</h2>'

        + '<div class="m-panel m-mt-2"><div class="m-panel-head"><h3>Views - last 30 days</h3></div>'
        +   '<svg viewBox="0 0 ' + W + ' ' + H + '" class="m-line-chart" preserveAspectRatio="xMidYMid meet">'
        +     '<line class="axis" x1="' + pad + '" y1="' + (H - pad) + '" x2="' + (W - pad) + '" y2="' + (H - pad) + '"/>'
        +     '<line class="axis" x1="' + pad + '" y1="' + pad + '" x2="' + pad + '" y2="' + (H - pad) + '"/>'
        +     '<polygon class="area" points="' + areaPts.join(' ') + '" />'
        +     '<polyline class="line" points="' + pts.join(' ') + '" />'
        +     pts.map(function (p, i) { if (i % 5 !== 0) return ''; var xy = p.split(','); return '<circle class="dot" cx="' + xy[0] + '" cy="' + xy[1] + '" r="3" />'; }).join('')
        +     '<text class="lbl" x="' + pad + '" y="' + (H - 6) + '">30 days ago</text>'
        +     '<text class="lbl" x="' + (W - pad - 30) + '" y="' + (H - 6) + '">today</text>'
        +   '</svg>'
        + '</div>'

        + '<div class="m-grid m-grid-2 m-mt-3">'
        +   '<div class="m-panel"><div class="m-panel-head"><h3>Leads by source</h3></div><div class="m-funnel">'
        +     r.leads_by_source.map(function (s) {
                return '<div class="m-funnel-row"><div class="lbl">' + esc(s.source) + '</div><div class="bar" style="width:' + Math.max(8, (s.leads / maxSrc) * 100) + '%;">' + s.leads + '</div></div>';
              }).join('')
        +   '</div></div>'
        +   '<div class="m-panel"><div class="m-panel-head"><h3>Conversion funnel</h3></div><div class="m-funnel">'
        +     r.funnel.map(function (s, i) {
                var prev = i === 0 ? r.funnel[0].v : r.funnel[i].v;
                return '<div class="m-funnel-row"><div class="lbl">' + esc(s.step) + '</div><div class="bar" style="width:' + (100 - i * 17) + '%;">' + s.v.toLocaleString() + '</div></div>';
              }).join('')
        +   '</div></div>'
        + '</div>'

        + '<div class="m-panel m-mt-3"><div class="m-panel-head"><h3>Top areas by listing count</h3></div>'
        +   '<table class="m-table"><thead><tr><th>Area</th><th>Active listings</th><th>Avg AED / ft²</th></tr></thead><tbody>'
        +     r.top_areas.map(function (a) { return '<tr><td>' + esc(a.area) + '</td><td>' + a.listings + '</td><td>AED ' + a.avg_aed_sqft.toLocaleString() + '</td></tr>'; }).join('')
        +   '</tbody></table>'
        + '</div>';
    });
  }

  // ====================== 9. PROMOTIONS ======================
  function promotions(host) {
    function refresh() {
      Promise.all([
        ManzilApp.api('/admin/promotions'),
        ManzilApp.api('/admin/banners')
      ]).then(function (results) {
        var promos = results[0].items;
        var banners = results[1].items;
        document.getElementById('promo-list').innerHTML = promos.map(function (p) {
          return '<div class="m-card" style="padding:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">'
            + '<div><strong>' + esc(p.name) + '</strong><div class="m-text-muted" style="font-size:12px;">' + p.listings.length + ' listings · ' + esc(p.starts || '') + ' → ' + esc(p.ends || '') + '</div></div>'
            + '<div class="m-flex-wrap"><span class="m-chip ' + (p.active ? 'active' : 'draft') + '">' + (p.active ? 'Active' : 'Inactive') + '</span><button class="m-btn m-btn--ghost m-btn--sm" onclick="ManzilAdminActions.togglePromo(\'' + p.id + '\')">Toggle</button><button class="m-btn m-btn--ghost m-btn--sm" onclick="ManzilAdminActions.removePromo(\'' + p.id + '\')">×</button></div>'
            + '</div>';
        }).join('');
        document.getElementById('banner-list').innerHTML = banners.map(function (b) {
          return '<div class="m-card" style="padding:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">'
            + '<div><strong>' + esc(b.title) + '</strong><div class="m-text-muted" style="font-size:12px;">' + esc(b.subtitle) + ' · CTA: ' + esc(b.cta) + ' → ' + esc(b.url) + '</div></div>'
            + '<div class="m-flex-wrap"><span class="m-chip ' + (b.active ? 'active' : 'draft') + '">' + (b.active ? 'Active' : 'Inactive') + '</span><button class="m-btn m-btn--ghost m-btn--sm" onclick="ManzilAdminActions.toggleBanner(\'' + b.id + '\')">Toggle</button><button class="m-btn m-btn--ghost m-btn--sm" onclick="ManzilAdminActions.removeBanner(\'' + b.id + '\')">×</button></div>'
            + '</div>';
        }).join('');
      });
    }

    host.innerHTML = ''
      + '<h2>Promotions & banners</h2>'
      + '<div class="m-mt-2"><div style="display:flex;justify-content:space-between;align-items:center;"><h3 style="margin:0;">Featured campaigns</h3><button class="m-btn m-btn--primary m-btn--sm" onclick="ManzilAdminActions.newPromo()">+ New campaign</button></div>'
      +   '<div class="m-grid m-mt-2" id="promo-list"></div>'
      + '</div>'
      + '<div class="m-mt-3"><div style="display:flex;justify-content:space-between;align-items:center;"><h3 style="margin:0;">Homepage banners</h3><button class="m-btn m-btn--primary m-btn--sm" onclick="ManzilAdminActions.newBanner()">+ New banner</button></div>'
      +   '<div class="m-grid m-mt-2" id="banner-list"></div>'
      + '</div>';
    refresh();

    window.ManzilAdminActions = window.ManzilAdminActions || {};
    window.ManzilAdminActions.newPromo = function () {
      formModal({
        title: 'New campaign',
        fields: [
          { name: 'name', label: 'Campaign name' },
          { name: 'starts', label: 'Starts', type: 'date' },
          { name: 'ends', label: 'Ends', type: 'date' },
          { name: 'active', label: 'Active', type: 'checkbox', value: true }
        ],
        onSubmit: function (body, close) {
          ManzilApp.api('/admin/promotions', { method: 'POST', body: Object.assign({ action: 'add' }, body) }).then(function () { window.toast('Created', 'success'); close(); refresh(); });
        }
      });
    };
    window.ManzilAdminActions.togglePromo = function (id) {
      ManzilApp.api('/admin/promotions', { method: 'POST', body: { action: 'toggle', id: id } }).then(refresh);
    };
    window.ManzilAdminActions.removePromo = function (id) {
      ManzilApp.api('/admin/promotions', { method: 'POST', body: { action: 'remove', id: id } }).then(refresh);
    };
    window.ManzilAdminActions.newBanner = function () {
      formModal({
        title: 'New banner',
        fields: [
          { name: 'title', label: 'Title' },
          { name: 'subtitle', label: 'Subtitle' },
          { name: 'cta', label: 'CTA text', value: 'Explore' },
          { name: 'url', label: 'Link URL', value: 'search.html' }
        ],
        onSubmit: function (body, close) {
          ManzilApp.api('/admin/banners', { method: 'POST', body: Object.assign({ action: 'add' }, body) }).then(function () { window.toast('Created', 'success'); close(); refresh(); });
        }
      });
    };
    window.ManzilAdminActions.toggleBanner = function (id) { ManzilApp.api('/admin/banners', { method: 'POST', body: { action: 'toggle', id: id } }).then(refresh); };
    window.ManzilAdminActions.removeBanner = function (id) { ManzilApp.api('/admin/banners', { method: 'POST', body: { action: 'remove', id: id } }).then(refresh); };
  }

  // ====================== 10. CONTENT (CMS) ======================
  function content(host) {
    var activeArea = null;
    function refresh() {
      ManzilApp.api('/admin/content/areas').then(function (r) {
        var overrides = r.overrides || {};
        host.innerHTML = ''
          + '<h2>Content - area guides</h2>'
          + '<p class="m-text-muted">Edit the area blurbs, schools and malls shown on customer-facing area pages. Originals are seed-data; overrides persist locally.</p>'
          + '<div class="m-grid m-grid-2 m-mt-2">'
          +   d.AREAS.map(function (a) {
                var o = overrides[a.id] || {};
                var edited = !!(o.blurb || o.schools || o.malls);
                return '<div class="m-card" style="padding:16px;">'
                  + '<div style="display:flex;justify-content:space-between;align-items:center;"><strong>' + esc(a.name) + '</strong>' + (edited ? '<span class="m-chip active">overridden</span>' : '') + '</div>'
                  + '<p style="font-size:13px;margin:8px 0 0;color:var(--manzil-muted);">' + esc((o.blurb || a.blurb).slice(0, 140)) + '...</p>'
                  + '<button class="m-btn m-btn--ghost m-btn--sm m-mt-2" onclick="ManzilAdminActions.editArea(\'' + a.id + '\')">Edit content</button>'
                  + '</div>';
              }).join('')
          + '</div>';
      });
    }
    refresh();

    window.ManzilAdminActions = window.ManzilAdminActions || {};
    window.ManzilAdminActions.editArea = function (id) {
      var a = d.AREAS.find(function (x) { return x.id === id; });
      formModal({
        title: 'Edit content - ' + a.name,
        fields: [
          { name: 'blurb', label: 'Blurb', type: 'textarea', rows: 4, value: a.blurb },
          { name: 'schools', label: 'Schools (comma)', value: (a.schools || []).join(', ') },
          { name: 'malls', label: 'Malls (comma)', value: (a.malls || []).join(', ') }
        ],
        onSubmit: function (body, close) {
          body.area_id = id;
          body.schools = (body.schools || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
          body.malls = (body.malls || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
          ManzilApp.api('/admin/content/areas', { method: 'POST', body: body }).then(function () { window.toast('Saved', 'success'); close(); refresh(); });
        }
      });
    };
  }

  // ====================== 11. MODERATION ======================
  function moderation(host) {
    function refresh() {
      ManzilApp.api('/admin/moderation').then(function (r) {
        host.innerHTML = ''
          + '<h2>Moderation queue</h2>'
          + '<p class="m-text-muted">User-reported listings and automated fraud signals.</p>'
          + '<div class="m-panel m-mt-2" style="padding:0;overflow:auto;">'
          +   '<table class="m-table"><thead><tr><th>Listing</th><th>Reason</th><th>Severity</th><th>Reported</th><th>Status</th><th></th></tr></thead><tbody>'
          +     r.items.map(function (x) {
                  var l = d.LISTINGS.find(function (y) { return y.id === x.listing_id; }) || {};
                  return '<tr>'
                    + '<td><a href="listing.html?id=' + x.listing_id + '" target="_blank">' + esc(l.title || x.listing_id) + '</a></td>'
                    + '<td>' + esc(x.reason) + '</td>'
                    + '<td><span class="m-chip ' + (x.severity === 'medium' ? 'pending' : 'draft') + '">' + x.severity + '</span></td>'
                    + '<td>' + ManzilApp.relDate(x.reported_at) + '</td>'
                    + '<td><span class="m-chip ' + (x.status === 'resolved' ? 'won' : 'new') + '">' + x.status + '</span></td>'
                    + '<td class="m-table-actions">'
                    +   '<button class="m-btn m-btn--ghost m-btn--sm" onclick="ManzilAdminActions.modDecide(\'' + x.id + '\',\'resolved\')">Resolve</button>'
                    +   '<button class="m-btn m-btn--ghost m-btn--sm" onclick="ManzilAdminActions.modDecide(\'' + x.id + '\',\'dismissed\')">Dismiss</button>'
                    + '</td>'
                    + '</tr>';
                }).join('')
          +   '</tbody></table>'
          + '</div>';
      });
    }
    refresh();
    window.ManzilAdminActions = window.ManzilAdminActions || {};
    window.ManzilAdminActions.modDecide = function (id, status) {
      ManzilApp.api('/admin/moderation', { method: 'POST', body: { id: id, status: status } }).then(function () { window.toast('Marked ' + status, 'success'); refresh(); });
    };
  }

  // ====================== 12. SETTINGS ======================
  function settings(host) {
    ManzilApp.api('/admin/settings').then(function (r) {
      var s = r.settings;
      host.innerHTML = ''
        + '<h2>Settings</h2>'
        + '<div class="m-grid m-grid-2 m-mt-2">'
        +   '<div class="m-panel">'
        +     '<h3 style="margin-top:0;">Currencies</h3>'
        +     '<table class="m-table"><thead><tr><th>Code</th><th>Symbol</th><th>Rate → AED</th></tr></thead><tbody>'
        +       (s.currencies || []).map(function (c) { return '<tr><td>' + c.code + '</td><td>' + c.symbol + '</td><td>' + c.rate_to_aed + '</td></tr>'; }).join('')
        +     '</tbody></table>'
        +     '<p class="m-text-muted" style="font-size:12px;">FX rates are static in demo mode. Default currency: <strong>' + (s.default_currency || 'AED') + '</strong>.</p>'
        +   '</div>'
        +   '<div class="m-panel">'
        +     '<h3 style="margin-top:0;">Commission & fees</h3>'
        +     '<label class="m-field"><span>Agent commission %</span><input class="m-input" id="set-comm" type="number" step="0.1" value="' + (s.commission_pct || 2) + '"></label>'
        +     '<label class="m-field m-mt-1"><span>DLD fee %</span><input class="m-input" id="set-dld" type="number" step="0.1" value="' + (s.rera_fee_pct || 4) + '"></label>'
        +     '<label class="m-field m-mt-1"><span>Contact email</span><input class="m-input" id="set-mail" value="' + esc(s.contact_email || '') + '"></label>'
        +     '<div class="m-mt-2"><button class="m-btn m-btn--primary" id="save-settings">Save changes</button></div>'
        +   '</div>'
        +   '<div class="m-panel">'
        +     '<h3 style="margin-top:0;">Locations master list</h3>'
        +     '<p class="m-text-muted" style="font-size:12px;">15 communities are configured.</p>'
        +     '<table class="m-table"><thead><tr><th>Area</th><th>AED/ft²</th><th>Listings</th></tr></thead><tbody>'
        +       d.AREAS.map(function (a) { return '<tr><td>' + esc(a.name) + '</td><td>' + a.avg_aed_sqft.toLocaleString() + '</td><td>' + d.LISTINGS.filter(function (l) { return l.area_id === a.id && l.status === 'active'; }).length + '</td></tr>'; }).join('')
        +     '</tbody></table>'
        +   '</div>'
        +   '<div class="m-panel">'
        +     '<h3 style="margin-top:0;">Amenities catalog</h3>'
        +     '<p class="m-text-muted" style="font-size:12px;">' + d.AMENITIES.length + ' amenities available for listings.</p>'
        +     '<div class="m-flex-wrap">' + d.AMENITIES.map(function (a) { return '<span class="m-chip">' + a.icon + ' ' + a.label + '</span>'; }).join('') + '</div>'
        +   '</div>'
        + '</div>'
        + '<div class="m-panel m-mt-3">'
        +   '<h3 style="margin-top:0;">Danger zone</h3>'
        +   '<p class="m-text-muted">Reset all local overrides (created listings, edits, deletes, status changes). Seed data is restored.</p>'
        +   '<button class="m-btn" style="background:var(--manzil-rose);color:white;" onclick="ManzilAdminActions.resetDemo()">Reset demo data</button>'
        + '</div>';
      document.getElementById('save-settings').addEventListener('click', function () {
        var body = {
          commission_pct: Number(document.getElementById('set-comm').value),
          rera_fee_pct: Number(document.getElementById('set-dld').value),
          contact_email: document.getElementById('set-mail').value
        };
        ManzilApp.api('/admin/settings', { method: 'POST', body: body }).then(function () { window.toast('Saved', 'success'); });
      });
    });
    window.ManzilAdminActions = window.ManzilAdminActions || {};
    window.ManzilAdminActions.resetDemo = function () {
      modal({
        title: 'Reset demo data',
        body: '<p>This clears all local overrides - created listings, edits, status changes, inquiries, viewings, banners and audit log.</p><p><strong>Seed data is untouched.</strong></p>',
        foot: '<button class="m-btn" data-modal-close>Cancel</button><button class="m-btn" style="background:var(--manzil-rose);color:white;" id="r-go">Reset</button>',
        onMount: function (h, close) {
          h.querySelector('#r-go').addEventListener('click', function () {
            Object.keys(localStorage).forEach(function (k) { if (k.indexOf('manzil.') === 0) localStorage.removeItem(k); });
            window.toast('Reset complete - reloading...', 'success'); close();
            setTimeout(function () { location.reload(); }, 800);
          });
        }
      });
    };
  }

  // ====================== 13. AUDIT ======================
  function audit(host) {
    ManzilApp.api('/admin/audit').then(function (r) {
      host.innerHTML = ''
        + '<h2>Audit log</h2>'
        + '<p class="m-text-muted">Append-only record of admin actions. ' + r.items.length + ' entries.</p>'
        + '<div class="m-panel m-mt-2" style="padding:0;overflow:auto;">'
        +   '<table class="m-table"><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th><th>Details</th></tr></thead><tbody>'
        +     (r.items.length ? r.items.map(function (a) {
                return '<tr><td>' + fmtDT(a.when) + '</td><td>' + esc(a.actor) + '</td><td><span class="m-chip">' + esc(a.action) + '</span></td><td>' + esc(a.target) + '</td><td>' + esc(a.details) + '</td></tr>';
              }).join('') : '<tr><td colspan="5" class="m-table-empty">No actions yet - perform any admin operation to populate.</td></tr>')
        +   '</tbody></table>'
        + '</div>'
        + '<div class="m-mt-2"><button class="m-btn m-btn--ghost m-btn--sm" onclick="ManzilAdminActions.exportAudit()">⤓ Export CSV</button></div>';
      window.ManzilAdminActions = window.ManzilAdminActions || {};
      window.ManzilAdminActions.exportAudit = function () { downloadCsv(r.items, 'manzil-audit.csv'); };
    });
  }

  /* ====================== OWNER APPROVALS - identity + documents queue ====================== */
  function owner_approvals(host) {
    var statusFilter = '';
    function refresh() {
      var qs = statusFilter ? '?status=' + statusFilter : '';
      ManzilApp.api('/admin/verifications' + qs).then(function (r) {
        var countEl = document.getElementById('vf-count');
        if (countEl) countEl.textContent = r.body.items.length + ' applications';
        var tbody = document.getElementById('vf-tbody');
        if (!tbody) return;
        tbody.innerHTML = r.body.items.length ? r.body.items.map(function (a) {
          return '<tr>'
            + '<td>' + (a.owner_photo ? '<img src="' + a.owner_photo + '" style="width:36px;height:36px;border-radius:999px;object-fit:cover;">' : '👤') + '</td>'
            + '<td><strong>' + esc(a.owner_name) + '</strong><div class="m-text-muted" style="font-size:11px;">' + esc(a.owner_id) + '</div></td>'
            + '<td>' + esc(a.submitted_at || '—') + '</td>'
            + '<td>' + a.document_count + ' docs · ' + a.submitted_doc_count + ' awaiting</td>'
            + '<td><span class="m-status-chip ' + esc(a.status) + '">' + esc(a.status.replace('_',' ')) + '</span></td>'
            + '<td class="m-table-actions"><button class="m-btn m-btn--ghost m-btn--sm" onclick="ManzilAdminActions.openVerification(\'' + a.owner_id + '\')">Review →</button></td>'
            + '</tr>';
        }).join('') : '<tr><td colspan="6" class="m-table-empty">No applications match this filter.</td></tr>';
      });
    }
    function chips() {
      var statuses = ['','submitted','changes_requested','approved','rejected'];
      return statuses.map(function (s) {
        var label = s === '' ? 'All' : s.replace('_',' ');
        return '<button class="m-chip" data-vfstatus="' + s + '" style="' + (statusFilter === s ? 'background:var(--manzil-primary);color:white;' : '') + 'border:1px solid var(--manzil-line);padding:4px 10px;font-size:12px;cursor:pointer;">' + label + '</button>';
      }).join('');
    }
    function paint() {
      host.innerHTML = ''
        + '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">'
        +   '<div><h2 style="margin:0;">Owner approvals</h2><p class="m-text-muted" style="margin:4px 0 0;font-size:13.5px;">Review identity + ownership documents. Once approved, the owner\'s listings move into the listing-approval queue.</p></div>'
        +   '<span id="vf-count" class="m-text-muted" style="font-size:13px;"></span>'
        + '</div>'
        + '<div class="m-flex-wrap" style="margin-top:14px;gap:6px;">' + chips() + '</div>'
        + '<div class="m-panel m-mt-2" style="padding:0;overflow:auto;"><table class="m-table"><thead><tr><th></th><th>Owner</th><th>Submitted</th><th>Docs</th><th>Status</th><th></th></tr></thead><tbody id="vf-tbody"></tbody></table></div>';
      document.querySelectorAll('[data-vfstatus]').forEach(function (b) {
        b.addEventListener('click', function () { statusFilter = b.getAttribute('data-vfstatus'); paint(); refresh(); });
      });
    }
    paint(); refresh();
  }

  /* ====================== LISTING APPROVALS - only listings whose owner is verified ====================== */
  function listing_approvals(host) {
    var statusFilter = 'pending_review';
    function refresh() {
      ManzilApp.api('/admin/listings' + (statusFilter ? '?status=' + statusFilter : '')).then(function (r) {
        var items = (r.body.items || []).filter(function (l) {
          if (statusFilter) return true;
          return (l.status || 'active') !== 'awaiting_owner_verification';
        });
        var countEl = document.getElementById('la-count');
        if (countEl) countEl.textContent = items.length + ' listings';
        var tbody = document.getElementById('la-tbody');
        if (!tbody) return;
        tbody.innerHTML = items.length ? items.map(function (l) {
          var s = l.status || 'active';
          return '<tr>'
            + '<td><img src="' + (l.photos && l.photos[0]) + '" style="width:54px;height:36px;object-fit:cover;border-radius:4px;"></td>'
            + '<td><strong>' + esc(l.title) + '</strong><div class="m-text-muted" style="font-size:11px;">' + esc(l.id) + '</div></td>'
            + '<td>' + aed(l.price_aed) + (l.transaction === 'rent' ? '/year' : '') + '</td>'
            + '<td>' + (l.listed_at ? l.listed_at.slice(0,10) : '—') + '</td>'
            + '<td><span class="m-status-chip ' + esc(s) + '">' + esc(s.replace('_',' ')) + '</span></td>'
            + '<td class="m-table-actions"><button class="m-btn m-btn--ghost m-btn--sm" onclick="ManzilAdminActions.openListingReview(\'' + l.id + '\')">Review →</button></td>'
            + '</tr>';
        }).join('') : '<tr><td colspan="6" class="m-table-empty">No listings in this queue.</td></tr>';
      });
    }
    function chips() {
      var statuses = [['pending_review','Pending review'],['changes_requested','Changes requested'],['active','Live'],['paused','Paused'],['rejected','Rejected'],['','All']];
      return statuses.map(function (e) {
        return '<button class="m-chip" data-lastatus="' + e[0] + '" style="' + (statusFilter === e[0] ? 'background:var(--manzil-primary);color:white;' : '') + 'border:1px solid var(--manzil-line);padding:4px 10px;font-size:12px;cursor:pointer;">' + e[1] + '</button>';
      }).join('');
    }
    function paint() {
      host.innerHTML = ''
        + '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">'
        +   '<div><h2 style="margin:0;">Listing approvals</h2><p class="m-text-muted" style="margin:4px 0 0;font-size:13.5px;">Approve listings once their owner is verified. Listings waiting on owner verification live in <a href="#owner_approvals">Owner approvals</a>.</p></div>'
        +   '<span id="la-count" class="m-text-muted" style="font-size:13px;"></span>'
        + '</div>'
        + '<div class="m-flex-wrap" style="margin-top:14px;gap:6px;">' + chips() + '</div>'
        + '<div class="m-panel m-mt-2" style="padding:0;overflow:auto;"><table class="m-table"><thead><tr><th>Photo</th><th>Listing</th><th>Price</th><th>Listed</th><th>Status</th><th></th></tr></thead><tbody id="la-tbody"></tbody></table></div>';
      document.querySelectorAll('[data-lastatus]').forEach(function (b) {
        b.addEventListener('click', function () { statusFilter = b.getAttribute('data-lastatus'); paint(); refresh(); });
      });
    }
    paint(); refresh();
  }

  /* ====================== Drawer modals ====================== */
  function reRenderAdmin() { window.dispatchEvent(new Event('hashchange')); }

  window.ManzilAdminActions = window.ManzilAdminActions || {};
  window.ManzilAdminActions.openVerification = function (owner_id) {
    ManzilApp.api('/admin/verifications/' + owner_id).then(function (r) {
      var a = r.body.application; var o = r.body.owner; var listings = r.body.listings || [];
      if (!a) return;
      var drawer = document.createElement('div');
      drawer.className = 'm-drawer-backdrop';
      drawer.innerHTML = ''
        + '<div class="m-drawer">'
        +   '<div class="m-drawer-head"><div style="display:flex;gap:12px;align-items:center;">' + (o && o.photo ? '<img src="' + o.photo + '" style="width:44px;height:44px;border-radius:999px;object-fit:cover;">' : '👤')
        +     '<div><h3 style="margin:0;">' + esc(o ? o.name : '(unknown)') + '</h3><div class="m-text-muted" style="font-size:12px;">' + esc(a.owner_id) + ' · submitted ' + (a.submitted_at || '—') + ' · <span class="m-status-chip ' + esc(a.status) + '">' + esc(a.status.replace('_',' ')) + '</span></div></div></div>'
        +     '<button class="m-btn m-btn--ghost m-btn--sm" data-drawer-close>×</button></div>'
        +   '<div class="m-drawer-body">'
        +     (a.notes_from_admin ? '<div class="m-doc-reject-reason" style="margin-bottom:14px;"><strong>Admin notes:</strong> ' + esc(a.notes_from_admin) + '</div>' : '')
        +     '<p class="m-text-muted" style="font-size:13px;">' + (a.resident ? 'UAE resident' : 'Non-resident owner') + '</p>'
        +     '<h4 style="margin-top:18px;">Documents</h4>'
        +     '<div class="m-doc-grid" style="margin-bottom:18px;">' + (a.documents || []).map(function (doc) {
              var dt = (d.DOCUMENT_TYPES || []).find(function (t) { return t.id === doc.type; }) || { icon: '📎', label: doc.type };
              return '<div class="m-doc-card' + (doc.status === 'rejected' ? ' rejected' : '') + '">'
                +    '<div class="m-doc-head"><div class="m-doc-icon">' + dt.icon + '</div><div class="m-doc-title">' + esc(dt.label) + '</div><span class="m-status-chip ' + esc(doc.status) + '">' + esc(doc.status) + '</span></div>'
                +    '<div class="m-doc-preview"><div class="m-doc-thumb">' + (doc.thumb ? '<img src="' + doc.thumb + '">' : '<span class="m-doc-thumb-fallback">' + (doc.type === 'iban' || doc.type === 'dld_permit' ? '💳' : '📄') + '</span>') + '</div>'
                +    '<div class="m-doc-meta"><div class="m-doc-meta-name">' + esc(doc.filename) + '</div></div></div>'
                +    (doc.rejection_reason ? '<div class="m-doc-reject-reason">' + esc(doc.rejection_reason) + '</div>' : '')
                +    (doc.status !== 'approved' && doc.status !== 'rejected' ? '<div class="m-doc-actions" style="margin-top:8px;"><button class="m-btn m-btn--ghost m-btn--sm" data-doc-app data-owner="' + a.owner_id + '" data-type="' + doc.type + '">✓ Approve</button><button class="m-btn m-btn--ghost m-btn--sm" data-doc-rej data-owner="' + a.owner_id + '" data-type="' + doc.type + '">✕ Reject</button></div>' : '')
                +    '</div>';
            }).join('') + '</div>'
        +     (listings.length ? '<h4>Listings by this owner (' + listings.length + ')</h4><ul style="font-size:13px;">' + listings.map(function (l) { return '<li>' + esc(l.title) + ' · <span class="m-status-chip ' + esc(l.status || 'active') + '">' + esc((l.status || 'active').replace('_',' ')) + '</span></li>'; }).join('') + '</ul>' : '')
        +   '</div>'
        +   '<div class="m-drawer-foot">'
        +     '<button class="m-btn m-btn--ghost" data-drawer-close>Cancel</button>'
        +     '<button class="m-btn" data-rev-req style="background:#d96b5c;color:white;">↻ Request changes</button>'
        +     '<button class="m-btn" data-rev-rej style="background:#9c2a1a;color:white;">✕ Reject</button>'
        +     '<button class="m-btn m-btn--primary" data-rev-app>✓ Approve all</button>'
        +   '</div>'
        + '</div>';
      document.body.appendChild(drawer);
      setTimeout(function () { drawer.classList.add('show'); }, 10);
      function close() { drawer.classList.remove('show'); setTimeout(function () { drawer.remove(); }, 200); reRenderAdmin(); }
      drawer.addEventListener('click', function (e) { if (e.target === drawer || e.target.hasAttribute('data-drawer-close')) close(); });
      drawer.querySelector('[data-rev-app]').addEventListener('click', function () { ManzilApp.api('/admin/verifications/' + a.owner_id + '/approve', { method: 'POST', body: {} }).then(function () { window.toast && window.toast('Owner approved', 'success'); close(); }); });
      drawer.querySelector('[data-rev-req]').addEventListener('click', function () { var reason = prompt('What changes does the owner need to make?'); if (!reason) return; ManzilApp.api('/admin/verifications/' + a.owner_id + '/request-changes', { method: 'POST', body: { reason: reason } }).then(function () { window.toast && window.toast('Changes requested', 'success'); close(); }); });
      drawer.querySelector('[data-rev-rej]').addEventListener('click', function () { var reason = prompt('Reason for rejection (visible to owner):'); if (!reason) return; ManzilApp.api('/admin/verifications/' + a.owner_id + '/reject', { method: 'POST', body: { reason: reason } }).then(function () { window.toast && window.toast('Owner rejected', 'success'); close(); }); });
      drawer.querySelectorAll('[data-doc-app]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          ManzilApp.api('/admin/verifications/' + btn.getAttribute('data-owner') + '/docs/' + btn.getAttribute('data-type') + '/approve', { method: 'POST', body: {} }).then(function () {
            window.toast && window.toast('Document approved', 'success'); close();
            setTimeout(function () { window.ManzilAdminActions.openVerification(btn.getAttribute('data-owner')); }, 220);
          });
        });
      });
      drawer.querySelectorAll('[data-doc-rej]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var reason = prompt('Why is this document being rejected? (visible to owner):'); if (!reason) return;
          ManzilApp.api('/admin/verifications/' + btn.getAttribute('data-owner') + '/docs/' + btn.getAttribute('data-type') + '/reject', { method: 'POST', body: { reason: reason } }).then(function () {
            window.toast && window.toast('Document rejected', 'success'); close();
            setTimeout(function () { window.ManzilAdminActions.openVerification(btn.getAttribute('data-owner')); }, 220);
          });
        });
      });
    });
  };

  window.ManzilAdminActions.openListingReview = function (lid) {
    ManzilApp.api('/listings/' + lid).then(function (r) {
      var l = r.body.listing; if (!l) return;
      var drawer = document.createElement('div');
      drawer.className = 'm-drawer-backdrop';
      drawer.innerHTML = ''
        + '<div class="m-drawer">'
        +   '<div class="m-drawer-head"><h3 style="margin:0;">Review listing - ' + esc(l.title) + '</h3><button class="m-btn m-btn--ghost m-btn--sm" data-drawer-close>×</button></div>'
        +   '<div class="m-drawer-body">'
        +     '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:14px;">' + (l.photos || []).slice(0, 6).map(function (u) { return '<img src="' + esc(u) + '" style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:6px;">'; }).join('') + '</div>'
        +     '<p>' + esc(l.description) + '</p>'
        +     '<table class="m-table" style="margin-top:14px;">'
        +       '<tr><td><strong>Type / Transaction</strong></td><td>' + esc(l.type) + ' · ' + esc(l.transaction) + '</td></tr>'
        +       '<tr><td><strong>Area</strong></td><td>' + esc(((d.AREAS || []).find(function (a) { return a.id === l.area_id; }) || {}).name || '—') + '</td></tr>'
        +       '<tr><td><strong>Price</strong></td><td>' + aed(l.price_aed) + (l.transaction === 'rent' ? '/year' : '') + '</td></tr>'
        +       '<tr><td><strong>Beds / Baths / Sqft</strong></td><td>' + l.beds + ' / ' + l.baths + ' / ' + l.sqft + '</td></tr>'
        +       '<tr><td><strong>Amenities</strong></td><td>' + (l.amenities || []).map(esc).join(', ') + '</td></tr>'
        +     '</table>'
        +     (l.review_note ? '<div class="m-doc-reject-reason" style="margin-top:14px;"><strong>Last admin note:</strong> ' + esc(l.review_note) + '</div>' : '')
        +   '</div>'
        +   '<div class="m-drawer-foot">'
        +     '<button class="m-btn m-btn--ghost" data-drawer-close>Cancel</button>'
        +     '<button class="m-btn" data-lst-req style="background:#d96b5c;color:white;">↻ Request changes</button>'
        +     '<button class="m-btn" data-lst-rej style="background:#9c2a1a;color:white;">✕ Reject</button>'
        +     '<button class="m-btn m-btn--primary" data-lst-app>✓ Approve &amp; publish</button>'
        +   '</div>'
        + '</div>';
      document.body.appendChild(drawer);
      setTimeout(function () { drawer.classList.add('show'); }, 10);
      function close() { drawer.classList.remove('show'); setTimeout(function () { drawer.remove(); }, 200); reRenderAdmin(); }
      drawer.addEventListener('click', function (e) { if (e.target === drawer || e.target.hasAttribute('data-drawer-close')) close(); });
      drawer.querySelector('[data-lst-app]').addEventListener('click', function () { ManzilApp.api('/admin/listings/' + lid + '/approve', { method: 'POST', body: {} }).then(function () { window.toast && window.toast('Listing approved', 'success'); close(); }); });
      drawer.querySelector('[data-lst-req]').addEventListener('click', function () { var reason = prompt('What needs to be fixed?'); if (!reason) return; ManzilApp.api('/admin/listings/' + lid + '/request-changes', { method: 'POST', body: { reason: reason } }).then(function () { window.toast && window.toast('Changes requested', 'success'); close(); }); });
      drawer.querySelector('[data-lst-rej]').addEventListener('click', function () { var reason = prompt('Reason for rejection (visible to owner):'); if (!reason) return; ManzilApp.api('/admin/listings/' + lid + '/reject', { method: 'POST', body: { reason: reason } }).then(function () { window.toast && window.toast('Listing rejected', 'success'); close(); }); });
    });
  };

  // ---------- Expose ----------
  window.ManzilAdmin = {
    dashboard: dashboard, listings: listings, inquiries: inquiries, viewings: viewings,
    agents: agents, agencies: agencies, customers: customers,
    analytics: analytics, promotions: promotions, content: content,
    moderation: moderation, settings: settings, audit: audit,
    owner_approvals: owner_approvals, listing_approvals: listing_approvals
  };
})();
