// TimeKit — tiny DOM helpers, persisted settings and controls (no framework).

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = Array.isArray(v) ? v.filter(Boolean).join(' ') : v;
      else if (k === 'style' && typeof v === 'object') {
        for (const [sk, sv] of Object.entries(v)) {
          if (sk.startsWith('--')) el.style.setProperty(sk, sv);
          else el.style[sk] = sv;
        }
      }
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k in el && typeof v !== 'string') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, kids);
  return el;
}

function append(el, kids) {
  for (const k of kids) {
    if (k === null || k === undefined || k === false) continue;
    if (Array.isArray(k)) append(el, k);
    else el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

// Epoch milliseconds with sub-millisecond resolution (smooth, and safe to persist).
export const now = () => performance.timeOrigin + performance.now();

export function persisted(ns, key, defaults) {
  const storageKey = `${ns}:${key}`;
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch { saved = {}; }
  const st = {
    v: { ...defaults, ...saved },
    set(k, val) { st.v[k] = val; st.save(); },
    save() { try { localStorage.setItem(storageKey, JSON.stringify(st.v)); } catch { /* private mode etc. */ } },
  };
  return st;
}

// ---- icons ---------------------------------------------------------------------

const ICONS = {
  play: '<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/>',
  pause: '<rect x="6.5" y="5" width="3.8" height="14" rx="1.2"/><rect x="13.7" y="5" width="3.8" height="14" rx="1.2"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2.5"/>',
  flag: '<path d="M6 21V4"/><path d="M6 4h10.5l-2 4 2 4H6"/>',
  settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  focus: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M9 4v16"/><path d="M14 10l2 2-2 2"/>',
  unfocus: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M9 4v16"/><path d="M16 10l-2 2 2 2"/>',
  fullscreen: '<path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4"/>',
  unfullscreen: '<path d="M9 4v4a1 1 0 0 1-1 1H4M15 4v4a1 1 0 0 0 1 1h4M9 20v-4a1 1 0 0 0-1-1H4M15 20v-4a1 1 0 0 1 1-1h4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M7 7l10 10M17 7L7 17"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
};
const FILLED = new Set(['play', 'pause', 'stop']);

export function icon(name) {
  const s = document.createElement('span');
  s.className = FILLED.has(name) ? 'tk-ic tk-ic--fill' : 'tk-ic';
  s.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
  return s;
}

export function setIcon(holder, name) {
  holder.replaceChild(icon(name), holder.querySelector('.tk-ic'));
}

// ---- controls --------------------------------------------------------------------

export function toggle(label, value, onChange) {
  const input = h('input', { type: 'checkbox', checked: !!value });
  input.addEventListener('change', () => onChange(input.checked));
  const el = h('label', { class: 'tk-switch' },
    input,
    h('span', { class: 'tk-switch-track', 'aria-hidden': 'true' }, h('span', { class: 'tk-switch-knob' })),
    label ? h('span', { class: 'tk-switch-l' }, label) : null);
  el.input = input;
  return el;
}

export function seg(options, value, onChange) {
  const wrap = h('div', { class: 'tk-seg', role: 'group' });
  const btns = options.map(([v, l]) => {
    const b = h('button', { type: 'button', class: 'tk-seg-b' }, l);
    b.addEventListener('click', () => { set(v); onChange(v); });
    b._v = v;
    return b;
  });
  const set = (v) => btns.forEach((b) => b.classList.toggle('tk-on', b._v === v));
  set(value);
  wrap.append(...btns);
  wrap.set = set;
  return wrap;
}

export function select(options, value, onChange, cls) {
  const s = h('select', { class: 'tk-select' }, options.map(([v, l]) => h('option', { value: v }, l)));
  s.value = value;
  s.addEventListener('change', () => onChange(s.value));
  const w = h('span', { class: ['tk-sel', cls] }, s);
  w.select = s;
  return w;
}

export const isTyping = (t) => !!(t && t.closest && t.closest('input, textarea, select, button, [contenteditable="true"], [contenteditable=""]'));
