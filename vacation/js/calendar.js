/* calendar.js — Hand-rolled date-range picker + availability display.
   Modes:
     - 'picker'  : interactive — click check-in, click check-out, hover preview
     - 'display' : read-only, shows blocked/booked/available states
*/
(function () {
  'use strict';

  var DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  function ymd(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function parse(s) { return s ? new Date(s + 'T00:00:00') : null; }
  function isPast(d) { var t = new Date(); t.setHours(0,0,0,0); return d < t; }
  function sameDay(a, b) { return a && b && ymd(a) === ymd(b); }
  function inRange(d, start, end) { return start && end && d > start && d < end; }
  function addMonths(d, n) { var nd = new Date(d); nd.setMonth(nd.getMonth() + n); nd.setDate(1); return nd; }
  function daysInMonth(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); }
  function startDay(d) { return new Date(d.getFullYear(), d.getMonth(), 1).getDay(); }

  function renderMonth(opts) {
    var first = new Date(opts.year, opts.month, 1);
    var days = daysInMonth(first);
    var lead = startDay(first);
    var monthLabel = first.toLocaleString('en', { month: 'long', year: 'numeric' });
    var html = ''
      + '<div class="v-cal-month">'
      +   '<div class="v-cal-month-head">'
      +     '<button class="v-cal-nav" data-cal-prev' + (opts.showPrev ? '' : ' style="visibility:hidden;"') + '>‹</button>'
      +     '<span>' + monthLabel + '</span>'
      +     '<button class="v-cal-nav" data-cal-next' + (opts.showNext ? '' : ' style="visibility:hidden;"') + '>›</button>'
      +   '</div>'
      +   '<div class="v-cal-grid">'
      +     DOW.map(function (d) { return '<div class="v-cal-dow">' + d + '</div>'; }).join('')
      +     Array.from({ length: lead }, function () { return '<div class="v-cal-day empty"></div>'; }).join('');
    for (var d = 1; d <= days; d++) {
      var date = new Date(opts.year, opts.month, d);
      var dStr = ymd(date);
      var cls = ['v-cal-day'];
      if (isPast(date)) cls.push('past');
      else if (opts.blocked.indexOf(dStr) !== -1) cls.push('blocked');
      else if (opts.booked.indexOf(dStr) !== -1) cls.push('booked');
      else cls.push('available');
      if (sameDay(date, new Date())) cls.push('today');
      if (sameDay(date, opts.checkIn)) cls.push('range-start');
      if (sameDay(date, opts.checkOut)) cls.push('range-end');
      if (inRange(date, opts.checkIn, opts.checkOut)) cls.push('range');
      if (opts.hoverEnd && inRange(date, opts.checkIn, opts.hoverEnd)) cls.push('range');
      html += '<div class="' + cls.join(' ') + '" data-cal-day="' + dStr + '">' + d + '</div>';
    }
    html += '</div></div>';
    return html;
  }

  function mountCalendar(host, opts) {
    opts = opts || {};
    var mode = opts.mode || 'picker';
    var state = {
      cursor: opts.cursor ? new Date(opts.cursor) : new Date(),
      checkIn: opts.checkIn ? new Date(opts.checkIn) : null,
      checkOut: opts.checkOut ? new Date(opts.checkOut) : null,
      hoverEnd: null,
      blocked: opts.blocked || [],
      booked: opts.booked || []
    };
    state.cursor.setDate(1);

    function render() {
      var monthA = { year: state.cursor.getFullYear(), month: state.cursor.getMonth(), showPrev: true, showNext: false, blocked: state.blocked, booked: state.booked, checkIn: state.checkIn, checkOut: state.checkOut, hoverEnd: state.hoverEnd };
      var monthBdate = addMonths(state.cursor, 1);
      var monthB = { year: monthBdate.getFullYear(), month: monthBdate.getMonth(), showPrev: false, showNext: true, blocked: state.blocked, booked: state.booked, checkIn: state.checkIn, checkOut: state.checkOut, hoverEnd: state.hoverEnd };
      host.innerHTML = ''
        + '<div class="v-cal">'
        +   '<div class="v-cal-months">' + renderMonth(monthA) + renderMonth(monthB) + '</div>'
        +   '<div class="v-cal-legend">'
        +     '<span><span class="v-cal-swatch av"></span>Available</span>'
        +     '<span><span class="v-cal-swatch bk"></span>Blocked / booked</span>'
        +     '<span><span class="v-cal-swatch sel"></span>Your selection</span>'
        +   '</div>'
        + '</div>';

      // Wire nav
      var prev = host.querySelector('[data-cal-prev]');
      if (prev) prev.addEventListener('click', function () {
        var t = new Date(); t.setHours(0,0,0,0); t.setDate(1);
        if (state.cursor > t) { state.cursor = addMonths(state.cursor, -1); render(); }
      });
      var next = host.querySelector('[data-cal-next]');
      if (next) next.addEventListener('click', function () { state.cursor = addMonths(state.cursor, 1); render(); });

      // Wire day clicks for picker mode
      if (mode === 'picker') {
        host.querySelectorAll('[data-cal-day]').forEach(function (el) {
          if (el.classList.contains('past') || el.classList.contains('blocked') || el.classList.contains('booked') || el.classList.contains('empty')) return;
          var d = parse(el.getAttribute('data-cal-day'));
          el.addEventListener('click', function () {
            if (!state.checkIn || (state.checkIn && state.checkOut)) {
              state.checkIn = d;
              state.checkOut = null;
            } else if (state.checkIn && !state.checkOut) {
              if (d <= state.checkIn) {
                state.checkIn = d;
                state.checkOut = null;
              } else {
                // Verify no blocked/booked dates between checkIn and d
                var blocks = state.blocked.concat(state.booked);
                var clean = true;
                var probe = new Date(state.checkIn);
                while (probe < d) {
                  if (blocks.indexOf(ymd(probe)) !== -1) { clean = false; break; }
                  probe.setDate(probe.getDate() + 1);
                }
                if (!clean) {
                  state.checkIn = d;
                  state.checkOut = null;
                  if (window.toast) window.toast('Some dates in that range are unavailable — picking new check-in.', 'warn', 2400);
                } else {
                  state.checkOut = d;
                }
              }
            }
            state.hoverEnd = null;
            render();
            if (typeof opts.onChange === 'function') {
              opts.onChange({
                check_in: state.checkIn ? ymd(state.checkIn) : null,
                check_out: state.checkOut ? ymd(state.checkOut) : null
              });
            }
          });
          el.addEventListener('mouseenter', function () {
            if (!(state.checkIn && !state.checkOut && d > state.checkIn)) return;
            if (state.hoverEnd && sameDay(state.hoverEnd, d)) return;
            state.hoverEnd = d;
            render();
          });
        });
      }
    }

    render();

    return {
      getRange: function () {
        return { check_in: state.checkIn ? ymd(state.checkIn) : null, check_out: state.checkOut ? ymd(state.checkOut) : null };
      },
      setRange: function (ci, co) {
        state.checkIn = ci ? parse(ci) : null;
        state.checkOut = co ? parse(co) : null;
        render();
      },
      reset: function () {
        state.checkIn = null; state.checkOut = null; state.hoverEnd = null;
        render();
      }
    };
  }

  window.VacationCalendar = { mount: mountCalendar };
})();
