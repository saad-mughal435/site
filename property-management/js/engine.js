/* engine.js - Property Management pure domain logic. Exposes window.PMEngine.
 *
 * The SINGLE SOURCE OF TRUTH for domain rules: status labels/colours, money
 * math, the maintenance work-order state machine + SLA, invoice/lease status
 * derivation, and inspection scoring. Pure functions only - no fetch, no
 * localStorage, no DOM. Consumed by mock-api.js (routing/persistence) and by
 * every role page (labels/formatting). Nothing here is re-implemented anywhere
 * else, which is how "no repeated functions" holds across the five portals. */
(function () {
  'use strict';
  var S = window.PM_DATA.SETTINGS;
  var DAY = 86400000, HOUR = 3600000;

  // ---------- money ----------
  function aed(n) {
    if (n == null || isNaN(n)) return 'AED 0';
    return 'AED ' + Math.round(n).toLocaleString('en-US');
  }
  function aedShort(n) {
    n = n || 0;
    if (Math.abs(n) >= 1e6) return 'AED ' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return 'AED ' + Math.round(n / 1e3) + 'k';
    return 'AED ' + Math.round(n);
  }
  function pct(n, dp) { return (n == null ? 0 : n).toFixed(dp == null ? 1 : dp) + '%'; }

  // ---------- labels + colours ----------
  var LABELS = {
    unit: { occupied: 'Occupied', vacant: 'Vacant', notice: 'On notice', under_maintenance: 'Maintenance', reserved: 'Reserved' },
    lease: { active: 'Active', upcoming: 'Upcoming', expiring: 'Expiring', renewal_offered: 'Renewal offered', expired: 'Expired', renewed: 'Renewed', terminated: 'Terminated', draft: 'Draft' },
    invoice: { upcoming: 'Upcoming', due: 'Due', paid: 'Paid', partially_paid: 'Partial', overdue: 'Overdue', cancelled: 'Cancelled' },
    wo: { submitted: 'Submitted', triaged: 'Triaged', assigned: 'Assigned', scheduled: 'Scheduled', in_progress: 'In progress', on_hold: 'On hold', completed: 'Completed', verified: 'Verified', closed: 'Closed', cancelled: 'Cancelled' },
    priority: { emergency: 'Emergency', high: 'High', medium: 'Medium', low: 'Low' },
    booking: { requested: 'Requested', confirmed: 'Confirmed', cancelled: 'Cancelled', completed: 'Completed' },
    visitor: { expected: 'Expected', checked_in: 'On site', checked_out: 'Left', expired: 'Expired' },
    ticket: { open: 'Open', in_progress: 'In progress', waiting: 'Waiting', resolved: 'Resolved', closed: 'Closed' },
    inspection: { assigned: 'Assigned', in_progress: 'In progress', submitted: 'Submitted', approved: 'Approved', returned: 'Returned' },
    category: { ac_hvac: 'AC / HVAC', plumbing: 'Plumbing', electrical: 'Electrical', appliance: 'Appliance', carpentry: 'Carpentry', pest: 'Pest control', cleaning: 'Cleaning', elevator: 'Elevator', general: 'General' },
    inspection_type: { move_in: 'Move-in', move_out: 'Move-out', periodic: 'Periodic', snagging: 'Snagging' }
  };
  // colour token per status -> maps to CSS class pm-chip--<tone>
  var TONE = {
    unit: { occupied: 'ok', vacant: 'muted', notice: 'warn', under_maintenance: 'info', reserved: 'info' },
    lease: { active: 'ok', upcoming: 'info', expiring: 'warn', renewal_offered: 'warn', expired: 'muted', renewed: 'ok', terminated: 'muted', draft: 'muted' },
    invoice: { upcoming: 'muted', due: 'warn', paid: 'ok', partially_paid: 'warn', overdue: 'urgent', cancelled: 'muted' },
    wo: { submitted: 'info', triaged: 'info', assigned: 'info', scheduled: 'info', in_progress: 'warn', on_hold: 'muted', completed: 'ok', verified: 'ok', closed: 'muted', cancelled: 'muted' },
    priority: { emergency: 'urgent', high: 'warn', medium: 'info', low: 'muted' },
    booking: { requested: 'warn', confirmed: 'ok', cancelled: 'muted', completed: 'muted' },
    visitor: { expected: 'info', checked_in: 'ok', checked_out: 'muted', expired: 'muted' },
    ticket: { open: 'warn', in_progress: 'info', waiting: 'muted', resolved: 'ok', closed: 'muted' },
    inspection: { assigned: 'info', in_progress: 'warn', submitted: 'info', approved: 'ok', returned: 'urgent' }
  };
  function label(kind, v) { return (LABELS[kind] && LABELS[kind][v]) || v || ''; }
  function tone(kind, v) { return (TONE[kind] && TONE[kind][v]) || 'muted'; }

  // ---------- invoice status (recomputed at read) ----------
  function invoiceStatus(inv, now) {
    now = now || Date.now();
    if (inv.status === 'cancelled') return 'cancelled';
    var paid = inv.amount_paid_aed || 0;
    if (paid >= inv.amount_aed) return 'paid';
    var due = new Date(inv.due_date).getTime();
    var graceMs = S.grace_period_days * DAY;
    if (paid > 0 && now > due + graceMs) return 'overdue';
    if (paid > 0) return 'partially_paid';
    if (now < due) return 'upcoming';
    if (now <= due + graceMs) return 'due';
    return 'overdue';
  }
  function invoiceOutstanding(inv) { return Math.max(0, inv.amount_aed - (inv.amount_paid_aed || 0)); }
  function lateFee(inv, now) {
    now = now || Date.now();
    if (invoiceStatus(inv, now) !== 'overdue') return 0;
    var due = new Date(inv.due_date).getTime();
    var monthsLate = Math.max(0, (now - due - S.grace_period_days * DAY) / (30 * DAY));
    var fee = invoiceOutstanding(inv) * (S.late_fee_pct_per_month / 100) * monthsLate;
    return Math.min(fee, invoiceOutstanding(inv) * 0.05); // cap 5%
  }
  function daysOverdue(inv, now) {
    now = now || Date.now();
    var due = new Date(inv.due_date).getTime();
    return Math.max(0, Math.floor((now - due) / DAY));
  }

  // ---------- arrears aging ----------
  function agingBuckets(invoices, now) {
    now = now || Date.now();
    var b = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    invoices.forEach(function (inv) {
      if (invoiceStatus(inv, now) !== 'overdue' && invoiceStatus(inv, now) !== 'partially_paid') return;
      var out = invoiceOutstanding(inv);
      if (out <= 0) return;
      var d = daysOverdue(inv, now);
      if (d <= 30) b['0-30'] += out; else if (d <= 60) b['31-60'] += out; else if (d <= 90) b['61-90'] += out; else b['90+'] += out;
    });
    return b;
  }
  function collectionStats(invoices, now) {
    now = now || Date.now();
    var billed = 0, collected = 0, outstanding = 0;
    invoices.forEach(function (inv) {
      if (inv.status === 'cancelled') return;
      var due = new Date(inv.due_date).getTime();
      if (due > now) return; // only invoices already billed
      billed += inv.amount_aed;
      collected += (inv.amount_paid_aed || 0);
      outstanding += invoiceOutstanding(inv);
    });
    return { billed: billed, collected: collected, outstanding: outstanding, rate: billed ? +(100 * collected / billed).toFixed(1) : 100 };
  }

  // ---------- lease ----------
  function leaseExpiry(lease, now) {
    now = now || Date.now();
    var end = new Date(lease.end_date).getTime();
    var days = Math.round((end - now) / DAY);
    var risk = days < 0 ? 'expired' : days <= 30 ? 'high' : days <= 90 ? 'medium' : 'low';
    return { days_to_end: days, vacancy_risk: risk };
  }

  // ---------- work-order state machine ----------
  // states: submitted -> triaged -> assigned -> scheduled -> in_progress ->
  //         (on_hold) -> completed -> verified -> closed ; + cancelled
  var WO_TRANSITIONS = {
    submitted:   [{ a: 'triage', to: 'triaged', roles: ['manager'] }, { a: 'cancel', to: 'cancelled', roles: ['manager', 'tenant'] }],
    triaged:     [{ a: 'assign', to: 'assigned', roles: ['manager'] }, { a: 'cancel', to: 'cancelled', roles: ['manager'] }],
    assigned:    [{ a: 'schedule', to: 'scheduled', roles: ['manager', 'vendor'] }, { a: 'start', to: 'in_progress', roles: ['vendor'] }, { a: 'decline', to: 'triaged', roles: ['vendor'] }, { a: 'cancel', to: 'cancelled', roles: ['manager'] }],
    scheduled:   [{ a: 'start', to: 'in_progress', roles: ['vendor'] }, { a: 'cancel', to: 'cancelled', roles: ['manager'] }],
    in_progress: [{ a: 'hold', to: 'on_hold', roles: ['vendor', 'manager'] }, { a: 'complete', to: 'completed', roles: ['vendor'] }],
    on_hold:     [{ a: 'resume', to: 'in_progress', roles: ['vendor', 'manager'] }, { a: 'cancel', to: 'cancelled', roles: ['manager'] }],
    completed:   [{ a: 'verify', to: 'verified', roles: ['tenant', 'manager'] }, { a: 'reopen', to: 'assigned', roles: ['tenant', 'manager'] }],
    verified:    [{ a: 'close', to: 'closed', roles: ['manager'] }],
    closed:      [],
    cancelled:   []
  };
  var WO_ACTION_LABEL = { triage: 'Triage', assign: 'Assign vendor', schedule: 'Schedule', start: 'Start work', decline: 'Decline', hold: 'Put on hold', resume: 'Resume', complete: 'Mark complete', verify: 'Verify & rate', reopen: 'Reopen', close: 'Close', cancel: 'Cancel' };
  function woActions(wo, role) {
    return (WO_TRANSITIONS[wo.status] || []).filter(function (t) { return t.roles.indexOf(role) !== -1; })
      .map(function (t) { return { action: t.a, to: t.to, label: WO_ACTION_LABEL[t.a] }; });
  }
  function woCanTransition(wo, action, role) {
    return (WO_TRANSITIONS[wo.status] || []).some(function (t) { return t.a === action && t.roles.indexOf(role) !== -1; });
  }
  function woTargetState(wo, action) {
    var t = (WO_TRANSITIONS[wo.status] || []).filter(function (x) { return x.a === action; })[0];
    return t ? t.to : null;
  }
  function slaState(wo, now) {
    now = now || Date.now();
    if (['completed', 'verified', 'closed', 'cancelled'].indexOf(wo.status) !== -1) return { state: 'ok', mins_left: 0, breached: false };
    var due = new Date(wo.sla_deadline).getTime();
    var minsLeft = Math.round((due - now) / 60000);
    var target = (wo.sla_hours || 24) * 60;
    var state = minsLeft <= 0 ? 'breach' : (minsLeft <= target * 0.15 ? 'warn' : 'ok');
    return { state: state, mins_left: minsLeft, breached: minsLeft <= 0 };
  }

  // ---------- inspections ----------
  function inspectionOverall(rooms) {
    var vals = [];
    rooms.forEach(function (r) { r.items.forEach(function (it) { if (it.rating != null) vals.push(it.rating); }); });
    if (!vals.length) return null;
    return +(vals.reduce(function (a, b) { return a + b; }, 0) / vals.length).toFixed(1);
  }
  function inspectionComplete(rooms) {
    return rooms.every(function (r) { return r.items.every(function (it) { return it.rating != null; }); });
  }
  function depositDeductions(inspection) {
    var lines = [];
    (inspection.rooms || []).forEach(function (r) {
      r.items.forEach(function (it) {
        if (it.action_required && it.cost_estimate > 0) lines.push({ room: r.name, item: it.label, amount_aed: it.cost_estimate, note: it.notes || '', rating: it.rating });
      });
    });
    return lines;
  }

  // ---------- misc helpers ----------
  function humanMins(mins) {
    var neg = mins < 0; mins = Math.abs(mins);
    var out;
    if (mins < 60) out = mins + 'm';
    else if (mins < 1440) out = Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm';
    else out = Math.floor(mins / 1440) + 'd ' + Math.floor((mins % 1440) / 60) + 'h';
    return neg ? out + ' overdue' : out + ' left';
  }

  window.PMEngine = {
    aed: aed, aedShort: aedShort, pct: pct,
    label: label, tone: tone, LABELS: LABELS,
    invoiceStatus: invoiceStatus, invoiceOutstanding: invoiceOutstanding, lateFee: lateFee, daysOverdue: daysOverdue,
    agingBuckets: agingBuckets, collectionStats: collectionStats,
    leaseExpiry: leaseExpiry,
    WO_TRANSITIONS: WO_TRANSITIONS, woActions: woActions, woCanTransition: woCanTransition, woTargetState: woTargetState, slaState: slaState,
    inspectionOverall: inspectionOverall, inspectionComplete: inspectionComplete, depositDeductions: depositDeductions,
    humanMins: humanMins
  };
})();
