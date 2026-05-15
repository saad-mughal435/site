/**
 * Demo Plant LLC - Inventory Module
 * Handles Raw Materials and Finished Goods inventory management
 */

import { debounce, showToast, state } from '../utils.js?v=20260129a';
import { authenticatedFetch } from '../auth.js';

// ============================================================================
// Inventory Sub-tabs
// ============================================================================

/**
 * Switch between Raw Materials and Finished Goods tabs
 * @param {string} subTab - 'rm' or 'fg'
 */
export function switchInventorySubTab(subTab) {
    state.currentInventorySubTab = subTab;
    
    // Hide all content
    document.getElementById('inv-content-rm').classList.add('hidden');
    document.getElementById('inv-content-fg').classList.add('hidden');
    const etPanel = document.getElementById('inv-content-et');
    if (etPanel) etPanel.classList.add('hidden');

    // Reset button styles
    const inactiveClass = "px-6 py-2.5 font-medium text-sm rounded-lg transition-all bg-white border border-slate-300 text-slate-700 hover:bg-slate-50";
    const activeClass = "px-6 py-2.5 font-medium text-sm rounded-lg transition-all bg-blue-600 text-white shadow-sm";

    document.getElementById('inv-subtab-rm').className = inactiveClass;
    document.getElementById('inv-subtab-fg').className = inactiveClass;
    const etBtn = document.getElementById('inv-subtab-et');
    if (etBtn) etBtn.className = inactiveClass;

    // Show selected content and set active button
    if (subTab === 'rm') {
        document.getElementById('inv-content-rm').classList.remove('hidden');
        document.getElementById('inv-subtab-rm').className = activeClass;
        loadRawMaterialsInventory();
    } else if (subTab === 'fg') {
        document.getElementById('inv-content-fg').classList.remove('hidden');
        document.getElementById('inv-subtab-fg').className = activeClass;
        loadFinishedGoodsInventory();
    } else if (subTab === 'et') {
        if (etPanel) etPanel.classList.remove('hidden');
        if (etBtn) etBtn.className = activeClass;
        loadETInventory();
    }
}

// ============================================================================
// Raw Materials Inventory
// ============================================================================

/**
 * Load raw materials inventory from MongoDB cache (fast, no sync)
 */
export async function loadRawMaterialsInventory() {
    const loader = document.getElementById('loader-rm-inv');
    const refreshBtn = document.querySelector('#inv-content-rm button[onclick="loadRawMaterialsInventory()"]');
    const originalBtnContent = refreshBtn ? refreshBtn.innerHTML : null;
    
    if (loader) loader.style.display = 'block';
    
    try {
        // Show loading state on button
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = `
                <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Loading...</span>
            `;
        }
        
        // Load cached data from MongoDB (fast)
        const response = await authenticatedFetch('/api/inventory');
        const data = await response.json();
        state.rmInventoryData = data;
        renderRMInventory();
    } catch (error) {
        console.error(error);
        showToast('❌ Error loading raw materials inventory', 'error');
    } finally {
        if (loader) loader.style.display = 'none';
        // Restore button state
        if (refreshBtn && originalBtnContent) {
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = originalBtnContent;
        }
    }
}

/**
 * Sync raw materials with Sage, then reload data
 */
export async function syncRawMaterialsInventory() {
    const syncBtn = document.querySelector('#inv-content-rm button[onclick="syncRawMaterialsInventory()"]');
    const originalBtnContent = syncBtn ? syncBtn.innerHTML : null;
    
    try {
        if (syncBtn) {
            syncBtn.disabled = true;
            syncBtn.innerHTML = `
                <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Syncing...</span>
            `;
        }
        
        showToast('🔄 Syncing Raw Materials with Sage...', 'info');
        
        const syncResponse = await authenticatedFetch('/api/inventory-transactions/sync', { method: 'POST' });
        let stockCount = 0;
        if (syncResponse.ok) {
            const syncResult = await syncResponse.json();
            stockCount = syncResult.stock_status?.stock_records || 0;
        }
        
        // Reload data after sync
        const response = await authenticatedFetch('/api/inventory');
        const data = await response.json();
        state.rmInventoryData = data;
        renderRMInventory();
        
        showToast(`✅ Raw Materials synced (${stockCount} stock records updated)`, 'success');
    } catch (error) {
        console.error(error);
        showToast('❌ Error syncing raw materials inventory', 'error');
    } finally {
        if (syncBtn && originalBtnContent) {
            syncBtn.disabled = false;
            syncBtn.innerHTML = originalBtnContent;
        }
    }
}

/**
 * Render raw materials inventory table
 */
export function renderRMInventory() {
    const tbody = document.getElementById('rm-inventory-body');
    if (!tbody) return;
    
    // Get search term
    const searchInput = document.getElementById('rm-search-input');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
    
    // Apply filter
    let filteredData = state.rmInventoryData;
    if (state.rmInventoryFilter === 'in-stock') {
        filteredData = state.rmInventoryData.filter(item => {
            const qty = item['Qty On Hand'] || item['qty_on_hand'] || 0;
            return parseFloat(qty) > 0;
        });
    } else if (state.rmInventoryFilter === 'zero') {
        filteredData = state.rmInventoryData.filter(item => {
            const qty = item['Qty On Hand'] || item['qty_on_hand'] || 0;
            return parseFloat(qty) === 0;
        });
    }
    
    // Apply search filter
    if (searchTerm) {
        filteredData = filteredData.filter(item => {
            const code = (item['Item Code'] || item['item_code'] || '').toLowerCase();
            const desc = (item['Item Description'] || item['description'] || '').toLowerCase();
            return code.includes(searchTerm) || desc.includes(searchTerm);
        });
    }
    
    if (filteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-slate-500">No items found</td></tr>`;
        return;
    }

    // PERFORMANCE: Use DocumentFragment to batch DOM updates
    const fragment = document.createDocumentFragment();

    filteredData.forEach(item => {
        const row = document.createElement('tr');
        const code = item['Item Code'] || item['item_code'] || '';
        const desc = item['Item Description'] || item['description'] || '';
        const uom = item['UOM'] || item['uom'] || '';
        const qty = item['Qty On Hand'] || item['qty_on_hand'] || 0;
        const qtyNum = parseFloat(qty);

        row.className = 'hover:bg-slate-50 transition-colors border-b border-slate-100';

        // Status badge
        let statusBadge = '';
        if (qtyNum === 0) {
            statusBadge = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Out of Stock</span>';
        } else if (qtyNum < 100) {
            statusBadge = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">Low Stock</span>';
        } else {
            statusBadge = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">In Stock</span>';
        }

        row.innerHTML = `
            <td class="px-6 py-4 text-sm font-medium text-slate-900">${code}</td>
            <td class="px-6 py-4 text-sm text-slate-600">${desc}</td>
            <td class="px-6 py-4 text-sm text-slate-600 uppercase">${uom || '-'}</td>
            <td class="px-6 py-4 text-sm text-right text-slate-900 font-semibold tabular-nums">${qtyNum.toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})}</td>
            <td class="px-6 py-4 text-center">${statusBadge}</td>
        `;
        fragment.appendChild(row);
    });

    // Clear and append all at once (single reflow)
    tbody.innerHTML = '';
    tbody.appendChild(fragment);
}

/**
 * Set filter for raw materials inventory
 * @param {string} filter - 'all', 'in-stock', or 'zero'
 */
export function setRMInventoryFilter(filter) {
    state.rmInventoryFilter = filter;
    
    // Update filter button styles
    const inactiveClass = "inventory-filter-btn text-xs font-medium px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-blue-500 transition-all duration-200";
    const activeClass = "inventory-filter-btn text-xs font-semibold px-4 py-2 rounded-lg bg-blue-600 text-white transition-all duration-200";
    
    document.getElementById('rm-filter-all').className = inactiveClass;
    document.getElementById('rm-filter-in-stock').className = inactiveClass;
    document.getElementById('rm-filter-zero').className = inactiveClass;
    document.getElementById(`rm-filter-${filter}`).className = activeClass;
    
    renderRMInventory();
}

