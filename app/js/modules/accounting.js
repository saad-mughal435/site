/**
 * Demo Plant LLC - Accounting Module
 * Cashbook / AR / AP batch entry with voucher forms, VAT tracking, aging reports
 */

import { showToast, formatNumber } from '../utils.js?v=20260129a';
import { authenticatedFetch, getCurrentUser } from '../auth.js?v=20260428b';

let currentSubTab = 'cashbook';
let glAccounts = [];
let clients = [];
let vendors = [];
let bankAccounts = [];
let cbTrCodes = [];
let projects = [];
let drafts = [];
let voucherLines = [];
let editingDraftId = null;
let currentVoucherIsReceipt = false;

const VOUCHER_TYPES = {
    BPV: { label: 'Bank Payment Voucher', module: 'CB', direction: 'payment' },
    CPV: { label: 'Cash Payment Voucher', module: 'CB', direction: 'payment' },
    TTPV: { label: 'TT Payment Voucher', module: 'CB', direction: 'payment' },
    BRV: { label: 'Bank Receipt Voucher', module: 'CB', direction: 'receipt' },
};

// ============================================================================
// Page Load & Sub-tab Switching
// ============================================================================

export async function loadAccountingPage() {
    await loadLookups();
    switchAccountingSubTab(currentSubTab);
}

export function switchAccountingSubTab(tab) {
    currentSubTab = tab;
    ['cashbook', 'ar', 'ap', 'vat'].forEach(t => {
        const el = document.getElementById(`acct-content-${t}`);
        const btn = document.getElementById(`acct-tab-${t}`);
        if (el) el.classList.toggle('hidden', t !== tab);
        if (btn) {
            btn.classList.toggle('border-blue-600', t === tab);
            btn.classList.toggle('text-blue-600', t === tab);
            btn.classList.toggle('border-transparent', t !== tab);
            btn.classList.toggle('text-slate-500', t !== tab);
        }
    });
    if (tab === 'cashbook') loadCashbookTab();
    else if (tab === 'ar') loadARTab();
    else if (tab === 'ap') loadAPTab();
    else if (tab === 'vat') loadVATTab();
}

async function loadLookups() {
    try {
        const [glRes, clRes, vnRes, baRes, trRes, prRes] = await Promise.all([
            authenticatedFetch('/api/accounting/gl-accounts'),
            authenticatedFetch('/api/accounting/clients'),
            authenticatedFetch('/api/accounting/vendors'),
            authenticatedFetch('/api/accounting/bank-accounts'),
            authenticatedFetch('/api/accounting/cb-tr-codes'),
            authenticatedFetch('/api/accounting/projects'),
        ]);
        const gl = await glRes.json(); glAccounts = gl.accounts || [];
        const cl = await clRes.json(); clients = cl.clients || [];
        const vn = await vnRes.json(); vendors = vn.vendors || [];
        const ba = await baRes.json(); bankAccounts = ba.bank_accounts || [];
        const tr = await trRes.json(); cbTrCodes = tr.tr_codes || [];
        const pr = await prRes.json(); projects = pr.projects || [];
    } catch (e) {
        console.error('Failed to load accounting lookups:', e);
    }
}

// ============================================================================
// Cashbook Tab
// ============================================================================

async function loadCashbookTab() {
    const container = document.getElementById('acct-content-cashbook');
    container.innerHTML = '<div class="text-center py-8 text-slate-400">Loading...</div>';

    const [entriesRes, draftsRes] = await Promise.all([
        authenticatedFetch('/api/accounting/cashbook'),
        authenticatedFetch('/api/accounting/drafts?module=CB'),
    ]);
    const entries = (await entriesRes.json()).entries || [];
    drafts = (await draftsRes.json()).drafts || [];

    container.innerHTML = `
        <div class="flex gap-2 mb-4">
            <button onclick="window.__acctNewVoucher('BPV')" class="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">+ BPV</button>
            <button onclick="window.__acctNewVoucher('CPV')" class="px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">+ CPV</button>
            <button onclick="window.__acctNewVoucher('TTPV')" class="px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700">+ TTPV</button>
            <button onclick="window.__acctNewVoucher('BRV')" class="px-3 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700">+ BRV</button>
        </div>
        ${renderDraftsSection(drafts)}
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div class="p-4 border-b border-slate-200 flex justify-between items-center">
                <h3 class="font-semibold text-slate-800">Recent Cashbook Entries (Sage)</h3>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead class="bg-slate-50 text-slate-600">
                        <tr><th class="p-2 text-left">Date</th><th class="p-2 text-left">Reference</th><th class="p-2 text-left">Description</th><th class="p-2 text-left">Account</th><th class="p-2 text-right">Debit</th><th class="p-2 text-right">Credit</th></tr>
                    </thead>
                    <tbody>${entries.slice(0, 100).map((e, i) => `
                        <tr class="${i % 2 ? 'bg-slate-50' : ''}">
                            <td class="p-2">${e.dTxDate || ''}</td>
                            <td class="p-2 font-mono text-xs">${e.cReference || ''}</td>
                            <td class="p-2">${e.cDescription || ''}</td>
                            <td class="p-2">${e.Account || ''} ${e.AccountName ? '- ' + e.AccountName : ''}</td>
                            <td class="p-2 text-right">${e.fDebit ? formatNumber(e.fDebit) : ''}</td>
                            <td class="p-2 text-right">${e.fCredit ? formatNumber(e.fCredit) : ''}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

}

