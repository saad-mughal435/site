/**
 * Demo Plant LLC - Job Order Documents Module
 * Grouped view with Pending / Completed sub-tabs
 */

import { debounce, showToast } from '../utils.js?v=20260125h';
import { authenticatedFetch, hasAnyRole } from '../auth.js?v=20260428b';

let allGroups = [];
let totalGroups = 0;
let currentDocSubTab = 'production';
let currentDocScope = 'main'; // 'main' (Job Orders tab) or 'po' (PO Processing > Status)
let allocationQueueRows = []; // allocation_pending items for Production view totals

let prodFilterType = 'all';
let prodFilterVolume = 'all';
let prodFilterSearch = '';
let prodFilterRM = 'all'; // 'all' | 'ready' (no RM shortage) | 'short' (RM short only)

function _suf(scope) { return (scope || currentDocScope) === 'po' ? '-po' : ''; }

// ============================================================================
// Sub-tab Switching
// ============================================================================

export function switchDocSubTab(tab, scope) {
    if (scope) currentDocScope = scope;
    currentDocSubTab = tab;
    const suf = _suf();

    const buttons = {
        pending: document.getElementById('doc-subtab-pending' + suf),
        completed: document.getElementById('doc-subtab-completed' + suf),
        production: document.getElementById('doc-subtab-production' + suf),
    };
    const activeClass = 'bg-blue-600 text-white shadow-sm border border-slate-300';
    const inactiveClass = 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50';

    for (const [key, btn] of Object.entries(buttons)) {
        if (btn) {
            btn.className = `px-6 py-2.5 font-medium text-sm rounded-lg transition-all ${key === tab ? activeClass : inactiveClass}`;
        }
    }

    loadDocumentsPage();
}

// ============================================================================
// Page Loading
// ============================================================================

export async function loadDocumentsPage(scope) {
    if (scope) currentDocScope = scope;
    const suf = _suf();
    try {
        const searchTerm = document.getElementById('doc-search' + suf)?.value || '';
        const params = new URLSearchParams();
        if (searchTerm) params.append('search', searchTerm);
        const apiStatus = currentDocSubTab === 'production' ? 'pending' : currentDocSubTab;
        params.append('status', apiStatus);

        const response = await authenticatedFetch(`/api/job-order-groups?${params}`);
        if (!response.ok) {
            const errText = await response.text().catch(() => '');
            throw new Error(errText || `HTTP ${response.status}`);
        }

        const data = await response.json();
        allGroups = data.groups || [];
        totalGroups = data.total || 0;

        // Production view also totals items still waiting in the allocation
        // queue (previous JOs whose items were returned, or parents not yet
        // activated) so "Total Quantity to be Produced" reflects all pending.
        if (currentDocSubTab === 'production') {
            try {
                const allocResp = await authenticatedFetch('/api/allocations/pending');
                if (allocResp.ok) {
                    const allocData = await allocResp.json();
                    allocationQueueRows = allocData.rows || [];
                } else {
                    allocationQueueRows = [];
                }
            } catch (_) {
                allocationQueueRows = [];
            }
        } else {
            allocationQueueRows = [];
        }

        renderDocumentsTable();
        updateDocumentStats();
    } catch (error) {
        console.error('Error loading job order groups:', error);
        showToast('Error loading job orders: ' + (error?.message || 'unknown'), 'error');
        const container = document.getElementById('documents-table-body' + suf);
        if (container) {
            container.innerHTML = `<div class="px-6 py-8 text-center text-red-500">Error loading job orders: ${(error?.message || 'unknown').replace(/</g, '&lt;')}</div>`;
        }
    }
}

// ============================================================================
// Rendering
// ============================================================================

