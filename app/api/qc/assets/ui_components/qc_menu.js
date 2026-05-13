import {
  qcGetAllRecipes,
  qcGetFillerMixerCip,
  qcGetQcReport,
  qcGetQcReportDefaultUv,
  qcGetSeamCheck,
  qcDeleteBatch,
  qcGetBatches,
  qcGetMixing,
  qcGetRecipesSummary,
  qcGetTankCip,
  qcGetPickingSheetRef,
  qcGetPickingSheetData,
  qcGetCoverPage,
  qcSaveCoverPage,
  qcDownloadCoverPagePdf,
  qcFetchPdfBlob,
  qcDownloadFillerMixerCipPdf,
  qcDownloadCombinedQcRecordPdf,
  qcDownloadQcReportPdf,
  qcDownloadSeamCheckPdf,
  qcGetTemplatePayload,
  qcDownloadTankCipPdf,
  qcDownloadMixingPdf,
  qcSaveFillerMixerCip,
  qcSaveMixing,
  qcSaveQcReport,
  qcSaveSeamCheck,
  qcSaveTankCip,
  qcSaveTemplatePayload,
  qcUpdateBatchIdentifiers,
} from './qc_api.js';

const state = {
  viewReady: false,
  batches: [],
  selectedBatchNo: null,
  /** When false with a selection, sidebar shows only the active batch (search expands to all). */
  qcShowAllBatchCards: false,
  activeSubmenu: 'picking_sheet',
  mixingData: null,
  tankCipData: null,
  fillerMixerCipData: null,
  qcReportData: null,
  seamCheckData: null,
  mixingAutoSaveTimer: null,
  mixingAutoSaveInFlight: false,
  mixingAutoSaveQueued: false,
  mixingLastSavedSnapshot: '',
  mixingAutoSaveTankHinted: false,
  tankCipLastSavedSnapshot: '',
  fillerMixerCipLastSavedSnapshot: '',
  qcReportLastSavedSnapshot: '',
  seamCheckLastSavedSnapshot: '',
  tankCipAutoSaveTimer: null,
  fillerMixerCipAutoSaveTimer: null,
  qcReportAutoSaveTimer: null,
  seamCheckAutoSaveTimer: null,
  tankCipAutoSaveInFlight: false,
  fillerMixerCipAutoSaveInFlight: false,
  qcReportAutoSaveInFlight: false,
  seamCheckAutoSaveInFlight: false,
  tankCipAutoSaveQueued: false,
  fillerMixerCipAutoSaveQueued: false,
  qcReportAutoSaveQueued: false,
  seamCheckAutoSaveQueued: false,
  templatePayload: null,
  recipeCatalog: [],
  configRecipeNames: [],
  configRecipeSearch: '',
  configTemplateType: '',
  configPendingTemplateType: '',
  pickingSheetObjectUrl: null,
  qcReportWizard: { dayIndex: 0, dataRowIndex: 1, timeAutofillKey: '', timeAutofilledRows: new Set() },
  seamCheckWizard: { rowIndex: 0 },
};

const NON_DATA_ENTRY_KEYS = new Set(['shelf_life', 'date_coding', 'pd_date', 'ratio', 'samples']);
const MIXING_AUTO_SAVE_DELAY_MS = 700;
const TANK_CIP_AUTO_SAVE_DELAY_MS = 700;
const QC_REPORT_AUTO_SAVE_DELAY_MS = 700;
const SEAM_CHECK_AUTO_SAVE_DELAY_MS = 700;

const MIXING_CHECK_DEFAULTS = [
  { key: 'appearance', test: 'Appearance', result_type: 'checkbox', data_entry: true, quality_keys: ['appearance'] },
  { key: 'syrup_brix', test: 'Syrup Brix', result_type: 'text', data_entry: true, quality_keys: ['syrup_brix', 'syrup brix'] },
  { key: 'rtd_brix', test: 'RTD Brix', result_type: 'text', data_entry: true, quality_keys: ['brix', 'rtd_brix', 'rtd brix'] },
  { key: 'ph', test: 'pH', result_type: 'text', data_entry: true, quality_keys: ['ph', 'p_h'] },
  { key: 'acidity', test: 'Acidity', result_type: 'text', data_entry: true, quality_keys: ['acidity'] },
  { key: 'co2_spec', test: 'CO2 Spec', result_type: 'text', data_entry: true, quality_keys: ['co2', 'co2_spec'] },
  { key: 'shelf_life', test: 'Shelf Life', result_type: 'text', data_entry: false, quality_keys: ['shelf_life'] },
  { key: 'date_coding', test: 'Date Coding', result_type: 'text', data_entry: false, quality_keys: ['date_coding', 'pd_coding'] },
  { key: 'ratio', test: 'Ratio', result_type: 'text', data_entry: false, quality_keys: ['ratio'] },
  { key: 'samples', test: 'Samples', result_type: 'text', data_entry: false, quality_keys: ['samples'] },
];

const TANK_CIP_CLEANING_SEQUENCE = 'Hot Water - Caustic - Oxonia - RO Water';
const FILLER_CIP_SIGN_NAMES = ['Bilal Paul', 'Shabeer', 'Idrees', 'Dilzaib'];
const TANK_MIXING_SIGN_NAMES = ['Zeeshan Alam', 'Zeeshan Ahmad', 'Umer', 'Zeeshan Iqbal', 'Usman'];
const TANK_CIP_SOLUTION_OPTIONS = ['Hot Water', 'Caustic 85C 1.7%', 'Topaz MD3 0.2%', 'Acid 1.3%', 'Oxonia 0.2% (80 ppm)', 'Sodium Hypochlorite 10-12% (2-5ppm)', 'RO Water'];
const TANK_CIP_LINE_OPTIONS = ['CAN', 'PET'];
const TANK_CIP_RINSER_FILTER_OPTIONS = [
  { value: '0_5_micro', label: '0.5 micrometer filter' },
  { value: '1_micro', label: '1 micrometer filter' },
];
const TANK_CIP_SWAB_TEST_TEMPLATES = [
  { id: 'filler_aqua_swab', label: 'Filler aqua swab __ RLU' },
  { id: 'mixer_aqua_swab', label: 'Mixer Aqua Swab __ RLU' },
  { id: 'pasturizer_aqua_swab', label: 'Pasturizer aqua swab __ RLU' },
  { id: 'syrup_tank_aqua_swab', label: 'Syrup Tank No. __ Aqua Swab __ RLU' },
  { id: 'mixing_tank_aqua_swab', label: 'Mixing Tank Aqua Swab __ RLU' },
  { id: 'mixing_hopper_surface_swab', label: 'Mixing Hopper Surface Swab __ RLU' },
  { id: 'sugar_tank_aqua_swab', label: 'Sugar Tank Aqua Swab __ RLU' },
  { id: 'ro_tank_aqua_swab', label: 'RO-Tank No __ Aqua Swab __ RLU' },
  { id: 'rinser_aqua_swab', label: 'Rinser Aqua Swab __ RLU' },
  { id: 'rinser_surface_swab', label: 'Rinser Surface Swab __ RLU' },
  { id: 'cip_tank_surface_swab', label: 'CIP Tank No. __ Surface Swab __ RLU' },
  { id: 'filler_nozzle_surface_swab', label: 'Filler Nozzle No. __ Surface Swab __ RLU' },
  { id: 'filler_nozzle_surface_swab_2', label: 'Filler Nozzle No. __ Surface Swab __ RLU' },
  { id: 'multimedia_filter_swab', label: 'Multimedia Filter Swab __ RLU' },
];

const TANK_CIP_TYPE_CONFIG = {
  '3_step': {
    title: '3 STEP C.I.P PROCEDURE AND CHECKLIST',
    doc_ref: 'KBF/PRD/58',
    issue_no: '01',
    effective_date: '24/11/2014',
    revision_date: '21/08/2019',
    page_text: '1 of 1',
    solution_row_count: 7,
    has_ro_ph_table: true,
    has_observations: false,
    show_oxonia_strip_result: true,
    procedure_lines: [
      'THIS PROCEDURE IS TO BE FOLLOWED TWICE A WEEK AND BEFORE STARTUP OF A PRODUCTION LINE.',
      'TO BE FOLLOWED ONCE A DAY WITH A TANK CIP.',
      'The three-step cleaning procedure can be used when the more thorough five-step process is not necessary, but sanitizing the equipment is required. The three-step cleaning consists of the following:',
      '1.1 Step 1 - Rinse with treated water for 5-10 minutes (ambient temperature).',
      'The first rinse is important to minimize the soil load. This removes most of the soluble material and increases the effectiveness of the cleaning agent.',
      '1.2 Step 2 - Rinse with 1-1.7% MIP CA ECOLAB at 66-85C.',
      'Allow solution to circulate for 20 to 30 minutes. The cleaning agent loosens residual soil particles from the surface of equipment. The hot water acts as a mild cleaning agent and a sanitizing agent to destroy microbial contamination. Check for color change.',
      '1.3 Step 3 - Rinse with treated water for 10-15 minutes.',
      'Rinse thoroughly until no trace of cleaning agent remains in the final rinse water. Check the final rinse water for caustic using phenolphthalein indicator. Call QC to check biotrace and/or swabs.',
      'Corrective action on biotrace instrument:',
      'If the biotrace result is "Caution", rinse for another 5 minutes with treated water.',
      'If the biotrace result is "Fail", run CIP again and take another biotrace test.',
    ],
  },
  '5_step': {
    title: '5 STEP C.I.P PROCEDURE AND CHECKLIST',
    doc_ref: 'KBF/PRD/57',
    issue_no: '01',
    effective_date: '24/11/2014',
    revision_date: '21/08/2019',
    page_text: '1 of 1',
    solution_row_count: 7,
    has_ro_ph_table: true,
    has_observations: false,
    show_oxonia_strip_result: true,
    procedure_lines: [
      'THIS PROCEDURE IS TO BE FOLLOWED ONCE A WEEK.',
      'The five-step cleaning process forms the basis of a deep-cleaning and sanitizing program for all product contact surfaces. The five-step procedure consists of the following:',
      '1.1 Step 1 - Rinse with treated water for 5-10 minutes (ambient temperature).',
      'The first rinse is important to minimize the soil load. This removes most of the soluble material and increases the effectiveness of the cleaning agent.',
      '1.2 Step 2 - Rinse with 1-1.7% MIP CA ECOLAB at 66-85C.',
      'Allow solution to circulate for 20 to 30 minutes. The cleaning agent loosens residual soil particles from the surface of equipment.',
      '1.3 Step 3 - Rinse with treated water for 5-10 minutes.',
      'Rinse until no trace of caustic solution remains. The rinse with treated water removes all traces of cleaning detergents and prevents redeposit of soil upon clean surfaces. Check with phenolphthalein indicator.',
      '1.4 Step 4 - Rinse with 2-4% P3-HOROLITH V at ambient temperature.',
      'Allow solution to circulate for 10 to 20 minutes. The sanitizing agent destroys microbial contamination.',
      '1.5 Step 5 - Rinse with treated water for 5-10 minutes.',
      'Ensure that all acidic residue is completely rinsed out of the system.',
      '1.6 Step 6 - Rinse with P3 OXONIA ACTIV for 10-20 minutes.',
      'Allow 0.5-1% solution to circulate for 10 to 20 minutes. It will disinfect the whole equipment.',
      'Final rinse with treated water for 10-15 minutes.',
      'Call QC to check biotrace and/or swabs. Check rinse water pH. Check manhole seal for deterioration.',
      'Corrective action on biotrace instrument:',
      'If the biotrace result is "Caution", rinse for another 5 minutes with treated water.',
      'If the biotrace result is "Fail", run CIP again and take another biotrace test.',
    ],
  },
  '5_step_foam': {
    title: '5 STEP Foam C.I.P PROCEDURE AND CHECKLIST',
    doc_ref: 'KBF/PRD/57.1',
    issue_no: '01',
    effective_date: '24/11/2014',
    revision_date: '21/08/2019',
    page_text: '1 of 1',
    solution_row_count: 7,
    has_ro_ph_table: false,
    has_observations: true,
    show_oxonia_strip_result: false,
    procedure_lines: [
      'THIS PROCEDURE IS TO BE FOLLOWED ONCE A WEEK.',
      'The five-step cleaning process forms the basis of a deep-cleaning and sanitizing program for all product contact surfaces. The five-step procedure consists of the following:',
      '1.1 Step 1 - Rinse with treated water for 5 minutes (ambient temperature).',
      'The first rinse is important to minimize the soil load. This removes most of the soluble material and increases the effectiveness of the cleaning agent.',
      '1.2 Step 2 - Rinse with 2-4% P3-TOPAX MD3 ECOLAB (ambient temperature).',
      'Allow foam to remain on surfaces for 10 to 20 minutes. The cleaning agent loosens residual soil particles from the surface of equipment.',
      '1.3 Step 3 - Rinse with treated water for 5-10 minutes.',
      'Rinse until no trace of caustic foam remains. The rinse with treated water removes all traces of cleaning detergents and prevents redeposit of soil upon clean surfaces. Check with phenolphthalein indicator.',
      '1.4 Step 4 - Rinse with 2-4% P3-TOPAX 56 at ambient temperature.',
      'Allow foam to remain on surfaces for 10 to 20 minutes. The sanitizing agent destroys microbial contamination.',
      '1.5 Step 5 - Rinse with treated water for 5-10 minutes.',
      'Ensure that all acidic foam residue is completely rinsed out of the system.',
      '1.6 Step 6 - Rinse with P3 TOPAX 990 for 10-30 minutes.',
      'Allow 1% foam on surfaces for 10 to 20 minutes. It will disinfect the whole equipment.',
      'Final rinse with treated water for 10-15 minutes.',
      'Call QC to check biotrace and/or swabs. Check rinse water pH. Check manhole seal for deterioration.',
      'Corrective action on biotrace instrument:',
      'If the biotrace result is "Caution", rinse for another 5 minutes with treated water.',
      'If the biotrace result is "Fail", run CIP again and take another biotrace test.',
    ],
  },
};

const QC_REPORT_DOC_CONFIG = {
  CAN: {
    report_title: 'QUALITY CONTROL REPORT CANS',
    doc_ref: 'KBF/PRD/63',
    issue_no: '00',
    effective_date: '15/04/2015',
    revision_date: '11/03/2026',
    page_text: '1 of 1',
    color_label: 'CAN END COLOUR',
    special_label: 'Past Temp',
    dry_label: 'Dry Cans',
    color_options: ['Silver', 'Red'],
  },
  PET: {
    report_title: 'QUALITY CONTROL REPORT PET',
    doc_ref: 'KBF/PRD/63.01',
    issue_no: '00',
    effective_date: '15/04/2015',
    revision_date: '11/03/2026',
    page_text: '1 of 1',
    color_label: 'CLOSURES COLOUR',
    special_label: 'Torque',
    dry_label: 'Dry Bottle',
    color_options: [
      'Red With logo',
      'Red without logo',
      'Blue with logo',
      'Green With Logo',
      'Yellow Without logo',
      'Black with logo',
    ],
  },
};

const QC_REPORT_COLUMN_KEYS = [
  'time',
  'brix',
  'turbidity_acidity',
  'taste_odour',
  'special_field',
  'temp',
  'gas_volume',
  'uv_light_on',
  'dry_field',
  'air_vol',
  'date_code',
  'bar_code',
  'net_content',
  'pressure_temp',
  'check_mat',
  'six_pack_shrink_wrap',
  'comments',
];

const QC_REPORT_ROW_COUNT = 22;

const QC_REPORT_FREQUENCY_BY_KEY = {
  brix: 'Every 1\\2h',
  turbidity_acidity: 'Tank Release',
  taste_odour: 'Start up &\nHOURLY',
  special_field: 'Start up &\nHourly',
  temp: 'Start up &\nEvery 1\\2h',
  gas_volume: 'Start up &\nEvery 1\\2h',
  uv_light_on: 'Start up &\nEvery 1\\2h',
  dry_field: 'HOURLY',
  air_vol: 'HOURLY',
  date_code: 'Start up &\nEvery 1\\2h',
  bar_code: 'HOURLY',
  net_content: 'HOURLY',
  pressure_temp: 'HOURLY',
  check_mat: 'Start up &\nEvery 1\\2h',
  six_pack_shrink_wrap: 'Start up &\nEvery 1\\2h',
};

const QC_REPORT_COLUMN_WIDTH_UNITS = {
  time: 1.25,
  brix: 0.95,
  turbidity_acidity: 0.95,
  taste_odour: 0.95,
  special_field: 0.95,
  temp: 0.95,
  gas_volume: 0.95,
  uv_light_on: 1.0,
  dry_field: 0.85,
  air_vol: 0.85,
  date_code: 0.95,
  bar_code: 0.95,
  net_content: 1.0,
  pressure_temp: 1.0,
  check_mat: 0.95,
  six_pack_shrink_wrap: 1.1,
  comments: 2.7,
};

const QC_REPORT_OK_DASH_KEYS = new Set([
  'taste_odour',
  'dry_field',
  'date_code',
  'bar_code',
  'check_mat',
  'six_pack_shrink_wrap',
]);

const QC_REPORT_UV_LIGHT_OPTIONS = ['-', '100%', '98%', 'NOT OK'];

const QC_REPORT_NET_CONTENT_OPTIONS = ['300 ml', '330 ml', '500 ml', '2.5 L'];
const QC_REPORT_DEFAULT_NET_CONTENT = '300 ml';
// Sticky default for fresh QC Reports — refreshed from the server on page load.
// Last-saved 98%/100% from the chronologically newest batch wins; falls back to '100%'.
let QC_REPORT_DEFAULT_UV_LIGHT = '100%';

async function loadQcReportDefaultUv() {
  try {
    const resp = await qcGetQcReportDefaultUv();
    const value = resp && typeof resp.default_uv === 'string' ? resp.default_uv.trim() : '';
    if (value === '98%' || value === '100%') {
      QC_REPORT_DEFAULT_UV_LIGHT = value;
    }
  } catch (_err) {
    // Best-effort — fall back to the existing in-memory default.
  }
}
const QC_REPORT_ROW_TEXT_PLACEHOLDER = '-';

const SEAM_CHECK_DOC_CONFIG = {
  report_title: 'SEAM CHECKS: NORMAL & SLENDER CANS',
  company_name: 'DEMO PLANT LLC',
  doc_ref: 'KBF/PRD/64',
  issue_no: '00',
  effective_date: '15/04/2015',
  revision_date: '11/03/2026',
  page_text: '1 of 1',
};

const SEAM_CHECK_SPECIFICATIONS = {
  countersink_depth: 'min 6.7 - 7.0',
  body_hook_length: '1.40 - 1.80',
  cover_hook_length: '1.32 - 1.72',
  tightness_rating: '90 - 100%',
  operational_seam_length: '2.23 - 2.49',
  seam_thickness: '1.13 - 1.23',
};

const SEAM_CHECK_HEAD_COUNT = 12;
const SEAM_CHECK_TRIPLET_BASE_KEYS = [
  'countersink_depth',
  'body_hook_length',
  'cover_hook_length',
  'operational_seam_length',
  'seam_thickness',
];
const SEAM_CHECK_SINGLE_ROW_KEYS = ['lacor', 'tightness_rating'];
function seamCheckTripletKeys(baseKey) {
  return [1, 2, 3].map((idx) => `${baseKey}_${idx}`);
}
const SEAM_CHECK_ROW_INPUT_KEYS = [
  ...SEAM_CHECK_TRIPLET_BASE_KEYS.reduce((acc, baseKey) => acc.concat(seamCheckTripletKeys(baseKey)), []),
  ...SEAM_CHECK_SINGLE_ROW_KEYS,
];
/** Web entry order only; row keys unchanged so seam PDF layout stays the same. */
const SEAM_CHECK_TIGHTNESS_RATING_OPTIONS = Array.from({ length: 11 }, (_, i) => String(90 + i));

const SEAM_CHECK_TABLE_GROUPS = [
  { kind: 'single', key: 'head', label: 'Head', width: 0.9, specKey: '' },
  { kind: 'triplet', key: 'seam_thickness', label: 'Seam<br />thickness', width: 1.6, specKey: 'seam_thickness' },
  { kind: 'triplet', key: 'operational_seam_length', label: 'Operational<br />seam length', width: 1.7, specKey: 'operational_seam_length' },
  { kind: 'triplet', key: 'countersink_depth', label: 'Countersink depth', width: 2.5, specKey: 'countersink_depth' },
  { kind: 'triplet', key: 'cover_hook_length', label: 'Cover hook length', width: 2.5, specKey: 'cover_hook_length' },
  { kind: 'triplet', key: 'body_hook_length', label: 'Body hook length', width: 2.5, specKey: 'body_hook_length' },
  { kind: 'single', key: 'lacor', label: 'Lacor', width: 0.85, specKey: '' },
  { kind: 'single', key: 'tightness_rating', label: 'Tightness<br />rating', width: 1.2, specKey: 'tightness_rating' },
];

function isCipSubmenu(name = state.activeSubmenu) {
  return name === 'tank_cip' || name === 'filler_mixer_cip';
}

function isQcReportSubmenu(name = state.activeSubmenu) {
  return name === 'qc_report';
}

function isSeamCheckSubmenu(name = state.activeSubmenu) {
  return name === 'seam_check';
}

function isPickingSheetSubmenu(name = state.activeSubmenu) {
  return name === 'picking_sheet';
}

function isCoverPageSubmenu(name = state.activeSubmenu) {
  return name === 'cover_page';
}

function revokeQcPickingBlobUrl() {
  if (state.pickingSheetObjectUrl) {
    try {
      window.URL.revokeObjectURL(state.pickingSheetObjectUrl);
    } catch (_err) {
      /* ignore */
    }
    state.pickingSheetObjectUrl = null;
  }
}

function hideQcPickingPanel() {
  document.getElementById('qc-picking-sheet-panel')?.classList.add('qc-hidden');
}

function ensureQcReportWizardIndices(days) {
  const d = Array.isArray(days) ? days : [];
  if (!d.length) return;
  let di = Number(state.qcReportWizard.dayIndex) || 0;
  if (di < 0) di = 0;
  if (di >= d.length) di = d.length - 1;
  state.qcReportWizard.dayIndex = di;
  const rows = Array.isArray(d[di].rows) ? d[di].rows : defaultQcReportRows();
  const maxDataIdx = Math.max(1, rows.length - 1);
  let ri = Number(state.qcReportWizard.dataRowIndex) || 1;
  if (ri < 1) ri = 1;
  if (ri > maxDataIdx) ri = maxDataIdx;
  state.qcReportWizard.dataRowIndex = ri;
}

function findNextQcReportInsertionRow(rows) {
  if (!Array.isArray(rows) || rows.length < 2) return 1;
  let lastFilled = 0;
  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i] || {};
    if (String(row.brix ?? '').trim() !== '') lastFilled = i;
  }
  if (lastFilled === 0) return 1;
  return Math.min(rows.length - 1, lastFilled + 1);
}

function ensureSeamCheckWizardIndex(rowCount) {
  const n = Number(rowCount) || 0;
  if (n <= 0) return;
  let ri = Number(state.seamCheckWizard.rowIndex) || 0;
  if (ri < 0) ri = 0;
  if (ri >= n) ri = n - 1;
  state.seamCheckWizard.rowIndex = ri;
}

function expandSeamCheckColumnsForWizard() {
  const expandedColumns = [];
  SEAM_CHECK_TABLE_GROUPS.forEach((group) => {
    const groupWidth = Number(group.width) || 1;
    if (group.kind === 'triplet') {
      const subWidth = groupWidth / 3;
      for (let slot = 1; slot <= 3; slot += 1) {
        expandedColumns.push({
          ...group,
          key: `${group.key}_${slot}`,
          width: subWidth,
          slot,
        });
      }
      return;
    }
    expandedColumns.push({ ...group, width: groupWidth });
  });
  return expandedColumns;
}

function isFillerMixerCipSubmenu(name = state.activeSubmenu) {
  return name === 'filler_mixer_cip';
}

function currentCipLabel(name = state.activeSubmenu) {
  return isFillerMixerCipSubmenu(name) ? 'Filler/Mixer CIP' : 'Tank CIP';
}

function activeCipSection(name = state.activeSubmenu) {
  return isFillerMixerCipSubmenu(name) ? 'filler_mixer_cip' : 'tank_cip';
}

function cipSubmenuFromSection(section) {
  return section === 'filler_mixer_cip' ? 'filler_mixer_cip' : 'tank_cip';
}

function cipLabelFromSection(section) {
  return currentCipLabel(cipSubmenuFromSection(section));
}

function getCipData(section = activeCipSection()) {
  return section === 'filler_mixer_cip' ? state.fillerMixerCipData : state.tankCipData;
}

function setCipData(section, data) {
  if (section === 'filler_mixer_cip') state.fillerMixerCipData = data;
  else state.tankCipData = data;
}

function getCipLastSavedSnapshot(section = activeCipSection()) {
  return section === 'filler_mixer_cip' ? state.fillerMixerCipLastSavedSnapshot : state.tankCipLastSavedSnapshot;
}

function setCipLastSavedSnapshot(section, value) {
  if (section === 'filler_mixer_cip') state.fillerMixerCipLastSavedSnapshot = value;
  else state.tankCipLastSavedSnapshot = value;
}

function getCipAutoSaveTimer(section = activeCipSection()) {
  return section === 'filler_mixer_cip' ? state.fillerMixerCipAutoSaveTimer : state.tankCipAutoSaveTimer;
}

function setCipAutoSaveTimer(section, timerId) {
  if (section === 'filler_mixer_cip') state.fillerMixerCipAutoSaveTimer = timerId;
  else state.tankCipAutoSaveTimer = timerId;
}

function getCipAutoSaveInFlight(section = activeCipSection()) {
  return section === 'filler_mixer_cip' ? state.fillerMixerCipAutoSaveInFlight : state.tankCipAutoSaveInFlight;
}

function setCipAutoSaveInFlight(section, value) {
  if (section === 'filler_mixer_cip') state.fillerMixerCipAutoSaveInFlight = !!value;
  else state.tankCipAutoSaveInFlight = !!value;
}

function getCipAutoSaveQueued(section = activeCipSection()) {
  return section === 'filler_mixer_cip' ? state.fillerMixerCipAutoSaveQueued : state.tankCipAutoSaveQueued;
}

function setCipAutoSaveQueued(section, value) {
  if (section === 'filler_mixer_cip') state.fillerMixerCipAutoSaveQueued = !!value;
  else state.tankCipAutoSaveQueued = !!value;
}

function getQcReportData() {
  return state.qcReportData;
}

function setQcReportData(data) {
  state.qcReportData = data;
}

function getQcReportLastSavedSnapshot() {
  return state.qcReportLastSavedSnapshot;
}

function setQcReportLastSavedSnapshot(value) {
  state.qcReportLastSavedSnapshot = value;
}

function getQcReportAutoSaveTimer() {
  return state.qcReportAutoSaveTimer;
}

function setQcReportAutoSaveTimer(timerId) {
  state.qcReportAutoSaveTimer = timerId;
}

function getQcReportAutoSaveInFlight() {
  return state.qcReportAutoSaveInFlight;
}

function setQcReportAutoSaveInFlight(value) {
  state.qcReportAutoSaveInFlight = !!value;
}

function getQcReportAutoSaveQueued() {
  return state.qcReportAutoSaveQueued;
}

function setQcReportAutoSaveQueued(value) {
  state.qcReportAutoSaveQueued = !!value;
}

function getSeamCheckData() {
  return state.seamCheckData;
}

function setSeamCheckData(data) {
  state.seamCheckData = data;
}

function getSeamCheckLastSavedSnapshot() {
  return state.seamCheckLastSavedSnapshot;
}

function setSeamCheckLastSavedSnapshot(value) {
  state.seamCheckLastSavedSnapshot = value;
}

function getSeamCheckAutoSaveTimer() {
  return state.seamCheckAutoSaveTimer;
}

function setSeamCheckAutoSaveTimer(timerId) {
  state.seamCheckAutoSaveTimer = timerId;
}

function getSeamCheckAutoSaveInFlight() {
  return state.seamCheckAutoSaveInFlight;
}

function setSeamCheckAutoSaveInFlight(value) {
  state.seamCheckAutoSaveInFlight = !!value;
}

function getSeamCheckAutoSaveQueued() {
  return state.seamCheckAutoSaveQueued;
}

function setSeamCheckAutoSaveQueued(value) {
  state.seamCheckAutoSaveQueued = !!value;
}

async function fetchActiveCipData(batchNo, submenuName = state.activeSubmenu) {
  return isFillerMixerCipSubmenu(submenuName)
    ? qcGetFillerMixerCip(batchNo)
    : qcGetTankCip(batchNo);
}

async function saveActiveCipData(batchNo, payload, submenuName = state.activeSubmenu) {
  return isFillerMixerCipSubmenu(submenuName)
    ? qcSaveFillerMixerCip(batchNo, payload)
    : qcSaveTankCip(batchNo, payload);
}

async function downloadActiveCipPdf(batchNo, submenuName = state.activeSubmenu) {
  return isFillerMixerCipSubmenu(submenuName)
    ? qcDownloadFillerMixerCipPdf(batchNo)
    : qcDownloadTankCipPdf(batchNo);
}

function setStatus(msg, isError = false) {
  const el = document.getElementById('qc-save-status');
  if (!el) return;
  el.textContent = msg;
  el.style.color = isError ? '#be123c' : '#64748b';
}

function ensureToastHost() {
  let host = document.getElementById('qc-toast-host');
  if (host) return host;
  host = document.createElement('div');
  host.id = 'qc-toast-host';
  host.className = 'qc-toast-host';
  document.body.appendChild(host);
  return host;
}

function showToast(message, isError = false) {
  const text = String(message || '').trim();
  if (!text) return;
  const host = ensureToastHost();
  const toast = document.createElement('div');
  toast.className = `qc-toast ${isError ? 'qc-toast-error' : 'qc-toast-success'}`;
  toast.textContent = text;
  host.appendChild(toast);
  window.setTimeout(() => toast.classList.add('is-visible'), 10);
  window.setTimeout(() => {
    toast.classList.remove('is-visible');
    window.setTimeout(() => toast.remove(), 200);
  }, 2600);
}

function ensureCss() {
  if (document.getElementById('qc-menu-css')) return;
  const link = document.createElement('link');
  link.id = 'qc-menu-css';
  link.rel = 'stylesheet';
  link.href = '/app/api/qc/assets/ui_components/qc_menu.css?v=20260429qcpages15';
  document.head.appendChild(link);
}

async function ensureViewMarkup() {
  if (state.viewReady) return;
  const host = document.getElementById('view-qc');
  if (!host) return;

  const res = await fetch('/app/api/qc/assets/ui_components/qc_menu_view.html?v=20260429qcpages15');
  const html = await res.text();
  host.innerHTML = html;
  state.viewReady = true;

  document.getElementById('qc-refresh-btn')?.addEventListener('click', () => refreshBatches());
  document.getElementById('qc-show-all-batches-btn')?.addEventListener('click', () => {
    const searchEl = document.getElementById('qc-batch-search');
    if (searchEl) searchEl.value = '';
    state.qcShowAllBatchCards = false;
    renderBatchList();
  });
  document.getElementById('qc-current-batch-full-pdf')?.addEventListener('click', (event) => {
    event.stopPropagation();
    if (state.selectedBatchNo) void onDownloadCombinedQcRecord(state.selectedBatchNo);
  });
  document.getElementById('qc-current-batch-delete')?.addEventListener('click', (event) => {
    event.stopPropagation();
    if (state.selectedBatchNo) void onDeleteSingleBatch(state.selectedBatchNo);
  });
  document.getElementById('qc-delete-all-btn')?.addEventListener('click', onDeleteAllBatches);
  document.getElementById('qc-mixing-save-btn')?.addEventListener('click', onSaveMixing);
  document.getElementById('qc-mixing-print-btn')?.addEventListener('click', onPrintMixingPdf);
  document.getElementById('qc-submenu-cover-page')?.addEventListener('click', () => setActiveSubmenu('cover_page'));
  document.getElementById('qc-submenu-picking-sheet')?.addEventListener('click', () => setActiveSubmenu('picking_sheet'));
  document.getElementById('qc-submenu-mixing')?.addEventListener('click', () => setActiveSubmenu('mixing'));
  document.getElementById('qc-submenu-tank-cip')?.addEventListener('click', () => setActiveSubmenu('tank_cip'));
  document.getElementById('qc-submenu-filler-mixer-cip')?.addEventListener('click', () => setActiveSubmenu('filler_mixer_cip'));
  document.getElementById('qc-submenu-qc-report')?.addEventListener('click', () => setActiveSubmenu('qc_report'));
  document.getElementById('qc-submenu-seam-check')?.addEventListener('click', () => setActiveSubmenu('seam_check'));
  document.getElementById('qc-tank-cip-save-btn')?.addEventListener('click', onSaveTankCip);
  document.getElementById('qc-tank-cip-print-btn')?.addEventListener('click', onPrintTankCipPdf);
  document.getElementById('qc-cip-add-3-step-btn')?.addEventListener('click', () => onAddTankCipBlock('3_step'));
  document.getElementById('qc-cip-add-5-step-btn')?.addEventListener('click', () => onAddTankCipBlock('5_step'));
  document.getElementById('qc-cip-add-foam-btn')?.addEventListener('click', () => onAddTankCipBlock('5_step_foam'));
  document.getElementById('qc-report-save-btn')?.addEventListener('click', onSaveQcReport);
  document.getElementById('qc-report-pdf-btn')?.addEventListener('click', onSaveQcReportPdf);
  document.getElementById('qc-report-add-day-btn')?.addEventListener('click', onAddQcReportDay);
  document.getElementById('qc-seam-save-btn')?.addEventListener('click', onSaveSeamCheck);
  document.getElementById('qc-seam-pdf-btn')?.addEventListener('click', onSaveSeamCheckPdf);
  document.getElementById('qc-config-mixing-btn')?.addEventListener('click', onOpenMixingConfiguration);
  document.getElementById('qc-mixing-config-add-btn')?.addEventListener('click', onAddMixingConfiguration);
  document.getElementById('qc-mixing-config-copy-btn')?.addEventListener('click', onCopyMixingConfiguration);
  document.getElementById('qc-mixing-config-remove-btn')?.addEventListener('click', onRemoveMixingConfiguration);
  document.getElementById('qc-mixing-config-save-btn')?.addEventListener('click', onSaveMixingConfiguration);
  document.getElementById('qc-config-add-check-btn')?.addEventListener('click', onAddMixingConfigCheckRow);
  document.getElementById('qc-tank-cip-blocks')?.addEventListener('click', onTankCipBlockActionClick);
  document.getElementById('qc-tank-cip-blocks')?.addEventListener('input', onTankCipBlockFieldInput);
  document.getElementById('qc-tank-cip-blocks')?.addEventListener('change', onTankCipBlockFieldInput);
  document.getElementById('qc-report-days')?.addEventListener('click', onQcReportDaysUnifiedClick);
  document.getElementById('qc-report-days')?.addEventListener('input', onQcReportFieldInput);
  document.getElementById('qc-report-days')?.addEventListener('change', onQcReportFieldInput);
  initQcReportAutoSaveEnhancements();
  document.getElementById('qc-seam-sheet-wrap')?.addEventListener('click', onSeamWizardClick);
  document.getElementById('qc-seam-sheet-wrap')?.addEventListener('input', onSeamCheckFieldInput);
  document.getElementById('qc-seam-sheet-wrap')?.addEventListener('change', onSeamCheckFieldInput);
  document.getElementById('qc-picking-open-tab')?.addEventListener('click', onQcPickingOpenTab);
  document.getElementById('qc-picking-edit')?.addEventListener('click', onQcPickingEdit);
  document.getElementById('qc-picking-prefill-calc')?.addEventListener('click', onQcPickingPrefillCalc);
  document.getElementById('qc-edit-batch-cancel')?.addEventListener('click', closeQcEditBatchModal);
  document.getElementById('qc-edit-batch-save')?.addEventListener('click', onQcEditBatchSave);
  document.getElementById('qc-edit-batch-modal')?.addEventListener('click', (e) => {
    if (e.target?.id === 'qc-edit-batch-modal') closeQcEditBatchModal();
  });
  document.getElementById('qc-cover-page-save-btn')?.addEventListener('click', onSaveCoverPage);
  document.getElementById('qc-cover-page-pdf-btn')?.addEventListener('click', onDownloadCoverPagePdf);

  // Refetch tank-cip / filler-mixer-cip data when the user comes back to this
  // tab — picks up changes propagated from the mixing section without forcing
  // a manual reload. Skipped while autosaves are pending or in flight so we
  // never overwrite live typing.
  window.addEventListener('focus', () => { void refreshActiveCipFromServerOnFocus(); });
}

function isQcViewVisible() {
  const root = document.getElementById('view-qc');
  return !!root && !root.classList.contains('hidden') && root.offsetParent !== null;
}

