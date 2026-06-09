/* fleet-sim.js - Marsad real-time vehicle simulator.
 *
 * Ticks every 4 seconds. Each on-route vehicle inches along a synthesised
 * heading + speed toward its next drop-off (the oldest open order for its
 * driver, if any), with small jitter. When a vehicle gets within ~120m of
 * its drop-off, it "delivers" - order flips to delivered, vehicle is sent
 * back toward the hub, then to its next assignment.
 *
 * Exposed as window.MarsadSim with the same subscriber pattern as WatadSim
 * - any page (console, driver, admin dashboard) can subscribe() and get
 * push notifications for 'tick' / 'delivered' / 'failed' / 'sla-warn'. */
(function () {
  'use strict';
  if (!window.MARSAD_DATA) { console.error('fleet-sim: MARSAD_DATA not loaded'); return; }

  var D = window.MARSAD_DATA;
  var TICK_MS = 4000;

  var Sim = {
    vehicles: {},          // id -> { lat, lng, heading, speed, target_order_id }
    orders: {},            // id -> { ...order } (mutable)
    subscribers: [],
    started: false,
    tickCount: 0,

    start: function () {
      if (this.started) return;
      this.started = true;
      this._initState();
      this._tick();
      this._interval = setInterval(this._tick.bind(this), TICK_MS);
    },
    stop: function () { if (this._interval) clearInterval(this._interval); this.started = false; },
    reset: function () { this.stop(); this.vehicles = {}; this.orders = {}; this.tickCount = 0; this.start(); },

    subscribe: function (cb) { this.subscribers.push(cb); return function () { Sim.subscribers = Sim.subscribers.filter(function (x) { return x !== cb; }); }; },
    publish: function (ev) { this.subscribers.forEach(function (cb) { try { cb(ev); } catch (e) { console.error(e); } }); },

    getVehicle: function (id) { return this.vehicles[id] || null; },
    getOrder:   function (id) { return this.orders[id] || null; },

    // ============ Internal ============
    _initState: function () {
      var self = this;
      D.VEHICLES.forEach(function (v) {
        self.vehicles[v.id] = {
          id: v.id,
          reg: v.reg,
          type: v.type,
          driver_id: v.driver_id,
          lat: v.lat,
          lng: v.lng,
          heading: v.heading,
          speed_kmh: v.speed_kmh,
          fuel_pct: v.fuel_pct,
          last_ping: new Date().toISOString(),
          target_order_id: null
        };
      });
      D.ORDERS.forEach(function (o) { self.orders[o.id] = Object.assign({}, o); });
      // Assign each on-route vehicle a target - the oldest still-open order for that driver.
      Object.values(this.vehicles).forEach(function (veh) {
        var open = Object.values(self.orders).filter(function (o) {
          return o.driver_id === veh.driver_id && (o.status === 'assigned' || o.status === 'picked_up' || o.status === 'in_transit');
        }).sort(function (a, b) { return new Date(a.placed_at) - new Date(b.placed_at); });
        veh.target_order_id = open[0] ? open[0].id : null;
      });
    },

    _tick: function () {
      this.tickCount++;
      var self = this;
      var newDelivered = [];
      var newWarnings = [];

      Object.values(this.vehicles).forEach(function (veh) {
        var driver = D.DRIVERS.find(function (d) { return d.id === veh.driver_id; });
        if (!driver || driver.status !== 'on_route') { veh.speed_kmh = 0; return; }
        var target = veh.target_order_id ? self.orders[veh.target_order_id] : null;
        if (!target) {
          // Idle near current position - small drift toward hub.
          driftToward(veh, D.HUB.lat, D.HUB.lng, 0.0001 + Math.random() * 0.0002);
          veh.speed_kmh = Math.floor(15 + Math.random() * 10);
        } else {
          var distM = haversineMeters(veh.lat, veh.lng, target.dropoff_lat, target.dropoff_lng);
          if (distM < 120) {
            // Delivered!
            target.status = 'delivered';
            target.delivered_at = new Date().toISOString();
            newDelivered.push(target);
            veh.target_order_id = null;
            // Pick next target for this driver
            var nextOpen = Object.values(self.orders).filter(function (o) {
              return o.driver_id === veh.driver_id
                && (o.status === 'assigned' || o.status === 'picked_up' || o.status === 'in_transit');
            }).sort(function (a, b) { return new Date(a.placed_at) - new Date(b.placed_at); });
            veh.target_order_id = nextOpen[0] ? nextOpen[0].id : null;
          } else {
            // Move toward target. Step size = ~30m per tick (~27 km/h average).
            var stepDeg = 0.00027;   // ~30m
            var dy = target.dropoff_lat - veh.lat;
            var dx = target.dropoff_lng - veh.lng;
            var mag = Math.sqrt(dy * dy + dx * dx);
            if (mag > 0) {
              veh.lat += (dy / mag) * stepDeg;
              veh.lng += (dx / mag) * stepDeg;
              veh.heading = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
            }
            veh.speed_kmh = Math.floor(20 + Math.random() * 30);
            // If status is still 'assigned' and we've been ticking → promote to 'picked_up' (left the hub) or 'in_transit'.
            if (target.status === 'assigned' && self.tickCount > 2) target.status = 'picked_up';
            if (target.status === 'picked_up' && distM < 2000) target.status = 'in_transit';
          }
        }
        // Fuel drains slightly
        veh.fuel_pct = Math.max(0, veh.fuel_pct - Math.random() * 0.05);
        veh.last_ping = new Date().toISOString();

        // SLA warning: 10 minutes before deadline
        if (target && !target.sla_breached) {
          var minsLeft = (new Date(target.sla_deadline) - new Date()) / 60000;
          if (minsLeft < 10 && minsLeft > -1) {
            target.sla_warn = true;
          }
          if (minsLeft <= 0) {
            target.sla_breached = true;
            newWarnings.push(target);
          }
        }
      });

      self.publish({ type: 'tick', tickCount: self.tickCount, delivered: newDelivered, slaBreached: newWarnings });
      newDelivered.forEach(function (o) { self.publish({ type: 'delivered', order: o }); });
      newWarnings.forEach(function (o) { self.publish({ type: 'sla-warn', order: o }); });
    }
  };

  function haversineMeters(lat1, lng1, lat2, lng2) {
    var R = 6371000;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLng = (lng2 - lng1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  function driftToward(veh, lat, lng, step) {
    var dy = lat - veh.lat, dx = lng - veh.lng, m = Math.sqrt(dy * dy + dx * dx);
    if (m > 0.00001) {
      veh.lat += (dy / m) * step;
      veh.lng += (dx / m) * step;
      veh.heading = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
    }
  }

  window.MarsadSim = Sim;
})();
