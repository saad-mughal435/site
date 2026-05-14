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
    user:            'anvil.user',
    company:         'anvil.company',
    cart:            'anvil.cart',
    orders:          'anvil.orders.created',
    notif:           'anvil.notifications',
    quotes:          'anvil.quotes.created',
    statusOverrides: 'anvil.orders.status_overrides',
    quoteStatusOver: 'anvil.quotes.status_overrides',
    productsCreated: 'anvil.products.created',
    productEdits:    'anvil.products.edits',
    productsDeleted: 'anvil.products.deleted',
    companiesCreated:'anvil.companies.created',
    companyEdits:    'anvil.companies.edits',
    emailLog:        'anvil.email_log',
    settings:        'anvil.settings.overrides',
  };
  try {
    if (!localStorage.getItem(LS.user))             localStorage.setItem(LS.user, JSON.stringify(D.current_user));
    if (!localStorage.getItem(LS.company))          localStorage.setItem(LS.company, JSON.stringify(D.current_company));
    if (!localStorage.getItem(LS.cart))             localStorage.setItem(LS.cart, '[]');
    if (!localStorage.getItem(LS.orders))           localStorage.setItem(LS.orders, '[]');
    if (!localStorage.getItem(LS.notif))            localStorage.setItem(LS.notif, '[]');
    if (!localStorage.getItem(LS.quotes))           localStorage.setItem(LS.quotes, '[]');
    if (!localStorage.getItem(LS.statusOverrides))  localStorage.setItem(LS.statusOverrides, '{}');
    if (!localStorage.getItem(LS.quoteStatusOver))  localStorage.setItem(LS.quoteStatusOver, '{}');
    if (!localStorage.getItem(LS.productsCreated))  localStorage.setItem(LS.productsCreated, '[]');
    if (!localStorage.getItem(LS.productEdits))     localStorage.setItem(LS.productEdits, '{}');
    if (!localStorage.getItem(LS.productsDeleted))  localStorage.setItem(LS.productsDeleted, '[]');
    if (!localStorage.getItem(LS.companiesCreated)) localStorage.setItem(LS.companiesCreated, '[]');
    if (!localStorage.getItem(LS.companyEdits))     localStorage.setItem(LS.companyEdits, '{}');
    if (!localStorage.getItem(LS.emailLog))         localStorage.setItem(LS.emailLog, '[]');
    if (!localStorage.getItem(LS.settings))         localStorage.setItem(LS.settings, '{}');
  } catch (_) {}

  function applyStatusOverride(order) {
    if (!order) return order;
    const overrides = readLS(LS.statusOverrides, {});
    const ov = overrides[order.id] || overrides[order.number];
    return ov ? { ...order, status: ov } : order;
  }
  function applyQuoteStatus(qt) {
    if (!qt) return qt;
    const ov = readLS(LS.quoteStatusOver, {})[qt.id];
    return ov ? { ...qt, status: ov } : qt;
  }
  function effectiveProducts() {
    const created = readLS(LS.productsCreated, []);
    const edits = readLS(LS.productEdits, {});
    const deleted = new Set(readLS(LS.productsDeleted, []));
    return [...D.products, ...created]
      .filter(p => !deleted.has(p.id))
      .map(p => edits[p.id] ? { ...p, ...edits[p.id] } : p);
  }
  function effectiveCompanies() {
    const created = readLS(LS.companiesCreated, []);
    const edits = readLS(LS.companyEdits, {});
    return [...D.companies, ...created].map(c => edits[c.id] ? { ...c, ...edits[c.id] } : c);
  }

  const readLS  = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch (_) { return f; } };
  const writeLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
  const json    = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });
  const findP   = (id) => effectiveProducts().find(p => p.id === id || p.sku === id);

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
      const all = effectiveProducts();
      const filtered = applyFilters(all, q);
      return json({ items: filtered, total: filtered.length });
    }
    if (path === '/products/featured') return json({ items: effectiveProducts().filter(p => (p.tags||[]).includes('bestseller')) });
    if (path.startsWith('/products/')) {
      const id = decodeURIComponent(path.split('/')[2]);
      const all = effectiveProducts();
      const p = all.find(x => x.id === id || x.sku === id);
      if (!p) return json({ error: 'not_found' }, 404);
      const related = (p.related || []).map(rid => all.find(x => x.id === rid || x.sku === rid)).filter(Boolean);
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
      if (p.stock <= 0) {
        return json({ ...cartTotals(), error: 'out_of_stock', sku: p.sku, name: p.name });
      }
      let qty = Number(body.qty) || p.moq;
      qty = Math.max(p.moq, Math.ceil(qty / p.pack_multiple) * p.pack_multiple);
      const existing = cart.find(l => l.product_id === p.id);
      const targetQty = existing ? (body.action === 'set' ? qty : existing.qty + qty) : qty;
      let capped = false;
      let finalQty = targetQty;
      if (finalQty > p.stock) {
        // Cap to highest pack multiple <= stock
        finalQty = Math.floor(p.stock / p.pack_multiple) * p.pack_multiple;
        if (finalQty < p.moq) finalQty = p.moq; // still respect MOQ even if it pushes a bit over
        finalQty = Math.min(finalQty, p.stock);
        capped = true;
      }
      if (existing) existing.qty = finalQty;
      else cart.push({ product_id: p.id, sku: p.sku, qty: finalQty, added_at: new Date().toISOString() });
      writeLS(LS.cart, cart);
      const totals = cartTotals();
      if (capped) return json({ ...totals, warning: 'capped_to_stock', stock: p.stock, sku: p.sku, name: p.name });
      return json(totals);
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
      const mine = [...created, ...D.orders.filter(o => o.company_id === company.id)]
        .map(applyStatusOverride);
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
      return json(applyStatusOverride(order));
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
      const allOrders = [...readLS(LS.orders, []), ...D.orders].map(applyStatusOverride);
      let out = allOrders;
      if (q.status && q.status !== 'all') out = out.filter(o => o.status === q.status);
      if (q.search) out = out.filter(o => o.id.toLowerCase().includes(q.search.toLowerCase()) || o.company_name.toLowerCase().includes(q.search.toLowerCase()));
      return json({ items: out });
    }
    if (path.startsWith('/admin/orders/')) {
      const id = decodeURIComponent(path.split('/')[3]);
      if (method === 'PUT' || method === 'PATCH') {
        const overrides = readLS(LS.statusOverrides, {});
        if (payload && payload.status) overrides[id] = payload.status;
        writeLS(LS.statusOverrides, overrides);
        return json({ success: true, status: payload?.status || null });
      }
    }
    if (path === '/admin/products') {
      if (method === 'GET') return json({ items: effectiveProducts() });
      if (method === 'POST') {
        const body = payload || {};
        const id = body.id || 'p-new-' + Math.random().toString(36).slice(2, 7);
        const created = readLS(LS.productsCreated, []);
        const price = Number(body.unit_price) || Number(body.price) || 0;
        const newProd = {
          id,
          sku: (body.sku || 'NEW-' + Math.floor(Math.random()*9000+1000)).toUpperCase(),
          name: body.name || 'New SKU',
          industry: body.industry || 'consumables',
          manufacturer: body.manufacturer || 'Anvil House Brand',
          short_desc: body.short_desc || '',
          description: body.description || '',
          unit_price: price,
          stock: Number(body.stock) || 0,
          moq: Number(body.moq) || 1,
          pack_size: body.pack_size || '1 unit',
          pack_multiple: Number(body.pack_multiple) || 1,
          lead_time: body.lead_time || '3-5 days',
          tier_pricing: [{ min: 1, price: price }, { min: 10, price: +(price * 0.95).toFixed(2) }, { min: 50, price: +(price * 0.9).toFixed(2) }, { min: 100, price: +(price * 0.85).toFixed(2) }],
          related: [], tags: [], specs: { ships_from: 'Central DC, Jebel Ali' },
        };
        created.unshift(newProd);
        writeLS(LS.productsCreated, created);
        return json({ success: true, product: newProd });
      }
    }
    if (path.startsWith('/admin/products/')) {
      const id = decodeURIComponent(path.split('/')[3]);
      if (method === 'PUT' || method === 'PATCH') {
        const body = payload || {};
        const edits = readLS(LS.productEdits, {});
        edits[id] = { ...(edits[id] || {}), ...body };
        if (body.unit_price != null) edits[id].unit_price = Number(body.unit_price);
        if (body.stock != null) edits[id].stock = Number(body.stock);
        if (body.moq != null) edits[id].moq = Number(body.moq);
        writeLS(LS.productEdits, edits);
        return json({ success: true });
      }
      if (method === 'DELETE') {
        const deleted = readLS(LS.productsDeleted, []);
        if (!deleted.includes(id)) deleted.push(id);
        writeLS(LS.productsDeleted, deleted);
        const created = readLS(LS.productsCreated, []).filter(p => p.id !== id);
        writeLS(LS.productsCreated, created);
        return json({ success: true });
      }
    }
    if (path === '/admin/customers') {
      if (method === 'GET') return json({ items: effectiveCompanies() });
      if (method === 'POST') {
        const body = payload || {};
        const id = body.id || 'co-new-' + Math.random().toString(36).slice(2, 7);
        const created = readLS(LS.companiesCreated, []);
        const newCo = {
          id,
          name: body.name || 'New Company',
          slug: (body.name || id).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          tier: body.tier || 'Standard',
          payment_terms: body.payment_terms || 'Net 30',
          credit_limit: Number(body.credit_limit) || 25000,
          open_balance: 0,
          contract_discount: Number(body.contract_discount || 0) / 100,
          ship_to: [{ id: 'sa-' + Math.random().toString(36).slice(2, 6), label: 'HQ', line1: body.address || 'Address pending', city: body.city || 'Dubai', country: 'UAE', default: true }],
          users: [{ id: 'u-' + Math.random().toString(36).slice(2, 6), name: body.contact_name || 'New Contact', email: body.contact_email || 'contact@demo.local', role: 'purchaser' }],
        };
        created.unshift(newCo);
        writeLS(LS.companiesCreated, created);
        return json({ success: true, company: newCo });
      }
    }
    if (path.startsWith('/admin/customers/')) {
      const id = decodeURIComponent(path.split('/')[3]);
      if (method === 'PUT' || method === 'PATCH') {
        const body = payload || {};
        const edits = readLS(LS.companyEdits, {});
        edits[id] = { ...(edits[id] || {}), ...body };
        if (body.credit_limit != null) edits[id].credit_limit = Number(body.credit_limit);
        if (body.contract_discount != null) edits[id].contract_discount = Number(body.contract_discount) / 100;
        writeLS(LS.companyEdits, edits);
        return json({ success: true });
      }
      const all = effectiveCompanies();
      const co = all.find(c => c.id === id) || all[0];
      return json({
        ...co,
        orders: [...readLS(LS.orders, []), ...D.orders].filter(o => o.company_id === co.id).map(applyStatusOverride),
        invoices: D.invoices.filter(i => i.company_id === co.id),
      });
    }
    if (path === '/admin/quotes') {
      if (method === 'POST') {
        const body = payload || {};
        const created = readLS(LS.quotes, []);
        const newQ = {
          id: 'q-new-' + Math.random().toString(36).slice(2, 7),
          status: 'pending',
          company_id: body.company_id || readLS(LS.company, D.current_company).id,
          company_name: body.company_name || (effectiveCompanies().find(c => c.id === body.company_id)?.name) || 'Demo Co.',
          requester: body.requester || readLS(LS.user, D.current_user).name,
          requested_at: new Date().toISOString(),
          items_count: Number(body.items_count) || 1,
          notes: body.notes || '',
        };
        created.unshift(newQ);
        writeLS(LS.quotes, created);
        return json({ success: true, quote: newQ });
      }
      const created = readLS(LS.quotes, []);
      return json({ items: [...created, ...D.quotes].map(applyQuoteStatus) });
    }
    if (path.startsWith('/admin/quotes/')) {
      const id = decodeURIComponent(path.split('/')[3]);
      if (method === 'PUT' || method === 'PATCH') {
        const body = payload || {};
        const overrides = readLS(LS.quoteStatusOver, {});
        if (body.status) overrides[id] = body.status;
        writeLS(LS.quoteStatusOver, overrides);
        return json({ success: true, status: body.status || null });
      }
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
      const overrides = readLS(LS.settings, {});
      const base = {
        store_name: D.brand.name,
        free_freight_threshold: D.brand.free_freight_threshold,
        tax_rate: D.brand.tax_rate,
        approval_threshold: 1000,
        integrations: { sap: true, sage: false, quickbooks: true, freightos: false },
      };
      if (method === 'GET') return json({ ...base, ...overrides, integrations: { ...base.integrations, ...(overrides.integrations || {}) } });
      if (method === 'POST' || method === 'PUT') {
        writeLS(LS.settings, { ...overrides, ...(payload || {}) });
        return json({ success: true });
      }
      if (method === 'DELETE') {
        writeLS(LS.settings, {});
        return json({ success: true });
      }
      return json({ success: true });
    }
    if (path === '/admin/email-log') {
      const seed = [
        { id: 'em-1', kind: 'order',     to: 'purchaser@acme.demo',   subject: 'Order PO-40128 confirmed',           preview: 'Your order is in the queue. Expected ship date: in 5 business days.', sent_at: new Date(Date.now() - 1000*60*8).toISOString() },
        { id: 'em-2', kind: 'quote',     to: 'maint@gamma.demo',      subject: 'Quote Q-04 ready to view',           preview: 'Pricing locked for 14 days. Click to view the line-by-line breakdown.', sent_at: new Date(Date.now() - 1000*60*55).toISOString() },
        { id: 'em-3', kind: 'invoice',   to: 'ap@gamma.demo',         subject: 'Invoice INV-2013 is overdue',        preview: 'Net 30 expired on Mar 18. Please remit at your earliest convenience.', sent_at: new Date(Date.now() - 1000*60*120).toISOString() },
        { id: 'em-4', kind: 'approval',  to: 'approver@acme.demo',    subject: 'Order PO-40131 awaiting approval',   preview: 'Demo Purchaser submitted an order for $1,840. Review and approve.', sent_at: new Date(Date.now() - 1000*60*240).toISOString() },
        { id: 'em-5', kind: 'shipment',  to: 'foreman@kilo.demo',     subject: 'PO-40104 has shipped',               preview: 'Tracking TRACK-X-882. Expected delivery in 3 business days.', sent_at: new Date(Date.now() - 1000*60*420).toISOString() },
        { id: 'em-6', kind: 'restock',   to: 'eng@tau.demo',          subject: 'BR-6204 is back in stock',           preview: 'You signed up for a restock alert. 240 units available.', sent_at: new Date(Date.now() - 1000*60*620).toISOString() },
      ];
      if (method === 'POST') {
        const body = payload || {};
        const sent = readLS(LS.emailLog, []);
        const em = { id: 'em-' + Date.now(), to: body.to || 'unknown@demo.local', subject: body.subject || '(no subject)', kind: body.kind || 'order', preview: (body.body || body.preview || '').slice(0, 200), sent_at: new Date().toISOString() };
        sent.unshift(em);
        writeLS(LS.emailLog, sent.slice(0, 100));
        return json({ success: true, email: em });
      }
      const sent = readLS(LS.emailLog, []);
      return json({ items: [...sent, ...seed].slice(0, 50) });
    }

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
