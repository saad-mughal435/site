/**
 * Sugar Dissolver — Sugar Issuance Record
 *
 * - Operator enters Production No + Date.
 * - Suggested sugar (Kg) is summed from RM-ready pending JOs.
 * - Operator overrides the suggested qty with their own final figure (NOT locked).
 * - "Generate & Print" downloads the PDF and stores an audit row.
 * - "View Past Issuances" lists previous prints with re-download links.
 */

import { authenticatedFetch } from '../auth.js?v=20260428b';
import { showToast } from '../utils.js?v=20260129a';

let _suggestedTotal = 0;
let _items = [];

function _fmtNum(n, dp = 2) {
    if (n === null || n === undefined || Number.isNaN(Number(n))) return '';
    const v = Number(n);
    return v.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

function _todayUaeISO() {
    const now = new Date();
    const uae = new Date(now.getTime() + (now.getTimezoneOffset() + 240) * 60000);
    return uae.toISOString().slice(0, 10);
}

function _renderShell(root) {
    root.innerHTML = `
        <div class="sd-subtabs">
            <button type="button" class="sd-subtab-btn active" data-sd-tab="issuance">Sugar Dissolver</button>
            <button type="button" class="sd-subtab-btn" data-sd-tab="cip">CIP</button>
        </div>

        <div id="sd-panel-issuance">
        <div class="mb-4">
            <h2 class="text-2xl font-bold text-slate-900">Sugar Dissolver</h2>
            <p class="text-slate-500 text-sm mt-1">
                Suggested sugar quantity is summed from pending job orders whose raw materials
                are currently available. The suggestion is informational — enter your own final
                quantity below before printing.
            </p>
        </div>

        <div class="bg-white rounded-xl shadow border border-slate-200 p-4 mb-4">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1">Production No</label>
                    <input id="sd-prod-no" type="text" placeholder="e.g. 414"
                        class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1">Date</label>
                    <input id="sd-date" type="date" value="${_todayUaeISO()}"
                        class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1">Tank No</label>
                    <input id="sd-tank" type="text" value="Sugar Dissolver" readonly
                        class="w-full px-3 py-2 border border-slate-200 bg-slate-100 text-slate-700 rounded-lg text-sm" />
                </div>
                <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1">Total Volume (Lt)</label>
                    <input id="sd-total-volume" type="number" step="0.01" placeholder="optional"
                        class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
            </div>
        </div>

        <div class="bg-white rounded-xl shadow border border-slate-200 mb-4">
            <div class="flex items-center justify-between p-4 border-b border-slate-200">
                <div>
                    <h3 class="text-base font-semibold text-slate-900">Pending Job Orders (RM-Ready)</h3>
                    <p class="text-xs text-slate-500 mt-0.5">Sugar required per JO, scaled from each recipe.</p>
                </div>
                <div class="flex gap-2">
                    <button id="sd-refresh" class="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">
                        Refresh
                    </button>
                </div>
            </div>
            <div id="sd-table-wrap" class="overflow-x-auto">
                <div class="p-8 text-center text-slate-400 text-sm">Loading...</div>
            </div>
            <div id="sd-skipped-wrap" class="p-3 border-t border-slate-100 text-xs text-slate-500"></div>
        </div>

        <div class="bg-white rounded-xl shadow border border-slate-200 p-4 mb-4">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                    <div class="text-xs font-semibold text-slate-500 uppercase">Suggested Sugar Qty</div>
                    <div id="sd-suggested" class="text-3xl font-bold text-blue-700 mt-1">— Kg</div>
                </div>
                <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1">Final Qty Required (Kg)</label>
                    <input id="sd-final-qty" type="number" step="0.01" placeholder="enter your qty"
                        class="w-full px-3 py-2 border-2 border-amber-400 rounded-lg text-base font-semibold focus:ring-2 focus:ring-amber-500 focus:border-amber-500" />
                    <button id="sd-reset" type="button" class="mt-1 text-xs text-blue-600 hover:underline">Reset to suggested</button>
                </div>
                <div class="flex flex-col gap-2">
                    <button id="sd-generate" class="px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">
                        Generate &amp; Print
                    </button>
                    <button id="sd-history" class="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm">
                        View Past Issuances
                    </button>
                </div>
            </div>
        </div>
        </div>

        <div id="sd-panel-cip" class="hidden"></div>

        <div id="sd-history-modal" class="fixed inset-0 bg-black/50 z-50 hidden flex items-start justify-center pt-10 overflow-y-auto">
            <div class="bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4 mb-10">
                <div class="flex items-center justify-between p-4 border-b border-slate-200">
                    <h3 class="text-lg font-semibold text-slate-900">Past Sugar Dissolver Issuances</h3>
                    <button id="sd-history-close" class="text-slate-400 hover:text-slate-700 text-2xl leading-none">&times;</button>
                </div>
                <div id="sd-history-body" class="p-4 max-h-[70vh] overflow-y-auto">
                    <div class="text-center text-slate-400 text-sm py-8">Loading...</div>
                </div>
            </div>
        </div>
    `;
}

function _renderTable(items) {
    const wrap = document.getElementById('sd-table-wrap');
    if (!wrap) return;
    if (!items.length) {
        wrap.innerHTML = `<div class="p-8 text-center text-slate-400 text-sm">
            No RM-ready pending job orders contain sugar. Adjust filters or check the Documents page.
        </div>`;
        return;
    }
    const rows = items.map(it => `
        <tr class="hover:bg-slate-50 border-t border-slate-100">
            <td class="px-3 py-2 text-xs text-slate-700">${it.jo_reference || '-'}</td>
            <td class="px-3 py-2 text-xs font-mono text-slate-700">${it.item_code || ''}</td>
            <td class="px-3 py-2 text-xs text-slate-700">${it.description || ''}</td>
            <td class="px-3 py-2 text-xs text-right text-slate-700">${_fmtNum(it.cases, 0)}</td>
            <td class="px-3 py-2 text-xs text-right font-semibold text-slate-900">${_fmtNum(it.sugar_kg, 2)}</td>
        </tr>
    `).join('');
    const total = items.reduce((s, it) => s + (Number(it.sugar_kg) || 0), 0);
    wrap.innerHTML = `
        <table class="min-w-full text-sm">
            <thead class="bg-slate-50">
                <tr>
                    <th class="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase">JO Ref</th>
                    <th class="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Item Code</th>
                    <th class="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Description</th>
                    <th class="px-3 py-2 text-right text-xs font-semibold text-slate-600 uppercase">Cases</th>
                    <th class="px-3 py-2 text-right text-xs font-semibold text-slate-600 uppercase">Sugar (Kg)</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot class="bg-slate-100 font-semibold border-t-2 border-slate-300">
                <tr>
                    <td colspan="4" class="px-3 py-2 text-right text-xs uppercase text-slate-700">Suggested Total</td>
                    <td class="px-3 py-2 text-right text-sm text-blue-700">${_fmtNum(total, 2)} Kg</td>
                </tr>
            </tfoot>
        </table>
    `;
}

function _renderSkipped(skipped) {
    const wrap = document.getElementById('sd-skipped-wrap');
    if (!wrap) return;
    if (!skipped || !skipped.length) {
        wrap.innerHTML = '';
        return;
    }
    const lis = skipped.map(s => `<li>
        <span class="font-mono">${s.item_code || ''}</span>
        ${s.cases ? `(${_fmtNum(s.cases, 0)} cases)` : ''}
        — ${s.reason || 'skipped'}
    </li>`).join('');
    wrap.innerHTML = `
        <details>
            <summary class="cursor-pointer hover:text-slate-700">
                Skipped ${skipped.length} pending JO(s) — click to expand
            </summary>
            <ul class="list-disc list-inside mt-2 space-y-0.5">${lis}</ul>
        </details>
    `;
}

async function _loadPending() {
    const wrap = document.getElementById('sd-table-wrap');
    if (wrap) wrap.innerHTML = `<div class="p-8 text-center text-slate-400 text-sm">Loading...</div>`;
    try {
        const resp = await authenticatedFetch('/api/sugar-dissolver/pending-sugar');
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        _items = data.items || [];
        _suggestedTotal = Number(data.total_sugar_kg || 0);
        _renderTable(_items);
        _renderSkipped(data.skipped || []);
        const sugSpan = document.getElementById('sd-suggested');
        if (sugSpan) sugSpan.textContent = `${_fmtNum(_suggestedTotal, 2)} Kg`;
        const finalInput = document.getElementById('sd-final-qty');
        if (finalInput && !finalInput.value) finalInput.value = _suggestedTotal.toFixed(2);
    } catch (e) {
        if (wrap) wrap.innerHTML = `<div class="p-8 text-center text-red-500 text-sm">Failed to load: ${e.message}</div>`;
    }
}

async function _generatePdf() {
    const prodNo = (document.getElementById('sd-prod-no')?.value || '').trim();
    const dateStr = document.getElementById('sd-date')?.value || '';
    const tankNo = (document.getElementById('sd-tank')?.value || 'Sugar Dissolver').trim();
    const totalVolStr = document.getElementById('sd-total-volume')?.value || '';
    const finalQtyStr = document.getElementById('sd-final-qty')?.value || '';

    if (!prodNo) { showToast('Production No is required', 'error'); return; }
    if (!dateStr) { showToast('Date is required', 'error'); return; }
    if (!finalQtyStr) { showToast('Final Qty Required is required', 'error'); return; }
    const finalQty = Number(finalQtyStr);
    if (!Number.isFinite(finalQty) || finalQty <= 0) {
        showToast('Final Qty Required must be a positive number', 'error');
        return;
    }

    const btn = document.getElementById('sd-generate');
    if (btn) { btn.disabled = true; btn.textContent = 'Generating...'; }
    try {
        const resp = await authenticatedFetch('/api/sugar-dissolver/pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                production_no: prodNo,
                issuance_date: dateStr,
                tank_no: tankNo,
                total_volume_lt: totalVolStr ? Number(totalVolStr) : null,
                qty_required_kg: finalQty,
                suggested_qty_kg: _suggestedTotal,
                items: _items.map(it => ({
                    jo_reference: it.jo_reference || '',
                    item_code: it.item_code || '',
                    description: it.description || '',
                    cases: it.cases || 0,
                    sugar_kg: it.sugar_kg || 0,
                })),
            }),
        });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.detail || `HTTP ${resp.status}`);
        }
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Sugar_Issuance_Dissolver_${prodNo}_${dateStr}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showToast('Sugar Issuance PDF generated', 'success');
    } catch (e) {
        showToast(`Failed: ${e.message}`, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Generate & Print'; }
    }
}

