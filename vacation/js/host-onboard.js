/* host-onboard.js — 6-step "List your property" wizard.
   Steps: About you → Verification (docs) → Property → Photos & description
        → Amenities & rules → Pricing & calendar → Review → Submit.
   Modes (via ?mode=): signup (default, full flow) · add-listing (skip step 1)
        · edit&id=L0XX (load existing listing into state).
   All data persists to localStorage so the wizard is save-and-resume. */
(function () {
  'use strict';

  var D = window.VACATION_DATA;
  var LS_DRAFT = 'vacation.host_draft';
  var LS_SESSION = 'vacation.host_session';
  var DUBAI_DESTINATIONS = ['d-marina','d-downtown','d-palm','d-jbr','d-business','d-hatta'];

  // ---------- State ----------
  function defaultState() {
    return {
      step: 0,
      mode: 'signup',
      edit_id: null,
      submitted_ref: null,
      profile: { name: '', email: '', phone: '', password: '', languages: [], photo: '', bio: '' },
      verification: { resident: true, ownership_kind: 'own', documents: {} },
      property: { type: 'apartment', title: '', destination_id: 'd-marina', address: '', lat: null, lng: null, bedrooms: 2, beds: 3, baths: 2, sqft: 1200, max_guests: 4 },
      photos: { list: [], description: '', listing_permit: null },
      amenities: { selected: [], house_rules: ['No smoking indoors','No parties','Check-in 3 PM','Check-out 11 AM'], custom_rule: '', cancellation: 'moderate' },
      pricing: { base_nightly: 0, weekend_surcharge_pct: 20, cleaning_fee: 200, instant_book: true, blocked_dates: [], min_nights: 2, max_nights: 30, advance_notice: 'same-day' },
      confirmed: false
    };
  }
  function getDraft() {
    try { return JSON.parse(localStorage.getItem(LS_DRAFT)); } catch (e) { return null; }
  }
  function saveDraft() { localStorage.setItem(LS_DRAFT, JSON.stringify(state)); }
  function clearDraft() { localStorage.removeItem(LS_DRAFT); }
  function getSession() {
    try { return JSON.parse(localStorage.getItem(LS_SESSION)); } catch (e) { return null; }
  }

  var state = defaultState();
  var leafletLoaded = false;
  var mapInstance = null;
  var mapMarker = null;

  // ---------- Step definitions ----------
  var STEPS = [
    { id: 'about',        label: 'About you',            render: renderStepAbout,        validate: validateAbout },
    { id: 'verification', label: 'Verification',         render: renderStepVerification, validate: validateVerification },
    { id: 'property',     label: 'Property',             render: renderStepProperty,     validate: validateProperty },
    { id: 'photos',       label: 'Photos & description', render: renderStepPhotos,       validate: validatePhotos },
    { id: 'amenities',    label: 'Amenities & rules',    render: renderStepAmenities,    validate: validateAmenities },
    { id: 'pricing',      label: 'Pricing & calendar',   render: renderStepPricing,      validate: validatePricing },
    { id: 'review',       label: 'Review',               render: renderStepReview,       validate: function () { return state.confirmed; } }
  ];

  // ---------- Generic helpers ----------
  function el(id) { return document.getElementById(id); }
  function esc(s) { return VacationApp.escapeHtml(String(s == null ? '' : s)); }
  function fmt(n) { return VacationApp.formatPriceExact(n); }
  function on(node, ev, fn) { if (node) node.addEventListener(ev, fn); }
  function bindInput(selector, path) {
    var node = document.querySelector(selector);
    if (!node) return;
    var keys = path.split('.');
    on(node, 'input', function () {
      var v = node.type === 'checkbox' ? node.checked : (node.type === 'number' ? Number(node.value) : node.value);
      setPath(state, keys, v);
      saveDraft();
    });
    on(node, 'change', function () {
      var v2 = node.type === 'checkbox' ? node.checked : (node.type === 'number' ? Number(node.value) : node.value);
      setPath(state, keys, v2);
      saveDraft();
    });
  }
  function setPath(obj, keys, value) {
    for (var i = 0; i < keys.length - 1; i++) {
      if (!obj[keys[i]]) obj[keys[i]] = {};
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = value;
  }

  function readFileAsBase64(file, cb) {
    if (!file) return cb(null);
    if (!/^image\//.test(file.type)) {
      // For PDFs and other non-image: store filename + mime only.
      return cb({ filename: file.name, mime: file.type || 'application/pdf', thumb: null });
    }
    var fr = new FileReader();
    fr.onload = function () { cb({ filename: file.name, mime: file.type, thumb: fr.result }); };
    fr.readAsDataURL(file);
  }

  function isDubaiDestination(id) { return DUBAI_DESTINATIONS.indexOf(id) !== -1; }
  function isValidEmail(s) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s || ''); }
  function isValidPhone(s) { return /^(\+971|00971|0)?[\s-]?5[0-9][\s-]?\d{3}[\s-]?\d{4}$/.test(String(s || '').replace(/\s/g, '')); }
  function isValidIban(s) { return /^AE\d{21}$/.test(String(s || '').replace(/\s/g, '').toUpperCase()); }

  function destLabel(id) { var d = D.DESTINATIONS.find(function (x) { return x.id === id; }); return d ? d.name : id; }

  // ---------- Step 1: About you ----------
  function renderStepAbout(host) {
    host.innerHTML = ''
      + '<h2>Tell us about you</h2>'
      + '<p class="v-step-intro">Your name, contact, and a short bio. Travelers see this when they book your home.</p>'
      + '<div class="v-grid" style="display:grid;grid-template-columns:1fr;gap:14px;">'
      +   '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">'
      +     '<label class="v-field"><span>Full name</span><input class="v-input" id="p-name" value="' + esc(state.profile.name) + '" placeholder="e.g., Ahmed Al-Falasi" /></label>'
      +     '<label class="v-field"><span>Email</span><input class="v-input" id="p-email" type="email" value="' + esc(state.profile.email) + '" placeholder="you@email.com" /></label>'
      +   '</div>'
      +   '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">'
      +     '<label class="v-field"><span>UAE mobile</span><input class="v-input" id="p-phone" value="' + esc(state.profile.phone) + '" placeholder="+971 50 123 4567" /></label>'
      +     '<label class="v-field"><span>Password</span><input class="v-input" id="p-password" type="password" value="' + esc(state.profile.password) + '" placeholder="At least 8 characters" /></label>'
      +   '</div>'
      +   '<label class="v-field"><span>Languages you speak</span>'
      +     '<div class="v-pills" id="p-langs">'
      +       ['English','Arabic','Hindi','Urdu','Russian','French','Spanish','German','Korean','Tagalog'].map(function (lang) {
              var on = state.profile.languages.indexOf(lang) !== -1;
              return '<button type="button" class="v-pill ' + (on ? 'active' : '') + '" data-lang="' + esc(lang) + '">' + esc(lang) + '</button>';
            }).join('')
      +     '</div>'
      +   '</label>'
      +   '<label class="v-field"><span>Profile photo URL <span class="v-text-muted" style="font-weight:400;">(optional)</span></span><input class="v-input" id="p-photo" value="' + esc(state.profile.photo) + '" placeholder="https://..." /></label>'
      +   '<label class="v-field"><span>Short bio <span class="v-text-muted" style="font-weight:400;" id="p-bio-count">(0/500)</span></span><textarea class="v-textarea" id="p-bio" rows="4" placeholder="Hi, I\'m Ahmed — I host weekends on Palm Jumeirah. I love showing guests the best brunch spots…">' + esc(state.profile.bio) + '</textarea></label>'
      + '</div>'
      + '<p class="v-text-muted" style="font-size:12px;margin-top:18px;">For the live product, passwords would be hashed server-side. This demo stores them in localStorage only — don\'t use a real password.</p>';
    bindInput('#p-name', 'profile.name');
    bindInput('#p-email', 'profile.email');
    bindInput('#p-phone', 'profile.phone');
    bindInput('#p-password', 'profile.password');
    bindInput('#p-photo', 'profile.photo');
    var bio = el('p-bio');
    var bioCount = el('p-bio-count');
    function updateBio() {
      state.profile.bio = bio.value;
      bioCount.textContent = '(' + bio.value.length + '/500)';
      saveDraft();
    }
    on(bio, 'input', updateBio); updateBio();
    document.querySelectorAll('[data-lang]').forEach(function (btn) {
      on(btn, 'click', function () {
        var lang = btn.getAttribute('data-lang');
        var arr = state.profile.languages;
        var idx = arr.indexOf(lang);
        if (idx === -1) arr.push(lang); else arr.splice(idx, 1);
        btn.classList.toggle('active');
        saveDraft();
      });
    });
  }
  function validateAbout() {
    var p = state.profile;
    if (!p.name || p.name.length < 2) return 'Please enter your full name.';
    if (!isValidEmail(p.email))         return 'Please enter a valid email.';
    if (!isValidPhone(p.phone))         return 'Please enter a UAE mobile (e.g., +971 50 123 4567).';
    if (!p.password || p.password.length < 8) return 'Password must be at least 8 characters.';
    if (!p.languages.length)            return 'Pick at least one language you speak.';
    if (!p.bio || p.bio.length < 60)    return 'Bio should be at least 60 characters — tell travellers a little about you.';
    return true;
  }

  // ---------- Step 2: Verification ----------
  function renderStepVerification(host) {
    var docs = D.DOCUMENT_TYPES;
    var resident = state.verification.resident;
    var isDubai = isDubaiDestination(state.property.destination_id);
    function isDocVisible(doc) {
      if (doc.required === 'non_resident') return !resident;
      if (doc.required === 'dubai_only')   return isDubai;
      return true;
    }
    host.innerHTML = ''
      + '<h2>Verify your identity &amp; property</h2>'
      + '<p class="v-step-intro">Documents are reviewed manually by our team within 24 hours. Your listing will not go live until verification clears.</p>'
      + '<div class="v-panel" style="padding:16px;margin-bottom:18px;">'
      +   '<strong>Are you a UAE resident?</strong>'
      +   '<div class="v-pills" style="margin-top:10px;">'
      +     '<button type="button" class="v-pill ' + (resident ? 'active' : '') + '" data-res="1">Yes — Emirates ID only</button>'
      +     '<button type="button" class="v-pill ' + (!resident ? 'active' : '') + '" data-res="0">No — I\'ll also upload my passport</button>'
      +   '</div>'
      + '</div>'
      + '<div class="v-panel" style="padding:16px;margin-bottom:18px;">'
      +   '<strong>How do you have rights to this property?</strong>'
      +   '<div class="v-pills" style="margin-top:10px;">'
      +     '<button type="button" class="v-pill ' + (state.verification.ownership_kind === 'own' ? 'active' : '') + '" data-own="own">I own it (Mulkiya)</button>'
      +     '<button type="button" class="v-pill ' + (state.verification.ownership_kind === 'sublease' ? 'active' : '') + '" data-own="sublease">I sublease (Ejari + landlord letter)</button>'
      +   '</div>'
      + '</div>'
      + '<div class="v-doc-grid" id="doc-grid">'
      +   docs.filter(isDocVisible).map(renderDocCard).join('')
      + '</div>'
      + '<p class="v-text-muted" style="font-size:12px;margin-top:18px;">All files are stored locally in this demo — they never leave your browser. In the live product they would be encrypted in transit and at rest.</p>';
    document.querySelectorAll('[data-res]').forEach(function (b) {
      on(b, 'click', function () { state.verification.resident = b.getAttribute('data-res') === '1'; saveDraft(); render(); });
    });
    document.querySelectorAll('[data-own]').forEach(function (b) {
      on(b, 'click', function () { state.verification.ownership_kind = b.getAttribute('data-own'); saveDraft(); render(); });
    });
    document.querySelectorAll('[data-doc-input]').forEach(function (input) {
      on(input, 'change', function (ev) {
        var type = input.getAttribute('data-doc-input');
        var file = ev.target.files && ev.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { window.toast && window.toast('File too large — max 5MB','warn'); return; }
        readFileAsBase64(file, function (doc) {
          if (!doc) return;
          state.verification.documents[type] = Object.assign({ type: type, status: 'submitted' }, doc);
          saveDraft();
          render();
        });
      });
    });
    document.querySelectorAll('[data-doc-remove]').forEach(function (b) {
      on(b, 'click', function () {
        delete state.verification.documents[b.getAttribute('data-doc-remove')];
        saveDraft(); render();
      });
    });
    var ibanInput = el('doc-iban');
    if (ibanInput) on(ibanInput, 'input', function () {
      var val = ibanInput.value.toUpperCase().replace(/\s/g, '');
      state.verification.documents.iban = { type: 'iban', filename: val, status: 'submitted' };
      saveDraft();
    });
  }
  function renderDocCard(doc) {
    if (doc.id === 'iban') {
      var val = (state.verification.documents.iban && state.verification.documents.iban.filename) || '';
      return ''
        + '<div class="v-doc-card' + (val ? ' has-file' : '') + '" style="grid-column:1/-1;">'
        +   '<div class="v-doc-head"><div class="v-doc-icon">' + doc.icon + '</div>'
        +     '<div class="v-doc-title">' + esc(doc.label) + '</div>'
        +     '<span class="v-doc-required">Required</span>'
        +   '</div>'
        +   '<div class="v-doc-tooltip">' + esc(doc.tooltip) + '</div>'
        +   '<input class="v-input" id="doc-iban" placeholder="AE07 0331 2345 6789 0123 456" value="' + esc(val) + '" />'
        +   (val && !isValidIban(val) ? '<div class="v-doc-reject-reason">Format must be AE followed by 21 digits.</div>' : '')
        + '</div>';
    }
    var saved = state.verification.documents[doc.id];
    var requiredLabel = doc.required === 'always' ? 'Required' : (doc.required === 'non_resident' ? 'Required (non-resident)' : 'Required (Dubai)');
    return ''
      + '<div class="v-doc-card' + (saved ? ' has-file' : '') + '">'
      +   '<div class="v-doc-head"><div class="v-doc-icon">' + doc.icon + '</div>'
      +     '<div class="v-doc-title">' + esc(doc.label) + '</div>'
      +     '<span class="v-doc-required">' + requiredLabel + '</span>'
      +   '</div>'
      +   '<div class="v-doc-tooltip">' + esc(doc.tooltip) + '</div>'
      +   (saved
          ? '<div class="v-doc-preview">'
            +   '<div class="v-doc-thumb">' + (saved.thumb ? '<img src="' + saved.thumb + '" alt="">' : '<span class="v-doc-thumb-fallback">📄</span>') + '</div>'
            +   '<div class="v-doc-meta"><div class="v-doc-meta-name">' + esc(saved.filename) + '</div><div class="v-doc-meta-status">Uploaded · awaiting review</div></div>'
            +   '<div class="v-doc-actions"><button class="v-btn v-btn--ghost v-btn--sm" data-doc-remove="' + doc.id + '">Remove</button></div>'
            + '</div>'
            + '<label class="v-btn v-btn--ghost v-btn--sm" style="position:relative;overflow:hidden;align-self:flex-start;">Replace<input type="file" accept="image/*,application/pdf" data-doc-input="' + doc.id + '" style="position:absolute;inset:0;opacity:0;cursor:pointer;" /></label>'
          : '<div class="v-doc-drop"><input type="file" accept="image/*,application/pdf" data-doc-input="' + doc.id + '" /><div class="v-doc-drop-text"><strong>Click to upload</strong> or drag a file<br><span style="font-size:11px;">PNG, JPG, PDF · max 5MB</span></div></div>'
          )
      + '</div>';
  }
  function validateVerification() {
    var v = state.verification;
    var docs = D.DOCUMENT_TYPES;
    var isDubai = isDubaiDestination(state.property.destination_id);
    var missing = [];
    docs.forEach(function (doc) {
      if (doc.required === 'always')       { if (!v.documents[doc.id]) missing.push(doc.label); }
      else if (doc.required === 'non_resident' && !v.resident) { if (!v.documents[doc.id]) missing.push(doc.label); }
      else if (doc.required === 'dubai_only' && isDubai)       { if (!v.documents[doc.id]) missing.push(doc.label); }
    });
    if (missing.length) return 'Please upload: ' + missing.join(', ') + '.';
    var iban = v.documents.iban && v.documents.iban.filename;
    if (!isValidIban(iban)) return 'IBAN must be AE followed by 21 digits.';
    return true;
  }

  // ---------- Step 3: Property basics ----------
  function renderStepProperty(host) {
    var p = state.property;
    host.innerHTML = ''
      + '<h2>The property</h2>'
      + '<p class="v-step-intro">Basic facts about your place. Travellers filter on these to find their stay.</p>'
      + '<div style="display:grid;grid-template-columns:1fr;gap:14px;">'
      +   '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">'
      +     '<label class="v-field"><span>Property type</span><select class="v-select" id="pr-type">'
      +       ['apartment','villa','townhouse','penthouse','cabin','glamping'].map(function (t) { return '<option value="' + t + '" ' + (p.type === t ? 'selected' : '') + '>' + t.charAt(0).toUpperCase() + t.slice(1) + '</option>'; }).join('')
      +     '</select></label>'
      +     '<label class="v-field"><span>Destination</span><select class="v-select" id="pr-dest">'
      +       D.DESTINATIONS.map(function (d) { return '<option value="' + d.id + '" ' + (p.destination_id === d.id ? 'selected' : '') + '>' + esc(d.name) + '</option>'; }).join('')
      +     '</select></label>'
      +   '</div>'
      +   '<label class="v-field"><span>Listing title <span class="v-text-muted" style="font-weight:400;" id="pr-title-count">(0/80)</span></span><input class="v-input" id="pr-title" maxlength="80" value="' + esc(p.title) + '" placeholder="e.g., Marina Heights — Skyline Penthouse" /></label>'
      +   '<label class="v-field"><span>Address line</span><input class="v-input" id="pr-addr" value="' + esc(p.address) + '" placeholder="Tower / building / area" /></label>'
      +   '<div>'
      +     '<label class="v-field"><span>Drop pin where the property is</span></label>'
      +     '<div id="pr-map" class="v-map-pin"></div>'
      +     '<div class="v-map-pin-hint">Click anywhere on the map to set the location. Approximate is fine.</div>'
      +   '</div>'
      +   '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:14px;">'
      +     '<label class="v-field"><span>Bedrooms</span><input class="v-input" id="pr-br" type="number" min="0" max="10" value="' + p.bedrooms + '" /></label>'
      +     '<label class="v-field"><span>Beds</span><input class="v-input" id="pr-beds" type="number" min="1" max="20" value="' + p.beds + '" /></label>'
      +     '<label class="v-field"><span>Baths</span><input class="v-input" id="pr-baths" type="number" min="1" max="10" value="' + p.baths + '" /></label>'
      +     '<label class="v-field"><span>Size (sqft)</span><input class="v-input" id="pr-sqft" type="number" min="200" max="20000" value="' + p.sqft + '" /></label>'
      +     '<label class="v-field"><span>Max guests</span><input class="v-input" id="pr-guests" type="number" min="1" max="30" value="' + p.max_guests + '" /></label>'
      +   '</div>'
      + '</div>';
    bindInput('#pr-type', 'property.type');
    on(el('pr-dest'), 'change', function () { state.property.destination_id = el('pr-dest').value; saveDraft(); centerMap(); });
    on(el('pr-addr'), 'input', function () { state.property.address = el('pr-addr').value; saveDraft(); });
    bindInput('#pr-br', 'property.bedrooms');
    bindInput('#pr-beds', 'property.beds');
    bindInput('#pr-baths', 'property.baths');
    bindInput('#pr-sqft', 'property.sqft');
    bindInput('#pr-guests', 'property.max_guests');
    var titleInput = el('pr-title');
    var titleCount = el('pr-title-count');
    function updTitle() {
      state.property.title = titleInput.value;
      titleCount.textContent = '(' + titleInput.value.length + '/80)';
      saveDraft();
    }
    on(titleInput, 'input', updTitle); updTitle();
    mountMap();
  }
  function mountMap() {
    var hostMap = el('pr-map');
    if (!hostMap) return;
    function ensureLeaflet(cb) {
      if (window.L) return cb();
      if (leafletLoaded) return setTimeout(function () { ensureLeaflet(cb); }, 100);
      leafletLoaded = true;
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
      var sc = document.createElement('script');
      sc.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      sc.onload = cb;
      document.head.appendChild(sc);
    }
    ensureLeaflet(function () {
      if (!window.L || !hostMap) return;
      var dest = D.DESTINATIONS.find(function (d) { return d.id === state.property.destination_id; }) || D.DESTINATIONS[0];
      var lat = state.property.lat || dest.lat;
      var lng = state.property.lng || dest.lng;
      hostMap.innerHTML = '';
      mapInstance = window.L.map(hostMap).setView([lat, lng], 14);
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(mapInstance);
      mapMarker = window.L.marker([lat, lng], { draggable: true }).addTo(mapInstance);
      mapMarker.on('moveend', function () {
        var pos = mapMarker.getLatLng();
        state.property.lat = pos.lat; state.property.lng = pos.lng;
        saveDraft();
      });
      mapInstance.on('click', function (e) {
        mapMarker.setLatLng(e.latlng);
        state.property.lat = e.latlng.lat; state.property.lng = e.latlng.lng;
        saveDraft();
      });
      state.property.lat = lat; state.property.lng = lng;
    });
  }
  function centerMap() {
    if (!mapInstance) return;
    var dest = D.DESTINATIONS.find(function (d) { return d.id === state.property.destination_id; }) || D.DESTINATIONS[0];
    mapInstance.setView([dest.lat, dest.lng], 14);
    mapMarker.setLatLng([dest.lat, dest.lng]);
    state.property.lat = dest.lat; state.property.lng = dest.lng;
    saveDraft();
  }
  function validateProperty() {
    var p = state.property;
    if (!p.title || p.title.length < 20)         return 'Listing title must be at least 20 characters.';
    if (!p.address)                              return 'Please add an address line.';
    if (!p.lat || !p.lng)                        return 'Drop a pin on the map to set the location.';
    if (p.bedrooms < 0 || p.bedrooms > 10)       return 'Bedrooms must be between 0 and 10.';
    if (p.beds < 1)                              return 'At least 1 bed is required.';
    if (p.max_guests < 1)                        return 'Max guests must be at least 1.';
    return true;
  }

  // ---------- Step 4: Photos & description ----------
  function renderStepPhotos(host) {
    host.innerHTML = ''
      + '<h2>Photos &amp; description</h2>'
      + '<p class="v-step-intro">Add up to 10 photos. The first photo is the cover travelers see first.</p>'
      + '<div class="v-flex-wrap" style="margin-bottom:14px;">'
      +   '<label class="v-btn v-btn--ghost v-btn--sm" style="position:relative;overflow:hidden;">Upload photos<input id="ph-upload" type="file" accept="image/*" multiple style="position:absolute;inset:0;opacity:0;cursor:pointer;" /></label>'
      +   '<button class="v-btn v-btn--ghost v-btn--sm" id="ph-paste-btn">Paste URL</button>'
      +   '<button class="v-btn v-btn--ghost v-btn--sm" id="ph-stock-btn">Use a stock photo</button>'
      + '</div>'
      + '<div class="v-photo-strip" id="ph-strip"></div>'
      + (state.photos.list.length === 0 ? '<div class="v-text-muted" style="font-size:13px;margin-top:8px;">No photos yet. Add at least 3 before submitting.</div>' : '')
      + '<label class="v-field" style="margin-top:24px;"><span>Description <span class="v-text-muted" style="font-weight:400;" id="ph-desc-count">(0/2000)</span></span><textarea class="v-textarea" id="ph-desc" rows="8" placeholder="Three short paragraphs:\n1. What makes this place special\n2. The space\n3. The neighbourhood">' + esc(state.photos.description) + '</textarea></label>';
    refreshPhotoStrip();
    on(el('ph-upload'), 'change', function (ev) {
      var files = Array.from(ev.target.files || []);
      files.slice(0, 10 - state.photos.list.length).forEach(function (file) {
        if (!/^image\//.test(file.type)) return;
        var fr = new FileReader();
        fr.onload = function () { state.photos.list.push(fr.result); saveDraft(); refreshPhotoStrip(); };
        fr.readAsDataURL(file);
      });
      ev.target.value = '';
    });
    on(el('ph-paste-btn'), 'click', function () {
      VacationApp.showModal({
        title: 'Paste a photo URL',
        body: '<label class="v-field"><span>Image URL</span><input class="v-input" id="ph-url-input" placeholder="https://images.unsplash.com/..." /></label>',
        foot: '<button class="v-btn v-btn--primary" id="ph-url-add">Add</button>',
        onMount: function (modal, close) {
          modal.querySelector('#ph-url-add').addEventListener('click', function () {
            var v = modal.querySelector('#ph-url-input').value.trim();
            if (v) { state.photos.list.push(v); saveDraft(); refreshPhotoStrip(); }
            close();
          });
        }
      });
    });
    on(el('ph-stock-btn'), 'click', function () {
      var avail = D.PHOTO_POOL.filter(function (u) { return state.photos.list.indexOf(u) === -1; });
      if (!avail.length) return window.toast && window.toast('No more stock photos','warn');
      state.photos.list.push(avail[Math.floor(Math.random() * avail.length)]);
      saveDraft();
      refreshPhotoStrip();
    });
    var desc = el('ph-desc');
    var descCount = el('ph-desc-count');
    function updDesc() {
      state.photos.description = desc.value;
      descCount.textContent = '(' + desc.value.length + '/2000)';
      saveDraft();
    }
    on(desc, 'input', updDesc); updDesc();
  }
  function refreshPhotoStrip() {
    var strip = el('ph-strip');
    if (!strip) return;
    strip.innerHTML = state.photos.list.map(function (url, i) {
      return '<div class="v-photo-strip-item ' + (i === 0 ? 'is-cover' : '') + '"><img src="' + esc(url) + '" alt="" loading="lazy"><button class="v-photo-strip-remove" data-rm="' + i + '">×</button></div>';
    }).join('');
    strip.querySelectorAll('[data-rm]').forEach(function (b) {
      on(b, 'click', function () {
        state.photos.list.splice(Number(b.getAttribute('data-rm')), 1);
        saveDraft();
        refreshPhotoStrip();
      });
    });
  }
  function validatePhotos() {
    if (state.photos.list.length < 3) return 'Add at least 3 photos.';
    if (!state.photos.description || state.photos.description.length < 100) return 'Description must be at least 100 characters.';
    return true;
  }

  // ---------- Step 5: Amenities & rules ----------
  function renderStepAmenities(host) {
    var sel = state.amenities.selected;
    host.innerHTML = ''
      + '<h2>Amenities &amp; rules</h2>'
      + '<p class="v-step-intro">What does your place have, and what should guests know before they book?</p>'
      + '<div style="margin-bottom:24px;">'
      +   '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><strong>Amenities</strong>'
      +     '<button class="v-btn v-btn--ghost v-btn--sm" id="am-essentials">+ Essentials</button>'
      +   '</div>'
      +   '<div class="v-amenity-grid">'
      +     D.AMENITIES.map(function (a) {
            var on = sel.indexOf(a.id) !== -1;
            return '<div class="v-amenity-tile ' + (on ? 'is-selected' : '') + '" data-amen="' + a.id + '"><span class="v-amenity-tile-icon">' + a.icon + '</span>' + esc(a.label) + '</div>';
          }).join('')
      +   '</div>'
      + '</div>'
      + '<div style="margin-bottom:24px;">'
      +   '<strong>House rules</strong>'
      +   '<div style="margin-top:10px;display:grid;gap:6px;">'
      +     ['No smoking indoors','No parties or events','No pets','Check-in 3 PM','Check-out 11 AM','Quiet hours 10 PM – 8 AM'].map(function (rule) {
            var on = state.amenities.house_rules.indexOf(rule) !== -1;
            return '<label class="v-check"><input type="checkbox" data-rule="' + esc(rule) + '" ' + (on ? 'checked' : '') + '> ' + esc(rule) + '</label>';
          }).join('')
      +   '</div>'
      +   '<label class="v-field" style="margin-top:14px;"><span>Additional rules</span><textarea class="v-textarea" id="am-custom" rows="3" placeholder="Anything else guests should know…">' + esc(state.amenities.custom_rule) + '</textarea></label>'
      + '</div>'
      + '<div>'
      +   '<strong>Cancellation policy</strong>'
      +   '<div class="v-pills" style="margin-top:10px;">'
      +     [
            { id: 'flexible',  label: 'Flexible',  desc: 'Free cancellation up to 24h before check-in.' },
            { id: 'moderate',  label: 'Moderate',  desc: 'Free cancellation up to 5 days before check-in.' },
            { id: 'strict',    label: 'Strict',    desc: 'Free cancellation only within 48h of booking.' }
          ].map(function (c) {
            return '<button type="button" class="v-pill ' + (state.amenities.cancellation === c.id ? 'active' : '') + '" data-cancel="' + c.id + '" title="' + esc(c.desc) + '">' + esc(c.label) + '</button>';
          }).join('')
      +   '</div>'
      +   '<div class="v-text-muted" style="font-size:12px;margin-top:6px;" id="am-cancel-desc"></div>'
      + '</div>';
    document.querySelectorAll('[data-amen]').forEach(function (tile) {
      on(tile, 'click', function () {
        var a = tile.getAttribute('data-amen');
        var idx = sel.indexOf(a);
        if (idx === -1) sel.push(a); else sel.splice(idx, 1);
        tile.classList.toggle('is-selected');
        saveDraft();
      });
    });
    on(el('am-essentials'), 'click', function () {
      ['wifi','ac','kitchen','washer','tv','parking','self-checkin'].forEach(function (a) { if (sel.indexOf(a) === -1) sel.push(a); });
      saveDraft();
      render();
    });
    document.querySelectorAll('[data-rule]').forEach(function (c) {
      on(c, 'change', function () {
        var r = c.getAttribute('data-rule');
        var arr = state.amenities.house_rules;
        var idx = arr.indexOf(r);
        if (c.checked && idx === -1) arr.push(r);
        if (!c.checked && idx !== -1) arr.splice(idx, 1);
        saveDraft();
      });
    });
    on(el('am-custom'), 'input', function () { state.amenities.custom_rule = el('am-custom').value; saveDraft(); });
    document.querySelectorAll('[data-cancel]').forEach(function (b) {
      on(b, 'click', function () {
        state.amenities.cancellation = b.getAttribute('data-cancel');
        document.querySelectorAll('[data-cancel]').forEach(function (x) { x.classList.toggle('active', x === b); });
        updCancelDesc();
        saveDraft();
      });
    });
    function updCancelDesc() {
      var desc = { flexible: 'Free cancellation up to 24h before check-in.', moderate: 'Free cancellation up to 5 days before check-in.', strict: 'Free cancellation only within 48h of booking.' };
      el('am-cancel-desc').textContent = desc[state.amenities.cancellation] || '';
    }
    updCancelDesc();
  }
  function validateAmenities() {
    if (state.amenities.selected.length < 4) return 'Pick at least 4 amenities.';
    if (!state.amenities.cancellation)        return 'Pick a cancellation policy.';
    return true;
  }

  // ---------- Step 6: Pricing & calendar ----------
  function renderStepPricing(host) {
    var p = state.pricing;
    var suggest = suggestNightly();
    if (!p.base_nightly) { p.base_nightly = suggest; saveDraft(); }
    host.innerHTML = ''
      + '<h2>Pricing &amp; calendar</h2>'
      + '<p class="v-step-intro">Set your nightly rate. You can always change it later from your host dashboard.</p>'
      + '<div style="display:grid;gap:14px;">'
      +   '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">'
      +     '<label class="v-field"><span>Base nightly (AED) <span class="v-text-muted" style="font-weight:400;">· suggested: ' + fmt(suggest) + '</span></span><input class="v-input" id="pc-night" type="number" min="100" max="20000" value="' + p.base_nightly + '" /></label>'
      +     '<label class="v-field"><span>Cleaning fee (AED)</span><input class="v-input" id="pc-clean" type="number" min="0" max="5000" value="' + p.cleaning_fee + '" /></label>'
      +   '</div>'
      +   '<label class="v-field"><span>Weekend surcharge: <strong id="pc-wkpct-val">' + p.weekend_surcharge_pct + '%</strong></span><input id="pc-wkpct" type="range" min="0" max="50" step="5" value="' + p.weekend_surcharge_pct + '" /></label>'
      +   '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;">'
      +     '<label class="v-field"><span>Min nights</span><input class="v-input" id="pc-min" type="number" min="1" max="30" value="' + p.min_nights + '" /></label>'
      +     '<label class="v-field"><span>Max nights</span><input class="v-input" id="pc-max" type="number" min="1" max="365" value="' + p.max_nights + '" /></label>'
      +     '<label class="v-field"><span>Advance notice</span><select class="v-select" id="pc-adv">'
      +       [['same-day','Same day OK'],['1-day','At least 1 day'],['2-days','At least 2 days'],['7-days','At least 7 days']].map(function (o) {
                return '<option value="' + o[0] + '" ' + (p.advance_notice === o[0] ? 'selected' : '') + '>' + o[1] + '</option>';
              }).join('')
      +     '</select></label>'
      +   '</div>'
      +   '<label class="v-check"><input type="checkbox" id="pc-instant" ' + (p.instant_book ? 'checked' : '') + '> <span><strong>Instant Book</strong> — let guests book without your approval. Strongly recommended for higher placement.</span></label>'
      + '</div>'
      + '<div style="margin-top:24px;">'
      +   '<strong>Block dates</strong>'
      +   '<p class="v-text-muted" style="font-size:13px;">Dates when your home is not available. You can adjust this anytime from the host dashboard.</p>'
      +   '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px;">'
      +     '<input class="v-input" id="pc-block-date" type="date" min="' + VacationApp.ymd(new Date()) + '" style="max-width:200px;" />'
      +     '<button class="v-btn v-btn--ghost v-btn--sm" id="pc-block-add">+ Add</button>'
      +   '</div>'
      +   '<div id="pc-block-list" style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px;"></div>'
      + '</div>';
    on(el('pc-night'), 'input', function () { state.pricing.base_nightly = Number(el('pc-night').value); saveDraft(); });
    on(el('pc-clean'), 'input', function () { state.pricing.cleaning_fee = Number(el('pc-clean').value); saveDraft(); });
    on(el('pc-min'), 'input', function () { state.pricing.min_nights = Number(el('pc-min').value); saveDraft(); });
    on(el('pc-max'), 'input', function () { state.pricing.max_nights = Number(el('pc-max').value); saveDraft(); });
    on(el('pc-adv'), 'change', function () { state.pricing.advance_notice = el('pc-adv').value; saveDraft(); });
    on(el('pc-instant'), 'change', function () { state.pricing.instant_book = el('pc-instant').checked; saveDraft(); });
    on(el('pc-wkpct'), 'input', function () {
      state.pricing.weekend_surcharge_pct = Number(el('pc-wkpct').value);
      el('pc-wkpct-val').textContent = state.pricing.weekend_surcharge_pct + '%';
      saveDraft();
    });
    function refreshBlocked() {
      el('pc-block-list').innerHTML = state.pricing.blocked_dates.length
        ? state.pricing.blocked_dates.map(function (d, i) { return '<span class="v-chip" style="background:var(--vacation-bg-2);">' + esc(d) + ' <button class="v-photo-strip-remove" data-rm-block="' + i + '" style="position:static;width:16px;height:16px;font-size:11px;margin-inline-start:6px;">×</button></span>'; }).join('')
        : '<span class="v-text-muted" style="font-size:13px;">No blocked dates yet.</span>';
      document.querySelectorAll('[data-rm-block]').forEach(function (b) {
        on(b, 'click', function () { state.pricing.blocked_dates.splice(Number(b.getAttribute('data-rm-block')), 1); saveDraft(); refreshBlocked(); });
      });
    }
    on(el('pc-block-add'), 'click', function () {
      var v = el('pc-block-date').value;
      if (!v) return;
      if (state.pricing.blocked_dates.indexOf(v) === -1) state.pricing.blocked_dates.push(v);
      state.pricing.blocked_dates.sort();
      el('pc-block-date').value = '';
      saveDraft();
      refreshBlocked();
    });
    refreshBlocked();
  }
  function suggestNightly() {
    var dest = D.DESTINATIONS.find(function (d) { return d.id === state.property.destination_id; }) || D.DESTINATIONS[0];
    var typeMult = { apartment: 0.85, villa: 1.35, townhouse: 1.05, penthouse: 1.5, cabin: 0.95, glamping: 1.1 }[state.property.type] || 1;
    var brMult = 0.65 + state.property.bedrooms * 0.18;
    return Math.round(dest.avg_nightly * typeMult * brMult);
  }
  function validatePricing() {
    var p = state.pricing;
    if (p.base_nightly < 100)         return 'Nightly rate must be at least AED 100.';
    if (p.cleaning_fee < 0)           return 'Cleaning fee can\'t be negative.';
    if (p.min_nights < 1)             return 'Minimum nights must be at least 1.';
    if (p.max_nights < p.min_nights)  return 'Max nights must be greater than or equal to min nights.';
    return true;
  }

  // ---------- Step 7: Review ----------
  function renderStepReview(host) {
    var p = state.property; var ph = state.photos; var a = state.amenities; var pc = state.pricing;
    var docCount = Object.keys(state.verification.documents).length;
    function summary(title, body, step) {
      return '<div class="v-panel" style="padding:14px 16px;margin-bottom:12px;">'
        +    '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;"><strong>' + esc(title) + '</strong><button class="v-btn v-btn--ghost v-btn--sm" data-jump="' + step + '">Edit</button></div>'
        +    '<div style="margin-top:6px;font-size:13.5px;color:var(--vacation-ink-2);">' + body + '</div>'
        +    '</div>';
    }
    host.innerHTML = ''
      + '<h2>Review &amp; submit</h2>'
      + '<p class="v-step-intro">Everything look right? Once you submit, our team will review your documents and listing within 24 hours.</p>'
      + summary('About you', esc(state.profile.name) + ' · ' + esc(state.profile.email) + ' · ' + esc(state.profile.phone) + '<br>Languages: ' + esc(state.profile.languages.join(', ')) + '<br>Bio: ' + esc(state.profile.bio).slice(0, 200), 0)
      + summary('Verification', docCount + ' documents uploaded · ' + (state.verification.resident ? 'UAE resident' : 'Non-resident') + ' · ' + (state.verification.ownership_kind === 'own' ? 'Owner' : 'Sublease'), 1)
      + summary('Property', '<strong>' + esc(p.title) + '</strong><br>' + p.type + ' · ' + esc(destLabel(p.destination_id)) + ' · ' + p.bedrooms + 'BR / ' + p.baths + ' bath · sleeps ' + p.max_guests, 2)
      + summary('Photos', ph.list.length + ' photos · ' + (ph.description.length) + ' chars description<br>' + ph.list.slice(0, 4).map(function (u) { return '<img src="' + esc(u) + '" alt="" style="width:60px;height:48px;object-fit:cover;border-radius:4px;margin-inline-end:4px;display:inline-block;">'; }).join(''), 3)
      + summary('Amenities &amp; rules', a.selected.length + ' amenities · ' + a.cancellation + ' cancellation<br>House rules: ' + esc(a.house_rules.join(', ')), 4)
      + summary('Pricing', '<strong>' + fmt(pc.base_nightly) + '/night</strong> · cleaning ' + fmt(pc.cleaning_fee) + ' · weekend +' + pc.weekend_surcharge_pct + '%<br>' + (pc.instant_book ? '⚡ Instant book ON' : '👋 Manual approval') + ' · min ' + pc.min_nights + 'n / max ' + pc.max_nights + 'n · ' + pc.blocked_dates.length + ' blocked dates', 5)
      + '<label class="v-check" style="margin-top:18px;display:flex;align-items:flex-start;gap:8px;"><input type="checkbox" id="rv-confirm" ' + (state.confirmed ? 'checked' : '') + '> <span>I confirm everything I\'ve entered is accurate. I understand my listing won\'t go live until our team approves my documents.</span></label>';
    document.querySelectorAll('[data-jump]').forEach(function (b) {
      on(b, 'click', function () { state.step = Number(b.getAttribute('data-jump')); saveDraft(); render(); });
    });
    on(el('rv-confirm'), 'change', function () { state.confirmed = el('rv-confirm').checked; saveDraft(); renderFooter(); });
  }

  // ---------- Success screen ----------
  function renderSuccess(host, ref) {
    host.innerHTML = ''
      + '<div class="v-empty-illustration">'
      +   '<div class="v-empty-illustration-mark">🎉</div>'
      +   '<h2>Listing submitted!</h2>'
      +   '<p>Your reference is <strong>' + esc(ref) + '</strong>. Our team will review your documents and listing within 24 hours.</p>'
      +   '<p>You\'ll get an email and a notification in your host dashboard the moment it goes live.</p>'
      +   '<div style="display:flex;gap:10px;justify-content:center;margin-top:18px;flex-wrap:wrap;">'
      +     '<a class="v-btn v-btn--primary" href="host-dashboard.html">Open host dashboard</a>'
      +     '<a class="v-btn v-btn--ghost" href="index.html">Back to home</a>'
      +   '</div>'
      + '</div>';
    // Hide footer on success.
    var foot = document.querySelector('.v-wizard-foot');
    if (foot) foot.style.display = 'none';
  }

  // ---------- Stepper / footer / nav ----------
  function renderStepper() {
    var host = el('wz-stepper');
    host.innerHTML = STEPS.map(function (s, i) {
      var cls = i < state.step ? 'is-done' : (i === state.step ? 'is-active' : '');
      return '<div class="v-step ' + cls + '"><div class="v-step-circle"><span class="v-step-num">' + (i + 1) + '</span></div><div class="v-step-label">' + esc(s.label) + '</div></div>';
    }).join('');
  }
  function renderFooter() {
    var pct = ((state.step + 1) / STEPS.length) * 100;
    el('wz-bar').style.width = pct + '%';
    el('wz-back').disabled = state.step === 0;
    el('wz-back').style.visibility = state.step === 0 ? 'hidden' : 'visible';
    var next = el('wz-next');
    if (state.step === STEPS.length - 1) {
      next.textContent = state.confirmed ? 'Submit listing for review' : 'Submit (confirm first)';
      next.disabled = !state.confirmed;
    } else {
      next.textContent = 'Continue →';
      next.disabled = false;
    }
  }
  function goNext() {
    var v = STEPS[state.step].validate();
    if (v !== true) { window.toast && window.toast(v, 'warn', 3000); return; }
    if (state.step === STEPS.length - 1) return submit();
    state.step++;
    saveDraft();
    render();
  }
  function goBack() {
    if (state.step === 0) return;
    state.step--;
    saveDraft();
    render();
  }
  function saveAndExit() {
    saveDraft();
    window.toast && window.toast('Draft saved. You can resume anytime.', 'success', 2000);
    setTimeout(function () { window.location.href = 'host.html'; }, 700);
  }

  function submit() {
    var savedSubmit = el('wz-next');
    if (savedSubmit) { savedSubmit.disabled = true; savedSubmit.textContent = 'Submitting…'; }

    function step1_signup() {
      var sess = getSession();
      if (sess) return Promise.resolve({ ok: true });
      return VacationApp.api('/auth/host-signup', { method: 'POST', body: {
        name: state.profile.name, email: state.profile.email, phone: state.profile.phone,
        languages: state.profile.languages, photo: state.profile.photo, bio: state.profile.bio
      } });
    }
    function step2_application() {
      var docs = Object.keys(state.verification.documents).map(function (k) { return state.verification.documents[k]; });
      return VacationApp.api('/host/applications', { method: 'POST', body: {
        resident: state.verification.resident,
        destination_id: state.property.destination_id,
        ownership_kind: state.verification.ownership_kind,
        documents: docs
      } });
    }
    function step3_listing() {
      return VacationApp.api('/host/listings', { method: 'POST', body: {
        title: state.property.title,
        type: state.property.type,
        destination_id: state.property.destination_id,
        address: state.property.address,
        lat: state.property.lat, lng: state.property.lng,
        bedrooms: state.property.bedrooms, beds: state.property.beds, baths: state.property.baths,
        sqft: state.property.sqft, max_guests: state.property.max_guests,
        photos: state.photos.list,
        description: state.photos.description,
        amenities: state.amenities.selected,
        house_rules: state.amenities.house_rules.concat(state.amenities.custom_rule ? [state.amenities.custom_rule] : []),
        cancellation: state.amenities.cancellation,
        base_nightly_aed: state.pricing.base_nightly,
        cleaning_fee_aed: state.pricing.cleaning_fee,
        weekend_surcharge_pct: state.pricing.weekend_surcharge_pct,
        instant_book: state.pricing.instant_book,
        blocked_dates: state.pricing.blocked_dates,
        min_nights: state.pricing.min_nights, max_nights: state.pricing.max_nights,
        advance_notice: state.pricing.advance_notice
      } });
    }
    step1_signup()
      .then(step2_application)
      .then(step3_listing)
      .then(function (r) {
        var ref = (r && r.body && r.body.listing && r.body.listing.id) || ('L' + Date.now());
        state.submitted_ref = ref;
        clearDraft();
        renderSuccess(el('wz-body'), ref);
      })
      .catch(function (e) {
        console.error(e);
        if (savedSubmit) { savedSubmit.disabled = false; savedSubmit.textContent = 'Submit listing for review'; }
        window.toast && window.toast('Submission failed — please try again.', 'error');
      });
  }

  // ---------- Render orchestration ----------
  function render() {
    renderStepper();
    var step = STEPS[state.step];
    var bodyHost = el('wz-body');
    bodyHost.innerHTML = '<div class="v-wizard-step"></div>';
    step.render(bodyHost.firstChild);
    renderFooter();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------- Edit-mode prefill ----------
  function prefillFromListing(listing) {
    state.property.type = listing.type;
    state.property.title = listing.title;
    state.property.destination_id = listing.destination_id;
    state.property.address = listing.address;
    state.property.lat = listing.lat; state.property.lng = listing.lng;
    state.property.bedrooms = listing.bedrooms; state.property.beds = listing.beds;
    state.property.baths = listing.baths; state.property.sqft = listing.sqft;
    state.property.max_guests = listing.max_guests;
    state.photos.list = listing.photos || [];
    state.photos.description = listing.description || '';
    state.amenities.selected = (listing.amenities || []).slice();
    state.amenities.house_rules = (listing.house_rules || []).slice();
    state.amenities.cancellation = listing.cancellation || 'moderate';
    state.pricing.base_nightly = listing.base_nightly_aed;
    state.pricing.cleaning_fee = listing.cleaning_fee_aed;
    state.pricing.weekend_surcharge_pct = listing.weekend_surcharge_pct || 20;
    state.pricing.instant_book = listing.instant_book;
    state.pricing.blocked_dates = (listing.blocked_dates || []).slice();
  }

  // ---------- Public init ----------
  window.HostOnboard = {
    start: function () {
      var params = new URLSearchParams(window.location.search);
      var mode = params.get('mode') || 'signup';
      var editId = params.get('id');

      var draft = getDraft();
      if (draft) state = Object.assign(defaultState(), draft);
      state.mode = mode;
      state.edit_id = editId || null;

      var session = getSession();
      if (session && mode === 'add-listing') {
        // Skip "About you" since they're already signed up.
        if (state.step === 0) state.step = 1;
      }

      function go() {
        on(el('wz-next'), 'click', goNext);
        on(el('wz-back'), 'click', goBack);
        on(el('wz-save-exit'), 'click', saveAndExit);
        render();
      }

      if (mode === 'edit' && editId) {
        VacationApp.api('/listings/' + editId).then(function (r) {
          if (r.body && r.body.listing) prefillFromListing(r.body.listing);
          state.step = 2; // jump to Property step on edit
          go();
        }).catch(go);
      } else {
        go();
      }
    }
  };
})();
