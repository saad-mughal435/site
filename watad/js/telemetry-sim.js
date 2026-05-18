/* telemetry-sim.js - The Watad real-time data engine.
 *
 * Ticks every 5 seconds, mutates every point's value plausibly based on
 * asset type + time of day + occupancy schedule + outdoor weather. Raises
 * and clears alarms based on point thresholds. Publishes 'tick',
 * 'alarm-new', 'alarm-cleared' events to subscribers.
 *
 * Keeps a 288-sample history buffer per point in memory (= 24h at 5-min
 * downsampled resolution). On page load the history regenerates from a
 * deterministic seeded RNG so charts always look populated.
 *
 * Exposes window.WatadSim. Pages call WatadSim.start() once, then
 * WatadSim.subscribe(cb) to get pushed updates.
 */
(function () {
  'use strict';
  if (!window.WATAD_DATA) { console.error('telemetry-sim: WATAD_DATA not loaded'); return; }

  var D = window.WATAD_DATA;
  var TICK_MS = 5000;
  var HISTORY_LEN = 288;          // 24h × 12 ticks/min × 5min downsampled = 288
  var HISTORY_STEP_MS = 5 * 60 * 1000;

  var Sim = {
    points: {},                   // pointId -> { value, ts, quality }
    alarmsByPoint: {},            // pointId -> active alarm object (null if none)
    history: {},                  // pointId -> [{t, v}, ...] (newest last)
    subscribers: [],
    started: false,
    tickCount: 0,
    outdoor_temp_f: 92,           // synthesised below

    start: function () {
      if (this.started) return;
      this.started = true;
      this._seedHistory();
      this._tick();               // initial tick
      this._interval = setInterval(this._tick.bind(this), TICK_MS);
    },
    stop: function () { if (this._interval) clearInterval(this._interval); this.started = false; },
    reset: function () { this.stop(); this.points = {}; this.alarmsByPoint = {}; this.history = {}; this.tickCount = 0; this.start(); },

    subscribe: function (cb) { this.subscribers.push(cb); return function () { Sim.subscribers = Sim.subscribers.filter(function (x) { return x !== cb; }); }; },
    publish: function (ev) { this.subscribers.forEach(function (cb) { try { cb(ev); } catch (e) { console.error(e); } }); },

    getPoint: function (id) { return this.points[id] || null; },
    getHistory: function (id) { return this.history[id] ? this.history[id].slice() : []; },
    setPoint: function (id, patch) {
      // Used by mock-api when admin/operator overrides a setpoint
      var p = D.POINTS.find(function (x) { return x.id === id; });
      if (p && patch.setpoint != null) p.setpoint = patch.setpoint;
    },

    // ============ Internal ============
    _tick: function () {
      this.tickCount++;
      this._updateOutdoor();
      var newAlarms = [];
      var clearedAlarms = [];
      var nowIso = new Date().toISOString();
      var nowMs = Date.now();
      var self = this;

      D.POINTS.forEach(function (p) {
        var asset = D.ASSETS.find(function (a) { return a.id === p.asset_id; });
        var newVal = computeValue(p, asset, self.points[p.id] && self.points[p.id].value, self);
        self.points[p.id] = { value: newVal, ts: nowIso, quality: 'good' };

        // Push to history every N ticks so the buffer represents downsampled 5-min averages.
        // (For demo: keep last 288 = 24h. New sample every tick is fine; older samples roll off.)
        if (!self.history[p.id]) self.history[p.id] = [];
        self.history[p.id].push({ t: nowMs, v: newVal });
        if (self.history[p.id].length > HISTORY_LEN) self.history[p.id].shift();

        // Threshold check → alarms
        var alm = self.alarmsByPoint[p.id];
        var sev = checkThreshold(p, newVal);
        if (sev && !alm) {
          alm = {
            id: 'sim-' + p.id + '-' + nowMs,
            asset_id: p.asset_id,
            point_id: p.id,
            severity: sev,
            title: alarmTitle(p, asset, newVal, sev),
            raised_at: nowIso,
            acknowledged_at: null,
            cleared_at: null
          };
          self.alarmsByPoint[p.id] = alm;
          newAlarms.push(alm);
        } else if (!sev && alm) {
          alm.cleared_at = nowIso;
          delete self.alarmsByPoint[p.id];
          clearedAlarms.push(alm);
        }
      });

      // Persist newly-raised alarms via the mock-api so they show up in admin too
      newAlarms.forEach(function (a) {
        fetch('/watad/api/alarms/_sim_raise', { method: 'POST', body: JSON.stringify(a), headers: { 'Content-Type': 'application/json' } });
      });
      clearedAlarms.forEach(function (a) {
        fetch('/watad/api/alarms/_sim_clear', { method: 'POST', body: JSON.stringify({ id: a.id }), headers: { 'Content-Type': 'application/json' } });
      });

      self.publish({ type: 'tick', tickCount: self.tickCount, newAlarms: newAlarms, clearedAlarms: clearedAlarms });
      newAlarms.forEach(function (a) { self.publish({ type: 'alarm-new', alarm: a }); });
      clearedAlarms.forEach(function (a) { self.publish({ type: 'alarm-cleared', alarm: a }); });
    },

    _updateOutdoor: function () {
      // Outdoor temp follows a daily sine: ~78°F at 06:00, ~104°F at 16:00 (Dubai summer).
      var h = new Date().getHours() + new Date().getMinutes() / 60;
      var base = 91 + Math.sin(((h - 9) / 24) * Math.PI * 2) * 13;       // ~78 to 104 range
      this.outdoor_temp_f = base + (Math.random() - 0.5) * 1.5;
    },

    _seedHistory: function () {
      // Backfill 24h of plausible history per point using a deterministic-feeling
      // generator. Each step is HISTORY_STEP_MS apart; values produced via the
      // same computeValue() chain but with a synthesised timestamp.
      var nowMs = Date.now();
      var self = this;
      D.POINTS.forEach(function (p) {
        var asset = D.ASSETS.find(function (a) { return a.id === p.asset_id; });
        self.history[p.id] = [];
        var prev = initialValue(p, asset);
        for (var i = HISTORY_LEN - 1; i >= 0; i--) {
          var t = nowMs - i * HISTORY_STEP_MS;
          var v = computeValueAt(p, asset, prev, t, self.outdoor_temp_f);
          self.history[p.id].push({ t: t, v: v });
          prev = v;
        }
        // Seed current
        self.points[p.id] = { value: prev, ts: new Date().toISOString(), quality: 'good' };
        // Pre-flag alarms for seed values that already breach thresholds
        var sev = checkThreshold(p, prev);
        if (sev) {
          self.alarmsByPoint[p.id] = {
            id: 'sim-init-' + p.id,
            asset_id: p.asset_id, point_id: p.id, severity: sev,
            title: alarmTitle(p, asset, prev, sev),
            raised_at: new Date(nowMs - 60000).toISOString(),
            acknowledged_at: null, cleared_at: null
          };
        }
      });
    }
  };

  // ============ Helpers ============
  function rng(seed) { var x = Math.sin(seed) * 10000; return x - Math.floor(x); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function noise(amp) { return (Math.random() - 0.5) * 2 * amp; }
  function isOccupied(scheduleId) {
    var sch = D.SCHEDULES.find(function (s) { return s.id === scheduleId; });
    if (!sch) return false;
    var d = new Date();
    var day = ['sun','mon','tue','wed','thu','fri','sat'][d.getDay()];
    var windows = sch[day] || [];
    var t = d.getHours() + d.getMinutes() / 60;
    return windows.some(function (w) {
      var s = parseTime(w[0]), e = parseTime(w[1]);
      return t >= s && t < e;
    });
  }
  function parseTime(s) { var p = s.split(':'); return parseInt(p[0],10) + parseInt(p[1],10)/60; }

  function initialValue(p, asset) {
    // Pick a sensible starting value per kind
    if (!p || !asset) return 0;
    var pid = p.id;
    if (/\.status$/.test(pid))     return 1;
    if (/\.chws$/.test(pid))       return 44 + noise(1);
    if (/\.chwr$/.test(pid))       return 54 + noise(1.5);
    if (/\.cond_temp$/.test(pid))  return 86 + noise(3);
    if (/\.load$/.test(pid))       return 55 + noise(15);
    if (/\.power$/.test(pid))      return (asset.rated_kw || 100) * 0.6;
    if (/\.sat$/.test(pid))        return 55 + noise(1);
    if (/\.rat$/.test(pid))        return 73 + noise(2);
    if (/\.filter_dp$/.test(pid))  return 0.6 + noise(0.1);
    if (/\.fan_vfd$/.test(pid) || /\.fan_speed$/.test(pid)) return 60 + noise(10);
    if (/\.basin_temp$/.test(pid)) return 79 + noise(2);
    if (/\.makeup_flow$/.test(pid)) return 12 + noise(2);
    if (/\.zone_temp$/.test(pid))  return 72 + noise(1);
    if (/\.zone_sp$/.test(pid))    return 72;
    if (/\.valve$/.test(pid))      return 40 + noise(20);
    if (/\.level$/.test(pid))      return 70;
    if (/\.kw$/.test(pid))         return assetExpectedKw(asset);
    if (/\.kwh$/.test(pid))        return 1.0e6 + Math.random() * 50000;
    if (/\.pf$/.test(pid))         return 0.92 + noise(0.04);
    if (/\.voltage$/.test(pid))    return 400 + noise(5);
    if (/\.presence$/.test(pid))   return isOccupied('sch-business') ? 1 : 0;
    if (/\.count$/.test(pid))      return isOccupied('sch-business') ? Math.floor(2 + Math.random() * 12) : 0;
    if (/\.co2$/.test(pid))        return 600 + noise(80);
    return 0;
  }
  function assetExpectedKw(a) {
    if (a.type === 'meter' && a.id === 'as-meter-main')    return 220;
    if (a.type === 'meter' && a.id === 'as-meter-chiller') return 140;
    if (a.type === 'meter') return 30 + Math.random() * 15;
    return 10;
  }

  function computeValue(p, asset, prev, sim) {
    return computeValueAt(p, asset, prev, Date.now(), sim.outdoor_temp_f);
  }
  function computeValueAt(p, asset, prev, ts, outdoor) {
    if (!asset) return prev || 0;
    var pid = p.id;
    var hour = new Date(ts).getHours() + new Date(ts).getMinutes() / 60;
    var dayFactor = clamp((Math.sin(((hour - 9) / 24) * Math.PI * 2) + 1) / 2, 0, 1); // 0..1, peak ~15:00
    var occupied = isOccupied(asset.zone_id ? (D.ZONES.find(function (z) { return z.id === asset.zone_id; }) || {}).schedule_id || 'sch-business' : 'sch-business');

    if (asset.type === 'chiller') {
      if (/\.status$/.test(pid))    return prev != null ? prev : 1;
      if (/\.chws$/.test(pid))      return 44 + Math.sin(ts / 600000) * 1.2 + noise(0.4);
      if (/\.chwr$/.test(pid))      return 54 + Math.sin(ts / 600000) * 1.5 + dayFactor * 1.5 + noise(0.6);
      if (/\.cond_temp$/.test(pid)) {
        // Outdoor-temp-driven; chiller-1 occasionally pushes high to fire the seeded alarm
        var base = 80 + (outdoor - 80) * 0.5 + dayFactor * 6;
        if (asset.id === 'as-chiller-1') base += 5;     // intentionally hotter — alarm-prone
        return base + noise(1.2);
      }
      if (/\.load$/.test(pid))      return clamp(30 + dayFactor * 55 + (outdoor - 88) * 1.2 + noise(3), 0, 100);
      if (/\.power$/.test(pid))     return (asset.rated_kw || 170) * (0.4 + dayFactor * 0.5) + noise(4);
    }
    if (asset.type === 'cooling-tower') {
      if (/\.fan_speed$/.test(pid))  return clamp(40 + dayFactor * 50 + noise(6), 0, 100);
      if (/\.basin_temp$/.test(pid)) {
        var base = 78 + (outdoor - 88) * 0.3 + dayFactor * 3;
        if (asset.id === 'as-ct-1') base += 7;          // seeded critical
        return base + noise(0.8);
      }
      if (/\.makeup_flow$/.test(pid)) return 8 + dayFactor * 8 + noise(1);
    }
    if (asset.type === 'ahu') {
      if (/\.status$/.test(pid))    return occupied ? 1 : (prev || 0);
      if (/\.sat$/.test(pid))       return 55 + noise(0.6);
      if (/\.rat$/.test(pid))       return 72 + (occupied ? 1.5 : -0.5) + noise(0.8);
      if (/\.filter_dp$/.test(pid)) {
        var pBase = (prev || 0.6) + 0.0008;            // slowly creeps upward
        if (asset.id === 'as-ahu-l2') pBase = 1.6 + noise(0.05);  // seeded warning
        return Math.min(2.5, pBase);
      }
      if (/\.fan_vfd$/.test(pid))   return occupied ? 65 + noise(8) : 25 + noise(5);
      if (/\.power$/.test(pid))     return (asset.rated_kw || 20) * (occupied ? 0.7 : 0.3) + noise(1);
    }
    if (asset.type === 'fcu') {
      if (/\.status$/.test(pid))    return occupied ? 1 : 0;
      if (/\.zone_temp$/.test(pid)) {
        var sp = p.setpoint || 72;
        var drift = (asset.id === 'as-fcu-l2-3' || asset.id === 'as-fcu-l1-7') ? 6.5 : (occupied ? 0.8 : -0.5);
        return sp + drift + noise(0.6);
      }
      if (/\.zone_sp$/.test(pid))   return p.setpoint || 72;
      if (/\.valve$/.test(pid))     return occupied ? 50 + noise(15) : 12 + noise(8);
    }
    if (asset.type === 'light') {
      if (/\.status$/.test(pid))    return occupied ? 1 : 0;
      if (/\.level$/.test(pid))     return occupied ? 80 + noise(8) : 0;
      if (/\.power$/.test(pid))     return (asset.rated_kw || 5) * (occupied ? (0.7 + noise(0.1)) : 0.02);
    }
    if (asset.type === 'meter') {
      if (/\.kw$/.test(pid)) {
        var expected = assetExpectedKw(asset);
        return expected * (0.7 + dayFactor * 0.4 + noise(0.04));
      }
      if (/\.kwh$/.test(pid))       return (prev || 1.0e6) + Math.max(0.1, (assetExpectedKw(asset) / 720));  // accumulate ~5s slice
      if (/\.pf$/.test(pid)) {
        var pf = 0.92 + noise(0.02);
        if (asset.id === 'as-meter-main') pf = 0.81 + noise(0.015);   // seeded warning
        return clamp(pf, 0.5, 1);
      }
      if (/\.voltage$/.test(pid))   return 400 + noise(2);
    }
    if (asset.type === 'sensor-occ') {
      if (/\.presence$/.test(pid))  return occupied && Math.random() > 0.1 ? 1 : 0;
      if (/\.count$/.test(pid))     return occupied ? Math.max(0, Math.floor(3 + Math.random() * 12)) : 0;
    }
    if (asset.type === 'sensor-co2') {
      if (/\.co2$/.test(pid)) {
        var co = 500 + (occupied ? 350 : 50) + dayFactor * 100 + noise(40);
        if (asset.id === 'as-co2-l2-board') co += 200;   // seeded urgent
        return co;
      }
    }
    return prev != null ? prev : 0;
  }

  function checkThreshold(p, value) {
    if (p.hi_alarm != null && value > p.hi_alarm) {
      var howFar = value - p.hi_alarm;
      if (howFar > (p.hi_alarm * 0.05)) return 'urgent';
      return 'warning';
    }
    if (p.lo_alarm != null && value < p.lo_alarm) {
      return 'warning';
    }
    return null;
  }
  function alarmTitle(p, asset, value, sev) {
    var unit = p.unit || '';
    var v = Number(value).toFixed(1);
    var aName = asset ? asset.name : '?';
    return aName + ' · ' + p.name + ' ' + (sev === 'critical' ? 'critical' : sev) + ' (' + v + (unit ? ' ' + unit : '') + ')';
  }

  window.WatadSim = Sim;
})();
