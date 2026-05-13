
import { showToast } from '../utils.js?v=20260129a';
import { authenticatedFetch, hasAnyRole } from '../auth.js?v=20260428b';
import { getRtdRatio, getBottleSizeInfo } from './recipes.js?v=20260216b';

const STYLE_ID = 'ppc-corrected-style';
const state = {
    pending: [],
    completed: [],
    batchHistoryCache: {},
    current: null,
    packaging: 'PET',
    packagingLocked: false,
    editOverride: false,
    readonly: false,
    previousDay: {
        production_counter: 0,
        checkmate_rejected: 0,
        line_damaged: 0,
        rejected_preform: 0,
        pet_types: [],
        pet_counter_extras: [],
        pet_counter_values: [],
        loose_cases_added: 0,
        cases_produced: 0,
        expiry_date: ''
    }
};
const AUTOSAVE_DELAY_MS = 800;
let autoSaveTimer = null;
let autoSaveInFlight = false;
let autoSaveDirty = false;
let autoSaveLastErrorAt = 0;
let materialsModalEscHandler = null;
const RETENTION_MANUAL_ATTR = 'data-manual-override';
const EMPTY_CAN_MANUAL_ATTR = 'data-empty-can-manual-override';

function isLockedStatus(status) {
    const s = (status || '').toLowerCase();
    return s === 'completed' || s === 'partial';
}

function clearAutoSaveTimer() {
    if (!autoSaveTimer) return;
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
}

function shouldAutoSaveTarget(target) {
    if (!(target instanceof Element)) return false;
    if (!target.matches('input,textarea,select')) return false;
    if (target.disabled || target.readOnly) return false;
    if (target.classList.contains('ppc-read')) return false;
    if (['ppc-oee', 'ppc-oee-a', 'ppc-oee-den', 'ppc-oee-b', 'ppc-target'].includes(target.id)) return false;
    return true;
}

function scheduleAutoSave() {
    if (!state.current?._id || state.readonly) return;
    if (isLockedStatus(state.current?.status) && !state.editOverride) return;
    autoSaveDirty = true;
    clearAutoSaveTimer();
    autoSaveTimer = setTimeout(() => {
        autoSaveTimer = null;
        void flushAutoSave();
    }, AUTOSAVE_DELAY_MS);
}

