/* data.js — Vacation Homes seed data
   All listings, hosts, guests, bookings, reviews and prices are fabricated.
   Photos via Unsplash (free to use). */
(function () {
  'use strict';

  function ph(id, w) { return 'https://images.unsplash.com/photo-' + id + '?w=' + (w || 1200) + '&q=80&auto=format'; }

  // Curated Unsplash pool — UAE-vacation-feeling photos.
  var PHOTO_POOL = [
    ph('1582719508461-905c673771fd'),  // poolside villa
    ph('1566073771259-6a8506099945'),  // luxury hotel room
    ph('1611892440504-42a792e24d32'),  // modern apt
    ph('1568084680786-a84f91d1153c'),  // beach villa
    ph('1571055107559-3e67626fa8be'),  // modern villa pool
    ph('1564013799919-ab600027ffc6'),  // apt interior
    ph('1505691938895-1758d7feb511'),  // bedroom luxury
    ph('1582268611958-ebfd161ef9cf'),  // marina night
    ph('1493809842364-78817add7ffb'),  // city apt
    ph('1604014237800-1c9102c219da'),  // dubai marina
    ph('1571939228382-b2f2b585ce15'),  // palm aerial
    ph('1518684079-3c830dcef090'),     // dubai
    ph('1512453979798-5ea266f8880c'),  // burj khalifa
    ph('1560448204-e02f11c3d0e2'),     // interior modern
    ph('1583847268964-b28dc8f51f92'),  // apt 2
    ph('1502672023488-70e25813eb80'),  // luxury home
    ph('1512917774080-9991f1c4c750'),  // villa
    ph('1600585154340-be6161a56a0c'),  // modern interior
    ph('1568605114967-8130f3a36994'),  // villa pool
    ph('1600596542815-ffad4c1539a9'),  // living room
    ph('1600566753190-17f0baa2a6c3'),  // kitchen
    ph('1567496898669-ee935f5f647a'),  // marina view
    ph('1547036967-23d11aacaee0'),     // hatta mountains
    ph('1569088070849-0a4f5067e7fb'),  // ras al khaimah
    ph('1582510003544-4d00b7f74220'),  // desert glamping
    ph('1600573472556-e636c2acda88'),  // interior view
    ph('1559599101-f09722fb4948'),     // luxury villa
    ph('1556909114-f6e7ad7d3136'),     // interior
    ph('1572120360610-d971b9d7767c'),  // home modern
    ph('1600210492486-724fe5c67fb0'),  // bedroom
    ph('1565538810643-b5bdb714032a'),  // bedroom 2
    ph('1631679706909-1844bbd07221'),  // modern bath
    ph('1600494603989-9650cf6dad51'),  // luxury living
    ph('1600607687939-ce8a6c25118c'),  // bath
    ph('1502672260266-1c1ef2d93688'),  // home
    ph('1554995207-c18c203602cb'),     // living luxury
    ph('1559329007-40df8a9345d8'),     // beach house
    ph('1564540583246-934409427776'),  // dubai apt
    ph('1591474200742-8e512e6f98f8'),  // apt interior
    ph('1560185007-cde436f6a4d0')      // luxury home 2
  ];

  function pickPhotos(seed, count) {
    var n = count || (6 + (seed % 3));
    var out = [];
    for (var i = 0; i < n; i++) out.push(PHOTO_POOL[(seed * 7 + i * 11) % PHOTO_POOL.length]);
    return out;
  }

  // ===================== DESTINATIONS =====================
  var DESTINATIONS = [
    { id: 'd-marina',   slug: 'dubai-marina',   name: 'Dubai Marina',     name_ar: 'مرسى دبي',       lat: 25.0805, lng: 55.1407, hero: ph('1604014237800-1c9102c219da', 1600), blurb: 'Waterfront living with high-rise penthouses and beachfront access — perfect for couples and city-loving travellers.', avg_nightly: 850 },
    { id: 'd-downtown', slug: 'downtown',       name: 'Downtown Dubai',   name_ar: 'وسط مدينة دبي', lat: 25.1972, lng: 55.2744, hero: ph('1512453979798-5ea266f8880c', 1600), blurb: 'Burj Khalifa, Dubai Mall and the fountain show on your doorstep. Premium apartments with skyline views.', avg_nightly: 950 },
    { id: 'd-palm',     slug: 'palm-jumeirah',  name: 'Palm Jumeirah',    name_ar: 'نخلة جميرا',     lat: 25.1124, lng: 55.139,  hero: ph('1571939228382-b2f2b585ce15', 1600), blurb: 'Beachfront villas and resort-style apartments on the iconic palm-shaped island. Family-friendly with private beach access.', avg_nightly: 1450 },
    { id: 'd-jbr',      slug: 'jbr',            name: 'JBR',              name_ar: 'جي بي آر',       lat: 25.0769, lng: 55.1340, hero: ph('1567496898669-ee935f5f647a', 1600), blurb: 'Jumeirah Beach Residence — apartments above The Walk with bars, beach clubs and the tram out the front door.', avg_nightly: 780 },
    { id: 'd-business', slug: 'business-bay',   name: 'Business Bay',     name_ar: 'الخليج التجاري', lat: 25.186,  lng: 55.2785, hero: ph('1518684079-3c830dcef090', 1600), blurb: 'Central business district along the Dubai Canal. Modern hotel-style apartments with rooftop pools.', avg_nightly: 620 },
    { id: 'd-rak',      slug: 'rak-beach',      name: 'RAK Beach',        name_ar: 'شاطئ رأس الخيمة',lat: 25.7896, lng: 55.9532, hero: ph('1569088070849-0a4f5067e7fb', 1600), blurb: 'Ras Al Khaimah beachfront villas — quieter than Dubai, with white sand, mangrove kayaking and Jebel Jais mountain access.', avg_nightly: 1100 },
    { id: 'd-hatta',    slug: 'hatta',          name: 'Hatta Mountains',  name_ar: 'حتا',            lat: 24.7956, lng: 56.1218, hero: ph('1547036967-23d11aacaee0', 1600), blurb: 'Mountain cabins and lodges in the Hajar range. Hiking, kayaking on the dam, weekend desert-mountain escapes.', avg_nightly: 540 },
    { id: 'd-corniche', slug: 'ad-corniche',    name: 'AD Corniche',      name_ar: 'كورنيش أبوظبي',  lat: 24.4729, lng: 54.3445, hero: ph('1582268611958-ebfd161ef9cf', 1600), blurb: 'Abu Dhabi Corniche — promenade, beaches and skyline. Family-friendly apartments minutes from Saadiyat and Yas.', avg_nightly: 720 },
    { id: 'd-fuj',      slug: 'fujairah-beach', name: 'Fujairah Beach',   name_ar: 'شاطئ الفجيرة',   lat: 25.1288, lng: 56.3265, hero: ph('1559329007-40df8a9345d8', 1600), blurb: 'East-coast beach villas — diving, snorkelling, the only mountain-meets-sea coast in the UAE.', avg_nightly: 920 },
    { id: 'd-liwa',     slug: 'liwa-desert',    name: 'Liwa Desert',      name_ar: 'صحراء ليوا',     lat: 23.135,  lng: 53.762,  hero: ph('1582510003544-4d00b7f74220', 1600), blurb: 'Desert glamping in the Empty Quarter — massive dunes, sunset camel rides, star-filled skies.', avg_nightly: 1280 }
  ];

  // ===================== AMENITIES =====================
  var AMENITIES = [
    { id: 'wifi',        label: 'Fast WiFi',         label_ar: 'واي فاي سريع',  icon: '📶' },
    { id: 'pool',        label: 'Private pool',      label_ar: 'مسبح خاص',      icon: '🏊' },
    { id: 'pool-shared', label: 'Shared pool',       label_ar: 'مسبح مشترك',    icon: '🏊‍♀️' },
    { id: 'parking',     label: 'Free parking',      label_ar: 'موقف مجاني',    icon: '🅿️' },
    { id: 'ac',          label: 'Central A/C',       label_ar: 'تكييف مركزي',   icon: '❄️' },
    { id: 'kitchen',     label: 'Full kitchen',      label_ar: 'مطبخ كامل',     icon: '🍳' },
    { id: 'washer',      label: 'Washing machine',   label_ar: 'غسالة',         icon: '🧺' },
    { id: 'dryer',       label: 'Dryer',             label_ar: 'مجفف',          icon: '🌀' },
    { id: 'tv',          label: 'Smart TV',          label_ar: 'تلفاز ذكي',     icon: '📺' },
    { id: 'workspace',   label: 'Dedicated workspace', label_ar: 'مكتب عمل',    icon: '💻' },
    { id: 'gym',         label: 'Gym',               label_ar: 'صالة رياضية',   icon: '🏋️' },
    { id: 'bbq',         label: 'BBQ area',          label_ar: 'منطقة شواء',    icon: '🍖' },
    { id: 'beach',       label: 'Beach access',      label_ar: 'وصول للشاطئ',   icon: '🏖️' },
    { id: 'sea-view',    label: 'Sea view',          label_ar: 'إطلالة بحرية',  icon: '🌊' },
    { id: 'burj-view',   label: 'Burj Khalifa view', label_ar: 'إطلالة برج خليفة', icon: '🏙️' },
    { id: 'marina-view', label: 'Marina view',       label_ar: 'إطلالة المرسى', icon: '⛵' },
    { id: 'desert-view', label: 'Desert view',       label_ar: 'إطلالة صحراوية',icon: '🐪' },
    { id: 'mountain-view', label: 'Mountain view',   label_ar: 'إطلالة جبلية',  icon: '⛰️' },
    { id: 'kids',        label: 'Kids friendly',     label_ar: 'مناسب للأطفال', icon: '🧒' },
    { id: 'pets',        label: 'Pets allowed',      label_ar: 'مسموح بالحيوانات', icon: '🐶' },
    { id: 'pool-heated', label: 'Heated pool',       label_ar: 'مسبح مدفأ',     icon: '♨️' },
    { id: 'jacuzzi',     label: 'Jacuzzi',           label_ar: 'جاكوزي',        icon: '🛁' },
    { id: 'fireplace',   label: 'Fireplace',         label_ar: 'مدفأة',         icon: '🔥' },
    { id: 'breakfast',   label: 'Breakfast included',label_ar: 'إفطار مشمول',   icon: '🍳' },
    { id: 'concierge',   label: 'Concierge',         label_ar: 'كونسيرج',       icon: '🛎️' },
    { id: 'self-checkin',label: 'Self check-in',     label_ar: 'تسجيل ذاتي',    icon: '🔑' }
  ];

  // ===================== HOSTS =====================
  function hp(id, w) { return 'https://images.unsplash.com/photo-' + id + '?w=' + (w || 200) + '&q=80&auto=format&fit=crop&crop=faces'; }
  var HOSTS = [
    { id: 'h01', name: 'Sarah Mitchell',    photo: hp('1494790108377-be9c29b29330'), joined: '2023-04', response_rate: 99, response_time_hrs: 1,  languages: ['English','French'],            superhost: true,  bio: 'Marina resident who hosts on weekends. I love showing guests the best brunch spots.', verified_at: '2023-04-18' },
    { id: 'h02', name: 'Mohammed Al-Rashid',photo: hp('1472099645785-5658abf4ff4e'), joined: '2022-08', response_rate: 100,response_time_hrs: 1,  languages: ['Arabic','English'],            superhost: true,  bio: 'Emirati host. Local insider tips guaranteed.', verified_at: '2022-08-05' },
    { id: 'h03', name: 'Olga Volkova',      photo: hp('1438761681033-6461ffad8d80'), joined: '2024-01', response_rate: 96, response_time_hrs: 2,  languages: ['Russian','English'],           superhost: false, bio: 'Manage 4 Marina apartments. Quick replies, fast keys.' },
    { id: 'h04', name: 'James Carter',      photo: hp('1500648767791-00dcc994a43e'), joined: '2021-11', response_rate: 99, response_time_hrs: 1,  languages: ['English'],                     superhost: true,  bio: 'Palm Jumeirah villa specialist. Family weekends are my niche.', verified_at: '2021-11-22' },
    { id: 'h05', name: 'Layla Hammoud',     photo: hp('1573496359142-b8d87734a5a2'), joined: '2023-09', response_rate: 98, response_time_hrs: 1,  languages: ['Arabic','English','French'],   superhost: true,  bio: 'Lebanese-French. I host RAK beach villas. Sunsets are mandatory.' },
    { id: 'h06', name: 'Priya Sharma',      photo: hp('1573496799652-408c2ac9fe98'), joined: '2024-03', response_rate: 94, response_time_hrs: 3,  languages: ['English','Hindi'],             superhost: false, bio: 'Two Downtown apartments. Walking distance to everything.' },
    { id: 'h07', name: 'Charles Thornton',  photo: hp('1519085360753-af0119f7cbe7'), joined: '2020-06', response_rate: 100,response_time_hrs: 1,  languages: ['English'],                     superhost: true,  bio: 'Long-time Palm host. Concierge-level service is the standard.' },
    { id: 'h08', name: 'Hannah Williamson', photo: hp('1502323777036-f29e3972d82f'), joined: '2022-02', response_rate: 99, response_time_hrs: 2,  languages: ['English'],                     superhost: true,  bio: 'Hatta cabin owner. Mountain weekends, full firewood stocked.' },
    { id: 'h09', name: 'Diana Lee',         photo: hp('1438761681033-6461ffad8d80'), joined: '2023-12', response_rate: 95, response_time_hrs: 2,  languages: ['English','Korean'],            superhost: false, bio: 'JBR beach apartments. Korean-speaking welcome.' },
    { id: 'h10', name: 'Khalid Al-Maktoum', photo: hp('1507591064344-4c6ce005b128'), joined: '2021-04', response_rate: 100,response_time_hrs: 1,  languages: ['Arabic','English'],            superhost: true,  bio: 'Emirati. Liwa desert glamping and Hatta lodges.' },
    { id: 'h11', name: 'Anna Petrov',       photo: hp('1487412720507-e7ab37603c6f'), joined: '2024-06', response_rate: 92, response_time_hrs: 4,  languages: ['Russian','English'],           superhost: false, bio: 'Business Bay rentals for travelers and Russian families.' },
    { id: 'h12', name: 'Maria Rodriguez',   photo: hp('1544005313-94ddf0286df2'), joined: '2023-01', response_rate: 98, response_time_hrs: 1,  languages: ['Spanish','English'],           superhost: true,  bio: 'Latin American expat. Fujairah beach villas with snorkeling kits.' },
    { id: 'h13', name: 'Tom Sullivan',      photo: hp('1539571696357-5a69c17a67c6'), joined: '2022-05', response_rate: 97, response_time_hrs: 2,  languages: ['English'],                     superhost: false, bio: 'Marina + JBR portfolio. Pet-friendly options available.' },
    { id: 'h14', name: 'Yara Mansour',      photo: hp('1534528741775-53994a69daeb'), joined: '2021-09', response_rate: 100,response_time_hrs: 1,  languages: ['Arabic','English'],            superhost: true,  bio: 'AD Corniche family apartments. Strollers and kids welcome.' },
    { id: 'h15', name: 'Pierre Dubois',     photo: hp('1492562080023-ab3db95bfbce'), joined: '2023-07', response_rate: 96, response_time_hrs: 2,  languages: ['French','English'],            superhost: false, bio: 'French-speaking host on the Palm.' },
    { id: 'h16', name: 'Aamir Khan',        photo: hp('1507003211169-0a1dd7228f2d'), joined: '2024-02', response_rate: 93, response_time_hrs: 3,  languages: ['English','Urdu','Hindi'],      superhost: false, bio: 'JLT and Business Bay apartments for South-Asian travellers.' },
    { id: 'h17', name: 'Karina Ivanova',    photo: hp('1531123897727-8f129e1688ce'), joined: '2022-11', response_rate: 98, response_time_hrs: 2,  languages: ['Russian','English'],           superhost: true,  bio: 'RAK and Fujairah beach villas. Family-trip specialist.' },
    { id: 'h18', name: 'Daniel Reyes',      photo: hp('1506794778202-cad84cf45f1d'), joined: '2024-08', response_rate: 91, response_time_hrs: 5,  languages: ['English','Tagalog'],           superhost: false, bio: 'New host. Marina studios, fast keys, easy check-ins.' },
    { id: 'h19', name: 'Imran Saleem',      photo: hp('1564564321837-a57b7070ac4f'), joined: '2023-03', response_rate: 99, response_time_hrs: 1,  languages: ['Arabic','English','Urdu'],     superhost: true,  bio: 'Hatta + Liwa specialist. Off-roading and desert dinners arranged.' },
    { id: 'h20', name: 'Hugo Müller',       photo: hp('1492447166138-50c3889fccb1'), joined: '2022-10', response_rate: 96, response_time_hrs: 2,  languages: ['German','English'],            superhost: false, bio: 'German-speaking host on Palm Jumeirah.' },
    { id: 'h21', name: 'Lena Park',         photo: hp('1554151228-14d9def656e4'), joined: '2024-04', response_rate: 90, response_time_hrs: 6,  languages: ['English','Korean'],            superhost: false, bio: 'Downtown apartments — recently launched, eager to please.' },
    { id: 'h22', name: 'Tariq Ahmed',       photo: hp('1500648767791-00dcc994a43e'), joined: '2023-05', response_rate: 97, response_time_hrs: 2,  languages: ['English','Urdu','Arabic'],     superhost: false, bio: 'JBR family apartments + Hatta weekend cabins.' }
  ];

  // ===================== LISTINGS =====================
  // Helper: pick 5-9 amenity ids deterministically.
  function pickAmenities(seed, must) {
    var picks = (must || []).slice();
    var pool = AMENITIES.map(function (a) { return a.id; }).filter(function (id) { return picks.indexOf(id) === -1; });
    var n = 6 + (seed % 4);
    for (var i = 0; i < n; i++) {
      var idx = (seed * 5 + i * 7) % pool.length;
      var pick = pool[idx];
      if (picks.indexOf(pick) === -1) picks.push(pick);
    }
    return picks;
  }

  function genBlockedDates(seed, count) {
    // Generate `count` random future-looking blocked dates (1-90 days out).
    var out = [];
    for (var i = 0; i < count; i++) {
      var days = 1 + ((seed * 3 + i * 17) % 90);
      var d = new Date();
      d.setDate(d.getDate() + days);
      out.push(d.toISOString().slice(0, 10));
    }
    // Sort + dedupe
    return Array.from(new Set(out)).sort();
  }

  var LISTINGS = [];
  function L(spec) {
    var seed = LISTINGS.length + 1;
    var dest = DESTINATIONS.find(function (d) { return d.id === spec.destination_id; }) || DESTINATIONS[0];
    var lat = dest.lat + ((seed * 13) % 100 - 50) / 5000;
    var lng = dest.lng + ((seed * 17) % 100 - 50) / 4000;
    LISTINGS.push({
      id: 'L' + String(seed).padStart(3, '0'),
      slug: spec.slug || ('stay-' + seed),
      title: spec.title,
      title_ar: spec.title_ar || spec.title,
      type: spec.type,
      destination_id: spec.destination_id,
      address: spec.address || dest.name,
      lat: lat, lng: lng,
      max_guests: spec.max_guests,
      bedrooms: spec.bedrooms,
      beds: spec.beds || spec.bedrooms + 1,
      baths: spec.baths || spec.bedrooms,
      sqft: spec.sqft || (spec.bedrooms * 600),
      base_nightly_aed: spec.base_nightly,
      weekend_surcharge_pct: spec.weekend_surcharge_pct || 20,
      cleaning_fee_aed: spec.cleaning_fee || (spec.bedrooms * 80 + 80),
      host_id: spec.host_id,
      amenities: pickAmenities(seed, spec.must_amenities || []),
      photos: pickPhotos(seed),
      description: spec.description,
      blocked_dates: genBlockedDates(seed, 6 + (seed % 8)),
      house_rules: spec.house_rules || ['No smoking indoors','No parties','Check-in 3 PM','Check-out 11 AM'],
      cancellation: spec.cancellation || ['flexible','moderate','strict'][seed % 3],
      instant_book: spec.instant_book !== false,
      rating: 4.4 + ((seed * 7) % 60) / 100,  // 4.40–5.00
      review_count: 8 + (seed * 3) % 120,
      featured: !!spec.featured,
      verified: spec.verified !== false,
      listed_at: new Date(Date.now() - (seed * 7 + 14) * 86400000).toISOString().slice(0, 10),
      status: spec.status || 'live'
    });
  }

  // Dubai Marina
  L({ title: 'Marina Heights — Skyline Penthouse',         destination_id: 'd-marina',   type: 'penthouse', max_guests: 6, bedrooms: 3, baths: 3, base_nightly: 1450, host_id: 'h01', featured: true, must_amenities: ['marina-view','pool-shared','gym','wifi'], description: 'Top-floor 3BR penthouse with 270° marina views, wraparound balcony, shared rooftop pool. Walk to JBR Beach, DMCC metro at the door.' });
  L({ title: 'Princess Tower — 1BR with Sea View',         destination_id: 'd-marina',   type: 'apartment', max_guests: 2, bedrooms: 1, baths: 2, base_nightly: 480, host_id: 'h03', must_amenities: ['sea-view','pool-shared','gym'], description: 'High-floor 1BR with floor-to-ceiling sea view. Tasteful interior, fast WiFi, fully equipped kitchen.' });
  L({ title: 'Marina Walk Loft — Beachfront',              destination_id: 'd-marina',   type: 'apartment', max_guests: 4, bedrooms: 2, baths: 2, base_nightly: 750, host_id: 'h13', must_amenities: ['marina-view','beach','wifi'], description: 'Loft-style 2BR with mezzanine bedroom and direct access to The Walk. Steps from beach + tram.' });
  L({ title: 'Cayan Tower — Twisted-Tower Studio',         destination_id: 'd-marina',   type: 'apartment', max_guests: 2, bedrooms: 0, beds: 1, baths: 1, base_nightly: 380, host_id: 'h18', must_amenities: ['marina-view','self-checkin','wifi'], description: 'Iconic twisted tower. Compact, modern studio. Self check-in via smart lock.' });
  L({ title: 'Marina Gate 2 — Furnished 2BR',              destination_id: 'd-marina',   type: 'apartment', max_guests: 4, bedrooms: 2, baths: 2, base_nightly: 620, host_id: 'h03', must_amenities: ['marina-view','pool-shared','workspace'], description: 'Furnished 2BR with workspace nook, walk-in closets, premium kitchen. Great for remote workers.' });
  L({ title: 'JBR Bahar — 2BR Sea-Facing',                 destination_id: 'd-jbr',      type: 'apartment', max_guests: 4, bedrooms: 2, baths: 2, base_nightly: 720, host_id: 'h09', featured: true, must_amenities: ['sea-view','beach','pool-shared','wifi'], description: 'Direct sea views, walking distance to The Beach mall, JBR tram and JBR cinema. Kids welcome.' });

  // Downtown
  L({ title: 'Burj Vista — 2BR with Burj View',            destination_id: 'd-downtown', type: 'apartment', max_guests: 4, bedrooms: 2, baths: 3, base_nightly: 980, host_id: 'h06', featured: true, must_amenities: ['burj-view','pool-shared','gym','concierge'], description: 'Direct Burj Khalifa view, premium Emaar finishes, hotel-style concierge. 5 min walk to Dubai Mall.' });
  L({ title: 'The Address Sky View — Studio',              destination_id: 'd-downtown', type: 'apartment', max_guests: 2, bedrooms: 0, beds: 1, baths: 1, base_nightly: 720, host_id: 'h21', must_amenities: ['burj-view','pool-shared','gym','concierge'], description: 'Studio with full Burj view. Hotel residence — daily housekeeping option.' });
  L({ title: 'BLVD Heights — 1BR over Burj Park',          destination_id: 'd-downtown', type: 'apartment', max_guests: 2, bedrooms: 1, baths: 2, base_nightly: 540, host_id: 'h06', must_amenities: ['burj-view','pool-shared','workspace'], description: '1BR overlooking Burj Park. Boutique residence, quieter than the boulevard, great for couples.' });
  L({ title: 'Opera District Loft — 1BR',                  destination_id: 'd-downtown', type: 'apartment', max_guests: 2, bedrooms: 1, baths: 1, base_nightly: 420, host_id: 'h21', must_amenities: ['burj-view','wifi'], description: 'Loft-style 1BR in Opera District. Walk to Dubai Opera, Souk Al Bahar.' });

  // Palm Jumeirah
  L({ title: 'Garden Homes — 4BR Beachfront Villa',        destination_id: 'd-palm',     type: 'villa',     max_guests: 10, bedrooms: 4, baths: 5, base_nightly: 2800, host_id: 'h04', featured: true, must_amenities: ['pool','beach','sea-view','bbq','kids'], description: 'Atrium-style 4BR villa with private pool, direct beach access, BBQ on the lawn. Sleeps 10 — perfect for families.' });
  L({ title: 'Signature Villa — Private Beach',            destination_id: 'd-palm',     type: 'villa',     max_guests: 12, bedrooms: 5, baths: 6, base_nightly: 4500, host_id: 'h07', featured: true, must_amenities: ['pool','beach','sea-view','jacuzzi','concierge'], description: 'Frond signature villa, 100ft private beach, indoor pool + outdoor pool, concierge on call.' });
  L({ title: 'Shoreline Apartment — 1BR Beach Club',       destination_id: 'd-palm',     type: 'apartment', max_guests: 2, bedrooms: 1, baths: 2, base_nightly: 650, host_id: 'h15', must_amenities: ['beach','pool-shared','sea-view'], description: '1BR with direct beach club access. Quiet trunk-of-palm location.' });
  L({ title: 'Tiara Residence — 2BR with Sea View',        destination_id: 'd-palm',     type: 'apartment', max_guests: 4, bedrooms: 2, baths: 3, base_nightly: 980, host_id: 'h20', must_amenities: ['sea-view','beach','pool-shared'], description: '2BR on the trunk with full sea view. Beach club included.' });
  L({ title: 'Atlantis Royal — 1BR Residence',             destination_id: 'd-palm',     type: 'apartment', max_guests: 2, bedrooms: 1, baths: 2, base_nightly: 1850, host_id: 'h07', featured: true, must_amenities: ['sea-view','pool-shared','concierge','breakfast'], description: 'Hotel-managed 1BR residence at Atlantis Royal. Full hotel access including waterpark.' });

  // Business Bay
  L({ title: 'Bay\'s Edge — 1BR Canal View',               destination_id: 'd-business', type: 'apartment', max_guests: 2, bedrooms: 1, baths: 2, base_nightly: 420, host_id: 'h11', must_amenities: ['pool-shared','gym','workspace','wifi'], description: '1BR with Dubai Canal view + boardwalk access. Perfect for digital nomads — workspace + fast WiFi.' });
  L({ title: 'Damac Maison — 2BR Hotel Apartment',         destination_id: 'd-business', type: 'apartment', max_guests: 4, bedrooms: 2, baths: 3, base_nightly: 720, host_id: 'h11', must_amenities: ['pool-shared','gym','breakfast','concierge'], description: 'Serviced 2BR — hotel amenities, daily housekeeping option.' });
  L({ title: 'Vera Residences — Studio',                   destination_id: 'd-business', type: 'apartment', max_guests: 2, bedrooms: 0, beds: 1, baths: 1, base_nightly: 320, host_id: 'h16', must_amenities: ['pool-shared','gym','wifi','self-checkin'], description: 'Compact studio, great for solo travellers and couples on a budget.' });
  L({ title: 'Volante Tower — 3BR Family',                 destination_id: 'd-business', type: 'apartment', max_guests: 6, bedrooms: 3, baths: 4, base_nightly: 880, host_id: 'h16', must_amenities: ['pool-shared','gym','kids','workspace'], description: '3BR family apartment with maid\'s room option. Walk to Bay Avenue.' });

  // JBR
  L({ title: 'Sadaf 6 — 2BR Walk Side',                    destination_id: 'd-jbr',      type: 'apartment', max_guests: 4, bedrooms: 2, baths: 3, base_nightly: 680, host_id: 'h22', must_amenities: ['marina-view','pool-shared','beach'], description: '2BR with walk-side views. Renovated last year, new kitchen, fresh interiors.' });
  L({ title: 'Murjan 1 — Studio with Beach Access',        destination_id: 'd-jbr',      type: 'apartment', max_guests: 2, bedrooms: 0, beds: 1, baths: 1, base_nightly: 380, host_id: 'h09', must_amenities: ['beach','sea-view','wifi'], description: 'Studio on the JBR side. Walk to The Beach mall, tram and beach club.' });
  L({ title: 'Rimal 5 — 1BR with Sea View',                destination_id: 'd-jbr',      type: 'apartment', max_guests: 3, bedrooms: 1, baths: 2, base_nightly: 520, host_id: 'h13', must_amenities: ['sea-view','beach','pool-shared'], description: 'Sea view 1BR, top floor, recently refurbished.' });
  L({ title: 'Address Beach Residence — 2BR',              destination_id: 'd-jbr',      type: 'apartment', max_guests: 4, bedrooms: 2, baths: 3, base_nightly: 1850, host_id: 'h22', featured: true, must_amenities: ['sea-view','pool-shared','beach','concierge','gym'], description: '2BR in the famous sky-bridge tower. Infinity pool included.' });

  // RAK Beach
  L({ title: 'Al Hamra Beach Villa — 4BR',                 destination_id: 'd-rak',      type: 'villa',     max_guests: 8, bedrooms: 4, baths: 5, base_nightly: 1850, host_id: 'h05', featured: true, must_amenities: ['pool','beach','sea-view','bbq','kids'], description: 'Al Hamra Village beachfront villa. Private pool, BBQ patio, kids\' play area. Family weekend perfect.' });
  L({ title: 'Marjan Island — Beach Apartment',            destination_id: 'd-rak',      type: 'apartment', max_guests: 4, bedrooms: 2, baths: 2, base_nightly: 720, host_id: 'h17', must_amenities: ['sea-view','beach','pool-shared'], description: '2BR on Marjan Island. Direct beach access, kayak rental at front desk.' });
  L({ title: 'Cove Rotana — 3BR Villa',                    destination_id: 'd-rak',      type: 'villa',     max_guests: 6, bedrooms: 3, baths: 4, base_nightly: 1280, host_id: 'h05', must_amenities: ['pool','beach','sea-view','jacuzzi'], description: 'Hillside 3BR villa with private pool overlooking the cove.' });
  L({ title: 'Jebel Jais Lodge — 2BR Mountain View',       destination_id: 'd-rak',      type: 'cabin',     max_guests: 4, bedrooms: 2, baths: 2, base_nightly: 850, host_id: 'h17', must_amenities: ['mountain-view','fireplace','bbq','wifi'], description: 'Mountain lodge near Jebel Jais — UAE\'s highest peak. Fireplace + BBQ + hiking trails out the door.' });

  // Hatta
  L({ title: 'Hatta Mountain Cabin — 2BR',                 destination_id: 'd-hatta',    type: 'cabin',     max_guests: 4, bedrooms: 2, baths: 2, base_nightly: 580, host_id: 'h08', featured: true, must_amenities: ['mountain-view','fireplace','bbq','kids','wifi'], description: 'Cosy mountain cabin in the Hajars. Wood-fired stove, BBQ patio, dam-kayaking 10 min away.' });
  L({ title: 'Hatta Dome Glamping — 1 Tent',               destination_id: 'd-hatta',    type: 'glamping',  max_guests: 2, bedrooms: 1, baths: 1, base_nightly: 720, host_id: 'h19', must_amenities: ['mountain-view','fireplace','breakfast'], description: 'Geodesic dome with mountain views. Star ceiling at night. Breakfast included.' });
  L({ title: 'Hatta Lodge — 3BR Family Cabin',             destination_id: 'd-hatta',    type: 'cabin',     max_guests: 6, bedrooms: 3, baths: 3, base_nightly: 880, host_id: 'h08', must_amenities: ['mountain-view','pool','fireplace','bbq','kids'], description: '3BR family cabin with small private pool, fire pit, hiking trail access.' });

  // AD Corniche
  L({ title: 'Corniche Tower — 2BR Sea View',              destination_id: 'd-corniche', type: 'apartment', max_guests: 4, bedrooms: 2, baths: 3, base_nightly: 680, host_id: 'h14', must_amenities: ['sea-view','pool-shared','gym','kids'], description: '2BR on the Corniche. Promenade + beach across the road. Family-friendly.' });
  L({ title: 'Etihad Towers — 1BR City View',              destination_id: 'd-corniche', type: 'apartment', max_guests: 2, bedrooms: 1, baths: 2, base_nightly: 580, host_id: 'h14', must_amenities: ['pool-shared','gym','concierge'], description: '1BR in Etihad Towers. Hotel-style amenities, walking distance to Marina Mall.' });
  L({ title: 'Saadiyat Beach — 3BR Villa',                 destination_id: 'd-corniche', type: 'villa',     max_guests: 6, bedrooms: 3, baths: 4, base_nightly: 1450, host_id: 'h14', must_amenities: ['pool','beach','sea-view','bbq','kids'], description: 'Saadiyat Beach villa. Walk to Louvre AD, private pool, BBQ patio.' });
  L({ title: 'Yas Marina — 2BR with Yacht View',           destination_id: 'd-corniche', type: 'apartment', max_guests: 4, bedrooms: 2, baths: 2, base_nightly: 920, host_id: 'h02', must_amenities: ['sea-view','pool-shared','gym'], description: 'Yas Marina view. Walking distance to F1 circuit and Yas Waterworld.' });

  // Fujairah Beach
  L({ title: 'Snoopy Island Villa — 3BR',                  destination_id: 'd-fuj',      type: 'villa',     max_guests: 6, bedrooms: 3, baths: 4, base_nightly: 1180, host_id: 'h12', featured: true, must_amenities: ['pool','beach','sea-view','kids'], description: 'Beachfront 3BR villa near Snoopy Island. Snorkeling kits provided.' });
  L({ title: 'Le Meridien Al Aqah — 2BR',                  destination_id: 'd-fuj',      type: 'apartment', max_guests: 4, bedrooms: 2, baths: 2, base_nightly: 820, host_id: 'h12', must_amenities: ['sea-view','beach','pool-shared'], description: 'Hotel-residence 2BR with east-coast sea view.' });
  L({ title: 'Dibba Mountain View — 2BR Cabin',            destination_id: 'd-fuj',      type: 'cabin',     max_guests: 4, bedrooms: 2, baths: 2, base_nightly: 580, host_id: 'h12', must_amenities: ['mountain-view','sea-view','bbq','fireplace'], description: '2BR cabin in Dibba — mountain on one side, sea on the other. Rare combo.' });

  // Liwa Desert
  L({ title: 'Liwa Dunes Tent — Luxury 1BR Glamp',         destination_id: 'd-liwa',     type: 'glamping',  max_guests: 2, bedrooms: 1, baths: 1, base_nightly: 1450, host_id: 'h10', featured: true, must_amenities: ['desert-view','fireplace','breakfast','jacuzzi'], description: 'Luxury glamping in the Empty Quarter. Outdoor jacuzzi, fire pit, camel-ride add-on.' });
  L({ title: 'Qasr Al Sarab Suite — 1BR',                  destination_id: 'd-liwa',     type: 'apartment', max_guests: 2, bedrooms: 1, baths: 2, base_nightly: 2200, host_id: 'h10', must_amenities: ['desert-view','pool-shared','breakfast','concierge'], description: 'Hotel suite at Qasr Al Sarab. Pool overlooking dunes, full hotel access.' });
  L({ title: 'Liwa Family Camp — 3 Tents',                 destination_id: 'd-liwa',     type: 'glamping',  max_guests: 6, bedrooms: 3, baths: 2, base_nightly: 1850, host_id: 'h19', must_amenities: ['desert-view','fireplace','breakfast','kids','bbq'], description: '3 connected tents around a fire pit. Kids welcome — sand-boarding included.' });

  // More Marina / Palm / Downtown — to round out to 55
  L({ title: 'Trident Grand — 3BR Marina Penthouse',       destination_id: 'd-marina',   type: 'penthouse', max_guests: 6, bedrooms: 3, baths: 4, base_nightly: 1850, host_id: 'h01', must_amenities: ['marina-view','sea-view','pool-shared','gym','concierge'], description: 'Full-floor 3BR penthouse, dual marina + sea views.' });
  L({ title: 'Marina Promenade — 2BR Pool View',           destination_id: 'd-marina',   type: 'apartment', max_guests: 4, bedrooms: 2, baths: 3, base_nightly: 720, host_id: 'h13', must_amenities: ['marina-view','pool-shared'], description: 'Renovated 2BR with pool-deck view, walkable to JBR Beach.' });
  L({ title: 'Forte Tower — 3BR Family Apartment',         destination_id: 'd-downtown', type: 'apartment', max_guests: 6, bedrooms: 3, baths: 4, base_nightly: 1450, host_id: 'h06', must_amenities: ['burj-view','pool-shared','gym','kids'], description: '3BR plus maid\'s, walk to Opera District. Family-friendly.' });
  L({ title: 'DT1 by Ellington — 1BR Boutique',            destination_id: 'd-downtown', type: 'apartment', max_guests: 2, bedrooms: 1, baths: 2, base_nightly: 480, host_id: 'h21', must_amenities: ['pool-shared','workspace','wifi'], description: 'Boutique tower, premium finishes, designer interior.' });
  L({ title: 'Five Palm — Sky Villa',                      destination_id: 'd-palm',     type: 'villa',     max_guests: 8, bedrooms: 4, baths: 5, base_nightly: 3800, host_id: 'h07', must_amenities: ['pool','sea-view','jacuzzi','concierge','breakfast'], description: 'FIVE Palm sky villa with private pool and panoramic Palm views.' });
  L({ title: 'Anantara — 1BR with Lagoon',                 destination_id: 'd-palm',     type: 'apartment', max_guests: 2, bedrooms: 1, baths: 2, base_nightly: 1280, host_id: 'h20', must_amenities: ['beach','pool-shared','sea-view','concierge'], description: '1BR overlooking the Anantara lagoon. Adults preferred.' });
  L({ title: 'Atlantis Residence — 2BR Family',            destination_id: 'd-palm',     type: 'apartment', max_guests: 4, bedrooms: 2, baths: 3, base_nightly: 1650, host_id: 'h15', must_amenities: ['pool-shared','beach','concierge','kids'], description: '2BR residence at Atlantis. Waterpark + Lost Chambers included.' });
  L({ title: 'Sustainable City — 3BR Eco Townhouse',       destination_id: 'd-business', type: 'townhouse', max_guests: 6, bedrooms: 3, baths: 4, base_nightly: 950, host_id: 'h02', must_amenities: ['pool-shared','kids','workspace','wifi','bbq'], description: 'Eco townhouse with solar panels, organic farm next door. Family-friendly.' });
  L({ title: 'Akoya Oxygen — 3BR Villa',                   destination_id: 'd-business', type: 'villa',     max_guests: 6, bedrooms: 3, baths: 4, base_nightly: 1180, host_id: 'h02', must_amenities: ['pool','bbq','kids','wifi'], description: '3BR Akoya villa with private pool and BBQ patio.' });
  L({ title: 'Mina al Arab Lagoon Villa — 4BR',            destination_id: 'd-rak',      type: 'villa',     max_guests: 8, bedrooms: 4, baths: 5, base_nightly: 1680, host_id: 'h17', must_amenities: ['pool','beach','sea-view','bbq','jacuzzi'], description: '4BR lagoon villa with private pool, kayak launch into the lagoon.' });
  L({ title: 'Hatta Wadi Cabin — Small 1BR',               destination_id: 'd-hatta',    type: 'cabin',     max_guests: 2, bedrooms: 1, baths: 1, base_nightly: 420, host_id: 'h19', must_amenities: ['mountain-view','fireplace','wifi'], description: 'Compact 1BR cabin for couples. Fireplace + wadi access.' });
  L({ title: 'Saadiyat Beach Hotel Suite — 1BR',           destination_id: 'd-corniche', type: 'apartment', max_guests: 2, bedrooms: 1, baths: 2, base_nightly: 980, host_id: 'h14', must_amenities: ['beach','pool-shared','breakfast','concierge'], description: '1BR hotel suite on Saadiyat Beach. Breakfast included.' });
  L({ title: 'Yas Acres — 4BR Golf Villa',                 destination_id: 'd-corniche', type: 'villa',     max_guests: 8, bedrooms: 4, baths: 5, base_nightly: 1850, host_id: 'h02', must_amenities: ['pool','bbq','kids','workspace'], description: '4BR family villa on Yas Acres — Yas Mall + F1 circuit minutes away.' });
  L({ title: 'Fujairah Coast Glamp — 2 Tents',             destination_id: 'd-fuj',      type: 'glamping',  max_guests: 4, bedrooms: 2, baths: 2, base_nightly: 720, host_id: 'h12', must_amenities: ['sea-view','beach','fireplace','breakfast'], description: 'Coastal glamping — 2 tents with sea view, breakfast included.' });

  // Listings whose host application is still being reviewed — these stay
  // off the listing-approval queue until the host's identity is verified.
  L({ title: 'Bluewaters — 2BR Ain Dubai View',            destination_id: 'd-marina',   type: 'apartment', max_guests: 4, bedrooms: 2, baths: 2, base_nightly: 980, host_id: 'h18', verified: false, status: 'awaiting_host_verification', must_amenities: ['marina-view','sea-view','pool-shared','gym'], description: 'New listing — 2BR with full Ain Dubai view. Boutique tower, walk to Bluewaters restaurants.' });
  L({ title: 'JBR Rimal 4 — 1BR Newly Renovated',          destination_id: 'd-jbr',      type: 'apartment', max_guests: 2, bedrooms: 1, baths: 1, base_nightly: 540, host_id: 'h09', verified: false, status: 'awaiting_host_verification', must_amenities: ['sea-view','beach','wifi'], description: 'Fresh renovation, new kitchen, sea view from balcony. Two-night minimum.' });
  // Listings whose host IS already verified — these go straight into the
  // listing-approval queue.
  L({ title: 'Hatta Lodge — 3BR with Hot Tub',             destination_id: 'd-hatta',    type: 'cabin',     max_guests: 6, bedrooms: 3, baths: 3, base_nightly: 880, host_id: 'h01', verified: false, status: 'pending_review', must_amenities: ['mountain-view','jacuzzi','fireplace','bbq'], description: 'Mountain lodge with a hot tub on the deck. Sleeps 6.' });

  // ===================== GUESTS =====================
  function guest(id, name, email, joined, locale, currency) {
    return { id: id, name: name, email: email, joined: joined, locale: locale, currency: currency, saved: [], notification_prefs: { email: true, push: true, sms: false } };
  }
  var GUESTS = [
    guest('g01', 'Demo Guest',         'demo@vacationhomes.ae','2025-08-12','en','AED'),
    guest('g02', 'James Anderson',     'james.a@email.com',    '2024-03-05','en','GBP'),
    guest('g03', 'Aisha Al-Mansoori',  'aisha.m@email.com',    '2023-11-22','ar','AED'),
    guest('g04', 'Vikram Patel',       'vikram@email.com',     '2024-06-18','en','AED'),
    guest('g05', 'Sophia Rossi',       'sophia.r@email.com',   '2025-01-09','en','EUR'),
    guest('g06', 'Lucas Wang',         'lwang@email.com',      '2024-09-14','en','USD'),
    guest('g07', 'Hassan Ibrahim',     'hassan@email.com',     '2024-12-01','ar','AED'),
    guest('g08', 'Emily Carter',       'emily.c@email.com',    '2025-04-30','en','GBP'),
    guest('g09', 'Dmitri Sokolov',     'dmitri@email.com',     '2024-02-18','en','USD'),
    guest('g10', 'Mira Choudhury',     'mira.c@email.com',     '2025-06-25','en','AED'),
    guest('g11', 'Khalid Al-Hashimi',  'khalid@email.com',     '2023-08-04','ar','AED'),
    guest('g12', 'Sarah Brown',        'sarah.b@email.com',    '2025-09-11','en','GBP'),
    guest('g13', 'Chen Wei',           'chen.w@email.com',     '2024-11-07','en','USD'),
    guest('g14', 'Fatima El-Sayed',    'fatima@email.com',     '2024-05-20','ar','AED'),
    guest('g15', 'Hugo Müller',        'hugo.m@email.com',     '2025-03-15','en','EUR'),
    guest('g16', 'Yuki Tanaka',        'yuki@email.com',       '2024-07-29','en','USD')
  ];

  // ===================== BOOKINGS =====================
  // Mix of past completed, in-progress, upcoming, cancelled — distributed across listings.
  function isoOffset(days) { var d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); }

  function buildBooking(seed, listingIdx, guestIdx, daysOut, nights, status) {
    var listing = LISTINGS[listingIdx % LISTINGS.length];
    var guest = GUESTS[guestIdx % GUESTS.length];
    var checkIn = isoOffset(daysOut);
    var checkOut = isoOffset(daysOut + nights);
    var nightly = listing.base_nightly_aed;
    var subtotal = nightly * nights;
    var weekendCount = 0; // Approximate — for seed purposes only.
    var weekendSurcharge = Math.round(subtotal * 0.05); // simple proxy
    var cleaning = listing.cleaning_fee_aed;
    var service = Math.round((subtotal + cleaning) * 0.10);
    var vat = Math.round((subtotal + cleaning + service) * 0.05);
    var total = subtotal + cleaning + service + vat;
    return {
      id: 'B' + String(seed).padStart(3, '0'),
      ref_number: 'VH-' + String(2026 * 100000 + seed * 13 + 4271).slice(0, 8),
      listing_id: listing.id, guest_id: guest.id, host_id: listing.host_id,
      check_in: checkIn, check_out: checkOut, nights: nights, guests_count: 2 + (seed % 4),
      status: status,
      pricing: {
        nightly_subtotal: subtotal,
        weekend_surcharge: weekendSurcharge,
        cleaning_fee: cleaning,
        service_fee: service,
        vat: vat,
        total: total
      },
      payment_status: status === 'cancelled' ? 'refunded' : 'paid',
      created_at: isoOffset(-30 - (seed % 60)).slice(0, 10),
      messages: seed % 3 === 0 ? [{ from: 'guest', body: 'Hi, what time is check-in?', when: isoOffset(-3) }, { from: 'host', body: 'Hi! Check-in is 3 PM. Self check-in via smart lock — code will be sent the morning of arrival.', when: isoOffset(-2) }] : []
    };
  }
  var BOOKINGS = [];
  // Past completed — daysOut negative, status completed (15)
  for (var i = 0; i < 15; i++) BOOKINGS.push(buildBooking(BOOKINGS.length + 1, i * 3, i * 2, -(60 - i * 3), 3 + i % 5, 'completed'));
  // In-progress — currently staying (3)
  for (var j = 0; j < 3; j++) BOOKINGS.push(buildBooking(BOOKINGS.length + 1, j * 5 + 2, j + 4, -2 - j, 5 + j, 'in-progress'));
  // Upcoming confirmed (12)
  for (var k = 0; k < 12; k++) BOOKINGS.push(buildBooking(BOOKINGS.length + 1, k * 4 + 1, k + 2, 7 + k * 6, 2 + k % 5, 'confirmed'));
  // Pending payment (3)
  for (var l = 0; l < 3; l++) BOOKINGS.push(buildBooking(BOOKINGS.length + 1, l * 7, l + 7, 30 + l * 14, 4 + l, 'pending'));
  // Cancelled (4)
  for (var m = 0; m < 4; m++) BOOKINGS.push(buildBooking(BOOKINGS.length + 1, m * 6 + 3, m + 9, 15 + m * 10, 3 + m, 'cancelled'));
  // Disputed (1)
  BOOKINGS.push(buildBooking(BOOKINGS.length + 1, 10, 13, -45, 4, 'disputed'));
  // Refunded (4)
  for (var n = 0; n < 4; n++) BOOKINGS.push(buildBooking(BOOKINGS.length + 1, n * 8 + 4, n + 6, -(20 - n), 3, 'refunded'));

  // ===================== REVIEWS =====================
  var REVIEW_BODIES = [
    'Stunning view and spotless. Host was responsive, check-in was a breeze.',
    'Great location, walking distance to everything. Would book again.',
    'Beautiful villa, kids loved the pool. A few maintenance issues but host fixed them fast.',
    'Exactly as pictured. Self-check-in worked perfectly.',
    'WiFi was patchy but otherwise a fantastic stay.',
    'Hidden gem. Quieter than the brochures suggest — perfect for a weekend off.',
    'Spacious, modern, well-equipped. Highly recommended for families.',
    'Host responded within minutes. Felt very welcome.',
    'Loved the rooftop pool and view. AC could be cooler.',
    'Best location on Palm. Beach access was a 30-second walk.'
  ];
  var REVIEW_TITLES = ['Lovely stay','Highly recommend','Great value','Beautiful spot','Amazing host','Will book again','Perfect for couples','Family-friendly','Cosy + clean','Better than photos'];

  var REVIEWS = [];
  BOOKINGS.filter(function (b) { return b.status === 'completed'; }).forEach(function (b, i) {
    // 2-3 reviews per completed booking — small over-representation to bring count to ~80
    var n = 2 + (i % 3);
    for (var r = 0; r < n; r++) {
      var seed = REVIEWS.length + 1;
      var dayOffset = -(60 - (i * 3)) + 3;  // a few days after check-out
      REVIEWS.push({
        id: 'R' + String(seed).padStart(3, '0'),
        booking_id: b.id,
        listing_id: b.listing_id,
        host_id: b.host_id,
        guest_id: b.guest_id,
        rating_overall: 4 + ((seed * 3) % 11) / 10,        // 4.0–5.0
        rating_cleanliness: 4 + ((seed * 7) % 11) / 10,
        rating_communication: 4 + ((seed * 11) % 11) / 10,
        rating_value: 4 + ((seed * 13) % 11) / 10,
        title: REVIEW_TITLES[seed % REVIEW_TITLES.length],
        body: REVIEW_BODIES[seed % REVIEW_BODIES.length],
        date: isoOffset(dayOffset + r * 2)
      });
    }
  });

  // ===================== DOCUMENT TYPES =====================
  // The six identity / ownership / licence documents a host must upload.
  // Admin manually reviews each one in /admin#verifications.
  var DOCUMENT_TYPES = [
    { id: 'emirates_id_front', label: 'Emirates ID — front',           icon: '🪪', required: 'always',        tooltip: 'Front side of your Emirates ID card. Used for identity verification.' },
    { id: 'emirates_id_back',  label: 'Emirates ID — back',            icon: '🪪', required: 'always',        tooltip: 'Back side of your Emirates ID card.' },
    { id: 'passport',          label: 'Passport bio page',             icon: '📘', required: 'non_resident',  tooltip: 'Required only if you are a non-resident owner. Bio-data page only.' },
    { id: 'ownership_doc',     label: 'Title deed or tenancy contract',icon: '📄', required: 'always',        tooltip: 'Mulkiya (title deed) if you own the property, or Ejari (tenancy contract) + landlord permission if you sublease.' },
    { id: 'dtcm_permit',       label: 'DTCM Holiday Homes permit',     icon: '🏛️', required: 'dubai_only',    tooltip: 'Department of Tourism and Commerce Marketing — required for short-term rentals in Dubai.' },
    { id: 'iban',              label: 'Bank IBAN (for payouts)',       icon: '💳', required: 'always',        tooltip: 'UAE bank IBAN format: AE + 21 digits. Stored encrypted in the live product.' }
  ];

  // ===================== HOST APPLICATIONS =====================
  // Seed data so the admin verification queue is non-empty on cold start.
  // Each application has per-document statuses so the admin can approve / reject individual docs.
  function todayMinus(days) { var d = new Date(); d.setDate(d.getDate() - days); return d.toISOString().slice(0, 10); }
  function stockDoc(type, filename) { return { type: type, filename: filename, thumb: PHOTO_POOL[(type.length * 7) % PHOTO_POOL.length], status: 'submitted' }; }

  var HOST_APPLICATIONS = [
    {
      host_id: 'h18',
      submitted_at: todayMinus(2),
      status: 'submitted',
      resident: true,
      destination_id: 'd-marina',
      documents: [
        stockDoc('emirates_id_front', 'eid-front-h18.jpg'),
        stockDoc('emirates_id_back',  'eid-back-h18.jpg'),
        stockDoc('ownership_doc',     'mulkiya-bluewaters.pdf'),
        stockDoc('dtcm_permit',       'dtcm-2026-A-188231.pdf'),
        { type: 'iban', filename: 'AE070331234567890123456', thumb: null, status: 'submitted' }
      ],
      notes_from_admin: ''
    },
    {
      host_id: 'h09',
      submitted_at: todayMinus(5),
      status: 'changes_requested',
      resident: true,
      destination_id: 'd-jbr',
      documents: [
        stockDoc('emirates_id_front', 'eid-front-h09.jpg'),
        Object.assign(stockDoc('emirates_id_back',  'eid-back-h09-blurry.jpg'), { status: 'rejected', rejection_reason: 'Back side is too blurry — please re-upload a clearer photo.' }),
        stockDoc('ownership_doc',     'ejari-rimal4.pdf'),
        stockDoc('dtcm_permit',       'dtcm-2026-B-021984.pdf'),
        { type: 'iban', filename: 'AE140260001234567890145', thumb: null, status: 'approved' }
      ],
      notes_from_admin: 'Re-upload the back side of the Emirates ID — current scan is too low resolution to read.'
    },
    {
      host_id: 'h01',
      submitted_at: todayMinus(60),
      status: 'approved',
      resident: false,
      destination_id: 'd-marina',
      documents: [
        Object.assign(stockDoc('emirates_id_front', 'eid-front-h01.jpg'), { status: 'approved' }),
        Object.assign(stockDoc('emirates_id_back',  'eid-back-h01.jpg'),  { status: 'approved' }),
        Object.assign(stockDoc('passport',          'passport-mitchell.pdf'), { status: 'approved' }),
        Object.assign(stockDoc('ownership_doc',     'mulkiya-marina-heights.pdf'), { status: 'approved' }),
        Object.assign(stockDoc('dtcm_permit',       'dtcm-2025-A-004921.pdf'), { status: 'approved' }),
        { type: 'iban', filename: 'AE070331234567890987654', thumb: null, status: 'approved' }
      ],
      notes_from_admin: 'All documents verified. Welcome to Vacation Homes.'
    },
    {
      host_id: 'h21',
      submitted_at: todayMinus(12),
      status: 'rejected',
      resident: true,
      destination_id: 'd-downtown',
      documents: [
        Object.assign(stockDoc('emirates_id_front', 'eid-front-h21.jpg'), { status: 'approved' }),
        Object.assign(stockDoc('emirates_id_back',  'eid-back-h21.jpg'),  { status: 'approved' }),
        Object.assign(stockDoc('ownership_doc',     'ejari-dt1.pdf'),     { status: 'rejected', rejection_reason: 'Tenancy contract does not include a landlord permission letter for short-term sub-letting.' }),
        Object.assign(stockDoc('dtcm_permit',       'dtcm-expired.pdf'),  { status: 'rejected', rejection_reason: 'Permit expired 4 months ago. Please renew with DTCM before re-applying.' }),
        { type: 'iban', filename: 'AE090331234567890123987', thumb: null, status: 'approved' }
      ],
      notes_from_admin: 'Rejected — please obtain a current DTCM permit and a landlord permission letter, then re-submit a fresh application.'
    },
    {
      host_id: 'h08',
      submitted_at: todayMinus(0),
      status: 'submitted',
      resident: true,
      destination_id: 'd-hatta',
      documents: [
        stockDoc('emirates_id_front', 'eid-front-h08.jpg'),
        stockDoc('emirates_id_back',  'eid-back-h08.jpg'),
        stockDoc('ownership_doc',     'mulkiya-hatta-lodge.pdf'),
        { type: 'iban', filename: 'AE070331234567890456789', thumb: null, status: 'submitted' }
      ],
      notes_from_admin: ''
    }
  ];

  // ===================== CURRENCIES =====================
  var CURRENCIES = [
    { code: 'AED', symbol: 'AED', rate_to_aed: 1 },
    { code: 'USD', symbol: '$',   rate_to_aed: 3.673 },
    { code: 'GBP', symbol: '£',   rate_to_aed: 4.620 },
    { code: 'EUR', symbol: '€',   rate_to_aed: 3.985 }
  ];

  // ===================== I18N =====================
  var I18N = {
    en: {
      'nav.stays': 'Stays', 'nav.destinations': 'Destinations', 'nav.trips': 'My trips', 'nav.host': 'Become a host',
      'search.where': 'Where', 'search.checkin': 'Check in', 'search.checkout': 'Check out', 'search.guests': 'Guests', 'search.cta': 'Search',
      'home.featured': 'Featured stays', 'home.destinations': 'Browse destinations', 'home.recent': 'Recently viewed',
      'reserve.cta': 'Reserve', 'reserve.book': 'Book now',
      'fav.added': 'Saved', 'fav.removed': 'Removed'
    },
    ar: {
      'nav.stays': 'إقامات', 'nav.destinations': 'الوجهات', 'nav.trips': 'رحلاتي', 'nav.host': 'كن مضيفًا',
      'search.where': 'إلى أين', 'search.checkin': 'تاريخ الوصول', 'search.checkout': 'تاريخ المغادرة', 'search.guests': 'الضيوف', 'search.cta': 'بحث',
      'home.featured': 'إقامات مميزة', 'home.destinations': 'تصفح الوجهات', 'home.recent': 'شوهدت مؤخرا',
      'reserve.cta': 'احجز', 'reserve.book': 'احجز الآن',
      'fav.added': 'تم الحفظ', 'fav.removed': 'تمت الإزالة'
    }
  };

  // ===================== EXPOSE =====================
  window.VACATION_DATA = {
    DESTINATIONS: DESTINATIONS,
    AMENITIES: AMENITIES,
    HOSTS: HOSTS,
    LISTINGS: LISTINGS,
    GUESTS: GUESTS,
    BOOKINGS: BOOKINGS,
    REVIEWS: REVIEWS,
    CURRENCIES: CURRENCIES,
    I18N: I18N,
    PHOTO_POOL: PHOTO_POOL,
    DOCUMENT_TYPES: DOCUMENT_TYPES,
    HOST_APPLICATIONS: HOST_APPLICATIONS,
    LISTING_STATUSES: ['live', 'pending_review', 'changes_requested', 'paused', 'rejected', 'awaiting_host_verification']
  };
})();