// ============================================================================
// AR Tab
// ============================================================================

async function loadARTab() {
    const container = document.getElementById('acct-content-ar');
    container.innerHTML = '<div class="text-center py-8 text-slate-400">Loading...</div>';

    const [entriesRes, draftsRes] = await Promise.all([
        authenticatedFetch('/api/accounting/ar'),
        authenticatedFetch('/api/accounting/drafts?module=AR'),
    ]);
    const entries = (await entriesRes.json()).entries || [];
    drafts = (await draftsRes.json()).drafts || [];

    container.innerHTML = `
        <div class="flex gap-2 mb-4">
            <button onclick="window.__acctNewAREntry()" class="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">+ New AR Entry</button>
        </div>
        ${renderDraftsSection(drafts)}
        <details class="mb-4">
            <summary class="cursor-pointer text-sm font-semibold text-slate-700 bg-slate-50 p-3 rounded-lg">Aging Report (AR)</summary>
            <div id="acct-aging-ar" class="mt-2"><div class="text-slate-400 text-sm p-4">Click to load...</div></div>
        </details>
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div class="p-4 border-b border-slate-200"><h3 class="font-semibold text-slate-800">Recent AR Entries (Sage)</h3></div>
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead class="bg-slate-50 text-slate-600">
                        <tr><th class="p-2 text-left">Date</th><th class="p-2 text-left">Customer</th><th class="p-2 text-left">Reference</th><th class="p-2 text-left">Description</th><th class="p-2 text-right">Debit</th><th class="p-2 text-right">Credit</th><th class="p-2 text-right">Outstanding</th></tr>
                    </thead>
                    <tbody>${entries.slice(0, 100).map((e, i) => `
                        <tr class="${i % 2 ? 'bg-slate-50' : ''}">
                            <td class="p-2">${e.TxDate || ''}</td>
                            <td class="p-2">${e.ClientName || ''}</td>
                            <td class="p-2 font-mono text-xs">${e.Reference || ''}</td>
                            <td class="p-2">${e.Description || ''}</td>
                            <td class="p-2 text-right">${e.Debit ? formatNumber(e.Debit) : ''}</td>
                            <td class="p-2 text-right">${e.Credit ? formatNumber(e.Credit) : ''}</td>
                            <td class="p-2 text-right font-semibold">${e.Outstanding ? formatNumber(e.Outstanding) : ''}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    document.getElementById('acct-aging-ar')?.closest('details')?.addEventListener('toggle', async function() {
        if (this.open) {
            const el = document.getElementById('acct-aging-ar');
            el.innerHTML = '<div class="text-slate-400 text-sm p-4">Loading...</div>';
            try {
                const res = await authenticatedFetch('/api/accounting/aging/ar');
                const data = await res.json();
                el.innerHTML = renderAgingTable(data.aging || []);
            } catch { el.innerHTML = '<div class="text-red-500 p-4">Failed to load</div>'; }
        }
    });
}

// ============================================================================
// AP Tab
// ============================================================================

async function loadAPTab() {
    const container = document.getElementById('acct-content-ap');
    container.innerHTML = '<div class="text-center py-8 text-slate-400">Loading...</div>';

    const [entriesRes, draftsRes] = await Promise.all([
        authenticatedFetch('/api/accounting/ap'),
        authenticatedFetch('/api/accounting/drafts?module=AP'),
    ]);
    const entries = (await entriesRes.json()).entries || [];
    drafts = (await draftsRes.json()).drafts || [];

    container.innerHTML = `
        <div class="flex gap-2 mb-4">
            <button onclick="window.__acctNewAPEntry()" class="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">+ New AP Entry</button>
        </div>
        ${renderDraftsSection(drafts)}
        <details class="mb-4">
            <summary class="cursor-pointer text-sm font-semibold text-slate-700 bg-slate-50 p-3 rounded-lg">Aging Report (AP)</summary>
            <div id="acct-aging-ap" class="mt-2"><div class="text-slate-400 text-sm p-4">Click to load...</div></div>
        </details>
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div class="p-4 border-b border-slate-200"><h3 class="font-semibold text-slate-800">Recent AP Entries (Sage)</h3></div>
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead class="bg-slate-50 text-slate-600">
                        <tr><th class="p-2 text-left">Date</th><th class="p-2 text-left">Supplier</th><th class="p-2 text-left">Reference</th><th class="p-2 text-left">Description</th><th class="p-2 text-right">Debit</th><th class="p-2 text-right">Credit</th><th class="p-2 text-right">Outstanding</th></tr>
                    </thead>
                    <tbody>${entries.slice(0, 100).map((e, i) => `
                        <tr class="${i % 2 ? 'bg-slate-50' : ''}">
                            <td class="p-2">${e.TxDate || ''}</td>
                            <td class="p-2">${e.VendorName || ''}</td>
                            <td class="p-2 font-mono text-xs">${e.Reference || ''}</td>
                            <td class="p-2">${e.Description || ''}</td>
                            <td class="p-2 text-right">${e.Debit ? formatNumber(e.Debit) : ''}</td>
                            <td class="p-2 text-right">${e.Credit ? formatNumber(e.Credit) : ''}</td>
                            <td class="p-2 text-right font-semibold">${e.Outstanding ? formatNumber(e.Outstanding) : ''}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    document.getElementById('acct-aging-ap')?.closest('details')?.addEventListener('toggle', async function() {
        if (this.open) {
            const el = document.getElementById('acct-aging-ap');
            el.innerHTML = '<div class="text-slate-400 text-sm p-4">Loading...</div>';
            try {
                const res = await authenticatedFetch('/api/accounting/aging/ap');
                const data = await res.json();
                el.innerHTML = renderAgingTable(data.aging || []);
            } catch { el.innerHTML = '<div class="text-red-500 p-4">Failed to load</div>'; }
        }
    });
}