async function refreshActiveCipFromServerOnFocus() {
  if (!isQcViewVisible()) return;
  if (!isCipSubmenu(state.activeSubmenu)) return;
  if (!state.selectedBatchNo) return;
  const section = activeCipSection();
  if (getCipAutoSaveTimer(section)) return;
  if (getCipAutoSaveInFlight(section)) return;
  if (getCipAutoSaveQueued(section)) return;
  // Bail if the rendered DOM has unsaved local edits relative to the last
  // saved snapshot — collectTankCipPayload reads from the live form.
  try {
    const livePayload = collectTankCipPayload(section);
    const liveSnapshot = serializeMixingSnapshot(livePayload);
    if (liveSnapshot && liveSnapshot !== getCipLastSavedSnapshot(section)) return;
  } catch (_err) { /* fall through to refresh */ }
  try {
    await loadSelectedTankCip();
  } catch (_err) { /* loader handles its own errors */ }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const QC_SIGNATORY_NAMES = ['Demo Analyst', 'Demo Supervisor', 'Demo QC Manager'];

function signatorySelectHtml(currentValue, fieldAttr) {
  const cur = String(currentValue || '').trim();
  const isKnown = !cur || QC_SIGNATORY_NAMES.includes(cur);
  let html = `<select class="qc-input qc-bubble-input" ${fieldAttr}>`;
  html += `<option value="">--</option>`;
  if (!isKnown) html += `<option value="${escapeHtml(cur)}" selected>${escapeHtml(cur)}</option>`;
  for (const name of QC_SIGNATORY_NAMES) {
    const sel = cur === name ? ' selected' : '';
    html += `<option value="${escapeHtml(name)}"${sel}>${escapeHtml(name)}</option>`;
  }
  html += '</select>';
  return html;
}

function toNumber(value) {
  const raw = String(value == null ? '' : value).replace(/,/g, '').trim();
  if (!raw) return 0;
  const num = Number(raw);
  return Number.isFinite(num) ? num : 0;
}

function formatAuto(value, decimals = 4) {
  if (!Number.isFinite(value) || value <= 0) return '';
  return value.toFixed(decimals).replace(/\.?0+$/, '');
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function normalizeYear(value) {
  const yearNum = Number(value);
  if (!Number.isFinite(yearNum)) return 0;
  if (yearNum >= 100) return yearNum;
  return yearNum <= 69 ? 2000 + yearNum : 1900 + yearNum;
}

function toDateInputValue(value) {
  const text = String(value || '').trim();
  if (!text) return '';

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const monthMap = {
    jan: 1, january: 1,
    feb: 2, february: 2,
    mar: 3, march: 3,
    apr: 4, april: 4,
    may: 5,
    jun: 6, june: 6,
    jul: 7, july: 7,
    aug: 8, august: 8,
    sep: 9, sept: 9, september: 9,
    oct: 10, october: 10,
    nov: 11, november: 11,
    dec: 12, december: 12,
  };

  const ddMmmYy = text.match(/^(\d{1,2})[-\/\s]([A-Za-z]{3,9})[-\/\s](\d{2,4})$/);
  if (ddMmmYy) {
    const day = Number(ddMmmYy[1]);
    const month = monthMap[String(ddMmmYy[2] || '').toLowerCase()];
    const year = normalizeYear(ddMmmYy[3]);
    if (day >= 1 && day <= 31 && month && year >= 1900 && year <= 2099) {
      return `${year}-${pad2(month)}-${pad2(day)}`;
    }
  }

  const ddMmYy = text.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})$/);
  if (ddMmYy) {
    const day = Number(ddMmYy[1]);
    const month = Number(ddMmYy[2]);
    const year = normalizeYear(ddMmYy[3]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2099) {
      return `${year}-${pad2(month)}-${pad2(day)}`;
    }
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
  }

  return '';
}

function todayDateInputValue() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function splitLines(value) {
  return String(value || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeStepRows(value) {
  return toArray(value)
    .map((step, idx) => {
      if (step && typeof step === 'object') {
        const instruction = String(step.instruction || '').trim();
        if (!instruction) return null;
        return {
          step_no: step.step_no ?? idx + 1,
          instruction,
        };
      }
      const instruction = String(step || '').trim();
      if (!instruction) return null;
      return {
        step_no: idx + 1,
        instruction,
      };
    })
    .filter(Boolean);
}

function stepsToLines(value) {
  return normalizeStepRows(value)
    .map((step) => String(step.instruction || '').trim())
    .filter(Boolean)
    .join('\n');
}

function linesToSteps(value) {
  return splitLines(value).map((instruction, idx) => ({ step_no: idx + 1, instruction }));
}

function getCalculatorBatchNoFallback() {
  const calcBatchNoEl = document.getElementById('calc-batch-no');
  return String(calcBatchNoEl && calcBatchNoEl.value ? calcBatchNoEl.value : '').trim();
}

function getCalculatorProductNameFallback() {
  const selectedRecipe = document.getElementById('calc-recipe-select');
  if (selectedRecipe && selectedRecipe.value) return String(selectedRecipe.value || '').trim();
  const recipeTextEl = document.getElementById('calc-recipe-text');
  const recipeText = String(recipeTextEl && recipeTextEl.textContent ? recipeTextEl.textContent : '').trim();
  if (recipeText && recipeText !== '-- Choose a Recipe --') return recipeText;
  return '';
}

function normalizeYesNoValue(value) {
  const text = String(value == null ? '' : value).trim().toLowerCase();
  if (['yes', 'y', 'true', '1', 'ok'].includes(text)) return 'yes';
  if (['no', 'n', 'false', '0', 'not ok', 'not_ok'].includes(text)) return 'no';
  return '';
}

function normalizeRinserFilterType(value) {
  const key = String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
  if (['0_5_micro', '0_5_micron', '0_5_micro_filter', '0_5', '05_micro', 'half_micro'].includes(key)) return '0_5_micro';
  if (['1_micro', '1_micron', '1_micro_filter', '1_0_micro', '1'].includes(key)) return '1_micro';
  return '';
}

function normalizeTankCipType(value) {
  const key = String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
  if (['3_step', '3_step_cip'].includes(key)) return '3_step';
  if (['5_step', '5_step_cip'].includes(key)) return '5_step';
  if (['5_step_foam', '5_step_foam_cip'].includes(key)) return '5_step_foam';
  return '3_step';
}

function normalizeTankCipLine(value) {
  const text = String(value || '').trim().toUpperCase();
  return TANK_CIP_LINE_OPTIONS.includes(text) ? text : '';
}

function inferTankCipLineFromRecipe(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const match = text.match(/^(\d{3})/);
  const prefix = match ? String(match[1] || '') : '';
  if (prefix === '202' || prefix === '204') return 'CAN';
  if (prefix === '301' || prefix === '302' || prefix === '303') return 'PET';
  return '';
}

function normalizeQcReportLine(value) {
  const text = String(value || '').trim().toUpperCase();
  if (!text) return '';
  if (text === 'CAN' || text === 'PET') return text;
  if (text.includes('CAN')) return 'CAN';
  if (text.includes('PET')) return 'PET';
  return '';
}

function getQcReportDocConfig(line) {
  return normalizeQcReportLine(line) === 'CAN' ? QC_REPORT_DOC_CONFIG.CAN : QC_REPORT_DOC_CONFIG.PET;
}

function qcReportColorNormKey(s) {
  return String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

function normalizeQcReportColorOption(value, line) {
  const text = String(value || '').trim();
  if (!text) return '';
  const options = getQcReportDocConfig(line).color_options || [];
  if (!options.length) return text;
  const normKey = qcReportColorNormKey;
  if (text.includes(',')) {
    const byKey = new Map(options.map((o) => [normKey(o), o]));
    const matched = [];
    text.split(',').forEach((part) => {
      const p = part.trim();
      if (!p) return;
      const canon = byKey.get(normKey(p));
      if (canon && !matched.includes(canon)) matched.push(canon);
    });
    return matched.length ? matched.join(', ') : text;
  }
  const key = normKey(text);
  const hit = options.find((option) => normKey(option) === key);
  return hit || text;
}

function detectQcReportLine(batchMeta) {
  const source = batchMeta && typeof batchMeta === 'object' ? batchMeta : {};
  // item_code prefix (202/204 → CAN, 301/302/303 → PET) is authoritative;
  // recipe/product names may be stored without the code on older batches.
  const fromItem = inferTankCipLineFromRecipe(source.item_code);
  if (fromItem) return fromItem;
  const inferred = inferTankCipLineFromRecipe(source.recipe_name || source.product_name);
  if (inferred) return inferred;

  const explicit = normalizeQcReportLine(source.packaging_type || source.line || source.line_type);
  if (explicit) return explicit;

  const packaging = String(source.packaging_type || '').trim().toLowerCase();
  if (packaging.includes('can')) return 'CAN';
  if (packaging.includes('pet')) return 'PET';
  return '';
}

function batchSupportsSeam(batchMeta) {
  const source = batchMeta && typeof batchMeta === 'object' ? batchMeta : {};
  // Detection from item_code/product_name prefix is authoritative; check it
  // before seam_required so a legacy meta with seam_required:false but a CAN
  // item code still enables the tab.
  if (detectQcReportLine(source) === 'CAN') return true;
  return source.seam_required === true;
}

function selectedBatchSupportsSeam() {
  return batchSupportsSeam(getSelectedBatchMeta());
}

function updateSeamSubmenuVisibility() {
  const seamBtn = document.getElementById('qc-submenu-seam-check');
  if (!seamBtn) return;
  const supported = selectedBatchSupportsSeam();
  seamBtn.classList.toggle('qc-hidden', !supported);
  if (!supported && isSeamCheckSubmenu()) {
    const fallback = state.selectedBatchNo ? 'qc_report' : 'picking_sheet';
    if (state.activeSubmenu !== fallback) setActiveSubmenu(fallback);
  }
}

// Item-code prefix → canonical size. Source of truth — names/regex are fallback only.
//   202 → 500 ml CAN, 204 → 300 ml CAN,
//   301 → 2.5 L PET,  302 → 500 ml PET, 303 → 330 ml PET
const QC_REPORT_ITEM_CODE_SIZE_MAP = {
  202: '500ML',
  204: '300ML',
  301: '2.5L',
  302: '500ML',
  303: '330ML',
};

function sizeFromQcReportItemCode(itemCode) {
  const m = String(itemCode || '').trim().match(/^(\d{3})\b/);
  if (!m) return '';
  return QC_REPORT_ITEM_CODE_SIZE_MAP[Number(m[1])] || '';
}

function detectQcReportSize(batchMeta) {
  const source = batchMeta && typeof batchMeta === 'object' ? batchMeta : {};

  // Authoritative: item-code prefix.
  const fromCode = sizeFromQcReportItemCode(source.item_code);
  if (fromCode) return fromCode;

  // Fallback: parse number+unit out of the recipe/product name (handles items
  // whose code prefix isn't in the map yet but whose name still encodes a size).
  const text = preferredBatchProductName(source) || String(source.recipe_name || source.product_name || '').trim();
  if (!text) return '';
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*(ml|l)\b/i);
  if (!match) return '';
  const numberRaw = String(match[1] || '').replace(',', '.');
  const unit = String(match[2] || '').toUpperCase();

  const parsed = Number(numberRaw);
  if (Number.isFinite(parsed)) {
    if (Math.floor(parsed) === parsed) return `${parsed}${unit}`;
    return `${parsed.toFixed(3).replace(/\.?0+$/, '')}${unit}`;
  }
  return `${numberRaw}${unit}`;
}

const QC_PRODUCT_PLACEHOLDER_KEYS = new Set([
  '',
  'test',
  'testing',
  'tbd',
  'todo',
  'na',
  'n_a',
  'none',
  'null',
  'unknown',
  'unknown_product',
  'product',
  'sample',
  'dummy',
  'tmp',
]);

function normalizeQcProductKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function isPlaceholderQcProductName(value) {
  return QC_PRODUCT_PLACEHOLDER_KEYS.has(normalizeQcProductKey(value));
}

function preferredBatchProductName(batchMeta) {
  const source = batchMeta && typeof batchMeta === 'object' ? batchMeta : {};
  const product = String(source.product_name || '').trim();
  const recipe = String(source.recipe_name || '').trim();

  if (product && !isPlaceholderQcProductName(product)) return product;
  if (recipe && !isPlaceholderQcProductName(recipe)) return recipe;
  return product || recipe;
}

function resolveQcReportProductName(savedProduct, batchMeta) {
  const source = batchMeta && typeof batchMeta === 'object' ? batchMeta : {};
  const saved = String(savedProduct || '').trim();
  const autoProduct = preferredBatchProductName(source);
  const metaRecipe = String(source.recipe_name || '').trim();
  const metaProduct = String(source.product_name || '').trim();

  if (!saved || isPlaceholderQcProductName(saved)) return autoProduct;
  if (
    metaProduct
    && saved === metaRecipe
    && metaProduct !== metaRecipe
    && !isPlaceholderQcProductName(metaProduct)
  ) {
    return metaProduct;
  }
  return saved;
}

function normalizeQcReportNetContentToken(text) {
  return String(text || '').toLowerCase().replace(/\s+/g, '');
}

function buildNetContentOptionsList(batchMeta, currentValue) {
  const list = [...QC_REPORT_NET_CONTENT_OPTIONS];
  const recipe = String(detectQcReportSize(batchMeta) || '').trim();
  const norm = normalizeQcReportNetContentToken;
  if (recipe && !list.some((o) => norm(o) === norm(recipe))) {
    list.unshift(recipe);
  }
  const cur = String(currentValue || '').trim();
  if (cur && !list.some((o) => norm(o) === norm(cur))) {
    list.push(cur);
  }
  return list;
}

function canonicalQcReportNetContent(batchMeta, existingRaw) {
  const opts = buildNetContentOptionsList(batchMeta, '');
  const norm = normalizeQcReportNetContentToken;
  const detected = detectQcReportSize(batchMeta);
  if (detected) {
    const hit = opts.find((o) => norm(o) === norm(detected));
    return hit || detected;
  }
  const cur = String(existingRaw || '').trim();
  if (cur) {
    const hit = opts.find((o) => norm(o) === norm(cur));
    return hit || cur;
  }
  return QC_REPORT_DEFAULT_NET_CONTENT;
}

function normalizeTimeForInput(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const m = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (!m) return '';
  const hhNum = Number(m[1]);
  const mmNum = Number(m[2]);
  if (!Number.isFinite(hhNum) || !Number.isFinite(mmNum) || hhNum > 23 || mmNum > 59) return '';
  const hh = String(hhNum).padStart(2, '0');
  const mm = String(mmNum).padStart(2, '0');
  return `${hh}:${mm}`;
}

function uaeNowHHMM() {
  const d = new Date();
  const parts = d.toLocaleString('en-GB', { timeZone: 'Asia/Dubai', hour: '2-digit', minute: '2-digit', hour12: false }).split(':');
  return `${String(parts[0]).padStart(2, '0')}:${String(parts[1]).padStart(2, '0')}`;
}

function qcReportUvLightOptionsHtml(storedValue) {
  const vRaw = String(storedValue || '').trim();
  const effective = vRaw || QC_REPORT_DEFAULT_UV_LIGHT;
  const standard = new Set(QC_REPORT_UV_LIGHT_OPTIONS);
  if (effective && !standard.has(effective)) {
    return [
      ...QC_REPORT_UV_LIGHT_OPTIONS.map(
        (o) => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`,
      ),
      `<option value="${escapeHtml(effective)}" selected>${escapeHtml(effective)}</option>`,
    ].join('');
  }
  const parts = [];
  QC_REPORT_UV_LIGHT_OPTIONS.forEach((o) => {
    const sel = effective === o ? ' selected' : '';
    parts.push(`<option value="${escapeHtml(o)}"${sel}>${escapeHtml(o)}</option>`);
  });
  return parts.join('');
}

function qcReportNetContentOptionsHtml(storedValue, batchMeta) {
  const vRaw = String(storedValue || '').trim();
  const detected = detectQcReportSize(batchMeta) || '';
  const norm0 = normalizeQcReportNetContentToken;
  const effective = detected ? (QC_REPORT_NET_CONTENT_OPTIONS.find(o => norm0(o) === norm0(detected)) || detected) : (vRaw || QC_REPORT_DEFAULT_NET_CONTENT);
  const opts = buildNetContentOptionsList(batchMeta, effective);
  const norm = normalizeQcReportNetContentToken;
  return opts
    .map((o) => {
      const sel = norm(o) === norm(effective) ? ' selected' : '';
      return `<option value="${escapeHtml(o)}"${sel}>${escapeHtml(o)}</option>`;
    })
    .concat(
      effective && !opts.some((o) => norm(o) === norm(effective))
        ? [`<option value="${escapeHtml(effective)}" selected>${escapeHtml(effective)}</option>`]
        : [],
    )
    .join('');
}

function qcReportSampleCellHtml(col, rawValue, dayIndex, dataRowIndex, batchMeta, line) {
  const resolved = normalizeQcReportLine(line);
  const isPet = resolved === 'PET';
  const isCan = resolved === 'CAN';
  const noPlaceholderDash = isPet || isCan;
  const freq = String(QC_REPORT_FREQUENCY_BY_KEY[col.key] || '').replace(/\n/g, ' ');
  const labelPart = `${escapeHtml(col.label).replace(/\n/g, ' ')}${freq ? `<small class="qc-bubble-freq">${escapeHtml(freq)}</small>` : ''}`;
  const commonAttrs = `data-qc-report-field="rows" data-day-index="${dayIndex}" data-row-index="${dataRowIndex}" data-row-key="${escapeHtml(col.key)}"`;

  if (col.key === 'time') {
    const tv = normalizeTimeForInput(rawValue);
    return `<label class="qc-bubble-field"><span class="qc-bubble-label">${labelPart}</span><input type="time" step="60" class="qc-input qc-bubble-input" value="${escapeHtml(tv)}" ${commonAttrs} /></label>`;
  }

  if (col.key === 'net_content') {
    if (noPlaceholderDash) {
      const nc = canonicalQcReportNetContent(batchMeta, rawValue);
      return `<label class="qc-bubble-field"><span class="qc-bubble-label">${labelPart}</span><input type="text" class="qc-input qc-bubble-input" value="${escapeHtml(nc)}" ${commonAttrs} readonly /></label>`;
    }
    return `<label class="qc-bubble-field"><span class="qc-bubble-label">${labelPart}</span><select class="qc-input qc-bubble-input" ${commonAttrs}>${qcReportNetContentOptionsHtml(rawValue, batchMeta)}</select></label>`;
  }

  if (col.key === 'uv_light_on') {
    return `<label class="qc-bubble-field"><span class="qc-bubble-label">${labelPart}</span><select class="qc-input qc-bubble-input" ${commonAttrs}>${qcReportUvLightOptionsHtml(rawValue)}</select></label>`;
  }

  if (QC_REPORT_OK_DASH_KEYS.has(col.key)) {
    const vRaw = String(rawValue || '').trim();
    const itemCode = (batchMeta && batchMeta.item_code) || '';
    const defaultVal = (col.key === 'bar_code' && isQcReport25LItemCode(itemCode)) ? '-' : 'OK';
    const effective = !vRaw ? defaultVal : vRaw;
    const vNorm = effective === 'Ok' || effective.toUpperCase() === 'OK' ? 'OK'
      : (effective.toUpperCase() === 'NOT OK' || effective === 'Not OK' ? 'NOT OK' : effective);
    let optionsHtml;
    const allowed = new Set(['-', 'OK', 'NOT OK', '']);
    if (effective && !allowed.has(vNorm)) {
      optionsHtml = `<option value="-">-</option><option value="OK">OK</option><option value="NOT OK">NOT OK</option><option value="${escapeHtml(effective)}" selected>${escapeHtml(effective)}</option>`;
    } else {
      const selDash = vNorm === '-' ? ' selected' : '';
      const selOk = vNorm === 'OK' ? ' selected' : '';
      const selNot = vNorm === 'NOT OK' ? ' selected' : '';
      const selBlank = effective === '' ? ' selected' : '';
      optionsHtml = `<option value=""${selBlank}></option><option value="-"${selDash}>-</option><option value="OK"${selOk}>OK</option><option value="NOT OK"${selNot}>NOT OK</option>`;
    }
    return `<label class="qc-bubble-field"><span class="qc-bubble-label">${labelPart}</span><select class="qc-input qc-bubble-input" ${commonAttrs}>${optionsHtml}</select></label>`;
  }

  const value = String(rawValue || '');
  return `<label class="qc-bubble-field"><span class="qc-bubble-label">${labelPart}</span><input type="text" class="qc-input qc-bubble-input" value="${escapeHtml(value)}" ${commonAttrs} /></label>`;
}

function isQcReport25LItemCode(itemCode) {
  // 2.5 L PET items use item codes that start with "301-" — bar_code defaults to "-" for these.
  return String(itemCode || '').trim().toUpperCase().startsWith('301-');
}

function defaultQcReportRows(netContent = '', itemCode = '') {
  const barCodeSampleDefault = isQcReport25LItemCode(itemCode) ? '-' : 'OK';
  return Array.from({ length: QC_REPORT_ROW_COUNT }, (_, idx) => {
    const isLimitsRow = idx === 0;
    return {
      time: '',
      brix: '',
      turbidity_acidity: isLimitsRow ? '' : 'OK',
      taste_odour: isLimitsRow ? '' : 'OK',
      special_field: '',
      temp: '',
      gas_volume: '',
      uv_light_on: QC_REPORT_DEFAULT_UV_LIGHT,
      dry_field: isLimitsRow ? '' : 'OK',
      air_vol: '',
      date_code: isLimitsRow ? '' : 'OK',
      bar_code: isLimitsRow ? '' : barCodeSampleDefault,
      net_content: '',
      pressure_temp: '',
      check_mat: isLimitsRow ? '' : 'OK',
      six_pack_shrink_wrap: isLimitsRow ? '' : 'OK',
      comments: '',
    };
  });
}

function getMixingLimitsForQcReport() {
  const checks = state.mixingData && Array.isArray(state.mixingData.checks) ? state.mixingData.checks : [];
  const result = { brix: '', gas_volume: '' };
  for (const check of checks) {
    if (!check || typeof check !== 'object') continue;
    const key = String(check.key || '').trim();
    const limits = String(check.limits || '').trim();
    if ((key === 'rtd_brix' || key === 'brix') && limits) result.brix = result.brix || limits;
    if ((key === 'co2_spec' || key === 'co2') && limits) result.gas_volume = result.gas_volume || limits;
  }
  return result;
}

function isDashOnly(text) {
  const t = String(text || '').trim();
  return t === '-' || t === '\u2013' || t === '\u2014';
}

const QC_REPORT_LIMITS_ROW_CLEAR_OK_KEYS = new Set([
  ...QC_REPORT_OK_DASH_KEYS,
  'turbidity_acidity',
]);

function normalizeQcReportRows(value, line, itemCode = '') {
  const resolved = normalizeQcReportLine(line);
  const stripDash = resolved === 'PET' || resolved === 'CAN';
  const defaults = defaultQcReportRows('', itemCode);
  const rows = Array.isArray(value) ? value : [];
  const normalized = defaults.map((base, idx) => {
    const source = rows[idx] && typeof rows[idx] === 'object' ? rows[idx] : {};
    const row = { ...base };
    QC_REPORT_COLUMN_KEYS.forEach((key) => {
      let t = String(source[key] ?? '').trim();
      if (stripDash && isDashOnly(t) && !QC_REPORT_OK_DASH_KEYS.has(key)) t = '';
      if (idx === 0 && QC_REPORT_LIMITS_ROW_CLEAR_OK_KEYS.has(key) && (t === 'OK' || t === 'Ok')) t = '';
      row[key] = t !== '' ? String(source[key]) : base[key];
    });
    return row;
  });
  // Mirror live-edit propagation (see onQcReportFieldInput): if the limit row
  // has a meaningful UV light value, force every sample row to match. Keeps
  // legacy/imported reports consistent on first paint.
  const limitUv = String((normalized[0] && normalized[0].uv_light_on) || '').trim();
  if (limitUv && limitUv !== '-') {
    for (let i = 1; i < normalized.length; i += 1) {
      normalized[i].uv_light_on = limitUv;
    }
  }
  return normalized;
}

function qcReportRowHasEnteredBrix(row) {
  const raw = String((row && row.brix) || '').trim();
  if (!raw) return false;
  if (raw === '-' || raw === '—' || raw === '–') return false;
  return true;
}

function qcReportRowShowsInSummary(row) {
  if (!row || typeof row !== 'object') return false;
  return qcReportRowHasEnteredBrix(row);
}

const QC_REPORT_SUMMARY_COMMENTS_MAX = 48;

function qcReportSummaryCellDisplay(col, row) {
  const raw = row && typeof row === 'object' ? row[col.key] : '';
  if (col.key === 'time') {
    const tv = normalizeTimeForInput(raw);
    if (tv) return tv;
    const s = String(raw || '').trim();
    return s || '—';
  }
  const s = String(raw || '').trim();
  if (!s) return '—';
  if (col.key === 'comments' && s.length > QC_REPORT_SUMMARY_COMMENTS_MAX) {
    return `${s.slice(0, QC_REPORT_SUMMARY_COMMENTS_MAX)}…`;
  }
  return s;
}

function buildQcReportSampleSummaryHtml(columns, rows) {
  const dataRows = Array.isArray(rows) ? rows : [];
  const cols = Array.isArray(columns) ? columns : [];

  let lastBrixIdx = -1;
  for (let i = 1; i < dataRows.length; i += 1) {
    if (qcReportRowHasEnteredBrix(dataRows[i])) lastBrixIdx = i;
  }

  const th = cols
    .map((col) => `<th scope="col">${escapeHtml(col.label).replace(/\n/g, ' ')}</th>`)
    .join('');
  const colCount = 1 + cols.length;
  const placeholderRow = `<tr><td colspan="${colCount}" class="qc-muted qc-wizard-sample-summary__placeholder">No sample rows yet. Enter <strong>Brix</strong> on a row below — it will appear here.</td></tr>`;

  let body;
  if (lastBrixIdx < 1) {
    body = placeholderRow;
  } else {
    const rowsHtml = [];
    for (let i = 1; i <= lastBrixIdx; i += 1) {
      const row = dataRows[i];
      if (qcReportRowHasEnteredBrix(row)) {
        const tds = cols
          .map((col) => `<td>${escapeHtml(qcReportSummaryCellDisplay(col, row))}</td>`)
          .join('');
        rowsHtml.push(`<tr><th scope="row">${i}</th>${tds}</tr>`);
      } else {
        const emptyCells = cols.map(() => '<td></td>').join('');
        rowsHtml.push(`<tr class="qc-muted"><th scope="row">${i}</th>${emptyCells}</tr>`);
      }
    }
    body = rowsHtml.join('');
  }

  return `
      <div class="qc-wizard-card qc-wizard-sample-summary">
        <h4 class="qc-wizard-card-title">Entered sample rows</h4>
        <div class="qc-table-wrap qc-wizard-sample-summary__scroll">
          <table class="qc-table qc-wizard-sample-summary__table">
            <thead><tr><th scope="col">Row</th>${th}</tr></thead>
            <tbody>${body}</tbody>
          </table>
        </div>
      </div>`;
}

function buildBlankQcReportDay(batchMeta, order = 1) {
  const source = batchMeta && typeof batchMeta === 'object' ? batchMeta : {};
  const line = detectQcReportLine(source) || 'PET';
  const docCfg = getQcReportDocConfig(line);
  const dateValue = toDateInputValue(source.date || '') || todayDateInputValue();
  return {
    id: `day_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    order,
    line,
    report_title: docCfg.report_title,
    doc_ref: docCfg.doc_ref,
    issue_no: docCfg.issue_no,
    effective_date: docCfg.effective_date,
    page_text: docCfg.page_text,
    color_label: docCfg.color_label,
    date: dateValue,
    batch_no: String(source.batch_no || '').trim(),
    qao: '',
    product: preferredBatchProductName(source),
    shift: 'A+B',
    size: detectQcReportSize(source),
    date_code: '',
    date_code_left: '',
    date_code_right: '',
    exp: '',
    pd: '',
    closure_or_can_end_color: '',
    rows: defaultQcReportRows(),
    other_comments: '',
    qc_sign: '',
    qao_sign: '',
    qam_sign: '',
  };
}

function normalizeQcReportData(raw, batchMeta) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const days = Array.isArray(source.days) ? source.days : (Array.isArray(source.blocks) ? source.blocks : []);
  const meta = batchMeta && typeof batchMeta === 'object' ? batchMeta : {};
  const autoLine = detectQcReportLine(meta);
  const autoProduct = preferredBatchProductName(meta);
  const autoSize = detectQcReportSize(meta);
  const autoBatchNo = String(meta.batch_no || state.selectedBatchNo || '').trim();

  const normalizedDays = days
    .filter((day) => day && typeof day === 'object')
    .map((day, idx) => {
      // autoLine is derived from item_code on the batch meta, which is authoritative —
      // prefer it over day.line so legacy days stored with the wrong line get corrected.
      const line = autoLine || normalizeQcReportLine(day.line) || inferTankCipLineFromRecipe(day.product || autoProduct) || 'PET';
      const docCfg = getQcReportDocConfig(line);
      const dateCodeLeft = String(day.date_code_left || day.date_code || '');
      const dateCodeRight = String(day.date_code_right || day.date_code_secondary || '');
      const productSaved = String(day.product || '').trim();
      const productOut = resolveQcReportProductName(productSaved, meta) || autoProduct;
      const shiftSaved = String(day.shift || '').trim();
      const shiftOut = shiftSaved || 'A+B';
      const sizeSaved = String(day.size || '').trim();
      // Size field is rendered readonly and computed from item_code, so any
      // saved value that disagrees with autoSize is stale (e.g. the production
      // batch was corrected after first save). Always prefer autoSize.
      const sizeOut = autoSize || sizeSaved;
      const closureRaw = String(day.closure_or_can_end_color || '');
      const closureOut = normalizeQcReportColorOption(closureRaw, line) || closureRaw;
      return {
        id: String(day.id || `day_${idx + 1}`),
        order: idx + 1,
        line,
        report_title: docCfg.report_title,
        doc_ref: docCfg.doc_ref,
        issue_no: docCfg.issue_no,
        effective_date: docCfg.effective_date,
        page_text: docCfg.page_text,
        color_label: docCfg.color_label,
        date: toDateInputValue(day.date || '') || '',
        batch_no: String(day.batch_no || '').trim() || autoBatchNo,
        qao: String(day.qao || ''),
        product: productOut,
        shift: shiftOut,
        size: sizeOut,
        date_code: dateCodeLeft,
        date_code_left: dateCodeLeft,
        date_code_right: dateCodeRight,
        exp: String(day.exp || ''),
        pd: String(day.pd || ''),
        closure_or_can_end_color: closureOut,
        rows: normalizeQcReportRows(day.rows, line, meta.item_code).map((row) => ({
          ...row,
          net_content: canonicalQcReportNetContent(meta, row.net_content),
        })),
        other_comments: String(day.other_comments || ''),
        qc_sign: String(day.qc_sign || ''),
        qao_sign: String(day.qao_sign || ''),
        qam_sign: String(day.qam_sign || ''),
      };
    });

  if (!normalizedDays.length) {
    const blank = buildBlankQcReportDay(meta, 1);
    blank.rows = (Array.isArray(blank.rows) ? blank.rows : defaultQcReportRows()).map((row) => ({
      ...row,
      net_content: canonicalQcReportNetContent(meta, row.net_content),
    }));
    return { days: [blank] };
  }

  return { days: normalizedDays.map((day, idx) => ({ ...day, order: idx + 1 })) };
}

function defaultSeamCheckRows() {
  return Array.from({ length: SEAM_CHECK_HEAD_COUNT }, () => {
    const row = { head: '' };
    SEAM_CHECK_ROW_INPUT_KEYS.forEach((key) => {
      row[key] = '';
    });
    return row;
  });
}

function seamCheckLegacyTripletValues(source, baseKey) {
  const values = ['', '', ''];
  if (!source || typeof source !== 'object') return values;

  const legacy = source[baseKey];
  if (Array.isArray(legacy)) {
    for (let idx = 0; idx < Math.min(3, legacy.length); idx += 1) {
      values[idx] = String(legacy[idx] ?? '');
    }
    return values;
  }
  if (legacy && typeof legacy === 'object') {
    for (let idx = 0; idx < 3; idx += 1) {
      const slot = idx + 1;
      values[idx] = String(
        legacy[slot]
        ?? legacy[String(slot)]
        ?? legacy[`value_${slot}`]
        ?? legacy[`v${slot}`]
        ?? ''
      );
    }
    return values;
  }
  values[0] = String(legacy ?? '');
  return values;
}

function seamCheckRowHasValue(row) {
  if (!row || typeof row !== 'object') return false;
  return SEAM_CHECK_ROW_INPUT_KEYS.some((key) => String(row[key] || '').trim() !== '');
}

function seamCheckRowIsFullyEntered(row) {
  if (!row || typeof row !== 'object') return false;
  return SEAM_CHECK_ROW_INPUT_KEYS.every((k) => String(row[k] ?? '').trim() !== '');
}

function findNextSeamCheckInsertionRow(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  let lastFull = -1;
  for (let i = 0; i < rows.length; i += 1) {
    if (seamCheckRowIsFullyEntered(rows[i])) lastFull = i;
  }
  if (lastFull < 0) return 0;
  return Math.min(rows.length - 1, lastFull + 1);
}

function buildSeamCheckSampleSummaryHtml(rows) {
  const dataRows = Array.isArray(rows) ? rows : [];
  const cols = expandSeamCheckColumnsForWizard();

  let lastTouchedIdx = -1;
  for (let i = 0; i < dataRows.length; i += 1) {
    if (seamCheckRowHasValue(dataRows[i])) lastTouchedIdx = i;
  }

  const th = cols
    .map((col) => `<th scope="col">${escapeHtml(String(col.label || '').replace(/<br\s*\/?>/gi, ' '))}</th>`)
    .join('');
  const colCount = 1 + cols.length;
  const placeholderRow = `<tr><td colspan="${colCount}" class="qc-muted qc-wizard-sample-summary__placeholder">No seam-check rows yet. Fill all measurements on a row below — it will appear here.</td></tr>`;

  let body;
  if (lastTouchedIdx < 0) {
    body = placeholderRow;
  } else {
    const rowsHtml = [];
    for (let i = 0; i <= lastTouchedIdx; i += 1) {
      const row = dataRows[i] || {};
      if (seamCheckRowHasValue(row)) {
        const tds = cols
          .map((col) => `<td>${escapeHtml(String(row[col.key] ?? ''))}</td>`)
          .join('');
        rowsHtml.push(`<tr><th scope="row">${i + 1}</th>${tds}</tr>`);
      } else {
        const emptyCells = cols.map(() => '<td></td>').join('');
        rowsHtml.push(`<tr class="qc-muted"><th scope="row">${i + 1}</th>${emptyCells}</tr>`);
      }
    }
    body = rowsHtml.join('');
  }

  return `
      <div class="qc-wizard-card qc-wizard-sample-summary">
        <h4 class="qc-wizard-card-title">Entered seam-check rows</h4>
        <div class="qc-table-wrap qc-wizard-sample-summary__scroll">
          <table class="qc-table qc-wizard-sample-summary__table">
            <thead><tr><th scope="col">Row</th>${th}</tr></thead>
            <tbody>${body}</tbody>
          </table>
        </div>
      </div>`;
}

function normalizeSeamCheckRows(value) {
  const defaults = defaultSeamCheckRows();
  const rows = Array.isArray(value) ? value : [];
  return defaults.map((base, idx) => {
    const source = rows[idx] && typeof rows[idx] === 'object' ? rows[idx] : {};
    const row = { ...base };
    SEAM_CHECK_TRIPLET_BASE_KEYS.forEach((baseKey) => {
      const legacyValues = seamCheckLegacyTripletValues(source, baseKey);
      for (let slot = 1; slot <= 3; slot += 1) {
        const key = `${baseKey}_${slot}`;
        row[key] = String(source[key] ?? legacyValues[slot - 1] ?? '');
      }
    });
    SEAM_CHECK_SINGLE_ROW_KEYS.forEach((key) => {
      row[key] = String(source[key] ?? '');
    });
    row.head = seamCheckRowHasValue(row) ? String(idx + 1) : '';
    return row;
  });
}

function normalizeSeamCheckData(raw, batchMeta) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const meta = batchMeta && typeof batchMeta === 'object' ? batchMeta : {};
  const header = source.header && typeof source.header === 'object' ? source.header : {};
  const footer = source.footer && typeof source.footer === 'object' ? source.footer : {};
  const line = detectQcReportLine(meta) || normalizeQcReportLine(source.line || source.packaging_type || source.line_type) || '';
  const seamRequired = source.seam_required === true || meta.seam_required === true || line === 'CAN';
  const autoProduct = preferredBatchProductName(meta);
  const autoBatchNo = String(meta.batch_no || state.selectedBatchNo || '').trim();
  const autoCanSize = detectQcReportSize(meta);
  const sourceSpecs = source.specifications && typeof source.specifications === 'object' ? source.specifications : {};

  return {
    line,
    seam_required: seamRequired,
    report_title: String(source.report_title || SEAM_CHECK_DOC_CONFIG.report_title),
    company_name: String(source.company_name || SEAM_CHECK_DOC_CONFIG.company_name),
    doc_ref: String(source.doc_ref || SEAM_CHECK_DOC_CONFIG.doc_ref),
    issue_no: String(source.issue_no || SEAM_CHECK_DOC_CONFIG.issue_no),
    effective_date: String(source.effective_date || SEAM_CHECK_DOC_CONFIG.effective_date),
    revision_date: String(source.revision_date || SEAM_CHECK_DOC_CONFIG.revision_date),
    page_text: String(source.page_text || SEAM_CHECK_DOC_CONFIG.page_text),
    specifications: {
      countersink_depth: String(sourceSpecs.countersink_depth || SEAM_CHECK_SPECIFICATIONS.countersink_depth),
      body_hook_length: String(sourceSpecs.body_hook_length || SEAM_CHECK_SPECIFICATIONS.body_hook_length),
      cover_hook_length: String(sourceSpecs.cover_hook_length || SEAM_CHECK_SPECIFICATIONS.cover_hook_length),
      tightness_rating: String(sourceSpecs.tightness_rating || SEAM_CHECK_SPECIFICATIONS.tightness_rating),
      operational_seam_length: String(sourceSpecs.operational_seam_length || SEAM_CHECK_SPECIFICATIONS.operational_seam_length),
      seam_thickness: String(sourceSpecs.seam_thickness || SEAM_CHECK_SPECIFICATIONS.seam_thickness),
    },
    header: {
      date: toDateInputValue(header.date || source.date || '') || '',
      can_batch_no: String(header.can_batch_no || source.can_batch_no || ''),
      can_end_batch_no: String(header.can_end_batch_no || source.can_end_batch_no || ''),
      product: autoProduct,
      batch_no: String(header.batch_no || '').trim() || autoBatchNo,
      can_size: autoCanSize,
    },
    rows: normalizeSeamCheckRows(source.rows),
    footer: {
      qao_sign: String(footer.qao_sign || source.qao_sign || ''),
      qam_sign: String(footer.qam_sign || source.qam_sign || ''),
    },
  };
}

function applyPrimaryLineToFollowerBlocks(blocks) {
  const rows = Array.isArray(blocks) ? blocks : [];
  if (!rows.length) return { blocks: rows, changed: false };
  const firstRow = rows[0] && typeof rows[0] === 'object' ? rows[0] : {};
  const explicitPrimary = normalizeTankCipLine(firstRow.line);
  const inferredPrimary = inferTankCipLineFromRecipe(firstRow.product_name || firstRow.recipe_name);
  const primaryLine = explicitPrimary || inferredPrimary;
  if (!primaryLine) return { blocks: rows, changed: false };

  let changed = false;
  const updated = rows.map((block) => {
    if (!block || typeof block !== 'object') return block;
    if (normalizeTankCipLine(block.line) === primaryLine) return block;
    changed = true;
    return { ...block, line: primaryLine };
  });

  return { blocks: updated, changed };
}

function defaultTankCipSolutionRows(rowCount = 5) {
  const count = Number.isFinite(Number(rowCount)) ? Math.max(1, Math.min(10, Number(rowCount))) : 5;
  return Array.from({ length: count }, () => ({
    time_start: '',
    time_finish: '',
    solution: '',
    sign: '',
  }));
}

function tankCipOrderSolutionLabel(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const key = raw.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (key.includes('caustic')) return 'Caustic';
  if (key.includes('topaz md3')) return 'Topaz MD3';
  if (key.includes('acid')) return 'Acid';
  if (key.includes('oxonia')) return 'Oxonia';
  if (key.includes('ro water')) return 'RO Water';
  if (key.includes('water')) return 'Hot Water';
  return raw;
}

function buildTankCipCleaningSequence(solutionRows, fallback = TANK_CIP_CLEANING_SEQUENCE) {
  const values = toArray(solutionRows)
    .map((row) => tankCipOrderSolutionLabel(row && row.solution))
    .filter((value) => !!value);
  if (values.length) return values.join(' - ');
  return String(fallback || '').trim();
}

function defaultTankCipSwabRows() {
  return Array.from({ length: 4 }, () => '');
}

function swabSlotCount(label) {
  return Math.max(0, String(label || '').split('__').length - 1);
}

function defaultTankCipSwabItems() {
  return TANK_CIP_SWAB_TEST_TEMPLATES.map((item) => ({
    id: String(item.id || ''),
    label: String(item.label || ''),
    selected: false,
    values: Array.from({ length: swabSlotCount(item.label) }, () => ''),
  }));
}

function normalizeTankCipSwabItems(rawItems, legacyRows = []) {
  const items = defaultTankCipSwabItems();
  const mapped = new Map();
  toArray(rawItems).forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const key = String(item.id || item.label || '').trim().toLowerCase();
    if (!key) return;
    mapped.set(key, item);
  });

  items.forEach((item) => {
    const source = mapped.get(String(item.id || '').toLowerCase()) || mapped.get(String(item.label || '').toLowerCase());
    const slotCount = swabSlotCount(item.label);
    const values = Array.from({ length: slotCount }, () => '');
    if (source && typeof source === 'object') {
      const sourceValues = Array.isArray(source.values) ? source.values : [];
      item.selected = normalizeYesNoValue(source.selected) === 'yes' || source.selected === true;
      for (let idx = 0; idx < slotCount; idx += 1) {
        if (idx < sourceValues.length) {
          values[idx] = String(sourceValues[idx] || '');
          continue;
        }
        values[idx] = String(source[`value_${idx + 1}`] || source[`entry_${idx + 1}`] || '');
      }
    }
    item.values = values;
  });

  return items;
}

