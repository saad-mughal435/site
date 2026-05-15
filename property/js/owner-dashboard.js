/* owner-dashboard.js - Manzil owner-side SPA for managing listings, inquiries,
   availability, earnings, profile, verification. Mirrors the vacation host
   dashboard pattern but scoped to a single signed-in property owner. */
(function () {
  'use strict';

  var D = window.MANZIL_DATA;
  var LS_SESSION = 'manzil.owner_session';
  var NAV = [
    { id: 'listings',     icon: '🏠', label: 'My listings' },
    { id: 'inquiries',    icon: '📨', label: 'Inquiries' },
    { id: 'availability', icon: '📅', label: 'Availability' },
    { id: 'earnings',     icon: '💰', label: 'Earnings' },
    { id: 'profile',      icon: '👤', label: 'Profile' },
    { id: 'verification', icon: '🛡', label: 'Verification' }
  ];

  function current() { return (location.hash || '#listings').slice(1); }
  function getSession() { try { return JSON.parse(localStorage.getItem(LS_SESSION)); } catch (e) { return null; } }
  function clearSession() { localStorage.removeItem(LS_SESSION); }
  function esc(s) { return ManzilApp.escapeHtml(String(s == null ? '' : s)); }
  function aed(n) { return 'AED ' + Math.round(n || 0).toLocaleString(); }

  // ---------- Sign-in / impersonation ----------
  function renderSignInScreen() {
    document.getElementById('host-side').style.display = 'none';
    document.getElementById('host-shell').style.gridTemplateColumns = '1fr';
    var apps = D.OWNER_APPLICATIONS || [];
    var preview = ['o01','o02','o03','o04','o05'].map(function (id) {
      var o = (D.OWNERS || []).find(function (x) { return x.id === id; });
      var a = apps.find(function (x) { return x.owner_id === id; });
      var status = (a && a.status) || (o && o.verified_at ? 'approved' : 'no application');
      var sub = { 'approved': 'Approved · verified owner', 'submitted': 'Submitted · awaiting admin review', 'changes_requested': 'Changes requested by admin', 'rejected': 'Rejected - needs new documents', 'no application': 'No application on file' }[status] || status;
      return { owner: o, status: status, sub: sub };
    }).filter(function (x) { return x.owner; });
    document.getElementById('host-main').innerHTML = ''
      + '<div style="max-width:760px;margin:0 auto;padding:32px 0;">'
      +   '<div style="text-align:center;margin-bottom:28px;">'
      +     '<a href="index.html" style="display:inline-flex;align-items:center;gap:10px;font-weight:700;font-size:18px;color:var(--manzil-ink);text-decoration:none;">'
      +       '<span style="width:36px;height:36px;border-radius:10px;background:var(--manzil-primary);color:white;display:grid;place-items:center;font-weight:800;">م</span> Manzil Properties'
      +     '</a>'
      +   '</div>'
      +   '<div class="m-panel" style="padding:24px;background:white;border:1px solid var(--manzil-line);border-radius:14px;">'
      +     '<h2 style="margin-top:0;">Sign in to your owner dashboard</h2>'
      +     '<p class="m-text-muted">Pick a demo owner to sign in as - each one shows a different state of the verification pipeline.</p>'
      +     '<div style="display:grid;gap:10px;margin-top:18px;">'
      +       preview.map(function (p) {
            return '<button class="m-doc-card" data-imp="' + esc(p.owner.id) + '" style="text-align:start;cursor:pointer;width:100%;padding:14px;font-family:inherit;">'
              + '<div style="display:flex;align-items:center;gap:12px;">'
              +   (p.owner.photo ? '<img src="' + p.owner.photo + '" style="width:42px;height:42px;border-radius:999px;object-fit:cover;">' : '<span style="font-size:28px;">👤</span>')
              +   '<div style="flex:1;"><div style="font-weight:600;">' + esc(p.owner.name) + '</div><div style="font-size:12px;color:var(--manzil-muted);">' + esc(p.sub) + '</div></div>'
              +   '<span class="m-status-chip ' + esc(p.status) + '">' + esc(p.status.replace('_',' ')) + '</span>'
              + '</div></button>';
          }).join('')
      +     '</div>'
      +     '<p class="m-text-muted" style="font-size:12px;margin-top:18px;text-align:center;">Or <a href="owner-onboard.html">list a new property →</a></p>'
      +   '</div>'
      + '</div>';
    document.querySelectorAll('[data-imp]').forEach(function (b) {
      b.addEventListener('click', function () {
        ManzilApp.api('/owner/session/impersonate', { method: 'POST', body: { owner_id: b.getAttribute('data-imp') } }).then(function () {
          document.getElementById('host-side').style.display = '';
          document.getElementById('host-shell').style.gridTemplateColumns = '';
          location.hash = '#listings'; renderSide(); renderMain();
        });
      });
    });
  }

  function renderSide() {
    var sess = getSession(); if (!sess) return;
    var o = (D.OWNERS || []).find(function (x) { return x.id === sess.owner_id; }) || { name: 'Unknown' };
    var created = ManzilApp.jget('manzil.owners.created', []).find(function (x) { return x.id === sess.owner_id; });
    if (created) o = created;
    var side = document.getElementById('host-side');
    var cur = current();
    side.innerHTML = ''
      + '<a class="m-host-side-brand" href="index.html"><span style="width:30px;height:30px;border-radius:8px;background:var(--manzil-primary);color:white;display:grid;place-items:center;font-weight:800;">م</span> Manzil</a>'
      + '<div style="padding:10px 8px;border-bottom:1px solid var(--manzil-line);display:flex;align-items:center;gap:10px;">'
      +   (o.photo ? '<img src="' + o.photo + '" style="width:36px;height:36px;border-radius:999px;object-fit:cover;">' : '<span style="font-size:24px;">👤</span>')
      +   '<div style="flex:1;overflow:hidden;"><div style="font-weight:600;font-size:13px;color:var(--manzil-ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(o.name) + '</div><div style="font-size:11px;color:var(--manzil-muted);">' + (o.verified ? '✓ Verified owner' : 'Owner') + '</div></div>'
      + '</div>'
      + '<nav class="m-host-nav">' + NAV.map(function (n) { return '<a href="#' + n.id + '" class="' + (cur === n.id ? 'is-active' : '') + '"><span>' + n.icon + '</span><span>' + esc(n.label) + '</span></a>'; }).join('') + '</nav>'
      + '<a class="m-btn m-btn--primary m-btn--sm" href="owner-onboard.html?mode=add-listing" style="margin:6px 8px 0;justify-content:center;">+ List another property</a>'
      + '<div class="m-host-side-foot"><button class="m-btn m-btn--ghost m-btn--sm" id="hs-switch" style="width:100%;">Switch owner</button></div>';
    document.getElementById('hs-switch').addEventListener('click', function () { clearSession(); renderSignInScreen(); });
  }

  function renderMain() {
    var sess = getSession(); if (!sess) return renderSignInScreen();
    var main = document.getElementById('host-main');
    var cur = current();
    var fn = sections[cur] || sections.listings;
    main.innerHTML = '<div class="m-text-muted">Loading…</div>';
    fn(main); renderSide();
  }

  var sections = {};

  sections.listings = function (host) {
    Promise.all([ManzilApp.api('/owner/dashboard'), ManzilApp.api('/owner/listings')]).then(function (rs) {
      var k = rs[0].body.kpis || {};
      var items = rs[1].body.items || [];
      host.innerHTML = ''
        + '<div style="display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;">'
        +   '<h2 style="margin:0;">My listings</h2>'
        +   '<a class="m-btn m-btn--primary m-btn--sm" href="owner-onboard.html?mode=add-listing">+ List another property</a>'
        + '</div>'
        + '<div class="m-kpi-grid m-mt-2" style="display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));margin-top:14px;">'
        +   '<div class="m-kpi" style="background:white;border:1px solid var(--manzil-line);border-radius:10px;padding:14px;"><div class="m-kpi-label" style="font-size:11px;color:var(--manzil-muted);text-transform:uppercase;">Live</div><div class="m-kpi-value" style="font-size:24px;font-weight:700;">' + (k.listings_live || 0) + '</div></div>'
        +   '<div class="m-kpi" style="background:white;border:1px solid var(--manzil-line);border-radius:10px;padding:14px;"><div class="m-kpi-label" style="font-size:11px;color:var(--manzil-muted);text-transform:uppercase;">Pending</div><div class="m-kpi-value" style="font-size:24px;font-weight:700;color:#8a6b1f;">' + (k.listings_pending || 0) + '</div></div>'
        +   '<div class="m-kpi" style="background:white;border:1px solid var(--manzil-line);border-radius:10px;padding:14px;"><div class="m-kpi-label" style="font-size:11px;color:var(--manzil-muted);text-transform:uppercase;">Inquiries</div><div class="m-kpi-value" style="font-size:24px;font-weight:700;">' + (k.inquiries_total || 0) + '</div></div>'
        +   '<div class="m-kpi" style="background:white;border:1px solid var(--manzil-line);border-radius:10px;padding:14px;"><div class="m-kpi-label" style="font-size:11px;color:var(--manzil-muted);text-transform:uppercase;">New leads</div><div class="m-kpi-value" style="font-size:24px;font-weight:700;color:var(--manzil-primary);">' + (k.inquiries_new || 0) + '</div></div>'
        + '</div>'
        + (items.length
          ? '<div class="m-panel m-mt-3" style="margin-top:18px;background:white;border:1px solid var(--manzil-line);border-radius:10px;padding:0;overflow:auto;">'
            + '<table class="m-table"><thead><tr><th>Photo</th><th>Title</th><th>Status</th><th>Price</th><th>Listed</th><th></th></tr></thead><tbody>'
            + items.map(function (l) {
              var s = l.status || 'active';
              return '<tr>'
                + '<td><img src="' + esc(l.photos && l.photos[0]) + '" style="width:54px;height:36px;object-fit:cover;border-radius:4px;"></td>'
                + '<td><strong>' + esc(l.title) + '</strong>' + (l.review_note ? '<div style="font-size:11px;color:#c2503f;">⚠ ' + esc(l.review_note) + '</div>' : '') + '</td>'
                + '<td><span class="m-status-chip ' + esc(s) + '">' + esc(s.replace('_',' ')) + '</span></td>'
                + '<td>' + aed(l.price_aed) + (l.transaction === 'rent' ? '/year' : '') + '</td>'
                + '<td>' + (l.listed_at ? l.listed_at.slice(0,10) : '—') + '</td>'
                + '<td class="m-table-actions">'
                +   '<a class="m-btn m-btn--ghost m-btn--sm" href="listing.html?id=' + esc(l.id) + '" target="_blank">View</a>'
                +   '<a class="m-btn m-btn--ghost m-btn--sm" href="owner-onboard.html?mode=edit&id=' + esc(l.id) + '">Edit</a>'
                +   (s === 'active' ? '<button class="m-btn m-btn--ghost m-btn--sm" data-pause="' + esc(l.id) + '">Pause</button>' : (s === 'paused' ? '<button class="m-btn m-btn--ghost m-btn--sm" data-unpause="' + esc(l.id) + '">Unpause</button>' : ''))
                + '</td></tr>';
            }).join('')
            + '</tbody></table></div>'
          : '<div class="m-empty-illustration m-mt-3"><div class="m-empty-illustration-mark">🏠</div><h3>No listings yet</h3><p>List your first property to start receiving inquiries on Manzil.</p><a class="m-btn m-btn--primary" href="owner-onboard.html">Start listing</a></div>');
      document.querySelectorAll('[data-pause]').forEach(function (b) { b.addEventListener('click', function () { ManzilApp.api('/owner/listings/' + b.getAttribute('data-pause') + '/pause', { method: 'POST', body: {} }).then(function () { window.toast && window.toast('Listing paused', 'success'); renderMain(); }); }); });
      document.querySelectorAll('[data-unpause]').forEach(function (b) { b.addEventListener('click', function () { ManzilApp.api('/owner/listings/' + b.getAttribute('data-unpause') + '/unpause', { method: 'POST', body: {} }).then(function () { window.toast && window.toast('Listing live again', 'success'); renderMain(); }); }); });
    });
  };

  sections.inquiries = function (host) {
    ManzilApp.api('/owner/inquiries').then(function (r) {
      var items = r.body.items || [];
      host.innerHTML = ''
        + '<h2>Inquiries</h2>'
        + '<p class="m-text-muted">Messages and viewing requests from people interested in your listings.</p>'
        + (items.length
          ? '<div class="m-panel m-mt-2" style="background:white;border:1px solid var(--manzil-line);border-radius:10px;padding:0;overflow:auto;"><table class="m-table"><thead><tr><th>From</th><th>Listing</th><th>Message</th><th>Status</th><th>Date</th></tr></thead><tbody>'
            + items.map(function (q) {
              var l = (D.LISTINGS || []).find(function (x) { return x.id === q.listing_id; }) || {};
              return '<tr><td>' + esc(q.name || '—') + '<div style="font-size:11px;color:var(--manzil-muted);">' + esc(q.email || '') + '</div></td><td>' + esc(l.title || q.listing_id) + '</td><td style="max-width:400px;">' + esc((q.message || '').slice(0, 120)) + (q.message && q.message.length > 120 ? '…' : '') + '</td><td><span class="m-chip ' + esc(q.status || 'new') + '">' + esc(q.status || 'new') + '</span></td><td>' + (q.created_at ? q.created_at.slice(0, 10) : '—') + '</td></tr>';
            }).join('')
            + '</tbody></table></div>'
          : '<div class="m-empty-illustration m-mt-2"><div class="m-empty-illustration-mark">📨</div><p>No inquiries on your listings yet.</p></div>');
    });
  };

  sections.availability = function (host) {
    ManzilApp.api('/owner/listings').then(function (r) {
      var items = r.body.items || [];
      host.innerHTML = ''
        + '<h2>Availability</h2>'
        + '<p class="m-text-muted">Quick toggle for each listing.</p>'
        + (items.length
          ? '<div class="m-panel m-mt-2" style="background:white;border:1px solid var(--manzil-line);border-radius:10px;padding:0;overflow:auto;"><table class="m-table"><thead><tr><th>Listing</th><th>Current status</th><th>Action</th></tr></thead><tbody>'
            + items.map(function (l) {
              var s = l.status || 'active';
              return '<tr><td>' + esc(l.title) + '</td><td><span class="m-status-chip ' + esc(s) + '">' + esc(s.replace('_',' ')) + '</span></td><td>' + (s === 'active' ? '<button class="m-btn m-btn--ghost m-btn--sm" data-pause="' + esc(l.id) + '">Pause</button>' : (s === 'paused' ? '<button class="m-btn m-btn--ghost m-btn--sm" data-unpause="' + esc(l.id) + '">Unpause</button>' : '—')) + '</td></tr>';
            }).join('')
            + '</tbody></table></div>'
          : '<div class="m-empty-illustration m-mt-2"><div class="m-empty-illustration-mark">📅</div><p>No listings to manage availability for.</p></div>');
      document.querySelectorAll('[data-pause]').forEach(function (b) { b.addEventListener('click', function () { ManzilApp.api('/owner/listings/' + b.getAttribute('data-pause') + '/pause', { method: 'POST', body: {} }).then(function () { renderMain(); }); }); });
      document.querySelectorAll('[data-unpause]').forEach(function (b) { b.addEventListener('click', function () { ManzilApp.api('/owner/listings/' + b.getAttribute('data-unpause') + '/unpause', { method: 'POST', body: {} }).then(function () { renderMain(); }); }); });
    });
  };

  sections.earnings = function (host) {
    ManzilApp.api('/owner/listings').then(function (r) {
      var items = r.body.items || [];
      var totalValue = items.filter(function (l) { return l.status === 'active'; }).reduce(function (s, l) { return s + (l.price_aed || 0); }, 0);
      host.innerHTML = ''
        + '<h2>Estimated earnings</h2>'
        + '<p class="m-text-muted">Portfolio value snapshot. Replace with broker analytics in the live product.</p>'
        + '<div class="m-kpi-grid m-mt-2" style="display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));">'
        +   '<div class="m-kpi" style="background:white;border:1px solid var(--manzil-line);border-radius:10px;padding:14px;"><div class="m-kpi-label" style="font-size:11px;color:var(--manzil-muted);text-transform:uppercase;">Portfolio value (live listings)</div><div class="m-kpi-value" style="font-size:20px;font-weight:700;">' + aed(totalValue) + '</div></div>'
        +   '<div class="m-kpi" style="background:white;border:1px solid var(--manzil-line);border-radius:10px;padding:14px;"><div class="m-kpi-label" style="font-size:11px;color:var(--manzil-muted);text-transform:uppercase;">Active listings</div><div class="m-kpi-value" style="font-size:24px;font-weight:700;">' + items.filter(function (l) { return l.status === 'active'; }).length + '</div></div>'
        +   '<div class="m-kpi" style="background:white;border:1px solid var(--manzil-line);border-radius:10px;padding:14px;"><div class="m-kpi-label" style="font-size:11px;color:var(--manzil-muted);text-transform:uppercase;">Pending review</div><div class="m-kpi-value" style="font-size:24px;font-weight:700;color:#8a6b1f;">' + items.filter(function (l) { return l.status === 'pending_review' || l.status === 'awaiting_owner_verification' || l.status === 'changes_requested'; }).length + '</div></div>'
        + '</div>'
        + '<div class="m-panel m-mt-3" style="background:white;border:1px solid var(--manzil-line);border-radius:10px;padding:18px;margin-top:18px;"><h3>Payout history</h3><p class="m-text-muted">Demo only - in the live product this would list every commission settlement and security deposit transfer.</p></div>';
    });
  };

  sections.profile = function (host) {
    var sess = getSession();
    var o = (D.OWNERS || []).find(function (x) { return x.id === sess.owner_id; });
    var created = ManzilApp.jget('manzil.owners.created', []).find(function (x) { return x.id === sess.owner_id; });
    if (created) o = created;
    var edits = ManzilApp.jget('manzil.owners.edits', {})[sess.owner_id] || {};
    o = Object.assign({}, o, edits);
    if (!o) return host.innerHTML = '<div>Owner not found.</div>';
    host.innerHTML = ''
      + '<h2>Profile</h2>'
      + '<p class="m-text-muted">How buyers and renters see you on listings.</p>'
      + '<div class="m-panel m-mt-2" style="background:white;border:1px solid var(--manzil-line);border-radius:10px;padding:18px;margin-top:14px;">'
      +   '<div style="display:flex;gap:16px;align-items:center;margin-bottom:18px;">' + (o.photo ? '<img src="' + o.photo + '" style="width:64px;height:64px;border-radius:999px;object-fit:cover;">' : '<span style="font-size:42px;">👤</span>') + '<div><div style="font-weight:700;font-size:18px;">' + esc(o.name) + '</div><div class="m-text-muted">Joined ' + esc(o.joined) + ' · ' + esc((o.languages || []).join(', ')) + '</div></div></div>'
      +   '<label class="m-field"><span>Display name</span><input class="m-input" id="pf-name" value="' + esc(o.name) + '"/></label>'
      +   '<label class="m-field" style="margin-top:10px;"><span>Photo URL</span><input class="m-input" id="pf-photo" value="' + esc(o.photo) + '"/></label>'
      +   '<label class="m-field" style="margin-top:10px;"><span>Bio</span><textarea class="m-textarea" id="pf-bio" rows="4">' + esc(o.bio || '') + '</textarea></label>'
      +   '<label class="m-field" style="margin-top:10px;"><span>Languages (comma-separated)</span><input class="m-input" id="pf-langs" value="' + esc((o.languages || []).join(', ')) + '"/></label>'
      +   '<div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end;"><button class="m-btn m-btn--primary" id="pf-save">Save changes</button></div>'
      + '</div>';
    document.getElementById('pf-save').addEventListener('click', function () {
      var oe = ManzilApp.jget('manzil.owners.edits', {});
      oe[sess.owner_id] = Object.assign({}, oe[sess.owner_id] || {}, {
        name: document.getElementById('pf-name').value,
        photo: document.getElementById('pf-photo').value,
        bio: document.getElementById('pf-bio').value,
        languages: document.getElementById('pf-langs').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean)
      });
      ManzilApp.jset('manzil.owners.edits', oe);
      window.toast && window.toast('Profile updated', 'success');
    });
  };

  sections.verification = function (host) {
    ManzilApp.api('/owner/applications/me').then(function (r) {
      var a = r.body.application;
      if (!a) {
        host.innerHTML = '<h2>Verification</h2><div class="m-empty-illustration"><div class="m-empty-illustration-mark">🛡️</div><h3>No application yet</h3><p>You have not submitted documents yet. Start the listing wizard to begin.</p><a class="m-btn m-btn--primary" href="owner-onboard.html">Start listing</a></div>';
        return;
      }
      var banner = { submitted: { cls: 'pending', icon: '⏳', title: 'Documents under review', text: 'Our team is reviewing your documents. This usually takes 24-48 hours.' }, changes_requested: { cls: 'changes', icon: '↻', title: 'Action needed', text: 'Please re-upload the highlighted documents below. ' + (a.notes_from_admin ? '- ' + esc(a.notes_from_admin) : '') }, approved: { cls: 'approved', icon: '✓', title: 'Verified owner', text: 'All documents approved. You are a verified owner on Manzil.' }, rejected: { cls: 'rejected', icon: '✕', title: 'Application rejected', text: a.notes_from_admin ? esc(a.notes_from_admin) : 'Your application was rejected. Contact support to re-apply.' } }[a.status] || { cls: 'pending', icon: '⏳', title: a.status, text: '' };
      host.innerHTML = ''
        + '<h2>Verification</h2>'
        + '<div class="m-verif-banner ' + banner.cls + '" style="margin-top:14px;"><div class="m-verif-banner-icon">' + banner.icon + '</div><div class="m-verif-banner-body"><div class="m-verif-banner-title">' + esc(banner.title) + '</div><div class="m-verif-banner-text">' + banner.text + '</div></div></div>'
        + '<h3 style="margin-top:24px;">Submitted documents</h3>'
        + '<div class="m-doc-grid">' + (a.documents || []).map(function (doc) {
            var dt = (D.DOCUMENT_TYPES || []).find(function (t) { return t.id === doc.type; }) || { icon: '📎', label: doc.type };
            return '<div class="m-doc-card' + (doc.status === 'rejected' ? ' rejected' : '') + '"><div class="m-doc-head"><div class="m-doc-icon">' + dt.icon + '</div><div class="m-doc-title">' + esc(dt.label) + '</div><span class="m-status-chip ' + esc(doc.status) + '">' + esc(doc.status) + '</span></div><div class="m-doc-preview"><div class="m-doc-thumb">' + (doc.thumb ? '<img src="' + esc(doc.thumb) + '">' : '<span class="m-doc-thumb-fallback">' + (doc.type === 'iban' || doc.type === 'dld_permit' ? '💳' : '📄') + '</span>') + '</div><div class="m-doc-meta"><div class="m-doc-meta-name">' + esc(doc.filename) + '</div></div></div>' + (doc.rejection_reason ? '<div class="m-doc-reject-reason"><strong>Reason:</strong> ' + esc(doc.rejection_reason) + '</div>' : '') + (doc.status === 'rejected' ? '<label class="m-btn m-btn--ghost m-btn--sm" style="position:relative;overflow:hidden;align-self:flex-start;margin-top:8px;">Re-upload<input type="file" accept="image/*,application/pdf" data-reup="' + esc(doc.type) + '" style="position:absolute;inset:0;opacity:0;cursor:pointer;"/></label>' : '') + '</div>';
          }).join('') + '</div>';
      document.querySelectorAll('[data-reup]').forEach(function (input) {
        input.addEventListener('change', function (ev) {
          var type = input.getAttribute('data-reup');
          var file = ev.target.files && ev.target.files[0]; if (!file) return;
          if (!/^image\//.test(file.type)) {
            ManzilApp.api('/owner/applications', { method: 'POST', body: { documents: [{ type: type, filename: file.name, mime: file.type || 'application/pdf', thumb: null }] } }).then(function () { window.toast && window.toast('Re-uploaded - status reset to submitted','success'); renderMain(); });
          } else {
            var fr = new FileReader();
            fr.onload = function () { ManzilApp.api('/owner/applications', { method: 'POST', body: { documents: [{ type: type, filename: file.name, mime: file.type, thumb: fr.result }] } }).then(function () { window.toast && window.toast('Re-uploaded - status reset to submitted','success'); renderMain(); }); };
            fr.readAsDataURL(file);
          }
        });
      });
    });
  };

  window.addEventListener('hashchange', renderMain);
  document.addEventListener('DOMContentLoaded', function () {
    var sess = getSession();
    if (!sess) renderSignInScreen(); else { renderSide(); renderMain(); }
  });
})();