// ============================================================================
// VAT Tab
// ============================================================================

async function loadVATTab() {
    const container = document.getElementById('acct-content-vat');
    container.innerHTML = `
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 class="font-semibold text-slate-800 mb-4">VAT Reporting</h3>
            <div class="flex flex-wrap gap-4 items-end mb-6">
                <div>
                    <label class="text-xs text-slate-500 block mb-1">From Date</label>
                    <input type="date" id="vat-date-from" class="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                    <label class="text-xs text-slate-500 block mb-1">To Date</label>
                    <input type="date" id="vat-date-to" class="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <button onclick="window.__acctLoadVATSummary()" class="px-4 py-2 bg-slate-700 text-white text-sm rounded-lg hover:bg-slate-800">Load Summary</button>
                <button onclick="window.__acctDownloadVATExcel()" class="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">Download Excel</button>
                <button onclick="window.__acctDownloadVATReport()" class="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700">Download PDF Report</button>
            </div>
            <div id="vat-summary-content"></div>
        </div>
    `;
}

// ============================================================================
// Drafts Section Renderer
// ============================================================================

function renderDraftsSection(draftsList) {
    if (!draftsList.length) return '<div class="text-slate-400 text-sm mb-4 p-3 bg-slate-50 rounded-lg">No draft batches</div>';

    const statusColor = {
        draft: 'bg-yellow-100 text-yellow-800',
        posted: 'bg-blue-100 text-blue-800',
        rejected: 'bg-red-100 text-red-800',
    };
    return `<div class="bg-white rounded-xl shadow-sm border border-slate-200 mb-4 overflow-hidden">
        <div class="p-4 border-b border-slate-200"><h3 class="font-semibold text-slate-800">Draft Batches</h3></div>
        <div class="divide-y divide-slate-100">
            ${draftsList.map(d => {
                const sageBadge = d.sage_batch_no
                    ? `<span class="font-mono text-[10px] text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded">${d.sage_batch_no}</span>`
                    : '';
                const rejectionNote = d.status === 'rejected' && d.rejection_reason
                    ? `<span class="text-xs text-red-500 ml-2" title="${d.rejection_reason}">Reason: ${d.rejection_reason}</span>`
                    : '';
                const pendingNote = d.status === 'draft'
                    ? '<span class="text-xs text-amber-600 ml-1">Pending admin approval</span>'
                    : '';

                return `
                <div class="p-3 flex items-center justify-between hover:bg-slate-50">
                    <div class="flex items-center gap-3">
                        <span class="px-2 py-0.5 text-xs font-semibold rounded ${statusColor[d.status] || 'bg-slate-100'}">${d.status}</span>
                        ${sageBadge}
                        <span class="font-mono text-sm font-semibold">${d.voucher_no || d.voucher_type || 'Entry'}</span>
                        <span class="text-sm text-slate-500">${d.date || ''}</span>
                        <span class="text-sm text-slate-500">${d.paid_to_or_received_from || d.being || ''}</span>
                        <span class="text-sm font-semibold">${formatNumber(d.total_debit || 0)}</span>
                        ${pendingNote}${rejectionNote}
                    </div>
                    <div class="flex gap-2">
                        <button onclick="window.__acctViewDraft('${d._id}')" class="text-xs px-2 py-1 bg-slate-100 rounded hover:bg-slate-200">View</button>
                        <button onclick="window.__acctVoucherPDF('${d._id}')" class="text-xs px-2 py-1 bg-slate-100 rounded hover:bg-slate-200">PDF</button>
                        ${d.status === 'draft' ? `<button onclick="window.__acctEditDraft('${d._id}')" class="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">Edit</button>
                        <button onclick="window.__acctDeleteDraft('${d._id}')" class="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200">Delete</button>` : ''}
                    </div>
                </div>`;
            }).join('')}
        </div>
    </div>`;
}

// ============================================================================
// Aging Table
// ============================================================================

