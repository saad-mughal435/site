const apiFetch = async (url, options = {}) => {
  const fn = window.authenticatedFetch || fetch;
  return fn(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });
};

const _safeJsonParse = (text) => {
  try {
    return JSON.parse(text);
  } catch (_err) {
    return null;
  }
};

const _cleanErrorText = (text) =>
  String(text || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const _extractErrorMessage = (res, payload, rawText, fallbackMessage) => {
  if (payload && typeof payload === 'object') {
    if (typeof payload.detail === 'string' && payload.detail.trim()) return payload.detail.trim();
    if (typeof payload.message === 'string' && payload.message.trim()) return payload.message.trim();
    if (typeof payload.error === 'string' && payload.error.trim()) return payload.error.trim();
  }

  const textMessage = _cleanErrorText(rawText);
  if (textMessage) return textMessage;
  return `${fallbackMessage} (HTTP ${res.status})`;
};

const requestJson = async (url, options = {}, fallbackMessage = 'Request failed') => {
  const res = await apiFetch(url, options);
  const rawText = await res.text();
  const payload = rawText ? _safeJsonParse(rawText) : null;

  if (!res.ok) {
    throw new Error(_extractErrorMessage(res, payload, rawText, fallbackMessage));
  }

  if (!rawText) return {};
  if (payload !== null) return payload;
  throw new Error('Server returned invalid JSON');
};

export async function qcGetBatches() {
  return requestJson('/api/qc/batches', {}, 'Failed to load QC batches');
}

export async function qcEnsureBatch(payload) {
  return requestJson('/api/qc/batches/ensure', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, 'Failed to ensure QC batch');
}

export async function qcGetBatch(batchNo) {
  return requestJson(`/api/qc/batches/${encodeURIComponent(batchNo)}`, {}, 'Failed to load QC batch');
}

export async function qcGetPickingSheetRef(batchNo) {
  return requestJson(
    `/api/qc/batches/${encodeURIComponent(batchNo)}/picking-sheet-url`,
    {},
    'Failed to load picking sheet'
  );
}

export async function qcGetPickingSheetData(batchId) {
  return requestJson(
    `/api/production-batch/${encodeURIComponent(batchId)}/picking-sheet-data`,
    {},
    'Failed to load picking sheet data'
  );
}

export async function qcUpdateBatchIdentifiers(oldBatchNo, payload) {
  return requestJson(
    `/api/qc/batches/${encodeURIComponent(oldBatchNo)}/identifiers`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    'Failed to update picking sheet identifiers'
  );
}

export async function qcGetCoverPage(batchNo) {
  return requestJson(
    `/api/qc/batches/${encodeURIComponent(batchNo)}/cover-page`,
    {},
    'Failed to load cover page'
  );
}

export async function qcSaveCoverPage(batchNo, data) {
  return requestJson(`/api/qc/batches/${encodeURIComponent(batchNo)}/cover-page`, {
    method: 'PUT',
    body: JSON.stringify({ data }),
  }, 'Failed to save cover page');
}

export async function qcDownloadCoverPagePdf(batchNo) {
  const url = `/api/qc/batches/${encodeURIComponent(batchNo)}/cover-page/pdf`;
  const res = await apiFetch(url, { method: 'GET' });
  if (!res.ok) {
    const rawText = await res.text();
    const payload = rawText ? _safeJsonParse(rawText) : null;
    throw new Error(_extractErrorMessage(res, payload, rawText, 'Failed to generate cover page PDF'));
  }
  return res.blob();
}

export async function qcFetchPdfBlob(path) {
  const fn = window.authenticatedFetch || fetch;
  const url = String(path || '').startsWith('/') ? String(path) : `/${path}`;
  const res = await fn(url, { method: 'GET' });
  const ct = res.headers.get('content-type') || '';
  if (!res.ok) {
    const rawText = await res.text();
    const payload = rawText ? _safeJsonParse(rawText) : null;
    throw new Error(_extractErrorMessage(res, payload, rawText, 'Failed to load PDF'));
  }
  if (ct.includes('application/json')) {
    const rawText = await res.text();
    const payload = rawText ? _safeJsonParse(rawText) : null;
    throw new Error(_extractErrorMessage(res, payload, rawText, 'Failed to load PDF'));
  }
  return res.blob();
}

export async function qcGetMixing(batchNo) {
  return requestJson(
    `/api/qc/batches/${encodeURIComponent(batchNo)}/mixing`,
    {},
    'Failed to load mixing instructions'
  );
}

export async function qcSaveMixing(batchNo, data) {
  return requestJson(`/api/qc/batches/${encodeURIComponent(batchNo)}/mixing`, {
    method: 'PUT',
    body: JSON.stringify({ data }),
  }, 'Failed to save mixing instructions');
}

export async function qcGetTankCip(batchNo) {
  // Cache-bust each fetch so the browser cannot serve stale data after a
  // mixing-side propagation just rewrote the QC tank_cip file on disk.
  return requestJson(
    `/api/qc/batches/${encodeURIComponent(batchNo)}/tank-cip?_t=${Date.now()}`,
    { cache: 'no-store' },
    'Failed to load Tank CIP'
  );
}

export async function qcSaveTankCip(batchNo, data) {
  return requestJson(`/api/qc/batches/${encodeURIComponent(batchNo)}/tank-cip`, {
    method: 'PUT',
    body: JSON.stringify({ data }),
  }, 'Failed to save Tank CIP');
}

export async function qcGetFillerMixerCip(batchNo) {
  return requestJson(
    `/api/qc/batches/${encodeURIComponent(batchNo)}/filler-mixer-cip`,
    {},
    'Failed to load Filler/Mixer CIP'
  );
}

export async function qcSaveFillerMixerCip(batchNo, data) {
  return requestJson(`/api/qc/batches/${encodeURIComponent(batchNo)}/filler-mixer-cip`, {
    method: 'PUT',
    body: JSON.stringify({ data }),
  }, 'Failed to save Filler/Mixer CIP');
}

export async function qcGetQcReport(batchNo) {
  return requestJson(
    `/api/qc/batches/${encodeURIComponent(batchNo)}/qc-report`,
    {},
    'Failed to load QC Report'
  );
}

export async function qcSaveQcReport(batchNo, data) {
  return requestJson(`/api/qc/batches/${encodeURIComponent(batchNo)}/qc-report`, {
    method: 'PUT',
    body: JSON.stringify({ data }),
  }, 'Failed to save QC Report');
}

export async function qcGetQcReportDefaultUv() {
  return requestJson(
    '/api/qc/qc-report/default-uv',
    {},
    'Failed to load QC Report default UV'
  );
}

export async function qcGetSeamCheck(batchNo) {
  return requestJson(
    `/api/qc/batches/${encodeURIComponent(batchNo)}/seam`,
    {},
    'Failed to load Seam Check'
  );
}

export async function qcSaveSeamCheck(batchNo, data) {
  return requestJson(`/api/qc/batches/${encodeURIComponent(batchNo)}/seam`, {
    method: 'PUT',
    body: JSON.stringify({ data }),
  }, 'Failed to save Seam Check');
}

export async function qcGetSection(batchNo, section) {
  return requestJson(`/api/qc/batches/${encodeURIComponent(batchNo)}/${section}`, {}, `Failed to load ${section}`);
}

export async function qcSaveSection(batchNo, section, data) {
  return requestJson(`/api/qc/batches/${encodeURIComponent(batchNo)}/${section}`, {
    method: 'PUT',
    body: JSON.stringify({ data }),
  }, `Failed to save ${section}`);
}

export async function qcGenerateDocs(batchNo, docTypes = null) {
  return requestJson(`/api/qc/batches/${encodeURIComponent(batchNo)}/documents/generate`, {
    method: 'POST',
    body: JSON.stringify({ doc_types: docTypes }),
  }, 'Failed to generate documents');
}

export async function qcDeleteBatch(batchNo) {
  return requestJson(
    `/api/qc/batches/${encodeURIComponent(batchNo)}`,
    { method: 'DELETE' },
    'Failed to delete QC batch'
  );
}

export async function qcGetRecipesSummary() {
  return requestJson('/api/qc/recipes/summary', {}, 'Failed to load recipe summary');
}

export async function qcGetAllRecipes() {
  return requestJson('/api/recipes', {}, 'Failed to load recipes');
}

export async function qcGetTemplatePayload() {
  return requestJson('/api/qc/templates/data-combined-types', {}, 'Failed to load template payload');
}

export async function qcSaveTemplatePayload(payload) {
  return requestJson('/api/qc/templates/data-combined-types', {
    method: 'PUT',
    body: JSON.stringify({ payload }),
  }, 'Failed to save template payload');
}

export async function qcDownloadMixingPdf(batchNo) {
  const url = `/api/qc/batches/${encodeURIComponent(batchNo)}/mixing/pdf`;
  const res = await apiFetch(url, { method: 'GET' });
  if (!res.ok) {
    const rawText = await res.text();
    const payload = rawText ? _safeJsonParse(rawText) : null;
    throw new Error(_extractErrorMessage(res, payload, rawText, 'Failed to generate mixing PDF'));
  }
  return res.blob();
}

export async function qcDownloadTankCipPdf(batchNo) {
  const url = `/api/qc/batches/${encodeURIComponent(batchNo)}/tank-cip/pdf`;
  const res = await apiFetch(url, { method: 'GET' });
  if (!res.ok) {
    const rawText = await res.text();
    const payload = rawText ? _safeJsonParse(rawText) : null;
    throw new Error(_extractErrorMessage(res, payload, rawText, 'Failed to generate Tank CIP PDF'));
  }
  return res.blob();
}

export async function qcDownloadFillerMixerCipPdf(batchNo) {
  const url = `/api/qc/batches/${encodeURIComponent(batchNo)}/filler-mixer-cip/pdf`;
  const res = await apiFetch(url, { method: 'GET' });
  if (!res.ok) {
    const rawText = await res.text();
    const payload = rawText ? _safeJsonParse(rawText) : null;
    throw new Error(_extractErrorMessage(res, payload, rawText, 'Failed to generate Filler/Mixer CIP PDF'));
  }
  return res.blob();
}

export async function qcDownloadQcReportPdf(batchNo) {
  const url = `/api/qc/batches/${encodeURIComponent(batchNo)}/qc-report/pdf?t=${Date.now()}`;
  const res = await apiFetch(url, { method: 'GET', cache: 'no-store' });
  if (!res.ok) {
    const rawText = await res.text();
    const payload = rawText ? _safeJsonParse(rawText) : null;
    throw new Error(_extractErrorMessage(res, payload, rawText, 'Failed to generate QC Report PDF'));
  }
  return res.blob();
}

export async function qcDownloadSeamCheckPdf(batchNo) {
  const url = `/api/qc/batches/${encodeURIComponent(batchNo)}/seam/pdf`;
  const res = await apiFetch(url, { method: 'GET' });
  if (!res.ok) {
    const rawText = await res.text();
    const payload = rawText ? _safeJsonParse(rawText) : null;
    throw new Error(_extractErrorMessage(res, payload, rawText, 'Failed to generate Seam Check PDF'));
  }
  return res.blob();
}

export async function qcDownloadCombinedQcRecordPdf(batchNo) {
  const url = `/api/qc/batches/${encodeURIComponent(batchNo)}/qc-record/pdf`;
  const res = await apiFetch(url, { method: 'GET' });
  if (!res.ok) {
    const rawText = await res.text();
    const payload = rawText ? _safeJsonParse(rawText) : null;
    throw new Error(_extractErrorMessage(res, payload, rawText, 'Failed to generate QC Record PDF'));
  }
  return res.blob();
}