export function renderDocumentsTable() {
    const suf = _suf();
    const container = document.getElementById('documents-table-body' + suf);
    if (!container) return;

    if (!allGroups || allGroups.length === 0) {
        const emptyMessages = {
            completed: 'No completed job order groups found',
            production: 'No items to produce',
            pending: 'No pending job order groups found',
        };
        const emptyMsg = emptyMessages[currentDocSubTab] || emptyMessages.pending;
        container.innerHTML = `<div class="px-6 py-12 text-center text-slate-400">${emptyMsg}</div>`;
        return;
    }

    if (currentDocSubTab === 'production') {
        const summaryHtml = buildProductionSummary(allGroups);
        container.innerHTML = summaryHtml || `<div class="px-6 py-12 text-center text-slate-400">No items to produce</div>`;
        return;
    }

    if (currentDocSubTab === 'pending') {
        const pendingOnlyHtml = buildGroupCardsHtml(allGroups, { showCompletedChildren: false, idSuffix: suf + '-top' });
        const fullHtml = buildGroupCardsHtml(allGroups, { showCompletedChildren: true, idSuffix: suf });
        const pendingGroupCount = allGroups.filter(g => (g.children || []).some(c => !c.completed && c.is_active !== false)).length;
        container.innerHTML = `
            <div class="mb-6">
                <div class="flex items-center gap-2 mb-3 px-1">
                    <h3 class="text-sm font-bold uppercase tracking-wider text-amber-800">Pending Job Orders</h3>
                    <span class="text-xs text-amber-600 font-medium">(${pendingGroupCount} group${pendingGroupCount === 1 ? '' : 's'})</span>
                </div>
                ${pendingOnlyHtml || '<div class="px-6 py-8 text-center text-slate-400 text-sm bg-white border border-slate-200 rounded-xl">No pending job orders.</div>'}
            </div>
            <div class="border-t-2 border-slate-200 my-6"></div>
            <div>
                <div class="flex items-center gap-2 mb-3 px-1">
                    <h3 class="text-sm font-bold uppercase tracking-wider text-slate-700">All Groups (Pending + Completed)</h3>
                    <span class="text-xs text-slate-500 font-medium">(${allGroups.length} group${allGroups.length === 1 ? '' : 's'})</span>
                </div>
                ${fullHtml}
            </div>
        `;
        return;
    }

    container.innerHTML = buildGroupCardsHtml(allGroups, { showCompletedChildren: true, idSuffix: _suf() });
}