function renderAgingTable(rows) {
    if (!rows.length) return '<div class="text-slate-400 text-sm p-4">No aging data</div>';
    const cols = Object.keys(rows[0]);
    return `<div class="overflow-x-auto"><table class="w-full text-sm">
        <thead class="bg-slate-50"><tr>${cols.map(c => `<th class="p-2 text-left text-xs">${c}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((r, i) => `<tr class="${i % 2 ? 'bg-slate-50' : ''}">${cols.map(c => {
            const v = r[c];
            const isNum = typeof v === 'number';
            return `<td class="p-2 ${isNum ? 'text-right' : ''}">${isNum ? formatNumber(v) : (v || '')}</td>`;
        }).join('')}</tr>`).join('')}</tbody>
    </table></div>`;
}

// ============================================================================
// Voucher Modal
// ============================================================================

function openVoucherModal(voucherType, module, existingData = null) {
    editingDraftId = existingData?._id || null;
    voucherLines = existingData?.lines || [];
    const isReceipt = voucherType === 'BRV';
    currentVoucherIsReceipt = isReceipt;
    const vtInfo = VOUCHER_TYPES[voucherType] || {};
    const data = existingData || {};

    // Backward compat: ensure all lines have per-entry fields
    for (const line of voucherLines) {
        if (line.paid_to === undefined) line.paid_to = '';
        if (line.being === undefined) line.being = '';
        if (line.invoice_no === undefined) line.invoice_no = '';
        if (line.grn_no === undefined) line.grn_no = '';
        if (line.po_no === undefined) line.po_no = '';
        if (line.project_id === undefined) line.project_id = '';
        if (line.project_name === undefined) line.project_name = '';
    }
    if (voucherLines.length > 0) {
        const first = voucherLines[0];
        if (!first.paid_to && data.paid_to_or_received_from) first.paid_to = data.paid_to_or_received_from;
        if (!first.being && data.being) first.being = data.being;
        if (!first.invoice_no && data.invoice_no) first.invoice_no = data.invoice_no;
        if (!first.grn_no && data.grn_no) first.grn_no = data.grn_no;
        if (!first.po_no && data.po_no) first.po_no = data.po_no;
        if (!first.project_id && data.project_id) {
            first.project_id = data.project_id;
            first.project_name = data.project_name || '';
        }
    }

    const bankOptions = bankAccounts.map(b => `<option value="${b.AccountLink}" ${data.bank_account_link == b.AccountLink ? 'selected' : ''}>${b.Master_Sub_Account} - ${b.Description}</option>`).join('');
    const trOptions = cbTrCodes.map(t => `<option value="${t.idTrCodes}" ${data.tr_code_id == t.idTrCodes ? 'selected' : ''}>${t.Code} - ${t.Description}</option>`).join('');

    const modal = document.getElementById('acct-voucher-modal');
    const content = document.getElementById('acct-voucher-modal-content');

    content.innerHTML = `
        <div class="p-6">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-lg font-bold text-slate-800">${vtInfo.label || voucherType}</h2>
                <button onclick="window.__acctCloseModal()" class="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                <div>
                    <label class="text-xs text-slate-500 block mb-1">${voucherType} #</label>
                    <input type="text" id="v-voucher-no" value="${data.voucher_no || ''}" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="${voucherType}#001" />
                </div>
                <div>
                    <label class="text-xs text-slate-500 block mb-1">Date</label>
                    <input type="date" id="v-date" value="${data.date || new Date().toISOString().slice(0, 10)}" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                ${module === 'CB' ? `
                <div>
                    <label class="text-xs text-slate-500 block mb-1">Bank Account</label>
                    <select id="v-bank" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"><option value="">Select...</option>${bankOptions}</select>
                </div>
                <div>
                    <label class="text-xs text-slate-500 block mb-1">Transaction Code</label>
                    <select id="v-trcode" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"><option value="">Select...</option>${trOptions}</select>
                </div>` : ''}
                <div>
                    <label class="text-xs text-slate-500 block mb-1">Currency</label>
                    <select id="v-currency" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                        <option value="AED" ${(data.currency || 'AED') === 'AED' ? 'selected' : ''}>AED</option>
                        <option value="USD" ${data.currency === 'USD' ? 'selected' : ''}>USD</option>
                        <option value="EUR" ${data.currency === 'EUR' ? 'selected' : ''}>EUR</option>
                        <option value="GBP" ${data.currency === 'GBP' ? 'selected' : ''}>GBP</option>
                    </select>
                </div>
                <div>
                    <label class="text-xs text-slate-500 block mb-1">Exchange Rate</label>
                    <input type="number" step="0.0001" id="v-rate" value="${data.exchange_rate || 1}" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
            </div>
            <input type="hidden" id="v-type" value="${voucherType}" />
            <input type="hidden" id="v-module" value="${module}" />

            <h3 class="font-semibold text-sm text-slate-700 mb-2">Entries</h3>
            <div id="v-lines-body" class="space-y-3 mb-2"></div>
            <button onclick="window.__acctAddLine()" class="text-sm text-blue-600 hover:text-blue-800 mb-3">+ Add Entry</button>

            <div class="flex items-center gap-4 bg-slate-100 rounded-lg px-4 py-2 mb-4">
                <span class="text-sm font-semibold text-slate-700">Total</span>
                <span class="ml-auto text-sm">Debit: <strong id="v-total-debit">0.00</strong></span>
                <span class="text-sm">Credit: <strong id="v-total-credit">0.00</strong></span>
                <span id="v-balance-badge"></span>
            </div>

            <div class="mb-4">
                <h3 class="font-semibold text-sm text-slate-700 mb-2">Supporting Documents</h3>
                <div id="v-files-list" class="flex flex-wrap gap-2 mb-2"></div>
                <input type="file" id="v-file-input" accept=".pdf,.jpg,.jpeg,.png" class="text-sm" multiple />
            </div>

            <div class="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button onclick="window.__acctCloseModal()" class="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancel</button>
                <button onclick="window.__acctSaveDraft()" id="v-save-btn" class="px-6 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">Save Draft</button>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');
    renderVoucherLines();
    if (voucherLines.length === 0) addVoucherLine();
    loadExistingFiles(editingDraftId);
}