function buildTankCipSwabDisplayLine(item) {
  const template = String((item && item.label) || '').trim();
  if (!template) return '';
  const parts = template.split('__');
  if (parts.length <= 1) return template;
  const values = Array.isArray(item && item.values) ? item.values : [];
  let line = parts[0];
  for (let idx = 0; idx < parts.length - 1; idx += 1) {
    line += `${String(values[idx] || '')}${parts[idx + 1]}`;
  }
  return line.replace(/\s+/g, ' ').trim();
}

function buildTankCipSwabDisplayRows(swabItems) {
  const rows = [];
  toArray(swabItems).forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const selected = normalizeYesNoValue(item.selected) === 'yes' || item.selected === true;
    if (!selected) return;
    const line = buildTankCipSwabDisplayLine(item);
    if (line) rows.push(line);
  });
  return rows;
}

function swabTemplateMenuLabel(template) {
  return String(template || '')
    .replace(/__/g, ' ____ ')
    .replace(/\s+/g, ' ')
    .trim();
}

function swabTemplateSearchValue(template) {
  return swabTemplateMenuLabel(template).toLowerCase();
}

function filterTankCipSwabOptions(blockIndex, query) {
  const picker = document.querySelector(`[data-cip-swab-picker][data-block-index="${blockIndex}"]`);
  if (!picker) return;

  const needle = String(query || '').trim().toLowerCase();
  const terms = needle.split(/\s+/).filter(Boolean);
  let visibleCount = 0;
  picker.querySelectorAll('[data-swab-option]').forEach((optionEl) => {
    const haystack = String(optionEl.getAttribute('data-swab-search') || '').toLowerCase();
    const show = !terms.length || terms.every((term) => haystack.includes(term));
    optionEl.classList.toggle('qc-hidden', !show);
    if (show) visibleCount += 1;
  });

  const noMatchEl = picker.querySelector('[data-swab-no-match]');
  if (noMatchEl) noMatchEl.classList.toggle('qc-hidden', visibleCount > 0);
}

function syncTankCipSwabEmptyState(blockIndex) {
  const emptyRowEl = document.querySelector(`[data-swab-selected-empty][data-block-index="${blockIndex}"]`);
  if (!emptyRowEl) return;
  const hasVisibleRows = !!document.querySelector(
    `[data-swab-selected-row][data-block-index="${blockIndex}"]:not(.qc-hidden)`
  );
  emptyRowEl.classList.toggle('qc-hidden', hasVisibleRows);
}

function syncTankCipSwabSummary(blockIndex) {
  const picker = document.querySelector(`[data-cip-swab-picker][data-block-index="${blockIndex}"]`);
  if (!picker) return;
  const summaryEl = picker.querySelector('[data-swab-summary]');
  if (!summaryEl) return;
  const selectedCount = picker.querySelectorAll(
    'input[data-cip-field="swab_items"][data-row-key="selected"]:checked'
  ).length;
  summaryEl.textContent = selectedCount
    ? `Search and select swab tests (${selectedCount} selected)`
    : 'Search and select swab tests';
}

function setTankCipSwabMenuOpen(blockIndex, isOpen) {
  const picker = document.querySelector(`[data-cip-swab-picker][data-block-index="${blockIndex}"]`);
  if (!picker) return;
  const menuEl = picker.querySelector('[data-swab-menu]');
  const triggerEl = picker.querySelector('[data-cip-field="swab_toggle"]');
  const caretEl = picker.querySelector('[data-swab-caret]');
  if (menuEl) menuEl.classList.toggle('qc-hidden', !isOpen);
  if (triggerEl) triggerEl.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  if (caretEl) caretEl.classList.toggle('is-open', !!isOpen);
  picker.classList.toggle('is-open', !!isOpen);
}

function closeAllTankCipSwabMenus(exceptBlockIndex = null) {
  document.querySelectorAll('[data-cip-swab-picker]').forEach((pickerEl) => {
    const blockIndex = Number(pickerEl.getAttribute('data-block-index'));
    if (Number.isFinite(blockIndex) && exceptBlockIndex != null && blockIndex === Number(exceptBlockIndex)) return;
    setTankCipSwabMenuOpen(blockIndex, false);
  });
}

function syncTankCipSwabSelectionUi(blockIndex, rowIndex, isSelected) {
  const selected = !!isSelected;
  const rowEl = document.querySelector(
    `[data-swab-selected-row][data-block-index="${blockIndex}"][data-row-index="${rowIndex}"]`
  );
  if (rowEl) rowEl.classList.toggle('qc-hidden', !selected);

  document
    .querySelectorAll(
      `input[data-cip-field="swab_items"][data-block-index="${blockIndex}"][data-row-index="${rowIndex}"][data-row-key="selected"]`
    )
    .forEach((checkboxEl) => {
      if (checkboxEl && checkboxEl.type === 'checkbox') checkboxEl.checked = selected;
    });

  syncTankCipSwabEmptyState(blockIndex);
  syncTankCipSwabSummary(blockIndex);
}

function renderTankCipSwabTemplateInputs(item, blockIndex, rowIndex) {
  const template = String((item && item.label) || '');
  const parts = template.split('__');
  const values = Array.isArray(item && item.values) ? item.values : [];
  if (parts.length <= 1) return escapeHtml(template);

  let html = '';
  for (let idx = 0; idx < parts.length - 1; idx += 1) {
    html += `<span>${escapeHtml(parts[idx])}</span>`;
    html += `<input type="text" class="qc-input qc-cip-swab-input" value="${escapeHtml(values[idx] || '')}" data-cip-field="swab_items" data-block-index="${blockIndex}" data-row-index="${rowIndex}" data-row-key="value" data-value-index="${idx}" />`;
  }
  html += `<span>${escapeHtml(parts[parts.length - 1])}</span>`;
  return html;
}

function defaultTankCipRoPhRows() {
  return Array.from({ length: 4 }, () => ({
    standard_ro_water_ph: '',
    verification_of_tested_ph: '',
  }));
}

function defaultTankCipObservationRows() {
  return Array.from({ length: 4 }, () => '');
}

