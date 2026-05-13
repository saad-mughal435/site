/**
 * Demo Plant LLC — Dispatch Module
 *
 * One dispatch row per stock_reservation (one per JO line / per JO number /
 * per item). Each row dispatches independently:
 *   Local  → FG-OUT against ET-<code> Sage stock.
 *   Export → FG-OUT against the base <code> Sage stock.
 *
 * Processing a row generates a single-line Delivery Note PDF + single-line
 * Sage FG-OUT draft. The parent JO closes only when admin approves the
 * FG-OUT drafts for every reservation on that JO.
 */

import { authenticatedFetch } from '../auth.js?v=20260428b';

const FMT_QTY = (v) => {
    const n = Number(v || 0);
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

let activeTab = 'pending';      // pending | active | history
let pendingSubTab = 'local';    // local | export | untyped
let pendingData = { local: [], export: [], untyped: [] };
let activeListData = [];        // serialized Awaiting Sage rows
let historyListData = [];       // serialized History rows
let searchTerm = '';            // shared across panels, reset on tab switch

const TAB_ACTIVE   = 'disp-main-tab px-6 py-2.5 font-medium text-sm rounded-lg transition-all bg-blue-600 text-white shadow-sm';
const TAB_INACTIVE = 'disp-main-tab px-6 py-2.5 font-medium text-sm rounded-lg transition-all bg-white border border-slate-300 text-slate-700 hover:bg-slate-50';
const FILTER_ACTIVE   = 'disp-sub text-xs font-semibold px-4 py-2 rounded-lg bg-blue-600 text-white transition-all duration-200';
const FILTER_INACTIVE = 'disp-sub text-xs font-medium px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-blue-500 transition-all duration-200';

export async function loadDispatchPage() {
    const root = document.getElementById('disp-root');
    if (!root) return;
    root.innerHTML = renderShell();
    bindShellEvents();
    await refreshActiveTab();
}

function renderShell() {
    return `
        <div class="flex gap-3 mb-6" id="disp-tabs">
            <button data-disp-tab="pending" class="${TAB_ACTIVE}">Pending</button>
            <button data-disp-tab="active"  class="${TAB_INACTIVE}">Awaiting Sage</button>
            <button data-disp-tab="history" class="${TAB_INACTIVE}">History</button>
        </div>
        <div id="disp-panel"></div>
        <div id="disp-modal-root"></div>
    `;
}

function bindShellEvents() {
    document.querySelectorAll('.disp-main-tab').forEach(btn => {
        btn.addEventListener('click', async () => {
            activeTab = btn.dataset.dispTab;
            searchTerm = '';
            document.querySelectorAll('.disp-main-tab').forEach(b => {
                b.className = (b.dataset.dispTab === activeTab) ? TAB_ACTIVE : TAB_INACTIVE;
            });
            await refreshActiveTab();
        });
    });
}

function renderSectionHeader(title, subtitle) {
    return `
        <div class="flex justify-between items-center mb-6">
            <div>
                <h2 class="text-xl font-bold tracking-tight text-slate-900">${escapeHtml(title)}</h2>
                <p class="text-sm text-slate-500 mt-1">${escapeHtml(subtitle)}</p>
            </div>
            <div class="flex items-center gap-2">
                <button id="disp-refresh" class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg shadow-sm transition-all flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                    <span>Refresh</span>
                </button>
            </div>
        </div>
    `;
}

function renderSearchBar(placeholder) {
    return `
        <div class="mb-4">
            <div class="relative">
                <input type="text" id="disp-search-input" value="${escapeAttr(searchTerm)}"
                       placeholder="${escapeAttr(placeholder)}"
                       class="w-full px-4 py-3 pl-10 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all text-sm">
                <svg class="w-5 h-5 text-slate-400 absolute left-3 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
            </div>
        </div>
    `;
}

function bindSharedEvents() {
    document.getElementById('disp-refresh')?.addEventListener('click', refreshActiveTab);
    const search = document.getElementById('disp-search-input');
    if (search) {
        search.addEventListener('input', (e) => {
            searchTerm = e.target.value || '';
            rerenderResults();
        });
    }
}

function rerenderResults() {
    const holder = document.getElementById('disp-results');
    if (!holder) return;
    if (activeTab === 'pending') {
        const rows = filterRows(pendingData[pendingSubTab] || [], rowMatchesPending);
        holder.innerHTML = renderPendingTable(rows);
        bindRowClicks();
    } else if (activeTab === 'active') {
        const rows = filterRows(activeListData, rowMatchesDispatch);
        holder.innerHTML = renderDispatchTable(rows, 'No dispatches awaiting Sage approval.', { showRevert: true });
        bindActiveListEvents();
    } else {
        const rows = filterRows(historyListData, rowMatchesDispatch);
        holder.innerHTML = renderDispatchTable(rows, 'No completed dispatches yet.');
    }
}

function filterRows(rows, predicate) {
    const q = (searchTerm || '').toLowerCase().trim();
    if (!q) return rows;
    return rows.filter(r => predicate(r, q));
}

function rowMatchesPending(r, q) {
    return (r.jo_number || '').toLowerCase().includes(q)
        || (r.summary_ref || '').toLowerCase().includes(q)
        || (r.customer || '').toLowerCase().includes(q)
        || (r.item_code || '').toLowerCase().includes(q)
        || (r.sage_item_code || '').toLowerCase().includes(q)
        || (r.description || '').toLowerCase().includes(q)
        || (r.sage_description || '').toLowerCase().includes(q);
}

function rowMatchesDispatch(d, q) {
    return (d.dn_number || '').toLowerCase().includes(q)
        || (d.jo_number || '').toLowerCase().includes(q)
        || (d.customer || '').toLowerCase().includes(q)
        || (d.item_code || '').toLowerCase().includes(q)
        || (d.sage_item_code || '').toLowerCase().includes(q)
        || (d.description || '').toLowerCase().includes(q);
}

async function refreshActiveTab() {
    const panel = document.getElementById('disp-panel');
    if (!panel) return;
    panel.innerHTML = `<div class="flex items-center justify-center gap-2 py-12 text-slate-400 text-sm">
        <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Loading…
    </div>`;
    try {
        if (activeTab === 'pending') {
            const resp = await authenticatedFetch('/api/dispatch/pending-items');
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            pendingData = await resp.json();
            panel.innerHTML = renderPendingPanel();
            bindPendingEvents();
            bindSharedEvents();
        } else if (activeTab === 'active') {
            const resp = await authenticatedFetch('/api/dispatch/active');
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            activeListData = data.items || [];
            panel.innerHTML = renderDispatchListPanelShell('Awaiting Sage Approval',
                'FG-OUT drafts created and pending posting by admin in Sage.', activeListData,
                'No dispatches awaiting Sage approval.', { showRevert: true });
            bindActiveListEvents();
            bindSharedEvents();
        } else if (activeTab === 'history') {
            const resp = await authenticatedFetch('/api/dispatch/history');
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            historyListData = data.items || [];
            panel.innerHTML = renderDispatchListPanelShell('Dispatch History',
                'Dispatches whose FG-OUT draft has been posted in Sage.', historyListData,
                'No completed dispatches yet.', {});
            bindSharedEvents();
        }
    } catch (err) {
        panel.innerHTML = `<div class="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
            <svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <div><b>Failed to load.</b> ${escapeHtml(err.message || err)}</div>
        </div>`;
    }
}

// ---------------------------------------------------------------------------
// Pending tab
// ---------------------------------------------------------------------------

function renderPendingPanel() {
    const local = pendingData.local || [];
    const exp = pendingData.export || [];
    const untyped = pendingData.untyped || [];
    const rows = filterRows(pendingData[pendingSubTab] || [], rowMatchesPending);

    const pill = (key, label, count) => {
        const active = pendingSubTab === key;
        const cls = active ? FILTER_ACTIVE : FILTER_INACTIVE;
        return `<button data-disp-sub="${key}" class="${cls}">
            ${label} <span class="ml-1.5 inline-flex items-center justify-center text-[10px] font-bold rounded px-1.5 ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'}">${count}</span>
        </button>`;
    };

    return `
        ${renderSectionHeader('Pending Dispatches', 'Items reserved against active job orders awaiting dispatch.')}
        ${renderSearchBar('Search by JO #, customer, item code, or description…')}
        <div class="flex gap-2 mb-6">
            ${pill('local', 'Local', local.length)}
            ${pill('export', 'Export', exp.length)}
            ${untyped.length ? pill('untyped', 'Untyped', untyped.length) : ''}
        </div>
        <div id="disp-results">${renderPendingTable(rows)}</div>
    `;
}

function bindPendingEvents() {
    document.querySelectorAll('.disp-sub').forEach(btn => {
        btn.addEventListener('click', () => {
            pendingSubTab = btn.dataset.dispSub;
            document.querySelectorAll('.disp-sub').forEach(b => {
                b.className = (b.dataset.dispSub === pendingSubTab) ? FILTER_ACTIVE : FILTER_INACTIVE;
                // preserve the count badge inside each label
            });
            // refresh sub-tab labels (badges) cleanly by re-running renderPendingPanel
            const panel = document.getElementById('disp-panel');
            panel.innerHTML = renderPendingPanel();
            bindPendingEvents();
            bindSharedEvents();
        });
    });
    bindRowClicks();
}

function bindRowClicks() {
    document.querySelectorAll('.disp-item-row').forEach(row => {
        row.addEventListener('click', () => openProcessModal(row.dataset.reservationId));
    });
}

function renderPendingTable(rows) {
    let banner = '';
    if (pendingSubTab === 'untyped' && rows.length) {
        banner = `<div class="flex items-start gap-3 p-3 mb-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            <svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <div><b>${rows.length}</b> reservation(s) without a Local/Export flag. Set it in <b>Admin → Untyped JOs</b> before dispatching.</div>
        </div>`;
    }
    const headers = `
        <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">JO #</th>
        <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">Customer</th>
        <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">Item Code</th>
        <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">Sage Code</th>
        <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">Description</th>
        <th class="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">Required</th>
        <th class="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">Available</th>
        <th class="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">Status</th>
    `;
    const body = rows.length
        ? rows.map(r => `
            <tr class="disp-item-row hover:bg-slate-50 transition-colors border-b border-slate-100 cursor-pointer ${r.ok ? '' : 'bg-red-50/40'}" data-reservation-id="${escapeAttr(r.reservation_id)}">
                <td class="px-6 py-4 text-sm font-mono font-medium text-slate-900 whitespace-nowrap">${escapeHtml(r.jo_number || r.summary_ref || '-')}</td>
                <td class="px-6 py-4 text-sm text-slate-700">${escapeHtml(r.customer || '-')}</td>
                <td class="px-6 py-4 text-sm font-mono text-slate-700 whitespace-nowrap">${escapeHtml(r.item_code)}</td>
                <td class="px-6 py-4 text-sm font-mono text-slate-500 whitespace-nowrap">${escapeHtml(r.sage_item_code)}</td>
                <td class="px-6 py-4 text-sm text-slate-600">${escapeHtml(r.description || r.sage_description || '-')}</td>
                <td class="px-6 py-4 text-sm text-right text-slate-900 font-semibold tabular-nums">${FMT_QTY(r.required_qty)}</td>
                <td class="px-6 py-4 text-sm text-right font-semibold tabular-nums ${r.ok ? 'text-slate-900' : 'text-red-700'}">${FMT_QTY(r.available_qty)}</td>
                <td class="px-6 py-4 text-center">
                    ${r.ok
                        ? '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Ready</span>'
                        : `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Short ${FMT_QTY(r.shortfall)}</span>`}
                </td>
            </tr>
        `).join('')
        : `<tr><td colspan="8" class="px-6 py-12 text-center text-slate-500">${searchTerm ? `No results for "${escapeHtml(searchTerm)}"` : `No ${pendingSubTab} items awaiting dispatch.`}</td></tr>`;

    return banner + `
        <div class="rounded-xl border border-slate-200 overflow-hidden bg-white">
            <div class="overflow-x-auto max-h-[70vh]">
                <table class="min-w-full">
                    <thead class="bg-slate-50 sticky top-0">
                        <tr>${headers}</tr>
                    </thead>
                    <tbody class="bg-white">${body}</tbody>
                </table>
            </div>
        </div>
    `;
}

// ---------------------------------------------------------------------------
// Process modal (per reservation)
// ---------------------------------------------------------------------------

function findRowById(rid) {
    for (const key of ['local', 'export', 'untyped']) {
        const r = (pendingData[key] || []).find(x => x.reservation_id === rid);
        if (r) return r;
    }
    return null;
}

function openProcessModal(reservationId) {
    const row = findRowById(reservationId);
    const root = document.getElementById('disp-modal-root');
    if (!row) {
        root.innerHTML = modalShell('Item not found', `
            <div class="text-sm text-slate-600 mb-4">Reservation no longer in the pending list — refresh and try again.</div>
            <div class="flex justify-end pt-4 border-t border-slate-100">
                <button id="disp-modal-cancel" class="px-4 py-2 text-sm font-medium border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 transition-colors">Close</button>
            </div>`);
        bindModalClose();
        return;
    }

    const tBadge = (() => {
        const base = 'inline-flex items-center px-2.5 py-1 text-[11px] font-bold rounded-md border';
        if (row.local_export_type === 'local')  return `<span class="${base} bg-rose-50 text-rose-700 border-rose-200">LOCAL</span>`;
        if (row.local_export_type === 'export') return `<span class="${base} bg-blue-50 text-blue-700 border-blue-200">EXPORT</span>`;
        return `<span class="${base} bg-amber-50 text-amber-800 border-amber-200">UNTYPED</span>`;
    })();

    const statusHtml = row.ok
        ? `<div class="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
            Available — ready to dispatch
        </div>`
        : `<div class="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md bg-red-50 text-red-700 border border-red-200">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Short ${FMT_QTY(row.shortfall)} — move stock in Sage first
        </div>`;

    const fieldLabel = 'text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1';

    const body = `
        <div class="flex items-start gap-4 pb-4 mb-4 border-b border-slate-100">
            <div class="flex-1 min-w-0">
                <div class="${fieldLabel}">JO Number</div>
                <div class="font-mono text-sm font-bold text-slate-900 truncate">${escapeHtml(row.jo_number || row.summary_ref || '-')}</div>
            </div>
            <div class="flex-1 min-w-0">
                <div class="${fieldLabel}">Customer</div>
                <div class="font-semibold text-slate-800 truncate">${escapeHtml(row.customer || '-')}</div>
            </div>
            <div class="flex-shrink-0">${tBadge}</div>
        </div>
        <div class="grid grid-cols-2 gap-4 text-sm bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
            <div>
                <div class="${fieldLabel}">Item Code</div>
                <div class="font-mono text-sm text-slate-800">${escapeHtml(row.item_code)}</div>
            </div>
            <div>
                <div class="${fieldLabel}">Sage Code (FG-OUT)</div>
                <div class="font-mono text-sm text-slate-800">${escapeHtml(row.sage_item_code)}</div>
            </div>
            <div class="col-span-2">
                <div class="${fieldLabel}">Description</div>
                <div class="text-slate-700">${escapeHtml(row.description || row.sage_description || '-')}</div>
            </div>
            <div>
                <div class="${fieldLabel}">Required Qty</div>
                <div class="text-base font-bold text-slate-900">${FMT_QTY(row.required_qty)} <span class="text-xs font-normal text-slate-500">${escapeHtml(row.uom || 'CS')}</span></div>
            </div>
            <div>
                <div class="${fieldLabel}">Sage Available</div>
                <div class="text-base font-bold ${row.ok ? 'text-slate-900' : 'text-red-700'}">${FMT_QTY(row.available_qty)}</div>
            </div>
        </div>
        <div class="mb-4">${statusHtml}</div>
        ${row.ok ? '' : `<div class="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 mb-4">
            <svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <div>Move stock in Sage (<b>Local:</b> into the ET- SKU; <b>Export:</b> into the base SKU), then click <b>Refresh</b> on the Pending list.</div>
        </div>`}
        <div class="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button id="disp-modal-cancel" class="px-4 py-2 text-sm font-medium border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 transition-colors">Cancel</button>
            <button id="disp-modal-process" class="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-md text-white shadow-sm transition-colors ${row.ok ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-300 cursor-not-allowed'}" ${row.ok ? '' : 'disabled'}>
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
                Process Dispatch
            </button>
        </div>
    `;
    root.innerHTML = modalShell(`Dispatch — ${escapeHtml(row.jo_number || '')} · ${escapeHtml(row.item_code)}`, body);
    bindModalClose();
    document.getElementById('disp-modal-process')?.addEventListener('click', () => processReservation(reservationId));
}

async function processReservation(reservationId) {
    const btn = document.getElementById('disp-modal-process');
    if (btn) { btn.disabled = true; btn.textContent = 'Processing…'; }

    try {
        const resp = await authenticatedFetch(`/api/dispatch/items/${encodeURIComponent(reservationId)}/process`, { method: 'POST' });
        const rawText = await resp.text();
        let data = {};
        try { data = rawText ? JSON.parse(rawText) : {}; } catch (_) { data = {}; }

        if (!resp.ok) {
            const detail = data.detail;
            if (detail && typeof detail === 'object' && detail.shortfall) {
                const s = detail.shortfall;
                showErrorInModal('Insufficient stock', `<div class="text-sm">
                    <span class="font-mono">${escapeHtml(s.sage_item_code)}</span> — required ${FMT_QTY(s.required)}, available ${FMT_QTY(s.available)} (short ${FMT_QTY(s.shortfall)}).
                </div>`);
            } else {
                let msg;
                if (typeof detail === 'string' && detail) msg = detail;
                else if (detail && typeof detail === 'object') msg = JSON.stringify(detail);
                else if (rawText) msg = rawText;
                else msg = '(empty response body)';
                showErrorInModal('Dispatch failed', `<div class="text-sm">
                    <div class="text-xs text-slate-500 mb-1">HTTP ${resp.status} ${escapeHtml(resp.statusText || '')}</div>
                    <pre class="whitespace-pre-wrap text-xs bg-slate-50 border border-slate-200 rounded p-2 max-h-64 overflow-auto">${escapeHtml(msg)}</pre>
                </div>`);
            }
            return;
        }
        showSuccessInModal(data);
    } catch (err) {
        showErrorInModal('Dispatch failed', `<div class="text-sm">${escapeHtml(err.message || err)}</div>`);
    }
}

function showSuccessInModal(result) {
    const root = document.getElementById('disp-modal-root');
    const fieldLabel = 'text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1';
    const body = `
        <div class="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-lg mb-4">
            <div class="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <svg class="w-5 h-5 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
            </div>
            <div class="flex-1">
                <div class="font-semibold text-emerald-900">${escapeHtml(result.message || 'Dispatch processed')}</div>
                <div class="text-xs text-emerald-700 mt-1">DN <span class="font-mono font-semibold">${escapeHtml(result.dn_number)}</span> · <span class="font-mono">${escapeHtml(result.sage_item_code)}</span> · ${FMT_QTY(result.qty)}</div>
            </div>
        </div>
        <div class="grid grid-cols-2 gap-4 bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
            <div>
                <div class="${fieldLabel}">JO Number</div>
                <div class="font-mono text-sm font-semibold text-slate-800">${escapeHtml(result.jo_number || '-')}</div>
            </div>
            <div>
                <div class="${fieldLabel}">Delivery Note PDF</div>
                <a href="${result.download_url}" target="_blank" class="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800">
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                    ${escapeHtml(result.dn_number)}.pdf
                </a>
            </div>
            <div class="col-span-2">
                <div class="${fieldLabel}">Sage FG-OUT Draft</div>
                <div class="text-sm text-slate-700">Batch <span class="font-mono font-semibold">#${escapeHtml(String(result.sage_batch_id || ''))}</span> · Journal <span class="font-mono font-semibold">${escapeHtml(String(result.sage_journal_number || ''))}</span></div>
            </div>
        </div>
        <div class="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 mb-4">
            <svg class="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <div>${escapeHtml(result.next_step || '')}</div>
        </div>
        <div class="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button id="disp-modal-cancel" class="px-4 py-2 text-sm font-semibold rounded-md bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors">Close</button>
        </div>
    `;
    root.innerHTML = modalShell('Dispatch processed', body);
    bindModalClose(() => refreshActiveTab());
}

function showErrorInModal(title, bodyHtml) {
    const root = document.getElementById('disp-modal-root');
    root.innerHTML = modalShell(title, `
        ${bodyHtml}
        <div class="flex justify-end gap-2 pt-4 mt-2 border-t border-slate-100">
            <button id="disp-modal-cancel" class="px-4 py-2 text-sm font-medium border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 transition-colors">Close</button>
        </div>
    `);
    bindModalClose();
}

// ---------------------------------------------------------------------------
// Awaiting Sage + History panels
// ---------------------------------------------------------------------------

function renderDispatchListPanelShell(title, subtitle, items, emptyMsg, opts = {}) {
    const placeholder = title.toLowerCase().includes('history')
        ? 'Search by DN #, JO #, customer, or item…'
        : 'Search by DN #, JO #, customer, or item…';
    const filtered = filterRows(items, rowMatchesDispatch);
    return `
        ${renderSectionHeader(title, subtitle)}
        ${renderSearchBar(placeholder)}
        <div id="disp-results">${renderDispatchTable(filtered, emptyMsg, opts)}</div>
    `;
}

function renderDispatchTable(items, emptyMsg, opts = {}) {
    const showRevert = !!opts.showRevert;
    const th = (align) => `<th class="px-6 py-3 ${align} text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">`;
    const colspan = 9 + (showRevert ? 1 : 0);
    const body = items.length
        ? items.map(d => `
            <tr class="hover:bg-slate-50 transition-colors border-b border-slate-100">
                <td class="px-6 py-4 text-sm font-mono font-medium text-slate-900 whitespace-nowrap">${escapeHtml(d.dn_number || '-')}</td>
                <td class="px-6 py-4 text-sm font-mono text-slate-700 whitespace-nowrap">${escapeHtml(d.jo_number || '-')}</td>
                <td class="px-6 py-4 text-sm text-slate-700">${escapeHtml(d.customer || '-')}</td>
                <td class="px-6 py-4 text-sm">
                    <div class="font-mono text-slate-700">${escapeHtml(d.sage_item_code || d.item_code || '-')}</div>
                    <div class="text-xs text-slate-500">${escapeHtml(d.description || '')}</div>
                </td>
                <td class="px-6 py-4 text-center">${typeBadge(d.local_export_type)}</td>
                <td class="px-6 py-4 text-sm text-right text-slate-900 font-semibold tabular-nums whitespace-nowrap">${FMT_QTY(d.qty)}</td>
                <td class="px-6 py-4 text-center">${sageStatusBadge(d.sage_fg_out_status)}</td>
                <td class="px-6 py-4 text-xs whitespace-nowrap">
                    <div class="text-slate-700">${escapeHtml((d.dispatched_at || '').slice(0, 19).replace('T', ' '))}</div>
                    <div class="text-slate-400">by ${escapeHtml(d.dispatched_by || '-')}</div>
                </td>
                <td class="px-6 py-4 text-center">${d.delivery_note_pdf_id
                    ? `<a href="/api/pdf-documents/${escapeAttr(d.delivery_note_pdf_id)}/download" target="_blank" class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                            PDF
                       </a>`
                    : '<span class="text-slate-300">—</span>'}</td>
                ${showRevert ? `<td class="px-6 py-4 text-center">
                    <button class="disp-revert-btn inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-amber-300 text-amber-700 bg-white hover:bg-amber-50 transition-colors"
                            data-dispatch-id="${escapeAttr(d.dispatch_id)}"
                            data-dn-number="${escapeAttr(d.dn_number || '')}"
                            data-jo-number="${escapeAttr(d.jo_number || '')}"
                            data-item-code="${escapeAttr(d.sage_item_code || d.item_code || '')}"
                            data-qty="${escapeAttr(d.qty)}"
                            title="Send this dispatch back to Pending">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>
                        Send back
                    </button>
                </td>` : ''}
            </tr>
        `).join('')
        : `<tr><td colspan="${colspan}" class="px-6 py-12 text-center text-slate-500">${searchTerm ? `No results for "${escapeHtml(searchTerm)}"` : escapeHtml(emptyMsg)}</td></tr>`;

    return `
        <div class="rounded-xl border border-slate-200 overflow-hidden bg-white">
            <div class="overflow-x-auto max-h-[70vh]">
                <table class="min-w-full">
                    <thead class="bg-slate-50 sticky top-0">
                        <tr>
                            ${th('text-left')}DN #</th>
                            ${th('text-left')}JO #</th>
                            ${th('text-left')}Customer</th>
                            ${th('text-left')}Item</th>
                            ${th('text-center')}Type</th>
                            ${th('text-right')}Qty</th>
                            ${th('text-center')}Sage Status</th>
                            ${th('text-left')}Dispatched</th>
                            ${th('text-center')}PDF</th>
                            ${showRevert ? `${th('text-center')}Actions</th>` : ''}
                        </tr>
                    </thead>
                    <tbody class="bg-white">${body}</tbody>
                </table>
            </div>
        </div>
    `;
}

function bindActiveListEvents() {
    document.querySelectorAll('.disp-revert-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            openRevertModal({
                dispatch_id: btn.dataset.dispatchId,
                dn_number: btn.dataset.dnNumber,
                jo_number: btn.dataset.joNumber,
                item_code: btn.dataset.itemCode,
                qty: btn.dataset.qty,
            });
        });
    });
}