function addVoucherLine() {
    voucherLines.push({
        paid_to: '', being: '', invoice_no: '', grn_no: '', po_no: '',
        project_id: '', project_name: '',
        account_link: '', account_code: '', account_name: '',
        description: '', debit: 0, credit: 0, is_vat: false, vat_category: null,
    });
    renderVoucherLines();
}

function removeVoucherLine(idx) {
    voucherLines.splice(idx, 1);
    renderVoucherLines();
}

function renderVoucherLines() {
    const container = document.getElementById('v-lines-body');
    if (!container) return;

    const isReceipt = currentVoucherIsReceipt;
    const accountOptions = glAccounts.map(a =>
        `<option value="${a.AccountLink}" data-code="${a.Master_Sub_Account}" data-name="${a.Description}">${a.Master_Sub_Account} - ${a.Description}</option>`
    ).join('');
    const projOptions = projects.map(p =>
        `<option value="${p.ProjectLink}">${p.ProjectCode} - ${p.ProjectName || ''}</option>`
    ).join('');

    container.innerHTML = voucherLines.map((line, idx) => `
        <div class="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
            <div class="flex justify-between items-center mb-2">
                <span class="text-xs font-semibold text-slate-400">Entry ${idx + 1}</span>
                <button onclick="window.__acctRemoveLine(${idx})" class="text-red-400 hover:text-red-600 text-lg leading-none">&times;</button>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-3 ${!isReceipt ? 'lg:grid-cols-6' : 'lg:grid-cols-3'} gap-2 mb-2">
                <div>
                    <label class="text-[10px] text-slate-400 block mb-0.5">${isReceipt ? 'Received From' : 'Paid To'}</label>
                    <input type="text" value="${line.paid_to || ''}" onchange="window.__acctLineFieldChange(${idx}, 'paid_to', this.value)" class="w-full border border-slate-300 rounded px-2 py-1.5 text-xs" />
                </div>
                <div>
                    <label class="text-[10px] text-slate-400 block mb-0.5">Being</label>
                    <input type="text" value="${line.being || ''}" onchange="window.__acctLineFieldChange(${idx}, 'being', this.value)" class="w-full border border-slate-300 rounded px-2 py-1.5 text-xs" />
                </div>
                ${!isReceipt ? `
                <div>
                    <label class="text-[10px] text-slate-400 block mb-0.5">Invoice No</label>
                    <input type="text" value="${line.invoice_no || ''}" onchange="window.__acctLineFieldChange(${idx}, 'invoice_no', this.value)" class="w-full border border-slate-300 rounded px-2 py-1.5 text-xs" />
                </div>
                <div>
                    <label class="text-[10px] text-slate-400 block mb-0.5">GRN No</label>
                    <input type="text" value="${line.grn_no || ''}" onchange="window.__acctLineFieldChange(${idx}, 'grn_no', this.value)" class="w-full border border-slate-300 rounded px-2 py-1.5 text-xs" />
                </div>
                <div>
                    <label class="text-[10px] text-slate-400 block mb-0.5">PO No</label>
                    <input type="text" value="${line.po_no || ''}" onchange="window.__acctLineFieldChange(${idx}, 'po_no', this.value)" class="w-full border border-slate-300 rounded px-2 py-1.5 text-xs" />
                </div>` : ''}
                <div>
                    <label class="text-[10px] text-slate-400 block mb-0.5">Project</label>
                    <select data-field="project" onchange="window.__acctLineProjChange(${idx}, this)" class="w-full border border-slate-300 rounded px-2 py-1.5 text-xs">
                        <option value="">None</option>
                        ${projOptions}
                    </select>
                </div>
            </div>
            <div class="grid grid-cols-12 gap-2 items-end">
                <div class="col-span-4">
                    <label class="text-[10px] text-slate-400 block mb-0.5">A/C Code</label>
                    <select data-field="account" onchange="window.__acctLineAcctChange(${idx}, this)" class="w-full border border-slate-300 rounded px-2 py-1.5 text-xs">
                        <option value="">Select account...</option>
                        ${accountOptions}
                    </select>
                </div>
                <div class="col-span-3">
                    <label class="text-[10px] text-slate-400 block mb-0.5">Description</label>
                    <input type="text" value="${line.description || ''}" onchange="window.__acctLineFieldChange(${idx}, 'description', this.value)" class="w-full border border-slate-300 rounded px-2 py-1.5 text-xs" />
                </div>
                <div class="col-span-2">
                    <label class="text-[10px] text-slate-400 block mb-0.5">Debit</label>
                    <input type="number" step="0.01" min="0" value="${line.debit || ''}" onchange="window.__acctLineFieldChange(${idx}, 'debit', parseFloat(this.value)||0)" class="w-full border border-slate-300 rounded px-2 py-1.5 text-xs text-right" />
                </div>
                <div class="col-span-2">
                    <label class="text-[10px] text-slate-400 block mb-0.5">Credit</label>
                    <input type="number" step="0.01" min="0" value="${line.credit || ''}" onchange="window.__acctLineFieldChange(${idx}, 'credit', parseFloat(this.value)||0)" class="w-full border border-slate-300 rounded px-2 py-1.5 text-xs text-right" />
                </div>
                <div class="col-span-1 flex items-end justify-center pb-1">
                    <label class="flex items-center gap-1 text-[10px] text-slate-400 cursor-pointer">
                        <input type="checkbox" ${line.is_vat ? 'checked' : ''} onchange="window.__acctLineFieldChange(${idx}, 'is_vat', this.checked)" class="rounded" />
                        VAT
                    </label>
                </div>
            </div>
        </div>
    `).join('');

    voucherLines.forEach((line, idx) => {
        const entryEl = container.children[idx];
        if (!entryEl) return;
        if (line.account_link) {
            const acctSel = entryEl.querySelector('[data-field="account"]');
            if (acctSel) acctSel.value = line.account_link;
        }
        if (line.project_id) {
            const projSel = entryEl.querySelector('[data-field="project"]');
            if (projSel) projSel.value = line.project_id;
        }
    });

    updateVoucherTotals();
}

