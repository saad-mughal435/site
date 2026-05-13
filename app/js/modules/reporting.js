/**
 * Demo Plant LLC - Reporting Module
 * Served from /reporting-menu/frontend/reporting.js
 */

import { debounce, formatNumber, showToast } from '/app/js/utils.js?v=20260129a';
import { authenticatedFetch } from '/app/js/auth.js?v=20260428b';

const TEMPLATE_URL = '/app/reporting_template.html?v=20260330a';

let allBatches = [];
let filteredBatches = [];
let palletRows = [];
let palletReportsLoaded = false;
let palletApiUnavailable = false;
let productionLogRows = [];
let productionLogsLoaded = false;
let productionLogsApiUnavailable = false;
let gtinDetailsRows = [];
let gtinDetailsFiltered = [];
let gtinDetailsLoaded = false;
let gtinDetailsApiUnavailable = false;
let listenersBound = false;
let activeReportingSubmenu = 'combined';

const batchById = new Map();
const ppcReportIdByBatchNo = new Map();

const SEARCH_DEBOUNCE_MS = 250;
const SUBMENU_ACTIVE_CLASS = 'px-5 py-2.5 text-sm font-semibold rounded-xl bg-black text-white border border-black transition-colors';
const SUBMENU_INACTIVE_CLASS = 'px-5 py-2.5 text-sm font-medium rounded-xl bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 transition-colors';
const PALLET_TYPE_CATALOG = [
    { code: '111-PLT-003', description: 'Pallets 1420 x 1120 mm' },
    { code: '111-PLT-005', description: 'Pallets 1200 x 1000 mm' },
    { code: '111-PLT-006', description: 'Pallets Red 1200 x 1000 x 150 mm' },
    { code: '111-PLT-007', description: 'Euro Pallets 1200 x 800 mm' }
];
const PALLET_TYPE_ORDER = Object.fromEntries(PALLET_TYPE_CATALOG.map((entry, idx) => [entry.code, idx]));

const applyReportingFiltersDebounced = debounce(() => {
    applyReportingFilters();
}, SEARCH_DEBOUNCE_MS);

const loadPalletReportsDebounced = debounce(() => {
    void loadPalletReports();
}, SEARCH_DEBOUNCE_MS);

const loadProductionLogsDebounced = debounce(() => {
    void loadProductionLogs();
}, SEARCH_DEBOUNCE_MS);

const filterGtinDetailsDebounced = debounce(() => {
    applyGtinDetailsFilter();
}, SEARCH_DEBOUNCE_MS);

const MONTH_INDEX = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11
};

function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
}

function stripProductCodePrefix(value) {
    const cleaned = String(value || '').trim();
    if (!cleaned) return '';

    const match = cleaned.match(/^([A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)\s*-\s*(.+)$/i);
    if (!match) return cleaned;
    const [, left, right] = match;
    const looksLikeItemCode = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/.test(String(left || '').trim());
    return looksLikeItemCode ? String(right || '').trim() : cleaned;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function toNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function parseYear(yearRaw) {
    const year = Number(yearRaw);
    if (!Number.isFinite(year)) return null;
    if (year < 100) return 2000 + year;
    return year;
}

function parseBatchDate(rawValue) {
    const raw = String(rawValue || '').trim();
    if (!raw) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        const [y, m, d] = raw.split('-').map(Number);
        return new Date(y, m - 1, d);
    }

    let match = raw.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})$/);
    if (match) {
        const day = Number(match[1]);
        const month = Number(match[2]) - 1;
        const year = parseYear(match[3]);
        if (year !== null) return new Date(year, month, day);
    }

    match = raw.match(/^(\d{1,2})[-\/ ]([A-Za-z]{3})[-\/ ](\d{2,4})$/);
    if (match) {
        const day = Number(match[1]);
        const month = MONTH_INDEX[String(match[2]).toLowerCase()];
        const year = parseYear(match[3]);
        if (Number.isFinite(month) && year !== null) return new Date(year, month, day);
    }

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
        return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    }

    return null;
}

function parseFilterDate(rawValue) {
    if (!rawValue) return null;
    const [year, month, day] = String(rawValue).split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
}

function dayStamp(dateObj) {
    if (!dateObj) return null;
    return new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()).getTime();
}

function sortBatches(rows) {
    return [...rows].sort((a, b) => {
        const aDate = dayStamp(parseBatchDate(a?.date));
        const bDate = dayStamp(parseBatchDate(b?.date));

        if (aDate !== null && bDate !== null && aDate !== bDate) {
            return bDate - aDate;
        }
        if (aDate === null && bDate !== null) return 1;
        if (aDate !== null && bDate === null) return -1;

        return toNumber(b?.id) - toNumber(a?.id);
    });
}

function getBatchById(batchId) {
    return batchById.get(String(batchId || '')) || null;
}

function getFilenameFromResponse(response, fallbackName) {
    const contentDisposition = response.headers.get('content-disposition') || '';

    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
        try {
            return decodeURIComponent(utf8Match[1].trim());
        } catch (_error) {
            return utf8Match[1].trim();
        }
    }

    const simpleMatch = contentDisposition.match(/filename=\"?([^\";]+)\"?/i);
    if (simpleMatch?.[1]) return simpleMatch[1].trim();

    return fallbackName;
}

async function extractErrorMessage(response, fallback = 'Request failed') {
    try {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            const payload = await response.json();
            if (payload?.detail) return String(payload.detail);
            if (payload?.message) return String(payload.message);
        }
        const text = await response.text();
        if (text) return text.slice(0, 220);
    } catch (_error) {
        // Ignore parse errors and use fallback
    }
    return fallback;
}

function triggerBlobDownload(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
}

async function downloadPdfFromUrl(url, fallbackFilename) {
    const response = await authenticatedFetch(url);
    if (!response.ok) {
        const errorText = await extractErrorMessage(response, `Download failed (${response.status})`);
        throw new Error(errorText);
    }

    const blob = await response.blob();
    const filename = getFilenameFromResponse(response, fallbackFilename);
    triggerBlobDownload(blob, filename);
}

async function downloadStockRequisition(batch) {
    const batchId = toNumber(batch?.id);
    const batchNo = String(batch?.batch_no || batchId || 'batch');
    if (!batchId) throw new Error('Production batch id is missing');

    await downloadPdfFromUrl(
        `/api/production-batch/${encodeURIComponent(batchId)}/stock-requisition-pdf`,
        `${batchNo}_StockRequisition.pdf`
    );
}

async function downloadPickingSheet(batch) {
    const batchId = toNumber(batch?.id);
    const batchNo = String(batch?.batch_no || batchId || 'batch');
    if (!batchId) throw new Error('Production batch id is missing');

    await downloadPdfFromUrl(
        `/api/production-batch/${encodeURIComponent(batchId)}/picking-sheet-pdf`,
        `${batchNo}_PickingSheet.pdf`
    );
}

async function downloadQcCombined(batch) {
    const batchNo = String(batch?.batch_no || '').trim();
    if (!batchNo) throw new Error('Batch number is missing');

    await downloadPdfFromUrl(
        `/api/qc/batches/${encodeURIComponent(batchNo)}/qc-record/pdf`,
        `${batchNo}_QC_Record.pdf`
    );
}

function reportStatusRank(status) {
    const normalized = normalizeText(status);
    if (normalized === 'completed') return 3;
    if (normalized === 'partial') return 2;
    if (normalized === 'pending') return 1;
    return 0;
}

