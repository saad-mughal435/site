/* data.js — Manzil Properties seed data
   All listings, agents, agencies, customers, inquiries and viewings are fabricated.
   Photos via Unsplash (free to use). */
(function () {
  'use strict';

  // ===================== PHOTO POOL =====================
  // Curated Unsplash photo IDs for residential real-estate.
  // Each listing draws 5-8 from this pool deterministically by listing id.
  function ph(id, w) {
    return 'https://images.unsplash.com/photo-' + id + '?w=' + (w || 1200) + '&q=80&auto=format';
  }
  var PHOTO_POOL = [
    ph('1545324418-cc1a3fa10c00'),  // modern apt exterior
    ph('1502672023488-70e25813eb80'), // luxury home
    ph('1512917774080-9991f1c4c750'), // modern villa
    ph('1600596542815-ffad4c1539a9'), // living room
    ph('1600585154340-be6161a56a0c'), // modern interior
    ph('1600566753190-17f0baa2a6c3'), // kitchen
    ph('1600210492486-724fe5c67fb0'), // bedroom
    ph('1600573472556-e636c2acda88'), // interior view
    ph('1600585154526-990dced4db0d'), // living
    ph('1600607687939-ce8a6c25118c'), // bath
    ph('1600210492286-aceace5a3a4d'), // kitchen alt
    ph('1556909114-f6e7ad7d3136'),  // interior
    ph('1564013799919-ab600027ffc6'), // apt
    ph('1568605114967-8130f3a36994'), // villa
    ph('1582268611958-ebfd161ef9cf'), // apt night
    ph('1613490493576-7fde63acd811'), // modern apt
    ph('1493809842364-78817add7ffb'), // apt view
    ph('1502005229762-cf1b2da7c5d6'), // bedroom modern
    ph('1505691938895-1758d7feb511'), // bath luxury
    ph('1560448204-e02f11c3d0e2'),  // interior modern
    ph('1583847268964-b28dc8f51f92'), // apt 2
    ph('1560185007-cde436f6a4d0'),  // luxury home
    ph('1572120360610-d971b9d7767c'), // home modern
    ph('1564540583246-934409427776'), // dubai apt
    ph('1567496898669-ee935f5f647a'), // marina view
    ph('1571055107559-3e67626fa8be'), // villa pool
    ph('1591474200742-8e512e6f98f8'), // apt interior
    ph('1554995207-c18c203602cb'),  // living luxury
    ph('1565538810643-b5bdb714032a'), // bedroom
    ph('1631679706909-1844bbd07221'), // modern bath
    ph('1600494603989-9650cf6dad51'), // luxury living
    ph('1600585152915-d208bec867a1'), // apt 3
    ph('1600566753051-6057b16f8b6f'), // kitchen 3
    ph('1505691723518-36a5ac3be353'), // apt
    ph('1502672260266-1c1ef2d93688'), // home
    ph('1493809842-364-c1a8'),       // (placeholder dup ok)
    ph('1604014237800-1c9102c219da'), // dubai marina
    ph('1518684079-3c830dcef090'),  // dubai night
    ph('1512453979798-5ea266f8880c'), // burj khalifa
    ph('1559599101-f09722fb4948')   // luxury villa
  ];

  function pickPhotos(seed, count) {
    var n = count || (5 + (seed % 4));
    var out = [];
    for (var i = 0; i < n; i++) {
      out.push(PHOTO_POOL[(seed * 7 + i * 13) % PHOTO_POOL.length]);
    }
    return out;
  }

  // ===================== AREAS =====================
  var AREAS = [
    { id: 'a-marina',    slug: 'dubai-marina',    name: 'Dubai Marina',       name_ar: 'مرسى دبي',       lat: 25.0805, lng: 55.1407, hero: ph('1604014237800-1c9102c219da', 1600), avg_aed_sqft: 1900, avg_rent_year: 110000,
      blurb: 'Waterfront living with 200+ residential towers along a 3km marina. Walking distance to JBR Beach, the Walk, and metro.',
      schools: ['Dubai International Academy', 'Emirates International School'], malls: ['Marina Mall'], metros: ['DMCC', 'Sobha Realty', 'Marina Towers'] },
    { id: 'a-downtown',  slug: 'downtown',        name: 'Downtown Dubai',     name_ar: 'وسط مدينة دبي', lat: 25.1972, lng: 55.2744, hero: ph('1512453979798-5ea266f8880c', 1600), avg_aed_sqft: 2400, avg_rent_year: 150000,
      blurb: 'Home to Burj Khalifa, Dubai Mall and Dubai Fountain. Premium addresses with skyline views and direct mall access.',
      schools: ['JSS Private School', 'Citizens School'], malls: ['Dubai Mall', 'Souk Al Bahar'], metros: ['Burj Khalifa/Dubai Mall'] },
    { id: 'a-palm',      slug: 'palm-jumeirah',   name: 'Palm Jumeirah',      name_ar: 'نخلة جميرا',     lat: 25.1124, lng: 55.139,  hero: ph('1571939228382-b2f2b585ce15', 1600), avg_aed_sqft: 2700, avg_rent_year: 220000,
      blurb: 'The iconic palm-shaped island. Beachfront villas and high-end towers on the trunk, crescent and fronds.',
      schools: ['Dubai College'], malls: ['Nakheel Mall', 'Golden Mile Galleria'], metros: ['Palm Monorail'] },
    { id: 'a-jbr',       slug: 'jbr',             name: 'JBR',                name_ar: 'جي بي آر',       lat: 25.0769, lng: 55.1340, hero: ph('1604014237800-1c9102c219da', 1600), avg_aed_sqft: 1850, avg_rent_year: 100000,
      blurb: 'Jumeirah Beach Residence — beachfront towers above The Walk strip with restaurants, cinema and the Beach mall.',
      schools: ['American School of Dubai'], malls: ['The Beach', 'JBR Walk'], metros: ['JLT'] },
    { id: 'a-business',  slug: 'business-bay',    name: 'Business Bay',       name_ar: 'الخليج التجاري', lat: 25.186,  lng: 55.2785, hero: ph('1518684079-3c830dcef090', 1600),  avg_aed_sqft: 1600, avg_rent_year: 95000,
      blurb: 'Central business district along the Dubai Canal. Mix of residential towers, offices and hotels, minutes from Downtown.',
      schools: ['Hartland International'], malls: ['Bay Avenue'], metros: ['Business Bay'] },
    { id: 'a-difc',      slug: 'difc',            name: 'DIFC',               name_ar: 'مركز دبي المالي', lat: 25.2138, lng: 55.2784, hero: ph('1582268611958-ebfd161ef9cf', 1600), avg_aed_sqft: 2200, avg_rent_year: 140000,
      blurb: 'Dubai International Financial Centre — premium residences within walking distance of the financial district and Gate Village.',
      schools: ['JSS Private'], malls: ['Gate Village'], metros: ['Financial Centre', 'Emirates Towers'] },
    { id: 'a-jlt',       slug: 'jlt',             name: 'JLT',                name_ar: 'أبراج بحيرات الجميرا', lat: 25.0691, lng: 55.1397, hero: ph('1564540583246-934409427776', 1600), avg_aed_sqft: 1400, avg_rent_year: 78000,
      blurb: 'Jumeirah Lake Towers — 80+ towers around four artificial lakes. Mid-market apartments, F&B, and DMCC offices.',
      schools: ['Emirates International'], malls: ['Almas Tower retail'], metros: ['DMCC', 'JLT'] },
    { id: 'a-ranches',   slug: 'arabian-ranches', name: 'Arabian Ranches',    name_ar: 'المرابع العربية', lat: 25.0497, lng: 55.262,  hero: ph('1568605114967-8130f3a36994', 1600), avg_aed_sqft: 1300, avg_rent_year: 180000,
      blurb: 'Established gated villa community with three phases, two golf courses, equestrian centre, and family-focused amenities.',
      schools: ['Jumeirah English Speaking', 'Ranches Primary'], malls: ['Ranches Souk'], metros: [] },
    { id: 'a-hills-em',  slug: 'emirates-hills',  name: 'Emirates Hills',     name_ar: 'تلال الإمارات',  lat: 25.0577, lng: 55.1782, hero: ph('1571055107559-3e67626fa8be', 1600), avg_aed_sqft: 2900, avg_rent_year: 600000,
      blurb: 'Ultra-premium gated villa community around the Montgomerie Golf Course. Dubai’s answer to Beverly Hills.',
      schools: ['Dubai International Academy'], malls: ['Springs Souk'], metros: [] },
    { id: 'a-springs',   slug: 'the-springs',     name: 'The Springs',        name_ar: 'الينابيع',       lat: 25.0461, lng: 55.1731, hero: ph('1559599101-f09722fb4948', 1600),  avg_aed_sqft: 1200, avg_rent_year: 145000,
      blurb: 'Family-friendly cluster of 2-3BR townhouses around man-made lakes. Adjacent to Meadows and Emirates Hills.',
      schools: ['Emirates International'], malls: ['Springs Souk'], metros: [] },
    { id: 'a-meadows',   slug: 'the-meadows',     name: 'The Meadows',        name_ar: 'المروج',         lat: 25.0526, lng: 55.1607, hero: ph('1572120360610-d971b9d7767c', 1600), avg_aed_sqft: 1500, avg_rent_year: 240000,
      blurb: 'Upmarket villa neighbourhood adjacent to Emirates Hills and Springs. Larger plots with private gardens.',
      schools: ['Dubai British School'], malls: ['Meadows Town Centre'], metros: [] },
    { id: 'a-hills-est', slug: 'dubai-hills',     name: 'Dubai Hills Estate', name_ar: 'تلال دبي',       lat: 25.1077, lng: 55.248,  hero: ph('1502672023488-70e25813eb80', 1600), avg_aed_sqft: 1800, avg_rent_year: 165000,
      blurb: 'Newer master-planned community by Emaar around an 18-hole championship golf course. Apartments, townhouses, villas.',
      schools: ['GEMS Wellington'], malls: ['Dubai Hills Mall'], metros: [] },
    { id: 'a-damac',     slug: 'damac-hills',     name: 'DAMAC Hills',        name_ar: 'داماك هيلز',    lat: 25.0259, lng: 55.2645, hero: ph('1571055107559-3e67626fa8be', 1600), avg_aed_sqft: 1100, avg_rent_year: 110000,
      blurb: 'Master-planned community around the Trump International Golf Club Dubai. Apartments and villa enclaves.',
      schools: ['Jebel Ali School'], malls: ['Vista Lux retail'], metros: [] },
    { id: 'a-mirdif',    slug: 'mirdif',          name: 'Mirdif',             name_ar: 'مردف',           lat: 25.2151, lng: 55.4159, hero: ph('1502672260266-1c1ef2d93688', 1600), avg_aed_sqft: 900, avg_rent_year: 85000,
      blurb: 'Established family neighbourhood with affordable villas and apartments. Near Mirdif City Centre and the airport.',
      schools: ['Uptown School'], malls: ['City Centre Mirdif'], metros: [] },
    { id: 'a-barsha',    slug: 'al-barsha',       name: 'Al Barsha',          name_ar: 'البرشاء',        lat: 25.1144, lng: 55.198,  hero: ph('1556909114-f6e7ad7d3136', 1600),  avg_aed_sqft: 1000, avg_rent_year: 80000,
      blurb: 'Central residential area near Mall of the Emirates with a mix of apartments, townhouses and villas.',
      schools: ['American School', 'King\'s School Al Barsha'], malls: ['Mall of the Emirates'], metros: ['Mall of the Emirates', 'Sharaf DG'] }
  ];

  // ===================== AMENITIES =====================
  var AMENITIES = [
    { id: 'm-pool',     label: 'Swimming pool',    label_ar: 'مسبح',          icon: '🏊' },
    { id: 'm-gym',      label: 'Gym',              label_ar: 'صالة رياضية',   icon: '🏋️' },
    { id: 'm-parking',  label: 'Covered parking',  label_ar: 'موقف مغطى',     icon: '🅿️' },
    { id: 'm-security', label: '24/7 security',    label_ar: 'أمن ٢٤ ساعة',   icon: '🛡️' },
    { id: 'm-maid',     label: "Maid's room",      label_ar: 'غرفة خادمة',    icon: '🚪' },
    { id: 'm-study',    label: 'Study',            label_ar: 'مكتب',          icon: '📚' },
    { id: 'm-balcony',  label: 'Balcony',          label_ar: 'شرفة',          icon: '🌅' },
    { id: 'm-seaview',  label: 'Sea view',         label_ar: 'إطلالة بحرية',  icon: '🌊' },
    { id: 'm-burj',     label: 'Burj Khalifa view',label_ar: 'إطلالة برج خليفة', icon: '🏙️' },
    { id: 'm-marina-v', label: 'Marina view',      label_ar: 'إطلالة المرسى', icon: '⛵' },
    { id: 'm-golf',     label: 'Golf course view', label_ar: 'إطلالة الغولف', icon: '⛳' },
    { id: 'm-furnished',label: 'Furnished',        label_ar: 'مفروشة',        icon: '🛋️' },
    { id: 'm-kitchen',  label: 'Built-in kitchen', label_ar: 'مطبخ مجهز',     icon: '🍳' },
    { id: 'm-wardrobe', label: 'Built-in wardrobes', label_ar: 'خزائن مدمجة',icon: '👔' },
    { id: 'm-laundry',  label: 'Laundry room',     label_ar: 'غرفة غسيل',     icon: '🧺' },
    { id: 'm-storage',  label: 'Storage room',     label_ar: 'غرفة تخزين',    icon: '📦' },
    { id: 'm-aircon',   label: 'Central A/C',      label_ar: 'تكييف مركزي',   icon: '❄️' },
    { id: 'm-pets',     label: 'Pets allowed',     label_ar: 'مسموح بالحيوانات', icon: '🐶' },
    { id: 'm-private-pool', label: 'Private pool', label_ar: 'مسبح خاص',      icon: '💧' },
    { id: 'm-garden',   label: 'Private garden',   label_ar: 'حديقة خاصة',    icon: '🌳' },
    { id: 'm-beach',    label: 'Beach access',     label_ar: 'وصول للشاطئ',   icon: '🏖️' },
    { id: 'm-concierge',label: 'Concierge',        label_ar: 'كونسيرج',       icon: '🛎️' },
    { id: 'm-spa',      label: 'Spa',              label_ar: 'سبا',           icon: '💆' },
    { id: 'm-bbq',      label: 'BBQ area',         label_ar: 'منطقة شواء',    icon: '🍖' },
    { id: 'm-kids',     label: 'Kids play area',   label_ar: 'منطقة لعب',     icon: '🧒' },
    { id: 'm-tennis',   label: 'Tennis court',     label_ar: 'ملعب تنس',      icon: '🎾' },
    { id: 'm-walkable', label: 'Walking distance to metro', label_ar: 'بالقرب من المترو', icon: '🚇' },
    { id: 'm-cinema',   label: 'Private cinema',   label_ar: 'سينما خاصة',    icon: '🎬' },
    { id: 'm-elevator', label: 'High-speed elevator', label_ar: 'مصعد سريع',  icon: '🛗' },
    { id: 'm-rooftop',  label: 'Rooftop terrace',  label_ar: 'سطح',           icon: '🌄' }
  ];

  // ===================== AGENCIES =====================
  var AGENCIES = [
    { id: 'g-marina',   name: 'Marina Realty Group',   license_no: 'RERA-1024',  founded: 2008, specialties: ['Marina', 'JBR', 'JLT'], hero: ph('1518684079-3c830dcef090', 1200) },
    { id: 'g-emirates', name: 'Emirates Premier',      license_no: 'RERA-0871',  founded: 2002, specialties: ['Emirates Hills', 'Meadows', 'Springs'], hero: ph('1571055107559-3e67626fa8be', 1200) },
    { id: 'g-azure',    name: 'Azure Real Estate',     license_no: 'RERA-2156',  founded: 2014, specialties: ['Downtown', 'Business Bay', 'DIFC'], hero: ph('1512453979798-5ea266f8880c', 1200) },
    { id: 'g-falcon',   name: 'Falcon Properties',     license_no: 'RERA-1382',  founded: 2010, specialties: ['Palm Jumeirah', 'Emirates Hills'], hero: ph('1571939228382-b2f2b585ce15', 1200) },
    { id: 'g-skyline',  name: 'Skyline Realty',        license_no: 'RERA-3041',  founded: 2017, specialties: ['Downtown', 'Marina'], hero: ph('1582268611958-ebfd161ef9cf', 1200) },
    { id: 'g-oasis',    name: 'Oasis Properties',      license_no: 'RERA-0925',  founded: 2005, specialties: ['Arabian Ranches', 'Hills', 'DAMAC Hills'], hero: ph('1568605114967-8130f3a36994', 1200) },
    { id: 'g-mirage',   name: 'Mirage Real Estate',    license_no: 'RERA-2867',  founded: 2016, specialties: ['Mirdif', 'Al Barsha', 'JLT'], hero: ph('1502672260266-1c1ef2d93688', 1200) },
    { id: 'g-pinnacle', name: 'Pinnacle Properties',   license_no: 'RERA-1719',  founded: 2012, specialties: ['Off-plan', 'Investments'], hero: ph('1504805572947-34fad45aed93', 1200) },
    { id: 'g-heritage', name: 'Heritage Homes',        license_no: 'RERA-0540',  founded: 2003, specialties: ['Villas', 'Family communities'], hero: ph('1572120360610-d971b9d7767c', 1200) },
    { id: 'g-bayut',    name: 'Bayut Heritage Realty', license_no: 'RERA-3309',  founded: 2018, specialties: ['Rentals', 'Mid-market'], hero: ph('1567496898669-ee935f5f647a', 1200) }
  ];

  // ===================== AGENTS =====================
  function agent(id, name, agency_id, lang, spec, yrs, rating, deals, bio, photo) {
    return {
      id: id, name: name, agency_id: agency_id, languages: lang, specialisation: spec,
      years_exp: yrs, rating: rating, deals_closed: deals,
      phone: '+971 50 ' + (1000000 + (id.charCodeAt(2) * 137 % 9000000)).toString().slice(0, 7),
      email: name.toLowerCase().replace(/[^a-z]/g, '.') + '@manzil.ae',
      whatsapp: '+971 50 ' + (1000000 + (id.charCodeAt(2) * 311 % 9000000)).toString().slice(0, 7),
      bio: bio,
      photo_url: photo
    };
  }
  function unsplashPortrait(id, w) { return 'https://images.unsplash.com/photo-' + id + '?w=' + (w || 400) + '&q=80&auto=format&fit=crop&crop=faces'; }
  var AGENTS = [
    agent('ag01', 'Sarah Mitchell',    'g-marina',   ['English', 'French'],           'Residential rentals',  9,  4.9, 187, 'Marina specialist with a decade of UAE experience. Multilingual and known for fast turnarounds.', unsplashPortrait('1494790108377-be9c29b29330')),
    agent('ag02', 'Aamir Khan',        'g-marina',   ['English', 'Urdu', 'Hindi'],    'Residential sales',    7,  4.8, 142, 'Helps families relocate to Dubai Marina and JLT. South Asian community contact.', unsplashPortrait('1507003211169-0a1dd7228f2d')),
    agent('ag03', 'Olga Volkova',      'g-marina',   ['Russian', 'English'],          'Luxury sales',         11, 4.7, 96,  'Russian-speaking luxury specialist on Marina and JBR penthouses.', unsplashPortrait('1438761681033-6461ffad8d80')),
    agent('ag04', 'James Carter',      'g-emirates', ['English'],                     'Villas',               14, 4.9, 211, 'Emirates Hills and Meadows villa expert. Career broker with deep developer relationships.', unsplashPortrait('1500648767791-00dcc994a43e')),
    agent('ag05', 'Layla Hammoud',     'g-emirates', ['Arabic', 'English', 'French'], 'Family rentals',       8,  4.8, 156, 'Lebanese-trilingual broker for villa and townhouse rentals in Springs/Meadows.', unsplashPortrait('1573496359142-b8d87734a5a2')),
    agent('ag06', 'Priya Sharma',      'g-azure',    ['English', 'Hindi'],            'Off-plan',             6,  4.6, 89,  'Investor-focused; specialises in off-plan handovers and Q4 deals.', unsplashPortrait('1573496799652-408c2ac9fe98')),
    agent('ag07', 'Mohammed Al-Rashid','g-azure',    ['Arabic', 'English'],           'Commercial & residential', 12, 4.7, 174, 'Native Emirati broker, DIFC tenancy specialist.', unsplashPortrait('1472099645785-5658abf4ff4e')),
    agent('ag08', 'Anna Petrov',       'g-azure',    ['Russian', 'English'],          'Luxury sales',         9,  4.8, 124, 'CIS clients moving into Downtown and Business Bay penthouses.', unsplashPortrait('1487412720507-e7ab37603c6f')),
    agent('ag09', 'Charles Thornton',  'g-falcon',   ['English'],                     'Palm specialist',      16, 4.9, 256, 'Palm Jumeirah broker since 2009. Bespoke search for ultra-prime clients.', unsplashPortrait('1519085360753-af0119f7cbe7')),
    agent('ag10', 'Maria Rodriguez',   'g-falcon',   ['Spanish', 'English'],          'Luxury sales',         10, 4.7, 132, 'Latin American expat community contact for Palm and Emirates Hills.', unsplashPortrait('1544005313-94ddf0286df2')),
    agent('ag11', 'Diana Lee',         'g-skyline',  ['English', 'Korean'],           'Downtown & Marina',    5,  4.6, 64,  'Younger broker with strong digital presence; Downtown apartments.', unsplashPortrait('1438761681033-6461ffad8d80')),
    agent('ag12', 'Daniel Reyes',      'g-skyline',  ['English', 'Tagalog'],          'Rentals',              4,  4.5, 51,  'Filipino community broker focusing on Marina and JLT rentals.', unsplashPortrait('1506794778202-cad84cf45f1d')),
    agent('ag13', 'Hannah Williamson', 'g-oasis',    ['English'],                     'Family villas',        13, 4.9, 198, 'Arabian Ranches expert; oversees Ranches 1/2/3 inventory.', unsplashPortrait('1502323777036-f29e3972d82f')),
    agent('ag14', 'Imran Saleem',      'g-oasis',    ['English', 'Urdu', 'Arabic'],   'Family villas',        8,  4.7, 119, 'Hills/Springs villa specialist, school-zone knowledge.', unsplashPortrait('1564564321837-a57b7070ac4f')),
    agent('ag15', 'Karina Ivanova',    'g-oasis',    ['Russian', 'English'],          'Family villas',        6,  4.7, 88,  'Russian-speaking family broker for Hills and Damac communities.', unsplashPortrait('1531123897727-8f129e1688ce')),
    agent('ag16', 'Rajesh Kumar',      'g-mirage',   ['English', 'Hindi', 'Tamil'],   'Mid-market rentals',   11, 4.5, 145, 'Mirdif and Al Barsha rentals for families on a budget.', unsplashPortrait('1492447166138-50c3889fccb1')),
    agent('ag17', 'Ahmed Hassan',      'g-mirage',   ['Arabic', 'English'],           'Mid-market sales',     9,  4.6, 102, 'Egyptian broker for Mirdif sales and rentals.', unsplashPortrait('1463453091185-61582044d556')),
    agent('ag18', 'Elena Voss',        'g-pinnacle', ['German', 'English'],           'Off-plan investments', 7,  4.8, 76,  'Off-plan portfolio builder for European investor clients.', unsplashPortrait('1580489944761-15a19d654956')),
    agent('ag19', 'Tom Sullivan',      'g-pinnacle', ['English'],                     'Investments',          15, 4.8, 188, 'UK-based investor relationships, off-plan focus.', unsplashPortrait('1539571696357-5a69c17a67c6')),
    agent('ag20', 'Yara Mansour',      'g-heritage', ['Arabic', 'English'],           'Villas & family',      12, 4.9, 167, 'Heritage Homes principal broker; ultra-premium villas.', unsplashPortrait('1534528741775-53994a69daeb')),
    agent('ag21', 'Pierre Dubois',     'g-heritage', ['French', 'English'],           'Luxury villas',        14, 4.8, 145, 'French-speaking specialist for Emirates Hills clients.', unsplashPortrait('1492562080023-ab3db95bfbce')),
    agent('ag22', 'Khaled Al-Maktoum', 'g-heritage', ['Arabic', 'English'],           'Heritage villas',      10, 4.7, 121, 'Emirati broker with developer connections.', unsplashPortrait('1507591064344-4c6ce005b128')),
    agent('ag23', 'Lena Park',         'g-bayut',    ['English', 'Korean'],           'Rentals',              3,  4.4, 38,  'New-to-Dubai broker focused on mid-market rentals across Mirdif and JLT.', unsplashPortrait('1554151228-14d9def656e4')),
    agent('ag24', 'Tariq Ahmed',       'g-bayut',    ['English', 'Urdu', 'Arabic'],   'Rentals & sales',      6,  4.5, 81,  'JLT and Business Bay broker, fast-moving inventory.', unsplashPortrait('1500648767791-00dcc994a43e'))
  ];

  // Wire agencies → agents
  AGENCIES.forEach(function (g) {
    g.agents_ids = AGENTS.filter(function (a) { return a.agency_id === g.id; }).map(function (a) { return a.id; });
  });

  // ===================== LISTINGS =====================
  var LISTINGS = [];
  function pushListing(spec) {
    var seed = LISTINGS.length + 1;
    var photos = pickPhotos(seed, 5 + (seed % 4));
    var area = AREAS.find(function (a) { return a.id === spec.area_id; });
    var aLat = area ? area.lat : 25.2;
    var aLng = area ? area.lng : 55.3;
    // jitter the lat/lng within ~1.5km of area center
    var lat = aLat + ((seed * 13) % 100 - 50) / 5000;
    var lng = aLng + ((seed * 17) % 100 - 50) / 4000;
    var listed = new Date(Date.now() - (spec.days_ago || (seed * 3 + 2)) * 86400000).toISOString();
    LISTINGS.push({
      id: 'L' + String(seed).padStart(3, '0'),
      slug: spec.slug || ('listing-' + seed),
      title: spec.title,
      title_ar: spec.title_ar || spec.title,
      transaction: spec.transaction || 'buy',
      type: spec.type,
      area_id: spec.area_id,
      address: spec.address || (area ? area.name : ''),
      lat: lat, lng: lng,
      price_aed: spec.price_aed,
      previous_price: spec.previous_price || null,
      rent_freq: spec.rent_freq || (spec.transaction === 'rent' ? 'year' : null),
      beds: spec.beds, baths: spec.baths, sqft: spec.sqft, year_built: spec.year_built || 2020,
      completion_status: spec.completion_status || (spec.transaction === 'off-plan' ? 'off-plan' : 'ready'),
      furnished: spec.furnished || false,
      amenities: spec.amenities || [],
      photos: photos,
      description: spec.description,
      description_ar: spec.description_ar || spec.description,
      agent_id: spec.agent_id,
      agency_id: AGENTS.find(function (a) { return a.id === spec.agent_id; }).agency_id,
      listed_at: listed,
      featured: !!spec.featured,
      verified: spec.verified === undefined ? true : spec.verified,
      premium: !!spec.premium,
      status: spec.status || 'active'
    });
  }

  // Marina
  pushListing({ title: 'Marina Promenade — 2BR with Marina View',                 area_id: 'a-marina',   type: 'apartment',  beds: 2, baths: 3, sqft: 1450, price_aed: 2400000, previous_price: 2600000, agent_id: 'ag01', featured: true, premium: true, amenities: ['m-pool','m-gym','m-parking','m-security','m-balcony','m-marina-v','m-walkable','m-aircon'], description: 'Bright corner unit on the 38th floor with full Marina views. Recently renovated, walk to JBR Beach and DMCC metro.' });
  pushListing({ title: 'Princess Tower — 1BR Sea & Marina Views',                 area_id: 'a-marina',   type: 'apartment',  beds: 1, baths: 2, sqft: 980,  price_aed: 1450000, agent_id: 'ag02', featured: true, amenities: ['m-pool','m-gym','m-parking','m-security','m-balcony','m-seaview','m-marina-v','m-aircon'], description: 'High-floor 1BR in iconic Princess Tower. Vacant on transfer, ready to move in.' });
  pushListing({ title: 'Cayan Tower (Infinity) — 3BR Penthouse',                   area_id: 'a-marina',   type: 'penthouse',  beds: 3, baths: 4, sqft: 2400, price_aed: 6200000, agent_id: 'ag03', premium: true, featured: true, amenities: ['m-pool','m-gym','m-parking','m-security','m-balcony','m-seaview','m-marina-v','m-rooftop','m-concierge','m-aircon'], description: 'Twisted-tower duplex penthouse with private terrace and 270° views.' });
  pushListing({ title: 'Marina Gate 2 — 2BR Furnished',                            area_id: 'a-marina',   type: 'apartment',  beds: 2, baths: 2, sqft: 1320, price_aed: 165000, transaction: 'rent', furnished: true, agent_id: 'ag12', amenities: ['m-pool','m-gym','m-parking','m-balcony','m-marina-v','m-furnished','m-aircon'], description: 'Furnished 2BR on a mid-floor, available immediately for 12-month lease.' });
  pushListing({ title: 'Marina Quays — Studio for Rent',                           area_id: 'a-marina',   type: 'studio',     beds: 0, baths: 1, sqft: 480,  price_aed: 68000,  transaction: 'rent', agent_id: 'ag12', amenities: ['m-pool','m-gym','m-parking','m-furnished','m-aircon','m-walkable'], description: 'Compact studio on the Marina walk, perfect for a single tenant.' });
  pushListing({ title: 'Emaar Six Towers — 4BR Penthouse',                         area_id: 'a-marina',   type: 'penthouse',  beds: 4, baths: 5, sqft: 3500, price_aed: 12500000, agent_id: 'ag03', premium: true, featured: true, amenities: ['m-pool','m-gym','m-parking','m-security','m-balcony','m-seaview','m-marina-v','m-rooftop','m-concierge','m-maid','m-aircon'], description: 'Triplex penthouse with private pool, dual terraces, and exclusive concierge.' });
  pushListing({ title: 'Manchester Tower — 2BR Renovated',                         area_id: 'a-marina',   type: 'apartment',  beds: 2, baths: 2, sqft: 1180, price_aed: 1850000, agent_id: 'ag01', amenities: ['m-pool','m-gym','m-parking','m-balcony','m-marina-v','m-aircon'], description: 'Fully renovated 2BR with new flooring, modern kitchen and en-suite bathrooms.' });

  // Downtown
  pushListing({ title: 'Burj Vista 1 — 2BR with Burj View',                        area_id: 'a-downtown', type: 'apartment',  beds: 2, baths: 3, sqft: 1380, price_aed: 3200000, agent_id: 'ag06', featured: true, amenities: ['m-pool','m-gym','m-parking','m-security','m-balcony','m-burj','m-walkable','m-concierge','m-aircon'], description: 'Tower 1 unit with unobstructed Burj Khalifa view. Premium Emaar handover finishes.' });
  pushListing({ title: 'The Address Sky View — Hotel Apartment',                   area_id: 'a-downtown', type: 'apartment',  beds: 1, baths: 2, sqft: 920,  price_aed: 2700000, agent_id: 'ag07', amenities: ['m-pool','m-gym','m-parking','m-security','m-balcony','m-burj','m-concierge','m-spa','m-aircon'], description: 'Serviced apartment with hotel benefits — concierge, daily housekeeping option.' });
  pushListing({ title: 'Forte Tower — 3BR Family Apartment',                       area_id: 'a-downtown', type: 'apartment',  beds: 3, baths: 4, sqft: 1850, price_aed: 4500000, agent_id: 'ag08', amenities: ['m-pool','m-gym','m-parking','m-security','m-balcony','m-maid','m-burj','m-walkable','m-aircon'], description: 'Spacious 3BR with maid\'s room, in front of Opera District.' });
  pushListing({ title: 'BLVD Heights — 1BR Furnished Rental',                      area_id: 'a-downtown', type: 'apartment',  beds: 1, baths: 2, sqft: 850,  price_aed: 145000, transaction: 'rent', furnished: true, agent_id: 'ag07', amenities: ['m-pool','m-gym','m-parking','m-furnished','m-burj','m-balcony','m-aircon','m-walkable'], description: 'High-floor 1BR overlooking Burj Park.' });
  pushListing({ title: 'IL Primo by Emaar — 5BR Penthouse',                        area_id: 'a-downtown', type: 'penthouse',  beds: 5, baths: 7, sqft: 7800, price_aed: 38000000, agent_id: 'ag10', premium: true, featured: true, amenities: ['m-pool','m-gym','m-parking','m-security','m-balcony','m-burj','m-maid','m-private-pool','m-rooftop','m-concierge','m-cinema','m-spa','m-aircon'], description: 'Ultra-prime full-floor penthouse with private rooftop pool and library.' });
  pushListing({ title: 'Burj Royale — 1BR Off-plan Q4 2026',                       area_id: 'a-downtown', type: 'apartment',  beds: 1, baths: 1, sqft: 720,  price_aed: 1750000, transaction: 'off-plan', completion_status: 'off-plan', agent_id: 'ag18', amenities: ['m-pool','m-gym','m-parking','m-burj','m-balcony','m-aircon','m-walkable'], description: 'Last off-plan tower on the Burj Khalifa boulevard. 60/40 payment plan.' });

  // Palm
  pushListing({ title: 'Garden Homes — 4BR Beachfront Villa',                      area_id: 'a-palm',     type: 'villa',      beds: 4, baths: 5, sqft: 5200, price_aed: 16500000, agent_id: 'ag09', premium: true, featured: true, amenities: ['m-pool','m-private-pool','m-garden','m-beach','m-security','m-maid','m-seaview','m-aircon'], description: 'Atrium-type villa with direct beach access, private pool, and landscaped garden.' });
  pushListing({ title: 'Atlantis The Royal Residences — 3BR',                      area_id: 'a-palm',     type: 'apartment',  beds: 3, baths: 4, sqft: 3100, price_aed: 22000000, agent_id: 'ag10', premium: true, featured: true, amenities: ['m-pool','m-gym','m-parking','m-security','m-beach','m-seaview','m-concierge','m-spa','m-cinema','m-aircon'], description: 'Hotel-managed residence with private beach club access and full Atlantis amenities.' });
  pushListing({ title: 'Shoreline Apartments — 1BR Sea View',                      area_id: 'a-palm',     type: 'apartment',  beds: 1, baths: 2, sqft: 920,  price_aed: 2100000, agent_id: 'ag09', amenities: ['m-pool','m-gym','m-parking','m-security','m-beach','m-seaview','m-aircon'], description: 'Trunk-of-the-palm 1BR with sea view and direct beach access via Shoreline club.' });
  pushListing({ title: 'Signature Villa — 6BR with Private Beach',                 area_id: 'a-palm',     type: 'villa',      beds: 6, baths: 8, sqft: 9000, price_aed: 65000000, agent_id: 'ag20', premium: true, featured: true, amenities: ['m-pool','m-private-pool','m-garden','m-beach','m-security','m-maid','m-seaview','m-cinema','m-spa','m-bbq','m-aircon'], description: 'Frond M signature villa with 100ft of private beach, indoor pool, and home cinema.' });
  pushListing({ title: 'Tiara Residences — 2BR Annual Rental',                     area_id: 'a-palm',     type: 'apartment',  beds: 2, baths: 3, sqft: 1500, price_aed: 240000, transaction: 'rent', furnished: true, agent_id: 'ag09', amenities: ['m-pool','m-gym','m-parking','m-security','m-beach','m-seaview','m-furnished','m-aircon'], description: 'Furnished 2BR on the trunk; chiller-free, available for 12-month lease.' });

  // JBR
  pushListing({ title: 'Bahar 4 — 1BR Sea View',                                   area_id: 'a-jbr',      type: 'apartment',  beds: 1, baths: 2, sqft: 880,  price_aed: 1650000, agent_id: 'ag01', amenities: ['m-pool','m-gym','m-parking','m-security','m-balcony','m-seaview','m-beach','m-aircon'], description: 'Sea-side 1BR with The Walk views and direct beach access via Active Beach.' });
  pushListing({ title: 'Sadaf 6 — 2BR Renovated',                                  area_id: 'a-jbr',      type: 'apartment',  beds: 2, baths: 3, sqft: 1450, price_aed: 2350000, agent_id: 'ag02', featured: true, amenities: ['m-pool','m-gym','m-parking','m-security','m-balcony','m-seaview','m-furnished','m-aircon'], description: 'Renovated 2BR with new kitchen, en-suite bathrooms, and Marina-side balcony.' });
  pushListing({ title: 'Murjan 1 — Studio for Rent',                               area_id: 'a-jbr',      type: 'studio',     beds: 0, baths: 1, sqft: 530,  price_aed: 75000,  transaction: 'rent', agent_id: 'ag12', amenities: ['m-pool','m-gym','m-parking','m-furnished','m-beach','m-aircon'], description: 'JBR-side studio walking distance to The Beach mall and tram.' });
  pushListing({ title: 'Address Beach Residence — 2BR',                            area_id: 'a-jbr',      type: 'apartment',  beds: 2, baths: 3, sqft: 1620, price_aed: 5500000, agent_id: 'ag10', premium: true, amenities: ['m-pool','m-gym','m-parking','m-security','m-beach','m-seaview','m-concierge','m-spa','m-cinema','m-aircon'], description: 'Top-tier serviced 2BR with the famous sky-bridge infinity pool.' });

  // Business Bay
  pushListing({ title: 'Damac Maison Bay\'s Edge — 1BR Canal View',                area_id: 'a-business', type: 'apartment',  beds: 1, baths: 2, sqft: 880,  price_aed: 1450000, agent_id: 'ag08', amenities: ['m-pool','m-gym','m-parking','m-security','m-balcony','m-aircon','m-walkable'], description: '1BR with Dubai Canal view and direct boardwalk access.' });
  pushListing({ title: 'Executive Towers — 2BR Office-View',                       area_id: 'a-business', type: 'apartment',  beds: 2, baths: 3, sqft: 1250, price_aed: 1850000, agent_id: 'ag06', amenities: ['m-pool','m-gym','m-parking','m-security','m-balcony','m-aircon','m-walkable'], description: 'Two-tower complex 2BR with chiller-free option for tenants.' });
  pushListing({ title: 'Vela by Omniyat — 4BR Penthouse',                          area_id: 'a-business', type: 'penthouse',  beds: 4, baths: 5, sqft: 4500, price_aed: 28500000, agent_id: 'ag18', premium: true, featured: true, amenities: ['m-pool','m-gym','m-parking','m-security','m-balcony','m-private-pool','m-burj','m-concierge','m-spa','m-aircon'], description: 'Off-plan Bulgari Bay penthouse, handover Q2 2027.' });
  pushListing({ title: 'Reva Residences — 1BR Furnished Rental',                   area_id: 'a-business', type: 'apartment',  beds: 1, baths: 2, sqft: 760,  price_aed: 95000,  transaction: 'rent', furnished: true, agent_id: 'ag24', amenities: ['m-pool','m-gym','m-parking','m-balcony','m-furnished','m-aircon'], description: 'Compact furnished 1BR; bills included for the first 3 months.' });
  pushListing({ title: 'Volante Tower — Office for Rent',                          area_id: 'a-business', type: 'office',     beds: 0, baths: 2, sqft: 2200, price_aed: 220000, transaction: 'rent', agent_id: 'ag07', amenities: ['m-parking','m-security','m-aircon','m-walkable'], description: 'Fitted office space, Grade A, with 4 parking bays.' });

  // DIFC
  pushListing({ title: 'Index Tower — 1BR DIFC',                                   area_id: 'a-difc',     type: 'apartment',  beds: 1, baths: 2, sqft: 900,  price_aed: 1900000, agent_id: 'ag07', amenities: ['m-pool','m-gym','m-parking','m-security','m-balcony','m-burj','m-concierge','m-walkable','m-aircon'], description: 'Iconic Index Tower 1BR with double-height ceilings and skyline views.' });
  pushListing({ title: 'Burj Daman — 2BR Premium',                                 area_id: 'a-difc',     type: 'apartment',  beds: 2, baths: 3, sqft: 1480, price_aed: 3850000, agent_id: 'ag08', featured: true, amenities: ['m-pool','m-gym','m-parking','m-security','m-balcony','m-burj','m-concierge','m-walkable','m-aircon'], description: 'High-floor 2BR with full Burj Khalifa view, premium handover finishes.' });
  pushListing({ title: 'Liberty House — Studio for Rent',                          area_id: 'a-difc',     type: 'studio',     beds: 0, baths: 1, sqft: 540,  price_aed: 85000,  transaction: 'rent', furnished: true, agent_id: 'ag24', amenities: ['m-pool','m-gym','m-parking','m-furnished','m-walkable','m-aircon'], description: 'Furnished studio in the heart of DIFC, walk to financial centre.' });

  // JLT
  pushListing({ title: 'Bonnington Tower — 2BR Lake View',                         area_id: 'a-jlt',      type: 'apartment',  beds: 2, baths: 3, sqft: 1300, price_aed: 1850000, agent_id: 'ag16', amenities: ['m-pool','m-gym','m-parking','m-balcony','m-walkable','m-aircon'], description: 'Lakefront 2BR with maid\'s room option, walk to DMCC metro.' });
  pushListing({ title: 'Almas Tower (Diamond) — 1BR for Rent',                     area_id: 'a-jlt',      type: 'apartment',  beds: 1, baths: 2, sqft: 850,  price_aed: 95000,  transaction: 'rent', agent_id: 'ag23', amenities: ['m-pool','m-gym','m-parking','m-balcony','m-aircon','m-walkable'], description: 'Tallest tower in JLT, 1BR rental with chiller-free option.' });
  pushListing({ title: 'Lake Terrace — 3BR Family Apartment',                      area_id: 'a-jlt',      type: 'apartment',  beds: 3, baths: 4, sqft: 1900, price_aed: 2350000, agent_id: 'ag17', amenities: ['m-pool','m-gym','m-parking','m-balcony','m-maid','m-aircon','m-walkable'], description: 'Spacious 3BR plus maid\'s, ideal for a family of 4.' });
  pushListing({ title: 'Lakeshore Tower — Studio for Rent',                        area_id: 'a-jlt',      type: 'studio',     beds: 0, baths: 1, sqft: 460,  price_aed: 52000,  transaction: 'rent', agent_id: 'ag23', amenities: ['m-pool','m-gym','m-parking','m-aircon','m-walkable'], description: 'Compact studio with city view, perfect for a single tenant.' });

  // Arabian Ranches
  pushListing({ title: 'Saheel — 4BR Family Villa',                                area_id: 'a-ranches',  type: 'villa',      beds: 4, baths: 5, sqft: 3800, price_aed: 5800000, agent_id: 'ag13', featured: true, amenities: ['m-private-pool','m-garden','m-security','m-maid','m-bbq','m-kids','m-aircon'], description: 'Type 14 villa with extended kitchen, swimming pool and landscaped garden.' });
  pushListing({ title: 'Alvorada — 3BR Townhouse',                                 area_id: 'a-ranches',  type: 'townhouse',  beds: 3, baths: 4, sqft: 2600, price_aed: 3950000, agent_id: 'ag13', amenities: ['m-garden','m-security','m-kids','m-aircon'], description: 'Backing to landscaped park, 3BR plus study, ideal for young family.' });
  pushListing({ title: 'Mirador La Coleccion — 5BR for Rent',                      area_id: 'a-ranches',  type: 'villa',      beds: 5, baths: 6, sqft: 5400, price_aed: 360000, transaction: 'rent', agent_id: 'ag14', amenities: ['m-private-pool','m-garden','m-security','m-maid','m-bbq','m-kids','m-aircon'], description: 'Spanish-style 5BR with private pool, available for annual rental.' });
  pushListing({ title: 'Palmera — 2BR Townhouse',                                  area_id: 'a-ranches',  type: 'townhouse',  beds: 2, baths: 3, sqft: 1800, price_aed: 2150000, agent_id: 'ag14', amenities: ['m-garden','m-security','m-aircon'], description: 'Original Palmera 2BR townhouse, walking to Ranches Souk and JESS school.' });

  // Emirates Hills
  pushListing({ title: 'Sector E — 6BR Custom-Built Mansion',                      area_id: 'a-hills-em', type: 'villa',      beds: 6, baths: 8, sqft: 12500, price_aed: 75000000, agent_id: 'ag04', premium: true, featured: true, amenities: ['m-private-pool','m-garden','m-security','m-maid','m-bbq','m-kids','m-cinema','m-spa','m-tennis','m-aircon'], description: 'Bespoke 6BR mansion on Montgomerie golf course. Indoor cinema, gym, spa and private pool.' });
  pushListing({ title: 'Sector L — 7BR Modern Villa',                              area_id: 'a-hills-em', type: 'villa',      beds: 7, baths: 9, sqft: 14200, price_aed: 110000000, agent_id: 'ag21', premium: true, featured: true, amenities: ['m-private-pool','m-garden','m-security','m-maid','m-bbq','m-cinema','m-spa','m-tennis','m-aircon'], description: 'Architect-designed 7BR with infinity pool, full gym, and panoramic golf-course views.' });
  pushListing({ title: 'Sector W — 5BR for Rent',                                  area_id: 'a-hills-em', type: 'villa',      beds: 5, baths: 7, sqft: 8500, price_aed: 900000, transaction: 'rent', furnished: true, agent_id: 'ag05', amenities: ['m-private-pool','m-garden','m-security','m-maid','m-furnished','m-bbq','m-aircon'], description: 'Furnished 5BR for annual rental, fully maintained estate.' });

  // Springs
  pushListing({ title: 'The Springs 4 — 3BR Townhouse',                            area_id: 'a-springs',  type: 'townhouse',  beds: 3, baths: 4, sqft: 2400, price_aed: 3450000, agent_id: 'ag05', amenities: ['m-pool','m-garden','m-security','m-aircon','m-kids'], description: 'Type 1E townhouse with lake view, recently upgraded interiors.' });
  pushListing({ title: 'The Springs 8 — 2BR with Pool',                            area_id: 'a-springs',  type: 'townhouse',  beds: 2, baths: 3, sqft: 2100, price_aed: 2850000, agent_id: 'ag05', amenities: ['m-pool','m-garden','m-security','m-aircon'], description: 'Type 4E with private pool added, end-unit.' });
  pushListing({ title: 'The Springs 14 — 4BR for Rent',                            area_id: 'a-springs',  type: 'townhouse',  beds: 4, baths: 5, sqft: 2900, price_aed: 245000, transaction: 'rent', agent_id: 'ag14', amenities: ['m-garden','m-security','m-aircon','m-kids'], description: 'Type 2M with extended garden, available for annual lease.' });

  // Meadows
  pushListing({ title: 'Meadows 7 — 5BR Villa',                                    area_id: 'a-meadows',  type: 'villa',      beds: 5, baths: 6, sqft: 5200, price_aed: 12500000, agent_id: 'ag04', featured: true, amenities: ['m-private-pool','m-garden','m-security','m-maid','m-bbq','m-kids','m-aircon'], description: 'Type 8 villa with full lake view, upgraded kitchen and basement.' });
  pushListing({ title: 'Meadows 4 — 4BR Family Villa',                             area_id: 'a-meadows',  type: 'villa',      beds: 4, baths: 5, sqft: 4200, price_aed: 8500000, agent_id: 'ag21', amenities: ['m-garden','m-security','m-maid','m-aircon','m-kids'], description: 'Type 11 villa, recently renovated with new flooring and lighting.' });

  // Dubai Hills
  pushListing({ title: 'Park Heights 1 — 2BR Park View',                           area_id: 'a-hills-est',type: 'apartment',  beds: 2, baths: 3, sqft: 1290, price_aed: 2750000, agent_id: 'ag13', amenities: ['m-pool','m-gym','m-parking','m-balcony','m-aircon','m-walkable'], description: 'Park-facing 2BR with full balcony and family-friendly amenities.' });
  pushListing({ title: 'Sidra Villas 3 — 4BR Villa',                               area_id: 'a-hills-est',type: 'villa',      beds: 4, baths: 5, sqft: 4500, price_aed: 8400000, agent_id: 'ag14', featured: true, amenities: ['m-private-pool','m-garden','m-security','m-maid','m-bbq','m-aircon','m-kids'], description: 'Type E villa with single-row layout, garden and private pool.' });
  pushListing({ title: 'Maple 1 — 3BR Townhouse',                                  area_id: 'a-hills-est',type: 'townhouse',  beds: 3, baths: 4, sqft: 2050, price_aed: 3650000, agent_id: 'ag15', amenities: ['m-garden','m-security','m-aircon','m-kids'], description: 'Middle-unit Maple townhouse with extended garden.' });
  pushListing({ title: 'Collective Tower — 1BR Off-plan',                          area_id: 'a-hills-est',type: 'apartment',  beds: 1, baths: 1, sqft: 720,  price_aed: 1450000, transaction: 'off-plan', completion_status: 'off-plan', agent_id: 'ag19', amenities: ['m-pool','m-gym','m-parking','m-balcony','m-aircon'], description: 'Co-living concept off-plan unit, handover Q1 2027.' });

  // DAMAC Hills
  pushListing({ title: 'Akoya Drive — 4BR Villa',                                  area_id: 'a-damac',    type: 'villa',      beds: 4, baths: 5, sqft: 3800, price_aed: 4950000, agent_id: 'ag15', amenities: ['m-private-pool','m-garden','m-security','m-maid','m-aircon','m-kids'], description: 'Trump golf-course community 4BR with private pool option.' });
  pushListing({ title: 'Carson — 3BR Townhouse',                                   area_id: 'a-damac',    type: 'townhouse',  beds: 3, baths: 4, sqft: 2300, price_aed: 3150000, agent_id: 'ag15', amenities: ['m-garden','m-security','m-aircon'], description: 'Three-row Carson townhouse with golf-course backing.' });
  pushListing({ title: 'Loreto — 2BR Apartment',                                   area_id: 'a-damac',    type: 'apartment',  beds: 2, baths: 3, sqft: 1380, price_aed: 1750000, agent_id: 'ag18', amenities: ['m-pool','m-gym','m-parking','m-balcony','m-aircon'], description: 'Loreto building 2BR with park view and Trump golf access.' });

  // Mirdif
  pushListing({ title: 'Uptown Mirdif — 4BR Townhouse',                            area_id: 'a-mirdif',   type: 'townhouse',  beds: 4, baths: 5, sqft: 2800, price_aed: 220000, transaction: 'rent', agent_id: 'ag16', amenities: ['m-garden','m-security','m-pool','m-aircon','m-kids'], description: 'Family townhouse with shared pool and play area, walk to school.' });
  pushListing({ title: 'Ghoroob — 2BR Apartment',                                  area_id: 'a-mirdif',   type: 'apartment',  beds: 2, baths: 3, sqft: 1450, price_aed: 95000,  transaction: 'rent', agent_id: 'ag17', amenities: ['m-pool','m-gym','m-parking','m-balcony','m-aircon','m-kids'], description: '2BR plus maid\'s, family-friendly Ghoroob compound.' });
  pushListing({ title: 'Mirdif Hills — 3BR Apartment',                             area_id: 'a-mirdif',   type: 'apartment',  beds: 3, baths: 4, sqft: 1850, price_aed: 1950000, agent_id: 'ag17', amenities: ['m-pool','m-gym','m-parking','m-balcony','m-maid','m-aircon'], description: 'Modern 3BR with maid\'s in the newly handed-over Mirdif Hills complex.' });

  // Al Barsha
  pushListing({ title: 'Al Barsha 1 — 5BR Independent Villa',                      area_id: 'a-barsha',   type: 'villa',      beds: 5, baths: 6, sqft: 4800, price_aed: 6900000, agent_id: 'ag22', amenities: ['m-private-pool','m-garden','m-security','m-maid','m-aircon'], description: 'Independent villa on a corner plot, walking distance to Mall of the Emirates.' });
  pushListing({ title: 'Al Barsha South — 2BR Studio Loft',                        area_id: 'a-barsha',   type: 'apartment',  beds: 2, baths: 2, sqft: 1300, price_aed: 1450000, agent_id: 'ag23', amenities: ['m-pool','m-gym','m-parking','m-balcony','m-aircon'], description: 'Modern loft-style 2BR with double-height living area.' });
  pushListing({ title: 'The Onyx — 3BR Apartment',                                 area_id: 'a-barsha',   type: 'apartment',  beds: 3, baths: 4, sqft: 1800, price_aed: 75000,  transaction: 'rent', agent_id: 'ag23', amenities: ['m-pool','m-gym','m-parking','m-balcony','m-aircon'], description: '3BR plus maid\'s in The Onyx towers, walk to metro.' });

  // Additional listings to reach ~70
  pushListing({ title: 'Marina Heights — 1BR Furnished',                           area_id: 'a-marina',   type: 'apartment',  beds: 1, baths: 2, sqft: 920, price_aed: 1320000, agent_id: 'ag02', amenities: ['m-pool','m-gym','m-parking','m-furnished','m-balcony','m-aircon','m-walkable'], description: 'Mid-floor 1BR with marina view, fully furnished by previous owner.' });
  pushListing({ title: 'Trident Grand — 3BR Sea View',                             area_id: 'a-marina',   type: 'apartment',  beds: 3, baths: 4, sqft: 1980, price_aed: 4250000, agent_id: 'ag03', amenities: ['m-pool','m-gym','m-parking','m-security','m-balcony','m-seaview','m-marina-v','m-aircon'], description: 'Full-sea view 3BR overlooking JBR beach.' });
  pushListing({ title: 'Boulevard Plaza 1 — 2BR Downtown',                         area_id: 'a-downtown', type: 'apartment',  beds: 2, baths: 3, sqft: 1480, price_aed: 2850000, agent_id: 'ag06', amenities: ['m-pool','m-gym','m-parking','m-balcony','m-burj','m-walkable','m-aircon'], description: '2BR on the boulevard with Burj Khalifa view.' });
  pushListing({ title: 'Opera Grand — 4BR Penthouse',                              area_id: 'a-downtown', type: 'penthouse',  beds: 4, baths: 5, sqft: 4200, price_aed: 18500000, agent_id: 'ag10', premium: true, amenities: ['m-pool','m-gym','m-parking','m-security','m-balcony','m-burj','m-maid','m-private-pool','m-rooftop','m-concierge','m-aircon'], description: 'Opera District penthouse with private rooftop terrace and pool.' });
  pushListing({ title: 'Atlantis Royal Tower — 1BR Sea View',                      area_id: 'a-palm',     type: 'apartment',  beds: 1, baths: 2, sqft: 1100, price_aed: 4800000, agent_id: 'ag10', amenities: ['m-pool','m-gym','m-parking','m-security','m-balcony','m-seaview','m-beach','m-concierge','m-spa','m-aircon'], description: 'Atlantis Royal one-bedroom with full sea view.' });
  pushListing({ title: 'FIVE Palm — Studio for Rent',                              area_id: 'a-palm',     type: 'studio',     beds: 0, baths: 1, sqft: 580, price_aed: 165000, transaction: 'rent', furnished: true, agent_id: 'ag09', amenities: ['m-pool','m-gym','m-parking','m-furnished','m-beach','m-concierge','m-aircon'], description: 'Furnished serviced studio at FIVE Palm with hotel access.' });
  pushListing({ title: 'Rimal 2 — 1BR for Rent',                                   area_id: 'a-jbr',      type: 'apartment',  beds: 1, baths: 2, sqft: 850, price_aed: 88000, transaction: 'rent', agent_id: 'ag12', amenities: ['m-pool','m-gym','m-parking','m-balcony','m-beach','m-aircon'], description: '1BR on the JBR side, available for annual rental.' });
  pushListing({ title: 'Vida Residences Dubai Mall — 2BR',                         area_id: 'a-downtown', type: 'apartment',  beds: 2, baths: 3, sqft: 1450, price_aed: 4500000, agent_id: 'ag06', featured: true, amenities: ['m-pool','m-gym','m-parking','m-security','m-balcony','m-burj','m-concierge','m-aircon','m-walkable'], description: 'Direct mall access 2BR with Burj fountain view.' });
  pushListing({ title: 'DT1 by Ellington — 1BR',                                   area_id: 'a-downtown', type: 'apartment',  beds: 1, baths: 2, sqft: 780, price_aed: 1850000, agent_id: 'ag11', amenities: ['m-pool','m-gym','m-parking','m-balcony','m-aircon','m-walkable'], description: 'Boutique boutique-tower 1BR with high-quality finishes.' });
  pushListing({ title: 'Reem Five Townhouse — 4BR',                                area_id: 'a-ranches',  type: 'townhouse',  beds: 4, baths: 5, sqft: 3100, price_aed: 4250000, agent_id: 'ag13', amenities: ['m-garden','m-security','m-kids','m-pool','m-aircon'], description: 'Reem 5 community townhouse, perfect for a young family.' });
  pushListing({ title: 'Casa Villa — 5BR Custom',                                  area_id: 'a-hills-em', type: 'villa',      beds: 5, baths: 7, sqft: 9200, price_aed: 48000000, agent_id: 'ag04', amenities: ['m-private-pool','m-garden','m-security','m-maid','m-bbq','m-cinema','m-spa','m-aircon'], description: 'Sector S architect-designed 5BR with full home automation.' });
  pushListing({ title: 'Springs 11 — 2BR Lake View',                               area_id: 'a-springs',  type: 'townhouse',  beds: 2, baths: 3, sqft: 1950, price_aed: 2650000, agent_id: 'ag05', amenities: ['m-garden','m-security','m-aircon','m-pool'], description: 'Type 4E with lake view from master bedroom.' });
  pushListing({ title: 'Park Point — 2BR for Rent',                                area_id: 'a-hills-est',type: 'apartment',  beds: 2, baths: 3, sqft: 1350, price_aed: 145000, transaction: 'rent', agent_id: 'ag15', amenities: ['m-pool','m-gym','m-parking','m-balcony','m-aircon'], description: 'Park-facing 2BR available for annual lease.' });
  pushListing({ title: 'Akoya Oxygen — 3BR Villa',                                 area_id: 'a-damac',    type: 'villa',      beds: 3, baths: 4, sqft: 2800, price_aed: 3200000, agent_id: 'ag18', amenities: ['m-private-pool','m-garden','m-security','m-aircon'], description: 'Newly handed-over Akoya Oxygen 3BR with private pool.' });
  pushListing({ title: 'Mira Oasis — 3BR Townhouse',                               area_id: 'a-ranches',  type: 'townhouse',  beds: 3, baths: 4, sqft: 2100, price_aed: 2950000, agent_id: 'ag14', amenities: ['m-garden','m-security','m-pool','m-kids','m-aircon'], description: 'Reem-style mira oasis 3BR townhouse, end unit.' });
  pushListing({ title: 'Botanica Tower — 1BR Marina',                              area_id: 'a-marina',   type: 'apartment',  beds: 1, baths: 2, sqft: 960, price_aed: 1550000, agent_id: 'ag01', amenities: ['m-pool','m-gym','m-parking','m-balcony','m-marina-v','m-walkable','m-aircon'], description: 'Mid-floor 1BR with full Marina view and large balcony.' });

  // ===================== CUSTOMERS =====================
  function customer(id, name, email, joined, locale, currency, favs, saved, mortgage) {
    return {
      id: id, name: name, email: email, joined: joined, locale: locale, currency: currency,
      favorites: favs || [], saved_searches: saved || [], mortgage_scenarios: mortgage || [],
      notification_prefs: { email: true, push: true, sms: false }
    };
  }
  var CUSTOMERS = [
    customer('c01', 'Demo Customer',     'demo@manzil.ae',      '2025-08-12', 'en', 'AED', ['L001','L008','L012'], [{ id:'s1', q:'2BR Marina under 2M', when:'2026-04-12' }], [{ id:'m1', price: 2400000, down: 25, rate: 4.5, years: 25 }]),
    customer('c02', 'James Anderson',    'j.anderson@email.com','2024-03-05', 'en', 'GBP', ['L015'], [], []),
    customer('c03', 'Aisha Al-Mansoori', 'aisha.m@email.com',   '2023-11-22', 'ar', 'AED', ['L020','L033'], [], []),
    customer('c04', 'Vikram Patel',      'vikram@email.com',    '2024-06-18', 'en', 'AED', ['L007'], [], []),
    customer('c05', 'Sophia Rossi',      'sophia.r@email.com',  '2025-01-09', 'en', 'EUR', [], [{ id:'s2', q:'Palm villa', when:'2026-03-22' }], []),
    customer('c06', 'Lucas Wang',        'lwang@email.com',     '2024-09-14', 'en', 'USD', ['L011'], [], []),
    customer('c07', 'Hassan Ibrahim',    'hassan@email.com',    '2024-12-01', 'ar', 'AED', ['L042'], [], []),
    customer('c08', 'Emily Carter',      'emily.c@email.com',   '2025-04-30', 'en', 'GBP', ['L001'], [], []),
    customer('c09', 'Dmitri Sokolov',    'dmitri@email.com',    '2024-02-18', 'en', 'USD', ['L013','L016'], [], []),
    customer('c10', 'Mira Choudhury',    'mira.c@email.com',    '2025-06-25', 'en', 'AED', [], [], []),
    customer('c11', 'Khalid Al-Hashimi', 'khalid@email.com',    '2023-08-04', 'ar', 'AED', ['L050'], [], []),
    customer('c12', 'Sarah Brown',       'sarah.b@email.com',   '2025-09-11', 'en', 'GBP', ['L024'], [], []),
    customer('c13', 'Chen Wei',          'chen.w@email.com',    '2024-11-07', 'en', 'USD', [], [], []),
    customer('c14', 'Fatima El-Sayed',   'fatima@email.com',    '2024-05-20', 'ar', 'AED', ['L038'], [], []),
    customer('c15', 'Hugo Müller',       'hugo.m@email.com',    '2025-03-15', 'en', 'EUR', ['L040'], [], []),
    customer('c16', 'Yuki Tanaka',       'yuki@email.com',      '2024-07-29', 'en', 'USD', [], [], []),
    customer('c17', 'Tariq Khan',        'tariq.k@email.com',   '2023-10-13', 'en', 'AED', ['L046','L053'], [], []),
    customer('c18', 'Lina Voss',         'lina.v@email.com',    '2025-02-04', 'en', 'EUR', [], [], [])
  ];

  // ===================== INQUIRIES =====================
  var INQUIRY_STATUSES = ['new', 'contacted', 'scheduled', 'negotiating', 'won', 'lost'];
  var INQUIRY_KINDS = ['call', 'whatsapp', 'email', 'callback', 'viewing'];
  var INQUIRIES = [];
  for (var i = 1; i <= 40; i++) {
    var l = LISTINGS[(i * 7) % LISTINGS.length];
    var c = CUSTOMERS[i % CUSTOMERS.length];
    INQUIRIES.push({
      id: 'I' + String(i).padStart(3, '0'),
      listing_id: l.id, agent_id: l.agent_id, customer_id: c.id,
      kind: INQUIRY_KINDS[i % INQUIRY_KINDS.length],
      status: INQUIRY_STATUSES[i % INQUIRY_STATUSES.length],
      name: c.name, email: c.email, phone: '+971 50 ' + (1000000 + i * 137).toString().slice(0, 7),
      message: 'Interested in this property. Please reach out at your convenience.',
      messages: [
        { from: 'customer', body: 'Is this still available?', when: new Date(Date.now() - (i * 86400000 / 2)).toISOString() },
        i > 12 ? { from: 'agent', body: 'Yes — happy to arrange a viewing. When suits you?', when: new Date(Date.now() - (i * 86400000 / 3)).toISOString() } : null
      ].filter(Boolean),
      notes: i > 24 ? [{ author: 'admin', body: 'Customer is a serious buyer, fast-track', when: new Date(Date.now() - i * 86400000 / 4).toISOString() }] : [],
      created_at: new Date(Date.now() - i * 86400000 / 2).toISOString()
    });
  }

  // ===================== VIEWINGS =====================
  var VIEWING_STATUSES = ['pending', 'confirmed', 'done', 'cancelled'];
  var VIEWINGS = [];
  for (var v = 1; v <= 20; v++) {
    var ll = LISTINGS[(v * 11) % LISTINGS.length];
    var cc = CUSTOMERS[v % CUSTOMERS.length];
    var future = (v * 3) % 14;
    VIEWINGS.push({
      id: 'V' + String(v).padStart(3, '0'),
      listing_id: ll.id, agent_id: ll.agent_id, customer_id: cc.id,
      scheduled_at: new Date(Date.now() + future * 86400000 + (10 + v % 8) * 3600000).toISOString(),
      duration_min: 30,
      status: VIEWING_STATUSES[v % VIEWING_STATUSES.length],
      notes: v % 4 === 0 ? 'Bring brochure and floor plan' : ''
    });
  }

  // ===================== REVIEWS =====================
  var REVIEWS = [];
  var REVIEW_BODIES = [
    'Smooth process, agent was responsive throughout.',
    'Helpful, knowledgeable, and made the move easy.',
    'Quick replies and showed us multiple options.',
    'Professional service, will use again.',
    'Closed the deal in under 2 weeks.',
    'Great negotiation, saved us money.',
    'Honest and transparent about pricing.',
    'Helped us understand the area thoroughly.',
    'Easy paperwork, no surprises.',
    'Excellent communication and follow-up.'
  ];
  for (var r = 1; r <= 60; r++) {
    var ag = AGENTS[r % AGENTS.length];
    var cu = CUSTOMERS[r % CUSTOMERS.length];
    REVIEWS.push({
      id: 'R' + String(r).padStart(3, '0'),
      agent_id: ag.id, customer_id: cu.id,
      rating: 4 + ((r * 7) % 3) / 2,
      title: ['Great experience', 'Highly recommend', 'Smooth process', 'Knowledgeable', 'Trustworthy'][r % 5],
      body: REVIEW_BODIES[r % REVIEW_BODIES.length],
      date: new Date(Date.now() - r * 86400000 * 2).toISOString()
    });
  }

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
      'nav.buy': 'Buy', 'nav.rent': 'Rent', 'nav.offplan': 'New Projects', 'nav.agents': 'Agents', 'nav.areas': 'Areas', 'nav.mortgage': 'Mortgage',
      'search.placeholder.location': 'Area, building, project...',
      'search.cta': 'Search',
      'search.type.any': 'Any type', 'search.beds.any': 'Beds', 'search.beds.studio': 'Studio',
      'search.price.any': 'Any price', 'search.price.min': 'Min price', 'search.price.max': 'Max price',
      'tab.buy': 'Buy', 'tab.rent': 'Rent', 'tab.offplan': 'Off-plan',
      'home.featured': 'Featured listings', 'home.trending': 'Trending searches', 'home.areas': 'Browse by area', 'home.agents': 'Top agents', 'home.why': 'Why Manzil', 'home.recent': 'Recently viewed',
      'fav.added': 'Saved to favorites', 'fav.removed': 'Removed from favorites'
    },
    ar: {
      'nav.buy': 'شراء', 'nav.rent': 'إيجار', 'nav.offplan': 'مشاريع جديدة', 'nav.agents': 'الوكلاء', 'nav.areas': 'المناطق', 'nav.mortgage': 'تمويل',
      'search.placeholder.location': 'منطقة، مبنى، مشروع...',
      'search.cta': 'بحث',
      'search.type.any': 'أي نوع', 'search.beds.any': 'غرف نوم', 'search.beds.studio': 'استوديو',
      'search.price.any': 'أي سعر', 'search.price.min': 'أقل سعر', 'search.price.max': 'أعلى سعر',
      'tab.buy': 'شراء', 'tab.rent': 'إيجار', 'tab.offplan': 'على المخطط',
      'home.featured': 'العروض المميزة', 'home.trending': 'بحوث رائجة', 'home.areas': 'تصفح حسب المنطقة', 'home.agents': 'أفضل الوكلاء', 'home.why': 'لماذا منزل', 'home.recent': 'شوهدت مؤخرا',
      'fav.added': 'تم الحفظ في المفضلة', 'fav.removed': 'تمت الإزالة من المفضلة'
    }
  };

  // ===================== EXPOSE =====================
  window.MANZIL_DATA = {
    AREAS: AREAS,
    AMENITIES: AMENITIES,
    AGENCIES: AGENCIES,
    AGENTS: AGENTS,
    LISTINGS: LISTINGS,
    CUSTOMERS: CUSTOMERS,
    INQUIRIES: INQUIRIES,
    VIEWINGS: VIEWINGS,
    REVIEWS: REVIEWS,
    CURRENCIES: CURRENCIES,
    I18N: I18N,
    PHOTO_POOL: PHOTO_POOL
  };
})();