async function flushAutoSave(force = false) {
    if (!state.current?._id || state.readonly) return;
    if (isLockedStatus(state.current?.status) && !state.editOverride) return;
    if (!autoSaveDirty && !force) return;
    if (autoSaveInFlight) {
        autoSaveDirty = true;
        return;
    }
    autoSaveInFlight = true;
    autoSaveDirty = false;
    recalcDownTimeTotal();
    const body = payload('pending');
    try {
        const res = await authenticatedFetch(`/api/production-control-reports/${state.current._id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!res.ok) {
            autoSaveDirty = true;
            const now = Date.now();
            if (now - autoSaveLastErrorAt > 15000) {
                showToast('Auto-save failed', 'error');
                autoSaveLastErrorAt = now;
            }
            return;
        }
        const updated = await res.json();
        await hydrateItemCodes([updated]);
        state.current = { ...state.current, ...updated };
    } catch (_e) {
        autoSaveDirty = true;
        const now = Date.now();
        if (now - autoSaveLastErrorAt > 15000) {
            showToast('Auto-save failed', 'error');
            autoSaveLastErrorAt = now;
        }
    } finally {
        autoSaveInFlight = false;
        if (autoSaveDirty) scheduleAutoSave();
    }
}

async function waitForAutoSaveIdle() {
    let safety = 0;
    while (autoSaveInFlight && safety < 100) {
        await new Promise((resolve) => setTimeout(resolve, 30));
        safety += 1;
    }
}

function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
    :root{
      --ppc-bg:#eef4fb;
      --ppc-card:#ffffff;
      --ppc-head:#e2e8f0;
      --ppc-border:#cbd5e1;
      --ppc-border-strong:#94a3b8;
      --ppc-text:#0f172a;
      --ppc-muted:#475569;
      --ppc-focus:#2563eb;
    }
    .ppc-btn{border:1px solid var(--ppc-border-strong);background:#fff;color:#0f172a;padding:7px 12px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;transition:all .18s ease}
    .ppc-btn:hover{background:#f8fafc;border-color:#64748b}
    .ppc-btn-success{background:#166534;color:#fff;border-color:#166534}
    .ppc-btn-success:hover{background:#14532d;border-color:#14532d}
    .ppc-btn-primary{background:#0f172a;color:#fff;border-color:#0f172a}
    .ppc-btn-primary:hover{background:#1e293b}
    .ppc-pack.active{background:#0f172a;color:#fff;border-color:#0f172a}
    .ppc-card{display:flex;justify-content:space-between;gap:10px;border:1px solid var(--ppc-border);background:#fff;padding:12px;border-radius:10px;box-shadow:0 4px 14px rgba(15,23,42,.06)}
    .ppc-meta{font-size:12px;color:var(--ppc-muted)}
    .ppc-title{font-size:14px;font-weight:700;color:var(--ppc-text)}
    .ppc-sheet-wrap{border:1px solid var(--ppc-border);border-radius:12px;background:linear-gradient(180deg,#f8fbff 0%,var(--ppc-bg) 100%);padding:12px;overflow:auto;box-shadow:0 10px 25px rgba(15,23,42,.10)}
    .ppc-sheet{min-width:980px;font-family:"Segoe UI",Tahoma,Geneva,Verdana,sans-serif;color:var(--ppc-text)}
    .ppc-table{width:100%;border-collapse:collapse;table-layout:fixed;border:1px solid var(--ppc-border-strong);background:var(--ppc-card)}
    .ppc-table th,.ppc-table td{border:1px solid var(--ppc-border);padding:6px 8px;font-size:12px;vertical-align:middle}
    .ppc-table th{font-weight:700;text-align:center;background:var(--ppc-head);color:#1e293b}
    .ppc-header-title{font-size:18px;font-weight:800;text-align:center}
    .ppc-page-title{font-size:32px;line-height:1.1;font-weight:900;text-align:center;color:#0f172a;letter-spacing:.4px;margin:8px 0 12px}
    .ppc-doc{font-family:"Times New Roman",serif;font-size:14px}
    .ppc-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin:10px 0;font-weight:700}
    .ppc-row-2{display:grid;grid-template-columns:1fr 220px;gap:10px;margin:8px 0}
    .ppc-top-grid{margin-top:8px}
    .ppc-top-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin:6px 0}
    .ppc-top-item{display:grid;grid-template-columns:150px 1fr;align-items:center;column-gap:8px;font-weight:700}
    .ppc-top-label{white-space:nowrap;color:#374151;text-align:left}
    .ppc-top-input{width:100%;box-sizing:border-box;border:1px solid var(--ppc-border);background:#fff;min-height:32px;padding:6px 8px;font-size:13px;border-radius:8px;transition:border-color .18s ease,box-shadow .18s ease,background-color .18s ease}
    .ppc-top-input:focus{outline:none;border-color:var(--ppc-focus);box-shadow:0 0 0 2px rgba(37,99,235,.16)}
    .ppc-top-input.ppc-read{background:#f1f5f9;color:#334155}
    .ppc-top-ratio{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:6px}
    .ppc-target-hidden{position:absolute;left:-10000px;width:1px;height:1px;opacity:0;pointer-events:none}
    .ppc-inline-note{font-size:14px;font-style:italic;color:#334155;margin:8px 0 4px}
    .ppc-grid{display:grid;grid-template-columns:58% 40%;gap:2%;margin:10px 0}
    .ppc-field{font-size:14px;font-weight:700;margin:8px 0;color:#1f2937}
    .ppc-field-row{display:grid;grid-template-columns:220px 110px;align-items:center;gap:8px;margin:8px 0}
    .ppc-field-row-wide{grid-template-columns:220px minmax(0,1fr)}
    .ppc-field-label{font-size:14px;font-weight:700;color:#1f2937;white-space:nowrap}
    .ppc-field-row .ppc-soft.short{width:100%}
    .ppc-counter-group{display:grid;grid-template-columns:210px;column-gap:6px;align-items:center;justify-content:start;min-width:0}
    .ppc-counter-group.has-extra{grid-template-columns:145px minmax(0,1fr)}
    .ppc-counter-group.has-total{grid-template-columns:145px 145px}
    .ppc-counter-group.has-extra.has-total{grid-template-columns:145px minmax(0,1fr) 145px}
    .ppc-counter-group .ppc-soft.short{width:210px;min-height:28px;padding:4px 6px;font-size:12px;font-weight:400;justify-self:start}
    .ppc-counter-group.has-extra .ppc-soft.short{width:145px}
    .ppc-counter-extras-wrap{display:flex;align-items:center;min-width:145px;width:auto}
    .ppc-counter-group.has-extra .ppc-counter-extras-wrap{width:auto;min-width:145px}
    .ppc-counter-total-wrap{display:flex;align-items:center;min-width:0;width:145px}
    .ppc-counter-total-wrap .ppc-input{min-height:28px;padding:4px 6px;font-size:12px}
    .ppc-counter-extras-wrap .ppc-pallet-columns{overflow-x:auto;overflow-y:hidden}
    .ppc-yield-eqn{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
    .ppc-yield-wrap{display:flex;flex-direction:column;gap:4px}
    .ppc-yield-frac{display:grid;grid-template-rows:auto 1px auto;justify-items:center;min-width:110px}
    .ppc-yield-frac .ppc-soft.short{width:110px}
    .ppc-yield-line{width:110px;height:1px;background:var(--ppc-border-strong);margin:3px 0}
    .ppc-continue-box{margin:8px 0;border:1px solid var(--ppc-border);border-radius:8px;background:#f8fafc;padding:8px}
    .ppc-continue-toggle{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;color:#1e293b}
    .ppc-continue-toggle input{margin:0}
    .ppc-continue-row{display:flex;align-items:center;gap:4px}
    .ppc-continue-sign{display:inline-flex;align-items:center;justify-content:center;width:18px;font-weight:700;color:#334155}
    .ppc-continue-row .ppc-input{min-height:28px;padding:4px 6px;font-size:12px}
    .ppc-input,.ppc-text{width:100%;box-sizing:border-box;border:1px solid var(--ppc-border);background:#fff;min-height:32px;padding:6px 8px;font-size:13px;border-radius:6px;transition:border-color .18s ease,box-shadow .18s ease,background-color .18s ease}
    .ppc-soft{border:1px solid var(--ppc-border);background:#fff;min-height:32px;font-size:14px;font-weight:700;outline:none;width:180px;border-radius:6px;padding:4px 8px;transition:border-color .18s ease,box-shadow .18s ease}
    .ppc-input:focus,.ppc-text:focus,.ppc-soft:focus{outline:none;border-color:var(--ppc-focus);box-shadow:0 0 0 2px rgba(37,99,235,.16)}
    .ppc-soft.short{width:100px}
    .ppc-read{background:#f1f5f9;color:#334155}
    .ppc-hidden{display:none!important}
    .ppc-tools{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:10px;padding:10px;border:1px solid var(--ppc-border);border-radius:10px;background:#f8fafc}
    .ppc-left,.ppc-right{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
    .ppc-chip{border:1px solid var(--ppc-border-strong);background:#fff;padding:6px 10px;border-radius:999px;font-size:12px;font-weight:700;color:#0f172a}
    .ppc-bottom{display:grid;grid-template-columns:40% 60%;margin-top:10px}
    .ppc-notes{border:1px solid var(--ppc-border-strong);border-left:0;background:#fff}
    .ppc-note-head{font-size:13px;padding:8px 10px;border-bottom:1px solid var(--ppc-border);font-weight:700;background:#f8fafc}
    .ppc-sign{display:grid;grid-template-columns:1fr 1fr 1fr;margin-top:12px;font-size:12px;font-weight:700;text-align:center}
    .ppc-dt-time-wrap{display:flex;align-items:center;gap:6px}
    .ppc-dt-time-wrap .ppc-dt-t{flex:1}
    .ppc-dt-actions{display:flex;align-items:center;gap:4px}
    .ppc-dt-table col.ppc-dt-col-machine{width:16%}
    .ppc-dt-table col.ppc-dt-col-reason{width:70%}
    .ppc-dt-table col.ppc-dt-col-job{width:6%}
    .ppc-dt-table col.ppc-dt-col-time{width:8%}
    .ppc-dt-table .ppc-dt-time-wrap{gap:4px}
    .ppc-dt-table .ppc-dt-actions{gap:2px}
    .ppc-dt-table .ppc-dt-actions .ppc-icon-btn{width:18px;height:18px;font-size:10px}
    .ppc-icon-btn{width:22px;height:22px;border:1px solid var(--ppc-border-strong);border-radius:4px;background:#fff;color:#0f172a;display:inline-flex;align-items:center;justify-content:center;font-size:12px;line-height:1;cursor:pointer;padding:0}
    .ppc-icon-btn:hover{background:#f1f5f9}
    .ppc-pallet-table th,.ppc-pallet-table td{padding:4px 6px}
    .ppc-pallet-table th:first-child{width:180px}
    .ppc-hidden-pallet-total{display:none}
    .ppc-pallet-columns{display:flex;gap:6px;align-items:flex-start;justify-content:flex-start;overflow-x:auto;padding:1px 0}
    .ppc-pallet-count{flex:0 0 210px;min-width:210px;max-width:210px;width:210px}
    .ppc-pallet-count .ppc-input{min-height:28px;padding:4px 6px;font-size:12px}
    .ppc-pallet-type{flex:0 0 210px;min-width:210px;max-width:210px;width:210px}
    .ppc-pallet-type-entry{display:grid;grid-template-columns:minmax(0,1fr) 40px;gap:4px;align-items:center}
    .ppc-pallet-type .ppc-input{min-height:28px;padding:4px 6px;font-size:12px}
    .ppc-pet-counter-extra{flex:0 0 210px;min-width:210px;max-width:210px;width:210px}
    .ppc-pet-counter-extra .ppc-input{min-height:28px;padding:4px 6px;font-size:12px}
    .ppc-pet-loose-extra{flex:0 0 210px;min-width:210px;max-width:210px;width:210px}
    .ppc-pet-loose-extra .ppc-input{min-height:28px;padding:4px 6px;font-size:12px}
    .ppc-pet-loose-main{flex:0 0 145px;min-width:145px;max-width:145px;width:145px}
    #ppc-loose-group{grid-template-columns:145px}
    #ppc-loose-group.has-extra{grid-template-columns:145px 145px}
    #ppc-loose-group.has-total{grid-template-columns:145px 145px}
    #ppc-loose-group.has-extra.has-total{grid-template-columns:145px 145px 145px}
    #ppc-loose-group .ppc-counter-extras-wrap{width:145px}
    .ppc-pet-loose-types .ppc-pallet-type{flex:0 0 145px;min-width:145px;max-width:145px;width:145px}
    #ppc-pet-pallet-counts .ppc-pallet-count{flex:0 0 145px;min-width:145px;max-width:145px;width:145px}
    #ppc-pet-pallet-types .ppc-pallet-type{flex:0 0 145px;min-width:145px;max-width:145px;width:145px}
    #ppc-pet-pallet-rows .ppc-pallet-entry{min-width:145px;max-width:145px;grid-template-columns:minmax(0,1fr) 52px 32px}
    #ppc-pet-counter-extras .ppc-pet-counter-extra{flex:0 0 145px;min-width:145px;max-width:145px;width:145px}
    #ppc-pet-loose-extras .ppc-pet-loose-extra{flex:0 0 145px;min-width:145px;max-width:145px;width:145px}
    #ppc-pet-counter-extras,#ppc-pet-loose-extras,#ppc-pet-pallet-counts,#ppc-pet-pallet-types,#ppc-pet-loose-types{gap:4px}
    #ppc-pet-right .ppc-pet-loose-main{flex:0 0 112px;min-width:112px;max-width:112px;width:112px}
    #ppc-pet-right #ppc-loose-group{grid-template-columns:112px}
    #ppc-pet-right #ppc-loose-group.has-extra{grid-template-columns:112px 112px}
    #ppc-pet-right #ppc-loose-group.has-total{grid-template-columns:112px 112px}
    #ppc-pet-right #ppc-loose-group.has-extra.has-total{grid-template-columns:112px 112px 112px}
    #ppc-pet-right #ppc-loose-group .ppc-counter-extras-wrap{width:112px}
    #ppc-pet-right #ppc-pet-loose-extras .ppc-pet-loose-extra{flex:0 0 112px;min-width:112px;max-width:112px;width:112px}
    #ppc-pet-right #ppc-pet-loose-total-wrap{width:112px}
    #ppc-pet-right #ppc-pet-loose-types .ppc-pallet-type{flex:0 0 112px;min-width:112px;max-width:112px;width:112px}
    #ppc-pet-right #ppc-pet-loose-types .ppc-pallet-type-entry{grid-template-columns:minmax(0,1fr) 36px}
    #ppc-pet-pallet-rows .ppc-pallet-actions .ppc-icon-btn,
    #ppc-pet-pallet-types .ppc-pallet-actions .ppc-icon-btn,
    #ppc-pet-loose-types .ppc-pallet-actions .ppc-icon-btn{width:16px;height:16px;font-size:9px}
    .ppc-pallet-entry{display:grid;grid-template-columns:minmax(0,1fr) 80px 40px;gap:4px;align-items:center;min-width:210px;max-width:210px}
    .ppc-pallet-entry .ppc-input{min-height:28px;padding:4px 6px;font-size:12px}
    .ppc-pallet-actions{display:flex;align-items:center;gap:4px;height:28px}
    .ppc-pallet-actions .ppc-icon-btn{width:18px;height:18px;font-size:10px}
    .ppc-materials-overlay{position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:flex-start;justify-content:center;padding:24px 14px;z-index:10050;overflow:auto}
    .ppc-materials-modal{width:min(880px,96vw);background:#fff;border:1px solid var(--ppc-border);border-radius:12px;box-shadow:0 20px 50px rgba(15,23,42,.3);overflow:hidden}
    .ppc-materials-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding:14px 16px;border-bottom:1px solid var(--ppc-border);background:#f8fafc}
    .ppc-materials-title{margin:0;font-size:18px;font-weight:800;color:#0f172a}
    .ppc-materials-meta{margin-top:4px;font-size:12px;color:#334155}
    .ppc-materials-close{width:30px;height:30px;border:1px solid var(--ppc-border-strong);background:#fff;border-radius:8px;font-size:18px;line-height:1;cursor:pointer;color:#1f2937}
    .ppc-materials-close:hover{background:#f1f5f9}
    .ppc-materials-body{padding:14px 16px}
    .ppc-materials-table{width:100%;border-collapse:collapse;table-layout:fixed}
    .ppc-materials-table th,.ppc-materials-table td{border:1px solid var(--ppc-border);padding:8px 10px;font-size:13px;vertical-align:top}
    .ppc-materials-table th{background:var(--ppc-head);font-weight:700;text-align:left;color:#1e293b;width:38%}
    .ppc-materials-value{font-weight:700;color:#0f172a}
    .ppc-materials-sub{font-weight:400;color:#334155}
    .ppc-materials-note{margin-top:10px;font-size:12px;color:#475569}
    @media (max-width:980px){
      .ppc-row,.ppc-row-2,.ppc-grid,.ppc-bottom,.ppc-field-row,.ppc-top-row{grid-template-columns:1fr}
      .ppc-counter-group,.ppc-counter-group.has-extra{grid-template-columns:1fr;row-gap:8px}
      .ppc-counter-group .ppc-soft.short{width:100%}
      .ppc-counter-extras-wrap{width:100%}
      .ppc-table th,.ppc-table td{font-size:11px;padding:5px 6px}
      .ppc-soft{width:100%}
      .ppc-soft.short{width:100%}
      .ppc-notes{border-left:1px solid var(--ppc-border-strong);border-top:0}
      .ppc-pallet-columns{display:grid;grid-template-columns:1fr}
      .ppc-pallet-table th:first-child{width:auto}
      .ppc-pallet-count,.ppc-pallet-entry,.ppc-pallet-type{min-width:0;max-width:none}
      .ppc-pallet-type-entry{grid-template-columns:minmax(0,1fr) 40px}
      .ppc-pallet-entry{grid-template-columns:minmax(0,1fr) 80px 40px}
      .ppc-pallet-actions{justify-content:flex-end}
      .ppc-materials-overlay{padding:14px 8px}
      .ppc-materials-head{padding:12px}
      .ppc-materials-body{padding:10px}
      .ppc-materials-table th,.ppc-materials-table td{font-size:12px;padding:7px 8px}
    }
    `;
    document.head.appendChild(s);
}

const id = (x) => document.getElementById(x);
const v = (x) => (id(x)?.value ?? '').toString().trim();
const sv = (x, y) => { if (id(x)) id(x).value = y ?? ''; };
const n = (x) => { const q = parseFloat(x); return Number.isFinite(q) ? q : 0; };
const optionalInt = (x) => {
    const raw = v(x);
    if (!raw) return null;
    const q = parseFloat(raw);
    if (!Number.isFinite(q)) return null;
    return Math.max(0, Math.round(q));
};
const d = (x) => {
    if (!x) return '';
    if (typeof x === 'string') {
        const m = x.match(/^(\d{4}-\d{2}-\d{2})/);
        if (m) return m[1];
        const m2 = x.match(/^(\d{2})-(\d{2})-(\d{4})/);
        if (m2) return `${m2[3]}-${m2[2]}-${m2[1]}`;
    }
    const z = (x instanceof Date) ? x : new Date(String(x));
    if (Number.isNaN(z.getTime())) return '';
    const yyyy = z.getFullYear();
    const mm = String(z.getMonth() + 1).padStart(2, '0');
    const dd = String(z.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};
const displayDate = (x) => {
    const iso = d(x);
    if (!iso) return '';
    const [yy, mm, dd] = iso.split('-');
    return `${dd}-${mm}-${yy}`;
};

function normalizeNumberArray(value) {
    if (Array.isArray(value)) return value.map((item) => n(item)).filter((item) => Number.isFinite(item));
    const txt = (value ?? '').toString().trim();
    if (!txt) return [];
    return txt.split(';').map((part) => n(part.trim())).filter((item) => Number.isFinite(item));
}

function normalizeTypeArray(value) {
    if (Array.isArray(value)) {
        return value
            .map((item) => (item ?? '').toString().trim())
            .filter((item) => item && !/^[+\-]+$/.test(item));
    }
    return normalizePalletTypeList(value)
        .map((item) => (item ?? '').toString().trim())
        .filter((item) => item && !/^[+\-]+$/.test(item));
}

function detectReportVolumeMl(report = {}) {
    const info = getBottleSizeInfo(report?.recipe_name || report?.product_name || '');
    if (info?.sizeMl) return info.sizeMl;
    const txt = `${report?.recipe_name || ''} ${report?.product_name || ''}`.toLowerCase();
    if (/2[\.,]5\s*l/.test(txt)) return 2500;
    const mlMatch = txt.match(/(\d{2,4})\s*ml/);
    if (mlMatch) return parseInt(mlMatch[1], 10) || 0;
    return 0;
}

function getReportCounterValues(report = {}) {
    const base = n(report?.production_counter || 0);
    const extras = normalizeNumberArray(report?.production_counter_type_values);
    return [base, ...extras];
}

function getReportProductionCounterTotal(report = {}) {
    const packaging = detectPackaging(report);
    if (packaging === 'PET') return getReportCounterValues(report).reduce((sum, value) => sum + n(value), 0);
    return n(report?.production_counter || 0);
}

function getPetCounterTypeSums(report = {}) {
    const counters = getReportCounterValues(report);
    const types = normalizeTypeArray(report?.bottle_pallet_type || '');
    let withLogo = 0;
    let withoutLogo = 0;
    counters.forEach((counter, idx) => {
        const type = (types[idx] || '').toUpperCase();
        if (type.includes('LOCAL')) withLogo += n(counter);
        if (type.includes('DVO') || type.includes('DNO')) withoutLogo += n(counter);
    });
    return { withLogo, withoutLogo };
}

function getPalletUsage(report = {}) {
    const packaging = detectPackaging(report);
    const mixRaw = packaging === 'CAN' ? report?.can_pallet_size : report?.bottle_pallet_size;
    const entries = normalizePalletMix(mixRaw);
    const grouped = new Map();
    entries.forEach((entry) => {
        const count = n(entry?.count);
        if (count <= 0) return;
        const label = (entry?.size || entry?.type || 'Pallets').toString().trim() || 'Pallets';
        grouped.set(label, (grouped.get(label) || 0) + count);
    });

    let breakdown = Array.from(grouped.entries()).map(([label, count]) => ({ label, count }));
    let total = breakdown.reduce((sum, row) => sum + n(row.count), 0);

    if (!breakdown.length) {
        const fallback = packaging === 'CAN'
            ? n(report?.filled_can_pallets || 0)
            : n(report?.filled_bottle_pallets || 0);
        if (fallback > 0) {
            breakdown = [{ label: 'Pallets', count: fallback }];
            total = fallback;
        }
    }

    // Always display Euro pallets first when present.
    const isEuro = (label) => {
        const txt = (label || '').toString().toLowerCase();
        return txt.includes('euro') || txt.includes('1200 x 800') || txt.includes('1200x800');
    };
    breakdown = breakdown.sort((a, b) => {
        const aEuro = isEuro(a?.label);
        const bEuro = isEuro(b?.label);
        if (aEuro && !bEuro) return -1;
        if (!aEuro && bEuro) return 1;
        return 0;
    });

    return { entries, breakdown, total };
}

function getPalletCountByMatcher(palletUsage, matcher) {
    return (palletUsage?.entries || []).reduce((sum, entry) => {
        const label = `${entry?.size || ''} ${entry?.type || ''}`.toLowerCase();
        if (!matcher(label)) return sum;
        return sum + n(entry?.count);
    }, 0);
}

function roundMaterialValue(value) {
    return Math.round(Number.isFinite(value) ? value : 0);
}

function materialValueText(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return formatAutoField(value);
    const txt = (value ?? '').toString().trim();
    return txt || '-';
}

function materialsProfileForReport(report = {}) {
    const packaging = detectPackaging(report);
    const sizeMl = detectReportVolumeMl(report);
    if (packaging === 'CAN') {
        if (sizeMl === 300) return { packaging, sizeMl, key: 'CAN_300' };
        if (sizeMl === 500) return { packaging, sizeMl, key: 'CAN_500' };
        return { packaging, sizeMl, key: 'CAN_OTHER' };
    }
    if (sizeMl === 2500) return { packaging, sizeMl, key: 'PET_2500' };
    if (sizeMl === 330) return { packaging, sizeMl, key: 'PET_330' };
    if (sizeMl === 500) return { packaging, sizeMl, key: 'PET_500' };
    return { packaging, sizeMl, key: 'PET_OTHER' };
}

function palletBreakdownHtml(palletUsage) {
    const rows = Array.isArray(palletUsage?.breakdown) ? palletUsage.breakdown : [];
    if (!rows.length) return '<span class="ppc-materials-sub">-</span>';
    return rows
        .map((row) => `${h(row.label)} <span class="ppc-materials-sub">(${materialValueText(row.count)})</span>`)
        .join('<br>');
}

function buildMaterialsUsedModel(report = {}) {
    const profile = materialsProfileForReport(report);
    const totalCounter = getReportProductionCounterTotal(report);
    const totalCases = n(report?.cases_produced || 0);
    const totalPallets = getPalletUsage(report);
    const rows = [];
    const notes = [];

    if (profile.packaging === 'CAN') {
        const damagedCans = n(report?.damaged_cans_added || 0);
        const shrinkFactor = profile.key === 'CAN_300' ? 0.03233 : 0.03876;
        if (profile.key === 'CAN_OTHER') notes.push('Using 500ml CAN shrink-film factor (0.03876) as fallback.');
        rows.push({ label: 'Cans Used', value: totalCounter + damagedCans });
        rows.push({ label: 'Can Lids/Ends Used', value: totalCounter });
        rows.push({ label: '6-Pack Barcode Used', value: totalCases * 4 });
        rows.push({ label: 'Tray Used', value: totalCases });
        rows.push({ label: 'Shrink Film Used', value: roundMaterialValue(totalCases * shrinkFactor) });
        rows.push({ label: 'Pallet Used', valueHtml: palletBreakdownHtml(totalPallets) });
        rows.push({ label: 'Stretch Film Used', value: roundMaterialValue(0.65 * totalPallets.total) });
        rows.push({ label: 'Pallet Barcode Label Used', value: totalPallets.total });
        return { profile, rows, notes };
    }

    const typeSums = getPetCounterTypeSums(report);
    const rejectedPreform = n(report?.rejected_preform || 0);
    rows.push({ label: 'Preform Used', value: totalCounter + rejectedPreform });
    rows.push({ label: 'Caps Used (With Logo)', value: typeSums.withLogo });
    rows.push({ label: 'Caps Used (Without Logo)', value: typeSums.withoutLogo });
    rows.push({ label: 'Label Used', value: totalCounter });

    let shrinkFactor = 0;
    if (profile.key === 'PET_2500') shrinkFactor = 0.03556;
    if (profile.key === 'PET_330') shrinkFactor = 0.03448;
    if (profile.key === 'PET_500') shrinkFactor = 0.04613;
    if (shrinkFactor <= 0) {
        notes.push('Shrink-film factor is not configured for this PET size.');
    } else {
        rows.push({ label: 'Shrink Film Used', value: roundMaterialValue(totalCases * shrinkFactor) });
    }

    rows.push({ label: 'Pallet Used', valueHtml: palletBreakdownHtml(totalPallets) });

    if (profile.key === 'PET_2500') {
        const euroPallets = getPalletCountByMatcher(totalPallets, (label) => label.includes('1200 x 800') || label.includes('1200x800') || label.includes('euro'));
        const size1000Pallets = getPalletCountByMatcher(totalPallets, (label) => label.includes('1200 x 1000') || label.includes('1200x1000'));
        rows.push({ label: 'Layer Board 1200x800mm EURO', value: euroPallets * 5 });
        rows.push({ label: 'Layer Board 1200x1000mm', value: size1000Pallets * 4 });
        rows.push({ label: 'Stretch Film Used', value: roundMaterialValue(0.65 * totalPallets.total) });
    } else if (profile.key === 'PET_330' || profile.key === 'PET_500') {
        rows.push({ label: '6-Pack Barcode Used', value: totalCases * 4 });
        rows.push({ label: 'Tray Used', value: totalCases });
        rows.push({ label: 'Stretch Film Used', value: roundMaterialValue(0.65 * totalPallets.total) });
    } else {
        notes.push('Only 2.5L, 330ml, and 500ml PET formulas are configured.');
    }

    rows.push({ label: 'Pallet Barcode Label Used', value: totalPallets.total });
    return { profile, rows, notes };
}

function materialsProfileLabel(profile = {}) {
    const packLabel = profile.packaging === 'CAN' ? 'CAN' : 'PET';
    if (profile.sizeMl === 2500) return `${packLabel} 2.5L`;
    if (profile.sizeMl > 0) return `${packLabel} ${profile.sizeMl}ml`;
    return packLabel;
}

function closeMaterialsUsedModal() {
    id('ppc-materials-overlay')?.remove();
    if (materialsModalEscHandler) {
        document.removeEventListener('keydown', materialsModalEscHandler);
        materialsModalEscHandler = null;
    }
}

function renderMaterialsUsedModal(report = {}, model = {}) {
    closeMaterialsUsedModal();
    const overlay = document.createElement('div');
    overlay.id = 'ppc-materials-overlay';
    overlay.className = 'ppc-materials-overlay';
    const profile = model.profile || {};
    const metaDate = displayDate(report?.production_date) || '-';
    const metaExpiry = displayDate(report?.expiry_date) || '-';
    const rowsHtml = (model.rows || []).map((row) => {
        const valueHtml = row?.valueHtml || `<span class="ppc-materials-value">${h(materialValueText(row?.value))}</span>`;
        return `<tr><th>${h(row?.label || '')}</th><td>${valueHtml}</td></tr>`;
    }).join('');
    const notesHtml = (model.notes || []).length
        ? `<div class="ppc-materials-note">${h(model.notes.join(' '))}</div>`
        : '';

    overlay.innerHTML = `
        <div class="ppc-materials-modal" role="dialog" aria-modal="true" aria-label="Materials Used">
            <div class="ppc-materials-head">
                <div>
                    <h3 class="ppc-materials-title">Materials Used</h3>
                    <div class="ppc-materials-meta">
                        ${h(report?.product_name || report?.recipe_name || '-')} | Batch: ${h(report?.batch_no || '-')} | Production Date: ${h(metaDate)} | Expiry Date: ${h(metaExpiry)} | ${h(materialsProfileLabel(profile))}
                    </div>
                </div>
                <button type="button" class="ppc-materials-close" data-materials-close aria-label="Close">&times;</button>
            </div>
            <div class="ppc-materials-body">
                <table class="ppc-materials-table">
                    <tbody>${rowsHtml}</tbody>
                </table>
                ${notesHtml}
            </div>
        </div>
    `;

    overlay.addEventListener('click', (e) => {
        const target = e.target;
        if (target === overlay || target?.closest?.('[data-materials-close]')) closeMaterialsUsedModal();
    });
    materialsModalEscHandler = (e) => {
        if (e.key === 'Escape') closeMaterialsUsedModal();
    };
    document.addEventListener('keydown', materialsModalEscHandler);
    document.body.appendChild(overlay);
}

function getCachedReportById(reportId) {
    return [...state.completed, ...state.pending].find((row) => row?._id === reportId) || null;
}

async function getReportForMaterials(reportId) {
    const cached = getCachedReportById(reportId);
    try {
        const res = await authenticatedFetch(`/api/production-control-reports/${reportId}`);
        if (res.ok) return await res.json();
    } catch (_e) {}
    return cached;
}

function syncTopDateDisplay() {
    sv('ppc-date-top', displayDate(v('ppc-date')));
}

function syncBatchCompletionDate(force = false) {
    const mainDate = d(v('ppc-date'));
    if (!mainDate) return;
    const current = d(v('ppc-bc-date'));
    if (!current || force) sv('ppc-bc-date', mainDate);
}

function syncExpiryAcrossContinuationDays(report = {}) {
    const expiryEl = id('ppc-exp');
    if (!expiryEl) return;
    const day = Math.max(1, n(report?.day_number || state.current?.day_number || 1));
    const inheritedExpiry = state.previousDay?.expiry_date || d(report?.expiry_date);
    if (day > 1 && inheritedExpiry) {
        sv('ppc-exp', inheritedExpiry);
        expiryEl.readOnly = true;
        expiryEl.classList.add('ppc-read');
        return;
    }
    if (!v('ppc-exp') && inheritedExpiry) sv('ppc-exp', inheritedExpiry);
    expiryEl.readOnly = false;
    expiryEl.classList.remove('ppc-read');
}

function continuationChecked() {
    return !!id('ppc-continue-next')?.checked;
}

function continuationMathActive() {
    const day = n(state.current?.day_number || 1);
    // Show continuation math table only from Day 2 onward.
    // On Day 1, checking "continues to next day" should not display the table.
    return day > 1;
}

function continuationPetTypeLockActive() {
    return continuationMathActive() && state.packaging === 'PET';
}

function getPreviousPetTypeCount() {
    const typeCount = Array.isArray(state.previousDay?.pet_types) ? state.previousDay.pet_types.filter(Boolean).length : 0;
    const counterCount = Array.isArray(state.previousDay?.pet_counter_values) ? state.previousDay.pet_counter_values.length : 0;
    return Math.max(1, typeCount, counterCount);
}

function yieldDeferred() {
    const status = (state.current?.status || '').toLowerCase();
    return continuationChecked() || status === 'partial' || !!state.current?.continues_next_day;
}

function updateContinuationLabels() {
    const day = Math.max(1, n(state.current?.day_number || 1));
    const dayLabel = id('ppc-continue-label');
    if (dayLabel) dayLabel.textContent = `Production Continues To Day ${day + 1}`;
    const counterRow = id('ppc-cont-row-counter');
    const checkmateLabel = id('ppc-cont-label-checkmate');
    const lineLabel = id('ppc-cont-label-line');
    const preformRow = id('ppc-cont-row-preform');
    const preformLabel = id('ppc-cont-label-preform');
    if (counterRow) counterRow.classList.toggle('ppc-hidden', state.packaging === 'PET');
    if (checkmateLabel) checkmateLabel.textContent = state.packaging === 'CAN' ? 'Checkmate Rejected Cans' : 'Checkmate Rejected Bottles';
    if (lineLabel) lineLabel.textContent = state.packaging === 'CAN' ? 'Line Damaged Cans' : 'Line Damaged Bottles';
    if (preformRow) preformRow.classList.toggle('ppc-hidden', state.packaging !== 'PET');
    if (preformLabel) preformLabel.textContent = 'Rejected Preform';
}

function toggleBatchCompletionVisibility() {
    id('ppc-batch-completion-wrap')?.classList.toggle('ppc-hidden', continuationChecked());
}

function mappedCode(...vals) {
    const re = /(?:^|[^0-9])(202|204|301|302|303)(?:[^0-9]|$)/;
    for (const raw of vals) {
        const t = (raw || '').toString();
        const m = t.match(re) || t.match(/^(202|204|301|302|303)-/);
        if (m) return m[1];
    }
    return null;
}

function detectPackaging(r) {
    const c = mappedCode(r?.item_code, r?.recipe_name, r?.product_name);
    if (c === '202' || c === '204') return 'CAN';
    if (c === '301' || c === '302' || c === '303') return 'PET';
    const ex = (r?.packaging_type || '').toUpperCase();
    if (ex === 'CAN' || ex === 'PET') return ex;
    const txt = `${r?.recipe_name || ''} ${r?.product_name || ''}`.toLowerCase();
    if (txt.includes('can')) return 'CAN';
    if (txt.includes('pet')) return 'PET';
    return 'PET';
}

const lineFromPack = (p) => (p === 'CAN' ? '01' : '02');
const tsFromBatch = (b) => { const s = (b || '').toString().trim().replace(/^[dD]/, ''); return s ? `TS-${s}` : ''; };
const PALLET_SIZE_VALUES = [
    'Pallets 1420 x 1120 mm',
    'Pallets 1200 x 1000 mm',
    'Pallets Red 1200 x 1000 x 150 mm',
    'Euro Pallets 1200 x 800 mm'
];
const PALLET_CONTAINER_META = {
    'ppc-can-pallet-rows': { countsId: 'ppc-can-pallet-counts', totalId: 'ppc-can-pal' },
    'ppc-pet-pallet-rows': { countsId: 'ppc-pet-pallet-counts', totalId: 'ppc-pet-pal' }
};

function palletSizeOptions(selected = '') {
    let html = '<option value="">-- Select --</option>';
    if (selected && !PALLET_SIZE_VALUES.includes(selected)) {
        html += `<option value="${selected}" selected>${selected}</option>`;
    }
    PALLET_SIZE_VALUES.forEach((value) => {
        html += `<option value="${value}"${selected === value ? ' selected' : ''}>${value}</option>`;
    });
    return html;
}

function palletMeta(containerId) {
    const meta = PALLET_CONTAINER_META[containerId] || {};
    return {
        countsId: meta.countsId || `${containerId}-counts`,
        totalId: meta.totalId || '',
        typesId: meta.typesId || ''
    };
}

function normalizePalletMix(value) {
    const raw = (value ?? '').toString().trim();
    if (!raw) return [];
    return raw.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
        const size = part.replace(/\s*\[(?:P|C\/P|T):\s*[^\]]+\]/gi, '').trim();
        const count = (part.match(/\[P:\s*([^\]]+)\]/i)?.[1] || '').trim();
        const cases = (part.match(/\[C\/P:\s*([^\]]+)\]/i)?.[1] || '').trim();
        const type = (part.match(/\[T:\s*([^\]]+)\]/i)?.[1] || '').trim();
        return {
            size,
            count,
            cases,
            type
        };
    }).filter((entry) => entry.size || entry.count || entry.cases || entry.type);
}

