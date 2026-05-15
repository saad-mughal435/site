/* owner-onboard.js - Manzil 6-step "List your property" wizard.
   Modeled on the Vacation Homes host-onboard pattern. Fields adapted for
   real-estate: title deed instead of nightly pricing, DLD permit, NOC,
   transaction-type branching (buy / rent / off-plan).
   All data persists to localStorage (manzil.owner_draft) so the wizard is
   save-and-resume; demo defaults fill every field so reviewers can click
   straight through. */
(function () {
  'use strict';

  var D = window.MANZIL_DATA;
  var LS_DRAFT = 'manzil.owner_draft';
  var LS_SESSION = 'manzil.owner_session';
  var DUBAI_AREA_PREFIX = 'a-'; // all Manzil seed areas are Dubai

  // ---------- State ----------
  function defaultState() {
    return {
      step: 0, mode: 'signup', edit_id: null, submitted_ref: null,
      profile: {
        name: 'Ahmed Al-Falasi',
        email: 'demo@example.ae',
        phone: '50123456',
        password: '12345678',
        languages: ['English', 'Arabic'],
        photo: '',
        bio: 'UAE resident with a small investment portfolio across Marina, Downtown, and Arabian Ranches. Listing my Marina apartment while I travel.'
      },
      verification: {
        resident: true,
        documents: {
          dld_permit: { type: 'dld_permit', filename: 'DLD-2026-A-018421', status: 'submitted' },
          iban:       { type: 'iban',       filename: 'AE070331234567890123456', status: 'submitted' }
        }
      },
      property: {
        transaction: 'buy',
        type: 'apartment',
        title: 'Marina Promenade - 2BR with full Marina view',
        area_id: 'a-marina',
        address: 'Marina Promenade Tower 3, Dubai Marina',
        lat: 25.0805, lng: 55.1407,
        beds: 2, baths: 3, sqft: 1450,
        year_built: 2020,
        completion_status: 'ready',
        furnished: false
      },
      photos: {
        list: [],
        description: 'Bright corner unit on a high floor with full marina views, recently renovated. Walk to JBR Beach, DMCC metro at the door. Open plan kitchen, ensuite bathrooms, large balcony. Vacant on transfer.'
      },
      amenities: {
        selected: ['m-pool','m-gym','m-parking','m-security','m-balcony','m-marina-v','m-walkable','m-aircon'],
        parking_spots: 1
      },
      pricing: {
        // buy
        price_aed: 2400000,
        previous_price: 2600000,
        commission_pct: 2,
        service_charge_sqft_year: 14,
        // rent (only used if transaction === 'rent')
        annual_rent: 165000,
        cheques: 2,
        deposit_pct: 5,
        contract_months: 12,
        // off-plan
        down_payment_pct: 20,
        handover_date: '2027-06-30',
        payment_plan: '60/40 (during construction / on handover)',
        // common
        available_from: new Date().toISOString().slice(0, 10),
        viewing_by_appointment: true,
        price_negotiable: true
      },
      confirmed: false
    };
  }
  function getDraft() { try { return JSON.parse(localStorage.getItem(LS_DRAFT)); } catch (e) { return null; } }
  function saveDraft() { localStorage.setItem(LS_DRAFT, JSON.stringify(state)); }
  function clearDraft() { localStorage.removeItem(LS_DRAFT); }
  function getSession() { try { return JSON.parse(localStorage.getItem(LS_SESSION)); } catch (e) { return null; } }

  function fillDemoData() {
    var fresh = defaultState();
    fresh.step = state.step;
    fresh.photos.list = [D.PHOTO_POOL[3], D.PHOTO_POOL[7], D.PHOTO_POOL[12], D.PHOTO_POOL[24]];
    fresh.confirmed = true;
    state = fresh; saveDraft(); render();
    window.toast && window.toast('Filled with demo data - just click Continue through to submit.', 'success', 2400);
  }
  function hydrateMissing() {
    var demo = defaultState();
    if (!state.profile) state.profile = {};
    ['name','email','phone','password','bio','photo'].forEach(function (k) { if (!state.profile[k]) state.profile[k] = demo.profile[k]; });
    if (!state.profile.languages || !state.profile.languages.length) state.profile.languages = demo.profile.languages.slice();
    if (!state.verification) state.verification = demo.verification;
    if (!state.verification.documents) state.verification.documents = {};
    if (!state.verification.documents.iban)       state.verification.documents.iban = demo.verification.documents.iban;
    if (!state.verification.documents.dld_permit) state.verification.documents.dld_permit = demo.verification.documents.dld_permit;
    if (!state.property) state.property = demo.property;
    ['transaction','type','title','area_id','address','completion_status'].forEach(function (k) { if (!state.property[k]) state.property[k] = demo.property[k]; });
    ['lat','lng','beds','baths','sqft','year_built'].forEach(function (k) { if (state.property[k] == null) state.property[k] = demo.property[k]; });
    if (!state.photos) state.photos = demo.photos;
    if (!state.photos.list || !state.photos.list.length) state.photos.list = [D.PHOTO_POOL[3], D.PHOTO_POOL[7], D.PHOTO_POOL[12], D.PHOTO_POOL[24]];
    if (!state.photos.description) state.photos.description = demo.photos.description;
    if (!state.amenities) state.amenities = demo.amenities;
    if (!state.amenities.selected || !state.amenities.selected.length) state.amenities.selected = demo.amenities.selected.slice();
    if (!state.pricing) state.pricing = demo.pricing;
    if (!state.pricing.price_aed)    state.pricing.price_aed = demo.pricing.price_aed;
    if (!state.pricing.commission_pct) state.pricing.commission_pct = demo.pricing.commission_pct;
    state.confirmed = true;
    saveDraft();
  }

  var state = defaultState();
  var leafletLoaded = false, mapInstance = null, mapMarker = null;

  // ---------- Steps ----------
  var STEPS = [
    { id: 'about',        label: 'About you',            render: renderAbout,        validate: function(){return true;} },
    { id: 'verification', label: 'Verification',         render: renderVerification, validate: function(){return true;} },
    { id: 'property',     label: 'Property',             render: renderProperty,     validate: function(){return true;} },
    { id: 'photos',       label: 'Photos & description', render: renderPhotos,       validate: function(){return true;} },
    { id: 'amenities',    label: 'Amenities & features', render: renderAmenities,    validate: function(){return true;} },
    { id: 'pricing',      label: 'Pricing & terms',      render: renderPricing,      validate: function(){return true;} },
    { id: 'review',       label: 'Review',               render: renderReview,       validate: function(){ return state.confirmed; } }
  ];

  // ---------- Helpers ----------
  function el(id) { return document.getElementById(id); }
  function esc(s) { return ManzilApp.escapeHtml(String(s == null ? '' : s)); }
  function fmt(n) { return 'AED ' + Math.round(n || 0).toLocaleString(); }
  function on(node, ev, fn) { if (node) node.addEventListener(ev, fn); }
  function readFileAsBase64(file, cb) {
    if (!file) return cb(null);
    if (!/^image\//.test(file.type)) return cb({ filename: file.name, mime: file.type || 'application/pdf', thumb: null });
    var fr = new FileReader();
    fr.onload = function () { cb({ filename: file.name, mime: file.type, thumb: fr.result }); };
    fr.readAsDataURL(file);
  }
  function areaLabel(id) { var a = (D.AREAS || []).find(function (x) { return x.id === id; }); return a ? a.name : id; }

  // ---------- Step 1: About you ----------
  function renderAbout(host) {
    host.innerHTML = ''
      + '<h2>Tell us about you</h2>'
      + '<p class="m-step-intro">Your name, contact, and a short bio. Buyers and renters see this when they enquire on your property.</p>'
      + '<div style="display:grid;gap:14px;">'
      +   '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">'
      +     '<label class="m-field"><span>Full name</span><input class="m-input" id="p-name" value="' + esc(state.profile.name) + '"/></label>'
      +     '<label class="m-field"><span>Email</span><input class="m-input" id="p-email" type="email" value="' + esc(state.profile.email) + '"/></label>'
      +   '</div>'
      +   '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">'
      +     '<label class="m-field"><span>Mobile</span><input class="m-input" id="p-phone" value="' + esc(state.profile.phone) + '" placeholder="8 digits, any format works"/></label>'
      +     '<label class="m-field"><span>Password</span><input class="m-input" id="p-password" type="password" value="' + esc(state.profile.password) + '" placeholder="12345678 works for the demo"/></label>'
      +   '</div>'
      +   '<label class="m-field"><span>Short bio</span><textarea class="m-textarea" id="p-bio" rows="4">' + esc(state.profile.bio) + '</textarea></label>'
      + '</div>';
    on(el('p-name'), 'input', function () { state.profile.name = el('p-name').value; saveDraft(); });
    on(el('p-email'), 'input', function () { state.profile.email = el('p-email').value; saveDraft(); });
    on(el('p-phone'), 'input', function () { state.profile.phone = el('p-phone').value; saveDraft(); });
    on(el('p-password'), 'input', function () { state.profile.password = el('p-password').value; saveDraft(); });
    on(el('p-bio'), 'input', function () { state.profile.bio = el('p-bio').value; saveDraft(); });
  }

  // ---------- Step 2: Verification ----------
  function renderVerification(host) {
    var docs = D.DOCUMENT_TYPES;
    var resident = state.verification.resident;
    var isOffPlanOrRent = (state.property.completion_status === 'off-plan') || (state.property.transaction === 'rent');
    function visible(doc) {
      if (doc.required === 'non_resident')       return !resident;
      if (doc.required === 'off_plan_or_rental') return isOffPlanOrRent;
      return true;
    }
    host.innerHTML = ''
      + '<h2>Verify your identity &amp; ownership</h2>'
      + '<p class="m-step-intro">Upload as many documents as you have on hand. For this demo none are required - just click Continue to skip ahead. In the live product our team reviews everything manually within 24-48 hours; your listing stays off-market until verification clears.</p>'
      + '<div class="m-panel" style="padding:16px;margin-bottom:14px;background:white;border:1px solid var(--manzil-line);border-radius:10px;">'
      +   '<strong>Are you a UAE resident?</strong>'
      +   '<div class="m-pills" style="margin-top:10px;">'
      +     '<button type="button" class="m-pill ' + (resident ? 'active' : '') + '" data-res="1">Yes - Emirates ID only</button>'
      +     '<button type="button" class="m-pill ' + (!resident ? 'active' : '') + '" data-res="0">No - passport required</button>'
      +   '</div>'
      + '</div>'
      + '<div class="m-doc-grid">' + docs.filter(visible).map(renderDocCard).join('') + '</div>';
    document.querySelectorAll('[data-res]').forEach(function (b) {
      on(b, 'click', function () { state.verification.resident = b.getAttribute('data-res') === '1'; saveDraft(); render(); });
    });
    document.querySelectorAll('[data-doc-input]').forEach(function (input) {
      on(input, 'change', function (ev) {
        var type = input.getAttribute('data-doc-input');
        var file = ev.target.files && ev.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) return window.toast && window.toast('File too large - max 5MB','warn');
        readFileAsBase64(file, function (doc) {
          if (!doc) return;
          state.verification.documents[type] = Object.assign({ type: type, status: 'submitted' }, doc);
          saveDraft(); render();
        });
      });
    });
    document.querySelectorAll('[data-doc-remove]').forEach(function (b) {
      on(b, 'click', function () { delete state.verification.documents[b.getAttribute('data-doc-remove')]; saveDraft(); render(); });
    });
    var dldInput = el('doc-dld');
    if (dldInput) on(dldInput, 'input', function () {
      state.verification.documents.dld_permit = { type: 'dld_permit', filename: dldInput.value.trim(), status: 'submitted' };
      saveDraft();
    });
    var ibanInput = el('doc-iban');
    if (ibanInput) on(ibanInput, 'input', function () {
      state.verification.documents.iban = { type: 'iban', filename: ibanInput.value.toUpperCase().replace(/\s/g, ''), status: 'submitted' };
      saveDraft();
    });
  }
  function renderDocCard(doc) {
    if (doc.id === 'iban' || doc.id === 'dld_permit') {
      var saved = state.verification.documents[doc.id];
      var val = (saved && saved.filename) || '';
      var elId = doc.id === 'iban' ? 'doc-iban' : 'doc-dld';
      return ''
        + '<div class="m-doc-card' + (val ? ' has-file' : '') + (doc.id === 'iban' ? '" style="grid-column:1/-1;"' : '"') + '>'
        +   '<div class="m-doc-head"><div class="m-doc-icon">' + doc.icon + '</div>'
        +     '<div class="m-doc-title">' + esc(doc.label) + '</div>'
        +     '<span class="m-doc-required">Required</span>'
        +   '</div>'
        +   '<div class="m-doc-tooltip">' + esc(doc.tooltip) + '</div>'
        +   '<input class="m-input" id="' + elId + '" placeholder="' + (doc.id === 'iban' ? 'AE07 0331 2345 6789 0123 456' : 'DLD-XXXX-XXXXX') + '" value="' + esc(val) + '" />'
        + '</div>';
    }
    var savedD = state.verification.documents[doc.id];
    var rlabel = doc.required === 'always' ? 'Required' : (doc.required === 'non_resident' ? 'Required (non-resident)' : doc.required === 'off_plan_or_rental' ? 'Required (off-plan/rental)' : 'Optional');
    return ''
      + '<div class="m-doc-card' + (savedD ? ' has-file' : '') + '">'
      +   '<div class="m-doc-head"><div class="m-doc-icon">' + doc.icon + '</div>'
      +     '<div class="m-doc-title">' + esc(doc.label) + '</div>'
      +     '<span class="m-doc-required">' + rlabel + '</span>'
      +   '</div>'
      +   '<div class="m-doc-tooltip">' + esc(doc.tooltip) + '</div>'
      +   (savedD
          ? '<div class="m-doc-preview"><div class="m-doc-thumb">' + (savedD.thumb ? '<img src="' + savedD.thumb + '">' : '<span class="m-doc-thumb-fallback">📄</span>') + '</div>'
            + '<div class="m-doc-meta"><div class="m-doc-meta-name">' + esc(savedD.filename) + '</div><div class="m-doc-meta-status">Uploaded · awaiting review</div></div>'
            + '<div class="m-doc-actions"><button class="m-btn m-btn--ghost m-btn--sm" data-doc-remove="' + doc.id + '">Remove</button></div></div>'
            + '<label class="m-btn m-btn--ghost m-btn--sm" style="position:relative;overflow:hidden;align-self:flex-start;">Replace<input type="file" accept="image/*,application/pdf" data-doc-input="' + doc.id + '" style="position:absolute;inset:0;opacity:0;cursor:pointer;"/></label>'
          : '<div class="m-doc-drop"><input type="file" accept="image/*,application/pdf" data-doc-input="' + doc.id + '"/><div class="m-doc-drop-text"><strong>Click to upload</strong> or drag a file<br><span style="font-size:11px;">PNG, JPG, PDF · max 5MB</span></div></div>'
          )
      + '</div>';
  }

  // ---------- Step 3: Property basics ----------
  function renderProperty(host) {
    var p = state.property;
    host.innerHTML = ''
      + '<h2>The property</h2>'
      + '<p class="m-step-intro">Basic facts. Buyers and renters filter on these.</p>'
      + '<div style="display:grid;gap:14px;">'
      +   '<div>'
      +     '<label class="m-field"><span>Transaction</span></label>'
      +     '<div class="m-pills">'
      +       [['buy','Buy'],['rent','Rent'],['off-plan','Off-plan']].map(function (t) {
              return '<button type="button" class="m-pill ' + (p.transaction === t[0] ? 'active' : '') + '" data-tx="' + t[0] + '">' + t[1] + '</button>';
            }).join('')
      +     '</div>'
      +   '</div>'
      +   '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">'
      +     '<label class="m-field"><span>Property type</span><select class="m-select" id="pr-type">'
      +       ['apartment','villa','townhouse','penthouse','studio','office'].map(function (t) { return '<option value="' + t + '" ' + (p.type === t ? 'selected' : '') + '>' + t.charAt(0).toUpperCase() + t.slice(1) + '</option>'; }).join('')
      +     '</select></label>'
      +     '<label class="m-field"><span>Community / area</span><select class="m-select" id="pr-area">'
      +       (D.AREAS || []).map(function (a) { return '<option value="' + a.id + '" ' + (p.area_id === a.id ? 'selected' : '') + '>' + esc(a.name) + '</option>'; }).join('')
      +     '</select></label>'
      +   '</div>'
      +   '<label class="m-field"><span>Listing title</span><input class="m-input" id="pr-title" maxlength="80" value="' + esc(p.title) + '"/></label>'
      +   '<label class="m-field"><span>Address line</span><input class="m-input" id="pr-addr" value="' + esc(p.address) + '"/></label>'
      +   '<div>'
      +     '<label class="m-field"><span>Drop pin where the property is</span></label>'
      +     '<div id="pr-map" class="m-map-pin"></div>'
      +     '<div class="m-map-pin-hint">Click anywhere on the map to set the location. Approximate is fine.</div>'
      +   '</div>'
      +   '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:14px;">'
      +     '<label class="m-field"><span>Beds</span><input class="m-input" id="pr-beds" type="number" min="0" max="20" value="' + p.beds + '"/></label>'
      +     '<label class="m-field"><span>Baths</span><input class="m-input" id="pr-baths" type="number" min="1" max="20" value="' + p.baths + '"/></label>'
      +     '<label class="m-field"><span>Size (sqft)</span><input class="m-input" id="pr-sqft" type="number" min="200" max="50000" value="' + p.sqft + '"/></label>'
      +     '<label class="m-field"><span>Year built</span><input class="m-input" id="pr-year" type="number" min="1970" max="2030" value="' + p.year_built + '"/></label>'
      +   '</div>'
      +   '<div>'
      +     '<label class="m-field"><span>Completion</span></label>'
      +     '<div class="m-pills">'
      +       [['ready','Ready'],['off-plan','Off-plan']].map(function (c) {
              return '<button type="button" class="m-pill ' + (p.completion_status === c[0] ? 'active' : '') + '" data-comp="' + c[0] + '">' + c[1] + '</button>';
            }).join('')
      +     '</div>'
      +   '</div>'
      + '</div>';
    document.querySelectorAll('[data-tx]').forEach(function (b) { on(b, 'click', function () { state.property.transaction = b.getAttribute('data-tx'); saveDraft(); render(); }); });
    document.querySelectorAll('[data-comp]').forEach(function (b) { on(b, 'click', function () { state.property.completion_status = b.getAttribute('data-comp'); saveDraft(); render(); }); });
    on(el('pr-type'), 'change', function () { state.property.type = el('pr-type').value; saveDraft(); });
    on(el('pr-area'), 'change', function () { state.property.area_id = el('pr-area').value; saveDraft(); centerMap(); });
    on(el('pr-title'), 'input', function () { state.property.title = el('pr-title').value; saveDraft(); });
    on(el('pr-addr'), 'input', function () { state.property.address = el('pr-addr').value; saveDraft(); });
    ['beds','baths','sqft','year'].forEach(function (k) {
      var f = k === 'year' ? 'year_built' : k;
      on(el('pr-' + k), 'input', function () { state.property[f] = Number(el('pr-' + k).value); saveDraft(); });
    });
    mountMap();
  }
  function mountMap() {
    var h = el('pr-map'); if (!h) return;
    function ensureL(cb) {
      if (window.L) return cb();
      if (leafletLoaded) return setTimeout(function () { ensureL(cb); }, 100);
      leafletLoaded = true;
      var link = document.createElement('link');
      link.rel = 'stylesheet'; link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
      var s = document.createElement('script');
      s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; s.onload = cb;
      document.head.appendChild(s);
    }
    ensureL(function () {
      if (!window.L || !h) return;
      var area = (D.AREAS || []).find(function (a) { return a.id === state.property.area_id; }) || (D.AREAS || [])[0] || { lat: 25.2, lng: 55.3 };
      var lat = state.property.lat || area.lat;
      var lng = state.property.lng || area.lng;
      h.innerHTML = '';
      mapInstance = window.L.map(h).setView([lat, lng], 14);
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(mapInstance);
      mapMarker = window.L.marker([lat, lng], { draggable: true }).addTo(mapInstance);
      mapMarker.on('moveend', function () { var p = mapMarker.getLatLng(); state.property.lat = p.lat; state.property.lng = p.lng; saveDraft(); });
      mapInstance.on('click', function (e) { mapMarker.setLatLng(e.latlng); state.property.lat = e.latlng.lat; state.property.lng = e.latlng.lng; saveDraft(); });
      state.property.lat = lat; state.property.lng = lng;
    });
  }
  function centerMap() {
    if (!mapInstance) return;
    var area = (D.AREAS || []).find(function (a) { return a.id === state.property.area_id; }); if (!area) return;
    mapInstance.setView([area.lat, area.lng], 14);
    mapMarker.setLatLng([area.lat, area.lng]);
    state.property.lat = area.lat; state.property.lng = area.lng;
    saveDraft();
  }

  // ---------- Step 4: Photos & description ----------
  function renderPhotos(host) {
    host.innerHTML = ''
      + '<h2>Photos &amp; description</h2>'
      + '<p class="m-step-intro">Up to 10 photos. The first is the cover.</p>'
      + '<div class="m-flex-wrap" style="margin-bottom:14px;display:flex;gap:8px;flex-wrap:wrap;">'
      +   '<label class="m-btn m-btn--ghost m-btn--sm" style="position:relative;overflow:hidden;cursor:pointer;">Upload photos<input id="ph-upload" type="file" accept="image/*" multiple style="position:absolute;inset:0;opacity:0;cursor:pointer;"/></label>'
      +   '<button class="m-btn m-btn--ghost m-btn--sm" id="ph-stock-btn">Use a stock photo</button>'
      + '</div>'
      + '<div class="m-photo-strip" id="ph-strip"></div>'
      + (state.photos.list.length === 0 ? '<div class="m-text-muted" style="font-size:13px;margin-top:8px;">No photos yet. Add at least 3 before submitting.</div>' : '')
      + '<label class="m-field" style="margin-top:24px;"><span>Description</span><textarea class="m-textarea" id="ph-desc" rows="8">' + esc(state.photos.description) + '</textarea></label>';
    refreshStrip();
    on(el('ph-upload'), 'change', function (ev) {
      var files = Array.from(ev.target.files || []);
      files.slice(0, 10 - state.photos.list.length).forEach(function (file) {
        if (!/^image\//.test(file.type)) return;
        var fr = new FileReader();
        fr.onload = function () { state.photos.list.push(fr.result); saveDraft(); refreshStrip(); };
        fr.readAsDataURL(file);
      });
      ev.target.value = '';
    });
    on(el('ph-stock-btn'), 'click', function () {
      var avail = D.PHOTO_POOL.filter(function (u) { return state.photos.list.indexOf(u) === -1; });
      if (!avail.length) return window.toast && window.toast('No more stock photos','warn');
      state.photos.list.push(avail[Math.floor(Math.random() * avail.length)]); saveDraft(); refreshStrip();
    });
    on(el('ph-desc'), 'input', function () { state.photos.description = el('ph-desc').value; saveDraft(); });
  }
  function refreshStrip() {
    var s = el('ph-strip'); if (!s) return;
    s.innerHTML = state.photos.list.map(function (u, i) { return '<div class="m-photo-strip-item ' + (i === 0 ? 'is-cover' : '') + '"><img src="' + esc(u) + '" loading="lazy"><button class="m-photo-strip-remove" data-rm="' + i + '">×</button></div>'; }).join('');
    s.querySelectorAll('[data-rm]').forEach(function (b) { on(b, 'click', function () { state.photos.list.splice(Number(b.getAttribute('data-rm')), 1); saveDraft(); refreshStrip(); }); });
  }

  // ---------- Step 5: Amenities & features ----------
  function renderAmenities(host) {
    var sel = state.amenities.selected;
    var amens = (D.AMENITIES || []);
    host.innerHTML = ''
      + '<h2>Amenities &amp; features</h2>'
      + '<p class="m-step-intro">What does the building / unit have?</p>'
      + '<div class="m-amenity-grid">' + amens.map(function (a) {
          var on_ = sel.indexOf(a.id) !== -1;
          return '<div class="m-amenity-tile ' + (on_ ? 'is-selected' : '') + '" data-amen="' + a.id + '"><span class="m-amenity-tile-icon">' + (a.icon || '✓') + '</span>' + esc(a.label) + '</div>';
        }).join('') + '</div>'
      + '<div style="margin-top:18px;display:grid;grid-template-columns:1fr 1fr;gap:14px;max-width:400px;">'
      +   '<label class="m-field"><span>Parking spots</span><input class="m-input" id="am-park" type="number" min="0" max="10" value="' + (state.amenities.parking_spots || 0) + '"/></label>'
      +   '<label class="m-check" style="display:flex;align-items:center;gap:8px;"><input type="checkbox" id="am-furn" ' + (state.property.furnished ? 'checked' : '') + '> <span>Furnished</span></label>'
      + '</div>';
    document.querySelectorAll('[data-amen]').forEach(function (t) {
      on(t, 'click', function () {
        var a = t.getAttribute('data-amen');
        var idx = sel.indexOf(a);
        if (idx === -1) sel.push(a); else sel.splice(idx, 1);
        t.classList.toggle('is-selected'); saveDraft();
      });
    });
    on(el('am-park'), 'input', function () { state.amenities.parking_spots = Number(el('am-park').value); saveDraft(); });
    on(el('am-furn'), 'change', function () { state.property.furnished = el('am-furn').checked; saveDraft(); });
  }

  // ---------- Step 6: Pricing & terms ----------
  function renderPricing(host) {
    var p = state.pricing; var tx = state.property.transaction;
    var fields = '';
    if (tx === 'buy') {
      fields = ''
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">'
        +   '<label class="m-field"><span>Asking price (AED)</span><input class="m-input" id="pc-price" type="number" min="100000" value="' + p.price_aed + '"/></label>'
        +   '<label class="m-field"><span>Previous price (optional - shows price drop)</span><input class="m-input" id="pc-prev" type="number" value="' + (p.previous_price || '') + '"/></label>'
        +   '<label class="m-field"><span>Commission %</span><input class="m-input" id="pc-comm" type="number" step="0.1" min="0" max="10" value="' + p.commission_pct + '"/></label>'
        +   '<label class="m-field"><span>Service charge (AED / sqft / year)</span><input class="m-input" id="pc-sc" type="number" step="0.1" value="' + p.service_charge_sqft_year + '"/></label>'
        + '</div>';
    } else if (tx === 'rent') {
      fields = ''
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">'
        +   '<label class="m-field"><span>Annual rent (AED)</span><input class="m-input" id="pc-rent" type="number" min="20000" value="' + p.annual_rent + '"/></label>'
        +   '<label class="m-field"><span>Cheques per year</span><select class="m-select" id="pc-cheques">' + [1,2,4,6,12].map(function (c) { return '<option value="' + c + '" ' + (p.cheques === c ? 'selected' : '') + '>' + c + '</option>'; }).join('') + '</select></label>'
        +   '<label class="m-field"><span>Security deposit %</span><input class="m-input" id="pc-dep" type="number" min="0" max="20" value="' + p.deposit_pct + '"/></label>'
        +   '<label class="m-field"><span>Contract length (months)</span><input class="m-input" id="pc-ct" type="number" min="3" max="60" value="' + p.contract_months + '"/></label>'
        + '</div>';
    } else { // off-plan
      fields = ''
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">'
        +   '<label class="m-field"><span>Total price (AED)</span><input class="m-input" id="pc-price" type="number" min="100000" value="' + p.price_aed + '"/></label>'
        +   '<label class="m-field"><span>Down payment %</span><input class="m-input" id="pc-dp" type="number" min="5" max="100" value="' + p.down_payment_pct + '"/></label>'
        +   '<label class="m-field"><span>Handover date</span><input class="m-input" id="pc-ho" type="date" value="' + p.handover_date + '"/></label>'
        +   '<label class="m-field"><span>Payment plan</span><input class="m-input" id="pc-plan" value="' + esc(p.payment_plan) + '" placeholder="e.g. 60/40, 50/50 + 1% monthly"/></label>'
        + '</div>';
    }
    host.innerHTML = ''
      + '<h2>Pricing &amp; terms</h2>'
      + '<p class="m-step-intro">Transaction type: <strong>' + tx + '</strong>. Change in <a href="#" id="pc-back">Property step</a> if needed.</p>'
      + fields
      + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-top:14px;">'
      +   '<label class="m-field"><span>Available from</span><input class="m-input" id="pc-from" type="date" value="' + p.available_from + '"/></label>'
      +   '<label class="m-check" style="display:flex;align-items:center;gap:8px;"><input type="checkbox" id="pc-viewing" ' + (p.viewing_by_appointment ? 'checked' : '') + '> <span>Viewings by appointment</span></label>'
      +   '<label class="m-check" style="display:flex;align-items:center;gap:8px;"><input type="checkbox" id="pc-neg" ' + (p.price_negotiable ? 'checked' : '') + '> <span>Price negotiable</span></label>'
      + '</div>';
    on(el('pc-back'), 'click', function (e) { e.preventDefault(); state.step = 2; saveDraft(); render(); });
    if (tx === 'buy') {
      on(el('pc-price'), 'input', function () { state.pricing.price_aed = Number(el('pc-price').value); saveDraft(); });
      on(el('pc-prev'), 'input', function () { state.pricing.previous_price = Number(el('pc-prev').value) || null; saveDraft(); });
      on(el('pc-comm'), 'input', function () { state.pricing.commission_pct = Number(el('pc-comm').value); saveDraft(); });
      on(el('pc-sc'), 'input', function () { state.pricing.service_charge_sqft_year = Number(el('pc-sc').value); saveDraft(); });
    } else if (tx === 'rent') {
      on(el('pc-rent'), 'input', function () { state.pricing.annual_rent = Number(el('pc-rent').value); saveDraft(); });
      on(el('pc-cheques'), 'change', function () { state.pricing.cheques = Number(el('pc-cheques').value); saveDraft(); });
      on(el('pc-dep'), 'input', function () { state.pricing.deposit_pct = Number(el('pc-dep').value); saveDraft(); });
      on(el('pc-ct'), 'input', function () { state.pricing.contract_months = Number(el('pc-ct').value); saveDraft(); });
    } else {
      on(el('pc-price'), 'input', function () { state.pricing.price_aed = Number(el('pc-price').value); saveDraft(); });
      on(el('pc-dp'), 'input', function () { state.pricing.down_payment_pct = Number(el('pc-dp').value); saveDraft(); });
      on(el('pc-ho'), 'change', function () { state.pricing.handover_date = el('pc-ho').value; saveDraft(); });
      on(el('pc-plan'), 'input', function () { state.pricing.payment_plan = el('pc-plan').value; saveDraft(); });
    }
    on(el('pc-from'), 'change', function () { state.pricing.available_from = el('pc-from').value; saveDraft(); });
    on(el('pc-viewing'), 'change', function () { state.pricing.viewing_by_appointment = el('pc-viewing').checked; saveDraft(); });
    on(el('pc-neg'), 'change', function () { state.pricing.price_negotiable = el('pc-neg').checked; saveDraft(); });
  }

  // ---------- Step 7: Review ----------
  function renderReview(host) {
    var p = state.property; var ph = state.photos; var a = state.amenities; var pc = state.pricing;
    var docCount = Object.keys(state.verification.documents).length;
    function card(title, body, step) {
      return '<div class="m-card" style="padding:14px 16px;margin-bottom:12px;background:white;border:1px solid var(--manzil-line);border-radius:10px;">'
        +    '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;"><strong>' + esc(title) + '</strong><button class="m-btn m-btn--ghost m-btn--sm" data-jump="' + step + '">Edit</button></div>'
        +    '<div style="margin-top:6px;font-size:13.5px;color:var(--manzil-ink-2);">' + body + '</div>'
        +    '</div>';
    }
    var priceLine = (function () {
      if (p.transaction === 'buy')      return '<strong>' + fmt(pc.price_aed) + '</strong> · ' + pc.commission_pct + '% commission';
      if (p.transaction === 'rent')     return '<strong>' + fmt(pc.annual_rent) + '/year</strong> · ' + pc.cheques + ' cheques · ' + pc.contract_months + ' months';
      return '<strong>' + fmt(pc.price_aed) + ' off-plan</strong> · ' + pc.down_payment_pct + '% down · handover ' + pc.handover_date;
    })();
    host.innerHTML = ''
      + '<h2>Review &amp; submit</h2>'
      + '<p class="m-step-intro">Everything look right? Once you submit, our team will review your documents and listing within 24-48 hours.</p>'
      + card('About you',     esc(state.profile.name) + ' · ' + esc(state.profile.email) + ' · ' + esc(state.profile.phone) + '<br>Bio: ' + esc(state.profile.bio).slice(0, 200), 0)
      + card('Verification',  docCount + ' documents uploaded · ' + (state.verification.resident ? 'UAE resident' : 'Non-resident'), 1)
      + card('Property',      '<strong>' + esc(p.title) + '</strong><br>' + p.transaction + ' · ' + p.type + ' · ' + esc(areaLabel(p.area_id)) + ' · ' + p.beds + 'BR / ' + p.baths + ' bath · ' + p.sqft + ' sqft · ' + p.completion_status, 2)
      + card('Photos',        ph.list.length + ' photos · ' + ph.description.length + ' chars description<br>' + ph.list.slice(0, 4).map(function (u) { return '<img src="' + esc(u) + '" style="width:60px;height:48px;object-fit:cover;border-radius:4px;margin-inline-end:4px;display:inline-block;">'; }).join(''), 3)
      + card('Amenities',     a.selected.length + ' amenities · ' + (a.parking_spots || 0) + ' parking spots · ' + (p.furnished ? 'furnished' : 'unfurnished'), 4)
      + card('Pricing',       priceLine + '<br>Available from ' + pc.available_from + ' · ' + (pc.viewing_by_appointment ? 'viewings by appt' : 'open viewings') + ' · ' + (pc.price_negotiable ? 'negotiable' : 'price firm'), 5)
      + '<label class="m-check" style="margin-top:18px;display:flex;align-items:flex-start;gap:8px;"><input type="checkbox" id="rv-confirm" ' + (state.confirmed ? 'checked' : '') + '> <span>I confirm everything is accurate and I have the right to list this property.</span></label>';
    document.querySelectorAll('[data-jump]').forEach(function (b) {
      on(b, 'click', function () { state.step = Number(b.getAttribute('data-jump')); saveDraft(); render(); });
    });
    on(el('rv-confirm'), 'change', function () { state.confirmed = el('rv-confirm').checked; saveDraft(); renderFooter(); });
  }

  // ---------- Success ----------
  function renderSuccess(host, ref) {
    host.innerHTML = ''
      + '<div class="m-empty-illustration">'
      +   '<div class="m-empty-illustration-mark">🎉</div>'
      +   '<h2>Listing submitted!</h2>'
      +   '<p>Your reference is <strong>' + esc(ref) + '</strong>. Our team will review your documents and listing within 24-48 hours.</p>'
      +   '<p>You will get an email and a notification in your owner dashboard the moment it goes live.</p>'
      +   '<div style="display:flex;gap:10px;justify-content:center;margin-top:18px;flex-wrap:wrap;">'
      +     '<a class="m-btn m-btn--primary" href="owner-dashboard.html">Open owner dashboard</a>'
      +     '<a class="m-btn m-btn--ghost" href="index.html">Back to home</a>'
      +   '</div>'
      + '</div>';
    var foot = document.querySelector('.m-wizard-foot');
    if (foot) foot.style.display = 'none';
  }

  // ---------- Stepper / footer / nav ----------
  function renderStepper() {
    el('wz-stepper').innerHTML = STEPS.map(function (s, i) {
      var cls = i < state.step ? 'is-done' : (i === state.step ? 'is-active' : '');
      return '<div class="m-step ' + cls + '"><div class="m-step-circle"><span class="m-step-num">' + (i + 1) + '</span></div><div class="m-step-label">' + esc(s.label) + '</div></div>';
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
    } else { next.textContent = 'Continue →'; next.disabled = false; }
  }
  function goNext() {
    var v = STEPS[state.step].validate();
    if (v !== true) { window.toast && window.toast(v, 'warn', 3000); return; }
    if (state.step === STEPS.length - 1) return submit();
    state.step++; saveDraft(); render();
  }
  function goBack() {
    if (state.step === 0) return;
    state.step--; saveDraft(); render();
  }
  function saveAndExit() {
    saveDraft();
    window.toast && window.toast('Draft saved. You can resume anytime.', 'success', 2000);
    setTimeout(function () { window.location.href = 'index.html'; }, 700);
  }
  function submit() {
    var next = el('wz-next');
    if (next) { next.disabled = true; next.textContent = 'Submitting…'; }
    function step1() {
      if (getSession()) return Promise.resolve({ ok: true });
      return ManzilApp.api('/auth/owner-signup', { method: 'POST', body: {
        name: state.profile.name, email: state.profile.email, phone: state.profile.phone,
        languages: state.profile.languages, photo: state.profile.photo, bio: state.profile.bio
      } });
    }
    function step2() {
      var docs = Object.keys(state.verification.documents).map(function (k) { return state.verification.documents[k]; });
      return ManzilApp.api('/owner/applications', { method: 'POST', body: {
        resident: state.verification.resident, documents: docs
      } });
    }
    function step3() {
      var p = state.property, pc = state.pricing;
      return ManzilApp.api('/owner/listings', { method: 'POST', body: {
        title: p.title,
        transaction: p.transaction,
        type: p.type,
        area_id: p.area_id,
        address: p.address,
        lat: p.lat, lng: p.lng,
        beds: p.beds, baths: p.baths, sqft: p.sqft,
        year_built: p.year_built,
        completion_status: p.completion_status,
        furnished: p.furnished,
        amenities: state.amenities.selected,
        photos: state.photos.list,
        description: state.photos.description,
        price_aed: p.transaction === 'rent' ? pc.annual_rent : pc.price_aed,
        previous_price: pc.previous_price,
        rent_freq: p.transaction === 'rent' ? 'year' : null
      } });
    }
    step1().then(step2).then(step3).then(function (r) {
      var ref = (r && r.body && r.body.listing && r.body.listing.id) || ('L' + Date.now());
      var displayRef = 'MZ-' + new Date().getFullYear() + '-' + ref.replace(/[^A-Z0-9]/gi, '').slice(-5).toUpperCase();
      state.submitted_ref = displayRef;
      clearDraft();
      renderSuccess(el('wz-body'), displayRef);
    }).catch(function (e) {
      console.error(e);
      if (next) { next.disabled = false; next.textContent = 'Submit listing for review'; }
      window.toast && window.toast('Submission failed - please try again.', 'error');
    });
  }

  function render() {
    renderStepper();
    var step = STEPS[state.step];
    var body = el('wz-body');
    body.innerHTML = '<div class="m-wizard-step"></div>';
    step.render(body.firstChild);
    renderFooter();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------- Public init ----------
  window.OwnerOnboard = {
    start: function () {
      var params = new URLSearchParams(window.location.search);
      var mode = params.get('mode') || 'signup';
      var editId = params.get('id');
      var draft = getDraft();
      if (draft) state = Object.assign(defaultState(), draft);
      state.mode = mode; state.edit_id = editId || null;
      var sess = getSession();
      if (sess && mode === 'add-listing' && state.step === 0) state.step = 1;
      hydrateMissing();
      function go() {
        on(el('wz-next'), 'click', goNext);
        on(el('wz-back'), 'click', goBack);
        on(el('wz-save-exit'), 'click', saveAndExit);
        on(el('wz-demo-fill'), 'click', fillDemoData);
        render();
      }
      if (mode === 'edit' && editId) {
        ManzilApp.api('/listings/' + editId).then(function (r) {
          if (r.body && r.body.listing) {
            var l = r.body.listing;
            state.property = Object.assign({}, state.property, l);
            state.photos.list = l.photos || []; state.photos.description = l.description || '';
            state.amenities.selected = (l.amenities || []).slice();
            state.pricing.price_aed = l.price_aed;
            state.step = 2;
          }
          go();
        }).catch(go);
      } else {
        go();
      }
    }
  };
})();
