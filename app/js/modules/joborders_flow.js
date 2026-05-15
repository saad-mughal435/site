/**
 * Demo Plant LLC - PO Processing Flow Module
 * Sub-tabs: PO Process -> Draft -> Allocation -> Status -> Docs.
 * Status sub-tab redirects to the Job Orders top-level view (documents.js).
 *
 * Allocation tab is the unified activation + edit view: pushed PO items grouped
 * by source PO, with active/inactive toggles and qty edits. Items that are
 * fully sent to a JO drop off the list (server filters to status=allocation_pending).
 */

import { showToast } from '../utils.js?v=20260125h';
import { authenticatedFetch } from '../auth.js?v=20260428b';

let pendingAllocations = [];
let processedJOsCache = [];
let allocationSearchQ = '';
let allocFilterType = 'all';     // 'all' | 'can' | 'pet'
let allocFilterVolume = 'all';   // 'all' | e.g. '300ml' | '2.5L'
// Map: parentSummaryRef -> Set(item_code) for items still pending in QC.
let qcPendingMap = {};

function _extractVolume(desc) {
    const m = (desc || '').match(/(\d+(?:\.\d+)?)\s*(ml|l)\b/i);
    if (!m) return null;
    return m[2].toLowerCase() === 'l' ? `${m[1]}L` : `${m[1]}ml`;
}

function _detectType(desc) {
    const d = (desc || '').toLowerCase();
    if (d.includes('can')) return 'can';
    if (d.includes('pet')) return 'pet';
    return null;
}

function _matchesTypeVolume(desc) {
    if (allocFilterType !== 'all' && _detectType(desc) !== allocFilterType) return false;
    if (allocFilterVolume !== 'all' && _extractVolume(desc) !== allocFilterVolume) return false;
    return true;
}

// ============================================================================
// Draft sub-tab - Process Draft action (flips draft -> allocation_pending)
// ============================================================================

export async function processDraftToAllocation(id) {
    if (!confirm('Process this draft? It will move to the Allocation tab for manual activation.')) return;
    try {
        const resp = await authenticatedFetch(`/api/job-orders/${id}/process-draft`, { method: 'POST' });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.detail || 'Failed');
        }
        showToast('Draft moved to Allocation.', 'success');
        if (typeof window.loadDraftsList === 'function') window.loadDraftsList();
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

// ============================================================================
// Allocation sub-tab - unified view (pushed PO items grouped by parent PO)
// ============================================================================

export async function loadAllocationPending() {
    const pendingList = document.getElementById('po-allocation-pending-list');
    const completedList = document.getElementById('po-allocation-completed-list');
    if (pendingList) pendingList.innerHTML = '<div class="text-center text-slate-400 py-8">Loading...</div>';
    if (completedList) completedList.innerHTML = '';
    try {
        const [pendingResp, processedResp, qcGroupsResp] = await Promise.all([
            authenticatedFetch('/api/allocations/pending'),
            authenticatedFetch('/api/job-orders?status=processed&limit=200'),
            authenticatedFetch('/api/job-order-groups?status=pending'),
        ]);
        if (!pendingResp.ok) throw new Error('Failed');
        const pendingData = await pendingResp.json();
        pendingAllocations = (pendingData.rows || []).map(r => ({ ...r }));
        if (processedResp.ok) {
            const procData = await processedResp.json();
            processedJOsCache = procData.orders || [];
        } else {
            processedJOsCache = [];
        }
        qcPendingMap = {};
        if (qcGroupsResp.ok) {
            const qcData = await qcGroupsResp.json();
            for (const g of (qcData.groups || [])) {
                const ref = g.summary_ref || '';
                if (!ref) continue;
                const codes = new Set();
                for (const c of (g.children || [])) {
                    if (!c.completed && c.is_active !== false && c.item_code) codes.add(c.item_code);
                }
                qcPendingMap[ref] = codes;
            }
        }
        _renderAllocation();
    } catch (e) {
        console.error(e);
        if (pendingList) pendingList.innerHTML = '<div class="text-center text-red-500 py-8">Error loading allocations.</div>';
    }
}