function updateVoucherTotals() {
    const totalDebit = voucherLines.reduce((s, l) => s + (l.debit || 0), 0);
    const totalCredit = voucherLines.reduce((s, l) => s + (l.credit || 0), 0);
    const diff = Math.abs(totalDebit - totalCredit);

    const el_d = document.getElementById('v-total-debit');
    const el_c = document.getElementById('v-total-credit');
    const badge = document.getElementById('v-balance-badge');
    if (el_d) el_d.textContent = totalDebit.toFixed(2);
    if (el_c) el_c.textContent = totalCredit.toFixed(2);
    if (badge) badge.innerHTML = diff < 0.01
        ? '<span class="text-green-600 text-xs font-bold">Balanced</span>'
        : `<span class="text-red-600 text-xs font-bold">Diff: ${diff.toFixed(2)}</span>`;
}

async function loadExistingFiles(draftId) {
    const container = document.getElementById('v-files-list');
    if (!container || !draftId) return;
    try {
        const res = await authenticatedFetch(`/api/accounting/drafts/${draftId}/files`);
        const data = await res.json();
        container.innerHTML = (data.files || []).map(f =>
            `<div class="flex items-center gap-1 bg-slate-100 rounded px-2 py-1 text-xs">
                <a href="/api/accounting/files/${f._id}" target="_blank" class="text-blue-600 hover:underline">${f.filename}</a>
                <button onclick="window.__acctDeleteFile('${f._id}')" class="text-red-400 hover:text-red-600 ml-1">&times;</button>
            </div>`
        ).join('');
    } catch { /* ignore */ }
}

// ============================================================================
// Save / CRUD Actions
// ============================================================================