function openRevertModal(info) {
    const root = document.getElementById('disp-modal-root');
    const fieldLabel = 'text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1';
    const body = `
        <div class="text-sm text-slate-600 mb-4">Send this dispatch back to the Pending list?</div>
        <div class="grid grid-cols-2 gap-4 bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
            <div>
                <div class="${fieldLabel}">DN Number</div>
                <div class="font-mono text-sm font-semibold text-slate-800">${escapeHtml(info.dn_number || '-')}</div>
            </div>
            <div>
                <div class="${fieldLabel}">JO Number</div>
                <div class="font-mono text-sm font-semibold text-slate-800">${escapeHtml(info.jo_number || '-')}</div>
            </div>
            <div>
                <div class="${fieldLabel}">Item</div>
                <div class="font-mono text-sm text-slate-700">${escapeHtml(info.item_code || '-')}</div>
            </div>
            <div>
                <div class="${fieldLabel}">Quantity</div>
                <div class="text-sm font-semibold text-slate-800">${FMT_QTY(info.qty)}</div>
            </div>
        </div>
        <div class="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 mb-4">
            <svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z"/></svg>
            <div>This will <b>delete the Sage FG-OUT draft batch</b>, reactivate the reservation, and roll the job order back to <b>Processed</b> if no other dispatches remain on it. The delivery note PDF stays available in document history. Cannot be undone if Sage has already posted the draft.</div>
        </div>
        <div class="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button id="disp-modal-cancel" class="px-4 py-2 text-sm font-medium border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 transition-colors">Cancel</button>
            <button id="disp-modal-revert" class="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-md bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition-colors" data-dispatch-id="${escapeAttr(info.dispatch_id)}">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>
                Send Back to Pending
            </button>
        </div>
    `;
    root.innerHTML = modalShell(`Revert dispatch — ${escapeHtml(info.dn_number || '')}`, body);
    bindModalClose();
    document.getElementById('disp-modal-revert')?.addEventListener('click', () => revertDispatch(info.dispatch_id));
}