export function switchAllocSubTab(name) {
    const target = (name === 'completed') ? 'completed' : 'pending';
    const btnP = document.getElementById('po-alloc-subtab-pending');
    const btnC = document.getElementById('po-alloc-subtab-completed');
    const listP = document.getElementById('po-allocation-pending-list');
    const listC = document.getElementById('po-allocation-completed-list');
    const createBtn = document.getElementById('po-alloc-create-btn');

    const activate = (el) => { if (!el) return; el.classList.remove('border-transparent', 'text-slate-500', 'hover:text-slate-700'); el.classList.add('border-blue-600', 'text-blue-600'); };
    const deactivate = (el) => { if (!el) return; el.classList.remove('border-blue-600', 'text-blue-600'); el.classList.add('border-transparent', 'text-slate-500', 'hover:text-slate-700'); };

    if (target === 'pending') {
        activate(btnP); deactivate(btnC);
        if (listP) listP.classList.remove('hidden');
        if (listC) listC.classList.add('hidden');
        if (createBtn) createBtn.classList.remove('hidden');
    } else {
        activate(btnC); deactivate(btnP);
        if (listC) listC.classList.remove('hidden');
        if (listP) listP.classList.add('hidden');
        if (createBtn) createBtn.classList.add('hidden');
    }
}

export function onAllocationSearch() {
    allocationSearchQ = (document.getElementById('po-allocation-search')?.value || '').toLowerCase().trim();
    _renderAllocation();
}

export function setAllocType(type) {
    allocFilterType = type || 'all';
    _syncFilterButtons();
    _renderAllocation();
}

export function setAllocVolume(vol) {
    allocFilterVolume = vol || 'all';
    _renderAllocation();
}

function _syncFilterButtons() {
    const activeCls = 'bg-blue-600 text-white shadow-sm';
    const inactiveCls = 'bg-white text-slate-700 hover:bg-slate-50';
    for (const t of ['all', 'can', 'pet']) {
        const btn = document.getElementById('alloc-type-' + t);
        if (!btn) continue;
        btn.classList.remove(...activeCls.split(' '), ...inactiveCls.split(' '));
        btn.classList.add(...(allocFilterType === t ? activeCls : inactiveCls).split(' '));
    }
}

function _refreshVolumeDropdown() {
    const sel = document.getElementById('alloc-volume');
    if (!sel) return;
    const set = new Set();
    for (const r of pendingAllocations) {
        const v = _extractVolume(r.description);
        if (v) set.add(v);
    }
    for (const jo of processedJOsCache) {
        for (const a of (jo.inventory_allocations || [])) {
            const v = _extractVolume(a.description);
            if (v) set.add(v);
        }
    }
    const volumes = [...set].sort((a, b) => parseFloat(a) - parseFloat(b));
    const current = allocFilterVolume;
    sel.innerHTML = `<option value="all">All Volumes</option>` +
        volumes.map(v => `<option value="${v}" ${v === current ? 'selected' : ''}>${v}</option>`).join('');
    if (!volumes.includes(current) && current !== 'all') {
        allocFilterVolume = 'all';
        sel.value = 'all';
    }
}

function _renderAllocation() {
    _refreshVolumeDropdown();
    _syncFilterButtons();

    const pendingEl = document.getElementById('po-allocation-pending-list');
    const completedEl = document.getElementById('po-allocation-completed-list');

    const q = allocationSearchQ;

    // --- Pending groups ---
    let pendingHtml = '';
    if (pendingAllocations.length === 0) {
        pendingHtml = '<div class="text-center text-slate-400 py-8">No pending allocations. Process a draft from the Draft tab.</div>';
    } else {
        const filteredIdx = new Set();
        pendingAllocations.forEach((r, i) => {
            if (!_matchesTypeVolume(r.description)) return;
            if (!q
                || (r.item_code || '').toLowerCase().includes(q)
                || (r.description || '').toLowerCase().includes(q)
                || (r.summary_ref || '').toLowerCase().includes(q)
                || (r.jo_number || '').toLowerCase().includes(q)
                || (r.customer || '').toLowerCase().includes(q)) {
                filteredIdx.add(i);
            }
        });
        if (filteredIdx.size === 0) {
            pendingHtml = '<div class="text-center text-slate-400 py-8">No matching allocations.</div>';
        } else {
            const groups = new Map();
            pendingAllocations.forEach((r, idx) => {
                if (!filteredIdx.has(idx)) return;
                const key = r.parent_id;
                if (!groups.has(key)) groups.set(key, { header: r, rows: [] });
                groups.get(key).rows.push({ ...r, _idx: idx });
            });
            for (const g of groups.values()) {
                g.rows.sort((a, b) => (b.is_active === true) - (a.is_active === true));
            }
            pendingHtml = Array.from(groups.values()).map(g => _renderAllocationGroup(g)).join('');
        }
    }

    const completedHtml = _renderProcessedJOs(processedJOsCache, q);

    if (pendingEl) pendingEl.innerHTML = pendingHtml;
    if (completedEl) completedEl.innerHTML = completedHtml || '<div class="text-center text-slate-400 py-8">No completed job orders.</div>';
}

