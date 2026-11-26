// NumKit — raw data viewer: dump text/hex/binary/… and slice it into units of 1–64 bits.

import { h, clear, ctlSelect, ctlNum, ctlCheck, persisted, debounce, segmented, copyText } from './ui.js';
import * as U from './numutil.js';

const INPUT_FORMATS = [
  ['text', 'Text (UTF-8)'], ['utf16', 'Text (UTF-16LE)'], ['hex', 'Hex'], ['bin', 'Binary'],
  ['dec', 'Decimal bytes'], ['oct', 'Octal bytes'], ['base64', 'Base64'],
];
const VIEW_FORMATS = [
  ['source', 'as input'], ['hex', 'hex'], ['bin', 'binary'], ['udec', 'unsigned'], ['sdec', 'signed'],
  ['oct', 'octal'], ['char', 'char'], ['float', 'float'],
];

function bitsFromString(str, bitsPerDigit) {
  const n = str.length * bitsPerDigit;
  const bytes = new Uint8Array(Math.ceil(n / 8));
  let pos = 0;
  for (const ch of str) {
    const d = parseInt(ch, 1 << bitsPerDigit);
    for (let k = bitsPerDigit - 1; k >= 0; k--, pos++) if ((d >> k) & 1) bytes[pos >> 3] |= 0x80 >> (pos & 7);
  }
  return { bytes, bits: n };
}