function palletMixToStorage(entries = []) {
    const parts = entries
        .map((entry) => ({
            size: (entry?.size || '').toString().trim(),
            count: (entry?.count || '').toString().trim(),
            cases: (entry?.cases || '').toString().trim(),
            type: (entry?.type || '').toString().trim()
        }))
        .filter((entry) => entry.size || entry.count || entry.cases || entry.type)
        .map((entry) => {
            let part = entry.size || '';
            if (entry.count) part += `${part ? ' ' : ''}[P:${entry.count}]`;
            if (entry.cases) part += `${part ? ' ' : ''}[C/P:${entry.cases}]`;
            if (entry.type) part += `${part ? ' ' : ''}[T:${entry.type}]`;
            return part;
        });
    return parts.join(' ; ');
}

function normalizePalletTypeList(value) {
    const raw = (value ?? '').toString().trim();
    if (!raw) return [];
    return raw.split(';').map((part) => part.trim()).filter(Boolean);
}

function palletTypesToStorage(entries = []) {
    const parts = entries
        .map((entry) => (entry?.type || '').toString().trim())
        .filter(Boolean);
    return parts.join(' ; ');
}

function palletCountCell(entry = {}) {
    const count = (entry?.count || '').toString().trim();
    return `<div class="ppc-pallet-count"><input class="ppc-input ppc-pal-count" type="number" step="0.0001" placeholder="Pallets Made" value="${count}"></div>`;
}

function palletTypeCell(entry = {}) {
    const type = (entry?.type || '').toString().trim();
    return `<div class="ppc-pallet-type"><div class="ppc-pallet-type-entry"><input class="ppc-input ppc-pal-type" placeholder="Type" value="${type}"><div class="ppc-pallet-actions"><button type="button" class="ppc-icon-btn" data-pallet-action="add" title="Add type">+</button><button type="button" class="ppc-icon-btn" data-pallet-action="remove" title="Remove type">-</button></div></div></div>`;
}

function petProductionTypeCount() {
    return Array.from(id('ppc-pet-pallet-types')?.querySelectorAll('.ppc-pal-type') || []).length;
}

function collectPetCounterExtras() {
    return Array.from(id('ppc-pet-counter-extras')?.querySelectorAll('.ppc-pet-counter-extra-input') || [])
        .map((el) => (el.value || '').toString().trim());
}

function normalizeOptionalNumberList(values = []) {
    const normalized = values.map((raw) => {
        const txt = (raw ?? '').toString().trim();
        if (!txt) return null;
        const parsed = parseFloat(txt);
        return Number.isFinite(parsed) ? parsed : null;
    });
    while (normalized.length && normalized[normalized.length - 1] === null) normalized.pop();
    return normalized;
}

function sumOptionalNumberValues(rawValues) {
    if (Array.isArray(rawValues)) {
        return rawValues.reduce((sum, raw) => {
            const txt = (raw ?? '').toString().trim();
            return txt ? (sum + n(txt)) : sum;
        }, 0);
    }
    const text = (rawValues ?? '').toString().trim();
    if (!text) return 0;
    return text.split(';').reduce((sum, part) => {
        const txt = part.trim();
        return txt ? (sum + n(txt)) : sum;
    }, 0);
}

function collectPetLooseExtras() {
    return Array.from(id('ppc-pet-loose-extras')?.querySelectorAll('.ppc-pet-loose-extra-input') || [])
        .map((el) => (el.value || '').toString().trim());
}

function petLooseTypeCount() {
    return Array.from(id('ppc-pet-loose-types')?.querySelectorAll('.ppc-pal-type') || []).length;
}

function collectPetTypeValues(containerId) {
    return Array.from(id(containerId)?.querySelectorAll('.ppc-pal-type') || [])
        .map((el) => (el.value || '').toString().trim());
}

function buildTypeSeed(sourceValues = [], count = 1) {
    const src = Array.isArray(sourceValues)
        ? sourceValues.map((value) => (value ?? '').toString().trim())
        : [];
    const targetCount = Math.max(1, count);
    const out = src.slice(0, targetCount);
    while (out.length < targetCount) out.push('');
    return out;
}

function normalizeTypeValues(values = []) {
    const out = (Array.isArray(values) ? values : []).map((value) => (value ?? '').toString().trim());
    while (out.length && !out[out.length - 1]) out.pop();
    return out;
}

function renderPetTypeColumns(containerId, seedValues = [], preserveEmpty = false) {
    const container = id(containerId);
    if (!container) return;
    const normalized = (Array.isArray(seedValues) ? seedValues : []).map((value) => (value ?? '').toString().trim());
    const usable = preserveEmpty ? normalized : normalized.filter(Boolean);
    const values = usable.length ? usable : [''];
    container.innerHTML = values.map((value) => palletTypeCell({ type: value })).join('');
}

function collectPetTypesForStorage() {
    const productionTypes = normalizeTypeValues(collectPetTypeValues('ppc-pet-pallet-types'));
    const looseTypes = normalizeTypeValues(collectPetTypeValues('ppc-pet-loose-types'));
    if (!looseTypes.length) return productionTypes;
    const merged = productionTypes.slice();
    looseTypes.forEach((value, idx) => {
        if (!merged[idx] && value) merged[idx] = value;
    });
    return normalizeTypeValues(merged);
}

function syncPetCounterExtrasWithTypes(seedValues = null) {
    const group = id('ppc-counter-group');
    const wrap = id('ppc-pet-counter-extras-wrap');
    const container = id('ppc-pet-counter-extras');
    if (!wrap || !container) return;

    if (state.packaging !== 'PET') {
        group?.classList.remove('has-extra');
        wrap.classList.add('ppc-hidden');
        container.innerHTML = '';
        updatePetCounterTotalField();
        return;
    }

    const typeCount = Math.max(1, petProductionTypeCount());
    const extraCount = Math.max(0, typeCount - 1);
    const currentValues = Array.isArray(seedValues)
        ? seedValues.map((v0) => (v0 ?? '').toString().trim())
        : collectPetCounterExtras();

    if (extraCount <= 0) {
        group?.classList.remove('has-extra');
        wrap.classList.add('ppc-hidden');
        container.innerHTML = '';
        updatePetCounterTotalField();
        return;
    }

    const values = currentValues.slice(0, extraCount);
    while (values.length < extraCount) values.push('');
    container.innerHTML = values.map((value, idx) => (
        `<div class="ppc-pet-counter-extra"><input class="ppc-input ppc-pet-counter-extra-input" type="number" step="0.0001" placeholder="Type ${idx + 2}" value="${value}"></div>`
    )).join('');
    group?.classList.add('has-extra');
    wrap.classList.remove('ppc-hidden');

    const prevTypeCount = getPreviousPetTypeCount();
    container.querySelectorAll('.ppc-pet-counter-extra-input').forEach((el, idx) => {
        const isReadOnly = continuationPetTypeLockActive() ? (idx < Math.max(0, prevTypeCount - 1)) : false;
        el.readOnly = isReadOnly;
        el.classList.toggle('ppc-read', isReadOnly);
    });
    updatePetCounterTotalField();
}

function syncPetLooseExtrasWithTypes(seedValues = null) {
    const group = id('ppc-loose-group');
    const wrap = id('ppc-pet-loose-extras-wrap');
    const container = id('ppc-pet-loose-extras');
    if (!wrap || !container) return;

    if (state.packaging !== 'PET') {
        group?.classList.remove('has-extra');
        wrap.classList.add('ppc-hidden');
        container.innerHTML = '';
        updatePetLooseTotalField();
        return;
    }

    const typeCount = Math.max(1, petLooseTypeCount());
    const extraCount = Math.max(0, typeCount - 1);
    const currentValues = Array.isArray(seedValues)
        ? seedValues.map((v0) => (v0 ?? '').toString().trim())
        : collectPetLooseExtras();

    if (extraCount <= 0) {
        group?.classList.remove('has-extra');
        wrap.classList.add('ppc-hidden');
        container.innerHTML = '';
        updatePetLooseTotalField();
        return;
    }

    const values = currentValues.slice(0, extraCount);
    while (values.length < extraCount) values.push('');
    container.innerHTML = values.map((value, idx) => (
        `<div class="ppc-pet-loose-extra"><input class="ppc-input ppc-pet-loose-extra-input" type="number" step="0.0001" placeholder="Type ${idx + 2}" value="${value}"></div>`
    )).join('');
    group?.classList.add('has-extra');
    wrap.classList.remove('ppc-hidden');
    updatePetLooseTotalField();
}

function palletRow(containerId, entry = {}) {
    const size = (entry?.size || '').toString().trim();
    const cases = (entry?.cases || '').toString().trim();
    return `<div class="ppc-pallet-entry"><select class="ppc-input ppc-pal-size">${palletSizeOptions(size)}</select><input class="ppc-input ppc-pal-cases" type="number" step="0.0001" placeholder="Cases/Pallet" value="${cases}"><div class="ppc-pallet-actions"><button type="button" class="ppc-icon-btn" data-pallet-action="add" title="Add column">+</button><button type="button" class="ppc-icon-btn" data-pallet-action="remove" title="Remove column">-</button></div></div>`;
}

function syncPalletTotal(containerId) {
    const { countsId, totalId } = palletMeta(containerId);
    if (!totalId) return;
    const countContainer = id(countsId);
    if (!countContainer) return;
    const total = Array.from(countContainer.querySelectorAll('.ppc-pal-count')).reduce((sum, el) => sum + n(el.value), 0);
    const rounded = Math.round(total * 10000) / 10000;
    sv(totalId, rounded > 0 ? String(rounded) : '');
}

function renderPalletEntries(containerId, entries = [], fallbackTotal = '', preserveEmpty = false) {
    const rowContainer = id(containerId);
    const { countsId } = palletMeta(containerId);
    const countContainer = id(countsId);
    if (!rowContainer || !countContainer) return;

    const normalized = entries
        .map((entry) => ({
            size: (entry?.size || '').toString().trim(),
            count: (entry?.count || '').toString().trim(),
            cases: (entry?.cases || '').toString().trim(),
            type: (entry?.type || '').toString().trim()
        }));
    const usable = preserveEmpty ? normalized : normalized.filter((entry) => entry.size || entry.count || entry.cases || entry.type);
    const seed = usable.length ? usable : [{}];

    const fallback = (fallbackTotal ?? '').toString().trim();
    const fallbackNum = n(fallback);
    if (!seed.some((entry) => entry.count) && fallbackNum > 0) {
        seed[0] = { ...seed[0], count: fallback || String(fallbackNum) };
    }

    countContainer.innerHTML = seed.map((entry) => palletCountCell(entry)).join('');
    rowContainer.innerHTML = seed.map((entry) => palletRow(containerId, entry)).join('');
    syncPalletTotal(containerId);
}

function renderPalletRows(containerId, value = '', totalValue = '') {
    const entries = normalizePalletMix(value);
    renderPalletEntries(containerId, entries, totalValue, false);
}

function collectPalletRowsInternal(containerId, includeEmpty = false) {
    const rowContainer = id(containerId);
    const { countsId, typesId } = palletMeta(containerId);
    const countContainer = id(countsId);
    const typeContainer = typesId ? id(typesId) : null;
    if (!rowContainer || !countContainer) return [];
    const rows = Array.from(rowContainer.querySelectorAll('.ppc-pallet-entry'));
    const counts = Array.from(countContainer.querySelectorAll('.ppc-pal-count'));
    const types = typeContainer ? Array.from(typeContainer.querySelectorAll('.ppc-pal-type')) : [];
    const mapped = rows.map((row, index) => ({
        size: row.querySelector('.ppc-pal-size')?.value?.trim() || '',
        cases: row.querySelector('.ppc-pal-cases')?.value?.trim() || '',
        count: counts[index]?.value?.trim() || '',
        type: types[index]?.value?.trim() || ''
    }));
    if (includeEmpty) return mapped;
    return mapped.filter((entry) => entry.size || entry.cases || entry.count || entry.type);
}

