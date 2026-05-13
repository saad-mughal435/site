/**
 * Demo Plant LLC - Raw Material Order Module
 * Handles the full procurement workflow:
 *   Critical Materials → Requisition → LPO → Receive → Sage GRN
 */

import { showToast, formatNumber } from '../utils.js?v=20260125h';
import { authenticatedFetch, hasAnyRole, getCurrentUser } from '../auth.js?v=20260428b';

// ============================================================================
// State
// ============================================================================

let criticalMaterials = [];
let selectedMaterials = new Set();
let allSuppliers = [];
let rmOrders = [];
let currentSubTab = 'critical';
let forecastMonth = null;
let forecastGeneratedAt = null;

// ============================================================================
// Sub-Tab Switching
// ============================================================================

export function switchRMOrderTab(tab) {
    currentSubTab = tab;

    // Update tab button styles
    document.querySelectorAll('.rmorder-tab').forEach(btn => {
        btn.classList.remove('bg-indigo-600', 'text-white');
        btn.classList.add('text-gray-600', 'hover:bg-gray-100');
    });
    const active = document.getElementById(`rmtab-${tab}`);
    if (active) {
        active.classList.remove('text-gray-600', 'hover:bg-gray-100');
        active.classList.add('bg-indigo-600', 'text-white');
    }

    // Show / hide content panels
    document.querySelectorAll('.rmorder-content').forEach(el => el.classList.add('hidden'));
    const panel = document.getElementById(`rmorder-${tab}`);
    if (panel) panel.classList.remove('hidden');

    // Load data for the tab
    switch (tab) {
        case 'dashboard': loadRMDashboard(); break;
        case 'critical': loadCriticalMaterials(); break;
        case 'orders': loadRMOrders(); break;
        case 'receive': loadReceivableOrders(); break;
        case 'grndocs': loadGRNDocuments(); break;
        case 'suppliers': loadSuppliers(); break;
        case 'customers': loadCustomers(); break;
    }
}

// ============================================================================
// Page entry-point (called from app.js)
// ============================================================================

export async function loadRMOrderPage() {
    await loadSupplierOptions();
    switchRMOrderTab('dashboard');
}

// ============================================================================
// SUPPLIERS
// ============================================================================

async function loadSupplierOptions() {
    try {
        const res = await authenticatedFetch('/api/suppliers?active_only=true');
        const data = await res.json();
        allSuppliers = data.suppliers || [];
        const sel = document.getElementById('rm-supplier-select');
        if (sel) {
            sel.innerHTML = '<option value="">-- Select Supplier --</option>' +
                allSuppliers.map(s =>
                    `<option value="${s._id}" data-name="${s.name}">${s.supplier_code} - ${s.name}</option>`
                ).join('');
        }
    } catch (e) {
        console.error('Failed to load suppliers:', e);
    }
}

export async function loadSuppliers() {
    try {
        const res = await authenticatedFetch('/api/suppliers?active_only=false');
        const data = await res.json();
        allSuppliers = data.suppliers || [];
        renderSuppliersTable();
    } catch (e) {
        showToast('Failed to load suppliers', 'error');
    }
}

