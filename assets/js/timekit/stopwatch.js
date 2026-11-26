// TimeKit — stopwatch with editable time, arbitrary speed (negative = counts down) and timed events.

import { h, persisted, icon, setIcon, toggle, seg, select, isTyping } from './dom.js';
import { parseDuration, fmt, fmtShort, human } from './time.js';
import { play, unlock, SOUND_OPTIONS } from './sound.js';

const VISUAL_OPTIONS = [['flash', 'Flash'], ['pulse', 'Pulse'], ['shake', 'Shake'], ['none', 'No visual']];
const ACTION_OPTIONS = [['none', 'Keep going'], ['pause', 'Then pause'], ['stop', 'Then stop']];
const MODE_OPTIONS = [['at', 'At'], ['every', 'Every']];
const PALETTE = ['#ff7a90', '#ffa96b', '#ffd36b', '#6fd6a8', '#6fb6ff', '#a98bff', '#ff8fd8'];
const SPEED_CHIPS = [-1, 0.5, 1, 2, 5, 10];
const SLIDER_MAX = 5;
const HINT = 'Click the time to type one: 5:00 · 1h 30m · 90s · -10s';

const newId = () => Math.random().toString(36).slice(2, 10);
const speedLabel = (x) => (x === 0.5 ? '½×' : x < 0 ? `−${-x}×` : `${x}×`);
const round = (x, d = 4) => Math.round(x * 10 ** d) / 10 ** d;
let spaceTaken = false;