function collectPalletRows(containerId) {
    return collectPalletRowsInternal(containerId, false);
}
function formTemplate() {
    return `
    <div class="ppc-tools">
      <div class="ppc-left">
        <button class="ppc-btn" onclick="switchProductionControlSubTab('pending')">Back</button>
        <span class="ppc-chip">Target Cases: <b id="ppc-chip-target">-</b></span>
        <span class="ppc-chip">Batch: <b id="ppc-chip-batch">-</b></span>
      </div>
      <div class="ppc-right">
        <button class="ppc-btn" id="ppc-reset" title="Clear all editable fields (keeps product/batch/target)">Reset Fields</button>
        <button class="ppc-btn" id="ppc-pdf">Download PDF</button>
        <button class="ppc-btn" id="ppc-save">Save Draft</button>
        <button class="ppc-btn ppc-btn-primary" id="ppc-submit">Submit Report</button>
      </div>
    </div>
    <div class="ppc-sheet-wrap"><div class="ppc-sheet">
      <div class="ppc-page-title">PRODUCTION PROCESS CONTROL REPORT</div>
      <div class="ppc-top-grid">
        <div class="ppc-top-row">
          <div class="ppc-top-item"><span class="ppc-top-label">Date:</span><input id="ppc-date-top" class="ppc-top-input ppc-read" readonly></div>
          <div class="ppc-top-item"><span class="ppc-top-label">Total Volume:</span><input id="ppc-vol" type="number" step="0.0001" class="ppc-top-input ppc-read" readonly></div>
          <div class="ppc-top-item"><span class="ppc-top-label">Syrup:Water Ratio:</span><div class="ppc-top-ratio"><input id="ppc-syr" type="number" step="0.0001" class="ppc-top-input ppc-read" readonly><span>:</span><input id="ppc-water" type="number" step="0.0001" class="ppc-top-input ppc-read" readonly></div></div>
        </div>
        <div class="ppc-top-row">
          <div class="ppc-top-item"><span class="ppc-top-label">Expiry Date:</span><input id="ppc-exp" type="date" class="ppc-top-input"></div>
          <div class="ppc-top-item"><span class="ppc-top-label">GTIN/Barcode:</span><input id="ppc-gtin" class="ppc-top-input ppc-read" readonly></div>
          <div class="ppc-top-item"><span class="ppc-top-label">Transfer Sheet No.:</span><input id="ppc-ts" class="ppc-top-input ppc-read" readonly></div>
        </div>
      </div>
      <input id="ppc-target" type="number" step="0.0001" class="ppc-target-hidden" readonly tabindex="-1">
      <table class="ppc-table" style="margin-top:8px">
        <tr><th style="width:30%">Product</th><th style="width:18%">Batch No.</th><th style="width:17%">Start Time</th><th style="width:17%">Stop Time</th><th style="width:18%">Cases Produced</th></tr>
        <tr>
          <td><input id="ppc-product" class="ppc-input"></td><td><input id="ppc-batch" class="ppc-input ppc-read" readonly></td>
          <td><input id="ppc-start" type="time" class="ppc-input"></td><td><input id="ppc-stop" type="time" class="ppc-input"></td>
          <td><input id="ppc-cases" type="number" step="0.0001" class="ppc-input"></td>
        </tr>
      </table>
      <div class="ppc-row">
        <div>Date: <input id="ppc-date" type="date" class="ppc-soft"></div>
        <div>Shift: <input id="ppc-shift" class="ppc-soft ppc-read" value="A+B" readonly></div>
        <div style="text-align:right">Line: <input id="ppc-line" class="ppc-soft short ppc-read" readonly></div>
      </div>
      <div class="ppc-row-2">
        <div class="ppc-yield-wrap"><div class="ppc-yield-eqn"><div class="ppc-yield-frac"><input id="ppc-oee-a" type="number" step="0.0001" class="ppc-soft short"><div class="ppc-yield-line"></div><input id="ppc-oee-den" type="number" step="0.0001" class="ppc-soft short"></div><span>x 100% =</span><input id="ppc-oee-b" type="number" step="0.0001" class="ppc-soft short"><span>%</span></div><div id="ppc-yield-note" class="ppc-inline-note ppc-hidden">Yield will be calculated after completion of production</div></div>
        <div>OEE %: <input id="ppc-oee" type="number" step="0.0001" class="ppc-soft short"></div>
      </div>
      <div class="ppc-continue-box">
        <label class="ppc-continue-toggle"><input id="ppc-continue-next" type="checkbox"><span id="ppc-continue-label">Production Continues To Day 2</span></label>
        <table id="ppc-continue-rows" class="ppc-table ppc-hidden" style="margin-top:6px">
          <tr><th style="width:24%">Field</th><th style="width:20%">Previous</th><th style="width:4%"></th><th style="width:20%">Today</th><th style="width:4%"></th><th style="width:28%">Total</th></tr>
          <tr id="ppc-cont-row-counter"><td>Production Counter</td><td><input id="ppc-prev-counter" type="number" step="0.0001" class="ppc-input ppc-read" readonly></td><td><span class="ppc-continue-sign">+</span></td><td><input id="ppc-add-counter" type="number" step="0.0001" class="ppc-input"></td><td><span class="ppc-continue-sign">=</span></td><td><input id="ppc-sum-counter" type="number" step="0.0001" class="ppc-input ppc-read" readonly></td></tr>
          <tr><td id="ppc-cont-label-checkmate">Checkmate Rejected</td><td><input id="ppc-prev-checkmate" type="number" step="0.0001" class="ppc-input ppc-read" readonly></td><td><span class="ppc-continue-sign">+</span></td><td><input id="ppc-add-checkmate" type="number" step="0.0001" class="ppc-input"></td><td><span class="ppc-continue-sign">=</span></td><td><input id="ppc-sum-checkmate" type="number" step="0.0001" class="ppc-input ppc-read" readonly></td></tr>
          <tr><td id="ppc-cont-label-line">Line Damaged</td><td><input id="ppc-prev-line" type="number" step="0.0001" class="ppc-input ppc-read" readonly></td><td><span class="ppc-continue-sign">+</span></td><td><input id="ppc-add-line" type="number" step="0.0001" class="ppc-input"></td><td><span class="ppc-continue-sign">=</span></td><td><input id="ppc-sum-line" type="number" step="0.0001" class="ppc-input ppc-read" readonly></td></tr>
          <tr id="ppc-cont-row-preform" class="ppc-hidden"><td id="ppc-cont-label-preform">Rejected Preform</td><td><input id="ppc-prev-preform" type="number" step="0.0001" class="ppc-input ppc-read" readonly></td><td><span class="ppc-continue-sign">+</span></td><td><input id="ppc-add-preform" type="number" step="0.0001" class="ppc-input"></td><td><span class="ppc-continue-sign">=</span></td><td><input id="ppc-sum-preform" type="number" step="0.0001" class="ppc-input ppc-read" readonly></td></tr>
        </table>
      </div>
      <div class="ppc-grid">
        <div>
          <div class="ppc-field-row ppc-field-row-wide"><span class="ppc-field-label">Production Counter:</span><div id="ppc-counter-group" class="ppc-counter-group"><input id="ppc-counter" type="number" step="0.0001" class="ppc-soft short"><div id="ppc-pet-counter-extras-wrap" class="ppc-counter-extras-wrap ppc-hidden"><div id="ppc-pet-counter-extras" class="ppc-pallet-columns"></div></div><div id="ppc-pet-counter-total-wrap" class="ppc-counter-total-wrap ppc-hidden"><input id="ppc-pet-counter-total" type="number" step="0.0001" class="ppc-soft short ppc-read" readonly placeholder="Total"></div></div></div>
          <div id="ppc-can-left">
            <div class="ppc-field-row"><span class="ppc-field-label">Checkmate Rejected Cans:</span><input id="ppc-can-rej" type="number" step="0.0001" class="ppc-soft short"></div>
            <div class="ppc-field-row"><span class="ppc-field-label">Line Damaged Cans:</span><input id="ppc-can-dmg" type="number" step="0.0001" class="ppc-soft short"></div>
            <table class="ppc-table ppc-pallet-table"><tr><th style="text-align:left">Filled Can Pallets</th><td><div id="ppc-can-pallet-counts" class="ppc-pallet-columns"></div><input id="ppc-can-pal" type="number" step="0.0001" class="ppc-input ppc-hidden-pallet-total" tabindex="-1"></td></tr><tr><th style="text-align:left;vertical-align:top">Pallet Size / Cases</th><td><div id="ppc-can-pallet-rows" class="ppc-pallet-columns"></div></td></tr></table>
          </div>
          <div id="ppc-pet-left" class="ppc-hidden">
            <div class="ppc-field-row ppc-field-row-wide"><span class="ppc-field-label">Type:</span><div id="ppc-pet-pallet-types" class="ppc-pallet-columns"></div></div>
            <div class="ppc-field-row"><span class="ppc-field-label">Checkmate Rejected Bottles:</span><input id="ppc-pet-rej-bot" type="number" step="0.0001" class="ppc-soft short"></div>
            <div class="ppc-field-row"><span class="ppc-field-label">Line Damaged Bottles:</span><input id="ppc-pet-dmg-bot" type="number" step="0.0001" class="ppc-soft short"></div>
            <table class="ppc-table ppc-pallet-table"><tr><th style="text-align:left">Filled Bottle Pallets</th><td><div id="ppc-pet-pallet-counts" class="ppc-pallet-columns"></div><input id="ppc-pet-pal" type="number" step="0.0001" class="ppc-input ppc-hidden-pallet-total" tabindex="-1"></td></tr><tr><th style="text-align:left;vertical-align:top">Pallet Size / Cases</th><td><div id="ppc-pet-pallet-rows" class="ppc-pallet-columns"></div></td></tr></table>
          </div>
        </div>
        <div>
          <div id="ppc-can-right"><table class="ppc-table"><tr><th style="text-align:left">Empty Can Pallets</th><td><input id="ppc-empty-can" type="number" step="1" min="0" class="ppc-input"></td></tr><tr><th style="text-align:left">Damaged Cans</th><td><input id="ppc-can-dmg-added" type="number" step="1" min="0" class="ppc-input" placeholder="Enter only on final day"></td></tr><tr><th style="text-align:left">Final Loose Cases</th><td><input id="ppc-loose-final" type="number" step="0.0001" class="ppc-input"></td></tr><tr><th style="text-align:left">Loose Cases Added</th><td><input id="ppc-loose-add" type="number" step="0.0001" class="ppc-input"></td></tr></table><table class="ppc-table" style="margin-top:6px"><tr><th style="text-align:left">Empty Cans / Pallet Setup</th><td><input id="ppc-empty-can-den" type="number" step="0.0001" class="ppc-input" value="5460"></td></tr></table></div>
          <div id="ppc-pet-right" class="ppc-hidden"><table class="ppc-table"><tr><th style="text-align:left">Rejected Preform</th><td><input id="ppc-rej-preform" type="number" step="0.0001" class="ppc-input"></td></tr><tr><th style="text-align:left">Loaded Preform</th><td><input id="ppc-load-preform" type="number" step="0.0001" class="ppc-input"></td></tr><tr><th style="text-align:left">Loaded Caps</th><td><input id="ppc-load-caps" type="number" step="0.0001" class="ppc-input"></td></tr><tr><th style="text-align:left">Final Loose Cases</th><td><div id="ppc-loose-group" class="ppc-counter-group"><div class="ppc-pallet-count ppc-pet-loose-main"><input id="ppc-loose-final-pet" type="number" step="0.0001" class="ppc-input"></div><div id="ppc-pet-loose-extras-wrap" class="ppc-counter-extras-wrap ppc-hidden"><div id="ppc-pet-loose-extras" class="ppc-pallet-columns"></div></div><div id="ppc-pet-loose-total-wrap" class="ppc-counter-total-wrap ppc-hidden"><input id="ppc-pet-loose-total" type="number" step="0.0001" class="ppc-input ppc-read" readonly placeholder="Total"></div></div></td></tr><tr><th style="text-align:left">Type</th><td><div id="ppc-pet-loose-types" class="ppc-pallet-columns ppc-pet-loose-types"></div></td></tr><tr><th style="text-align:left">Loose Cases Added</th><td><input id="ppc-loose-add-pet" type="number" step="0.0001" class="ppc-input"></td></tr></table></div>
        </div>
      </div>
      <div id="ppc-batch-completion-wrap"><div class="ppc-inline-note">*To be completed after the batch is finished</div>
      <table class="ppc-table"><tr><th>Date</th><th>Batch Number</th><th>Production Counter</th><th>Total Rejection</th><th>QC Sample</th><th>Retention Sample</th><th>Quantity Issued to Store</th></tr><tr><td><input id="ppc-bc-date" type="date" class="ppc-input"></td><td><input id="ppc-bc-batch" class="ppc-input"></td><td><input id="ppc-bc-counter" type="number" step="0.0001" class="ppc-input"></td><td><input id="ppc-total-rej" type="number" step="0.0001" class="ppc-input"></td><td><input id="ppc-qc" type="number" step="0.0001" class="ppc-input"></td><td><input id="ppc-ret" type="number" step="0.0001" class="ppc-input"></td><td><input id="ppc-store" type="number" step="0.0001" class="ppc-input"></td></tr></table></div>
      <table class="ppc-table ppc-dt-table" style="margin-top:8px"><colgroup><col class="ppc-dt-col-machine"><col class="ppc-dt-col-reason"><col class="ppc-dt-col-job"><col class="ppc-dt-col-time"></colgroup><tr><th colspan="4" style="font-size:14px">Down Time</th></tr><tr><th>Machine/Device</th><th>Reason</th><th>Job Card No.</th><th>Time (Mins)</th></tr><tbody id="ppc-dt-body"></tbody><tr><td colspan="2"></td><th>Total</th><td><input id="ppc-dt-total" type="number" step="0.0001" class="ppc-input"></td></tr></table>
      <div class="ppc-bottom">
        <table class="ppc-table"><tr><th colspan="2" style="font-size:14px">Machine Hours</th></tr><tr><td>Filler</td><td><input id="ppc-mh-filler" type="number" step="0.0001" class="ppc-input"></td></tr><tr id="ppc-mh-contiform-row" class="ppc-hidden"><td>Contiform</td><td><input id="ppc-mh-contiform" type="number" step="0.0001" class="ppc-input"></td></tr><tr><td>Mixer</td><td><input id="ppc-mh-mixer" type="number" step="0.0001" class="ppc-input"></td></tr><tr id="ppc-mh-contiroll-row" class="ppc-hidden"><td>Contiroll</td><td><input id="ppc-mh-contiroll" type="number" step="0.0001" class="ppc-input"></td></tr><tr><td>Variopac Pro FS</td><td><input id="ppc-mh-vfs" type="number" step="0.0001" class="ppc-input"></td></tr><tr><td>Shrinking Tunnel</td><td><input id="ppc-mh-sh" type="number" step="0.0001" class="ppc-input"></td></tr><tr><td>Variopac Pro Tray</td><td><input id="ppc-mh-vt" type="number" step="0.0001" class="ppc-input"></td></tr><tr><td>Palletizer</td><td><input id="ppc-mh-pal" type="number" step="0.0001" class="ppc-input"></td></tr><tr id="ppc-mh-dep-row"><td>Depalletizer</td><td><input id="ppc-mh-dep" type="number" step="0.0001" class="ppc-input"></td></tr></table>
        <div class="ppc-notes"><div class="ppc-note-head">Notes</div><textarea id="ppc-notes" class="ppc-text" style="min-height:250px;resize:vertical"></textarea></div>
      </div>
      <div class="ppc-sign"><div>Line Incharge</div><div>Store Incharge</div><div>Production Manager</div></div>
    </div></div>`;
}

function dtRow(e = {}) {
    return `<tr class="ppc-dt-row"><td><input class="ppc-input ppc-dt-m" value="${e.machine_device || ''}"></td><td><input class="ppc-input ppc-dt-r" value="${e.reason || ''}"></td><td><input class="ppc-input ppc-dt-j" value="${e.job_card_no || ''}"></td><td><div class="ppc-dt-time-wrap"><input class="ppc-input ppc-dt-t" type="number" step="0.0001" value="${e.time_mins ?? ''}"><div class="ppc-dt-actions"><button type="button" class="ppc-icon-btn" title="Add row" onclick="addDownTimeEntryAfter(this)">+</button><button type="button" class="ppc-icon-btn" title="Delete row" onclick="removeDownTimeEntry(this)">&#128465;</button></div></div></td></tr>`;
}

function renderDtRows(rows = []) {
    const body = id('ppc-dt-body'); if (!body) return;
    const seed = rows.length ? rows : Array.from({ length: 6 }, () => ({}));
    body.innerHTML = seed.map((r) => dtRow(r)).join('');
}

function collectDtRows() {
    return Array.from(document.querySelectorAll('#ppc-dt-body .ppc-dt-row')).map((row) => ({
        machine_device: row.querySelector('.ppc-dt-m')?.value?.trim() || '',
        reason: row.querySelector('.ppc-dt-r')?.value?.trim() || '',
        job_card_no: row.querySelector('.ppc-dt-j')?.value?.trim() || '',
        time_mins: n(row.querySelector('.ppc-dt-t')?.value || 0)
    })).filter((r) => r.machine_device || r.reason || r.job_card_no || r.time_mins);
}

function continuationFallbackToday(explicitVal, totalVal, prevVal, dayNum) {
    if (explicitVal !== null && explicitVal !== undefined && explicitVal !== '') return n(explicitVal);
    if (dayNum > 1) return Math.max(0, n(totalVal) - n(prevVal));
    return 0;
}

function isFreshContinuationReport(report = {}) {
    if (!report?.previous_day_report_id) return false;
    const day = Math.max(1, n(report?.day_number || state.current?.day_number || 1));
    if (day <= 1) return false;
    const createdAt = new Date(report?.created_at || '').getTime();
    const updatedAt = new Date(report?.updated_at || '').getTime();
    if (!Number.isFinite(createdAt) || !Number.isFinite(updatedAt)) return false;
    return Math.abs(updatedAt - createdAt) <= 10000;
}

function setContinuationTargetReadOnly(on) {
    ['ppc-counter', 'ppc-can-rej', 'ppc-can-dmg', 'ppc-pet-rej-bot', 'ppc-pet-dmg-bot', 'ppc-rej-preform'].forEach((fieldId) => {
        const el = id(fieldId);
        if (!el) return;
        el.readOnly = !!on;
        el.classList.toggle('ppc-read', !!on);
    });
    const prevTypeCount = getPreviousPetTypeCount();
    Array.from(document.querySelectorAll('#ppc-pet-counter-extras .ppc-pet-counter-extra-input')).forEach((el, idx) => {
        const shouldLock = !!on && state.packaging === 'PET' ? (idx < Math.max(0, prevTypeCount - 1)) : !!on;
        el.readOnly = shouldLock;
        el.classList.toggle('ppc-read', shouldLock);
    });

    const lockTypeFields = !!on && state.packaging === 'PET';
    Array.from(document.querySelectorAll('#ppc-pet-pallet-types .ppc-pal-type')).forEach((el, idx) => {
        const shouldLock = lockTypeFields ? (idx < prevTypeCount) : false;
        el.readOnly = shouldLock;
        el.classList.toggle('ppc-read', shouldLock);
    });
    Array.from(document.querySelectorAll('#ppc-pet-pallet-types .ppc-pallet-type-entry')).forEach((row, idx) => {
        const addBtn = row.querySelector('[data-pallet-action="add"]');
        const removeBtn = row.querySelector('[data-pallet-action="remove"]');
        if (addBtn) addBtn.disabled = false;
        if (removeBtn) removeBtn.disabled = lockTypeFields ? (idx < prevTypeCount) : false;
    });

    // Final loose-case type stays user-editable during continuation.
    Array.from(document.querySelectorAll('#ppc-pet-loose-types .ppc-pal-type')).forEach((el) => {
        el.readOnly = false;
        el.classList.remove('ppc-read');
    });
    Array.from(document.querySelectorAll('#ppc-pet-loose-types .ppc-icon-btn')).forEach((btn) => {
        btn.disabled = false;
    });
}

async function loadPreviousDayTotals(report = {}) {
    let prev = null;
    const prevId = report?.previous_day_report_id;
    if (prevId) {
        prev = [...state.pending, ...state.completed].find((r) => r?._id === prevId) || null;
        if (!prev) {
            try {
                const res = await authenticatedFetch(`/api/production-control-reports/${prevId}`);
                if (res.ok) prev = await res.json();
            } catch (_e) {}
        }
    }

    const prevCounterTotal = state.packaging === 'PET'
        ? (n(prev?.production_counter || 0) + sumOptionalNumberValues(prev?.production_counter_type_values))
        : n(prev?.production_counter || 0);
    const prevPetTypes = normalizePalletTypeList(prev?.bottle_pallet_type || '');
    const prevPetCounterExtras = Array.isArray(prev?.production_counter_type_values)
        ? prev.production_counter_type_values.map((v0) => (v0 ?? '').toString().trim()).filter(Boolean)
        : normalizePalletTypeList(prev?.production_counter_type_values || '');
    const prevPetCounterBase = (prev?.production_counter ?? '').toString().trim();
    const prevPetCounterValues = [prevPetCounterBase || '0', ...prevPetCounterExtras];

    state.previousDay = {
        production_counter: prevCounterTotal,
        checkmate_rejected: state.packaging === 'CAN'
            ? n(prev?.checkmate_rejected_cans || 0)
            : n(prev?.checkmate_rejected_bottles || 0),
        line_damaged: state.packaging === 'CAN'
            ? n(prev?.line_damaged_cans || 0)
            : n(prev?.line_damaged_bottles || 0),
        rejected_preform: n(prev?.rejected_preform || 0),
        pet_types: prevPetTypes,
        pet_counter_extras: prevPetCounterExtras,
        pet_counter_values: prevPetCounterValues,
        loose_cases_added: n(prev?.loose_cases_added || 0),
        cases_produced: n(prev?.cases_produced || 0),
        expiry_date: d(prev?.expiry_date)
    };

    sv('ppc-prev-counter', formatAutoField(state.previousDay.production_counter));
    sv('ppc-prev-checkmate', formatAutoField(state.previousDay.checkmate_rejected));
    sv('ppc-prev-line', formatAutoField(state.previousDay.line_damaged));
    sv('ppc-prev-preform', formatAutoField(state.previousDay.rejected_preform));
}