function parseInput(src, fmt) {
  const labels = null;
  switch (fmt) {
    case 'text': {
      const bytes = new TextEncoder().encode(src);
      // map every byte to the character it belongs to (continuation bytes → '⋯')
      const lab = [];
      for (const ch of src) {
        const n = new TextEncoder().encode(ch).length;
        lab.push(ch === ' ' ? '␠' : ch === '\n' ? '↵' : ch === '\t' ? '⇥' : ch, ...Array(n - 1).fill('⋯'));
      }
      return { bytes, bits: bytes.length * 8, labels: lab };
    }
    case 'utf16': {
      const bytes = new Uint8Array(src.length * 2);
      const lab = [];
      for (let i = 0; i < src.length; i++) {
        const c = src.charCodeAt(i);
        bytes[2 * i] = c & 0xff; bytes[2 * i + 1] = c >> 8;
        lab.push(src[i] === ' ' ? '␠' : src[i] === '\n' ? '↵' : src[i], '⋯');
      }
      return { bytes, bits: bytes.length * 8, labels: lab };
    }
    case 'hex': {
      const s = src.replace(/0x|\\x|[\s,;:_'-]|\bh\b/gi, '');
      const bad = /[^0-9a-f]/i.exec(s);
      if (bad) throw new Error(`Not a hex digit: '${bad[0]}'`);
      return bitsFromString(s, 4);
    }
    case 'bin': {
      const s = src.replace(/0b|[\s,;:_'.-]/gi, '');
      const bad = /[^01]/.exec(s);
      if (bad) throw new Error(`Not a binary digit: '${bad[0]}'`);
      return bitsFromString(s, 1);
    }
    case 'dec':
    case 'oct': {
      const toks = src.split(/[\s,;]+/).filter(Boolean);
      const bytes = new Uint8Array(toks.length);
      toks.forEach((t, i) => {
        const v = fmt === 'dec' ? Number(t) : parseInt(t.replace(/^0o/i, ''), 8);
        if (!Number.isInteger(v) || v < -128 || v > 255 || (fmt === 'oct' && !/^(0o)?[0-7]+$/i.test(t))) throw new Error(`Not a byte: '${t}'`);
        bytes[i] = v & 0xff;
      });
      return { bytes, bits: bytes.length * 8 };
    }
    case 'base64': {
      let bin;
      try { bin = atob(src.replace(/\s+/g, '')); } catch { throw new Error('Invalid base64'); }
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      return { bytes, bits: bytes.length * 8 };
    }
  }
  return { bytes: new Uint8Array(0), bits: 0, labels };
}

function readUnit(data, bitOff, w, littleEndian, lsbFirst) {
  if (w % 8 === 0 && bitOff % 8 === 0) {
    const b0 = bitOff / 8, n = w / 8;
    let v = 0n;
    for (let i = 0; i < n; i++) {
      const byte = BigInt(data.bytes[b0 + (littleEndian ? n - 1 - i : i)] ?? 0);
      v = (v << 8n) | byte;
    }
    return v;
  }
  let v = 0n;
  for (let k = 0; k < w; k++) {
    const pos = bitOff + k;
    const byte = data.bytes[pos >> 3] ?? 0;
    if (lsbFirst) { if ((byte >> (pos & 7)) & 1) v |= 1n << BigInt(k); }
    else v = (v << 1n) | BigInt((byte >> (7 - (pos & 7))) & 1);
  }
  return v;
}

function glyph(cp) {
  const g = U.printableChar(cp);
  return g === null ? '·' : g;
}

function formatUnit(v, w, fmt, ctx) {
  switch (fmt) {
    case 'hex': return U.padBase(v, 16, Math.ceil(w / 4));
    case 'bin': return v.toString(2).padStart(w, '0');
    case 'oct': return U.padBase(v, 8, Math.ceil(w / 3));
    case 'udec': return v.toString();
    case 'sdec': return U.wrap(v, w, true).toString();
    case 'char': return w > 32 ? '·' : glyph(Number(v));
    case 'float': {
      if (w !== 16 && w !== 32 && w !== 64) return '—';
      const x = U.bitsToFloat(v, w);
      const s = U.shortest(x, w);
      return s.length > 12 ? x.toPrecision(w === 16 ? 4 : 6) : s;
    }
    case 'source': {
      if (ctx.labels && w === 8 && ctx.aligned) return ctx.labels[ctx.byteIndex] ?? '·';
      if (ctx.labels && w === 16 && ctx.fmt === 'utf16' && ctx.aligned) return ctx.labels[ctx.byteIndex] ?? '·';
      const f = { hex: 'hex', bin: 'bin', dec: 'udec', oct: 'oct' }[ctx.fmt] || (w % 4 ? 'bin' : 'hex');
      return formatUnit(v, w, f === 'hex' && w % 4 ? 'bin' : f, ctx);
    }
  }
  return '?';
}

export function mountData(body, ctx) {
  const st = persisted(ctx.ns, 'data', {
    input: 'Hello, NumKit! ✓ 0123', fmt: 'text', unit: 8, endian: 'le', bitOrder: 'msb',
    top: 'source', bottom: 'hex', layout: 'stacked', perRow: 0, textCol: true,
  }, () => render());
  let fileData = null, fileName = '';
  let limit = 4096;

  ctx.settings.append(
    ctlSelect(st, 'endian', 'Byte order', [['le', 'Little-endian'], ['be', 'Big-endian']], 'For byte-aligned units of 16+ bits'),
    ctlSelect(st, 'bitOrder', 'Bit order', [['msb', 'MSB first'], ['lsb', 'LSB first']], 'How non-byte-aligned units read the bit stream'),
    ctlNum(st, 'perRow', 'Units / row', { min: 0, max: 64 }, '0 = auto'),
    ctlCheck(st, 'textCol', 'Text column'),
  );

  const fmtSel = h('select', {
    onchange: () => { fileData = null; st.set('fmt', INPUT_FORMATS[fmtSel.selectedIndex][0]); syncInputState(); },
  }, INPUT_FORMATS.map(([v, l]) => h('option', { selected: st.v.fmt === v }, l)));
  const ta = h('textarea', { class: 'nk-input nk-mono-area', rows: 4, spellcheck: 'false', placeholder: 'Paste text, hex (DE AD BE EF), binary (0101…), or drop a file here' });
  ta.value = st.v.input;
  const fileInp = h('input', { type: 'file', style: { display: 'none' } });
  const fileBtn = h('button', { type: 'button', class: 'nk-btn', onclick: () => fileInp.click() }, 'Load file…');
  const fileTag = h('span', { class: 'nk-filetag' });

  const unitInp = h('input', { type: 'range', min: 1, max: 64, value: st.v.unit });
  const unitNum = h('input', { type: 'number', min: 1, max: 64, value: st.v.unit, class: 'nk-num-s' });
  const setUnit = (w) => {
    w = Math.max(1, Math.min(64, Math.round(w) || 8));
    unitInp.value = w; unitNum.value = w;
    limit = 4096;
    st.set('unit', w);
  };
  unitInp.addEventListener('input', () => setUnit(Number(unitInp.value)));
  unitNum.addEventListener('input', () => unitNum.value && setUnit(Number(unitNum.value)));
  const presetUnits = h('span', { class: 'nk-seg' }, [1, 4, 8, 16, 32, 64].map((w) => h('button', { type: 'button', onclick: () => setUnit(w) }, String(w))));

  const viewSel = (key) => {
    const sel = h('select', { onchange: () => st.set(key, VIEW_FORMATS[sel.selectedIndex][0]) },
      VIEW_FORMATS.map(([v, l]) => h('option', { selected: st.v[key] === v }, l)));
    return sel;
  };
  const layoutSeg = h('span');
  const renderLayoutSeg = () => {
    clear(layoutSeg).append(segmented([['stacked', 'Original above value'], ['split', 'Side-by-side tables']], st.v.layout, (v) => { st.set('layout', v); renderLayoutSeg(); }));
  };
  renderLayoutSeg();

  const stats = h('div', { class: 'nk-sub' });
  const errBox = h('div', { class: 'nk-errbox' });
  const grid = h('div', { class: 'nk-hexview' });
  const detail = h('div', { class: 'nk-detail' }, h('span', { class: 'nk-note' }, 'Hover a unit to inspect it, click to pin.'));

  body.append(
    h('div', { class: 'nk-row' }, h('label', { class: 'nk-ctl' }, h('span', null, 'Input'), fmtSel), fileBtn, fileTag, fileInp,
      h('button', { type: 'button', class: 'nk-btn', onclick: () => exportC() }, 'Copy as C array')),
    ta,
    h('div', { class: 'nk-row' },
      h('label', { class: 'nk-ctl' }, h('span', null, 'Unit width (bits)'), unitInp, unitNum), presetUnits),
    h('div', { class: 'nk-row' },
      h('label', { class: 'nk-ctl' }, h('span', null, 'Original'), viewSel('top')),
      h('label', { class: 'nk-ctl' }, h('span', null, 'Interpreted'), viewSel('bottom')), layoutSeg),
    errBox, stats, grid, detail,
  );

  const syncInputState = () => {
    ta.disabled = !!fileData;
    fileTag.textContent = fileData ? `${fileName} (${fileData.bytes.length.toLocaleString()} bytes)` : '';
    if (fileData) fileTag.append(' ', h('button', { type: 'button', class: 'nk-mini', onclick: () => { fileData = null; syncInputState(); render(); } }, '×'));
  };
  const loadFile = async (file) => {
    const buf = new Uint8Array(await file.arrayBuffer());
    fileData = { bytes: buf, bits: buf.length * 8 };
    fileName = file.name;
    limit = 4096;
    syncInputState();
    render();
  };
  fileInp.addEventListener('change', () => fileInp.files[0] && loadFile(fileInp.files[0]));
  ta.addEventListener('dragover', (e) => { e.preventDefault(); ta.classList.add('nk-drop'); });
  ta.addEventListener('dragleave', () => ta.classList.remove('nk-drop'));
  ta.addEventListener('drop', (e) => {
    e.preventDefault();
    ta.classList.remove('nk-drop');
    if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
  });
  const rerender = debounce(() => render(), 150);
  ta.addEventListener('input', () => { st.set('input', ta.value, true); limit = 4096; rerender(); });

  let current = null, pinned = -1;

  function getData() {
    if (fileData) return { ...fileData, labels: null };
    return parseInput(st.v.input, st.v.fmt);
  }

  function exportC() {
    try {
      const d = getData();
      const n = Math.ceil(d.bits / 8);
      const lines = [];
      for (let i = 0; i < n; i += 12) lines.push('    ' + [...d.bytes.slice(i, Math.min(n, i + 12))].map((b) => '0x' + U.hex2(b)).join(', ') + ',');
      copyText(`static const unsigned char data[${n}] = {\n${lines.join('\n')}\n};`);
    } catch (err) { errBox.textContent = err.message; }
  }

  function render() {
    clear(errBox);
    let data;
    try { data = getData(); } catch (err) {
      errBox.append(h('div', { class: 'nk-err' }, h('b', null, 'Error: '), err.message));
      return;
    }
    const w = st.v.unit, le = st.v.endian === 'le', lsb = st.v.bitOrder === 'lsb';
    const full = Math.floor(data.bits / w), rem = data.bits % w;
    const total = full + (rem ? 1 : 0);
    const perRow = st.v.perRow || (w <= 4 ? 32 : w <= 8 ? 16 : w <= 32 ? 8 : 4);
    const shown = Math.min(total, limit);
    current = { data, w, le, lsb, full, rem, perRow };
    pinned = -1;

    stats.textContent = `${Math.ceil(data.bits / 8).toLocaleString()} bytes · ${data.bits.toLocaleString()} bits · ${full.toLocaleString()} unit${full === 1 ? '' : 's'} of ${w} bit${w > 1 ? 's' : ''}`
      + (rem ? ` + ${rem} leftover bit${rem > 1 ? 's' : ''}` : '')
      + (w % 8 === 0 && w > 8 ? ` · ${le ? 'little' : 'big'}-endian` : w % 8 ? ` · ${lsb ? 'LSB' : 'MSB'}-first bit stream` : '');

    const units = [];
    for (let i = 0; i < shown; i++) {
      const isPartial = i === full;
      const uw = isPartial ? rem : w;
      const off = i * w;
      const v = readUnit(data, off, uw, le, lsb);
      units.push({ i, v, uw, off, partial: isPartial });
    }
    const fctx = (u) => ({ labels: data.labels, aligned: u.off % 8 === 0, byteIndex: u.off / 8, fmt: fileData ? 'file' : st.v.fmt });
    const cell = (u, fmt) => formatUnit(u.v, u.uw, fmt, fctx(u));

    clear(grid);
    grid.className = `nk-hexview nk-layout-${st.v.layout}`;
    const rows = Math.ceil(shown / perRow);
    const rowBits = perRow * w;
    const textOk = st.v.textCol && rowBits % 8 === 0;
    const offDigits = Math.max(4, Math.ceil(data.bits / 8).toString(16).length);
    const offLabel = (r) => {
      const bitOff = r * rowBits;
      return bitOff % 8 === 0 ? U.padBase(BigInt(bitOff / 8), 16, offDigits) : `${U.padBase(BigInt(bitOff >> 3), 16, offDigits)}.${bitOff & 7}`;
    };
    const textFor = (r) => {
      const b0 = (r * rowBits) / 8, b1 = Math.min(Math.ceil(data.bits / 8), b0 + rowBits / 8);
      const span = h('span', { class: 'nk-hv-text' });
      for (let b = b0; b < b1; b++) {
        const byte = data.bytes[b];
        span.append(h('span', { 'data-b': b }, byte >= 32 && byte < 127 ? String.fromCharCode(byte) : '·'));
      }
      return span;
    };

    const tbl = h('table', { class: 'nk-hv' });
    const head = h('tr', null, h('th', { class: 'nk-hv-off' }, 'offset'));
    const colHead = (k) => (w % 8 === 0 ? `+${((k * w) / 8).toString(16).toUpperCase()}` : `${k}`);
    if (st.v.layout === 'split') {
      for (let k = 0; k < perRow; k++) head.append(h('th', null, colHead(k)));
      head.append(h('th', { class: 'nk-hv-gap' }));
      for (let k = 0; k < perRow; k++) head.append(h('th', null, colHead(k)));
    } else {
      for (let k = 0; k < perRow; k++) head.append(h('th', null, colHead(k)));
    }
    if (textOk) head.append(h('th', { class: 'nk-hv-textcol' }, 'text'));
    tbl.append(h('thead', null, head));
    const tb = h('tbody');
    for (let r = 0; r < rows; r++) {
      const tr = h('tr', null, h('td', { class: 'nk-hv-off' }, offLabel(r)));
      const slice = units.slice(r * perRow, (r + 1) * perRow);
      const mk = (u, fmt, extra) => h('td', { class: ['nk-hv-c', u.partial && 'nk-partial', extra], 'data-i': u.i }, cell(u, fmt));
      if (st.v.layout === 'split') {
        slice.forEach((u) => tr.append(mk(u, st.v.top, 'nk-hv-top')));
        for (let k = slice.length; k < perRow; k++) tr.append(h('td'));
        tr.append(h('td', { class: 'nk-hv-gap' }));
        slice.forEach((u) => tr.append(mk(u, st.v.bottom, 'nk-hv-bot')));
        for (let k = slice.length; k < perRow; k++) tr.append(h('td'));
      } else {
        slice.forEach((u) => tr.append(h('td', { class: ['nk-hv-c nk-hv-stack', u.partial && 'nk-partial'], 'data-i': u.i },
          h('div', { class: 'nk-hv-top' }, cell(u, st.v.top)), h('div', { class: 'nk-hv-bot' }, cell(u, st.v.bottom)))));
        for (let k = slice.length; k < perRow; k++) tr.append(h('td'));
      }
      if (textOk) tr.append(h('td', { class: 'nk-hv-textcol' }, textFor(r)));
      tb.append(tr);
    }
    tbl.append(tb);
    grid.append(h('div', { class: 'nk-hv-scroll' }, tbl));
    if (shown < total) {
      grid.append(h('button', { type: 'button', class: 'nk-btn', onclick: () => { limit *= 4; render(); } },
        `Show more (${shown.toLocaleString()} of ${total.toLocaleString()} units)`));
    }
    current.units = units;
    showDetail(-1);
  }

  function highlight(i) {
    grid.querySelectorAll('.nk-hl').forEach((e) => e.classList.remove('nk-hl'));
    if (i < 0 || !current) return;
    grid.querySelectorAll(`[data-i="${i}"]`).forEach((e) => e.classList.add('nk-hl'));
    const u = current.units[i];
    const b0 = u.off >> 3, b1 = (u.off + u.uw - 1) >> 3;
    for (let b = b0; b <= b1; b++) grid.querySelectorAll(`[data-b="${b}"]`).forEach((e) => e.classList.add('nk-hl'));
  }

  function showDetail(i) {
    clear(detail);
    if (i < 0 || !current) { detail.append(h('span', { class: 'nk-note' }, 'Hover a unit to inspect it, click to pin.')); return; }
    const u = current.units[i];
    const w = u.uw;
    const parts = [
      ['unit', `#${u.i}${u.partial ? ' (partial)' : ''}`],
      ['offset', `bit ${u.off} = byte ${u.off >> 3}${u.off & 7 ? '.' + (u.off & 7) : ''}`],
      ['hex', '0x' + U.padBase(u.v, 16, Math.ceil(w / 4))],
      ['bin', u.v.toString(2).padStart(w, '0')],
      ['unsigned', u.v.toString()],
      ['signed', U.wrap(u.v, w, true).toString()],
    ];
    if (w === 16 || w === 32 || w === 64) parts.push([U.FMT[w].name.split(' ')[0], U.shortest(U.bitsToFloat(u.v, w), w)]);
    if (w <= 32) { const g = U.printableChar(Number(u.v)); if (g) parts.push(['char', g]); }
    detail.append(...parts.map(([k, v]) => h('span', { class: 'nk-det' }, h('b', null, k), ' ', h('span', { class: 'nk-copy', onclick: () => copyText(v) }, v))));
    if (ctx.openInCalc) detail.append(h('button', { type: 'button', class: 'nk-mini', onclick: () => ctx.openInCalc('0x' + U.padBase(u.v, 16, Math.ceil(w / 4))) }, 'open in calculator'));
  }

  grid.addEventListener('mouseover', (e) => {
    if (pinned >= 0) return;
    const c = e.target.closest('[data-i]');
    if (!c) return;
    const i = Number(c.dataset.i);
    highlight(i);
    showDetail(i);
  });
  grid.addEventListener('click', (e) => {
    const c = e.target.closest('[data-i]');
    if (!c) return;
    const i = Number(c.dataset.i);
    pinned = pinned === i ? -1 : i;
    highlight(i);
    showDetail(i);
    grid.classList.toggle('nk-pinned', pinned >= 0);
  });

  syncInputState();
  render();
}