async function resolvePpcReportId(batchNo) {
    const key = normalizeText(batchNo);
    if (!key) return null;
    if (ppcReportIdByBatchNo.has(key)) return ppcReportIdByBatchNo.get(key);

    const response = await authenticatedFetch(
        `/api/production-control-reports?search=${encodeURIComponent(batchNo)}&limit=1000`
    );
    if (!response.ok) {
        const errorText = await extractErrorMessage(response, 'Failed to load PPC report list');
        throw new Error(errorText);
    }

    const payload = await response.json();
    const reports = Array.isArray(payload?.reports) ? payload.reports : [];

    const matches = reports
        .filter((row) => normalizeText(row?.batch_no) === key)
        .sort((a, b) => {
            const statusDelta = reportStatusRank(b?.status) - reportStatusRank(a?.status);
            if (statusDelta !== 0) return statusDelta;

            const dayDelta = toNumber(b?.day_number) - toNumber(a?.day_number);
            if (dayDelta !== 0) return dayDelta;

            const aTime = Date.parse(String(a?.updated_at || a?.created_at || '')) || 0;
            const bTime = Date.parse(String(b?.updated_at || b?.created_at || '')) || 0;
            return bTime - aTime;
        });

    const selectedId = matches[0]?._id || null;
    ppcReportIdByBatchNo.set(key, selectedId);
    return selectedId;
}

async function downloadPpcCombined(batch) {
    const batchNo = String(batch?.batch_no || '').trim();
    if (!batchNo) throw new Error('Batch number is missing');

    const reportId = await resolvePpcReportId(batchNo);
    if (!reportId) throw new Error(`No PPC report found for batch ${batchNo}`);

    await downloadPdfFromUrl(
        `/api/production-control-reports/${encodeURIComponent(reportId)}/pdf-combined`,
        `${batchNo}_PPC_Combined.pdf`
    );
}

function setActionButtonBusy(button, busy, busyLabel = 'Working...') {
    if (!button) return;
    if (busy) {
        button.dataset.originalLabel = button.textContent || '';
        button.textContent = busyLabel;
        button.disabled = true;
        button.classList.add('opacity-60');
        return;
    }
    button.textContent = button.dataset.originalLabel || button.textContent;
    button.disabled = false;
    button.classList.remove('opacity-60');
}

async function runSingleAction(action, batch) {
    switch (action) {
        case 'stock':
            await downloadStockRequisition(batch);
            showToast(`Stock Requisition downloaded for ${batch.batch_no}`, 'success');
            break;
        case 'picking':
            await downloadPickingSheet(batch);
            showToast(`Picking Sheet downloaded for ${batch.batch_no}`, 'success');
            break;
        case 'qc':
            await downloadQcCombined(batch);
            showToast(`QC combined file downloaded for ${batch.batch_no}`, 'success');
            break;
        case 'ppc':
            await downloadPpcCombined(batch);
            showToast(`PPC combined report downloaded for ${batch.batch_no}`, 'success');
            break;
        default:
            throw new Error('Unknown action');
    }
}

async function downloadAllInOrder(batch) {
    const batchId = toNumber(batch?.id);
    const batchNo = String(batch?.batch_no || batchId || 'batch').trim();
    if (!batchId) throw new Error('Production batch id is missing');

    await downloadPdfFromUrl(
        `/api/reporting/combined-batch/${encodeURIComponent(batchId)}/pdf`,
        `${batchNo}_Combined_Batch_Report.pdf`
    );
    showToast(`Combined batch report downloaded for ${batchNo}`, 'success');
}

function buildDownloadsCell(batch) {
    const batchId = String(batch?.id ?? '');
    const hasBatchId = !!toNumber(batchId);
    const hasBatchNo = !!String(batch?.batch_no || '').trim();

    const disabledAll = !(hasBatchId && hasBatchNo) ? 'disabled' : '';
    const disabledYield = !hasBatchId ? 'disabled' : '';
    const disabledBatchNo = !hasBatchNo ? 'disabled' : '';

    return `
        <div class="flex flex-wrap gap-1.5">
            <button data-action="all" data-batch-id="${escapeHtml(batchId)}" ${disabledAll} class="px-2 py-1 text-[11px] font-semibold rounded-md bg-slate-900 text-white hover:bg-slate-800 transition-colors">All In 1 PDF</button>
            <button data-action="stock" data-batch-id="${escapeHtml(batchId)}" ${disabledYield} class="px-2 py-1 text-[11px] font-medium rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors">Stock Req</button>
            <button data-action="picking" data-batch-id="${escapeHtml(batchId)}" ${disabledYield} class="px-2 py-1 text-[11px] font-medium rounded-md bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors">Picking</button>
            <button data-action="qc" data-batch-id="${escapeHtml(batchId)}" ${disabledBatchNo} class="px-2 py-1 text-[11px] font-medium rounded-md bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors">QC</button>
            <button data-action="ppc" data-batch-id="${escapeHtml(batchId)}" ${disabledBatchNo} class="px-2 py-1 text-[11px] font-medium rounded-md bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors">PPC</button>
        </div>
    `;
}

function renderReportingTableRows() {
    const tbody = document.getElementById('reporting-batch-table-body');
    const countEl = document.getElementById('reporting-results-count');
    if (!tbody) return;

    if (countEl) {
        countEl.textContent = `${filteredBatches.length} batch(es)`;
    }

    if (!filteredBatches.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="px-6 py-10 text-center text-slate-400">No batches match the selected filters.</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filteredBatches.map((batch) => {
        const dateText = escapeHtml(batch?.date || '-');
        const batchNo = escapeHtml(batch?.batch_no || '-');
        const itemCode = escapeHtml(batch?.item_code || '-');
        const recipeOrDesc = escapeHtml(batch?.recipe_name || batch?.description || '-');
        const plannedQty = formatNumber(batch?.planned_qty ?? 0, 4);
        const actualQty = formatNumber(batch?.actual_qty ?? 0, 4);

        return `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">${dateText}</td>
                <td class="px-4 py-3 text-sm font-semibold text-slate-900 whitespace-nowrap">${batchNo}</td>
                <td class="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">${itemCode}</td>
                <td class="px-4 py-3 text-sm text-slate-700">${recipeOrDesc}</td>
                <td class="px-4 py-3 text-sm text-slate-700 text-right whitespace-nowrap">${plannedQty}</td>
                <td class="px-4 py-3 text-sm text-slate-700 text-right whitespace-nowrap">${actualQty}</td>
                <td class="px-4 py-3 text-sm text-slate-700">${buildDownloadsCell(batch)}</td>
            </tr>
        `;
    }).join('');
}

function formatPalletQty(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return '-';
    if (Number.isInteger(parsed)) return String(parsed);
    return parsed.toFixed(4).replace(/\.?0+$/, '');
}

function naturalSortKey(value) {
    const raw = String(value || '').trim().toUpperCase();
    if (!raw) return [''];
    const parts = raw.split(/(\d+)/).filter(Boolean);
    return parts.map((part) => (/^\d+$/.test(part) ? Number(part) : part));
}

function compareNaturalKeys(aKey = [], bKey = []) {
    const maxLen = Math.max(aKey.length, bKey.length);
    for (let i = 0; i < maxLen; i += 1) {
        const a = aKey[i];
        const b = bKey[i];
        if (a === undefined && b !== undefined) return -1;
        if (a !== undefined && b === undefined) return 1;
        if (a === b) continue;

        const aNum = typeof a === 'number';
        const bNum = typeof b === 'number';
        if (aNum && bNum) return a - b;
        return String(a).localeCompare(String(b), undefined, { sensitivity: 'base' });
    }
    return 0;
}

function parseIsoDate(value) {
    if (!value) return null;
    const [year, month, day] = String(value).split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
}

function isoToDmy(iso) {
    if (!iso) return '';
    const parts = String(iso).split('-');
    return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : iso;
}

function parseApiDateToIso(rawValue) {
    if (!rawValue) return '';
    const value = String(rawValue).trim();
    if (!value) return '';
    const datePart = value.includes('T') ? value.slice(0, 10) : value;
    const parsed = parseBatchDate(datePart);
    if (!parsed) return '';
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parsePalletMixStorage(mixValue) {
    const raw = String(mixValue || '').trim();
    if (!raw) return [];

    return raw
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
            const size = part.replace(/\s*\[(?:P|C\/P|T):\s*[^\]]+\]/gi, '').trim();
            const count = (part.match(/\[P:\s*([^\]]+)\]/i)?.[1] || '').trim();
            const type = (part.match(/\[T:\s*([^\]]+)\]/i)?.[1] || '').trim();
            return { size, count: toNumber(count), type };
        });
}

