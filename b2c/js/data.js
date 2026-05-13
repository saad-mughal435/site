/* =========================================================
   Pebble & Co. - seed data for the disconnected demo
   All names, copy, and prices are fabricated. No real brands.
   ========================================================= */
(function () {
  'use strict';

  const today = new Date('2026-05-14');
  const daysAgo = (n) => { const d = new Date(today); d.setDate(d.getDate() - n); return d.toISOString(); };

  const CATEGORIES = [
    { slug: 'audio',       name: 'Audio',       blurb: 'Headphones, speakers, and listening rooms.',         icon: '⏵', palette: ['#f15a3a', '#ffd4c4'] },
    { slug: 'wearables',   name: 'Wearables',   blurb: 'Watches, rings, and quiet tech you live with.',     icon: '◐', palette: ['#3a6b54', '#cfe3d6'] },
    { slug: 'home',        name: 'Home',        blurb: 'Lamps, candles, textiles. Soft architecture.',      icon: '◇', palette: ['#c89b5a', '#f6e4cc'] },
    { slug: 'accessories', name: 'Accessories', blurb: 'Carry-ons, small leather goods, and odds you need.', icon: '◈', palette: ['#7c4a8a', '#e6d4ee'] },
  ];

  const PRODUCTS = [
    /* ---- Audio ---- */
    { id: 'p-001', slug: 'bloom-earbuds', name: 'Bloom Earbuds', category: 'audio',
      price: 129, compare_at: 149, rating: 4.7, review_count: 248, stock: 23, featured: true,
      short_desc: 'Compact, all-day buds with active noise control.',
      description: 'Three small mics per side and a soft-touch silicone tip. Eight hours of listening per charge, twenty-four more in the case. Pair them once, forget about them.',
      features: ['Active noise control', '8h playback + 24h case', 'USB-C + wireless charging', 'IPX4 splash resistant', 'Multipoint to two devices'],
      specs: { weight_per_bud: '4.5 g', driver: '11 mm dynamic', codecs: 'AAC, SBC, LC3', case_weight: '38 g', warranty: '2 years' },
      variants: [
        { id: 'v1', name: 'Sand',     hex: '#e6d3b3', stock: 9 },
        { id: 'v2', name: 'Charcoal', hex: '#272524', stock: 12 },
        { id: 'v3', name: 'Coral',    hex: '#f15a3a', stock: 2 },
      ],
      tags: ['bestseller', 'noise-control'], related: ['p-002', 'p-005', 'p-003'],
      palette: ['#f15a3a', '#ffd4c4'] },

    { id: 'p-002', slug: 'hush-headphones', name: 'Hush Over-Ear Headphones', category: 'audio',
      price: 249, compare_at: null, rating: 4.8, review_count: 419, stock: 14, featured: true,
      short_desc: 'Wool-blend cups, vegetable-tanned headband. Built to wear all day.',
      description: 'A 40 mm dynamic driver tuned for long sessions. Wool-felt earpads instead of pleather. A vegetable-tanned headband that breaks in like a good boot.',
      features: ['40 mm dynamic driver', 'Active noise control', '36h battery', 'Bluetooth 5.3 + USB-C audio', 'Replaceable pads'],
      specs: { weight: '298 g', driver: '40 mm dynamic', impedance: '32 ohm', battery: '36 h', warranty: '3 years' },
      variants: [
        { id: 'v1', name: 'Bone',     hex: '#ede4d6', stock: 6 },
        { id: 'v2', name: 'Charcoal', hex: '#272524', stock: 8 },
      ],
      tags: ['premium', 'wool-blend'], related: ['p-001', 'p-003', 'p-006'],
      palette: ['#c89b5a', '#f6e4cc'] },

    { id: 'p-003', slug: 'echo-speaker', name: 'Echo Tabletop Speaker', category: 'audio',
      price: 179, compare_at: null, rating: 4.5, review_count: 132, stock: 27,
      short_desc: 'A small room speaker that fills the room.',
      description: 'Front-firing tweeter, downward bass radiator. Linen-wrapped grille. Sounds bigger than it has any right to.',
      features: ['Stereo pairing', 'Wi-Fi + Bluetooth', 'Multi-room audio', 'Touch top controls', 'Recycled aluminium body'],
      specs: { weight: '1.4 kg', power: '40 W RMS', drivers: 'tweeter + woofer', height: '186 mm', warranty: '2 years' },
      variants: [
        { id: 'v1', name: 'Oat',      hex: '#d8c9aa', stock: 14 },
        { id: 'v2', name: 'Slate',    hex: '#3d3f3e', stock: 13 },
      ],
      tags: ['stereo-pair'], related: ['p-002', 'p-004', 'p-005'],
      palette: ['#f15a3a', '#ffd4c4'] },

    { id: 'p-004', slug: 'reed-soundbar', name: 'Reed Soundbar', category: 'audio',
      price: 299, compare_at: 349, rating: 4.6, review_count: 86, stock: 9,
      short_desc: 'Slim soundbar for rooms that should sound bigger.',
      description: 'Eight drivers, four passive radiators, and a quiet sub built in. No subwoofer cable to hide. HDMI eARC + optical.',
      features: ['Dolby Atmos profile', 'HDMI eARC', 'Built-in sub', 'Voice clarity mode', 'Night mode'],
      specs: { length: '880 mm', drivers: '8 + 4 passive', power: '180 W RMS', inputs: 'HDMI eARC, optical, BT', warranty: '2 years' },
      variants: [
        { id: 'v1', name: 'Charcoal', hex: '#272524', stock: 9 },
      ],
      tags: ['sale', 'home-theatre'], related: ['p-003', 'p-005'],
      palette: ['#f15a3a', '#ffd4c4'] },

    { id: 'p-005', slug: 'wave-mini', name: 'Wave Mini Speaker', category: 'audio',
      price: 79, compare_at: null, rating: 4.4, review_count: 311, stock: 41,
      short_desc: 'Pocketable, weirdly loud, surprisingly waterproof.',
      description: 'Twelve hours per charge. IP67. Strap loop for the hand or a backpack. Pair two for stereo.',
      features: ['12h battery', 'IP67 dust + water', 'USB-C charge', 'Stereo pairing', 'Built-in mic for calls'],
      specs: { weight: '320 g', driver: '52 mm full-range', battery: '12 h', dust_water: 'IP67', warranty: '1 year' },
      variants: [
        { id: 'v1', name: 'Coral',    hex: '#f15a3a', stock: 18 },
        { id: 'v2', name: 'Oat',      hex: '#d8c9aa', stock: 13 },
        { id: 'v3', name: 'Moss',     hex: '#5c7c4f', stock: 10 },
      ],
      tags: ['portable', 'bestseller'], related: ['p-001', 'p-003'],
      palette: ['#3a6b54', '#cfe3d6'] },

    { id: 'p-006', slug: 'drift-turntable', name: 'Drift Belt-Drive Turntable', category: 'audio',
      price: 399, compare_at: null, rating: 4.7, review_count: 64, stock: 7,
      short_desc: 'A starter deck that grows up well.',
      description: 'Belt-driven, pre-fitted MM cartridge, built-in phono pre-amp you can switch off when you outgrow it. Two speeds. Replaceable headshell.',
      features: ['33 / 45 RPM', 'Built-in phono pre-amp', 'Replaceable cartridge', 'Anti-skate adjustment', 'Wool turntable mat'],
      specs: { weight: '5.2 kg', cartridge: 'MM pre-fitted', dimensions: '420 x 350 x 110 mm', warranty: '2 years' },
      variants: [
        { id: 'v1', name: 'Walnut',   hex: '#6d4a30', stock: 4 },
        { id: 'v2', name: 'Bone',     hex: '#ede4d6', stock: 3 },
      ],
      tags: ['premium'], related: ['p-002', 'p-003'],
      palette: ['#c89b5a', '#f6e4cc'] },

    /* ---- Wearables ---- */
    { id: 'p-007', slug: 'loop-watch', name: 'Loop Watch', category: 'wearables',
      price: 199, compare_at: null, rating: 4.5, review_count: 198, stock: 19, featured: true,
      short_desc: 'A quiet smart-watch. Heart rate, sleep, and not much else.',
      description: 'Sapphire crystal, anodized aluminium case, soft fluoro-elastomer band. Two-week battery. Notifications optional. Workouts auto-detected.',
      features: ['14-day battery', 'Heart rate + SpO2', 'Sleep stages', 'Auto-workout detect', 'Sapphire crystal'],
      specs: { case_size: '40 mm', weight: '32 g', water: '5 ATM', display: 'AMOLED 1.32"', warranty: '2 years' },
      variants: [
        { id: 'v1', name: 'Steel',    hex: '#9aa1a8', stock: 7 },
        { id: 'v2', name: 'Bronze',   hex: '#a07042', stock: 6 },
        { id: 'v3', name: 'Graphite', hex: '#3a3a3a', stock: 6 },
      ],
      tags: ['bestseller'], related: ['p-008', 'p-010'],
      palette: ['#3a6b54', '#cfe3d6'] },

    { id: 'p-008', slug: 'shore-band', name: 'Shore Watch Band', category: 'wearables',
      price: 39, compare_at: null, rating: 4.6, review_count: 412, stock: 86,
      short_desc: 'Spare band in five colors. Quick-release pins.',
      description: 'Soft fluoro-elastomer with stainless quick-release pins. Replace in seconds. Fits the Loop Watch.',
      features: ['Quick-release', 'Hypoallergenic', 'Machine washable', 'Five colors', 'Fits 40 mm case'],
      specs: { material: 'fluoro-elastomer', closure: 'tang buckle', sizes: 'S / M / L', warranty: '1 year' },
      variants: [
        { id: 'v1', name: 'Sand',  hex: '#e6d3b3', stock: 20 },
        { id: 'v2', name: 'Coral', hex: '#f15a3a', stock: 18 },
        { id: 'v3', name: 'Moss',  hex: '#5c7c4f', stock: 17 },
        { id: 'v4', name: 'Slate', hex: '#3d3f3e', stock: 16 },
        { id: 'v5', name: 'Bone',  hex: '#ede4d6', stock: 15 },
      ],
      tags: ['affordable'], related: ['p-007'],
      palette: ['#3a6b54', '#cfe3d6'] },

    { id: 'p-009', slug: 'glow-ring', name: 'Glow Sleep Ring', category: 'wearables',
      price: 149, compare_at: null, rating: 4.3, review_count: 87, stock: 21,
      short_desc: 'Track sleep without a screen on your wrist all night.',
      description: 'A titanium ring with infrared sensors. No display, no notifications. Companion app shows sleep stages, readiness, and resting heart rate.',
      features: ['No-display tracking', '5-day battery', 'Titanium body', 'Sleep + readiness + HRV', 'IP68 water resistant'],
      specs: { material: 'titanium', weight: '4.5 g', battery: '5 days', sizes: '6-13 US', warranty: '2 years' },
      variants: [
        { id: 'v1', name: 'Brushed',  hex: '#9aa1a8', stock: 10 },
        { id: 'v2', name: 'Matte black', hex: '#1f1f1f', stock: 11 },
      ],
      tags: ['discreet'], related: ['p-007', 'p-010'],
      palette: ['#3a6b54', '#cfe3d6'] },

    { id: 'p-010', slug: 'mist-tracker', name: 'Mist Fitness Tracker', category: 'wearables',
      price: 99, compare_at: 119, rating: 4.2, review_count: 156, stock: 33,
      short_desc: 'The basics, done right, under a hundred.',
      description: 'Steps, heart rate, workouts, sleep. Two-week battery. No subscription. Pairs over Bluetooth.',
      features: ['14-day battery', 'GPS-connected', 'Heart rate', 'Sleep stages', 'No subscription'],
      specs: { weight: '24 g', display: 'AMOLED 1.1"', water: '5 ATM', warranty: '1 year' },
      variants: [
        { id: 'v1', name: 'Charcoal', hex: '#272524', stock: 18 },
        { id: 'v2', name: 'Coral',    hex: '#f15a3a', stock: 15 },
      ],
      tags: ['sale', 'starter'], related: ['p-007', 'p-009'],
      palette: ['#3a6b54', '#cfe3d6'] },

    { id: 'p-011', slug: 'hush-sleep-mask', name: 'Hush Heated Sleep Mask', category: 'wearables',
      price: 59, compare_at: null, rating: 4.6, review_count: 244, stock: 28,
      short_desc: 'Heat, dim, and silence. Fall asleep faster.',
      description: 'Memory-foam contour, gentle heat, white-noise speakers around the ear. Three timers. USB-C charging.',
      features: ['3 heat settings', 'White-noise speakers', 'Timer 15 / 30 / 60', 'Removable washable cover', 'USB-C'],
      specs: { weight: '180 g', battery: '8 h', material: 'organic cotton + memory foam', warranty: '1 year' },
      variants: [
        { id: 'v1', name: 'Bone', hex: '#ede4d6', stock: 14 },
        { id: 'v2', name: 'Moss', hex: '#5c7c4f', stock: 14 },
      ],
      tags: ['gift'], related: ['p-009', 'p-007'],
      palette: ['#3a6b54', '#cfe3d6'] },

    { id: 'p-012', slug: 'pulse-strap', name: 'Pulse Chest Strap', category: 'wearables',
      price: 79, compare_at: null, rating: 4.7, review_count: 91, stock: 16,
      short_desc: 'Heart-rate accuracy when wrist tracking is not enough.',
      description: 'Soft fabric strap. Bluetooth + ANT+. Replaceable battery. Works with every app.',
      features: ['Bluetooth + ANT+', '1-year battery', 'Replaceable cell', 'Fabric strap, machine washable', 'Open standard'],
      specs: { battery: 'CR2032 replaceable', sizes: 'S-M / M-XL', warranty: '1 year' },
      variants: [
        { id: 'v1', name: 'Charcoal', hex: '#272524', stock: 16 },
      ],
      tags: ['fitness'], related: ['p-007', 'p-010'],
      palette: ['#3a6b54', '#cfe3d6'] },

    /* ---- Home ---- */
    { id: 'p-013', slug: 'glow-lamp', name: 'Glow Bedside Lamp', category: 'home',
      price: 89, compare_at: null, rating: 4.5, review_count: 167, stock: 22, featured: true,
      short_desc: 'A lamp that knows what time it is.',
      description: 'Warm-shift dimming through the evening. Wakes up gradually in the morning. Touch top to dim or off. Plug it in and forget it.',
      features: ['Warm-shift dimming', 'Wake-light cycle', 'Touch dimmer', 'USB-C charging port', 'Companion app optional'],
      specs: { height: '220 mm', lumens: '450 max', color_temp: '1800-3000 K', warranty: '2 years' },
      variants: [
        { id: 'v1', name: 'Bone',   hex: '#ede4d6', stock: 11 },
        { id: 'v2', name: 'Sage',   hex: '#a8b89a', stock: 11 },
      ],
      tags: ['bestseller', 'gift'], related: ['p-014', 'p-018'],
      palette: ['#c89b5a', '#f6e4cc'] },

    { id: 'p-014', slug: 'stone-diffuser', name: 'Stone Essential-Oil Diffuser', category: 'home',
      price: 69, compare_at: null, rating: 4.4, review_count: 203, stock: 18,
      short_desc: 'Stone, ceramic, mist. No plastic anywhere.',
      description: 'A 200 ml ceramic well that ultrasonically diffuses oils for up to ten hours. Auto-off. Soft amber LED.',
      features: ['200 ml capacity', '10 h run-time', 'Auto-off', 'Ultrasonic, no heat', 'Ceramic + walnut'],
      specs: { capacity: '200 ml', noise: '< 18 dB', height: '160 mm', warranty: '1 year' },
      variants: [
        { id: 'v1', name: 'Bone',   hex: '#ede4d6', stock: 10 },
        { id: 'v2', name: 'Slate',  hex: '#3d3f3e', stock: 8 },
      ],
      tags: ['ceramic'], related: ['p-013', 'p-015'],
      palette: ['#c89b5a', '#f6e4cc'] },

    { id: 'p-015', slug: 'hearth-candle', name: 'Hearth Candle, Cedar + Smoke', category: 'home',
      price: 34, compare_at: null, rating: 4.8, review_count: 612, stock: 64,
      short_desc: '60-hour pour, hand-poured in small batches.',
      description: 'Soy + coconut wax. Cotton wick. The cedar comes from a sawmill in Oregon; the smoke note is leather plus a little birch.',
      features: ['60 h burn time', 'Soy + coconut wax', 'Cotton wick', 'Recyclable glass', 'Phthalate-free fragrance'],
      specs: { weight: '230 g', dimensions: '85 x 95 mm', warranty: 'no - it is a candle' },
      variants: [
        { id: 'v1', name: 'Cedar + Smoke',     hex: '#6d4a30', stock: 24 },
        { id: 'v2', name: 'Fig + Black Tea',   hex: '#3d2a35', stock: 20 },
        { id: 'v3', name: 'Salt + Driftwood',  hex: '#b8b0a0', stock: 20 },
      ],
      tags: ['gift', 'bestseller'], related: ['p-013', 'p-016', 'p-017'],
      palette: ['#c89b5a', '#f6e4cc'] },

    { id: 'p-016', slug: 'reed-vase', name: 'Reed Stoneware Vase', category: 'home',
      price: 49, compare_at: null, rating: 4.5, review_count: 89, stock: 31,
      short_desc: 'Hand-thrown stoneware. Three sizes, four glazes.',
      description: 'Thrown in a studio in Stoke-on-Trent. Reactive glaze; every piece is a little different. Food-safe; dishwasher-safe.',
      features: ['Hand-thrown', 'Food-safe glaze', 'Dishwasher-safe', 'Three sizes', 'Made in small batches'],
      specs: { height: '120 / 180 / 240 mm', material: 'stoneware', warranty: 'no replacements - one of a kind' },
      variants: [
        { id: 'v1', name: 'Sand',   hex: '#d8c9aa', stock: 11 },
        { id: 'v2', name: 'Sage',   hex: '#a8b89a', stock: 8 },
        { id: 'v3', name: 'Slate',  hex: '#3d3f3e', stock: 6 },
        { id: 'v4', name: 'Coral',  hex: '#f15a3a', stock: 6 },
      ],
      tags: ['handmade'], related: ['p-015', 'p-017'],
      palette: ['#c89b5a', '#f6e4cc'] },

    { id: 'p-017', slug: 'cove-throw', name: 'Cove Wool Throw', category: 'home',
      price: 119, compare_at: 149, rating: 4.7, review_count: 178, stock: 14,
      short_desc: 'Lambswool throw, woven on an old loom.',
      description: 'Made in a mill in the Scottish Borders. 100% lambswool, fringed ends, two-tone weave. Tucks over the foot of the bed or the back of a chair.',
      features: ['100% lambswool', 'Woven in Scotland', '130 x 180 cm', 'Two-tone weave', 'Hand wash, lay flat'],
      specs: { weight: '1.2 kg', dimensions: '130 x 180 cm', care: 'hand wash', warranty: '1 year' },
      variants: [
        { id: 'v1', name: 'Oat',   hex: '#d8c9aa', stock: 6 },
        { id: 'v2', name: 'Sage',  hex: '#a8b89a', stock: 4 },
        { id: 'v3', name: 'Rust',  hex: '#a4582a', stock: 4 },
      ],
      tags: ['sale', 'gift'], related: ['p-015', 'p-016'],
      palette: ['#c89b5a', '#f6e4cc'] },

    { id: 'p-018', slug: 'mist-humidifier', name: 'Mist Humidifier', category: 'home',
      price: 109, compare_at: null, rating: 4.4, review_count: 122, stock: 17,
      short_desc: 'A quiet humidifier in a ceramic body. Lasts the night.',
      description: '2.5 L capacity, ultrasonic, runs for ~20 hours on low. Top-fill - just pour water in. Auto-off when empty.',
      features: ['2.5 L capacity', '~20 h run-time', 'Top-fill', 'Auto-off when empty', 'BPA-free'],
      specs: { capacity: '2.5 L', noise: '< 25 dB', height: '280 mm', warranty: '2 years' },
      variants: [
        { id: 'v1', name: 'Bone',  hex: '#ede4d6', stock: 9 },
        { id: 'v2', name: 'Slate', hex: '#3d3f3e', stock: 8 },
      ],
      tags: ['quiet'], related: ['p-013', 'p-014'],
      palette: ['#c89b5a', '#f6e4cc'] },

    /* ---- Accessories ---- */
    { id: 'p-019', slug: 'field-tote', name: 'Field Tote', category: 'accessories',
      price: 89, compare_at: null, rating: 4.6, review_count: 207, stock: 28, featured: true,
      short_desc: 'Waxed canvas tote that lives in your trunk.',
      description: 'Waxed cotton canvas, leather handles, brass hardware. Inside pocket for a laptop sleeve. Holds a week of groceries or a day of beach.',
      features: ['Waxed canvas', 'Leather handles', 'Inside laptop pocket', 'Brass hardware', 'Repairable for life'],
      specs: { dimensions: '380 x 410 x 180 mm', weight: '780 g', capacity: '~18 L', warranty: 'lifetime repair' },
      variants: [
        { id: 'v1', name: 'Sand',   hex: '#d8c9aa', stock: 12 },
        { id: 'v2', name: 'Olive',  hex: '#5c5e3a', stock: 8 },
        { id: 'v3', name: 'Charcoal', hex: '#272524', stock: 8 },
      ],
      tags: ['bestseller', 'lifetime'], related: ['p-020', 'p-024'],
      palette: ['#7c4a8a', '#e6d4ee'] },

    { id: 'p-020', slug: 'pocket-wallet', name: 'Pocket Wallet', category: 'accessories',
      price: 69, compare_at: null, rating: 4.7, review_count: 314, stock: 39,
      short_desc: 'A small wallet for fewer cards.',
      description: 'Italian vegetable-tanned leather. Six card slots, one cash pocket, no extra space. Patinas with use.',
      features: ['Italian veg-tan leather', 'Six card slots', 'RFID block', 'Compact 95 x 110 mm', 'Hand-stitched'],
      specs: { dimensions: '95 x 110 mm', material: 'veg-tan leather', warranty: '2 years' },
      variants: [
        { id: 'v1', name: 'Tan',   hex: '#b07a3a', stock: 18 },
        { id: 'v2', name: 'Black', hex: '#1f1f1f', stock: 12 },
        { id: 'v3', name: 'Coral', hex: '#f15a3a', stock: 9 },
      ],
      tags: ['leather'], related: ['p-019', 'p-022'],
      palette: ['#7c4a8a', '#e6d4ee'] },

    { id: 'p-021', slug: 'crest-sunglasses', name: 'Crest Sunglasses', category: 'accessories',
      price: 129, compare_at: null, rating: 4.5, review_count: 142, stock: 24,
      short_desc: 'Polarised, acetate, made-to-last.',
      description: 'Hand-polished Italian acetate. Polarised glass lenses. Spring hinges. Five-barrel construction. Comes with a leather case and a microfibre cloth.',
      features: ['Polarised glass', 'Spring hinges', 'Italian acetate', 'Five-barrel build', 'Leather case included'],
      specs: { lens_size: '52 mm', bridge: '20 mm', material: 'acetate', warranty: '2 years' },
      variants: [
        { id: 'v1', name: 'Tortoise', hex: '#7a4a2a', stock: 10 },
        { id: 'v2', name: 'Black',    hex: '#1f1f1f', stock: 8 },
        { id: 'v3', name: 'Crystal',  hex: '#cfd6dc', stock: 6 },
      ],
      tags: ['polarised'], related: ['p-019', 'p-020'],
      palette: ['#7c4a8a', '#e6d4ee'] },

    { id: 'p-022', slug: 'loop-keychain', name: 'Loop Keychain', category: 'accessories',
      price: 24, compare_at: null, rating: 4.4, review_count: 188, stock: 73,
      short_desc: 'A solid-brass keychain you actually want to use.',
      description: 'Cast brass loop, machined screw-gate, leather pull. Develops a patina over time. Holds a lot of keys.',
      features: ['Solid brass', 'Screw-gate', 'Leather pull', 'Patinas with age', 'Replaceable parts'],
      specs: { weight: '32 g', material: 'brass + leather', warranty: '2 years' },
      variants: [
        { id: 'v1', name: 'Brass + Tan',    hex: '#b8862a', stock: 38 },
        { id: 'v2', name: 'Brass + Black',  hex: '#1f1f1f', stock: 35 },
      ],
      tags: ['affordable'], related: ['p-020', 'p-024'],
      palette: ['#7c4a8a', '#e6d4ee'] },

    { id: 'p-023', slug: 'cove-notebook', name: 'Cove A5 Notebook', category: 'accessories',
      price: 19, compare_at: null, rating: 4.6, review_count: 425, stock: 102,
      short_desc: 'Dot-grid, 192 pages, ribbons that match the cover.',
      description: 'Acid-free 100 gsm paper that handles fountain pens without bleed-through. Lay-flat binding. Two ribbon markers. Pocket inside the back cover.',
      features: ['100 gsm paper', 'Lay-flat binding', 'Dot-grid pages', '2 ribbon markers', '192 pages'],
      specs: { dimensions: 'A5', pages: 192, paper: '100 gsm', warranty: 'replacement on binding faults' },
      variants: [
        { id: 'v1', name: 'Bone',   hex: '#ede4d6', stock: 36 },
        { id: 'v2', name: 'Sage',   hex: '#a8b89a', stock: 34 },
        { id: 'v3', name: 'Slate',  hex: '#3d3f3e', stock: 32 },
      ],
      tags: ['affordable', 'gift'], related: ['p-020', 'p-022'],
      palette: ['#7c4a8a', '#e6d4ee'] },

    { id: 'p-024', slug: 'drift-cable-pack', name: 'Drift Cable Pack', category: 'accessories',
      price: 29, compare_at: null, rating: 4.5, review_count: 96, stock: 58,
      short_desc: 'Three braided cables in a small canvas pouch.',
      description: 'USB-C to USB-C, USB-C to Lightning, USB-C to USB-A. All 1 m, all braided, all matching. Canvas pouch keeps them untangled.',
      features: ['3 cables, all 1 m', 'Braided nylon', '100 W USB-C PD', 'MFi certified Lightning', 'Canvas carry pouch'],
      specs: { length: '1 m each', cables: 'C-C / C-Lightning / C-A', warranty: '2 years' },
      variants: [
        { id: 'v1', name: 'Sand',  hex: '#d8c9aa', stock: 30 },
        { id: 'v2', name: 'Charcoal', hex: '#272524', stock: 28 },
      ],
      tags: ['travel'], related: ['p-019', 'p-022'],
      palette: ['#7c4a8a', '#e6d4ee'] },
  ];

  /* ---- Reviews (3-5 per product, ~80 total) ---- */
  const REVIEW_AUTHORS = ['Alex P.', 'Jordan M.', 'Sam R.', 'Casey B.', 'Riley T.', 'Morgan E.', 'Avery S.', 'Quinn D.', 'Taylor F.', 'Jamie L.', 'Drew K.', 'Reese A.'];
  const REVIEW_TEXTS = {
    high: [
      'Honestly better than I expected. Battery is the headline for me.',
      'Buy this. The build quality is silly for the price.',
      'I have replaced two competing products with this. Worth it.',
      'The packaging alone tells you what kind of brand this is.',
      'My partner stole mine. Ordered another.',
      'I am picky and this clears the bar.',
    ],
    mid: [
      'Good, not life-changing. Solid for the money.',
      'Does the job. App could be better.',
      'Looks great, sounds fine. Would buy again.',
      'A small thing I appreciate every day.',
      'No complaints. It works.',
    ],
    low: [
      'Returned. The fit was not for me.',
      'Speaker started crackling after a month. Support helped though.',
      'Looks more premium online than in person.',
      'Wanted to love it. The app is the weak link.',
    ],
  };

  const REVIEWS = [];
  let reviewId = 1;
  PRODUCTS.forEach(p => {
    const count = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const score = Math.random() < 0.75 ? 5 : (Math.random() < 0.6 ? 4 : (Math.random() < 0.6 ? 3 : 2));
      const bucket = score >= 5 ? 'high' : score >= 3 ? 'mid' : 'low';
      const texts = REVIEW_TEXTS[bucket];
      REVIEWS.push({
        id: 'r-' + (reviewId++),
        product_id: p.id,
        author: REVIEW_AUTHORS[Math.floor(Math.random() * REVIEW_AUTHORS.length)],
        rating: score,
        title: score >= 5 ? 'Worth it.' : score >= 4 ? 'Recommended.' : score >= 3 ? 'OK.' : 'Not for me.',
        body: texts[Math.floor(Math.random() * texts.length)],
        date: daysAgo(Math.floor(Math.random() * 120)),
        verified: Math.random() > 0.2,
        helpful: Math.floor(Math.random() * 40),
      });
    }
  });

  /* ---- Customers (12) ---- */
  const CUSTOMERS = [
    { id: 'c-1', name: 'Demo Shopper', email: 'shopper@demo.local', joined: daysAgo(120), orders_count: 4,  lifetime_value: 612.45, points: 320, segment: 'returning', addresses: [
      { id: 'a1', label: 'Home', line1: '12 Demo Lane', city: 'Dubai', state: 'Dubai', zip: '00000', country: 'UAE', default: true },
    ]},
    { id: 'c-2', name: 'Alex Demo',       email: 'alex@demo.local',     joined: daysAgo(8),   orders_count: 1, lifetime_value: 129,    points: 12,  segment: 'new' },
    { id: 'c-3', name: 'Sample Customer', email: 'sample@demo.local',   joined: daysAgo(420), orders_count: 11, lifetime_value: 2104,  points: 980, segment: 'vip' },
    { id: 'c-4', name: 'Placeholder Buyer', email: 'placeholder@demo.local', joined: daysAgo(60), orders_count: 2, lifetime_value: 209, points: 60, segment: 'returning' },
    { id: 'c-5', name: 'Riley Sample',    email: 'riley@demo.local',    joined: daysAgo(15),  orders_count: 1, lifetime_value: 89,     points: 8,   segment: 'new' },
    { id: 'c-6', name: 'Casey Demo',      email: 'casey@demo.local',    joined: daysAgo(200), orders_count: 6, lifetime_value: 1180,   points: 540, segment: 'vip' },
    { id: 'c-7', name: 'Jordan Sample',   email: 'jordan@demo.local',   joined: daysAgo(45),  orders_count: 2, lifetime_value: 332,    points: 88,  segment: 'returning' },
    { id: 'c-8', name: 'Sam Placeholder', email: 'sam@demo.local',      joined: daysAgo(3),   orders_count: 1, lifetime_value: 249,    points: 24,  segment: 'new' },
    { id: 'c-9', name: 'Morgan Demo',     email: 'morgan@demo.local',   joined: daysAgo(310), orders_count: 8, lifetime_value: 1722,   points: 770, segment: 'vip' },
    { id: 'c-10', name: 'Taylor Sample',  email: 'taylor@demo.local',   joined: daysAgo(90),  orders_count: 3, lifetime_value: 387,    points: 110, segment: 'returning' },
    { id: 'c-11', name: 'Avery Demo',     email: 'avery@demo.local',    joined: daysAgo(150), orders_count: 4, lifetime_value: 612,    points: 220, segment: 'returning' },
    { id: 'c-12', name: 'Quinn Sample',   email: 'quinn@demo.local',    joined: daysAgo(540), orders_count: 14, lifetime_value: 2980,  points: 1430, segment: 'vip' },
  ];

  /* ---- Orders (30, mix of statuses, last 90 days) ---- */
  const ORDER_STATUSES = ['paid', 'fulfilled', 'shipped', 'delivered', 'cancelled', 'refunded'];
  const ORDERS = [];
  for (let i = 0; i < 30; i++) {
    const cust = CUSTOMERS[Math.floor(Math.random() * CUSTOMERS.length)];
    const lineCount = 1 + Math.floor(Math.random() * 3);
    const lines = [];
    let subtotal = 0;
    for (let j = 0; j < lineCount; j++) {
      const p = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
      const qty = 1 + Math.floor(Math.random() * 2);
      lines.push({ product_id: p.id, product_name: p.name, qty, unit_price: p.price, line_total: p.price * qty });
      subtotal += p.price * qty;
    }
    const shipping = subtotal >= 75 ? 0 : 8;
    const tax = +(subtotal * 0.05).toFixed(2);
    const total = +(subtotal + shipping + tax).toFixed(2);
    const status = ORDER_STATUSES[Math.floor(Math.random() * ORDER_STATUSES.length)];
    ORDERS.push({
      id: 'o-' + String(1000 + i),
      number: 'PBL-' + String(10000 + i),
      customer_id: cust.id,
      customer_name: cust.name,
      customer_email: cust.email,
      placed_at: daysAgo(Math.floor(Math.random() * 90)),
      status,
      lines,
      subtotal,
      shipping,
      tax,
      total,
      shipping_address: { line1: '12 Demo Lane', city: 'Sample City', country: 'Demo', zip: '00000' },
      payment_method: 'Card ****' + (1000 + Math.floor(Math.random() * 9000)),
    });
  }
  ORDERS.sort((a, b) => new Date(b.placed_at) - new Date(a.placed_at));

  /* ---- Promo codes ---- */
  const PROMO_CODES = [
    { code: 'DEMO10',   description: '10% off any order',          type: 'percent', value: 10,  uses: 142, expires: daysAgo(-90), active: true },
    { code: 'PEBBLE25', description: '25% off orders over $150',   type: 'percent', value: 25,  uses: 38,  expires: daysAgo(-30), active: true, min_subtotal: 150 },
    { code: 'FREESHIP', description: 'Free shipping no minimum',   type: 'shipping',value: 0,   uses: 287, expires: daysAgo(-180),active: true },
    { code: 'WELCOME15',description: '$15 off your first order',   type: 'fixed',   value: 15,  uses: 76,  expires: daysAgo(-60), active: true },
  ];

  /* ---- Currently signed-in user (auto-login) ---- */
  const CURRENT_USER = CUSTOMERS[0]; // Demo Shopper

  window.PEBBLE_DATA = {
    brand: {
      name: 'Pebble & Co.',
      tagline: 'Small things, beautifully made.',
      email: 'hello@pebbleandco.demo',
      phone: '+1 (555) 010-0123',
      free_shipping_threshold: 75,
      tax_rate: 0.05,
    },
    categories: CATEGORIES,
    products: PRODUCTS,
    reviews: REVIEWS,
    customers: CUSTOMERS,
    orders: ORDERS,
    promo_codes: PROMO_CODES,
    current_user: CURRENT_USER,
  };
})();
