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
  };
  try {
    if (!localStorage.getItem(LS.user)) {
      localStorage.setItem(LS.user, JSON.stringify(D.current_user));
    }
    if (!localStorage.getItem(LS.cart))            localStorage.setItem(LS.cart, '[]');
    if (!localStorage.getItem(LS.wishlist))        localStorage.setItem(LS.wishlist, '[]');
    if (!localStorage.getItem(LS.orders))          localStorage.setItem(LS.orders, '[]');
    if (!localStorage.getItem(LS.notif))           localStorage.setItem(LS.notif, '[]');
    if (!localStorage.getItem(LS.statusOverrides)) localStorage.setItem(LS.statusOverrides, '{}');
  } catch (_) {}

  function applyStatusOverride(order) {
    if (!order) return order;
    const overrides = readLS(LS.statusOverrides, {});
    const ov = overrides[order.id] || overrides[order.number];
    return ov ? { ...order, status: ov } : order;
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
    const promo = promoCode ? D.promo_codes.find(p => p.code === promoCode.toUpperCase() && p.active) : null;
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
      const filtered = applyFilters(D.products, q);
      const page = Math.max(1, Number(q.page) || 1);
      const per_page = Number(q.per_page) || 24;
      const start = (page - 1) * per_page;
      return jsonResponse({
        items: filtered.slice(start, start + per_page),
        total: filtered.length, page, per_page,
        pages: Math.ceil(filtered.length / per_page),
      });
    }
    if (path === '/products/featured')    return jsonResponse({ items: D.products.filter(p => p.featured) });
    if (path === '/products/trending')    return jsonResponse({ items: D.products.filter(p => (p.tags||[]).includes('bestseller')) });

    if (path.startsWith('/products/')) {
      const idOrSlug = path.split('/')[2];
      const p = productById(idOrSlug) || productBySlug(idOrSlug);
      if (!p) return jsonResponse({ error: 'not_found' }, 404);
      const related = (p.related || []).map(productById).filter(Boolean);
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
      // add or set qty
      const existing = cart.find(l => l.product_id === body.product_id && l.variant_id === body.variant_id);
      if (existing) {
        if (body.action === 'set') existing.qty = Math.max(0, body.qty);
        else                       existing.qty = Math.min(99, existing.qty + (body.qty || 1));
        if (existing.qty === 0) {
          const idx = cart.indexOf(existing);
          cart.splice(idx, 1);
        }
      } else if (body.qty !== 0) {
        cart.push({
          product_id: body.product_id,
          variant_id: body.variant_id || null,
          variant_name: body.variant_name || null,
          qty: Math.max(1, body.qty || 1),
          added_at: new Date().toISOString(),
        });
      }
      writeLS(LS.cart, cart);
      return jsonResponse(cartTotals());
    }

    // ---- promo ----
    if (path === '/promo' && method === 'POST') {
      const body = payload || {};
      const promo = D.promo_codes.find(p => p.code === (body.code || '').toUpperCase() && p.active);
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
      if (method === 'GET') return jsonResponse({ items: D.products });
      return jsonResponse({ success: true });
    }
    if (path.startsWith('/admin/products/')) {
      if (method === 'PUT' || method === 'PATCH' || method === 'DELETE') return jsonResponse({ success: true });
      return jsonResponse(productById(path.split('/')[3]) || D.products[0]);
    }
    if (path === '/admin/customers') return jsonResponse({ items: D.customers });
    if (path.startsWith('/admin/customers/')) {
      const c = D.customers.find(x => x.id === path.split('/')[3]) || D.customers[0];
      const allOrders = [...readLS(LS.orders, []), ...D.orders];
      return jsonResponse({ ...c, orders: allOrders.filter(o => o.customer_id === c.id) });
    }
    if (path === '/admin/promotions') return jsonResponse({ items: D.promo_codes });
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
      return jsonResponse({ items: [
        { id: 'em-1', subject: 'Your order PBL-10024 is confirmed', to: 'demo.shopper@demo.local', kind: 'order_confirmation', preview: 'Thanks for your order. We will email when it ships.', sent_at: new Date(Date.now() - 1000*60*5).toISOString() },
        { id: 'em-2', subject: 'PBL-10023 has shipped',            to: 'sample@demo.local',         kind: 'shipping',           preview: 'Your order is on the way. Tracking: TRACK-DEMO-981.', sent_at: new Date(Date.now() - 1000*60*45).toISOString() },
        { id: 'em-3', subject: 'Stock alert: Bloom Earbuds (Coral)',to: 'admin@pebbleandco.demo',   kind: 'stock_alert',        preview: 'Bloom Earbuds in Coral is below 5 units.', sent_at: new Date(Date.now() - 1000*60*120).toISOString() },
        { id: 'em-4', subject: 'Welcome to Pebble & Co.',          to: 'sam@demo.local',            kind: 'welcome',            preview: 'Thanks for signing up. Your code WELCOME15 saves $15.', sent_at: new Date(Date.now() - 1000*60*240).toISOString() },
        { id: 'em-5', subject: 'You left something behind',        to: 'casey@demo.local',          kind: 'abandoned_cart',     preview: 'Hush Headphones are still in your cart.', sent_at: new Date(Date.now() - 1000*60*360).toISOString() },
      ]});
    }
    if (path === '/admin/settings') {
      if (method === 'GET') return jsonResponse({
        store_name: D.brand.name,
        email: D.brand.email,
        free_shipping_threshold: D.brand.free_shipping_threshold,
        tax_rate: D.brand.tax_rate,
        integrations: {
          mailchimp: false, klaviyo: true, googleAnalytics: true, metaPixel: true,
        },
      });
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