function ensurePetContinuationCounterTodaySlot(seedTodayValue = null, forceSeed = false) {
    if (!continuationPetTypeLockActive()) return;
    const prevTypes = Array.isArray(state.previousDay?.pet_types) ? state.previousDay.pet_types.filter(Boolean) : [];
    const prevValues = Array.isArray(state.previousDay?.pet_counter_values) ? state.previousDay.pet_counter_values : [];
    const prevTypeCount = getPreviousPetTypeCount();
    const targetTypeCount = prevTypeCount + 1;

    const typeValues = collectPetTypeValues('ppc-pet-pallet-types');
    let typeChanged = false;
    while (typeValues.length < targetTypeCount) {
        typeValues.push('');
        typeChanged = true;
    }
    for (let i = 0; i < prevTypes.length; i += 1) {
        const fixedType = prevTypes[i] || '';
        if ((typeValues[i] || '').toString().trim() !== fixedType) {
            typeValues[i] = fixedType;
            typeChanged = true;
        }
    }
    if (typeChanged) renderPetTypeColumns('ppc-pet-pallet-types', typeValues, true);

    const extras = collectPetCounterExtras();
    let extrasChanged = false;
    const prevExtras = prevValues.slice(1).map((txt) => (txt ?? '').toString().trim());
    for (let i = 0; i < prevExtras.length; i += 1) {
        const fixedExtra = prevExtras[i] || '';
        if ((extras[i] || '').toString().trim() !== fixedExtra) {
            extras[i] = fixedExtra;
            extrasChanged = true;
        }
    }
    const todayExtraIndex = Math.max(0, prevTypeCount - 1);
    while (extras.length <= todayExtraIndex) {
        extras[todayExtraIndex] = '';
        extrasChanged = true;
    }
    if (seedTodayValue !== null && seedTodayValue !== undefined) {
        const seededValue = formatAutoField(n(seedTodayValue));
        const existingToday = (extras[todayExtraIndex] || '').toString().trim();
        if (forceSeed || !existingToday) {
            if (existingToday !== seededValue) {
                extras[todayExtraIndex] = seededValue;
                extrasChanged = true;
            }
        }
    }
    if (extrasChanged) syncPetCounterExtrasWithTypes(extras);

    const prevBase = (prevValues[0] ?? '').toString().trim();
    const fixedBase = formatAutoField(n(prevBase || 0));
    if (v('ppc-counter') !== fixedBase) sv('ppc-counter', fixedBase);
    setContinuationTargetReadOnly(true);
}

function applyContinuationInputDefaults(report = {}) {
    const day = Math.max(1, n(report?.day_number || state.current?.day_number || 1));
    const checkmateTotal = state.packaging === 'CAN' ? n(report?.checkmate_rejected_cans || 0) : n(report?.checkmate_rejected_bottles || 0);
    const lineTotal = state.packaging === 'CAN' ? n(report?.line_damaged_cans || 0) : n(report?.line_damaged_bottles || 0);
    const currentCounterTotal = state.packaging === 'PET'
        ? (n(report?.production_counter || 0) + sumOptionalNumberValues(report?.production_counter_type_values))
        : n(report?.production_counter || 0);
    const preformTotal = n(report?.rejected_preform || 0);
    const addCounter = continuationFallbackToday(report?.today_production_counter, currentCounterTotal, state.previousDay.production_counter, day);
    const addCheckmate = continuationFallbackToday(report?.today_checkmate_rejected, checkmateTotal, state.previousDay.checkmate_rejected, day);
    const addLine = continuationFallbackToday(report?.today_line_damaged, lineTotal, state.previousDay.line_damaged, day);
    const addPreform = continuationFallbackToday(report?.today_rejected_preform, preformTotal, state.previousDay.rejected_preform, day);
    let addLoose = n(report?.today_loose_cases_added);
    if (addLoose <= 0) {
        const looseTotal = n(report?.loose_cases_added);
        addLoose = day > 1 ? (looseTotal > 0 ? looseTotal : state.previousDay.loose_cases_added) : looseTotal;
    }
    sv('ppc-add-counter', formatAutoField(addCounter));
    sv('ppc-add-checkmate', formatAutoField(addCheckmate));
    sv('ppc-add-line', formatAutoField(addLine));
    sv('ppc-add-preform', formatAutoField(addPreform));
    if (state.packaging !== 'PET') sv('ppc-add-preform', '');
    const looseFieldId = state.packaging === 'CAN' ? 'ppc-loose-add' : 'ppc-loose-add-pet';
    if (!v(looseFieldId) && addLoose > 0) {
        sv('ppc-loose-add', formatAutoField(addLoose));
        sv('ppc-loose-add-pet', formatAutoField(addLoose));
    }

    if (state.packaging === 'PET' && isFreshContinuationReport(report)) {
        sv('ppc-loose-final', '');
        sv('ppc-loose-final-pet', '');
        syncPetLooseExtrasWithTypes([]);
        updatePetLooseTotalField();
    }

    if (state.packaging === 'PET' && day > 1) {
        const explicitTodayRaw = report?.today_production_counter;
        const hasExplicitToday = explicitTodayRaw !== null && explicitTodayRaw !== undefined && explicitTodayRaw !== '';
        const freshDay = isFreshContinuationReport(report);
        if (hasExplicitToday || !freshDay) {
            ensurePetContinuationCounterTodaySlot(addCounter, true);
        } else {
            ensurePetContinuationCounterTodaySlot(null, false);
            sv('ppc-add-counter', '');
        }
    }
}

function seedContinuationInputsFromCurrent() {
    if (!continuationChecked()) return;
    const day = Math.max(1, n(state.current?.day_number || 1));
    if (day > 1) return;
    const allBlank = !v('ppc-add-counter') && !v('ppc-add-checkmate') && !v('ppc-add-line') && !v('ppc-add-preform');
    if (!allBlank) return;
    const checkmateNow = state.packaging === 'CAN' ? v('ppc-can-rej') : v('ppc-pet-rej-bot');
    const lineNow = state.packaging === 'CAN' ? v('ppc-can-dmg') : v('ppc-pet-dmg-bot');
    const counterNow = state.packaging === 'PET' ? getProductionCounterTotal() : n(v('ppc-counter'));
    sv('ppc-add-counter', formatAutoField(counterNow));
    sv('ppc-add-checkmate', checkmateNow);
    sv('ppc-add-line', lineNow);
    if (state.packaging === 'PET') sv('ppc-add-preform', v('ppc-rej-preform'));
}

function continuationTodayCounterValue() {
    if (continuationPetTypeLockActive()) {
        const totalNow = getProductionCounterTotal();
        const prevTotal = n(state.previousDay?.production_counter || 0);
        return Math.max(0, totalNow - prevTotal);
    }
    return n(v('ppc-add-counter'));
}

function recalcContinuationTotals() {
    updateContinuationLabels();
    const active = continuationMathActive();
    id('ppc-continue-rows')?.classList.toggle('ppc-hidden', !active);
    toggleBatchCompletionVisibility();
    setContinuationTargetReadOnly(active);
    if (!active) {
        recalcCasesProducedFromPallets();
        recalcYieldFormula();
        return;
    }

    const addCounter = continuationTodayCounterValue();
    const addCheckmate = n(v('ppc-add-checkmate'));
    const addLine = n(v('ppc-add-line'));
    const addPreform = state.packaging === 'PET' ? n(v('ppc-add-preform')) : 0;
    const addLoose = n(state.packaging === 'CAN' ? v('ppc-loose-add') : v('ppc-loose-add-pet'));
    if (state.packaging === 'PET') ensurePetContinuationCounterTodaySlot();
    sv('ppc-add-counter', formatAutoField(addCounter));

    const sumCounter = state.previousDay.production_counter + addCounter;
    const sumCheckmate = state.previousDay.checkmate_rejected + addCheckmate;
    const sumLine = state.previousDay.line_damaged + addLine;
    const sumPreform = state.previousDay.rejected_preform + addPreform;

    sv('ppc-sum-counter', formatAutoField(sumCounter));
    sv('ppc-sum-checkmate', formatAutoField(sumCheckmate));
    sv('ppc-sum-line', formatAutoField(sumLine));
    sv('ppc-sum-preform', state.packaging === 'PET' ? formatAutoField(sumPreform) : '');

    if (state.packaging === 'CAN') {
        sv('ppc-counter', formatAutoField(sumCounter));
    } else {
        const prevBase = Array.isArray(state.previousDay?.pet_counter_values)
            ? n(state.previousDay.pet_counter_values[0] || 0)
            : n(state.previousDay.production_counter || 0);
        sv('ppc-counter', formatAutoField(prevBase));
    }
    if (state.packaging === 'CAN') {
        sv('ppc-can-rej', formatAutoField(sumCheckmate));
        sv('ppc-can-dmg', formatAutoField(sumLine));
        sv('ppc-loose-add', formatAutoField(addLoose));
        sv('ppc-loose-add-pet', formatAutoField(addLoose));
        sv('ppc-rej-preform', '');
    } else {
        sv('ppc-pet-rej-bot', formatAutoField(sumCheckmate));
        sv('ppc-pet-dmg-bot', formatAutoField(sumLine));
        sv('ppc-rej-preform', formatAutoField(sumPreform));
        sv('ppc-loose-add-pet', formatAutoField(addLoose));
        sv('ppc-loose-add', formatAutoField(addLoose));
    }

    recalcEmptyCanPalletsAuto();
    recalcCasesProducedFromPallets();
}

function setPackaging(p, force = false) {
    if (state.packagingLocked && !force) return;
    state.packaging = p === 'CAN' ? 'CAN' : 'PET';
    id('ppc-can-left')?.classList.toggle('ppc-hidden', state.packaging !== 'CAN');
    id('ppc-can-right')?.classList.toggle('ppc-hidden', state.packaging !== 'CAN');
    id('ppc-pet-left')?.classList.toggle('ppc-hidden', state.packaging !== 'PET');
    id('ppc-pet-right')?.classList.toggle('ppc-hidden', state.packaging !== 'PET');
    id('ppc-mh-dep-row')?.classList.toggle('ppc-hidden', state.packaging !== 'CAN');
    id('ppc-mh-contiform-row')?.classList.toggle('ppc-hidden', state.packaging !== 'PET');
    id('ppc-mh-contiroll-row')?.classList.toggle('ppc-hidden', state.packaging !== 'PET');
    sv('ppc-line', lineFromPack(state.packaging));
    if (id('ppc-rev')) id('ppc-rev').textContent = state.packaging === 'CAN' ? ':28/01/2026' : ':22/01/2026';
    updateContinuationLabels();
    recalcContinuationTotals();
    renderPetTypeColumns('ppc-pet-pallet-types', collectPetTypeValues('ppc-pet-pallet-types'), true);
    renderPetTypeColumns('ppc-pet-loose-types', collectPetTypeValues('ppc-pet-loose-types'), true);
    syncPetCounterExtrasWithTypes();
    syncPetLooseExtrasWithTypes();
    syncEmptyCanPalletDenominator(true);
    recalcEmptyCanPalletsAuto();
}

function getPetFinalLooseTotal() {
    const baseLoose = n(v('ppc-loose-final-pet'));
    const extraLoose = collectPetLooseExtras().reduce((sum, value) => sum + n(value), 0);
    return baseLoose + extraLoose;
}

function getProductionCounterTotal() {
    const baseCounter = n(v('ppc-counter'));
    if (state.packaging !== 'PET') return baseCounter;
    const extraCounter = collectPetCounterExtras().reduce((sum, value) => sum + n(value), 0);
    return baseCounter + extraCounter;
}

function updatePetCounterTotalField() {
    const group = id('ppc-counter-group');
    const wrap = id('ppc-pet-counter-total-wrap');
    const totalEl = id('ppc-pet-counter-total');
    if (!group || !wrap) return;

    if (state.packaging !== 'PET') {
        group.classList.remove('has-total');
        wrap.classList.add('ppc-hidden');
        sv('ppc-pet-counter-total', '');
        return;
    }

    const showTotal = continuationPetTypeLockActive() || petProductionTypeCount() > 1;
    group.classList.toggle('has-total', showTotal);
    wrap.classList.toggle('ppc-hidden', !showTotal);
    if (!showTotal) {
        if (totalEl) totalEl.placeholder = 'Total';
        sv('ppc-pet-counter-total', '');
        return;
    }
    if (continuationPetTypeLockActive()) {
        if (totalEl) totalEl.placeholder = 'Total';
        sv('ppc-pet-counter-total', formatAutoField(getProductionCounterTotal()));
        return;
    }
    if (totalEl) totalEl.placeholder = 'Total';
    sv('ppc-pet-counter-total', formatAutoField(getProductionCounterTotal()));
}

function updatePetLooseTotalField() {
    const group = id('ppc-loose-group');
    const wrap = id('ppc-pet-loose-total-wrap');
    if (!group || !wrap) return;

    if (state.packaging !== 'PET') {
        group.classList.remove('has-total');
        wrap.classList.add('ppc-hidden');
        sv('ppc-pet-loose-total', '');
        return;
    }

    const showTotal = petLooseTypeCount() > 1;
    group.classList.toggle('has-total', showTotal);
    wrap.classList.toggle('ppc-hidden', !showTotal);
    sv('ppc-pet-loose-total', showTotal ? formatAutoField(getPetFinalLooseTotal()) : '');
}

function addPetTypeRow(containerId, target) {
    if (state.readonly) return;
    const container = id(containerId);
    if (!container) return;
    const rows = Array.from(container.querySelectorAll('.ppc-pallet-type-entry'));
    const values = collectPetTypeValues(containerId);
    let insertIndex = values.length;
    const row = target?.closest?.('.ppc-pallet-type-entry');
    if (row) {
        const foundIndex = rows.indexOf(row);
        if (foundIndex >= 0) insertIndex = foundIndex + 1;
    }
    values.splice(insertIndex, 0, '');
    renderPetTypeColumns(containerId, values, true);
    if (containerId === 'ppc-pet-pallet-types') {
        syncPetCounterExtrasWithTypes();
        if (continuationPetTypeLockActive()) {
            recalcContinuationTotals();
        } else {
            recalcBatchCompletionMetrics();
        }
    } else {
        syncPetLooseExtrasWithTypes();
        recalcCasesProducedFromPallets();
    }
    const added = container.querySelectorAll('.ppc-pal-type')?.[insertIndex];
    added?.focus();
    scheduleAutoSave();
}

function removePetTypeRow(containerId, target) {
    if (state.readonly) return;
    const container = id(containerId);
    if (!container) return;
    const rows = Array.from(container.querySelectorAll('.ppc-pallet-type-entry'));
    const values = collectPetTypeValues(containerId);
    let index = rows.length - 1;
    const row = target?.closest?.('.ppc-pallet-type-entry');
    if (row) {
        const foundIndex = rows.indexOf(row);
        if (foundIndex >= 0) index = foundIndex;
    }
    if (containerId === 'ppc-pet-pallet-types' && continuationPetTypeLockActive()) {
        const prevTypeCount = getPreviousPetTypeCount();
        if (index < prevTypeCount) return;
        if (values.length <= prevTypeCount) return;
    }
    if (index >= 0) values.splice(index, 1);
    if (!values.length) values.push('');
    renderPetTypeColumns(containerId, values, true);
    if (containerId === 'ppc-pet-pallet-types') {
        syncPetCounterExtrasWithTypes();
        if (continuationPetTypeLockActive()) {
            recalcContinuationTotals();
        } else {
            recalcBatchCompletionMetrics();
        }
    } else {
        syncPetLooseExtrasWithTypes();
        recalcCasesProducedFromPallets();
    }
    scheduleAutoSave();
}

export function addPalletMixRow(containerId, target) {
    if (state.readonly) return;
    const container = id(containerId);
    if (!container) return;
    const rows = Array.from(container.querySelectorAll('.ppc-pallet-entry'));
    const entries = collectPalletRowsInternal(containerId, true);
    let insertIndex = entries.length;
    const row = target?.closest?.('.ppc-pallet-entry');
    if (row) {
        const foundIndex = rows.indexOf(row);
        if (foundIndex >= 0) insertIndex = foundIndex + 1;
    }
    entries.splice(insertIndex, 0, {});
    renderPalletEntries(containerId, entries, '', true);
    const addedRow = container.querySelectorAll('.ppc-pallet-entry')?.[insertIndex];
    addedRow?.querySelector('.ppc-pal-size')?.focus();
    recalcCasesProducedFromPallets();
    scheduleAutoSave();
}

export function removePalletMixRow(containerId, target) {
    if (state.readonly) return;
    const container = id(containerId);
    if (!container) return;
    const rows = Array.from(container.querySelectorAll('.ppc-pallet-entry'));
    const entries = collectPalletRowsInternal(containerId, true);
    const row = target?.closest?.('.ppc-pallet-entry');
    let index = row ? rows.indexOf(row) : -1;
    if (index < 0) index = entries.length - 1;
    if (index >= 0) entries.splice(index, 1);
    if (!entries.length) entries.push({});
    renderPalletEntries(containerId, entries, '', true);
    recalcCasesProducedFromPallets();
    scheduleAutoSave();
}

