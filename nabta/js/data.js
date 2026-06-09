/* data.js - Nabta HR + payroll seed.
 * UAE-flavoured HRIS: 32 employees across 4 departments, leave balances,
 * 6 months of WPS payroll runs, recruitment pipeline with 18 candidates,
 * performance review cycle in flight, HR policy KB. */
(function () {
  'use strict';

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var rand = mulberry32(20260521);
  function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }
  function isoAgo(days) { return new Date(Date.now() - days * 86400000).toISOString(); }

  // Company
  var COMPANY = {
    id: 'co-1',
    name: 'Sila Trading FZ-LLC',
    trade_license: 'DED 1234567',
    address: 'Office 2103, Boulevard Tower B, Downtown Dubai',
    wps_employer_code: 'WPS-AE-0042',
    bank: 'Emirates NBD',
    iban: 'AE070260001234567890123',
    employees_count: 32
  };

  var DEPTS = [
    { id: 'dept-eng',  name: 'Engineering',  color: '#6e8eff', head: 'em-001' },
    { id: 'dept-ops',  name: 'Operations',   color: '#34d399', head: 'em-005' },
    { id: 'dept-sales',name: 'Sales',        color: '#fb923c', head: 'em-009' },
    { id: 'dept-cs',   name: 'Customer Success', color: '#a78bfa', head: 'em-013' },
    { id: 'dept-fin',  name: 'Finance & HR', color: '#facc15', head: 'em-017' }
  ];

  var FIRST = ['Hassan','Layla','Khalid','Noura','Omar','Hind','Tariq','Sara','Yusuf','Aisha','Bilal','Marwa','Faisal','Mariam','Adel','Reem','Karim','Fatima','Imran','Ziad','Mona','Sami','Amira','Wael','Lina','Anas','Dina','Saif','Rola','Tamer','Yara','Zaid'];
  var LAST  = ['Mansouri','Khan','Rashid','Falasi','Hussain','Mahmood','Iqbal','Yousaf','Bin Saif','Al-Nahyan','Saleem','Latif','Mughal','Bin Hamad','Al-Suwaidi','Al-Maktoum'];
  var NATIONALITIES = ['UAE','Pakistan','India','Egypt','Jordan','Lebanon','Philippines','UK','Sudan','Syria'];
  var JOB_TITLES_BY_DEPT = {
    'dept-eng':   ['Senior Software Engineer','Software Engineer','DevOps Engineer','QA Engineer','Engineering Manager','Tech Lead','Junior Software Engineer','Solutions Architect'],
    'dept-ops':   ['Operations Manager','Logistics Coordinator','Procurement Officer','Operations Analyst','Site Supervisor'],
    'dept-sales': ['Sales Manager','Senior Account Executive','Account Executive','SDR','Sales Engineer','Key Account Manager'],
    'dept-cs':    ['Customer Success Manager','Customer Support Lead','Onboarding Specialist','Support Engineer'],
    'dept-fin':   ['CFO','HR Director','Finance Manager','HR Business Partner','Accountant','Payroll Specialist','Recruiter']
  };

  var EMPLOYEES = [];
  for (var i = 0; i < 32; i++) {
    var deptIdx = i < 8 ? 0 : i < 14 ? 1 : i < 20 ? 2 : i < 26 ? 3 : 4;
    var dept = DEPTS[deptIdx];
    var titles = JOB_TITLES_BY_DEPT[dept.id];
    var title = titles[i % titles.length];
    var fn = FIRST[i];
    var ln = LAST[i % LAST.length];
    var hireDaysAgo = Math.floor(40 + rand() * (365 * 4));   // 40d to ~4y ago
    var baseSalary = title.indexOf('CFO') !== -1 ? 38000
                   : title.indexOf('Director') !== -1 ? 30000
                   : title.indexOf('Manager') !== -1 || title.indexOf('Lead') !== -1 ? 22000 + Math.floor(rand() * 6000)
                   : title.indexOf('Senior') !== -1 || title.indexOf('Architect') !== -1 ? 18000 + Math.floor(rand() * 4000)
                   : title.indexOf('Junior') !== -1 || title.indexOf('SDR') !== -1 ? 9000 + Math.floor(rand() * 3000)
                   : 13000 + Math.floor(rand() * 4000);
    var allowances = Math.round(baseSalary * 0.25);    // typical UAE housing+transport
    var status = (i === 30 || i === 31) ? 'probation' : 'active';
    if (i === 6) status = 'notice';                    // one person on notice period
    EMPLOYEES.push({
      id: 'em-' + String(i + 1).padStart(3, '0'),
      first_name: fn,
      last_name: ln,
      name: fn + ' ' + ln,
      email: (fn + '.' + ln).toLowerCase().replace(/[^a-z]+/g, '.') + '@sila.demo',
      phone: '+9715' + (10 + Math.floor(rand() * 90)) + Math.floor(rand() * 9000000),
      dept_id: dept.id,
      title: title,
      manager_id: i === 0 ? null : EMPLOYEES[Math.max(0, i - 1 - (i % 4))] ? EMPLOYEES[Math.max(0, i - 1 - (i % 4))].id : null,
      hire_date: isoAgo(hireDaysAgo).slice(0, 10),
      status: status,
      nationality: pick(NATIONALITIES),
      passport: 'P' + (1000000 + Math.floor(rand() * 8999999)),
      emirates_id: '784-' + (1980 + Math.floor(rand() * 30)) + '-' + Math.floor(rand() * 9999999).toString().padStart(7, '0') + '-' + Math.floor(rand() * 9),
      visa_expires: isoAgo(-(i < 4 ? Math.floor(15 + rand() * 35) : Math.floor(60 + rand() * 600))).slice(0, 10),
      base_salary_aed: baseSalary,
      allowances_aed: allowances,
      total_salary_aed: baseSalary + allowances,
      iban: 'AE0' + Math.floor(rand() * 9) + '0000' + Math.floor(rand() * 99999999999).toString().padStart(11, '0'),
      annual_leave_total: 30,
      annual_leave_taken: Math.floor(rand() * 18),
      sick_leave_total: 15,
      sick_leave_taken: Math.floor(rand() * 4),
      photo_initials: (fn[0] + ln[0]).toUpperCase()
    });
  }

  // Leave requests - 14 in various states
  var LEAVE_TYPES = ['Annual','Sick','Maternity','Paternity','Unpaid','Compassionate','Hajj/Umrah'];
  var LEAVE_STATUSES = ['pending','approved','rejected','taken'];
  var LEAVE = [];
  var leaveSerial = 200;
  for (var lr = 0; lr < 18; lr++) {
    var emp = EMPLOYEES[Math.floor(rand() * EMPLOYEES.length)];
    var startDaysFromNow = -10 + Math.floor(rand() * 30);
    var duration = 1 + Math.floor(rand() * 9);
    var status;
    if (lr < 5) status = 'pending';
    else if (lr < 13) status = 'approved';
    else if (lr < 15) status = 'taken';
    else status = 'rejected';
    var n = leaveSerial++;
    LEAVE.push({
      id: 'lv-' + n,
      number: 'LV-' + n,
      employee_id: emp.id,
      employee_name: emp.name,
      type: pick(LEAVE_TYPES),
      start_date: new Date(Date.now() + startDaysFromNow * 86400000).toISOString().slice(0, 10),
      end_date: new Date(Date.now() + (startDaysFromNow + duration - 1) * 86400000).toISOString().slice(0, 10),
      days: duration,
      reason: pick(['Family visit', 'Medical appointment', 'Personal matter', 'Travel', 'Wedding', 'Religious obligation']),
      status: status,
      submitted_at: isoAgo(Math.floor(rand() * 14)),
      approved_at: status === 'approved' ? isoAgo(Math.floor(rand() * 10)) : null,
      approved_by: status === 'approved' ? 'em-017' : null,
      notes: ''
    });
  }

  // Payroll runs - last 6 months + current draft
  var PAYROLL_RUNS = [];
  for (var m = 6; m >= 0; m--) {
    var d = new Date(); d.setMonth(d.getMonth() - m); d.setDate(1);
    var month = d.toISOString().slice(0, 7);
    var totalGross = EMPLOYEES.reduce(function (s, e) { return s + e.total_salary_aed; }, 0);
    var deductions = Math.round(totalGross * 0.02);
    PAYROLL_RUNS.push({
      id: 'pr-' + month,
      month: month,
      label: d.toLocaleDateString('en', { month: 'long', year: 'numeric' }),
      status: m === 0 ? 'draft' : 'paid',
      employees_count: EMPLOYEES.length,
      gross_total: totalGross,
      deductions: deductions,
      net_total: totalGross - deductions,
      paid_at: m === 0 ? null : isoAgo(m * 30 - 2),
      wps_sif_generated: m !== 0,
      wps_acknowledged: m > 0
    });
  }

  // Candidates / recruitment pipeline
  var STAGES = ['lead', 'applied', 'interview', 'offer', 'hired', 'rejected'];
  var ROLES_OPEN = [
    { id: 'role-001', title: 'Senior Backend Engineer', dept_id: 'dept-eng', salary_range: '20-26k AED', remote: 'hybrid', status: 'open' },
    { id: 'role-002', title: 'Sales Manager · MENA',     dept_id: 'dept-sales', salary_range: '24-30k AED', remote: 'on-site', status: 'open' },
    { id: 'role-003', title: 'Customer Success Lead',    dept_id: 'dept-cs', salary_range: '18-22k AED', remote: 'remote', status: 'open' },
    { id: 'role-004', title: 'Accountant',               dept_id: 'dept-fin', salary_range: '11-15k AED', remote: 'on-site', status: 'open' }
  ];
  var CANDIDATES = [];
  var candSerial = 5000;
  for (var c = 0; c < 22; c++) {
    var role = pick(ROLES_OPEN);
    var stage = STAGES[Math.min(STAGES.length - 1, Math.floor(rand() * 5))];
    var cFn = FIRST[c % FIRST.length];
    var cLn = LAST[(c * 3) % LAST.length];
    CANDIDATES.push({
      id: 'ca-' + (candSerial++),
      name: cFn + ' ' + cLn,
      email: (cFn + '.' + cLn + Math.floor(rand() * 99)).toLowerCase() + '@candidate.demo',
      role_id: role.id,
      role_title: role.title,
      stage: stage,
      source: pick(['LinkedIn','Indeed','Referral','Direct apply','Bayt']),
      applied_at: isoAgo(Math.floor(rand() * 45)),
      rating: stage === 'hired' || stage === 'offer' ? +(4 + rand()).toFixed(1) : +(2.5 + rand() * 2).toFixed(1),
      years_exp: Math.floor(2 + rand() * 12),
      current_salary_aed: Math.floor(8000 + rand() * 22000),
      expected_salary_aed: Math.floor(12000 + rand() * 28000),
      notes: rand() < 0.3 ? pick(['Strong portfolio', 'Notice period 2 months', 'Visa transfer required', 'Open to remote']) : ''
    });
  }

  // Performance review cycle - Q2 in progress
  var REVIEWS = EMPLOYEES.slice(0, 12).map(function (e, i) {
    return {
      id: 'rv-' + e.id,
      employee_id: e.id,
      employee_name: e.name,
      cycle: 'Q2-2026',
      manager_id: 'em-017',
      status: i < 4 ? 'submitted' : i < 8 ? 'in_progress' : 'not_started',
      rating: i < 4 ? +(3.5 + rand() * 1.4).toFixed(1) : null,
      submitted_at: i < 4 ? isoAgo(Math.floor(rand() * 14)) : null,
      goals_met_pct: i < 4 ? Math.floor(60 + rand() * 35) : null
    };
  });

  // HR Policy KB - used by AI policy assistant
  var POLICIES = [
    { id: 'pol-leave', title: 'Annual leave policy', body: "All UAE-based full-time employees accrue 30 calendar days of paid annual leave per year, vesting monthly. Carry-over capped at 15 days into the next calendar year. Sick leave: 15 days fully paid + 30 days half-paid per year per UAE Labour Law. Notice for annual leave: 2 weeks for stretches under 5 days; 4 weeks for longer. Approval via line manager + HR." },
    { id: 'pol-wps',   title: 'WPS (Wage Protection System)', body: "All salaries are paid through the UAE WPS via Emirates NBD on the 28th of each month (or last working day before). SIF file generated on the 26th. Mismatch tolerance is AED 1 per employee - anything larger flags a payroll re-run. Bonuses + commissions are paid in a separate WPS batch on the 15th of the following month." },
    { id: 'pol-visa',  title: 'Visa & residency', body: "Sila Trading sponsors employment visas under our DED 1234567 trade licence. Visa renewal 60 days before expiry - HR initiates, finance covers the AED 850 fee. Employees on visa transfer must serve their existing notice + arrange entry permit. NOC issued by HR director on request. New hires must be onsite within 60 days of visa issuance." },
    { id: 'pol-gratuity', title: 'End-of-service gratuity', body: "Per UAE Labour Law (Federal Decree-Law No. 33 of 2021): 21 days of base salary per year for the first 5 years + 30 days per year thereafter, capped at 2 years' total salary. Calculated on basic salary only - not allowances. Forfeited only in case of gross misconduct. Payable within 14 days of last working day." },
    { id: 'pol-probation', title: 'Probation', body: "All new hires serve a 6-month probation. During probation, termination notice from either side is 14 days. After confirmation, notice becomes 30 days (or 60 days for managers and above). Probation can be extended once by 3 months with HR director approval." },
    { id: 'pol-remote', title: 'Remote & hybrid work', body: "Hybrid baseline: 3 days office + 2 days remote per week. Fully remote requires VP + HR sign-off and applies to specific roles only (engineering ICs, customer success, design). Time-zone overlap requirement: at least 4 working hours overlap with Gulf Standard Time. Equipment provided by company; expensed home-office set-up capped at AED 2,500 per employee." }
  ];

  // Audit log
  var AUDIT_SEED = [
    { id: 'a-1', when: isoAgo(0.05), actor: 'em-018', action: 'leave.approve',  target: 'LV-201', details: 'Approved Annual · 5 days' },
    { id: 'a-2', when: isoAgo(0.15), actor: 'em-017', action: 'payroll.draft',  target: 'pr-' + PAYROLL_RUNS[0].month, details: 'Started current-month draft' },
    { id: 'a-3', when: isoAgo(1.2),  actor: 'em-017', action: 'employee.hire',  target: 'em-031', details: 'Probation 6 months' },
    { id: 'a-4', when: isoAgo(2.0),  actor: 'em-018', action: 'review.submit',  target: 'rv-em-001', details: 'Rating 4.3 · Q2-2026' }
  ];

  var SETTINGS = {
    company_name: COMPANY.name,
    pay_day: 28,
    wps_employer_code: COMPANY.wps_employer_code,
    annual_leave_days: 30,
    sick_leave_days: 15,
    probation_months: 6,
    notice_days_after_probation: 30,
    end_of_service_calc: 'UAE-Labour-2021',
    currency: 'AED',
    model: 'claude-haiku-4-5-20251001',
    system_prompt: "You are Nabta, an HR policy AI assistant for a UAE company. Answer based on the company's HR policies + UAE Labour Law (Federal Decree-Law No. 33 of 2021). Cite the specific policy id [pol-xxx] at the end of sentences that lean on it. Be precise about numbers, dates, and procedures. Don't speculate where the policy is silent - say so and recommend asking HR."
  };

  window.NABTA_DATA = {
    COMPANY: COMPANY,
    DEPTS: DEPTS,
    EMPLOYEES: EMPLOYEES,
    LEAVE: LEAVE,
    PAYROLL_RUNS: PAYROLL_RUNS,
    ROLES_OPEN: ROLES_OPEN,
    CANDIDATES: CANDIDATES,
    REVIEWS: REVIEWS,
    POLICIES: POLICIES,
    AUDIT_SEED: AUDIT_SEED,
    SETTINGS: SETTINGS,
    STAGES: STAGES,
    LEAVE_TYPES: LEAVE_TYPES,
    LEAVE_STATUSES: LEAVE_STATUSES
  };
})();