export function mountStopwatch(body, ctx) {
  const { now, card } = ctx;
  const st = persisted(ctx.ns, 'stopwatch', { base: 0, start: 0, speed: 1, since: null, prec: 2, hours: false, volume: 0.7 });
  const evs = persisted(ctx.ns, 'events', {
    list: [
      { id: newId(), on: false, mode: 'at', t: 0, label: 'Time is up', sound: 'alarm', visual: 'flash', action: 'pause', color: '#ff7a90' },
      { id: newId(), on: false, mode: 'every', t: 60000, label: 'Another minute', sound: 'soft', visual: 'pulse', action: 'none', color: '#6fb6ff' },
    ],
  });
  if (!Array.isArray(evs.v.list)) evs.v.list = [];
  for (const k of ['base', 'start', 'speed']) if (!Number.isFinite(st.v[k])) st.v[k] = k === 'speed' ? 1 : 0;
  const saveEvs = () => evs.save();

  // ---- state ---------------------------------------------------------------------
  // value = base + (now − since) × speed while running; changing speed re-bases.

  const running = () => st.v.since != null;
  const value = () => (running() ? st.v.base + (now() - st.v.since) * st.v.speed : st.v.base);
  let prev = value();

  function start() {
    unlock();
    if (!running()) { st.v.since = now(); prev = st.v.base; st.save(); }
    sync();
  }
  function pause() {
    if (running()) { st.v.base = value(); st.v.since = null; st.save(); }
    sync();
  }
  function stop() {
    // First press: back to the start time. Pressing again there: back to zero.
    if (!running() && st.v.base === st.v.start) st.v.start = 0;
    st.v.since = null;
    st.v.base = st.v.start;
    prev = st.v.base;
    st.save();
    sync();
  }
  function setTime(v) {
    st.v.base = v;
    st.v.start = v;
    if (running()) st.v.since = now();
    prev = v;
    st.save();
    sync();
  }
  function setSpeed(x, from) {
    if (!Number.isFinite(x)) return;
    if (running()) { st.v.base = value(); st.v.since = now(); }
    st.v.speed = x;
    st.save();
    syncSpeed(from);
  }

  // ---- header status ---------------------------------------------------------------

  const statusText = h('span', { class: 'tk-status-t' });
  const speedBadge = h('span', { class: 'tk-status-speed' });
  ctx.tools.append(h('span', { class: 'tk-status' }, h('i', { class: 'tk-status-dot' }), statusText, speedBadge));

  // ---- display + inline editing --------------------------------------------------------

  const dSign = h('span', { class: 'tk-d-sign' });
  const dMain = h('span', { class: 'tk-d-main' });
  const dFrac = h('span', { class: 'tk-d-frac' });
  const display = h('button', { type: 'button', class: 'tk-digits tk-digits--sw', title: 'Click to type a time' }, dSign, dMain, dFrac);
  const edit = h('input', { type: 'text', class: 'tk-edit', hidden: true, spellcheck: false, autocomplete: 'off', 'aria-label': 'Set the stopwatch time' });
  const hint = h('p', { class: 'tk-hint' }, HINT);
  let editing = false;

  function openEdit() {
    editing = true;
    edit.value = fmtShort(value());
    edit.classList.remove('tk-bad');
    display.hidden = true;
    edit.hidden = false;
    hint.textContent = 'Enter to set · Esc to cancel';
    edit.focus();
    edit.select();
  }
  function closeEdit(commit) {
    if (!editing) return;
    editing = false;
    if (commit) {
      const v = parseDuration(edit.value);
      if (Number.isFinite(v)) setTime(v);
    }
    edit.hidden = true;
    display.hidden = false;
    hint.textContent = HINT;
  }
  display.addEventListener('click', openEdit);
  edit.addEventListener('input', () => edit.classList.toggle('tk-bad', !Number.isFinite(parseDuration(edit.value))));
  edit.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); closeEdit(true); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeEdit(false); }
  });
  edit.addEventListener('blur', () => closeEdit(true));

  // ---- transport -------------------------------------------------------------------------

  const stopBtn = h('button', { type: 'button', class: 'tk-round', title: 'Stop: back to the start time (again: back to 0)', 'aria-label': 'Stop' }, icon('stop'));
  const playBtn = h('button', { type: 'button', class: 'tk-round tk-round--main', title: 'Start (Space)', 'aria-label': 'Start' }, icon('play'));
  const markBtn = h('button', { type: 'button', class: 'tk-round', title: 'Add an event at the current time', 'aria-label': 'Add an event here' }, icon('flag'));
  stopBtn.addEventListener('click', stop);
  playBtn.addEventListener('click', () => (running() ? pause() : start()));
  markBtn.addEventListener('click', () => {
    unlock();
    addEvent(Math.round(value() / 10 ** (3 - st.v.prec)) * 10 ** (3 - st.v.prec));
  });

  // ---- speed ------------------------------------------------------------------------------

  const slider = h('input', { type: 'range', class: 'tk-range', min: String(-SLIDER_MAX), max: String(SLIDER_MAX), step: '0.05', 'aria-label': 'Speed' });
  const speedNum = h('input', { type: 'text', inputmode: 'decimal', class: 'tk-in tk-speed-n', 'aria-label': 'Speed, any value' });
  const chips = SPEED_CHIPS.map((x) => {
    const b = h('button', { type: 'button', class: 'tk-chip' }, speedLabel(x));
    b.addEventListener('click', () => setSpeed(x));
    b._v = x;
    return b;
  });
  slider.addEventListener('input', () => {
    let x = Number(slider.value);
    for (const snap of [-1, 0, 1]) if (Math.abs(x - snap) < 0.12) x = snap;
    setSpeed(x, 'slider');
  });
  speedNum.addEventListener('input', () => {
    const x = Number(speedNum.value.replace(',', '.').replace(/[−–]/g, '-').replace(/[x×]$/i, ''));
    const ok = speedNum.value.trim() !== '' && Number.isFinite(x);
    speedNum.classList.toggle('tk-bad', !ok);
    if (ok) setSpeed(x, 'num');
  });
  speedNum.addEventListener('blur', () => syncSpeed());

  function syncSpeed(from) {
    const x = st.v.speed;
    const clamped = Math.max(-SLIDER_MAX, Math.min(SLIDER_MAX, x));
    if (from !== 'slider') slider.value = String(clamped);
    if (from !== 'num') { speedNum.value = String(round(x)); speedNum.classList.remove('tk-bad'); }
    // fill the track from 0 to the current value
    const pos = ((clamped + SLIDER_MAX) / (2 * SLIDER_MAX)) * 100;
    slider.style.setProperty('--a', `${Math.min(50, pos)}%`);
    slider.style.setProperty('--b', `${Math.max(50, pos)}%`);
    chips.forEach((c) => c.classList.toggle('tk-on', c._v === x));
    speedBadge.textContent = x === 1 ? '' : x < 0 ? `${speedLabel(round(x, 2))} ↓` : speedLabel(round(x, 2));
    card.classList.toggle('tk-reverse', x < 0);
  }

  // ---- next event ---------------------------------------------------------------------------

  const nextFill = h('span', { class: 'tk-next-fill' });
  const nextText = h('span', { class: 'tk-next-t' });
  const nextEl = h('div', { class: 'tk-next' }, h('span', { class: 'tk-next-track' }, nextFill), nextText);

  // ---- events list --------------------------------------------------------------------------

  const list = h('div', { class: 'tk-evs' });
  const empty = h('p', { class: 'tk-evs-empty' }, 'No events yet. Add one, or press the flag while the stopwatch runs.');
  const addBtn = h('button', { type: 'button', class: 'tk-btn' }, icon('plus'), 'Add event');
  addBtn.addEventListener('click', () => { unlock(); addEvent(null); });
  const rows = new Map();

  function addEvent(t) {
    const color = PALETTE[evs.v.list.length % PALETTE.length];
    const e = { id: newId(), on: true, mode: 'at', t: t ?? (Math.round(value()) || 60000), label: '', sound: 'chime', visual: 'flash', action: 'none', color };
    evs.v.list.push(e);
    saveEvs();
    renderList();
    rows.get(e)?.querySelector('.tk-ev-label')?.focus();
  }

  function renderList() {
    rows.clear();
    list.replaceChildren(...evs.v.list.map(evRow));
    empty.hidden = evs.v.list.length > 0;
  }

  function evRow(e) {
    const row = h('div', { class: ['tk-ev', !e.on && 'tk-off'], style: { '--tk-ev': e.color } });

    const on = toggle('', e.on, (v) => { e.on = v; row.classList.toggle('tk-off', !v); saveEvs(); });
    on.classList.add('tk-ev-on');
    on.title = 'On / off';

    const time = h('input', { type: 'text', class: 'tk-in tk-ev-time', value: fmtShort(e.t), spellcheck: false, autocomplete: 'off', 'aria-label': 'Time' });
    const validate = () => {
      const v = parseDuration(time.value);
      const ok = Number.isFinite(v) && (e.mode !== 'every' || v > 0);
      time.classList.toggle('tk-bad', !ok);
      return ok ? v : null;
    };
    time.addEventListener('input', () => { const v = validate(); if (v !== null) { e.t = v; saveEvs(); } });
    time.addEventListener('blur', () => { time.value = fmtShort(e.t); time.classList.remove('tk-bad'); });

    const mode = select(MODE_OPTIONS, e.mode, (v) => {
      e.mode = v;
      if (v === 'every' && !(e.t > 0)) { e.t = 60000; time.value = fmtShort(e.t); }
      validate();
      saveEvs();
    }, 'tk-ev-mode');

    const label = h('input', { type: 'text', class: 'tk-in tk-ev-label', value: e.label || '', placeholder: 'Label', 'aria-label': 'Label' });
    label.addEventListener('input', () => { e.label = label.value; saveEvs(); });

    const sound = select(SOUND_OPTIONS, e.sound, (v) => { e.sound = v; saveEvs(); play(v, st.v.volume); }, 'tk-ev-sound');
    const visual = select(VISUAL_OPTIONS, e.visual, (v) => { e.visual = v; saveEvs(); effects(e, null, true); }, 'tk-ev-visual');
    const action = select(ACTION_OPTIONS, e.action, (v) => { e.action = v; saveEvs(); }, 'tk-ev-action');

    const color = h('input', { type: 'color', class: 'tk-ev-color', value: e.color, title: 'Colour', 'aria-label': 'Colour' });
    color.addEventListener('input', () => { e.color = color.value; row.style.setProperty('--tk-ev', e.color); saveEvs(); });

    const test = h('button', { type: 'button', class: 'tk-icon-btn tk-ev-test', title: 'Preview', 'aria-label': 'Preview' }, icon('bell'));
    test.addEventListener('click', () => { unlock(); effects(e, null); });
    const del = h('button', { type: 'button', class: 'tk-icon-btn tk-ev-del', title: 'Delete', 'aria-label': 'Delete' }, icon('x'));
    del.addEventListener('click', () => { evs.v.list = evs.v.list.filter((x) => x !== e); saveEvs(); renderList(); });

    row.append(on, mode, time, label, sound, visual, action, color, test, del);
    rows.set(e, row);
    return row;
  }

  // ---- firing --------------------------------------------------------------------------------

  const banner = h('div', { class: 'tk-banner', role: 'status', 'aria-live': 'polite' });
  card.append(banner);
  let bannerTimer = 0;

  function restart(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

  function effects(e, at, silent) {
    if (!silent) play(e.sound, st.v.volume);
    card.style.setProperty('--tk-ev', e.color);
    if (e.visual !== 'none') {
      card.classList.remove('tk-fx-flash', 'tk-fx-pulse', 'tk-fx-shake');
      restart(card, `tk-fx-${e.visual}`);
    }
    banner.textContent = e.label || fmtShort(at ?? e.t);
    restart(banner, 'tk-show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => banner.classList.remove('tk-show'), 2800);
    const row = rows.get(e);
    if (row) restart(row, 'tk-hit');
  }

  // The first boundary passed when moving from a to b (either direction), or null.
  function crossing(e, a, b) {
    if (e.mode === 'every') {
      const iv = e.t;
      if (!(iv > 0)) return null;
      if (b > a) return Math.floor(b / iv) > Math.floor(a / iv) ? (Math.floor(a / iv) + 1) * iv : null;
      return Math.ceil(b / iv) < Math.ceil(a / iv) ? (Math.ceil(a / iv) - 1) * iv : null;
    }
    if (b > a) return a < e.t && e.t <= b ? e.t : null;
    return b <= e.t && e.t < a ? e.t : null;
  }

  function tick() {
    if (!running()) return;
    const cur = value();
    if (cur === prev) return;
    const a = prev;
    prev = cur;
    const hits = [];
    for (const e of evs.v.list) {
      if (!e.on) continue;
      const at = crossing(e, a, cur);
      if (at !== null) hits.push({ d: Math.abs(at - a), e, at });
    }
    if (!hits.length) return;
    hits.sort((x, y) => x.d - y.d);
    let halt = null;
    for (const hit of hits) {
      if (halt && hit.d > halt.d) break; // the stopwatch halted before reaching this one
      effects(hit.e, hit.at);
      if (!halt && hit.e.action !== 'none') halt = hit;
    }
    if (halt?.e.action === 'pause') { st.v.base = halt.at; st.v.since = null; prev = halt.at; st.save(); sync(); }
    else if (halt?.e.action === 'stop') { st.v.since = null; st.v.base = st.v.start; prev = st.v.base; st.save(); sync(); }
  }

  function upcoming(cur) {
    const sp = st.v.speed;
    if (!sp) return null;
    const dir = Math.sign(sp);
    let best = null, bestD = Infinity, anchor = null, anchorD = Infinity;
    for (const e of evs.v.list) {
      if (!e.on) continue;
      let n, p;
      if (e.mode === 'every') {
        const iv = e.t;
        if (!(iv > 0)) continue;
        n = dir > 0 ? (Math.floor(cur / iv) + 1) * iv : (Math.ceil(cur / iv) - 1) * iv;
        p = dir > 0 ? Math.floor(cur / iv) * iv : Math.ceil(cur / iv) * iv;
      } else if ((e.t - cur) * dir > 0) n = e.t;
      else p = e.t;
      if (n !== undefined) { const d = (n - cur) * dir; if (d > 0 && d < bestD) { bestD = d; best = { e, at: n }; } }
      if (p !== undefined) { const d = (cur - p) * dir; if (d >= 0 && d < anchorD) { anchorD = d; anchor = p; } }
    }
    if (!best) return null;
    if (anchor === null && (cur - st.v.start) * dir >= 0) anchor = st.v.start;
    best.progress = anchor === null || best.at === anchor ? 0 : (cur - anchor) / (best.at - anchor);
    best.real = bestD / Math.abs(sp);
    return best;
  }

  // ---- settings ---------------------------------------------------------------------------------

  const vol = h('input', { type: 'range', class: 'tk-range tk-range--vol', min: '0', max: '1', step: '0.05', value: String(st.v.volume), 'aria-label': 'Volume' });
  const syncVol = () => { vol.style.setProperty('--a', '0%'); vol.style.setProperty('--b', `${st.v.volume * 100}%`); };
  vol.addEventListener('input', () => { st.set('volume', Number(vol.value)); syncVol(); });
  vol.addEventListener('change', () => play('chime', st.v.volume));
  syncVol();
  ctx.settings.append(
    h('span', { class: 'tk-set-group' }, h('span', { class: 'tk-set-l' }, 'Precision'),
      seg([[0, '1 s'], [1, '0.1'], [2, '0.01'], [3, '0.001']], st.v.prec, (v) => st.set('prec', v))),
    toggle('Always show hours', st.v.hours, (v) => st.set('hours', v)),
    h('label', { class: 'tk-set-group' }, h('span', { class: 'tk-set-l' }, 'Volume'), vol),
  );

  // ---- assemble ----------------------------------------------------------------------------------

  body.append(
    h('div', { class: 'tk-sw' },
      h('div', { class: 'tk-sw-face' }, display, edit),
      hint,
      h('div', { class: 'tk-controls' }, stopBtn, playBtn, markBtn),
      h('div', { class: 'tk-speed' },
        h('span', { class: 'tk-set-l' }, 'Speed'),
        h('div', { class: 'tk-speed-ctl' }, slider, h('span', { class: 'tk-speed-num' }, speedNum, h('span', { class: 'tk-speed-x' }, '×'))),
        h('div', { class: 'tk-chips' }, chips)),
      nextEl),
    h('div', { class: 'tk-evsec' },
      h('div', { class: 'tk-evsec-h' },
        h('div', null,
          h('h3', { class: 'tk-evsec-t' }, 'Events'),
          h('p', { class: 'tk-evsec-d' }, 'Sound and light cues. They fire whenever the stopwatch passes their time, in either direction.')),
        addBtn),
      list, empty),
  );

  function sync() {
    const run = running();
    setIcon(playBtn, run ? 'pause' : 'play');
    playBtn.title = run ? 'Pause (Space)' : 'Start (Space)';
    playBtn.setAttribute('aria-label', run ? 'Pause' : 'Start');
    card.classList.toggle('tk-running', run);
    statusText.textContent = run ? 'Running' : st.v.base === st.v.start ? 'Ready' : 'Paused';
  }

  if (!spaceTaken) {
    spaceTaken = true;
    document.addEventListener('keydown', (e) => {
      if (e.code !== 'Space' || e.repeat || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      e.preventDefault();
      running() ? pause() : start();
    });
  }

  renderList();
  syncSpeed();
  sync();

  // ---- loop ---------------------------------------------------------------------------------------

  let last = {};
  const put = (key, val, fn) => { if (last[key] !== val) { last[key] = val; fn(val); } };

  ctx.onTick(tick);
  ctx.onFrame(() => {
    const v = value();
    const p = fmt(v, st.v.prec, st.v.hours);
    put('sign', p.sign, (x) => { dSign.textContent = x; });
    put('main', p.main, (x) => { dMain.textContent = x; });
    put('frac', p.frac, (x) => { dFrac.textContent = x; });

    const u = upcoming(v);
    const anyOn = evs.v.list.some((e) => e.on);
    put('nextHidden', !anyOn, (x) => { nextEl.hidden = x; });
    if (!anyOn) return;
    if (!u) {
      put('next', st.v.speed ? 'No more events ahead' : 'Speed is 0: time stands still', (x) => { nextText.textContent = x; });
      put('fill', '0', (x) => { nextFill.style.width = `${x}%`; });
      return;
    }
    const name = u.e.label || (u.e.mode === 'every' ? `Every ${fmtShort(u.e.t)}` : 'Event');
    put('next', `Next: ${name} at ${fmtShort(u.at)} · in ${human(u.real)}`, (x) => { nextText.textContent = x; });
    put('fill', (Math.max(0, Math.min(1, u.progress)) * 100).toFixed(1), (x) => { nextFill.style.width = `${x}%`; });
    put('fillColor', u.e.color, (x) => nextEl.style.setProperty('--tk-ev', x));
  });
}
