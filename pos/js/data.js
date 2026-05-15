/* data.js - Qahwa POS seed data
   All products, prices, staff and orders are fabricated for the demo. */
(function () {
  'use strict';

  function ph(id, w) { return 'https://images.unsplash.com/photo-' + id + '?w=' + (w || 600) + '&q=80&auto=format'; }
  function pp(id, w) { return 'https://images.unsplash.com/photo-' + id + '?w=' + (w || 200) + '&q=80&auto=format&fit=crop&crop=faces'; }

  // ===================== CATEGORIES =====================
  var CATEGORIES = [
    { id: 'cat-coffee',     name: 'Coffee',       name_ar: 'قهوة',         icon: '☕', display_order: 1 },
    { id: 'cat-tea',        name: 'Tea',          name_ar: 'شاي',          icon: '🍵', display_order: 2 },
    { id: 'cat-cold',       name: 'Cold Drinks',  name_ar: 'مشروبات باردة', icon: '🧊', display_order: 3 },
    { id: 'cat-pastries',   name: 'Pastries',     name_ar: 'معجنات',       icon: '🥐', display_order: 4 },
    { id: 'cat-sandwiches', name: 'Sandwiches',   name_ar: 'سندويتشات',    icon: '🥪', display_order: 5 },
    { id: 'cat-snacks',     name: 'Snacks',       name_ar: 'وجبات خفيفة',  icon: '🍪', display_order: 6 },
    { id: 'cat-beans',      name: 'Beans',        name_ar: 'حبوب',         icon: '🫘', display_order: 7 },
    { id: 'cat-merch',      name: 'Merch',        name_ar: 'منتجات',       icon: '🎁', display_order: 8 }
  ];

  // ===================== MODIFIER GROUPS =====================
  var MODIFIER_GROUPS = [
    { id: 'mg-size', name: 'Size', type: 'single', required: true, options: [
      { id: 'size-s', label: 'Small (8oz)',  price_delta: 0 },
      { id: 'size-m', label: 'Medium (12oz)', price_delta: 4 },
      { id: 'size-l', label: 'Large (16oz)', price_delta: 8 }
    ]},
    { id: 'mg-milk', name: 'Milk', type: 'single', required: true, options: [
      { id: 'milk-dairy',   label: 'Whole dairy',  price_delta: 0 },
      { id: 'milk-skim',    label: 'Skim',         price_delta: 0 },
      { id: 'milk-oat',     label: 'Oat',          price_delta: 5 },
      { id: 'milk-almond',  label: 'Almond',       price_delta: 5 },
      { id: 'milk-soy',     label: 'Soy',          price_delta: 5 },
      { id: 'milk-lactose', label: 'Lactose-free', price_delta: 4 }
    ]},
    { id: 'mg-syrup', name: 'Syrups', type: 'multi', required: false, options: [
      { id: 'syr-vanilla',  label: 'Vanilla',  price_delta: 3 },
      { id: 'syr-caramel',  label: 'Caramel',  price_delta: 3 },
      { id: 'syr-hazelnut', label: 'Hazelnut', price_delta: 3 },
      { id: 'syr-toffee',   label: 'Toffee nut', price_delta: 3 }
    ]},
    { id: 'mg-extras', name: 'Extras', type: 'multi', required: false, options: [
      { id: 'ext-shot',    label: 'Extra shot',   price_delta: 6 },
      { id: 'ext-decaf',   label: 'Decaf',        price_delta: 0 },
      { id: 'ext-whipped', label: 'Whipped cream',price_delta: 4 },
      { id: 'ext-cinnamon',label: 'Cinnamon',     price_delta: 0 },
      { id: 'ext-honey',   label: 'Honey',        price_delta: 2 }
    ]}
  ];

  // ===================== PRODUCTS =====================
  // Helper to pin photos by seed id
  var P = function (i) { return ph(i); };
  var PRODUCTS = [
    // Coffee (~12)
    { id: 'p-espresso',         name: 'Espresso',          name_ar: 'إسبريسو',          category_id: 'cat-coffee', price_aed: 12, cost_aed: 3.5, photo: P('1510707577719-ae7c14805e3a'), modifier_group_ids: ['mg-size','mg-extras'], active: true },
    { id: 'p-double-espresso',  name: 'Double Espresso',   name_ar: 'دبل إسبريسو',      category_id: 'cat-coffee', price_aed: 16, cost_aed: 5.0, photo: P('1572442388796-11668a67e53d'), modifier_group_ids: ['mg-extras'], active: true },
    { id: 'p-americano',        name: 'Americano',         name_ar: 'أمريكانو',          category_id: 'cat-coffee', price_aed: 16, cost_aed: 4.0, photo: P('1497636577773-f1231844b336'), modifier_group_ids: ['mg-size','mg-extras'], active: true },
    { id: 'p-cappuccino',       name: 'Cappuccino',        name_ar: 'كابتشينو',          category_id: 'cat-coffee', price_aed: 20, cost_aed: 5.0, photo: P('1572442388796-11668a67e53d'), modifier_group_ids: ['mg-size','mg-milk','mg-syrup','mg-extras'], active: true },
    { id: 'p-latte',            name: 'Latte',             name_ar: 'لاتيه',             category_id: 'cat-coffee', price_aed: 20, cost_aed: 5.0, photo: P('1561882468-9110e03e0f78'), modifier_group_ids: ['mg-size','mg-milk','mg-syrup','mg-extras'], active: true },
    { id: 'p-flat-white',       name: 'Flat White',        name_ar: 'فلات وايت',         category_id: 'cat-coffee', price_aed: 22, cost_aed: 5.5, photo: P('1570968915860-54d5c301fa9f'), modifier_group_ids: ['mg-milk','mg-extras'], active: true },
    { id: 'p-mocha',            name: 'Mocha',             name_ar: 'موكا',              category_id: 'cat-coffee', price_aed: 24, cost_aed: 6.0, photo: P('1485808191679-5f86510681a2'), modifier_group_ids: ['mg-size','mg-milk','mg-extras'], active: true },
    { id: 'p-macchiato',        name: 'Caramel Macchiato', name_ar: 'كراميل ماكياتو',    category_id: 'cat-coffee', price_aed: 26, cost_aed: 6.0, photo: P('1485808191679-5f86510681a2'), modifier_group_ids: ['mg-size','mg-milk','mg-extras'], active: true },
    { id: 'p-turkish',          name: 'Turkish Coffee',    name_ar: 'قهوة تركية',        category_id: 'cat-coffee', price_aed: 18, cost_aed: 4.0, photo: P('1559925393-8be0ec4767c8'), modifier_group_ids: [], active: true },
    { id: 'p-arabic',           name: 'Arabic Coffee',     name_ar: 'قهوة عربية',        category_id: 'cat-coffee', price_aed: 16, cost_aed: 3.5, photo: P('1559925393-8be0ec4767c8'), modifier_group_ids: [], active: true },
    { id: 'p-cortado',          name: 'Cortado',           name_ar: 'كورتادو',           category_id: 'cat-coffee', price_aed: 18, cost_aed: 4.5, photo: P('1572442388796-11668a67e53d'), modifier_group_ids: ['mg-milk'], active: true },
    { id: 'p-spanish-latte',    name: 'Spanish Latte',     name_ar: 'لاتيه إسباني',      category_id: 'cat-coffee', price_aed: 24, cost_aed: 5.5, photo: P('1561882468-9110e03e0f78'), modifier_group_ids: ['mg-size','mg-milk'], active: true },

    // Tea (~5)
    { id: 'p-english-tea',      name: 'English Breakfast', name_ar: 'شاي إنجليزي',      category_id: 'cat-tea', price_aed: 14, cost_aed: 2.5, photo: P('1597481499750-3e6b22637e12'), modifier_group_ids: ['mg-extras'], active: true },
    { id: 'p-green-tea',        name: 'Green Tea',         name_ar: 'شاي أخضر',          category_id: 'cat-tea', price_aed: 14, cost_aed: 2.5, photo: P('1556679343-c7306c1976bc'), modifier_group_ids: ['mg-extras'], active: true },
    { id: 'p-mint-tea',         name: 'Moroccan Mint',     name_ar: 'شاي بالنعناع',      category_id: 'cat-tea', price_aed: 16, cost_aed: 3.0, photo: P('1556679343-c7306c1976bc'), modifier_group_ids: ['mg-extras'], active: true },
    { id: 'p-karak',            name: 'Karak Chai',        name_ar: 'كرك',               category_id: 'cat-tea', price_aed: 10, cost_aed: 2.0, photo: P('1597481499750-3e6b22637e12'), modifier_group_ids: [], active: true },
    { id: 'p-chamomile',        name: 'Chamomile',         name_ar: 'بابونج',            category_id: 'cat-tea', price_aed: 14, cost_aed: 2.5, photo: P('1556679343-c7306c1976bc'), modifier_group_ids: ['mg-extras'], active: true },

    // Cold drinks (~8)
    { id: 'p-iced-latte',       name: 'Iced Latte',        name_ar: 'لاتيه بارد',        category_id: 'cat-cold', price_aed: 22, cost_aed: 5.0, photo: P('1461023058943-07fcbe16d735'), modifier_group_ids: ['mg-size','mg-milk','mg-syrup'], active: true },
    { id: 'p-iced-americano',   name: 'Iced Americano',    name_ar: 'أمريكانو بارد',     category_id: 'cat-cold', price_aed: 18, cost_aed: 4.0, photo: P('1497935586351-b67a49e012bf'), modifier_group_ids: ['mg-size','mg-extras'], active: true },
    { id: 'p-cold-brew',        name: 'Cold Brew',         name_ar: 'كولد برو',          category_id: 'cat-cold', price_aed: 22, cost_aed: 5.0, photo: P('1517701604599-bb29b565090c'), modifier_group_ids: ['mg-size'], active: true },
    { id: 'p-frappuccino',      name: 'Caramel Frappé',    name_ar: 'فرابيه كراميل',     category_id: 'cat-cold', price_aed: 28, cost_aed: 6.5, photo: P('1572442388796-11668a67e53d'), modifier_group_ids: ['mg-size','mg-milk','mg-extras'], active: true },
    { id: 'p-mango-smoothie',   name: 'Mango Smoothie',    name_ar: 'سموثي مانجو',       category_id: 'cat-cold', price_aed: 22, cost_aed: 5.0, photo: P('1487700160041-babef9c3cb55'), modifier_group_ids: ['mg-size'], active: true },
    { id: 'p-lemon-mint',       name: 'Lemon Mint',        name_ar: 'ليمون نعناع',       category_id: 'cat-cold', price_aed: 18, cost_aed: 3.5, photo: P('1556679343-c7306c1976bc'), modifier_group_ids: [], active: true },
    { id: 'p-water',            name: 'Mineral Water',     name_ar: 'مياه',              category_id: 'cat-cold', price_aed: 6,  cost_aed: 1.5, photo: P('1559839734-2b71ea197ec2'), modifier_group_ids: [], active: true },
    { id: 'p-coke',             name: 'Coca-Cola',         name_ar: 'كوكاكولا',          category_id: 'cat-cold', price_aed: 8,  cost_aed: 2.0, photo: P('1554866585-cd94860890b7'), modifier_group_ids: [], active: true },

    // Pastries (~8)
    { id: 'p-croissant',        name: 'Butter Croissant',   name_ar: 'كرواسون',          category_id: 'cat-pastries', price_aed: 12, cost_aed: 3.5, photo: P('1555507036-ab1f4038808a'), modifier_group_ids: [], active: true },
    { id: 'p-pain-choc',        name: 'Pain au Chocolat',   name_ar: 'بان أو شوكولا',    category_id: 'cat-pastries', price_aed: 14, cost_aed: 4.0, photo: P('1509440159596-0249088772ff'), modifier_group_ids: [], active: true },
    { id: 'p-almond-croissant', name: 'Almond Croissant',   name_ar: 'كرواسون لوز',      category_id: 'cat-pastries', price_aed: 16, cost_aed: 4.5, photo: P('1555507036-ab1f4038808a'), modifier_group_ids: [], active: true },
    { id: 'p-cheese-danish',    name: 'Cheese Danish',      name_ar: 'دانماركية بالجبنة', category_id: 'cat-pastries', price_aed: 14, cost_aed: 4.0, photo: P('1509440159596-0249088772ff'), modifier_group_ids: [], active: true },
    { id: 'p-muffin-blueberry', name: 'Blueberry Muffin',   name_ar: 'مافن توت',         category_id: 'cat-pastries', price_aed: 12, cost_aed: 3.0, photo: P('1607958996333-41aef7caefaa'), modifier_group_ids: [], active: true },
    { id: 'p-banana-bread',     name: 'Banana Bread',       name_ar: 'خبز موز',          category_id: 'cat-pastries', price_aed: 14, cost_aed: 3.5, photo: P('1606101206196-3a0a0e5cfeb0'), modifier_group_ids: [], active: true },
    { id: 'p-cinnamon-roll',    name: 'Cinnamon Roll',      name_ar: 'سينابون',          category_id: 'cat-pastries', price_aed: 16, cost_aed: 4.0, photo: P('1509365390695-33aee754301f'), modifier_group_ids: [], active: true },
    { id: 'p-baklava',          name: 'Baklava (3pc)',      name_ar: 'بقلاوة',           category_id: 'cat-pastries', price_aed: 18, cost_aed: 5.0, photo: P('1555507036-ab1f4038808a'), modifier_group_ids: [], active: true },

    // Sandwiches (~6)
    { id: 'p-chicken-club',     name: 'Chicken Club',        name_ar: 'سندويش دجاج',    category_id: 'cat-sandwiches', price_aed: 36, cost_aed: 10, photo: P('1568901346375-23c9450c58cd'), modifier_group_ids: [], active: true },
    { id: 'p-halloumi',         name: 'Grilled Halloumi',    name_ar: 'حلوم مشوي',      category_id: 'cat-sandwiches', price_aed: 32, cost_aed: 9,  photo: P('1539252554935-80c8cabf1e57'), modifier_group_ids: [], active: true },
    { id: 'p-tuna-melt',        name: 'Tuna Melt',           name_ar: 'تونة بالجبنة',    category_id: 'cat-sandwiches', price_aed: 34, cost_aed: 9,  photo: P('1554200876-56c2f25224fa'), modifier_group_ids: [], active: true },
    { id: 'p-veggie-wrap',      name: 'Veggie Wrap',         name_ar: 'لفافة خضار',     category_id: 'cat-sandwiches', price_aed: 28, cost_aed: 7,  photo: P('1565299624946-b28f40a0ae38'), modifier_group_ids: [], active: true },
    { id: 'p-beef-shawarma',    name: 'Beef Shawarma',       name_ar: 'شاورما لحم',     category_id: 'cat-sandwiches', price_aed: 28, cost_aed: 8,  photo: P('1565299624946-b28f40a0ae38'), modifier_group_ids: [], active: true },
    { id: 'p-egg-mayo',         name: 'Egg & Mayo',          name_ar: 'بيض ومايونيز',    category_id: 'cat-sandwiches', price_aed: 24, cost_aed: 6,  photo: P('1554200876-56c2f25224fa'), modifier_group_ids: [], active: true },

    // Snacks (~6)
    { id: 'p-chocolate-cookie', name: 'Chocolate Chip Cookie', name_ar: 'كوكيز شوكولا',  category_id: 'cat-snacks', price_aed: 10, cost_aed: 2.5, photo: P('1499636136210-6f4ee915583e'), modifier_group_ids: [], active: true },
    { id: 'p-brownie',          name: 'Fudge Brownie',         name_ar: 'براوني',         category_id: 'cat-snacks', price_aed: 14, cost_aed: 3.5, photo: P('1606312619070-d48b4c652a52'), modifier_group_ids: [], active: true },
    { id: 'p-cheesecake',       name: 'NY Cheesecake',         name_ar: 'تشيز كيك',       category_id: 'cat-snacks', price_aed: 22, cost_aed: 5.5, photo: P('1567306226416-28f0efdc88ce'), modifier_group_ids: [], active: true },
    { id: 'p-tiramisu',         name: 'Tiramisu',              name_ar: 'تيراميسو',       category_id: 'cat-snacks', price_aed: 24, cost_aed: 6.0, photo: P('1571877227200-a0d98ea607e9'), modifier_group_ids: [], active: true },
    { id: 'p-mixed-nuts',       name: 'Mixed Nuts (small)',    name_ar: 'مكسرات',         category_id: 'cat-snacks', price_aed: 14, cost_aed: 4.0, photo: P('1488477181946-6428a0a36077'), modifier_group_ids: [], active: true },
    { id: 'p-dates',            name: 'Khalas Dates',          name_ar: 'تمر خلاص',       category_id: 'cat-snacks', price_aed: 18, cost_aed: 4.5, photo: P('1582547094030-1aff84c97826'), modifier_group_ids: [], active: true },

    // Beans (retail)
    { id: 'p-beans-250g',       name: 'Beans 250g (Yemen)',  name_ar: 'حبوب 250غ',       category_id: 'cat-beans', price_aed: 65, cost_aed: 28, photo: P('1559925393-8be0ec4767c8'), modifier_group_ids: [], active: true },
    { id: 'p-beans-1kg',        name: 'Beans 1kg (House blend)', name_ar: 'حبوب 1كغ',    category_id: 'cat-beans', price_aed: 180, cost_aed: 75, photo: P('1559925393-8be0ec4767c8'), modifier_group_ids: [], active: true },

    // Merch
    { id: 'p-mug',              name: 'Branded Mug',          name_ar: 'كوب',            category_id: 'cat-merch', price_aed: 45, cost_aed: 18, photo: P('1517256673644-36ad11246d21'), modifier_group_ids: [], active: true },
    { id: 'p-tumbler',          name: 'Reusable Tumbler',     name_ar: 'كوب قابل لإعادة الاستخدام', category_id: 'cat-merch', price_aed: 65, cost_aed: 24, photo: P('1517256673644-36ad11246d21'), modifier_group_ids: [], active: true }
  ];

  // ===================== STAFF =====================
  var STAFF = [
    { id: 'st-manager', name: 'Layla Hassan',  pin: '1234', role: 'manager',    photo: pp('1573497019940-1c28c88b4f3e') },
    { id: 'st-super',   name: 'Omar Al-Suwaidi', pin: '5678', role: 'supervisor', photo: pp('1500648767791-00dcc994a43e') },
    { id: 'st-cash-1',  name: 'Amani Khaled',  pin: '1111', role: 'cashier',    photo: pp('1494790108377-be9c29b29330') },
    { id: 'st-cash-2',  name: 'Zayed Ahmed',   pin: '2222', role: 'cashier',    photo: pp('1507003211169-0a1dd7228f2d') }
  ];

  // ===================== TABLES =====================
  var TABLES = [
    { id: 't1',  label: 'T1',  capacity: 2, position: { x: 1, y: 1 }, status: 'free' },
    { id: 't2',  label: 'T2',  capacity: 2, position: { x: 2, y: 1 }, status: 'seated' },
    { id: 't3',  label: 'T3',  capacity: 4, position: { x: 3, y: 1 }, status: 'free' },
    { id: 't4',  label: 'T4',  capacity: 4, position: { x: 4, y: 1 }, status: 'occupied' },
    { id: 't5',  label: 'T5',  capacity: 2, position: { x: 1, y: 2 }, status: 'free' },
    { id: 't6',  label: 'T6',  capacity: 6, position: { x: 2, y: 2 }, status: 'free' },
    { id: 't7',  label: 'T7',  capacity: 4, position: { x: 3, y: 2 }, status: 'dirty' },
    { id: 't8',  label: 'T8',  capacity: 2, position: { x: 4, y: 2 }, status: 'free' },
    { id: 't9',  label: 'B1',  capacity: 6, position: { x: 1, y: 3 }, status: 'free' },
    { id: 't10', label: 'B2',  capacity: 6, position: { x: 2, y: 3 }, status: 'occupied' },
    { id: 't11', label: 'Bar1',capacity: 1, position: { x: 3, y: 3 }, status: 'free' },
    { id: 't12', label: 'Bar2',capacity: 1, position: { x: 4, y: 3 }, status: 'seated' }
  ];

  // ===================== DISCOUNTS =====================
  var DISCOUNTS = [
    { id: 'd-opening5', code: 'OPENING5', type: 'pct', value: 5,  active: true,  min_total: 0,   expires_at: null,         label: 'Opening week 5% off' },
    { id: 'd-staff20',  code: 'STAFF20',  type: 'pct', value: 20, active: true,  min_total: 0,   expires_at: null,         label: 'Staff 20% off' },
    { id: 'd-newbie10', code: 'NEWBIE10', type: 'pct', value: 10, active: true,  min_total: 30,  expires_at: '2026-12-31', label: '10% off first order' },
    { id: 'd-bogo',     code: 'BOGO',     type: 'bogo',value: 0,  active: false, min_total: 0,   expires_at: '2026-12-31', label: 'Buy one get one free (paused)' }
  ];

  // ===================== INVENTORY =====================
  var INVENTORY = [
    { id: 'ing-beans-house', name: 'House blend beans',  unit: 'g',  on_hand: 28000, min_qty: 5000, cost_per_unit: 0.12 },
    { id: 'ing-beans-yemen', name: 'Yemen beans',        unit: 'g',  on_hand: 8000,  min_qty: 2000, cost_per_unit: 0.21 },
    { id: 'ing-milk-dairy',  name: 'Whole dairy milk',   unit: 'ml', on_hand: 24000, min_qty: 6000, cost_per_unit: 0.012 },
    { id: 'ing-milk-oat',    name: 'Oat milk',           unit: 'ml', on_hand: 8000,  min_qty: 2000, cost_per_unit: 0.025 },
    { id: 'ing-milk-almond', name: 'Almond milk',        unit: 'ml', on_hand: 6000,  min_qty: 2000, cost_per_unit: 0.024 },
    { id: 'ing-sugar',       name: 'Sugar',              unit: 'g',  on_hand: 14000, min_qty: 3000, cost_per_unit: 0.004 },
    { id: 'ing-vanilla',     name: 'Vanilla syrup',      unit: 'ml', on_hand: 2400,  min_qty: 500,  cost_per_unit: 0.14 },
    { id: 'ing-caramel',     name: 'Caramel syrup',      unit: 'ml', on_hand: 2200,  min_qty: 500,  cost_per_unit: 0.14 },
    { id: 'ing-hazelnut',    name: 'Hazelnut syrup',     unit: 'ml', on_hand: 1800,  min_qty: 500,  cost_per_unit: 0.14 },
    { id: 'ing-cup-8',       name: 'Cup 8oz',            unit: 'pcs',on_hand: 540,   min_qty: 200,  cost_per_unit: 0.35 },
    { id: 'ing-cup-12',      name: 'Cup 12oz',           unit: 'pcs',on_hand: 720,   min_qty: 200,  cost_per_unit: 0.45 },
    { id: 'ing-cup-16',      name: 'Cup 16oz',           unit: 'pcs',on_hand: 480,   min_qty: 200,  cost_per_unit: 0.55 },
    { id: 'ing-lid',         name: 'Lid',                unit: 'pcs',on_hand: 1700,  min_qty: 400,  cost_per_unit: 0.10 },
    { id: 'ing-croissant',   name: 'Croissant (frozen)', unit: 'pcs',on_hand: 48,    min_qty: 12,   cost_per_unit: 2.80 },
    { id: 'ing-muffin',      name: 'Muffin',             unit: 'pcs',on_hand: 22,    min_qty: 6,    cost_per_unit: 2.20 },
    { id: 'ing-cookie',      name: 'Cookie',             unit: 'pcs',on_hand: 60,    min_qty: 15,   cost_per_unit: 1.80 },
    { id: 'ing-chicken',     name: 'Chicken (kg)',       unit: 'g',  on_hand: 4200,  min_qty: 1000, cost_per_unit: 0.045 },
    { id: 'ing-halloumi',    name: 'Halloumi (kg)',      unit: 'g',  on_hand: 1800,  min_qty: 500,  cost_per_unit: 0.06 },
    { id: 'ing-bread',       name: 'Sandwich bread',     unit: 'pcs',on_hand: 80,    min_qty: 20,   cost_per_unit: 1.10 },
    { id: 'ing-napkins',     name: 'Napkins',            unit: 'pcs',on_hand: 1200,  min_qty: 300,  cost_per_unit: 0.02 }
  ];

  // ===================== ORDERS (~30 seed) =====================
  function makeLine(productId, qty, modifiers) {
    var prod = PRODUCTS.find(function (p) { return p.id === productId; });
    var modDelta = 0;
    (modifiers || []).forEach(function (mid) {
      MODIFIER_GROUPS.forEach(function (g) {
        var opt = g.options.find(function (o) { return o.id === mid; });
        if (opt) modDelta += opt.price_delta;
      });
    });
    var unit = (prod ? prod.price_aed : 0) + modDelta;
    return { id: 'ln-' + Math.random().toString(36).slice(2, 8), product_id: productId, qty: qty, modifiers: modifiers || [], unit_price: unit, line_total: unit * qty, ready: false };
  }
  function makeOrder(seed, opts) {
    var lines = opts.lines || [];
    var subtotal = lines.reduce(function (s, l) { return s + l.line_total; }, 0);
    var discount = opts.discount || 0;
    var afterDisc = Math.max(0, subtotal - discount);
    var vat = +(afterDisc * 0.05).toFixed(2);
    var total = +(afterDisc + vat).toFixed(2);
    var minutesAgo = opts.minutes_ago || (seed * 7);
    var created = new Date(Date.now() - minutesAgo * 60000).toISOString();
    return {
      id: 'o-' + String(seed).padStart(4, '0'),
      order_no: '#' + (1000 + seed),
      table_id: opts.table_id || null,
      type: opts.type || (opts.table_id ? 'dine-in' : 'takeaway'),
      lines: lines,
      subtotal: subtotal,
      discount: discount,
      vat: vat,
      total: total,
      payments: opts.payments || [],
      status: opts.status || 'completed',
      cashier_id: opts.cashier_id || 'st-cash-1',
      created_at: created,
      completed_at: opts.status === 'completed' ? new Date(Date.now() - (minutesAgo - 8) * 60000).toISOString() : null
    };
  }
  var ORDERS = [];
  // 4 currently in kitchen
  ORDERS.push(makeOrder(1, { table_id: 't2', minutes_ago: 4, status: 'kitchen', cashier_id: 'st-cash-1',
    lines: [ makeLine('p-cappuccino', 2, ['size-m','milk-oat','syr-vanilla']), makeLine('p-croissant', 1, []) ]
  }));
  ORDERS.push(makeOrder(2, { type: 'takeaway', minutes_ago: 3, status: 'kitchen', cashier_id: 'st-cash-2',
    lines: [ makeLine('p-iced-latte', 1, ['size-l','milk-almond']), makeLine('p-cheesecake', 1, []) ]
  }));
  ORDERS.push(makeOrder(3, { table_id: 't4', minutes_ago: 6, status: 'kitchen', cashier_id: 'st-cash-1',
    lines: [ makeLine('p-flat-white', 1, ['milk-dairy']), makeLine('p-chicken-club', 1, []), makeLine('p-water', 1, []) ]
  }));
  ORDERS.push(makeOrder(4, { type: 'takeaway', minutes_ago: 9, status: 'kitchen', cashier_id: 'st-cash-2',
    lines: [ makeLine('p-mocha', 1, ['size-l','milk-dairy','ext-whipped']), makeLine('p-cinnamon-roll', 1, []) ]
  }));
  // 2 on tables waiting payment (ready)
  ORDERS.push(makeOrder(5, { table_id: 't10', minutes_ago: 18, status: 'ready', cashier_id: 'st-cash-1',
    lines: [ makeLine('p-cappuccino', 1, ['size-m','milk-dairy']), makeLine('p-latte', 1, ['size-m','milk-oat']), makeLine('p-pain-choc', 2, []) ]
  }));
  ORDERS.push(makeOrder(6, { table_id: 't12', minutes_ago: 22, status: 'served', cashier_id: 'st-cash-2',
    lines: [ makeLine('p-espresso', 1, ['size-s']), makeLine('p-baklava', 1, []) ]
  }));
  // 18 completed today
  var seedCompleted = 7;
  var completedSpecs = [
    { lines: [['p-americano',2,['size-m']], ['p-croissant',1,[]]],         t: 35 },
    { lines: [['p-cappuccino',1,['size-m','milk-oat','syr-caramel']], ['p-muffin-blueberry',1,[]]], t: 45 },
    { lines: [['p-latte',1,['size-l','milk-almond']]],                    t: 52 },
    { lines: [['p-iced-americano',1,['size-l']], ['p-tuna-melt',1,[]]],   t: 65 },
    { lines: [['p-mocha',2,['size-m','milk-dairy','ext-shot']]],         t: 78 },
    { lines: [['p-espresso',1,[]], ['p-double-espresso',1,[]]],          t: 90 },
    { lines: [['p-karak',2,[]], ['p-baklava',1,[]]],                      t: 105 },
    { lines: [['p-frappuccino',1,['size-l','milk-soy','ext-whipped']]],  t: 120 },
    { lines: [['p-cold-brew',1,['size-l']], ['p-chocolate-cookie',2,[]]],t: 130 },
    { lines: [['p-spanish-latte',1,['size-m','milk-dairy']], ['p-cheese-danish',1,[]]], t: 145 },
    { lines: [['p-halloumi',1,[]], ['p-lemon-mint',1,[]]],                 t: 160, table: 't6' },
    { lines: [['p-cappuccino',1,['size-l','milk-oat']], ['p-banana-bread',1,[]]], t: 175 },
    { lines: [['p-mango-smoothie',2,['size-m']]],                          t: 188 },
    { lines: [['p-turkish',1,[]], ['p-dates',1,[]]],                        t: 200 },
    { lines: [['p-arabic',1,[]], ['p-almond-croissant',1,[]]],              t: 215 },
    { lines: [['p-americano',1,['size-s']], ['p-brownie',1,[]]],            t: 230 },
    { lines: [['p-mint-tea',1,[]], ['p-green-tea',1,[]]],                   t: 250, table: 't3' },
    { lines: [['p-flat-white',2,['milk-dairy']], ['p-veggie-wrap',1,[]]],   t: 280 }
  ];
  completedSpecs.forEach(function (spec) {
    var ls = spec.lines.map(function (s) { return makeLine(s[0], s[1], s[2]); });
    ORDERS.push(makeOrder(seedCompleted++, {
      table_id: spec.table || null,
      type: spec.table ? 'dine-in' : 'takeaway',
      lines: ls,
      status: 'completed',
      cashier_id: seedCompleted % 2 === 0 ? 'st-cash-1' : 'st-cash-2',
      minutes_ago: spec.t,
      payments: [{ method: seedCompleted % 3 === 0 ? 'cash' : 'card', amount: ls.reduce(function (s, l) { return s + l.line_total; }, 0) * 1.05 }]
    }));
  });
  // 3 refunded
  for (var r = 0; r < 3; r++) {
    var rspec = [['p-espresso',1,[]], ['p-cookie',1,[]]];
    var rls = [makeLine('p-espresso', 1, []), makeLine('p-chocolate-cookie', 1, [])];
    ORDERS.push(makeOrder(seedCompleted++, {
      type: 'takeaway', status: 'refunded', cashier_id: 'st-cash-1',
      lines: rls, minutes_ago: 90 + r * 60,
      payments: [{ method: 'card', amount: 23.10 }]
    }));
  }
  // 3 from yesterday
  for (var y = 0; y < 3; y++) {
    var ys = [makeLine('p-cappuccino', 1, ['size-m','milk-dairy']), makeLine('p-croissant', 1, [])];
    ORDERS.push(makeOrder(seedCompleted++, {
      type: 'takeaway', status: 'completed', cashier_id: y % 2 === 0 ? 'st-cash-1' : 'st-cash-2',
      lines: ys, minutes_ago: 1440 + y * 90,
      payments: [{ method: y % 2 === 0 ? 'card' : 'cash', amount: 38 }]
    }));
  }

  // ===================== SHIFTS =====================
  var SHIFTS = [
    { id: 'sh-1', opened_at: new Date(Date.now() - 26 * 3600000).toISOString(), closed_at: new Date(Date.now() - 16 * 3600000).toISOString(), opened_by: 'st-manager', closed_by: 'st-manager', opening_count_aed: 500,  closing_count_aed: 1840, expected_aed: 1850, variance: -10,  payments_total: 1340, orders_count: 28, z_report: 'Yesterday afternoon' },
    { id: 'sh-2', opened_at: new Date(Date.now() - 15 * 3600000).toISOString(), closed_at: new Date(Date.now() - 9  * 3600000).toISOString(), opened_by: 'st-super',   closed_by: 'st-super',   opening_count_aed: 500,  closing_count_aed: 980,  expected_aed: 975,  variance: 5,    payments_total: 480, orders_count: 12, z_report: 'Yesterday evening' },
    { id: 'sh-3', opened_at: new Date(Date.now() - 8  * 3600000).toISOString(), closed_at: null, opened_by: 'st-manager', closed_by: null, opening_count_aed: 500, closing_count_aed: null, expected_aed: null, variance: null, payments_total: null, orders_count: null, z_report: null }
  ];

  // ===================== SETTINGS =====================
  var SETTINGS = {
    business_name: 'Qahwa Café',
    location: 'Downtown Dubai',
    trn: '100000000003',
    address: 'Boulevard Plaza Tower 2 · Ground floor · Downtown Dubai',
    vat_pct: 5,
    tax_included: false,
    currency: 'AED',
    gratuity_default: 0,
    opening_hours: 'Sat-Thu 07:00-23:00 · Fri 14:00-23:00',
    receipt_header: 'Qahwa Café · Downtown Dubai',
    receipt_footer: 'Thank you. Come back soon. ☕'
  };

  // ===================== EXPOSE =====================
  window.POS_DATA = {
    CATEGORIES: CATEGORIES,
    MODIFIER_GROUPS: MODIFIER_GROUPS,
    PRODUCTS: PRODUCTS,
    STAFF: STAFF,
    TABLES: TABLES,
    ORDERS: ORDERS,
    SHIFTS: SHIFTS,
    DISCOUNTS: DISCOUNTS,
    INVENTORY: INVENTORY,
    SETTINGS: SETTINGS
  };
})();