function _renderProcessedJOs(jos, q) {
    if (!jos || jos.length === 0) return '';
    const rendered = jos
        .map(jo => {
            const matchedAllocs = (jo.inventory_allocations || []).filter(a => {
                if (!_matchesTypeVolume(a.description)) return false;
                if (!q) return true;
                if ((a.item_code || '').toLowerCase().includes(q)) return true;
                if ((a.description || '').toLowerCase().includes(q)) return true;
                if ((jo.summary_ref || '').toLowerCase().includes(q)) return true;
                if ((jo.jo_number || '').toLowerCase().includes(q)) return true;
                if ((jo.customer_name || '').toLowerCase().includes(q)) return true;
                return false;
            });
            if (matchedAllocs.length === 0) return '';
            return _renderProcessedJOBlock(jo, matchedAllocs);
        })
        .filter(Boolean);
    return rendered.join('');
}

function _parentRefFromChild(childRef) {
    const m = (childRef || '').match(/^(.*)-\d{2}$/);
    return m ? m[1] : (childRef || '');
}

function _renderProcessedJOBlock(jo, allocsOverride) {
    const allocs = allocsOverride || jo.inventory_allocations || [];
    if (allocs.length === 0) return '';
    const ref = jo.summary_ref || jo.jo_number || '';
    const customer = jo.customer_name || '';
    const date = jo.jo_date || '';
    const childId = jo.id || '';
    const parentRef = _parentRefFromChild(ref);
    const pendingCodes = qcPendingMap[parentRef] || new Set();
    const jo_num_map = {};
    for (const e of (jo.item_jo_numbers || [])) {
        if (e && e.item_code) jo_num_map[e.item_code] = e.jo_number || '';
    }
    return `<div class="mb-4 border border-slate-200 rounded-xl overflow-hidden">
        <div class="px-4 py-3 bg-green-50 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
            <div>
                <div class="font-semibold text-slate-900">${ref}</div>
                <div class="text-xs text-slate-500">${customer}${date ? ' - ' + date : ''}</div>
            </div>
            <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-700">Processed</span>
            </div>
        </div>
        <table class="min-w-full text-sm">
            <thead class="bg-white">
                <tr>
                    <th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 border-b">JO #</th>
                    <th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 border-b">Item</th>
                    <th class="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 border-b">Sent</th>
                    <th class="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 border-b">From Stock</th>
                    <th class="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 border-b">To Produce</th>
                    <th class="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 border-b">Action</th>
                </tr>
            </thead>
            <tbody>
                ${allocs.map(a => {
                    const code = a.item_code || '';
                    const canReturn = code && pendingCodes.has(code) && childId;
                    return `<tr class="border-b border-slate-100 last:border-0">
                    <td class="px-3 py-2 font-mono text-xs text-slate-600">${jo_num_map[code] || ref}</td>
                    <td class="px-3 py-2">
                        <div class="font-mono text-xs text-slate-700">${code}</div>
                        <div class="text-xs text-slate-500">${a.description || ''}</div>
                    </td>
                    <td class="px-3 py-2 text-right font-medium">${Number(a.requested || 0).toFixed(2)}</td>
                    <td class="px-3 py-2 text-right text-slate-600">${Number(a.from_stock || 0).toFixed(2)}</td>
                    <td class="px-3 py-2 text-right text-slate-600">${Number(a.to_produce || 0).toFixed(2)}</td>
                    <td class="px-3 py-2 text-right">
                        ${canReturn
                            ? `<button onclick="returnJOItemToAllocation('${childId}', '${code.replace(/'/g, "&#39;")}')" class="text-xs font-semibold py-1 px-2 rounded bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-200">Return</button>`
                            : '<span class="text-xs text-slate-300">-</span>'}
                    </td>
                </tr>`;
                }).join('')}
            </tbody>
        </table>
    </div>`;
}

async function _postReturnToAllocation(childId, itemCodes) {
    const body = itemCodes && itemCodes.length ? { item_codes: itemCodes } : {};
    const resp = await authenticatedFetch(`/api/job-orders/${childId}/return-to-allocation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${resp.status}`);
    }
    return resp.json().catch(() => ({}));
}

