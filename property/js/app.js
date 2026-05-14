/* app.js — Shared shell for Manzil customer pages
   Nav, footer, currency, language, favorites, compare, recently-viewed, formatters, helpers. */
(function () {
  'use strict';

  // ---------- localStorage keys ----------
  var LS = {
    user:        'manzil.user',
    favorites:   'manzil.favorites',
    compare:     'manzil.compare',
    recently:    'manzil.recently_viewed',
    saved:       'manzil.saved_searches',
    mortgage:    'manzil.mortgage_scenarios',
    locale:      'manzil.locale',
    currency:    'manzil.currency',
    inquiries:   'manzil.inquiries.created',
    viewings:    'manzil.viewings.created'
  };

  function jget(k, def) { try { return JSON.parse(localStorage.getItem(k)) || def; } catch (e) { return def; } }
  function jset(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

  // ---------- Currency ----------
  function getCurrency() { return localStorage.getItem(LS.currency) || 'AED'; }
  function setCurrency(c) {
    localStorage.setItem(LS.currency, c);
    document.documentElement.setAttribute('data-currency', c);
    updateAllPrices();
    if (typeof window.toast === 'function') window.toast('Currency: ' + c, 'success', 1400);
  }

  function getRate(c) {
    var rates = (window.MANZIL_DATA && window.MANZIL_DATA.CURRENCIES) || [];
    var r = rates.find(function (x) { return x.code === c; });
    return r ? r.rate_to_aed : 1;
  }
  function symbol(c) {
    var rates = (window.MANZIL_DATA && window.MANZIL_DATA.CURRENCIES) || [];
    var r = rates.find(function (x) { return x.code === c; });
    return r ? r.symbol : '';
  }

  function formatPrice(aed, opts) {
    opts = opts || {};
    var c = opts.currency || getCurrency();
    var rate = getRate(c);
    var val = aed / rate;
    var sign = symbol(c) || c;
    if (val >= 1_000_000) return sign + ' ' + (val / 1_000_000).toFixed(val % 1_000_000 === 0 ? 0 : 1) + 'M';
    if (val >= 1_000) return sign + ' ' + Math.round(val).toLocaleString();
    return sign + ' ' + Math.round(val).toLocaleString();
  }
  function formatPriceExact(aed, opts) {
    opts = opts || {};
    var c = opts.currency || getCurrency();
    var rate = getRate(c);
    var val = aed / rate;
    var sign = symbol(c) || c;
    return sign + ' ' + Math.round(val).toLocaleString();
  }

  function updateAllPrices() {
    document.querySelectorAll('[data-price-aed]').forEach(function (el) {
      var aed = Number(el.getAttribute('data-price-aed'));
      var freq = el.getAttribute('data-price-freq') || '';
      el.innerHTML = formatPrice(aed) + (freq ? '<span class="m-price-rent">/' + freq + '</span>' : '');
    });
    document.querySelectorAll('[data-price-aed-exact]').forEach(function (el) {
      var aed = Number(el.getAttribute('data-price-aed-exact'));
      el.textContent = formatPriceExact(aed);
    });
  }

  // ---------- Locale / i18n ----------
  function getLocale() { return localStorage.getItem(LS.locale) || 'en'; }
  function setLocale(l) {
    localStorage.setItem(LS.locale, l);
    document.documentElement.lang = l;
    document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
    document.body.classList.toggle('rtl', l === 'ar');
    applyI18n();
    if (typeof window.toast === 'function') window.toast(l === 'ar' ? 'تم تغيير اللغة' : 'Language: English', 'success', 1400);
  }
  function t(key, fallback) {
    var data = (window.MANZIL_DATA && window.MANZIL_DATA.I18N) || {};
    var loc = getLocale();
    return (data[loc] && data[loc][key]) || (data.en && data.en[key]) || fallback || key;
  }
  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'), el.textContent);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder'), el.placeholder));
    });
  }

  // ---------- Favorites ----------
  function getFavorites() { return jget(LS.favorites, []); }
  function isFavorite(id) { return getFavorites().indexOf(String(id)) !== -1; }
  function toggleFavorite(id) {
    var list = getFavorites();
    id = String(id);
    var idx = list.indexOf(id);
    if (idx === -1) { list.push(id); }
    else { list.splice(idx, 1); }
    jset(LS.favorites, list);
    document.querySelectorAll('[data-fav="' + id + '"]').forEach(function (el) {
      el.classList.toggle('on', idx === -1);
      el.innerHTML = idx === -1 ? '♥' : '♡';
    });
    if (typeof window.toast === 'function') window.toast(idx === -1 ? t('fav.added', 'Saved to favorites') : t('fav.removed', 'Removed from favorites'), idx === -1 ? 'success' : '', 1400);
    return idx === -1;
  }

  // ---------- Compare ----------
  function getCompare() { return jget(LS.compare, []); }
  function isInCompare(id) { return getCompare().indexOf(String(id)) !== -1; }
  function toggleCompare(id) {
    var list = getCompare();
    id = String(id);
    var idx = list.indexOf(id);
    if (idx !== -1) { list.splice(idx, 1); }
    else if (list.length >= 3) {
      if (typeof window.toast === 'function') window.toast('You can compare up to 3 listings', 'warn'); return false;
    } else {
      list.push(id);
    }
    jset(LS.compare, list);
    if (typeof window.toast === 'function') window.toast(idx === -1 ? 'Added to compare' : 'Removed from compare', idx === -1 ? 'success' : '', 1400);
    return idx === -1;
  }

  // ---------- Recently viewed ----------
  function pushRecentlyViewed(id) {
    var list = jget(LS.recently, []);
    id = String(id);
    list = list.filter(function (x) { return x !== id; });
    list.unshift(id);
    list = list.slice(0, 6);
    jset(LS.recently, list);
  }
  function getRecentlyViewed() { return jget(LS.recently, []); }

  // ---------- Nav + footer ----------
  function navHtml(active) {
    var locale = getLocale();
    var currency = getCurrency();
    var links = [
      { href: 'search.html?transaction=buy',     i18n: 'nav.buy',     en: 'Buy',          ar: 'شراء' },
      { href: 'search.html?transaction=rent',    i18n: 'nav.rent',    en: 'Rent',         ar: 'إيجار' },
      { href: 'search.html?transaction=off-plan',i18n: 'nav.offplan', en: 'New Projects', ar: 'مشاريع جديدة' },
      { href: 'agents.html',                     i18n: 'nav.agents',  en: 'Agents',       ar: 'الوكلاء' },
      { href: 'areas.html',                      i18n: 'nav.areas',   en: 'Areas',        ar: 'المناطق' },
      { href: 'mortgage.html',                   i18n: 'nav.mortgage',en: 'Mortgage',     ar: 'تمويل' }
    ];
    return ''
      + '<div class="m-demo-banner"><div class="m-container"><strong>DEMO MODE</strong>All listings, agents and inquiries are fabricated. Photos via <a href="https://unsplash.com" rel="noopener" target="_blank" class="credit">Unsplash</a>.</div></div>'
      + '<header class="m-nav">'
      +   '<div class="m-container m-nav-inner">'
      +     '<a href="index.html" class="m-logo"><span class="m-logo-mark">م</span><span>Manzil</span></a>'
      +     '<nav class="m-nav-links" role="navigation">'
      +       links.map(function (l) {
                return '<a href="' + l.href + '"' + (active === l.i18n ? ' class="active"' : '') + ' data-i18n="' + l.i18n + '">' + (locale === 'ar' ? l.ar : l.en) + '</a>';
              }).join('')
      +     '</nav>'
      +     '<div class="m-nav-right">'
      +       '<select class="m-pill" data-currency-select aria-label="Currency">'
      +         ['AED','USD','GBP','EUR'].map(function (c) {
                  return '<option value="' + c + '"' + (c === currency ? ' selected' : '') + '>' + c + '</option>';
                }).join('')
      +       '</select>'
      +       '<button class="m-pill" data-locale-toggle aria-label="Language">' + (locale === 'ar' ? 'EN' : 'العربية') + '</button>'
      +       '<div data-bell-host style="position:relative;display:inline-block;"></div>'
      +       '<a class="m-pill m-pill--ghost" href="account.html" aria-label="Account">👤</a>'
      +       '<button class="m-nav-burger" data-burger aria-label="Open menu">☰</button>'
      +     '</div>'
      +   '</div>'
      + '</header>'
      + '<aside class="m-sheet" data-sheet>'
      +   '<div class="m-sheet-panel">'
      +     '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">'
      +       '<div class="m-logo"><span class="m-logo-mark">م</span><span>Manzil</span></div>'
      +       '<button class="m-pill" data-sheet-close aria-label="Close menu">×</button>'
      +     '</div>'
      +     links.map(function (l) {
              return '<a href="' + l.href + '">' + (locale === 'ar' ? l.ar : l.en) + '</a>';
            }).join('')
      +     '<a href="account.html">' + (locale === 'ar' ? 'حسابي' : 'My account') + '</a>'
      +     '<a href="compare.html">' + (locale === 'ar' ? 'قارن' : 'Compare') + '</a>'
      +     '<a href="admin.html">' + (locale === 'ar' ? 'لوحة الإدارة' : 'Admin panel') + '</a>'
      +   '</div>'
      + '</aside>';
  }

  function footHtml() {
    return ''
      + '<footer class="m-foot">'
      +   '<div class="m-container">'
      +     '<div class="m-foot-grid">'
      +       '<div>'
      +         '<div class="m-logo" style="color:white;"><span class="m-logo-mark">م</span><span>Manzil</span></div>'
      +         '<p style="color:rgba(255,255,255,.6);margin-top:8px;max-width:340px;">A Dubai-based real-estate marketplace demo. Find apartments, villas, off-plan and rentals across 15 UAE communities.</p>'
      +         '<p style="font-size:11px;color:rgba(255,255,255,.5);margin-top:8px;">Listings, agents, agencies and inquiries are fabricated for portfolio purposes. Photos via <a href="https://unsplash.com" rel="noopener" target="_blank">Unsplash</a> (free to use).</p>'
      +       '</div>'
      +       '<div><h4>Explore</h4><ul>'
      +         '<li><a href="search.html?transaction=buy">For sale</a></li>'
      +         '<li><a href="search.html?transaction=rent">For rent</a></li>'
      +         '<li><a href="search.html?transaction=off-plan">Off-plan</a></li>'
      +         '<li><a href="areas.html">Areas</a></li>'
      +         '<li><a href="mortgage.html">Mortgage</a></li>'
      +       '</ul></div>'
      +       '<div><h4>Manzil</h4><ul>'
      +         '<li><a href="agents.html">Find an agent</a></li>'
      +         '<li><a href="agents.html?tab=agencies">Agencies</a></li>'
      +         '<li><a href="account.html">My account</a></li>'
      +         '<li><a href="compare.html">Compare</a></li>'
      +         '<li><a href="admin.html">Admin demo</a></li>'
      +       '</ul></div>'
      +       '<div><h4>Demo info</h4><ul>'
      +         '<li><a href="../demo.html">All demos</a></li>'
      +         '<li><a href="../index.html">Portfolio home</a></li>'
      +         '<li><a href="../contact.html">Contact Saad</a></li>'
      +         '<li><a href="https://github.com/saad-mughal435/site" rel="noopener" target="_blank">Source on GitHub</a></li>'
      +       '</ul></div>'
      +     '</div>'
      +     '<div class="m-foot-bottom">'
      +       '<span>© 2026 Manzil Properties · Demo by Saad Mughal · All data fabricated.</span>'
      +       '<span>RERA-style permit numbers are illustrative.</span>'
      +     '</div>'
      +   '</div>'
      + '</footer>';
  }

  function mountShell(active) {
    var navHost = document.querySelector('[data-shell-nav]');
    var footHost = document.querySelector('[data-shell-foot]');
    if (navHost) navHost.innerHTML = navHtml(active);
    if (footHost) footHost.innerHTML = footHtml();

    // currency switcher
    var sel = document.querySelector('[data-currency-select]');
    if (sel) sel.addEventListener('change', function () { setCurrency(sel.value); });

    // locale toggle
    var loc = document.querySelector('[data-locale-toggle]');
    if (loc) loc.addEventListener('click', function () { setLocale(getLocale() === 'ar' ? 'en' : 'ar'); });

    // burger
    var burger = document.querySelector('[data-burger]');
    var sheet = document.querySelector('[data-sheet]');
    if (burger && sheet) burger.addEventListener('click', function () { sheet.classList.add('open'); });
    var sclose = document.querySelector('[data-sheet-close]');
    if (sclose && sheet) sclose.addEventListener('click', function () { sheet.classList.remove('open'); });
    if (sheet) sheet.addEventListener('click', function (e) { if (e.target === sheet) sheet.classList.remove('open'); });

    // bell
    var bell = document.querySelector('[data-bell-host]');
    if (bell && window.ManzilNotifications) window.ManzilNotifications.render(bell);

    // apply locale on load
    document.documentElement.lang = getLocale();
    document.documentElement.dir = getLocale() === 'ar' ? 'rtl' : 'ltr';
    document.body.classList.toggle('rtl', getLocale() === 'ar');
    applyI18n();
    updateAllPrices();
  }

  // ---------- Helpers / formatters ----------
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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

  function fmtDate(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString(getLocale() === 'ar' ? 'ar-AE' : 'en-AE', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  function fmtDateTime(iso) {
    var d = new Date(iso);
    return d.toLocaleString(getLocale() === 'ar' ? 'ar-AE' : 'en-AE', { dateStyle: 'medium', timeStyle: 'short' });
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }

  // ---------- API helper ----------
  function api(path, opts) {
    opts = opts || {};
    return fetch('/property/api' + path, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) { return r.json(); });
  }

  // ---------- Listing card renderer ----------
  function listingCard(l, opts) {
    opts = opts || {};
    var d = window.MANZIL_DATA;
    var area = d.AREAS.find(function (a) { return a.id === l.area_id; }) || {};
    var agent = d.AGENTS.find(function (a) { return a.id === l.agent_id; }) || {};
    var photo = (l.photos && l.photos[0]) || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=80';

    var badges = [];
    if (l.featured) badges.push('<span class="m-badge m-badge--featured">Featured</span>');
    if (l.verified) badges.push('<span class="m-badge m-badge--verified">Verified</span>');
    if (l.previous_price && l.previous_price > l.price_aed) badges.push('<span class="m-badge m-badge--drop">Price ↓</span>');
    var daysAgo = Math.floor((Date.now() - new Date(l.listed_at).getTime()) / 86400_000);
    if (daysAgo <= 7) badges.push('<span class="m-badge m-badge--new">New</span>');
    if (l.premium) badges.push('<span class="m-badge m-badge--premium">Premium</span>');

    var fav = isFavorite(l.id);
    var freq = l.transaction === 'rent' ? (l.rent_freq || 'year') : '';

    return ''
      + '<a href="listing.html?id=' + l.id + '" class="m-card m-listing-card" data-listing-id="' + l.id + '">'
      +   '<div class="m-listing-media">'
      +     '<img src="' + photo + '" alt="' + escapeHtml(l.title) + '" loading="lazy" />'
      +     '<div class="m-badges">' + badges.join('') + '</div>'
      +     '<button type="button" class="m-fav' + (fav ? ' on' : '') + '" data-fav="' + l.id + '" aria-label="Save to favorites" onclick="event.preventDefault();event.stopPropagation();ManzilApp.toggleFavorite(\'' + l.id + '\')">' + (fav ? '♥' : '♡') + '</button>'
      +   '</div>'
      +   '<div class="m-listing-body">'
      +     '<div class="m-listing-price"><span data-price-aed="' + l.price_aed + '"' + (freq ? ' data-price-freq="' + freq + '"' : '') + '>' + formatPrice(l.price_aed) + (freq ? '<span class="m-price-rent">/' + freq + '</span>' : '') + '</span></div>'
      +     '<div class="m-listing-title m-truncate">' + escapeHtml(l.title) + '</div>'
      +     '<div class="m-listing-loc">📍 ' + escapeHtml(area.name || '') + (l.address ? ' · ' + escapeHtml(l.address) : '') + '</div>'
      +     '<div class="m-listing-stats">'
      +       '<span>🛏 ' + (l.beds || 'Studio') + '</span>'
      +       '<span>🛁 ' + l.baths + '</span>'
      +       '<span>📐 ' + l.sqft.toLocaleString() + ' ft²</span>'
      +     '</div>'
      +     (opts.hideAgent ? '' :
              '<div class="m-listing-agent">'
              + (agent.photo_url ? '<img src="' + agent.photo_url + '" alt="' + escapeHtml(agent.name) + '" />' : '')
              + '<span>' + escapeHtml(agent.name || 'Manzil agent') + '</span>'
              + '</div>')
      +   '</div>'
      + '</a>';
  }

  // ---------- Agent card renderer ----------
  function agentCard(a) {
    var d = window.MANZIL_DATA;
    var agency = d.AGENCIES.find(function (x) { return x.id === a.agency_id; }) || {};
    var listings = d.LISTINGS.filter(function (l) { return l.agent_id === a.id && l.status === 'active'; }).length;
    return ''
      + '<a href="agent.html?id=' + a.id + '" class="m-agent-card">'
      +   '<img src="' + a.photo_url + '" alt="' + escapeHtml(a.name) + '" />'
      +   '<div>'
      +     '<h4>' + escapeHtml(a.name) + '</h4>'
      +     '<div class="agency">' + escapeHtml(agency.name || '') + '</div>'
      +     '<div class="ratings">' + stars(a.rating) + ' <span style="color:var(--manzil-muted)">· ' + listings + ' active</span></div>'
      +   '</div>'
      + '</a>';
  }

  function stars(n) {
    var full = Math.floor(n || 0), half = (n - full) >= 0.5;
    return '★'.repeat(full) + (half ? '☆' : '') + '☆'.repeat(Math.max(0, 5 - full - (half ? 1 : 0))).replace(/☆/g, '<span style="opacity:.35">★</span>');
  }

  // ---------- Modal helper ----------
  function showModal(opts) {
    var bd = document.createElement('div');
    bd.className = 'm-modal-backdrop';
    bd.innerHTML = ''
      + '<div class="m-modal' + (opts.size === 'lg' ? ' m-modal--lg' : opts.size === 'xl' ? ' m-modal--xl' : '') + '" role="dialog" aria-modal="true">'
      +   '<div class="m-modal-head"><h3>' + escapeHtml(opts.title || '') + '</h3><button class="m-modal-close" aria-label="Close">×</button></div>'
      +   '<div class="m-modal-body">' + (opts.body || '') + '</div>'
      +   (opts.foot === false ? '' : ('<div class="m-modal-foot">' + (opts.foot || '<button class="m-btn" data-modal-close>Close</button>') + '</div>'))
      + '</div>';
    document.body.appendChild(bd);
    function close() { if (bd.parentNode) bd.parentNode.removeChild(bd); document.removeEventListener('keydown', onEsc); }
    function onEsc(e) { if (e.key === 'Escape') close(); }
    bd.addEventListener('click', function (e) { if (e.target === bd) close(); });
    bd.querySelector('.m-modal-close').addEventListener('click', close);
    bd.querySelectorAll('[data-modal-close]').forEach(function (b) { b.addEventListener('click', close); });
    document.addEventListener('keydown', onEsc);
    if (typeof opts.onMount === 'function') opts.onMount(bd, close);
    return { el: bd, close: close };
  }

  // ---------- Inquiry / viewing actions ----------
  function openInquiry(listingId, kind) {
    var d = window.MANZIL_DATA;
    var l = d.LISTINGS.find(function (x) { return x.id === listingId; });
    if (!l) return;
    var agent = d.AGENTS.find(function (a) { return a.id === l.agent_id; }) || {};
    var titles = { call: 'Request a call', whatsapp: 'WhatsApp this agent', email: 'Email the agent', callback: 'Request callback', viewing: 'Schedule a viewing' };
    var bodyExtra = kind === 'viewing'
      ? '<div class="m-mortgage-row"><label class="m-field"><span>Date</span><input class="m-input" type="date" id="iq-date" min="' + new Date().toISOString().slice(0,10) + '" required></label>'
      +   '<label class="m-field"><span>Time</span><input class="m-input" type="time" id="iq-time" value="14:00" required></label></div>'
      : '';
    showModal({
      title: titles[kind] || 'Send message',
      body: ''
        + '<div style="display:flex;gap:12px;align-items:center;padding:10px;background:#fafaf6;border-radius:10px;">'
        +   '<img src="' + (agent.photo_url || '') + '" alt="" style="width:44px;height:44px;border-radius:999px;object-fit:cover;" />'
        +   '<div><strong>' + escapeHtml(agent.name || 'Manzil agent') + '</strong><div style="font-size:12px;color:var(--manzil-muted)">' + escapeHtml(l.title) + '</div></div>'
        + '</div>'
        + '<label class="m-field"><span>Your name</span><input class="m-input" id="iq-name" placeholder="Full name" required></label>'
        + '<label class="m-field"><span>Email</span><input class="m-input" id="iq-email" type="email" placeholder="you@email.com" required></label>'
        + '<label class="m-field"><span>Phone</span><input class="m-input" id="iq-phone" placeholder="+971 ..."></label>'
        + bodyExtra
        + '<label class="m-field"><span>Message</span><textarea class="m-textarea" id="iq-msg" rows="3" placeholder="I would like to ' + (kind === 'viewing' ? 'view' : 'know more about') + ' this property...">Hi ' + (agent.name||'') + ', I am interested in this listing.</textarea></label>',
      foot: '<button class="m-btn" data-modal-close>Cancel</button><button class="m-btn m-btn--primary" id="iq-submit">Send</button>',
      onMount: function (host, close) {
        host.querySelector('#iq-submit').addEventListener('click', function () {
          var name = host.querySelector('#iq-name').value.trim();
          var email = host.querySelector('#iq-email').value.trim();
          var phone = host.querySelector('#iq-phone').value.trim();
          var msg = host.querySelector('#iq-msg').value.trim();
          if (!name || !email) { toast('Please fill name and email', 'error'); return; }
          var payload = {
            listing_id: l.id, agent_id: agent.id, kind: kind,
            name: name, email: email, phone: phone, message: msg,
            created_at: new Date().toISOString()
          };
          if (kind === 'viewing') {
            var date = host.querySelector('#iq-date').value;
            var time = host.querySelector('#iq-time').value;
            payload.scheduled_at = date + 'T' + time;
            api('/viewings', { method: 'POST', body: payload }).then(function () {
              toast('Viewing scheduled — agent will confirm', 'success');
              if (window.ManzilNotifications) window.ManzilNotifications.push('Viewing booked', l.title + ' on ' + date + ' at ' + time);
              close();
            });
          } else {
            api('/inquiries', { method: 'POST', body: payload }).then(function () {
              toast(kind === 'whatsapp' ? 'WhatsApp message sent (demo)' : 'Inquiry sent — agent will respond soon', 'success');
              if (window.ManzilNotifications) window.ManzilNotifications.push('Inquiry sent', l.title);
              close();
            });
          }
        });
      }
    });
  }

  // ---------- Share ----------
  function shareListing(id) {
    var d = window.MANZIL_DATA;
    var l = d.LISTINGS.find(function (x) { return x.id === id; });
    if (!l) return;
    var url = location.origin + '/property/listing.html?id=' + id;
    var msg = encodeURIComponent(l.title + ' — ' + formatPriceExact(l.price_aed) + ' · ' + url);
    showModal({
      title: 'Share this listing',
      body: ''
        + '<div class="m-grid m-grid-3">'
        +   '<a class="m-btn m-btn--ghost" href="https://wa.me/?text=' + msg + '" target="_blank" rel="noopener">WhatsApp</a>'
        +   '<a class="m-btn m-btn--ghost" href="mailto:?subject=' + encodeURIComponent(l.title) + '&body=' + msg + '">Email</a>'
        +   '<button class="m-btn m-btn--ghost" data-copy>Copy link</button>'
        + '</div>'
        + '<input class="m-input" value="' + url + '" readonly style="margin-top:10px;" />',
      foot: '<button class="m-btn" data-modal-close>Done</button>',
      onMount: function (host) {
        host.querySelector('[data-copy]').addEventListener('click', function () {
          navigator.clipboard.writeText(url).then(function () { toast('Link copied', 'success'); });
        });
      }
    });
  }

  // ---------- Mortgage compute ----------
  function computeMortgage(price, downPct, ratePct, years) {
    var down = price * (downPct / 100);
    var loan = price - down;
    var monthlyRate = (ratePct / 100) / 12;
    var n = years * 12;
    var monthly = monthlyRate === 0 ? loan / n : (loan * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n));
    var totalPay = monthly * n;
    var totalInt = totalPay - loan;
    return { down: down, loan: loan, monthly: monthly, totalPay: totalPay, totalInt: totalInt };
  }

  // ---------- Expose ----------
  window.ManzilApp = {
    LS: LS, jget: jget, jset: jset,
    getCurrency: getCurrency, setCurrency: setCurrency, formatPrice: formatPrice, formatPriceExact: formatPriceExact, updateAllPrices: updateAllPrices,
    getLocale: getLocale, setLocale: setLocale, t: t, applyI18n: applyI18n,
    getFavorites: getFavorites, isFavorite: isFavorite, toggleFavorite: toggleFavorite,
    getCompare: getCompare, isInCompare: isInCompare, toggleCompare: toggleCompare,
    pushRecentlyViewed: pushRecentlyViewed, getRecentlyViewed: getRecentlyViewed,
    mountShell: mountShell, escapeHtml: escapeHtml, qs: qs, buildQs: buildQs,
    relDate: relDate, fmtDate: fmtDate, fmtDateTime: fmtDateTime, debounce: debounce,
    api: api, listingCard: listingCard, agentCard: agentCard, stars: stars,
    showModal: showModal, openInquiry: openInquiry, shareListing: shareListing,
    computeMortgage: computeMortgage
  };
})();
