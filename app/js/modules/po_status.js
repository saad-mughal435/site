/**
 * Demo Plant LLC - PO Processing Status sub-tab
 *
 * Purpose-built flat list of active pending Job Orders. Sources data from
 * /api/job-order-groups?status=pending and shows only rows where
 * is_active=true and completed=false. Reuses existing window handlers
 * for priority, reason, and active-toggle.
 */

import { showToast } from '../utils.js?v=20260125h';
import { authenticatedFetch } from '../auth.js?v=20260428b';

let cachedRows = [];
let searchQ = '';
let customerFilter = 'all';
let typeFilter = 'all';      // 'all' | 'can' | 'pet'
let volumeFilter = 'all';    // 'all' | e.g. '300ml' | '2.5L'

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

function _escape(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export async function loadPOStatus() {
    const list = document.getElementById('po-status-list');
    const countEl = document.getElementById('po-status-count');
    if (list) list.innerHTML = '<div class="text-center text-slate-400 py-8">Loading...</div>';
    try {
        const resp = await authenticatedFetch('/api/job-order-groups?status=pending');
        if (!resp.ok) throw new Error('Failed to load status');
        const data = await resp.json();

        cachedRows = [];
        for (const g of (data.groups || [])) {
            for (const c of (g.children || [])) {
                if (c.is_active === false) continue;
                if (c.completed) continue;
                cachedRows.push({
                    child_id: c.child_id,
                    jo_reference: c.jo_reference || '',
                    item_code: c.item_code || '',
                    description: c.description || '',
                    cases: Number(c.cases || 0),
                    priority: (c.priority || 'normal').toLowerCase(),
                    auto_urgent: !!c.auto_urgent,
                    pending_reason_manual: c.pending_reason_manual || '',
                    pending_reason_auto: c.pending_reason_auto || '',
                    filename: c.filename || '',
                    summary_ref: g.summary_ref || '',
                    summary_id: g.summary_id || '',
                    customer_name: g.customer_name || '',
                    group_date: g.date || '',
                    po_filename: g.po_filename || '',
                    local_export_type: g.local_export_type || null,
                });
            }
        }

        cachedRows.sort((a, b) => {
            if (a.priority !== b.priority) return a.priority === 'urgent' ? -1 : 1;
            const ka = `${a.summary_ref}|${a.item_code}`;
            const kb = `${b.summary_ref}|${b.item_code}`;
            return ka.localeCompare(kb);
        });

        if (countEl) countEl.textContent = String(cachedRows.length);
        _refreshCustomerFilter();
        _refreshVolumeFilter();
        _syncTypeButtons();
        _render();
    } catch (e) {
        console.error('loadPOStatus failed:', e);
        if (list) list.innerHTML = '<div class="text-center text-red-500 py-8">Error loading status.</div>';
        showToast('Failed to load status: ' + e.message, 'error');
    }
}

export function onPOStatusSearch() {
    searchQ = (document.getElementById('po-status-search')?.value || '').toLowerCase().trim();
    _render();
}

export function setPOStatusCustomer(value) {
    customerFilter = value || 'all';
    _render();
}

export function setPOStatusType(value) {
    typeFilter = (value || 'all').toLowerCase();
    _syncTypeButtons();
    _render();
}

export function setPOStatusVolume(value) {
    volumeFilter = value || 'all';
    _render();
}

function _syncTypeButtons() {
    for (const t of ['all', 'can', 'pet']) {
        const btn = document.getElementById(`po-status-type-${t}`);
        if (!btn) continue;
        const active = typeFilter === t;
        btn.className = `px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 transition-all ${active ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-700 hover:bg-slate-50'}`;
    }
}

function _refreshCustomerFilter() {
    const sel = document.getElementById('po-status-customer');
    if (!sel) return;
    const names = Array.from(new Set(cachedRows.map(r => r.customer_name).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const prev = customerFilter;
    sel.innerHTML = `<option value="all">All Customers</option>` + names.map(n => `<option value="${_escape(n)}">${_escape(n)}</option>`).join('');
    if (prev !== 'all' && names.includes(prev)) {
        sel.value = prev;
    } else {
        sel.value = 'all';
        customerFilter = 'all';
    }
}

function _refreshVolumeFilter() {
    const sel = document.getElementById('po-status-volume');
    if (!sel) return;
    const volumes = new Set();
    for (const r of cachedRows) {
        const v = _extractVolume(r.description);
        if (v) volumes.add(v);
    }
    const sorted = Array.from(volumes).sort((a, b) => {
        const pa = parseFloat(a), pb = parseFloat(b);
        const ua = /L$/i.test(a) ? 'L' : 'ml', ub = /L$/i.test(b) ? 'L' : 'ml';
        const na = ua === 'L' ? pa * 1000 : pa;
        const nb = ub === 'L' ? pb * 1000 : pb;
        return na - nb;
    });
    const prev = volumeFilter;
    sel.innerHTML = `<option value="all">All Volumes</option>` + sorted.map(v => `<option value="${_escape(v)}">${_escape(v)}</option>`).join('');
    if (prev !== 'all' && sorted.includes(prev)) {
        sel.value = prev;
    } else {
        sel.value = 'all';
        volumeFilter = 'all';
    }
}

function _rowMatches(r, q) {
    if (customerFilter !== 'all' && (r.customer_name || '') !== customerFilter) return false;
    if (typeFilter !== 'all' && _detectType(r.description) !== typeFilter) return false;
    if (volumeFilter !== 'all' && _extractVolume(r.description) !== volumeFilter) return false;
    if (!q) return true;
    return (r.item_code || '').toLowerCase().includes(q)
        || (r.description || '').toLowerCase().includes(q)
        || (r.summary_ref || '').toLowerCase().includes(q)
        || (r.jo_reference || '').toLowerCase().includes(q)
        || (r.customer_name || '').toLowerCase().includes(q);
}

function _renderRow(r) {
    const cid = _escape(r.child_id);
    const isUrgent = r.priority === 'urgent';
    const rowClass = isUrgent ? 'bg-red-50/60' : '';
    const autoReason = r.pending_reason_auto
        ? `<div class="text-[11px] text-red-600 font-medium mb-1">${_escape(r.pending_reason_auto)}</div>`
        : '';
    return `<tr class="${rowClass} border-b border-slate-100 last:border-0 align-top">
        <td class="px-3 py-3 text-center">
            <input type="checkbox" checked
                onchange="onStatusActiveToggle('${cid}', this.checked, this)"
                class="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
        </td>
        <td class="px-3 py-3 whitespace-nowrap">
            <div class="font-mono text-xs text-slate-700">${_escape(r.jo_reference)}</div>
            <div class="text-[11px] text-slate-400">${_escape(r.summary_ref)}</div>
        </td>
        <td class="px-3 py-3">
            <div class="font-mono text-xs text-slate-700">${_escape(r.item_code)}</div>
            <div class="text-xs text-slate-500">${_escape(r.description)}</div>
        </td>
        <td class="px-3 py-3 text-right text-sm font-medium text-slate-700 whitespace-nowrap">${r.cases.toFixed(0)}</td>
        <td class="px-3 py-3 text-center whitespace-nowrap">
            <select onchange="setJOStatus('${cid}', 'priority', this.value)"
                title="${r.auto_urgent && isUrgent ? 'Auto-escalated: RM-short JO is now 10+ days old with RM available' : ''}"
                class="px-2 py-1 border border-slate-300 rounded text-xs font-semibold ${isUrgent ? 'text-red-600 bg-red-50 border-red-300' : 'text-slate-700 bg-white'}">
                <option value="normal" ${!isUrgent ? 'selected' : ''}>Normal</option>
                <option value="urgent" ${isUrgent ? 'selected' : ''}>Urgent</option>
            </select>
            ${r.auto_urgent && isUrgent ? '<div class="text-[9px] font-bold text-red-700 mt-0.5">AUTO</div>' : ''}
        </td>
        <td class="px-3 py-3 min-w-[280px]">
            ${autoReason}
            <input type="text" value="${_escape(r.pending_reason_manual)}"
                placeholder="Add a reason (optional)…"
                onblur="savePendingReason('${cid}', this.value)"
                onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}"
                class="w-full px-2 py-1 text-xs border border-rose-200 bg-white rounded-md text-red-700 placeholder-rose-300 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-rose-400" />
        </td>
    </tr>`;
}

function _formatGroupDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function _renderGroup(rows) {
    const first = rows[0] || {};
    const customer = first.customer_name || '';
    const summaryRef = first.summary_ref || '';
    const dateStr = _formatGroupDate(first.group_date);
    const totalCases = rows.reduce((s, r) => s + (r.cases || 0), 0);
    const urgentCount = rows.filter(r => r.priority === 'urgent').length;
    const urgentBadge = urgentCount
        ? `<span class="ml-2 px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-100 text-red-700">${urgentCount} URGENT</span>`
        : '';
    const poBadge = summaryRef
        ? `<span class="ml-2 px-2 py-0.5 text-[10px] font-semibold rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono">${_escape(summaryRef)}</span>`
        : '';
    const orderType = first.local_export_type || null;
    const orderTypeBadge = summaryRef
        ? (orderType === 'local'
            ? `<span class="ml-2 px-2 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-800 border border-amber-200 cursor-pointer hover:bg-amber-200" title="Click to change order type" onclick="editJOType('${_escape(summaryRef)}', '${orderType}')">LOCAL ✎</span>`
            : (orderType === 'export'
                ? `<span class="ml-2 px-2 py-0.5 text-[10px] font-bold rounded bg-blue-100 text-blue-700 border border-blue-200 cursor-pointer hover:bg-blue-200" title="Click to change order type" onclick="editJOType('${_escape(summaryRef)}', '${orderType}')">EXPORT ✎</span>`
                : `<span class="ml-2 px-2 py-0.5 text-[10px] font-bold rounded bg-slate-200 text-slate-700 border border-slate-300 cursor-pointer hover:bg-slate-300" title="Untyped legacy JO — click to flag" onclick="editJOType('${_escape(summaryRef)}', null)">UNTYPED ✎</span>`))
        : '';
    const dateBadge = dateStr
        ? `<span class="ml-2 px-2 py-0.5 text-[10px] font-semibold rounded bg-slate-200 text-slate-700">${_escape(dateStr)}</span>`
        : '';
    return `<div class="border-b border-slate-200 last:border-b-0">
        <div class="bg-slate-100 px-4 py-2.5 flex items-center justify-between flex-wrap gap-2">
            <div class="flex items-center flex-wrap">
                <h3 class="text-sm font-bold text-slate-800">${_escape(customer) || '(No customer)'}</h3>
                ${poBadge}
                ${orderTypeBadge}
                ${dateBadge}
                ${urgentBadge}
            </div>
            <div class="text-xs text-slate-600">
                <span class="font-semibold">${rows.length}</span> item${rows.length === 1 ? '' : 's'} ·
                <span class="font-semibold">${totalCases.toFixed(0)}</span> cases
            </div>
        </div>
        <table class="min-w-full text-sm">
            <thead class="bg-slate-50">
                <tr>
                    <th class="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 border-b w-12">Active</th>
                    <th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 border-b">JO #</th>
                    <th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 border-b">Item</th>
                    <th class="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 border-b">Cases</th>
                    <th class="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 border-b">Priority</th>
                    <th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 border-b">Pending Reason</th>
                </tr>
            </thead>
            <tbody>${rows.map(_renderRow).join('')}</tbody>
        </table>
    </div>`;
}

function _render() {
    const list = document.getElementById('po-status-list');
    if (!list) return;
    const rows = cachedRows.filter(r => _rowMatches(r, searchQ));
    if (rows.length === 0) {
        list.innerHTML = `<div class="text-center text-slate-400 py-10">
            ${cachedRows.length === 0 ? 'No pending job orders.' : 'No matching rows.'}
        </div>`;
        return;
    }
    // Group by summary_ref so each processed PO shows as its own block,
    // even when multiple POs belong to the same customer.
    const bySummary = new Map();
    for (const r of rows) {
        const key = r.summary_ref || `__no_ref__|${r.customer_name || ''}`;
        if (!bySummary.has(key)) bySummary.set(key, []);
        bySummary.get(key).push(r);
    }
    const groups = Array.from(bySummary.values()).sort((a, b) => {
        const au = a.some(r => r.priority === 'urgent');
        const bu = b.some(r => r.priority === 'urgent');
        if (au !== bu) return au ? -1 : 1;
        // Newest first by date, then fall back to summary_ref.
        const da = new Date((a[0] || {}).group_date || 0).getTime() || 0;
        const db = new Date((b[0] || {}).group_date || 0).getTime() || 0;
        if (da !== db) return db - da;
        return ((a[0] || {}).summary_ref || '').localeCompare((b[0] || {}).summary_ref || '');
    });
    list.innerHTML = groups.map(rs => _renderGroup(rs)).join('');
}