function splitTypeValues(value) {
    return String(value || '')
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean);
}

function resolvePalletCatalog(rawLabel) {
    const label = String(rawLabel || '').trim();
    const normalized = normalizeText(label).replace(/[^a-z0-9]/g, '');
    const rawUpper = label.toUpperCase();

    const codeMatch = rawUpper.match(/111[-\s]?PLT[-\s]?(003|005|006|007)/);
    if (codeMatch) {
        const code = `111-PLT-${codeMatch[1]}`;
        const found = PALLET_TYPE_CATALOG.find((entry) => entry.code === code);
        if (found) return found;
    }

    if (normalized.includes('1420') && normalized.includes('1120')) return PALLET_TYPE_CATALOG[0];
    if (normalized.includes('euro') || (normalized.includes('1200') && normalized.includes('800'))) return PALLET_TYPE_CATALOG[3];
    if ((normalized.includes('red') && normalized.includes('1200') && normalized.includes('1000')) || (normalized.includes('1200') && normalized.includes('1000') && normalized.includes('150'))) return PALLET_TYPE_CATALOG[2];
    if (normalized.includes('1200') && normalized.includes('1000')) return PALLET_TYPE_CATALOG[1];

    return { code: '', description: label || 'Pallets' };
}

function reportRank(report) {
    const day = toNumber(report?.day_number || 0);
    const updated = Date.parse(String(report?.batch_completion_date || report?.submitted_at || report?.updated_at || report?.created_at || '')) || 0;
    return [day, updated];
}

function extractPalletRowsFromCompletedReports(completedReports = []) {
    const latestByBatch = new Map();

    completedReports.forEach((report) => {
        const batchNo = String(report?.batch_no || '').trim();
        if (!batchNo) return;

        const key = normalizeText(batchNo);
        const current = latestByBatch.get(key);
        if (!current) {
            latestByBatch.set(key, report);
            return;
        }

        const [currentDay, currentTime] = reportRank(current);
        const [nextDay, nextTime] = reportRank(report);
        if (nextDay > currentDay || (nextDay === currentDay && nextTime > currentTime)) {
            latestByBatch.set(key, report);
        }
    });

    const rows = [];

    latestByBatch.forEach((report) => {
        const packagingType = String(report?.packaging_type || '').trim().toUpperCase();
        const batchNo = String(report?.batch_no || '').trim();
        const productName = String(report?.product_name || report?.recipe_name || '').trim();
        const reportDate = parseApiDateToIso(
            report?.batch_completion_date
            || report?.production_date
            || report?.submitted_at
            || report?.updated_at
            || report?.created_at
        );

        const mixRaw = packagingType === 'CAN' ? report?.can_pallet_size : report?.bottle_pallet_size;
        const fallbackTotal = packagingType === 'CAN'
            ? toNumber(report?.filled_can_pallets || 0)
            : toNumber(report?.filled_bottle_pallets || 0);
        const fallbackTypes = splitTypeValues(report?.bottle_pallet_type);

        let mixEntries = parsePalletMixStorage(mixRaw);
        if (mixEntries.length) {
            mixEntries = mixEntries.map((entry, idx) => ({
                ...entry,
                type: entry.type || fallbackTypes[idx] || ''
            }));
        }

        const hasCounts = mixEntries.some((entry) => toNumber(entry?.count) > 0);
        if (!hasCounts && fallbackTotal > 0) {
            if (mixEntries.length) {
                mixEntries[0].count = fallbackTotal;
            } else {
                mixEntries = [{ size: '', type: fallbackTypes[0] || '', count: fallbackTotal }];
            }
        }

        const grouped = new Map();
        mixEntries.forEach((entry) => {
            const count = toNumber(entry?.count);
            if (count <= 0) return;
            const rawLabel = String(entry?.size || entry?.type || 'Pallets').trim();
            const palletInfo = resolvePalletCatalog(rawLabel);
            const groupKey = `${palletInfo.code}|${palletInfo.description}`;
            grouped.set(groupKey, {
                report_id: String(report?._id || ''),
                report_date: reportDate,
                batch_no: batchNo,
                product_name: productName,
                packaging_type: packagingType || '-',
                pallet_item_code: palletInfo.code || '',
                pallet_type: palletInfo.description || rawLabel || 'Pallets',
                pallet_count: toNumber(grouped.get(groupKey)?.pallet_count || 0) + count
            });
        });

        grouped.forEach((row) => {
            rows.push({
                ...row,
                pallet_count: Number(toNumber(row.pallet_count).toFixed(4))
            });
        });
    });

    rows.sort((a, b) => {
        const aBatch = naturalSortKey(a?.batch_no);
        const bBatch = naturalSortKey(b?.batch_no);
        const batchCompare = compareNaturalKeys(aBatch, bBatch);
        if (batchCompare !== 0) return batchCompare;

        const aOrder = PALLET_TYPE_ORDER[a?.pallet_item_code] ?? 999;
        const bOrder = PALLET_TYPE_ORDER[b?.pallet_item_code] ?? 999;
        if (aOrder !== bOrder) return aOrder - bOrder;

        return normalizeText(a?.pallet_type).localeCompare(normalizeText(b?.pallet_type));
    });

    return rows;
}

function applyClientSidePalletFilters(rows = [], filters = getPalletFilterSnapshot()) {
    const search = normalizeText(filters.search);
    const batchNo = normalizeText(filters.batchNo);
    const palletType = String(filters.palletType || '').trim();
    const palletTypeNormalized = normalizeText(palletType);
    const selectedPalletCode = resolvePalletCatalog(palletType).code || '';
    const fromDay = dayStamp(parseFilterDate(filters.dateFrom));
    const toDay = dayStamp(parseFilterDate(filters.dateTo));

    return rows.filter((row) => {
        const rowDateStamp = dayStamp(parseIsoDate(row?.report_date));
        if (fromDay !== null && (rowDateStamp === null || rowDateStamp < fromDay)) return false;
        if (toDay !== null && (rowDateStamp === null || rowDateStamp > toDay)) return false;

        const rowBatch = normalizeText(row?.batch_no);
        const rowCode = normalizeText(row?.pallet_item_code);
        const rowType = normalizeText(row?.pallet_type);
        const rowPack = normalizeText(row?.packaging_type);
        const rowProduct = normalizeText(row?.product_name);
        const rowDate = normalizeText(row?.report_date);

        if (batchNo && !rowBatch.includes(batchNo)) return false;

        if (palletType) {
            if (selectedPalletCode) {
                if (String(row?.pallet_item_code || '').trim() !== selectedPalletCode) return false;
            } else {
                const palletText = `${rowCode} ${rowType}`;
                if (!palletText.includes(palletTypeNormalized)) return false;
            }
        }

        if (search) {
            const searchable = `${rowBatch} ${rowProduct} ${rowPack} ${rowCode} ${rowType} ${rowDate}`;
            if (!searchable.includes(search)) return false;
        }
        return true;
    });
}

