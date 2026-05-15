/* host-dashboard.js - Host-side SPA for managing listings, bookings, calendar, earnings, profile, verification.
   Mirrors admin.html shell but scoped to a single signed-in host. If no session exists, shows a host-picker
   so reviewers can impersonate any seed host to see different verification states. */
(function () {
  'use strict';

  var D = window.VACATION_DATA;
  var LS_SESSION = 'vacation.host_session';

  var NAV = [
    { id: 'listings',     icon: '🏠', label: 'My listings' },
    { id: 'bookings',     icon: '🗓', label: 'Bookings' },
    { id: 'calendar',     icon: '📅', label: 'Calendar' },
    { id: 'earnings',     icon: '💰', label: 'Earnings' },
    { id: 'profile',      icon: '👤', label: 'Profile' },
    { id: 'verification', icon: '🛡', label: 'Verification' }
  ];

  function current() { return (location.hash || '#listings').slice(1); }
  function getSession() { try { return JSON.parse(localStorage.getItem(LS_SESSION)); } catch (e) { return null; } }
  function setSession(s) { localStorage.setItem(LS_SESSION, JSON.stringify(s)); }
  function clearSession() { localStorage.removeItem(LS_SESSION); }
  function esc(s) { return VacationApp.escapeHtml(String(s == null ? '' : s)); }
  function aed(n) { return 'AED ' + Math.round(n || 0).toLocaleString(); }

  // ---------------- Sign-in / impersonation ----------------
  function renderSignInScreen() {
    document.getElementById('host-side').style.display = 'none';
    var main = document.getElementById('host-main');
    document.getElementById('host-shell').style.gridTemplateColumns = '1fr';
    // Preview hosts spanning the verification states.
    var apps = D.HOST_APPLICATIONS || [];
    var preview = ['h01','h09','h18','h21','h08'].map(function (id) {
      var h = D.HOSTS.find(function (x) { return x.id === id; });
      var a = apps.find(function (x) { return x.host_id === id; });
      var status = (a && a.status) || (h && h.verified_at ? 'approved' : 'no application');
      var sub = {
        'approved': 'Approved · verified host',
        'submitted': 'Submitted · awaiting admin review',
        'changes_requested': 'Changes requested by admin',
        'rejected': 'Rejected - needs new documents',
        'no application': 'No application on file'
      }[status] || status;
      return { host: h, status: status, sub: sub };
    }).filter(function (x) { return x.host; });
    main.innerHTML = ''
      + '<div style="max-width:760px;margin:0 auto;padding:32px 0;">'
      +   '<div style="text-align:center;margin-bottom:28px;">'
      +     '<a href="host.html" style="display:inline-flex;align-items:center;gap:10px;font-family:var(--font-display);font-weight:700;font-size:18px;color:var(--vacation-ink);">'
      +       '<span style="width:36px;height:36px;border-radius:10px;background:var(--vacation-primary);color:white;display:grid;place-items:center;font-weight:800;">V</span> Vacation Homes'
      +     '</a>'
      +   '</div>'
      +   '<div class="v-panel" style="padding:24px;">'
      +     '<h2 style="margin-top:0;font-family:var(--font-display);">Sign in to your host dashboard</h2>'
      +     '<p class="v-text-muted">Pick a demo host to sign in as - each one shows a different state of the verification pipeline.</p>'
      +     '<div style="display:grid;gap:10px;margin-top:18px;">'
      +       preview.map(function (p) {
              return '<button class="v-doc-card" data-imp="' + esc(p.host.id) + '" style="text-align:start;cursor:pointer;width:100%;padding:14px;background:var(--vacation-card);border:1.5px solid var(--vacation-line);">'
                + '<div style="display:flex;align-items:center;gap:12px;">'
                +   (p.host.photo ? '<img src="' + p.host.photo + '" style="width:42px;height:42px;border-radius:999px;object-fit:cover;">' : '<span style="font-size:28px;">👤</span>')
                +   '<div style="flex:1;">'
                +     '<div style="font-weight:600;color:var(--vacation-ink);">' + esc(p.host.name) + '</div>'
                +     '<div style="font-size:12px;color:var(--vacation-muted);">' + esc(p.sub) + '</div>'
                +   '</div>'
                +   '<span class="v-status-chip ' + esc(p.status) + '">' + esc(p.status.replace('_',' ')) + '</span>'
                + '</div>'
                + '</button>';
            }).join('')
      +     '</div>'
      +     '<p class="v-text-muted" style="font-size:12px;margin-top:18px;text-align:center;">Or <a href="host-onboard.html">create a new host account →</a></p>'
      +   '</div>'
      + '</div>';
    document.querySelectorAll('[data-imp]').forEach(function (b) {
      b.addEventListener('click', function () {
        var hid = b.getAttribute('data-imp');
        VacationApp.api('/host/session/impersonate', { method: 'POST', body: { host_id: hid } }).then(function () {
          document.getElementById('host-side').style.display = '';
          document.getElementById('host-shell').style.gridTemplateColumns = '';
          location.hash = '#listings';
          renderSide();
          renderMain();
        });
      });
    });
  }

  // ---------------- Sidebar ----------------
  function renderSide() {
    var sess = getSession();
    if (!sess) return;
    var h = D.HOSTS.find(function (x) { return x.id === sess.host_id; }) || { name: 'Unknown host' };
    var hostCreated = VacationApp.jget('vacation.hosts.created', []).find(function (x) { return x.id === sess.host_id; });
    if (hostCreated) h = hostCreated;
    var side = document.getElementById('host-side');
    var cur = current();
    side.innerHTML = ''
      + '<a class="v-host-side-brand" href="index.html"><span style="width:30px;height:30px;border-radius:8px;background:var(--vacation-primary);color:white;display:grid;place-items:center;font-weight:800;">V</span> Vacation Homes</a>'
      + '<div style="padding:10px 8px;border-bottom:1px solid var(--vacation-line);display:flex;align-items:center;gap:10px;">'
      +   (h.photo ? '<img src="' + h.photo + '" style="width:36px;height:36px;border-radius:999px;object-fit:cover;">' : '<span style="font-size:24px;">👤</span>')
      +   '<div style="flex:1;overflow:hidden;"><div style="font-weight:600;font-size:13px;color:var(--vacation-ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(h.name) + '</div><div style="font-size:11px;color:var(--vacation-muted);">' + (h.superhost ? '⭐ Superhost' : 'Host') + '</div></div>'
      + '</div>'
      + '<nav class="v-host-nav">' + NAV.map(function (n) {
          return '<a href="#' + n.id + '" class="' + (cur === n.id ? 'is-active' : '') + '"><span>' + n.icon + '</span><span>' + esc(n.label) + '</span></a>';
        }).join('') + '</nav>'
      + '<a class="v-btn v-btn--primary v-btn--sm" href="host-onboard.html?mode=add-listing" style="margin:6px 8px 0;justify-content:center;">+ List a new property</a>'
      + '<div class="v-host-side-foot">'
      +   '<button class="v-btn v-btn--ghost v-btn--sm" id="hs-switch" style="width:100%;">Switch host</button>'
      + '</div>';
    document.getElementById('hs-switch').addEventListener('click', function () {
      clearSession();
      renderSignInScreen();
    });
  }

  // ---------------- Main router ----------------
  function renderMain() {
    var sess = getSession();
    if (!sess) return renderSignInScreen();
    var main = document.getElementById('host-main');
    var cur = current();
    var fn = sections[cur] || sections.listings;
    main.innerHTML = '<div class="v-text-muted">Loading…</div>';
    fn(main);
    // Refresh sidebar to mark active.
    renderSide();
  }

  // ---------------- Sections ----------------
  var sections = {};

  sections.listings = function (host) {
    Promise.all([VacationApp.api('/host/dashboard'), VacationApp.api('/host/listings')]).then(function (rs) {
      var k = rs[0].body.kpis || {};
      var items = (rs[1].body.items) || [];
      host.innerHTML = ''
        + '<div style="display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;">'
        +   '<h2 style="margin:0;font-family:var(--font-display);">My listings</h2>'
        +   '<a class="v-btn v-btn--primary v-btn--sm" href="host-onboard.html?mode=add-listing">+ List a new property</a>'
        + '</div>'
        + '<div class="v-kpi-grid v-mt-2" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr));">'
        +   '<div class="v-kpi"><div class="v-kpi-label">Live listings</div><div class="v-kpi-value">' + (k.listings_live || 0) + '</div></div>'
        +   '<div class="v-kpi"><div class="v-kpi-label">Pending review</div><div class="v-kpi-value" style="color:var(--vacation-accent-2);">' + (k.listings_pending || 0) + '</div></div>'
        +   '<div class="v-kpi"><div class="v-kpi-label">Upcoming bookings</div><div class="v-kpi-value">' + (k.bookings_upcoming || 0) + '</div></div>'
        +   '<div class="v-kpi"><div class="v-kpi-label">Revenue 30d</div><div class="v-kpi-value" style="font-size:18px;">' + aed(k.revenue_30d) + '</div></div>'
        +   '<div class="v-kpi"><div class="v-kpi-label">Avg rating</div><div class="v-kpi-value">' + (k.avg_rating || '-') + ' <span class="v-text-muted" style="font-size:12px;">(' + (k.review_count || 0) + ')</span></div></div>'
        + '</div>'
        + (items.length
          ? '<div class="v-panel v-mt-3" style="padding:0;overflow:auto;">'
            + '<table class="v-table"><thead><tr><th>Photo</th><th>Title</th><th>Status</th><th>Nightly</th><th>Listed</th><th></th></tr></thead><tbody>'
            + items.map(function (l) {
              var s = l.status || 'live';
              return '<tr>'
                + '<td><img src="' + esc(l.photos && l.photos[0]) + '" style="width:54px;height:36px;object-fit:cover;border-radius:4px;"></td>'
                + '<td><strong>' + esc(l.title) + '</strong>' + (l.review_note ? '<div class="v-text-muted" style="font-size:11px;color:var(--vacation-coral-2);">⚠ ' + esc(l.review_note) + '</div>' : '') + '</td>'
                + '<td><span class="v-status-chip ' + esc(s) + '">' + esc(s.replace('_',' ')) + '</span></td>'
                + '<td>' + aed(l.base_nightly_aed) + '</td>'
                + '<td>' + esc(l.listed_at) + '</td>'
                + '<td class="v-table-actions">'
                +   '<a class="v-btn v-btn--ghost v-btn--sm" href="stay.html?id=' + esc(l.id) + '" target="_blank">View</a>'
                +   '<a class="v-btn v-btn--ghost v-btn--sm" href="host-onboard.html?mode=edit&id=' + esc(l.id) + '">Edit</a>'
                +   (s === 'live' ? '<button class="v-btn v-btn--ghost v-btn--sm" data-pause="' + esc(l.id) + '">Pause</button>' : (s === 'paused' ? '<button class="v-btn v-btn--ghost v-btn--sm" data-unpause="' + esc(l.id) + '">Unpause</button>' : ''))
                + '</td>'
                + '</tr>';
            }).join('')
            + '</tbody></table></div>'
          : '<div class="v-panel v-mt-3 v-empty-illustration"><div class="v-empty-illustration-mark">🏖️</div><h3>No listings yet</h3><p>List your first property to start hosting on Vacation Homes.</p><a class="v-btn v-btn--primary" href="host-onboard.html">Start listing</a></div>');
      document.querySelectorAll('[data-pause]').forEach(function (b) {
        b.addEventListener('click', function () {
          VacationApp.api('/host/listings/' + b.getAttribute('data-pause') + '/pause', { method: 'POST', body: {} }).then(function () { window.toast && window.toast('Listing paused', 'success'); renderMain(); });
        });
      });
      document.querySelectorAll('[data-unpause]').forEach(function (b) {
        b.addEventListener('click', function () {
          VacationApp.api('/host/listings/' + b.getAttribute('data-unpause') + '/unpause', { method: 'POST', body: {} }).then(function () { window.toast && window.toast('Listing live again', 'success'); renderMain(); });
        });
      });
    });
  };

  sections.bookings = function (host) {
    VacationApp.api('/host/bookings').then(function (r) {
      var items = r.body.items || [];
      var groups = {
        upcoming: items.filter(function (b) { return b.status === 'confirmed' || b.status === 'pending'; }),
        inprogress: items.filter(function (b) { return b.status === 'in-progress'; }),
        past: items.filter(function (b) { return b.status === 'completed'; }),
        cancelled: items.filter(function (b) { return b.status === 'cancelled' || b.status === 'refunded'; })
      };
      function table(rows) {
        if (!rows.length) return '<div class="v-empty-illustration" style="padding:30px 10px;"><div class="v-text-muted">No bookings here yet.</div></div>';
        return '<div class="v-panel" style="padding:0;overflow:auto;margin-top:8px;"><table class="v-table"><thead><tr><th>Ref</th><th>Listing</th><th>Guest</th><th>Dates</th><th>Total</th><th>Status</th></tr></thead><tbody>'
          + rows.map(function (b) {
            var l = D.LISTINGS.find(function (x) { return x.id === b.listing_id; }) || {};
            var g = D.GUESTS.find(function (x) { return x.id === b.guest_id; }) || {};
            return '<tr><td>' + esc(b.ref_number) + '</td><td>' + esc(l.title || b.listing_id) + '</td><td>' + esc(g.name || b.guest_id) + '</td><td>' + b.check_in + ' → ' + b.check_out + '</td><td>' + aed(b.pricing && b.pricing.total) + '</td><td><span class="v-status-chip ' + esc(b.status) + '">' + esc(b.status.replace('-',' ')) + '</span></td></tr>';
          }).join('')
          + '</tbody></table></div>';
      }
      host.innerHTML = ''
        + '<h2 style="margin:0;font-family:var(--font-display);">Bookings</h2>'
        + '<p class="v-text-muted">All bookings across your listings.</p>'
        + '<h3 style="margin-top:18px;">Upcoming · ' + groups.upcoming.length + '</h3>' + table(groups.upcoming)
        + '<h3 style="margin-top:18px;">In progress · ' + groups.inprogress.length + '</h3>' + table(groups.inprogress)
        + '<h3 style="margin-top:18px;">Past · ' + groups.past.length + '</h3>' + table(groups.past)
        + '<h3 style="margin-top:18px;">Cancelled · ' + groups.cancelled.length + '</h3>' + table(groups.cancelled);
    });
  };

  sections.calendar = function (host) {
    VacationApp.api('/host/listings').then(function (r) {
      var items = (r.body.items || []).filter(function (l) { return l.status === 'live' || !l.status; });
      if (!items.length) {
        host.innerHTML = '<h2 style="font-family:var(--font-display);">Calendar</h2><div class="v-empty-illustration"><div class="v-empty-illustration-mark">📅</div><p>No live listings yet - add one to manage its calendar.</p></div>';
        return;
      }
      var selected = items[0].id;
      function render() {
        var l = items.find(function (x) { return x.id === selected; });
        VacationApp.api('/availability/' + l.id).then(function (a) {
          host.innerHTML = ''
            + '<h2 style="margin:0;font-family:var(--font-display);">Calendar</h2>'
            + '<p class="v-text-muted">Block dates when your home is unavailable. Booked dates (by guests) are read-only.</p>'
            + '<label class="v-field" style="max-width:400px;"><span>Listing</span><select class="v-select" id="cal-pick">' + items.map(function (i) { return '<option value="' + esc(i.id) + '" ' + (i.id === selected ? 'selected' : '') + '>' + esc(i.title) + '</option>'; }).join('') + '</select></label>'
            + '<div class="v-panel" style="padding:14px;margin-top:14px;"><div id="cal-host"></div></div>'
            + '<p class="v-text-muted" style="font-size:13px;margin-top:8px;">Click an available date to block it. Click a blocked date to release it.</p>';
          document.getElementById('cal-pick').addEventListener('change', function () { selected = document.getElementById('cal-pick').value; render(); });
          var calHost = document.getElementById('cal-host');
          var blocked = (a.body.blocked || []).slice();
          var booked = (a.body.booked || []).slice();
          var inst = window.VacationCalendar.mount(calHost, {
            mode: 'display', blocked: blocked, booked: booked,
            cursor: new Date()
          });
          // Re-wire clicks on the calendar to toggle block status.
          setTimeout(function () {
            calHost.querySelectorAll('[data-cal-day]').forEach(function (cell) {
              cell.addEventListener('click', function () {
                if (cell.classList.contains('booked') || cell.classList.contains('past') || cell.classList.contains('empty')) return;
                var date = cell.getAttribute('data-cal-day');
                var isBlocked = cell.classList.contains('blocked');
                var body = isBlocked ? { remove: [date] } : { add: [date] };
                VacationApp.api('/host/listings/' + l.id + '/block-dates', { method: 'POST', body: body }).then(function (res) {
                  blocked = res.body.blocked_dates || blocked;
                  inst.reset && inst.reset();
                  render();
                  window.toast && window.toast(isBlocked ? 'Date released' : 'Date blocked', 'success', 1500);
                });
              });
            });
          }, 50);
        });
      }
      render();
    });
  };

  sections.earnings = function (host) {
    VacationApp.api('/host/bookings').then(function (r) {
      var items = (r.body.items || []).filter(function (b) { return b.status !== 'cancelled' && b.status !== 'refunded'; });
      var now = new Date();
      function inMonth(b, offset) {
        var d = new Date(b.check_in);
        var target = new Date(now.getFullYear(), now.getMonth() - offset, 1);
        return d.getFullYear() === target.getFullYear() && d.getMonth() === target.getMonth();
      }
      var thisM = items.filter(function (b) { return inMonth(b, 0); }).reduce(function (s, b) { return s + (b.pricing && b.pricing.total || 0); }, 0);
      var lastM = items.filter(function (b) { return inMonth(b, 1); }).reduce(function (s, b) { return s + (b.pricing && b.pricing.total || 0); }, 0);
      var ytd = items.filter(function (b) { return new Date(b.check_in).getFullYear() === now.getFullYear(); }).reduce(function (s, b) { return s + (b.pricing && b.pricing.total || 0); }, 0);
      var all = items.reduce(function (s, b) { return s + (b.pricing && b.pricing.total || 0); }, 0);
      // Monthly bar chart of last 12 months.
      var monthly = [];
      for (var i = 11; i >= 0; i--) {
        var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        var sum = items.filter(function (b) {
          var bd = new Date(b.check_in);
          return bd.getFullYear() === d.getFullYear() && bd.getMonth() === d.getMonth();
        }).reduce(function (s2, b) { return s2 + (b.pricing && b.pricing.total || 0); }, 0);
        monthly.push({ label: d.toLocaleString('en', { month: 'short' }), revenue: sum });
      }
      var maxRev = Math.max.apply(null, monthly.map(function (m) { return m.revenue; })) || 1;
      host.innerHTML = ''
        + '<h2 style="margin:0;font-family:var(--font-display);">Earnings</h2>'
        + '<p class="v-text-muted">Your gross revenue. After our 15% service fee + 5% VAT, host take-home is roughly 80%.</p>'
        + '<div class="v-kpi-grid v-mt-2" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr));">'
        +   '<div class="v-kpi"><div class="v-kpi-label">This month</div><div class="v-kpi-value" style="font-size:20px;">' + aed(thisM) + '</div></div>'
        +   '<div class="v-kpi"><div class="v-kpi-label">Last month</div><div class="v-kpi-value" style="font-size:20px;">' + aed(lastM) + '</div></div>'
        +   '<div class="v-kpi"><div class="v-kpi-label">Year to date</div><div class="v-kpi-value" style="font-size:20px;">' + aed(ytd) + '</div></div>'
        +   '<div class="v-kpi"><div class="v-kpi-label">All-time</div><div class="v-kpi-value" style="font-size:20px;">' + aed(all) + '</div></div>'
        + '</div>'
        + '<div class="v-panel v-mt-3">'
        +   '<div class="v-panel-head"><h3>Revenue by month</h3><span class="v-text-muted" style="font-size:12px;">Last 12 months</span></div>'
        +   '<div class="v-bars">'
        +     monthly.map(function (m) {
              var h = Math.max(8, (m.revenue / maxRev) * 160);
              return '<div class="bar" style="height:' + h + 'px;"><span class="v">' + Math.round(m.revenue / 1000) + 'k</span></div>';
            }).join('')
        +   '</div>'
        +   '<div class="v-bars-labels">' + monthly.map(function (m) { return '<span>' + m.label + '</span>'; }).join('') + '</div>'
        + '</div>'
        + '<div class="v-panel v-mt-3"><div class="v-panel-head"><h3>Payout history</h3></div><p class="v-text-muted">Demo only - in the live product this would list every payout with date, amount, and reference.</p></div>';
    });
  };

  sections.profile = function (host) {
    var sess = getSession();
    var h = D.HOSTS.find(function (x) { return x.id === sess.host_id; });
    var created = VacationApp.jget('vacation.hosts.created', []).find(function (x) { return x.id === sess.host_id; });
    if (created) h = created;
    var edits = VacationApp.jget('vacation.hosts.edits', {})[sess.host_id] || {};
    h = Object.assign({}, h, edits);
    if (!h) return host.innerHTML = '<div>Host not found.</div>';
    host.innerHTML = ''
      + '<h2 style="margin:0;font-family:var(--font-display);">Profile</h2>'
      + '<p class="v-text-muted">How travellers see you.</p>'
      + '<div class="v-panel v-mt-2" style="padding:18px;">'
      +   '<div style="display:flex;gap:16px;align-items:center;margin-bottom:18px;">'
      +     (h.photo ? '<img src="' + h.photo + '" style="width:64px;height:64px;border-radius:999px;object-fit:cover;">' : '<span style="font-size:42px;">👤</span>')
      +     '<div><div style="font-weight:600;font-family:var(--font-display);font-size:18px;">' + esc(h.name) + '</div><div class="v-text-muted">Joined ' + esc(h.joined) + ' · ' + esc((h.languages || []).join(', ')) + '</div></div>'
      +   '</div>'
      +   '<label class="v-field"><span>Display name</span><input class="v-input" id="pf-name" value="' + esc(h.name) + '" /></label>'
      +   '<label class="v-field" style="margin-top:10px;"><span>Photo URL</span><input class="v-input" id="pf-photo" value="' + esc(h.photo) + '" /></label>'
      +   '<label class="v-field" style="margin-top:10px;"><span>Bio</span><textarea class="v-textarea" id="pf-bio" rows="4">' + esc(h.bio || '') + '</textarea></label>'
      +   '<label class="v-field" style="margin-top:10px;"><span>Languages (comma-separated)</span><input class="v-input" id="pf-langs" value="' + esc((h.languages || []).join(', ')) + '" /></label>'
      +   '<div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end;">'
      +     '<button class="v-btn v-btn--primary" id="pf-save">Save changes</button>'
      +   '</div>'
      + '</div>';
    document.getElementById('pf-save').addEventListener('click', function () {
      var body = {
        name: document.getElementById('pf-name').value,
        photo: document.getElementById('pf-photo').value,
        bio: document.getElementById('pf-bio').value,
        languages: document.getElementById('pf-langs').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean)
      };
      VacationApp.api('/admin/hosts/' + sess.host_id, { method: 'PUT', body: body }).then(function () {
        window.toast && window.toast('Profile updated', 'success');
      });
    });
  };

  sections.verification = function (host) {
    VacationApp.api('/host/applications/me').then(function (r) {
      var a = r.body.application;
      if (!a) {
        host.innerHTML = ''
          + '<h2 style="margin:0;font-family:var(--font-display);">Verification</h2>'
          + '<div class="v-empty-illustration">'
          +   '<div class="v-empty-illustration-mark">🛡️</div>'
          +   '<h3>No application yet</h3>'
          +   '<p>You haven\'t submitted documents yet. Start the listing wizard to begin.</p>'
          +   '<a class="v-btn v-btn--primary" href="host-onboard.html">Start listing</a>'
          + '</div>';
        return;
      }
      var banner = {
        submitted:         { cls: 'pending',  icon: '⏳', title: 'Documents under review', text: 'Our team is reviewing your documents. This usually takes under 24 hours.' },
        changes_requested: { cls: 'changes',  icon: '↻',  title: 'Action needed',         text: 'Please re-upload the highlighted documents below. ' + (a.notes_from_admin ? '- ' + esc(a.notes_from_admin) : '') },
        approved:          { cls: 'approved', icon: '✓',  title: 'Verified',              text: 'All documents approved. You\'re a verified host on Vacation Homes.' },
        rejected:          { cls: 'rejected', icon: '✕',  title: 'Application rejected',  text: a.notes_from_admin ? esc(a.notes_from_admin) : 'Your application was rejected. Contact support to re-apply.' }
      }[a.status] || { cls: 'pending', icon: '⏳', title: a.status, text: '' };
      host.innerHTML = ''
        + '<h2 style="margin:0;font-family:var(--font-display);">Verification</h2>'
        + '<div class="v-verif-banner ' + banner.cls + '" style="margin-top:14px;">'
        +   '<div class="v-verif-banner-icon">' + banner.icon + '</div>'
        +   '<div class="v-verif-banner-body"><div class="v-verif-banner-title">' + esc(banner.title) + '</div><div class="v-verif-banner-text">' + banner.text + '</div></div>'
        + '</div>'
        + '<h3 style="margin-top:24px;">Submitted documents</h3>'
        + '<div class="v-doc-grid">' + (a.documents || []).map(function (doc) {
            var dt = (D.DOCUMENT_TYPES || []).find(function (t) { return t.id === doc.type; }) || { icon: '📎', label: doc.type };
            return '<div class="v-doc-card' + (doc.status === 'rejected' ? ' rejected' : '') + '">'
              + '<div class="v-doc-head"><div class="v-doc-icon">' + dt.icon + '</div><div class="v-doc-title">' + esc(dt.label) + '</div><span class="v-status-chip ' + esc(doc.status) + '">' + esc(doc.status) + '</span></div>'
              + '<div class="v-doc-preview"><div class="v-doc-thumb">' + (doc.thumb ? '<img src="' + esc(doc.thumb) + '" alt="">' : '<span class="v-doc-thumb-fallback">' + (doc.type === 'iban' ? '💳' : '📄') + '</span>') + '</div>'
              + '<div class="v-doc-meta"><div class="v-doc-meta-name">' + esc(doc.filename) + '</div></div></div>'
              + (doc.rejection_reason ? '<div class="v-doc-reject-reason"><strong>Reason:</strong> ' + esc(doc.rejection_reason) + '</div>' : '')
              + (doc.status === 'rejected' ? '<label class="v-btn v-btn--ghost v-btn--sm" style="position:relative;overflow:hidden;align-self:flex-start;margin-top:8px;">Re-upload<input type="file" accept="image/*,application/pdf" data-reup="' + esc(doc.type) + '" style="position:absolute;inset:0;opacity:0;cursor:pointer;" /></label>' : '')
              + '</div>';
          }).join('') + '</div>';
      document.querySelectorAll('[data-reup]').forEach(function (input) {
        input.addEventListener('change', function (ev) {
          var type = input.getAttribute('data-reup');
          var file = ev.target.files && ev.target.files[0];
          if (!file) return;
          if (!/^image\//.test(file.type)) {
            var doc = { type: type, filename: file.name, mime: file.type || 'application/pdf', thumb: null };
            VacationApp.api('/host/applications', { method: 'POST', body: { documents: [doc] } }).then(function () { window.toast && window.toast('Re-uploaded - status reset to submitted','success'); renderMain(); });
          } else {
            var fr = new FileReader();
            fr.onload = function () {
              VacationApp.api('/host/applications', { method: 'POST', body: { documents: [{ type: type, filename: file.name, mime: file.type, thumb: fr.result }] } }).then(function () { window.toast && window.toast('Re-uploaded - status reset to submitted','success'); renderMain(); });
            };
            fr.readAsDataURL(file);
          }
        });
      });
    });
  };

  window.addEventListener('hashchange', renderMain);
  document.addEventListener('DOMContentLoaded', function () {
    var sess = getSession();
    if (!sess) renderSignInScreen();
    else { renderSide(); renderMain(); }
  });
})();
