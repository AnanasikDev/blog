// NumKit — embeddable number toolkit.
//
//   <div data-numkit data-apps="calc,data,layout,bits"></div>
//   <script src="numkit.js"></script>
//
// or programmatically: NumKit.mount(element, { apps: ['calc', 'bits'], theme: 'dark', storage: 'numkit' })

import { h, clear, persisted } from './ui.js';
import { mountCalc } from './app-calc.js';
import { mountData } from './app-data.js';
import { mountLayout } from './app-layout.js';
import { mountBits } from './app-bits.js';

const APPS = {
  calc: {
    title: 'Calculator & translator',
    desc: 'Math across bases — ints are exact, floats track float/double. Type a single value to see every interpretation of it.',
    mount: mountCalc,
  },
  data: {
    title: 'Raw data viewer',
    desc: 'Paste or drop data and slice it into units of 1–64 bits.',
    mount: mountData,
  },
  layout: {
    title: 'Layout modeller',
    desc: 'Lay out fields and arrays in bits or bytes, see offsets, padding and a diagram, and generate a C header.',
    mount: mountLayout,
  },
  bits: {
    title: 'Bit playground',
    desc: 'Fixed-width variables and C bit operations, with a bit-by-bit trace of every line.',
    mount: mountBits,
  },
};

export function mount(el, opts = {}) {
  if (el.__numkit) return el.__numkit;
  const ds = el.dataset || {};
  const apps = (opts.apps || ds.apps || 'calc,data,layout,bits').toString().split(',').map((s) => s.trim()).filter((s) => APPS[s]);
  const ns = opts.storage || ds.storage || 'numkit';
  const theme = opts.theme || ds.theme || 'auto';
  const nav = (opts.nav ?? ds.nav ?? (apps.length > 1 ? 'true' : 'false')).toString() !== 'false';
  const ui = persisted(ns, 'frame', { collapsed: {} });

  clear(el);
  const root = h('div', { class: 'nk', 'data-theme': theme });
  el.append(root);
  const instances = {};
  const sections = {};

  if (nav) {
    root.append(h('nav', { class: 'nk-nav' }, apps.map((id) =>
      h('a', { href: `#nk-${id}`, onclick: (e) => { e.preventDefault(); expand(id); sections[id].scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, APPS[id].title))));
  }

  const expand = (id) => {
    sections[id].classList.remove('nk-collapsed');
    ui.v.collapsed[id] = false;
    ui.save();
  };

  for (const id of apps) {
    const def = APPS[id];
    const settings = h('div', { class: 'nk-settings', hidden: true });
    const bodyEl = h('div', { class: 'nk-app-b' });
    const gear = h('button', { type: 'button', class: 'nk-btn nk-gear', title: 'Settings', 'aria-expanded': 'false' }, '⚙ Settings');
    gear.addEventListener('click', () => {
      settings.hidden = !settings.hidden;
      gear.setAttribute('aria-expanded', String(!settings.hidden));
      gear.classList.toggle('nk-on', !settings.hidden);
    });
    const fold = h('button', { type: 'button', class: 'nk-btn nk-fold', title: 'Collapse / expand' }, '▾');
    const sec = h('section', { class: ['nk-app', ui.v.collapsed[id] && 'nk-collapsed'], id: el.id ? `${el.id}-${id}` : `nk-${id}` },
      h('header', { class: 'nk-app-h' },
        h('div', { class: 'nk-app-hl' }, h('h2', { class: 'nk-app-t' }, def.title), h('p', { class: 'nk-app-d' }, def.desc)),
        h('div', { class: 'nk-app-tools' }, gear, fold)),
      settings, bodyEl);
    fold.addEventListener('click', () => {
      sec.classList.toggle('nk-collapsed');
      ui.v.collapsed[id] = sec.classList.contains('nk-collapsed');
      ui.save();
    });
    sections[id] = sec;
    root.append(sec);
    const ctx = {
      ns, settings,
      openInCalc: apps.includes('calc') ? (expr) => {
        expand('calc');
        instances.calc?.setExpr(expr);
        sections.calc.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } : null,
    };
    try {
      instances[id] = def.mount(bodyEl, ctx) || {};
    } catch (err) {
      console.error('[NumKit]', id, err);
      bodyEl.append(h('div', { class: 'nk-err' }, `Failed to start ${def.title}: ${err.message}`));
    }
  }
  el.__numkit = { root, instances };
  return el.__numkit;
}

function autoMount() {
  document.querySelectorAll('[data-numkit]').forEach((el) => mount(el));
}

const api = { mount, autoMount, apps: Object.keys(APPS) };
if (typeof window !== 'undefined') {
  window.NumKit = api;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoMount);
  else autoMount();
}
export default api;
