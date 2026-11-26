// TimeKit — current time.

import { h, persisted, toggle, seg } from './dom.js';

const p2 = (n) => String(n).padStart(2, '0');

export function mountClock(body, ctx) {
  const st = persisted(ctx.ns, 'clock', { date: true, seconds: true, ms: false, h12: false });

  const msToggle = toggle('Milliseconds', st.v.ms, (v) => st.set('ms', v));
  const syncMs = () => msToggle.classList.toggle('tk-dis', !st.v.seconds);
  ctx.settings.append(
    toggle('Date', st.v.date, (v) => st.set('date', v)),
    toggle('Seconds', st.v.seconds, (v) => { st.set('seconds', v); syncMs(); }),
    msToggle,
    h('span', { class: 'tk-set-group' }, h('span', { class: 'tk-set-l' }, 'Format'),
      seg([[false, '24 h'], [true, '12 h']], st.v.h12, (v) => st.set('h12', v))),
  );
  syncMs();

  const main = h('span', { class: 'tk-d-main' });
  const frac = h('span', { class: 'tk-d-frac' });
  const ap = h('span', { class: 'tk-d-ap' });
  const digits = h('div', { class: 'tk-digits tk-digits--clock' }, main, frac, ap);
  const date = h('div', { class: 'tk-clock-date' });
  body.append(h('div', { class: 'tk-clock' }, digits, date));

  let last = {};
  const put = (key, val, fn) => { if (last[key] !== val) { last[key] = val; fn(val); } };

  ctx.onFrame(() => {
    const d = new Date(), v = st.v;
    let hr = d.getHours(), apText = '';
    if (v.h12) { apText = hr < 12 ? 'AM' : 'PM'; hr = hr % 12 || 12; }
    const parts = [v.h12 ? String(hr) : p2(hr), p2(d.getMinutes())];
    if (v.seconds) parts.push(p2(d.getSeconds()));

    put('main', parts.join('<i class="tk-colon">:</i>'), (x) => { main.innerHTML = x; });
    put('frac', v.seconds && v.ms ? '.' + String(d.getMilliseconds()).padStart(3, '0') : '', (x) => { frac.textContent = x; });
    put('ap', apText, (x) => { ap.textContent = x; ap.hidden = !x; });
    // Without seconds, the colons breathe once a second.
    put('blink', !v.seconds && d.getMilliseconds() >= 500, (x) => digits.classList.toggle('tk-blink', x));
    put('date', v.date ? d.toDateString() : '', (x) => {
      date.hidden = !x;
      date.textContent = x ? d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '';
    });
  });
}
