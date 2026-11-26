// TimeKit — clock and stopwatch for the site.
//
//   <div data-timekit data-apps="clock,stopwatch"></div>
//   <script src="timekit.js"></script>
//
// or programmatically: TimeKit.mount(element, { apps: ['stopwatch'], theme: 'auto', storage: 'timekit' })

import { h, now, icon, setIcon, isTyping } from './dom.js';
import { mountClock } from './clock.js';
import { mountStopwatch } from './stopwatch.js';

const APPS = {
  clock: { title: 'Current time', mount: mountClock },
  stopwatch: { title: 'Stopwatch', mount: mountStopwatch },
};

// ---- focus mode: hides the site's left panel and centres the content -----------------

let focusFromFullscreen = false;
const focusButtons = [];
const fsButtons = [];

function setFocus(on) {
  document.body.classList.toggle('tk-focus', on);
  for (const b of focusButtons) {
    b.classList.toggle('tk-on', on);
    b.setAttribute('aria-pressed', String(on));
    setIcon(b, on ? 'unfocus' : 'focus');
    b.querySelector('.tk-btn-l').textContent = on ? 'Show panel' : 'Focus';
  }
}

function toggleFullscreen() {
  if (document.fullscreenElement) { document.exitFullscreen?.(); return; }
  const req = document.documentElement.requestFullscreen?.();
  if (!req) return;
  req.then(() => {
    if (!document.body.classList.contains('tk-focus')) { focusFromFullscreen = true; setFocus(true); }
  }).catch(() => {});
}

let globalsBound = false;
function bindGlobals() {
  if (globalsBound) return;
  globalsBound = true;
  document.addEventListener('fullscreenchange', () => {
    const fs = !!document.fullscreenElement;
    for (const b of fsButtons) {
      b.classList.toggle('tk-on', fs);
      setIcon(b, fs ? 'unfullscreen' : 'fullscreen');
      b.querySelector('.tk-btn-l').textContent = fs ? 'Exit full screen' : 'Full screen';
    }
    if (!fs && focusFromFullscreen) { focusFromFullscreen = false; setFocus(false); }
  });
  document.addEventListener('keydown', (e) => {
    // In full screen the browser handles Esc itself.
    if (e.key === 'Escape' && !document.fullscreenElement && document.body.classList.contains('tk-focus') && !isTyping(e.target)) setFocus(false);
  });
}

// ---- mount ------------------------------------------------------------------------------

export function mount(el, opts = {}) {
  if (el.__timekit) return el.__timekit;
  const ds = el.dataset || {};
  const apps = (opts.apps || ds.apps || 'clock,stopwatch').toString().split(',').map((s) => s.trim()).filter((s) => APPS[s]);
  const ns = opts.storage || ds.storage || 'timekit';
  const theme = opts.theme || ds.theme || 'auto';
  const showBar = (opts.bar ?? ds.bar ?? 'true').toString() !== 'false';

  const root = h('div', { class: 'tk', 'data-theme': theme });
  el.replaceChildren(root);
  bindGlobals();

  if (showBar) {
    const focusBtn = h('button', { type: 'button', class: 'tk-btn tk-btn--ghost', title: 'Hide the side panel and centre the content (Esc to leave)', 'aria-pressed': 'false' },
      icon('focus'), h('span', { class: 'tk-btn-l' }, 'Focus'));
    focusBtn.addEventListener('click', () => { focusFromFullscreen = false; setFocus(!document.body.classList.contains('tk-focus')); });
    focusButtons.push(focusBtn);
    const bar = h('div', { class: 'tk-bar' }, focusBtn);
    if (document.documentElement.requestFullscreen) {
      const fsBtn = h('button', { type: 'button', class: 'tk-btn tk-btn--ghost', title: 'Full screen' }, icon('fullscreen'), h('span', { class: 'tk-btn-l' }, 'Full screen'));
      fsBtn.addEventListener('click', toggleFullscreen);
      fsButtons.push(fsBtn);
      bar.append(fsBtn);
    }
    root.append(bar);
  }

  const frames = [], ticks = [];
  for (const id of apps) {
    const settings = h('div', { class: 'tk-settings', hidden: true });
    const tools = h('div', { class: 'tk-card-tools' });
    const body = h('div', { class: 'tk-card-b' });
    const card = h('section', { class: ['tk-card', `tk-card--${id}`] },
      h('header', { class: 'tk-card-h' }, h('h2', { class: 'tk-card-t' }, APPS[id].title), tools),
      settings, body);
    root.append(card);

    APPS[id].mount(body, { ns, now, card, tools, settings, onFrame: (f) => frames.push(f), onTick: (f) => ticks.push(f) });

    if (settings.childNodes.length) {
      const gear = h('button', { type: 'button', class: 'tk-icon-btn', title: 'Settings', 'aria-label': 'Settings', 'aria-expanded': 'false' }, icon('settings'));
      gear.addEventListener('click', () => {
        settings.hidden = !settings.hidden;
        gear.classList.toggle('tk-on', !settings.hidden);
        gear.setAttribute('aria-expanded', String(!settings.hidden));
      });
      tools.append(gear);
    }
  }

  // Animation frames drive the display; ticks (event checks) also run on a timer so
  // events still fire while the tab is in the background and frames are paused.
  const loop = () => { for (const f of ticks) f(); for (const f of frames) f(); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  setInterval(() => { if (document.hidden) for (const f of ticks) f(); }, 200);

  el.__timekit = { root };
  return el.__timekit;
}

function autoMount() { document.querySelectorAll('[data-timekit]').forEach((el) => mount(el)); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoMount);
else autoMount();

window.TimeKit = { mount };
