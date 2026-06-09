# Watad walkthrough

A scripted recruiter / interviewer demo of the Watad smart-building / BMS
operations console. Every step has been smoke-tested against the live site at
<https://saadm.dev/watad/> and works at any time of day. **Total runtime: ~6
minutes if you click through; ~12 minutes if you read the under-the-hood notes
between steps.**

Each step lists:

- **Do this** - the click / URL
- **You'll see** - the visible result you can verify
- **Under the hood** - what the code is actually doing (skip on first pass)

---

## Pre-flight

| | |
|---|---|
| **URL** | <https://saadm.dev/watad/> |
| **Aliases** | `/bms` → console · `/building` → landing · `/facilities` → console |
| **Mode** | Demo (default) - deterministic mock AI replies + simulated telemetry. **Live mode** is one Cloudflare Worker secret away; see `watad/README.md`. |
| **Browser** | Chrome / Edge / Safari / Firefox. **Tablet+ landscape recommended** (full floor-plan layout). Phones get a stacked fallback. |
| **State** | Lives in `localStorage` under `watad.*` keys. The admin **Settings → Reset demo data** button wipes it. |
| **Audio** | The console plays a Web Audio chime on every new urgent / critical alarm. Modern browsers require **at least one click on the page first** to unlock audio. |

If you'd like to follow this as a guided tour, keep this file open in one
tab and the demo open in another.

---

## Step 1 - Landing page

**Do this:** open <https://saadm.dev/watad/>.

**You'll see:**

- Hero with headline *"Building operations, live on a floor plan."*
- Three CTAs in the hero - **Open operations console**, **Energy dashboard**, **Open admin**.
- A mocked chiller-summary card on the right (CH-1, CHWS 44.2 °F, condenser 94.2 °F ⚠, AI snippet).
- A mode badge top-right reading **Demo mode** (or **Live · Haiku 4.5** if the Worker proxy is configured).
- Six explainer cards: live floor plan · simulated BACnet/Modbus stream · alarm management · predictive-maintenance WOs · energy dashboard · industrial AI copilot.
- A "Two-minute walkthrough" card with 7 numbered steps that link to the relevant pages.

**Under the hood:** `index.html` is a static landing page. It loads `data.js`,
`mock-api.js`, `ai-engine.js`, `app.js` so the mode badge can call
`WatadAI.health()` and flip Live / Demo based on whether
`/api/watad/ai/health` returns `live: true`.

---

## Step 2 - Operations console · first paint