function sumOptionalNumberValues(rawValues) {
    if (Array.isArray(rawValues)) {
        return rawValues.reduce((total, value) => {
            if (value === null || value === undefined || String(value).trim() === '') return total;
            return total + toNumber(value);
        }, 0);
    }

    const raw = String(rawValues || '').trim();
    if (!raw) return 0;
    return raw
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean)
        .reduce((total, part) => total + toNumber(part), 0);
}

function inferProductVolumeMl(report) {
    const text = `${String(report?.recipe_name || '')} ${String(report?.product_name || '')}`.toLowerCase();
    const match = text.match(/(\d+(?:\.\d+)?)\s*(ml|l)\b/i);
    if (!match) return 0;

    const qty = toNumber(match[1]);
    if (qty <= 0) return 0;
    return String(match[2]).toLowerCase() === 'l' ? qty * 1000 : qty;
}

function resolveProductionCounterValue(report) {
    const batchCompletionCounter = toNumber(report?.batch_completion_counter || 0);
    if (batchCompletionCounter > 0) return batchCompletionCounter;

    const packagingType = String(report?.packaging_type || '').trim().toUpperCase();
    const baseCounter = toNumber(report?.production_counter || 0);
    if (packagingType !== 'PET') return baseCounter;
    return baseCounter + sumOptionalNumberValues(report?.production_counter_type_values);
}

function resolveProductionRejectionValue(report) {
    const packagingType = String(report?.packaging_type || '').trim().toUpperCase();
    const fallback = packagingType === 'CAN'
        ? toNumber(report?.checkmate_rejected_cans || 0) + toNumber(report?.line_damaged_cans || 0)
        : toNumber(report?.checkmate_rejected_bottles || 0) + toNumber(report?.line_damaged_bottles || 0);

    let value = toNumber(report?.total_rejection || 0);
    if (value <= 0 && fallback > 0) value = fallback;
    return value;
}

function resolveProductionRetentionValue(report, counterValue) {
    let value = toNumber(report?.retention_sample || 0);
    if (value <= 0 && counterValue > 0) {
        value = counterValue > 100099 ? 18 : 12;
    }
    return value;
}

function resolveProductionQuantityIssuedValue(report) {
    let value = toNumber(report?.quantity_issued_to_store || 0);
    if (value > 0) return value;

    const casesProduced = toNumber(report?.cases_produced || 0);
    if (casesProduced <= 0) return 0;

    const packagingType = String(report?.packaging_type || '').trim().toUpperCase();
    if (packagingType === 'CAN') return casesProduced * 24;

    const volumeMl = inferProductVolumeMl(report);
    const unitsPerCase = volumeMl >= 2500 ? 6 : 24;
    return casesProduced * unitsPerCase;
}

function resolveProductionQcSampleValue(report, counterValue, totalRejection, retentionSample, quantityIssuedToStore) {
    const fromReport = toNumber(report?.qc_sample || 0);
    if (fromReport > 0) return fromReport;
    return counterValue - totalRejection - retentionSample - quantityIssuedToStore;
}

function extractProductionLogRowsFromCompletedReports(completedReports = []) {
    const latestByBatch = new Map();

    completedReports.forEach((report) => {
        const batchNo = String(report?.batch_no || '').trim();
        if (!batchNo) return;

        const key = normalizeText(batchNo);
        const current = latestByBatch.get(key);
        if (!current) {
            latestByBatch.set(key, report);
            return;
        }

        const [currentDay, currentTime] = reportRank(current);
        const [nextDay, nextTime] = reportRank(report);
        if (nextDay > currentDay || (nextDay === currentDay && nextTime > currentTime)) {
            latestByBatch.set(key, report);
        }
    });

    const rows = [];
    latestByBatch.forEach((report) => {
        const reportDate = parseApiDateToIso(
            report?.batch_completion_date
            || report?.production_date
            || report?.submitted_at
            || report?.updated_at
            || report?.created_at
        );
        const packagingType = String(report?.packaging_type || '').trim().toUpperCase() || '-';
        const productionCounter = resolveProductionCounterValue(report);
        const totalRejection = resolveProductionRejectionValue(report);
        const retentionSample = resolveProductionRetentionValue(report, productionCounter);
        const quantityIssuedToStore = resolveProductionQuantityIssuedValue(report);
        const qcSample = resolveProductionQcSampleValue(
            report,
            productionCounter,
            totalRejection,
            retentionSample,
            quantityIssuedToStore
        );

        const prodDate = parseApiDateToIso(report?.production_date);
        const expDate = parseApiDateToIso(report?.expiry_date);

        rows.push({
            report_id: String(report?._id || ''),
            report_date: reportDate,
            production_date: prodDate,
            expiry_date: expDate,
            batch_no: String(report?.batch_completion_batch_no || report?.batch_no || '').trim(),
            product_name: stripProductCodePrefix(String(report?.product_name || report?.recipe_name || '').trim()),
            gtin_barcode: String(report?.gtin_barcode || report?.gtin || '').trim(),
            packaging_type: packagingType,
            production_counter: Number(toNumber(productionCounter).toFixed(4)),
            total_rejection: Number(toNumber(totalRejection).toFixed(4)),
            qc_sample: Number(toNumber(qcSample).toFixed(4)),
            retention_sample: Number(toNumber(retentionSample).toFixed(4)),
            quantity_issued_to_store: Number(toNumber(quantityIssuedToStore).toFixed(4)),
            cases_produced: Number(toNumber(report?.cases_produced || 0).toFixed(4))
        });
    });

    rows.sort((a, b) => {
        const aDate = dayStamp(parseIsoDate(a?.report_date));
        const bDate = dayStamp(parseIsoDate(b?.report_date));
        if (aDate !== null && bDate !== null && aDate !== bDate) return bDate - aDate;
        if (aDate === null && bDate !== null) return 1;
        if (aDate !== null && bDate === null) return -1;

        const aBatch = naturalSortKey(a?.batch_no);
        const bBatch = naturalSortKey(b?.batch_no);
        return compareNaturalKeys(aBatch, bBatch);
    });

    return rows;
}

function applyClientSideProductionLogFilters(rows = [], filters = getProductionLogFilterSnapshot()) {
    const search = normalizeText(filters.search);
    const packagingType = String(filters.packagingType || '').trim().toUpperCase();
    const fromDay = dayStamp(parseFilterDate(filters.dateFrom));
    const toDay = dayStamp(parseFilterDate(filters.dateTo));

    return rows.filter((row) => {
        const rowDateStamp = dayStamp(parseIsoDate(row?.report_date));
        if (fromDay !== null && (rowDateStamp === null || rowDateStamp < fromDay)) return false;
        if (toDay !== null && (rowDateStamp === null || rowDateStamp > toDay)) return false;

        const rowPack = String(row?.packaging_type || '').trim().toUpperCase();
        if (packagingType && rowPack !== packagingType) return false;

        if (search) {
            const searchable = normalizeText([
                row?.report_date,
                row?.batch_no,
                row?.product_name,
                row?.gtin_barcode,
                row?.packaging_type
            ].join(' '));
            if (!searchable.includes(search)) return false;
        }

        return true;
    });
}

function sortProductionLogRows(rows, sortBy = 'date-desc') {
    const sorted = [...rows];
    sorted.sort((a, b) => {
        if (sortBy === 'batch-asc' || sortBy === 'batch-desc') {
            const aKey = naturalSortKey(a?.batch_no);
            const bKey = naturalSortKey(b?.batch_no);
            const cmp = compareNaturalKeys(aKey, bKey);
            return sortBy === 'batch-desc' ? -cmp : cmp;
        }
        const aDate = dayStamp(parseIsoDate(a?.production_date || a?.report_date));
        const bDate = dayStamp(parseIsoDate(b?.production_date || b?.report_date));
        if (aDate !== null && bDate !== null && aDate !== bDate) {
            return sortBy === 'date-asc' ? aDate - bDate : bDate - aDate;
        }
        if (aDate === null && bDate !== null) return 1;
        if (aDate !== null && bDate === null) return -1;
        const aKey = naturalSortKey(a?.batch_no);
        const bKey = naturalSortKey(b?.batch_no);
        return compareNaturalKeys(aKey, bKey);
    });
    return sorted;
}