async function saveDraft() {
    const voucherType = document.getElementById('v-type')?.value;
    const module = document.getElementById('v-module')?.value;
    const voucherNo = document.getElementById('v-voucher-no')?.value;
    const date = document.getElementById('v-date')?.value;
    const bankEl = document.getElementById('v-bank');
    const trEl = document.getElementById('v-trcode');

    const bankLink = bankEl ? parseInt(bankEl.value) || null : null;
    const bankName = bankEl ? bankEl.options[bankEl.selectedIndex]?.text || '' : '';
    const trCodeId = trEl ? parseInt(trEl.value) || null : null;

    const validLines = voucherLines.filter(l => l.account_link);
    const firstLine = validLines[0] || {};

    const payload = {
        voucher_type: voucherType,
        module: module,
        voucher_no: voucherNo,
        date: date,
        paid_to_or_received_from: firstLine.paid_to || '',
        being: firstLine.being || '',
        bank_account_link: bankLink,
        bank_account_name: bankName,
        tr_code_id: trCodeId,
        invoice_no: firstLine.invoice_no || '',
        grn_no: firstLine.grn_no || '',
        po_no: firstLine.po_no || '',
        project_id: firstLine.project_id ? parseInt(firstLine.project_id) : null,
        project_name: firstLine.project_name || '',
        currency: document.getElementById('v-currency')?.value || 'AED',
        exchange_rate: parseFloat(document.getElementById('v-rate')?.value) || 1,
        lines: validLines,
    };

    try {
        let res;
        if (editingDraftId) {
            res = await authenticatedFetch(`/api/accounting/drafts/${editingDraftId}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
        } else {
            res = await authenticatedFetch('/api/accounting/drafts', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
        }
        const data = await res.json();
        if (!res.ok) {
            showToast(data.detail || 'Failed to save', 'error');
            return;
        }

        const draftId = data.draft?._id || editingDraftId;
        const fileInput = document.getElementById('v-file-input');
        if (fileInput?.files?.length && draftId) {
            for (const file of fileInput.files) {
                const fd = new FormData();
                fd.append('file', file);
                await authenticatedFetch(`/api/accounting/drafts/${draftId}/files`, { method: 'POST', body: fd });
            }
        }

        showToast(editingDraftId ? 'Draft updated' : 'Draft saved', 'success');
        closeModal();
        switchAccountingSubTab(currentSubTab);
    } catch (e) {
        showToast('Error saving: ' + e.message, 'error');
    }
}

function closeModal() {
    document.getElementById('acct-voucher-modal')?.classList.add('hidden');
    editingDraftId = null;
    voucherLines = [];
}

async function viewDraft(id) {
    try {
        const res = await authenticatedFetch(`/api/accounting/drafts/${id}`);
        const data = await res.json();
        if (data.draft) {
            openVoucherModal(data.draft.voucher_type || 'BPV', data.draft.module || 'CB', data.draft);
        }
    } catch (e) {
        showToast('Failed to load draft', 'error');
    }
}

async function editDraft(id) {
    await viewDraft(id);
}

async function deleteDraft(id) {
    if (!confirm('Delete this draft?')) return;
    try {
        await authenticatedFetch(`/api/accounting/drafts/${id}`, { method: 'DELETE' });
        showToast('Draft deleted', 'success');
        switchAccountingSubTab(currentSubTab);
    } catch (e) {
        showToast('Failed to delete', 'error');
    }
}

function openVoucherPDF(id) {
    window.open(`/api/accounting/drafts/${id}/voucher-pdf`, '_blank');
}

async function deleteFile(fileId) {
    await authenticatedFetch(`/api/accounting/files/${fileId}`, { method: 'DELETE' });
    loadExistingFiles(editingDraftId);
}

// ============================================================================
// AR/AP Entry helpers
// ============================================================================

function newAREntry() {
    voucherLines = [];
    editingDraftId = null;
    openGenericEntryModal('AR', 'AR Entry', clients, 'Client');
}

function newAPEntry() {
    voucherLines = [];
    editingDraftId = null;
    openGenericEntryModal('AP', 'AP Entry', vendors, 'Vendor');
}

function openGenericEntryModal(module, title, entityList, entityLabel) {
    const entityOptions = entityList.map(e => `<option value="${e.DCLink}">${e.Account} - ${e.Name}</option>`).join('');
    const projOptions = projects.map(p => `<option value="${p.ProjectLink}">${p.ProjectCode} - ${p.ProjectName || ''}</option>`).join('');
    const accountOptions = glAccounts.map(a => `<option value="${a.AccountLink}" data-code="${a.Master_Sub_Account}" data-name="${a.Description}">${a.Master_Sub_Account} - ${a.Description}</option>`).join('');

    const modal = document.getElementById('acct-voucher-modal');
    const content = document.getElementById('acct-voucher-modal-content');

    content.innerHTML = `
        <div class="p-6">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-lg font-bold text-slate-800">${title}</h2>
                <button onclick="window.__acctCloseModal()" class="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div>
                    <label class="text-xs text-slate-500 block mb-1">${entityLabel}</label>
                    <select id="v-entity" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"><option value="">Select...</option>${entityOptions}</select>
                </div>
                <div>
                    <label class="text-xs text-slate-500 block mb-1">Date</label>
                    <input type="date" id="v-date" value="${new Date().toISOString().slice(0, 10)}" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                    <label class="text-xs text-slate-500 block mb-1">Reference</label>
                    <input type="text" id="v-voucher-no" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                    <label class="text-xs text-slate-500 block mb-1">Description</label>
                    <input type="text" id="v-being" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                    <label class="text-xs text-slate-500 block mb-1">Project</label>
                    <select id="v-project" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"><option value="">None</option>${projOptions}</select>
                </div>
                <div>
                    <label class="text-xs text-slate-500 block mb-1">Currency</label>
                    <select id="v-currency" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                        <option value="AED" selected>AED</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option>
                    </select>
                </div>
                <div>
                    <label class="text-xs text-slate-500 block mb-1">Exchange Rate</label>
                    <input type="number" step="0.0001" id="v-rate" value="1" class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
            </div>
            <input type="hidden" id="v-type" value="${module === 'AR' ? 'AR' : 'AP'}" />
            <input type="hidden" id="v-module" value="${module}" />

            <h3 class="font-semibold text-sm text-slate-700 mb-2">Line Items</h3>
            <div class="overflow-x-auto mb-2">
                <table class="w-full text-sm">
                    <thead class="bg-slate-50">
                        <tr><th class="p-2 text-left w-48">A/C Code</th><th class="p-2 text-left">Description</th><th class="p-2 text-right w-28">Debit</th><th class="p-2 text-right w-28">Credit</th><th class="p-2 text-center w-14">VAT</th><th class="p-2 w-10"></th></tr>
                    </thead>
                    <tbody id="v-lines-body"></tbody>
                    <tfoot>
                        <tr class="bg-slate-100 font-semibold">
                            <td class="p-2" colspan="2">Total</td>
                            <td class="p-2 text-right" id="v-total-debit">0.00</td>
                            <td class="p-2 text-right" id="v-total-credit">0.00</td>
                            <td class="p-2 text-center" id="v-balance-badge"></td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            <button onclick="window.__acctAddLine()" class="text-sm text-blue-600 hover:text-blue-800 mb-4">+ Add Line</button>

            <div class="mb-4">
                <h3 class="font-semibold text-sm text-slate-700 mb-2">Supporting Documents</h3>
                <div id="v-files-list" class="flex flex-wrap gap-2 mb-2"></div>
                <input type="file" id="v-file-input" accept=".pdf,.jpg,.jpeg,.png" class="text-sm" multiple />
            </div>

            <div class="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button onclick="window.__acctCloseModal()" class="px-4 py-2 text-sm text-slate-600">Cancel</button>
                <button onclick="window.__acctSaveGenericDraft('${module}')" class="px-6 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">Save Draft</button>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');
    renderVoucherLines();
    if (voucherLines.length === 0) addVoucherLine();
}

async function saveGenericDraft(module) {
    const entityEl = document.getElementById('v-entity');
    const entityName = entityEl ? entityEl.options[entityEl.selectedIndex]?.text || '' : '';
    const projEl = document.getElementById('v-project');

    const payload = {
        voucher_type: module,
        module: module,
        voucher_no: document.getElementById('v-voucher-no')?.value || '',
        date: document.getElementById('v-date')?.value || '',
        paid_to_or_received_from: entityName,
        being: document.getElementById('v-being')?.value || '',
        project_id: projEl ? parseInt(projEl.value) || null : null,
        project_name: projEl ? projEl.options[projEl.selectedIndex]?.text || '' : '',
        currency: document.getElementById('v-currency')?.value || 'AED',
        exchange_rate: parseFloat(document.getElementById('v-rate')?.value) || 1,
        lines: voucherLines.filter(l => l.account_link),
    };

    try {
        const res = await authenticatedFetch('/api/accounting/drafts', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) {
            showToast(data.detail || 'Failed to save', 'error');
            return;
        }
        const draftId = data.draft?._id;
        const fileInput = document.getElementById('v-file-input');
        if (fileInput?.files?.length && draftId) {
            for (const file of fileInput.files) {
                const fd = new FormData();
                fd.append('file', file);
                await authenticatedFetch(`/api/accounting/drafts/${draftId}/files`, { method: 'POST', body: fd });
            }
        }
        showToast('Draft saved', 'success');
        closeModal();
        switchAccountingSubTab(currentSubTab);
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

// ============================================================================
// VAT Actions
// ============================================================================

async function loadVATSummary() {
    const from = document.getElementById('vat-date-from')?.value || '';
    const to = document.getElementById('vat-date-to')?.value || '';
    const container = document.getElementById('vat-summary-content');
    container.innerHTML = '<div class="text-slate-400 py-4">Loading...</div>';
    try {
        const res = await authenticatedFetch(`/api/accounting/vat/summary?date_from=${from}&date_to=${to}`);
        const data = await res.json();
        const summary = data.summary || {};
        const boxLabels = { box1: 'Std Rated Sales (Box 1)', box3: 'Import of Services (Box 3)', box9: 'Std Rated Purchases (Box 9)', box10: 'Supplies subject to RCM (Box 10)' };
        let html = '<table class="w-full text-sm"><thead class="bg-slate-50"><tr><th class="p-2 text-left">Category</th><th class="p-2 text-right">VAT Amount</th><th class="p-2 text-right">Entries</th></tr></thead><tbody>';
        let totalOutput = 0, totalInput = 0;
        for (const [key, val] of Object.entries(summary)) {
            html += `<tr><td class="p-2">${boxLabels[key] || key}</td><td class="p-2 text-right">${formatNumber(val.vat)}</td><td class="p-2 text-right">${val.count}</td></tr>`;
            if (key === 'box1') totalOutput += val.vat;
            else totalInput += val.vat;
        }
        html += '</tbody></table>';
        html += `<div class="mt-4 p-3 bg-slate-50 rounded-lg text-sm"><strong>Output VAT:</strong> ${formatNumber(totalOutput)} | <strong>Input VAT:</strong> ${formatNumber(totalInput)} | <strong>Net:</strong> ${formatNumber(totalOutput - totalInput)}</div>`;
        container.innerHTML = html;
    } catch { container.innerHTML = '<div class="text-red-500">Failed to load VAT summary</div>'; }
}

function downloadVATExcel() {
    const from = document.getElementById('vat-date-from')?.value || '';
    const to = document.getElementById('vat-date-to')?.value || '';
    window.open(`/api/accounting/vat/excel?date_from=${from}&date_to=${to}`, '_blank');
}

function downloadVATReport() {
    const from = document.getElementById('vat-date-from')?.value || '';
    const to = document.getElementById('vat-date-to')?.value || '';
    window.open(`/api/accounting/vat/report?date_from=${from}&date_to=${to}`, '_blank');
}

// ============================================================================
// Window Bindings
// ============================================================================

window.__acctNewVoucher = (type) => openVoucherModal(type, 'CB');
window.__acctNewAREntry = newAREntry;
window.__acctNewAPEntry = newAPEntry;
window.__acctCloseModal = closeModal;
window.__acctAddLine = addVoucherLine;
window.__acctRemoveLine = removeVoucherLine;
window.__acctSaveDraft = saveDraft;
window.__acctSaveGenericDraft = saveGenericDraft;
window.__acctViewDraft = viewDraft;
window.__acctEditDraft = editDraft;
window.__acctDeleteDraft = deleteDraft;
window.__acctVoucherPDF = openVoucherPDF;
window.__acctDeleteFile = deleteFile;
window.__acctLoadVATSummary = loadVATSummary;
window.__acctDownloadVATExcel = downloadVATExcel;
window.__acctDownloadVATReport = downloadVATReport;

window.__acctLineAcctChange = (idx, sel) => {
    const opt = sel.options[sel.selectedIndex];
    voucherLines[idx].account_link = parseInt(sel.value) || '';
    voucherLines[idx].account_code = opt?.dataset?.code || '';
    voucherLines[idx].account_name = opt?.dataset?.name || '';
};

window.__acctLineProjChange = (idx, sel) => {
    const opt = sel.options[sel.selectedIndex];
    voucherLines[idx].project_id = parseInt(sel.value) || '';
    voucherLines[idx].project_name = opt?.text || '';
};

window.__acctLineFieldChange = (idx, field, value) => {
    voucherLines[idx][field] = value;
    if (field === 'debit' || field === 'credit') updateVoucherTotals();
};
