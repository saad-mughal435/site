/* app.js — Shared shell for Vacation Homes
   Nav, footer, currency, locale, favorites, recently-viewed, formatters,
   date helpers, listing card renderer, modal helper, booking helpers. */
// Cross-site portfolio-demo banner — appears above the fold on every page so
// recruiters landing via a deep link see this is a demo, not a real booking site.
(function () { var s = document.createElement('script'); s.src = '/assets/portfolio-banner.js?v=20260514'; s.async = true; document.head.appendChild(s); })();
(function () {
  'use strict';

  var LS = {
    user:        'vacation.user',
    favorites:   'vacation.favorites',
    recently:    'vacation.recently_viewed',
    locale:      'vacation.locale',
    currency:    'vacation.currency',
    bookings:    'vacation.bookings.created',
    bookings_cx: 'vacation.bookings.status',  // cancellations etc.
    pending_quote: 'vacation.pending_quote'   // bridge from stay.html → checkout.html
  };

  function jget(k, def) { try { return JSON.parse(localStorage.getItem(k)) || def; } catch (e) { return def; } }
  function jset(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

  /* ---------- Currency ---------- */
  function getCurrency() { return localStorage.getItem(LS.currency) || 'AED'; }
  function setCurrency(c) {
    localStorage.setItem(LS.currency, c);
    updateAllPrices();
    if (window.toast) window.toast('Currency: ' + c, 'success', 1400);
  }
  function getRate(c) {
    var rates = (window.VACATION_DATA && window.VACATION_DATA.CURRENCIES) || [];
    var r = rates.find(function (x) { return x.code === c; });
    return r ? r.rate_to_aed : 1;
  }
  function symbol(c) {
    var rates = (window.VACATION_DATA && window.VACATION_DATA.CURRENCIES) || [];
    var r = rates.find(function (x) { return x.code === c; });
    return r ? r.symbol : '';
  }
  function formatPrice(aed, opts) {
    opts = opts || {};
    var c = opts.currency || getCurrency();
    var rate = getRate(c);
    var val = aed / rate;
    var sign = symbol(c) || c;
    if (val >= 1_000_000) return sign + ' ' + (val / 1_000_000).toFixed(1) + 'M';
    if (val >= 1_000) return sign + ' ' + Math.round(val).toLocaleString();
    return sign + ' ' + Math.round(val).toLocaleString();
  }
  function formatPriceExact(aed) {
    var c = getCurrency();
    var rate = getRate(c);
    var val = aed / rate;
    return (symbol(c) || c) + ' ' + Math.round(val).toLocaleString();
  }
  function updateAllPrices() {
    document.querySelectorAll('[data-price-aed]').forEach(function (el) {
      var aed = Number(el.getAttribute('data-price-aed'));
      var unit = el.getAttribute('data-price-unit') || '';
      el.innerHTML = formatPrice(aed) + (unit ? '<span class="v-rate-unit"> ' + unit + '</span>' : '');
    });
    document.querySelectorAll('[data-price-aed-exact]').forEach(function (el) {
      el.textContent = formatPriceExact(Number(el.getAttribute('data-price-aed-exact')));
    });
  }

  /* ---------- Locale / i18n ---------- */
  function getLocale() { return localStorage.getItem(LS.locale) || 'en'; }
  function setLocale(l) {
    localStorage.setItem(LS.locale, l);
    document.documentElement.lang = l;
    document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
    document.body.classList.toggle('rtl', l === 'ar');
    applyI18n();
    if (window.toast) window.toast(l === 'ar' ? 'تم تغيير اللغة' : 'Language: English', 'success', 1400);
  }
  function t(key, fallback) {
    var data = (window.VACATION_DATA && window.VACATION_DATA.I18N) || {};
    var loc = getLocale();
    return (data[loc] && data[loc][key]) || (data.en && data.en[key]) || fallback || key;
  }
  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'), el.textContent);
    });
  }

  /* ---------- Favorites + recently-viewed ---------- */
  function getFavorites() { return jget(LS.favorites, []); }
  function isFavorite(id) { return getFavorites().indexOf(String(id)) !== -1; }
  function toggleFavorite(id) {
    var list = getFavorites();
    id = String(id);
    var idx = list.indexOf(id);
    if (idx === -1) list.push(id); else list.splice(idx, 1);
    jset(LS.favorites, list);
    document.querySelectorAll('[data-fav="' + id + '"]').forEach(function (el) {
      el.classList.toggle('on', idx === -1);
      el.innerHTML = idx === -1 ? '♥' : '♡';
    });
    if (window.toast) window.toast(idx === -1 ? 'Saved' : 'Removed from saved', idx === -1 ? 'success' : '', 1400);
    return idx === -1;
  }
  function pushRecentlyViewed(id) {
    var list = jget(LS.recently, []);
    id = String(id);
    list = list.filter(function (x) { return x !== id; });
    list.unshift(id);
    list = list.slice(0, 6);
    jset(LS.recently, list);
  }
  function getRecentlyViewed() { return jget(LS.recently, []); }

  /* ---------- Date helpers ---------- */
  function ymd(d) {
    if (!d) return '';
    if (typeof d === 'string') return d.slice(0, 10);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function addDays(d, n) {
    var nd = new Date(d);
    nd.setDate(nd.getDate() + n);
    return nd;
  }
  function nightsBetween(a, b) {
    var d1 = typeof a === 'string' ? new Date(a) : a;
    var d2 = typeof b === 'string' ? new Date(b) : b;
    return Math.round((d2 - d1) / 86400000);
  }
  function fmtDate(d, opts) {
    if (!d) return '';
    var dt = typeof d === 'string' ? new Date(d) : d;
    return dt.toLocaleDateString(getLocale() === 'ar' ? 'ar-AE' : 'en-AE', opts || { month: 'short', day: 'numeric' });
  }
  function fmtDateRange(a, b) {
    if (!a || !b) return '';
    return fmtDate(a) + ' – ' + fmtDate(b);
  }

  /* ---------- Quote / price breakdown ---------- */
  function isWeekend(d) {
    // UAE weekend: Saturday + Sunday (modern) — getDay() 0=Sun, 6=Sat
    var x = typeof d === 'string' ? new Date(d) : d;
    var dy = x.getDay();
    return dy === 0 || dy === 6;
  }
  function quote(listing, checkIn, checkOut) {
    var nights = nightsBetween(checkIn, checkOut);
    if (nights <= 0) return null;
    var subtotal = 0;
    var weekendNights = 0;
    var d = new Date(checkIn);
    for (var i = 0; i < nights; i++) {
      var night = listing.base_nightly_aed;
      if (isWeekend(d)) { night = Math.round(night * (1 + (listing.weekend_surcharge_pct || 0) / 100)); weekendNights++; }
      subtotal += night;
      d.setDate(d.getDate() + 1);
    }
    var baseSub = listing.base_nightly_aed * nights;
    var weekendSurcharge = subtotal - baseSub;
    var cleaning = listing.cleaning_fee_aed || 0;
    var serviceFeePct = 0.10;  // platform service fee
    var serviceFee = Math.round((subtotal + cleaning) * serviceFeePct);
    var vat = Math.round((subtotal + cleaning + serviceFee) * 0.05);
    var total = subtotal + cleaning + serviceFee + vat;
    return {
      nights: nights,
      base_nightly: listing.base_nightly_aed,
      base_subtotal: baseSub,
      weekend_nights: weekendNights,
      weekend_surcharge: weekendSurcharge,
      nightly_subtotal: subtotal,
      cleaning_fee: cleaning,
      service_fee: serviceFee,
      vat: vat,
      total: total
    };
  }

  /* ---------- Nav + footer ---------- */
  function navHtml(active) {
    var locale = getLocale();
    var currency = getCurrency();
    var links = [
      { href: 'search.html',        i18n: 'nav.stays',        en: 'Stays',         ar: 'إقامات' },
      { href: 'destinations.html',  i18n: 'nav.destinations', en: 'Destinations',  ar: 'الوجهات' },
      { href: 'trips.html',         i18n: 'nav.trips',        en: 'My trips',      ar: 'رحلاتي' },
      { href: 'host.html',          i18n: 'nav.host',         en: 'Become a host', ar: 'كن مضيفًا' }
    ];
    return ''
      + '<div class="v-demo-banner"><div class="v-container"><strong>DEMO MODE</strong>All listings, hosts, bookings and prices are fabricated. Photos via <a href="https://unsplash.com" rel="noopener" target="_blank" class="credit">Unsplash</a>.</div></div>'
      + '<header class="v-nav">'
      +   '<div class="v-container v-nav-inner">'
      +     '<a href="index.html" class="v-logo"><span class="v-logo-mark">V</span><span>Vacation Homes</span></a>'
      +     '<nav class="v-nav-links">'
      +       links.map(function (l) { return '<a href="' + l.href + '"' + (active === l.i18n ? ' class="active"' : '') + '>' + (locale === 'ar' ? l.ar : l.en) + '</a>'; }).join('')
      +     '</nav>'
      +     '<div class="v-nav-right">'
      +       '<select class="v-pill" data-currency-select aria-label="Currency">'
      +         ['AED','USD','GBP','EUR'].map(function (c) { return '<option value="' + c + '"' + (c === currency ? ' selected' : '') + '>' + c + '</option>'; }).join('')
      +       '</select>'
      +       '<button class="v-pill" data-locale-toggle>' + (locale === 'ar' ? 'EN' : 'العربية') + '</button>'
      +       '<div data-bell-host style="position:relative;display:inline-block;"></div>'
      +       '<a class="v-pill v-pill--ghost" href="trips.html" aria-label="Account">👤</a>'
      +       '<button class="v-nav-burger" data-burger>☰</button>'
      +     '</div>'
      +   '</div>'
      + '</header>'
      + '<aside class="v-sheet" data-sheet>'
      +   '<div class="v-sheet-panel">'
      +     '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">'
      +       '<div class="v-logo"><span class="v-logo-mark">V</span><span>Vacation Homes</span></div>'
      +       '<button class="v-pill" data-sheet-close>×</button>'
      +     '</div>'
      +     links.map(function (l) { return '<a href="' + l.href + '">' + (locale === 'ar' ? l.ar : l.en) + '</a>'; }).join('')
      +     '<a href="admin.html">' + (locale === 'ar' ? 'لوحة الإدارة' : 'Admin panel') + '</a>'
      +   '</div>'
      + '</aside>';
  }

  function footHtml() {
    return ''
      + '<footer class="v-foot">'
      +   '<div class="v-container">'
      +     '<div class="v-foot-grid">'
      +       '<div>'
      +         '<div class="v-logo" style="color:white;"><span class="v-logo-mark">V</span><span>Vacation Homes</span></div>'
      +         '<p style="color:rgba(255,255,255,.6);margin-top:8px;max-width:340px;">A UAE short-stay booking demo. 55 vacation homes across 10 destinations — Marina, Palm, Hatta, RAK, Fujairah, Liwa and more. Book by the night.</p>'
      +         '<p style="font-size:11px;color:rgba(255,255,255,.5);margin-top:8px;">Listings, hosts, bookings and prices are fabricated. Photos via <a href="https://unsplash.com" rel="noopener" target="_blank">Unsplash</a>.</p>'
      +       '</div>'
      +       '<div><h4>Explore</h4><ul>'
      +         '<li><a href="search.html">All stays</a></li>'
      +         '<li><a href="destinations.html">Destinations</a></li>'
      +         '<li><a href="trips.html">My trips</a></li>'
      +         '<li><a href="host.html">Become a host</a></li>'
      +       '</ul></div>'
      +       '<div><h4>Vacation Homes</h4><ul>'
      +         '<li><a href="trips.html#saved">Saved</a></li>'
      +         '<li><a href="admin.html">Admin demo</a></li>'
      +       '</ul></div>'
      +       '<div><h4>Demo info</h4><ul>'
      +         '<li><a href="../demo.html">All demos</a></li>'
      +         '<li><a href="../index.html">Portfolio home</a></li>'
      +         '<li><a href="../contact.html">Contact Saad</a></li>'
      +       '</ul></div>'
      +     '</div>'
      +     '<div class="v-foot-bottom">'
      +       '<span>© 2026 Vacation Homes · Demo by Saad Mughal · All data fabricated.</span>'
      +     '</div>'
      +   '</div>'
      + '</footer>';
  }

  function mountShell(active) {
    var navHost = document.querySelector('[data-shell-nav]');
    var footHost = document.querySelector('[data-shell-foot]');
    if (navHost) navHost.innerHTML = navHtml(active);
    if (footHost) footHost.innerHTML = footHtml();

    var sel = document.querySelector('[data-currency-select]');
    if (sel) sel.addEventListener('change', function () { setCurrency(sel.value); });
    var loc = document.querySelector('[data-locale-toggle]');
    if (loc) loc.addEventListener('click', function () { setLocale(getLocale() === 'ar' ? 'en' : 'ar'); });

    var burger = document.querySelector('[data-burger]');
    var sheet = document.querySelector('[data-sheet]');
    if (burger && sheet) burger.addEventListener('click', function () { sheet.classList.add('open'); });
    var sclose = document.querySelector('[data-sheet-close]');
    if (sclose && sheet) sclose.addEventListener('click', function () { sheet.classList.remove('open'); });
    if (sheet) sheet.addEventListener('click', function (e) { if (e.target === sheet) sheet.classList.remove('open'); });

    var bell = document.querySelector('[data-bell-host]');
    if (bell && window.VacationNotifications) window.VacationNotifications.render(bell);

    document.documentElement.lang = getLocale();
    document.documentElement.dir = getLocale() === 'ar' ? 'rtl' : 'ltr';
    document.body.classList.toggle('rtl', getLocale() === 'ar');
    applyI18n();
    updateAllPrices();
  }

  /* ---------- Helpers ---------- */
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function qs() {
    var out = {};
    location.search.replace(/^\?/, '').split('&').forEach(function (kv) {
      if (!kv) return;
      var p = kv.split('=');
      out[decodeURIComponent(p[0])] = decodeURIComponent((p[1] || '').replace(/\+/g, ' '));
    });
    return out;
  }
  function buildQs(obj) {
    var keys = Object.keys(obj).filter(function (k) { return obj[k] !== undefined && obj[k] !== null && obj[k] !== ''; });
    if (!keys.length) return '';
    return '?' + keys.map(function (k) {
      var v = obj[k];
      if (Array.isArray(v)) v = v.join(',');
      return encodeURIComponent(k) + '=' + encodeURIComponent(v);
    }).join('&');
  }
  function relDate(iso) {
    var d = new Date(iso);
    var s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600)+ 'h ago';
    var days = Math.floor(s / 86400);
    if (days < 30) return days + 'd ago';
    if (days < 365) return Math.floor(days / 30) + 'mo ago';
    return Math.floor(days / 365) + 'y ago';
  }
  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }

  /* ---------- API helper ---------- */
  function api(path, opts) {
    opts = opts || {};
    return fetch('/vacation/api' + path, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, body: j }; }); });
  }

  /* ---------- Listing card renderer ---------- */
  function listingCard(l, opts) {
    opts = opts || {};
    var d = window.VACATION_DATA;
    var dest = d.DESTINATIONS.find(function (x) { return x.id === l.destination_id; }) || {};
    var host = d.HOSTS.find(function (x) { return x.id === l.host_id; }) || {};
    var photo = (l.photos && l.photos[0]) || 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800&q=80';

    var badges = [];
    if (l.featured) badges.push('<span class="v-badge v-badge--featured">Featured</span>');
    if (l.instant_book) badges.push('<span class="v-badge v-badge--instant">⚡ Instant</span>');
    if (host.superhost) badges.push('<span class="v-badge v-badge--superhost">★ Superhost</span>');
    var daysAgo = l.listed_at ? Math.floor((Date.now() - new Date(l.listed_at).getTime()) / 86400000) : 99;
    if (daysAgo <= 14) badges.push('<span class="v-badge v-badge--new">New</span>');

    var fav = isFavorite(l.id);

    // Optional: when search has check_in/check_out, show total
    var totalLine = '';
    if (opts.nights && opts.nights > 0) {
      var subtotal = l.base_nightly_aed * opts.nights;
      totalLine = '<div class="v-rate-total" data-price-aed="' + subtotal + '" data-price-unit="total · ' + opts.nights + ' night' + (opts.nights === 1 ? '' : 's') + '">' + formatPrice(subtotal) + ' total · ' + opts.nights + ' night' + (opts.nights === 1 ? '' : 's') + '</div>';
    }

    return ''
      + '<a href="stay.html?id=' + l.id + (opts.checkIn ? '&check_in=' + opts.checkIn + '&check_out=' + opts.checkOut : '') + '" class="v-card v-listing-card" data-listing-id="' + l.id + '">'
      +   '<div class="v-listing-media">'
      +     '<img src="' + photo + '" alt="' + escapeHtml(l.title) + '" loading="lazy" />'
      +     '<div class="v-badges">' + badges.join('') + '</div>'
      +     '<button type="button" class="v-fav' + (fav ? ' on' : '') + '" data-fav="' + l.id + '" aria-label="Save" onclick="event.preventDefault();event.stopPropagation();VacationApp.toggleFavorite(\'' + l.id + '\')">' + (fav ? '♥' : '♡') + '</button>'
      +   '</div>'
      +   '<div class="v-listing-body">'
      +     '<div class="v-listing-price"><span data-price-aed="' + l.base_nightly_aed + '" data-price-unit="/ night">' + formatPrice(l.base_nightly_aed) + '<span class="v-rate-unit"> / night</span></span></div>'
      +     totalLine
      +     '<div class="v-listing-title v-truncate">' + escapeHtml(l.title) + '</div>'
      +     '<div class="v-listing-loc">📍 ' + escapeHtml(dest.name || '') + '</div>'
      +     '<div class="v-listing-stats">'
      +       '<span>🛏 ' + l.bedrooms + 'BR</span>'
      +       '<span>👥 ' + l.max_guests + '</span>'
      +       '<span>🛁 ' + l.baths + '</span>'
      +     '</div>'
      +     '<div class="v-listing-rating"><span class="v-rating-star">★</span> ' + (l.rating || 0).toFixed(2) + ' <span class="v-rating-count">(' + (l.review_count || 0) + ')</span></div>'
      +   '</div>'
      + '</a>';
  }

  /* ---------- Modal helper ---------- */
  function showModal(opts) {
    var bd = document.createElement('div');
    bd.className = 'v-modal-backdrop';
    bd.innerHTML = ''
      + '<div class="v-modal' + (opts.size === 'lg' ? ' v-modal--lg' : opts.size === 'xl' ? ' v-modal--xl' : '') + '">'
      +   '<div class="v-modal-head"><h3>' + escapeHtml(opts.title || '') + '</h3><button class="v-modal-close">×</button></div>'
      +   '<div class="v-modal-body">' + (opts.body || '') + '</div>'
      +   (opts.foot === false ? '' : ('<div class="v-modal-foot">' + (opts.foot || '<button class="v-btn" data-modal-close>Close</button>') + '</div>'))
      + '</div>';
    document.body.appendChild(bd);
    function close() { if (bd.parentNode) bd.parentNode.removeChild(bd); document.removeEventListener('keydown', onEsc); }
    function onEsc(e) { if (e.key === 'Escape') close(); }
    bd.addEventListener('click', function (e) { if (e.target === bd) close(); });
    bd.querySelector('.v-modal-close').addEventListener('click', close);
    bd.querySelectorAll('[data-modal-close]').forEach(function (b) { b.addEventListener('click', close); });
    document.addEventListener('keydown', onEsc);
    if (typeof opts.onMount === 'function') opts.onMount(bd, close);
    return { el: bd, close: close };
  }

  /* ---------- Stars ---------- */
  function stars(n) {
    var full = Math.floor(n || 0), half = (n - full) >= 0.5;
    return '★'.repeat(full) + (half ? '☆' : '') + '☆'.repeat(Math.max(0, 5 - full - (half ? 1 : 0))).replace(/☆/g, '<span style="opacity:.35">★</span>');
  }

  /* ---------- Expose ---------- */
  window.VacationApp = {
    LS: LS, jget: jget, jset: jset,
    getCurrency: getCurrency, setCurrency: setCurrency, formatPrice: formatPrice, formatPriceExact: formatPriceExact, updateAllPrices: updateAllPrices,
    getLocale: getLocale, setLocale: setLocale, t: t, applyI18n: applyI18n,
    getFavorites: getFavorites, isFavorite: isFavorite, toggleFavorite: toggleFavorite,
    pushRecentlyViewed: pushRecentlyViewed, getRecentlyViewed: getRecentlyViewed,
    ymd: ymd, addDays: addDays, nightsBetween: nightsBetween, fmtDate: fmtDate, fmtDateRange: fmtDateRange, isWeekend: isWeekend, quote: quote,
    mountShell: mountShell, escapeHtml: escapeHtml, qs: qs, buildQs: buildQs, relDate: relDate, debounce: debounce,
    api: api, listingCard: listingCard, showModal: showModal, stars: stars
  };
})();