**Do this:** click **Open operations console** (or go to
<https://saadm.dev/watad/console.html>).

**You'll see, within ~200 ms:**

- **Topbar:** Watad brand · Console / Work orders / Energy / Admin nav · BACnet status pill ("3 trunks · 182 points · gateway online") · Demo / Live mode badge.
- **KPI strip (second row):**
  - 🔴 **Active alarms** - at least **5 active** (the three time-of-day-insensitive seeded alarms always fire: CH-1 condenser high, CT-1 basin critical, L2 boardroom CO₂ over 1000 ppm - plus AHU-L2 filter ΔP warning and main-meter low PF warning).
  - ⚡ **Real power** - live kW reading from the main meter, e.g. *242.3 kW*.
  - 🌡 **Avg zone temp** - averaged across all `zone_temp` points, e.g. *73.4 °F*.
  - 👥 **Occupancy** - % of occupancy sensors currently reading "present".
  - 🌳 **Today kgCO₂** - `today_kwh × 0.4032` (UAE grid factor from settings).
- **Main canvas:** Level 1 floor plan rendered as SVG with grid background, zone outlines, zone labels (Acme · East, Nour Legal, etc.), and equipment icons positioned at absolute pixel coordinates. Floor switcher above ("Roof / MEP", "Level 2", "Level 1", "Ground") with **Level 1** active.
- **Alarm queue side panel (right ~360 px):** sorted **critical → urgent → warning → info → age desc**. The CT-1 basin-temp critical alarm sits at the top with a pulsing red dot. Each row has **Ack · Create WO · ✦ Explain · → (drill)** buttons.
- **Trend strip (bottom 160 px):** three mini SVG line charts - **Real power**, **Avg zone temp** (with a green ASHRAE comfort band overlay 68-76 °F), **Active alarms**. Each card pre-populated with ~60 historical samples from the seeded RNG buffer so the lines aren't empty.

**Under the hood:** `console.js` calls `WatadSim.start()` which executes
`_seedHistory()` first - 288 samples × 182 points generated from a
deterministic-feeling generator before paint. Then it calls
`WatadFloorPlan.render()` (custom SVG with `<button class="wtd-equip">`
absolute-positioned for each asset) and subscribes to sim ticks. Diff-rendering
on every tick keeps it flicker-free.

---

## Step 3 - Operations console · live tick

**Do this:** stay on the console. Wait **~5 seconds** without clicking anything.

**You'll see:**

- The **Real power** KPI tile changes (gentle drift, e.g. 242.3 → 245.1 kW).
- The trend-strip mini charts each advance by one sample.
- Tooltip values on equipment icons (hover any chiller / AHU / FCU) update in real time.
- Within **~60 seconds** a new alarm typically fires from a threshold breach - you'll hear a Web Audio chime (frequency varies by severity: critical 1100 Hz square wave + 250 ms double-pulse · urgent 880 Hz sine · info 660 Hz), a card flashes briefly red, and a toast appears bottom-right.

**Under the hood:** `WatadSim._tick()` runs every 5 s. For every point it
calls `computeValueAt(p, asset, prev, ts, outdoor_temp_f)` which mutates the
value plausibly by asset class + time of day + occupancy schedule (Sun-Thu
07:00-19:00 GST per `sch-business`) + synthesised outdoor temp curve (78 °F at
06:00 → 104 °F at 16:00). New samples roll the 288-element history buffer.
Threshold breaches raise alarms; recovery clears them. Sim alarms also POST to
`/watad/api/alarms/_sim_raise` so they appear in the admin Alarms tab.

---

## Step 4 - Drill into an asset (CH-1 chiller)

**Do this:** in the floor plan, switch to **Roof / MEP** (top floor tab). You'll see two pulsing blue chiller icons (`❄ CH-1`, `❄ CH-2`) and two cooling-tower icons (`🌀 CT-1`, `🌀 CT-2`). Click **CH-1** (the leftmost chiller, alarming because its condenser temp is over 95 °F).

*Equivalent direct link:* <https://saadm.dev/watad/asset.html?id=as-chiller-1>

**You'll see:**

- **Header:** `❄ CH-1 · 250 TR` with a chip showing **URGENT · N active** and "last comm · HH:MM" stamp.
- **Subtitle:** `chiller · Roof / MEP / Chiller Plant · Trane RTAC 250 · firmware 4.2.1`.
- **📈 Last 24 hours · 6 points** - multi-line SVG overlay of CHWS / CHWR / condenser temp / load / power, with a colour-coded legend showing the current value of each.
- **🔔 Alarms (N)** - at least the live condenser-temp urgent row, with an **Ack** button.
- **🛠 Work orders (N)** - `wo-1: Replace CH-1 condenser fan motor bearing` (in-progress, urgent) and possibly `wo-5: PM - Chiller annual oil sample CH-2` if the seed pulled it in.
- **🏷 Asset metadata** - ID, Type, Model, Firmware, Install date, Floor, Zone, Controller, Rated kW grid.
- **Right side panel:**
  - **✦ AI suggested maintenance** card with a primary "Suggest now" button.
  - **⚙ Manual override** card - setpoint inputs for CHWS (44 °F) appear here (operator-only, audit-logged).
  - **📍 Live point readings** table - every point with its current value + timestamp, refreshed every 5 s in place.

**Under the hood:** asset.js parses `?id=` from the URL (defaults to
`as-chiller-1` if missing) and calls `GET /watad/api/assets/<id>`. The
mock-api returns `{ asset, points, alarms, work_orders }` in one shot. The
24h chart is hand-rolled SVG (no library) - pulls `WatadSim.getHistory(id)`
for each analog point, computes a shared y-range, draws path elements.

---

## Step 5 - Explain alarm with AI

**Do this:** go back to the console (top nav). In the alarm queue, find the
CH-1 condenser-temp alarm and click **✦ Explain**.

**You'll see:**

- A modal opens titled **✦ Explain alarm with AI**.
- For ~0.4-1.2 s a spinner ("Asking AI…").
- Then **two paragraphs** in this shape:

  > **Action:** Dispatch a technician to CH-1 within the hour to confirm condenser-water flow and basin condition.
  >
  > **Likely cause:** Condenser-side approach has widened - most often refrigerant overcharge, condenser-coil fouling, or low CT basin level reducing heat rejection. Cross-check CT-1 fan VFD speed and basin temp. If both look normal, prioritise the chiller-side: schedule an oil-sample analysis and check for non-condensables.

- A mode chip - **mock** in Demo mode, **live** in Live mode.
- A model + latency line: `claude-haiku-4-5-20251001 · 312ms`.
- A footer with **Close** and **Acknowledge alarm** buttons.

**Under the hood:** `WatadAI.explainAlarm({alarm, asset})` builds a payload
with the alarm + asset JSON, calls `/api/watad/ai/call`. In Demo mode that
request fails (no Worker) and `mockReply()` runs the title through a
regex-keyed dictionary in `ai-engine.js` - the condenser-temp branch matches
on `/condenser.*temp.*(high|critical|94|95)/`. In Live mode the Worker
proxies to Claude with the BMS-tuned system prompt.

---

## Step 6 - Create work order from alarm

**Do this:** close the AI modal. On the same alarm row click **Create WO**.

**You'll see:**

- A modal **Create work order from alarm** with these pre-filled fields:
  - **Title:** the alarm's title verbatim
  - **Asset:** CH-1 · 250 TR (disabled - locked to the alarm's asset)
  - **Priority:** **Urgent** (auto-bumped because alarm severity is urgent / critical)
  - **Assignee:** dropdown of operators + technicians (Rashid, Amani, Omar, Noura, Saif - Layla excluded as admin)
  - **Due in (hours):** `1` for critical, `4` for urgent, `24` otherwise
  - **Description:** "Alarm: <title>\n\nFrom Watad console at <timestamp>."
- Click **Create work order**.
- Toast bottom-right: `Created WO-1016` (the next available WO number, advancing from the seeded 1015).
- Modal closes.

**Verify it landed:** click **Work orders** in the top nav. Your new WO sits
at the top of the **Open** filter chip.

**Under the hood:** `POST /watad/api/work-orders` with the body. The mock-api
computes the next `wo_no` by scanning `WORK_ORDERS.map(w => parseInt(w.wo_no))
.max() + 1`, persists to `localStorage` under `watad.wo.created`, and audits
to `watad.audit`.

---

## Step 7 - Acknowledge an alarm

**Do this:** in the alarm queue, on any alarm, click **Ack**.

**You'll see:**

- Toast bottom-right: `Alarm acknowledged`.
- The alarm immediately disappears from the queue.
- The **Active alarms** KPI tile decrements by 1.

**Verify the audit:** open
<https://saadm.dev/watad/admin.html#audit> - your action is at the top
("alarm.ack · <alarm-id>").

**Under the hood:** `POST /watad/api/alarms/<id>/ack` with `{ack_by:
'st-rashid'}`. The mock-api persists the ack timestamp under
`watad.alarm.acks` keyed by id. Note: the seeded alarms in `data.js` and the
sim alarms in `WatadSim.alarmsByPoint` are separate - Ack visually removes
from the side panel (which reads sim state). The seeded alarm shows up
acknowledged in **Admin → Alarms** instead.

---

## Step 8 - Switch floors

**Do this:** at the top of the floor plan, click each floor tab in order:
**Roof / MEP → Level 2 → Level 1 → Ground**.

**You'll see:**

- Each floor renders a different wall layout, different zone labels (Mirage Studios on L2, Acme Capital · East on L1, Main Lobby on Ground, Chiller Plant on Roof), and different equipment placements.
- The "X zones · Y assets · Zk ft²" meta in the floor head updates.
- Roof has the two chillers + two cooling towers + main meter - that's where the heaviest alarming happens.
- Ground has the lobby AHU + 4 FCUs + lobby lighting + ground meter + lobby occupancy sensor - only the meter pulses if any.

**Under the hood:** `WatadFloorPlan.render(host, floorId)` rebuilds the SVG +
icon buttons. Wall outlines are hand-tuned SVG `<path d="…">` strings in
`floorplan.js`. Equipment colours: chiller blue, cooling tower cyan, AHU teal,
FCU green, light amber, meter violet, sensors slate.

---

## Step 9 - Energy dashboard

**Do this:** click **Energy** in the top nav (or go to
<https://saadm.dev/watad/energy.html>).

**You'll see:**

- **Five KPI tiles:**
  - **Today kWh** - sum of today's records across all 8 meters, with a `+/-N% vs yesterday` sub-line.
  - **Cost today** - `AED ${kWh × 0.32}` (tariff from settings).
  - **kgCO₂ today** - `kWh × 0.4032` (grid factor from settings).
  - **Peak kW today** - `max(peak_kw)` from today's rows.
  - **30-day total** - total MWh.
- **Daily kWh - last 30 days** bar chart (~1000 × 240 SVG):
  - Y-axis: kWh labels.
  - X-axis: 30 daily bars, labelled every 5 days (MM-DD).
  - **ASHRAE 90.1 target band** shown as a translucent green horizontal band overlay (75-95 % of 30-day average).
  - Bars **green** when below band, **cyan** when inside, **amber** when above.
- **Sub-meters · today** table sorted by today's kWh: each row shows kWh + % of total + vs-yesterday trend arrow (🔺 amber up, 🔻 green down, em-dash unchanged).
- **DEWA DSM demand-response events** - 5 weekday windows (14:00-17:00) with AED 0.18/kWh tariff credit + 120 kWh projected curtailment + opt-in checkbox per row.
- **✦ AI optimise setpoints** card with a "Suggest optimisations" button.

**Under the hood:** energy.js calls `GET /watad/api/energy/history` (returns
the 210 ENERGY_HISTORY records). Bar colours come from comparing each day's
total against the avg ± band. The ASHRAE overlay band rect is drawn first so
bars paint over it.

---

## Step 10 - AI optimise setpoints

**Do this:** still on the Energy page, click **Suggest optimisations** in the
AI card.

**You'll see:**

- Spinner ("Analysing occupancy + outdoor temp + setpoints…") for ~0.4-1.2 s.
- Then **3 numbered suggestions** with **bold task names**, e.g.:

  > 1. **Bump unoccupied-zone CSP from 75°F → 78°F** during 19:00-06:00 - occupancy is normal. Stays inside ASHRAE 55 night setback comfort window. **Est. saving: 38 kWh/day (~AED 12/day, ~AED 4,400/yr).**
  >
  > 2. **Pre-cool L1/L2 by 1°F from 06:00-07:00** to coast through the morning ramp at lower compressor lift. With outdoor at 96°F this morning, CH-1 lift is high. **Est. saving: 22 kWh/day (~AED 7/day, ~AED 2,600/yr).**
  >
  > 3. **Reset CHWS from 44°F → 45°F** between 11:00-15:00 when load profile is steady. Trane curves show ~1.6% kW reduction per °F reset. **Est. saving: 18 kWh/day (~AED 6/day, ~AED 2,100/yr).**

- Footer: **Total annual saving: ~AED 9,100** with an A/B test recommendation.
- Mode chip + model + latency line below.

**Under the hood:** `WatadAI.optimizeSetpoints({occupancy_pct, outdoor_temp_f,
current_setpoints})` builds the context from the live sim state and the seeded
zone setpoints. Mock dictionary populates the outdoor temp inline so the
suggestion text personalises against the current sim conditions.

---

## Step 11 - Work orders module

**Do this:** click **Work orders** in the top nav (or go to
<https://saadm.dev/watad/workorders.html>).

**You'll see:**

- Six **filter chips** with live counts: **All · Open · In progress · On hold · Completed · Cancelled**. Click any to filter the table.
- Search box top-right.
- Table columns: WO# · Title · Asset · Priority · Assignee · Created · Due · Status · (Open).
- 15 seeded WOs + any you created in Step 6.

**Now click the search box** and type `chiller` - table narrows to chiller WOs.

**Click Open** on any row.

**You'll see:**

- Modal opens with WO# / Asset / Priority headline, full description, parts list, two dropdowns (Status, Assignee), comments timeline, an **Add comment** input + button, and a **signature canvas** with **Clear** below.
- The canvas accepts mouse + touch input. Sign your name with a squiggle.
- Click **Add** after typing a comment - the modal re-opens with your new comment timestamped at the bottom.
- Change **Status** → Save changes → toast `Saved`, the row's status chip updates in the underlying table when the modal closes.
- **Delete** → confirm → row removed (persisted as a tombstone in `watad.wo.deleted`).

**Under the hood:** `GET /work-orders/<id>` for drill-in, `POST
/work-orders/<id>/comments` for the timeline append, `PUT /work-orders/<id>`
for status/assignee, `DELETE /work-orders/<id>` for tombstone. The signature
canvas uses raw 2D context paths; not saved server-side (it's a UX
demonstration - the signature counts as proof-of-completion in the operator
flow).

---

## Step 12 - Admin · Dashboard

**Do this:** click **Admin** in the top nav (or go to
<https://saadm.dev/watad/admin.html>).

**You'll see:**

- Sidebar left: 11 sections grouped - **Operate** (Dashboard, Work orders) · **Building** (Assets, Points, Alarms, Schedules) · **Team** (Staff) · **Intelligence** (AI Console) · **Setup** (Integrations, Settings, Audit log).
- Top bar: section title · mode badge · Layla Hassan / admin pill.
- **Dashboard content:**
  - **6 KPI tiles** - Alarms critical / urgent / warning + Live power + Avg zone temp + Occupancy.
  - **Last 7 days · total kWh** bar chart (Sun-Sat).
  - **Top alarming assets** - top-5 ranked by raise count.
  - **Alarms by hour of day** heatmap - 24 cells, intensity by frequency (green → red).
  - **Recent alarms** table - most recent 8 with severity + status chips.

**Under the hood:** `GET /watad/api/admin/dashboard` returns one bundled
payload - KPIs, recent alarms, top alarming, weekly_kwh series, by_hour
array. Server-side aggregation in `mock-api.js → dashboardKpis()`.

---

## Step 13 - Admin · Points (live values)

**Do this:** in the sidebar click **Points** (or visit
<https://saadm.dev/watad/admin.html#points>).

**You'll see:**

- Asset filter dropdown · search box · counter (e.g. "182 / 182 points").
- Table: Point · Asset · Kind chip · Setpoint · Hi-alarm · Lo-alarm · **Current** (live).
- The **Current** column shows live values from `WatadSim` - values refresh on every tick because the simulator is running in the background.
- Filter to `as-chiller-1` to see all 6 of its points (Run status, CHWS, CHWR, Condenser temp, Load, Power) - Condenser temp will read ~99-103 °F (above its 95 °F hi-alarm, in amber).

**Under the hood:** `GET /watad/api/points` returns the seeded register
merged with any operator setpoint edits from `watad.point.edits`. The "Current"
column is decorated client-side using `WatadSim.getPoint(id).value`.

---

## Step 14 - Admin · Alarms (history audit)

**Do this:** click **Alarms** in the sidebar.

**You'll see:**

- Status filter chips (**all · active · cleared**) and severity chips
  (**all · critical · urgent · warning · info**).
- Table columns: Severity · Title · Asset · Raised · Acked · Cleared.
- **30 seeded alarms** mixed with any sim-raised alarms - 13 active /
  acknowledged + 17 cleared historical.
- Acked column populated for alarms you Ack'd in Step 7; Cleared column for
  the 17 historical entries.

**Under the hood:** `GET /watad/api/alarms` returns
`WATAD_DATA.ALARMS + alarm_extra + acks` merged. Sort by severity then raise
desc.

---

## Step 15 - Admin · AI Console (test with sample)

**Do this:** click **AI Console** in the sidebar.

**You'll see:**

- **Model picker** - three radio cards: **Haiku 4.5** (fastest, cheapest) · **Sonnet 4.6** (balanced) · **Opus 4.7** (highest quality). Click to switch - the selected card highlights cyan.
- **System prompt** textarea (editable, ~5 lines, pre-populated with the building-operator persona).
- Three side-by-side knobs: **Temperature** (0.4 default) · **Max tokens** (600 default) · **Prompt cache** (Enabled / Disabled).
- **Save AI settings** primary button.
- **Test with sample alarm** secondary button (top-right).

**Click Test with sample alarm.**

**You'll see:**

- Loading spinner ("Generating sample alarm explanation…").
- A card with the title **Sample alarm explanation** + mode chip (mock / live) + the same two-paragraph format you saw in Step 5 (using a fake CH-1 condenser-temp alarm). Latency + model footer.

**Change the model from Haiku to Sonnet, then click Save AI settings.**

**You'll see:** toast `AI settings saved`. The setting persists to
`watad.settings.overrides` and is read back by `WatadAI.call()` on the next
AI invocation anywhere in the app.

---

## Step 16 - Admin · Integrations

**Do this:** click **Integrations** in the sidebar.

**You'll see:**

- A grid of 6 cards: **BACnet IP Gateway · Modbus TCP · DALI Lighting · MQTT Broker · IBM Maximo CMMS · ServiceNow**.
- Each card shows icon · name · last-connect timestamp · connected/disconnected chip · details (e.g. "3 trunks · 87 devices · 182 points").
- **Connect / Disconnect** button toggles state and persists to
  `watad.integ.overrides`.

**Under the hood:** `POST /watad/api/integrations/<id>` toggles the status
and audits.

---

## Step 17 - Admin · Schedules + Staff

**Do this:** click **Schedules**.

**You'll see** a table with 4 schedules (`sch-business`, `sch-public`,
`sch-24x7`, `sch-cleaning`) and a column per weekday showing the active
windows.

**Click Staff.**

**You'll see** the 6-row staff roster with avatars (Unsplash thumbnails),
role chips (admin / tech / operator), shift, online dot, and a
**Permission matrix** card listing what operators / techs / admins can each
do.

---

## Step 18 - Admin · Audit log + CSV export

**Do this:** click **Audit log**.

**You'll see:**

- Entry counter top-left + **Export CSV** button top-right.
- Table: When · Actor · Action · Target · Details.
- Every action you've taken in the demo (ack'd alarms, created WOs, changed
  settings, toggled integrations) is here with millisecond timestamps. The
  layla actor handle resolves to her display name "Layla Hassan" in the table.

**Click Export CSV.**

**You'll see:** browser downloads `watad-audit-2026-05-18.csv` with the same
rows. Toast confirms count.

---

## Step 19 - Admin · Settings + Reset demo

**Do this:** click **Settings**.

**You'll see:**

- **Building** card: name, address, hours, time zone.
- **Energy** card: currency, tariff/kWh, CO₂ factor, units (imperial / metric), ASHRAE band low + high.
- **Save settings** + **Reset demo data** (red).

**Try this:** change tariff from `0.32` → `0.45`, save. Then go back to
**Energy** → **Cost today** KPI now uses AED 0.45 multiplier. The tariff
flows from settings into both the energy dashboard *and* the AI
optimize-setpoints saving estimates.

**Then click Reset demo data → confirm.** The page reloads. Every Ack, WO,
setting edit, integration toggle, AI log is wiped. Seed data returns intact.

**Under the hood:** `POST /watad/api/admin/reset-demo` iterates the
`watad.*` localStorage keys and removes them, then calls `WatadSim.reset()`
which restarts the simulator from t=0.

---

## Step 20 - Friendly aliases + 404

**Do this:** try each in a new tab:

- <https://saadm.dev/bms> → 302 to the console
- <https://saadm.dev/building> → 302 to the landing
- <https://saadm.dev/facilities> → 302 to the console
- <https://saadm.dev/watad/this-does-not-exist> → branded 404 ("Point not on the trunk.") with links back to every section

---

## Step 21 - Optional: enable Live mode

Demo mode is good enough for any recruiter conversation - the mock replies
are written in the same voice as the live Claude responses. But if you want
to flip on real Claude:

1. Cloudflare → Workers & Pages → site → Settings → Variables and Secrets.
2. Add (or reuse from Sanad) `ANTHROPIC_API_KEY = sk-ant-…`.
3. Extend the existing `_worker.js` with the `/api/watad/ai/*` handler
   (snippet at the bottom of `watad/README.md`).
4. Push or trigger a redeploy.
5. Reload any Watad page. The mode badge flips to **Live · Haiku 4.5** and
   `WatadAI.health()` returns `{live: true}`.

Cost guardrails: ~AED 0.005 per `explain_alarm` call, ~AED 0.015 for
`suggest_maintenance`, ~AED 0.020 for `optimize_setpoints`. Worker rate-limits
20 calls / minute / IP.

---

## Quick reference

| Goal | Where |
|------|-------|
| See live data | <https://saadm.dev/watad/console.html> |
| Drill into a chiller | <https://saadm.dev/watad/asset.html?id=as-chiller-1> |
| 24h trend chart | inside asset detail |
| Create a work order | console alarm card → Create WO **or** workorders.html → + New |
| ASHRAE 90.1 overlay | <https://saadm.dev/watad/energy.html> |
| AI-suggested maintenance | asset detail → ✦ Suggest now |
| AI-explain alarm | console alarm card → ✦ Explain |
| AI-optimise setpoints | energy.html → Suggest optimisations |
| Model selector | <https://saadm.dev/watad/admin.html#ai_console> |
| All telemetry points | <https://saadm.dev/watad/admin.html#points> |
| Audit log + CSV | <https://saadm.dev/watad/admin.html#audit> |
| Reset everything | <https://saadm.dev/watad/admin.html#settings> → Reset demo data |
| Live mode setup | `watad/README.md` |

---

## What this demo proves to a recruiter

- I can think in **real-time data shapes** - telemetry simulator with a subscriber pattern, not request/response CRUD.
- I understand **industrial protocols** - BACnet IP / Modbus TCP / DALI lighting, schedules, point-types (analog / binary / multistate), hi-/lo-alarm thresholds.
- I understand **facilities operations** - work-order pipelines, signature-on-completion, PM cycles, alarm severity rankings, schedule-driven occupancy, ASHRAE 90.1 + 55 references.
- I can integrate **LLMs into operator workflows** safely - Live/Mock fallback, system-prompt control, cost tracking, model selection, audit on every call.
- I ship **end-to-end**: design system, seed data, API, simulator, console, drill-ins, admin SPA, AI integration, 404, sitemap entries, friendly aliases - all without a framework.

This is the gap UAE facilities-management (Imdaad / EFS / Farnek),
building-automation (Schneider / Honeywell / Siemens), energy utilities
(DEWA / Masdar), and data-centre operators (Khazna) hire for. There aren't
many electrical engineers in Dubai who can also ship a BMS console like this.