async function fetchCompletedPpcReportsForPalletFallback() {
    const response = await authenticatedFetch('/api/production-control-reports?status=completed&limit=10000');
    if (!response.ok) {
        const errorText = await extractErrorMessage(response, 'Failed to load completed PPC reports');
        throw new Error(errorText);
    }
    const payload = await response.json();
    return Array.isArray(payload?.reports) ? payload.reports : [];
}

function getPalletFilterSnapshot() {
    return {
        search: String(document.getElementById('reporting-pallet-search')?.value || '').trim(),
        batchNo: '',
        dateFrom: String(document.getElementById('reporting-pallet-date-from')?.value || '').trim(),
        dateTo: String(document.getElementById('reporting-pallet-date-to')?.value || '').trim(),
        palletType: String(document.getElementById('reporting-pallet-type')?.value || '').trim()
    };
}

function buildPalletQueryParams(filters = getPalletFilterSnapshot()) {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.batchNo) params.set('batch_no', filters.batchNo);
    if (filters.dateFrom) params.set('date_from', filters.dateFrom);
    if (filters.dateTo) params.set('date_to', filters.dateTo);
    if (filters.palletType) params.set('pallet_type', filters.palletType);
    return params.toString();
}

function renderPalletLoading(message = 'Loading pallet report data...') {
    const tbody = document.getElementById('reporting-pallet-table-body');
    if (!tbody) return;
    tbody.innerHTML = `
        <tr>
            <td colspan="7" class="px-6 py-10 text-center text-slate-400">${escapeHtml(message)}</td>
        </tr>
    `;
}

function renderPalletRows() {
    const tbody = document.getElementById('reporting-pallet-table-body');
    const countEl = document.getElementById('reporting-pallet-results-count');
    if (!tbody) return;

    if (countEl) {
        countEl.textContent = `${palletRows.length} row(s)`;
    }

    if (!palletRows.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="px-6 py-10 text-center text-slate-400">No completed pallet rows match the selected filters.</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = palletRows.map((row) => {
        const reportDate = escapeHtml(row?.report_date || '-');
        const batchNo = escapeHtml(row?.batch_no || '-');
        const productName = escapeHtml(row?.product_name || '-');
        const packaging = escapeHtml(row?.packaging_type || '-');
        const palletCode = escapeHtml(row?.pallet_item_code || '-');
        const palletType = escapeHtml(row?.pallet_type || '-');
        const palletQty = escapeHtml(formatPalletQty(row?.pallet_count));

        return `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">${reportDate}</td>
                <td class="px-4 py-3 text-sm font-semibold text-slate-900 whitespace-nowrap">${batchNo}</td>
                <td class="px-4 py-3 text-sm text-slate-700">${productName}</td>
                <td class="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">${packaging}</td>
                <td class="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">${palletCode}</td>
                <td class="px-4 py-3 text-sm text-slate-700">${palletType}</td>
                <td class="px-4 py-3 text-sm text-slate-700 text-right whitespace-nowrap">${palletQty}</td>
            </tr>
        `;
    }).join('');
}

async function fetchPalletReportRows(filters = getPalletFilterSnapshot()) {
    if (palletApiUnavailable) {
        const completedReports = await fetchCompletedPpcReportsForPalletFallback();
        const allRows = extractPalletRowsFromCompletedReports(completedReports);
        return applyClientSidePalletFilters(allRows, filters);
    }

    const query = buildPalletQueryParams(filters);
    const url = query ? `/api/reporting/pallet-reports?${query}` : '/api/reporting/pallet-reports';
    const response = await authenticatedFetch(url);
    if (response.ok) {
        const payload = await response.json();
        return Array.isArray(payload?.rows) ? payload.rows : [];
    }

    if (response.status !== 404) {
        const errorText = await extractErrorMessage(response, 'Failed to load pallet report');
        throw new Error(errorText);
    }

    palletApiUnavailable = true;
    const completedReports = await fetchCompletedPpcReportsForPalletFallback();
    const allRows = extractPalletRowsFromCompletedReports(completedReports);
    return applyClientSidePalletFilters(allRows, filters);
}

async function loadPalletReports() {
    renderPalletLoading();

    try {
        const rows = await fetchPalletReportRows();
        palletRows = rows;
        palletReportsLoaded = true;
        renderPalletRows();
    } catch (error) {
        console.error('Error loading pallet reports:', error);
        renderPalletLoading('Failed to load pallet reports.');
        showToast(error.message || 'Failed to load pallet reports', 'error');
    }
}

function clearPalletFilters() {
    const searchInput = document.getElementById('reporting-pallet-search');
    const dateFromInput = document.getElementById('reporting-pallet-date-from');
    const dateToInput = document.getElementById('reporting-pallet-date-to');
    const palletTypeSelect = document.getElementById('reporting-pallet-type');

    if (searchInput) searchInput.value = '';
    if (dateFromInput) dateFromInput.value = '';
    if (dateToInput) dateToInput.value = '';
    if (palletTypeSelect) palletTypeSelect.value = '';

    void loadPalletReports();
}

async function downloadPalletReportPdf() {
    if (!palletRows.length) {
        throw new Error('No filtered pallet rows found to print');
    }
    const query = buildPalletQueryParams();
    const url = query ? `/api/reporting/pallet-reports/pdf?${query}` : '/api/reporting/pallet-reports/pdf';
    try {
        await downloadPdfFromUrl(url, 'Pallet_Report.pdf');
    } catch (error) {
        const message = String(error?.message || '');
        if (message.toLowerCase().includes('not found')) {
            throw new Error('Pallet Save PDF endpoint is not available on this backend yet. Data view is loaded from completed PPC reports.');
        }
        throw error;
    }
    showToast('Pallet report PDF saved', 'success');
}

async function ensurePalletReportsLoaded() {
    if (palletReportsLoaded) return;
    await loadPalletReports();
}

function getProductionLogFilterSnapshot() {
    return {
        search: String(document.getElementById('reporting-production-logs-search')?.value || '').trim(),
        dateFrom: String(document.getElementById('reporting-production-logs-date-from')?.value || '').trim(),
        dateTo: String(document.getElementById('reporting-production-logs-date-to')?.value || '').trim(),
        packagingType: String(document.getElementById('reporting-production-logs-packaging-type')?.value || '').trim().toUpperCase(),
        sortBy: String(document.getElementById('reporting-production-logs-sort')?.value || 'date-desc').trim()
    };
}

function buildProductionLogQueryParams(filters = getProductionLogFilterSnapshot()) {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.dateFrom) params.set('date_from', filters.dateFrom);
    if (filters.dateTo) params.set('date_to', filters.dateTo);
    if (filters.packagingType) params.set('packaging_type', filters.packagingType);
    if (filters.sortBy && filters.sortBy !== 'date-desc') params.set('sort_by', filters.sortBy);
    return params.toString();
}

function renderProductionLogsLoading(message = 'Loading production logs...') {
    const tbody = document.getElementById('reporting-production-logs-table-body');
    if (!tbody) return;
    tbody.innerHTML = `
        <tr>
            <td colspan="12" class="px-6 py-10 text-center text-slate-400">${escapeHtml(message)}</td>
        </tr>
    `;
}

