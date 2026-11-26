// NumKit — tiny DOM helpers and shared widgets (no framework).

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
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k === 'html') el.innerHTML = v;
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

export const clear = (el) => { while (el.firstChild) el.firstChild.remove(); return el; };

// ---- persistence -------------------------------------------------------------

export function persisted(ns, key, defaults, onChange) {
  const storageKey = `${ns}:${key}`;
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch { saved = {}; }
  const st = {
    v: { ...defaults, ...saved },
    set(k, val, silent) {
      st.v[k] = val;
      st.save();
      if (!silent && onChange) onChange(k, val);
    },
    save() { try { localStorage.setItem(storageKey, JSON.stringify(st.v)); } catch { /* private mode etc. */ } },
    reset() { st.v = { ...defaults }; st.save(); onChange && onChange(); },
  };
  return st;
}

// ---- copy-to-clipboard -------------------------------------------------------

let toastEl = null, toastTimer = 0;
export function toast(msg) {
  if (!toastEl) {
    toastEl = h('div', { class: 'nk-toast' });
    document.body.append(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.classList.add('nk-show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('nk-show'), 1100);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = h('textarea', { style: { position: 'fixed', opacity: '0' } });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    try { document.execCommand('copy'); } catch { /* ignore */ }
    ta.remove();
  }
  toast(`Copied ${text.length > 40 ? text.slice(0, 40) + '…' : text}`);
}

/** A value that copies itself (or `raw`) on click. */
export function cp(display, raw, cls) {
  const text = raw ?? (typeof display === 'string' ? display : display.textContent);
  return h('span', { class: ['nk-copy', cls], title: 'Click to copy', onclick: () => copyText(text) }, display);
}

// ---- layout widgets ------------------------------------------------------------

export function pod(title, body, opts = {}) {
  return h('section', { class: ['nk-pod', opts.class] },
    h('header', { class: 'nk-pod-h' }, h('span', { class: 'nk-pod-t' }, title), opts.badge ? h('span', { class: 'nk-badge' }, opts.badge) : null,
      opts.actions ? h('span', { class: 'nk-pod-a' }, opts.actions) : null),
    h('div', { class: 'nk-pod-b' }, body));
}

/** Key/value table. rows: [label, value(node|string), note?] */
export function kv(rows, cls) {
  return h('table', { class: ['nk-kv', cls] },
    h('tbody', null, rows.filter(Boolean).map(([k, v, note]) =>
      h('tr', null, h('th', null, k), h('td', null, typeof v === 'string' ? cp(v) : v, note ? h('span', { class: 'nk-note' }, ' ', note) : null)))));
}

export function table(headers, rows, cls) {
  return h('table', { class: ['nk-tbl', cls] },
    h('thead', null, h('tr', null, headers.map((x) => h('th', null, x)))),
    h('tbody', null, rows.map((r) => (r instanceof Node ? r : h('tr', null, r.map((c) => h('td', null, c)))))));
}

// ---- settings controls -----------------------------------------------------------

export function ctlSelect(st, key, label, options, hint) {
  const sel = h('select', {
    onchange: () => st.set(key, options[sel.selectedIndex][0]),
  }, options.map(([val, lab]) => h('option', { selected: st.v[key] === val }, lab)));
  return h('label', { class: 'nk-ctl', title: hint }, h('span', null, label), sel);
}

export function ctlNum(st, key, label, { min, max, step = 1 } = {}, hint) {
  const inp = h('input', {
    type: 'number', min, max, step, value: st.v[key],
    oninput: () => {
      let x = Number(inp.value);
      if (!Number.isFinite(x) || inp.value === '') return;
      if (min !== undefined) x = Math.max(min, x);
      if (max !== undefined) x = Math.min(max, x);
      st.set(key, x);
    },
  });
  return h('label', { class: 'nk-ctl', title: hint }, h('span', null, label), inp);
}

export function ctlCheck(st, key, label, hint) {
  const inp = h('input', { type: 'checkbox', checked: !!st.v[key], onchange: () => st.set(key, inp.checked) });
  return h('label', { class: 'nk-ctl nk-ctl-check', title: hint }, inp, h('span', null, label));
}

export function ctlText(st, key, label, hint, attrs = {}) {
  const inp = h('input', { type: 'text', value: st.v[key], oninput: () => st.set(key, inp.value), spellcheck: 'false', ...attrs });
  return h('label', { class: 'nk-ctl', title: hint }, h('span', null, label), inp);
}

export function segmented(options, value, onPick) {
  return h('span', { class: 'nk-seg' }, options.map(([val, lab]) =>
    h('button', { type: 'button', class: val === value ? 'nk-on' : '', onclick: () => onPick(val) }, lab)));
}

// ---- bit grid -------------------------------------------------------------------

/**
 * Visual bit grid, MSB on the left.
 * opts: prev (BigInt, highlight changed bits), region(i) -> class suffix, onToggle(i),
 *       rowBits (default 32), hex (show hex digit per nibble, default true), labels (default true)
 */
export function bitGrid(value, width, opts = {}) {
  const rowBits = opts.rowBits || 32;
  const showHex = opts.hex !== false;
  const root = h('div', { class: ['nk-bits', opts.onToggle && 'nk-bits-edit', opts.compact && 'nk-bits-compact'] });
  const rows = Math.ceil(width / rowBits);
  for (let r = rows - 1; r >= 0; r--) {
    const hi = Math.min(width, (r + 1) * rowBits) - 1, lo = r * rowBits;
    const row = h('div', { class: 'nk-brow' });
    // first group may be partial (e.g. width 5)
    let i = hi;
    while (i >= lo) {
      const groupLo = Math.max(lo, i - (i % 4));
      const nib = h('div', { class: ['nk-nib', (groupLo % 8 === 0) && 'nk-byte-end'] });
      const cells = h('div', { class: 'nk-nib-cells' });
      const idx = h('div', { class: 'nk-nib-idx' });
      let nibVal = 0;
      for (let b = i; b >= groupLo; b--) {
        const bit = Number((value >> BigInt(b)) & 1n);
        nibVal = (nibVal << 1) | bit;
        const changed = opts.prev !== undefined && opts.prev !== null && Number((opts.prev >> BigInt(b)) & 1n) !== bit;
        const reg = opts.region ? opts.region(b) : null;
        cells.append(h('span', {
          class: ['nk-bit', bit ? 'nk-1' : 'nk-0', changed && 'nk-chg', reg && `nk-r-${reg}`],
          title: `bit ${b}${reg ? ` (${{ s: 'sign', e: 'exponent', m: 'mantissa' }[reg] || reg})` : ''}${opts.onToggle ? ' — click to flip' : ''}`,
          onclick: opts.onToggle ? () => opts.onToggle(b) : null,
        }, String(bit)));
        idx.append(h('span', null, opts.labels === false ? '' : (b % 4 === 0 || b === width - 1) ? String(b) : ''));
      }
      nib.append(idx, cells);
      if (showHex) nib.append(h('div', { class: 'nk-nib-hex' }, nibVal.toString(16).toUpperCase()));
      row.append(nib);
      i = groupLo - 1;
    }
    root.append(row);
  }
  return root;
}

/** Row of byte boxes with offsets. */
export function byteRow(bytes, opts = {}) {
  return h('div', { class: 'nk-bytes' }, bytes.map((b, i) =>
    h('div', { class: 'nk-byte' }, h('span', { class: 'nk-byte-off' }, `+${i}`), h('span', { class: 'nk-byte-v' }, b.toString(16).toUpperCase().padStart(2, '0')),
      opts.chars ? h('span', { class: 'nk-byte-c' }, b >= 32 && b < 127 ? String.fromCharCode(b) : '·') : null)));
}

export function download(name, text, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function debounce(fn, ms) {
  let t = 0;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export const sup = (n) => String(n).replace(/[0-9-]/g, (c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'['0123456789'.indexOf(c)] ?? '⁻');
