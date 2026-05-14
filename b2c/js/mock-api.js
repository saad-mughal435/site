/* =========================================================
   Pebble & Co. - disconnected mock API
   Wraps fetch + XHR. All /b2c/api/* requests resolve in-browser
   from window.PEBBLE_DATA + localStorage. No network leaves.
   ========================================================= */
(function () {
  'use strict';
  if (!window.PEBBLE_DATA) {
    console.error('[pebble-api] PEBBLE_DATA missing - load data.js first');
    return;
  }
  const D = window.PEBBLE_DATA;
  const log = (...a) => console.debug('[pebble-api]', ...a);

  /* ---- Auto-login + persistent state ---- */
  const LS = {
    user:            'pebble.user',
    cart:            'pebble.cart',
    wishlist:        'pebble.wishlist',
    orders:          'pebble.orders.created',
    notif:           'pebble.notifications',
    statusOverrides: 'pebble.orders.status_overrides',
    productsCreated: 'pebble.products.created',
    productEdits:    'pebble.products.edits',
    productsDeleted: 'pebble.products.deleted',
    customersCreated:'pebble.customers.created',
    customerEdits:   'pebble.customers.edits',
    promosCreated:   'pebble.promos.created',
    banners:         'pebble.banners',
    emailLog:        'pebble.email_log',
    settings:        'pebble.settings.overrides',
  };
  try {
    if (!localStorage.getItem(LS.user)) {
      localStorage.setItem(LS.user, JSON.stringify(D.current_user));
    }
    if (!localStorage.getItem(LS.cart))             localStorage.setItem(LS.cart, '[]');
    if (!localStorage.getItem(LS.wishlist))         localStorage.setItem(LS.wishlist, '[]');
    if (!localStorage.getItem(LS.orders))           localStorage.setItem(LS.orders, '[]');
    if (!localStorage.getItem(LS.notif))            localStorage.setItem(LS.notif, '[]');
    if (!localStorage.getItem(LS.statusOverrides))  localStorage.setItem(LS.statusOverrides, '{}');
    if (!localStorage.getItem(LS.productsCreated))  localStorage.setItem(LS.productsCreated, '[]');
    if (!localStorage.getItem(LS.productEdits))     localStorage.setItem(LS.productEdits, '{}');
    if (!localStorage.getItem(LS.productsDeleted))  localStorage.setItem(LS.productsDeleted, '[]');
    if (!localStorage.getItem(LS.customersCreated)) localStorage.setItem(LS.customersCreated, '[]');
    if (!localStorage.getItem(LS.customerEdits))    localStorage.setItem(LS.customerEdits, '{}');
    if (!localStorage.getItem(LS.promosCreated))    localStorage.setItem(LS.promosCreated, '[]');
    if (!localStorage.getItem(LS.banners))          localStorage.setItem(LS.banners, '[]');
    if (!localStorage.getItem(LS.emailLog))         localStorage.setItem(LS.emailLog, '[]');
    if (!localStorage.getItem(LS.settings))         localStorage.setItem(LS.settings, '{}');
  } catch (_) {}

  function applyStatusOverride(order) {
    if (!order) return order;
    const overrides = readLS(LS.statusOverrides, {});
    const ov = overrides[order.id] || overrides[order.number];
    return ov ? { ...order, status: ov } : order;
  }

  // Merge seed products with user-created + user edits, minus deleted
  function effectiveProducts() {
    const created = readLS(LS.productsCreated, []);
    const edits = readLS(LS.productEdits, {});
    const deleted = new Set(readLS(LS.productsDeleted, []));
    const all = [...D.products, ...created]
      .filter(p => !deleted.has(p.id))
      .map(p => edits[p.id] ? { ...p, ...edits[p.id] } : p);
    return all;
  }
  function effectiveCustomers() {
    const created = readLS(LS.customersCreated, []);
    const edits = readLS(LS.customerEdits, {});
    return [...D.customers, ...created].map(c => edits[c.id] ? { ...c, ...edits[c.id] } : c);
  }
  function effectivePromos() {
    return [...D.promo_codes, ...readLS(LS.promosCreated, [])];
  }

  function readLS(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (_) { return fallback; }
  }
  function writeLS(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (_) {}
  }

  /* ---- Helpers ---- */
  const jsonResponse = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  const productById = (id) => D.products.find(p => p.id === id);
  const productBySlug = (slug) => D.products.find(p => p.slug === slug);

  function reviewsFor(productId) {
    return D.reviews.filter(r => r.product_id === productId)
                    .sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  function cartLines() {
    const cart = readLS(LS.cart, []);
    return cart.map(item => {
      const p = productById(item.product_id);
      if (!p) return null;
      return {
        ...item,
        product: p,
        line_total: +(item.qty * (p.compare_at && item.use_sale ? p.price : p.price)).toFixed(2),
      };
    }).filter(Boolean);
  }

  function cartTotals(promoCode) {
    const lines = cartLines();
    const subtotal = +lines.reduce((s, l) => s + l.line_total, 0).toFixed(2);
    let discount = 0;
    let free_shipping_override = false;
    const allPromos = [...D.promo_codes, ...readLS(LS.promosCreated, [])];
    const promo = promoCode ? allPromos.find(p => p.code === promoCode.toUpperCase() && p.active) : null;
    if (promo) {
      if (promo.type === 'percent')  discount = +(subtotal * promo.value / 100).toFixed(2);
      if (promo.type === 'fixed')    discount = Math.min(promo.value, subtotal);
      if (promo.type === 'shipping') free_shipping_override = true;
      if (promo.min_subtotal && subtotal < promo.min_subtotal) discount = 0;
    }
    const after_discount = +(subtotal - discount).toFixed(2);
    const shipping = (free_shipping_override || after_discount >= D.brand.free_shipping_threshold || after_discount === 0) ? 0 : 8;
    const tax = +(after_discount * D.brand.tax_rate).toFixed(2);
    const total = +(after_discount + shipping + tax).toFixed(2);
    return {
      lines, subtotal, discount, after_discount, shipping, tax, total,
      promo: promo ? { code: promo.code, description: promo.description } : null,
      free_shipping_eligible: after_discount >= D.brand.free_shipping_threshold,
      free_shipping_progress: Math.min(100, Math.round((after_discount / D.brand.free_shipping_threshold) * 100)),
    };
  }

  function applyFilters(products, q) {
    let out = [...products];
    if (q.category && q.category !== 'all') out = out.filter(p => p.category === q.category);
    if (q.min_price) out = out.filter(p => p.price >= Number(q.min_price));
    if (q.max_price) out = out.filter(p => p.price <= Number(q.max_price));
    if (q.search) {
      const s = String(q.search).toLowerCase();
      out = out.filter(p => p.name.toLowerCase().includes(s) || p.short_desc.toLowerCase().includes(s));
    }
    if (q.tag) out = out.filter(p => (p.tags || []).includes(q.tag));
    if (q.sort === 'price-asc')  out.sort((a, b) => a.price - b.price);
    if (q.sort === 'price-desc') out.sort((a, b) => b.price - a.price);
    if (q.sort === 'rating')     out.sort((a, b) => b.rating - a.rating);
    if (q.sort === 'newest')     out.reverse();
    return out;
  }

  /* ---- Routes ---- */
  function route(pathRaw, method, payload) {
    const url = new URL(pathRaw, window.location.origin);
    const path = url.pathname.replace(/^\/b2c\/api/, '');
    const q = Object.fromEntries(url.searchParams.entries());

    // ---- account ----
    if (path === '/account')              return jsonResponse(readLS(LS.user, D.current_user));
    if (path === '/auth/login')           return jsonResponse({ success: true, user: D.current_user });
    if (path === '/auth/signup')          return jsonResponse({ success: true, user: D.current_user });
    if (path === '/auth/logout')          return jsonResponse({ success: true });

    // ---- categories ----
    if (path === '/categories')           return jsonResponse({ categories: D.categories });

    // ---- products ----
    if (path === '/products') {
      const all = effectiveProducts();
      const filtered = applyFilters(all, q);
      const page = Math.max(1, Number(q.page) || 1);
      const per_page = Number(q.per_page) || 24;
      const start = (page - 1) * per_page;
      return jsonResponse({
        items: filtered.slice(start, start + per_page),
        total: filtered.length, page, per_page,
        pages: Math.ceil(filtered.length / per_page),
      });
    }
    if (path === '/products/featured')    return jsonResponse({ items: effectiveProducts().filter(p => p.featured) });
    if (path === '/products/trending')    return jsonResponse({ items: effectiveProducts().filter(p => (p.tags||[]).includes('bestseller')) });

    if (path.startsWith('/products/')) {
      const idOrSlug = decodeURIComponent(path.split('/')[2]);
      const all = effectiveProducts();
      const p = all.find(x => x.id === idOrSlug) || all.find(x => x.slug === idOrSlug);
      if (!p) return jsonResponse({ error: 'not_found' }, 404);
      const related = (p.related || []).map(rid => all.find(x => x.id === rid)).filter(Boolean);
      return jsonResponse({
        product: p,
        reviews: reviewsFor(p.id),
        related,
      });
    }

    // ---- reviews ----
    if (path === '/reviews' && method === 'POST') {
      const body = payload || {};
      const r = {
        id: 'r-' + Math.random().toString(36).slice(2, 8),
        product_id: body.product_id,
        author: body.author || 'You',
        rating: body.rating || 5,
        title: body.title || '',
        body: body.body || '',
        date: new Date().toISOString(),
        verified: true,
        helpful: 0,
      };
      D.reviews.push(r);
      return jsonResponse({ success: true, review: r });
    }

    // ---- cart ----
    if (path === '/cart') {
      if (method === 'GET') return jsonResponse(cartTotals(q.promo));
      // POST: add or set
      const body = payload || {};
      const cart = readLS(LS.cart, []);
      if (body.action === 'clear') {
        writeLS(LS.cart, []);
        return jsonResponse(cartTotals());
      }
      if (body.action === 'remove') {
        const next = cart.filter(l => !(l.product_id === body.product_id && l.variant_id === body.variant_id));
        writeLS(LS.cart, next);
        return jsonResponse(cartTotals());
      }
      // Stock validation
      const product = effectiveProducts().find(p => p.id === body.product_id);
      if (!product) return jsonResponse({ ...cartTotals(), error: 'product_not_found' });
      const variant = body.variant_id && product.variants ? product.variants.find(v => v.id === body.variant_id) : null;
      const availStock = variant ? (variant.stock ?? product.stock) : product.stock;
      if (availStock <= 0) {
        return jsonResponse({ ...cartTotals(), error: 'out_of_stock', stock: 0, product_name: product.name });
      }
      // add or set qty
      const existing = cart.find(l => l.product_id === body.product_id && l.variant_id === body.variant_id);
      let capped = false;
      if (existing) {
        let nextQty;
        if (body.action === 'set') nextQty = Math.max(0, body.qty);
        else                       nextQty = existing.qty + (body.qty || 1);
        if (nextQty > availStock) { nextQty = availStock; capped = true; }
        existing.qty = Math.min(99, nextQty);
        if (existing.qty === 0) {
          const idx = cart.indexOf(existing);
          cart.splice(idx, 1);
        }
      } else if (body.qty !== 0) {
        let qty = Math.max(1, body.qty || 1);
        if (qty > availStock) { qty = availStock; capped = true; }
        cart.push({
          product_id: body.product_id,
          variant_id: body.variant_id || null,
          variant_name: body.variant_name || null,
          qty: Math.min(99, qty),
          added_at: new Date().toISOString(),
        });
      }
      writeLS(LS.cart, cart);
      const totals = cartTotals();
      if (capped) return jsonResponse({ ...totals, warning: 'capped_to_stock', stock: availStock, product_name: product.name });
      return jsonResponse(totals);
    }

    // ---- promo ----
    if (path === '/promo' && method === 'POST') {
      const body = payload || {};
      const all = [...D.promo_codes, ...readLS(LS.promosCreated, [])];
      const promo = all.find(p => p.code === (body.code || '').toUpperCase() && p.active);
      if (!promo) return jsonResponse({ success: false, error: 'invalid_code' });
      const totals = cartTotals(promo.code);
      if (promo.min_subtotal && totals.subtotal < promo.min_subtotal) {
        return jsonResponse({ success: false, error: 'min_subtotal_not_met', min: promo.min_subtotal });
      }
      return jsonResponse({ success: true, totals, promo: { code: promo.code, description: promo.description } });
    }

    // ---- wishlist ----
    if (path === '/wishlist') {
      const list = readLS(LS.wishlist, []);
      if (method === 'GET') return jsonResponse({ items: list.map(productById).filter(Boolean) });
      const body = payload || {};
      const next = list.includes(body.product_id)
        ? list.filter(id => id !== body.product_id)
        : [...list, body.product_id];
      writeLS(LS.wishlist, next);
      return jsonResponse({ items: next, toggled: body.product_id });
    }

    // ---- checkout ----
    if (path === '/checkout' && method === 'POST') {
      const body = payload || {};
      const totals = cartTotals(body.promo);
      const orderNum = 'PBL-' + Math.floor(11000 + Math.random() * 8999);
      const placed_at = new Date();
      const ship = body.shipping || {};
      const etaDays = ship.method === 'express' ? 2 : ship.method === 'pickup' ? 1 : 4;
      const eta = new Date(placed_at.getTime() + etaDays * 24 * 3600 * 1000).toISOString();
      const customer_name = [ship.first_name, ship.last_name].filter(Boolean).join(' ') || D.current_user.name;
      const newOrder = {
        id: orderNum,
        number: orderNum,
        customer_id: D.current_user.id,
        customer_name,
        customer_email: ship.email || D.current_user.email,
        placed_at: placed_at.toISOString(),
        eta,
        status: 'paid',
        lines: totals.lines.map(l => ({
          product_id: l.product_id,
          product: { id: l.product.id, name: l.product.name, slug: l.product.slug, palette: l.product.palette },
          product_name: l.product.name,
          qty: l.qty,
          unit_price: l.product.price,
          line_total: l.line_total,
          variant_id: l.variant_id,
          variant_name: l.variant_name,
        })),
        subtotal: totals.subtotal,
        discount: totals.discount,
        shipping_cost: totals.shipping,
        tax: totals.tax,
        total: totals.total,
        shipping: ship,
        notes: body.notes || '',
        payment: {
          kind: body.payment?.kind || 'card',
          last4: body.payment?.last4 || '4242',
        },
        payment_method: body.payment?.kind === 'card' ? 'Card ****' + (body.payment?.last4 || '4242')
                       : body.payment?.kind === 'paypal' ? 'PayPal'
                       : 'Cash on delivery',
        promo_code: totals.promo?.code || null,
      };
      const created = readLS(LS.orders, []);
      created.unshift(newOrder);
      writeLS(LS.orders, created);
      writeLS(LS.cart, []);
      // notification
      const notifs = readLS(LS.notif, []);
      notifs.unshift({ id: 'n-' + Date.now(), kind: 'order', title: 'Order placed', body: `${orderNum} - $${newOrder.total}`, at: new Date().toISOString(), read: false });
      writeLS(LS.notif, notifs.slice(0, 50));
      return jsonResponse({ success: true, order: newOrder });
    }

    // ---- orders (customer) ----
    if (path === '/orders') {
      const created = readLS(LS.orders, []);
      const mine = [...created, ...D.orders.filter(o => o.customer_id === D.current_user.id)]
        .map(applyStatusOverride);
      return jsonResponse({ items: mine });
    }
    if (path.startsWith('/orders/')) {
      const id = decodeURIComponent(path.split('/')[2]);
      const created = readLS(LS.orders, []);
      let order = created.find(o => o.number === id || o.id === id)
               || D.orders.find(o => o.number === id || o.id === id);
      if (!order) return jsonResponse({ error: 'not_found' }, 404);
      // Hydrate older seed orders so success page can render product placeholders
      if (!order.lines[0]?.product) {
        order = {
          ...order,
          lines: order.lines.map(l => {
            const p = productById(l.product_id);
            return { ...l, product: p ? { id: p.id, name: p.name, slug: p.slug, palette: p.palette } : { id: l.product_id, name: l.product_name, palette: ['#ddd','#aaa'] } };
          }),
          shipping_cost: order.shipping_cost ?? order.shipping ?? 0,
          shipping: typeof order.shipping === 'object' ? order.shipping : (order.shipping_address || {}),
          payment: order.payment || { kind: 'card', last4: '1234' },
          eta: order.eta || new Date(new Date(order.placed_at).getTime() + 4 * 24 * 3600 * 1000).toISOString(),
        };
      }
      return jsonResponse(applyStatusOverride(order));
    }

    // ---- newsletter ----
    if (path === '/newsletter' && method === 'POST') {
      return jsonResponse({ success: true, message: 'You are on the list.' });
    }

    // ---- notifications ----
    if (path === '/notifications') {
      if (method === 'GET') {
        return jsonResponse({ items: readLS(LS.notif, []) });
      }
      const body = payload || {};
      if (body.action === 'mark_all_read') {
        const list = readLS(LS.notif, []).map(n => ({ ...n, read: true }));
        writeLS(LS.notif, list);
        return jsonResponse({ success: true });
      }
      if (body.action === 'push') {
        const list = readLS(LS.notif, []);
        list.unshift({ id: 'n-' + Date.now(), kind: body.kind || 'info', title: body.title, body: body.body, at: new Date().toISOString(), read: false });
        writeLS(LS.notif, list.slice(0, 50));
        return jsonResponse({ success: true });
      }
    }

    /* =========================================================
       ADMIN
       ========================================================= */
    if (path === '/admin/dashboard') {
      const allOrders = [...readLS(LS.orders, []), ...D.orders];
      const revenue_total = allOrders.reduce((s, o) => s + (o.status === 'cancelled' || o.status === 'refunded' ? 0 : o.total), 0);
      const orders_today = allOrders.filter(o => {
        const d = new Date(o.placed_at);
        const now = new Date();
        return d.toDateString() === now.toDateString();
      }).length;
      const avg = allOrders.length ? revenue_total / allOrders.length : 0;
      const low_stock = D.products.filter(p => p.stock < 15);
      const trend = [];
      for (let i = 6; i >= 0; i--) {
        trend.push({ day: i, revenue: 200 + Math.floor(Math.random() * 800) });
      }
      return jsonResponse({
        kpis: {
          revenue_total: +revenue_total.toFixed(2),
          orders_today,
          avg_order: +avg.toFixed(2),
          conversion_pct: 2.4 + Math.random() * 1.2,
          new_customers: 3 + Math.floor(Math.random() * 8),
          inventory_value: D.products.reduce((s, p) => s + p.price * p.stock, 0),
        },
        revenue_trend: trend,
        recent_orders: allOrders.slice(0, 5),
        low_stock,
      });
    }
    if (path === '/admin/orders') {
      const allOrders = [...readLS(LS.orders, []), ...D.orders].map(applyStatusOverride);
      let out = allOrders;
      if (q.status && q.status !== 'all') out = out.filter(o => o.status === q.status);
      if (q.search) out = out.filter(o => o.number.toLowerCase().includes(q.search.toLowerCase()) || o.customer_name.toLowerCase().includes(q.search.toLowerCase()));
      return jsonResponse({ items: out });
    }
    if (path.startsWith('/admin/orders/')) {
      const parts = path.split('/');
      const id = decodeURIComponent(parts[3]);
      if (method === 'PUT' || method === 'PATCH') {
        const overrides = readLS(LS.statusOverrides, {});
        if (payload && payload.status) overrides[id] = payload.status;
        writeLS(LS.statusOverrides, overrides);
        return jsonResponse({ success: true, status: payload?.status || null });
      }
      const allOrders = [...readLS(LS.orders, []), ...D.orders];
      const found = allOrders.find(o => o.number === id || o.id === id);
      if (!found) return jsonResponse({ error: 'not_found' }, 404);
      return jsonResponse(applyStatusOverride(found));
    }
    if (path === '/admin/products') {
      if (method === 'GET') return jsonResponse({ items: effectiveProducts() });
      if (method === 'POST') {
        const body = payload || {};
        const id = body.id || 'p-new-' + Math.random().toString(36).slice(2, 7);
        const created = readLS(LS.productsCreated, []);
        const newProd = {
          id,
          slug: (body.slug || body.name || id).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          name: body.name || 'Untitled product',
          category: body.category || 'audio',
          price: Number(body.price) || 0,
          compare_at: body.compare_at ? Number(body.compare_at) : null,
          stock: Number(body.stock) || 0,
          rating: 5,
          review_count: 0,
          palette: ['#7c9cff', '#5eead4'],
          variants: [{ id: 'v-default', name: 'Default', hex: '#444', stock: Number(body.stock) || 0 }],
          tags: [], featured: false,
          short_desc: body.short_desc || '',
          description: body.description || '',
          features: [], specs: {},
          related: [],
        };
        created.unshift(newProd);
        writeLS(LS.productsCreated, created);
        return jsonResponse({ success: true, product: newProd });
      }
      return jsonResponse({ success: true });
    }
    if (path.startsWith('/admin/products/')) {
      const id = decodeURIComponent(path.split('/')[3]);
      if (method === 'PUT' || method === 'PATCH') {
        const body = payload || {};
        const edits = readLS(LS.productEdits, {});
        edits[id] = { ...(edits[id] || {}), ...body };
        if (body.price != null) edits[id].price = Number(body.price);
        if (body.stock != null) edits[id].stock = Number(body.stock);
        writeLS(LS.productEdits, edits);
        return jsonResponse({ success: true });
      }
      if (method === 'DELETE') {
        const deleted = readLS(LS.productsDeleted, []);
        if (!deleted.includes(id)) deleted.push(id);
        writeLS(LS.productsDeleted, deleted);
        // Also remove from created list if present
        const created = readLS(LS.productsCreated, []).filter(p => p.id !== id);
        writeLS(LS.productsCreated, created);
        return jsonResponse({ success: true });
      }
      return jsonResponse(effectiveProducts().find(p => p.id === id) || effectiveProducts()[0]);
    }
    if (path === '/admin/customers') {
      if (method === 'GET') return jsonResponse({ items: effectiveCustomers() });
      if (method === 'POST') {
        const body = payload || {};
        const id = body.id || 'c-new-' + Math.random().toString(36).slice(2, 7);
        const created = readLS(LS.customersCreated, []);
        const newCust = {
          id,
          name: body.name || 'New Customer',
          email: body.email || 'new@demo.local',
          joined: new Date().toISOString(),
          orders_count: 0,
          lifetime_value: 0,
          points: 0,
          segment: body.segment || 'new',
        };
        created.unshift(newCust);
        writeLS(LS.customersCreated, created);
        return jsonResponse({ success: true, customer: newCust });
      }
    }
    if (path.startsWith('/admin/customers/')) {
      const id = decodeURIComponent(path.split('/')[3]);
      if (method === 'PUT' || method === 'PATCH') {
        const body = payload || {};
        const edits = readLS(LS.customerEdits, {});
        edits[id] = { ...(edits[id] || {}), ...body };
        writeLS(LS.customerEdits, edits);
        return jsonResponse({ success: true });
      }
      const all = effectiveCustomers();
      const c = all.find(x => x.id === id) || all[0];
      const allOrders = [...readLS(LS.orders, []), ...D.orders];
      return jsonResponse({ ...c, orders: allOrders.filter(o => o.customer_id === c.id) });
    }
    if (path === '/admin/promotions') {
      if (method === 'GET') return jsonResponse({ items: effectivePromos() });
      if (method === 'POST') {
        const body = payload || {};
        const code = String(body.code || '').toUpperCase().replace(/\s+/g, '');
        if (!code) return jsonResponse({ success: false, error: 'code_required' }, 400);
        const created = readLS(LS.promosCreated, []);
        const newPromo = {
          code,
          description: body.description || '',
          type: body.type || 'percent',
          value: Number(body.value) || 0,
          min_subtotal: body.min_subtotal ? Number(body.min_subtotal) : null,
          max_uses: body.max_uses ? Number(body.max_uses) : null,
          used_count: 0,
          active: body.active !== 'false' && body.active !== false,
        };
        created.unshift(newPromo);
        writeLS(LS.promosCreated, created);
        return jsonResponse({ success: true, promo: newPromo });
      }
    }
    if (path === '/admin/banners') {
      if (method === 'GET') return jsonResponse({ items: readLS(LS.banners, []) });
      if (method === 'POST') {
        const body = payload || {};
        const list = readLS(LS.banners, []);
        list.unshift({ id: 'b-' + Date.now(), title: body.title || 'New banner', blurb: body.blurb || '', status: 'running', kind: body.kind || 'manual' });
        writeLS(LS.banners, list);
        return jsonResponse({ success: true });
      }
    }
    if (path === '/admin/analytics') {
      const byCategory = D.categories.map(c => ({
        category: c.name,
        revenue: D.products.filter(p => p.category === c.slug).reduce((s, p) => s + p.price * (p.review_count || 0), 0),
      }));
      const topProducts = [...D.products].sort((a, b) => b.review_count - a.review_count).slice(0, 10);
      return jsonResponse({
        by_category: byCategory,
        top_products: topProducts,
        funnel: { visitors: 8420, viewed_product: 4180, added_to_cart: 980, reached_checkout: 412, purchased: 287 },
        revenue_trend: Array.from({length: 30}, (_, i) => ({ day: i, revenue: 200 + Math.floor(Math.random() * 1200) })),
      });
    }
    if (path === '/admin/email-log') {
      const seed = [
        { id: 'em-1', subject: 'Your order PBL-10024 is confirmed', to: 'demo.shopper@demo.local', kind: 'order_confirmation', preview: 'Thanks for your order. We will email when it ships.', sent_at: new Date(Date.now() - 1000*60*5).toISOString() },
        { id: 'em-2', subject: 'PBL-10023 has shipped',            to: 'sample@demo.local',         kind: 'shipping',           preview: 'Your order is on the way. Tracking: TRACK-DEMO-981.', sent_at: new Date(Date.now() - 1000*60*45).toISOString() },
        { id: 'em-3', subject: 'Stock alert: Bloom Earbuds (Coral)',to: 'admin@pebbleandco.demo',   kind: 'stock_alert',        preview: 'Bloom Earbuds in Coral is below 5 units.', sent_at: new Date(Date.now() - 1000*60*120).toISOString() },
        { id: 'em-4', subject: 'Welcome to Pebble & Co.',          to: 'sam@demo.local',            kind: 'welcome',            preview: 'Thanks for signing up. Your code WELCOME15 saves $15.', sent_at: new Date(Date.now() - 1000*60*240).toISOString() },
        { id: 'em-5', subject: 'You left something behind',        to: 'casey@demo.local',          kind: 'abandoned_cart',     preview: 'Hush Headphones are still in your cart.', sent_at: new Date(Date.now() - 1000*60*360).toISOString() },
      ];
      if (method === 'POST') {
        const body = payload || {};
        const sent = readLS(LS.emailLog, []);
        const em = {
          id: 'em-' + Date.now(),
          subject: body.subject || '(no subject)',
          to: body.to || 'unknown@demo.local',
          kind: body.kind || 'welcome',
          preview: (body.body || body.preview || '').slice(0, 200),
          sent_at: new Date().toISOString(),
        };
        sent.unshift(em);
        writeLS(LS.emailLog, sent.slice(0, 100));
        return jsonResponse({ success: true, email: em });
      }
      const sent = readLS(LS.emailLog, []);
      return jsonResponse({ items: [...sent, ...seed].slice(0, 50) });
    }
    if (path === '/admin/settings') {
      const overrides = readLS(LS.settings, {});
      const base = {
        store_name: D.brand.name,
        email: D.brand.email,
        free_shipping_threshold: D.brand.free_shipping_threshold,
        tax_rate: D.brand.tax_rate,
        integrations: { mailchimp: false, klaviyo: true, googleAnalytics: true, metaPixel: true },
      };
      if (method === 'GET') return jsonResponse({ ...base, ...overrides, integrations: { ...base.integrations, ...(overrides.integrations || {}) } });
      if (method === 'POST' || method === 'PUT') {
        writeLS(LS.settings, { ...overrides, ...(payload || {}) });
        return jsonResponse({ success: true });
      }
      if (method === 'DELETE') {
        writeLS(LS.settings, {});
        return jsonResponse({ success: true });
      }
      return jsonResponse({ success: true });
    }

    /* ---- Fallback ---- */
    if (method === 'GET') return jsonResponse([]);
    return jsonResponse({ success: true, _id: 'demo-' + Math.random().toString(36).slice(2, 8) });
  }

  /* =========================================================
     fetch + XHR shim
     ========================================================= */
  const realFetch = window.fetch.bind(window);
  function shouldIntercept(url) {
    if (!url) return false;
    if (url.startsWith('blob:') || url.startsWith('data:')) return false;
    try {
      const u = new URL(url, window.location.href);
      if (u.origin === window.location.origin) return u.pathname.startsWith('/b2c/api/');
    } catch (_) {}
    return url.startsWith('/b2c/api/');
  }
  window.fetch = async function patched(input, init = {}) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const method = (init.method || (input && input.method) || 'GET').toUpperCase();
    if (!shouldIntercept(url)) {
      if (/^https?:\/\//.test(url)) {
        log('blocked external', url);
        return jsonResponse({ blocked: true });
      }
      return realFetch(input, init);
    }
    let payload = null;
    if (init.body) { try { payload = typeof init.body === 'string' ? JSON.parse(init.body) : null; } catch (_) {} }
    log(method, url);
    return route(url, method, payload);
  };

  const RealXHR = window.XMLHttpRequest;
  function MockXHR() {
    const xhr = new RealXHR();
    let _url = '', _method = 'GET';
    const origOpen = xhr.open;
    xhr.open = function (m, u, ...rest) {
      _method = (m || 'GET').toUpperCase();
      _url = u;
      if (shouldIntercept(u)) {
        Object.defineProperty(xhr, 'readyState', { configurable: true, get: () => 4 });
        Object.defineProperty(xhr, 'status',     { configurable: true, get: () => 200 });
        xhr.send = function () {
          let payload = null;
          try { payload = arguments[0] ? JSON.parse(arguments[0]) : null; } catch (_) {}
          const resp = route(_url, _method, payload);
          resp.text().then(t => {
            Object.defineProperty(xhr, 'responseText', { configurable: true, get: () => t });
            Object.defineProperty(xhr, 'response',     { configurable: true, get: () => t });
            if (typeof xhr.onreadystatechange === 'function') xhr.onreadystatechange();
            if (typeof xhr.onload === 'function') xhr.onload();
          });
        };
        return;
      }
      return origOpen.call(xhr, m, u, ...rest);
    };
    return xhr;
  }
  window.XMLHttpRequest = MockXHR;

  log('Pebble mock API installed -', D.products.length, 'products,', D.customers.length, 'customers,', D.orders.length, 'orders');
})();