async function revertDispatch(dispatchId) {
    const btn = document.getElementById('disp-modal-revert');
    if (btn) { btn.disabled = true; btn.textContent = 'Reverting…'; }
    try {
        const resp = await authenticatedFetch(`/api/dispatch/${encodeURIComponent(dispatchId)}/revert`, { method: 'POST' });
        const rawText = await resp.text();
        let data = {};
        try { data = rawText ? JSON.parse(rawText) : {}; } catch (_) { data = {}; }
        if (!resp.ok) {
            const detail = data.detail;
            const msg = typeof detail === 'string' && detail
                ? detail
                : (detail && typeof detail === 'object' ? JSON.stringify(detail) : (rawText || '(empty response body)'));
            showErrorInModal('Revert failed', `<div class="text-sm">
                <div class="text-xs text-slate-500 mb-1">HTTP ${resp.status} ${escapeHtml(resp.statusText || '')}</div>
                <pre class="whitespace-pre-wrap text-xs bg-slate-50 border border-slate-200 rounded p-2 max-h-64 overflow-auto">${escapeHtml(msg)}</pre>
            </div>`);
            return;
        }
        const yesNo = (v) => v
            ? '<span class="inline-flex items-center gap-1 text-emerald-700"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>yes</span>'
            : '<span class="inline-flex items-center gap-1 text-slate-500"><span class="w-1.5 h-1.5 rounded-full bg-slate-300"></span>no</span>';
        const ok = `
            <div class="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-lg mb-4">
                <div class="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                    <svg class="w-5 h-5 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                </div>
                <div class="flex-1">
                    <div class="font-semibold text-emerald-900">${escapeHtml(data.message || 'Dispatch reverted')}</div>
                    <div class="text-xs text-emerald-700 mt-1">The reservation is back on the Pending list.</div>
                </div>
            </div>
            <div class="grid grid-cols-3 gap-3 text-sm bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4">
                <div>
                    <div class="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Reservations</div>
                    <div class="font-semibold text-slate-800">${data.reservations_reactivated || 0} reactivated</div>
                </div>
                <div>
                    <div class="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">JO rolled back</div>
                    <div class="font-semibold text-sm">${yesNo(data.jo_rolled_back_to_processed)}</div>
                </div>
                <div>
                    <div class="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Sage draft deleted</div>
                    <div class="font-semibold text-sm">${yesNo(data.sage_batch_deleted)}</div>
                </div>
            </div>
            <div class="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button id="disp-modal-cancel" class="px-4 py-2 text-sm font-semibold rounded-md bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors">Close</button>
            </div>
        `;
        document.getElementById('disp-modal-root').innerHTML = modalShell('Dispatch reverted', ok);
        bindModalClose(() => refreshActiveTab());
    } catch (err) {
        showErrorInModal('Revert failed', `<div class="text-sm">${escapeHtml(err.message || err)}</div>`);
    }
}