function renderProductionLogRows() {
    const tbody = document.getElementById('reporting-production-logs-table-body');
    const countEl = document.getElementById('reporting-production-logs-results-count');
    if (!tbody) return;

    if (countEl) {
        countEl.textContent = `${productionLogRows.length} row(s)`;
    }

    if (!productionLogRows.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="12" class="px-6 py-10 text-center text-slate-400">No completed production logs match the selected filters.</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = productionLogRows.map((row) => {
        const productionDate = escapeHtml(isoToDmy(row?.production_date || row?.report_date) || '-');
        const expiryDate = escapeHtml(isoToDmy(row?.expiry_date) || '-');
        const batchNo = escapeHtml(row?.batch_no || '-');
        const productName = escapeHtml(stripProductCodePrefix(row?.product_name) || '-');
        const gtin = escapeHtml(row?.gtin_barcode || '-');
        const packagingType = escapeHtml(row?.packaging_type || '-');
        const productionCounter = escapeHtml(formatPalletQty(row?.production_counter));
        const totalRejection = escapeHtml(formatPalletQty(row?.total_rejection));
        const qcSample = escapeHtml(formatPalletQty(row?.qc_sample));
        const retentionSample = escapeHtml(formatPalletQty(row?.retention_sample));
        const quantityIssued = escapeHtml(formatPalletQty(row?.quantity_issued_to_store));
        const casesProduced = escapeHtml(formatPalletQty(row?.cases_produced));

        return `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">${productionDate}</td>
                <td class="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">${expiryDate}</td>
                <td class="px-4 py-3 text-sm font-semibold text-slate-900 whitespace-nowrap">${batchNo}</td>
                <td class="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">${productName}</td>
                <td class="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">${gtin}</td>
                <td class="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">${packagingType}</td>
                <td class="px-4 py-3 text-sm text-slate-700 text-right whitespace-nowrap">${productionCounter}</td>
                <td class="px-4 py-3 text-sm text-slate-700 text-right whitespace-nowrap">${totalRejection}</td>
                <td class="px-4 py-3 text-sm text-slate-700 text-right whitespace-nowrap">${qcSample}</td>
                <td class="px-4 py-3 text-sm text-slate-700 text-right whitespace-nowrap">${retentionSample}</td>
                <td class="px-4 py-3 text-sm text-slate-700 text-right whitespace-nowrap">${quantityIssued}</td>
                <td class="px-4 py-3 text-sm text-slate-700 text-right whitespace-nowrap">${casesProduced}</td>
            </tr>
        `;
    }).join('');
}

async function fetchProductionLogRows(filters = getProductionLogFilterSnapshot()) {
    if (productionLogsApiUnavailable) {
        const completedReports = await fetchCompletedPpcReportsForPalletFallback();
        const allRows = extractProductionLogRowsFromCompletedReports(completedReports);
        return applyClientSideProductionLogFilters(allRows, filters);
    }

    const query = buildProductionLogQueryParams(filters);
    const url = query ? `/api/reporting/production-logs?${query}` : '/api/reporting/production-logs';
    const response = await authenticatedFetch(url);
    if (response.ok) {
        const payload = await response.json();
        return Array.isArray(payload?.rows) ? payload.rows : [];
    }

    if (response.status !== 404) {
        const errorText = await extractErrorMessage(response, 'Failed to load production logs');
        throw new Error(errorText);
    }

    productionLogsApiUnavailable = true;
    const completedReports = await fetchCompletedPpcReportsForPalletFallback();
    const allRows = extractProductionLogRowsFromCompletedReports(completedReports);
    return applyClientSideProductionLogFilters(allRows, filters);
}

async function loadProductionLogs() {
    renderProductionLogsLoading();

    try {
        const filters = getProductionLogFilterSnapshot();
        const rows = await fetchProductionLogRows(filters);
        productionLogRows = sortProductionLogRows(rows, filters.sortBy);
        productionLogsLoaded = true;
        renderProductionLogRows();
    } catch (error) {
        console.error('Error loading production logs:', error);
        renderProductionLogsLoading('Failed to load production logs.');
        showToast(error.message || 'Failed to load production logs', 'error');
    }
}

function clearProductionLogFilters() {
    const searchInput = document.getElementById('reporting-production-logs-search');
    const dateFromInput = document.getElementById('reporting-production-logs-date-from');
    const dateToInput = document.getElementById('reporting-production-logs-date-to');
    const packagingTypeSelect = document.getElementById('reporting-production-logs-packaging-type');
    const sortSelect = document.getElementById('reporting-production-logs-sort');

    if (searchInput) searchInput.value = '';
    if (dateFromInput) dateFromInput.value = '';
    if (dateToInput) dateToInput.value = '';
    if (packagingTypeSelect) packagingTypeSelect.value = '';
    if (sortSelect) sortSelect.value = 'date-desc';

    void loadProductionLogs();
}

async function downloadProductionLogsPdf() {
    if (!productionLogRows.length) {
        throw new Error('No filtered production log rows found to save');
    }

    const query = buildProductionLogQueryParams();
    const url = query ? `/api/reporting/production-logs/pdf?${query}` : '/api/reporting/production-logs/pdf';
    try {
        await downloadPdfFromUrl(url, 'Production_Logs_Report.pdf');
    } catch (error) {
        const message = String(error?.message || '');
        if (message.toLowerCase().includes('not found')) {
            throw new Error('Production Logs Save PDF endpoint is not available on this backend yet. Data view is loaded from completed PPC reports.');
        }
        throw error;
    }

    showToast('Production logs PDF saved', 'success');
}

async function ensureProductionLogsLoaded() {
    if (productionLogsLoaded) return;
    await loadProductionLogs();
}

function applyReportingSubmenuUi() {
    const combinedBtn = document.getElementById('reporting-submenu-combined');
    const palletBtn = document.getElementById('reporting-submenu-pallet');
    const productionLogsBtn = document.getElementById('reporting-submenu-production-logs');
    const gtinDetailsBtn = document.getElementById('reporting-submenu-gtin-details');
    const combinedView = document.getElementById('reporting-subview-combined');
    const palletView = document.getElementById('reporting-subview-pallet');
    const productionLogsView = document.getElementById('reporting-subview-production-logs');
    const gtinDetailsView = document.getElementById('reporting-subview-gtin-details');

    if (!combinedBtn || !palletBtn || !productionLogsBtn || !gtinDetailsBtn || !combinedView || !palletView || !productionLogsView || !gtinDetailsView) return;

    combinedBtn.className = SUBMENU_INACTIVE_CLASS;
    palletBtn.className = SUBMENU_INACTIVE_CLASS;
    productionLogsBtn.className = SUBMENU_INACTIVE_CLASS;
    gtinDetailsBtn.className = SUBMENU_INACTIVE_CLASS;
    combinedView.classList.add('hidden');
    palletView.classList.add('hidden');
    productionLogsView.classList.add('hidden');
    gtinDetailsView.classList.add('hidden');

    if (activeReportingSubmenu === 'pallet') {
        palletBtn.className = SUBMENU_ACTIVE_CLASS;
        palletView.classList.remove('hidden');
        return;
    }

    if (activeReportingSubmenu === 'production-logs') {
        productionLogsBtn.className = SUBMENU_ACTIVE_CLASS;
        productionLogsView.classList.remove('hidden');
        return;
    }

    if (activeReportingSubmenu === 'gtin-details') {
        gtinDetailsBtn.className = SUBMENU_ACTIVE_CLASS;
        gtinDetailsView.classList.remove('hidden');
        return;
    }

    combinedBtn.className = SUBMENU_ACTIVE_CLASS;
    combinedView.classList.remove('hidden');
}

export function switchReportingSubMenu(submenu) {
    const normalized = String(submenu || '').trim().toLowerCase();
    if (normalized === 'pallet') {
        activeReportingSubmenu = 'pallet';
    } else if (normalized === 'production-logs' || normalized === 'production_logs' || normalized === 'productionlogs') {
        activeReportingSubmenu = 'production-logs';
    } else if (normalized === 'gtin-details' || normalized === 'gtin_details' || normalized === 'gtindetails') {
        activeReportingSubmenu = 'gtin-details';
    } else {
        activeReportingSubmenu = 'combined';
    }

    applyReportingSubmenuUi();

    if (activeReportingSubmenu === 'pallet') {
        void ensurePalletReportsLoaded();
        return;
    }

    if (activeReportingSubmenu === 'production-logs') {
        void ensureProductionLogsLoaded();
        return;
    }

    if (activeReportingSubmenu === 'gtin-details') {
        void ensureGtinDetailsLoaded();
        return;
    }
}

function getSearchableText(batch) {
    return normalizeText([
        batch?.batch_no,
        batch?.item_code,
        batch?.recipe_name,
        batch?.description,
        batch?.date
    ].join(' '));
}

export function applyReportingFilters() {
    const searchInput = document.getElementById('reporting-search');
    const dateFromInput = document.getElementById('reporting-date-from');
    const dateToInput = document.getElementById('reporting-date-to');

    const searchTerm = normalizeText(searchInput?.value);
    const dateFrom = dayStamp(parseFilterDate(dateFromInput?.value));
    const dateTo = dayStamp(parseFilterDate(dateToInput?.value));

    filteredBatches = allBatches.filter((batch) => {
        const searchable = getSearchableText(batch);
        if (searchTerm && !searchable.includes(searchTerm)) return false;

        if (dateFrom !== null || dateTo !== null) {
            const batchDate = dayStamp(parseBatchDate(batch?.date));
            if (batchDate === null) return false;
            if (dateFrom !== null && batchDate < dateFrom) return false;
            if (dateTo !== null && batchDate > dateTo) return false;
        }

        return true;
    });

    renderReportingTableRows();
}

export function clearReportingFilters() {
    const searchInput = document.getElementById('reporting-search');
    const dateFromInput = document.getElementById('reporting-date-from');
    const dateToInput = document.getElementById('reporting-date-to');

    if (searchInput) searchInput.value = '';
    if (dateFromInput) dateFromInput.value = '';
    if (dateToInput) dateToInput.value = '';

    applyReportingFilters();
}

async function fetchProductionBatches() {
    const response = await authenticatedFetch('/api/production-batches');
    if (!response.ok) {
        const errorText = await extractErrorMessage(response, 'Failed to load production batches');
        throw new Error(errorText);
    }
    const payload = await response.json();
    return Array.isArray(payload?.batches) ? payload.batches : [];
}

function renderReportingLoading(message = 'Loading combined batch reports...') {
    const tbody = document.getElementById('reporting-batch-table-body');
    if (!tbody) return;
    tbody.innerHTML = `
        <tr>
            <td colspan="7" class="px-6 py-10 text-center text-slate-400">${escapeHtml(message)}</td>
        </tr>
    `;
}

async function loadCombinedBatchReports() {
    renderReportingLoading();

    try {
        const rows = await fetchProductionBatches();
        allBatches = sortBatches(rows);
        filteredBatches = [...allBatches];

        batchById.clear();
        for (const row of allBatches) {
            batchById.set(String(row?.id ?? ''), row);
        }

        ppcReportIdByBatchNo.clear();
        applyReportingFilters();
    } catch (error) {
        console.error('Error loading combined batch reports:', error);
        renderReportingLoading('Failed to load combined batch reports.');
        showToast(error.message || 'Failed to load combined batch reports', 'error');
    }
}

async function onReportingTableClick(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const action = String(button.dataset.action || '');
    const batchId = String(button.dataset.batchId || '');
    const batch = getBatchById(batchId);
    if (!batch) {
        showToast('Batch data is not available. Refresh and try again.', 'error');
        return;
    }

    setActionButtonBusy(button, true, action === 'all' ? 'Downloading...' : 'Downloading');
    try {
        if (action === 'all') {
            await downloadAllInOrder(batch);
            return;
        }
        await runSingleAction(action, batch);
    } catch (error) {
        console.error(`[Reporting] ${action} action failed:`, error);
        showToast(error.message || 'Download failed', 'error');
    } finally {
        setActionButtonBusy(button, false);
    }
}

async function loadGtinDetails() {
    const tbody = document.getElementById('reporting-gtin-table-body');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-10 text-center text-slate-400">Loading product GTIN details...</td></tr>';
    }

    try {
        const response = await authenticatedFetch('/api/reporting/product-gtin-details');
        if (!response.ok) {
            const errorText = await extractErrorMessage(response, 'Failed to load GTIN details');
            throw new Error(errorText);
        }
        const data = await response.json();
        gtinDetailsRows = data.rows || [];
        gtinDetailsLoaded = true;
        gtinDetailsApiUnavailable = false;
        applyGtinDetailsFilter();
    } catch (error) {
        console.error('Error loading GTIN details:', error);
        gtinDetailsApiUnavailable = true;
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-10 text-center text-red-500">${error.message || 'Failed to load GTIN details'}</td></tr>`;
        }
    }
}

