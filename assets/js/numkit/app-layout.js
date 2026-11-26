// NumKit — memory / bit layout modeller.

import { h, clear, ctlSelect, ctlNum, ctlCheck, ctlText, persisted, debounce, copyText, download, segmented } from './ui.js';
import * as U from './numutil.js';

let idc = 0;
const uid = () => `i${Date.now().toString(36)}${(idc++).toString(36)}`;
const F = (name, width, extra = {}) => ({ id: uid(), kind: 'field', name, width, offMode: 'auto', off: 0, used: true, ...extra });
const A = (name, count, items, extra = {}) => ({ id: uid(), kind: 'array', name, count, items, offMode: 'auto', off: 0, used: true, ...extra });

const PRESETS = {
  demo: () => ({
    unit: 'bits', rowWidth: 32, prefix: 'PKT', alignTotal: 32,
    items: [F('magic', 16), F('version', 4), F('flags', 4), F('reserved', 8, { used: false }), F('length', 16),
      A('entries', 6, [F('id', 12), F('kind', 4)], { offMode: 'rel', off: 16 }), F('crc', 32)],
  }),
  ipv4: () => ({
    unit: 'bits', rowWidth: 32, prefix: 'IPV4', alignTotal: 0,
    items: [F('version', 4), F('ihl', 4), F('dscp', 6), F('ecn', 2), F('total_length', 16), F('identification', 16), F('flags', 3),
      F('fragment_offset', 13), F('ttl', 8), F('protocol', 8), F('header_checksum', 16), F('src_addr', 32), F('dst_addr', 32)],
  }),
  float32: () => ({ unit: 'bits', rowWidth: 32, prefix: 'F32', alignTotal: 0, items: [F('sign', 1), F('exponent', 8), F('mantissa', 23)] }),
  rgb565: () => ({ unit: 'bits', rowWidth: 16, prefix: 'RGB565', alignTotal: 0, items: [F('r', 5), F('g', 6), F('b', 5)] }),
  cstruct: () => ({
    unit: 'bytes', rowWidth: 8, prefix: 'VTX', alignTotal: 4,
    items: [F('tag', 1), F('x', 4, { offMode: 'abs', off: 4 }), F('y', 4), F('z', 4), F('id', 2)],
  }),
  table: () => ({
    unit: 'bytes', rowWidth: 16, prefix: 'SHEET', alignTotal: 0,
    items: [F('count', 2), F('flags', 2), F('reserved', 4, { used: false }),
      A('frames', 32, [F('x', 2), F('y', 2), F('w', 1), F('h', 1), F('pad', 2, { used: false })]), F('crc', 4)],
  }),
};
const PRESET_NAMES = [['demo', 'Packet (bits, with array)'], ['ipv4', 'IPv4 header'], ['float32', 'IEEE float32'], ['rgb565', 'RGB565 pixel'],
  ['cstruct', 'C struct w/ padding (bytes)'], ['table', 'Sprite table (bytes, array)']];

const macro = (s) => (s || 'UNNAMED').replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase() || 'X';

// ---- layout computation -------------------------------------------------------

function computeLayout(items, issues, path = '') {
  let cursor = 0;
  const placed = [];
  const names = new Set();
  for (const it of items) {
    const label = path + (it.name || '(unnamed)');
    if (names.has(it.name)) issues.push(`Duplicate name '${label}'`);
    names.add(it.name);
    const off = it.offMode === 'abs' ? +it.off || 0 : it.offMode === 'rel' ? cursor + (+it.off || 0) : cursor;
    if (off < cursor) issues.push(`'${label}' at ${off} overlaps the previous item (ends at ${cursor})`);
    let size, elem = null;
    if (it.kind === 'array') {
      elem = computeLayout(it.items || [], issues, `${label}[].`);
      size = Math.max(0, +it.count || 0) * elem.size;
      if (!elem.size) issues.push(`Array '${label}' has zero-size elements`);
    } else {
      size = Math.max(0, +it.width || 0);
      if (!size) issues.push(`'${label}' has zero width`);
    }
    placed.push({ it, off, size, elem });
    cursor = Math.max(cursor, off + size);
  }
  const size = cursor;
  // gaps = uncovered ranges
  const iv = placed.filter((p) => p.size > 0).map((p) => [p.off, p.off + p.size]).sort((a, b) => a[0] - b[0]);
  const gaps = [];
  let c = 0, covered = 0;
  for (const [s, e] of iv) {
    if (s > c) gaps.push({ off: c, len: s - c });
    if (e > c) { covered += e - Math.max(s, c); c = e; }
  }
  let used = 0, unused = 0, padding = gaps.reduce((a, g) => a + g.len, 0);
  for (const p of placed) {
    if (p.it.kind === 'array') {
      const n = Math.max(0, +p.it.count || 0);
      if (p.it.used) { used += n * p.elem.used; unused += n * p.elem.unused; }
      else unused += n * (p.elem.used + p.elem.unused);
      padding += n * p.elem.padding;
    } else if (p.it.used) used += p.size;
    else unused += p.size;
  }
  const overlap = placed.reduce((a, p) => a + p.size, 0) - covered;
  return { placed, size, gaps, used, unused, padding, overlap };
}