function typeBadge(t) {
    const base = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';
    if (t === 'local')  return `<span class="${base} bg-rose-100 text-rose-800">LOCAL</span>`;
    if (t === 'export') return `<span class="${base} bg-blue-100 text-blue-800">EXPORT</span>`;
    return `<span class="${base} bg-slate-100 text-slate-600">—</span>`;
}

function sageStatusBadge(s) {
    const base = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';
    const m = {
        pending:   `${base} bg-slate-100 text-slate-700`,
        draft:     `${base} bg-orange-100 text-orange-800`,
        posted:    `${base} bg-green-100 text-green-800`,
        failed:    `${base} bg-red-100 text-red-800`,
        cancelled: `${base} bg-slate-100 text-slate-500`,
    };
    const key = s || 'pending';
    return `<span class="${m[key] || m.pending}">${escapeHtml(key.toUpperCase())}</span>`;
}

// ---------------------------------------------------------------------------
// Modal helpers
// ---------------------------------------------------------------------------

function modalShell(title, bodyHtml) {
    return `
        <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 flex items-center justify-center p-4" id="disp-modal-backdrop">
            <div class="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onclick="event.stopPropagation()">
                <div class="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50/50 rounded-t-xl">
                    <h3 class="text-base font-bold text-slate-900">${escapeHtml(title)}</h3>
                    <button id="disp-modal-x" class="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>
                <div class="p-5">${bodyHtml}</div>
            </div>
        </div>
    `;
}

function bindModalClose(onClose) {
    const close = () => {
        const root = document.getElementById('disp-modal-root');
        if (root) root.innerHTML = '';
        if (typeof onClose === 'function') onClose();
    };
    document.getElementById('disp-modal-x')?.addEventListener('click', close);
    document.getElementById('disp-modal-cancel')?.addEventListener('click', close);
    document.getElementById('disp-modal-backdrop')?.addEventListener('click', (e) => {
        if (e.target.id === 'disp-modal-backdrop') close();
    });
}

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

function escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function escapeAttr(s) { return encodeURIComponent(String(s == null ? '' : s)); }