function applyGtinDetailsFilter() {
    const searchInput = document.getElementById('reporting-gtin-search');
    const searchTerm = normalizeText(searchInput?.value);

    if (!searchTerm) {
        gtinDetailsFiltered = [...gtinDetailsRows];
    } else {
        gtinDetailsFiltered = gtinDetailsRows.filter(row => {
            const searchable = normalizeText([
                row.item_code,
                row.recipe_code,
                row.product_name,
                row.volume,
                row.packaging_type,
                row.gtin,
            ].join(' '));
            return searchable.includes(searchTerm);
        });
    }

    renderGtinDetailsTable();
}

function renderGtinDetailsTable() {
    const tbody = document.getElementById('reporting-gtin-table-body');
    const countEl = document.getElementById('reporting-gtin-results-count');

    if (countEl) {
        countEl.textContent = `${gtinDetailsFiltered.length} product(s)`;
    }

    if (!tbody) return;

    if (gtinDetailsFiltered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-10 text-center text-slate-400">No products found.</td></tr>';
        return;
    }

    const rows = gtinDetailsFiltered.map((row, index) => {
        const itemCode = row.item_code || '-';
        const product = row.product_name || '-';
        const volume = row.volume || '-';
        const packType = row.packaging_type || '-';
        const gtin = row.gtin || '-';
        const packClass = packType === 'CAN'
            ? 'bg-amber-100 text-amber-800'
            : 'bg-blue-100 text-blue-800';

        return `<tr class="hover:bg-slate-50 transition-colors">
            <td class="px-4 py-3 text-sm text-slate-500 text-center">${index + 1}</td>
            <td class="px-4 py-3 text-sm text-slate-700 font-medium">${escapeHtml(itemCode)}</td>
            <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(product)}</td>
            <td class="px-4 py-3 text-sm text-slate-700 text-center">${escapeHtml(volume)}</td>
            <td class="px-4 py-3 text-center"><span class="inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full ${packClass}">${escapeHtml(packType)}</span></td>
            <td class="px-4 py-3 text-sm text-slate-700 font-mono">${escapeHtml(gtin)}</td>
        </tr>`;
    });

    tbody.innerHTML = rows.join('');
}

async function ensureGtinDetailsLoaded() {
    if (gtinDetailsLoaded) return;
    await loadGtinDetails();
}