function flatten(lay, base, prefix, spans, colorRef, depth = 0) {
  for (const p of lay.placed) {
    const abs = base + p.off;
    const color = depth === 0 ? colorRef.n++ % 10 : colorRef.n++ % 10;
    if (p.it.kind === 'field') {
      if (p.size) spans.push({ start: abs, len: p.size, label: prefix + p.it.name, w: p.size, kind: p.it.used ? 'field' : 'unused', color, id: p.it.id });
    } else {
      const n = Math.max(0, +p.it.count || 0);
      const stride = p.elem.size;
      if (!n || !stride) continue;
      flatten(p.elem, abs, `${prefix}${p.it.name}[0].`, spans, colorRef, depth + 1);
      if (n > 1) spans.push({ start: abs + stride, len: stride * (n - 1), label: `${prefix}${p.it.name}[1…${n - 1}]`, w: stride * (n - 1), kind: 'rest', color, id: p.it.id });
    }
  }
  for (const g of lay.gaps) spans.push({ start: base + g.off, len: g.len, label: 'padding', w: g.len, kind: 'pad' });
}

// ---- C header ---------------------------------------------------------------------

function genHeader(lay, st, tail) {
  const P = macro(st.prefix);
  const unit = st.unit;
  const out = [];
  const defs = [];
  const def = (name, value, comment) => defs.push([name, String(value), comment]);
  const isBits = unit === 'bits';
  const maskLit = (w) => (w <= 32 ? `0x${U.mask(w).toString(16).toUpperCase()}u` : `0x${U.mask(w).toString(16).toUpperCase()}ull`);

  def(`${P}_SIZE`, lay.size, `total size in ${unit}${tail ? ` (incl. ${tail} tail padding)` : ''}`);
  if (isBits) def(`${P}_SIZE_BYTES`, Math.ceil(lay.size / 8), 'rounded up');
  def(`${P}_USED_SIZE`, lay.used, null);

  const walk = (l, path, rel) => {
    for (const p of l.placed) {
      if (!p.it.used && !st.includeUnused) continue;
      const N = `${P}_${path}${macro(p.it.name)}`;
      const note = [!p.it.used && 'unused', rel && 'relative to element'].filter(Boolean).join(', ') || null;
      def(`${N}_OFFSET`, p.off, note);
      if (p.it.kind === 'field') {
        def(`${N}_WIDTH`, p.size, null);
        if (isBits && st.masks && p.size > 0 && p.size <= 64) def(`${N}_MASK`, maskLit(p.size), null);
      } else {
        def(`${N}_COUNT`, Math.max(0, +p.it.count || 0), null);
        def(`${N}_STRIDE`, p.elem.size, 'element size');
        def(`${N}_SIZE`, p.size, null);
        walk(p.elem, `${path}${macro(p.it.name)}_`, true);
      }
    }
  };
  walk(lay, '', false);

  out.push(`/* ${P} layout — generated by NumKit layout modeller`);
  out.push(` * units: ${unit}; used ${lay.used}, unused ${lay.unused}, padding ${lay.padding}${lay.overlap ? `, overlapping ${lay.overlap}` : ''} */`);
  if (st.guard) out.push(`#ifndef ${P}_LAYOUT_H`, `#define ${P}_LAYOUT_H`);
  out.push('');
  const width = Math.max(...defs.map((d) => d[0].length)) + 1;
  const vw = Math.max(...defs.map((d) => d[1].length));
  for (const [n, v, c] of defs) {
    const cm = c ? `  /* ${c} */` : '';
    if (st.style === 'constexpr') {
      const isMask = v.endsWith('u');
      out.push(`inline constexpr ${isMask ? (v.endsWith('ull') ? 'unsigned long long' : 'unsigned') : 'int'} ${n.padEnd(width)}= ${v};${cm}`);
    } else out.push(`#define ${n.padEnd(width)}${c ? v.padEnd(vw) : v}${cm}`);
  }
  if (isBits && st.helpers && st.masks) {
    out.push('', '/* Field access, treating OFFSET as the shift from bit 0 (LSB) of an integer word. */');
    out.push(`#define ${P}_GET(word, FIELD) \\`, `    (((word) >> ${P}_##FIELD##_OFFSET) & ${P}_##FIELD##_MASK)`);
    out.push(`#define ${P}_SET(word, FIELD, value) \\`,
      `    ((word) = ((word) & ~((${P}_##FIELD##_MASK) << ${P}_##FIELD##_OFFSET)) | \\`,
      `              (((value) & ${P}_##FIELD##_MASK) << ${P}_##FIELD##_OFFSET))`);
  }
  if (st.guard) out.push('', `#endif /* ${P}_LAYOUT_H */`);
  return out.join('\n') + '\n';
}

