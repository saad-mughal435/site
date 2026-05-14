/* mock-api.js — Intercepts fetch to /vacation/api/* and serves from
   VACATION_DATA + localStorage. Implements public booking flow with
   conflict-check and full admin surface. All writes are local-only. */
(function () {
  'use strict';

  if (!window.VACATION_DATA) {
    console.error('mock-api: VACATION_DATA not loaded — include data.js first');
    return;
  }

  // ---------- localStorage keys ----------
  var LS = {
    user:               'vacation.user',
    favorites:          'vacation.favorites',
    bookings_created:   'vacation.bookings.created',
    bookings_status:    'vacation.bookings.status',     // { bookingId: 'cancelled' }
    bookings_messages:  'vacation.bookings.messages',   // { bookingId: [msg, ...] }
    listings_created:   'vacation.listings.created',
    listings_edits:     'vacation.listings.edits',
    listings_deleted:   'vacation.listings.deleted',
    hosts_created:      'vacation.hosts.created',
    hosts_edits:        'vacation.hosts.edits',
    hosts_deleted:      'vacation.hosts.deleted',
    guests_edits:       'vacation.guests.edits',
    reviews_created:    'vacation.reviews.created',
    reviews_status:     'vacation.reviews.status',
    promotions:         'vacation.promotions',
    content_dest:       'vacation.content.destinations',
    settings:           'vacation.settings.overrides',
    audit:              'vacation.audit',
    notifications:      'vacation.notifications',
    host_session:       'vacation.host_session',         // current logged-in host { host_id, started_at }
    host_applications:  'vacation.host_applications',    // overrides on seed HOST_APPLICATIONS, keyed by host_id
    host_draft:         'vacation.host_draft'            // wizard save-and-resume payload
  };

  function jget(k, def) { try { return JSON.parse(localStorage.getItem(k)) || def; } catch (e) { return def; } }
  function jset(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

  function getUser() {
    var u = jget(LS.user, null);
    if (!u) {
      u = window.VACATION_DATA.GUESTS[0];  // Demo Guest
      jset(LS.user, u);
    }
    return u;
  }

  /* ---------- Merged views ---------- */
  function listings() {
    var seed = window.VACATION_DATA.LISTINGS.slice();
    var created = jget(LS.listings_created, []);
    var edits = jget(LS.listings_edits, {});
    var deleted = jget(LS.listings_deleted, []);
    return seed.concat(created).filter(function (l) { return deleted.indexOf(l.id) === -1; })
      .map(function (l) { return edits[l.id] ? Object.assign({}, l, edits[l.id]) : l; });
  }
  // Public-facing view: only listings that have been approved by admin appear on the marketplace.
  // Direct ID/slug lookup uses listings() so hosts can preview their own pending listing.
  function liveListings() {
    return listings().filter(function (l) { return !l.status || l.status === 'live'; });
  }
  function hosts() {
    var seed = window.VACATION_DATA.HOSTS.slice();
    var created = jget(LS.hosts_created, []);
    var edits = jget(LS.hosts_edits, {});
    var deleted = jget(LS.hosts_deleted, []);
    return seed.concat(created).filter(function (h) { return deleted.indexOf(h.id) === -1; })
      .map(function (h) { return edits[h.id] ? Object.assign({}, h, edits[h.id]) : h; });
  }
  function bookings() {
    var seed = window.VACATION_DATA.BOOKINGS.slice();
    var created = jget(LS.bookings_created, []);
    var status = jget(LS.bookings_status, {});
    var msgs = jget(LS.bookings_messages, {});
    return seed.concat(created).map(function (b) {
      var copy = Object.assign({}, b);
      if (status[b.id]) copy.status = status[b.id];
      if (msgs[b.id]) copy.messages = (b.messages || []).concat(msgs[b.id]);
      return copy;
    });
  }
  function reviews() {
    var seed = window.VACATION_DATA.REVIEWS.slice();
    var created = jget(LS.reviews_created, []);
    return seed.concat(created);
  }
  // Merged view of host applications — seed + per-host overrides from localStorage.
  function applications() {
    var seed = (window.VACATION_DATA.HOST_APPLICATIONS || []).slice();
    var overrides = jget(LS.host_applications, {});
    var seedByHost = {};
    seed.forEach(function (a) { seedByHost[a.host_id] = a; });
    // Apply overrides; new applications come in as keys not present in seedByHost.
    Object.keys(overrides).forEach(function (hid) {
      seedByHost[hid] = Object.assign({}, seedByHost[hid] || {}, overrides[hid]);
    });
    return Object.keys(seedByHost).map(function (hid) { return seedByHost[hid]; });
  }
  function getApplication(host_id) {
    return applications().find(function (a) { return a.host_id === host_id; }) || null;
  }
  function saveApplication(host_id, app) {
    var o = jget(LS.host_applications, {});
    o[host_id] = app;
    jset(LS.host_applications, o);
  }
  function pushNotification(n) {
    var l = jget(LS.notifications, []);
    l.unshift(Object.assign({ id: 'n' + Date.now(), when: Date.now(), unread: true }, n));
    jset(LS.notifications, l.slice(0, 40));
  }
  function guests() {
    var seed = window.VACATION_DATA.GUESTS.slice();
    var edits = jget(LS.guests_edits, {});
    return seed.map(function (g) { return edits[g.id] ? Object.assign({}, g, edits[g.id]) : g; });
  }

  function audit(action, target, details) {
    var log = jget(LS.audit, []);
    log.unshift({ id: 'AU' + Date.now(), action: action, target: target, details: details || '', when: new Date().toISOString(), actor: getUser().name || 'Demo Admin' });
    jset(LS.audit, log.slice(0, 200));
  }

  /* ---------- Date helpers ---------- */
  function ymd(d) {
    if (!d) return '';
    if (typeof d === 'string') return d.slice(0, 10);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function datesInRange(checkIn, checkOut) {
    // Returns inclusive list of YYYY-MM-DD dates from checkIn up to but excluding checkOut.
    var out = [];
    if (!checkIn || !checkOut) return out;
    var d = new Date(checkIn);
    var end = new Date(checkOut);
    while (d < end) {
      out.push(ymd(d));
      d.setDate(d.getDate() + 1);
    }
    return out;
  }
  function rangesOverlap(aIn, aOut, bIn, bOut) {
    return !(aOut <= bIn || bOut <= aIn);
  }

  /* ---------- Availability ---------- */
  function bookedDatesForListing(listingId) {
    var b = bookings().filter(function (bk) {
      return bk.listing_id === listingId && bk.status !== 'cancelled' && bk.status !== 'refunded';
    });
    var dates = [];
    b.forEach(function (bk) { datesInRange(bk.check_in, bk.check_out).forEach(function (d) { dates.push(d); }); });
    return Array.from(new Set(dates));
  }
  function blockedDatesForListing(listingId) {
    var l = listings().find(function (x) { return x.id === listingId; });
    return (l && l.blocked_dates) || [];
  }
  function isAvailable(listingId, checkIn, checkOut) {
    var blocked = blockedDatesForListing(listingId);
    var booked = bookedDatesForListing(listingId);
    var rangeDates = datesInRange(checkIn, checkOut);
    for (var i = 0; i < rangeDates.length; i++) {
      if (blocked.indexOf(rangeDates[i]) !== -1) return false;
      if (booked.indexOf(rangeDates[i]) !== -1) return false;
    }
    return true;
  }

  /* ---------- Quote (price breakdown) ---------- */
  function quote(listing, checkIn, checkOut) {
    if (!listing || !checkIn || !checkOut) return null;
    var dates = datesInRange(checkIn, checkOut);
    if (!dates.length) return null;
    var subtotal = 0;
    var weekendNights = 0;
    var baseSub = 0;
    var night = listing.base_nightly_aed;
    var surchargePct = (listing.weekend_surcharge_pct || 0) / 100;
    dates.forEach(function (d) {
      var dow = new Date(d).getDay();
      var isWeekend = (dow === 0 || dow === 6);  // Sat + Sun
      var rate = isWeekend ? Math.round(night * (1 + surchargePct)) : night;
      subtotal += rate;
      baseSub += night;
      if (isWeekend) weekendNights++;
    });
    var cleaning = listing.cleaning_fee_aed || 0;
    var serviceFeePct = 0.10;
    var serviceFee = Math.round((subtotal + cleaning) * serviceFeePct);
    var vat = Math.round((subtotal + cleaning + serviceFee) * 0.05);
    var total = subtotal + cleaning + serviceFee + vat;
    return {
      nights: dates.length,
      base_nightly: listing.base_nightly_aed,
      base_subtotal: baseSub,
      weekend_nights: weekendNights,
      weekend_surcharge: subtotal - baseSub,
      nightly_subtotal: subtotal,
      cleaning_fee: cleaning,
      service_fee: serviceFee,
      vat: vat,
      total: total
    };
  }

  /* ---------- Filtering ---------- */
  function filterListings(p) {
    var rows = liveListings();
    if (p.q) {
      var q = String(p.q).toLowerCase();
      rows = rows.filter(function (l) { return (l.title + ' ' + (l.address || '') + ' ' + l.type).toLowerCase().indexOf(q) !== -1; });
    }
    if (p.destination) rows = rows.filter(function (l) { return l.destination_id === p.destination; });
    if (p.type)        rows = rows.filter(function (l) { return l.type === p.type; });
    if (p.max_guests)  rows = rows.filter(function (l) { return l.max_guests >= Number(p.max_guests); });
    if (p.beds)        rows = rows.filter(function (l) { return l.bedrooms >= Number(p.beds); });
    if (p.price_min)   rows = rows.filter(function (l) { return l.base_nightly_aed >= Number(p.price_min); });
    if (p.price_max)   rows = rows.filter(function (l) { return l.base_nightly_aed <= Number(p.price_max); });
    if (p.instant_book === 'true') rows = rows.filter(function (l) { return l.instant_book; });
    if (p.amenities) {
      var amens = String(p.amenities).split(',').filter(Boolean);
      if (amens.length) rows = rows.filter(function (l) { return amens.every(function (a) { return (l.amenities || []).indexOf(a) !== -1; }); });
    }
    // Date-aware availability filter
    if (p.check_in && p.check_out) {
      rows = rows.filter(function (l) { return isAvailable(l.id, p.check_in, p.check_out); });
    }
    // Sort
    var sort = p.sort || 'featured';
    if (sort === 'featured')         rows.sort(function (a, b) { return (b.featured ? 1 : 0) - (a.featured ? 1 : 0); });
    else if (sort === 'cheapest')    rows.sort(function (a, b) { return a.base_nightly_aed - b.base_nightly_aed; });
    else if (sort === 'priciest')    rows.sort(function (a, b) { return b.base_nightly_aed - a.base_nightly_aed; });
    else if (sort === 'highest-rated') rows.sort(function (a, b) { return b.rating - a.rating; });
    else if (sort === 'newest')      rows.sort(function (a, b) { return new Date(b.listed_at) - new Date(a.listed_at); });
    return rows;
  }

  /* ---------- Route handler ---------- */
  function handle(method, path, body, params) {
    // ----- Auth -----
    if (path === '/account') return { ok: true, user: getUser() };
    if (path === '/auth/login') { jset(LS.user, body.user || getUser()); return { ok: true }; }
    if (path === '/auth/logout') { localStorage.removeItem(LS.user); return { ok: true }; }

    // ----- Listings -----
    if (path === '/listings') {
      var rows = filterListings(params || {});
      var page = Math.max(1, Number(params.page || 1));
      var size = Math.max(1, Number(params.page_size || 12));
      var total = rows.length;
      var paged = rows.slice((page - 1) * size, page * size);
      return { ok: true, total: total, page: page, page_size: size, items: paged };
    }
    if (path === '/listings/featured') return { ok: true, items: liveListings().filter(function (l) { return l.featured; }).slice(0, 8) };

    var m;
    if (m = path.match(/^\/listings\/([^\/]+)$/)) {
      var l = listings().find(function (x) { return x.id === m[1] || x.slug === m[1]; });
      if (!l) return { ok: false, error: 'not_found' };
      var host = hosts().find(function (h) { return h.id === l.host_id; });
      var similar = listings().filter(function (x) { return x.id !== l.id && x.destination_id === l.destination_id; }).slice(0, 4);
      var listingReviews = reviews().filter(function (r) { return r.listing_id === l.id; }).slice(0, 12);
      return { ok: true, listing: l, host: host, similar: similar, reviews: listingReviews };
    }

    // ----- Destinations -----
    if (path === '/destinations') {
      var withCounts = window.VACATION_DATA.DESTINATIONS.map(function (d) {
        var count = liveListings().filter(function (l) { return l.destination_id === d.id; }).length;
        return Object.assign({}, d, { listings_count: count });
      });
      return { ok: true, items: withCounts };
    }
    if (m = path.match(/^\/destinations\/([^\/]+)$/)) {
      var dest = window.VACATION_DATA.DESTINATIONS.find(function (x) { return x.slug === m[1] || x.id === m[1]; });
      if (!dest) return { ok: false, error: 'not_found' };
      var topL = liveListings().filter(function (l) { return l.destination_id === dest.id; }).slice(0, 8);
      return { ok: true, destination: dest, top_listings: topL };
    }

    // ----- Hosts -----
    if (m = path.match(/^\/hosts\/([^\/]+)$/)) {
      var h = hosts().find(function (x) { return x.id === m[1]; });
      if (!h) return { ok: false, error: 'not_found' };
      var hL = liveListings().filter(function (l) { return l.host_id === h.id; });
      var hR = reviews().filter(function (r) { return r.host_id === h.id; });
      return { ok: true, host: h, listings: hL, reviews: hR };
    }

    // ----- Availability -----
    if (m = path.match(/^\/availability\/([^\/]+)$/)) {
      return {
        ok: true,
        listing_id: m[1],
        blocked: blockedDatesForListing(m[1]),
        booked: bookedDatesForListing(m[1])
      };
    }

    // ----- Quote -----
    if (path === '/quote' && method === 'POST') {
      var lst = listings().find(function (x) { return x.id === body.listing_id; });
      if (!lst) return { ok: false, error: 'not_found' };
      var q = quote(lst, body.check_in, body.check_out);
      if (!q) return { ok: false, error: 'invalid_dates' };
      return { ok: true, quote: q };
    }

    // ----- Bookings -----
    if (path === '/bookings' && method === 'POST') {
      var lst2 = listings().find(function (x) { return x.id === body.listing_id; });
      if (!lst2) return { ok: false, error: 'not_found' };
      // Conflict check: any other non-cancelled booking overlapping the requested range?
      if (!isAvailable(lst2.id, body.check_in, body.check_out)) {
        return { ok: false, error: 'conflict', status: 409, message: 'These dates were just booked or blocked by the host. Please pick a different range.' };
      }
      var q2 = quote(lst2, body.check_in, body.check_out);
      var booking = {
        id: 'B' + Date.now(),
        ref_number: 'VH-' + String(Date.now()).slice(-7),
        listing_id: lst2.id, host_id: lst2.host_id, guest_id: getUser().id,
        check_in: body.check_in, check_out: body.check_out,
        nights: q2.nights, guests_count: body.guests_count || 2,
        status: lst2.instant_book ? 'confirmed' : 'pending',
        pricing: q2,
        payment_status: 'paid',
        created_at: new Date().toISOString(),
        messages: []
      };
      var existing = jget(LS.bookings_created, []);
      existing.unshift(booking);
      jset(LS.bookings_created, existing);
      audit('booking.create', booking.id, body.check_in + ' → ' + body.check_out);
      // Push notification
      var notifs = jget(LS.notifications, []);
      notifs.unshift({ id: 'n' + Date.now(), title: 'Booking confirmed', body: lst2.title + ' · ' + body.check_in + ' → ' + body.check_out, when: Date.now(), unread: true });
      jset(LS.notifications, notifs.slice(0, 30));
      return { ok: true, booking: booking };
    }
    if (path === '/bookings' && method === 'GET') {
      var u = getUser();
      return { ok: true, items: bookings().filter(function (b) { return b.guest_id === u.id; }) };
    }
    if (m = path.match(/^\/bookings\/([^\/]+)$/) && method === 'GET') {
      var bk = bookings().find(function (x) { return x.id === m[1] || x.ref_number === m[1]; });
      if (!bk) return { ok: false, error: 'not_found' };
      var bL = listings().find(function (x) { return x.id === bk.listing_id; });
      var bH = hosts().find(function (x) { return x.id === bk.host_id; });
      return { ok: true, booking: bk, listing: bL, host: bH };
    }
    if (m = path.match(/^\/bookings\/([^\/]+)\/cancel$/) && method === 'POST') {
      var st = jget(LS.bookings_status, {});
      st[m[1]] = 'cancelled';
      jset(LS.bookings_status, st);
      audit('booking.cancel', m[1], '');
      return { ok: true };
    }
    if (m = path.match(/^\/bookings\/([^\/]+)\/message$/) && method === 'POST') {
      var msgs = jget(LS.bookings_messages, {});
      msgs[m[1]] = msgs[m[1]] || [];
      msgs[m[1]].push({ from: body.from || 'guest', body: body.body, when: new Date().toISOString() });
      jset(LS.bookings_messages, msgs);
      return { ok: true };
    }

    // ----- Reviews -----
    if (path === '/reviews' && method === 'POST') {
      var r = Object.assign({}, body, {
        id: 'R' + Date.now(),
        guest_id: getUser().id,
        date: new Date().toISOString().slice(0, 10)
      });
      var rc = jget(LS.reviews_created, []);
      rc.unshift(r);
      jset(LS.reviews_created, rc);
      audit('review.create', r.id, '');
      return { ok: true, review: r };
    }

    // ----- Favorites -----
    if (path === '/favorites' && method === 'GET') {
      var ids = jget(LS.favorites, []);
      return { ok: true, items: listings().filter(function (l) { return ids.indexOf(l.id) !== -1; }) };
    }
    if (path === '/favorites' && method === 'POST') {
      var ids2 = jget(LS.favorites, []);
      if (body.action === 'add' && ids2.indexOf(body.id) === -1) ids2.push(body.id);
      else if (body.action === 'remove') ids2 = ids2.filter(function (x) { return x !== body.id; });
      jset(LS.favorites, ids2);
      return { ok: true, items: ids2 };
    }

    // ----- Notifications -----
    if (path === '/notifications' && method === 'GET') {
      return { ok: true, items: jget(LS.notifications, []) };
    }
    if (path === '/notifications' && method === 'POST') {
      if (body.action === 'mark_all_read') {
        var l = jget(LS.notifications, []).map(function (n) { n.unread = false; return n; });
        jset(LS.notifications, l);
      }
      return { ok: true };
    }

    /* ================== HOST (public producer side) ================== */

    // Sign up as a host — creates a host record + sets session.
    if (path === '/auth/host-signup' && method === 'POST') {
      var hid = 'h' + Date.now();
      var newHost = {
        id: hid,
        name: body.name || 'New host',
        email: body.email || '',
        phone: body.phone || '',
        photo: body.photo || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80&auto=format&fit=crop&crop=faces',
        joined: new Date().toISOString().slice(0, 7),
        response_rate: 95, response_time_hrs: 2,
        languages: body.languages || ['English'],
        superhost: false,
        bio: body.bio || '',
        verified: false
      };
      var hc2 = jget(LS.hosts_created, []); hc2.unshift(newHost); jset(LS.hosts_created, hc2);
      jset(LS.host_session, { host_id: hid, started_at: new Date().toISOString() });
      audit('host.signup', hid, newHost.name);
      return { ok: true, host: newHost };
    }

    // Current host session
    if (path === '/host/session' && method === 'GET') {
      var sess = jget(LS.host_session, null);
      if (!sess) return { ok: false, error: 'not_authenticated', status: 401 };
      var hh = hosts().find(function (x) { return x.id === sess.host_id; });
      return { ok: true, session: sess, host: hh };
    }
    if (path === '/host/session' && method === 'DELETE') {
      localStorage.removeItem(LS.host_session);
      return { ok: true };
    }
    // For demo convenience: log in as any seed host so reviewers can poke around without going through signup.
    if (path === '/host/session/impersonate' && method === 'POST') {
      jset(LS.host_session, { host_id: body.host_id, started_at: new Date().toISOString() });
      return { ok: true };
    }

    // Submit / update host application (documents bundle)
    if (path === '/host/applications' && method === 'POST') {
      var sess1 = jget(LS.host_session, null);
      if (!sess1) return { ok: false, error: 'not_authenticated', status: 401 };
      var existing = getApplication(sess1.host_id) || { host_id: sess1.host_id, submitted_at: null, status: 'draft', documents: [], notes_from_admin: '' };
      // Merge new documents — each body.documents[i] is { type, filename, thumb, mime } and we mark status: 'submitted'.
      var docs = (body.documents || []).map(function (doc) {
        return Object.assign({ status: 'submitted' }, doc);
      });
      // Replace doc with matching type (re-uploads keep one entry per type).
      var merged = existing.documents.slice();
      docs.forEach(function (newDoc) {
        var idx = merged.findIndex(function (d) { return d.type === newDoc.type; });
        if (idx >= 0) merged[idx] = newDoc;
        else merged.push(newDoc);
      });
      var nextApp = Object.assign({}, existing, {
        documents: merged,
        resident: typeof body.resident === 'boolean' ? body.resident : existing.resident,
        destination_id: body.destination_id || existing.destination_id,
        status: 'submitted',
        submitted_at: new Date().toISOString().slice(0, 10),
        notes_from_admin: ''
      });
      saveApplication(sess1.host_id, nextApp);
      audit('host.application.submit', sess1.host_id, merged.length + ' documents');
      pushNotification({ title: 'New host application', body: nextApp.host_id + ' submitted ' + merged.length + ' documents.', kind: 'verify' });
      return { ok: true, application: nextApp };
    }
    if (path === '/host/applications/me' && method === 'GET') {
      var sess2 = jget(LS.host_session, null);
      if (!sess2) return { ok: false, error: 'not_authenticated', status: 401 };
      var app = getApplication(sess2.host_id);
      return { ok: true, application: app };
    }

    // Public host listings — create / list / update / delete own listings.
    if (path === '/host/listings' && method === 'POST') {
      var sess3 = jget(LS.host_session, null);
      if (!sess3) return { ok: false, error: 'not_authenticated', status: 401 };
      var nid2 = body.id || ('L' + Date.now());
      var newL = Object.assign({
        id: nid2,
        slug: (body.title || 'new-listing').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50),
        host_id: sess3.host_id,
        photos: body.photos && body.photos.length ? body.photos : [window.VACATION_DATA.PHOTO_POOL[0]],
        listed_at: new Date().toISOString().slice(0, 10),
        rating: 0, review_count: 0,
        amenities: body.amenities || [], blocked_dates: body.blocked_dates || [],
        house_rules: body.house_rules || ['No smoking','No parties','Check-in 3 PM','Check-out 11 AM'],
        cancellation: body.cancellation || 'flexible',
        instant_book: typeof body.instant_book === 'boolean' ? body.instant_book : false,
        featured: false, verified: false,
        status: 'pending_review'
      }, body, {
        // Force-overwrite: server-controlled fields don't trust client input.
        host_id: sess3.host_id, status: 'pending_review', verified: false, featured: false
      });
      var lc2 = jget(LS.listings_created, []); lc2.unshift(newL); jset(LS.listings_created, lc2);
      audit('listing.host.create', nid2, newL.title + ' (pending review)');
      pushNotification({ title: 'New listing pending review', body: newL.title, kind: 'review' });
      return { ok: true, listing: newL };
    }
    if (path === '/host/listings' && method === 'GET') {
      var sess4 = jget(LS.host_session, null);
      if (!sess4) return { ok: false, error: 'not_authenticated', status: 401 };
      var my = listings().filter(function (l) { return l.host_id === sess4.host_id; });
      return { ok: true, items: my };
    }
    if (m = path.match(/^\/host\/listings\/([^\/]+)$/)) {
      var sess5 = jget(LS.host_session, null);
      if (!sess5) return { ok: false, error: 'not_authenticated', status: 401 };
      var l5 = listings().find(function (x) { return x.id === m[1]; });
      if (!l5 || l5.host_id !== sess5.host_id) return { ok: false, error: 'forbidden', status: 403 };
      if (method === 'PUT') {
        var ed5 = jget(LS.listings_edits, {});
        var nextEd = Object.assign({}, ed5[m[1]] || {}, body);
        // Live edits to material fields re-trigger admin review.
        var materialFields = ['title', 'description', 'photos', 'base_nightly_aed', 'address'];
        var triggersReview = materialFields.some(function (f) { return body.hasOwnProperty(f); });
        if (l5.status === 'live' && triggersReview) nextEd.status = 'pending_review';
        ed5[m[1]] = nextEd;
        jset(LS.listings_edits, ed5);
        audit('listing.host.update', m[1], '');
        return { ok: true };
      }
      if (method === 'DELETE') {
        var dd = jget(LS.listings_deleted, []);
        if (dd.indexOf(m[1]) === -1) dd.push(m[1]);
        jset(LS.listings_deleted, dd);
        audit('listing.host.delete', m[1], '');
        return { ok: true };
      }
    }
    if (m = path.match(/^\/host\/listings\/([^\/]+)\/(pause|unpause)$/) && method === 'POST') {
      var sess6 = jget(LS.host_session, null);
      if (!sess6) return { ok: false, error: 'not_authenticated', status: 401 };
      var ed6 = jget(LS.listings_edits, {});
      ed6[m[1]] = Object.assign({}, ed6[m[1]] || {}, { status: m[2] === 'pause' ? 'paused' : 'live' });
      jset(LS.listings_edits, ed6);
      audit('listing.host.' + m[2], m[1], '');
      return { ok: true };
    }
    if (m = path.match(/^\/host\/listings\/([^\/]+)\/block-dates$/) && method === 'POST') {
      var sess7 = jget(LS.host_session, null);
      if (!sess7) return { ok: false, error: 'not_authenticated', status: 401 };
      var l7 = listings().find(function (x) { return x.id === m[1]; });
      if (!l7) return { ok: false, error: 'not_found' };
      var ed7 = jget(LS.listings_edits, {});
      var cur = (ed7[m[1]] && ed7[m[1]].blocked_dates) || l7.blocked_dates || [];
      var add = body.add || []; var remove = body.remove || [];
      var nextBlocked = cur.filter(function (d) { return remove.indexOf(d) === -1; }).concat(add).filter(function (x, i, a) { return a.indexOf(x) === i; }).sort();
      ed7[m[1]] = Object.assign({}, ed7[m[1]] || {}, { blocked_dates: nextBlocked });
      jset(LS.listings_edits, ed7);
      audit('listing.host.block', m[1], add.length + ' added, ' + remove.length + ' removed');
      return { ok: true, blocked_dates: nextBlocked };
    }
    if (path === '/host/bookings' && method === 'GET') {
      var sess8 = jget(LS.host_session, null);
      if (!sess8) return { ok: false, error: 'not_authenticated', status: 401 };
      var mine = bookings().filter(function (b) { return b.host_id === sess8.host_id; });
      return { ok: true, items: mine };
    }
    if (path === '/host/dashboard' && method === 'GET') {
      var sess9 = jget(LS.host_session, null);
      if (!sess9) return { ok: false, error: 'not_authenticated', status: 401 };
      var myL = listings().filter(function (l) { return l.host_id === sess9.host_id; });
      var myB = bookings().filter(function (b) { return b.host_id === sess9.host_id; });
      var liveCount = myL.filter(function (l) { return l.status === 'live' || !l.status; }).length;
      var pendingCount = myL.filter(function (l) { return l.status === 'pending_review' || l.status === 'changes_requested'; }).length;
      var upcomingBk = myB.filter(function (b) { return b.status === 'confirmed' || b.status === 'pending'; });
      var rev30 = myB.filter(function (b) {
        return (Date.now() - new Date(b.created_at).getTime()) < 30 * 86400000 && b.status !== 'cancelled' && b.status !== 'refunded';
      }).reduce(function (s, b) { return s + (b.pricing && b.pricing.total || 0); }, 0);
      var ratings = reviews().filter(function (r) { return r.host_id === sess9.host_id; });
      var avgRating = ratings.length ? Math.round(ratings.reduce(function (s, r) { return s + r.rating_overall; }, 0) / ratings.length * 10) / 10 : 0;
      return {
        ok: true,
        kpis: {
          listings_live: liveCount,
          listings_pending: pendingCount,
          bookings_upcoming: upcomingBk.length,
          revenue_30d: rev30,
          avg_rating: avgRating,
          review_count: ratings.length
        },
        listings: myL,
        recent_bookings: myB.slice().sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); }).slice(0, 6)
      };
    }

    /* ================== ADMIN ================== */

    if (path === '/admin/dashboard') {
      var all = bookings();
      var active = listings();
      var recentBk = all.slice().sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); }).slice(0, 6);
      var sevenDayBk = all.filter(function (b) { return (Date.now() - new Date(b.created_at).getTime()) < 7 * 86400000; });
      // Revenue last 30 days from completed/confirmed
      var rev30 = all.filter(function (b) {
        var inLast30 = (Date.now() - new Date(b.created_at).getTime()) < 30 * 86400000;
        return inLast30 && b.status !== 'cancelled' && b.status !== 'refunded';
      }).reduce(function (s, b) { return s + (b.pricing && b.pricing.total || 0); }, 0);
      var occupancyPct = Math.round(50 + ((Date.now() / 1000000) % 20));  // fake metric ~ 50-70%
      var adr = all.length ? Math.round(all.reduce(function (s, b) { return s + (b.pricing && b.pricing.nightly_subtotal || 0) / Math.max(b.nights, 1); }, 0) / all.length) : 0;
      // Monthly bookings chart
      var monthly = [];
      for (var i = 11; i >= 0; i--) {
        var d = new Date(); d.setMonth(d.getMonth() - i);
        monthly.push({ label: d.toLocaleString('en', { month: 'short' }), bookings: 18 + ((i * 41) % 28) });
      }
      var pendingApps = applications().filter(function (a) { return a.status === 'submitted' || a.status === 'changes_requested'; });
      var pendingListings = listings().filter(function (l) { return l.status === 'pending_review'; });
      var alertsList = [];
      if (pendingApps.length)     alertsList.push({ kind: 'verify',  msg: pendingApps.length + ' host application' + (pendingApps.length === 1 ? '' : 's') + ' awaiting review', count: pendingApps.length, link: '#verifications' });
      if (pendingListings.length) alertsList.push({ kind: 'listing', msg: pendingListings.length + ' listing' + (pendingListings.length === 1 ? '' : 's') + ' pending approval',     count: pendingListings.length, link: '#verifications' });
      alertsList.push({ kind: 'review', msg: '3 reviews under 3★ — review for moderation', count: 3, link: '#reviews' });
      alertsList.push({ kind: 'payout', msg: '14 host payouts in queue', count: 14, link: '#payments' });
      return {
        ok: true,
        kpis: {
          active_listings: active.filter(function (l) { return !l.status || l.status === 'live'; }).length,
          bookings_7d: sevenDayBk.length,
          occupancy_pct: occupancyPct,
          adr: adr,
          revenue_30d: rev30,
          pending_verifications: pendingApps.length,
          pending_listings: pendingListings.length
        },
        monthly: monthly,
        recent_bookings: recentBk,
        recent_reviews: reviews().slice(0, 5),
        alerts: alertsList
      };
    }

    if (path === '/admin/listings' && method === 'GET') {
      var rs = listings();
      if (params.q) {
        var qq = String(params.q).toLowerCase();
        rs = rs.filter(function (l) { return (l.title + ' ' + l.address).toLowerCase().indexOf(qq) !== -1; });
      }
      if (params.status) {
        rs = rs.filter(function (l) {
          var s = l.status || 'live';
          return s === params.status;
        });
      }
      return { ok: true, items: rs };
    }
    if (path === '/admin/listings' && method === 'POST') {
      var nid = 'L' + Date.now();
      var nl = Object.assign({
        id: nid, slug: (body.title || 'new').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40),
        photos: [window.VACATION_DATA.PHOTO_POOL[0]],
        listed_at: new Date().toISOString().slice(0, 10),
        rating: 4.7, review_count: 0, instant_book: true, verified: true,
        amenities: body.amenities || [], blocked_dates: [],
        house_rules: ['No smoking','No parties','Check-in 3 PM','Check-out 11 AM'],
        cancellation: 'flexible', featured: false
      }, body);
      var lc = jget(LS.listings_created, []); lc.unshift(nl); jset(LS.listings_created, lc);
      audit('listing.create', nid, body.title);
      return { ok: true, listing: nl };
    }
    if (m = path.match(/^\/admin\/listings\/([^\/]+)$/)) {
      if (method === 'PUT') {
        var ed = jget(LS.listings_edits, {});
        ed[m[1]] = Object.assign({}, ed[m[1]] || {}, body);
        jset(LS.listings_edits, ed);
        audit('listing.update', m[1], '');
        return { ok: true };
      }
      if (method === 'DELETE') {
        var d = jget(LS.listings_deleted, []);
        if (d.indexOf(m[1]) === -1) d.push(m[1]);
        jset(LS.listings_deleted, d);
        audit('listing.delete', m[1], '');
        return { ok: true };
      }
    }
    if (path === '/admin/listings/bulk' && method === 'POST') {
      var ids = body.ids || [];
      var op = body.op;
      var ed2 = jget(LS.listings_edits, {});
      var de2 = jget(LS.listings_deleted, []);
      ids.forEach(function (id) {
        if (op === 'delete') { if (de2.indexOf(id) === -1) de2.push(id); }
        else {
          ed2[id] = ed2[id] || {};
          if (op === 'feature')   ed2[id].featured = true;
          if (op === 'unfeature') ed2[id].featured = false;
          if (op === 'verify')    { ed2[id].verified = true;  ed2[id].status = 'live'; }
          if (op === 'unverify')  ed2[id].verified = false;
          if (op === 'instant-on')  ed2[id].instant_book = true;
          if (op === 'instant-off') ed2[id].instant_book = false;
          if (op === 'approve')   { ed2[id].status = 'live'; ed2[id].verified = true; }
          if (op === 'pause')     ed2[id].status = 'paused';
          if (op === 'unpause')   ed2[id].status = 'live';
        }
      });
      jset(LS.listings_edits, ed2);
      jset(LS.listings_deleted, de2);
      audit('listing.bulk', op, ids.length + ' listings');
      return { ok: true };
    }

    // Admin listing approval pipeline.
    if (m = path.match(/^\/admin\/listings\/([^\/]+)\/(approve|request-changes|reject)$/) && method === 'POST') {
      var lid = m[1]; var action = m[2];
      var l_target = listings().find(function (x) { return x.id === lid; });
      if (!l_target) return { ok: false, error: 'not_found' };
      var leds = jget(LS.listings_edits, {});
      leds[lid] = leds[lid] || {};
      if (action === 'approve') { leds[lid].status = 'live'; leds[lid].verified = true; }
      if (action === 'request-changes') { leds[lid].status = 'changes_requested'; leds[lid].review_note = body.reason || ''; }
      if (action === 'reject') { leds[lid].status = 'rejected'; leds[lid].review_note = body.reason || ''; }
      jset(LS.listings_edits, leds);
      audit('listing.' + action, lid, body.reason || '');
      pushNotification({ title: 'Listing ' + action, body: l_target.title + (body.reason ? ' — ' + body.reason : ''), kind: 'review' });
      return { ok: true };
    }

    // Admin bookings
    if (path === '/admin/bookings' && method === 'GET') {
      var rb = bookings();
      if (params.status) rb = rb.filter(function (b) { return b.status === params.status; });
      rb.sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
      return { ok: true, items: rb };
    }
    if (m = path.match(/^\/admin\/bookings\/([^\/]+)$/) && method === 'PUT') {
      var sts = jget(LS.bookings_status, {});
      if (body.status) sts[m[1]] = body.status;
      jset(LS.bookings_status, sts);
      audit('booking.update', m[1], JSON.stringify(body));
      return { ok: true };
    }
    if (m = path.match(/^\/admin\/bookings\/([^\/]+)\/refund$/) && method === 'POST') {
      var st2 = jget(LS.bookings_status, {});
      st2[m[1]] = 'refunded';
      jset(LS.bookings_status, st2);
      audit('booking.refund', m[1], '');
      return { ok: true };
    }

    // Admin hosts
    if (path === '/admin/hosts' && method === 'GET') return { ok: true, items: hosts() };
    if (path === '/admin/hosts' && method === 'POST') {
      var hid = 'h' + Date.now();
      var nh = Object.assign({ id: hid, photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80&auto=format&fit=crop&crop=faces', joined: new Date().toISOString().slice(0, 7), response_rate: 95, response_time_hrs: 2, languages: ['English'], superhost: false, bio: '' }, body);
      var hc = jget(LS.hosts_created, []); hc.unshift(nh); jset(LS.hosts_created, hc);
      audit('host.create', hid, body.name);
      return { ok: true, host: nh };
    }
    if (m = path.match(/^\/admin\/hosts\/([^\/]+)$/)) {
      if (method === 'PUT') {
        var he = jget(LS.hosts_edits, {});
        he[m[1]] = Object.assign({}, he[m[1]] || {}, body);
        jset(LS.hosts_edits, he);
        audit('host.update', m[1], '');
        return { ok: true };
      }
      if (method === 'DELETE') {
        var hd = jget(LS.hosts_deleted, []);
        if (hd.indexOf(m[1]) === -1) hd.push(m[1]);
        jset(LS.hosts_deleted, hd);
        audit('host.delete', m[1], '');
        return { ok: true };
      }
    }
    if (m = path.match(/^\/admin\/hosts\/([^\/]+)\/verify$/) && method === 'POST') {
      var he2 = jget(LS.hosts_edits, {});
      he2[m[1]] = he2[m[1]] || {};
      he2[m[1]].superhost = true;
      jset(LS.hosts_edits, he2);
      audit('host.verify', m[1], '');
      return { ok: true };
    }

    /* ---- Admin verifications (host applications + document review) ---- */
    if (path === '/admin/verifications' && method === 'GET') {
      var apps = applications();
      if (params.status) apps = apps.filter(function (a) { return a.status === params.status; });
      var withHost = apps.map(function (a) {
        var h_app = hosts().find(function (x) { return x.id === a.host_id; });
        return Object.assign({}, a, {
          host_name: h_app ? h_app.name : '(host removed)',
          host_photo: h_app ? h_app.photo : null,
          document_count: (a.documents || []).length,
          submitted_doc_count: (a.documents || []).filter(function (d) { return d.status === 'submitted'; }).length
        });
      });
      withHost.sort(function (a, b) { return (b.submitted_at || '').localeCompare(a.submitted_at || ''); });
      return { ok: true, items: withHost };
    }
    if (m = path.match(/^\/admin\/verifications\/([^\/]+)$/) && method === 'GET') {
      var app_d = getApplication(m[1]);
      if (!app_d) return { ok: false, error: 'not_found' };
      var h_d = hosts().find(function (x) { return x.id === m[1]; });
      var l_d = listings().filter(function (l) { return l.host_id === m[1]; });
      return { ok: true, application: app_d, host: h_d, listings: l_d };
    }
    if (m = path.match(/^\/admin\/verifications\/([^\/]+)\/(approve|request-changes|reject)$/) && method === 'POST') {
      var hid_v = m[1]; var act = m[2];
      var app_v = getApplication(hid_v);
      if (!app_v) return { ok: false, error: 'not_found' };
      var nextStatus = act === 'approve' ? 'approved' : (act === 'request-changes' ? 'changes_requested' : 'rejected');
      var nextApp_v = Object.assign({}, app_v, {
        status: nextStatus,
        notes_from_admin: body.reason || app_v.notes_from_admin || ''
      });
      // Cascade per-doc status on approve / reject, leave individual doc decisions untouched on request-changes.
      if (act === 'approve') {
        nextApp_v.documents = (app_v.documents || []).map(function (d) { return Object.assign({}, d, { status: 'approved' }); });
        // Mark host verified.
        var he_v = jget(LS.hosts_edits, {});
        he_v[hid_v] = Object.assign({}, he_v[hid_v] || {}, { verified: true, verified_at: new Date().toISOString().slice(0, 10) });
        jset(LS.hosts_edits, he_v);
      } else if (act === 'reject') {
        nextApp_v.documents = (app_v.documents || []).map(function (d) {
          return d.status === 'approved' ? d : Object.assign({}, d, { status: 'rejected' });
        });
      }
      saveApplication(hid_v, nextApp_v);
      audit('verification.' + act, hid_v, body.reason || '');
      pushNotification({ title: 'Host verification ' + act, body: hid_v + (body.reason ? ' — ' + body.reason : ''), kind: 'verify' });
      return { ok: true, application: nextApp_v };
    }
    if (m = path.match(/^\/admin\/verifications\/([^\/]+)\/docs\/([^\/]+)\/(approve|reject)$/) && method === 'POST') {
      var hid_d2 = m[1]; var dtype = m[2]; var dact = m[3];
      var app_d2 = getApplication(hid_d2);
      if (!app_d2) return { ok: false, error: 'not_found' };
      var docs = (app_d2.documents || []).map(function (d) {
        if (d.type !== dtype) return d;
        return Object.assign({}, d, {
          status: dact === 'approve' ? 'approved' : 'rejected',
          rejection_reason: dact === 'reject' ? (body.reason || 'Please re-upload') : undefined
        });
      });
      var nextApp_d = Object.assign({}, app_d2, { documents: docs });
      // If any doc is rejected, application status auto-shifts to changes_requested.
      if (dact === 'reject' && app_d2.status !== 'changes_requested') nextApp_d.status = 'changes_requested';
      saveApplication(hid_d2, nextApp_d);
      audit('verification.doc.' + dact, hid_d2, dtype + (body.reason ? ' — ' + body.reason : ''));
      return { ok: true };
    }

    // Admin guests
    if (path === '/admin/guests' && method === 'GET') {
      return { ok: true, items: guests().map(function (g) {
        var trips = bookings().filter(function (b) { return b.guest_id === g.id; });
        return Object.assign({}, g, {
          trip_count: trips.length,
          total_spent: trips.reduce(function (s, b) { return s + (b.pricing && b.pricing.total || 0); }, 0),
          last_booking: trips[0] ? trips[0].created_at : null
        });
      }) };
    }

    // Admin reviews
    if (path === '/admin/reviews' && method === 'GET') {
      var rev = reviews();
      var rst = jget(LS.reviews_status, {});
      return { ok: true, items: rev.map(function (r) { return Object.assign({}, r, { status: rst[r.id] || 'approved' }); }) };
    }
    if (m = path.match(/^\/admin\/reviews\/([^\/]+)$/) && method === 'PUT') {
      var rs2 = jget(LS.reviews_status, {});
      rs2[m[1]] = body.status;
      jset(LS.reviews_status, rs2);
      audit('review.update', m[1], body.status);
      return { ok: true };
    }

    // Admin payments
    if (path === '/admin/payments') {
      var pays = bookings().map(function (b) {
        return {
          id: 'P' + b.id,
          booking_id: b.id,
          ref_number: b.ref_number,
          guest_id: b.guest_id,
          host_id: b.host_id,
          amount: b.pricing && b.pricing.total || 0,
          host_payout: Math.round((b.pricing && b.pricing.nightly_subtotal || 0) * 0.85),  // platform takes 15%
          status: b.status === 'refunded' ? 'refunded' : (b.status === 'cancelled' ? 'cancelled' : 'paid'),
          created_at: b.created_at
        };
      });
      return { ok: true, items: pays };
    }

    // Admin promotions
    if (path === '/admin/promotions' && method === 'GET') {
      var pr = jget(LS.promotions, [
        { id: 'p1', code: 'DUBAISUMMER25', label: 'Dubai summer 25%', type: 'percent', value: 25, starts: '2026-06-01', ends: '2026-08-31', min_nights: 3, active: true },
        { id: 'p2', code: 'RAMADAN10',     label: 'Ramadan 10%',      type: 'percent', value: 10, starts: '2026-02-15', ends: '2026-03-31', min_nights: 2, active: true },
        { id: 'p3', code: 'NYE-VILLA',     label: 'NYE villa fixed',  type: 'fixed',   value: 500, starts: '2026-12-28', ends: '2027-01-03', min_nights: 3, active: false }
      ]);
      jset(LS.promotions, pr);
      return { ok: true, items: pr };
    }
    if (path === '/admin/promotions' && method === 'POST') {
      var pr2 = jget(LS.promotions, []);
      if (body.action === 'add') pr2.unshift({ id: 'p' + Date.now(), code: body.code, label: body.label, type: body.type || 'percent', value: Number(body.value), starts: body.starts, ends: body.ends, min_nights: Number(body.min_nights || 1), active: !!body.active });
      else if (body.action === 'toggle') pr2 = pr2.map(function (p) { return p.id === body.id ? Object.assign({}, p, { active: !p.active }) : p; });
      else if (body.action === 'remove') pr2 = pr2.filter(function (p) { return p.id !== body.id; });
      jset(LS.promotions, pr2);
      audit('promotion', body.action, body.code || body.id);
      return { ok: true, items: pr2 };
    }

    // Admin content (destinations CMS)
    if (path === '/admin/content/destinations' && method === 'GET') {
      return { ok: true, overrides: jget(LS.content_dest, {}) };
    }
    if (path === '/admin/content/destinations' && method === 'POST') {
      var cd = jget(LS.content_dest, {});
      cd[body.destination_id] = { blurb: body.blurb, avg_nightly: body.avg_nightly };
      jset(LS.content_dest, cd);
      audit('content.destinations', body.destination_id, '');
      return { ok: true };
    }

    // Admin settings
    if (path === '/admin/settings' && method === 'GET') {
      return { ok: true, settings: jget(LS.settings, {
        currencies: window.VACATION_DATA.CURRENCIES,
        default_currency: 'AED',
        service_fee_pct: 10,
        vat_pct: 5,
        cancellation_policies: ['flexible','moderate','strict'],
        payout_schedule: 'after_checkin_24h'
      }) };
    }
    if (path === '/admin/settings' && method === 'POST') {
      var s = jget(LS.settings, {});
      Object.assign(s, body);
      jset(LS.settings, s);
      audit('settings.update', '', '');
      return { ok: true, settings: s };
    }

    // Audit
    if (path === '/admin/audit') return { ok: true, items: jget(LS.audit, []) };

    return { ok: false, error: 'no_handler', path: path, method: method };
  }

  function parseUrl(u) {
    var s = u.indexOf('/vacation/api');
    if (s === -1) return null;
    var rest = u.slice(s + '/vacation/api'.length);
    var q = rest.indexOf('?');
    var path = q === -1 ? rest : rest.slice(0, q);
    var params = {};
    if (q !== -1) {
      rest.slice(q + 1).split('&').forEach(function (kv) {
        if (!kv) return;
        var p = kv.split('=');
        params[decodeURIComponent(p[0])] = decodeURIComponent((p[1] || '').replace(/\+/g, ' '));
      });
    }
    return { path: path, params: params };
  }

  var origFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : input.url;
    if (url.indexOf('/vacation/api') === -1) return origFetch(input, init);
    var pu = parseUrl(url);
    var method = (init && init.method) || (typeof input !== 'string' && input.method) || 'GET';
    var body = null;
    try { body = init && init.body ? JSON.parse(init.body) : null; } catch (e) { body = null; }
    var res = handle(method.toUpperCase(), pu.path, body || {}, pu.params || {});
    var httpStatus = res.ok ? 200 : (res.status || 404);
    return Promise.resolve({
      ok: !!res.ok,
      status: httpStatus,
      json: function () { return Promise.resolve(res); },
      text: function () { return Promise.resolve(JSON.stringify(res)); }
    });
  };

  console.log('Vacation mock-api ready — fetch intercepted for /vacation/api/*');
})();