function buildGroupCardsHtml(groups, { showCompletedChildren = true, idSuffix = '' } = {}) {
    const canDelete = hasAnyRole(['admin', 'manager']);
    const canViewConfidential = hasAnyRole(['admin', 'manager']);

    const cards = groups.map((group) => {
        const date = new Date(group.date);
        const formattedDate = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const totalCases = Number(group.total_cases || 0).toLocaleString();

        const completedCount = (group.children || []).filter(c => c.completed).length;
        const totalCount = (group.children || []).length;
        const progressText = `${completedCount}/${totalCount} completed`;

        const visibleChildren = showCompletedChildren
            ? (group.children || [])
            : (group.children || []).filter(c => !c.completed && c.is_active !== false);

        if (!visibleChildren.length) return '';

        const summaryBtn = `<button onclick="downloadPDF('${group.summary_id}', '${group.summary_filename}')"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-semibold transition-colors border border-emerald-200" title="Download Summary Sheet">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
            Summary Sheet
        </button>`;

        const poBtn = (canViewConfidential && group.po_id)
            ? `<button onclick="downloadPDF('${group.po_id}', '${group.po_filename || 'PO.pdf'}')"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold transition-colors border border-blue-200" title="Download Purchase Order">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                Purchase Order
               </button>`
            : '';

        const piBtn = (canViewConfidential && group.pi_id)
            ? `<button onclick="downloadPDF('${group.pi_id}', '${group.pi_filename || 'PI.pdf'}')"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg text-xs font-semibold transition-colors border border-amber-200" title="Download Proforma Invoice">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                Proforma Invoice
               </button>`
            : '';

        const joSummaryBtn = group.jo_summary_id
            ? `<button onclick="downloadPDF('${group.jo_summary_id}', '${group.jo_summary_filename || 'JO_Summary.pdf'}')"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-700 hover:bg-orange-100 rounded-lg text-xs font-semibold transition-colors border border-orange-200" title="Download JO Summary (per-PO breakdown)">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>
                JO Summary
               </button>`
            : '';

        const childIds = JSON.stringify(group.children.map(c => c.child_id));
        const safeRef = (group.summary_ref || 'JOs').replace(/'/g, "\\'");
        const allJOsBtn = group.children.length > 0
            ? `<button onclick="downloadAllJOs('${safeRef}', ${childIds.replace(/"/g, '&quot;')})"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg text-xs font-semibold transition-colors border border-purple-200" title="Download all JO PDFs as one combined file">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                All Job Orders
               </button>`
            : '';

        const completedBadge = group.all_completed
            ? `<span class="px-2.5 py-1 text-xs font-bold rounded-lg bg-green-100 text-green-700">Completed</span>`
            : `<span class="px-2.5 py-1 text-xs font-medium rounded-lg bg-amber-50 text-amber-700 border border-amber-200">${progressText}</span>`;

        const childRows = visibleChildren.map(child => {
            const cases = child.cases != null ? Number(child.cases).toLocaleString() : '-';
            const escapedItemCode = (child.item_code || '').replace(/'/g, "\\'");
            const casesNum = child.cases || 0;
            const isDone = child.completed;
            const isActive = child.is_active !== false; // default true for legacy rows
            const isUrgent = (child.priority || 'normal') === 'urgent';

            let rowClass = isDone
                ? 'bg-green-50/50 transition-colors'
                : 'hover:bg-slate-50 transition-colors';
            if (!isActive) rowClass += ' opacity-50 bg-slate-50';

            const textClass = !isActive
                ? 'text-slate-400 italic'
                : (isDone ? 'text-slate-400 line-through' : 'text-slate-700');
            const casesTextClass = !isActive
                ? 'text-slate-400 italic'
                : (isDone ? 'text-slate-400 line-through' : 'text-slate-900');

            const deleteBtn = canDelete && !isDone && isActive
                ? `<button onclick="deletePDF('${child.child_id}')" class="text-red-500 hover:text-red-700" title="Delete">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                   </button>`
                : '';

            let completeBtn = '';
            if (!isActive) {
                completeBtn = `<span class="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-400 rounded-md text-xs font-semibold border border-slate-200" title="Inactive job order">Inactive</span>`;
            } else if (!isDone) {
                completeBtn = `<button onclick="completeJO('${child.child_id}', 'batch-${child.child_id}${idSuffix}')"
                    class="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 hover:bg-green-100 rounded-md text-xs font-semibold transition-colors border border-green-200" title="Mark as completed">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                    Complete
                </button>`;
            } else {
                completeBtn = `<button onclick="uncompleteJO('${child.child_id}')"
                    class="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-50 text-slate-500 hover:bg-slate-100 rounded-md text-xs font-semibold transition-colors border border-slate-200" title="Undo completion">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
                    Undo
                </button>`;
            }

            const statusIcon = isDone
                ? `<svg class="w-4 h-4 text-green-500 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`
                : '';

            const isAutoUrgent = !!child.auto_urgent;
            const urgentBadge = (isUrgent && isActive)
                ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-100 text-red-700 border border-red-200 ml-1" title="${isAutoUrgent ? 'Auto-escalated to urgent: this JO was RM-short and RM is now available after 10+ days' : 'Urgent priority'}">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                    URGENT${isAutoUrgent ? ' <span class="px-1 text-[9px] rounded bg-red-200 text-red-800">AUTO</span>' : ''}
                </span>`
                : '';

            const isPO = currentDocScope === 'po';
            const rowColSpan = isPO ? 6 : 7;
            const showReasonRow = !isDone && isActive;
            const autoReason = (child.pending_reason_auto || '').trim();
            const manualReason = (child.pending_reason_manual || '').replace(/"/g, '&quot;');
            const reasonRowHtml = showReasonRow
                ? `<tr class="bg-rose-50/30">
                        <td colspan="${rowColSpan}" class="px-4 pb-2 pt-0">
                            ${autoReason ? `<div class="text-xs text-red-600 font-medium flex items-start gap-1">
                                <svg class="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                                <span>${autoReason.replace(/</g, '&lt;')}</span>
                            </div>` : ''}
                            <div class="flex items-center gap-2 mt-1">
                                <span class="text-[11px] text-slate-500 font-medium">Reason:</span>
                                <input type="text" id="reason-${child.child_id}${idSuffix}" value="${manualReason}"
                                    placeholder="Add a reason (optional)…"
                                    onblur="savePendingReason('${child.child_id}', this.value)"
                                    onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}"
                                    class="flex-1 px-2 py-1 text-xs border border-rose-200 bg-white rounded-md text-red-700 placeholder-rose-300 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-rose-400" />
                            </div>
                        </td>
                    </tr>`
                : '';

            const cid = String(child.child_id).replace(/'/g, "\\'");
            const activeHandler = isPO ? 'onStatusActiveToggle' : 'setJOStatus';
            const activeArgs = isPO ? `'${cid}', this.checked, this` : `'${cid}', 'is_active', this.checked`;
            const activeCell = isDone
                ? `<input type="checkbox" ${isActive ? 'checked' : ''} disabled title="Completed — cannot deactivate" class="w-4 h-4 rounded border-slate-300 text-slate-400 cursor-not-allowed">`
                : `<input type="checkbox" ${isActive ? 'checked' : ''} onchange="${activeHandler}(${activeArgs})" class="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer">`;
            const prioNormal = !isUrgent ? 'selected' : '';
            const prioUrgent = isUrgent ? 'selected' : '';
            const priorityCell = isDone
                ? `<select disabled class="px-2 py-1 border border-slate-200 rounded text-xs font-semibold text-slate-400 bg-slate-50 cursor-not-allowed">
                        <option value="normal" ${prioNormal}>Normal</option>
                        <option value="urgent" ${prioUrgent}>Urgent</option>
                    </select>`
                : `<select onchange="setJOStatus('${cid}', 'priority', this.value)"
                        class="px-2 py-1 border border-slate-300 rounded text-xs font-semibold ${isUrgent ? 'text-red-600 bg-red-50 border-red-300' : 'text-slate-700 bg-white'}">
                        <option value="normal" ${prioNormal}>Normal</option>
                        <option value="urgent" ${prioUrgent}>Urgent</option>
                    </select>`;

            const joRefCell = isPO ? '' : `<td class="px-4 py-3 whitespace-nowrap text-sm">
                    ${statusIcon}<span class="px-2 py-0.5 text-xs font-semibold rounded-full ${isDone ? 'bg-green-100 text-green-600' : 'bg-green-100 text-green-800'}">${child.jo_reference || '-'}</span>
                </td>`;
            const gtinCell = isPO ? '' : `<td class="px-4 py-3 whitespace-nowrap text-xs ${!isActive ? 'text-slate-400 italic' : (isDone ? 'text-slate-400' : 'text-slate-500')} font-mono">${child.gtin || '-'}</td>`;
            const batchCell = isPO ? '' : `<td class="px-4 py-3 whitespace-nowrap text-sm">
                    ${!isActive
                        ? `<span class="text-xs font-mono font-medium text-slate-400 italic">${child.batch_number || '-'}</span>`
                        : (isDone
                            ? `<span class="text-xs font-mono font-medium text-slate-600">${child.batch_number || '-'}</span>`
                            : `<input type="text" id="batch-${child.child_id}${idSuffix}" placeholder="Enter batch #"
                                class="w-32 px-2 py-1 text-xs font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400" />`)
                    }
                </td>`;
            const itemCodeLead = isPO
                ? `<td class="px-4 py-3 whitespace-nowrap text-xs ${!isActive ? 'text-slate-400 italic' : (isDone ? 'text-slate-400' : 'text-slate-500')} font-mono">${statusIcon}${child.item_code || '-'}</td>`
                : `<td class="px-4 py-3 whitespace-nowrap text-xs ${!isActive ? 'text-slate-400 italic' : (isDone ? 'text-slate-400' : 'text-slate-500')} font-mono">${child.item_code || '-'}</td>`;

            return `<tr class="${rowClass}">
                ${isPO ? `<td class="px-4 py-3 whitespace-nowrap text-center text-sm">${activeCell}</td>` : ''}
                ${joRefCell}
                ${itemCodeLead}
                <td class="px-4 py-3 text-sm ${textClass}">${child.description || '-'}</td>
                ${gtinCell}
                ${isPO ? `<td class="px-4 py-3 whitespace-nowrap text-center text-sm">${priorityCell}</td>` : ''}
                <td class="px-4 py-3 whitespace-nowrap text-sm text-right font-medium ${casesTextClass}">${cases}</td>
                ${batchCell}
                <td class="px-4 py-3 whitespace-nowrap text-center text-sm">
                    <div class="flex items-center justify-center gap-1.5">
                        ${completeBtn}
                        ${isActive ? `<button onclick="downloadPDF('${child.child_id}', '${child.filename}')" class="text-blue-600 hover:text-blue-800" title="Download JO PDF">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                        </button>` : ''}
                        ${deleteBtn}
                    </div>
                </td>
            </tr>${reasonRowHtml}`;
        }).join('');

        const headerBorderColor = group.all_completed ? 'border-green-200' : 'border-slate-200';
        const headerBg = group.all_completed
            ? 'bg-gradient-to-r from-green-50 to-emerald-50'
            : 'bg-gradient-to-r from-slate-50 to-white';

        return `<div class="mb-6 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <!-- Group Header -->
            <div class="px-5 py-4 ${headerBg} border-b ${headerBorderColor}">
                <div class="flex items-center justify-between flex-wrap gap-3">
                    <div class="flex items-center gap-4 min-w-0">
                        <span class="text-sm font-medium text-slate-500">${formattedDate}</span>
                        <span class="px-2.5 py-1 text-xs font-bold rounded-lg bg-indigo-100 text-indigo-800">${group.summary_ref}</span>
                        <span class="text-sm font-semibold text-slate-800 truncate">${group.customer_name || '-'}${group.address ? ' (' + group.address + ')' : ''}</span>
                        <span class="text-xs text-slate-400">|</span>
                        <span class="text-xs text-slate-500"><strong class="text-slate-700">${group.items_count}</strong> items</span>
                        <span class="text-xs text-slate-500"><strong class="text-slate-700">${totalCases}</strong> total cases</span>
                        ${completedBadge}
                    </div>
                    <div class="flex items-center gap-2">
                        ${summaryBtn}
                        ${poBtn}
                        ${piBtn}
                        ${joSummaryBtn}
                        ${allJOsBtn}
                    </div>
                </div>
            </div>
            <!-- JO Table -->
            <table class="min-w-full divide-y divide-slate-100">
                <thead class="bg-slate-50">
                    <tr>
                        ${currentDocScope === 'po' ? '<th class="px-4 py-2.5 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Active</th>' : ''}
                        ${currentDocScope === 'po' ? '' : '<th class="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">JO Reference</th>'}
                        <th class="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Item Code</th>
                        <th class="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Product Name</th>
                        ${currentDocScope === 'po' ? '' : '<th class="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">GTIN</th>'}
                        ${currentDocScope === 'po' ? '<th class="px-4 py-2.5 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Priority</th>' : ''}
                        <th class="px-4 py-2.5 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Cases</th>
                        ${currentDocScope === 'po' ? '' : '<th class="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Batch No</th>'}
                        <th class="px-4 py-2.5 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                    ${childRows}
                </tbody>
            </table>
        </div>`;
    });

    return cards.filter(Boolean).join('');
}

// ============================================================================
// Production Summary (aggregated by item code)
// ============================================================================

function _extractVolume(desc) {
    const m = desc.match(/(\d+(?:\.\d+)?)\s*(ml|l)\b/i);
    if (!m) return null;
    return m[2].toLowerCase() === 'l' ? `${m[1]}L` : `${m[1]}ml`;
}

function _detectType(desc) {
    const d = desc.toLowerCase();
    if (d.includes('can')) return 'can';
    if (d.includes('pet')) return 'pet';
    return null;
}

function buildProductionSummary(groups) {
    const aggregated = {};

    for (const group of groups) {
        const customerName = group.customer_name || 'Unknown Customer';
        const summaryRef = group.summary_ref || '';
        for (const child of group.children) {
            if (child.completed) continue;
            if (child.is_active === false) continue;
            const code = child.item_code || '';
            if (!code) continue;
            const cases = Number(child.cases) || 0;
            const isUrgent = (child.priority || 'normal') === 'urgent';
            if (!aggregated[code]) {
                aggregated[code] = {
                    item_code: code,
                    description: child.description || '-',
                    total_cases: 0,
                    contributions: [],
                    child_ids: [],
                    has_urgent: false,
                    shortages: new Set(),
                };
            }
            aggregated[code].total_cases += cases;
            aggregated[code].child_ids.push(child.child_id);
            if (isUrgent) aggregated[code].has_urgent = true;
            const auto = (child.pending_reason_auto || '').trim();
            if (auto) {
                for (const line of auto.split(/\r?\n/)) {
                    const t = line.trim();
                    if (t && /short\s*rm/i.test(t)) aggregated[code].shortages.add(t);
                }
            }
            aggregated[code].contributions.push({
                customer: customerName,
                jo_reference: child.jo_reference || '-',
                summary_ref: summaryRef,
                cases,
                is_urgent: isUrgent,
                source: 'jo',
            });
        }
    }

    // Add items still waiting in the allocation queue (items returned from a
    // previous JO, or parents not yet activated). These contribute to the
    // total "to be produced" but are flagged as QUEUED so the user can tell
    // them apart from committed JOs.
    for (const row of (allocationQueueRows || [])) {
        if (row.is_active === false) continue;
        const code = row.item_code || '';
        if (!code) continue;
        const cases = Number(row.to_produce || 0) || Number(row.requested || 0) || 0;
        if (cases <= 0) continue;
        const isUrgent = (row.priority || 'normal') === 'urgent';
        if (!aggregated[code]) {
            aggregated[code] = {
                item_code: code,
                description: row.description || '-',
                total_cases: 0,
                contributions: [],
                child_ids: [],
                has_urgent: false,
                shortages: new Set(),
            };
        }
        aggregated[code].total_cases += cases;
        if (isUrgent) aggregated[code].has_urgent = true;
        aggregated[code].contributions.push({
            customer: row.customer || 'Unknown Customer',
            jo_reference: row.jo_number || row.summary_ref || '(allocation)',
            summary_ref: row.summary_ref || '',
            cases,
            is_urgent: isUrgent,
            source: 'alloc',
        });
    }

    const allItems = Object.values(aggregated).sort((a, b) => {
        // RM-short items drop to the bottom of the list.
        const aShort = a.shortages && a.shortages.size > 0;
        const bShort = b.shortages && b.shortages.size > 0;
        if (aShort !== bShort) return aShort ? 1 : -1;
        // Within each partition: urgent first, then by item code.
        if (a.has_urgent !== b.has_urgent) return a.has_urgent ? -1 : 1;
        return a.item_code.localeCompare(b.item_code);
    });
    if (allItems.length === 0) return '';

    // Extract unique volumes from all items for the dropdown
    const volumeSet = new Set();
    for (const it of allItems) {
        const v = _extractVolume(it.description);
        if (v) volumeSet.add(v);
    }
    const volumes = [...volumeSet].sort((a, b) => {
        const na = parseFloat(a);
        const nb = parseFloat(b);
        return na - nb;
    });

    // Apply filters
    let items = allItems;

    if (prodFilterType !== 'all') {
        items = items.filter(it => _detectType(it.description) === prodFilterType);
    }

    if (prodFilterVolume !== 'all') {
        items = items.filter(it => _extractVolume(it.description) === prodFilterVolume);
    }

    if (prodFilterSearch) {
        const s = prodFilterSearch.toLowerCase();
        items = items.filter(it =>
            it.item_code.toLowerCase().includes(s) ||
            it.description.toLowerCase().includes(s) ||
            (it.contributions || []).some(c =>
                (c.customer || '').toLowerCase().includes(s) ||
                (c.jo_reference || '').toLowerCase().includes(s) ||
                (c.summary_ref || '').toLowerCase().includes(s)
            )
        );
    }

    if (prodFilterRM === 'ready') {
        items = items.filter(it => !(it.shortages && it.shortages.size > 0));
    } else if (prodFilterRM === 'short') {
        items = items.filter(it => it.shortages && it.shortages.size > 0);
    }

    const grandTotal = items.reduce((sum, it) => sum + it.total_cases, 0);

    // Build filter bar
    const typeBtnClass = (val) => val === prodFilterType
        ? 'bg-amber-600 text-white shadow-sm'
        : 'bg-white text-slate-700 hover:bg-slate-50';
    const rmBtnClass = (val) => val === prodFilterRM
        ? 'bg-amber-600 text-white shadow-sm'
        : 'bg-white text-slate-700 hover:bg-slate-50';

    const volumeOptions = volumes.map(v =>
        `<option value="${v}" ${v === prodFilterVolume ? 'selected' : ''}>${v}</option>`
    ).join('');

    const filterBarHtml = `
        <div class="px-5 py-3 bg-slate-50 border-b border-amber-200 flex flex-wrap items-center gap-4">
            <div class="flex items-center gap-1.5">
                <span class="text-xs font-medium text-slate-500 mr-1">Type:</span>
                <button onclick="filterProdType('all')" class="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 transition-all ${typeBtnClass('all')}">All</button>
                <button onclick="filterProdType('can')" class="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 transition-all ${typeBtnClass('can')}">Can</button>
                <button onclick="filterProdType('pet')" class="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 transition-all ${typeBtnClass('pet')}">PET</button>
            </div>
            <div class="flex items-center gap-1.5">
                <span class="text-xs font-medium text-slate-500 mr-1">Volume:</span>
                <select onchange="filterProdVolume(this.value)" class="rounded-lg border-slate-300 text-xs py-1.5 px-2 focus:ring-2 focus:ring-amber-400 focus:border-amber-400">
                    <option value="all" ${prodFilterVolume === 'all' ? 'selected' : ''}>All Volumes</option>
                    ${volumeOptions}
                </select>
            </div>
            <div class="flex items-center gap-1.5">
                <span class="text-xs font-medium text-slate-500 mr-1">RM:</span>
                <button onclick="filterProdRM('all')" class="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 transition-all ${rmBtnClass('all')}">All</button>
                <button onclick="filterProdRM('ready')" class="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 transition-all ${rmBtnClass('ready')}">Ready</button>
                <button onclick="filterProdRM('short')" class="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 transition-all ${rmBtnClass('short')}">RM Short</button>
            </div>
            <div class="flex-1 min-w-[180px] max-w-xs">
                <input type="text" placeholder="Search item, product, customer, or JO..."
                    value="${prodFilterSearch.replace(/"/g, '&quot;')}"
                    oninput="filterProdSearchInput(this.value)"
                    class="w-full rounded-lg border-slate-300 text-xs py-1.5 px-3 focus:ring-2 focus:ring-amber-400 focus:border-amber-400" />
            </div>
        </div>`;

    // Build rows
    const rows = items.map(item => {
        const escapedCode = item.item_code.replace(/'/g, "\\'");
        const childIdsJson = JSON.stringify(item.child_ids).replace(/"/g, '&quot;');
        const breakdownLines = item.contributions.map(c => {
            const isAlloc = c.source === 'alloc';
            const joBadgeClass = isAlloc ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-green-50 text-green-700';
            const allocBadge = isAlloc
                ? `<span class="px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-200 text-slate-700" title="Item is still in the Allocation queue — not yet activated into a Job Order">QUEUED</span>`
                : '';
            return `<div class="flex items-center justify-between gap-4 py-0.5">
                <div class="flex items-center gap-2 min-w-0">
                    <span class="text-xs font-semibold text-slate-700 truncate">${c.customer}</span>
                    <span class="px-1.5 py-0.5 text-[10px] font-bold rounded bg-indigo-50 text-indigo-600">${c.summary_ref}</span>
                    <span class="px-1.5 py-0.5 text-[10px] font-semibold rounded ${joBadgeClass}">${c.jo_reference}</span>
                    ${allocBadge}
                    ${c.is_urgent ? `<span class="px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-100 text-red-700 border border-red-200">URGENT</span>` : ''}
                </div>
                <span class="text-xs font-medium text-slate-600 whitespace-nowrap">${Number(c.cases).toLocaleString()} cases</span>
            </div>`;
        }).join('');

        const urgentProductBadge = item.has_urgent
            ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-100 text-red-700 border border-red-200 ml-2 align-middle" title="At least one job order for this product is urgent">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                    URGENT
                </span>`
            : '';
        const shortageList = (item.shortages && item.shortages.size)
            ? [...item.shortages]
            : [];
        const shortageBadge = shortageList.length
            ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-yellow-100 text-yellow-800 border border-yellow-300 ml-2 align-middle cursor-help"
                    title="Raw material shortage:\n${shortageList.join('\n').replace(/"/g, '&quot;')}">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                    RM SHORT
                </span>`
            : '';
        const rowBg = item.has_urgent ? 'bg-red-50/30 hover:bg-red-50/60' : 'hover:bg-slate-50';

        return `<tr class="${rowBg} transition-colors border-b border-slate-100">
            <td class="px-4 py-3 whitespace-nowrap text-xs text-slate-600 font-mono align-top">${item.item_code}</td>
            <td class="px-4 py-3 text-sm text-slate-700 font-medium align-top">${item.description}${urgentProductBadge}${shortageBadge}</td>
            <td class="px-4 py-3">
                <div class="space-y-0.5">${breakdownLines}</div>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-right font-bold text-slate-900 align-top">
                ${Number(item.total_cases).toLocaleString()}
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-center align-top">
                <button onclick="pushToCalculator('${escapedCode}', ${item.total_cases}, JSON.parse(this.dataset.childIds))" data-child-ids="${childIdsJson}"
                    class="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-md text-xs font-semibold transition-colors border border-amber-200" title="Calculate materials for total ${Number(item.total_cases).toLocaleString()} cases">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                    Calculator
                </button>
            </td>
        </tr>`;
    }).join('');

    const noResultsRow = items.length === 0
        ? `<tr><td colspan="5" class="px-6 py-8 text-center text-slate-400">No products match the selected filters</td></tr>`
        : '';

    return `<div class="mb-6 bg-white rounded-xl shadow-sm border-2 border-amber-200 overflow-hidden">
        <div class="px-5 py-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <svg class="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                    <h3 class="text-base font-bold text-slate-900">Total Quantity to be Produced</h3>
                </div>
                <div class="flex items-center gap-3">
                    <span class="text-xs text-slate-500"><strong class="text-slate-700">${items.length}</strong> products</span>
                    <span class="px-3 py-1 text-sm font-bold rounded-lg bg-amber-100 text-amber-800">${Number(grandTotal).toLocaleString()} total cases</span>
                </div>
            </div>
        </div>
        ${filterBarHtml}
        <table class="min-w-full divide-y divide-slate-100">
            <thead class="bg-slate-50">
                <tr>
                    <th class="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Item Code</th>
                    <th class="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Product Name</th>
                    <th class="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Customer / JO Breakdown</th>
                    <th class="px-4 py-2.5 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Total Cases</th>
                    <th class="px-4 py-2.5 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
                ${rows || noResultsRow}
            </tbody>
        </table>
    </div>`;
}

export function updateDocumentStats() {
    const el = document.getElementById('doc-total-count' + _suf());
    if (el) el.textContent = totalGroups;
}

// ============================================================================
// Search (debounced)
// ============================================================================

export function filterDocuments(scope) {
    loadDocumentsPage(scope);
}

export const searchDocuments = debounce(function(scope) {
    loadDocumentsPage(scope);
}, 300);

// ============================================================================
// Production Summary Filters
// ============================================================================

export function filterProdType(type) {
    prodFilterType = type;
    renderDocumentsTable();
}

export function filterProdVolume(volume) {
    prodFilterVolume = volume;
    renderDocumentsTable();
}

export function filterProdRM(val) {
    prodFilterRM = val;
    renderDocumentsTable();
}

const _debouncedProdSearch = debounce(function() {
    renderDocumentsTable();
}, 250);

export function filterProdSearchInput(term) {
    prodFilterSearch = term;
    _debouncedProdSearch();
}

// Stubs kept for app.js compatibility
export function toggleGroup() {}
export function updatePaginationControls() {}
export function loadDocumentsPreviousPage() {}
export function loadDocumentsNextPage() {}

// ============================================================================
// Manual pending reason
// ============================================================================

export async function onStatusActiveToggle(childId, checked, el) {
    if (checked) {
        // Checking an inactive JO under Status just flips the flag (no return flow).
        if (typeof window.setJOStatus === 'function') {
            return window.setJOStatus(childId, 'is_active', true);
        }
        return;
    }
    // Unchecking under Status returns just this item to the parent allocation.
    if (!confirm("Return this item to Allocation? Its stock reservation will be released and it will be removed from the Job Order.")) {
        if (el) el.checked = true;
        return;
    }
    try {
        const resp = await authenticatedFetch(`/api/job-orders/by-pdf/${childId}/return-item`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.detail || `HTTP ${resp.status}`);
        }
        showToast('Item returned to Allocation.', 'success');
        if (typeof window.loadPOStatus === 'function') {
            try { await window.loadPOStatus(); } catch (_) {}
        }
        if (typeof window.loadDocumentsPage === 'function') {
            try { await window.loadDocumentsPage(); } catch (_) {}
        }
        if (typeof window.loadAllocationPending === 'function') {
            try { await window.loadAllocationPending(); } catch (_) {}
        }
    } catch (e) {
        console.error('Return-to-allocation failed:', e);
        showToast('Error: ' + e.message, 'error');
        if (el) el.checked = true;
    }
}

export async function savePendingReason(childId, value) {
    const reason = (value || '').trim();
    // Avoid spamming API when input lost focus without changes — find local state
    const group = allGroups.find(g => (g.children || []).some(c => c.child_id === childId));
    const child = group ? group.children.find(c => c.child_id === childId) : null;
    const prev = child ? (child.pending_reason_manual || '') : '';
    if (prev === reason) return;
    try {
        const resp = await authenticatedFetch(`/api/job-orders/${childId}/pending-reason`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason }),
        });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.detail || 'Save failed');
        }
        if (child) child.pending_reason_manual = reason;
        showToast(reason ? 'Reason saved' : 'Reason cleared', 'success');
    } catch (e) {
        console.error('Pending reason save failed:', e);
        showToast('Failed to save reason: ' + e.message, 'error');
    }
}

// ============================================================================
// PDF Actions
// ============================================================================

export async function downloadPDF(documentId, filename) {
    try {
        const response = await authenticatedFetch(`/api/pdf-documents/${documentId}/download`);
        if (!response.ok) throw new Error('Failed to download PDF');

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const disposition = response.headers.get('Content-Disposition');
        let dlFilename = filename;
        if (disposition) {
            const match = disposition.match(/filename="?([^";\n]+)"?/);
            if (match) dlFilename = match[1];
        }
        const a = document.createElement('a');
        a.href = url;
        a.download = dlFilename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        showToast('PDF downloaded successfully', 'success');
    } catch (error) {
        console.error('Error downloading PDF:', error);
        showToast('Error downloading PDF', 'error');
    }
}

export async function deletePDF(documentId) {
    if (!hasAnyRole(['admin', 'manager'])) {
        showToast('You do not have permission to delete documents', 'error');
        return;
    }

    if (!confirm('Are you sure you want to delete this PDF? This action cannot be undone.')) {
        return;
    }

    try {
        const response = await authenticatedFetch(`/api/pdf-documents/${documentId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete PDF');

        showToast('PDF deleted successfully', 'success');
        loadDocumentsPage();
    } catch (error) {
        console.error('Error deleting PDF:', error);
        showToast('Error deleting PDF', 'error');
    }
}

// ============================================================================
// Download All JOs (merged PDF)
// ============================================================================

export async function downloadAllJOs(summaryRef, childIds) {
    if (!childIds || childIds.length === 0) {
        showToast('No job orders to download', 'error');
        return;
    }

    const filename = `All_JOs_${summaryRef.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
    showToast('Merging job order PDFs...', 'info');

    try {
        const response = await authenticatedFetch('/api/pdf-documents/merge-download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ document_ids: childIds, filename }),
        });

        if (!response.ok) throw new Error('Failed to merge PDFs');

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        showToast('Combined PDF downloaded successfully', 'success');
    } catch (error) {
        console.error('Error downloading merged JOs:', error);
        showToast('Error downloading combined job orders', 'error');
    }
}

// ============================================================================
// JO Completion
// ============================================================================

export async function completeJO(childId, inputId) {
    const resolvedInputId = inputId || `batch-${childId}`;
    const batchInput = document.getElementById(resolvedInputId);
    const batchNumber = batchInput ? batchInput.value.trim() : '';
    try {
        const response = await authenticatedFetch(`/api/job-orders/${childId}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ batch_number: batchNumber }),
        });
        if (!response.ok) throw new Error('Failed to complete job order');

        showToast('Job order marked as completed', 'success');
        loadDocumentsPage();
    } catch (error) {
        console.error('Error completing JO:', error);
        showToast('Error completing job order', 'error');
    }
}

export async function uncompleteJO(childId) {
    try {
        const response = await authenticatedFetch(`/api/job-orders/${childId}/uncomplete`, { method: 'POST' });
        if (!response.ok) throw new Error('Failed to undo completion');

        showToast('Job order completion undone', 'success');
        loadDocumentsPage();
    } catch (error) {
        console.error('Error undoing JO completion:', error);
        showToast('Error undoing completion', 'error');
    }
}

// ============================================================================
// Push to Calculator
// ============================================================================

export function pushToCalculator(itemCode, cases, childIds) {
    if (!itemCode) {
        showToast('No product item code available for this job order', 'error');
        return;
    }
    window._pendingCalcPrefill = { itemCode, cases: cases || 0, childIds: childIds || [] };
    window.switchTab('calculator');
}