function setReadonly(on) {
    state.readonly = !!on;
    const root = id('pcr-content-form'); if (!root) return;
    root.querySelectorAll('input,textarea,button,select').forEach((el) => {
        if (['ppc-pdf'].includes(el.id)) return;
        if (['ppc-save', 'ppc-submit'].includes(el.id)) { el.disabled = on; return; }
        if (el.classList.contains('ppc-icon-btn')) { el.disabled = on; return; }
        if (el.type === 'button') return;
        if (['ppc-batch', 'ppc-shift', 'ppc-line', 'ppc-vol', 'ppc-syr', 'ppc-water', 'ppc-gtin', 'ppc-ts', 'ppc-target', 'ppc-cases', 'ppc-oee', 'ppc-oee-a', 'ppc-oee-den', 'ppc-oee-b', 'ppc-bc-counter', 'ppc-total-rej', 'ppc-qc', 'ppc-store'].includes(el.id)) { el.readOnly = true; return; }
        el.disabled = on;
    });
}

async function fillForm(r) {
    state.current = r;
    state.packagingLocked = false;
    const p = detectPackaging(r);
    setPackaging(p, true);
    state.packagingLocked = true;
    sv('ppc-product', r.product_name || r.recipe_name || '');
    sv('ppc-batch', r.batch_no || '');
    sv('ppc-start', r.start_time || ''); sv('ppc-stop', r.stop_time || '');
    sv('ppc-date', d(r.production_date) || d(new Date())); sv('ppc-shift', 'A+B');
    syncTopDateDisplay();
    const target = n(r.planned_qty); sv('ppc-target', target || ''); sv('ppc-cases', n(r.cases_produced) > 0 ? r.cases_produced : (target || ''));
    if (id('ppc-chip-target')) id('ppc-chip-target').textContent = target ? String(target) : '-';
    if (id('ppc-chip-batch')) id('ppc-chip-batch').textContent = r.batch_no || '-';
    sv('ppc-counter', r.production_counter || '');
    sv('ppc-oee', r.oee_percent || '');
    recalcYieldFormula();
    sv('ppc-can-rej', r.checkmate_rejected_cans || ''); sv('ppc-can-dmg', r.line_damaged_cans || '');
    sv('ppc-empty-can', r.empty_can_pallets || '');
    sv('ppc-can-dmg-added', r.damaged_cans_added ?? '');
    const defaultEmptyCanDen = getEmptyCanDefaultDenominator() || 5460;
    sv('ppc-empty-can-den', String(defaultEmptyCanDen));
    const loadedEmptyCan = n(r.empty_can_pallets || 0);
    const autoDenominator = getEmptyCanPalletDenominator();
    const autoCandidate = autoDenominator > 0 ? Math.round(n(r.production_counter || 0) / autoDenominator) : 0;
    const loadedLooksManual = loadedEmptyCan > 0 && (autoCandidate <= 0 || Math.round(loadedEmptyCan) !== autoCandidate);
    setEmptyCanManualOverride(loadedLooksManual);
    sv('ppc-can-pal', r.filled_can_pallets || ''); renderPalletRows('ppc-can-pallet-rows', r.can_pallet_size || '', r.filled_can_pallets || '');
    sv('ppc-rej-preform', r.rejected_preform || ''); sv('ppc-load-preform', r.loaded_preform || ''); sv('ppc-load-caps', r.loaded_caps || '');
    sv('ppc-pet-rej-bot', r.checkmate_rejected_bottles || ''); sv('ppc-pet-dmg-bot', r.line_damaged_bottles || ''); sv('ppc-pet-pal', r.filled_bottle_pallets || '');
    renderPalletRows('ppc-pet-pallet-rows', r.bottle_pallet_size || '', r.filled_bottle_pallets || '');
    const counterExtrasRaw = r.production_counter_type_values;
    const counterExtrasSeed = Array.isArray(counterExtrasRaw)
        ? counterExtrasRaw.map((v0) => (v0 ?? '').toString().trim())
        : normalizePalletTypeList(counterExtrasRaw || '');
    const storedTypeSeed = normalizePalletTypeList(r.bottle_pallet_type || '');
    const counterTypeSeed = buildTypeSeed(storedTypeSeed, Math.max(1, counterExtrasSeed.length + 1));
    renderPetTypeColumns('ppc-pet-pallet-types', counterTypeSeed, true);
    syncPetCounterExtrasWithTypes(counterExtrasSeed);
    const lf = r.final_loose_cases || ''; const la = r.loose_cases_added || '';
    const looseExtrasRaw = r.final_loose_cases_type_values;
    const looseExtrasSeed = Array.isArray(looseExtrasRaw)
        ? looseExtrasRaw.map((v0) => (v0 ?? '').toString().trim())
        : normalizePalletTypeList(looseExtrasRaw || '');
    const looseTypeSeed = buildTypeSeed(storedTypeSeed, Math.max(1, looseExtrasSeed.length + 1));
    renderPetTypeColumns('ppc-pet-loose-types', looseTypeSeed, true);
    const petLooseBase = looseExtrasSeed.length
        ? Math.max(0, n(lf) - looseExtrasSeed.reduce((sum, value) => sum + n(value), 0))
        : n(lf);
    sv('ppc-loose-final', lf);
    sv('ppc-loose-add', la);
    sv('ppc-loose-final-pet', lf === '' ? '' : formatAutoField(petLooseBase));
    sv('ppc-loose-add-pet', la);
    syncPetLooseExtrasWithTypes(looseExtrasSeed);
    const continueFlag = !!(r.continues_next_day || (r.status || '').toLowerCase() === 'partial');
    if (id('ppc-continue-next')) id('ppc-continue-next').checked = continueFlag;
    updateContinuationLabels();
    await loadPreviousDayTotals(r);
    applyContinuationInputDefaults(r);
    recalcContinuationTotals();
    sv('ppc-bc-date', d(r.batch_completion_date)); sv('ppc-bc-batch', r.batch_completion_batch_no || r.batch_no || '');
    syncBatchCompletionDate();
    sv('ppc-bc-counter', r.batch_completion_counter || ''); sv('ppc-total-rej', r.total_rejection || '');
    sv('ppc-qc', r.qc_sample || ''); sv('ppc-ret', r.retention_sample || ''); sv('ppc-store', r.quantity_issued_to_store || '');
    setRetentionManualOverride(v('ppc-ret') !== '');
    const ratio = getRtdRatio(r.recipe_name || r.product_name || ''); sv('ppc-syr', r.syrup_ratio ?? ratio.ingredient); sv('ppc-water', r.water_ratio ?? ratio.water);
    const info = getBottleSizeInfo(r.recipe_name || r.product_name || '');
    const vol = info && target > 0 ? Math.round(target * info.perCase * (info.sizeMl / 1000) * 10000) / 10000 : n(r.total_volume_liters);
    sv('ppc-vol', vol || ''); sv('ppc-exp', d(r.expiry_date)); sv('ppc-gtin', r.gtin_barcode || ''); sv('ppc-ts', r.transfer_sheet_number || tsFromBatch(r.batch_no));
    syncExpiryAcrossContinuationDays(r);
    const mh = r.machine_hours || {};
    sv('ppc-mh-filler', mh.filler || ''); sv('ppc-mh-contiform', mh.contiform || ''); sv('ppc-mh-mixer', mh.mixer || '');
    sv('ppc-mh-contiroll', mh.contiroll || ''); sv('ppc-mh-vfs', mh.variopac_pro_fs || ''); sv('ppc-mh-sh', mh.shrinking_tunnel || ''); sv('ppc-mh-vt', mh.variopac_pro_tray || '');
    sv('ppc-mh-pal', mh.palletizer || ''); sv('ppc-mh-dep', mh.depalletizer || ''); sv('ppc-notes', r.notes || ''); sv('ppc-dt-total', r.down_time_total || '');
    renderDtRows(r.down_time_entries || []);
    recalcEmptyCanPalletsAuto();
    recalcCasesProducedFromPallets();
    recalcYieldFormula();
    recalcOEE();
    recalcBatchCompletionMetrics();
    if (!r.gtin_barcode && r.recipe_name) {
        try { const res = await authenticatedFetch(`/api/recipes/${encodeURIComponent(r.recipe_name)}`); if (res.ok) { const data = await res.json(); if (!v('ppc-gtin') && data?.gtin) sv('ppc-gtin', data.gtin); } } catch (_e) {}
    }
}

let batchCodeMap = null;