function renderSuppliersTable() {
    const container = document.getElementById('suppliers-container');
    if (!container) return;

    if (allSuppliers.length === 0) {
        container.innerHTML = `<div class="p-8 text-center text-gray-400">
            No suppliers found. Click "Add Supplier" to get started.
        </div>`;
        return;
    }

    let html = `<table class="w-full text-sm">
        <thead>
            <tr class="bg-gray-50 border-b">
                <th class="text-left px-4 py-3 font-semibold text-gray-600">Code</th>
                <th class="text-left px-4 py-3 font-semibold text-gray-600">Name</th>
                <th class="text-left px-4 py-3 font-semibold text-gray-600">Address</th>
                <th class="text-center px-4 py-3 font-semibold text-gray-600">Status</th>
                <th class="text-center px-4 py-3 font-semibold text-gray-600">Actions</th>
            </tr>
        </thead>
        <tbody>`;

    allSuppliers.forEach(s => {
        const status = s.is_active !== false;
        html += `<tr class="border-b hover:bg-gray-50 transition-colors">
            <td class="px-4 py-2.5 font-mono text-xs">${s.supplier_code || ''}</td>
            <td class="px-4 py-2.5 font-medium">${s.name || ''}</td>
            <td class="px-4 py-2.5 text-gray-500 text-xs">${s.address || '-'}</td>
            <td class="px-4 py-2.5 text-center">
                <span class="px-2 py-0.5 rounded-full text-xs font-medium ${
                    status ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }">${status ? 'Active' : 'Inactive'}</span>
            </td>
            <td class="px-4 py-2.5 text-center">
                <button onclick="editSupplier('${s._id}')" class="text-indigo-600 hover:text-indigo-800 text-xs font-medium mr-3" title="Edit">
                    <svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                    Edit
                </button>
                <button onclick="deleteSupplier('${s._id}', '${(s.name || '').replace(/'/g, "\\'")}')" class="text-red-600 hover:text-red-800 text-xs font-medium" title="Delete">
                    <svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    Delete
                </button>
            </td>
        </tr>`;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

let editingSupplierId = null;

export function showAddSupplierModal() {
    editingSupplierId = null;
    document.getElementById('supplier-modal-title').textContent = 'Add New Supplier';
    document.getElementById('supplier-modal-save-btn').textContent = 'Save Supplier';
    document.getElementById('add-supplier-modal').classList.remove('hidden');
    document.getElementById('new-supplier-name').value = '';
    document.getElementById('new-supplier-address').value = '';
}

export function closeAddSupplierModal() {
    document.getElementById('add-supplier-modal').classList.add('hidden');
    editingSupplierId = null;
}

export function editSupplier(supplierId) {
    const supplier = allSuppliers.find(s => s._id === supplierId);
    if (!supplier) {
        showToast('Supplier not found', 'error');
        return;
    }
    editingSupplierId = supplierId;
    document.getElementById('supplier-modal-title').textContent = 'Edit Supplier';
    document.getElementById('supplier-modal-save-btn').textContent = 'Update Supplier';
    document.getElementById('new-supplier-name').value = supplier.name || '';
    document.getElementById('new-supplier-address').value = supplier.address || '';
    document.getElementById('add-supplier-modal').classList.remove('hidden');
}

export async function deleteSupplier(supplierId, supplierName) {
    if (!confirm(`Are you sure you want to delete supplier "${supplierName}"? This cannot be undone.`)) {
        return;
    }
    try {
        const res = await authenticatedFetch(`/api/suppliers/${supplierId}`, {
            method: 'DELETE',
        });
        const data = await res.json();
        if (data.success) {
            showToast('Supplier deleted', 'success');
            await loadSuppliers();
            await loadSupplierOptions();
        } else {
            showToast(data.detail || 'Failed to delete supplier', 'error');
        }
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

export async function saveNewSupplier() {
    const name = document.getElementById('new-supplier-name').value.trim();
    if (!name) {
        showToast('Supplier name is required', 'error');
        return;
    }
    const payload = {
        name,
        address: document.getElementById('new-supplier-address').value.trim() || null,
    };

    try {
        let res;
        if (editingSupplierId) {
            // Update existing supplier
            res = await authenticatedFetch(`/api/suppliers/${editingSupplierId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
        } else {
            // Create new supplier
            res = await authenticatedFetch('/api/suppliers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
        }
        const data = await res.json();
        if (data.success) {
            showToast(editingSupplierId ? 'Supplier updated' : `Supplier ${data.supplier_code} created`, 'success');
            closeAddSupplierModal();
            await loadSuppliers();
            await loadSupplierOptions();
        } else {
            showToast(data.detail || 'Failed to save supplier', 'error');
        }
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

// ============================================================================
// DASHBOARD
// ============================================================================

export async function loadRMDashboard() {
    const container = document.getElementById('rm-dashboard-container');
    if (!container) return;
    container.innerHTML = `<div class="bg-white rounded-xl shadow-lg p-8 text-center text-gray-400">
        <div class="loader border-indigo-600 border-t-transparent w-8 h-8 mx-auto mb-4"></div>
        Loading dashboard...
    </div>`;

    try {
        const res = await authenticatedFetch('/api/rm-orders/dashboard');
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || `Server error (${res.status})`);
        }
        const data = await res.json();
        renderRMDashboard(data);
    } catch (e) {
        container.innerHTML = `<div class="bg-white rounded-xl shadow-lg p-8 text-center text-red-400">Failed to load dashboard: ${e.message}</div>`;
    }
}

function renderRMDashboard(data) {
    const container = document.getElementById('rm-dashboard-container');
    if (!container) return;

    const sc = data.status_counts || {};
    const summaries = data.lpo_summaries || [];
    const totalLPOValue = data.total_value || 0;

    // Summary cards — 5 cards in a responsive grid
    let html = `<div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div class="bg-white rounded-xl shadow-lg p-5 border-l-4 border-indigo-500">
            <div class="text-sm text-gray-500 mb-1">Active LPOs</div>
            <div class="text-2xl font-bold text-indigo-700">${data.total_active_lpos || 0}</div>
        </div>
        <div class="bg-white rounded-xl shadow-lg p-5 border-l-4 border-blue-500">
            <div class="text-sm text-gray-500 mb-1">Total LPO Value</div>
            <div class="text-xl font-bold text-blue-700">AED ${totalLPOValue.toLocaleString(undefined, {minimumFractionDigits:4, maximumFractionDigits:4})}</div>
        </div>
        <div class="bg-white rounded-xl shadow-lg p-5 border-l-4 border-amber-500">
            <div class="text-sm text-gray-500 mb-1">Awaiting Delivery</div>
            <div class="text-2xl font-bold text-amber-700">${sc.lpo || 0}</div>
        </div>
        <div class="bg-white rounded-xl shadow-lg p-5 border-l-4 border-orange-500">
            <div class="text-sm text-gray-500 mb-1">Partially Received</div>
            <div class="text-2xl font-bold text-orange-700">${sc.partially_received || 0}</div>
        </div>
        <div class="bg-white rounded-xl shadow-lg p-5 border-l-4 border-green-500">
            <div class="text-sm text-gray-500 mb-1">Fully Received</div>
            <div class="text-2xl font-bold text-green-700">${sc.received || 0}</div>
        </div>
    </div>`;

    // LPO progress table
    if (summaries.length === 0) {
        html += `<div class="bg-white rounded-xl shadow-lg p-8 text-center text-gray-400">
            No LPOs found. Create a requisition and approve it to see data here.
        </div>`;
    } else {
        html += `<div class="bg-white rounded-xl shadow-lg overflow-hidden">
            <div class="px-6 py-4 border-b">
                <h3 class="text-lg font-bold text-gray-900">LPO Delivery Progress</h3>
            </div>
            <div class="overflow-x-auto">
            <table class="w-full text-sm">
                <thead>
                    <tr class="bg-gray-50 border-b">
                        <th class="text-left px-4 py-3 font-semibold text-gray-600">LPO #</th>
                        <th class="text-left px-4 py-3 font-semibold text-gray-600">Supplier</th>
                        <th class="text-center px-4 py-3 font-semibold text-gray-600">Status</th>
                        <th class="text-right px-4 py-3 font-semibold text-gray-600">Value (AED)</th>
                        <th class="text-center px-4 py-3 font-semibold text-gray-600">Exp. Delivery</th>
                        <th class="text-right px-4 py-3 font-semibold text-gray-600">Ordered</th>
                        <th class="text-right px-4 py-3 font-semibold text-gray-600">Received</th>
                        <th class="px-4 py-3 font-semibold text-gray-600 min-w-[150px]">Progress</th>
                        <th class="text-center px-4 py-3 font-semibold text-gray-600">GRNs</th>
                        <th class="text-center px-4 py-3 font-semibold text-gray-600">Actions</th>
                    </tr>
                </thead>
                <tbody>`;

        summaries.forEach(s => {
            const statusBadge = getDashboardStatusBadge(s.status);
            const pct = s.percent_complete || 0;
            const barColor = pct >= 100 ? 'bg-green-500' : (pct > 50 ? 'bg-indigo-500' : 'bg-orange-500');
            const expDel = s.expected_delivery ? new Date(s.expected_delivery).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

            html += `<tr class="border-b hover:bg-gray-50 transition-colors">
                <td class="px-4 py-3 font-mono text-xs font-bold">${s.order_number}</td>
                <td class="px-4 py-3">${s.supplier_name || 'N/A'}</td>
                <td class="px-4 py-3 text-center">
                    <span class="px-2 py-0.5 rounded-full text-xs font-bold ${statusBadge}">${s.status.toUpperCase().replace(/_/g, ' ')}</span>
                </td>
                <td class="px-4 py-3 text-right font-medium">${(s.total_value || 0).toLocaleString(undefined, {minimumFractionDigits:4, maximumFractionDigits:4})}</td>
                <td class="px-4 py-3 text-center text-gray-600 text-xs">${expDel}</td>
                <td class="px-4 py-3 text-right">${(s.total_ordered || 0).toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})}</td>
                <td class="px-4 py-3 text-right font-medium text-green-700">${(s.total_received || 0).toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})}</td>
                <td class="px-4 py-3">
                    <div class="flex items-center gap-2">
                        <div class="flex-1 bg-gray-200 rounded-full h-2.5">
                            <div class="${barColor} h-2.5 rounded-full transition-all" style="width: ${Math.min(100, pct)}%"></div>
                        </div>
                        <span class="text-xs font-bold ${pct >= 100 ? 'text-green-600' : 'text-gray-500'}">${pct.toFixed(4)}%</span>
                    </div>
                </td>
                <td class="px-4 py-3 text-center">
                    <span class="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-bold">${s.grn_count || 0}</span>
                </td>
                <td class="px-4 py-3 text-center">
                    <button onclick="viewRMOrderDetail('${s.order_id}')" class="text-indigo-600 hover:text-indigo-800 text-xs font-medium mr-2" title="View Details">Details</button>
                    ${s.has_master_pdf ? `<button onclick="downloadRMOrderPDF('${s.order_id}', 'master')" class="text-green-600 hover:text-green-800 text-xs font-medium mr-2" title="Download Master PDF">Master PDF</button>` : ''}
                    <button onclick="deleteRMOrder('${s.order_id}', '${(s.order_number || '').replace(/'/g, "\\'")}')" class="text-red-600 hover:text-red-800 text-xs font-medium" title="Delete order">Delete</button>
                </td>
            </tr>`;
        });

        html += '</tbody></table></div></div>';
    }

    container.innerHTML = html;
}

function getDashboardStatusBadge(status) {
    const map = {
        lpo: 'bg-indigo-100 text-indigo-700',
        pending_grn: 'bg-amber-100 text-amber-700',
        partially_received: 'bg-orange-100 text-orange-700',
        received: 'bg-green-100 text-green-700',
    };
    return map[status] || 'bg-gray-100 text-gray-700';
}

// ============================================================================
// CRITICAL MATERIALS
// ============================================================================

export async function loadCriticalMaterials() {
    await refreshCriticalMaterials();
}

export async function refreshCriticalMaterials() {
    const container = document.getElementById('critical-materials-container');
    if (container) {
        container.innerHTML = `<div class="p-8 text-center text-gray-400">
            <div class="loader border-indigo-600 border-t-transparent w-8 h-8 mx-auto mb-4"></div>
            Loading critical materials...
        </div>`;
    }
    try {
        const res = await authenticatedFetch('/api/rm-orders/critical-materials');
        const data = await res.json();
        criticalMaterials = data.materials || [];
        forecastMonth = data.forecast_month || null;
        forecastGeneratedAt = data.generated_at || null;
        selectedMaterials.clear();
        renderCriticalMaterialsTable();
        updateCreateRequisitionButton();
    } catch (e) {
        if (container) {
            container.innerHTML = `<div class="p-8 text-center text-red-400">Failed to load: ${e.message}</div>`;
        }
    }
}

function renderCriticalMaterialsTable() {
    const container = document.getElementById('critical-materials-container');
    if (!container) return;

    // Apply search filter
    const searchVal = (document.getElementById('rm-critical-search') || {}).value || '';
    const searchTerm = searchVal.toLowerCase().trim();
    const filtered = searchTerm
        ? criticalMaterials.filter(m =>
            (m.item_code || '').toLowerCase().includes(searchTerm) ||
            (m.description || '').toLowerCase().includes(searchTerm))
        : criticalMaterials;

    if (criticalMaterials.length === 0) {
        container.innerHTML = `<div class="p-8 text-center text-gray-400">
            <svg class="w-12 h-12 mx-auto mb-3 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path></svg>
            <p class="font-medium">No forecast data available</p>
            <p class="text-sm mt-1">Generate a forecast report from the <strong>Forecast</strong> page first,<br>then come back here to see consolidated materials to order.</p>
        </div>`;
        return;
    }

    // Forecast info banner
    let bannerHtml = '';
    if (forecastMonth) {
        const genDate = forecastGeneratedAt ? new Date(forecastGeneratedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
        bannerHtml = `<div class="bg-indigo-50 border-l-4 border-indigo-500 px-4 py-2.5 text-sm flex items-center justify-between">
            <div>
                <span class="font-semibold text-indigo-700">Forecast:</span>
                <span class="text-indigo-600 ml-1">${forecastMonth}</span>
                <span class="text-gray-400 mx-2">&bull;</span>
                <span class="text-gray-500">${criticalMaterials.length} materials to order</span>
            </div>
            <div class="text-gray-400 text-xs">${genDate ? 'Generated: ' + genDate : ''}</div>
        </div>`;
    }

    if (filtered.length === 0 && searchTerm) {
        container.innerHTML = bannerHtml + `<div class="p-6 text-center text-gray-400">
            No materials match "<strong>${searchTerm}</strong>". Try a different search term.
        </div>`;
        return;
    }

    let html = bannerHtml + `<table class="w-full text-sm">
        <thead>
            <tr class="bg-gray-50 border-b">
                <th class="px-3 py-3 text-center w-10">
                    <input type="checkbox" id="rm-select-all" onchange="toggleSelectAllMaterials()" class="rounded">
                </th>
                <th class="text-left px-3 py-3 font-semibold text-gray-600">Item Code</th>
                <th class="text-left px-3 py-3 font-semibold text-gray-600">Description</th>
                <th class="text-center px-3 py-3 font-semibold text-gray-600">UOM</th>
                <th class="text-right px-3 py-3 font-semibold text-gray-600">Required Qty</th>
                <th class="text-right px-3 py-3 font-semibold text-gray-600">Sage Qty</th>
                <th class="text-right px-3 py-3 font-semibold text-gray-600">Unit Cost</th>
                <th class="text-center px-3 py-3 font-semibold text-gray-600">Lead Time</th>
                <th class="text-right px-3 py-3 font-semibold text-gray-600 min-w-[120px]">Order Qty</th>
            </tr>
        </thead>
        <tbody>`;

    filtered.forEach((m, idx) => {
        const isChecked = selectedMaterials.has(m.item_code);
        html += `<tr class="border-b hover:bg-gray-50 transition-colors ${isChecked ? 'bg-indigo-50' : ''}">
            <td class="px-3 py-2.5 text-center">
                <input type="checkbox" class="rounded rm-material-cb" data-code="${m.item_code}"
                    ${isChecked ? 'checked' : ''} onchange="toggleMaterialSelection('${m.item_code}')">
            </td>
            <td class="px-3 py-2.5 font-mono text-xs font-medium">${m.item_code}</td>
            <td class="px-3 py-2.5">${m.description || ''}</td>
            <td class="px-3 py-2.5 text-center text-gray-500">${m.uom || ''}</td>
            <td class="px-3 py-2.5 text-right text-gray-600">${(m.required_qty || 0).toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})}</td>
            <td class="px-3 py-2.5 text-right font-medium">${(m.available_qty || 0).toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})}</td>
            <td class="px-3 py-2.5 text-right text-gray-500">${(m.unit_cost || 0).toFixed(4)}</td>
            <td class="px-3 py-2.5 text-center text-gray-500">${m.lead_time_days != null ? m.lead_time_days + 'd' : '-'}</td>
            <td class="px-3 py-2.5 text-right">
                <input type="number" min="0" step="1" class="w-28 border rounded px-2 py-1 text-right text-sm rm-order-qty"
                    data-code="${m.item_code}" value="${parseFloat(m.order_qty || 0).toFixed(4)}"
                    onchange="updateMaterialOrderQty('${m.item_code}', this.value)">
            </td>
        </tr>`;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

export function toggleSelectAllMaterials() {
    const cb = document.getElementById('rm-select-all');
    const checked = cb && cb.checked;
    document.querySelectorAll('.rm-material-cb').forEach(el => {
        el.checked = checked;
        const code = el.dataset.code;
        if (checked) selectedMaterials.add(code);
        else selectedMaterials.delete(code);
    });
    updateCreateRequisitionButton();
}

export function toggleMaterialSelection(code) {
    if (selectedMaterials.has(code)) selectedMaterials.delete(code);
    else selectedMaterials.add(code);
    updateCreateRequisitionButton();
}

export function updateMaterialOrderQty(code, value) {
    const mat = criticalMaterials.find(m => m.item_code === code);
    if (mat) mat._order_qty = parseFloat(value) || 0;
}

let _searchDebounce = null;

export function searchCriticalMaterials() {
    clearTimeout(_searchDebounce);
    const searchVal = (document.getElementById('rm-critical-search') || {}).value || '';
    const term = searchVal.toLowerCase().trim();

    // If search is empty or short, just filter locally
    if (term.length < 2) {
        renderCriticalMaterialsTable();
        return;
    }

    // First render local filter immediately
    renderCriticalMaterialsTable();

    // Then debounce a backend search if no local matches
    const localMatches = criticalMaterials.filter(m =>
        (m.item_code || '').toLowerCase().includes(term) ||
        (m.description || '').toLowerCase().includes(term));

    if (localMatches.length === 0) {
        _searchDebounce = setTimeout(async () => {
            try {
                const container = document.getElementById('critical-materials-container');
                // Show searching indicator
                if (container) {
                    container.innerHTML = `<div class="p-6 text-center text-gray-400">
                        <div class="loader border-indigo-600 border-t-transparent w-6 h-6 mx-auto mb-3"></div>
                        Searching all raw materials for "<strong>${term}</strong>"...
                    </div>`;
                }
                const res = await authenticatedFetch(`/api/rm-orders/search-materials?q=${encodeURIComponent(term)}`);
                const data = await res.json();
                const searchResults = data.materials || [];

                if (searchResults.length === 0) {
                    if (container) {
                        container.innerHTML = `<div class="p-6 text-center text-gray-400">
                            No materials found matching "<strong>${term}</strong>".
                        </div>`;
                    }
                    return;
                }

                // Merge search results into display (avoid duplicates with existing criticalMaterials)
                const existingCodes = new Set(criticalMaterials.map(m => m.item_code));
                const newItems = searchResults.filter(m => !existingCodes.has(m.item_code));

                if (newItems.length > 0) {
                    renderSearchResultsTable(newItems, term);
                } else {
                    // All search results are already in the forecast list
                    renderCriticalMaterialsTable();
                }
            } catch (e) {
                console.error('Search error:', e);
            }
        }, 400);
    }
}

function renderSearchResultsTable(items, searchTerm) {
    const container = document.getElementById('critical-materials-container');
    if (!container) return;

    let html = `<div class="bg-yellow-50 border-l-4 border-yellow-400 px-4 py-2.5 text-sm">
        <span class="font-semibold text-yellow-700">Search Results</span>
        <span class="text-yellow-600 ml-1">— ${items.length} items matching "${searchTerm}" (not in forecast)</span>
        <span class="text-gray-400 ml-2">Select items and set order qty to add them to your requisition</span>
    </div>
    <table class="w-full text-sm">
        <thead>
            <tr class="bg-gray-50 border-b">
                <th class="px-3 py-3 text-center w-10">
                    <input type="checkbox" id="rm-select-all" onchange="toggleSelectAllMaterials()" class="rounded">
                </th>
                <th class="text-left px-3 py-3 font-semibold text-gray-600">Item Code</th>
                <th class="text-left px-3 py-3 font-semibold text-gray-600">Description</th>
                <th class="text-center px-3 py-3 font-semibold text-gray-600">UOM</th>
                <th class="text-right px-3 py-3 font-semibold text-gray-600">Sage Qty</th>
                <th class="text-right px-3 py-3 font-semibold text-gray-600">Unit Cost</th>
                <th class="text-center px-3 py-3 font-semibold text-gray-600">Lead Time</th>
                <th class="text-right px-3 py-3 font-semibold text-gray-600 min-w-[120px]">Order Qty</th>
            </tr>
        </thead>
        <tbody>`;

    items.forEach(m => {
        // Add to criticalMaterials so they can be selected for requisition
        if (!criticalMaterials.find(cm => cm.item_code === m.item_code)) {
            criticalMaterials.push(m);
        }
        const isChecked = selectedMaterials.has(m.item_code);
        html += `<tr class="border-b hover:bg-gray-50 transition-colors ${isChecked ? 'bg-indigo-50' : ''}">
            <td class="px-3 py-2.5 text-center">
                <input type="checkbox" class="rounded rm-material-cb" data-code="${m.item_code}"
                    ${isChecked ? 'checked' : ''} onchange="toggleMaterialSelection('${m.item_code}')">
            </td>
            <td class="px-3 py-2.5 font-mono text-xs font-medium">${m.item_code}</td>
            <td class="px-3 py-2.5">${m.description || ''}</td>
            <td class="px-3 py-2.5 text-center text-gray-500">${m.uom || ''}</td>
            <td class="px-3 py-2.5 text-right font-medium">${(m.available_qty || 0).toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})}</td>
            <td class="px-3 py-2.5 text-right text-gray-500">${(m.unit_cost || 0).toFixed(4)}</td>
            <td class="px-3 py-2.5 text-center text-gray-500">${m.lead_time_days != null ? m.lead_time_days + 'd' : '-'}</td>
            <td class="px-3 py-2.5 text-right">
                <input type="number" min="0" step="1" class="w-28 border rounded px-2 py-1 text-right text-sm rm-order-qty"
                    data-code="${m.item_code}" value="0"
                    onchange="updateMaterialOrderQty('${m.item_code}', this.value)">
            </td>
        </tr>`;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

function updateCreateRequisitionButton() {
    const btn = document.getElementById('btn-create-requisition');
    if (btn) btn.disabled = selectedMaterials.size === 0;
}

// ============================================================================
// CREATE REQUISITION
// ============================================================================

export async function createRequisition() {
    if (selectedMaterials.size === 0) {
        showToast('Please select at least one material', 'error');
        return;
    }
    const supplierSel = document.getElementById('rm-supplier-select');
    const supplierId = supplierSel ? supplierSel.value : '';
    const supplierName = supplierId
        ? supplierSel.options[supplierSel.selectedIndex].dataset.name
        : '';
    if (!supplierName) {
        showToast('Please select a supplier', 'error');
        return;
    }

    const lineItems = [];
    criticalMaterials.forEach(m => {
        if (!selectedMaterials.has(m.item_code)) return;
        const qtyInput = document.querySelector(`.rm-order-qty[data-code="${m.item_code}"]`);
        const orderQty = qtyInput ? parseFloat(qtyInput.value) || 0 : (m._order_qty || 0);
        if (orderQty <= 0) return;
        lineItems.push({
            item_code: m.item_code,
            description: m.description || '',
            uom: m.uom || '',
            order_qty: orderQty,
            unit_cost: m.unit_cost || 0,
            sage_qty: m.available_qty || 0,
        });
    });

    if (lineItems.length === 0) {
        showToast('No items with order quantity > 0', 'error');
        return;
    }

    const loader = document.getElementById('loader-requisition');
    if (loader) loader.classList.remove('hidden');

    try {
        const res = await authenticatedFetch('/api/rm-orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                supplier_id: supplierId || null,
                supplier_name: supplierName,
                line_items: lineItems,
                notes: null,
            })
        });
        const data = await res.json();
        if (data.success) {
            showToast(`Requisition ${data.order_number} created successfully!`, 'success');
            selectedMaterials.clear();
            // Switch to orders tab
            switchRMOrderTab('orders');
        } else {
            showToast(data.detail || 'Failed to create requisition', 'error');
        }
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    } finally {
        if (loader) loader.classList.add('hidden');
    }
}

// ============================================================================
// ACTIVE ORDERS
// ============================================================================

export async function loadRMOrders() {
    const container = document.getElementById('rm-orders-container');
    if (container) {
        container.innerHTML = `<div class="bg-white rounded-xl shadow-lg p-8 text-center text-gray-400">
            <div class="loader border-indigo-600 border-t-transparent w-8 h-8 mx-auto mb-4"></div>
            Loading orders...
        </div>`;
    }

    const statusFilter = document.getElementById('rm-order-status-filter');
    const status = statusFilter ? statusFilter.value : '';

    try {
        const url = status ? `/api/rm-orders?status=${status}` : '/api/rm-orders';
        const res = await authenticatedFetch(url);
        const data = await res.json();
        rmOrders = data.orders || [];
        renderRMOrdersList();
    } catch (e) {
        if (container) {
            container.innerHTML = `<div class="bg-white rounded-xl shadow-lg p-8 text-center text-red-400">
                Failed to load orders: ${e.message}
            </div>`;
        }
    }
}

function getStatusBadge(status) {
    const map = {
        requisition: 'bg-yellow-100 text-yellow-700',
        approved: 'bg-blue-100 text-blue-700',
        lpo: 'bg-indigo-100 text-indigo-700',
        pending_grn: 'bg-amber-100 text-amber-700',
        partially_received: 'bg-orange-100 text-orange-700',
        received: 'bg-green-100 text-green-700',
        rejected: 'bg-red-100 text-red-700',
    };
    return map[status] || 'bg-gray-100 text-gray-700';
}

function getStatusLabel(status) {
    if (status === 'pending_grn') return 'PENDING GRN APPROVAL';
    return status.toUpperCase().replace(/_/g, ' ');
}

function renderRMOrdersList() {
    const container = document.getElementById('rm-orders-container');
    if (!container) return;

    if (rmOrders.length === 0) {
        container.innerHTML = `<div class="bg-white rounded-xl shadow-lg p-8 text-center text-gray-400">
            No orders found. Create a requisition from the Critical Materials tab.
        </div>`;
        return;
    }

    let html = '';
    rmOrders.forEach(order => {
        const date = order.order_date ? new Date(order.order_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
        const expDate = order.expected_delivery ? new Date(order.expected_delivery).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
        const statusBadge = getStatusBadge(order.status);

        html += `<div class="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            <div class="p-4 flex items-center justify-between flex-wrap gap-3">
                <div class="flex items-center gap-4">
                    <div>
                        <div class="flex items-center gap-2 mb-1">
                            <span class="font-bold text-gray-900">${order.order_number}</span>
                            <span class="px-2.5 py-0.5 rounded-full text-xs font-bold ${statusBadge}">${getStatusLabel(order.status)}</span>
                        </div>
                        <div class="text-sm text-gray-500">
                            <span>${order.supplier_name || 'N/A'}</span>
                            <span class="mx-2">&bull;</span>
                            <span>${date}</span>
                            <span class="mx-2">&bull;</span>
                            <span>${order.total_items || 0} items</span>
                            <span class="mx-2">&bull;</span>
                            <span>AED ${(order.total_value || 0).toLocaleString(undefined, {minimumFractionDigits:4, maximumFractionDigits:4})}</span>
                            ${order.status === 'pending_grn' ? `<span class="mx-2">&bull;</span><span class="text-amber-600 font-medium">Awaiting Sage GRN approval</span>` : ''}
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    ${order.status === 'requisition' ? `
                        <button onclick="approveRMOrder('${order._id}')" class="bg-green-600 text-white text-xs font-bold py-1.5 px-3 rounded hover:bg-green-700">Approve &rarr; LPO</button>
                        <button onclick="rejectRMOrder('${order._id}')" class="bg-red-100 text-red-700 text-xs font-bold py-1.5 px-3 rounded hover:bg-red-200">Reject</button>
                    ` : ''}
                    ${order.requisition_pdf_id ? `<button onclick="downloadRMOrderPDF('${order._id}', 'requisition')" class="bg-gray-100 text-gray-700 text-xs font-medium py-1.5 px-3 rounded hover:bg-gray-200" title="Download Requisition PDF">
                        <svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg> REQ
                    </button>` : ''}
                    ${order.lpo_pdf_id ? `<button onclick="downloadRMOrderPDF('${order._id}', 'lpo')" class="bg-indigo-100 text-indigo-700 text-xs font-medium py-1.5 px-3 rounded hover:bg-indigo-200" title="Download LPO PDF">
                        <svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg> LPO
                    </button>` : ''}
                    <button onclick="viewRMOrderDetail('${order._id}')" class="bg-gray-100 text-gray-700 text-xs font-medium py-1.5 px-3 rounded hover:bg-gray-200">Details</button>
                </div>
            </div>
        </div>`;
    });

    container.innerHTML = html;
}

// ============================================================================
// ORDER DETAIL / APPROVE / REJECT
// ============================================================================

export async function deleteRMOrder(orderId, orderNumber) {
    const label = orderNumber || orderId;
    if (!confirm(`Delete order ${label}? This cannot be undone.\n\nNote: any Sage entries / stock lots already created from completed GRNs will remain — only the order record is removed.`)) {
        return;
    }
    try {
        const res = await authenticatedFetch(`/api/rm-orders/${orderId}`, { method: 'DELETE' });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || `Request failed (${res.status})`);
        }
        showToast(`Order ${label} deleted`, 'success');
        await loadRMDashboard();
    } catch (e) {
        showToast(`Error: ${e.message}`, 'error');
    }
}

export async function viewRMOrderDetail(orderId) {
    const modal = document.getElementById('rm-order-detail-modal');
    const title = document.getElementById('rm-order-detail-title');
    const content = document.getElementById('rm-order-detail-content');
    if (modal) modal.classList.remove('hidden');
    if (content) content.innerHTML = '<div class="text-center text-gray-400 py-8"><div class="loader border-indigo-600 border-t-transparent w-8 h-8 mx-auto mb-4"></div>Loading...</div>';

    try {
        const res = await authenticatedFetch(`/api/rm-orders/${orderId}`);
        const order = await res.json();
        if (title) title.textContent = `Order ${order.order_number}`;

        const statusBadge = getStatusBadge(order.status);
        const items = order.enriched_items || order.line_items || [];

        let html = `
            <div class="flex items-center gap-3 mb-4">
                <span class="px-3 py-1 rounded-full text-sm font-bold ${statusBadge}">${getStatusLabel(order.status)}</span>
                <span class="text-gray-500">Supplier: <strong>${order.supplier_name || 'N/A'}</strong></span>
                ${order.status === 'pending_grn' ? '<span class="text-amber-600 text-sm font-medium">— Awaiting Sage GRN approval on Sage Entries page</span>' : ''}
            </div>`;

        // If LPO or partially_received, show enriched table with Sage + LPO qty
        if (order.enriched_items && order.enriched_items.length > 0) {
            html += `<div class="overflow-x-auto mb-4">
                <table class="w-full text-sm border">
                    <thead>
                        <tr class="bg-indigo-50">
                            <th class="text-left px-3 py-2 font-semibold">Item Code</th>
                            <th class="text-left px-3 py-2 font-semibold">Description</th>
                            <th class="text-right px-3 py-2 font-semibold">Sage Qty</th>
                            <th class="text-right px-3 py-2 font-semibold">LPO Qty</th>
                            <th class="text-right px-3 py-2 font-semibold bg-green-50">Total (Sage+LPO)</th>
                            <th class="text-center px-3 py-2 font-semibold">Lead Time</th>
                            <th class="text-right px-3 py-2 font-semibold">Received</th>
                        </tr>
                    </thead>
                    <tbody>`;
            items.forEach(li => {
                html += `<tr class="border-t hover:bg-gray-50">
                    <td class="px-3 py-2 font-mono text-xs">${li.item_code}</td>
                    <td class="px-3 py-2">${li.description || ''}</td>
                    <td class="px-3 py-2 text-right">${(li.current_sage_qty || 0).toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})}</td>
                    <td class="px-3 py-2 text-right text-indigo-600 font-medium">${(li.pending_lpo_qty || 0).toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})}</td>
                    <td class="px-3 py-2 text-right font-bold text-green-700 bg-green-50">${(li.total_expected || 0).toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})}</td>
                    <td class="px-3 py-2 text-center text-gray-500">${li.lead_time_days != null ? li.lead_time_days + ' days' : '-'}</td>
                    <td class="px-3 py-2 text-right">${(li.received_qty || 0).toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})}</td>
                </tr>`;
            });
            html += `</tbody></table></div>`;

            // Expected delivery
            if (order.expected_delivery) {
                const ed = new Date(order.expected_delivery).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
                html += `<div class="text-sm text-gray-500 mb-3">Expected Delivery: <strong>${ed}</strong></div>`;
            }
        } else if (order.status === 'requisition') {
            // Editable table for requisitions — user can set unit cost & lead time before approval
            html += `<div class="overflow-x-auto mb-4">
                <table class="w-full text-sm border" id="requisition-edit-table">
                    <thead>
                        <tr class="bg-amber-50">
                            <th class="text-left px-3 py-2 font-semibold">Item Code</th>
                            <th class="text-left px-3 py-2 font-semibold">Description</th>
                            <th class="text-center px-3 py-2 font-semibold">UOM</th>
                            <th class="text-right px-3 py-2 font-semibold">Order Qty</th>
                            <th class="text-right px-3 py-2 font-semibold">Unit Cost (AED)</th>
                            <th class="text-center px-3 py-2 font-semibold">Lead Time (Days)</th>
                            <th class="text-right px-3 py-2 font-semibold">Line Total</th>
                        </tr>
                    </thead>
                    <tbody>`;
            items.forEach((li, idx) => {
                const lineTotal = (li.order_qty || 0) * (li.unit_cost || 0);
                html += `<tr class="border-t hover:bg-gray-50">
                    <td class="px-3 py-2 font-mono text-xs">${li.item_code}</td>
                    <td class="px-3 py-2">${li.description || ''}</td>
                    <td class="px-3 py-2 text-center text-gray-500">${li.uom || ''}</td>
                    <td class="px-3 py-2 text-right font-medium">${(li.order_qty || 0).toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})}</td>
                    <td class="px-3 py-2 text-right">
                        <input type="number" step="0.0001" min="0" value="${li.unit_cost || 0}"
                            data-item-code="${li.item_code}" data-field="unit_cost" data-order-qty="${li.order_qty || 0}"
                            oninput="updateRequisitionLineTotal(this)"
                            class="req-edit-cost w-24 text-right border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                    </td>
                    <td class="px-3 py-2 text-center">
                        <input type="number" step="1" min="1" value="${li.lead_time_days || 7}"
                            data-item-code="${li.item_code}" data-field="lead_time_days"
                            class="req-edit-lt w-20 text-center border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                    </td>
                    <td class="px-3 py-2 text-right font-medium req-line-total" data-idx="${idx}">AED ${lineTotal.toLocaleString(undefined, {minimumFractionDigits:4, maximumFractionDigits:4})}</td>
                </tr>`;
            });
            const grandTotal = items.reduce((s, li) => s + (li.order_qty || 0) * (li.unit_cost || 0), 0);
            html += `</tbody>
                    <tfoot>
                        <tr class="border-t-2 bg-gray-50">
                            <td colspan="6" class="px-3 py-2 text-right font-bold text-gray-700">Grand Total:</td>
                            <td class="px-3 py-2 text-right font-bold text-indigo-700" id="req-grand-total">AED ${grandTotal.toLocaleString(undefined, {minimumFractionDigits:4, maximumFractionDigits:4})}</td>
                        </tr>
                    </tfoot>
                </table></div>`;

            // Delivery & Payment terms (editable)
            html += `<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Delivery Terms</label>
                    <input type="text" id="req-delivery-terms" value="Ex-Works JAFZA"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
                    <input type="text" id="req-payment-terms" value="Net 30"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                </div>
            </div>`;

            // Approve button
            html += `<div class="flex items-center gap-3 mt-4 pt-4 border-t">
                <button onclick="approveRMOrderFromDetail('${orderId}')" class="bg-green-600 text-white font-bold py-2.5 px-6 rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                    Approve &amp; Generate LPO
                </button>
                <button onclick="rejectRMOrder('${orderId}')" class="bg-red-100 text-red-700 font-bold py-2.5 px-6 rounded-lg hover:bg-red-200 text-sm">Reject</button>
                <span class="text-xs text-gray-400 ml-2">Review costs and lead times above before approving</span>
            </div>`;
        } else {
            // Simple read-only table for other non-enriched statuses
            html += `<div class="overflow-x-auto mb-4">
                <table class="w-full text-sm border">
                    <thead>
                        <tr class="bg-gray-50">
                            <th class="text-left px-3 py-2 font-semibold">Item Code</th>
                            <th class="text-left px-3 py-2 font-semibold">Description</th>
                            <th class="text-center px-3 py-2 font-semibold">UOM</th>
                            <th class="text-right px-3 py-2 font-semibold">Order Qty</th>
                            <th class="text-right px-3 py-2 font-semibold">Unit Cost</th>
                            <th class="text-center px-3 py-2 font-semibold">Lead Time</th>
                        </tr>
                    </thead>
                    <tbody>`;
            items.forEach(li => {
                html += `<tr class="border-t hover:bg-gray-50">
                    <td class="px-3 py-2 font-mono text-xs">${li.item_code}</td>
                    <td class="px-3 py-2">${li.description || ''}</td>
                    <td class="px-3 py-2 text-center text-gray-500">${li.uom || ''}</td>
                    <td class="px-3 py-2 text-right font-medium">${(li.order_qty || 0).toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})}</td>
                    <td class="px-3 py-2 text-right text-gray-500">${(li.unit_cost || 0).toFixed(4)}</td>
                    <td class="px-3 py-2 text-center text-gray-500">${li.lead_time_days != null ? li.lead_time_days + ' days' : '-'}</td>
                </tr>`;
            });
            html += `</tbody></table></div>`;
        }

        // Notes
        if (order.notes) {
            html += `<div class="text-sm text-gray-600 mt-2"><strong>Notes:</strong> ${order.notes}</div>`;
        }

        // ── GRN History Section ──────────────────────────────────────
        const grns = order.grns || [];
        if (grns.length > 0) {
            const totalOrdered = (order.line_items || []).reduce((s, li) => s + (li.order_qty || 0), 0);
            const totalReceived = (order.line_items || []).reduce((s, li) => s + (li.received_qty || 0), 0);
            const pct = totalOrdered > 0 ? (totalReceived / totalOrdered * 100) : 0;
            const barColor = pct >= 100 ? 'bg-green-500' : (pct > 50 ? 'bg-indigo-500' : 'bg-orange-500');

            html += `
            <div class="mt-6 pt-4 border-t-2 border-indigo-100">
                <div class="flex items-center justify-between mb-3">
                    <h4 class="text-sm font-bold text-gray-900">GRN History (${grns.length} receipt${grns.length > 1 ? 's' : ''})</h4>
                    <div class="flex items-center gap-2" style="min-width:200px">
                        <div class="flex-1 bg-gray-200 rounded-full h-2.5">
                            <div class="${barColor} h-2.5 rounded-full" style="width:${Math.min(100, pct)}%"></div>
                        </div>
                        <span class="text-xs font-bold ${pct >= 100 ? 'text-green-600' : 'text-gray-500'}">${pct.toFixed(4)}% delivered</span>
                    </div>
                </div>
                <div class="space-y-2">`;

            grns.forEach(g => {
                const gDate = g.grn_date ? new Date(g.grn_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
                const grnTotalQty = (g.line_items || []).reduce((s, li) => s + (li.received_qty || 0), 0);

                html += `<div class="border rounded-lg p-3 bg-gray-50 hover:bg-white transition-colors">
                    <div class="flex items-center justify-between flex-wrap gap-2">
                        <div class="flex items-center gap-3">
                            <span class="font-bold text-indigo-700 text-sm">${g.grn_number}</span>
                            <span class="text-xs text-gray-500">${gDate}</span>
                            <span class="text-xs text-gray-600">By: ${g.received_by || 'N/A'}</span>
                            <span class="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-xs font-medium">${grnTotalQty.toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})} units</span>
                            ${g.status === 'draft' ? '<span class="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-xs font-bold">DRAFT</span>' : ''}
                        </div>
                        <div class="flex items-center gap-2">
                            ${g.grn_pdf_id ? `<button onclick="downloadGRNPDF('${orderId}', '${g.grn_number}')" class="text-indigo-600 hover:text-indigo-800 text-xs font-medium flex items-center gap-1">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                PDF
                            </button>` : ''}
                        </div>
                    </div>
                    ${g.notes ? `<div class="text-xs text-gray-500 mt-1 italic">${g.notes}</div>` : ''}
                </div>`;
            });

            html += `</div>`;

            // Master PDF button
            if (order.master_pdf_id) {
                html += `<div class="mt-3">
                    <button onclick="downloadRMOrderPDF('${orderId}', 'master')" class="bg-green-600 text-white text-xs font-bold py-2 px-4 rounded hover:bg-green-700 flex items-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        Download Master Completion PDF (LPO + All GRNs)
                    </button>
                </div>`;
            }

            html += `</div>`;
        }

        if (content) content.innerHTML = html;
    } catch (e) {
        if (content) content.innerHTML = `<div class="text-red-500">Error: ${e.message}</div>`;
    }
}

export function closeRMOrderDetail() {
    const modal = document.getElementById('rm-order-detail-modal');
    if (modal) modal.classList.add('hidden');
}

export async function approveRMOrder(orderId) {
    // Quick approve from the orders list (no inline edits available)
    if (!confirm('Approve this requisition and convert to LPO?\n\nTip: Open "Details" first to set costs and lead times.')) return;
    try {
        const res = await authenticatedFetch(`/api/rm-orders/${orderId}/approve`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                delivery_terms: 'Ex-Works JAFZA',
                payment_terms: 'Net 30',
            })
        });
        const data = await res.json();
        if (data.success) {
            showToast(`${data.order_number} approved and converted to LPO!`, 'success');
            loadRMOrders();
        } else {
            showToast(data.detail || 'Approval failed', 'error');
        }
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

/**
 * Live-update line total and grand total when user edits unit cost in the requisition detail table.
 */
export function updateRequisitionLineTotal(inputEl) {
    const orderQty = parseFloat(inputEl.dataset.orderQty) || 0;
    const unitCost = parseFloat(inputEl.value) || 0;
    const row = inputEl.closest('tr');
    const lineTotalCell = row.querySelector('.req-line-total');
    if (lineTotalCell) {
        const total = orderQty * unitCost;
        lineTotalCell.textContent = `AED ${total.toLocaleString(undefined, {minimumFractionDigits:4, maximumFractionDigits:4})}`;
    }
    // Recalculate grand total
    let grandTotal = 0;
    document.querySelectorAll('#requisition-edit-table .req-edit-cost').forEach(inp => {
        const qty = parseFloat(inp.dataset.orderQty) || 0;
        const cost = parseFloat(inp.value) || 0;
        grandTotal += qty * cost;
    });
    const grandEl = document.getElementById('req-grand-total');
    if (grandEl) {
        grandEl.textContent = `AED ${grandTotal.toLocaleString(undefined, {minimumFractionDigits:4, maximumFractionDigits:4})}`;
    }
}

/**
 * Approve a requisition from the detail modal, reading inline-edited costs and lead times.
 */
export async function approveRMOrderFromDetail(orderId) {
    if (!confirm('Approve this requisition and generate LPO with the values above?')) return;

    // Collect line item edits from the inline inputs
    const lineItems = [];
    document.querySelectorAll('#requisition-edit-table .req-edit-cost').forEach(costInput => {
        const itemCode = costInput.dataset.itemCode;
        const unitCost = parseFloat(costInput.value) || 0;
        // Find matching lead-time input
        const ltInput = document.querySelector(`#requisition-edit-table .req-edit-lt[data-item-code="${itemCode}"]`);
        const leadTimeDays = ltInput ? (parseInt(ltInput.value) || 7) : 7;
        lineItems.push({ item_code: itemCode, unit_cost: unitCost, lead_time_days: leadTimeDays });
    });

    const deliveryTerms = document.getElementById('req-delivery-terms')?.value || 'Ex-Works JAFZA';
    const paymentTerms = document.getElementById('req-payment-terms')?.value || 'Net 30';

    try {
        const res = await authenticatedFetch(`/api/rm-orders/${orderId}/approve`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                delivery_terms: deliveryTerms,
                payment_terms: paymentTerms,
                line_items: lineItems,
            })
        });
        const data = await res.json();
        if (data.success) {
            showToast(`${data.order_number} approved and converted to LPO!`, 'success');
            closeRMOrderDetail();
            loadRMOrders();
        } else {
            showToast(data.detail || 'Approval failed', 'error');
        }
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

