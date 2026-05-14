/* =========================================================
   Anvil Supply Co. - disconnected mock API
   Intercepts /b2b/api/* fetch + XHR. All state in localStorage.
   ========================================================= */
(function () {
  'use strict';
  if (!window.ANVIL_DATA) {
    console.error('[anvil-api] ANVIL_DATA missing - load data.js first');
    return;
  }
  const D = window.ANVIL_DATA;
  const log = (...a) => console.debug('[anvil-api]', ...a);

  const LS = {
    user:    'anvil.user',
    company: 'anvil.company',
    cart:    'anvil.cart',
    orders:  'anvil.orders.created',
    notif:   'anvil.notifications',
    quotes:  'anvil.quotes.created',
  };
  try {
    if (!localStorage.getItem(LS.user))    localStorage.setItem(LS.user, JSON.stringify(D.current_user));
    if (!localStorage.getItem(LS.company)) localStorage.setItem(LS.company, JSON.stringify(D.current_company));
    if (!localStorage.getItem(LS.cart))    localStorage.setItem(LS.cart, '[]');
    if (!localStorage.getItem(LS.orders))  localStorage.setItem(LS.orders, '[]');
    if (!localStorage.getItem(LS.notif))   localStorage.setItem(LS.notif, '[]');
    if (!localStorage.getItem(LS.quotes))  localStorage.setItem(LS.quotes, '[]');
  } catch (_) {}

  const readLS  = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch (_) { return f; } };
  const writeLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
  const json    = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });
  const findP   = (id) => D.products.find(p => p.id === id || p.sku === id);

  function tierFor(p, qty) {
    const t = p.tier_pricing.slice().reverse().find(x => qty >= x.min);
    return t || p.tier_pricing[0];
  }

  function cartLines() {
    const cart = readLS(LS.cart, []);
    return cart.map(it => {
      const p = findP(it.product_id);
      if (!p) return null;
      const tier = tierFor(p, it.qty);
      return {
        ...it,
        product: p,
        unit_price: tier.price,
        line_total: +(tier.price * it.qty).toFixed(2),
      };
    }).filter(Boolean);
  }

  function cartTotals() {
    const company = readLS(LS.company, D.current_company);
    const lines = cartLines();
    const subtotal = +lines.reduce((s, l) => s + l.line_total, 0).toFixed(2);
    const contractDiscount = company.contract_discount || 0;
    const discount = +(subtotal * contractDiscount).toFixed(2);
    const after = +(subtotal - discount).toFixed(2);
    const freight = after >= D.brand.free_freight_threshold || after === 0 ? 0 : 35;
    const tax = +(after * D.brand.tax_rate).toFixed(2);
    const total = +(after + freight + tax).toFixed(2);
    return {
      lines, subtotal, discount, after, freight, tax, total,
      contract_discount_pct: contractDiscount * 100,
      company,
      free_freight_eligible: after >= D.brand.free_freight_threshold,
      free_freight_progress: Math.min(100, Math.round((after / D.brand.free_freight_threshold) * 100)),
    };
  }

  function applyFilters(products, q) {
    let out = [...products];
    if (q.industry && q.industry !== 'all') out = out.filter(p => p.industry === q.industry);
    if (q.manufacturer) out = out.filter(p => p.manufacturer === q.manufacturer);
    if (q.in_stock === 'true') out = out.filter(p => p.stock > 0);
    if (q.max_moq) out = out.filter(p => p.moq <= Number(q.max_moq));
    if (q.search) {
      const s = q.search.toLowerCase();
      out = out.filter(p => p.name.toLowerCase().includes(s)
                         || p.sku.toLowerCase().includes(s)
                         || p.short_desc.toLowerCase().includes(s)
                         || p.manufacturer.toLowerCase().includes(s));
    }
    if (q.sort === 'price-asc')  out.sort((a, b) => a.unit_price - b.unit_price);
    if (q.sort === 'price-desc') out.sort((a, b) => b.unit_price - a.unit_price);
    if (q.sort === 'sku')        out.sort((a, b) => a.sku.localeCompare(b.sku));
    if (q.sort === 'stock')      out.sort((a, b) => b.stock - a.stock);
    return out;
  }

  function route(pathRaw, method, payload) {
    const url  = new URL(pathRaw, window.location.origin);
    const path = url.pathname.replace(/^\/b2b\/api/, '');
    const q    = Object.fromEntries(url.searchParams.entries());

    if (path === '/me') return json({
      user:    readLS(LS.user, D.current_user),
      company: readLS(LS.company, D.current_company),
    });

    if (path === '/industries') return json({ items: D.industries });
    if (path === '/manufacturers') return json({
      items: [...new Set(D.products.map(p => p.manufacturer))].sort()
    });

    if (path === '/products') {
      const filtered = applyFilters(D.products, q);
      return json({ items: filtered, total: filtered.length });
    }
    if (path === '/products/featured') return json({ items: D.products.filter(p => (p.tags||[]).includes('bestseller')) });
    if (path.startsWith('/products/')) {
      const id = path.split('/')[2];
      const p = findP(id);
      if (!p) return json({ error: 'not_found' }, 404);
      const related = (p.related || []).map(findP).filter(Boolean);
      return json({ product: p, related });
    }

    // Bulk lookup (paste SKU list)
    if (path === '/bulk-lookup' && method === 'POST') {
      const body = payload || {};
      const items = (body.skus || []).map(line => {
        const parts = line.split(/[\s,;:\t]+/).filter(Boolean);
        const sku = parts[0];
        const qty = Number(parts[1]) || 0;
        const p = findP(sku);
        return p
          ? { sku, qty, match: true, product: p, line_total: +(tierFor(p, qty).price * qty).toFixed(2) }
          : { sku, qty, match: false };
      });
      return json({ items });
    }

    /* --- Cart --- */
    if (path === '/cart') {
      if (method === 'GET') return json(cartTotals());
      const body = payload || {};
      const cart = readLS(LS.cart, []);
      if (body.action === 'clear') { writeLS(LS.cart, []); return json(cartTotals()); }
      if (body.action === 'remove') {
        writeLS(LS.cart, cart.filter(l => l.product_id !== body.product_id));
        return json(cartTotals());
      }
      const p = findP(body.product_id || body.sku);
      if (!p) return json({ error: 'sku_not_found', sku: body.sku || body.product_id });
      if (body.action === 'set' && Number(body.qty) === 0) {
        writeLS(LS.cart, cart.filter(l => l.product_id !== p.id));
        return json(cartTotals());
      }
      let qty = Number(body.qty) || p.moq;
      qty = Math.max(p.moq, Math.ceil(qty / p.pack_multiple) * p.pack_multiple);
      const existing = cart.find(l => l.product_id === p.id);
      if (existing) {
        existing.qty = body.action === 'set' ? qty : existing.qty + qty;
      } else {
        cart.push({ product_id: p.id, sku: p.sku, qty, added_at: new Date().toISOString() });
      }
      writeLS(LS.cart, cart);
      return json(cartTotals());
    }

    /* --- Quotes --- */
    if (path === '/quotes' && method === 'POST') {
      const body = payload || {};
      const created = readLS(LS.quotes, []);
      const q = {
        id: 'q-new-' + Math.random().toString(36).slice(2, 7),
        status: 'pending',
        company_id: readLS(LS.company, D.current_company).id,
        company_name: readLS(LS.company, D.current_company).name,
        requester: readLS(LS.user, D.current_user).name,
        requested_at: new Date().toISOString(),
        items_count: (body.items || []).length,
        items: body.items || [],
        notes: body.notes || '',
        expected_delivery: body.expected_delivery || '',
        budget_range: body.budget_range || '',
      };
      created.unshift(q);
      writeLS(LS.quotes, created);
      const notifs = readLS(LS.notif, []);
      notifs.unshift({ id: 'n-' + Date.now(), kind: 'quote', title: 'Quote request sent', body: `${q.items_count} item(s) - we will respond within 1 business day`, at: new Date().toISOString(), read: false });
      writeLS(LS.notif, notifs.slice(0, 50));
      return json({ success: true, quote: q });
    }
    if (path === '/quotes') {
      const created = readLS(LS.quotes, []);
      const company = readLS(LS.company, D.current_company);
      const all = [...created, ...D.quotes.filter(x => x.company_id === company.id)];
      return json({ items: all });
    }

    /* --- Checkout --- */
    if (path === '/checkout' && method === 'POST') {
      const body = payload || {};
      const totals = cartTotals();
      const company = totals.company;
      const orderNum = 'PO-' + Math.floor(40000 + Math.random() * 9999);
      const requiresApproval = totals.total >= 1000;
      const status = requiresApproval ? 'awaiting_approval' : 'submitted';
      const placed_at = new Date();
      const eta = new Date(placed_at.getTime() + 5 * 24 * 3600 * 1000).toISOString();
      const order = {
        id: orderNum,
        number: orderNum,
        company_id: company.id,
        company_name: company.name,
        customer_name: readLS(LS.user, D.current_user).name,
        customer_email: readLS(LS.user, D.current_user).email,
        placed_at: placed_at.toISOString(),
        eta,
        status,
        requires_approval: requiresApproval,
        approver_email: body.approver_email || null,
        po_number: body.po_number || '',
        payment_terms: body.payment_terms || company.payment_terms,
        ship_to: body.ship_to || company.ship_to[0],
        notes: body.notes || '',
        lines: totals.lines.map(l => ({
          product_id: l.product_id,
          sku: l.product.sku,
          name: l.product.name,
          qty: l.qty,
          unit_price: l.unit_price,
          line_total: l.line_total,
          product: { id: l.product.id, name: l.product.name, sku: l.product.sku, industry: l.product.industry },
        })),
        subtotal: totals.subtotal,
        discount: totals.discount,
        freight: totals.freight,
        tax: totals.tax,
        total: totals.total,
      };
      const created = readLS(LS.orders, []);
      created.unshift(order);
      writeLS(LS.orders, created);
      writeLS(LS.cart, []);
      const notifs = readLS(LS.notif, []);
      notifs.unshift({ id: 'n-' + Date.now(), kind: 'order', title: requiresApproval ? 'Order awaiting approval' : 'Order submitted', body: `${orderNum} - $${order.total.toLocaleString()}`, at: new Date().toISOString(), read: false });
      writeLS(LS.notif, notifs.slice(0, 50));
      return json({ success: true, order });
    }

    /* --- Orders (customer side) --- */
    if (path === '/orders') {
      const created = readLS(LS.orders, []);
      const company = readLS(LS.company, D.current_company);
      const mine = [...created, ...D.orders.filter(o => o.company_id === company.id)];
      return json({ items: mine });
    }
    if (path.startsWith('/orders/')) {
      const id = decodeURIComponent(path.split('/')[2]);
      const created = readLS(LS.orders, []);
      let order = created.find(o => o.id === id || o.number === id)
               || D.orders.find(o => o.id === id || o.number === id);
      if (!order) return json({ error: 'not_found' }, 404);
      // Hydrate seed orders so product info is present
      if (!order.lines[0]?.product) {
        order = {
          ...order,
          lines: order.lines.map(l => {
            const p = findP(l.product_id || l.sku);
            return { ...l, product: p ? { id: p.id, name: p.name, sku: p.sku, industry: p.industry } : { id: l.product_id, name: l.name } };
          }),
          freight: order.freight ?? 0,
          eta: order.eta || new Date(new Date(order.placed_at).getTime() + 5 * 24 * 3600 * 1000).toISOString(),
          ship_to: order.ship_to || readLS(LS.company, D.current_company).ship_to[0],
        };
      }
      return json(order);
    }

    /* --- Invoices, Recurring --- */
    if (path === '/invoices') {
      const company = readLS(LS.company, D.current_company);
      const items = D.invoices.filter(i => i.company_id === company.id);
      return json({ items });
    }
    if (path === '/recurring') return json({ items: D.recurring });

    /* --- Notifications --- */
    if (path === '/notifications') {
      if (method === 'GET') return json({ items: readLS(LS.notif, []) });
      const body = payload || {};
      if (body.action === 'mark_all_read') {
        writeLS(LS.notif, readLS(LS.notif, []).map(n => ({ ...n, read: true })));
        return json({ success: true });
      }
      if (body.action === 'push') {
        const list = readLS(LS.notif, []);
        list.unshift({ id: 'n-' + Date.now(), kind: body.kind || 'info', title: body.title, body: body.body, at: new Date().toISOString(), read: false });
        writeLS(LS.notif, list.slice(0, 50));
        return json({ success: true });
      }
    }

    /* --- Admin endpoints --- */
    if (path === '/admin/dashboard') {
      const allOrders = [...readLS(LS.orders, []), ...D.orders];
      const revenue = allOrders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0);
      const orders_today = allOrders.filter(o => new Date(o.placed_at).toDateString() === new Date().toDateString()).length;
      const open_quotes = D.quotes.filter(q => q.status === 'pending').length;
      const pending_approvals = allOrders.filter(o => o.status === 'awaiting_approval' || (o.requires_approval && o.status === 'submitted')).length;
      const overdue_invoices = D.invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + i.amount, 0);
      const trend = Array.from({length: 7}, (_, i) => ({ day: 6 - i, revenue: 500 + Math.floor(Math.random() * 4500) }));
      return json({
        kpis: {
          revenue_total: +revenue.toFixed(2),
          orders_today,
          open_quotes,
          pending_approvals,
          overdue_invoices: +overdue_invoices.toFixed(2),
          avg_order: allOrders.length ? +(revenue / allOrders.length).toFixed(2) : 0,
        },
        revenue_trend: trend,
        recent_orders: allOrders.slice(0, 6),
        pending_quotes: D.quotes.filter(q => q.status === 'pending'),
        low_stock: D.products.filter(p => p.stock < 50).slice(0, 6),
      });
    }
    if (path === '/admin/orders') {
      const allOrders = [...readLS(LS.orders, []), ...D.orders];
      let out = allOrders;
      if (q.status && q.status !== 'all') out = out.filter(o => o.status === q.status);
      if (q.search) out = out.filter(o => o.id.toLowerCase().includes(q.search.toLowerCase()) || o.company_name.toLowerCase().includes(q.search.toLowerCase()));
      return json({ items: out });
    }
    if (path === '/admin/products') return json({ items: D.products });
    if (path === '/admin/customers') return json({ items: D.companies });
    if (path.startsWith('/admin/customers/')) {
      const id = path.split('/')[3];
      const co = D.companies.find(c => c.id === id) || D.companies[0];
      return json({
        ...co,
        orders: [...readLS(LS.orders, []), ...D.orders].filter(o => o.company_id === co.id),
        invoices: D.invoices.filter(i => i.company_id === co.id),
      });
    }
    if (path === '/admin/quotes') {
      const created = readLS(LS.quotes, []);
      return json({ items: [...created, ...D.quotes] });
    }
    if (path === '/admin/approvals') {
      const all = [...readLS(LS.orders, []), ...D.orders];
      return json({ items: all.filter(o => o.requires_approval || o.status === 'awaiting_approval') });
    }
    if (path === '/admin/analytics') {
      const allOrders = [...readLS(LS.orders, []), ...D.orders];
      const by_industry = D.industries.map(ind => ({
        industry: ind.name,
        revenue: D.products.filter(p => p.industry === ind.slug).reduce((s, p) => s + p.unit_price * p.stock, 0),
      }));
      const top_companies = D.companies.map(co => ({
        name: co.name,
        revenue: allOrders.filter(o => o.company_id === co.id).reduce((s, o) => s + o.total, 0),
      })).sort((a, b) => b.revenue - a.revenue);
      return json({
        by_industry,
        top_companies,
        revenue_trend: Array.from({length: 30}, (_, i) => ({ day: i, revenue: 600 + Math.floor(Math.random() * 5000) })),
        fulfillment_avg_days: 3.4,
      });
    }
    if (path === '/admin/settings') {
      return json({
        store_name: D.brand.name,
        free_freight_threshold: D.brand.free_freight_threshold,
        tax_rate: D.brand.tax_rate,
        approval_threshold: 1000,
        integrations: { sap: true, sage: false, quickbooks: true, freightos: false },
      });
    }
    if (path === '/admin/email-log') return json({ items: [
      { id: 'em-1', kind: 'order',     to: 'purchaser@acme.demo',   subject: 'Order PO-40128 confirmed',           preview: 'Your order is in the queue. Expected ship date: in 5 business days.', sent_at: new Date(Date.now() - 1000*60*8).toISOString() },
      { id: 'em-2', kind: 'quote',     to: 'maint@gamma.demo',      subject: 'Quote Q-04 ready to view',           preview: 'Pricing locked for 14 days. Click to view the line-by-line breakdown.', sent_at: new Date(Date.now() - 1000*60*55).toISOString() },
      { id: 'em-3', kind: 'invoice',   to: 'ap@gamma.demo',         subject: 'Invoice INV-2013 is overdue',        preview: 'Net 30 expired on Mar 18. Please remit at your earliest convenience.', sent_at: new Date(Date.now() - 1000*60*120).toISOString() },
      { id: 'em-4', kind: 'approval',  to: 'approver@acme.demo',    subject: 'Order PO-40131 awaiting approval',   preview: 'Demo Purchaser submitted an order for $1,840. Review and approve.', sent_at: new Date(Date.now() - 1000*60*240).toISOString() },
      { id: 'em-5', kind: 'shipment',  to: 'foreman@kilo.demo',     subject: 'PO-40104 has shipped',               preview: 'Tracking TRACK-X-882. Expected delivery in 3 business days.', sent_at: new Date(Date.now() - 1000*60*420).toISOString() },
      { id: 'em-6', kind: 'restock',   to: 'eng@tau.demo',          subject: 'BR-6204 is back in stock',           preview: 'You signed up for a restock alert. 240 units available.', sent_at: new Date(Date.now() - 1000*60*620).toISOString() },
    ]});

    if (method === 'GET') return json([]);
    return json({ success: true });
  }

  /* --- fetch + XHR shim --- */
  const realFetch = window.fetch.bind(window);
  function shouldIntercept(url) {
    if (!url) return false;
    if (url.startsWith('blob:') || url.startsWith('data:')) return false;
    try {
      const u = new URL(url, window.location.href);
      if (u.origin === window.location.origin) return u.pathname.startsWith('/b2b/api/');
    } catch (_) {}
    return url.startsWith('/b2b/api/');
  }
  window.fetch = async function patched(input, init = {}) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const method = (init.method || (input && input.method) || 'GET').toUpperCase();
    if (!shouldIntercept(url)) {
      if (/^https?:\/\//.test(url)) { log('blocked external', url); return json({ blocked: true }); }
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
      _method = (m || 'GET').toUpperCase(); _url = u;
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
  log('Anvil mock API installed -', D.products.length, 'SKUs,', D.companies.length, 'companies');
})();