function buildBlankTankCipBlock(cipType = '3_step') {
  const type = normalizeTankCipType(cipType);
  const cfg = TANK_CIP_TYPE_CONFIG[type] || TANK_CIP_TYPE_CONFIG['3_step'];
  const solutionRowCount = Number.isFinite(Number(cfg.solution_row_count))
    ? Math.max(1, Math.min(10, Number(cfg.solution_row_count)))
    : 5;
  return {
    id: `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    cip_type: type,
    date: '',
    line: '',
    tank_no: '',
    start_time: '',
    finish_time: '',
    solution_row_count: solutionRowCount,
    solution_rows: defaultTankCipSolutionRows(solutionRowCount),
    swab_items: defaultTankCipSwabItems(),
    swab_rows: defaultTankCipSwabRows(),
    ro_ph_rows: defaultTankCipRoPhRows(),
    oxonia_strip_result: '',
    rinser_filter_change: '',
    rinser_filter_type: '',
    observations: defaultTankCipObservationRows(),
    filler_sign_names: [],
    qao: '',
    fsms_tl: '',
  };
}

function normalizeFillerSignNames(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => String(v || '').trim())
    .filter((v) => FILLER_CIP_SIGN_NAMES.includes(v));
}

function normalizeTankMixingSignNames(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => String(v || '').trim())
    .filter((v) => TANK_MIXING_SIGN_NAMES.includes(v));
}

function normalizeTankCipData(raw, batchMeta) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const blocks = Array.isArray(source.blocks) ? source.blocks : [];
  const autoBatchNo = String(
    (batchMeta && batchMeta.batch_no)
    || state.selectedBatchNo
    || getCalculatorBatchNoFallback()
    || ''
  ).trim();
  const autoProductName = String(
    (batchMeta && (batchMeta.recipe_name || batchMeta.product_name))
    || getCalculatorProductNameFallback()
    || ''
  ).trim();

  const normalizedBlocks = blocks
    .filter((row) => row && typeof row === 'object')
    .map((row, index) => {
      const type = normalizeTankCipType(row.cip_type);
      const cfg = TANK_CIP_TYPE_CONFIG[type] || TANK_CIP_TYPE_CONFIG['3_step'];
      const solutionRowCount = Number.isFinite(Number(cfg.solution_row_count))
        ? Math.max(1, Math.min(10, Number(cfg.solution_row_count)))
        : 5;
      const solutionRowsRaw = Array.isArray(row.solution_rows) ? row.solution_rows : [];
      const solutionRows = defaultTankCipSolutionRows(solutionRowCount).map((base, rowIndex) => {
        const item = solutionRowsRaw[rowIndex] && typeof solutionRowsRaw[rowIndex] === 'object'
          ? solutionRowsRaw[rowIndex]
          : {};
        const solutionValue = String(item.solution || '').trim();
        const normalizedSolution = solutionValue;
        return {
          ...base,
          time_start: String(item.time_start || ''),
          time_finish: String(item.time_finish || ''),
          solution: normalizedSolution,
          sign: '',
        };
      });

      const swabRowsRaw = Array.isArray(row.swab_rows) ? row.swab_rows : [];
      const swabItems = normalizeTankCipSwabItems(row.swab_items, swabRowsRaw);
      const swabDisplayRows = buildTankCipSwabDisplayRows(swabItems);
      const swabRows = defaultTankCipSwabRows().map((_, rowIndex) => String(swabDisplayRows[rowIndex] || ''));

      const roPhRowsRaw = Array.isArray(row.ro_ph_rows) ? row.ro_ph_rows : [];
      const roPhRows = defaultTankCipRoPhRows().map((_, rowIndex) => {
        const item = roPhRowsRaw[rowIndex] && typeof roPhRowsRaw[rowIndex] === 'object'
          ? roPhRowsRaw[rowIndex]
          : {};
        return {
          standard_ro_water_ph: String(item.standard_ro_water_ph || ''),
          verification_of_tested_ph: String(item.verification_of_tested_ph || ''),
        };
      });

      const observationsRaw = Array.isArray(row.observations) ? row.observations : [];
      const observations = defaultTankCipObservationRows().map((_, rowIndex) => String(observationsRaw[rowIndex] || ''));
      const rinserFilterChange = normalizeYesNoValue(row.rinser_filter_change);
      const rinserFilterType = rinserFilterChange === 'yes'
        ? normalizeRinserFilterType(row.rinser_filter_type)
        : '';

      const rinsingDone = !!row.rinsing_done;
      const out = {
        id: String(row.id || `${type}_${index + 1}`),
        cip_type: type,
        order: index + 1,
        cleaning_sequence: TANK_CIP_CLEANING_SEQUENCE,
        procedure_title: String(cfg.title || ''),
        doc_ref: String(cfg.doc_ref || ''),
        issue_no: String(cfg.issue_no || ''),
        effective_date: String(cfg.effective_date || ''),
        revision_date: String(cfg.revision_date || ''),
        page_text: String(cfg.page_text || ''),
        solution_row_count: solutionRowCount,
        has_ro_ph_table: !!cfg.has_ro_ph_table,
        has_observations: !!cfg.has_observations,
        show_oxonia_strip_result: !!cfg.show_oxonia_strip_result,
        procedure_lines: Array.isArray(cfg.procedure_lines) ? [...cfg.procedure_lines] : [],
        date: String(row.date || ''),
        product_name: autoProductName,
        line: normalizeTankCipLine(row.line),
        is_rinser: !!row.is_rinser,
        tank_no: String(row.tank_no || ''),
        batch_no: autoBatchNo,
        start_time: String(row.start_time || ''),
        finish_time: String(row.finish_time || ''),
        rinsing_done: rinsingDone,
        rinsing_date: rinsingDone ? String(row.rinsing_date || '') : '',
        mixing_comments: String(row.mixing_comments || ''),
        solution_rows: solutionRows,
        swab_items: swabItems,
        swab_rows: swabRows,
        ro_ph_rows: roPhRows,
        oxonia_strip_result: normalizeYesNoValue(row.oxonia_strip_result),
        rinser_filter_change: rinserFilterChange,
        rinser_filter_type: rinserFilterType,
        observations,
        filler_sign_names: normalizeFillerSignNames(row.filler_sign_names),
        tank_mixing_sign_names: normalizeTankMixingSignNames(row.tank_mixing_sign_names),
        qao: String(row.qao || ''),
        fsms_tl: String(row.fsms_tl || ''),
      };
      // Preserve mixing-CIP back-pointer so QC→mixing two-way sync can match by source.record_id.
      if (row.source && typeof row.source === 'object') {
        out.source = { ...row.source };
      }
      return out;
    });

  return {
    blocks: normalizedBlocks,
  };
}

function slugifyKey(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return '';
  return text
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function defaultCheckDataEntryEnabled(key) {
  return !NON_DATA_ENTRY_KEYS.has(String(key || '').trim().toLowerCase());
}

function normalizeDataEntry(value, key = '') {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const text = String(value == null ? '' : value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'editable', 'enabled', 'input'].includes(text)) return true;
  if (['0', 'false', 'no', 'n', 'readonly', 'read_only', 'disabled', 'display'].includes(text)) return false;
  return defaultCheckDataEntryEnabled(key);
}

function withPrefixIfMissing(value, prefix) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.toUpperCase().startsWith(String(prefix || '').toUpperCase())) return text;
  return `${prefix} ${text}`;
}

function normalizeList(values) {
  const seen = new Set();
  const rows = [];
  toArray(values).forEach((value) => {
    const text = String(value || '').trim();
    if (!text) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    rows.push(text);
  });
  return rows;
}

function listIncludesByNormalizedKey(values, candidate) {
  const target = normalizeKeyLookup(candidate);
  if (!target) return false;
  return toArray(values).some((value) => normalizeKeyLookup(value) === target);
}

function filterConfigRecipeOptions(recipeNames, selectedNames, searchQuery) {
  const selectedLookup = new Set(toArray(selectedNames).map((name) => normalizeKeyLookup(name)));
  const query = normalizeKeyLookup(searchQuery);
  return toArray(recipeNames).filter((name) => {
    const key = normalizeKeyLookup(name);
    if (!key) return false;
    if (selectedLookup.has(key)) return false;
    if (!query) return true;
    return key.includes(query);
  });
}

function qualityLimit(qualitySpecs, keys) {
  const source = qualitySpecs && typeof qualitySpecs === 'object' ? qualitySpecs : {};
  for (const key of toArray(keys)) {
    const value = String(source[key] || '').trim();
    if (value) return value;
  }
  return '';
}

function dateCodingLimit(qualitySpecs) {
  const source = qualitySpecs && typeof qualitySpecs === 'object' ? qualitySpecs : {};
  const exp = withPrefixIfMissing(source.date_coding, 'EXP');
  const pd = withPrefixIfMissing(source.pd_coding, 'PD');
  return [exp, pd].filter(Boolean).join(' | ');
}

function normalizeSamplesLimit(value) {
  return String(value || '')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function normalizeSimpleSyrupDefaults(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    syrup_brix: String(source.syrup_brix || ''),
    g_per_l: String(source.g_per_l || ''),
    kg_sugar: String(source.kg_sugar || ''),
    kg_per_l: String(source.kg_per_l || ''),
    value: String(source.value || ''),
  };
}

function buildDefaultTemplateChecks(qualitySpecs = {}) {
  return MIXING_CHECK_DEFAULTS.map((def) => {
    const limit = def.key === 'date_coding'
      ? dateCodingLimit(qualitySpecs)
      : qualityLimit(qualitySpecs, def.quality_keys);
    return {
      test: def.test,
      limits: def.key === 'samples' ? normalizeSamplesLimit(limit) : limit,
      result: '',
      adjustments: '',
      result_type: def.result_type,
      data_entry: normalizeDataEntry(def.data_entry, def.key),
      key: def.key,
    };
  });
}

function normalizeTemplateChecks(value, qualitySpecs = {}) {
  if (!Array.isArray(value) || !value.length) {
    return buildDefaultTemplateChecks(qualitySpecs);
  }
  return value
    .map((row, idx) => {
      const source = row && typeof row === 'object' ? row : {};
      const test = String(source.test || '').trim() || `Check ${idx + 1}`;
      const key = slugifyKey(source.key || test);
      const resultType = String(source.result_type || '').trim().toLowerCase() === 'checkbox' ? 'checkbox' : 'text';
      const limitRaw = String(source.limits || '').trim();
      const fallbackLimit = key === 'date_coding'
        ? dateCodingLimit(qualitySpecs)
        : qualityLimit(qualitySpecs, [key, key.replace(/_/g, ' ')]);
      const limitsValue = limitRaw || fallbackLimit;
      return {
        test,
        limits: key === 'samples' ? normalizeSamplesLimit(limitsValue) : limitsValue,
        result: String(source.result || ''),
        adjustments: String(source.adjustments || ''),
        result_type: resultType,
        data_entry: normalizeDataEntry(source.data_entry, key),
        key,
      };
    })
    .filter((row) => String(row.test || '').trim() || String(row.key || '').trim());
}

function normalizeTemplateTypeItem(item) {
  const source = item && typeof item === 'object' ? item : {};
  const dataMain = source.data_main && typeof source.data_main === 'object' ? source.data_main : {};
  const qualitySpecs = source.quality_specs && typeof source.quality_specs === 'object' ? source.quality_specs : {};
  return {
    ...source,
    type: String(source.type || ''),
    sheet: String(source.sheet || ''),
    data_main: {
      ...dataMain,
      heading: String(dataMain.heading || ''),
      procedure: String(dataMain.procedure || ''),
      notes: normalizeList(dataMain.notes),
      extra_notes: normalizeList(dataMain.extra_notes),
      steps: normalizeStepRows(dataMain.steps),
    },
    quality_specs: qualitySpecs,
    raw_specs: toArray(source.raw_specs),
    mixing_simple_syrup_defaults: normalizeSimpleSyrupDefaults(source.mixing_simple_syrup_defaults),
    mixing_checks: normalizeTemplateChecks(source.mixing_checks, qualitySpecs),
  };
}

function normalizeTemplatePayload(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const payload = {
    ...source,
    types: toArray(source.types).map((item) => normalizeTemplateTypeItem(item)),
    recipe_title_mapping: source.recipe_title_mapping && typeof source.recipe_title_mapping === 'object'
      ? { ...source.recipe_title_mapping }
      : {},
  };
  return payload;
}

function normalizeKeyLookup(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ');
}

function findTemplateByType(typeName) {
  const target = normalizeKeyLookup(typeName);
  if (!target || !state.templatePayload || !Array.isArray(state.templatePayload.types)) return null;
  return state.templatePayload.types.find((item) => normalizeKeyLookup(item.type) === target) || null;
}

function getRecipeNamesForConfig() {
  const names = toArray(state.recipeCatalog).map((item) => String((item && item.name) || '').trim());
  const batchNames = toArray(state.batches).flatMap((item) => [
    String((item && item.recipe_name) || '').trim(),
    String((item && item.product_name) || '').trim(),
  ]);
  const mappingKeys = state.templatePayload && state.templatePayload.recipe_title_mapping
    ? Object.keys(state.templatePayload.recipe_title_mapping)
    : [];
  return normalizeList([...names, ...batchNames, ...mappingKeys]);
}

function getProcedureTypeNames() {
  if (!state.templatePayload || !Array.isArray(state.templatePayload.types)) return [];
  return normalizeList(state.templatePayload.types.map((item) => String((item && item.type) || '').trim()));
}

function findMappedTypeForRecipe(recipeName) {
  const mapping = state.templatePayload && state.templatePayload.recipe_title_mapping
    ? state.templatePayload.recipe_title_mapping
    : {};
  const recipe = String(recipeName || '').trim();
  if (!recipe) return '';
  if (mapping[recipe]) return String(mapping[recipe] || '');

  const normalized = normalizeKeyLookup(recipe);
  for (const [key, value] of Object.entries(mapping)) {
    if (normalizeKeyLookup(key) === normalized) return String(value || '');
  }
  return '';
}

function findMappedTypeForRecipes(recipeNames) {
  for (const recipeName of normalizeList(recipeNames)) {
    const mapped = findMappedTypeForRecipe(recipeName);
    if (mapped) return mapped;
  }
  return '';
}

function getRecipesMappedToType(typeName) {
  const mapping = state.templatePayload && state.templatePayload.recipe_title_mapping
    ? state.templatePayload.recipe_title_mapping
    : {};
  const target = normalizeKeyLookup(typeName);
  if (!target) return [];

  const seen = new Set();
  const rows = [];
  Object.entries(mapping).forEach(([recipeName, mappedType]) => {
    if (normalizeKeyLookup(mappedType) !== target) return;
    const recipe = String(recipeName || '').trim();
    const key = normalizeKeyLookup(recipe);
    if (!key || seen.has(key)) return;
    seen.add(key);
    rows.push(recipe);
  });
  return normalizeList(rows);
}

function getCurrentConfigTemplate() {
  return findTemplateByType(state.configTemplateType);
}

function nextUniqueTemplateTypeName(baseName, excludeTemplate = null) {
  const seed = String(baseName || '').trim() || 'New Mixing Procedure';
  const types = state.templatePayload && Array.isArray(state.templatePayload.types)
    ? state.templatePayload.types
    : [];
  const used = new Set(
    types
      .filter((item) => item && item !== excludeTemplate)
      .map((item) => normalizeKeyLookup(item.type))
      .filter(Boolean)
  );

  let candidate = seed;
  let suffix = 2;
  while (used.has(normalizeKeyLookup(candidate))) {
    candidate = `${seed} ${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function buildBlankMixingTemplate(typeName, sheetName = 'CANS') {
  const resolvedType = String(typeName || '').trim();
  const heading = resolvedType ? `MASTER BATCH PRODUCTION RECORD : ${resolvedType}` : '';
  return normalizeTemplateTypeItem({
    sheet: String(sheetName || 'CANS'),
    type: resolvedType,
    data_main: {
      heading,
      procedure: '',
      notes: [],
      extra_notes: [],
      steps: [],
    },
    quality_specs: {},
    raw_specs: [],
    mixing_simple_syrup_defaults: {
      syrup_brix: '',
      g_per_l: '',
      kg_sugar: '',
      kg_per_l: '',
      value: '',
    },
    mixing_checks: [],
  });
}

async function saveTemplatePayloadAndRefresh(successMessage) {
  setStatus('Saving mixing procedure configuration...');
  const response = await qcSaveTemplatePayload(state.templatePayload);
  const savedPayload = response && response.payload ? response.payload : null;
  if (savedPayload && typeof savedPayload === 'object') {
    state.templatePayload = normalizeTemplatePayload(savedPayload);
  } else {
    await loadTemplatePayload(true);
  }

  const typeNames = getProcedureTypeNames();
  if (!typeNames.includes(state.configTemplateType)) {
    state.configTemplateType = typeNames[0] || '';
  }
  state.configPendingTemplateType = state.configTemplateType;
  state.configRecipeNames = getRecipesMappedToType(state.configTemplateType);

  renderMixingConfigPanel();
  if (state.selectedBatchNo) await loadSelectedMixing();
  setStatus(successMessage);
  showToast(successMessage);
}

function applyTemplateTypeRename(newTypeNameRaw) {
  const template = getCurrentConfigTemplate();
  if (!template) return;

  const oldType = String(template.type || '').trim();
  const newType = String(newTypeNameRaw || '').trim();
  if (!newType || normalizeKeyLookup(newType) === normalizeKeyLookup(oldType)) {
    state.configPendingTemplateType = oldType;
    return;
  }

  const duplicate = findTemplateByType(newType);
  if (duplicate && duplicate !== template) {
    throw new Error(`Title name '${newType}' already exists.`);
  }

  template.type = newType;
  template.data_main = template.data_main || {};
  const heading = String(template.data_main.heading || '').trim();
  if (!heading) {
    template.data_main.heading = `MASTER BATCH PRODUCTION RECORD : ${newType}`;
  } else if (oldType && heading.includes(oldType)) {
    template.data_main.heading = heading.replace(oldType, newType);
  }

  const mapping = state.templatePayload && state.templatePayload.recipe_title_mapping
    ? state.templatePayload.recipe_title_mapping
    : {};
  Object.keys(mapping).forEach((recipe) => {
    if (normalizeKeyLookup(mapping[recipe]) === normalizeKeyLookup(oldType)) {
      mapping[recipe] = newType;
    }
  });

  state.configTemplateType = newType;
  state.configPendingTemplateType = newType;
}

function getSelectedBatchMeta() {
  if (!state.selectedBatchNo) return null;
  return state.batches.find((b) => b.batch_no === state.selectedBatchNo) || null;
}

function normalizeMixingData(raw, batchMeta) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const batchNo = String((source.header && source.header.batch_no) || (batchMeta && batchMeta.batch_no) || state.selectedBatchNo || '').trim();
  const derivedJobNo = batchNo.toLowerCase().startsWith('d') ? batchNo.slice(1) : batchNo;
  const normalizedDate = toDateInputValue(
    (source.header && source.header.date) ||
    (batchMeta && batchMeta.date) ||
    ''
  );

  const header = {
    date: normalizedDate,
    batch_no: batchNo,
    job_no: String((source.header && source.header.job_no) || derivedJobNo),
    tank_no: String((source.header && source.header.tank_no) || ''),
    product_name: String(
      (source.header && source.header.product_name) ||
      (batchMeta && (batchMeta.recipe_name || batchMeta.product_name)) ||
      ''
    ),
  };

  const syrup = {
    quantity: String((source.syrup && source.syrup.quantity) || ''),
    actual: String((source.syrup && source.syrup.actual) || ''),
  };

  const simple_syrup_conversion = {
    syrup_brix: String((source.simple_syrup_conversion && source.simple_syrup_conversion.syrup_brix) || ''),
    g_per_l: String((source.simple_syrup_conversion && source.simple_syrup_conversion.g_per_l) || ''),
    kg_sugar: String((source.simple_syrup_conversion && source.simple_syrup_conversion.kg_sugar) || ''),
    kg_per_l: String((source.simple_syrup_conversion && source.simple_syrup_conversion.kg_per_l) || ''),
    value: String((source.simple_syrup_conversion && source.simple_syrup_conversion.value) || ''),
  };

  const approvedRaw = String((source.packing_decision && source.packing_decision.approved) || '').trim().toLowerCase();
  const packing_decision = {
    approved: approvedRaw === 'yes' || approvedRaw === 'no' ? approvedRaw : '',
    actual_final_volume: String(
      (source.packing_decision && source.packing_decision.actual_final_volume) ||
      (source.syrup && source.syrup.actual) ||
      ''
    ),
    compared_batch_no: String(
      (source.packing_decision && (source.packing_decision.compared_batch_no || source.packing_decision.compared_batch)) ||
      ''
    ),
  };

  const notes = Array.isArray(source.notes)
    ? source.notes.map((x) => String(x || '').trim()).filter(Boolean)
    : [];

  const steps = Array.isArray(source.steps)
    ? source.steps
        .map((step, idx) => {
          if (step && typeof step === 'object') {
            const instruction = String(step.instruction || '').trim();
            if (!instruction) return null;
            return {
              step_no: step.step_no ?? idx + 1,
              instruction,
            };
          }
          const instruction = String(step || '').trim();
          if (!instruction) return null;
          return { step_no: idx + 1, instruction };
        })
        .filter(Boolean)
    : [];

  let checks = Array.isArray(source.checks)
    ? source.checks.map((row) => ({
        test: String((row && row.test) || ''),
        limits: String((row && row.limits) || ''),
        result: String((row && row.result) || ''),
        adjustments: String((row && row.adjustments) || ''),
        result_type: String((row && row.result_type) || ''),
        data_entry: row && Object.prototype.hasOwnProperty.call(row, 'data_entry') ? row.data_entry : undefined,
        key: String((row && row.key) || ''),
      }))
    : [];

  if (!checks.length) {
    checks = [
      { test: 'Appearance', limits: '', result: '', adjustments: '', result_type: 'checkbox', data_entry: true, key: 'appearance' },
      { test: 'Syrup Brix', limits: '', result: '', adjustments: '', result_type: 'text', data_entry: true, key: 'syrup_brix' },
      { test: 'RTD Brix', limits: '', result: '', adjustments: '', result_type: 'text', data_entry: true, key: 'rtd_brix' },
      { test: 'pH', limits: '', result: '', adjustments: '', result_type: 'text', data_entry: true, key: 'ph' },
      { test: 'Acidity', limits: '', result: '', adjustments: '', result_type: 'text', data_entry: true, key: 'acidity' },
      { test: 'CO2 Spec', limits: '', result: '', adjustments: '', result_type: 'text', data_entry: true, key: 'co2_spec' },
      { test: 'Shelf Life', limits: '', result: '', adjustments: '', result_type: 'text', data_entry: false, key: 'shelf_life' },
      { test: 'Date Coding', limits: '', result: '', adjustments: '', result_type: 'text', data_entry: false, key: 'date_coding' },
      { test: 'Ratio', limits: '', result: '', adjustments: '', result_type: 'text', data_entry: false, key: 'ratio' },
      { test: 'Samples', limits: '', result: '', adjustments: '', result_type: 'text', data_entry: false, key: 'samples' },
    ];
  }

  const withPrefix = (value, prefix) => {
    const text = String(value || '').trim();
    if (!text) return '';
    if (text.toUpperCase().startsWith(prefix)) return text;
    return `${prefix} ${text}`;
  };

  const dateCodingRow = checks.find((row) => String((row && row.key) || '').trim().toLowerCase() === 'date_coding');
  const pdDateRow = checks.find((row) => String((row && row.key) || '').trim().toLowerCase() === 'pd_date');
  if (dateCodingRow || pdDateRow) {
    const mergedLimits = [
      withPrefix(dateCodingRow ? dateCodingRow.limits : '', 'EXP'),
      withPrefix(pdDateRow ? pdDateRow.limits : '', 'PD'),
    ].filter(Boolean).join(' | ');

    if (dateCodingRow) {
      if (mergedLimits) dateCodingRow.limits = mergedLimits;
      if (!String(dateCodingRow.result || '').trim() && pdDateRow) {
        dateCodingRow.result = String(pdDateRow.result || '');
      }
      if (!String(dateCodingRow.adjustments || '').trim() && pdDateRow) {
        dateCodingRow.adjustments = String(pdDateRow.adjustments || '');
      }
    } else if (pdDateRow) {
      checks.push({
        ...pdDateRow,
        test: 'Date Coding',
        key: 'date_coding',
        limits: mergedLimits || withPrefix(pdDateRow.limits, 'PD'),
      });
    }
  }

  checks = checks.filter((row) => String((row && row.key) || '').trim().toLowerCase() !== 'pd_date');

  checks = checks.map((row) => {
    const key = String(row.key || '').trim().toLowerCase();
    const explicitType = String(row.result_type || '').trim().toLowerCase();
    const resultType = explicitType || (key === 'appearance' ? 'checkbox' : 'text');
    return {
      ...row,
      limits: key === 'samples'
        ? String(row.limits || '').replace(/,/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase()
        : row.limits,
      result_type: resultType,
      data_entry: normalizeDataEntry(row.data_entry, key),
    };
  });

  return {
    header,
    notes,
    steps,
    syrup,
    has_sugar: source.has_sugar,
    simple_syrup_conversion,
    packing_decision,
    checks,
  };
}

function hideAllQcPanels() {
  const ids = [
    'qc-cover-page-panel',
    'qc-picking-sheet-panel',
    'qc-mixing-panel',
    'qc-tank-cip-panel',
    'qc-report-panel',
    'qc-seam-panel',
    'qc-mixing-config-panel',
  ];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.add('qc-hidden');
  });
  const emptyEl = document.getElementById('qc-mixing-empty');
  if (emptyEl) emptyEl.classList.add('qc-hidden');
}

function renderPickingSheetPanel() {
  if (!isPickingSheetSubmenu()) return;
  const batchMeta = getSelectedBatchMeta();
  if (!state.selectedBatchNo || !batchMeta) {
    showMixingEmpty('Select a batch to open Picking Sheet.');
    return;
  }

  hideAllQcPanels();
  const pickingPanel = document.getElementById('qc-picking-sheet-panel');
  if (pickingPanel) pickingPanel.classList.remove('qc-hidden');
  const statusEl = document.getElementById('qc-picking-status');
  if (statusEl) statusEl.textContent = '';
  void loadPickingSheetBubbles();
  void loadPickingSheetPreview();
}

function renderCoverPagePanel() {
  if (!isCoverPageSubmenu()) return;
  const batchMeta = getSelectedBatchMeta();
  if (!state.selectedBatchNo || !batchMeta) {
    showMixingEmpty('Select a batch to open Cover Page.');
    return;
  }
  hideAllQcPanels();
  const panel = document.getElementById('qc-cover-page-panel');
  if (panel) panel.classList.remove('qc-hidden');
  void loadCoverPageData();
}

async function loadPickingSheetPreview() {
  if (!isPickingSheetSubmenu() || !state.selectedBatchNo) return;
  const statusEl = document.getElementById('qc-picking-status');
  revokeQcPickingBlobUrl();
  if (statusEl) statusEl.textContent = 'Loading picking sheet…';
  try {
    const ref = await qcGetPickingSheetRef(state.selectedBatchNo);
    const urlPath = ref && ref.picking_sheet_url ? String(ref.picking_sheet_url).trim() : '';
    if (!urlPath) {
      if (statusEl) {
        statusEl.textContent = 'No picking sheet is linked to this batch (production batch ID missing).';
      }
      return;
    }
    const blob = await qcFetchPdfBlob(urlPath);
    const fileLike = typeof File === 'function'
      ? new File([blob], 'picking-sheet.pdf', { type: 'application/pdf' })
      : blob;
    const objUrl = window.URL.createObjectURL(fileLike);
    state.pickingSheetObjectUrl = objUrl;
    if (statusEl) statusEl.textContent = '';
  } catch (err) {
    if (statusEl) statusEl.textContent = err.message || 'Failed to load picking sheet.';
  }
}

function onQcPickingOpenTab() {
  if (!state.pickingSheetObjectUrl) {
    showToast('No picking sheet loaded yet.', true);
    return;
  }
  window.open(state.pickingSheetObjectUrl, '_blank', 'noopener,noreferrer');
}

async function onQcPickingPrefillCalc() {
  const batchMeta = getSelectedBatchMeta();
  if (!batchMeta || !state.selectedBatchNo) {
    showToast('Select a batch first.', true);
    return;
  }
  const batchNo = String(state.selectedBatchNo || '').trim();
  const recipeName = String(batchMeta.recipe_name || batchMeta.product_name || '').trim();
  const tankNo = String(batchMeta.tank_no || '').trim();

  let editBatchId = null;
  let plannedQty = null;
  try {
    const resp = await fetch('/api/production-batches', {
      headers: { Authorization: `Bearer ${localStorage.getItem('demoplant_auth_token') || ''}` },
    });
    if (resp.ok) {
      const data = await resp.json();
      const match = (data.batches || []).find((b) => String(b.batch_no) === batchNo);
      if (match) {
        editBatchId = match.id;
        plannedQty = match.planned_qty;
      }
    }
  } catch (_err) { /* ignore */ }

  if (editBatchId == null) {
    showToast('Could not locate the production batch for this QC batch.', true);
    return;
  }

  window._pendingCalcPrefill = {
    itemCode: (recipeName.split(' - ')[0] || '').trim(),
    cases: plannedQty || 0,
    childIds: [],
    recipeName,
    batchNo,
    tankNo,
    editBatchId,
  };

  if (typeof window.switchTab === 'function') {
    window.switchTab('calculator');
  }
}

const QC_BATCH_NO_REGEX = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

function showQcEditBatchError(message) {
  const el = document.getElementById('qc-edit-batch-error');
  if (!el) return;
  if (message) {
    el.textContent = message;
    el.classList.remove('qc-hidden');
  } else {
    el.textContent = '';
    el.classList.add('qc-hidden');
  }
}

function setQcEditBatchBusy(busy) {
  const saveBtn = document.getElementById('qc-edit-batch-save');
  const cancelBtn = document.getElementById('qc-edit-batch-cancel');
  const batchInp = document.getElementById('qc-edit-batch-no-input');
  const tankInp = document.getElementById('qc-edit-tank-no-input');
  [saveBtn, cancelBtn, batchInp, tankInp].forEach((el) => {
    if (!el) return;
    el.disabled = !!busy;
  });
  if (saveBtn) saveBtn.textContent = busy ? 'Saving...' : 'Save';
}

function openQcEditBatchModal() {
  const modal = document.getElementById('qc-edit-batch-modal');
  if (!modal) return;
  const batchMeta = getSelectedBatchMeta() || {};
  const batchInp = document.getElementById('qc-edit-batch-no-input');
  const tankInp = document.getElementById('qc-edit-tank-no-input');
  if (batchInp) batchInp.value = String(state.selectedBatchNo || '');
  if (tankInp) tankInp.value = String(batchMeta.tank_no || '');
  showQcEditBatchError('');
  setQcEditBatchBusy(false);
  modal.classList.remove('qc-hidden');
  if (batchInp) batchInp.focus();
}

function closeQcEditBatchModal() {
  const modal = document.getElementById('qc-edit-batch-modal');
  if (!modal) return;
  modal.classList.add('qc-hidden');
  showQcEditBatchError('');
  setQcEditBatchBusy(false);
}

async function onQcPickingEdit() {
  if (!state.selectedBatchNo) {
    showToast('Select a batch first.', true);
    return;
  }
  openQcEditBatchModal();
}

async function onQcEditBatchSave() {
  const oldBatch = String(state.selectedBatchNo || '').trim();
  const batchInp = document.getElementById('qc-edit-batch-no-input');
  const tankInp = document.getElementById('qc-edit-tank-no-input');
  const newBatch = String(batchInp?.value || '').trim();
  const newTank = String(tankInp?.value || '').trim();

  if (!newBatch) {
    showQcEditBatchError('Batch No is required.');
    return;
  }
  if (!QC_BATCH_NO_REGEX.test(newBatch)) {
    showQcEditBatchError('Batch No can only contain letters, digits, dot, underscore and dash, and must start with a letter or digit.');
    return;
  }

  const batchMeta = getSelectedBatchMeta() || {};
  const oldTank = String(batchMeta.tank_no || '').trim();
  const tankChanged = newTank !== oldTank;
  const batchChanged = newBatch !== oldBatch;
  if (!tankChanged && !batchChanged) {
    closeQcEditBatchModal();
    return;
  }

  if (tankChanged) {
    const proceed = window.confirm(
      `Changing the tank from "${oldTank || '(none)'}" to "${newTank || '(none)'}" will clear this batch's Tank CIP and Filler/Mixer CIP entries and return assigned mixing CIPs to pending. Continue?`
    );
    if (!proceed) return;
  }

  showQcEditBatchError('');
  setQcEditBatchBusy(true);
  try {
    const payload = {};
    if (batchChanged) payload.batch_no = newBatch;
    if (tankChanged) payload.tank_no = newTank;
    const res = await qcUpdateBatchIdentifiers(oldBatch, payload);
    closeQcEditBatchModal();
    if (res && res.batch_no && res.batch_no !== oldBatch) {
      state.selectedBatchNo = res.batch_no;
    }
    await refreshBatches();
    if (typeof loadPickingSheetPreview === 'function') {
      try { await loadPickingSheetPreview(); } catch (_e) { /* non-fatal */ }
    }
    showToast(`Picking sheet updated${res?.renamed ? ' (renamed)' : ''}.`);
  } catch (err) {
    showQcEditBatchError(err?.message || 'Update failed');
  } finally {
    setQcEditBatchBusy(false);
  }
}

function setActiveSubmenu(name) {
  if (name === 'seam_check' && !selectedBatchSupportsSeam()) {
    name = state.selectedBatchNo ? 'qc_report' : 'picking_sheet';
  }
  const prev = state.activeSubmenu;
  if (isCipSubmenu(prev) && prev !== name) {
    void flushCipAutoSaveForSection(activeCipSection(prev));
  }
  if (prev === 'qc_report' && name !== 'qc_report') {
    syncQcReportDomToStateIfVisible();
    void flushQcReportPendingSave();
  }
  if (prev === 'seam_check' && name !== 'seam_check') {
    void flushSeamCheckPendingSave();
  }
  state.activeSubmenu = name;
  const coverPageBtn = document.getElementById('qc-submenu-cover-page');
  const pickingBtn = document.getElementById('qc-submenu-picking-sheet');
  const mixingBtn = document.getElementById('qc-submenu-mixing');
  const tankCipBtn = document.getElementById('qc-submenu-tank-cip');
  const fillerMixerCipBtn = document.getElementById('qc-submenu-filler-mixer-cip');
  const qcReportBtn = document.getElementById('qc-submenu-qc-report');
  const seamCheckBtn = document.getElementById('qc-submenu-seam-check');
  const configBtn = document.getElementById('qc-config-mixing-btn');
  const isConfigMode = name === 'configure_mixing';
  const gridEl = document.querySelector('.qc-grid');
  const listPanelEl = document.querySelector('.qc-list-panel');
  if (gridEl) gridEl.classList.toggle('qc-grid-config-mode', isConfigMode);
  if (listPanelEl) listPanelEl.classList.toggle('qc-hidden', isConfigMode);
  updateSeamSubmenuVisibility();
  if (coverPageBtn) {
    if (name === 'cover_page') coverPageBtn.classList.add('qc-btn-primary');
    else coverPageBtn.classList.remove('qc-btn-primary');
  }
  if (pickingBtn) {
    if (name === 'picking_sheet') pickingBtn.classList.add('qc-btn-primary');
    else pickingBtn.classList.remove('qc-btn-primary');
  }
  if (mixingBtn) {
    if (name === 'mixing') mixingBtn.classList.add('qc-btn-primary');
    else mixingBtn.classList.remove('qc-btn-primary');
  }
  if (tankCipBtn) {
    if (name === 'tank_cip') tankCipBtn.classList.add('qc-btn-primary');
    else tankCipBtn.classList.remove('qc-btn-primary');
  }
  if (fillerMixerCipBtn) {
    if (name === 'filler_mixer_cip') fillerMixerCipBtn.classList.add('qc-btn-primary');
    else fillerMixerCipBtn.classList.remove('qc-btn-primary');
  }
  if (qcReportBtn) {
    if (name === 'qc_report') qcReportBtn.classList.add('qc-btn-primary');
    else qcReportBtn.classList.remove('qc-btn-primary');
  }
  if (seamCheckBtn) {
    if (name === 'seam_check') seamCheckBtn.classList.add('qc-btn-primary');
    else seamCheckBtn.classList.remove('qc-btn-primary');
  }
  if (configBtn) {
    if (name === 'configure_mixing') configBtn.classList.add('qc-btn-primary');
    else configBtn.classList.remove('qc-btn-primary');
  }
  if (name === 'cover_page') {
    renderCoverPagePanel();
    updateCurrentBatchContextBar();
    return;
  }
  if (name === 'picking_sheet') {
    renderPickingSheetPanel();
    updateCurrentBatchContextBar();
    return;
  }
  if (name === 'mixing') {
    renderMixingPanel();
    loadSelectedMixing();
    updateCurrentBatchContextBar();
    return;
  }
  if (isCipSubmenu(name)) {
    renderTankCipPanel();
    loadSelectedTankCip();
    updateCurrentBatchContextBar();
    return;
  }
  if (isQcReportSubmenu(name)) {
    renderQcReportPanel();
    loadSelectedQcReport();
    updateCurrentBatchContextBar();
    return;
  }
  if (isSeamCheckSubmenu(name)) {
    renderSeamCheckPanel();
    loadSelectedSeamCheck();
    updateCurrentBatchContextBar();
    return;
  }
  if (name === 'configure_mixing') renderMixingConfigPanel();
  updateCurrentBatchContextBar();
}

function showMixingEmpty(message) {
  const emptyEl = document.getElementById('qc-mixing-empty');
  const coverPagePanelEl = document.getElementById('qc-cover-page-panel');
  const pickingPanelEl = document.getElementById('qc-picking-sheet-panel');
  const mixingPanelEl = document.getElementById('qc-mixing-panel');
  const tankPanelEl = document.getElementById('qc-tank-cip-panel');
  const qcReportPanelEl = document.getElementById('qc-report-panel');
  const seamPanelEl = document.getElementById('qc-seam-panel');
  const configPanelEl = document.getElementById('qc-mixing-config-panel');
  if (emptyEl) {
    emptyEl.textContent = message || 'Select a batch to open Picking Sheet.';
    emptyEl.classList.remove('qc-hidden');
  }
  if (coverPagePanelEl) coverPagePanelEl.classList.add('qc-hidden');
  if (pickingPanelEl) pickingPanelEl.classList.add('qc-hidden');
  if (mixingPanelEl) mixingPanelEl.classList.add('qc-hidden');
  if (tankPanelEl) tankPanelEl.classList.add('qc-hidden');
  if (qcReportPanelEl) qcReportPanelEl.classList.add('qc-hidden');
  if (seamPanelEl) seamPanelEl.classList.add('qc-hidden');
  if (configPanelEl) configPanelEl.classList.add('qc-hidden');
  revokeQcPickingBlobUrl();
}

async function loadTemplatePayload(forceReload = false) {
  if (!forceReload && state.templatePayload) return state.templatePayload;
  const payload = await qcGetTemplatePayload();
  state.templatePayload = normalizeTemplatePayload(payload);
  return state.templatePayload;
}

function syncTemplateProcedureFromForm() {
  const template = getCurrentConfigTemplate();
  if (!template) return;

  const titleNameEl = document.getElementById('qc-config-title-name');
  const procedureNameEl = document.getElementById('qc-config-procedure-name');
  const notesEl = document.getElementById('qc-config-notes');
  const stepsEl = document.getElementById('qc-config-steps');

  template.data_main = template.data_main || {};
  template.data_main.procedure = procedureNameEl ? String(procedureNameEl.value || '') : String(template.data_main.procedure || '');
  template.data_main.notes = notesEl ? splitLines(notesEl.value) : normalizeList(template.data_main.notes);
  template.data_main.steps = stepsEl ? linesToSteps(stepsEl.value) : normalizeStepRows(template.data_main.steps);
  state.configPendingTemplateType = titleNameEl
    ? String(titleNameEl.value || '').trim()
    : String(template.type || '').trim();

  const checkRows = [];
  document.querySelectorAll('#qc-config-checks-body tr[data-row-index]').forEach((rowEl) => {
    const rowIndex = Number(rowEl.getAttribute('data-row-index'));
    if (!Number.isFinite(rowIndex)) return;
    const testInput = rowEl.querySelector('[data-col="test"]');
    const limitsInput = rowEl.querySelector('[data-col="limits"]');
    const typeInput = rowEl.querySelector('[data-col="result_type"]');
    const dataEntryInput = rowEl.querySelector('[data-col="data_entry"]');
    const test = testInput ? String(testInput.value || '').trim() : '';
    const key = slugifyKey(test);
    if (!test && !key) return;
    checkRows.push({
      test: test || `Check ${checkRows.length + 1}`,
      limits: limitsInput ? String(limitsInput.value || '') : '',
      result: '',
      adjustments: '',
      key,
      result_type: typeInput && String(typeInput.value || '').trim().toLowerCase() === 'checkbox' ? 'checkbox' : 'text',
      data_entry: normalizeDataEntry(dataEntryInput ? dataEntryInput.value : undefined, key),
    });
  });
  template.mixing_checks = normalizeTemplateChecks(checkRows, template.quality_specs || {});
}

function renderConfigRecipePicker(recipeNames) {
  const tagsEl = document.getElementById('qc-config-recipe-tags');
  const searchEl = document.getElementById('qc-config-recipe-search');
  const optionsEl = document.getElementById('qc-config-recipe-options');
  if (!tagsEl || !searchEl || !optionsEl) return;

  const selectedNames = normalizeList(state.configRecipeNames).filter((name) => listIncludesByNormalizedKey(recipeNames, name));
  state.configRecipeNames = selectedNames;

  tagsEl.innerHTML = selectedNames
    .map((name) => `
      <span class="qc-multi-tag">
        ${escapeHtml(name)}
        <button type="button" class="qc-multi-remove" data-recipe="${escapeHtml(name)}" aria-label="Remove ${escapeHtml(name)}">&times;</button>
      </span>
    `)
    .join('');
  tagsEl.onclick = function(e) {
    const btn = e.target.closest('.qc-multi-remove');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    onConfigRecipeTagRemove({ currentTarget: btn });
  };

  const query = String(state.configRecipeSearch || '');
  const filteredOptions = filterConfigRecipeOptions(recipeNames, selectedNames, query);
  if (!recipeNames.length) {
    optionsEl.innerHTML = '<div class="qc-muted qc-multi-empty">No recipes found</div>';
  } else if (!filteredOptions.length) {
    optionsEl.innerHTML = '<div class="qc-muted qc-multi-empty">No matching recipes</div>';
  } else {
    optionsEl.innerHTML = filteredOptions
      .map((name) => `<button type="button" class="qc-multi-option" data-recipe="${escapeHtml(name)}">${escapeHtml(name)}</button>`)
      .join('');
  }
  optionsEl.querySelectorAll('.qc-multi-option').forEach((btn) => {
    btn.onmousedown = onConfigRecipeOptionMouseDown;
    btn.onclick = onConfigRecipeOptionSelect;
  });

  searchEl.value = query;
  searchEl.disabled = !recipeNames.length;
  searchEl.placeholder = recipeNames.length ? 'Search recipe name...' : 'No recipes found';
  searchEl.oninput = onConfigRecipeSearchInput;
  searchEl.onfocus = onConfigRecipeSearchFocus;
  searchEl.onblur = onConfigRecipeSearchBlur;
  searchEl.onkeydown = onConfigRecipeSearchKeyDown;

  const hasFocus = document.activeElement === searchEl;
  if (hasFocus || String(query).trim()) optionsEl.classList.remove('qc-hidden');
  else optionsEl.classList.add('qc-hidden');
}

function onConfigRecipeTagRemove(event) {
  const recipeName = String(event && event.currentTarget && event.currentTarget.getAttribute('data-recipe') || '').trim();
  if (!recipeName) return;
  const nextRecipeNames = toArray(state.configRecipeNames).filter(
    (name) => normalizeKeyLookup(name) !== normalizeKeyLookup(recipeName)
  );
  state.configRecipeSearch = '';
  onConfigRecipeChanged(nextRecipeNames);
}

function onConfigRecipeOptionSelect(event) {
  if (event && typeof event.preventDefault === 'function') event.preventDefault();
  const recipeName = String(event && event.currentTarget && event.currentTarget.getAttribute('data-recipe') || '').trim();
  if (!recipeName) return;
  const existingType = findMappedTypeForRecipe(recipeName);
  const currentTypeKey = normalizeKeyLookup(state.configTemplateType);
  if (existingType && normalizeKeyLookup(existingType) !== currentTypeKey) {
    showToast(`Recipe "${recipeName}" is already linked to "${existingType}". Remove it from that procedure first.`, true);
    return;
  }
  const nextRecipeNames = normalizeList([...toArray(state.configRecipeNames), recipeName]);
  state.configRecipeSearch = '';
  onConfigRecipeChanged(nextRecipeNames);
}

function onConfigRecipeOptionMouseDown(event) {
  if (!event) return;
  event.preventDefault();
  onConfigRecipeOptionSelect(event);
}

function onConfigRecipeSearchInput(event) {
  state.configRecipeSearch = String(event && event.target ? event.target.value || '' : '');
  renderConfigRecipePicker(getRecipeNamesForConfig());
}

function onConfigRecipeSearchFocus() {
  renderConfigRecipePicker(getRecipeNamesForConfig());
}

function onConfigRecipeSearchBlur() {
  window.setTimeout(() => {
    const optionsEl = document.getElementById('qc-config-recipe-options');
    const searchEl = document.getElementById('qc-config-recipe-search');
    if (!optionsEl || !searchEl) return;
    if (document.activeElement !== searchEl) optionsEl.classList.add('qc-hidden');
  }, 120);
}

function onConfigRecipeSearchKeyDown(event) {
  if (!event) return;
  if (event.key === 'Enter') {
    event.preventDefault();
    const firstOption = document.querySelector('#qc-config-recipe-options .qc-multi-option');
    if (firstOption) firstOption.click();
    return;
  }
  if (event.key === 'Backspace' && !String(event.target && event.target.value || '').trim() && state.configRecipeNames.length) {
    event.preventDefault();
    const nextRecipeNames = state.configRecipeNames.slice(0, -1);
    state.configRecipeSearch = '';
    onConfigRecipeChanged(nextRecipeNames);
    return;
  }
  if (event.key === 'Escape') {
    const optionsEl = document.getElementById('qc-config-recipe-options');
    if (optionsEl) optionsEl.classList.add('qc-hidden');
  }
}

function onConfigRecipeChanged(nextRecipeNames = null) {
  syncTemplateProcedureFromForm();
  const incomingNames = nextRecipeNames == null ? state.configRecipeNames : nextRecipeNames;
  state.configRecipeNames = normalizeList(incomingNames);
  const typeNames = getProcedureTypeNames();
  if (!typeNames.includes(state.configTemplateType)) {
    state.configTemplateType = typeNames[0] || '';
  }
  state.configRecipeSearch = '';
  state.configPendingTemplateType = state.configTemplateType;
  renderMixingConfigPanel();
}

function onConfigTemplateChanged(newType) {
  syncTemplateProcedureFromForm();
  const previousType = String(state.configTemplateType || '');
  const nextType = String(newType || '');
  const isActualChange = normalizeKeyLookup(nextType) !== normalizeKeyLookup(previousType);
  state.configTemplateType = nextType;
  if (isActualChange) {
    state.configRecipeNames = getRecipesMappedToType(state.configTemplateType);
  }
  state.configRecipeSearch = '';
  state.configPendingTemplateType = state.configTemplateType;
  renderMixingConfigPanel();
}

function renderProcedureDropdown(typeNames) {
  const searchEl = document.getElementById('qc-config-procedure-search');
  const optionsEl = document.getElementById('qc-config-procedure-options');
  const hiddenSelect = document.getElementById('qc-config-procedure-select');
  if (!searchEl || !optionsEl) return;

  if (hiddenSelect) hiddenSelect.value = state.configTemplateType;

  const query = String(state._procSearch || '').toLowerCase();
  searchEl.value = state._procSearchFocused ? (state._procSearch || '') : (state.configTemplateType || '');

  if (!typeNames.length) {
    optionsEl.innerHTML = '<div class="qc-muted" style="padding:8px 12px;">No procedures found</div>';
    searchEl.disabled = true;
    return;
  }
  searchEl.disabled = false;

  const filtered = query
    ? typeNames.filter((n) => n.toLowerCase().includes(query))
    : typeNames;

  optionsEl.innerHTML = filtered.length
    ? filtered.map((name) => {
        const active = normalizeKeyLookup(name) === normalizeKeyLookup(state.configTemplateType) ? ' qc-proc-active' : '';
        return `<button type="button" class="qc-proc-option${active}" data-type="${escapeHtml(name)}">${escapeHtml(name)}</button>`;
      }).join('')
    : '<div class="qc-muted" style="padding:8px 12px;">No matching procedures</div>';

  optionsEl.querySelectorAll('.qc-proc-option').forEach((btn) => {
    btn.onmousedown = (e) => e.preventDefault();
    btn.onclick = () => {
      state._procSearch = '';
      state._procSearchFocused = false;
      optionsEl.classList.add('qc-hidden');
      onConfigTemplateChanged(btn.getAttribute('data-type'));
    };
  });

  searchEl.oninput = () => {
    state._procSearch = searchEl.value;
    state._procSearchFocused = true;
    optionsEl.classList.remove('qc-hidden');
    renderProcedureDropdown(getProcedureTypeNames());
  };
  searchEl.onfocus = () => {
    state._procSearchFocused = true;
    state._procSearch = '';
    searchEl.value = '';
    optionsEl.classList.remove('qc-hidden');
    renderProcedureDropdown(getProcedureTypeNames());
  };
  searchEl.onblur = () => {
    setTimeout(() => {
      state._procSearchFocused = false;
      state._procSearch = '';
      optionsEl.classList.add('qc-hidden');
      if (searchEl) searchEl.value = state.configTemplateType || '';
    }, 150);
  };

  if (state._procSearchFocused) optionsEl.classList.remove('qc-hidden');
  else optionsEl.classList.add('qc-hidden');
}

function onConfigTitleNameInput(event) {
  const value = event && event.target ? String(event.target.value || '') : '';
  state.configPendingTemplateType = value;
}

function onConfigCheckFieldInput(event) {
  const el = event.target;
  const rowIndex = Number(el.getAttribute('data-row-index'));
  const col = el.getAttribute('data-col');
  if (!Number.isFinite(rowIndex) || rowIndex < 0 || !col) return;

  const template = getCurrentConfigTemplate();
  if (!template || !Array.isArray(template.mixing_checks) || !template.mixing_checks[rowIndex]) return;
  const row = template.mixing_checks[rowIndex];
  if (col === 'result_type') {
    row[col] = String(el.value || '').trim().toLowerCase() === 'checkbox' ? 'checkbox' : 'text';
    return;
  }
  if (col === 'data_entry') {
    row[col] = normalizeDataEntry(el.value, row.key || row.test || '');
    return;
  }
  row[col] = String(el.value || '');
  if (col === 'test') {
    row.key = slugifyKey(row[col]);
  }
}

function onConfigCheckDelete(event) {
  const el = event.target;
  const rowIndex = Number(el.getAttribute('data-row-index'));
  if (!Number.isFinite(rowIndex) || rowIndex < 0) return;
  const template = getCurrentConfigTemplate();
  if (!template || !Array.isArray(template.mixing_checks)) return;
  template.mixing_checks.splice(rowIndex, 1);
  template.mixing_checks = normalizeTemplateChecks(template.mixing_checks, template.quality_specs || {});
  renderMixingConfigPanel();
}

function onAddMixingConfigCheckRow() {
  const template = getCurrentConfigTemplate();
  if (!template) return;
  syncTemplateProcedureFromForm();
  template.mixing_checks = toArray(template.mixing_checks);
  template.mixing_checks.push({
    test: '',
    limits: '',
    result: '',
    adjustments: '',
    key: '',
    result_type: 'text',
    data_entry: true,
  });
  renderMixingConfigPanel();
}

function renderMixingConfigChecks(template) {
  const checksHost = document.getElementById('qc-config-checks-body');
  if (!checksHost) return;
  const checks = normalizeTemplateChecks(template.mixing_checks, template.quality_specs || {});
  template.mixing_checks = checks;

  checksHost.innerHTML = checks
    .map((row, idx) => `
      <tr data-row-index="${idx}">
        <td><input class="qc-input" data-row-index="${idx}" data-col="test" value="${escapeHtml(row.test)}" /></td>
        <td><input class="qc-input" data-row-index="${idx}" data-col="limits" value="${escapeHtml(row.limits)}" /></td>
        <td>
          <select class="qc-input qc-check-type" data-row-index="${idx}" data-col="result_type">
            <option value="text" ${String(row.result_type || '').toLowerCase() === 'text' ? 'selected' : ''}>text</option>
            <option value="checkbox" ${String(row.result_type || '').toLowerCase() === 'checkbox' ? 'selected' : ''}>checkbox</option>
          </select>
        </td>
        <td>
          <select class="qc-input qc-check-type" data-row-index="${idx}" data-col="data_entry">
            <option value="true" ${normalizeDataEntry(row.data_entry, row.key) ? 'selected' : ''}>editable</option>
            <option value="false" ${normalizeDataEntry(row.data_entry, row.key) ? '' : 'selected'}>read-only</option>
          </select>
        </td>
        <td><button class="qc-btn qc-btn-danger qc-check-delete" data-row-index="${idx}">Delete</button></td>
      </tr>
    `)
    .join('');

  checksHost.querySelectorAll('input[data-col], select[data-col]').forEach((input) => {
    input.addEventListener('input', onConfigCheckFieldInput);
    input.addEventListener('change', onConfigCheckFieldInput);
  });
  checksHost.querySelectorAll('.qc-check-delete').forEach((btn) => {
    btn.addEventListener('click', onConfigCheckDelete);
  });
}

function setMixingConfigActionState(hasTemplate) {
  const saveBtn = document.getElementById('qc-mixing-config-save-btn');
  const copyBtn = document.getElementById('qc-mixing-config-copy-btn');
  const removeBtn = document.getElementById('qc-mixing-config-remove-btn');
  if (saveBtn) saveBtn.disabled = !hasTemplate;
  if (copyBtn) copyBtn.disabled = !hasTemplate;
  if (removeBtn) removeBtn.disabled = !hasTemplate;
}

function renderMixingConfigPanel() {
  if (state.activeSubmenu !== 'configure_mixing') return;

  const emptyEl = document.getElementById('qc-mixing-empty');
  const mixingPanelEl = document.getElementById('qc-mixing-panel');
  const tankPanelEl = document.getElementById('qc-tank-cip-panel');
  const qcReportPanelEl = document.getElementById('qc-report-panel');
  const seamPanelEl = document.getElementById('qc-seam-panel');
  const configPanelEl = document.getElementById('qc-mixing-config-panel');
  if (emptyEl) emptyEl.classList.add('qc-hidden');
  if (mixingPanelEl) mixingPanelEl.classList.add('qc-hidden');
  if (tankPanelEl) tankPanelEl.classList.add('qc-hidden');
  if (qcReportPanelEl) qcReportPanelEl.classList.add('qc-hidden');
  if (seamPanelEl) seamPanelEl.classList.add('qc-hidden');
  if (configPanelEl) configPanelEl.classList.remove('qc-hidden');
  hideQcPickingPanel();

  const recipeNames = getRecipeNamesForConfig();
  const payload = state.templatePayload;
  if (!payload || !Array.isArray(payload.types) || !payload.types.length) {
    const procedureSelect = document.getElementById('qc-config-procedure-select');
    const titleNameEl = document.getElementById('qc-config-title-name');
    const procedureNameEl = document.getElementById('qc-config-procedure-name');
    const notesEl = document.getElementById('qc-config-notes');
    const stepsEl = document.getElementById('qc-config-steps');
    const checksHost = document.getElementById('qc-config-checks-body');

    state.configTemplateType = '';
    state.configPendingTemplateType = '';

    renderConfigRecipePicker(recipeNames);
    if (procedureSelect) {
      procedureSelect.innerHTML = '<option value="" selected disabled>No title names found</option>';
      procedureSelect.disabled = true;
      procedureSelect.onchange = null;
    }
    if (titleNameEl) titleNameEl.value = '';
    if (procedureNameEl) procedureNameEl.value = '';
    if (notesEl) notesEl.value = '';
    if (stepsEl) stepsEl.value = '';
    if (checksHost) checksHost.innerHTML = '';
    setMixingConfigActionState(false);
    setStatus('No mixing procedures found. Add a new configuration.', true);
    return;
  }
  setMixingConfigActionState(true);

  const typeNames = getProcedureTypeNames();
  if (!state.configTemplateType || !typeNames.includes(state.configTemplateType)) {
    state.configTemplateType = typeNames[0] || '';
    state.configRecipeNames = [];
  }
  if (!state.configRecipeNames.length) {
    state.configRecipeNames = getRecipesMappedToType(state.configTemplateType)
      .filter((name) => listIncludesByNormalizedKey(recipeNames, name));
  }
  if (!state.configPendingTemplateType) state.configPendingTemplateType = state.configTemplateType;

  const procedureSelect = document.getElementById('qc-config-procedure-select');
  const titleNameEl = document.getElementById('qc-config-title-name');
  const procedureNameEl = document.getElementById('qc-config-procedure-name');
  const notesEl = document.getElementById('qc-config-notes');
  const stepsEl = document.getElementById('qc-config-steps');
  renderConfigRecipePicker(recipeNames);

  if (!typeNames.includes(state.configTemplateType)) state.configTemplateType = typeNames[0] || '';
  renderProcedureDropdown(typeNames);

  const template = getCurrentConfigTemplate();
  if (!template) return;

  if (titleNameEl) {
    titleNameEl.value = String(state.configPendingTemplateType || template.type || '');
    titleNameEl.oninput = onConfigTitleNameInput;
  }
  if (procedureNameEl) {
    procedureNameEl.value = String((template.data_main && template.data_main.procedure) || '');
    procedureNameEl.oninput = syncTemplateProcedureFromForm;
  }
  if (notesEl) {
    notesEl.value = normalizeList(template.data_main && template.data_main.notes).join('\n');
    notesEl.oninput = syncTemplateProcedureFromForm;
  }
  if (stepsEl) {
    stepsEl.value = stepsToLines(template.data_main && template.data_main.steps);
    stepsEl.oninput = syncTemplateProcedureFromForm;
  }

  renderMixingConfigChecks(template);
}

async function onOpenMixingConfiguration() {
  try {
    setStatus('Loading mixing procedure configuration...');
    await Promise.all([loadTemplatePayload(), refreshRecipeSummary()]);
    state.configRecipeNames = [];
    state.configTemplateType = '';
    state.configPendingTemplateType = '';
    setActiveSubmenu('configure_mixing');
    setStatus('Mixing procedure configuration loaded.');
    showToast('Mixing procedure configuration loaded.');
  } catch (err) {
    setStatus(err.message || 'Failed to load mixing procedure configuration.', true);
    showToast(err.message || 'Failed to load mixing procedure configuration.', true);
  }
}

async function onAddMixingConfiguration() {
  try {
    await loadTemplatePayload();
    syncTemplateProcedureFromForm();

    state.templatePayload.types = toArray(state.templatePayload.types);
    const currentTemplate = getCurrentConfigTemplate();
    const sheetName = String((currentTemplate && currentTemplate.sheet) || 'CANS').trim() || 'CANS';
    const newType = nextUniqueTemplateTypeName('New Mixing Procedure');
    const newTemplate = buildBlankMixingTemplate(newType, sheetName);

    state.templatePayload.types.push(newTemplate);
    state.configTemplateType = newType;
    state.configPendingTemplateType = newType;
    state.configRecipeNames = [];

    await saveTemplatePayloadAndRefresh('New mixing configuration created.');
  } catch (err) {
    setStatus(err.message || 'Failed to add mixing configuration.', true);
    showToast(err.message || 'Failed to add mixing configuration.', true);
  }
}

async function onCopyMixingConfiguration() {
  try {
    await loadTemplatePayload();
    syncTemplateProcedureFromForm();

    const template = getCurrentConfigTemplate();
    if (!template) {
      throw new Error('Select a configuration to copy.');
    }

    const sourceType = String(template.type || '').trim() || 'Mixing Procedure';
    const suggestedName = nextUniqueTemplateTypeName(`${sourceType} Copy`, template);
    const typedName = window.prompt('Enter new name for copied configuration:', suggestedName);
    if (typedName === null) return;

    const newType = String(typedName || '').trim();
    if (!newType) {
      throw new Error('Configuration name is required.');
    }
    const duplicate = findTemplateByType(newType);
    if (duplicate) {
      throw new Error(`Configuration '${newType}' already exists.`);
    }

    const copied = normalizeTemplateTypeItem(JSON.parse(JSON.stringify(template)));
    const oldType = String(copied.type || '').trim();
    copied.type = newType;
    copied.data_main = copied.data_main || {};
    const heading = String(copied.data_main.heading || '').trim();
    if (!heading) {
      copied.data_main.heading = `MASTER BATCH PRODUCTION RECORD : ${newType}`;
    } else if (oldType && heading.includes(oldType)) {
      copied.data_main.heading = heading.replace(oldType, newType);
    }

    state.templatePayload.types = toArray(state.templatePayload.types);
    state.templatePayload.types.push(copied);
    state.configTemplateType = newType;
    state.configPendingTemplateType = newType;
    state.configRecipeNames = [];

    await saveTemplatePayloadAndRefresh('Mixing configuration copied.');
  } catch (err) {
    setStatus(err.message || 'Failed to copy mixing configuration.', true);
    showToast(err.message || 'Failed to copy mixing configuration.', true);
  }
}

async function onRemoveMixingConfiguration() {
  try {
    await loadTemplatePayload();
    syncTemplateProcedureFromForm();

    const template = getCurrentConfigTemplate();
    if (!template) {
      throw new Error('Select a configuration to remove.');
    }

    const allTypes = toArray(state.templatePayload.types);

    const selectedType = String(template.type || '').trim();
    const confirmed = window.confirm(`Remove configuration '${selectedType}'? This cannot be undone.`);
    if (!confirmed) return;

    const selectedTypeKey = normalizeKeyLookup(selectedType);
    state.templatePayload.types = allTypes.filter(
      (item) => normalizeKeyLookup(item && item.type) !== selectedTypeKey
    );

    const mapping = state.templatePayload.recipe_title_mapping && typeof state.templatePayload.recipe_title_mapping === 'object'
      ? state.templatePayload.recipe_title_mapping
      : {};
    const nextMapping = {};
    Object.entries(mapping).forEach(([recipeName, mappedType]) => {
      if (normalizeKeyLookup(mappedType) === selectedTypeKey) return;
      nextMapping[recipeName] = mappedType;
    });
    state.templatePayload.recipe_title_mapping = nextMapping;

    const typeNames = getProcedureTypeNames();
    state.configTemplateType = typeNames[0] || '';
    state.configPendingTemplateType = state.configTemplateType;
    state.configRecipeNames = getRecipesMappedToType(state.configTemplateType);

    await saveTemplatePayloadAndRefresh('Mixing configuration removed.');
  } catch (err) {
    setStatus(err.message || 'Failed to remove mixing configuration.', true);
    showToast(err.message || 'Failed to remove mixing configuration.', true);
  }
}

async function onSaveMixingConfiguration() {
  try {
    await loadTemplatePayload();
    syncTemplateProcedureFromForm();
    applyTemplateTypeRename(state.configPendingTemplateType || state.configTemplateType);

    const selectedRecipes = normalizeList(state.configRecipeNames);
    const selectedType = String(state.configTemplateType || '').trim();
    if (!selectedType) {
      throw new Error('Select a Mixing Procedure Title.');
    }
    state.templatePayload.recipe_title_mapping = state.templatePayload.recipe_title_mapping || {};

    const mapping = state.templatePayload.recipe_title_mapping;
    const selectedTypeKey = normalizeKeyLookup(selectedType);
    const selectedByNorm = new Map();
    selectedRecipes.forEach((recipeName) => {
      const key = normalizeKeyLookup(recipeName);
      if (!key || selectedByNorm.has(key)) return;
      selectedByNorm.set(key, recipeName);
    });
    const selectedNorm = new Set(selectedByNorm.keys());

    const nextMapping = {};
    Object.entries(mapping).forEach(([recipeName, mappedType]) => {
      const recipe = String(recipeName || '').trim();
      const mapped = String(mappedType || '').trim();
      const recipeKey = normalizeKeyLookup(recipe);
      const mappedKey = normalizeKeyLookup(mapped);
      if (!recipe || !mapped || !recipeKey) return;

      if (selectedNorm.has(recipeKey)) return;
      if (mappedKey === selectedTypeKey) return;
      nextMapping[recipe] = mapped;
    });

    selectedByNorm.forEach((recipeName) => {
      nextMapping[recipeName] = selectedType;
    });
    state.templatePayload.recipe_title_mapping = nextMapping;
    state.configRecipeNames = normalizeList(Array.from(selectedByNorm.values()));

    await saveTemplatePayloadAndRefresh('Mixing procedure configuration saved.');
  } catch (err) {
    setStatus(err.message || 'Failed to save mixing procedure configuration.', true);
    showToast(err.message || 'Failed to save mixing procedure configuration.', true);
  }
}

function ensureMixingSectionOrder() {
  const panelEl = document.getElementById('qc-mixing-panel');
  if (!panelEl) return;
  const convEl = panelEl.querySelector('.qc-conv-section');
  const tableEl = panelEl.querySelector('.qc-table-wrap');
  if (!convEl || !tableEl || !tableEl.parentNode) return;
  if (tableEl.nextElementSibling === convEl) return;
  tableEl.parentNode.insertBefore(convEl, tableEl.nextSibling);
}

function renderMixingPanel() {
  if (state.activeSubmenu !== 'mixing') return;

  const batchMeta = getSelectedBatchMeta();
  if (!state.selectedBatchNo || !batchMeta || !state.mixingData) {
    showMixingEmpty('Select a batch to open Mixing Instructions.');
    return;
  }

  const emptyEl = document.getElementById('qc-mixing-empty');
  const panelEl = document.getElementById('qc-mixing-panel');
  const tankPanelEl = document.getElementById('qc-tank-cip-panel');
  const qcReportPanelEl = document.getElementById('qc-report-panel');
  const seamPanelEl = document.getElementById('qc-seam-panel');
  const configPanelEl = document.getElementById('qc-mixing-config-panel');
  if (emptyEl) emptyEl.classList.add('qc-hidden');
  if (panelEl) panelEl.classList.remove('qc-hidden');
  if (tankPanelEl) tankPanelEl.classList.add('qc-hidden');
  if (qcReportPanelEl) qcReportPanelEl.classList.add('qc-hidden');
  if (seamPanelEl) seamPanelEl.classList.add('qc-hidden');
  if (configPanelEl) configPanelEl.classList.add('qc-hidden');
  hideQcPickingPanel();
  ensureMixingSectionOrder();

  const data = state.mixingData;
  const header = data.header || {};

  const dateEl = document.getElementById('qc-mix-date');
  const batchNoEl = document.getElementById('qc-mix-batch-no');
  const jobNoEl = document.getElementById('qc-mix-job-no');
  const tankNoEl = document.getElementById('qc-mix-tank-no');
  const productTopEl = document.getElementById('qc-mix-product-name-top');
  const productEl = document.getElementById('qc-mix-product-name');
  const syrupQtyEl = document.getElementById('qc-mix-syrup-qty');
  const syrupActualEl = document.getElementById('qc-mix-syrup-actual');
  const packApprovedYesEl = document.getElementById('qc-pack-approved-yes');
  const packApprovedNoEl = document.getElementById('qc-pack-approved-no');
  const packFinalVolumeEl = document.getElementById('qc-pack-final-volume');
  const packComparedBatchEl = document.getElementById('qc-pack-compared-batch');
  const convBrixEl = document.getElementById('qc-conv-syrup-brix');
  const convGLEl = document.getElementById('qc-conv-gl');
  const convKgSugarEl = document.getElementById('qc-conv-kg-sugar');
  const convKgLEl = document.getElementById('qc-conv-kg-l');
  const convTotalEl = document.getElementById('qc-conv-total');

  const resolvedDateValue = toDateInputValue(header.date) || toDateInputValue(batchMeta.date) || todayDateInputValue();
  if (dateEl) dateEl.value = resolvedDateValue;
  if (state.mixingData && state.mixingData.header) state.mixingData.header.date = resolvedDateValue;
  if (batchNoEl) batchNoEl.value = String(header.batch_no || batchMeta.batch_no || '');
  if (jobNoEl) jobNoEl.value = String(header.job_no || '');
  if (tankNoEl) tankNoEl.value = String(header.tank_no || '');
  const exactRecipeName = String((batchMeta && batchMeta.recipe_name) || header.product_name || batchMeta.product_name || '');
  if (productTopEl) productTopEl.value = exactRecipeName;
  if (productEl) productEl.textContent = exactRecipeName;
  if (syrupQtyEl) syrupQtyEl.value = String((data.syrup && data.syrup.quantity) || '');
  if (syrupActualEl) syrupActualEl.value = String((data.syrup && data.syrup.actual) || '');

  const updateHeaderAndQueueAutoSave = () => {
    if (!state.mixingData) return;
    state.mixingData.header = state.mixingData.header || {};
    state.mixingData.header.date = dateEl ? String(dateEl.value || '') : String(state.mixingData.header.date || '');
    state.mixingData.header.tank_no = tankNoEl ? String(tankNoEl.value || '') : String(state.mixingData.header.tank_no || '');
    queueMixingAutoSave();
  };

  if (dateEl) {
    dateEl.oninput = updateHeaderAndQueueAutoSave;
    dateEl.onchange = updateHeaderAndQueueAutoSave;
  }
  if (tankNoEl) {
    tankNoEl.oninput = updateHeaderAndQueueAutoSave;
    tankNoEl.onchange = updateHeaderAndQueueAutoSave;
  }

  const packing = data.packing_decision || {};
  const approved = String(packing.approved || '').toLowerCase();
  if (packApprovedYesEl) packApprovedYesEl.checked = approved === 'yes';
  if (packApprovedNoEl) packApprovedNoEl.checked = approved === 'no';
  if (packComparedBatchEl) packComparedBatchEl.value = String(packing.compared_batch_no || '');

  const syncFinalVolumeFromActual = () => {
    const topValue = syrupActualEl ? String(syrupActualEl.value || '') : '';
    const finalVolumeValue = topValue || String((packing && packing.actual_final_volume) || '');
    if (packFinalVolumeEl) packFinalVolumeEl.value = finalVolumeValue;
    if (!state.mixingData) return;
    state.mixingData.syrup = state.mixingData.syrup || {};
    state.mixingData.syrup.actual = topValue;
    state.mixingData.packing_decision = state.mixingData.packing_decision || {};
    state.mixingData.packing_decision.actual_final_volume = finalVolumeValue;
  };
  syncFinalVolumeFromActual();

  if (syrupActualEl) {
    syrupActualEl.oninput = () => {
      syncFinalVolumeFromActual();
      queueMixingAutoSave();
    };
    syrupActualEl.onchange = () => {
      syncFinalVolumeFromActual();
      queueMixingAutoSave();
    };
  }

  const setApproved = (value) => {
    const normalized = value === 'yes' || value === 'no' ? value : '';
    if (packApprovedYesEl) packApprovedYesEl.checked = normalized === 'yes';
    if (packApprovedNoEl) packApprovedNoEl.checked = normalized === 'no';
    if (!state.mixingData) return;
    state.mixingData.packing_decision = state.mixingData.packing_decision || {};
    state.mixingData.packing_decision.approved = normalized;
  };

  if (packApprovedYesEl) {
    packApprovedYesEl.onchange = () => {
      if (packApprovedYesEl.checked) setApproved('yes');
      else setApproved('');
      queueMixingAutoSave();
    };
  }
  if (packApprovedNoEl) {
    packApprovedNoEl.onchange = () => {
      if (packApprovedNoEl.checked) setApproved('no');
      else setApproved('');
      queueMixingAutoSave();
    };
  }

  if (packComparedBatchEl) {
    packComparedBatchEl.oninput = () => {
      if (!state.mixingData) return;
      state.mixingData.packing_decision = state.mixingData.packing_decision || {};
      state.mixingData.packing_decision.compared_batch_no = String(packComparedBatchEl.value || '');
      queueMixingAutoSave();
    };
  }

  const conv = data.simple_syrup_conversion || {};
  const convSectionEl = panelEl.querySelector('.qc-conv-section');
  if (convSectionEl) {
    if (data.has_sugar === false) {
      convSectionEl.classList.add('qc-hidden');
    } else {
      convSectionEl.classList.remove('qc-hidden');
    }
  }
  if (convBrixEl) convBrixEl.value = String(conv.syrup_brix || '');
  if (convGLEl) convGLEl.value = String(conv.g_per_l || '');
  if (convKgSugarEl) convKgSugarEl.value = String(conv.kg_sugar || '');
  if (convKgLEl) convKgLEl.value = String(conv.kg_per_l || '');
  if (convTotalEl) convTotalEl.value = String(conv.value || '');

  const recalcSimpleSyrup = () => {
    const gPerL = convGLEl ? toNumber(convGLEl.value) : 0;
    const kgSugar = convKgSugarEl ? toNumber(convKgSugarEl.value) : 0;
    const kgPerL = gPerL > 0 ? gPerL / 1000 : 0;
    const total = kgPerL > 0 && kgSugar > 0 ? (kgSugar / kgPerL) : 0;

    const kgPerLText = formatAuto(kgPerL, 6);
    const totalText = formatAuto(total, 3);

    if (convKgLEl) convKgLEl.value = kgPerLText;
    if (convTotalEl) convTotalEl.value = totalText;

    if (!state.mixingData) return;
    state.mixingData.simple_syrup_conversion = state.mixingData.simple_syrup_conversion || {};
    state.mixingData.simple_syrup_conversion.syrup_brix = convBrixEl ? String(convBrixEl.value || '') : '';
    state.mixingData.simple_syrup_conversion.g_per_l = convGLEl ? String(convGLEl.value || '') : '';
    state.mixingData.simple_syrup_conversion.kg_sugar = convKgSugarEl ? String(convKgSugarEl.value || '') : '';
    state.mixingData.simple_syrup_conversion.kg_per_l = kgPerLText;
    state.mixingData.simple_syrup_conversion.value = totalText;
  };

  if (convBrixEl) {
    convBrixEl.oninput = () => {
      recalcSimpleSyrup();
      queueMixingAutoSave();
    };
    convBrixEl.onchange = () => {
      recalcSimpleSyrup();
      queueMixingAutoSave();
    };
  }
  if (convGLEl) {
    convGLEl.oninput = () => {
      recalcSimpleSyrup();
      queueMixingAutoSave();
    };
    convGLEl.onchange = () => {
      recalcSimpleSyrup();
      queueMixingAutoSave();
    };
  }
  if (convKgSugarEl) {
    convKgSugarEl.oninput = () => {
      recalcSimpleSyrup();
      queueMixingAutoSave();
    };
    convKgSugarEl.onchange = () => {
      recalcSimpleSyrup();
      queueMixingAutoSave();
    };
  }
  recalcSimpleSyrup();

  const notesHost = document.getElementById('qc-mix-notes');
  if (notesHost) {
    if (!data.notes || !data.notes.length) {
      notesHost.innerHTML = '<li class="qc-muted">No notes from template.</li>';
    } else {
      notesHost.innerHTML = data.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('');
    }
  }

  const stepsHost = document.getElementById('qc-mix-steps');
  if (stepsHost) {
    if (!data.steps || !data.steps.length) {
      stepsHost.innerHTML = '<li class="qc-muted">No steps from template.</li>';
    } else {
      stepsHost.innerHTML = data.steps
        .map((step) => `<li><strong>${escapeHtml(step.step_no)}</strong> ${escapeHtml(step.instruction)}</li>`)
        .join('');
    }
  }

  const checksHost = document.getElementById('qc-mix-checks-body');
  if (checksHost) {
    checksHost.innerHTML = (data.checks || [])
      .map((row, idx) => {
        const key = String(row.key || '').trim().toLowerCase();
        const isReadOnly = !normalizeDataEntry(row.data_entry, key);
        const resultType = String(row.result_type || '').toLowerCase() === 'checkbox' ? 'checkbox' : 'text';
        const resultChecked = ['1', 'true', 'yes', 'y', 'ok', 'pass', 'checked'].includes(
          String(row.result || '').trim().toLowerCase()
        );
        let resultCell = '';
        let adjustmentCell = '';

        if (isReadOnly) {
          resultCell = `<span class="qc-muted">${escapeHtml(row.result || '')}</span>`;
          adjustmentCell = `<span class="qc-muted">${escapeHtml(row.adjustments || '')}</span>`;
        } else {
          resultCell = resultType === 'checkbox'
            ? `<label class="qc-checkbox-wrap"><input type="checkbox" class="qc-check-input" data-row-index="${idx}" data-col="result" ${resultChecked ? 'checked' : ''} /></label>`
            : `<input class="qc-input qc-check-input" data-row-index="${idx}" data-col="result" value="${escapeHtml(row.result)}" />`;
          adjustmentCell = `<input class="qc-input qc-check-input" data-row-index="${idx}" data-col="adjustments" value="${escapeHtml(row.adjustments)}" />`;
        }

        return `
          <tr>
            <td>${escapeHtml(row.test)}</td>
            <td>${escapeHtml(row.limits)}</td>
            <td>${resultCell}</td>
            <td>${adjustmentCell}</td>
          </tr>
        `;
      })
      .join('');

    checksHost.querySelectorAll('.qc-check-input').forEach((input) => {
      const handler = (event) => {
        const el = event.target;
        const rowIndex = Number(el.getAttribute('data-row-index'));
        const col = el.getAttribute('data-col');
        if (!Number.isFinite(rowIndex) || rowIndex < 0 || !col) return;
        if (!state.mixingData || !Array.isArray(state.mixingData.checks) || !state.mixingData.checks[rowIndex]) return;
        state.mixingData.checks[rowIndex][col] = el.type === 'checkbox' ? (el.checked ? '1' : '') : el.value;
        queueMixingAutoSave();
      };
      input.addEventListener('input', handler);
      input.addEventListener('change', handler);
    });
  }
}

function renderTankCipPanel() {
  if (!isCipSubmenu()) return;
  const cipSection = activeCipSection();
  const cipData = getCipData(cipSection);
  const cipLabel = currentCipLabel();
  const isFillerMixerMode = isFillerMixerCipSubmenu();

  const batchMeta = getSelectedBatchMeta();
  if (!state.selectedBatchNo || !batchMeta || !cipData) {
    showMixingEmpty(`Select a batch to open ${cipLabel}.`);
    return;
  }

  const emptyEl = document.getElementById('qc-mixing-empty');
  const mixingPanelEl = document.getElementById('qc-mixing-panel');
  const tankPanelEl = document.getElementById('qc-tank-cip-panel');
  const qcReportPanelEl = document.getElementById('qc-report-panel');
  const seamPanelEl = document.getElementById('qc-seam-panel');
  const configPanelEl = document.getElementById('qc-mixing-config-panel');
  const cipEmptyEl = document.getElementById('qc-tank-cip-empty');
  const blocksHost = document.getElementById('qc-tank-cip-blocks');
  const panelTitleEl = document.getElementById('qc-cip-panel-title');

  if (emptyEl) emptyEl.classList.add('qc-hidden');
  if (mixingPanelEl) mixingPanelEl.classList.add('qc-hidden');
  if (tankPanelEl) tankPanelEl.classList.remove('qc-hidden');
  if (qcReportPanelEl) qcReportPanelEl.classList.add('qc-hidden');
  if (seamPanelEl) seamPanelEl.classList.add('qc-hidden');
  if (configPanelEl) configPanelEl.classList.add('qc-hidden');
  hideQcPickingPanel();
  if (panelTitleEl) panelTitleEl.textContent = cipLabel;
  if (!blocksHost) return;

  let data = normalizeTankCipData(cipData, batchMeta);
  if (cipSection === 'filler_mixer_cip') {
    const propagated = applyPrimaryLineToFollowerBlocks(Array.isArray(data.blocks) ? data.blocks : []);
    if (propagated.changed) {
      data = normalizeTankCipData({ blocks: propagated.blocks }, batchMeta);
    }
  }
  setCipData(cipSection, data);
  const blocks = Array.isArray(data.blocks) ? data.blocks : [];

  const pageCountEl = document.getElementById('qc-tank-cip-page-count');
  if (pageCountEl) {
    pageCountEl.textContent = `${blocks.length} ${blocks.length === 1 ? 'page' : 'pages'}`;
  }

  if (!blocks.length) {
    blocksHost.innerHTML = '';
    if (cipEmptyEl) {
      cipEmptyEl.textContent = `Add one or more ${cipLabel} procedures to begin.`;
      cipEmptyEl.classList.remove('qc-hidden');
    }
    return;
  }
  if (cipEmptyEl) cipEmptyEl.classList.add('qc-hidden');

  blocksHost.innerHTML = blocks
    .map((block, blockIndex) => {
      const typeCfg = TANK_CIP_TYPE_CONFIG[block.cip_type] || TANK_CIP_TYPE_CONFIG['3_step'];
      const solutionRowCount = Number.isFinite(Number(block.solution_row_count))
        ? Math.max(1, Math.min(10, Number(block.solution_row_count)))
        : (Number.isFinite(Number(typeCfg.solution_row_count))
          ? Math.max(1, Math.min(10, Number(typeCfg.solution_row_count)))
          : 5);
      const solutionRows = Array.isArray(block.solution_rows)
        ? block.solution_rows
        : defaultTankCipSolutionRows(solutionRowCount);
      const orderSequenceText = buildTankCipCleaningSequence(
        solutionRows,
        String(block.cleaning_sequence || TANK_CIP_CLEANING_SEQUENCE)
      );
      const swabItems = normalizeTankCipSwabItems(
        Array.isArray(block.swab_items) ? block.swab_items : [],
        block.swab_rows,
      );
      block.swab_items = swabItems;
      const roPhRows = Array.isArray(block.ro_ph_rows) ? block.ro_ph_rows : defaultTankCipRoPhRows();
      const observations = Array.isArray(block.observations) ? block.observations : defaultTankCipObservationRows();
      const oxoniaValue = String(block.oxonia_strip_result || '');
      const rinserValue = String(block.rinser_filter_change || '');
      const rinserFilterTypeValue = normalizeRinserFilterType(block.rinser_filter_type);
      const lineValue = normalizeTankCipLine(block.line);
      const isRinser = !!block.is_rinser;
      const lineDisplay = (isRinser && lineValue === 'CAN') ? 'CAN Line Rinser' : lineValue;
      const topLineOrTankFieldHtml = isFillerMixerMode
        ? `
            <label class="qc-field">
              <span>Line</span>
              <input
                type="text"
                class="qc-input"
                value="${escapeHtml(lineDisplay)}"
                data-cip-field="line_display"
                data-block-index="${blockIndex}"
                readonly
              />
              <input type="hidden" value="${escapeHtml(lineValue)}" data-cip-field="line" data-block-index="${blockIndex}" />
            </label>
            <label class="qc-field qc-cip-rinser-toggle">
              <span>Rinser</span>
              <input
                type="checkbox"
                data-cip-field="is_rinser"
                data-block-index="${blockIndex}"
                data-input-type="checkbox"
                ${isRinser ? 'checked' : ''}
                ${lineValue === 'CAN' ? '' : 'disabled'}
              />
            </label>
          `
        : `
            <label class="qc-field">
              <span>Tank No.</span>
              <input type="text" class="qc-input" value="${escapeHtml(block.tank_no)}" data-cip-field="tank_no" data-block-index="${blockIndex}" />
            </label>
          `;

      const fillerSignNames = normalizeFillerSignNames(block.filler_sign_names);
      const tankMixingSignNames = normalizeTankMixingSignNames(block.tank_mixing_sign_names);

      const solutionRowsHtml = solutionRows
        .map((row, rowIndex) => {
          let signCellHtml = '';
          if (isFillerMixerMode) {
            if (rowIndex === 0) {
              signCellHtml = `<td class="qc-cip-sign-cell" rowspan="${solutionRows.length}" style="vertical-align:top;">
                <div style="display:flex;flex-direction:column;gap:4px;padding:4px 2px;">
                  ${FILLER_CIP_SIGN_NAMES.map((name) => `
                    <label style="display:flex;align-items:flex-start;gap:4px;cursor:pointer;font-size:0.82em;min-width:0;word-break:break-word;">
                      <input type="checkbox" ${fillerSignNames.includes(name) ? 'checked' : ''}
                        data-cip-field="filler_sign_names" data-block-index="${blockIndex}" data-sign-name="${escapeHtml(name)}" />
                      <span>${escapeHtml(name)}</span>
                    </label>
                  `).join('')}
                </div>
              </td>`;
            }
          } else {
            if (rowIndex === 0) {
              signCellHtml = `<td class="qc-cip-sign-cell" rowspan="${solutionRows.length}" style="vertical-align:top;">
                <div style="display:flex;flex-direction:column;gap:4px;padding:4px 2px;">
                  ${TANK_MIXING_SIGN_NAMES.map((name) => `
                    <label style="display:flex;align-items:flex-start;gap:4px;cursor:pointer;font-size:0.82em;min-width:0;word-break:break-word;">
                      <input type="checkbox" ${tankMixingSignNames.includes(name) ? 'checked' : ''}
                        data-cip-field="tank_mixing_sign_names" data-block-index="${blockIndex}" data-sign-name="${escapeHtml(name)}" />
                      <span>${escapeHtml(name)}</span>
                    </label>
                  `).join('')}
                </div>
              </td>`;
            }
          }
          return `
          <tr>
            <td>
              <input type="time" class="qc-input" value="${escapeHtml(row.time_start)}"
                data-cip-field="solution_rows" data-block-index="${blockIndex}" data-row-index="${rowIndex}" data-row-key="time_start" />
            </td>
            <td>
              <input type="time" class="qc-input" value="${escapeHtml(row.time_finish)}"
                data-cip-field="solution_rows" data-block-index="${blockIndex}" data-row-index="${rowIndex}" data-row-key="time_finish" />
            </td>
            <td>
              <select class="qc-input" data-cip-field="solution_rows" data-block-index="${blockIndex}" data-row-index="${rowIndex}" data-row-key="solution">
                <option value="">Select</option>
                ${TANK_CIP_SOLUTION_OPTIONS
                  .map((option) => `<option value="${escapeHtml(option)}" ${row.solution === option ? 'selected' : ''}>${escapeHtml(option)}</option>`)
                  .join('')}
              </select>
            </td>
            ${signCellHtml}
          </tr>
        `;})
        .join('');

      const swabPickerOptionsHtml = swabItems
        .map((item, rowIndex) => {
          const selected = normalizeYesNoValue(item && item.selected) === 'yes' || (item && item.selected === true);
          return `
            <label class="qc-cip-swab-option" data-swab-option data-swab-search="${escapeHtml(swabTemplateSearchValue(item && item.label))}">
              <input type="checkbox" ${selected ? 'checked' : ''}
                data-cip-field="swab_items" data-block-index="${blockIndex}" data-row-index="${rowIndex}" data-row-key="selected" data-input-type="checkbox" />
              <span>${escapeHtml(swabTemplateMenuLabel(item && item.label))}</span>
            </label>
          `;
        })
        .join('');

      const swabSelectedRowsHtml = swabItems
        .map((item, rowIndex) => {
          const selected = normalizeYesNoValue(item && item.selected) === 'yes' || (item && item.selected === true);
          return `
            <tr class="${selected ? '' : 'qc-hidden'}" data-swab-selected-row data-block-index="${blockIndex}" data-row-index="${rowIndex}">
              <td>
                <div class="qc-cip-swab-selected-item">
                  <span class="qc-cip-swab-text">${renderTankCipSwabTemplateInputs(item, blockIndex, rowIndex)}</span>
                </div>
              </td>
            </tr>
          `;
        })
        .join('');

      const selectedSwabCount = swabItems.filter(
        (item) => normalizeYesNoValue(item && item.selected) === 'yes' || (item && item.selected === true)
      ).length;

      const roPhRowsHtml = roPhRows
        .map((row, rowIndex) => `
          <tr>
            <td>
              <input type="text" class="qc-input" value="${escapeHtml(row.standard_ro_water_ph)}"
                data-cip-field="ro_ph_rows" data-block-index="${blockIndex}" data-row-index="${rowIndex}" data-row-key="standard_ro_water_ph" />
            </td>
            <td>
              <input type="text" class="qc-input" value="${escapeHtml(row.verification_of_tested_ph)}"
                data-cip-field="ro_ph_rows" data-block-index="${blockIndex}" data-row-index="${rowIndex}" data-row-key="verification_of_tested_ph" />
            </td>
          </tr>
        `)
        .join('');

      const observationsHtml = observations
        .map((value, rowIndex) => `
          <tr class="qc-cip-observations-row">
            <td>
              <input type="text" class="qc-input" value="${escapeHtml(value)}"
                data-cip-field="observations" data-block-index="${blockIndex}" data-row-index="${rowIndex}" />
            </td>
          </tr>
        `)
        .join('');

      const nonFoamLabelsHtml = typeCfg.show_oxonia_strip_result
        ? `
          <div class="qc-cip-label-row">
            <label class="qc-field">
              <span>Oxonia Strip Result</span>
              <select class="qc-input" data-cip-field="oxonia_strip_result" data-block-index="${blockIndex}">
                <option value="">Select</option>
                <option value="yes" ${oxoniaValue === 'yes' ? 'selected' : ''}>OK</option>
                <option value="no" ${oxoniaValue === 'no' ? 'selected' : ''}>NOT OK</option>
              </select>
            </label>
            <label class="qc-field">
              <span>Rinser Filter Change</span>
              <select class="qc-input" data-cip-field="rinser_filter_change" data-block-index="${blockIndex}">
                <option value="">Select</option>
                <option value="yes" ${rinserValue === 'yes' ? 'selected' : ''}>YES</option>
                <option value="no" ${rinserValue === 'no' ? 'selected' : ''}>NO</option>
              </select>
            </label>
          </div>
        `
        : '';

      const rinserFilterTypeHtml = rinserValue === 'yes'
        ? `
          <div class="qc-cip-label-row">
            ${TANK_CIP_RINSER_FILTER_OPTIONS.map((option) => `
              <label class="qc-cip-label-box">
                <input type="checkbox" ${rinserFilterTypeValue === option.value ? 'checked' : ''}
                  data-cip-field="rinser_filter_type" data-block-index="${blockIndex}" data-input-type="exclusive-checkbox" data-option-value="${escapeHtml(option.value)}" />
                <span style="margin-left:8px;">${escapeHtml(option.label)}</span>
              </label>
            `).join('')}
          </div>
        `
        : '';

      const foamExtraHtml = typeCfg.has_observations
        ? `
          <div class="qc-cip-label-row">
            <label class="qc-field">
              <span>Rinser Filter Change</span>
              <select class="qc-input" data-cip-field="rinser_filter_change" data-block-index="${blockIndex}">
                <option value="">Select</option>
                <option value="yes" ${rinserValue === 'yes' ? 'selected' : ''}>YES</option>
                <option value="no" ${rinserValue === 'no' ? 'selected' : ''}>NO</option>
              </select>
            </label>
          </div>
          <div class="qc-cip-section-title">Observations</div>
          <table class="qc-cip-table">
            <tbody>${observationsHtml}</tbody>
          </table>
        `
        : '';

      const roPhTableHtml = typeCfg.has_ro_ph_table
        ? `
          <div class="qc-cip-section-title">Standard RO Water pH Verification</div>
          <table class="qc-cip-table">
            <thead>
              <tr>
                <th>Standard RO Water pH</th>
                <th>Verification of Tested pH</th>
              </tr>
            </thead>
            <tbody>${roPhRowsHtml}</tbody>
          </table>
        `
        : '';

      const procedureHtml = (Array.isArray(typeCfg.procedure_lines) ? typeCfg.procedure_lines : [])
        .map((line) => `<p>${escapeHtml(line)}</p>`)
        .join('');

      return `
        <article class="qc-cip-block">
          <div class="qc-cip-block-header">
            <div class="qc-cip-title-wrap">
              <h4 class="qc-cip-title">${escapeHtml(typeCfg.title)}</h4>
              <span class="qc-cip-doc">Doc.Ref.: ${escapeHtml(typeCfg.doc_ref)} | Issue: ${escapeHtml(typeCfg.issue_no)} | Effective: ${escapeHtml(typeCfg.effective_date)} | Revision: ${escapeHtml(typeCfg.revision_date)}</span>
            </div>
            <div class="qc-cip-controls">
              <span class="qc-cip-order-badge">Order ${block.order}</span>
              <button type="button" class="qc-cip-mini-btn" data-cip-action="move-up" data-block-index="${blockIndex}" ${blockIndex === 0 ? 'disabled' : ''} aria-label="Move up">&#8593;</button>
              <button type="button" class="qc-cip-mini-btn" data-cip-action="move-down" data-block-index="${blockIndex}" ${blockIndex === blocks.length - 1 ? 'disabled' : ''} aria-label="Move down">&#8595;</button>
              <button type="button" class="qc-cip-mini-btn" data-cip-action="remove" data-block-index="${blockIndex}" aria-label="Remove block">&times;</button>
            </div>
          </div>

          <div class="qc-cip-grid">
            <label class="qc-field">
              <span>Date</span>
              <input type="date" class="qc-input" value="${escapeHtml(block.date)}" data-cip-field="date" data-block-index="${blockIndex}" />
            </label>
            <label class="qc-field">
              <span>Product Name</span>
              <input type="text" class="qc-input" value="${escapeHtml(block.product_name)}" readonly />
            </label>
            ${topLineOrTankFieldHtml}
            <label class="qc-field">
              <span>Batch Number</span>
              <input type="text" class="qc-input" value="${escapeHtml(block.batch_no)}" readonly />
            </label>
            <label class="qc-field">
              <span>Start Time</span>
              <input type="time" class="qc-input" value="${escapeHtml(block.start_time)}" data-cip-field="start_time" data-block-index="${blockIndex}" />
            </label>
            <label class="qc-field">
              <span>Finish Time</span>
              <input type="time" class="qc-input" value="${escapeHtml(block.finish_time)}" data-cip-field="finish_time" data-block-index="${blockIndex}" />
            </label>
          </div>

          <p class="qc-cip-order-line"><strong>Order:</strong> ${escapeHtml(orderSequenceText)}</p>

          <table class="qc-cip-table qc-cip-solution-table">
            <thead>
              <tr>
                <th>Time Start</th>
                <th>Time Finish</th>
                <th>Solution</th>
                <th>Sign</th>
              </tr>
            </thead>
            <tbody>${solutionRowsHtml}</tbody>
          </table>

          <div class="qc-cip-section-title">Swab Result</div>
          <div class="qc-cip-swab-picker" data-cip-swab-picker data-block-index="${blockIndex}">
            <button type="button" class="qc-cip-swab-trigger" data-cip-field="swab_toggle" data-block-index="${blockIndex}" aria-expanded="false">
              <span class="qc-cip-swab-summary" data-swab-summary>
                ${selectedSwabCount ? `Search and select swab tests (${selectedSwabCount} selected)` : 'Search and select swab tests'}
              </span>
              <span class="qc-cip-swab-caret" data-swab-caret>&#9662;</span>
            </button>
            <div class="qc-cip-swab-picker-body qc-hidden" data-swab-menu>
              <div class="qc-cip-swab-picker-head">
                <input type="search" class="qc-input qc-cip-swab-search" placeholder="Type to filter tests..."
                  data-cip-field="swab_search" data-block-index="${blockIndex}" />
              </div>
              <div class="qc-cip-swab-picker-menu">
                ${swabPickerOptionsHtml}
                <div class="qc-cip-swab-no-match qc-hidden" data-swab-no-match>No matching tests.</div>
              </div>
            </div>
          </div>
          <table class="qc-cip-table">
            <tbody>
              <tr class="${selectedSwabCount ? 'qc-hidden' : ''}" data-swab-selected-empty data-block-index="${blockIndex}">
                <td class="qc-cip-swab-empty">Select swab tests from the menu.</td>
              </tr>
              ${swabSelectedRowsHtml}
            </tbody>
          </table>

          ${nonFoamLabelsHtml}
          ${rinserFilterTypeHtml}
          ${roPhTableHtml}
          ${foamExtraHtml}

          <div class="qc-cip-procedure">
            ${procedureHtml}
          </div>

          <div class="qc-cip-rinsing" style="margin-top:10px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-size:0.85em;font-weight:600;color:#475569;">
              <input type="checkbox"
                data-cip-field="rinsing_done" data-block-index="${blockIndex}" data-input-type="checkbox"
                ${block.rinsing_done ? 'checked' : ''} />
              <span>Rinsing${block.rinsing_done ? ` (${escapeHtml(block.tank_no || '')})` : ''}</span>
            </label>
            <input type="date"
              data-cip-field="rinsing_date" data-block-index="${blockIndex}"
              value="${escapeHtml(block.rinsing_date || '')}"
              style="font-size:0.85em;padding:4px 8px;border:1px solid #cbd5e1;border-radius:6px;${block.rinsing_done ? '' : 'display:none;'}" />
          </div>

          <div class="qc-cip-comments" style="margin-top:10px;">
            <label style="display:block;font-size:0.78em;font-weight:600;color:#475569;margin-bottom:4px;">Comments</label>
            <textarea class="qc-input" rows="2"
              data-cip-field="mixing_comments" data-block-index="${blockIndex}"
              placeholder="Comments from mixing area auto-sync here; you can also edit."
              style="width:100%;font-size:0.85em;border:1px solid #cbd5e1;border-radius:6px;padding:6px 8px;resize:vertical;">${escapeHtml(block.mixing_comments || '')}</textarea>
          </div>

        </article>
      `;
    })
    .join('');
}

function onAddTankCipBlock(cipType) {
  const cipSection = activeCipSection();
  const batchMeta = getSelectedBatchMeta();
  if (!state.selectedBatchNo || !batchMeta) {
    setStatus('Select a batch first.', true);
    showToast('Select a batch first.', true);
    return;
  }
  const base = normalizeTankCipData(getCipData(cipSection) || { blocks: [] }, batchMeta);
  const blocks = Array.isArray(base.blocks) ? [...base.blocks] : [];
  blocks.unshift(buildBlankTankCipBlock(cipType));
  const nextBlocks = cipSection === 'filler_mixer_cip'
    ? applyPrimaryLineToFollowerBlocks(blocks).blocks
    : blocks;
  setCipData(cipSection, normalizeTankCipData({ blocks: nextBlocks }, batchMeta));
  renderTankCipPanel();
  queueTankCipAutoSave(cipSection);
  const addButtonId = (
    cipType === '3_step'
      ? 'qc-cip-add-3-step-btn'
      : (cipType === '5_step' ? 'qc-cip-add-5-step-btn' : 'qc-cip-add-foam-btn')
  );
  const addBtn = document.getElementById(addButtonId);
  if (addBtn) {
    addBtn.classList.add('qc-btn-success-flash');
    if (addBtn._flashTimer) window.clearTimeout(addBtn._flashTimer);
    addBtn._flashTimer = window.setTimeout(() => {
      addBtn.classList.remove('qc-btn-success-flash');
      addBtn._flashTimer = null;
    }, 900);
  }
  const cipTypeLabel = cipType === '3_step' ? '3 STEP CIP' : (cipType === '5_step' ? '5 STEP CIP' : '5 STEP Foam CIP');
  const cipLabel = cipLabelFromSection(cipSection);
  const message = `${cipTypeLabel} added to ${cipLabel} as page 1.`;
  setStatus(message);
  showToast(message);
}

function onTankCipBlockActionClick(event) {
  const swabToggle = event.target && typeof event.target.closest === 'function'
    ? event.target.closest('[data-cip-field="swab_toggle"]')
    : null;
  if (swabToggle) {
    const index = Number(swabToggle.getAttribute('data-block-index'));
    if (!Number.isFinite(index) || index < 0) return;
    event.preventDefault();
    const isOpen = String(swabToggle.getAttribute('aria-expanded') || '').toLowerCase() === 'true';
    closeAllTankCipSwabMenus(index);
    setTankCipSwabMenuOpen(index, !isOpen);
    if (!isOpen) {
      const searchEl = document.querySelector(
        `input[data-cip-field="swab_search"][data-block-index="${index}"]`
      );
      if (searchEl && typeof searchEl.focus === 'function') searchEl.focus();
    }
    return;
  }

  const target = event.target && typeof event.target.closest === 'function'
    ? event.target.closest('[data-cip-action]')
    : null;
  if (!target) return;
  const action = String(target.getAttribute('data-cip-action') || '').trim();
  const index = Number(target.getAttribute('data-block-index'));
  if (!action || !Number.isFinite(index) || index < 0) return;
  const cipSection = activeCipSection();
  const batchMeta = getSelectedBatchMeta();
  const base = normalizeTankCipData(getCipData(cipSection) || { blocks: [] }, batchMeta);
  const blocks = Array.isArray(base.blocks) ? [...base.blocks] : [];
  if (!blocks[index]) return;

  if (action === 'remove') {
    blocks.splice(index, 1);
  } else if (action === 'move-up' && index > 0) {
    const current = blocks[index];
    blocks[index] = blocks[index - 1];
    blocks[index - 1] = current;
  } else if (action === 'move-down' && index < blocks.length - 1) {
    const current = blocks[index];
    blocks[index] = blocks[index + 1];
    blocks[index + 1] = current;
  }

  const nextBlocks = cipSection === 'filler_mixer_cip'
    ? applyPrimaryLineToFollowerBlocks(blocks).blocks
    : blocks;
  setCipData(cipSection, normalizeTankCipData({ blocks: nextBlocks }, batchMeta));
  renderTankCipPanel();
  queueTankCipAutoSave(cipSection);
}

function onTankCipBlockFieldInput(event) {
  const el = event && event.target;
  if (!el || !el.getAttribute) return;
  const field = String(el.getAttribute('data-cip-field') || '').trim();
  if (!field) return;

  const blockIndex = Number(el.getAttribute('data-block-index'));
  if (!Number.isFinite(blockIndex) || blockIndex < 0) return;
  if (field === 'swab_search') {
    filterTankCipSwabOptions(blockIndex, el.value);
    return;
  }

  const cipSection = activeCipSection();
  const batchMeta = getSelectedBatchMeta();
  const base = normalizeTankCipData(getCipData(cipSection) || { blocks: [] }, batchMeta);
  const blocks = Array.isArray(base.blocks) ? [...base.blocks] : [];
  const block = blocks[blockIndex];
  if (!block) return;
  let swabUiSync = null;

  if (field === 'solution_rows') {
    const rowIndex = Number(el.getAttribute('data-row-index'));
    const rowKey = String(el.getAttribute('data-row-key') || '').trim();
    if (!Number.isFinite(rowIndex) || rowIndex < 0 || !rowKey) return;
    const solutionRowCount = Number.isFinite(Number(block.solution_row_count))
      ? Math.max(1, Math.min(10, Number(block.solution_row_count)))
      : 5;
    const rows = Array.isArray(block.solution_rows)
      ? [...block.solution_rows]
      : defaultTankCipSolutionRows(solutionRowCount);
    const row = rows[rowIndex] && typeof rows[rowIndex] === 'object' ? { ...rows[rowIndex] } : {};
    row[rowKey] = String(el.value || '');
    rows[rowIndex] = row;
    block.solution_rows = rows;
  } else if (field === 'swab_items') {
    const rowIndex = Number(el.getAttribute('data-row-index'));
    const rowKey = String(el.getAttribute('data-row-key') || '').trim();
    if (!Number.isFinite(rowIndex) || rowIndex < 0 || !rowKey) return;
    const rows = Array.isArray(block.swab_items)
      ? block.swab_items.map((row) => ({ ...row, values: Array.isArray(row.values) ? [...row.values] : [] }))
      : defaultTankCipSwabItems();
    const row = rows[rowIndex] && typeof rows[rowIndex] === 'object'
      ? { ...rows[rowIndex], values: Array.isArray(rows[rowIndex].values) ? [...rows[rowIndex].values] : [] }
      : null;
    if (!row) return;
    if (rowKey === 'selected' && el.type === 'checkbox') {
      row.selected = !!el.checked;
      swabUiSync = { blockIndex, rowIndex };
    } else if (rowKey === 'value') {
      const valueIndex = Number(el.getAttribute('data-value-index'));
      if (!Number.isFinite(valueIndex) || valueIndex < 0) return;
      while (row.values.length <= valueIndex) row.values.push('');
      row.values[valueIndex] = String(el.value || '');
    }
    rows[rowIndex] = row;
    block.swab_items = rows;
    block.swab_rows = defaultTankCipSwabRows().map((_, idx) => String(buildTankCipSwabDisplayRows(rows)[idx] || ''));
  } else if (field === 'swab_rows') {
    const rowIndex = Number(el.getAttribute('data-row-index'));
    if (!Number.isFinite(rowIndex) || rowIndex < 0) return;
    const rows = Array.isArray(block.swab_rows) ? [...block.swab_rows] : defaultTankCipSwabRows();
    rows[rowIndex] = String(el.value || '');
    block.swab_rows = rows;
  } else if (field === 'ro_ph_rows') {
    const rowIndex = Number(el.getAttribute('data-row-index'));
    const rowKey = String(el.getAttribute('data-row-key') || '').trim();
    if (!Number.isFinite(rowIndex) || rowIndex < 0 || !rowKey) return;
    const rows = Array.isArray(block.ro_ph_rows) ? [...block.ro_ph_rows] : defaultTankCipRoPhRows();
    const row = rows[rowIndex] && typeof rows[rowIndex] === 'object' ? { ...rows[rowIndex] } : {};
    row[rowKey] = String(el.value || '');
    rows[rowIndex] = row;
    block.ro_ph_rows = rows;
  } else if (field === 'observations') {
    const rowIndex = Number(el.getAttribute('data-row-index'));
    if (!Number.isFinite(rowIndex) || rowIndex < 0) return;
    const rows = Array.isArray(block.observations) ? [...block.observations] : defaultTankCipObservationRows();
    rows[rowIndex] = String(el.value || '');
    block.observations = rows;
  } else if (field === 'filler_sign_names' && el.type === 'checkbox') {
    const signName = String(el.getAttribute('data-sign-name') || '').trim();
    if (!signName || !FILLER_CIP_SIGN_NAMES.includes(signName)) return;
    const current = normalizeFillerSignNames(block.filler_sign_names);
    if (el.checked && !current.includes(signName)) current.push(signName);
    else if (!el.checked) {
      const idx = current.indexOf(signName);
      if (idx >= 0) current.splice(idx, 1);
    }
    block.filler_sign_names = current;
  } else if (field === 'tank_mixing_sign_names' && el.type === 'checkbox') {
    const signName = String(el.getAttribute('data-sign-name') || '').trim();
    if (!signName || !TANK_MIXING_SIGN_NAMES.includes(signName)) return;
    const current = normalizeTankMixingSignNames(block.tank_mixing_sign_names);
    if (el.checked && !current.includes(signName)) current.push(signName);
    else if (!el.checked) {
      const idx = current.indexOf(signName);
      if (idx >= 0) current.splice(idx, 1);
    }
    block.tank_mixing_sign_names = current;
  } else if (field === 'rinser_filter_type' && el.getAttribute('data-input-type') === 'exclusive-checkbox') {
    const optionValue = normalizeRinserFilterType(el.getAttribute('data-option-value') || el.value);
    block.rinser_filter_type = el.checked ? optionValue : '';
  } else if (field === 'oxonia_strip_result' || field === 'rinser_filter_change') {
    block[field] = normalizeYesNoValue(el.value);
    if (field === 'rinser_filter_change' && block[field] !== 'yes') {
      block.rinser_filter_type = '';
    }
  } else if (field === 'is_rinser' && el.type === 'checkbox') {
    block.is_rinser = !!el.checked;
  } else if (field === 'rinsing_done' && el.type === 'checkbox') {
    block.rinsing_done = !!el.checked;
    if (!el.checked) block.rinsing_date = '';
  } else if (field === 'rinsing_date') {
    block.rinsing_date = String(el.value || '');
  } else if (field === 'line_display') {
    return;
  } else {
    block[field] = String(el.value || '');
  }

  blocks[blockIndex] = block;
  const nextBlocks = (cipSection === 'filler_mixer_cip' && field === 'line')
    ? applyPrimaryLineToFollowerBlocks(blocks).blocks
    : blocks;
  setCipData(cipSection, normalizeTankCipData({ blocks: nextBlocks }, batchMeta));
  if (swabUiSync) {
    const normalizedData = getCipData(cipSection);
    const normalizedBlocks = Array.isArray(normalizedData && normalizedData.blocks)
      ? normalizedData.blocks
      : [];
    const normalizedBlock = normalizedBlocks[swabUiSync.blockIndex];
    const normalizedItems = Array.isArray(normalizedBlock && normalizedBlock.swab_items)
      ? normalizedBlock.swab_items
      : [];
    const normalizedItem = normalizedItems[swabUiSync.rowIndex];
    const selectedNow = !!(
      normalizedItem
      && (normalizedItem.selected === true || normalizeYesNoValue(normalizedItem.selected) === 'yes')
    );
    syncTankCipSwabSelectionUi(swabUiSync.blockIndex, swabUiSync.rowIndex, selectedNow);
  }
  if (
    field === 'rinser_filter_change'
    || field === 'rinser_filter_type'
    || field === 'is_rinser'
    || field === 'rinsing_done'
    || (cipSection === 'filler_mixer_cip' && field === 'line')
  ) {
    renderTankCipPanel();
  }
  queueTankCipAutoSave(cipSection);
}

async function loadSelectedTankCip() {
  const cipSection = activeCipSection();
  const submenuName = cipSubmenuFromSection(cipSection);
  const cipLabel = cipLabelFromSection(cipSection);
  if (!state.selectedBatchNo) {
    setCipData(cipSection, null);
    resetTankCipAutoSaveState(cipSection);
    setCipLastSavedSnapshot(cipSection, '');
    showMixingEmpty(`Select a batch to open ${cipLabel}.`);
    return;
  }
  const batchMeta = getSelectedBatchMeta();
  try {
    const data = await fetchActiveCipData(state.selectedBatchNo, submenuName);
    let normalized = normalizeTankCipData(data, batchMeta);
    if (cipSection === 'filler_mixer_cip') {
      const propagated = applyPrimaryLineToFollowerBlocks(Array.isArray(normalized.blocks) ? normalized.blocks : []);
      if (propagated.changed) {
        normalized = normalizeTankCipData({ blocks: propagated.blocks }, batchMeta);
      }
    }
    setCipData(cipSection, normalized);
    resetTankCipAutoSaveState(cipSection);
    // Render BEFORE computing the snapshot. collectTankCipPayload truncates
    // payloadBlocks to the rendered .qc-cip-block count when the section is
    // visible — if we snapshot first, the DOM is still empty and the snapshot
    // ends up as `{blocks: []}`, so every later autosave compares non-empty
    // payload to empty snapshot and fires, pushing stale QC data back into
    // the mixing record via propagate_qc_blocks_to_mixing.
    if (cipSection === activeCipSection()) renderTankCipPanel();
    setCipLastSavedSnapshot(cipSection, serializeMixingSnapshot(collectTankCipPayload(cipSection)));
  } catch (err) {
    setCipData(cipSection, null);
    resetTankCipAutoSaveState(cipSection);
    setCipLastSavedSnapshot(cipSection, '');
    if (cipSection === activeCipSection()) {
      showMixingEmpty(err.message || `Failed to load ${cipLabel}.`);
      setStatus(err.message || `Failed to load ${cipLabel}.`, true);
    }
  }
}

function collectTankCipPayload(section = activeCipSection()) {
  const batchMeta = getSelectedBatchMeta();
  const base = normalizeTankCipData(getCipData(section) || { blocks: [] }, batchMeta);
  const blocks = Array.isArray(base.blocks) ? base.blocks : [];
  let payloadBlocks = blocks.map((block) => {
    const rinserFilterChange = normalizeYesNoValue(block.rinser_filter_change);
    const rinserFilterType = rinserFilterChange === 'yes'
      ? normalizeRinserFilterType(block.rinser_filter_type)
      : '';
    const rinsingDone = !!block.rinsing_done;
    const out = {
      id: String(block.id || ''),
      cip_type: String(block.cip_type || '3_step'),
      date: String(block.date || ''),
      product_name: String(block.product_name || ''),
      line: normalizeTankCipLine(block.line),
      is_rinser: !!block.is_rinser,
      tank_no: String(block.tank_no || ''),
      batch_no: String(block.batch_no || ''),
      start_time: String(block.start_time || ''),
      finish_time: String(block.finish_time || ''),
      rinsing_done: rinsingDone,
      rinsing_date: rinsingDone ? String(block.rinsing_date || '') : '',
      mixing_comments: String(block.mixing_comments || ''),
      solution_rows: (
        Array.isArray(block.solution_rows)
          ? block.solution_rows
          : defaultTankCipSolutionRows(block.solution_row_count)
      ).map((row) => ({
        time_start: String((row && row.time_start) || ''),
        time_finish: String((row && row.time_finish) || ''),
        solution: String((row && row.solution) || ''),
        sign: '',
      })),
      ...(() => {
        const swabItems = (Array.isArray(block.swab_items) ? block.swab_items : defaultTankCipSwabItems())
          .map((item) => {
            const label = String((item && item.label) || '');
            const slotCount = swabSlotCount(label);
            const values = Array.isArray(item && item.values)
              ? item.values.slice(0, slotCount).map((value) => String(value || ''))
              : Array.from({ length: slotCount }, () => '');
            while (values.length < slotCount) values.push('');
            return {
              id: String((item && item.id) || ''),
              label,
              selected: !!(item && (item.selected === true || normalizeYesNoValue(item.selected) === 'yes')),
              values,
            };
          });
        const swabLines = buildTankCipSwabDisplayRows(swabItems);
        return {
          swab_items: swabItems,
          swab_rows: defaultTankCipSwabRows().map((_, idx) => String(swabLines[idx] || '')),
        };
      })(),
      ro_ph_rows: (Array.isArray(block.ro_ph_rows) ? block.ro_ph_rows : defaultTankCipRoPhRows()).map((row) => ({
        standard_ro_water_ph: String((row && row.standard_ro_water_ph) || ''),
        verification_of_tested_ph: String((row && row.verification_of_tested_ph) || ''),
      })),
      oxonia_strip_result: normalizeYesNoValue(block.oxonia_strip_result),
      rinser_filter_change: rinserFilterChange,
      rinser_filter_type: rinserFilterType,
      observations: (Array.isArray(block.observations) ? block.observations : defaultTankCipObservationRows()).map((value) => String(value || '')),
      filler_sign_names: normalizeFillerSignNames(block.filler_sign_names),
      tank_mixing_sign_names: normalizeTankMixingSignNames(block.tank_mixing_sign_names),
    };
    if (block.source && typeof block.source === 'object') {
      out.source = { ...block.source };
    }
    return out;
  });

  const blocksHost = document.getElementById('qc-tank-cip-blocks');
  const sectionIsVisible = isCipSubmenu() && activeCipSection() === section;
  if (blocksHost && sectionIsVisible) {
    const renderedCount = blocksHost.querySelectorAll('.qc-cip-block').length;
    if (renderedCount > 0 && payloadBlocks.length > renderedCount) {
      payloadBlocks = payloadBlocks.slice(0, renderedCount);
    }
    if (section === 'filler_mixer_cip') {
      blocksHost.querySelectorAll('[data-cip-field="line"][data-block-index]').forEach((el) => {
        const blockIndex = Number(el.getAttribute('data-block-index'));
        if (!Number.isFinite(blockIndex) || blockIndex < 0 || blockIndex >= payloadBlocks.length) return;
        payloadBlocks[blockIndex].line = normalizeTankCipLine(el.value);
      });
    }
  }
  if (section === 'filler_mixer_cip') {
    payloadBlocks = applyPrimaryLineToFollowerBlocks(payloadBlocks).blocks;
  }

  return {
    blocks: payloadBlocks,
  };
}

async function flushCipAutoSaveForSection(section) {
  if (!state.selectedBatchNo) return;
  const hasSectionState = (
    !!getCipData(section)
    || !!getCipAutoSaveTimer(section)
    || getCipAutoSaveInFlight(section)
    || getCipAutoSaveQueued(section)
  );
  if (!hasSectionState) return;

  for (let guard = 0; guard < 25; guard += 1) {
    const timer = getCipAutoSaveTimer(section);
    if (timer) {
      window.clearTimeout(timer);
      setCipAutoSaveTimer(section, null);
    }
    while (getCipAutoSaveInFlight(section)) {
      await new Promise((r) => setTimeout(r, 30));
    }
    await runTankCipAutoSave(section);
    while (getCipAutoSaveInFlight(section)) {
      await new Promise((r) => setTimeout(r, 30));
    }
    if (!getCipAutoSaveTimer(section) && !getCipAutoSaveQueued(section)) break;
    if (getCipAutoSaveQueued(section)) {
      setCipAutoSaveQueued(section, false);
    }
  }
}

async function saveTankCipPayload(payload, options = {}) {
  const section = typeof options.section === 'string' ? options.section : activeCipSection();
  const submenuName = cipSubmenuFromSection(section);
  const rerender = options.rerender !== false;
  const successStatus = typeof options.successStatus === 'string' ? options.successStatus : '';
  const successToast = typeof options.successToast === 'string' ? options.successToast : '';

  const result = await saveActiveCipData(state.selectedBatchNo, payload, submenuName);
  const normalized = normalizeTankCipData(result.data || payload, getSelectedBatchMeta());
  setCipData(section, normalized);
  setCipLastSavedSnapshot(section, serializeMixingSnapshot(payload));

  if (rerender && section === activeCipSection()) renderTankCipPanel();
  if (successStatus) setStatus(successStatus);
  if (successToast) showToast(successToast);

  return { result, data: normalized };
}

async function runTankCipAutoSave(section = activeCipSection()) {
  const cipLabel = cipLabelFromSection(section);
  const isActiveSection = section === activeCipSection();
  if (!state.selectedBatchNo) return;
  if (getCipAutoSaveInFlight(section)) {
    setCipAutoSaveQueued(section, true);
    return;
  }

  const payload = collectTankCipPayload(section);
  const snapshot = serializeMixingSnapshot(payload);
  if (snapshot && snapshot === getCipLastSavedSnapshot(section)) return;

  setCipAutoSaveInFlight(section, true);
  try {
    await saveTankCipPayload(payload, { rerender: false, section });
    if (isActiveSection) setStatus(`Auto-saved ${cipLabel}.`);
  } catch (err) {
    if (isActiveSection) setStatus(err.message || `Failed to auto-save ${cipLabel}.`, true);
  } finally {
    setCipAutoSaveInFlight(section, false);
    if (getCipAutoSaveQueued(section)) {
      setCipAutoSaveQueued(section, false);
      queueTankCipAutoSave(section);
    }
  }
}

function queueTankCipAutoSave(section = activeCipSection()) {
  if (!state.selectedBatchNo) return;
  const existingTimer = getCipAutoSaveTimer(section);
  if (existingTimer) {
    window.clearTimeout(existingTimer);
  }
  const timerId = window.setTimeout(() => {
    setCipAutoSaveTimer(section, null);
    void runTankCipAutoSave(section);
  }, TANK_CIP_AUTO_SAVE_DELAY_MS);
  setCipAutoSaveTimer(section, timerId);
}

async function onSaveTankCip() {
  const cipSection = activeCipSection();
  const cipLabel = cipLabelFromSection(cipSection);
  if (!state.selectedBatchNo) {
    setStatus('Select a batch first.', true);
    showToast('Select a batch first.', true);
    return;
  }

  try {
    const payload = collectTankCipPayload(cipSection);
    setStatus(`Saving ${cipLabel}...`);
    await saveTankCipPayload(payload, {
      section: cipSection,
      rerender: true,
      successStatus: `${cipLabel} saved.`,
      successToast: `${cipLabel} saved.`,
    });
  } catch (err) {
    setStatus(err.message || `Failed to save ${cipLabel}.`, true);
    showToast(err.message || `Failed to save ${cipLabel}.`, true);
  }
}

async function onPrintTankCipPdf() {
  const cipSection = activeCipSection();
  const submenuName = cipSubmenuFromSection(cipSection);
  const cipLabel = cipLabelFromSection(cipSection);
  if (!state.selectedBatchNo) {
    setStatus('Select a batch first.', true);
    showToast('Select a batch first.', true);
    return;
  }

  try {
    const payload = collectTankCipPayload(cipSection);
    if (!Array.isArray(payload.blocks) || !payload.blocks.length) {
      await saveTankCipPayload(payload, { rerender: false, section: cipSection });
      setStatus(`No ${cipLabel} data entered. Skipped PDF generation.`);
      return;
    }
    if (cipSection === 'filler_mixer_cip') {
      const missingLineIndex = payload.blocks.findIndex((block) => !normalizeTankCipLine(block && block.line));
      if (missingLineIndex >= 0) {
        const message = `Select Line (CAN or PET) in block ${missingLineIndex + 1} before exporting PDF.`;
        setStatus(message, true);
        showToast(message, true);
        return;
      }
    }

    setStatus(`Saving ${cipLabel} and preparing PDF...`);
    await saveTankCipPayload(payload, { rerender: false, section: cipSection });

    const blob = await downloadActiveCipPdf(state.selectedBatchNo, submenuName);
    const batchNoRaw = String(
      (payload.blocks[0] && payload.blocks[0].batch_no)
      || state.selectedBatchNo
      || ''
    ).trim();
    const safeBatchNo = batchNoRaw.replace(/[<>:"/\\|?*\x00-\x1f]+/g, '_') || 'batch';
    const fileName = cipSection === 'filler_mixer_cip'
      ? `${safeBatchNo}_Filler_Mixer_CIP.pdf`
      : `${safeBatchNo}_Tank_CIP.pdf`;
    const fileLike = typeof File === 'function'
      ? new File([blob], fileName, { type: 'application/pdf' })
      : blob;
    const url = window.URL.createObjectURL(fileLike);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 60000);

    setStatus(`${cipLabel} PDF downloaded.`);
    showToast(`${cipLabel} PDF downloaded.`);
  } catch (err) {
    setStatus(err.message || `Failed to generate ${cipLabel} PDF.`, true);
    showToast(err.message || `Failed to generate ${cipLabel} PDF.`, true);
  }
}

function qcReportColumnsForLine(line) {
  const docCfg = getQcReportDocConfig(line);
  const cols = [
    { key: 'time', label: 'Time' },
    { key: 'brix', label: 'Brix' },
    { key: 'turbidity_acidity', label: 'Turbidity/\nacidity' },
    { key: 'taste_odour', label: 'Taste \\ Odour' },
    { key: 'special_field', label: docCfg.special_label },
    { key: 'temp', label: 'Temp' },
    { key: 'gas_volume', label: 'Gas volume' },
    { key: 'uv_light_on', label: 'UV light on' },
    { key: 'dry_field', label: docCfg.dry_label },
    { key: 'air_vol', label: 'Air Vol' },
    { key: 'date_code', label: 'Date code' },
    { key: 'bar_code', label: 'Bar Code' },
    { key: 'net_content', label: 'Net content' },
    { key: 'pressure_temp', label: 'Pressure Temp' },
    { key: 'check_mat', label: 'Check MAT' },
    { key: 'six_pack_shrink_wrap', label: '6-Pack Shrink-\nwrap' },
    { key: 'comments', label: 'COMMENTS /\nTunnel Past settings' },
  ];
  return cols.map((col) => ({ ...col, width_unit: QC_REPORT_COLUMN_WIDTH_UNITS[col.key] || 1 }));
}

function renderQcReportPanel() {
  if (!isQcReportSubmenu()) return;
  const data = getQcReportData();
  const batchMeta = getSelectedBatchMeta();
  if (!state.selectedBatchNo || !batchMeta || !data) {
    showMixingEmpty('Select a batch to open QC Report.');
    return;
  }

  const emptyEl = document.getElementById('qc-mixing-empty');
  const mixingPanelEl = document.getElementById('qc-mixing-panel');
  const tankPanelEl = document.getElementById('qc-tank-cip-panel');
  const reportPanelEl = document.getElementById('qc-report-panel');
  const seamPanelEl = document.getElementById('qc-seam-panel');
  const configPanelEl = document.getElementById('qc-mixing-config-panel');
  const reportEmptyEl = document.getElementById('qc-report-empty');
  const daysHost = document.getElementById('qc-report-days');

  if (emptyEl) emptyEl.classList.add('qc-hidden');
  if (mixingPanelEl) mixingPanelEl.classList.add('qc-hidden');
  if (tankPanelEl) tankPanelEl.classList.add('qc-hidden');
  if (reportPanelEl) reportPanelEl.classList.remove('qc-hidden');
  if (seamPanelEl) seamPanelEl.classList.add('qc-hidden');
  if (configPanelEl) configPanelEl.classList.add('qc-hidden');
  hideQcPickingPanel();
  if (!daysHost) return;

  const normalized = normalizeQcReportData(data, batchMeta);
  setQcReportData(normalized);
  const days = Array.isArray(normalized.days) ? normalized.days : [];

  if (!days.length) {
    daysHost.innerHTML = '';
    if (reportEmptyEl) reportEmptyEl.classList.remove('qc-hidden');
    return;
  }
  if (reportEmptyEl) reportEmptyEl.classList.add('qc-hidden');

  ensureQcReportWizardIndices(days);
  const working = normalizeQcReportData(getQcReportData() || {}, batchMeta);
  setQcReportData(working);
  const daysW = Array.isArray(working.days) ? working.days : [];
  const dayIndex = state.qcReportWizard.dayIndex;
  const day = daysW[dayIndex];
  const docCfg = getQcReportDocConfig(day.line);
  const columns = qcReportColumnsForLine(day.line);
  const rows = Array.isArray(day.rows) ? day.rows : defaultQcReportRows(day.size);
  const dataRowIndex = state.qcReportWizard.dataRowIndex;
  const sampleTotal = Math.max(1, rows.length - 1);
  const rowSample = rows[dataRowIndex] && typeof rows[dataRowIndex] === 'object' ? rows[dataRowIndex] : {};

  const resolvedLine = normalizeQcReportLine(day.line);
  if ((resolvedLine === 'PET' || resolvedLine === 'CAN') && dataRowIndex >= 1) {
    const afKey = `${dayIndex}:${dataRowIndex}`;
    if (!state.qcReportWizard.timeAutofilledRows.has(afKey) && !normalizeTimeForInput(rowSample.time)) {
      rowSample.time = uaeNowHHMM();
      rows[dataRowIndex] = { ...rowSample };
      day.rows = rows;
      daysW[dayIndex] = day;
      setQcReportData({ days: daysW });
      state.qcReportWizard.timeAutofilledRows.add(afKey);
    }
  }

  const selectedColorKeys = new Set(
    String(day.closure_or_can_end_color || '')
      .split(',')
      .map((s) => qcReportColorNormKey(s))
      .filter(Boolean),
  );
  const colorCheckboxesHtml = (docCfg.color_options || [])
    .map((option) => {
      const checked = selectedColorKeys.has(qcReportColorNormKey(option)) ? ' checked' : '';
      return `<label class="qc-color-checkbox"><input type="checkbox" value="${escapeHtml(option)}" data-qc-color-check data-day-index="${dayIndex}"${checked} />${escapeHtml(option)}</label>`;
    })
    .join('');

  const dayTabsHtml = daysW
    .map((d, i) => {
      const active = i === dayIndex ? ' qc-btn-primary' : '';
      return `<button type="button" class="qc-btn qc-wizard-day-tab${active}" data-qc-wizard-day="${i}">Day ${i + 1}</button>`;
    })
    .join('');

  const fixedNetContent = resolvedLine === 'PET' || resolvedLine === 'CAN';
  const rangeRow = rows[0] && typeof rows[0] === 'object' ? rows[0] : {};
  const mixingLimits = getMixingLimitsForQcReport();
  if (mixingLimits.brix) rangeRow.brix = mixingLimits.brix;
  if (mixingLimits.gas_volume) rangeRow.gas_volume = mixingLimits.gas_volume;
  const limitsHtml = columns
    .map((col) => {
      const rowAttrs = `data-qc-report-field="rows" data-day-index="${dayIndex}" data-row-index="0" data-row-key="${escapeHtml(col.key)}"`;
      if (col.key === 'uv_light_on') {
        const value = String((rangeRow && rangeRow[col.key]) || '');
        return `<label class="qc-bubble-field"><span class="qc-bubble-label">${escapeHtml(col.label).replace(/\n/g, ' ')}</span><select class="qc-input qc-bubble-input" ${rowAttrs}>${qcReportUvLightOptionsHtml(value)}</select></label>`;
      }
      if (col.key === 'net_content') {
        const value = String((rangeRow && rangeRow[col.key]) || '');
        if (fixedNetContent) {
          const nc = canonicalQcReportNetContent(batchMeta, value);
          return `<label class="qc-bubble-field"><span class="qc-bubble-label">${escapeHtml(col.label).replace(/\n/g, ' ')}</span><input type="text" class="qc-input qc-bubble-input" value="${escapeHtml(nc)}" ${rowAttrs} readonly /></label>`;
        }
        return `<label class="qc-bubble-field"><span class="qc-bubble-label">${escapeHtml(col.label).replace(/\n/g, ' ')}</span><select class="qc-input qc-bubble-input" ${rowAttrs}>${qcReportNetContentOptionsHtml(value, batchMeta)}</select></label>`;
      }
      const value = String((rangeRow && rangeRow[col.key]) || '');
      return `<label class="qc-bubble-field"><span class="qc-bubble-label">${escapeHtml(col.label).replace(/\n/g, ' ')}</span><input type="text" class="qc-input qc-bubble-input" value="${escapeHtml(value)}" ${rowAttrs} /></label>`;
    })
    .join('');

  const sampleHtml = columns
    .map((col) => qcReportSampleCellHtml(col, (rowSample && rowSample[col.key]) || '', dayIndex, dataRowIndex, batchMeta, day.line))
    .join('');

  const manageIdx = dayIndex;
  daysHost.innerHTML = `
    <div class="qc-wizard">
      <p class="qc-wizard-docref qc-muted">${escapeHtml(docCfg.report_title)} · ${escapeHtml(docCfg.doc_ref)}</p>
      <div class="qc-wizard-day-strip">${dayTabsHtml}</div>
      <div class="qc-wizard-manage">
        <span class="qc-muted">Reorder / remove active day</span>
        <span class="qc-wizard-manage-btns">
          <button type="button" class="qc-cip-mini-btn" data-qc-report-action="move-up" data-day-index="${manageIdx}" ${manageIdx === 0 ? 'disabled' : ''} aria-label="Move up">&#8593;</button>
          <button type="button" class="qc-cip-mini-btn" data-qc-report-action="move-down" data-day-index="${manageIdx}" ${manageIdx === daysW.length - 1 ? 'disabled' : ''} aria-label="Move down">&#8595;</button>
          <button type="button" class="qc-cip-mini-btn" data-qc-report-action="remove" data-day-index="${manageIdx}" aria-label="Remove day">&times;</button>
        </span>
      </div>

      <div class="qc-wizard-card">
        <h4 class="qc-wizard-card-title">Day details</h4>
        <div class="qc-wizard-meta-grid">
          <label class="qc-bubble-field qc-bubble-field--compact"><span class="qc-bubble-label">Date</span>
            <input type="date" class="qc-input qc-bubble-input" value="${escapeHtml(day.date)}" data-qc-report-field="date" data-day-index="${dayIndex}" /></label>
          <label class="qc-bubble-field qc-bubble-field--compact"><span class="qc-bubble-label">Line</span>
            <input type="text" class="qc-input qc-bubble-input" value="${escapeHtml(day.line)}" data-qc-report-field="line" data-day-index="${dayIndex}" readonly /></label>
          <label class="qc-bubble-field qc-bubble-field--compact"><span class="qc-bubble-label">Size</span>
            <input type="text" class="qc-input qc-bubble-input" value="${escapeHtml(day.size)}" data-qc-report-field="size" data-day-index="${dayIndex}" readonly /></label>
          <label class="qc-bubble-field qc-bubble-field--wide"><span class="qc-bubble-label">Product</span>
            <input type="text" class="qc-input qc-bubble-input" value="${escapeHtml(day.product)}" data-qc-report-field="product" data-day-index="${dayIndex}" readonly /></label>
          <label class="qc-bubble-field qc-bubble-field--compact"><span class="qc-bubble-label">Shift</span>
            <input type="text" class="qc-input qc-bubble-input" value="${escapeHtml(day.shift || 'A+B')}" data-qc-report-field="shift" data-day-index="${dayIndex}" readonly /></label>
          <div class="qc-bubble-field qc-bubble-field--wide"><span class="qc-bubble-label">${escapeHtml(docCfg.color_label)} <small>(max 2)</small></span>
            <div class="qc-color-checkbox-group">${colorCheckboxesHtml}</div></div>
          <label class="qc-bubble-field qc-bubble-field--extra-wide"><span class="qc-bubble-label">Date code</span>
            <span class="qc-wizard-date-code-pair">
              <input type="text" class="qc-input qc-bubble-input" value="${escapeHtml(day.date_code_left || day.date_code || '')}" data-qc-report-field="date_code_left" data-day-index="${dayIndex}" placeholder="PD" />
              <input type="text" class="qc-input qc-bubble-input" value="${escapeHtml(day.date_code_right || '')}" data-qc-report-field="date_code_right" data-day-index="${dayIndex}" placeholder="EXP" />
            </span></label>
        </div>
        <label class="qc-bubble-field qc-bubble-field--wide qc-bubble-field--block"><span class="qc-bubble-label">Other comments</span>
          <textarea class="qc-textarea qc-bubble-textarea" data-qc-report-field="other_comments" data-day-index="${dayIndex}">${escapeHtml(day.other_comments)}</textarea></label>
        <div class="qc-wizard-sign-grid">
          <label class="qc-bubble-field qc-bubble-field--compact"><span class="qc-bubble-label">QC sign</span>
            ${signatorySelectHtml(day.qc_sign, `data-qc-report-field="qc_sign" data-day-index="${dayIndex}"`)}</label>
          <label class="qc-bubble-field qc-bubble-field--compact"><span class="qc-bubble-label">QAO sign</span>
            ${signatorySelectHtml(day.qao_sign, `data-qc-report-field="qao_sign" data-day-index="${dayIndex}"`)}</label>
          <label class="qc-bubble-field qc-bubble-field--compact"><span class="qc-bubble-label">QAM sign</span>
            ${signatorySelectHtml(day.qam_sign, `data-qc-report-field="qam_sign" data-day-index="${dayIndex}"`)}</label>
        </div>
      </div>

      <details class="qc-wizard-card qc-wizard-limits-details">
        <summary class="qc-wizard-card-title qc-wizard-summary">Limits (expectations row)</summary>
        <div class="qc-bubble-grid">${limitsHtml}</div>
      </details>

      ${buildQcReportSampleSummaryHtml(columns, rows)}

      <div class="qc-wizard-card">
        <div class="qc-wizard-sample-heading">
          <h4 class="qc-wizard-card-title qc-wizard-sample-heading__title">Sample row ${dataRowIndex}</h4>
          <div class="qc-wizard-row-nav qc-wizard-row-nav--inline">
            <button type="button" class="qc-btn" data-qc-wizard-action="prev-row" ${dataRowIndex <= 1 ? 'disabled' : ''}>Previous row</button>
            <button type="button" class="qc-btn qc-btn-primary" data-qc-wizard-action="next-row" ${dataRowIndex >= sampleTotal ? 'disabled' : ''}>Next row</button>
          </div>
        </div>
        <div class="qc-bubble-grid">${sampleHtml}</div>
      </div>
    </div>
  `;
}

function onQcReportDaysUnifiedClick(event) {
  const wizardDayEl = event.target && typeof event.target.closest === 'function'
    ? event.target.closest('[data-qc-wizard-day]')
    : null;
  if (wizardDayEl) {
    const idx = Number(wizardDayEl.getAttribute('data-qc-wizard-day'));
    if (!Number.isFinite(idx) || idx < 0) return;
    syncQcReportDomToStateIfVisible();
    const batchMeta = getSelectedBatchMeta();
    const base = normalizeQcReportData(getQcReportData() || {}, batchMeta);
    const days = Array.isArray(base.days) ? base.days : [];
    if (!days[idx]) return;
    state.qcReportWizard.dayIndex = idx;
    const dayRows = Array.isArray(days[idx].rows) ? days[idx].rows : [];
    state.qcReportWizard.dataRowIndex = findNextQcReportInsertionRow(dayRows);
    ensureQcReportWizardIndices(days);
    renderQcReportPanel();
    queueQcReportAutoSave();
    return;
  }

  const wizardActEl = event.target && typeof event.target.closest === 'function'
    ? event.target.closest('[data-qc-wizard-action]')
    : null;
  if (wizardActEl) {
    const act = String(wizardActEl.getAttribute('data-qc-wizard-action') || '').trim();
    syncQcReportDomToStateIfVisible();
    const batchMeta = getSelectedBatchMeta();
    const base = normalizeQcReportData(getQcReportData() || {}, batchMeta);
    const days = Array.isArray(base.days) ? base.days : [];
    const di = state.qcReportWizard.dayIndex;
    const rows = days[di] && Array.isArray(days[di].rows) ? days[di].rows : defaultQcReportRows();
    const maxData = Math.max(1, rows.length - 1);
    if (act === 'next-row') {
      state.qcReportWizard.dataRowIndex = Math.min(maxData, (state.qcReportWizard.dataRowIndex || 1) + 1);
    } else if (act === 'prev-row') {
      state.qcReportWizard.dataRowIndex = Math.max(1, (state.qcReportWizard.dataRowIndex || 1) - 1);
    }
    ensureQcReportWizardIndices(days);
    renderQcReportPanel();
    queueQcReportAutoSave();
    return;
  }

  const colorGroup = event.target && typeof event.target.closest === 'function'
    ? event.target.closest('.qc-color-checkbox-group')
    : null;
  if (colorGroup) {
    queueMicrotask(() => {
      applyQcReportClosureColorsFromGroup(colorGroup, null);
    });
    return;
  }

  onQcReportActionClick(event);
}

/**
 * Persist closure / can-end colour checkboxes for one group into app state and queue QC Report auto-save.
 * @param {Element} groupEl - .qc-color-checkbox-group
 * @param {HTMLInputElement | null} toggledEl - checkbox that fired change; used to enforce max 2 selections
 */
function applyQcReportClosureColorsFromGroup(groupEl, toggledEl) {
  if (!groupEl || typeof groupEl.querySelector !== 'function') return;
  const boxes = Array.from(groupEl.querySelectorAll('input[data-qc-color-check]'));
  if (!boxes.length) return;
  const dayIndex = Number(boxes[0].getAttribute('data-day-index'));
  if (!Number.isFinite(dayIndex) || dayIndex < 0) return;
  const checked = boxes.filter((cb) => cb.checked);
  if (toggledEl && checked.length > 2) {
    toggledEl.checked = false;
    return;
  }
  const combined = checked.map((cb) => cb.value).join(', ');
  const batchMeta = getSelectedBatchMeta();
  const base = normalizeQcReportData(getQcReportData() || {}, batchMeta);
  const days = Array.isArray(base.days) ? [...base.days] : [];
  const day = days[dayIndex] && typeof days[dayIndex] === 'object' ? { ...days[dayIndex] } : null;
  if (!day) return;
  day.closure_or_can_end_color = combined;
  days[dayIndex] = day;
  setQcReportData(normalizeQcReportData({ days }, batchMeta));
  queueQcReportAutoSave();
}

function onAddQcReportDay() {
  syncQcReportDomToStateIfVisible();
  const batchMeta = getSelectedBatchMeta();
  if (!state.selectedBatchNo || !batchMeta) {
    setStatus('Select a batch first.', true);
    showToast('Select a batch first.', true);
    return;
  }

  const base = normalizeQcReportData(getQcReportData() || {}, batchMeta);
  const days = Array.isArray(base.days) ? [...base.days] : [];
  days.push(buildBlankQcReportDay(batchMeta, days.length + 1));
  const next = normalizeQcReportData({ days }, batchMeta);
  setQcReportData(next);
  state.qcReportWizard.dayIndex = next.days.length - 1;
  state.qcReportWizard.dataRowIndex = 1;
  ensureQcReportWizardIndices(next.days);
  renderQcReportPanel();
  queueQcReportAutoSave();
}

function onQcReportActionClick(event) {
  const actionEl = event.target && typeof event.target.closest === 'function'
    ? event.target.closest('[data-qc-report-action]')
    : null;
  if (!actionEl) return;

  syncQcReportDomToStateIfVisible();

  const action = String(actionEl.getAttribute('data-qc-report-action') || '').trim();
  const dayIndex = Number(actionEl.getAttribute('data-day-index'));
  if (!action || !Number.isFinite(dayIndex) || dayIndex < 0) return;

  const batchMeta = getSelectedBatchMeta();
  const base = normalizeQcReportData(getQcReportData() || {}, batchMeta);
  const days = Array.isArray(base.days) ? [...base.days] : [];
  if (!days[dayIndex]) return;

  if (action === 'remove') {
    if (days.length <= 1) {
      days[0] = buildBlankQcReportDay(batchMeta, 1);
    } else {
      days.splice(dayIndex, 1);
    }
  } else if (action === 'move-up' && dayIndex > 0) {
    const current = days[dayIndex];
    days[dayIndex] = days[dayIndex - 1];
    days[dayIndex - 1] = current;
  } else if (action === 'move-down' && dayIndex < days.length - 1) {
    const current = days[dayIndex];
    days[dayIndex] = days[dayIndex + 1];
    days[dayIndex + 1] = current;
  }

  const next = normalizeQcReportData({ days }, batchMeta);
  setQcReportData(next);
  if (action === 'move-up' || action === 'move-down') {
    const movedTo = action === 'move-up' ? dayIndex - 1 : dayIndex + 1;
    if (movedTo >= 0 && movedTo < next.days.length) state.qcReportWizard.dayIndex = movedTo;
  } else if (action === 'remove') {
    state.qcReportWizard.dayIndex = Math.min(state.qcReportWizard.dayIndex, next.days.length - 1);
  }
  ensureQcReportWizardIndices(next.days);
  renderQcReportPanel();
  queueQcReportAutoSave();
}

function onQcReportFieldInput(event) {
  const el = event && event.target;
  if (!el || !el.getAttribute) return;

  if (el.hasAttribute('data-qc-color-check')) {
    const group = el.closest('.qc-color-checkbox-group');
    if (!group) return;
    applyQcReportClosureColorsFromGroup(group, el);
    return;
  }

  const field = String(el.getAttribute('data-qc-report-field') || '').trim();
  if (!field) return;

  const dayIndex = Number(el.getAttribute('data-day-index'));
  if (!Number.isFinite(dayIndex) || dayIndex < 0) return;

  const batchMeta = getSelectedBatchMeta();
  const base = normalizeQcReportData(getQcReportData() || {}, batchMeta);
  const days = Array.isArray(base.days) ? [...base.days] : [];
  const day = days[dayIndex] && typeof days[dayIndex] === 'object'
    ? { ...days[dayIndex], rows: Array.isArray(days[dayIndex].rows) ? [...days[dayIndex].rows] : defaultQcReportRows() }
    : null;
  if (!day) return;

  if (field === 'rows') {
    const rowIndex = Number(el.getAttribute('data-row-index'));
    const rowKey = String(el.getAttribute('data-row-key') || '').trim();
    if (!Number.isFinite(rowIndex) || rowIndex < 0 || !rowKey) return;
    const rows = Array.isArray(day.rows) ? [...day.rows] : defaultQcReportRows();
    const row = rows[rowIndex] && typeof rows[rowIndex] === 'object' ? { ...rows[rowIndex] } : {};
    row[rowKey] = String(el.value || '');
    rows[rowIndex] = row;
    if (rowIndex === 0 && rowKey === 'uv_light_on') {
      const newUv = row.uv_light_on;
      for (let i = 1; i < rows.length; i += 1) {
        const r = rows[i] && typeof rows[i] === 'object' ? { ...rows[i] } : {};
        r.uv_light_on = newUv;
        rows[i] = r;
      }
      const daysHost = document.getElementById('qc-report-days');
      if (daysHost) {
        daysHost
          .querySelectorAll(
            `select[data-qc-report-field="rows"][data-day-index="${dayIndex}"][data-row-key="uv_light_on"]:not([data-row-index="0"])`,
          )
          .forEach((sel) => { sel.value = newUv; });
      }
    }
    day.rows = rows;
  } else if (field === 'date') {
    day.date = toDateInputValue(el.value || '') || '';
  } else if (field !== 'line' && field !== 'product' && field !== 'size' && field !== 'shift' && field !== 'closure_or_can_end_color') {
    day[field] = String(el.value || '');
  }

  days[dayIndex] = day;
  setQcReportData(normalizeQcReportData({ days }, batchMeta));
  queueQcReportAutoSave();
}

function syncQcReportDomToStateIfVisible() {
  const panel = document.getElementById('qc-report-panel');
  const daysHost = document.getElementById('qc-report-days');
  const panelOpen = panel && !panel.classList.contains('qc-hidden');
  const batchMeta = getSelectedBatchMeta();
  if (!batchMeta || !state.selectedBatchNo) return;

  const base = normalizeQcReportData(getQcReportData() || {}, batchMeta);
  const days = Array.isArray(base.days)
    ? base.days.map((d) => ({
        ...d,
        rows: normalizeQcReportRows(d.rows, d.line).map((r) => ({ ...r })),
      }))
    : [];
  if (!days.length) return;

  if (panelOpen) {
    panel.querySelectorAll('[data-qc-report-field]').forEach((el) => {
    const tag = String(el.tagName || '').toLowerCase();
    if (tag === 'button') return;
    const field = String(el.getAttribute('data-qc-report-field') || '').trim();
    if (!field) return;
    const dayIndex = Number(el.getAttribute('data-day-index'));
    if (!Number.isFinite(dayIndex) || dayIndex < 0 || !days[dayIndex]) return;

    if (field === 'rows') {
      const rowIndex = Number(el.getAttribute('data-row-index'));
      const rowKey = String(el.getAttribute('data-row-key') || '').trim();
      if (!Number.isFinite(rowIndex) || rowIndex < 0 || !rowKey) return;
      const day = days[dayIndex];
      const rows = normalizeQcReportRows(day.rows, day.line).map((r) => ({ ...r }));
      const row = { ...(rows[rowIndex] || {}) };
      row[rowKey] = String(el.value || '');
      rows[rowIndex] = row;
      days[dayIndex] = { ...day, rows };
    } else {
      const day = {
        ...days[dayIndex],
        rows: normalizeQcReportRows(days[dayIndex].rows, days[dayIndex].line).map((r) => ({ ...r })),
      };
      if (field === 'date') {
        day.date = toDateInputValue(el.value || '') || '';
      } else if (field !== 'line' && field !== 'product' && field !== 'size' && field !== 'shift' && field !== 'closure_or_can_end_color') {
        day[field] = String(el.value || '');
      }
      days[dayIndex] = day;
    }
    });
  }

  const colorSyncRoot = daysHost || panel;
  if (colorSyncRoot) {
    colorSyncRoot.querySelectorAll('.qc-color-checkbox-group').forEach((group) => {
      const boxes = Array.from(group.querySelectorAll('input[data-qc-color-check]'));
      if (!boxes.length) return;
      const dayIndex = Number(boxes[0].getAttribute('data-day-index'));
      if (!Number.isFinite(dayIndex) || dayIndex < 0 || !days[dayIndex]) return;
      const checked = boxes.filter((cb) => cb.checked).map((cb) => cb.value);
      days[dayIndex] = { ...days[dayIndex], closure_or_can_end_color: checked.join(', ') };
    });
  }

  setQcReportData(normalizeQcReportData({ days }, batchMeta));
}

function collectQcReportPayload() {
  syncQcReportDomToStateIfVisible();
  const batchMeta = getSelectedBatchMeta();
  const base = normalizeQcReportData(getQcReportData() || {}, batchMeta);
  const days = Array.isArray(base.days) ? base.days : [];
  return {
    days: days.map((day) => ({
      id: String(day.id || ''),
      order: Number(day.order || 0),
      line: normalizeQcReportLine(day.line),
      report_title: String(day.report_title || ''),
      doc_ref: String(day.doc_ref || ''),
      issue_no: String(day.issue_no || ''),
      effective_date: String(day.effective_date || ''),
      page_text: String(day.page_text || ''),
      color_label: String(day.color_label || ''),
      date: toDateInputValue(day.date || '') || '',
      batch_no: String(day.batch_no || batchMeta?.batch_no || state.selectedBatchNo || '').trim(),
      qao: String(day.qao || ''),
      product: String(day.product || ''),
      shift: String(day.shift || '').trim() || 'A+B',
      size: String(day.size || ''),
      date_code: String(day.date_code_left || day.date_code || ''),
      date_code_left: String(day.date_code_left || day.date_code || ''),
      date_code_right: String(day.date_code_right || ''),
      exp: String(day.exp || ''),
      pd: String(day.pd || ''),
      closure_or_can_end_color: String(day.closure_or_can_end_color || ''),
      rows: normalizeQcReportRows(day.rows, day.line).map((row) => {
        const normalizedRow = {};
        QC_REPORT_COLUMN_KEYS.forEach((key) => {
          const v = row[key];
          normalizedRow[key] = v === undefined || v === null ? '' : String(v);
        });
        return normalizedRow;
      }),
      other_comments: String(day.other_comments || ''),
      qc_sign: String(day.qc_sign || ''),
      qao_sign: String(day.qao_sign || ''),
      qam_sign: String(day.qam_sign || ''),
    })),
  };
}

async function saveQcReportPayload(payload, options = {}) {
  const rerender = options.rerender !== false;
  const successStatus = typeof options.successStatus === 'string' ? options.successStatus : '';
  const successToast = typeof options.successToast === 'string' ? options.successToast : '';

  const result = await qcSaveQcReport(state.selectedBatchNo, payload);
  const normalized = normalizeQcReportData(result.data || payload, getSelectedBatchMeta());
  setQcReportData(normalized);
  setQcReportLastSavedSnapshot(serializeMixingSnapshot(payload));

  if (rerender && isQcReportSubmenu()) renderQcReportPanel();
  if (successStatus) setStatus(successStatus);
  if (successToast) showToast(successToast);
  return { result, data: normalized };
}

async function runQcReportAutoSave() {
  syncQcReportDomToStateIfVisible();
  const isActiveSection = isQcReportSubmenu();
  if (!state.selectedBatchNo) return;
  if (getQcReportAutoSaveInFlight()) {
    setQcReportAutoSaveQueued(true);
    return;
  }

  const payload = collectQcReportPayload();
  if (!Array.isArray(payload.days) || !payload.days.length) return;

  const snapshot = serializeMixingSnapshot(payload);
  if (snapshot && snapshot === getQcReportLastSavedSnapshot()) return;

  setQcReportAutoSaveInFlight(true);
  try {
    await saveQcReportPayload(payload, { rerender: false });
    if (isActiveSection) setStatus('Auto-saved QC Report.');
  } catch (err) {
    if (isActiveSection) setStatus(err.message || 'Failed to auto-save QC Report.', true);
  } finally {
    setQcReportAutoSaveInFlight(false);
    if (getQcReportAutoSaveQueued()) {
      setQcReportAutoSaveQueued(false);
      queueQcReportAutoSave();
    }
  }
}

function queueQcReportAutoSave() {
  if (!state.selectedBatchNo) return;
  const existingTimer = getQcReportAutoSaveTimer();
  if (existingTimer) window.clearTimeout(existingTimer);
  const timerId = window.setTimeout(() => {
    setQcReportAutoSaveTimer(null);
    void runQcReportAutoSave();
  }, QC_REPORT_AUTO_SAVE_DELAY_MS);
  setQcReportAutoSaveTimer(timerId);
}

function initQcReportAutoSaveEnhancements() {
  if (typeof window !== 'undefined' && window.__qcReportAutoSaveEnhancementsDone) return;
  if (typeof window !== 'undefined') window.__qcReportAutoSaveEnhancementsDone = true;

  document.getElementById('qc-report-days')?.addEventListener('focusout', () => {
    if (!state.selectedBatchNo) return;
    syncQcReportDomToStateIfVisible();
    queueQcReportAutoSave();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && state.selectedBatchNo) {
      void flushQcReportPendingSave();
    }
  });
}

async function onSaveQcReport() {
  if (!state.selectedBatchNo) {
    setStatus('Select a batch first.', true);
    showToast('Select a batch first.', true);
    return;
  }

  try {
    const payload = collectQcReportPayload();
    setStatus('Saving QC Report...');
    await saveQcReportPayload(payload, {
      rerender: true,
      successStatus: 'QC Report saved.',
      successToast: 'QC Report saved.',
    });
  } catch (err) {
    setStatus(err.message || 'Failed to save QC Report.', true);
    showToast(err.message || 'Failed to save QC Report.', true);
  }
}

async function onSaveQcReportPdf() {
  if (!state.selectedBatchNo) {
    setStatus('Select a batch first.', true);
    showToast('Select a batch first.', true);
    return;
  }

  try {
    const payload = collectQcReportPayload();
    const days = Array.isArray(payload.days) ? payload.days : [];
    if (!days.length) {
      const message = 'Add at least one QC Report day before saving PDF.';
      setStatus(message, true);
      showToast(message, true);
      return;
    }

    setStatus('Saving QC Report and generating PDF...');
    await saveQcReportPayload(payload, { rerender: false });

    const blob = await qcDownloadQcReportPdf(state.selectedBatchNo);
    const batchNoRaw = String(state.selectedBatchNo || '').trim();
    const safeBatchNo = batchNoRaw.replace(/[<>:"/\\|?*\x00-\x1f]+/g, '_') || 'batch';
    const fileName = `${safeBatchNo}_QC_Report.pdf`;
    const fileLike = typeof File === 'function'
      ? new File([blob], fileName, { type: 'application/pdf' })
      : blob;
    const url = window.URL.createObjectURL(fileLike);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 60000);

    setStatus('QC Report PDF downloaded.');
    showToast('QC Report PDF downloaded.');
  } catch (err) {
    setStatus(err.message || 'Failed to generate QC Report PDF.', true);
    showToast(err.message || 'Failed to generate QC Report PDF.', true);
  }
}

async function loadSelectedQcReport() {
  if (!state.selectedBatchNo) {
    setQcReportData(null);
    resetQcReportAutoSaveState();
    setQcReportLastSavedSnapshot('');
    showMixingEmpty('Select a batch to open QC Report.');
    return;
  }

  const batchMeta = getSelectedBatchMeta();
  try {
    if (!state.mixingData) {
      try {
        const mixData = await qcGetMixing(state.selectedBatchNo);
        state.mixingData = normalizeMixingData(mixData, batchMeta);
      } catch (_) { /* mixing data optional */ }
    }
    const data = await qcGetQcReport(state.selectedBatchNo);
    const normalized = normalizeQcReportData(data, batchMeta);
    setQcReportData(normalized);
    state.qcReportWizard.dayIndex = 0;
    const firstDayRows = (normalized.days && normalized.days[0] && Array.isArray(normalized.days[0].rows))
      ? normalized.days[0].rows
      : [];
    state.qcReportWizard.dataRowIndex = findNextQcReportInsertionRow(firstDayRows);
    state.qcReportWizard.timeAutofillKey = '';
    state.qcReportWizard.timeAutofilledRows = new Set();
    ensureQcReportWizardIndices(normalized.days);
    resetQcReportAutoSaveState();
    setQcReportLastSavedSnapshot(serializeMixingSnapshot(normalized));
    if (isQcReportSubmenu()) renderQcReportPanel();
  } catch (err) {
    setQcReportData(null);
    resetQcReportAutoSaveState();
    setQcReportLastSavedSnapshot('');
    if (isQcReportSubmenu()) {
      showMixingEmpty(err.message || 'Failed to load QC Report.');
      setStatus(err.message || 'Failed to load QC Report.', true);
    }
  }
}

function renderSeamCheckPanel() {
  if (!isSeamCheckSubmenu()) return;
  const batchMeta = getSelectedBatchMeta();
  if (!state.selectedBatchNo || !batchMeta) {
    showMixingEmpty('Select a batch to open Seam Check.');
    return;
  }

  const emptyEl = document.getElementById('qc-mixing-empty');
  const mixingPanelEl = document.getElementById('qc-mixing-panel');
  const tankPanelEl = document.getElementById('qc-tank-cip-panel');
  const reportPanelEl = document.getElementById('qc-report-panel');
  const seamPanelEl = document.getElementById('qc-seam-panel');
  const configPanelEl = document.getElementById('qc-mixing-config-panel');
  const seamEmptyEl = document.getElementById('qc-seam-empty');
  const seamHost = document.getElementById('qc-seam-sheet-wrap');

  if (emptyEl) emptyEl.classList.add('qc-hidden');
  if (mixingPanelEl) mixingPanelEl.classList.add('qc-hidden');
  if (tankPanelEl) tankPanelEl.classList.add('qc-hidden');
  if (reportPanelEl) reportPanelEl.classList.add('qc-hidden');
  if (seamPanelEl) seamPanelEl.classList.remove('qc-hidden');
  if (configPanelEl) configPanelEl.classList.add('qc-hidden');
  hideQcPickingPanel();
  if (!seamHost) return;

  const supported = batchSupportsSeam(batchMeta);
  if (!supported) {
    seamHost.innerHTML = '';
    if (seamEmptyEl) {
      seamEmptyEl.textContent = 'Seam Check is available only for CAN batches.';
      seamEmptyEl.classList.remove('qc-hidden');
    }
    return;
  }
  if (seamEmptyEl) seamEmptyEl.classList.add('qc-hidden');

  const data = normalizeSeamCheckData(getSeamCheckData() || {}, batchMeta);
  setSeamCheckData(data);
  const specs = data.specifications || {};
  const rows = Array.isArray(data.rows) ? data.rows : defaultSeamCheckRows();
  const header = data.header || {};
  const footer = data.footer || {};

  ensureSeamCheckWizardIndex(rows.length);
  const rowIndex = state.seamCheckWizard.rowIndex;
  const row = rows[rowIndex] && typeof rows[rowIndex] === 'object' ? rows[rowIndex] : {};

  const specByKey = {
    countersink_depth: String(specs.countersink_depth || SEAM_CHECK_SPECIFICATIONS.countersink_depth),
    body_hook_length: String(specs.body_hook_length || SEAM_CHECK_SPECIFICATIONS.body_hook_length),
    cover_hook_length: String(specs.cover_hook_length || SEAM_CHECK_SPECIFICATIONS.cover_hook_length),
    tightness_rating: String(specs.tightness_rating || SEAM_CHECK_SPECIFICATIONS.tightness_rating),
    operational_seam_length: String(specs.operational_seam_length || SEAM_CHECK_SPECIFICATIONS.operational_seam_length),
    seam_thickness: String(specs.seam_thickness || SEAM_CHECK_SPECIFICATIONS.seam_thickness),
  };
  const specsLineHtml = SEAM_CHECK_TABLE_GROUPS.filter((g) => g.specKey)
    .map((g) => {
      const v = specByKey[g.specKey] || '';
      const lab = String(g.label || '').replace(/<br \/>/gi, ' ');
      return `<span class="qc-seam-spec-chip"><strong>${escapeHtml(lab)}</strong> ${escapeHtml(v)}</span>`;
    })
    .join('');

  const measureBubbles = SEAM_CHECK_TABLE_GROUPS
    .filter((group) => group.key !== 'head')
    .map((group) => {
      const groupLabel = String(group.label || group.key).replace(/<br \/>/gi, ' ');

      if (group.kind === 'triplet') {
        const subInputs = [1, 2, 3].map((slot) => {
          const subKey = `${group.key}_${slot}`;
          const val = String((row && row[subKey]) || '');
          const attrs = `data-seam-field="rows" data-row-index="${rowIndex}" data-row-key="${escapeHtml(subKey)}"`;
          return `
            <div class="qc-bubble-subfield">
              <span class="qc-bubble-sublabel">(${slot})</span>
              <input type="text" class="qc-input qc-bubble-input qc-bubble-input--sub" value="${escapeHtml(val)}" ${attrs} />
            </div>`;
        }).join('');

        return `
          <div class="qc-bubble-field qc-bubble-field--group">
            <span class="qc-bubble-label">${escapeHtml(groupLabel)}</span>
            <div class="qc-bubble-subgrid">${subInputs}</div>
          </div>`;
      }

      const value = String((row && row[group.key]) || '');
      const rowAttrs = `data-seam-field="rows" data-row-index="${rowIndex}" data-row-key="${escapeHtml(group.key)}"`;
      if (group.key === 'tightness_rating') {
        const allowed = new Set(SEAM_CHECK_TIGHTNESS_RATING_OPTIONS);
        const parts = ['<option value=""></option>'];
        SEAM_CHECK_TIGHTNESS_RATING_OPTIONS.forEach((o) => {
          const sel = value === o ? ' selected' : '';
          parts.push(`<option value="${escapeHtml(o)}"${sel}>${escapeHtml(o)}</option>`);
        });
        if (value && !allowed.has(value)) {
          parts.push(`<option value="${escapeHtml(value)}" selected>${escapeHtml(value)}</option>`);
        }
        return `<label class="qc-bubble-field"><span class="qc-bubble-label">${escapeHtml(groupLabel)}</span><select class="qc-input qc-bubble-input" ${rowAttrs}>${parts.join('')}</select></label>`;
      }
      return `<label class="qc-bubble-field"><span class="qc-bubble-label">${escapeHtml(groupLabel)}</span><input type="text" class="qc-input qc-bubble-input" value="${escapeHtml(value)}" ${rowAttrs} /></label>`;
    })
    .join('');

  const headDisplay = String(row.head || '').trim() || String(rowIndex + 1);
  const lastIdx = rows.length - 1;

  seamHost.innerHTML = `
    <div class="qc-wizard">
      <p class="qc-wizard-docref qc-muted">${escapeHtml(data.report_title || SEAM_CHECK_DOC_CONFIG.report_title)} · ${escapeHtml(data.doc_ref || SEAM_CHECK_DOC_CONFIG.doc_ref)}</p>

      <div class="qc-wizard-card">
        <h4 class="qc-wizard-card-title">Header</h4>
        <div class="qc-wizard-meta-grid">
          <label class="qc-bubble-field qc-bubble-field--compact"><span class="qc-bubble-label">Date</span>
            <input type="date" class="qc-input qc-bubble-input" value="${escapeHtml(header.date || '')}" data-seam-field="date" /></label>
          <label class="qc-bubble-field qc-bubble-field--wide"><span class="qc-bubble-label">Can batch no.</span>
            <input type="text" class="qc-input qc-bubble-input" value="${escapeHtml(header.can_batch_no || '')}" data-seam-field="can_batch_no" /></label>
          <label class="qc-bubble-field qc-bubble-field--wide"><span class="qc-bubble-label">Can end batch no.</span>
            <input type="text" class="qc-input qc-bubble-input" value="${escapeHtml(header.can_end_batch_no || '')}" data-seam-field="can_end_batch_no" /></label>
          <label class="qc-bubble-field qc-bubble-field--wide"><span class="qc-bubble-label">Product</span>
            <input type="text" class="qc-input qc-bubble-input" value="${escapeHtml(header.product || '')}" readonly /></label>
          <label class="qc-bubble-field qc-bubble-field--compact"><span class="qc-bubble-label">Batch no.</span>
            <input type="text" class="qc-input qc-bubble-input" value="${escapeHtml(header.batch_no || '')}" readonly /></label>
          <label class="qc-bubble-field qc-bubble-field--compact"><span class="qc-bubble-label">Can size</span>
            <input type="text" class="qc-input qc-bubble-input" value="${escapeHtml(header.can_size || '')}" readonly /></label>
        </div>
      </div>

      <div class="qc-wizard-card qc-seam-specs-card">
        <h4 class="qc-wizard-card-title">Specifications</h4>
        <div class="qc-seam-spec-chips">${specsLineHtml}</div>
      </div>

      ${buildSeamCheckSampleSummaryHtml(rows)}

      <div class="qc-wizard-card">
        <div class="qc-wizard-sample-heading">
          <h4 class="qc-wizard-card-title qc-wizard-sample-heading__title">Seam row ${rowIndex + 1} of ${rows.length} <span class="qc-muted qc-wizard-head-label">(head ${escapeHtml(headDisplay)})</span></h4>
          <div class="qc-wizard-row-nav qc-wizard-row-nav--inline">
            <button type="button" class="qc-btn" data-seam-wizard-action="prev-row" ${rowIndex <= 0 ? 'disabled' : ''}>Previous row</button>
            <button type="button" class="qc-btn qc-btn-primary" data-seam-wizard-action="next-row" ${rowIndex >= lastIdx ? 'disabled' : ''}>Next row</button>
          </div>
        </div>
        <div class="qc-bubble-grid">${measureBubbles}</div>
      </div>

      <div class="qc-wizard-card">
        <h4 class="qc-wizard-card-title">Signatures</h4>
        <div class="qc-wizard-sign-grid">
          <label class="qc-bubble-field qc-bubble-field--compact"><span class="qc-bubble-label">QAO</span>
            ${signatorySelectHtml(footer.qao_sign || '', 'data-seam-field="qao_sign"')}</label>
          <label class="qc-bubble-field qc-bubble-field--compact"><span class="qc-bubble-label">QAM</span>
            ${signatorySelectHtml(footer.qam_sign || '', 'data-seam-field="qam_sign"')}</label>
        </div>
      </div>
    </div>
  `;
}

function onSeamWizardClick(event) {
  const el = event.target && typeof event.target.closest === 'function'
    ? event.target.closest('[data-seam-wizard-action]')
    : null;
  if (!el) return;
  const act = String(el.getAttribute('data-seam-wizard-action') || '').trim();
  const batchMeta = getSelectedBatchMeta();
  const base = normalizeSeamCheckData(getSeamCheckData() || {}, batchMeta);
  const rows = normalizeSeamCheckRows(base.rows);
  const lastIdx = Math.max(0, rows.length - 1);
  if (act === 'next-row') {
    state.seamCheckWizard.rowIndex = Math.min(lastIdx, (state.seamCheckWizard.rowIndex || 0) + 1);
  } else if (act === 'prev-row') {
    state.seamCheckWizard.rowIndex = Math.max(0, (state.seamCheckWizard.rowIndex || 0) - 1);
  }
  ensureSeamCheckWizardIndex(rows.length);
  renderSeamCheckPanel();
}

function onSeamCheckFieldInput(event) {
  const el = event && event.target;
  if (!el || !el.getAttribute) return;
  const field = String(el.getAttribute('data-seam-field') || '').trim();
  if (!field) return;
  if (!state.selectedBatchNo) return;

  const batchMeta = getSelectedBatchMeta();
  const base = normalizeSeamCheckData(getSeamCheckData() || {}, batchMeta);
  const next = {
    ...base,
    header: { ...(base.header || {}) },
    rows: normalizeSeamCheckRows(base.rows),
    footer: { ...(base.footer || {}) },
  };

  if (field === 'rows') {
    const rowIndex = Number(el.getAttribute('data-row-index'));
    const rowKey = String(el.getAttribute('data-row-key') || '').trim();
    if (!Number.isFinite(rowIndex) || rowIndex < 0 || rowIndex >= next.rows.length || !SEAM_CHECK_ROW_INPUT_KEYS.includes(rowKey)) {
      return;
    }
    const row = next.rows[rowIndex] && typeof next.rows[rowIndex] === 'object'
      ? { ...next.rows[rowIndex] }
      : { ...defaultSeamCheckRows()[rowIndex] };
    row[rowKey] = String(el.value || '');
    row.head = seamCheckRowHasValue(row) ? String(rowIndex + 1) : '';
    next.rows[rowIndex] = row;
    const rowHeadEl = document.querySelector(`input[data-seam-head-index="${rowIndex}"]`);
    if (rowHeadEl) rowHeadEl.value = row.head;
  } else if (field === 'date') {
    next.header.date = toDateInputValue(el.value || '') || '';
  } else if (field === 'can_batch_no' || field === 'can_end_batch_no') {
    next.header[field] = String(el.value || '');
  } else if (field === 'qao_sign' || field === 'qam_sign') {
    next.footer[field] = String(el.value || '');
  } else {
    return;
  }

  setSeamCheckData(normalizeSeamCheckData(next, batchMeta));
  queueSeamCheckAutoSave();
}

function collectSeamCheckPayload() {
  const batchMeta = getSelectedBatchMeta();
  const base = normalizeSeamCheckData(getSeamCheckData() || {}, batchMeta);
  return {
    ...base,
    header: {
      date: toDateInputValue((base.header && base.header.date) || '') || '',
      can_batch_no: String((base.header && base.header.can_batch_no) || ''),
      can_end_batch_no: String((base.header && base.header.can_end_batch_no) || ''),
      product: String((base.header && base.header.product) || ''),
      batch_no: String((base.header && base.header.batch_no) || ''),
      can_size: String((base.header && base.header.can_size) || ''),
    },
    rows: normalizeSeamCheckRows(base.rows).map((row, idx) => {
      const out = { head: '' };
      SEAM_CHECK_ROW_INPUT_KEYS.forEach((key) => {
        out[key] = String(row[key] || '');
      });
      out.head = seamCheckRowHasValue(out) ? String(idx + 1) : '';
      return out;
    }),
    footer: {
      qao_sign: String((base.footer && base.footer.qao_sign) || ''),
      qam_sign: String((base.footer && base.footer.qam_sign) || ''),
    },
  };
}

async function saveSeamCheckPayload(payload, options = {}) {
  const rerender = options.rerender !== false;
  const successStatus = typeof options.successStatus === 'string' ? options.successStatus : '';
  const successToast = typeof options.successToast === 'string' ? options.successToast : '';

  const result = await qcSaveSeamCheck(state.selectedBatchNo, payload);
  const normalized = normalizeSeamCheckData(result.data || payload, getSelectedBatchMeta());
  setSeamCheckData(normalized);
  setSeamCheckLastSavedSnapshot(serializeMixingSnapshot(payload));

  if (rerender && isSeamCheckSubmenu()) renderSeamCheckPanel();
  if (successStatus) setStatus(successStatus);
  if (successToast) showToast(successToast);
  return { result, data: normalized };
}

async function runSeamCheckAutoSave() {
  const isActiveSection = isSeamCheckSubmenu();
  if (!state.selectedBatchNo || !selectedBatchSupportsSeam()) return;
  if (getSeamCheckAutoSaveInFlight()) {
    setSeamCheckAutoSaveQueued(true);
    return;
  }

  const payload = collectSeamCheckPayload();
  const snapshot = serializeMixingSnapshot(payload);
  if (snapshot && snapshot === getSeamCheckLastSavedSnapshot()) return;

  setSeamCheckAutoSaveInFlight(true);
  try {
    await saveSeamCheckPayload(payload, { rerender: false });
    if (isActiveSection) setStatus('Auto-saved Seam Check.');
  } catch (err) {
    if (isActiveSection) setStatus(err.message || 'Failed to auto-save Seam Check.', true);
  } finally {
    setSeamCheckAutoSaveInFlight(false);
    if (getSeamCheckAutoSaveQueued()) {
      setSeamCheckAutoSaveQueued(false);
      queueSeamCheckAutoSave();
    }
  }
}

function queueSeamCheckAutoSave() {
  if (!state.selectedBatchNo || !selectedBatchSupportsSeam()) return;
  const existingTimer = getSeamCheckAutoSaveTimer();
  if (existingTimer) window.clearTimeout(existingTimer);
  const timerId = window.setTimeout(() => {
    setSeamCheckAutoSaveTimer(null);
    void runSeamCheckAutoSave();
  }, SEAM_CHECK_AUTO_SAVE_DELAY_MS);
  setSeamCheckAutoSaveTimer(timerId);
}

async function onSaveSeamCheck() {
  if (!state.selectedBatchNo) {
    setStatus('Select a batch first.', true);
    showToast('Select a batch first.', true);
    return;
  }
  if (!selectedBatchSupportsSeam()) {
    setStatus('Seam Check is available only for CAN batches.', true);
    showToast('Seam Check is available only for CAN batches.', true);
    return;
  }

  try {
    const payload = collectSeamCheckPayload();
    setStatus('Saving Seam Check...');
    await saveSeamCheckPayload(payload, {
      rerender: true,
      successStatus: 'Seam Check saved.',
      successToast: 'Seam Check saved.',
    });
  } catch (err) {
    setStatus(err.message || 'Failed to save Seam Check.', true);
    showToast(err.message || 'Failed to save Seam Check.', true);
  }
}

async function onSaveSeamCheckPdf() {
  if (!state.selectedBatchNo) {
    setStatus('Select a batch first.', true);
    showToast('Select a batch first.', true);
    return;
  }
  if (!selectedBatchSupportsSeam()) {
    setStatus('Seam Check is available only for CAN batches.', true);
    showToast('Seam Check is available only for CAN batches.', true);
    return;
  }

  try {
    const payload = collectSeamCheckPayload();
    setStatus('Saving Seam Check and generating PDF...');
    await saveSeamCheckPayload(payload, { rerender: false });

    const blob = await qcDownloadSeamCheckPdf(state.selectedBatchNo);
    const batchNoRaw = String(state.selectedBatchNo || '').trim();
    const safeBatchNo = batchNoRaw.replace(/[<>:"/\\|?*\x00-\x1f]+/g, '_') || 'batch';
    const fileName = `${safeBatchNo}_Seam_Check.pdf`;
    const fileLike = typeof File === 'function'
      ? new File([blob], fileName, { type: 'application/pdf' })
      : blob;
    const url = window.URL.createObjectURL(fileLike);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 60000);

    setStatus('Seam Check PDF downloaded.');
    showToast('Seam Check PDF downloaded.');
  } catch (err) {
    setStatus(err.message || 'Failed to generate Seam Check PDF.', true);
    showToast(err.message || 'Failed to generate Seam Check PDF.', true);
  }
}

function updateCurrentBatchContextBar() {
  const bar = document.getElementById('qc-current-batch-bar');
  const noEl = document.getElementById('qc-current-batch-no');
  const recipeEl = document.getElementById('qc-current-batch-recipe');
  const showAllBtn = document.getElementById('qc-show-all-batches-btn');
  if (!bar || !noEl || !recipeEl) return;

  const isConfig = state.activeSubmenu === 'configure_mixing';
  const row = getSelectedBatchMeta();

  if (!state.selectedBatchNo || isConfig || !row) {
    bar.classList.add('qc-hidden');
    if (showAllBtn) showAllBtn.classList.add('qc-hidden');
    return;
  }

  bar.classList.remove('qc-hidden');
  noEl.textContent = String(row.batch_no || '').trim() || '—';
  const recipeLine = String(row.product_name || row.recipe_name || '').trim();
  recipeEl.textContent = recipeLine || '—';

  if (showAllBtn) {
    const searchEl = document.getElementById('qc-batch-search');
    const hasSearch = Boolean(searchEl && String(searchEl.value || '').trim());
    showAllBtn.classList.toggle('qc-hidden', !hasSearch);
  }
}

async function loadSelectedSeamCheck() {
  if (!state.selectedBatchNo) {
    setSeamCheckData(null);
    resetSeamCheckAutoSaveState();
    setSeamCheckLastSavedSnapshot('');
    showMixingEmpty('Select a batch to open Seam Check.');
    return;
  }

  const batchMeta = getSelectedBatchMeta();
  if (!batchSupportsSeam(batchMeta)) {
    const fallback = normalizeSeamCheckData({}, batchMeta);
    setSeamCheckData(fallback);
    state.seamCheckWizard.rowIndex = 0;
    resetSeamCheckAutoSaveState();
    setSeamCheckLastSavedSnapshot('');
    if (isSeamCheckSubmenu()) renderSeamCheckPanel();
    return;
  }

  try {
    const data = await qcGetSeamCheck(state.selectedBatchNo);
    const normalized = normalizeSeamCheckData(data, batchMeta);
    setSeamCheckData(normalized);
    const seamRows = Array.isArray(normalized.rows) ? normalized.rows : [];
    state.seamCheckWizard.rowIndex = findNextSeamCheckInsertionRow(seamRows);
    ensureSeamCheckWizardIndex(seamRows.length || SEAM_CHECK_HEAD_COUNT);
    resetSeamCheckAutoSaveState();
    setSeamCheckLastSavedSnapshot(serializeMixingSnapshot(normalized));
    if (isSeamCheckSubmenu()) renderSeamCheckPanel();
  } catch (err) {
    setSeamCheckData(null);
    resetSeamCheckAutoSaveState();
    setSeamCheckLastSavedSnapshot('');
    if (isSeamCheckSubmenu()) {
      showMixingEmpty(err.message || 'Failed to load Seam Check.');
      setStatus(err.message || 'Failed to load Seam Check.', true);
    }
  }
}

async function flushMixingAutoSaveForBatchSwitch() {
  if (state.activeSubmenu !== 'mixing' || !state.selectedBatchNo) return;
  for (let guard = 0; guard < 25; guard += 1) {
    if (state.mixingAutoSaveTimer) {
      window.clearTimeout(state.mixingAutoSaveTimer);
      state.mixingAutoSaveTimer = null;
    }
    while (state.mixingAutoSaveInFlight) {
      await new Promise((r) => setTimeout(r, 30));
    }
    await runMixingAutoSave();
    while (state.mixingAutoSaveInFlight) {
      await new Promise((r) => setTimeout(r, 30));
    }
    if (!state.mixingAutoSaveTimer && !state.mixingAutoSaveQueued) break;
    if (state.mixingAutoSaveQueued) {
      state.mixingAutoSaveQueued = false;
    }
  }
}

async function flushCipAutoSaveForBatchSwitch() {
  if (!state.selectedBatchNo) return;
  await flushCipAutoSaveForSection('tank_cip');
  await flushCipAutoSaveForSection('filler_mixer_cip');
}

/** Persist QC Report when leaving the tab or switching batches (not only while QC Report is visible). */
async function flushQcReportPendingSave() {
  if (!state.selectedBatchNo || getQcReportData() == null) return;
  for (let guard = 0; guard < 25; guard += 1) {
    const timer = getQcReportAutoSaveTimer();
    if (timer) {
      window.clearTimeout(timer);
      setQcReportAutoSaveTimer(null);
    }
    while (getQcReportAutoSaveInFlight()) {
      await new Promise((r) => setTimeout(r, 30));
    }
    syncQcReportDomToStateIfVisible();
    await runQcReportAutoSave();
    while (getQcReportAutoSaveInFlight()) {
      await new Promise((r) => setTimeout(r, 30));
    }
    if (!getQcReportAutoSaveTimer() && !getQcReportAutoSaveQueued()) break;
    if (getQcReportAutoSaveQueued()) {
      setQcReportAutoSaveQueued(false);
    }
  }
}

async function flushQcReportAutoSaveForBatchSwitch() {
  await flushQcReportPendingSave();
}

/** Persist Seam Check when leaving the tab or switching batches. */
async function flushSeamCheckPendingSave() {
  if (!state.selectedBatchNo || !selectedBatchSupportsSeam() || getSeamCheckData() == null) return;
  for (let guard = 0; guard < 25; guard += 1) {
    const timer = getSeamCheckAutoSaveTimer();
    if (timer) {
      window.clearTimeout(timer);
      setSeamCheckAutoSaveTimer(null);
    }
    while (getSeamCheckAutoSaveInFlight()) {
      await new Promise((r) => setTimeout(r, 30));
    }
    await runSeamCheckAutoSave();
    while (getSeamCheckAutoSaveInFlight()) {
      await new Promise((r) => setTimeout(r, 30));
    }
    if (!getSeamCheckAutoSaveTimer() && !getSeamCheckAutoSaveQueued()) break;
    if (getSeamCheckAutoSaveQueued()) {
      setSeamCheckAutoSaveQueued(false);
    }
  }
}

async function flushSeamCheckAutoSaveForBatchSwitch() {
  await flushSeamCheckPendingSave();
}

async function flushPendingAutoSavesBeforeBatchSwitch() {
  if (!state.selectedBatchNo) return;
  await flushMixingAutoSaveForBatchSwitch();
  await flushCipAutoSaveForBatchSwitch();
  await flushQcReportAutoSaveForBatchSwitch();
  await flushSeamCheckAutoSaveForBatchSwitch();
}

function ensureQcBatchResultsHost() {
  let el = document.getElementById('qc-batch-results');
  if (el) return el;
  const wrap = document.querySelector('.qc-batch-sidebar');
  if (!wrap) return null;
  el = document.createElement('div');
  el.id = 'qc-batch-results';
  el.className = 'qc-batch-results';
  el.setAttribute('role', 'listbox');
  el.setAttribute('aria-label', 'Batch list');
  wrap.appendChild(el);
  return el;
}

function renderBatchList() {
  const host = ensureQcBatchResultsHost();
  if (!host) return;

  const searchEl = document.getElementById('qc-batch-search');
  const rawQuery = String((searchEl && searchEl.value) || '').trim();
  const query = rawQuery.toLowerCase();

  if (!state.batches.length) {
    host.classList.remove('qc-hidden');
    host.classList.add('qc-batch-results--hint');
    host.innerHTML = '<div class="qc-muted">No QC batches found.</div>';
    updateSeamSubmenuVisibility();
    showMixingEmpty('No QC batches found. Push a batch to production first.');
    updateCurrentBatchContextBar();
    return;
  }

  host.classList.remove('qc-batch-results--hint');
  host.classList.remove('qc-hidden');

  let filtered = query
    ? state.batches.filter((batch) => {
        const text = `${batch.batch_no} ${batch.product_name || ''} ${batch.recipe_name || ''}`.toLowerCase();
        return text.includes(query);
      })
    : [...state.batches];

  filtered.sort((a, b) => {
    const numA = parseInt((a.batch_no || '').replace(/\D/g, ''), 10) || 0;
    const numB = parseInt((b.batch_no || '').replace(/\D/g, ''), 10) || 0;
    return numB - numA;
  });

  if (!filtered.length) {
    host.classList.remove('qc-hidden');
    host.innerHTML = '<div class="qc-muted">No batches match your search.</div>';
    updateSeamSubmenuVisibility();
    updateCurrentBatchContextBar();
    return;
  }

  host.classList.remove('qc-hidden');
  host.innerHTML = filtered
    .map((batch) => {
      const active = batch.batch_no === state.selectedBatchNo ? 'active' : '';
      const product = batch.product_name || batch.recipe_name || '';
      return `
        <div class="qc-batch-item ${active}" data-batch="${batch.batch_no}" role="option">
          <div class="qc-batch-item-header">
            <div><strong>${escapeHtml(batch.batch_no)}</strong></div>
          </div>
          <div class="qc-muted">${escapeHtml(product)}</div>
          <div class="qc-muted">${escapeHtml(batch.updated_at || '')}</div>
        </div>
      `;
    })
    .join('');

  host.querySelectorAll('.qc-batch-item').forEach((item) => {
    item.addEventListener('click', () => {
      void selectBatch(item.getAttribute('data-batch'));
    });
  });
  updateSeamSubmenuVisibility();
  updateCurrentBatchContextBar();
}

function bindQcBatchSearchInputDelegation() {
  if (bindQcBatchSearchInputDelegation._done) return;
  bindQcBatchSearchInputDelegation._done = true;
  const onQcBatchSearchField = (ev) => {
    const el = ev.target;
    if (!el || el.id !== 'qc-batch-search') return;
    const root = document.getElementById('view-qc');
    if (!root || !root.contains(el)) return;
    renderBatchList();
  };
  document.addEventListener('input', onQcBatchSearchField, true);
  document.addEventListener('change', onQcBatchSearchField, true);
}

bindQcBatchSearchInputDelegation();

async function refreshRecipeSummary() {
  const el = document.getElementById('qc-recipe-summary');
  if (!el) return;
  try {
    // Use the same source as calculator dropdown.
    const recipesData = await qcGetAllRecipes();
    state.recipeCatalog = Array.isArray(recipesData.recipes) ? recipesData.recipes : [];
    el.textContent = `Recipes: ${state.recipeCatalog.length}`;
  } catch (err) {
    try {
      // Fallback to QC summary endpoint if recipes endpoint is unavailable.
      const data = await qcGetRecipesSummary();
      state.recipeCatalog = Array.isArray(data.recipes) ? data.recipes : [];
      if (data.match) {
        el.textContent = `Recipes: ${data.observed} (matches expected ${data.expected})`;
      } else {
        el.textContent = `Recipes: observed ${data.observed}, expected ${data.expected} (warning)`;
      }
    } catch (fallbackErr) {
      state.recipeCatalog = [];
      el.textContent = `Recipe summary unavailable: ${fallbackErr.message || err.message}`;
    }
  }
  if (state.activeSubmenu === 'configure_mixing') renderMixingConfigPanel();
}

async function loadSelectedMixing() {
  if (!state.selectedBatchNo) {
    state.mixingData = null;
    resetMixingAutoSaveState();
    state.mixingLastSavedSnapshot = '';
    showMixingEmpty('Select a batch to open Mixing Instructions.');
    return;
  }

  const batchMeta = getSelectedBatchMeta();
  try {
    const data = await qcGetMixing(state.selectedBatchNo);
    state.mixingData = normalizeMixingData(data, batchMeta);
    resetMixingAutoSaveState();
    state.mixingLastSavedSnapshot = serializeMixingSnapshot(state.mixingData);
    renderMixingPanel();
  } catch (err) {
    state.mixingData = null;
    resetMixingAutoSaveState();
    state.mixingLastSavedSnapshot = '';
    showMixingEmpty(err.message || 'Failed to load Mixing Instructions.');
    setStatus(err.message || 'Failed to load Mixing Instructions.', true);
  }
}

async function loadSelectedForActiveSubmenu() {
  updateSeamSubmenuVisibility();
  if (state.activeSubmenu === 'configure_mixing') {
    renderMixingConfigPanel();
    return;
  }
  if (state.activeSubmenu === 'picking_sheet') {
    renderPickingSheetPanel();
    return;
  }
  if (isCipSubmenu(state.activeSubmenu)) {
    await loadSelectedTankCip();
    return;
  }
  if (isQcReportSubmenu(state.activeSubmenu)) {
    await loadSelectedQcReport();
    return;
  }
  if (isSeamCheckSubmenu(state.activeSubmenu)) {
    await loadSelectedSeamCheck();
    return;
  }
  await loadSelectedMixing();
}

async function refreshBatches(options = {}) {
  const preserveSelection = options.preserveSelection !== false;
  const loadActiveData = options.loadActiveData !== false && options.loadMixing !== false;

  try {
    const result = await qcGetBatches();
    const previous = state.selectedBatchNo;
    state.batches = result.batches || [];

    if (!state.batches.length) {
      state.selectedBatchNo = null;
    } else if (
      preserveSelection &&
      previous &&
      state.batches.some((b) => b.batch_no === previous)
    ) {
      state.selectedBatchNo = previous;
    } else {
      state.selectedBatchNo = state.batches[0].batch_no;
    }

    updateSeamSubmenuVisibility();
    renderBatchList();
    if (loadActiveData) await loadSelectedForActiveSubmenu();
  } catch (err) {
    setStatus(err.message, true);
  }
}

async function selectBatch(batchNo) {
  const next = String(batchNo || '').trim();
  if (!next) return;
  if (next === state.selectedBatchNo) {
    state.qcShowAllBatchCards = false;
    const searchEl = document.getElementById('qc-batch-search');
    if (searchEl) searchEl.value = '';
    updateSeamSubmenuVisibility();
    renderBatchList();
    updateCurrentBatchContextBar();
    return;
  }
  await flushPendingAutoSavesBeforeBatchSwitch();
  revokeQcPickingBlobUrl();
  state.selectedBatchNo = next;
  state.qcShowAllBatchCards = false;
  const searchEl = document.getElementById('qc-batch-search');
  if (searchEl) searchEl.value = '';
  state.mixingData = null;
  state.tankCipData = null;
  state.fillerMixerCipData = null;
  state.qcReportData = null;
  state.seamCheckData = null;
  resetMixingAutoSaveState();
  resetTankCipAutoSaveState();
  resetQcReportAutoSaveState();
  resetSeamCheckAutoSaveState();
  state.mixingLastSavedSnapshot = '';
  state.tankCipLastSavedSnapshot = '';
  state.fillerMixerCipLastSavedSnapshot = '';
  state.qcReportLastSavedSnapshot = '';
  state.seamCheckLastSavedSnapshot = '';
  updateSeamSubmenuVisibility();
  renderBatchList();
  await loadSelectedForActiveSubmenu();
  updateCurrentBatchContextBar();
}

function collectMixingPayload() {
  const batchMeta = getSelectedBatchMeta();
  const base = normalizeMixingData(state.mixingData || {}, batchMeta);

  const payload = JSON.parse(JSON.stringify(base));

  const dateEl = document.getElementById('qc-mix-date');
  const batchNoEl = document.getElementById('qc-mix-batch-no');
  const jobNoEl = document.getElementById('qc-mix-job-no');
  const tankNoEl = document.getElementById('qc-mix-tank-no');
  const productTopEl = document.getElementById('qc-mix-product-name-top');
  const productEl = document.getElementById('qc-mix-product-name');
  const syrupQtyEl = document.getElementById('qc-mix-syrup-qty');
  const syrupActualEl = document.getElementById('qc-mix-syrup-actual');
  const packApprovedYesEl = document.getElementById('qc-pack-approved-yes');
  const packApprovedNoEl = document.getElementById('qc-pack-approved-no');
  const packFinalVolumeEl = document.getElementById('qc-pack-final-volume');
  const packComparedBatchEl = document.getElementById('qc-pack-compared-batch');
  const convBrixEl = document.getElementById('qc-conv-syrup-brix');
  const convGLEl = document.getElementById('qc-conv-gl');
  const convKgSugarEl = document.getElementById('qc-conv-kg-sugar');

  const selectedDate = dateEl ? String(dateEl.value || '') : '';
  payload.header.date = selectedDate || toDateInputValue((payload.header && payload.header.date) || (batchMeta && batchMeta.date) || '') || todayDateInputValue();
  payload.header.batch_no = batchNoEl ? String(batchNoEl.value || '') : String(payload.header.batch_no || '');
  payload.header.job_no = jobNoEl ? String(jobNoEl.value || '') : String(payload.header.job_no || '');
  payload.header.tank_no = tankNoEl ? String(tankNoEl.value || '') : '';
  payload.header.product_name = productTopEl
    ? String(productTopEl.value || '')
    : (productEl ? String(productEl.textContent || '') : String(payload.header.product_name || ''));
  payload.syrup = payload.syrup || {};
  payload.syrup.quantity = syrupQtyEl ? String(syrupQtyEl.value || '') : String((payload.syrup && payload.syrup.quantity) || '');
  payload.syrup.actual = syrupActualEl ? String(syrupActualEl.value || '') : '';

  const topActualValue = syrupActualEl ? String(syrupActualEl.value || '') : '';
  let approved = '';
  if (packApprovedYesEl && packApprovedYesEl.checked) approved = 'yes';
  else if (packApprovedNoEl && packApprovedNoEl.checked) approved = 'no';

  payload.packing_decision = payload.packing_decision || {};
  payload.packing_decision.approved = approved;
  payload.packing_decision.actual_final_volume = topActualValue || (packFinalVolumeEl ? String(packFinalVolumeEl.value || '') : '');
  payload.packing_decision.compared_batch_no = packComparedBatchEl ? String(packComparedBatchEl.value || '') : '';

  const gPerL = convGLEl ? toNumber(convGLEl.value) : 0;
  const kgSugar = convKgSugarEl ? toNumber(convKgSugarEl.value) : 0;
  const kgPerL = gPerL > 0 ? gPerL / 1000 : 0;
  const total = kgPerL > 0 && kgSugar > 0 ? (kgSugar / kgPerL) : 0;

  payload.simple_syrup_conversion = payload.simple_syrup_conversion || {};
  payload.simple_syrup_conversion.syrup_brix = convBrixEl ? String(convBrixEl.value || '') : '';
  payload.simple_syrup_conversion.g_per_l = convGLEl ? String(convGLEl.value || '') : '';
  payload.simple_syrup_conversion.kg_sugar = convKgSugarEl ? String(convKgSugarEl.value || '') : '';
  payload.simple_syrup_conversion.kg_per_l = formatAuto(kgPerL, 6);
  payload.simple_syrup_conversion.value = formatAuto(total, 3);

  document.querySelectorAll('#qc-mix-checks-body .qc-check-input').forEach((input) => {
    const rowIndex = Number(input.getAttribute('data-row-index'));
    const col = input.getAttribute('data-col');
    if (!Number.isFinite(rowIndex) || rowIndex < 0 || !col) return;
    if (!payload.checks[rowIndex]) return;
    payload.checks[rowIndex][col] = input.type === 'checkbox' ? (input.checked ? '1' : '') : input.value;
  });

  return payload;
}

function requireMixingTankNumber(payload, options = {}) {
  const notify = options.notify !== false;
  const tankNo = String((payload && payload.header && payload.header.tank_no) || '').trim();
  if (tankNo) return true;
  if (!notify) return false;
  setStatus('Tank number is required.', true);
  showToast('Tank number is required.', true);
  const tankNoEl = document.getElementById('qc-mix-tank-no');
  if (tankNoEl && typeof tankNoEl.focus === 'function') tankNoEl.focus();
  return false;
}

function serializeMixingSnapshot(value) {
  try {
    return JSON.stringify(value || {});
  } catch (_err) {
    return '';
  }
}

function resetMixingAutoSaveState() {
  if (state.mixingAutoSaveTimer) {
    window.clearTimeout(state.mixingAutoSaveTimer);
  }
  state.mixingAutoSaveTimer = null;
  state.mixingAutoSaveInFlight = false;
  state.mixingAutoSaveQueued = false;
  state.mixingAutoSaveTankHinted = false;
}

function resetTankCipAutoSaveState(section = null) {
  const sections = section ? [section] : ['tank_cip', 'filler_mixer_cip'];
  sections.forEach((name) => {
    const timer = getCipAutoSaveTimer(name);
    if (timer) window.clearTimeout(timer);
    setCipAutoSaveTimer(name, null);
    setCipAutoSaveInFlight(name, false);
    setCipAutoSaveQueued(name, false);
  });
}

function resetQcReportAutoSaveState() {
  const timer = getQcReportAutoSaveTimer();
  if (timer) window.clearTimeout(timer);
  setQcReportAutoSaveTimer(null);
  setQcReportAutoSaveInFlight(false);
  setQcReportAutoSaveQueued(false);
}

function resetSeamCheckAutoSaveState() {
  const timer = getSeamCheckAutoSaveTimer();
  if (timer) window.clearTimeout(timer);
  setSeamCheckAutoSaveTimer(null);
  setSeamCheckAutoSaveInFlight(false);
  setSeamCheckAutoSaveQueued(false);
}

async function saveMixingPayload(payload, options = {}) {
  const notifyTank = options.notifyTank !== false;
  const rerender = options.rerender !== false;
  const refreshList = options.refreshList === true;
  const successStatus = typeof options.successStatus === 'string' ? options.successStatus : '';
  const successToast = typeof options.successToast === 'string' ? options.successToast : '';

  if (!requireMixingTankNumber(payload, { notify: notifyTank })) {
    return { skipped: true, reason: 'tank_required' };
  }

  const result = await qcSaveMixing(state.selectedBatchNo, payload);
  const normalized = normalizeMixingData(result.data || payload, getSelectedBatchMeta());
  state.mixingData = normalized;
  state.mixingLastSavedSnapshot = serializeMixingSnapshot(payload);
  state.mixingAutoSaveTankHinted = false;

  if (rerender) renderMixingPanel();
  if (successStatus) setStatus(successStatus);
  if (successToast) showToast(successToast);
  if (refreshList) await refreshBatches({ preserveSelection: true, loadMixing: false });

  return { skipped: false, result, data: normalized };
}

async function runMixingAutoSave() {
  if (!state.selectedBatchNo || state.activeSubmenu !== 'mixing') return;
  if (state.mixingAutoSaveInFlight) {
    state.mixingAutoSaveQueued = true;
    return;
  }

  const payload = collectMixingPayload();
  const snapshot = serializeMixingSnapshot(payload);
  if (snapshot && snapshot === state.mixingLastSavedSnapshot) return;

  if (!requireMixingTankNumber(payload, { notify: false })) {
    if (!state.mixingAutoSaveTankHinted) {
      setStatus('Enter tank number to enable auto-save.', true);
      state.mixingAutoSaveTankHinted = true;
    }
    return;
  }

  state.mixingAutoSaveInFlight = true;
  try {
    await saveMixingPayload(payload, { notifyTank: false, rerender: false, refreshList: false });
    setStatus('Auto-saved mixing instructions.');
  } catch (err) {
    setStatus(err.message || 'Failed to auto-save mixing instructions.', true);
  } finally {
    state.mixingAutoSaveInFlight = false;
    if (state.mixingAutoSaveQueued) {
      state.mixingAutoSaveQueued = false;
      queueMixingAutoSave();
    }
  }
}

function queueMixingAutoSave() {
  if (!state.selectedBatchNo || state.activeSubmenu !== 'mixing') return;
  if (state.mixingAutoSaveTimer) {
    window.clearTimeout(state.mixingAutoSaveTimer);
  }
  state.mixingAutoSaveTimer = window.setTimeout(() => {
    state.mixingAutoSaveTimer = null;
    void runMixingAutoSave();
  }, MIXING_AUTO_SAVE_DELAY_MS);
}

async function onSaveMixing() {
  if (!state.selectedBatchNo) {
    setStatus('Select a batch first.', true);
    showToast('Select a batch first.', true);
    return;
  }

  try {
    setStatus('Saving mixing instructions...');
    const payload = collectMixingPayload();
    const outcome = await saveMixingPayload(payload, {
      notifyTank: true,
      rerender: true,
      refreshList: true,
      successStatus: 'Mixing instructions saved.',
      successToast: 'Mixing instructions saved.',
    });
    if (outcome.skipped) return;
  } catch (err) {
    setStatus(err.message || 'Failed to save mixing instructions', true);
    showToast(err.message || 'Failed to save mixing instructions', true);
  }
}

async function onPrintMixingPdf() {
  if (!state.selectedBatchNo) {
    setStatus('Select a batch first.', true);
    showToast('Select a batch first.', true);
    return;
  }

  try {
    setStatus('Saving mixing instructions and preparing mixing procedure PDF...');
    const payload = collectMixingPayload();
    const outcome = await saveMixingPayload(payload, { notifyTank: true, rerender: false, refreshList: false });
    if (outcome.skipped) return;

    const blob = await qcDownloadMixingPdf(state.selectedBatchNo);
    const batchNoRaw = String(
      (state.mixingData && state.mixingData.header && state.mixingData.header.batch_no)
      || state.selectedBatchNo
      || ''
    ).trim();
    const safeBatchNo = batchNoRaw.replace(/[<>:"/\\|?*\x00-\x1f]+/g, '_') || 'batch';
    const fileName = `${safeBatchNo}_Mixing_Instructions.pdf`;
    const fileLike = typeof File === 'function'
      ? new File([blob], fileName, { type: 'application/pdf' })
      : blob;
    const url = window.URL.createObjectURL(fileLike);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 60000);

    setStatus('Mixing procedure PDF downloaded.');
    showToast('Mixing procedure PDF downloaded.');
  } catch (err) {
    setStatus(err.message || 'Failed to generate mixing procedure PDF.', true);
    showToast(err.message || 'Failed to generate mixing procedure PDF.', true);
  }
}

function stripItemCodePrefix(value) {
  const text = String(value || '');
  return text.replace(/^\s*[A-Z0-9]+(?:-[A-Z0-9]+)+\s*-\s*/i, '').trim();
}

function todayIsoDate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function downloadBlobAs(blob, filename) {
  const fileLike = typeof File === 'function'
    ? new File([blob], filename, { type: 'application/pdf' })
    : blob;
  const url = window.URL.createObjectURL(fileLike);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 60000);
}

async function loadCoverPageData() {
  const statusEl = document.getElementById('qc-cover-page-status');
  if (!state.selectedBatchNo) return;
  const meta = getSelectedBatchMeta() || {};
  const productEl = document.getElementById('qc-cover-page-product');
  const batchEl = document.getElementById('qc-cover-page-batch-no');
  const destEl = document.getElementById('qc-cover-page-destination');
  const dateEl = document.getElementById('qc-cover-page-date');
  if (statusEl) statusEl.textContent = 'Loading cover page…';
  try {
    const res = await qcGetCoverPage(state.selectedBatchNo);
    const data = (res && typeof res === 'object' && res.data) ? res.data : (res || {});
    const mf = (data && data.manual_fields) || (res && res.manual_fields) || {};
    const apiDefaults = (res && res.defaults) || (data && data.defaults) || {};
    const defaultProduct = apiDefaults.product_name || stripItemCodePrefix(meta.product_name || meta.recipe_name || '');
    const defaultBatch = apiDefaults.batch_no || meta.batch_no || state.selectedBatchNo || '';
    const defaultDate = apiDefaults.date || meta.date || todayIsoDate();
    if (productEl) productEl.value = mf.product_name_override || defaultProduct;
    if (batchEl) batchEl.value = mf.batch_no_override || defaultBatch;
    if (destEl) destEl.value = mf.destination || '';
    if (dateEl) dateEl.value = mf.date_override || defaultDate;
    if (statusEl) statusEl.textContent = '';
  } catch (err) {
    if (statusEl) statusEl.textContent = err.message || 'Failed to load cover page.';
  }
}

async function onSaveCoverPage() {
  if (!state.selectedBatchNo) { showToast('Select a batch first.', true); return; }
  const statusEl = document.getElementById('qc-cover-page-status');
  const productEl = document.getElementById('qc-cover-page-product');
  const batchEl = document.getElementById('qc-cover-page-batch-no');
  const destEl = document.getElementById('qc-cover-page-destination');
  const dateEl = document.getElementById('qc-cover-page-date');
  const payload = {
    manual_fields: {
      product_name_override: String(productEl?.value || '').trim(),
      batch_no_override: String(batchEl?.value || '').trim(),
      destination: String(destEl?.value || '').trim(),
      date_override: String(dateEl?.value || '').trim(),
    },
  };
  try {
    if (statusEl) statusEl.textContent = 'Saving…';
    await qcSaveCoverPage(state.selectedBatchNo, payload);
    if (statusEl) statusEl.textContent = 'Saved.';
    showToast('Cover page saved.');
  } catch (err) {
    if (statusEl) statusEl.textContent = err.message || 'Failed to save cover page.';
    showToast(err.message || 'Failed to save cover page.', true);
  }
}

async function onDownloadCoverPagePdf() {
  if (!state.selectedBatchNo) { showToast('Select a batch first.', true); return; }
  const statusEl = document.getElementById('qc-cover-page-status');
  try {
    await onSaveCoverPage();
    if (statusEl) statusEl.textContent = 'Preparing PDF…';
    const blob = await qcDownloadCoverPagePdf(state.selectedBatchNo);
    const safe = String(state.selectedBatchNo).replace(/[<>:"/\\|?*\x00-\x1f]+/g, '_') || 'batch';
    downloadBlobAs(blob, `${safe}_QC_Cover.pdf`);
    if (statusEl) statusEl.textContent = 'Cover page PDF downloaded.';
  } catch (err) {
    if (statusEl) statusEl.textContent = err.message || 'Failed to download cover page PDF.';
    showToast(err.message || 'Failed to download cover page PDF.', true);
  }
}

async function loadPickingSheetBubbles() {
  const container = document.getElementById('qc-picking-sheet-bubbles');
  if (!container || !state.selectedBatchNo) return;
  const meta = getSelectedBatchMeta() || {};
  const batchId = meta.production_batch_id;
  if (!batchId) {
    container.innerHTML = '<p class="qc-muted">Picking sheet data not available (no production batch linked).</p>';
    return;
  }
  container.innerHTML = '<p class="qc-muted">Loading picking sheet data…</p>';
  try {
    const res = await qcGetPickingSheetData(batchId);
    const header = (res && res.header) || {};
    const rows = Array.isArray(res && res.rows) ? res.rows : [];
    container.innerHTML = renderPickingSheetBubblesHtml(header, rows, meta);
  } catch (err) {
    container.innerHTML = `<p class="qc-muted">${escapeHtml(err.message || 'Failed to load picking sheet data.')}</p>`;
  }
}

function _formatQtyNum(v) {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return '';
  if (Number.isInteger(n)) return n.toLocaleString('en-US');
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function _formatVolume(v) {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return '';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function _todayDmy() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function renderPickingSheetBubblesHtml(header, rows, meta) {
  const h = header || {};
  const m = meta || {};
  const recipe = h.recipe_name || m.recipe_name || '';
  const itemCode = m.item_code || '';
  const titleParts = [itemCode, recipe].filter((x) => String(x || '').trim().length > 0);
  const title = titleParts.length ? `Picking Sheet: ${titleParts.join(' - ')}` : 'Picking Sheet';

  const batchNoStr = String(h.batch_no || '').trim();
  const productionNo = batchNoStr.toLowerCase().startsWith('d') ? batchNoStr.slice(1) : batchNoStr;
  const customerRows = [
    ['Customer', ''],
    ['Product To Be Mixed', recipe],
    ['Date', _todayDmy()],
    ['Production No', productionNo],
    ['Batch No', batchNoStr],
  ];
  const customerHtml = customerRows
    .map(
      ([label, value]) => `
      <div class="qc-picking-info-row">
        <span class="qc-picking-info-label">${escapeHtml(label)}:</span>
        <span class="qc-picking-info-value">${escapeHtml(String(value || ''))}</span>
      </div>`,
    )
    .join('');

  const mixingRows = [
    ['Total Volume', _formatVolume(h.total_volume), 'Lt'],
    ['Ratio', h.ratio_str || '', ''],
    ['Total Syrup', _formatVolume(h.total_syrup), 'Lt'],
    ['Total Cases', _formatQtyNum(h.total_cases), ''],
    ['Tank No', h.tank_no || '', ''],
  ];
  const mixingHtml = mixingRows
    .map(
      ([label, value, unit]) => `
      <div class="qc-picking-info-row">
        <span class="qc-picking-info-label">${escapeHtml(label)}:</span>
        <span class="qc-picking-info-value">${escapeHtml(String(value || ''))}${unit ? ` <span class="qc-picking-info-unit">${escapeHtml(unit)}</span>` : ''}</span>
      </div>`,
    )
    .join('');

  const bodyRowsHtml = rows.length
    ? rows
        .map((row) => {
          const qty = _formatQtyNum(row.qty_required);
          return `
          <tr>
            <td>${escapeHtml(String(row.item_code || ''))}</td>
            <td>${escapeHtml(String(row.description || ''))}</td>
            <td class="qc-picking-td-center">B.P.1</td>
            <td class="qc-picking-td-center">${escapeHtml(String(row.uom || ''))}</td>
            <td class="qc-picking-td-right">${escapeHtml(qty)}</td>
          </tr>`;
        })
        .join('')
    : '<tr><td colspan="5" class="qc-picking-td-center qc-muted">No items found.</td></tr>';

  return `
    <div class="qc-picking-title">${escapeHtml(title)}</div>
    <div class="qc-picking-info-grid">
      <div class="qc-picking-info-block">
        <div class="qc-picking-info-heading">Customer information:</div>
        ${customerHtml}
      </div>
      <div class="qc-picking-info-block">
        <div class="qc-picking-info-heading">Mixing information: <span class="qc-picking-info-hint">(Use R.T.D volume)</span></div>
        ${mixingHtml}
      </div>
    </div>
    <table class="qc-picking-table">
      <thead>
        <tr>
          <th>Product Code</th>
          <th>Description</th>
          <th>Location/Store</th>
          <th>U.O.M</th>
          <th>QTY Required</th>
        </tr>
      </thead>
      <tbody>${bodyRowsHtml}</tbody>
    </table>
  `;
}

async function onDeleteAllBatches() {
  const batches = state.batches || [];
  if (!batches.length) {
    setStatus('No QC batches to delete.');
    showToast('No QC batches to delete.');
    return;
  }

  const total = batches.length;
  const confirmed = window.confirm(`Delete all ${total} QC batches? This cannot be undone.`);
  if (!confirmed) return;

  const deleteBtn = document.getElementById('qc-delete-all-btn');
  const refreshBtn = document.getElementById('qc-refresh-btn');
  const configBtn = document.getElementById('qc-config-mixing-btn');

  if (deleteBtn) deleteBtn.disabled = true;
  if (refreshBtn) refreshBtn.disabled = true;
  if (configBtn) configBtn.disabled = true;

  let deleted = 0;
  let failed = 0;

  try {
    setStatus(`Deleting ${total} QC batches...`);
    for (const batch of batches) {
      const batchNo = String(batch.batch_no || '').trim();
      if (!batchNo) continue;
      try {
        await qcDeleteBatch(batchNo);
        deleted += 1;
      } catch (err) {
        failed += 1;
        console.error(`Failed deleting QC batch '${batchNo}':`, err);
      }
    }

    await refreshBatches({ preserveSelection: false, loadMixing: true });
    await refreshRecipeSummary();

    if (failed > 0) {
      setStatus(`Deleted ${deleted}/${total} batches. Failed: ${failed}.`, true);
      showToast(`Deleted ${deleted}/${total} batches. Failed: ${failed}.`, true);
    } else {
      setStatus(`Deleted ${deleted} batches.`);
      showToast(`Deleted ${deleted} batches.`);
    }
  } catch (err) {
    setStatus(err.message || 'Failed deleting QC batches', true);
    showToast(err.message || 'Failed deleting QC batches', true);
  } finally {
    if (deleteBtn) deleteBtn.disabled = false;
    if (refreshBtn) refreshBtn.disabled = false;
    if (configBtn) configBtn.disabled = false;
  }
}

async function onDeleteSingleBatch(batchNoRaw) {
  const batchNo = String(batchNoRaw || '').trim();
  if (!batchNo) return;

  const confirmed = window.confirm(
    `Delete batch ${batchNo}?\n\n` +
    `This will:\n` +
    `  • Remove the QC record and PPCR\n` +
    `  • Return the linked job orders to Pending\n` +
    `  • Free the batch number ${batchNo} for reuse\n` +
    `  • Send the Stock Requisition / Picking Sheet / PPCR PDFs to the OneDrive recycle bin\n\n` +
    `Refuses if Sage drafts exist or the PCR has already been submitted.\n` +
    `This cannot be undone.`
  );
  if (!confirmed) return;

  try {
    setStatus(`Deleting ${batchNo}...`);
    await qcDeleteBatch(batchNo);
    await refreshBatches({ preserveSelection: true, loadMixing: true });
    await refreshRecipeSummary();
    setStatus(`Deleted ${batchNo}.`);
    showToast(`Deleted ${batchNo}.`);
  } catch (err) {
    setStatus(err.message || `Failed to delete ${batchNo}.`, true);
    showToast(err.message || `Failed to delete ${batchNo}.`, true);
  }
}

async function onDownloadCombinedQcRecord(batchNoRaw) {
  const batchNo = String(batchNoRaw || '').trim();
  if (!batchNo) return;

  try {
    setStatus(`Preparing QC Record PDF for ${batchNo}...`);
    if (state.selectedBatchNo === batchNo) {
      await flushCipAutoSaveForSection('tank_cip');
      await flushCipAutoSaveForSection('filler_mixer_cip');
    }
    const blob = await qcDownloadCombinedQcRecordPdf(batchNo);
    const safeBatchNo = batchNo.replace(/[<>:"/\\|?*\x00-\x1f]+/g, '_') || 'batch';
    const fileName = `${safeBatchNo}_QC_Record.pdf`;
    const fileLike = typeof File === 'function'
      ? new File([blob], fileName, { type: 'application/pdf' })
      : blob;
    const url = window.URL.createObjectURL(fileLike);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 60000);

    setStatus(`QC Record PDF downloaded for ${batchNo}.`);
    showToast(`QC Record PDF downloaded for ${batchNo}.`);
  } catch (err) {
    setStatus(err.message || `Failed to generate QC Record PDF for ${batchNo}.`, true);
    showToast(err.message || `Failed to generate QC Record PDF for ${batchNo}.`, true);
  }
}

export async function loadQCPage() {
  ensureCss();
  if (state.viewReady && !document.getElementById('qc-batch-search')) {
    state.viewReady = false;
  }
  await ensureViewMarkup();
  setActiveSubmenu('picking_sheet');
  updateSeamSubmenuVisibility();
  // Refresh the sticky UV default in the background so fresh QC Reports
  // pre-fill with the user's last selection. Non-blocking — fallback is '100%'.
  loadQcReportDefaultUv();
  await refreshRecipeSummary();
  await refreshBatches();
}

window.loadQCPage = loadQCPage;