export async function rejectRMOrder(orderId) {
    const reason = prompt('Rejection reason (optional):');
    if (reason === null) return; // user cancelled
    try {
        const res = await authenticatedFetch(`/api/rm-orders/${orderId}/reject?reason=${encodeURIComponent(reason || '')}`, {
            method: 'PUT',
        });
        const data = await res.json();
        if (data.success) {
            showToast('Requisition rejected', 'success');
            loadRMOrders();
        } else {
            showToast(data.detail || 'Rejection failed', 'error');
        }
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

export async function downloadRMOrderPDF(orderId, pdfType) {
    try {
        const res = await authenticatedFetch(`/api/rm-orders/${orderId}/pdf/${pdfType}`);
        if (!res.ok) throw new Error('PDF not found');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    } catch (e) {
        showToast('Failed to download PDF: ' + e.message, 'error');
    }
}

// ============================================================================
// RECEIVE GOODS
// ============================================================================

export async function loadReceivableOrders() {
    const container = document.getElementById('receivable-orders-container');
    if (container) {
        container.innerHTML = `<div class="bg-white rounded-xl shadow-lg p-8 text-center text-gray-400">
            <div class="loader border-indigo-600 border-t-transparent w-8 h-8 mx-auto mb-4"></div>
            Loading receivable orders...
        </div>`;
    }
    try {
        // Fetch LPO and partially_received orders
        const [lpoRes, prRes] = await Promise.all([
            authenticatedFetch('/api/rm-orders?status=lpo'),
            authenticatedFetch('/api/rm-orders?status=partially_received'),
        ]);
        const lpoData = await lpoRes.json();
        const prData = await prRes.json();
        const orders = [...(lpoData.orders || []), ...(prData.orders || [])];

        if (orders.length === 0) {
            container.innerHTML = `<div class="bg-white rounded-xl shadow-lg p-8 text-center text-gray-400">
                No orders pending receipt. Approve a requisition first.
            </div>`;
            return;
        }

        let html = '';
        orders.forEach(order => {
            const date = order.order_date ? new Date(order.order_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
            const expDate = order.expected_delivery ? new Date(order.expected_delivery).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
            const statusBadge = getStatusBadge(order.status);
            const grns = order.grns || [];
            const totalOrdered = (order.line_items || []).reduce((s, li) => s + (li.order_qty || 0), 0);
            const totalReceived = (order.line_items || []).reduce((s, li) => s + (li.received_qty || 0), 0);
            const pct = totalOrdered > 0 ? (totalReceived / totalOrdered * 100) : 0;
            const barColor = pct >= 100 ? 'bg-green-500' : (pct > 50 ? 'bg-indigo-500' : 'bg-orange-500');

            html += `<div class="bg-white rounded-xl shadow-lg border border-gray-100 p-4 mb-4">
                <div class="flex items-center justify-between flex-wrap gap-3 mb-3">
                    <div>
                        <div class="flex items-center gap-2 mb-1">
                            <span class="font-bold text-gray-900">${order.order_number}</span>
                            <span class="px-2.5 py-0.5 rounded-full text-xs font-bold ${statusBadge}">${getStatusLabel(order.status)}</span>
                            ${grns.length > 0 ? `<span class="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-bold">${grns.length} GRN${grns.length > 1 ? 's' : ''}</span>` : ''}
                        </div>
                        <div class="text-sm text-gray-500">
                            ${order.supplier_name || ''} &bull; ${date} &bull; Expected: ${expDate}
                        </div>
                        <!-- Progress bar -->
                        <div class="flex items-center gap-2 mt-1.5" style="max-width:300px">
                            <div class="flex-1 bg-gray-200 rounded-full h-2">
                                <div class="${barColor} h-2 rounded-full transition-all" style="width: ${Math.min(100, pct)}%"></div>
                            </div>
                            <span class="text-xs font-bold ${pct >= 100 ? 'text-green-600' : 'text-gray-500'}">${pct.toFixed(4)}%</span>
                        </div>
                    </div>
                    <button onclick="openReceiveGoodsModal('${order._id}')" class="bg-green-600 text-white text-sm font-bold py-2 px-4 rounded hover:bg-green-700 flex items-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
                        Receive Goods
                    </button>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-xs">
                        <thead>
                            <tr class="bg-gray-50">
                                <th class="text-left px-2 py-1.5 font-semibold">Item Code</th>
                                <th class="text-left px-2 py-1.5 font-semibold">Description</th>
                                <th class="text-right px-2 py-1.5 font-semibold">Order Qty</th>
                                <th class="text-right px-2 py-1.5 font-semibold">Received</th>
                                <th class="text-right px-2 py-1.5 font-semibold">Pending</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(order.line_items || []).map(li => {
                                const pending = (li.order_qty || 0) - (li.received_qty || 0);
                                return `<tr class="border-t">
                                    <td class="px-2 py-1.5 font-mono">${li.item_code}</td>
                                    <td class="px-2 py-1.5">${(li.description || '').substring(0, 30)}</td>
                                    <td class="px-2 py-1.5 text-right">${(li.order_qty || 0).toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})}</td>
                                    <td class="px-2 py-1.5 text-right text-green-600">${(li.received_qty || 0).toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})}</td>
                                    <td class="px-2 py-1.5 text-right font-medium ${pending > 0 ? 'text-orange-600' : 'text-green-600'}">${pending.toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})}</td>
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>

                ${grns.length > 0 ? `
                <div class="mt-3 pt-3 border-t">
                    <div class="text-xs font-bold text-gray-600 mb-2">GRN History</div>
                    <div class="flex flex-wrap gap-2">
                        ${grns.map(g => {
                            const gDate = g.grn_date ? new Date(g.grn_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '';
                            return `<div class="inline-flex items-center gap-1 bg-gray-50 border rounded-lg px-3 py-1.5 text-xs">
                                <span class="font-bold text-indigo-700">${g.grn_number}</span>
                                <span class="text-gray-400">|</span>
                                <span class="text-gray-500">${gDate}</span>
                                <span class="text-gray-400">|</span>
                                <span class="text-gray-600">By: ${g.received_by || 'N/A'}</span>
                                ${g.grn_pdf_id ? `<button onclick="downloadGRNPDF('${order._id}', '${g.grn_number}')" class="ml-1 text-indigo-500 hover:text-indigo-700" title="Download GRN PDF">
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                </button>` : ''}
                            </div>`;
                        }).join('')}
                    </div>
                </div>` : ''}

            </div>`;
        });

        container.innerHTML = html;
    } catch (e) {
        if (container) {
            container.innerHTML = `<div class="bg-white rounded-xl shadow-lg p-8 text-center text-red-400">Failed to load: ${e.message}</div>`;
        }
    }
}

export async function downloadGRNPDF(orderId, grnNumber) {
    try {
        const res = await authenticatedFetch(`/api/rm-orders/${orderId}/grn/${encodeURIComponent(grnNumber)}/pdf`);
        if (!res.ok) throw new Error('PDF not found');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    } catch (e) {
        showToast('Failed to download GRN PDF: ' + e.message, 'error');
    }
}

// ============================================================================
// GRN DOCUMENTS TAB
// ============================================================================

let allGRNDocuments = []; // cached for client-side filtering

export async function loadGRNDocuments() {
    const container = document.getElementById('grndocs-container');
    if (!container) return;
    container.innerHTML = `<div class="bg-white rounded-xl shadow-lg p-8 text-center text-gray-400">
        <div class="loader border-indigo-600 border-t-transparent w-8 h-8 mx-auto mb-4"></div>
        Loading GRN documents...
    </div>`;

    try {
        const res = await authenticatedFetch('/api/rm-orders/grn-documents');
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || `Server error (${res.status})`);
        }
        const data = await res.json();
        allGRNDocuments = data.documents || [];
        renderGRNDocuments(allGRNDocuments);
    } catch (e) {
        container.innerHTML = `<div class="bg-white rounded-xl shadow-lg p-8 text-center text-red-400">Failed to load GRN documents: ${e.message}</div>`;
    }
}

export function filterGRNDocuments() {
    const search = (document.getElementById('grndocs-search')?.value || '').trim().toLowerCase();
    const statusFilter = document.getElementById('grndocs-status-filter')?.value || '';

    let filtered = allGRNDocuments;
    if (search) {
        filtered = filtered.filter(d => {
            const haystack = `${d.grn_number} ${d.order_number} ${d.supplier_name}`.toLowerCase();
            return haystack.includes(search);
        });
    }
    if (statusFilter) {
        filtered = filtered.filter(d => d.sage_status === statusFilter);
    }
    renderGRNDocuments(filtered);
}

function renderGRNDocuments(documents) {
    const container = document.getElementById('grndocs-container');
    if (!container) return;

    if (documents.length === 0) {
        container.innerHTML = `<div class="bg-white rounded-xl shadow-lg p-8 text-center text-gray-400">
            <svg class="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            No GRN documents found. Receive goods against an LPO to generate GRNs.
        </div>`;
        return;
    }

    let html = `<div class="bg-white rounded-xl shadow-lg overflow-hidden">
        <div class="px-6 py-4 border-b flex items-center justify-between">
            <h3 class="text-lg font-bold text-gray-900">All GRN Documents</h3>
            <span class="text-sm text-gray-500">${documents.length} document${documents.length !== 1 ? 's' : ''}</span>
        </div>
        <div class="overflow-x-auto">
            <table class="w-full text-sm">
                <thead>
                    <tr class="bg-gray-50 border-b">
                        <th class="text-left px-4 py-3 font-semibold text-gray-600">GRN #</th>
                        <th class="text-left px-4 py-3 font-semibold text-gray-600">LPO #</th>
                        <th class="text-left px-4 py-3 font-semibold text-gray-600">Supplier</th>
                        <th class="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                        <th class="text-left px-4 py-3 font-semibold text-gray-600">Received By</th>
                        <th class="text-right px-4 py-3 font-semibold text-gray-600">Qty Received</th>
                        <th class="text-center px-4 py-3 font-semibold text-gray-600">Sage Status</th>
                        <th class="text-center px-4 py-3 font-semibold text-gray-600">Actions</th>
                    </tr>
                </thead>
                <tbody>`;

    documents.forEach((d, docIdx) => {
        const gDate = d.grn_date ? new Date(d.grn_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
        const statusBadge = d.sage_status === 'approved'
            ? 'bg-green-100 text-green-700'
            : 'bg-amber-100 text-amber-700';
        const statusLabel = (d.sage_status || 'draft').toUpperCase();

        const hasCustomsData = (d.line_items || []).some(li => li.bl_number || li.hs_code);

        html += `<tr class="border-b hover:bg-gray-50 transition-colors">
            <td class="px-4 py-3 font-mono text-xs font-bold text-indigo-700">
                ${hasCustomsData ? `<button onclick="toggleGRNDetail(${docIdx})" class="mr-1 text-gray-400 hover:text-indigo-600 align-middle" title="Show B/L & HS details">
                    <svg id="grn-chevron-${docIdx}" class="w-4 h-4 inline transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                </button>` : ''}
                ${d.grn_number}
            </td>
            <td class="px-4 py-3 font-mono text-xs">
                <button onclick="viewRMOrderDetail('${d.order_id}')" class="text-indigo-600 hover:text-indigo-800 hover:underline" title="View LPO Details">${d.order_number}</button>
            </td>
            <td class="px-4 py-3 text-gray-700">${d.supplier_name || 'N/A'}</td>
            <td class="px-4 py-3 text-gray-600">${gDate}</td>
            <td class="px-4 py-3 text-gray-600">${d.received_by || 'N/A'}</td>
            <td class="px-4 py-3 text-right font-medium">${(d.total_received_qty || 0).toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})}</td>
            <td class="px-4 py-3 text-center">
                <span class="px-2 py-0.5 rounded-full text-xs font-bold ${statusBadge}">${statusLabel}</span>
            </td>
            <td class="px-4 py-3 text-center">
                <div class="flex items-center justify-center gap-2">
                    ${d.grn_pdf_id ? `<button onclick="downloadGRNPDF('${d.order_id}', '${d.grn_number}')" class="bg-indigo-50 text-indigo-700 text-xs font-medium py-1 px-2.5 rounded hover:bg-indigo-100 flex items-center gap-1" title="Download GRN PDF">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        PDF
                    </button>` : '<span class="text-gray-300 text-xs">No PDF</span>'}
                    ${d.has_master_pdf ? `<button onclick="downloadRMOrderPDF('${d.order_id}', 'master')" class="bg-green-50 text-green-700 text-xs font-medium py-1 px-2.5 rounded hover:bg-green-100 flex items-center gap-1" title="Download Master PDF">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        Master
                    </button>` : ''}
                </div>
            </td>
        </tr>`;

        if (hasCustomsData) {
            let detailRows = (d.line_items || [])
                .filter(li => li.bl_number || li.hs_code)
                .map(li => `
                    <tr class="border-t border-gray-100">
                        <td class="px-3 py-1.5 font-mono text-xs text-gray-700">${li.item_code}</td>
                        <td class="px-3 py-1.5 text-xs text-gray-600">${li.bl_number || '-'}</td>
                        <td class="px-3 py-1.5 text-xs text-gray-600">${li.hs_code || '-'}</td>
                        <td class="px-3 py-1.5 text-xs text-right text-gray-600">${(li.received_qty || 0).toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})}</td>
                    </tr>
                `).join('');

            html += `<tr id="grn-detail-${docIdx}" class="hidden">
                <td colspan="8" class="px-6 py-3 bg-indigo-50/50">
                    <div class="text-xs font-semibold text-indigo-700 mb-2">Import / Customs Details</div>
                    <table class="w-full text-xs">
                        <thead>
                            <tr class="bg-indigo-100/50">
                                <th class="text-left px-3 py-1.5 font-semibold text-indigo-600">Item Code</th>
                                <th class="text-left px-3 py-1.5 font-semibold text-indigo-600">B/L Number</th>
                                <th class="text-left px-3 py-1.5 font-semibold text-indigo-600">HS Code</th>
                                <th class="text-right px-3 py-1.5 font-semibold text-indigo-600">Qty Received</th>
                            </tr>
                        </thead>
                        <tbody>${detailRows}</tbody>
                    </table>
                </td>
            </tr>`;
        }
    });

    html += '</tbody></table></div></div>';

    container.innerHTML = html;
}

export function toggleGRNDetail(docIdx) {
    const detailRow = document.getElementById(`grn-detail-${docIdx}`);
    const chevron = document.getElementById(`grn-chevron-${docIdx}`);
    if (detailRow) {
        detailRow.classList.toggle('hidden');
        if (chevron) {
            chevron.style.transform = detailRow.classList.contains('hidden') ? '' : 'rotate(90deg)';
        }
    }
}

let currentReceiveOrderId = null;

export async function openReceiveGoodsModal(orderId) {
    currentReceiveOrderId = orderId;
    const modal = document.getElementById('receive-goods-modal');
    const title = document.getElementById('receive-goods-title');
    const content = document.getElementById('receive-goods-content');
    if (modal) modal.classList.remove('hidden');
    if (content) content.innerHTML = '<div class="text-center text-gray-400 py-8"><div class="loader border-indigo-600 border-t-transparent w-8 h-8 mx-auto mb-4"></div>Loading...</div>';

    try {
        const res = await authenticatedFetch(`/api/rm-orders/${orderId}`);
        const order = await res.json();
        const nextGRN = (order.grn_count || 0) + 1;
        const grnLabel = `GRN-${order.order_number}-${nextGRN}`;
        if (title) title.textContent = `Receive Goods - ${order.order_number} (${grnLabel})`;

        const items = order.line_items || [];
        let html = `<div class="text-sm text-gray-500 mb-4">
            Supplier: <strong>${order.supplier_name || 'N/A'}</strong> &bull;
            Creating <span class="font-bold text-indigo-600">${grnLabel}</span> &bull;
            Enter received quantities and click "Confirm Receipt".
        </div>
        <div class="overflow-x-auto">
            <table class="w-full text-sm border">
                <thead>
                    <tr class="bg-gray-50">
                        <th class="text-left px-3 py-2">Item Code</th>
                        <th class="text-left px-3 py-2">Description</th>
                        <th class="text-right px-3 py-2">Ordered</th>
                        <th class="text-right px-3 py-2">Already Received</th>
                        <th class="text-right px-3 py-2">Remaining</th>
                        <th class="text-right px-3 py-2">Receiving Now</th>
                        <th class="text-right px-3 py-2">Unit Cost</th>
                        <th class="text-left px-3 py-2">Batch No</th>
                    </tr>
                </thead>
                <tbody>`;

        items.forEach(li => {
            const pending = Math.max(0, (li.order_qty || 0) - (li.received_qty || 0));
            html += `<tr class="border-t">
                <td class="px-3 py-2 font-mono text-xs">${li.item_code}</td>
                <td class="px-3 py-2">${(li.description || '').substring(0, 30)}</td>
                <td class="px-3 py-2 text-right">${(li.order_qty || 0).toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})}</td>
                <td class="px-3 py-2 text-right text-green-600">${(li.received_qty || 0).toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})}</td>
                <td class="px-3 py-2 text-right font-medium ${pending > 0 ? 'text-orange-600' : 'text-green-600'}">${pending.toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})}</td>
                <td class="px-3 py-2 text-right">
                    <input type="number" min="0" max="${pending}" step="1" class="w-20 border rounded px-2 py-1 text-right text-sm recv-qty"
                        data-code="${li.item_code}" value="${pending}">
                </td>
                <td class="px-3 py-2 text-right">
                    <input type="number" min="0" step="0.0001" class="w-20 border rounded px-2 py-1 text-right text-sm recv-cost"
                        data-code="${li.item_code}" value="${(li.unit_cost || 0).toFixed(4)}">
                </td>
                <td class="px-3 py-2">
                    <input type="text" class="w-24 border rounded px-2 py-1 text-sm recv-batch"
                        data-code="${li.item_code}" placeholder="Batch #">
                </td>
            </tr>`;
        });

        html += `</tbody></table></div>
        <div class="mt-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">GRN Notes (optional)</label>
            <textarea id="grn-notes-input" rows="2" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Notes for this GRN receipt..."></textarea>
        </div>
        <div id="receive-result-area"></div>
        <div class="flex justify-end gap-3 mt-4" id="receive-action-buttons">
            <button onclick="closeReceiveGoodsModal()" class="bg-gray-100 text-gray-700 font-medium py-2 px-4 rounded hover:bg-gray-200">Cancel</button>
            <button onclick="confirmReceiveGoods()" class="bg-green-600 text-white font-bold py-2 px-6 rounded hover:bg-green-700 flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                Confirm Receipt & Create GRN
            </button>
        </div>`;

        if (content) content.innerHTML = html;
    } catch (e) {
        if (content) content.innerHTML = `<div class="text-red-500">Error: ${e.message}</div>`;
    }
}

export function closeReceiveGoodsModal() {
    document.getElementById('receive-goods-modal').classList.add('hidden');
    currentReceiveOrderId = null;
}

export async function confirmReceiveGoods() {
    if (!currentReceiveOrderId) return;

    const lineItems = [];
    document.querySelectorAll('.recv-qty').forEach(el => {
        const code = el.dataset.code;
        const qty = parseFloat(el.value) || 0;
        if (qty <= 0) return;
        const costEl = document.querySelector(`.recv-cost[data-code="${code}"]`);
        const batchEl = document.querySelector(`.recv-batch[data-code="${code}"]`);
        const descTd = el.closest('tr')?.querySelector('td:nth-child(2)');
        lineItems.push({
            item_code: code,
            received_qty: qty,
            unit_cost: costEl ? parseFloat(costEl.value) || 0 : 0,
            batch_no: batchEl ? batchEl.value.trim() || null : null,
            _description: descTd ? descTd.textContent.trim() : code,
        });
    });

    if (lineItems.length === 0) {
        showToast('No items with received quantity > 0', 'error');
        return;
    }

    const grn_notes = document.getElementById('grn-notes-input')?.value?.trim() || '';
    const orderId = currentReceiveOrderId;

    showBLHSCodeModal(lineItems, grn_notes, orderId);
}

function showBLHSCodeModal(lineItems, grn_notes, orderId) {
    const existing = document.getElementById('bl-hs-modal');
    if (existing) existing.remove();

    let rowsHtml = lineItems.map((li, idx) => `
        <tr class="border-t">
            <td class="px-3 py-2 font-mono text-xs">${li.item_code}</td>
            <td class="px-3 py-2 text-sm text-gray-700">${li._description}</td>
            <td class="px-3 py-2 text-right text-sm">${li.received_qty.toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})}</td>
            <td class="px-3 py-2">
                <input type="text" class="w-full border rounded px-2 py-1 text-sm bl-number-input"
                    data-idx="${idx}" placeholder="e.g. BL-2026-001">
            </td>
            <td class="px-3 py-2">
                <input type="text" class="w-full border rounded px-2 py-1 text-sm hs-code-input"
                    data-idx="${idx}" placeholder="e.g. 1701.99">
            </td>
        </tr>
    `).join('');

    const modal = `
        <div id="bl-hs-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
            <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
                <div class="px-6 py-4 border-b">
                    <h3 class="text-lg font-bold text-gray-900">Import / Customs Details</h3>
                    <p class="text-sm text-gray-500 mt-1">Enter B/L Number and HS Code for each item before generating the GRN.</p>
                </div>
                <div class="flex-1 overflow-y-auto px-6 py-4">
                    <table class="w-full text-sm border">
                        <thead>
                            <tr class="bg-gray-50">
                                <th class="text-left px-3 py-2 font-semibold text-gray-600">Item Code</th>
                                <th class="text-left px-3 py-2 font-semibold text-gray-600">Description</th>
                                <th class="text-right px-3 py-2 font-semibold text-gray-600">Recv Qty</th>
                                <th class="text-left px-3 py-2 font-semibold text-gray-600">B/L Number</th>
                                <th class="text-left px-3 py-2 font-semibold text-gray-600">HS Code</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                </div>
                <div class="px-6 py-4 border-t flex justify-end gap-3">
                    <button id="bl-hs-cancel-btn" class="bg-gray-100 text-gray-700 font-medium py-2 px-4 rounded hover:bg-gray-200">Cancel</button>
                    <button id="bl-hs-confirm-btn" class="bg-green-600 text-white font-bold py-2 px-6 rounded hover:bg-green-700 flex items-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                        Confirm &amp; Generate GRN
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modal);

    document.getElementById('bl-hs-cancel-btn').addEventListener('click', () => {
        document.getElementById('bl-hs-modal')?.remove();
    });

    document.getElementById('bl-hs-confirm-btn').addEventListener('click', () => {
        document.querySelectorAll('.bl-number-input').forEach(el => {
            const idx = parseInt(el.dataset.idx);
            lineItems[idx].bl_number = el.value.trim() || null;
        });
        document.querySelectorAll('.hs-code-input').forEach(el => {
            const idx = parseInt(el.dataset.idx);
            lineItems[idx].hs_code = el.value.trim() || null;
        });

        document.getElementById('bl-hs-modal')?.remove();

        const payload = lineItems.map(li => ({
            item_code: li.item_code,
            received_qty: li.received_qty,
            unit_cost: li.unit_cost,
            batch_no: li.batch_no,
            bl_number: li.bl_number,
            hs_code: li.hs_code,
        }));

        submitReceiveGoods(payload, grn_notes, orderId);
    });
}