// ---- UI ------------------------------------------------------------------------------

export function mountLayout(body, ctx) {
  const st = persisted(ctx.ns, 'layout', {
    ...PRESETS.demo(), masks: true, helpers: true, includeUnused: true, guard: true, style: 'define',
  }, (k) => { if (k === 'unit') buildEditor(); update(); });

  const buildSettings = () => clear(ctx.settings).append(
    ctlText(st, 'prefix', 'Macro prefix', 'Prefix for generated names', { size: 10 }),
    ctlNum(st, 'alignTotal', 'Pad total to multiple of', { min: 0, max: 4096 }, '0 or 1 = no tail padding'),
    ctlSelect(st, 'style', 'C style', [['define', '#define'], ['constexpr', 'C++ constexpr']]),
    ctlCheck(st, 'masks', 'Emit masks (bits)'),
    ctlCheck(st, 'helpers', 'GET/SET helpers'),
    ctlCheck(st, 'includeUnused', 'Include unused'),
    ctlCheck(st, 'guard', 'Include guard'),
  );
  buildSettings();

  const unitSeg = h('span');
  const renderUnitSeg = () => clear(unitSeg).append(segmented([['bits', 'bits'], ['bytes', 'bytes']], st.v.unit, (v) => { st.set('unit', v); renderUnitSeg(); }));
  renderUnitSeg();
  const rowInp = h('input', { type: 'number', min: 1, max: 256, value: st.v.rowWidth, class: 'nk-num-s', oninput: () => { const v = Math.round(+rowInp.value); if (v >= 1 && v <= 256) st.set('rowWidth', v); } });
  const presetSel = h('select', null, h('option', null, 'Load preset…'), PRESET_NAMES.map(([, l]) => h('option', null, l)));
  presetSel.addEventListener('change', () => {
    const i = presetSel.selectedIndex - 1;
    if (i < 0) return;
    const p = PRESETS[PRESET_NAMES[i][0]]();
    Object.assign(st.v, p);
    st.save();
    presetSel.selectedIndex = 0;
    rowInp.value = st.v.rowWidth;
    renderUnitSeg();
    buildSettings();
    buildEditor();
    update();
  });

  const jsonBox = h('textarea', { class: 'nk-input nk-mono-area', rows: 6, spellcheck: 'false' });
  const jsonErr = h('span', { class: 'nk-warn' });
  const jsonPanel = h('div', { class: 'nk-json', hidden: true }, jsonBox, h('div', { class: 'nk-row' },
    h('button', { type: 'button', class: 'nk-btn', onclick: () => applyJson() }, 'Apply JSON'),
    h('button', { type: 'button', class: 'nk-btn', onclick: () => copyText(jsonBox.value) }, 'Copy'),
    h('button', { type: 'button', class: 'nk-btn', onclick: () => download(`${st.v.prefix || 'layout'}.json`, jsonBox.value, 'application/json') }, 'Download'),
    jsonErr));
  const toggleJson = () => {
    jsonPanel.hidden = !jsonPanel.hidden;
    if (!jsonPanel.hidden) jsonBox.value = JSON.stringify({ unit: st.v.unit, rowWidth: st.v.rowWidth, prefix: st.v.prefix, alignTotal: st.v.alignTotal, items: strip(st.v.items) }, null, 2);
  };
  const strip = (items) => items.map(({ id, ...r }) => (r.kind === 'array' ? { ...r, items: strip(r.items) } : r));
  const addIds = (items) => items.map((r) => ({ ...r, id: uid(), offMode: r.offMode || 'auto', off: r.off || 0, used: r.used !== false, kind: r.kind || 'field', ...(r.kind === 'array' ? { items: addIds(r.items || []) } : {}) }));
  function applyJson() {
    try {
      const j = JSON.parse(jsonBox.value);
      if (!Array.isArray(j.items)) throw new Error('missing "items" array');
      Object.assign(st.v, { unit: j.unit === 'bytes' ? 'bytes' : 'bits', rowWidth: +j.rowWidth || 32, prefix: j.prefix || 'LAYOUT', alignTotal: +j.alignTotal || 0, items: addIds(j.items) });
      st.save();
      jsonErr.textContent = '';
      rowInp.value = st.v.rowWidth;
      renderUnitSeg();
      buildSettings();
      buildEditor();
      update();
    } catch (err) { jsonErr.textContent = 'Invalid JSON: ' + err.message; }
  }

  const editor = h('div', { class: 'nk-led' });
  const summary = h('div', { class: 'nk-lsum' });
  const issuesBox = h('div', { class: 'nk-issues' });
  const diagram = h('div', { class: 'nk-diagram' });
  const resultTbl = h('div');
  const headerPre = h('pre', { class: 'nk-code' });

  body.append(
    h('div', { class: 'nk-row' }, h('label', { class: 'nk-ctl' }, h('span', null, 'Units'), unitSeg),
      h('label', { class: 'nk-ctl' }, h('span', null, 'Diagram row width'), rowInp),
      presetSel, h('button', { type: 'button', class: 'nk-btn', onclick: toggleJson }, 'Import / export JSON')),
    jsonPanel,
    editor,
    h('div', { class: 'nk-row' },
      h('button', { type: 'button', class: 'nk-btn', onclick: () => { st.v.items.push(F(`field${st.v.items.length}`, st.v.unit === 'bits' ? 8 : 4)); save(true); } }, '+ Field'),
      h('button', { type: 'button', class: 'nk-btn', onclick: () => { st.v.items.push(A(`array${st.v.items.length}`, 4, [F('value', st.v.unit === 'bits' ? 8 : 4)])); save(true); } }, '+ Array'),
      h('button', { type: 'button', class: 'nk-btn nk-btn-danger', onclick: () => { st.v.items = []; save(true); } }, 'Clear')),
    issuesBox, summary, diagram, resultTbl,
    h('div', { class: 'nk-row nk-row-between' }, h('b', null, 'C header'),
      h('span', null, h('button', { type: 'button', class: 'nk-btn', onclick: () => copyText(headerPre.textContent) }, 'Copy'), ' ',
        h('button', { type: 'button', class: 'nk-btn', onclick: () => download(`${(st.v.prefix || 'layout').toLowerCase()}_layout.h`, headerPre.textContent) }, 'Download .h'))),
    headerPre,
  );

  const computedCells = new Map();
  const save = (rebuild) => { st.save(); if (rebuild) buildEditor(); update(); };
  const updateSoon = debounce(() => update(), 80);

  function moveIn(list, i, d) {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    save(true);
  }

  function itemRow(it, list, idx, depth) {
    const nameInp = h('input', { type: 'text', value: it.name, class: 'nk-led-name', spellcheck: 'false', oninput: () => { it.name = nameInp.value; st.save(); updateSoon(); } });
    const numInp = (key, min = 0) => {
      const inp = h('input', { type: 'number', min, value: it[key], class: 'nk-num-s', oninput: () => { it[key] = Math.max(min, Math.round(+inp.value || 0)); st.save(); updateSoon(); } });
      return inp;
    };
    const offInp = numInp('off');
    offInp.hidden = it.offMode === 'auto';
    const modeSel = h('select', {
      title: 'auto: right after the previous item · +gap: skip N units first · @abs: fixed offset within the parent',
      onchange: () => { it.offMode = ['auto', 'rel', 'abs'][modeSel.selectedIndex]; offInp.hidden = it.offMode === 'auto'; st.save(); update(); },
    }, [['auto', 'auto'], ['rel', '+gap'], ['abs', '@ offset']].map(([v, l]) => h('option', { selected: it.offMode === v }, l)));
    const usedChk = h('input', { type: 'checkbox', checked: it.used, title: 'used', onchange: () => { it.used = usedChk.checked; st.save(); update(); } });
    const computed = h('td', { class: 'nk-led-comp' });
    computedCells.set(it.id, computed);
    const btn = (label, title, fn, cls) => h('button', { type: 'button', class: ['nk-mini', cls], title, onclick: fn }, label);
    const actions = h('td', { class: 'nk-led-act' },
      btn('↑', 'Move up', () => moveIn(list, idx, -1)), btn('↓', 'Move down', () => moveIn(list, idx, 1)),
      btn('⧉', 'Duplicate', () => { list.splice(idx + 1, 0, clone(it)); save(true); }),
      it.kind === 'array' ? btn('+f', 'Add field to array', () => { it.items.push(F(`f${it.items.length}`, st.v.unit === 'bits' ? 4 : 1)); save(true); }) : null,
      it.kind === 'array' ? btn('+[]', 'Add nested array', () => { it.items.push(A(`a${it.items.length}`, 2, [F('v', st.v.unit === 'bits' ? 4 : 1)])); save(true); }) : null,
      btn('✕', 'Delete', () => { list.splice(idx, 1); save(true); }, 'nk-mini-danger'));
    const sizeCell = it.kind === 'array'
      ? h('td', null, h('span', { class: 'nk-led-arr' }, '[', numInp('count'), ']'))
      : h('td', null, numInp('width'));
    return h('tr', { class: ['nk-led-r', it.kind === 'array' && 'nk-led-arrrow', !it.used && 'nk-led-unused'] },
      h('td', { style: { paddingLeft: `${0.4 + depth * 1.4}rem` } }, depth ? h('span', { class: 'nk-led-tree' }, '└ ') : null, nameInp),
      sizeCell, h('td', null, modeSel, ' ', offInp), h('td', { class: 'nk-c' }, usedChk), computed, actions);
  }

  function clone(it) {
    const c = { ...it, id: uid() };
    if (it.kind === 'array') c.items = it.items.map(clone);
    return c;
  }

  function buildEditor() {
    clear(editor);
    computedCells.clear();
    const u = st.v.unit;
    const tb = h('tbody');
    const walk = (list, depth) => list.forEach((it, i) => {
      tb.append(itemRow(it, list, i, depth));
      if (it.kind === 'array') walk(it.items, depth + 1);
    });
    walk(st.v.items, 0);
    if (!st.v.items.length) tb.append(h('tr', null, h('td', { colspan: 6, class: 'nk-note' }, 'No items yet — add a field or load a preset.')));
    editor.append(h('div', { class: 'nk-hv-scroll' }, h('table', { class: 'nk-tbl nk-led-t' },
      h('thead', null, h('tr', null, h('th', null, 'Name'), h('th', null, `Width (${u}) / count`), h('th', null, 'Offset'), h('th', null, 'Used'), h('th', null, 'Placed at'), h('th'))),
      tb)));
  }

  function fmtOff(n) {
    if (st.v.unit === 'bits') return n % 8 === 0 ? `${n} (byte ${n / 8})` : `${n} (byte ${n >> 3}.${n & 7})`;
    return `${n} (0x${n.toString(16).toUpperCase()})`;
  }

  function update() {
    const issues = [];
    const lay = computeLayout(st.v.items, issues);
    const al = st.v.alignTotal;
    let tail = 0;
    if (al > 1 && lay.size % al) {
      tail = al - (lay.size % al);
      lay.gaps.push({ off: lay.size, len: tail });
      lay.padding += tail;
      lay.size += tail;
    }
    const u = st.v.unit;

    // computed cells in the editor
    const fillComputed = (l, base) => {
      for (const p of l.placed) {
        const cell = computedCells.get(p.it.id);
        if (cell) {
          cell.textContent = p.it.kind === 'array'
            ? `${base + p.off} … ${base + p.off + p.size}  (× ${p.elem.size})`
            : `${base + p.off} … ${base + p.off + p.size}`;
        }
        if (p.it.kind === 'array') fillComputed(p.elem, base + p.off);
      }
    };
    fillComputed(lay, 0);

    clear(issuesBox);
    if (issues.length) issuesBox.append(...issues.map((m) => h('div', { class: 'nk-warn' }, '⚠ ', m)));

    // summary
    clear(summary);
    const tot = lay.size || 1;
    const pct = (x) => `${((100 * x) / tot).toFixed(1)}%`;
    const bytesNote = u === 'bits' ? ` = ${(lay.size / 8).toLocaleString()} bytes` : ` = ${(lay.size * 8).toLocaleString()} bits`;
    summary.append(
      h('div', { class: 'nk-lsum-row' },
        h('span', { class: 'nk-stat' }, h('b', null, lay.size.toLocaleString()), ` ${u} total${bytesNote}`),
        h('span', { class: 'nk-stat nk-k-used' }, h('b', null, lay.used.toLocaleString()), ` used (${pct(lay.used)})`),
        h('span', { class: 'nk-stat nk-k-unused' }, h('b', null, lay.unused.toLocaleString()), ` unused (${pct(lay.unused)})`),
        h('span', { class: 'nk-stat nk-k-pad' }, h('b', null, lay.padding.toLocaleString()), ` padding (${pct(lay.padding)})`),
        lay.overlap ? h('span', { class: 'nk-stat nk-warn' }, h('b', null, String(lay.overlap)), ' overlapping') : null),
      h('div', { class: 'nk-lbar' },
        h('span', { class: 'nk-k-used', style: { width: pct(lay.used) } }),
        h('span', { class: 'nk-k-unused', style: { width: pct(lay.unused) } }),
        h('span', { class: 'nk-k-pad', style: { width: pct(lay.padding) } })));

    renderDiagram(lay);

    // results table
    const rows = [];
    const walk = (l, base, prefix, depth) => {
      for (const p of l.placed) {
        const abs = base + p.off;
        if (p.it.kind === 'field') {
          rows.push(h('tr', { class: !p.it.used ? 'nk-dim' : '' }, h('td', { style: { paddingLeft: `${0.4 + depth}rem` } }, prefix + p.it.name),
            h('td', null, fmtOff(abs)), h('td', null, String(p.size)), h('td', null, String(abs + p.size)), h('td', null, p.it.used ? 'used' : 'unused')));
        } else {
          rows.push(h('tr', { class: 'nk-led-arrrow' }, h('td', { style: { paddingLeft: `${0.4 + depth}rem` } }, `${prefix}${p.it.name}[${p.it.count}]`),
            h('td', null, fmtOff(abs)), h('td', null, `${p.size} (${p.it.count} × ${p.elem.size})`), h('td', null, String(abs + p.size)), h('td', null, p.it.used ? 'array' : 'unused array')));
          walk(p.elem, abs, `${prefix}${p.it.name}[0].`, depth + 1);
        }
      }
    };
    walk(lay, 0, '', 0);
    clear(resultTbl).append(h('details', { class: 'nk-help', open: false }, h('summary', null, 'Absolute offsets table'),
      h('div', { class: 'nk-hv-scroll' }, h('table', { class: 'nk-tbl' },
        h('thead', null, h('tr', null, ['Item', `Offset (${u})`, 'Size', 'End', ''].map((x) => h('th', null, x)))), h('tbody', null, rows)))));

    headerPre.textContent = genHeader(lay, st.v, tail);
  }

  function renderDiagram(lay) {
    clear(diagram);
    const R = st.v.rowWidth;
    const spans = [];
    flatten(lay, 0, '', spans, { n: 0 });
    spans.sort((a, b) => a.start - b.start);
    const total = lay.size;
    if (!total) { diagram.append(h('div', { class: 'nk-note' }, 'Empty layout.')); return; }
    const nRows = Math.ceil(total / R);
    // decide which rows to collapse (runs of rows fully inside an "array rest" span)
    const rest = spans.filter((s) => s.kind === 'rest');
    const inside = (r) => rest.some((s) => s.start <= r * R && s.start + s.len >= (r + 1) * R);
    const visual = [];
    for (let r = 0; r < nRows; r++) {
      if (inside(r) && r > 0 && inside(r - 1) && r + 1 < nRows && inside(r + 1)) {
        const last = visual[visual.length - 1];
        if (last && last.skip) last.count++;
        else visual.push({ skip: true, from: r, count: 1 });
      } else visual.push({ r });
    }
    if (visual.length > 1500) { diagram.append(h('div', { class: 'nk-warn' }, `Diagram too large (${visual.length} rows) — increase the row width.`)); return; }

    const tickEvery = R <= 16 ? 1 : R <= 32 ? (u() === 'bits' ? 1 : 4) : R <= 64 ? 8 : 16;
    function u() { return st.v.unit; }
    const grid = h('div', { class: 'nk-dg', style: { '--cols': R } });
    const head = h('div', { class: 'nk-dg-row nk-dg-head' }, h('div', { class: 'nk-dg-off' }, u()));
    const headCells = h('div', { class: 'nk-dg-cells' });
    for (let c = 0; c < R; c++) headCells.append(h('div', { class: 'nk-dg-tick', style: { gridColumn: `${c + 1}` } }, c % tickEvery === 0 ? String(c) : ''));
    head.append(headCells);
    grid.append(head);
    for (const v of visual) {
      if (v.skip) {
        grid.append(h('div', { class: 'nk-dg-row nk-dg-skip' }, h('div', { class: 'nk-dg-off' }, '⋮'),
          h('div', { class: 'nk-dg-cells' }, h('div', { class: 'nk-dg-skipl', style: { gridColumn: `1 / span ${R}` } }, `⋯ ${v.count} more row${v.count > 1 ? 's' : ''} of array elements (${(v.count * R).toLocaleString()} ${u()}) ⋯`))));
        continue;
      }
      const rs = v.r * R, re = Math.min(rs + R, total);
      const cells = h('div', { class: 'nk-dg-cells' });
      for (const s of spans) {
        const ss = Math.max(s.start, rs), se = Math.min(s.start + s.len, re);
        if (se <= ss) continue;
        const cont = ss > s.start, more = se < s.start + s.len;
        const lab = s.kind === 'pad' ? (se - ss > 2 ? 'pad' : '') : s.kind === 'rest' ? `… ${s.label}` : s.label;
        cells.append(h('div', {
          class: ['nk-dg-seg', `nk-dg-${s.kind}`, s.color !== undefined && `nk-c${s.color}`, cont && 'nk-dg-cont', more && 'nk-dg-more'],
          style: { gridColumn: `${ss - rs + 1} / span ${se - ss}` },
          title: `${s.label}\noffset ${s.start}, width ${s.w} ${u()}${cont || more ? `\n(this row: ${ss}–${se})` : ''}`,
        }, h('span', { class: 'nk-dg-lab' }, lab), s.kind !== 'pad' && !cont ? h('span', { class: 'nk-dg-w' }, String(s.w)) : null));
      }
      if (re - rs < R) cells.append(h('div', { class: 'nk-dg-seg nk-dg-beyond', style: { gridColumn: `${re - rs + 1} / span ${R - (re - rs)}` } }));
      grid.append(h('div', { class: 'nk-dg-row' }, h('div', { class: 'nk-dg-off' }, String(rs)), cells));
    }
    diagram.append(h('div', { class: 'nk-hv-scroll' }, grid));
  }

  buildEditor();
  update();
}
