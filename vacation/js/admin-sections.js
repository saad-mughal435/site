/* admin-sections.js — 11 admin sections under window.VacationAdmin */
(function () {
  'use strict';

  var esc = VacationApp.escapeHtml;
  var fmtDate = VacationApp.fmtDate;
  var d = window.VACATION_DATA;
  var aed = function (n) { return 'AED ' + Math.round(n).toLocaleString(); };

  function modal(opts) { return VacationApp.showModal(opts); }
  function formModal(opts) {
    var body = (opts.fields || []).map(function (f) {
      if (f.type === 'select') {
        return '<label class="v-field"><span>' + f.label + '</span><select class="v-select" id="ff-' + f.name + '">'
          + f.options.map(function (o) {
              var v = typeof o === 'object' ? o.value : o;
              var lab = typeof o === 'object' ? o.label : o;
              return '<option value="' + esc(v) + '"' + (f.value === v ? ' selected' : '') + '>' + esc(lab) + '</option>';
            }).join('')
          + '</select></label>';
      }
      if (f.type === 'textarea') return '<label class="v-field"><span>' + f.label + '</span><textarea class="v-textarea" id="ff-' + f.name + '" rows="' + (f.rows || 3) + '">' + esc(f.value || '') + '</textarea></label>';
      if (f.type === 'checkbox') return '<label class="v-field" style="flex-direction:row;align-items:center;gap:8px;"><input type="checkbox" id="ff-' + f.name + '"' + (f.value ? ' checked' : '') + ' /><span>' + f.label + '</span></label>';
      return '<label class="v-field"><span>' + f.label + '</span><input class="v-input" id="ff-' + f.name + '" type="' + (f.type || 'text') + '" value="' + esc(f.value == null ? '' : f.value) + '" /></label>';
    }).join('');
    var m = modal({
      title: opts.title, size: opts.size || 'lg',
      body: '<form id="ff-form" onsubmit="event.preventDefault()">' + body + '</form>',
      foot: '<button class="v-btn" data-modal-close>Cancel</button><button class="v-btn v-btn--primary" id="ff-submit">' + (opts.submitLabel || 'Save') + '</button>'
    });
    setTimeout(function () {
      m.el.querySelector('#ff-submit').addEventListener('click', function () {
        var out = {};
        (opts.fields || []).forEach(function (f) {
          var el = m.el.querySelector('#ff-' + f.name);
          if (!el) return;
          if (f.type === 'checkbox') out[f.name] = el.checked;
          else out[f.name] = el.value;
        });
        opts.onSubmit(out, m.close);
      });
    }, 0);
  }
  function confirmDel(label, fn) {
    modal({
      title: 'Confirm delete',
      body: '<p>Delete <strong>' + esc(label) + '</strong>? Will be logged in audit.</p>',
      foot: '<button class="v-btn" data-modal-close>Cancel</button><button class="v-btn" style="background:var(--vacation-coral-2);color:white;" id="cdel">Delete</button>',
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
    a.href = URL.createObjectURL(blob); a.download = filename; a.click();
    window.toast('CSV exported', 'success');
  }

  /* ====================== 1. DASHBOARD ====================== */
  function dashboard(host) {
    VacationApp.api('/admin/dashboard').then(function (r) {
      var k = r.body.kpis;
      var maxBk = Math.max.apply(null, r.body.monthly.map(function (m) { return m.bookings; }));
      host.innerHTML = ''
        + '<h2>Dashboard</h2>'
        + '<p class="v-text-muted">Live snapshot of the marketplace.</p>'
        + '<div class="v-kpi-grid v-mt-2">'
        +   '<div class="v-kpi"><div class="v-kpi-label">Active listings</div><div class="v-kpi-value">' + k.active_listings + '</div></div>'
        +   '<div class="v-kpi"><div class="v-kpi-label">Bookings (7d)</div><div class="v-kpi-value">' + k.bookings_7d + '</div><div class="v-kpi-delta up">+12%</div></div>'
        +   '<div class="v-kpi"><div class="v-kpi-label">Occupancy</div><div class="v-kpi-value">' + k.occupancy_pct + '%</div></div>'
        +   '<div class="v-kpi"><div class="v-kpi-label">ADR</div><div class="v-kpi-value" style="font-size:20px;">' + aed(k.adr) + '</div></div>'
        +   '<div class="v-kpi"><div class="v-kpi-label">Revenue 30d</div><div class="v-kpi-value" style="font-size:20px;">' + aed(k.revenue_30d) + '</div></div>'
        + '</div>'
        + '<div class="v-grid v-grid-2 v-mt-3">'
        +   '<div class="v-panel">'
        +     '<div class="v-panel-head"><h3>Monthly bookings</h3><span class="v-text-muted" style="font-size:12px;">Last 12 months</span></div>'
        +     '<div class="v-bars">' + r.body.monthly.map(function (m) { var h = Math.max(8, (m.bookings / maxBk) * 160); return '<div class="bar" style="height:' + h + 'px;"><span class="v">' + m.bookings + '</span></div>'; }).join('') + '</div>'
        +     '<div class="v-bars-labels">' + r.body.monthly.map(function (m) { return '<span>' + m.label + '</span>'; }).join('') + '</div>'
        +   '</div>'
        +   '<div class="v-panel"><div class="v-panel-head"><h3>System alerts</h3></div>'
        +     r.body.alerts.map(function (a) { return '<div style="padding:8px 0;border-bottom:1px solid var(--vacation-line);">⚠️ ' + esc(a.msg) + '</div>'; }).join('')
        +   '</div>'
        + '</div>'
        + '<div class="v-grid v-grid-2 v-mt-3">'
        +   '<div class="v-panel"><div class="v-panel-head"><h3>Recent bookings</h3><a class="v-text-muted" href="#bookings" style="font-size:12px;">All →</a></div>'
        +     '<table class="v-table"><thead><tr><th>Ref</th><th>Dates</th><th>Status</th></tr></thead><tbody>'
        +       r.body.recent_bookings.map(function (b) { return '<tr><td>' + b.ref_number + '</td><td>' + b.check_in + ' → ' + b.check_out + '</td><td><span class="v-chip ' + b.status + '">' + b.status + '</span></td></tr>'; }).join('')
        +     '</tbody></table>'
        +   '</div>'
        +   '<div class="v-panel"><div class="v-panel-head"><h3>Recent reviews</h3></div>'
        +     '<table class="v-table"><thead><tr><th>Rating</th><th>Title</th><th>Date</th></tr></thead><tbody>'
        +       r.body.recent_reviews.map(function (rv) { return '<tr><td><span class="v-stars">' + VacationApp.stars(rv.rating_overall) + '</span></td><td>' + esc(rv.title) + '</td><td>' + rv.date + '</td></tr>'; }).join('')
        +     '</tbody></table>'
        +   '</div>'
        + '</div>';
    });
  }

  /* ====================== 2. LISTINGS ====================== */
  function listings(host) {
    function refresh() {
      VacationApp.api('/admin/listings').then(function (r) {
        document.getElementById('lst-count').textContent = r.body.items.length + ' listings';
        document.getElementById('lst-tbody').innerHTML = r.body.items.length ? r.body.items.map(function (l) {
          var ho = d.HOSTS.find(function (h) { return h.id === l.host_id; }) || {};
          var de = d.DESTINATIONS.find(function (x) { return x.id === l.destination_id; }) || {};
          return '<tr>'
            + '<td><input type="checkbox" class="lst-check" value="' + l.id + '"></td>'
            + '<td><img src="' + l.photos[0] + '" alt="" style="width:54px;height:36px;object-fit:cover;border-radius:4px;" /></td>'
            + '<td><strong>' + esc(l.title) + '</strong><div class="v-text-muted" style="font-size:11px;">' + l.id + ' · ' + de.name + '</div></td>'
            + '<td>' + aed(l.base_nightly_aed) + '/night</td>'
            + '<td>' + l.bedrooms + 'BR · ' + l.max_guests + 'gst</td>'
            + '<td>' + l.type + '</td>'
            + '<td>' + (l.featured ? '<span class="v-chip" style="background:var(--vacation-accent);color:white;">⭐ Featured</span>' : '<span class="v-chip">—</span>') + ' ' + (l.instant_book ? '<span class="v-chip" style="background:var(--vacation-teal);color:white;">⚡</span>' : '') + '</td>'
            + '<td>' + esc(ho.name || '') + '</td>'
            + '<td class="v-table-actions"><button class="v-btn v-btn--ghost v-btn--sm" onclick="VacationAdminActions.editListing(\'' + l.id + '\')">Edit</button><button class="v-btn v-btn--ghost v-btn--sm" onclick="VacationAdminActions.deleteListing(\'' + l.id + '\',\'' + esc(l.title) + '\')">×</button></td>'
            + '</tr>';
        }).join('') : '<tr><td colspan="9" class="v-table-empty">No listings.</td></tr>';
      });
    }
    host.innerHTML = ''
      + '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;"><h2 style="margin:0;">Listings</h2>'
      +   '<div class="v-flex-wrap">'
      +     '<button class="v-btn v-btn--primary v-btn--sm" onclick="VacationAdminActions.newListing()">+ New listing</button>'
      +     '<button class="v-btn v-btn--ghost v-btn--sm" onclick="VacationAdminActions.bulk(\'feature\')">⭐ Feature</button>'
      +     '<button class="v-btn v-btn--ghost v-btn--sm" onclick="VacationAdminActions.bulk(\'verify\')">✓ Verify</button>'
      +     '<button class="v-btn v-btn--ghost v-btn--sm" onclick="VacationAdminActions.bulk(\'instant-on\')">⚡ Instant on</button>'
      +     '<button class="v-btn v-btn--ghost v-btn--sm" onclick="VacationAdminActions.bulk(\'delete\')">× Delete</button>'
      +     '<button class="v-btn v-btn--ghost v-btn--sm" onclick="VacationAdminActions.exportListings()">⤓ CSV</button>'
      +     '<span id="lst-count" class="v-text-muted" style="font-size:13px;margin-inline-start:auto;"></span>'
      +   '</div>'
      + '</div>'
      + '<div class="v-panel v-mt-2" style="padding:0;overflow:auto;"><table class="v-table"><thead><tr><th><input type="checkbox" id="lst-all" /></th><th>Photo</th><th>Title</th><th>Nightly</th><th>Beds/Guests</th><th>Type</th><th>Flags</th><th>Host</th><th></th></tr></thead><tbody id="lst-tbody"></tbody></table></div>';
    document.getElementById('lst-all').addEventListener('change', function (e) { document.querySelectorAll('.lst-check').forEach(function (c) { c.checked = e.target.checked; }); });
    refresh();

    window.VacationAdminActions = window.VacationAdminActions || {};
    window.VacationAdminActions.exportListings = function () { VacationApp.api('/admin/listings').then(function (r) { downloadCsv(r.body.items.map(function (l) { return { id: l.id, title: l.title, type: l.type, destination: l.destination_id, max_guests: l.max_guests, bedrooms: l.bedrooms, base_nightly: l.base_nightly_aed, host: l.host_id, rating: l.rating, reviews: l.review_count }; }), 'vacation-listings.csv'); }); };
    window.VacationAdminActions.newListing = function () {
      formModal({
        title: 'New listing',
        fields: [
          { name: 'title', label: 'Title' },
          { name: 'type', label: 'Type', type: 'select', options: ['villa','apartment','townhouse','penthouse','cabin','glamping'] },
          { name: 'destination_id', label: 'Destination', type: 'select', options: d.DESTINATIONS.map(function (x) { return { value: x.id, label: x.name }; }) },
          { name: 'host_id', label: 'Host', type: 'select', options: d.HOSTS.map(function (x) { return { value: x.id, label: x.name }; }) },
          { name: 'max_guests', label: 'Max guests', type: 'number', value: 4 },
          { name: 'bedrooms', label: 'Bedrooms', type: 'number', value: 2 },
          { name: 'baths', label: 'Baths', type: 'number', value: 2 },
          { name: 'base_nightly_aed', label: 'Base nightly (AED)', type: 'number', value: 500 },
          { name: 'cleaning_fee_aed', label: 'Cleaning fee (AED)', type: 'number', value: 160 },
          { name: 'description', label: 'Description', type: 'textarea' },
          { name: 'instant_book', label: 'Instant book', type: 'checkbox', value: true }
        ],
        onSubmit: function (body, close) {
          ['max_guests','bedrooms','baths','base_nightly_aed','cleaning_fee_aed'].forEach(function (k) { body[k] = Number(body[k]); });
          VacationApp.api('/admin/listings', { method: 'POST', body: body }).then(function () { window.toast('Listing created','success'); close(); refresh(); });
        }
      });
    };
    window.VacationAdminActions.editListing = function (id) {
      var l = d.LISTINGS.find(function (x) { return x.id === id; }) || (VacationApp.jget('vacation.listings.created', []).find(function (x) { return x.id === id; }));
      if (!l) return;
      formModal({
        title: 'Edit listing — ' + l.id,
        fields: [
          { name: 'title', label: 'Title', value: l.title },
          { name: 'base_nightly_aed', label: 'Base nightly (AED)', type: 'number', value: l.base_nightly_aed },
          { name: 'cleaning_fee_aed', label: 'Cleaning fee (AED)', type: 'number', value: l.cleaning_fee_aed },
          { name: 'instant_book', label: 'Instant book', type: 'checkbox', value: l.instant_book },
          { name: 'featured', label: 'Featured', type: 'checkbox', value: l.featured }
        ],
        onSubmit: function (body, close) {
          body.base_nightly_aed = Number(body.base_nightly_aed);
          body.cleaning_fee_aed = Number(body.cleaning_fee_aed);
          VacationApp.api('/admin/listings/' + id, { method: 'PUT', body: body }).then(function () { window.toast('Updated','success'); close(); refresh(); });
        }
      });
    };
    window.VacationAdminActions.deleteListing = function (id, label) { confirmDel(label, function () { VacationApp.api('/admin/listings/' + id, { method: 'DELETE' }).then(function () { window.toast('Deleted','success'); refresh(); }); }); };
    window.VacationAdminActions.bulk = function (op) {
      var ids = Array.prototype.slice.call(document.querySelectorAll('.lst-check:checked')).map(function (c) { return c.value; });
      if (!ids.length) { window.toast('Select rows first'); return; }
      VacationApp.api('/admin/listings/bulk', { method: 'POST', body: { op: op, ids: ids } }).then(function () { window.toast(op + ' applied to ' + ids.length, 'success'); refresh(); });
    };
  }

  /* ====================== 3. BOOKINGS ====================== */
  function bookings(host) {
    var statusFilter = '';
    function refresh() {
      var params = statusFilter ? '?status=' + statusFilter : '';
      VacationApp.api('/admin/bookings' + params).then(function (r) {
        document.getElementById('bk-count').textContent = r.body.items.length + ' bookings';
        document.getElementById('bk-tbody').innerHTML = r.body.items.length ? r.body.items.map(function (b) {
          var l = d.LISTINGS.find(function (x) { return x.id === b.listing_id; }) || {};
          var g = d.GUESTS.find(function (x) { return x.id === b.guest_id; }) || {};
          return '<tr>'
            + '<td>' + b.ref_number + '</td>'
            + '<td>' + esc(g.name || '') + '</td>'
            + '<td>' + esc(l.title || b.listing_id) + '</td>'
            + '<td>' + b.check_in + '</td>'
            + '<td>' + b.check_out + '</td>'
            + '<td>' + b.nights + '</td>'
            + '<td>' + aed(b.pricing.total) + '</td>'
            + '<td><span class="v-chip ' + b.status + '">' + b.status + '</span></td>'
            + '<td class="v-table-actions">'
            +   '<select class="v-select" style="font-size:11px;padding:3px 6px;" onchange="VacationAdminActions.updateBookingStatus(\'' + b.id + '\', this.value)">'
            +     ['pending','confirmed','in-progress','completed','cancelled','disputed','refunded'].map(function (s) { return '<option value="' + s + '"' + (s === b.status ? ' selected' : '') + '>' + s + '</option>'; }).join('')
            +   '</select>'
            +   '<button class="v-btn v-btn--ghost v-btn--sm" onclick="VacationAdminActions.refundBooking(\'' + b.id + '\')">Refund</button>'
            + '</td>'
            + '</tr>';
        }).join('') : '<tr><td colspan="9" class="v-table-empty">No bookings.</td></tr>';
      });
    }
    host.innerHTML = ''
      + '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;"><h2 style="margin:0;">Bookings</h2>'
      +   '<div class="v-flex-wrap">'
      +     '<select id="bk-filter" class="v-select"><option value="">All statuses</option><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="in-progress">In progress</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="disputed">Disputed</option><option value="refunded">Refunded</option></select>'
      +     '<button class="v-btn v-btn--ghost v-btn--sm" onclick="VacationAdminActions.exportBookings()">⤓ CSV</button>'
      +     '<span id="bk-count" class="v-text-muted" style="font-size:13px;align-self:center;"></span>'
      +   '</div>'
      + '</div>'
      + '<div class="v-panel v-mt-2" style="padding:0;overflow:auto;"><table class="v-table"><thead><tr><th>Ref</th><th>Guest</th><th>Stay</th><th>Check-in</th><th>Check-out</th><th>Nights</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody id="bk-tbody"></tbody></table></div>';
    document.getElementById('bk-filter').addEventListener('change', function (e) { statusFilter = e.target.value; refresh(); });
    refresh();

    window.VacationAdminActions = window.VacationAdminActions || {};
    window.VacationAdminActions.updateBookingStatus = function (id, status) {
      VacationApp.api('/admin/bookings/' + id, { method: 'PUT', body: { status: status } }).then(function () { window.toast('Status: ' + status, 'success'); refresh(); });
    };
    window.VacationAdminActions.refundBooking = function (id) {
      if (!confirm('Refund this booking?')) return;
      VacationApp.api('/admin/bookings/' + id + '/refund', { method: 'POST' }).then(function () { window.toast('Refunded','success'); refresh(); });
    };
    window.VacationAdminActions.exportBookings = function () {
      VacationApp.api('/admin/bookings').then(function (r) {
        downloadCsv(r.body.items.map(function (b) { return { ref: b.ref_number, guest_id: b.guest_id, listing_id: b.listing_id, check_in: b.check_in, check_out: b.check_out, nights: b.nights, status: b.status, total: b.pricing.total, created: b.created_at }; }), 'vacation-bookings.csv');
      });
    };
  }

  /* ====================== 4. HOSTS ====================== */
  function hosts(host) {
    function refresh() {
      VacationApp.api('/admin/hosts').then(function (r) {
        document.getElementById('hs-grid').innerHTML = r.body.items.map(function (h) {
          var lc = d.LISTINGS.filter(function (l) { return l.host_id === h.id; }).length;
          return '<div class="v-card" style="padding:16px;">'
            + '<div style="display:flex;gap:12px;align-items:center;"><img src="' + h.photo + '" alt="" style="width:48px;height:48px;border-radius:999px;object-fit:cover;" />'
            + '<div><h4 style="margin:0;">' + esc(h.name) + (h.superhost ? ' <span class="v-chip superhost" style="font-size:9px;">SUPER</span>' : '') + '</h4>'
            +   '<div class="v-text-muted" style="font-size:12px;">' + (h.languages || []).join(', ') + '</div></div></div>'
            + '<div class="v-flex-wrap v-mt-2" style="font-size:11px;"><span class="v-chip">' + lc + ' listings</span><span class="v-chip">' + h.response_rate + '% reply</span><span class="v-chip">~' + h.response_time_hrs + 'h</span></div>'
            + '<p style="font-size:12.5px;margin-top:8px;color:var(--vacation-ink-2);">' + esc(h.bio || '') + '</p>'
            + '<div class="v-flex-wrap v-mt-2">'
            +   (h.superhost ? '' : '<button class="v-btn v-btn--ghost v-btn--sm" onclick="VacationAdminActions.verifyHost(\'' + h.id + '\')">Verify</button>')
            +   '<button class="v-btn v-btn--ghost v-btn--sm" onclick="VacationAdminActions.editHost(\'' + h.id + '\')">Edit</button>'
            +   '<button class="v-btn v-btn--ghost v-btn--sm" onclick="VacationAdminActions.deleteHost(\'' + h.id + '\',\'' + esc(h.name) + '\')">×</button>'
            + '</div></div>';
        }).join('');
      });
    }
    host.innerHTML = ''
      + '<div style="display:flex;justify-content:space-between;align-items:center;"><h2>Hosts</h2><button class="v-btn v-btn--primary v-btn--sm" onclick="VacationAdminActions.newHost()">+ New host</button></div>'
      + '<div class="v-grid v-grid-3 v-mt-2" id="hs-grid"></div>';
    refresh();

    window.VacationAdminActions = window.VacationAdminActions || {};
    window.VacationAdminActions.newHost = function () {
      formModal({
        title: 'New host',
        fields: [
          { name: 'name', label: 'Name' },
          { name: 'bio', label: 'Bio', type: 'textarea' }
        ],
        onSubmit: function (body, close) { VacationApp.api('/admin/hosts', { method: 'POST', body: body }).then(function () { window.toast('Host added','success'); close(); refresh(); }); }
      });
    };
    window.VacationAdminActions.editHost = function (id) {
      VacationApp.api('/admin/hosts').then(function (r) {
        var h = r.body.items.find(function (x) { return x.id === id; }); if (!h) return;
        formModal({
          title: 'Edit ' + h.name,
          fields: [
            { name: 'name', label: 'Name', value: h.name },
            { name: 'response_rate', label: 'Response rate %', type: 'number', value: h.response_rate },
            { name: 'response_time_hrs', label: 'Response time (hrs)', type: 'number', value: h.response_time_hrs },
            { name: 'bio', label: 'Bio', type: 'textarea', value: h.bio || '' }
          ],
          onSubmit: function (body, close) {
            body.response_rate = Number(body.response_rate);
            body.response_time_hrs = Number(body.response_time_hrs);
            VacationApp.api('/admin/hosts/' + id, { method: 'PUT', body: body }).then(function () { window.toast('Updated','success'); close(); refresh(); });
          }
        });
      });
    };
    window.VacationAdminActions.verifyHost = function (id) { VacationApp.api('/admin/hosts/' + id + '/verify', { method: 'POST' }).then(function () { window.toast('Verified as Superhost','success'); refresh(); }); };
    window.VacationAdminActions.deleteHost = function (id, label) { confirmDel(label, function () { VacationApp.api('/admin/hosts/' + id, { method: 'DELETE' }).then(function () { window.toast('Deleted','success'); refresh(); }); }); };
  }

  /* ====================== 5. GUESTS ====================== */
  function guests(hostEl) {
    VacationApp.api('/admin/guests').then(function (r) {
      hostEl.innerHTML = ''
        + '<h2>Guests</h2>'
        + '<div class="v-panel v-mt-2" style="padding:0;overflow:auto;">'
        +   '<table class="v-table"><thead><tr><th>Name</th><th>Email</th><th>Joined</th><th>Locale</th><th>Trips</th><th>Total spent</th><th>Last booking</th></tr></thead><tbody>'
        +     r.body.items.map(function (g) { return '<tr><td>' + esc(g.name) + '</td><td>' + esc(g.email) + '</td><td>' + g.joined + '</td><td>' + g.locale.toUpperCase() + '</td><td>' + g.trip_count + '</td><td>' + aed(g.total_spent) + '</td><td>' + (g.last_booking ? g.last_booking.slice(0,10) : '—') + '</td></tr>'; }).join('')
        +   '</tbody></table>'
        + '</div>';
    });
  }

  /* ====================== 6. REVIEWS ====================== */
  function reviews(hostEl) {
    function refresh() {
      VacationApp.api('/admin/reviews').then(function (r) {
        hostEl.querySelector('#rv-tbody').innerHTML = r.body.items.map(function (rv) {
          var l = d.LISTINGS.find(function (x) { return x.id === rv.listing_id; }) || {};
          return '<tr>'
            + '<td><span class="v-stars">' + VacationApp.stars(rv.rating_overall) + '</span> ' + rv.rating_overall.toFixed(1) + '</td>'
            + '<td><strong>' + esc(rv.title) + '</strong><div style="font-size:12px;color:var(--vacation-muted);">' + esc(rv.body.slice(0,80)) + '…</div></td>'
            + '<td>' + esc(l.title || rv.listing_id) + '</td>'
            + '<td>' + rv.date + '</td>'
            + '<td><span class="v-chip">' + (rv.status || 'approved') + '</span></td>'
            + '<td class="v-table-actions"><button class="v-btn v-btn--ghost v-btn--sm" onclick="VacationAdminActions.reviewStatus(\'' + rv.id + '\',\'approved\')">Approve</button><button class="v-btn v-btn--ghost v-btn--sm" onclick="VacationAdminActions.reviewStatus(\'' + rv.id + '\',\'hidden\')">Hide</button></td>'
            + '</tr>';
        }).join('');
      });
    }
    hostEl.innerHTML = '<h2>Reviews</h2><div class="v-panel v-mt-2" style="padding:0;overflow:auto;"><table class="v-table"><thead><tr><th>Rating</th><th>Review</th><th>Stay</th><th>Date</th><th>Status</th><th></th></tr></thead><tbody id="rv-tbody"></tbody></table></div>';
    refresh();
    window.VacationAdminActions = window.VacationAdminActions || {};
    window.VacationAdminActions.reviewStatus = function (id, status) { VacationApp.api('/admin/reviews/' + id, { method: 'PUT', body: { status: status } }).then(function () { window.toast('Marked ' + status, 'success'); refresh(); }); };
  }

  /* ====================== 7. PAYMENTS ====================== */
  function payments(hostEl) {
    VacationApp.api('/admin/payments').then(function (r) {
      var pays = r.body.items;
      var totalRev = pays.filter(function (p) { return p.status === 'paid'; }).reduce(function (s, p) { return s + p.amount; }, 0);
      var totalPayout = pays.filter(function (p) { return p.status === 'paid'; }).reduce(function (s, p) { return s + p.host_payout; }, 0);
      var platformCut = totalRev - totalPayout;
      hostEl.innerHTML = ''
        + '<h2>Payments & payouts</h2>'
        + '<div class="v-kpi-grid v-mt-2">'
        +   '<div class="v-kpi"><div class="v-kpi-label">Total revenue</div><div class="v-kpi-value" style="font-size:20px;">' + aed(totalRev) + '</div></div>'
        +   '<div class="v-kpi"><div class="v-kpi-label">Host payouts</div><div class="v-kpi-value" style="font-size:20px;">' + aed(totalPayout) + '</div></div>'
        +   '<div class="v-kpi"><div class="v-kpi-label">Platform fee (15%)</div><div class="v-kpi-value" style="font-size:20px;">' + aed(platformCut) + '</div></div>'
        +   '<div class="v-kpi"><div class="v-kpi-label">Refunds</div><div class="v-kpi-value">' + pays.filter(function (p) { return p.status === 'refunded'; }).length + '</div></div>'
        + '</div>'
        + '<div class="v-panel v-mt-3" style="padding:0;overflow:auto;">'
        +   '<table class="v-table"><thead><tr><th>Ref</th><th>Booking</th><th>Amount</th><th>Host payout</th><th>Status</th><th>When</th></tr></thead><tbody>'
        +     pays.slice(0, 30).map(function (p) { return '<tr><td>' + p.id + '</td><td>' + p.ref_number + '</td><td>' + aed(p.amount) + '</td><td>' + aed(p.host_payout) + '</td><td><span class="v-chip ' + p.status + '">' + p.status + '</span></td><td>' + p.created_at.slice(0,10) + '</td></tr>'; }).join('')
        +   '</tbody></table>'
        + '</div>';
    });
  }

  /* ====================== 8. PROMOTIONS ====================== */
  function promotions(hostEl) {
    function refresh() {
      VacationApp.api('/admin/promotions').then(function (r) {
        hostEl.querySelector('#pr-list').innerHTML = r.body.items.map(function (p) {
          return '<div class="v-card" style="padding:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">'
            + '<div><strong>' + esc(p.code) + '</strong> · ' + esc(p.label) + '<div class="v-text-muted" style="font-size:12px;">' + p.starts + ' → ' + p.ends + ' · ' + (p.type === 'percent' ? p.value + '%' : aed(p.value)) + ' off · min ' + p.min_nights + ' nights</div></div>'
            + '<div class="v-flex-wrap"><span class="v-chip ' + (p.active ? 'active' : 'draft') + '">' + (p.active ? 'Active' : 'Inactive') + '</span><button class="v-btn v-btn--ghost v-btn--sm" onclick="VacationAdminActions.togglePromo(\'' + p.id + '\')">Toggle</button><button class="v-btn v-btn--ghost v-btn--sm" onclick="VacationAdminActions.removePromo(\'' + p.id + '\')">×</button></div>'
            + '</div>';
        }).join('');
      });
    }
    hostEl.innerHTML = ''
      + '<div style="display:flex;justify-content:space-between;align-items:center;"><h2>Promotions</h2><button class="v-btn v-btn--primary v-btn--sm" onclick="VacationAdminActions.newPromo()">+ New promo</button></div>'
      + '<div class="v-grid v-mt-2" id="pr-list"></div>';
    refresh();
    window.VacationAdminActions = window.VacationAdminActions || {};
    window.VacationAdminActions.newPromo = function () {
      formModal({
        title: 'New promotion',
        fields: [
          { name: 'code', label: 'Code (e.g. SUMMER20)' },
          { name: 'label', label: 'Label' },
          { name: 'type', label: 'Type', type: 'select', options: ['percent','fixed'] },
          { name: 'value', label: 'Value (% or AED)', type: 'number', value: 10 },
          { name: 'starts', label: 'Starts', type: 'date' },
          { name: 'ends', label: 'Ends', type: 'date' },
          { name: 'min_nights', label: 'Min nights', type: 'number', value: 1 },
          { name: 'active', label: 'Active', type: 'checkbox', value: true }
        ],
        onSubmit: function (body, close) { VacationApp.api('/admin/promotions', { method: 'POST', body: Object.assign({ action: 'add' }, body) }).then(function () { window.toast('Created','success'); close(); refresh(); }); }
      });
    };
    window.VacationAdminActions.togglePromo = function (id) { VacationApp.api('/admin/promotions', { method: 'POST', body: { action: 'toggle', id: id } }).then(refresh); };
    window.VacationAdminActions.removePromo = function (id) { VacationApp.api('/admin/promotions', { method: 'POST', body: { action: 'remove', id: id } }).then(refresh); };
  }

  /* ====================== 9. DESTINATIONS CMS ====================== */
  function destinations(hostEl) {
    VacationApp.api('/admin/content/destinations').then(function (r) {
      var overrides = r.body.overrides || {};
      hostEl.innerHTML = ''
        + '<h2>Destinations (content)</h2>'
        + '<p class="v-text-muted">Override destination blurbs + average nightly hints. Originals are seed data; overrides persist locally.</p>'
        + '<div class="v-grid v-grid-2 v-mt-2">' + d.DESTINATIONS.map(function (de) {
            var o = overrides[de.id] || {};
            var edited = !!(o.blurb || o.avg_nightly);
            return '<div class="v-card" style="padding:16px;">'
              + '<div style="display:flex;justify-content:space-between;align-items:center;"><strong>' + esc(de.name) + '</strong>' + (edited ? '<span class="v-chip active">overridden</span>' : '') + '</div>'
              + '<p style="font-size:13px;margin:8px 0 0;color:var(--vacation-muted);">' + esc((o.blurb || de.blurb).slice(0, 140)) + '...</p>'
              + '<button class="v-btn v-btn--ghost v-btn--sm v-mt-2" onclick="VacationAdminActions.editDest(\'' + de.id + '\')">Edit content</button>'
              + '</div>';
          }).join('') + '</div>';
    });
    window.VacationAdminActions = window.VacationAdminActions || {};
    window.VacationAdminActions.editDest = function (id) {
      var de = d.DESTINATIONS.find(function (x) { return x.id === id; });
      formModal({
        title: 'Edit ' + de.name,
        fields: [
          { name: 'blurb', label: 'Blurb', type: 'textarea', rows: 4, value: de.blurb },
          { name: 'avg_nightly', label: 'Avg nightly (AED)', type: 'number', value: de.avg_nightly }
        ],
        onSubmit: function (body, close) { body.destination_id = id; body.avg_nightly = Number(body.avg_nightly); VacationApp.api('/admin/content/destinations', { method: 'POST', body: body }).then(function () { window.toast('Saved','success'); close(); destinations(hostEl); }); }
      });
    };
  }

  /* ====================== 10. SETTINGS ====================== */
  function settings(hostEl) {
    VacationApp.api('/admin/settings').then(function (r) {
      var s = r.body.settings;
      hostEl.innerHTML = ''
        + '<h2>Settings</h2>'
        + '<div class="v-grid v-grid-2 v-mt-2">'
        +   '<div class="v-panel"><h3 style="margin-top:0;">Pricing</h3>'
        +     '<label class="v-field"><span>Service fee %</span><input class="v-input" id="set-svc" type="number" step="0.5" value="' + (s.service_fee_pct || 10) + '"></label>'
        +     '<label class="v-field v-mt-1"><span>VAT %</span><input class="v-input" id="set-vat" type="number" step="0.5" value="' + (s.vat_pct || 5) + '"></label>'
        +     '<div class="v-mt-2"><button class="v-btn v-btn--primary" id="save-settings">Save changes</button></div>'
        +   '</div>'
        +   '<div class="v-panel"><h3 style="margin-top:0;">Currencies</h3>'
        +     '<table class="v-table"><thead><tr><th>Code</th><th>Symbol</th><th>Rate → AED</th></tr></thead><tbody>'
        +       (s.currencies || []).map(function (c) { return '<tr><td>' + c.code + '</td><td>' + c.symbol + '</td><td>' + c.rate_to_aed + '</td></tr>'; }).join('')
        +     '</tbody></table>'
        +   '</div>'
        +   '<div class="v-panel"><h3 style="margin-top:0;">Cancellation policies</h3><ul>' + (s.cancellation_policies || []).map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul></div>'
        +   '<div class="v-panel"><h3 style="margin-top:0;">Payout schedule</h3><p>' + esc(s.payout_schedule || 'after_checkin_24h') + '</p></div>'
        + '</div>'
        + '<div class="v-panel v-mt-3"><h3 style="margin-top:0;">Danger zone</h3><p class="v-text-muted">Reset all local overrides (created listings, bookings, edits). Seed data restored.</p>'
        +   '<button class="v-btn" style="background:var(--vacation-coral-2);color:white;" onclick="VacationAdminActions.resetDemo()">Reset demo data</button>'
        + '</div>';
      document.getElementById('save-settings').addEventListener('click', function () {
        VacationApp.api('/admin/settings', { method: 'POST', body: { service_fee_pct: Number(document.getElementById('set-svc').value), vat_pct: Number(document.getElementById('set-vat').value) } }).then(function () { window.toast('Saved','success'); });
      });
    });
    window.VacationAdminActions = window.VacationAdminActions || {};
    window.VacationAdminActions.resetDemo = function () {
      modal({
        title: 'Reset demo data',
        body: '<p>This clears all local overrides — created listings, bookings, edits, audit log. Seed data is untouched.</p>',
        foot: '<button class="v-btn" data-modal-close>Cancel</button><button class="v-btn" style="background:var(--vacation-coral-2);color:white;" id="r-go">Reset</button>',
        onMount: function (h, close) {
          h.querySelector('#r-go').addEventListener('click', function () {
            Object.keys(localStorage).forEach(function (k) { if (k.indexOf('vacation.') === 0) localStorage.removeItem(k); });
            window.toast('Reset complete — reloading...','success'); close();
            setTimeout(function () { location.reload(); }, 800);
          });
        }
      });
    };
  }

  /* ====================== 11. AUDIT ====================== */
  function audit(hostEl) {
    VacationApp.api('/admin/audit').then(function (r) {
      hostEl.innerHTML = ''
        + '<h2>Audit log</h2>'
        + '<p class="v-text-muted">Append-only record of admin actions. ' + r.body.items.length + ' entries.</p>'
        + '<div class="v-panel v-mt-2" style="padding:0;overflow:auto;">'
        +   '<table class="v-table"><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th><th>Details</th></tr></thead><tbody>'
        +     (r.body.items.length ? r.body.items.map(function (a) { return '<tr><td>' + a.when.slice(0,16).replace('T',' ') + '</td><td>' + esc(a.actor) + '</td><td><span class="v-chip">' + esc(a.action) + '</span></td><td>' + esc(a.target) + '</td><td>' + esc(a.details) + '</td></tr>'; }).join('') : '<tr><td colspan="5" class="v-table-empty">No actions yet.</td></tr>')
        +   '</tbody></table>'
        + '</div>'
        + '<div class="v-mt-2"><button class="v-btn v-btn--ghost v-btn--sm" onclick="VacationAdminActions.exportAudit()">⤓ Export CSV</button></div>';
      window.VacationAdminActions = window.VacationAdminActions || {};
      window.VacationAdminActions.exportAudit = function () { downloadCsv(r.body.items, 'vacation-audit.csv'); };
    });
  }

  window.VacationAdmin = {
    dashboard: dashboard, listings: listings, bookings: bookings, hosts: hosts,
    guests: guests, reviews: reviews, payments: payments, promotions: promotions,
    destinations: destinations, settings: settings, audit: audit
  };
})();