/**
 * Search raw materials inventory (triggers re-render)
 */
export function searchRMInventory() {
    renderRMInventory();
}

// PERFORMANCE: Debounced version for oninput
export const debouncedSearchRM = debounce(searchRMInventory, 300);

/**
 * Print currently visible (filtered + searched) raw materials inventory.
 * Renders into a hidden iframe and triggers the browser print dialog.
 */
export function printRMInventory() {
    const searchInput = document.getElementById('rm-search-input');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

    let filteredData = state.rmInventoryData || [];
    if (state.rmInventoryFilter === 'in-stock') {
        filteredData = filteredData.filter(item => parseFloat(item['Qty On Hand'] || item['qty_on_hand'] || 0) > 0);
    } else if (state.rmInventoryFilter === 'zero') {
        filteredData = filteredData.filter(item => parseFloat(item['Qty On Hand'] || item['qty_on_hand'] || 0) === 0);
    }
    if (searchTerm) {
        filteredData = filteredData.filter(item => {
            const code = (item['Item Code'] || item['item_code'] || '').toLowerCase();
            const desc = (item['Item Description'] || item['description'] || '').toLowerCase();
            return code.includes(searchTerm) || desc.includes(searchTerm);
        });
    }

    if (filteredData.length === 0) {
        showToast('No items to print', 'warning');
        return;
    }

    _openPrintWindow({
        title: 'Raw Materials Inventory',
        filterKey: state.rmInventoryFilter,
        searchTerm,
        rows: filteredData,
        lowStockThreshold: 100
    });
}

// ============================================================================
// Finished Goods Inventory
// ============================================================================

/**
 * Load finished goods inventory from MongoDB cache (fast, no sync)
 */
export async function loadFinishedGoodsInventory() {
    const loader = document.getElementById('loader-fg-inv');
    const refreshBtn = document.querySelector('#inv-content-fg button[onclick="loadFinishedGoodsInventory()"]');
    const originalBtnContent = refreshBtn ? refreshBtn.innerHTML : null;
    
    if (loader) loader.style.display = 'block';
    
    try {
        // Show loading state on button
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = `
                <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Loading...</span>
            `;
        }
        
        // Load cached data from MongoDB (fast)
        const response = await authenticatedFetch('/api/finished-goods-inventory');
        const data = await response.json();
        state.fgInventoryData = data;
        renderFGInventory();
    } catch (error) {
        console.error(error);
        showToast('❌ Error loading finished goods inventory', 'error');
    } finally {
        if (loader) loader.style.display = 'none';
        // Restore button state
        if (refreshBtn && originalBtnContent) {
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = originalBtnContent;
        }
    }
}

/**
 * Sync finished goods with Sage, then reload data
 */
export async function syncFinishedGoodsInventory() {
    const syncBtn = document.querySelector('#inv-content-fg button[onclick="syncFinishedGoodsInventory()"]');
    const originalBtnContent = syncBtn ? syncBtn.innerHTML : null;
    
    try {
        if (syncBtn) {
            syncBtn.disabled = true;
            syncBtn.innerHTML = `
                <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Syncing...</span>
            `;
        }
        
        showToast('🔄 Syncing Finished Goods with Sage...', 'info');
        
        const syncResponse = await authenticatedFetch('/api/inventory-transactions/sync', { method: 'POST' });
        let stockCount = 0;
        if (syncResponse.ok) {
            const syncResult = await syncResponse.json();
            stockCount = syncResult.stock_status?.stock_records || 0;
        }
        
        // Reload data after sync
        const response = await authenticatedFetch('/api/finished-goods-inventory');
        const data = await response.json();
        state.fgInventoryData = data;
        renderFGInventory();
        
        showToast(`✅ Finished Goods synced (${stockCount} stock records updated)`, 'success');
    } catch (error) {
        console.error(error);
        showToast('❌ Error syncing finished goods inventory', 'error');
    } finally {
        if (syncBtn && originalBtnContent) {
            syncBtn.disabled = false;
            syncBtn.innerHTML = originalBtnContent;
        }
    }
}

/**
 * Render finished goods inventory table
 */
export function renderFGInventory() {
    const tbody = document.getElementById('fg-inventory-body');
    if (!tbody) return;
    
    // Get search term
    const searchInput = document.getElementById('fg-search-input');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
    
    // Apply filter
    let filteredData = state.fgInventoryData;
    if (state.fgInventoryFilter === 'in-stock') {
        filteredData = state.fgInventoryData.filter(item => {
            const qty = item['Qty On Hand'] || item['qty_on_hand'] || 0;
            return parseFloat(qty) > 0;
        });
    } else if (state.fgInventoryFilter === 'zero') {
        filteredData = state.fgInventoryData.filter(item => {
            const qty = item['Qty On Hand'] || item['qty_on_hand'] || 0;
            return parseFloat(qty) === 0;
        });
    }
    
    // Apply search filter
    if (searchTerm) {
        filteredData = filteredData.filter(item => {
            const code = (item['Item Code'] || item['item_code'] || '').toLowerCase();
            const desc = (item['Item Description'] || item['description'] || '').toLowerCase();
            return code.includes(searchTerm) || desc.includes(searchTerm);
        });
    }
    
    if (filteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-slate-500">No items found</td></tr>`;
        return;
    }

    // PERFORMANCE: Use DocumentFragment to batch DOM updates
    const fragment = document.createDocumentFragment();

    filteredData.forEach(item => {
        const row = document.createElement('tr');
        const code = item['Item Code'] || item['item_code'] || '';
        const desc = item['Item Description'] || item['description'] || '';
        const uom = item['UOM'] || item['uom'] || '';
        const qty = item['Qty On Hand'] || item['qty_on_hand'] || 0;
        const qtyNum = parseFloat(qty);

        row.className = 'hover:bg-slate-50 transition-colors border-b border-slate-100 cursor-pointer';
        row.dataset.fgRow = code;

        // Status badge
        let statusBadge = '';
        if (qtyNum === 0) {
            statusBadge = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Out of Stock</span>';
        } else if (qtyNum < 50) {
            statusBadge = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">Low Stock</span>';
        } else {
            statusBadge = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">In Stock</span>';
        }

        row.innerHTML = `
            <td class="px-6 py-4 text-sm font-medium text-slate-900">${code}</td>
            <td class="px-6 py-4 text-sm text-slate-600">${desc}</td>
            <td class="px-6 py-4 text-sm text-slate-600 uppercase">${uom || '-'}</td>
            <td class="px-6 py-4 text-sm text-right text-slate-900 font-semibold tabular-nums">${qtyNum.toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})}</td>
            <td class="px-6 py-4 text-center">${statusBadge}</td>
        `;
        row.addEventListener('click', () => toggleFGRowExpand(code));
        fragment.appendChild(row);
    });

    // Clear and append all at once (single reflow)
    tbody.innerHTML = '';
    tbody.appendChild(fragment);
}