async function submitReceiveGoods(lineItems, grn_notes, orderId) {
    try {
        showToast('Creating GRN draft in Sage...', 'info');
        const res = await authenticatedFetch(`/api/rm-orders/${orderId}/receive`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ line_items: lineItems, grn_notes })
        });
        const data = await res.json();
        if (data.success) {
            showToast(data.message || 'GRN created successfully.', 'success');

            const resultArea = document.getElementById('receive-result-area');
            if (resultArea) {
                let resultHtml = `<div class="mt-4 p-4 rounded-lg border-2 border-green-200 bg-green-50">
                    <div class="flex items-center gap-2 mb-2">
                        <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        <span class="font-bold text-green-800">${data.grn_number || 'GRN'} Created Successfully</span>
                    </div>
                    <div class="text-sm text-green-700 mb-3">${data.message || ''}</div>
                    <div class="flex gap-2 flex-wrap">`;

                if (data.grn_pdf_id) {
                    resultHtml += `<button onclick="downloadGRNPDF('${orderId}', '${data.grn_number}')" class="bg-indigo-600 text-white text-xs font-bold py-1.5 px-3 rounded hover:bg-indigo-700 flex items-center gap-1">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        Download GRN PDF
                    </button>`;
                }
                if (data.master_pdf_id) {
                    resultHtml += `<button onclick="downloadRMOrderPDF('${orderId}', 'master')" class="bg-green-600 text-white text-xs font-bold py-1.5 px-3 rounded hover:bg-green-700 flex items-center gap-1">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        Download Master PDF
                    </button>`;
                }

                resultHtml += `</div></div>`;
                resultArea.innerHTML = resultHtml;
            }

            const actionBtns = document.getElementById('receive-action-buttons');
            if (actionBtns) {
                actionBtns.innerHTML = `<button onclick="closeReceiveGoodsModal()" class="bg-gray-600 text-white font-medium py-2 px-6 rounded hover:bg-gray-700">Close</button>`;
            }

            loadReceivableOrders();
            loadRMOrders();
        } else {
            showToast(data.detail || 'Failed to receive goods', 'error');
        }
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