export async function returnJOItemToAllocation(childId, itemCode) {
    if (!childId || !itemCode) return;
    if (!confirm(`Return ${itemCode} to Allocation? This releases its stock reservation and removes it from the Job Order.`)) return;
    try {
        await _postReturnToAllocation(childId, [itemCode]);
        showToast(`${itemCode} returned to Allocation.`, 'success');
        await loadAllocationPending();
        if (typeof window.loadDocumentsPage === 'function') {
            try { await window.loadDocumentsPage('po'); } catch (_) {}
            try { await window.loadDocumentsPage(); } catch (_) {}
        }
    } catch (e) {
        console.error(e);
        showToast('Error: ' + e.message, 'error');
    }
}

export async function returnJOToAllocation(childId) {
    if (!childId) return;
    if (!confirm("Return this entire Job Order's items to Allocation? The Job Order will be deleted and its stock reservations released.")) return;
    try {
        await _postReturnToAllocation(childId, null);
        showToast('Returned to Allocation.', 'success');
        await loadAllocationPending();
        if (typeof window.loadDocumentsPage === 'function') {
            try { await window.loadDocumentsPage('po'); } catch (_) {}
            try { await window.loadDocumentsPage(); } catch (_) {}
        }
    } catch (e) {
        console.error(e);
        showToast('Error: ' + e.message, 'error');
    }
}