async function _openHistory() {
    const modal = document.getElementById('sd-history-modal');
    const body = document.getElementById('sd-history-body');
    if (!modal || !body) return;
    modal.classList.remove('hidden');
    body.innerHTML = `<div class="text-center text-slate-400 text-sm py-8">Loading...</div>`;
    try {
        const resp = await authenticatedFetch('/api/sugar-dissolver/issuances?limit=200');
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        const items = data.items || [];
        if (!items.length) {
            body.innerHTML = `<div class="text-center text-slate-400 text-sm py-8">No past issuances yet.</div>`;
            return;
        }
        const rows = items.map(it => `
            <tr class="border-t border-slate-100 hover:bg-slate-50">
                <td class="px-3 py-2 text-xs">${it.production_no || ''}</td>
                <td class="px-3 py-2 text-xs">${it.issuance_date || ''}</td>
                <td class="px-3 py-2 text-xs">${it.tank_no || ''}</td>
                <td class="px-3 py-2 text-xs text-right font-semibold">${_fmtNum(it.qty_required_kg, 2)} Kg</td>
                <td class="px-3 py-2 text-xs text-slate-500">${it.created_by || ''}</td>
                <td class="px-3 py-2 text-xs text-right">
                    <button data-id="${it.id}" class="sd-redownload px-2 py-1 text-xs border border-blue-300 text-blue-700 rounded hover:bg-blue-50">
                        Download
                    </button>
                </td>
            </tr>
        `).join('');
        body.innerHTML = `
            <table class="min-w-full text-sm">
                <thead class="bg-slate-50">
                    <tr>
                        <th class="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Production No</th>
                        <th class="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Date</th>
                        <th class="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Tank</th>
                        <th class="px-3 py-2 text-right text-xs font-semibold text-slate-600 uppercase">Qty</th>
                        <th class="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Created By</th>
                        <th class="px-3 py-2 text-right text-xs font-semibold text-slate-600 uppercase">PDF</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
        body.querySelectorAll('.sd-redownload').forEach(btn => {
            btn.addEventListener('click', () => _downloadPastIssuance(btn.getAttribute('data-id')));
        });
    } catch (e) {
        body.innerHTML = `<div class="text-center text-red-500 text-sm py-8">Failed: ${e.message}</div>`;
    }
}

function _closeHistory() {
    const modal = document.getElementById('sd-history-modal');
    if (modal) modal.classList.add('hidden');
}

async function _downloadPastIssuance(id) {
    if (!id) return;
    try {
        const resp = await authenticatedFetch(`/api/sugar-dissolver/issuances/${id}/pdf`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sugar_dissolver_${id}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    } catch (e) {
        showToast(`Download failed: ${e.message}`, 'error');
    }
}

let _cipRendered = false;

function _switchSdSubtab(name) {
    const issuancePanel = document.getElementById('sd-panel-issuance');
    const cipPanel = document.getElementById('sd-panel-cip');
    document.querySelectorAll('.sd-subtab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.sdTab === name);
    });
    if (name === 'cip') {
        if (issuancePanel) issuancePanel.classList.add('hidden');
        if (cipPanel) cipPanel.classList.remove('hidden');
        if (cipPanel && !_cipRendered) {
            _cipRendered = true;
            import('./sugar_dissolver_cip.js?v=20260506mix21').then(mod => {
                mod.renderSugarDissolverCip(cipPanel);
            }).catch(err => {
                cipPanel.innerHTML = `<div class="p-8 text-center text-red-500 text-sm">Failed to load CIP module: ${err.message}</div>`;
            });
        }
    } else {
        if (cipPanel) cipPanel.classList.add('hidden');
        if (issuancePanel) issuancePanel.classList.remove('hidden');
    }
}

export async function initSugarDissolverPage() {
    const root = document.getElementById('view-sugar-dissolver');
    if (!root) {
        console.warn('view-sugar-dissolver container missing');
        return;
    }
    _renderShell(root);
    _cipRendered = false;

    root.querySelectorAll('.sd-subtab-btn').forEach(btn => {
        btn.addEventListener('click', () => _switchSdSubtab(btn.dataset.sdTab));
    });

    document.getElementById('sd-refresh')?.addEventListener('click', _loadPending);
    document.getElementById('sd-generate')?.addEventListener('click', _generatePdf);
    document.getElementById('sd-reset')?.addEventListener('click', () => {
        const f = document.getElementById('sd-final-qty');
        if (f) f.value = _suggestedTotal.toFixed(2);
    });
    document.getElementById('sd-history')?.addEventListener('click', _openHistory);
    document.getElementById('sd-history-close')?.addEventListener('click', _closeHistory);
    document.getElementById('sd-history-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'sd-history-modal') _closeHistory();
    });

    await _loadPending();
}