// ============================================================================
// CUSTOMERS
// ============================================================================

let allCustomers = [];
let editingCustomerId = null;

export async function loadCustomers() {
    try {
        const res = await authenticatedFetch('/api/customers?active_only=false&limit=500');
        const data = await res.json();
        allCustomers = data.customers || [];
        renderCustomersTable();
    } catch (e) {
        showToast('Failed to load customers', 'error');
    }
}

function renderCustomersTable() {
    const container = document.getElementById('customers-container');
    if (!container) return;

    if (allCustomers.length === 0) {
        container.innerHTML = `<div class="p-8 text-center text-gray-400">
            No customers found. Click "Add Customer" to get started.
        </div>`;
        return;
    }

    let html = `<table class="w-full text-sm">
        <thead>
            <tr class="bg-gray-50 border-b">
                <th class="text-left px-4 py-3 font-semibold text-gray-600">Code</th>
                <th class="text-left px-4 py-3 font-semibold text-gray-600">Name</th>
                <th class="text-left px-4 py-3 font-semibold text-gray-600">Customer Ref</th>
                <th class="text-left px-4 py-3 font-semibold text-gray-600">Address</th>
                <th class="text-left px-4 py-3 font-semibold text-gray-600">City</th>
                <th class="text-left px-4 py-3 font-semibold text-gray-600">Country</th>
                <th class="text-left px-4 py-3 font-semibold text-gray-600">Phone</th>
                <th class="text-left px-4 py-3 font-semibold text-gray-600">Email</th>
                <th class="text-left px-4 py-3 font-semibold text-gray-600">Type</th>
                <th class="text-center px-4 py-3 font-semibold text-gray-600">Status</th>
                <th class="text-center px-4 py-3 font-semibold text-gray-600">Actions</th>
            </tr>
        </thead>
        <tbody>`;

    allCustomers.forEach(c => {
        const status = c.is_active !== false;
        html += `<tr class="border-b hover:bg-gray-50 transition-colors">
            <td class="px-4 py-2.5 font-mono text-xs">${c.customer_code || ''}</td>
            <td class="px-4 py-2.5 font-medium">${c.name || ''}</td>
            <td class="px-4 py-2.5 text-xs font-medium text-indigo-700">${c.customer_ref || '-'}</td>
            <td class="px-4 py-2.5 text-gray-500 text-xs max-w-[200px] truncate">${c.address || '-'}</td>
            <td class="px-4 py-2.5 text-xs">${c.city || '-'}</td>
            <td class="px-4 py-2.5 text-xs">${c.country || '-'}</td>
            <td class="px-4 py-2.5 text-xs">${c.phone || '-'}</td>
            <td class="px-4 py-2.5 text-xs">${c.email || '-'}</td>
            <td class="px-4 py-2.5 text-xs">${c.customer_type || '-'}</td>
            <td class="px-4 py-2.5 text-center">
                <span class="px-2 py-0.5 rounded-full text-xs font-medium ${
                    status ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }">${status ? 'Active' : 'Inactive'}</span>
            </td>
            <td class="px-4 py-2.5 text-center whitespace-nowrap">
                <button onclick="editRMCustomer('${c._id}')" class="text-indigo-600 hover:text-indigo-800 text-xs font-medium mr-3" title="Edit">
                    <svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                    Edit
                </button>
                <button onclick="deleteCustomer('${c._id}', '${(c.name || '').replace(/'/g, "\\\\'")}')" class="text-red-600 hover:text-red-800 text-xs font-medium" title="Delete">
                    <svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    Delete
                </button>
            </td>
        </tr>`;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

export function showAddCustomerModal() {
    editingCustomerId = null;
    document.getElementById('customer-modal-title').textContent = 'Add New Customer';
    document.getElementById('customer-modal-save-btn').textContent = 'Save Customer';
    document.getElementById('new-customer-name').value = '';
    document.getElementById('new-customer-address').value = '';
    const refEl = document.getElementById('new-customer-ref');
    if (refEl) refEl.value = '';
    document.getElementById('new-customer-city').value = '';
    document.getElementById('new-customer-country').value = '';
    document.getElementById('new-customer-phone').value = '';
    document.getElementById('new-customer-email').value = '';
    document.getElementById('new-customer-type').value = '';
    document.getElementById('new-customer-credit-terms').value = '';
    document.getElementById('edit-customer-id').value = '';
    document.getElementById('add-customer-modal').classList.remove('hidden');
}

export function closeAddCustomerModal() {
    document.getElementById('add-customer-modal').classList.add('hidden');
    editingCustomerId = null;
}

export function editCustomer(customerId) {
    const customer = allCustomers.find(c => c._id === customerId);
    if (!customer) {
        showToast('Customer not found', 'error');
        return;
    }
    editingCustomerId = customerId;
    document.getElementById('customer-modal-title').textContent = 'Edit Customer';
    document.getElementById('customer-modal-save-btn').textContent = 'Update Customer';
    document.getElementById('new-customer-name').value = customer.name || '';
    document.getElementById('new-customer-address').value = customer.address || '';
    const refEl = document.getElementById('new-customer-ref');
    if (refEl) refEl.value = customer.customer_ref || '';
    document.getElementById('new-customer-city').value = customer.city || '';
    document.getElementById('new-customer-country').value = customer.country || '';
    document.getElementById('new-customer-phone').value = customer.phone || '';
    document.getElementById('new-customer-email').value = customer.email || '';
    document.getElementById('new-customer-type').value = customer.customer_type || '';
    document.getElementById('new-customer-credit-terms').value = customer.credit_terms || '';
    document.getElementById('edit-customer-id').value = customerId;
    document.getElementById('add-customer-modal').classList.remove('hidden');
}

export async function deleteCustomer(customerId, customerName) {
    if (!confirm(`Are you sure you want to delete customer "${customerName}"? This cannot be undone.`)) {
        return;
    }
    try {
        const res = await authenticatedFetch(`/api/customers/${customerId}`, {
            method: 'DELETE',
        });
        if (res.ok) {
            showToast('Customer deleted', 'success');
            await loadCustomers();
        } else {
            const data = await res.json();
            showToast(data.detail || 'Failed to delete customer', 'error');
        }
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

export async function saveNewCustomer() {
    const name = document.getElementById('new-customer-name').value.trim();
    if (!name) {
        showToast('Customer name is required', 'error');
        return;
    }
    const payload = {
        name,
        address: document.getElementById('new-customer-address').value.trim() || null,
        customer_ref: document.getElementById('new-customer-ref')?.value.trim() || null,
        city: document.getElementById('new-customer-city').value.trim() || null,
        country: document.getElementById('new-customer-country').value.trim() || null,
        phone: document.getElementById('new-customer-phone').value.trim() || null,
        email: document.getElementById('new-customer-email').value.trim() || null,
        customer_type: document.getElementById('new-customer-type').value || 'retail',
        credit_terms: document.getElementById('new-customer-credit-terms').value.trim() || null,
    };

    try {
        let res;
        if (editingCustomerId) {
            res = await authenticatedFetch(`/api/customers/${editingCustomerId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
        } else {
            res = await authenticatedFetch('/api/customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
        }
        const data = await res.json();
        if (res.ok) {
            showToast(editingCustomerId ? 'Customer updated' : `Customer ${data.customer_code || ''} created`, 'success');
            closeAddCustomerModal();
            await loadCustomers();
        } else {
            showToast(data.detail || 'Failed to save customer', 'error');
        }
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