function h(x) {
    return (x ?? '').toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function ensureBatchCodeMap() {
    if (batchCodeMap) return;
    try {
        const res = await authenticatedFetch('/api/production-batches');
        if (!res.ok) return;
        const data = await res.json();
        batchCodeMap = new Map((data?.batches || []).map((b) => [
            (b?.batch_no || '').toString(),
            (b?.item_code || '').toString()
        ]));
    } catch (_e) {
        batchCodeMap = null;
    }
}

async function hydrateItemCodes(rows = []) {
    if (!rows.length) return;
    await ensureBatchCodeMap();
    if (!batchCodeMap) return;
    rows.forEach((r) => {
        if (!r.item_code) {
            const code = batchCodeMap.get((r.batch_no || '').toString());
            if (code) r.item_code = code;
        }
    });
}

function recalcDownTimeTotal() {
    const total = Array.from(document.querySelectorAll('#ppc-dt-body .ppc-dt-t'))
        .reduce((sum, el) => sum + n(el.value), 0);
    sv('ppc-dt-total', total || '');
    recalcOEE();
}

function getTargetCasesValue() {
    const fromField = n(v('ppc-target'));
    if (fromField > 0) return fromField;

    const fromChip = n(id('ppc-chip-target')?.textContent || '');
    if (fromChip > 0) {
        sv('ppc-target', fromChip);
        return fromChip;
    }

    const fromCurrent = n(state.current?.planned_qty || 0);
    if (fromCurrent > 0) {
        sv('ppc-target', fromCurrent);
        return fromCurrent;
    }
    return 0;
}

function formatYieldCell(value) {
    if (!Number.isFinite(value)) return '';
    const rounded = Math.round(value * 10000) / 10000;
    if (Math.abs(rounded - Math.round(rounded)) < 0.0001) return String(Math.round(rounded));
    return rounded.toFixed(4);
}

function formatAutoField(value) {
    if (!Number.isFinite(value)) return '';
    const rounded = Math.round(value * 10000) / 10000;
    if (Math.abs(rounded - Math.round(rounded)) < 0.0001) return String(Math.round(rounded));
    return rounded.toFixed(4);
}

function retentionIsManualOverride() {
    const el = id('ppc-ret');
    return !!el && el.getAttribute(RETENTION_MANUAL_ATTR) === '1';
}

function setRetentionManualOverride(on) {
    const el = id('ppc-ret');
    if (!el) return;
    el.setAttribute(RETENTION_MANUAL_ATTR, on ? '1' : '0');
}

function emptyCanIsManualOverride() {
    const el = id('ppc-empty-can');
    return !!el && el.getAttribute(EMPTY_CAN_MANUAL_ATTR) === '1';
}

function setEmptyCanManualOverride(on) {
    const el = id('ppc-empty-can');
    if (!el) return;
    el.setAttribute(EMPTY_CAN_MANUAL_ATTR, on ? '1' : '0');
}

function getEmptyCanDefaultDenominator() {
    if (state.packaging !== 'CAN') return 0;
    const volumeMl = getProductVolumeMl();
    if (Math.abs(volumeMl - 500) < 0.5) return 5460;
    if (Math.abs(volumeMl - 300) < 0.5) return 9108;
    return 5460;
}

function syncEmptyCanPalletDenominator(force = false) {
    const denEl = id('ppc-empty-can-den');
    if (!denEl || state.packaging !== 'CAN') return;
    const defaultDenominator = getEmptyCanDefaultDenominator();
    if (defaultDenominator <= 0) return;
    const currentDenominator = n(denEl.value);
    if (force || currentDenominator <= 0) {
        sv('ppc-empty-can-den', String(defaultDenominator));
    }
}

function getEmptyCanPalletDenominator() {
    if (state.packaging !== 'CAN') return 0;
    const enteredDenominator = n(v('ppc-empty-can-den'));
    if (enteredDenominator > 0) return enteredDenominator;
    const fallback = getEmptyCanDefaultDenominator();
    return fallback > 0 ? fallback : 5460;
}

function recalcEmptyCanPalletsAuto(force = false) {
    if (state.packaging !== 'CAN') return;
    if (emptyCanIsManualOverride() && !force) return;
    const counter = n(v('ppc-counter'));
    const denominator = getEmptyCanPalletDenominator();
    if (counter <= 0 || denominator <= 0) return;
    sv('ppc-empty-can', String(Math.max(0, Math.round(counter / denominator))));
}

function recalcYieldFormula() {
    const yieldNote = id('ppc-yield-note');
    if (yieldDeferred()) {
        sv('ppc-oee-a', '');
        sv('ppc-oee-den', '');
        sv('ppc-oee-b', '');
        yieldNote?.classList.remove('ppc-hidden');
        return;
    }
    yieldNote?.classList.add('ppc-hidden');

    const target = getTargetCasesValue();
    if (target <= 0) {
        sv('ppc-oee-a', '');
        sv('ppc-oee-den', '');
        sv('ppc-oee-b', '');
        return;
    }

    const casesProduced = n(v('ppc-cases')) || n(state.current?.cases_produced || 0);
    const ratio = casesProduced / target;
    const yieldPct = ratio * 100;
    sv('ppc-oee-a', formatYieldCell(casesProduced));
    sv('ppc-oee-den', formatYieldCell(target));
    sv('ppc-oee-b', yieldPct.toFixed(4));
}

function unitsPerCaseForStore() {
    const volumeMl = getProductVolumeMl();
    return volumeMl >= 2500 ? 6 : 24;
}

function recalcPetPreformAndCapsAuto() {
    if (state.packaging !== 'PET') return;
    const totalCounter = getProductionCounterTotal();
    const rejectedPreform = n(v('ppc-rej-preform'));
    const volumeMl = getProductVolumeMl();

    let denominator = 12000;
    if (Math.abs(volumeMl - 2500) < 0.5 || volumeMl >= 2400) {
        denominator = 5300;
    } else if (Math.abs(volumeMl - 330) < 0.5 || Math.abs(volumeMl - 500) < 0.5) {
        denominator = 12000;
    }

    const loadedPreformRaw = denominator > 0 ? (totalCounter + rejectedPreform) / denominator : 0;
    const loadedCapsRaw = totalCounter / 3800;
    const loadedPreform = Math.max(1, Math.round(loadedPreformRaw));
    const loadedCaps = Math.max(1, Math.round(loadedCapsRaw));

    sv('ppc-load-preform', String(loadedPreform));
    sv('ppc-load-caps', String(loadedCaps));
}

function recalcBatchCompletionMetrics() {
    const counter = getProductionCounterTotal();
    updatePetCounterTotalField();
    recalcPetPreformAndCapsAuto();
    const casesProduced = n(v('ppc-cases')) || n(state.current?.cases_produced || 0);

    const checkmateRejected = state.packaging === 'CAN'
        ? n(v('ppc-can-rej'))
        : n(v('ppc-pet-rej-bot'));
    const lineRejected = state.packaging === 'CAN'
        ? n(v('ppc-can-dmg'))
        : n(v('ppc-pet-dmg-bot'));

    const totalRejected = checkmateRejected + lineRejected;
    const autoRetentionSample = counter > 100099 ? 18 : 12;
    const retentionSample = retentionIsManualOverride() ? n(v('ppc-ret')) : autoRetentionSample;
    const quantityIssued = casesProduced * unitsPerCaseForStore();
    const qcSample = counter - retentionSample - totalRejected - quantityIssued;

    if (!retentionIsManualOverride()) {
        sv('ppc-ret', formatAutoField(autoRetentionSample));
    }
    sv('ppc-bc-counter', formatAutoField(counter));
    sv('ppc-total-rej', formatAutoField(totalRejected));
    sv('ppc-qc', formatAutoField(qcSample));
    sv('ppc-store', formatAutoField(quantityIssued));
}

function recalcCasesProducedFromPallets() {
    const containerId = state.packaging === 'CAN' ? 'ppc-can-pallet-rows' : 'ppc-pet-pallet-rows';
    const entries = collectPalletRowsInternal(containerId, true);
    const palletCases = entries.reduce((sum, entry) => sum + (n(entry?.count) * n(entry?.cases)), 0);
    const finalLoose = state.packaging === 'CAN' ? n(v('ppc-loose-final')) : getPetFinalLooseTotal();
    updatePetLooseTotalField();
    const looseAdded = n(state.packaging === 'CAN' ? v('ppc-loose-add') : v('ppc-loose-add-pet'));
    const casesProduced = palletCases + finalLoose - looseAdded;
    sv('ppc-cases', formatAutoField(casesProduced));
    recalcYieldFormula();
    recalcOEE();
    recalcBatchCompletionMetrics();
}

function getTodayCasesProducedForMetrics() {
    const totalCases = n(v('ppc-cases')) || n(state.current?.cases_produced || 0);
    const day = Math.max(1, n(state.current?.day_number || 1));
    if (day <= 1) return totalCases;

    const prevCases = n(state.previousDay?.cases_produced || 0);
    if (prevCases > 0) {
        // Day N reports store cumulative total in cases_produced; OEE should use only today's production.
        return totalCases >= prevCases ? (totalCases - prevCases) : totalCases;
    }

    const storedToday = n(state.current?.today_cases_produced || 0);
    return storedToday > 0 ? storedToday : totalCases;
}

function getProductVolumeMl() {
    const name = state.current?.recipe_name || v('ppc-product');
    const info = getBottleSizeInfo(name || '');
    if (info?.sizeMl && Number.isFinite(info.sizeMl)) return Number(info.sizeMl);

    const text = (name || '').toString().toLowerCase();
    const m = text.match(/(\d+(?:\.\d+)?)\s*(ml|l)\b/);
    if (!m) return 0;
    const qty = parseFloat(m[1]);
    if (!Number.isFinite(qty) || qty <= 0) return 0;
    return m[2] === 'l' ? qty * 1000 : qty;
}

function recalcOEE() {
    const startTime = v('ppc-start');
    const stopTime = v('ppc-stop');
    const casesProduced = getTodayCasesProducedForMetrics();

    if (!startTime || !stopTime || casesProduced <= 0) {
        sv('ppc-oee', '');
        return;
    }

    const [startH, startM] = startTime.split(':').map(Number);
    const [stopH, stopM] = stopTime.split(':').map(Number);
    if (![startH, startM, stopH, stopM].every(Number.isFinite)) {
        sv('ppc-oee', '');
        return;
    }

    let idealTimeMinutes = (stopH * 60 + stopM) - (startH * 60 + startM);
    if (idealTimeMinutes <= 0) idealTimeMinutes += 1440; // overnight shift

    const downtimeMinutes = Array.from(document.querySelectorAll('#ppc-dt-body .ppc-dt-t'))
        .reduce((sum, el) => sum + n(el.value), 0);

    const actualRunningTime = idealTimeMinutes - downtimeMinutes;
    if (actualRunningTime <= 0 || idealTimeMinutes <= 0) {
        sv('ppc-oee', '');
        return;
    }

    const availability = actualRunningTime / idealTimeMinutes;

    let idealSpeed;
    let unitsPerCase;
    if (state.packaging === 'CAN') {
        idealSpeed = 400;
        unitsPerCase = 24;
    } else {
        const volumeMl = getProductVolumeMl();
        if (volumeMl >= 2500) {
            idealSpeed = 198; // 2.5L PET
            unitsPerCase = 6;
        } else {
            idealSpeed = 306; // 330/500ml PET
            unitsPerCase = 24;
        }
    }

    const idealProduction = (idealSpeed * actualRunningTime) / unitsPerCase;
    if (idealProduction <= 0) {
        sv('ppc-oee', '');
        return;
    }

    const performance = casesProduced / idealProduction;
    const quality = 1.0;
    const oeeRaw = availability * performance * quality * 100;
    const oee = Math.min(100, Math.max(0, oeeRaw));

    sv('ppc-oee', oee.toFixed(4));
}

function recalcTotalVolume() {
    const recipe = state.current?.recipe_name || v('ppc-product');
    const target = n(v('ppc-target')) || n(state.current?.planned_qty || 0);
    const info = getBottleSizeInfo(recipe || '');
    if (info && target > 0) {
        const vol = Math.round(target * info.perCase * (info.sizeMl / 1000) * 10000) / 10000;
        sv('ppc-vol', vol || '');
    }
    recalcYieldFormula();
    recalcBatchCompletionMetrics();
}

function payload(nextStatus = null) {
    const emptyCanPalletsRounded = state.packaging === 'CAN'
        ? Math.max(0, Math.round(n(v('ppc-empty-can'))))
        : 0;
    const petCounterExtras = state.packaging === 'PET'
        ? normalizeOptionalNumberList(collectPetCounterExtras())
        : [];
    const petLooseExtras = state.packaging === 'PET'
        ? normalizeOptionalNumberList(collectPetLooseExtras())
        : [];
    const p = {
        packaging_type: state.packaging,
        product_name: v('ppc-product'),
        batch_no: v('ppc-batch'),
        start_time: v('ppc-start') || null,
        stop_time: v('ppc-stop') || null,
        cases_produced: n(v('ppc-cases')),
        production_date: v('ppc-date') || null,
        shift: 'A+B',
        line: v('ppc-line') || lineFromPack(state.packaging),
        day_number: n(state.current?.day_number || 0) || null,
        continues_next_day: continuationChecked(),
        previous_day_report_id: state.current?.previous_day_report_id || null,

        total_volume_liters: n(v('ppc-vol')),
        syrup_ratio: n(v('ppc-syr')),
        water_ratio: n(v('ppc-water')),
        expiry_date: v('ppc-exp') || null,
        gtin_barcode: v('ppc-gtin') || null,
        transfer_sheet_number: v('ppc-ts') || tsFromBatch(v('ppc-batch')),

        production_counter: n(v('ppc-counter')),
        production_counter_type_values: petCounterExtras,
        oee_percent: n(v('ppc-oee')),
        final_loose_cases: state.packaging === 'CAN' ? n(v('ppc-loose-final')) : getPetFinalLooseTotal(),
        final_loose_cases_type_values: petLooseExtras,
        loose_cases_added: n(state.packaging === 'CAN' ? v('ppc-loose-add') : v('ppc-loose-add-pet')),

        rejected_preform: n(v('ppc-rej-preform')),
        loaded_preform: n(v('ppc-load-preform')),
        loaded_caps: n(v('ppc-load-caps')),
        checkmate_rejected_bottles: n(v('ppc-pet-rej-bot')),
        line_damaged_bottles: n(v('ppc-pet-dmg-bot')),
        filled_bottle_pallets: n(v('ppc-pet-pal')),
        bottle_pallet_size: palletMixToStorage(collectPalletRows('ppc-pet-pallet-rows')) || null,
        bottle_pallet_type: normalizeTypeValues(collectPetTypesForStorage()).join(' ; ') || null,

        checkmate_rejected_cans: n(v('ppc-can-rej')),
        line_damaged_cans: n(v('ppc-can-dmg')),
        empty_can_pallets: emptyCanPalletsRounded,
        damaged_cans_added: optionalInt('ppc-can-dmg-added'),
        filled_can_pallets: n(v('ppc-can-pal')),
        can_pallet_size: palletMixToStorage(collectPalletRows('ppc-can-pallet-rows')) || null,

        batch_completion_date: v('ppc-bc-date') || null,
        batch_completion_batch_no: v('ppc-bc-batch') || null,
        batch_completion_counter: n(v('ppc-bc-counter')),
        total_rejection: n(v('ppc-total-rej')),
        qc_sample: n(v('ppc-qc')),
        retention_sample: n(v('ppc-ret')),
        quantity_issued_to_store: n(v('ppc-store')),
        today_production_counter: continuationTodayCounterValue(),
        today_checkmate_rejected: n(v('ppc-add-checkmate')),
        today_line_damaged: n(v('ppc-add-line')),
        today_rejected_preform: n(v('ppc-add-preform')),
        today_loose_cases_added: n(state.packaging === 'CAN' ? v('ppc-loose-add') : v('ppc-loose-add-pet')),
        today_cases_produced: getTodayCasesProducedForMetrics(),
        today_final_loose_cases: state.packaging === 'CAN' ? n(v('ppc-loose-final')) : getPetFinalLooseTotal(),
        today_filled_pallets: n(state.packaging === 'CAN' ? v('ppc-can-pal') : v('ppc-pet-pal')),
        today_empty_can_pallets: emptyCanPalletsRounded,

        down_time_entries: collectDtRows(),
        down_time_total: n(v('ppc-dt-total')),
        machine_hours: {
            filler: n(v('ppc-mh-filler')),
            contiform: n(v('ppc-mh-contiform')),
            mixer: n(v('ppc-mh-mixer')),
            contiroll: n(v('ppc-mh-contiroll')),
            variopac_pro_fs: n(v('ppc-mh-vfs')),
            shrinking_tunnel: n(v('ppc-mh-sh')),
            variopac_pro_tray: n(v('ppc-mh-vt')),
            palletizer: n(v('ppc-mh-pal')),
            depalletizer: n(v('ppc-mh-dep'))
        },
        notes: v('ppc-notes') || null
    };
    if (nextStatus) p.status = nextStatus;
    return p;
}

async function getByStatus(status) {
    try {
        const res = await authenticatedFetch(`/api/production-control-reports?status=${encodeURIComponent(status)}&limit=200`);
        if (!res.ok) return [];
        const data = await res.json();
        return data?.reports || [];
    } catch (_e) {
        return [];
    }
}

function byNewest(a, b) {
    const da = new Date(a?.updated_at || a?.created_at || 0).getTime();
    const db = new Date(b?.updated_at || b?.created_at || 0).getTime();
    return db - da;
}

function reportBatchKey(report) {
    return (report?.batch_no || report?.production_batch_id || '')
        .toString()
        .trim()
        .toUpperCase();
}

function batchHistoryCacheKey(batchNo) {
    return (batchNo || '').toString().trim().toUpperCase();
}

async function refreshLists() {
    const [pendingRaw, partialRaw, completedRaw] = await Promise.all([
        getByStatus('pending'),
        getByStatus('partial'),
        getByStatus('completed')
    ]);

    const completedBatchKeys = new Set(
        completedRaw.map((r) => reportBatchKey(r)).filter(Boolean)
    );

    const pendingVisible = [...pendingRaw, ...partialRaw].filter((r) => {
        const key = reportBatchKey(r);
        if (!key) return true;
        return !completedBatchKeys.has(key);
    });

    const dedup = new Map();
    pendingVisible.forEach((r) => dedup.set(r._id, r));
    state.pending = Array.from(dedup.values()).sort(byNewest);
    state.completed = [...completedRaw].sort(byNewest);
    state.batchHistoryCache = {};
    const completedBatchNos = Array.from(new Set(
        state.completed
            .map((r) => (r?.batch_no || '').toString().trim())
            .filter(Boolean)
    ));
    await Promise.all(completedBatchNos.map((batchNo) => getBatchHistoryReports(batchNo)));

    await hydrateItemCodes([...state.pending, ...state.completed]);
    renderPending();
    renderCompleted();
}

async function getBatchHistoryReports(batchNo) {
    const apiBatchNo = (batchNo || '').toString().trim();
    if (!apiBatchNo) return [];
    const key = batchHistoryCacheKey(apiBatchNo);
    if (Array.isArray(state.batchHistoryCache[key])) return state.batchHistoryCache[key];
    try {
        const res = await authenticatedFetch(`/api/production-control-reports/batch-history/${encodeURIComponent(apiBatchNo)}`);
        if (!res.ok) return [];
        const data = await res.json();
        const reports = [...(data?.reports || [])].sort((a, b) => {
            const dayA = Math.max(1, Math.trunc(n(a?.day_number || 1)));
            const dayB = Math.max(1, Math.trunc(n(b?.day_number || 1)));
            if (dayA !== dayB) return dayA - dayB;
            return byNewest(a, b);
        });
        state.batchHistoryCache[key] = reports;
        return reports;
    } catch (_e) {
        return [];
    }
}

function getCachedBatchHistoryReports(batchNo) {
    const key = batchHistoryCacheKey(batchNo);
    if (!key) return [];
    return Array.isArray(state.batchHistoryCache[key]) ? state.batchHistoryCache[key] : [];
}

function pendingCard(r) {
    const prodDate = d(r.production_date) || '-';
    const title = h(r.product_name || r.recipe_name || 'Unnamed Product');
    const batch = h(r.batch_no || '-');
    const target = n(r.planned_qty) > 0 ? n(r.planned_qty) : '-';
    const code = h(r.item_code || mappedCode(r.recipe_name, r.product_name) || '-');
    const statusRaw = (r.status || 'pending').toLowerCase();
    const dayNum = Math.max(1, n(r.day_number || 1));
    const isPartial = statusRaw === 'partial' || !!r.is_partial;
    const isPendingNextDay = statusRaw === 'pending' && dayNum > 1;
    const st = isPartial
        ? `DAY ${dayNum} COMPLETED`
        : (isPendingNextDay ? `DAY ${dayNum} PENDING` : statusRaw.toUpperCase());
    const openLabel = isPartial
        ? `View Day ${dayNum}`
        : (isPendingNextDay ? `Fill Report For Day ${dayNum}` : 'Open');
    const openReadonly = isPartial ? 'true' : 'false';
    const reportNo = h(r.report_number || '-');
    return `
    <div class="ppc-card">
      <div>
        <div class="ppc-title">${title}</div>
        <div class="ppc-meta">Batch: ${batch} | Date: ${prodDate} | Target: ${target} | Code: ${code}</div>
        <div class="ppc-meta">Report: ${reportNo} | Status: ${st}</div>
      </div>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        ${hasAnyRole(['admin', 'manager']) ? `<button class="ppc-btn" onclick="deleteProductionReport('${r._id}')">Delete</button>` : ''}
        <button class="ppc-btn" title="Edit report" aria-label="Edit report" onclick="editReportById('${r._id}')">&#9998;</button>
        <button class="ppc-btn ppc-btn-primary" onclick="openPendingReportById('${r._id}', ${openReadonly})">${openLabel}</button>
      </div>
    </div>`;
}

function completedCard(r) {
    const prodDate = d(r.production_date) || '-';
    const title = h(r.product_name || r.recipe_name || 'Unnamed Product');
    const batch = h(r.batch_no || '-');
    const reportNo = h(r.report_number || '-');
    const batchReports = getCachedBatchHistoryReports(r.batch_no);
    const dayNumbers = Array.from(new Set(
        batchReports
            .map((row) => Math.max(1, Math.trunc(n(row?.day_number || 1))))
            .filter((day) => day > 0)
    )).sort((a, b) => a - b);
    const finalDay = Math.max(
        Math.max(1, Math.trunc(n(r.day_number || 1))),
        dayNumbers.length ? dayNumbers[dayNumbers.length - 1] : 1
    );
    const dayButtons = dayNumbers.length
        ? dayNumbers.filter((day) => day < finalDay)
        : Array.from({ length: Math.max(0, finalDay - 1) }, (_x, idx) => idx + 1);
    const dayDownloadButtons = dayButtons.map((day) => {
        return `<button class="ppc-btn" onclick="downloadCompletedDayReportById('${r._id}', ${day})">Download Day ${day}</button>`;
    }).join('');
    return `
    <div class="ppc-card">
      <div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:nowrap">
          <div class="ppc-title" style="min-width:440px;flex:0 0 440px">${title}</div>
          <button class="ppc-btn ppc-btn-success" style="flex-shrink:0" onclick="showMaterialsUsedById('${r._id}')">Materials Used</button>
        </div>
        <div class="ppc-meta">Batch: ${batch} | Date: ${prodDate}</div>
        <div class="ppc-meta">Report: ${reportNo} | Status: COMPLETED</div>
      </div>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
        ${hasAnyRole(['admin', 'manager']) ? `<button class="ppc-btn" onclick="deleteProductionReport('${r._id}')">Delete</button>` : ''}
        <button class="ppc-btn" title="Edit report" aria-label="Edit report" onclick="editReportById('${r._id}')">&#9998;</button>
        ${dayDownloadButtons}
        <button class="ppc-btn" onclick="downloadCombinedReportPdf('${r._id}')">Download Combined</button>
        <button class="ppc-btn ppc-btn-primary" onclick="downloadCompletedReportPdf('${r._id}')">Download Completed</button>
      </div>
    </div>`;
}

function renderPending() {
    const c = id('pcr-pending-list');
    if (!c) return;
    if (!state.pending.length) {
        c.innerHTML = '<div class="ppc-meta" style="padding:8px 0">No pending reports.</div>';
        return;
    }
    c.innerHTML = state.pending.map((r) => pendingCard(r)).join('');
}

function renderCompleted() {
    const c = id('pcr-history-list');
    if (!c) return;

    const search = (id('pcr-history-search')?.value || '').toLowerCase().trim();

    let reports = [...state.completed];

    if (search) {
        reports = reports.filter((r) => {
            const product = (r.product_name || r.recipe_name || '').toLowerCase();
            const batch = (r.batch_no || '').toLowerCase();
            return product.includes(search) || batch.includes(search);
        });
    }

    const batchNum = (v) => {
        const m = String(v || '').match(/\d+/);
        return m ? parseInt(m[0], 10) : -1;
    };
    reports.sort((a, b) => batchNum(b.batch_no) - batchNum(a.batch_no));

    if (!reports.length) {
        c.innerHTML = `<div class="ppc-meta" style="padding:8px 0">${search ? 'No reports match your search.' : 'No completed reports.'}</div>`;
        return;
    }
    c.innerHTML = reports.map((r) => completedCard(r)).join('');
}

function showTab(tab) {
    const tabs = ['pending', 'form', 'history'];
    tabs.forEach((t) => {
        id(`pcr-content-${t}`)?.classList.add('hidden');
        const btn = id(`pcr-subtab-${t}`);
        if (btn) {
            btn.classList.remove('bg-blue-600', 'text-white');
            btn.classList.add('bg-white', 'text-slate-700', 'border-slate-300');
        }
    });
    id(`pcr-content-${tab}`)?.classList.remove('hidden');
    const active = id(`pcr-subtab-${tab}`);
    if (active) {
        active.classList.remove('bg-white', 'text-slate-700', 'border-slate-300');
        active.classList.add('bg-blue-600', 'text-white');
    }
}

function resetFormFields() {
    if (state.readonly) return;
    if (!confirm('Clear all editable fields? Product, batch, and target will be kept.')) return;
    const keep = ['ppc-product', 'ppc-batch', 'ppc-target', 'ppc-chip-target', 'ppc-chip-batch'];
    const root = id('pcr-content-form');
    if (!root) return;
    root.querySelectorAll('input,textarea,select').forEach((el) => {
        if (keep.includes(el.id)) return;
        if (el.type === 'checkbox') { el.checked = false; return; }
        if (el.type === 'radio') return;
        el.value = '';
    });
    const dtBody = id('ppc-dt-body');
    if (dtBody) { dtBody.innerHTML = ''; dtBody.insertAdjacentHTML('beforeend', dtRow({})); }
    recalcDownTimeTotal();
    recalcTotalVolume();
    scheduleAutoSave();
}

function mountForm() {
    injectStyles();
    const root = id('pcr-content-form');
    if (!root) return;
    clearAutoSaveTimer();
    autoSaveDirty = false;
    root.innerHTML = formTemplate();
    const formRoot = root.querySelector('.ppc-sheet') || root;
    formRoot.addEventListener('input', (e) => {
        if (shouldAutoSaveTarget(e.target)) scheduleAutoSave();
    });
    formRoot.addEventListener('change', (e) => {
        if (shouldAutoSaveTarget(e.target)) scheduleAutoSave();
    });

    id('ppc-reset')?.addEventListener('click', () => resetFormFields());
    id('ppc-save')?.addEventListener('click', () => saveReportDraft());
    id('ppc-submit')?.addEventListener('click', () => submitReport());
    id('ppc-pdf')?.addEventListener('click', () => downloadReportPdf());
    id('ppc-dt-body')?.addEventListener('input', (e) => {
        if (e.target?.classList?.contains('ppc-dt-t')) recalcDownTimeTotal();
    });
    id('ppc-date')?.addEventListener('input', () => {
        syncTopDateDisplay();
        syncBatchCompletionDate(true);
    });
    id('ppc-date')?.addEventListener('change', () => {
        syncTopDateDisplay();
        syncBatchCompletionDate(true);
    });
    id('ppc-continue-next')?.addEventListener('change', () => {
        seedContinuationInputsFromCurrent();
        recalcContinuationTotals();
        recalcYieldFormula();
    });
    [['ppc-can-pallet-counts', 'ppc-can-pallet-rows'], ['ppc-pet-pallet-counts', 'ppc-pet-pallet-rows']].forEach(([countId, rowsId]) => {
        id(countId)?.addEventListener('input', () => { syncPalletTotal(rowsId); recalcCasesProducedFromPallets(); });
        id(countId)?.addEventListener('change', () => { syncPalletTotal(rowsId); recalcCasesProducedFromPallets(); });
        id(rowsId)?.addEventListener('input', () => recalcCasesProducedFromPallets());
        id(rowsId)?.addEventListener('change', () => recalcCasesProducedFromPallets());
        id(rowsId)?.addEventListener('click', (e) => {
            const btn = e.target?.closest?.('.ppc-icon-btn');
            if (!btn) return;
            const action = btn.getAttribute('data-pallet-action');
            if (action === 'add') addPalletMixRow(rowsId, btn);
            if (action === 'remove') removePalletMixRow(rowsId, btn);
        });
    });
    ['ppc-pet-pallet-types', 'ppc-pet-loose-types'].forEach((containerId) => {
        id(containerId)?.addEventListener('click', (e) => {
            const btn = e.target?.closest?.('.ppc-icon-btn');
            if (!btn) return;
            const action = btn.getAttribute('data-pallet-action');
            if (action === 'add') addPetTypeRow(containerId, btn);
            if (action === 'remove') removePetTypeRow(containerId, btn);
        });
        ['input', 'change'].forEach((eventName) => {
            id(containerId)?.addEventListener(eventName, () => {
                if (containerId === 'ppc-pet-pallet-types') {
                    const expectedExtras = Math.max(0, petProductionTypeCount() - 1);
                    const actualExtras = collectPetCounterExtras().length;
                    if (actualExtras !== expectedExtras) {
                        syncPetCounterExtrasWithTypes();
                    } else {
                        updatePetCounterTotalField();
                    }
                    if (continuationPetTypeLockActive()) {
                        recalcContinuationTotals();
                    } else {
                        recalcBatchCompletionMetrics();
                    }
                } else {
                    syncPetLooseExtrasWithTypes();
                    recalcCasesProducedFromPallets();
                }
                scheduleAutoSave();
            });
        });
    });
    ['ppc-start', 'ppc-stop', 'ppc-cases', 'ppc-product'].forEach((fieldId) => {
        id(fieldId)?.addEventListener('input', () => recalcOEE());
        id(fieldId)?.addEventListener('change', () => recalcOEE());
    });
    id('ppc-counter')?.addEventListener('input', () => recalcEmptyCanPalletsAuto());
    id('ppc-counter')?.addEventListener('change', () => recalcEmptyCanPalletsAuto());
    id('ppc-product')?.addEventListener('input', () => {
        syncEmptyCanPalletDenominator(true);
        setEmptyCanManualOverride(false);
        recalcEmptyCanPalletsAuto(true);
    });
    id('ppc-product')?.addEventListener('change', () => {
        syncEmptyCanPalletDenominator(true);
        setEmptyCanManualOverride(false);
        recalcEmptyCanPalletsAuto(true);
    });
    id('ppc-rej-preform')?.addEventListener('input', () => recalcPetPreformAndCapsAuto());
    id('ppc-rej-preform')?.addEventListener('change', () => recalcPetPreformAndCapsAuto());
    const emptyCanInput = id('ppc-empty-can');
    const onEmptyCanEdit = (e) => {
        const raw = (e?.target?.value ?? '').toString().trim();
        if (!raw) {
            setEmptyCanManualOverride(false);
            recalcEmptyCanPalletsAuto(true);
            return;
        }
        const rounded = Math.max(0, Math.round(n(raw)));
        sv('ppc-empty-can', String(rounded));
        setEmptyCanManualOverride(true);
    };
    emptyCanInput?.addEventListener('input', onEmptyCanEdit);
    emptyCanInput?.addEventListener('change', onEmptyCanEdit);
    ['ppc-empty-can-den'].forEach((fieldId) => {
        id(fieldId)?.addEventListener('input', () => {
            setEmptyCanManualOverride(false);
            recalcEmptyCanPalletsAuto(true);
        });
        id(fieldId)?.addEventListener('change', () => {
            setEmptyCanManualOverride(false);
            recalcEmptyCanPalletsAuto(true);
        });
    });
    ['ppc-counter', 'ppc-can-rej', 'ppc-can-dmg', 'ppc-pet-rej-bot', 'ppc-pet-dmg-bot', 'ppc-cases', 'ppc-product'].forEach((fieldId) => {
        id(fieldId)?.addEventListener('input', () => recalcBatchCompletionMetrics());
        id(fieldId)?.addEventListener('change', () => recalcBatchCompletionMetrics());
    });
    ['ppc-loose-final', 'ppc-loose-add', 'ppc-loose-final-pet', 'ppc-loose-add-pet'].forEach((fieldId) => {
        id(fieldId)?.addEventListener('input', () => recalcCasesProducedFromPallets());
        id(fieldId)?.addEventListener('change', () => recalcCasesProducedFromPallets());
    });
    id('ppc-pet-counter-extras')?.addEventListener('input', () => {
        if (continuationPetTypeLockActive()) {
            recalcContinuationTotals();
        } else {
            recalcBatchCompletionMetrics();
        }
        scheduleAutoSave();
    });
    id('ppc-pet-counter-extras')?.addEventListener('change', () => {
        if (continuationPetTypeLockActive()) {
            recalcContinuationTotals();
        } else {
            recalcBatchCompletionMetrics();
        }
        scheduleAutoSave();
    });
    id('ppc-pet-loose-extras')?.addEventListener('input', () => { recalcCasesProducedFromPallets(); scheduleAutoSave(); });
    id('ppc-pet-loose-extras')?.addEventListener('change', () => { recalcCasesProducedFromPallets(); scheduleAutoSave(); });
    ['ppc-add-counter', 'ppc-add-checkmate', 'ppc-add-line', 'ppc-add-preform'].forEach((fieldId) => {
        id(fieldId)?.addEventListener('input', () => recalcContinuationTotals());
        id(fieldId)?.addEventListener('change', () => recalcContinuationTotals());
    });
    id('ppc-ret')?.addEventListener('input', (e) => {
        const raw = (e.target?.value ?? '').toString().trim();
        setRetentionManualOverride(raw !== '');
        recalcBatchCompletionMetrics();
    });
    id('ppc-ret')?.addEventListener('change', (e) => {
        const raw = (e.target?.value ?? '').toString().trim();
        setRetentionManualOverride(raw !== '');
        recalcBatchCompletionMetrics();
    });
    ['ppc-oee'].forEach((fieldId) => {
        const el = id(fieldId);
        if (el) {
            el.readOnly = true;
            el.classList.add('ppc-read');
            el.title = 'Auto-calculated from Start/Stop time, Cases Produced, and Downtime';
        }
    });
    ['ppc-oee-a', 'ppc-oee-den', 'ppc-oee-b'].forEach((fieldId) => {
        const el = id(fieldId);
        if (el) {
            el.readOnly = true;
            el.classList.add('ppc-read');
            el.title = 'Auto-calculated from Cases Produced and Target Cases';
        }
    });
    ['ppc-cases'].forEach((fieldId) => {
        const el = id(fieldId);
        if (el) {
            el.readOnly = true;
            el.classList.add('ppc-read');
            el.title = 'Auto-calculated from pallet and loose-case values';
        }
    });
    ['ppc-load-preform', 'ppc-load-caps'].forEach((fieldId) => {
        const el = id(fieldId);
        if (el) {
            el.readOnly = true;
            el.classList.add('ppc-read');
            el.title = 'Auto-calculated for PET line';
        }
    });
    ['ppc-bc-counter', 'ppc-total-rej', 'ppc-qc', 'ppc-store'].forEach((fieldId) => {
        const el = id(fieldId);
        if (el) {
            el.readOnly = true;
            el.classList.add('ppc-read');
            el.title = 'Auto-calculated from production values';
        }
    });
    const retentionEl = id('ppc-ret');
    if (retentionEl) {
        retentionEl.readOnly = false;
        retentionEl.classList.remove('ppc-read');
        retentionEl.title = 'Auto-shows 12/18; user-entered value overrides auto';
    }
    setRetentionManualOverride(false);
    setEmptyCanManualOverride(false);
    sv('ppc-empty-can-den', '5460');
    sv('ppc-shift', 'A+B');
    syncTopDateDisplay();
    syncBatchCompletionDate();
    updateContinuationLabels();
    toggleBatchCompletionVisibility();
    setContinuationTargetReadOnly(false);
    renderPalletRows('ppc-can-pallet-rows', '');
    renderPalletRows('ppc-pet-pallet-rows', '');
    renderPetTypeColumns('ppc-pet-pallet-types', [''], true);
    renderPetTypeColumns('ppc-pet-loose-types', [''], true);
    syncPetCounterExtrasWithTypes([]);
    syncPetLooseExtrasWithTypes([]);
    renderDtRows([]);
    recalcDownTimeTotal();
    recalcContinuationTotals();
    recalcEmptyCanPalletsAuto();
    recalcCasesProducedFromPallets();
    recalcYieldFormula();
    recalcOEE();
    recalcBatchCompletionMetrics();
    setPackaging(state.packaging);
}

async function openReport(reportId, forceReadonly = false, forceEditable = false) {
    try {
        const res = await authenticatedFetch(`/api/production-control-reports/${reportId}`);
        if (!res.ok) {
            showToast('Failed to load report', 'error');
            return;
        }
        const report = await res.json();
        await hydrateItemCodes([report]);
        mountForm();
        await fillForm(report);
        recalcDownTimeTotal();
        recalcTotalVolume();
        state.editOverride = !!forceEditable;
        const lockByStatus = isLockedStatus(report.status) && !state.editOverride;
        setReadonly(forceReadonly || lockByStatus);
        showTab('form');
    } catch (_e) {
        showToast('Failed to load report', 'error');
    }
}

async function persist(nextStatus = null) {
    if (!state.current?._id) {
        showToast('Select a report first', 'warning');
        return null;
    }
    clearAutoSaveTimer();
    if (autoSaveInFlight) await waitForAutoSaveIdle();
    autoSaveDirty = false;
    recalcDownTimeTotal();
    const body = payload(nextStatus);
    try {
        const res = await authenticatedFetch(`/api/production-control-reports/${state.current._id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            const detail = err?.detail;
            const msg = typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map(e => e.msg || JSON.stringify(e)).join('; ') : 'Failed to save report';
            showToast(msg, 'error');
            return null;
        }
        const updated = await res.json();
        await hydrateItemCodes([updated]);
        await fillForm(updated);
        const lockByStatus = isLockedStatus(updated.status) && !state.editOverride;
        setReadonly(lockByStatus);
        await refreshLists();
        return updated;
    } catch (_e) {
        showToast('Failed to save report', 'error');
        return null;
    }
}

export async function loadProductionControlPage() {
    injectStyles();
    showTab('pending');
    await refreshLists();
}

export async function switchProductionControlSubTab(subTab) {
    const tab = ['pending', 'form', 'history'].includes(subTab) ? subTab : 'pending';
    if (tab === 'form' && !state.current?._id) {
        showToast('Open a report from Pending or Completed list', 'warning');
        showTab('pending');
        await refreshLists();
        return;
    }
    showTab(tab);
    if (tab !== 'form') await refreshLists();
}

export function togglePackagingType(type) {
    setPackaging((type || '').toString().toUpperCase() === 'CAN' ? 'CAN' : 'PET');
    recalcTotalVolume();
}

export function addDownTimeEntry() {
    if (state.readonly) return;
    id('ppc-dt-body')?.insertAdjacentHTML('beforeend', dtRow({}));
    recalcDownTimeTotal();
    scheduleAutoSave();
}

export function addDownTimeEntryAfter(target) {
    if (state.readonly) return;
    const row = target?.closest?.('tr');
    if (!row) {
        addDownTimeEntry();
        return;
    }
    row.insertAdjacentHTML('afterend', dtRow({}));
    recalcDownTimeTotal();
    scheduleAutoSave();
}

export function removeDownTimeEntry(target) {
    if (state.readonly) return;
    const body = id('ppc-dt-body');
    if (!body) return;

    if (target && typeof target.closest === 'function') {
        target.closest('tr')?.remove();
    } else if (Number.isInteger(target)) {
        body.querySelectorAll('tr')?.[target]?.remove();
    } else {
        body.querySelector('tr:last-child')?.remove();
    }

    if (!body.querySelector('tr')) {
        body.insertAdjacentHTML('beforeend', dtRow({}));
    }
    recalcDownTimeTotal();
    scheduleAutoSave();
}

export function updateDownTimeEntry() {
    recalcDownTimeTotal();
    scheduleAutoSave();
}

export async function saveReportDraft() {
    const currentStatus = (state.current?.status || '').toLowerCase();
    const keepLockedStatus = state.editOverride && isLockedStatus(currentStatus);
    const targetStatus = keepLockedStatus ? currentStatus : 'pending';
    const updated = await persist(targetStatus);
    if (updated) showToast('Draft saved', 'success');
}

export async function submitReport() {
    const nextStatus = continuationChecked() ? 'partial' : 'completed';
    const updated = await persist(nextStatus);
    if (!updated) return;
    if (nextStatus === 'partial') {
        showToast('Partial report submitted. Next day report created.', 'success');
        await switchProductionControlSubTab('pending');
        return;
    }
    showToast('Report submitted', 'success');
    await switchProductionControlSubTab('history');
}

export async function downloadReportPdf() {
    if (!state.current?._id) {
        showToast('Open a report first', 'warning');
        return;
    }
    try {
        const res = await authenticatedFetch(`/api/production-control-reports/${state.current._id}/pdf`);
        if (!res.ok) {
            showToast('Failed to generate PDF', 'error');
            return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const cd = res.headers.get('content-disposition') || '';
        const m = cd.match(/filename\*?=(?:UTF-8''|")?([^\";]+)/i);
        const fallback = `${state.current?.report_number || state.current?.batch_no || 'production-report'}.pdf`;
        const filename = m ? decodeURIComponent(m[1]) : fallback;
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    } catch (_e) {
        showToast('Failed to download PDF', 'error');
    }
}

export async function downloadCompletedReportPdf(reportId) {
    if (!reportId) {
        showToast('Open a report first', 'warning');
        return;
    }
    try {
        const res = await authenticatedFetch(`/api/production-control-reports/${reportId}/pdf`);
        if (!res.ok) {
            showToast('Failed to generate PDF', 'error');
            return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const cd = res.headers.get('content-disposition') || '';
        const m = cd.match(/filename\*?=(?:UTF-8''|")?([^\";]+)/i);
        const filename = m ? decodeURIComponent(m[1]) : `production-report-${reportId}.pdf`;
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    } catch (_e) {
        showToast('Failed to download PDF', 'error');
    }
}

export async function downloadCompletedDayReportById(completedReportId, dayNumber) {
    const completed = state.completed.find((r) => r?._id === completedReportId);
    if (!completed) {
        showToast('Report not found', 'warning');
        return;
    }
    const reports = await getBatchHistoryReports(completed.batch_no);
    if (!reports.length) {
        showToast('No day reports found for this batch', 'warning');
        return;
    }
    const day = Math.max(1, Math.trunc(n(dayNumber || 1)));
    const dayReport = reports.find((r) => Math.max(1, Math.trunc(n(r?.day_number || 1))) === day);
    if (!dayReport?._id) {
        showToast(`Day ${day} report not found`, 'warning');
        return;
    }
    await downloadCompletedReportPdf(dayReport._id);
}

export async function downloadCombinedReportPdf(reportId) {
    if (!reportId) {
        showToast('Open a report first', 'warning');
        return;
    }
    try {
        const res = await authenticatedFetch(`/api/production-control-reports/${reportId}/pdf-combined`);
        if (!res.ok) {
            showToast('Failed to generate combined PDF', 'error');
            return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const cd = res.headers.get('content-disposition') || '';
        const m = cd.match(/filename\*?=(?:UTF-8''|")?([^\";]+)/i);
        const filename = m ? decodeURIComponent(m[1]) : `production-report-combined-${reportId}.pdf`;
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    } catch (_e) {
        showToast('Failed to download combined PDF', 'error');
    }
}

export async function showMaterialsUsedById(reportId) {
    if (!reportId) {
        showToast('Report not found', 'warning');
        return;
    }
    try {
        const report = await getReportForMaterials(reportId);
        if (!report) {
            showToast('Report not found', 'warning');
            return;
        }
        const model = buildMaterialsUsedModel(report);
        renderMaterialsUsedModal(report, model);
    } catch (_e) {
        showToast('Failed to load materials used', 'error');
    }
}

export async function editReportById(reportId) {
    await openReport(reportId, false, true);
}

export async function resetPendingReport(reportId) {
    if (!confirm('This will clear all form data for this report and delete any continuation day reports.\n\nOnly product name, item code, and target cases will be kept.\n\nContinue?')) return;
    try {
        const res = await authenticatedFetch(`/api/production-control-reports/${reportId}/reset`, { method: 'POST' });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            const detail = err?.detail;
            const msg = typeof detail === 'string' ? detail : 'Failed to reset report';
            showToast(msg, 'error');
            return;
        }
        showToast('Report data cleared', 'success');
        if (state.current?._id === reportId) state.current = null;
        await refreshLists();
        showTab('pending');
    } catch (_e) {
        showToast('Failed to reset report', 'error');
    }
}

export async function deleteProductionReport(reportId) {
    if (!hasAnyRole(['admin', 'manager'])) {
        showToast('You do not have permission to delete reports', 'error');
        return;
    }
    if (!confirm('Are you sure you want to delete this report?')) return;
    try {
        const res = await authenticatedFetch(`/api/production-control-reports/${reportId}`, { method: 'DELETE' });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            showToast(err?.detail || 'Failed to delete report', 'error');
            return;
        }
        if (state.current?._id === reportId) state.current = null;
        showToast('Report deleted', 'success');
        await switchProductionControlSubTab('pending');
    } catch (_e) {
        showToast('Failed to delete report', 'error');
    }
}

// Non-exported internal functions needed by inline HTML handlers
window.openReportById = (reportId) => openReport(reportId, false);
window.openPendingReportById = (reportId, forceReadonly = false) => openReport(reportId, !!forceReadonly);
window.viewReportById = (reportId) => openReport(reportId, true);
window.resetPendingReport = resetPendingReport;
window.ppcHistoryFilter = renderCompleted;