function _renderAllocationGroup(group) {
    const h = group.header;
    const idxList = group.rows.map(r => r._idx);
    const idxJson = JSON.stringify(idxList).replace(/"/g, '&quot;');
    const allActive = group.rows.length > 0 && group.rows.every(r => r.is_active);
    const someActive = group.rows.some(r => r.is_active);
    const indet = someActive && !allActive ? 'data-indeterminate="1"' : '';
    return `<div class="mb-6 border border-slate-200 rounded-xl overflow-hidden">
        <div class="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
                <div class="font-semibold text-slate-900">${h.summary_ref}</div>
                <div class="text-xs text-slate-500">${h.customer} - ${h.jo_date}</div>
            </div>
            <label class="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                <input type="checkbox" ${allActive ? 'checked' : ''} ${indet}
                    onchange="toggleAllocationGroupActive('${idxJson}', this.checked)"
                    class="rounded border-slate-300 w-4 h-4">
                Select All
            </label>
        </div>
        <table class="min-w-full text-sm">
            <thead class="bg-white">
                <tr>
                    <th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 border-b w-10">Active</th>
                    <th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 border-b">JO #</th>
                    <th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 border-b">Item</th>
                    <th class="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 border-b">Requested</th>
                    <th class="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 border-b">In Store</th>
                    <th class="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 border-b">From Stock</th>
                    <th class="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 border-b">To Produce</th>
                    <th class="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 border-b">Priority</th>
                </tr>
            </thead>
            <tbody>
                ${group.rows.map(r => _renderAllocationRow(r)).join('')}
            </tbody>
        </table>
    </div>`;
}

function _renderAllocationRow(r) {
    const i = r._idx;
    const active = r.is_active;
    const joNum = r.jo_number || r.summary_ref || '';
    const priority = ((r.priority || 'normal') + '').toLowerCase();
    const isUrgent = priority === 'urgent';
    const prioNormalSel = !isUrgent ? 'selected' : '';
    const prioUrgentSel = isUrgent ? 'selected' : '';
    const prioColorCls = active
        ? (isUrgent ? 'text-red-600 bg-red-50 border-red-300' : 'text-slate-700 bg-white border-slate-300')
        : 'text-slate-400 bg-slate-100 border-slate-200 cursor-not-allowed';
    return `<tr class="border-b border-slate-100 last:border-0 ${active ? 'bg-blue-50' : ''}">
        <td class="px-3 py-2"><input type="checkbox" ${active ? 'checked' : ''} onchange="toggleAllocationActive(${i}, this.checked)" class="rounded border-slate-300"></td>
        <td class="px-3 py-2 font-mono text-xs text-slate-600">${joNum}</td>
        <td class="px-3 py-2">
            <div class="font-mono text-xs text-slate-700">${r.item_code}</div>
            <div class="text-xs text-slate-500">${r.description}</div>
        </td>
        <td class="px-3 py-2 text-right font-medium">${r.requested.toFixed(2)}</td>
        <td class="px-3 py-2 text-right ${r.current_stock > 0 ? 'text-green-600' : 'text-slate-400'}">${r.current_stock.toFixed(2)}</td>
        <td class="px-3 py-2 text-center">
            <input type="number" min="0" step="0.01" value="${r.from_stock || 0}" ${active ? '' : 'disabled'}
                onchange="updateAllocationFromStock(${i}, this.value)"
                class="w-24 px-2 py-1 border border-slate-300 rounded text-center text-sm ${active ? '' : 'bg-slate-100 text-slate-400'}">
        </td>
        <td class="px-3 py-2 text-center">
            <input type="number" min="0" step="0.01" value="${r.to_produce || 0}" ${active ? '' : 'disabled'}
                onchange="updateAllocationToProduce(${i}, this.value)"
                class="w-24 px-2 py-1 border border-slate-300 rounded text-center text-sm ${active ? '' : 'bg-slate-100 text-slate-400'}">
        </td>
        <td class="px-3 py-2 text-center">
            <select ${active ? '' : 'disabled'} onchange="setAllocationPriority(${i}, this.value)"
                class="px-2 py-1 border rounded text-xs font-semibold ${prioColorCls}"
                title="${active ? 'Set priority for this item' : 'Activate the item to set priority'}">
                <option value="normal" ${prioNormalSel}>Normal</option>
                <option value="urgent" ${prioUrgentSel}>Urgent</option>
            </select>
        </td>
    </tr>`;
}

export function toggleAllocationActive(idx, checked) {
    const r = pendingAllocations[idx];
    if (!r) return;
    r.is_active = checked;
    if (checked) {
        const fromStock = Math.min(r.requested, r.current_stock);
        r.from_stock = fromStock;
        r.to_produce = Math.max(0, r.requested - fromStock);
    }
    _renderAllocation();
}

export function toggleAllocationGroupActive(idxJson, checked) {
    let idxList = [];
    try { idxList = JSON.parse(idxJson); } catch (_) { return; }
    for (const i of idxList) {
        const r = pendingAllocations[i];
        if (!r) continue;
        r.is_active = !!checked;
        if (checked) {
            const fromStock = Math.min(r.requested, r.current_stock);
            r.from_stock = fromStock;
            r.to_produce = Math.max(0, r.requested - fromStock);
        }
    }
    _renderAllocation();
}

export function setAllocationPriority(idx, value) {
    const r = pendingAllocations[idx];
    if (!r) return;
    r.priority = (value === 'urgent') ? 'urgent' : 'normal';
    _renderAllocation();
}

export function updateAllocationFromStock(idx, value) {
    const r = pendingAllocations[idx];
    if (!r) return;
    let fromStock = parseFloat(value) || 0;
    if (fromStock > r.current_stock) fromStock = r.current_stock;
    if (fromStock > r.requested) fromStock = r.requested;
    r.from_stock = fromStock;
    r.to_produce = Math.max(0, r.requested - fromStock);
    _renderAllocation();
}

export function updateAllocationToProduce(idx, value) {
    const r = pendingAllocations[idx];
    if (!r) return;
    let toProduce = parseFloat(value) || 0;
    if (toProduce < 0) toProduce = 0;
    r.to_produce = toProduce;
    r.from_stock = Math.min(r.current_stock, Math.max(0, r.requested - toProduce));
    _renderAllocation();
}

export async function createJobOrderFromAllocation() {
    const active = pendingAllocations.filter(r => r.is_active);
    if (active.length === 0) {
        showToast('No items activated. Check items to include in the Job Order.', 'error');
        return;
    }
    const byParent = new Map();
    active.forEach(r => {
        if (!byParent.has(r.parent_id)) byParent.set(r.parent_id, []);
        byParent.get(r.parent_id).push(r);
    });
    if (byParent.size > 1) {
        if (!confirm(`This will create ${byParent.size} separate Job Orders (one per source PO). Continue?`)) return;
    }
    try {
        let created = 0;
        for (const [parentId, items] of byParent.entries()) {
            const payload = {
                items: items.map(r => ({
                    item_code: r.item_code,
                    is_active: true,
                    from_stock: r.from_stock || 0,
                    to_produce: r.to_produce || 0,
                    priority: r.priority || 'normal',
                })),
            };
            const resp = await authenticatedFetch(`/api/job-orders/${parentId}/activate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                throw new Error(err.detail || 'Activate failed');
            }
            created += 1;
        }
        showToast(`${created} Job Order(s) created.`, 'success');
        await loadAllocationPending();
        try { await window.renderSavedJobOrders?.(); } catch (_) {}
        try { await window.loadDocumentsPage?.('main'); } catch (_) {}
        try { await window.loadDocumentsPage?.('po'); } catch (_) {}
        try { await window.loadPOStatus?.(); } catch (_) {}
    } catch (e) {
        console.error(e);
        showToast('Error: ' + e.message, 'error');
    }
}