async function downloadGtinDetailsPdf() {
    const response = await authenticatedFetch('/api/reporting/product-gtin-details/pdf');
    if (!response.ok) {
        const message = await extractErrorMessage(response, 'Failed to generate GTIN details PDF');
        throw new Error(message);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const disposition = response.headers.get('Content-Disposition') || '';
    const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
    a.download = filenameMatch ? filenameMatch[1] : 'Product_GTIN_Details.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('GTIN details PDF saved', 'success');
}

function bindReportingListeners() {
    if (listenersBound) return;

    const searchInput = document.getElementById('reporting-search');
    const dateFromInput = document.getElementById('reporting-date-from');
    const dateToInput = document.getElementById('reporting-date-to');
    const refreshBtn = document.getElementById('reporting-btn-refresh');
    const clearBtn = document.getElementById('reporting-btn-clear');
    const tbody = document.getElementById('reporting-batch-table-body');
    const combinedTabBtn = document.getElementById('reporting-submenu-combined');
    const palletTabBtn = document.getElementById('reporting-submenu-pallet');
    const productionLogsTabBtn = document.getElementById('reporting-submenu-production-logs');
    const gtinDetailsTabBtn = document.getElementById('reporting-submenu-gtin-details');
    const palletSearchInput = document.getElementById('reporting-pallet-search');
    const palletDateFromInput = document.getElementById('reporting-pallet-date-from');
    const palletDateToInput = document.getElementById('reporting-pallet-date-to');
    const palletTypeSelect = document.getElementById('reporting-pallet-type');
    const palletRefreshBtn = document.getElementById('reporting-pallet-btn-refresh');
    const palletClearBtn = document.getElementById('reporting-pallet-btn-clear');
    const palletPrintBtn = document.getElementById('reporting-pallet-btn-print');
    const productionLogsSearchInput = document.getElementById('reporting-production-logs-search');
    const productionLogsDateFromInput = document.getElementById('reporting-production-logs-date-from');
    const productionLogsDateToInput = document.getElementById('reporting-production-logs-date-to');
    const productionLogsPackagingTypeSelect = document.getElementById('reporting-production-logs-packaging-type');
    const productionLogsSortSelect = document.getElementById('reporting-production-logs-sort');
    const productionLogsRefreshBtn = document.getElementById('reporting-production-logs-btn-refresh');
    const productionLogsClearBtn = document.getElementById('reporting-production-logs-btn-clear');
    const productionLogsSaveBtn = document.getElementById('reporting-production-logs-btn-save');
    const gtinSearchInput = document.getElementById('reporting-gtin-search');
    const gtinRefreshBtn = document.getElementById('reporting-gtin-btn-refresh');
    const gtinSaveBtn = document.getElementById('reporting-gtin-btn-save');

    if (
        !searchInput || !dateFromInput || !dateToInput || !refreshBtn || !clearBtn || !tbody || !combinedTabBtn || !palletTabBtn || !productionLogsTabBtn || !gtinDetailsTabBtn
        || !palletSearchInput || !palletDateFromInput || !palletDateToInput || !palletTypeSelect
        || !palletRefreshBtn || !palletClearBtn || !palletPrintBtn
        || !productionLogsSearchInput || !productionLogsDateFromInput || !productionLogsDateToInput || !productionLogsPackagingTypeSelect || !productionLogsSortSelect
        || !productionLogsRefreshBtn || !productionLogsClearBtn || !productionLogsSaveBtn
        || !gtinSearchInput || !gtinRefreshBtn || !gtinSaveBtn
    ) {
        return;
    }

    listenersBound = true;

    searchInput.addEventListener('input', applyReportingFiltersDebounced);
    dateFromInput.addEventListener('change', applyReportingFilters);
    dateToInput.addEventListener('change', applyReportingFilters);

    refreshBtn.addEventListener('click', () => {
        void loadCombinedBatchReports();
    });
    clearBtn.addEventListener('click', clearReportingFilters);
    combinedTabBtn.addEventListener('click', () => switchReportingSubMenu('combined'));
    palletTabBtn.addEventListener('click', () => switchReportingSubMenu('pallet'));
    productionLogsTabBtn.addEventListener('click', () => switchReportingSubMenu('production-logs'));
    gtinDetailsTabBtn.addEventListener('click', () => switchReportingSubMenu('gtin-details'));

    palletSearchInput.addEventListener('input', loadPalletReportsDebounced);
    palletDateFromInput.addEventListener('change', () => {
        void loadPalletReports();
    });
    palletDateToInput.addEventListener('change', () => {
        void loadPalletReports();
    });
    palletTypeSelect.addEventListener('change', () => {
        void loadPalletReports();
    });
    palletRefreshBtn.addEventListener('click', () => {
        void loadPalletReports();
    });
    palletClearBtn.addEventListener('click', clearPalletFilters);
    palletPrintBtn.addEventListener('click', async () => {
        setActionButtonBusy(palletPrintBtn, true, 'Saving...');
        try {
            await downloadPalletReportPdf();
        } catch (error) {
            console.error('Error saving pallet report PDF:', error);
            showToast(error.message || 'Failed to save pallet report', 'error');
        } finally {
            setActionButtonBusy(palletPrintBtn, false);
        }
    });

    productionLogsSearchInput.addEventListener('input', loadProductionLogsDebounced);
    productionLogsDateFromInput.addEventListener('change', () => {
        void loadProductionLogs();
    });
    productionLogsDateToInput.addEventListener('change', () => {
        void loadProductionLogs();
    });
    productionLogsPackagingTypeSelect.addEventListener('change', () => {
        void loadProductionLogs();
    });
    productionLogsSortSelect.addEventListener('change', () => {
        void loadProductionLogs();
    });
    productionLogsRefreshBtn.addEventListener('click', () => {
        void loadProductionLogs();
    });
    productionLogsClearBtn.addEventListener('click', clearProductionLogFilters);
    productionLogsSaveBtn.addEventListener('click', async () => {
        setActionButtonBusy(productionLogsSaveBtn, true, 'Saving...');
        try {
            await downloadProductionLogsPdf();
        } catch (error) {
            console.error('Error saving production logs PDF:', error);
            showToast(error.message || 'Failed to save production logs PDF', 'error');
        } finally {
            setActionButtonBusy(productionLogsSaveBtn, false);
        }
    });

    gtinSearchInput.addEventListener('input', filterGtinDetailsDebounced);
    gtinRefreshBtn.addEventListener('click', () => {
        gtinDetailsLoaded = false;
        void loadGtinDetails();
    });
    gtinSaveBtn.addEventListener('click', async () => {
        setActionButtonBusy(gtinSaveBtn, true, 'Saving...');
        try {
            await downloadGtinDetailsPdf();
        } catch (error) {
            console.error('Error saving GTIN details PDF:', error);
            showToast(error.message || 'Failed to save GTIN details PDF', 'error');
        } finally {
            setActionButtonBusy(gtinSaveBtn, false);
        }
    });

    tbody.addEventListener('click', (event) => {
        void onReportingTableClick(event);
    });
}

async function ensureReportingTemplateMounted() {
    const host = document.getElementById('view-reporting');
    if (!host) {
        throw new Error('Reporting view container not found');
    }

    if (host.dataset.reportingMounted === '1') return;

    const response = await fetch(TEMPLATE_URL, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`Failed to load reporting template (${response.status})`);
    }

    const html = await response.text();
    host.innerHTML = html;
    host.dataset.reportingMounted = '1';
}

export async function loadReportingPage() {
    try {
        await ensureReportingTemplateMounted();
    } catch (error) {
        console.error('Failed to mount reporting template:', error);
        showToast(error.message || 'Failed to load reporting view', 'error');
        return;
    }

    bindReportingListeners();
    palletRows = [];
    palletReportsLoaded = false;
    palletApiUnavailable = false;
    productionLogRows = [];
    productionLogsLoaded = false;
    productionLogsApiUnavailable = false;
    gtinDetailsRows = [];
    gtinDetailsFiltered = [];
    gtinDetailsLoaded = false;
    gtinDetailsApiUnavailable = false;
    renderPalletLoading();
    renderProductionLogsLoading();
    switchReportingSubMenu('combined');
    await loadCombinedBatchReports();
}