async function toggleFGRowExpand(itemCode) {
    const selector = `tr[data-fg-expand-for="${CSS.escape(itemCode)}"]`;
    const existing = document.querySelector(selector);
    if (existing) {
        existing.remove();
        state.fgExpandedItem = null;
        return;
    }

    document.querySelectorAll('tr[data-fg-expand-for]').forEach(el => el.remove());

    const parentRow = document.querySelector(`tr[data-fg-row="${CSS.escape(itemCode)}"]`);
    if (!parentRow) return;

    const placeholder = document.createElement('tr');
    placeholder.setAttribute('data-fg-expand-for', itemCode);
    placeholder.innerHTML = `<td colspan="5" class="px-6 py-4 bg-slate-50 text-sm text-slate-500">Loading…</td>`;
    parentRow.after(placeholder);

    try {
        const res = await authenticatedFetch(`/api/finished-goods-inventory/${encodeURIComponent(itemCode)}/summary`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        placeholder.innerHTML = renderFGExpandedPanel(data);
        state.fgExpandedItem = itemCode;
    } catch (err) {
        console.error('FG summary fetch failed', err);
        placeholder.innerHTML = `<td colspan="5" class="px-6 py-4 bg-red-50 text-sm text-red-700">Failed to load summary</td>`;
    }
}

function renderFGExpandedPanel(d) {
    const fmt = (n) => Number(n || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 4});
    const fmtDate = (iso) => {
        if (!iso) return '<span class="italic text-slate-400">Unknown</span>';
        const dt = new Date(iso);
        if (isNaN(dt.getTime())) return '<span class="italic text-slate-400">Unknown</span>';
        return `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}-${dt.getFullYear()}`;
    };
    const unk = (txt) => txt ? `<span class="font-mono">${txt}</span>` : `<span class="italic text-slate-400">Unknown</span>`;
    const uom = d.uom || '';

    const bookedExport = Number(d.booked_export_from_stock || 0);
    const bookedLocal = Number(d.booked_local_from_stock || 0);
    const bookedUntyped = Number(d.booked_untyped_from_stock || 0);
    const etBookedRaw = Number(d.booked_from_et || 0);
    const etUnbooked = Number(d.et_unbooked || 0);
    const tiles = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div class="bg-white rounded-lg p-3 border border-slate-200">
                <div class="text-xs uppercase tracking-wide text-slate-500">Sage on-hand</div>
                <div class="text-lg font-semibold tabular-nums">${fmt(d.sage_qty)}</div>
            </div>
            <div class="bg-white rounded-lg p-3 border border-amber-200">
                <div class="text-xs uppercase tracking-wide text-amber-600">ET on-hand</div>
                <div class="text-lg font-semibold tabular-nums text-amber-700">${fmt(d.et_qty)}</div>
            </div>
            <div class="bg-white rounded-lg p-3 border border-blue-200">
                <div class="text-xs uppercase tracking-wide text-blue-600">Booked (Export)</div>
                <div class="text-lg font-semibold tabular-nums text-blue-700">${fmt(bookedExport)}</div>
            </div>
            <div class="bg-white rounded-lg p-3 border border-amber-300">
                <div class="text-xs uppercase tracking-wide text-amber-700">Booked (Local → ET)</div>
                <div class="text-lg font-semibold tabular-nums text-amber-800">${fmt(bookedLocal)}</div>
            </div>
            ${bookedUntyped > 0 ? `
                <div class="bg-white rounded-lg p-3 border border-slate-300">
                    <div class="text-xs uppercase tracking-wide text-slate-600">Booked (Untyped)</div>
                    <div class="text-lg font-semibold tabular-nums text-slate-700">${fmt(bookedUntyped)}</div>
                </div>` : ''}
            <div class="bg-white rounded-lg p-3 border ${d.is_overbooked ? 'border-red-300' : 'border-emerald-200'}">
                <div class="text-xs uppercase tracking-wide ${d.is_overbooked ? 'text-red-600' : 'text-emerald-600'}">Unbooked (base)</div>
                <div class="text-lg font-semibold tabular-nums ${d.is_overbooked ? 'text-red-700' : 'text-emerald-700'}">${fmt(d.unbooked)}</div>
            </div>
            <div class="bg-white rounded-lg p-3 border ${d.is_et_overbooked ? 'border-red-300' : 'border-emerald-200'}">
                <div class="text-xs uppercase tracking-wide ${d.is_et_overbooked ? 'text-red-600' : 'text-emerald-600'}">Unbooked (ET)</div>
                <div class="text-lg font-semibold tabular-nums ${d.is_et_overbooked ? 'text-red-700' : 'text-emerald-700'}">${fmt(etUnbooked)}</div>
            </div>
        </div>`;

    const overbookBanner = d.is_overbooked ? `
        <div class="mt-3 px-3 py-2 rounded-md bg-red-50 border border-red-200 text-sm text-red-800">
            <strong>Overbooked by ${fmt(d.overbook_qty)} ${uom}</strong> - active bookings exceed current Sage stock.
            Likely cause: stock was dispatched / moved to ET after reservation. Review stale bookings.
        </div>` : '';

    const toProduceNote = d.booked_to_produce > 0
        ? `<div class="mt-2 text-xs text-slate-500">+ ${fmt(d.booked_to_produce)} ${uom} booked against future production</div>`
        : '';

    // Unified customer-allocation view: every booking (JO/PO) inline with its
    // batch + production + expiry, plus an ET row labelled My City Micro, and
    // an unbooked row showing the leftover.
    //
    // Reconciliation rule: sum(non-ET allocations) + unbooked = Sage qty.
    // ET is presented separately so Sage qty always matches without it.
    const allocs = d.customer_allocations || [];
    // Section split:
    //   - Sage section (base SKU): rows with order_type !== 'local' AND source !== 'et'
    //   - ET section (ET- SKU): rows with order_type === 'local' OR source === 'et'
    const sageAllocs = allocs.filter(a => a.order_type !== 'local' && a.source !== 'et');
    const etAllocs   = allocs.filter(a => a.order_type === 'local' || a.source === 'et');
    const sageQty    = Number(d.sage_qty || 0);
    const etQty      = Number(d.et_qty   || 0);
    const totalSage  = sageAllocs.reduce((s, a) => s + Number(a.qty || 0), 0);
    const unbookedTotal = Math.max(sageQty - totalSage, 0);
    const sageShortfall = Math.max(totalSage - sageQty, 0);
    const sourceLabel = (s) => {
        if (s === 'et') return '<span class="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">ET</span>';
        if (s === 'lot') return '<span class="text-xs px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">Lot</span>';
        if (s === 'fifo') return '<span class="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">FIFO</span>';
        if (s === 'shortfall') return '<span class="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">Shortfall</span>';
        return '';
    };
    const orderTypeBadge = (t) => {
        if (t === 'local') return '<span class="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">Local</span>';
        if (t === 'export') return '<span class="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">Export</span>';
        return '<span class="text-xs px-1.5 py-0.5 rounded bg-slate-200 text-slate-700" title="Legacy JO with no Local/Export flag - open Admin → Untyped JOs to flag it">Untyped</span>';
    };
    const renderAllocRow = (a) => `
        <tr class="border-t border-slate-100 ${a.source === 'shortfall' ? 'bg-red-50' : ''}">
            <td class="px-4 py-1.5 font-medium">${a.customer || '<span class="italic text-slate-400">Unknown</span>'}</td>
            <td class="px-4 py-1.5 text-slate-600">${a.jo_number || '-'}</td>
            <td class="px-4 py-1.5 text-right tabular-nums font-semibold">${fmt(a.qty)}</td>
            <td class="px-4 py-1.5">${unk(a.batch_no)}</td>
            <td class="px-4 py-1.5">${fmtDate(a.production_date)}</td>
            <td class="px-4 py-1.5">${fmtDate(a.expiry_date)}</td>
            <td class="px-4 py-1.5 text-center">${orderTypeBadge(a.order_type)}</td>
            <td class="px-4 py-1.5 text-center">${sourceLabel(a.source)}</td>
        </tr>`;
    const allocHtml = `
        <div class="mt-4">
            <div class="text-sm font-semibold text-slate-700 mb-1">Stock allocation by customer</div>
            <div class="text-xs text-slate-500 mb-2 italic">Export bookings draw from Sage on-hand. Local bookings draw from the ET- SKU (stock you moved to ET manually in Sage). Untyped legacy bookings sit under Sage until you flag them.</div>
            <div class="overflow-x-auto bg-white border border-slate-200 rounded-lg">
                <table class="min-w-full text-sm">
                    <thead class="bg-slate-50 text-xs uppercase text-slate-500">
                        <tr>
                            <th class="px-4 py-1.5 text-left">Customer</th>
                            <th class="px-4 py-1.5 text-left">JO / Ref</th>
                            <th class="px-4 py-1.5 text-right">Qty</th>
                            <th class="px-4 py-1.5 text-left">Batch</th>
                            <th class="px-4 py-1.5 text-left">Production</th>
                            <th class="px-4 py-1.5 text-left">Expiry</th>
                            <th class="px-4 py-1.5 text-center">Type</th>
                            <th class="px-4 py-1.5 text-center">Source</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="bg-slate-100">
                            <td colspan="8" class="px-4 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">Sage on-hand (${fmt(sageQty)}) - Export + Untyped bookings</td>
                        </tr>
                        ${sageAllocs.length === 0 ? `
                            <tr><td colspan="8" class="px-4 py-2 italic text-slate-400 text-center">No Export bookings against Sage stock.</td></tr>
                        ` : sageAllocs.map(renderAllocRow).join('')}
                        ${unbookedTotal > 0 ? `
                            <tr class="border-t-2 border-emerald-200 bg-emerald-50">
                                <td class="px-4 py-1.5 font-semibold text-emerald-800">Unbooked</td>
                                <td class="px-4 py-1.5 text-emerald-700 italic">free stock</td>
                                <td class="px-4 py-1.5 text-right tabular-nums font-bold text-emerald-700">${fmt(unbookedTotal)}</td>
                                <td colspan="4" class="px-4 py-1.5 text-xs text-emerald-700 italic">leftover Sage qty after Export + Untyped bookings</td>
                                <td class="px-4 py-1.5 text-center"><span class="text-xs px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">Free</span></td>
                            </tr>` : ''}
                        ${sageShortfall > 0 ? `
                            <tr class="border-t-2 border-red-200 bg-red-50">
                                <td class="px-4 py-1.5 font-semibold text-red-800">Overbook</td>
                                <td class="px-4 py-1.5 text-red-700 italic">bookings exceed Sage</td>
                                <td class="px-4 py-1.5 text-right tabular-nums font-bold text-red-700">−${fmt(sageShortfall)}</td>
                                <td colspan="4" class="px-4 py-1.5 text-xs text-red-700 italic">Export + Untyped bookings exceed Sage on-hand - stale reservations</td>
                                <td class="px-4 py-1.5 text-center"><span class="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">Overbook</span></td>
                            </tr>` : ''}
                        <tr class="border-t-2 border-slate-300 bg-slate-100">
                            <td colspan="2" class="px-4 py-1.5 font-semibold text-slate-700">Sage subtotal</td>
                            <td class="px-4 py-1.5 text-right tabular-nums font-bold">${fmt(totalSage + unbookedTotal - sageShortfall)}</td>
                            <td colspan="5" class="px-4 py-1.5 text-xs text-slate-500 italic">Bookings ${fmt(totalSage)}${unbookedTotal > 0 ? ` + Unbooked ${fmt(unbookedTotal)}` : ''}${sageShortfall > 0 ? ` − Overbook ${fmt(sageShortfall)}` : ''} = ${fmt(sageQty)}</td>
                        </tr>

                        ${etQty > 0 || etAllocs.length > 0 ? `
                            <tr class="bg-amber-100">
                                <td colspan="8" class="px-4 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800">ET- SKU (${fmt(etQty)}) - Local bookings</td>
                            </tr>
                            ${etAllocs.length === 0 ? `
                                <tr><td colspan="8" class="px-4 py-2 italic text-amber-400 text-center bg-amber-50">No Local bookings against ET stock.</td></tr>
                            ` : etAllocs.map(a => `
                                <tr class="border-t border-amber-200 bg-amber-50">
                                    <td class="px-4 py-1.5 font-medium">${a.customer}</td>
                                    <td class="px-4 py-1.5 text-slate-600">${a.jo_number}</td>
                                    <td class="px-4 py-1.5 text-right tabular-nums font-semibold">${fmt(a.qty)}</td>
                                    <td class="px-4 py-1.5">${unk(a.batch_no)}</td>
                                    <td class="px-4 py-1.5">${fmtDate(a.production_date)}</td>
                                    <td class="px-4 py-1.5">${fmtDate(a.expiry_date)}</td>
                                    <td class="px-4 py-1.5 text-center">${orderTypeBadge(a.order_type)}</td>
                                    <td class="px-4 py-1.5 text-center">${sourceLabel(a.source)}</td>
                                </tr>`).join('')}
                        ` : ''}

                        <tr class="border-t-2 border-slate-400 bg-slate-200">
                            <td colspan="2" class="px-4 py-1.5 font-bold text-slate-800">Grand total (Sage + ET)</td>
                            <td class="px-4 py-1.5 text-right tabular-nums font-bold">${fmt(sageQty + etQty)}</td>
                            <td colspan="5" class="px-4 py-1.5 text-xs text-slate-600 italic">Sage ${fmt(sageQty)} + ET ${fmt(etQty)} = ${fmt(sageQty + etQty)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>`;

    const lots = d.lots || [];
    const lotsHtml = lots.length === 0
        ? `<div class="text-sm text-slate-500 italic px-4 py-3 bg-white rounded-lg border border-slate-200">No physical lots in stock.</div>`
        : lots.map(lot => {
            const claims = (lot.claims || []);
            const claimsRows = claims.length === 0
                ? `<tr><td colspan="3" class="px-4 py-1.5 text-xs text-slate-400 italic">No bookings against this lot.</td></tr>`
                : claims.map(c => `
                    <tr class="border-t border-slate-100">
                        <td class="px-4 py-1.5 text-sm text-slate-700">${c.jo_number || '-'}</td>
                        <td class="px-4 py-1.5 text-sm text-slate-700">${c.customer || '-'}</td>
                        <td class="px-4 py-1.5 text-sm text-right tabular-nums text-blue-700">${fmt(c.qty)}</td>
                    </tr>`).join('');
            const expBadge = lot.expiry_from_pcr ? ` <span class="text-xs text-amber-600">(from PCR)</span>` : '';
            return `
                <div class="border border-slate-200 rounded-lg mb-2 bg-white overflow-hidden">
                    <div class="bg-slate-100 px-4 py-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                        <span><span class="font-semibold">Lot:</span> ${unk(lot.lot_number)}</span>
                        <span><span class="font-semibold">Production:</span> ${fmtDate(lot.production_date)}</span>
                        <span><span class="font-semibold">Expiry:</span> ${fmtDate(lot.expiry_date)}${expBadge}</span>
                        <span><span class="font-semibold">Available:</span> ${fmt(lot.qty_available)}</span>
                        <span class="ml-auto text-xs ${lot.qty_unclaimed > 0 ? 'text-emerald-600' : 'text-slate-400'}">Unclaimed: ${fmt(lot.qty_unclaimed)}</span>
                    </div>
                    <table class="min-w-full">
                        <thead class="bg-slate-50 text-xs uppercase text-slate-500">
                            <tr>
                                <th class="px-4 py-1.5 text-left">JO</th>
                                <th class="px-4 py-1.5 text-left">Customer</th>
                                <th class="px-4 py-1.5 text-right">Booked Qty</th>
                            </tr>
                        </thead>
                        <tbody>${claimsRows}</tbody>
                    </table>
                </div>`;
        }).join('');

    const unalloc = d.unallocated_from_stock || [];
    const shortfall = Number(d.booking_shortfall_qty || 0);
    const hasShortfall = shortfall > 0;
    const bookedPanelClass = hasShortfall ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200';
    const bookedHeaderClass = hasShortfall ? 'text-red-800' : 'text-blue-800';
    const bookedSubClass = hasShortfall ? 'text-red-700' : 'text-blue-700';
    const bookedDivider = hasShortfall ? 'border-red-200' : 'border-blue-200';
    const bookedHtml = unalloc.length === 0 ? '' : `
        <div class="mt-3 px-3 py-2 rounded-md border ${bookedPanelClass}">
            <div class="text-sm font-semibold ${bookedHeaderClass} mb-1">Booked stock - by batch (${unalloc.length})</div>
            <div class="text-xs ${bookedSubClass} mb-2 italic">FIFO-matched to completed production batches (no <code>stock_lots</code> entries exist for this item).</div>
            <table class="min-w-full text-sm">
                <thead class="text-xs uppercase ${bookedSubClass}">
                    <tr>
                        <th class="text-left pr-3 py-1">JO</th>
                        <th class="text-left pr-3 py-1">Customer</th>
                        <th class="text-right pr-3 py-1">Qty</th>
                        <th class="text-left pr-3 py-1">Likely Batch</th>
                        <th class="text-left pr-3 py-1">Production</th>
                        <th class="text-left py-1">Expiry</th>
                    </tr>
                </thead>
                <tbody>
                    ${unalloc.map(r => {
                        const srcs = r.sources || [];
                        const sf = Number(r.shortfall_qty || 0);
                        const baseRows = srcs.length === 0
                            ? `
                                <tr class="border-t ${bookedDivider}">
                                    <td class="pr-3 py-1">${r.jo_number || '-'}</td>
                                    <td class="pr-3 py-1">${r.customer || '-'}</td>
                                    <td class="text-right tabular-nums pr-3 py-1">${fmt(r.qty_remaining)}</td>
                                    <td colspan="3" class="py-1 italic text-slate-500">No matching production batch on record</td>
                                </tr>`
                            : srcs.map((s, i) => `
                                <tr class="${i === 0 ? 'border-t ' + bookedDivider : ''}">
                                    <td class="pr-3 py-1">${i === 0 ? (r.jo_number || '-') : ''}</td>
                                    <td class="pr-3 py-1">${i === 0 ? (r.customer || '-') : ''}</td>
                                    <td class="text-right tabular-nums pr-3 py-1">${fmt(s.qty)}</td>
                                    <td class="pr-3 py-1">${unk(s.batch_no)}</td>
                                    <td class="pr-3 py-1">${fmtDate(s.production_date)}</td>
                                    <td class="py-1">${fmtDate(s.expiry_date)}</td>
                                </tr>`).join('');
                        const sfRow = sf > 0 ? `
                            <tr>
                                <td></td><td></td>
                                <td class="text-right tabular-nums pr-3 py-1 text-red-700 font-semibold">${fmt(sf)}</td>
                                <td colspan="3" class="py-1 text-xs text-red-700 italic">No matching production qty - likely overbook</td>
                            </tr>` : '';
                        return baseRows + sfRow;
                    }).join('')}
                </tbody>
            </table>
        </div>`;

    const free = d.free_stock_by_batch || [];
    const freeHtml = free.length === 0 ? '' : `
        <div class="mt-3 px-3 py-2 rounded-md border bg-emerald-50 border-emerald-200">
            <div class="text-sm font-semibold text-emerald-800 mb-1">Free stock - by batch (${free.length})</div>
            <div class="text-xs text-emerald-700 mb-2 italic">Remaining unbooked qty per production batch (FIFO leftover after booking match).</div>
            <table class="min-w-full text-sm">
                <thead class="text-xs uppercase text-emerald-700">
                    <tr>
                        <th class="text-left pr-3 py-1">Batch</th>
                        <th class="text-left pr-3 py-1">Production</th>
                        <th class="text-left pr-3 py-1">Expiry</th>
                        <th class="text-right py-1">Qty</th>
                    </tr>
                </thead>
                <tbody>
                    ${free.map(f => `
                        <tr class="border-t border-emerald-200">
                            <td class="pr-3 py-1">${unk(f.batch_no)}</td>
                            <td class="pr-3 py-1">${fmtDate(f.production_date)}</td>
                            <td class="pr-3 py-1">${fmtDate(f.expiry_date)}</td>
                            <td class="text-right tabular-nums py-1 text-emerald-700 font-semibold">${fmt(f.qty)}</td>
                        </tr>`).join('')}
                </tbody>
            </table>
        </div>`;

    const unallocHtml = bookedHtml + freeHtml;

    const history = d.production_history || [];
    const batchStatusColor = (s) => {
        if (s === 'completed') return 'bg-emerald-100 text-emerald-700';
        if (s === 'in_progress') return 'bg-amber-100 text-amber-800';
        if (s === 'planned') return 'bg-sky-100 text-sky-700';
        return 'bg-slate-100 text-slate-700';
    };
    const historyHtml = history.length === 0 ? '' : `
        <div class="mt-4">
            <div class="text-sm font-semibold text-slate-700 mb-1">Production history (${history.length})</div>
            <div class="overflow-x-auto bg-white border border-slate-200 rounded-lg">
                <table class="min-w-full text-sm">
                    <thead class="bg-slate-50 text-xs uppercase text-slate-500">
                        <tr>
                            <th class="px-4 py-1.5 text-left">Batch No</th>
                            <th class="px-4 py-1.5 text-left">Recipe</th>
                            <th class="px-4 py-1.5 text-right">Planned</th>
                            <th class="px-4 py-1.5 text-right">Actual</th>
                            <th class="px-4 py-1.5 text-left">Production</th>
                            <th class="px-4 py-1.5 text-left">Expiry</th>
                            <th class="px-4 py-1.5 text-left">Status</th>
                            <th class="px-4 py-1.5 text-center">FG-IN Lot?</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${history.map(h => `
                            <tr class="border-t border-slate-100">
                                <td class="px-4 py-1.5">${unk(h.batch_no)}</td>
                                <td class="px-4 py-1.5 text-slate-600">${h.recipe_name || '<span class="italic text-slate-400">Unknown</span>'}</td>
                                <td class="px-4 py-1.5 text-right tabular-nums text-slate-600">${fmt(h.planned_qty)}</td>
                                <td class="px-4 py-1.5 text-right tabular-nums">${h.actual_qty == null ? '<span class="italic text-slate-400">-</span>' : fmt(h.actual_qty)}</td>
                                <td class="px-4 py-1.5">${fmtDate(h.production_date)}</td>
                                <td class="px-4 py-1.5">${fmtDate(h.expiry_date)}</td>
                                <td class="px-4 py-1.5"><span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${batchStatusColor(h.batch_status)}">${h.batch_status || 'unknown'}</span></td>
                                <td class="px-4 py-1.5 text-center">${h.has_fg_in_lot ? '<span class="text-emerald-600">✓</span>' : '<span class="text-red-500" title="Stock posted to Sage but no FG-IN entry in app">✗</span>'}</td>
                            </tr>`).join('')}
                    </tbody>
                </table>
            </div>
            ${history.some(h => !h.has_fg_in_lot && (h.actual_qty || 0) > 0) ? `
                <div class="mt-2 text-xs text-slate-500 italic">
                    Rows with ✗ in FG-IN Lot column: production completed but no FG-IN Sage Entry was created in this app - that's why "Physical lots" above appears empty even though Sage shows on-hand stock.
                </div>` : ''}
        </div>`;

    const stageColor = {
        'Awaiting plan': 'bg-slate-100 text-slate-700',
        'Planned': 'bg-sky-100 text-sky-700',
        'Producing': 'bg-amber-100 text-amber-800',
        'PCR filled': 'bg-indigo-100 text-indigo-700',
        "FG-IN'd": 'bg-emerald-100 text-emerald-700',
    };
    const tp = d.to_produce || [];
    const tpHtml = tp.length === 0 ? '' : `
        <div class="mt-4">
            <div class="text-sm font-semibold text-slate-700 mb-1">To-produce queue (${tp.length})</div>
            <div class="overflow-x-auto bg-white border border-slate-200 rounded-lg">
                <table class="min-w-full text-sm">
                    <thead class="bg-slate-50 text-xs uppercase text-slate-500">
                        <tr>
                            <th class="px-4 py-1.5 text-left">JO</th>
                            <th class="px-4 py-1.5 text-left">Customer</th>
                            <th class="px-4 py-1.5 text-right">Qty</th>
                            <th class="px-4 py-1.5 text-left">Batch No</th>
                            <th class="px-4 py-1.5 text-left">Production</th>
                            <th class="px-4 py-1.5 text-left">Expiry</th>
                            <th class="px-4 py-1.5 text-left">Stage</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tp.map(r => `
                            <tr class="border-t border-slate-100">
                                <td class="px-4 py-1.5">${r.jo_number || '-'}</td>
                                <td class="px-4 py-1.5">${r.customer || '-'}</td>
                                <td class="px-4 py-1.5 text-right tabular-nums">${fmt(r.qty)}</td>
                                <td class="px-4 py-1.5">${unk(r.batch_no)}</td>
                                <td class="px-4 py-1.5">${fmtDate(r.production_date)}</td>
                                <td class="px-4 py-1.5">${fmtDate(r.expiry_date)}</td>
                                <td class="px-4 py-1.5"><span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${stageColor[r.stage] || 'bg-slate-100 text-slate-700'}">${r.stage}</span></td>
                            </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;

    return `
        <td colspan="5" class="px-6 py-4 bg-slate-50 border-y border-slate-200">
            ${tiles}
            ${overbookBanner}
            ${toProduceNote}
            ${allocHtml}
            <div class="mt-4">
                <div class="text-sm font-semibold text-slate-700 mb-1">Physical lots (${lots.length})</div>
                ${lotsHtml}
                ${unallocHtml}
            </div>
            ${historyHtml}
            ${tpHtml}
        </td>`;
}

/**
 * Set filter for finished goods inventory
 * @param {string} filter - 'all', 'in-stock', or 'zero'
 */
export function setFGInventoryFilter(filter) {
    state.fgInventoryFilter = filter;
    
    // Update filter button styles
    const inactiveClass = "inventory-filter-btn text-xs font-medium px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-blue-500 transition-all duration-200";
    const activeClass = "inventory-filter-btn text-xs font-semibold px-4 py-2 rounded-lg bg-blue-600 text-white transition-all duration-200";
    
    document.getElementById('fg-filter-all').className = inactiveClass;
    document.getElementById('fg-filter-in-stock').className = inactiveClass;
    document.getElementById('fg-filter-zero').className = inactiveClass;
    document.getElementById(`fg-filter-${filter}`).className = activeClass;
    
    renderFGInventory();
}

/**
 * Search finished goods inventory (triggers re-render)
 */
export function searchFGInventory() {
    renderFGInventory();
}

// PERFORMANCE: Debounced version for oninput
export const debouncedSearchFG = debounce(searchFGInventory, 300);

/**
 * Print currently visible (filtered + searched) finished goods inventory.
 * Renders into a hidden iframe and triggers the browser print dialog.
 */
export function printFGInventory() {
    const searchInput = document.getElementById('fg-search-input');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

    let filteredData = state.fgInventoryData || [];
    if (state.fgInventoryFilter === 'in-stock') {
        filteredData = filteredData.filter(item => parseFloat(item['Qty On Hand'] || item['qty_on_hand'] || 0) > 0);
    } else if (state.fgInventoryFilter === 'zero') {
        filteredData = filteredData.filter(item => parseFloat(item['Qty On Hand'] || item['qty_on_hand'] || 0) === 0);
    }
    if (searchTerm) {
        filteredData = filteredData.filter(item => {
            const code = (item['Item Code'] || item['item_code'] || '').toLowerCase();
            const desc = (item['Item Description'] || item['description'] || '').toLowerCase();
            return code.includes(searchTerm) || desc.includes(searchTerm);
        });
    }

    if (filteredData.length === 0) {
        showToast('No items to print', 'warning');
        return;
    }

    _openPrintWindow({
        title: 'Finished Goods Inventory',
        filterKey: state.fgInventoryFilter,
        searchTerm,
        rows: filteredData,
        lowStockThreshold: 50
    });
}

// ============================================================================
// Excise Tax Declared Stock (ET- prefixed items)
// ============================================================================

/**
 * Load ET inventory from MongoDB cache (fast, no sync)
 */
export async function loadETInventory() {
    const loader = document.getElementById('loader-et-inv');
    const refreshBtn = document.querySelector('#inv-content-et button[onclick="loadETInventory()"]');
    const originalBtnContent = refreshBtn ? refreshBtn.innerHTML : null;

    if (loader) loader.style.display = 'block';

    try {
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = `
                <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Loading...</span>
            `;
        }

        const response = await authenticatedFetch('/api/et-inventory');
        const data = await response.json();
        state.etInventoryData = data;
        renderETInventory();
    } catch (error) {
        console.error(error);
        showToast('❌ Error loading ET inventory', 'error');
    } finally {
        if (loader) loader.style.display = 'none';
        if (refreshBtn && originalBtnContent) {
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = originalBtnContent;
        }
    }
}

/**
 * Sync ET items with Sage (full inventory sync), then reload data
 */
export async function syncETInventory() {
    const syncBtn = document.querySelector('#inv-content-et button[onclick="syncETInventory()"]');
    const originalBtnContent = syncBtn ? syncBtn.innerHTML : null;

    try {
        if (syncBtn) {
            syncBtn.disabled = true;
            syncBtn.innerHTML = `
                <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Syncing...</span>
            `;
        }

        showToast('🔄 Syncing Excise Tax Declared Stock with Sage...', 'info');

        const syncResponse = await authenticatedFetch('/api/inventory-transactions/sync', { method: 'POST' });
        let stockCount = 0;
        if (syncResponse.ok) {
            const syncResult = await syncResponse.json();
            stockCount = syncResult.stock_status?.stock_records || 0;
        }

        const response = await authenticatedFetch('/api/et-inventory');
        const data = await response.json();
        state.etInventoryData = data;
        renderETInventory();

        showToast(`✅ ET inventory synced (${stockCount} stock records updated)`, 'success');
    } catch (error) {
        console.error(error);
        showToast('❌ Error syncing ET inventory', 'error');
    } finally {
        if (syncBtn && originalBtnContent) {
            syncBtn.disabled = false;
            syncBtn.innerHTML = originalBtnContent;
        }
    }
}

/**
 * Render ET inventory table
 */
export function renderETInventory() {
    const tbody = document.getElementById('et-inventory-body');
    if (!tbody) return;

    const searchInput = document.getElementById('et-search-input');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

    let filteredData = state.etInventoryData || [];
    if (state.etInventoryFilter === 'in-stock') {
        filteredData = filteredData.filter(item => {
            const qty = item['Qty On Hand'] || item['qty_on_hand'] || 0;
            return parseFloat(qty) > 0;
        });
    } else if (state.etInventoryFilter === 'zero') {
        filteredData = filteredData.filter(item => {
            const qty = item['Qty On Hand'] || item['qty_on_hand'] || 0;
            return parseFloat(qty) === 0;
        });
    }

    if (searchTerm) {
        filteredData = filteredData.filter(item => {
            const code = (item['Item Code'] || item['item_code'] || '').toLowerCase();
            const desc = (item['Item Description'] || item['description'] || '').toLowerCase();
            return code.includes(searchTerm) || desc.includes(searchTerm);
        });
    }

    if (filteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-slate-500">No items found</td></tr>`;
        return;
    }

    const fragment = document.createDocumentFragment();

    filteredData.forEach(item => {
        const row = document.createElement('tr');
        const code = item['Item Code'] || item['item_code'] || '';
        const desc = item['Item Description'] || item['description'] || '';
        const uom = item['UOM'] || item['uom'] || '';
        const qty = item['Qty On Hand'] || item['qty_on_hand'] || 0;
        const qtyNum = parseFloat(qty);

        row.className = 'hover:bg-slate-50 transition-colors border-b border-slate-100 cursor-pointer';
        row.dataset.etRow = code;

        let statusBadge = '';
        if (qtyNum === 0) {
            statusBadge = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Out of Stock</span>';
        } else if (qtyNum < 50) {
            statusBadge = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">Low Stock</span>';
        } else {
            statusBadge = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">In Stock</span>';
        }

        row.innerHTML = `
            <td class="px-6 py-4 text-sm font-medium text-slate-900">${code}</td>
            <td class="px-6 py-4 text-sm text-slate-600">${desc}</td>
            <td class="px-6 py-4 text-sm text-slate-600 uppercase">${uom || '-'}</td>
            <td class="px-6 py-4 text-sm text-right text-slate-900 font-semibold tabular-nums">${qtyNum.toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})}</td>
            <td class="px-6 py-4 text-center">${statusBadge}</td>
        `;
        row.addEventListener('click', () => toggleETRowExpand(code));
        fragment.appendChild(row);
    });

    tbody.innerHTML = '';
    tbody.appendChild(fragment);
}

async function toggleETRowExpand(itemCode) {
    const selector = `tr[data-et-expand-for="${CSS.escape(itemCode)}"]`;
    const existing = document.querySelector(selector);
    if (existing) {
        existing.remove();
        return;
    }
    document.querySelectorAll('tr[data-et-expand-for]').forEach(el => el.remove());

    const parentRow = document.querySelector(`tr[data-et-row="${CSS.escape(itemCode)}"]`);
    if (!parentRow) return;

    const placeholder = document.createElement('tr');
    placeholder.setAttribute('data-et-expand-for', itemCode);
    placeholder.innerHTML = `<td colspan="5" class="px-6 py-4 bg-slate-50 text-sm text-slate-500">Loading…</td>`;
    parentRow.after(placeholder);

    try {
        // The FG summary endpoint accepts either the base or the ET- code and
        // returns both halves in one shot. We render only the ET section here.
        const res = await authenticatedFetch(`/api/finished-goods-inventory/${encodeURIComponent(itemCode)}/summary`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        placeholder.innerHTML = renderETExpandedPanel(data);
    } catch (err) {
        console.error('ET summary fetch failed', err);
        placeholder.innerHTML = `<td colspan="5" class="px-6 py-4 bg-red-50 text-sm text-red-700">Failed to load summary</td>`;
    }
}

function renderETExpandedPanel(d) {
    const fmt = (n) => Number(n || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 4});
    const fmtDate = (iso) => {
        if (!iso) return '<span class="italic text-slate-400">Unknown</span>';
        const dt = new Date(iso);
        if (isNaN(dt.getTime())) return '<span class="italic text-slate-400">Unknown</span>';
        return `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}-${dt.getFullYear()}`;
    };
    const unk = (txt) => txt ? `<span class="font-mono">${txt}</span>` : `<span class="italic text-slate-400">Unknown</span>`;

    const etQty = Number(d.et_qty || 0);
    const bookedLocal = Number(d.booked_local_from_stock || 0);
    const etUnbooked = Number(d.et_unbooked || 0);
    const isOver = !!d.is_et_overbooked;

    // ET section only: rows that draw from ET stock are order_type='local' or source='et'.
    const allocs = (d.customer_allocations || []).filter(a => a.order_type === 'local' || a.source === 'et');

    const tiles = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div class="bg-white rounded-lg p-3 border border-amber-200">
                <div class="text-xs uppercase tracking-wide text-amber-700">ET on-hand</div>
                <div class="text-lg font-semibold tabular-nums text-amber-800">${fmt(etQty)}</div>
            </div>
            <div class="bg-white rounded-lg p-3 border border-amber-300">
                <div class="text-xs uppercase tracking-wide text-amber-700">Booked (Local)</div>
                <div class="text-lg font-semibold tabular-nums text-amber-800">${fmt(bookedLocal)}</div>
            </div>
            <div class="bg-white rounded-lg p-3 border ${isOver ? 'border-red-300' : 'border-emerald-200'}">
                <div class="text-xs uppercase tracking-wide ${isOver ? 'text-red-600' : 'text-emerald-600'}">Unbooked (ET)</div>
                <div class="text-lg font-semibold tabular-nums ${isOver ? 'text-red-700' : 'text-emerald-700'}">${fmt(etUnbooked)}</div>
            </div>
            <div class="bg-white rounded-lg p-3 border border-slate-200">
                <div class="text-xs uppercase tracking-wide text-slate-500">Base SKU on-hand</div>
                <div class="text-lg font-semibold tabular-nums text-slate-700">${fmt(d.sage_qty)}</div>
            </div>
        </div>`;

    const overbookBanner = isOver ? `
        <div class="mt-3 px-3 py-2 rounded-md bg-red-50 border border-red-200 text-sm text-red-800">
            <strong>ET overbooked by ${fmt(d.et_overbook_qty)}</strong> - Local bookings exceed ET on-hand.
            Likely cause: stock not yet moved base→ET in Sage. Move it manually or flip JO to Export.
        </div>` : '';

    const allocHtml = `
        <div class="mt-4">
            <div class="text-sm font-semibold text-slate-700 mb-1">Local bookings against ET stock</div>
            <div class="overflow-x-auto bg-white border border-amber-200 rounded-lg">
                <table class="min-w-full text-sm">
                    <thead class="bg-amber-50 text-xs uppercase text-amber-800">
                        <tr>
                            <th class="px-4 py-1.5 text-left">Customer</th>
                            <th class="px-4 py-1.5 text-left">JO / Ref</th>
                            <th class="px-4 py-1.5 text-right">Qty</th>
                            <th class="px-4 py-1.5 text-left">Batch</th>
                            <th class="px-4 py-1.5 text-left">Production</th>
                            <th class="px-4 py-1.5 text-left">Expiry</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${allocs.length === 0 ? `
                            <tr><td colspan="6" class="px-4 py-2 italic text-amber-400 text-center">No Local bookings on this ET- SKU.</td></tr>
                        ` : allocs.map(a => `
                            <tr class="border-t border-amber-100 ${a.source === 'shortfall' ? 'bg-red-50' : 'bg-amber-50'}">
                                <td class="px-4 py-1.5 font-medium">${a.customer || '<span class="italic text-slate-400">Unknown</span>'}</td>
                                <td class="px-4 py-1.5 text-slate-600">${a.jo_number || '-'}</td>
                                <td class="px-4 py-1.5 text-right tabular-nums font-semibold">${fmt(a.qty)}</td>
                                <td class="px-4 py-1.5">${unk(a.batch_no)}</td>
                                <td class="px-4 py-1.5">${fmtDate(a.production_date)}</td>
                                <td class="px-4 py-1.5">${fmtDate(a.expiry_date)}</td>
                            </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;

    return `
        <td colspan="5" class="px-6 py-4 bg-slate-50 border-y border-slate-200">
            ${tiles}
            ${overbookBanner}
            ${allocHtml}
        </td>`;
}

export function setETInventoryFilter(filter) {
    state.etInventoryFilter = filter;

    const inactiveClass = "inventory-filter-btn text-xs font-medium px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-blue-500 transition-all duration-200";
    const activeClass = "inventory-filter-btn text-xs font-semibold px-4 py-2 rounded-lg bg-blue-600 text-white transition-all duration-200";

    document.getElementById('et-filter-all').className = inactiveClass;
    document.getElementById('et-filter-in-stock').className = inactiveClass;
    document.getElementById('et-filter-zero').className = inactiveClass;
    document.getElementById(`et-filter-${filter}`).className = activeClass;

    renderETInventory();
}

export function searchETInventory() {
    renderETInventory();
}

export const debouncedSearchET = debounce(searchETInventory, 300);

export function printETInventory() {
    const searchInput = document.getElementById('et-search-input');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

    let filteredData = state.etInventoryData || [];
    if (state.etInventoryFilter === 'in-stock') {
        filteredData = filteredData.filter(item => parseFloat(item['Qty On Hand'] || item['qty_on_hand'] || 0) > 0);
    } else if (state.etInventoryFilter === 'zero') {
        filteredData = filteredData.filter(item => parseFloat(item['Qty On Hand'] || item['qty_on_hand'] || 0) === 0);
    }
    if (searchTerm) {
        filteredData = filteredData.filter(item => {
            const code = (item['Item Code'] || item['item_code'] || '').toLowerCase();
            const desc = (item['Item Description'] || item['description'] || '').toLowerCase();
            return code.includes(searchTerm) || desc.includes(searchTerm);
        });
    }

    if (filteredData.length === 0) {
        showToast('No items to print', 'warning');
        return;
    }

    _openPrintWindow({
        title: 'Excise Tax Declared Stock',
        filterKey: state.etInventoryFilter,
        searchTerm,
        rows: filteredData,
        lowStockThreshold: 50
    });
}

// ============================================================================
// Print helper (shared between RM and FG)
// ============================================================================

function _escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function _openPrintWindow({ title, filterKey, searchTerm, rows, lowStockThreshold }) {
    const filterLabel = filterKey === 'in-stock' ? 'In Stock'
        : filterKey === 'zero' ? 'Zero Quantity'
        : 'All Items';
    const searchPart = searchTerm ? ` &middot; Search: "${_escapeHtml(searchTerm)}"` : '';
    const printedAt = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Dubai' });

    const rowsHtml = rows.map((item, idx) => {
        const code = _escapeHtml(item['Item Code'] || item['item_code'] || '');
        const desc = _escapeHtml(item['Item Description'] || item['description'] || '');
        const uom = _escapeHtml(item['UOM'] || item['uom'] || '');
        const qtyNum = parseFloat(item['Qty On Hand'] || item['qty_on_hand'] || 0);
        const qtyStr = qtyNum.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
        const statusText = qtyNum === 0 ? 'Out of Stock' : (qtyNum < lowStockThreshold ? 'Low Stock' : 'In Stock');
        const statusClass = qtyNum === 0 ? 'st-out' : (qtyNum < lowStockThreshold ? 'st-low' : 'st-in');
        return `<tr>
            <td class="sn">${idx + 1}</td>
            <td class="code">${code}</td>
            <td>${desc}</td>
            <td class="uom">${uom || '-'}</td>
            <td class="num">${qtyStr}</td>
            <td class="${statusClass}">${statusText}</td>
        </tr>`;
    }).join('');

    const letterheadUrl = `${window.location.origin}/app/demoplant.jpg`;

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Demo Plant - ${_escapeHtml(title)}</title>
<style>
    /* Margin: 0 on @page suppresses the browser-injected URL/title/page-number overlays.
       Visible margins are reproduced by padding on .content. */
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; width: 210mm; }
    body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

    /* Full-page letterhead background (logo + company info + watermark all baked in) */
    .page-bg {
        position: fixed;
        top: 0; left: 0;
        width: 210mm;
        height: 297mm;
        z-index: -1;
        pointer-events: none;
        user-select: none;
    }

    /* Content sits on top of the letterhead.
       Top padding (~42mm) clears the letterhead header strip; matches pdf_config.margins.top. */
    .content { padding: 44mm 14mm 18mm; position: relative; }

    /* Title block */
    h1 { font-size: 15px; margin: 0 0 3px; color: #0f172a; }
    .meta { font-size: 10px; color: #475569; margin-bottom: 10px; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; }

    /* Table - stronger borders + zebra rows for legibility.
       print-color-adjust: exact forces backgrounds to print even when the user
       has Chrome's "Print backgrounds" checkbox off. */
    table { width: 100%; border-collapse: collapse; font-size: 10px; table-layout: fixed; border: 1.5px solid #334155; background: rgba(255,255,255,0.92); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    col.c-sn   { width: 5%; }
    col.c-code { width: 16%; }
    col.c-desc { width: 35%; }
    col.c-uom  { width: 14%; }
    col.c-qty  { width: 15%; }
    col.c-stat { width: 15%; }
    th, td { border: 1px solid #94a3b8; padding: 6px 8px; text-align: left; vertical-align: middle; word-wrap: break-word; overflow-wrap: break-word; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    thead th { background: #1e293b !important; color: #ffffff !important; font-weight: 700; text-transform: uppercase; font-size: 9px; letter-spacing: 0.05em; padding: 7px 8px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    tbody tr:nth-child(even) td { background: #f1f5f9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    td.sn { text-align: center; font-weight: 600; color: #475569; }
    td.code { font-weight: 600; color: #0f172a; }
    td.uom { text-transform: uppercase; white-space: nowrap; text-align: center; }
    td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
    tr { page-break-inside: avoid; }
    .st-out { color: #991b1b; font-weight: 700; }
    .st-low { color: #9a3412; font-weight: 700; }
    .st-in  { color: #166534; font-weight: 700; }

    /* Footer */
    .foot { margin-top: 10px; font-size: 8px; color: #94a3b8; text-align: center; }
</style></head><body>
    <img class="page-bg" src="${letterheadUrl}" alt="" aria-hidden="true">
    <div class="content">
        <h1>${_escapeHtml(title)}</h1>
        <div class="meta">Filter: ${filterLabel}${searchPart} &middot; ${rows.length} item${rows.length === 1 ? '' : 's'} &middot; Printed: ${_escapeHtml(printedAt)} (UAE)</div>
        <table>
            <colgroup>
                <col class="c-sn"><col class="c-code"><col class="c-desc"><col class="c-uom"><col class="c-qty"><col class="c-stat">
            </colgroup>
            <thead><tr>
                <th class="num">#</th><th>Item Code</th><th>Description</th><th>UOM</th><th class="num">Qty On Hand</th><th>Status</th>
            </tr></thead>
            <tbody>${rowsHtml}</tbody>
        </table>
        <div class="foot">Inventory Management System &middot; Confidential</div>
    </div>
</body></html>`;

    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();

    const triggerPrint = () => {
        const imgs = Array.from(iframe.contentWindow.document.images || []);
        const waits = imgs.map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => {
                img.addEventListener('load', resolve, { once: true });
                img.addEventListener('error', resolve, { once: true });
                setTimeout(resolve, 2000); // safety net
            });
        });
        Promise.all(waits).then(() => {
            try {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
            } catch (err) {
                console.error('Print failed', err);
                showToast('❌ Print failed', 'error');
            }
            setTimeout(() => {
                if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
            }, 1000);
        });
    };

    if (iframe.contentWindow.document.readyState === 'complete') {
        triggerPrint();
    } else {
        iframe.onload = triggerPrint;
    }
}
