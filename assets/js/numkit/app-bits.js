// NumKit — bit playground: fixed-width variables, C-style bit ops, per-line bit previews and op traces.

import { h, clear, ctlSelect, ctlCheck, persisted, debounce, bitGrid, cp } from './ui.js';
import { BitEval } from './bit-eval.js';
import * as U from './numutil.js';

const SNIPPETS = {
  'Mask from width & offset': `// all variables are fixed-width unsigned (see settings)
width  = 5
offset = 3
value  = 0xFFFFFFFF
value  = (~(~0u >> width) >> offset);
mask   = ((1u << width) - 1) << (WIDTH - width - offset)
value == mask`,
  'Bitfield extract / insert': `reg   = 0xDEADBEEF
off   = 8
width = 12
m     = (1 << width) - 1
field = (reg >> off) & m
reg   = (reg & ~(m << off)) | ((0xABC & m) << off)
extract(reg, off, width)
insert(reg, 0x123, off, width)`,
  'Lowest-bit tricks': `x = 0b1011_0100
x & -x          // isolate lowest set bit
x & (x - 1)     // clear lowest set bit
x | (x - 1)     // set all bits below the lowest set bit
~x & (x + 1)    // isolate lowest clear bit
ctz(x)
clz(x)`,
  'Round up to power of two': `v = 1000
v = v - 1
v |= v >> 1
v |= v >> 2
v |= v >> 4
v |= v >> 8
v |= v >> 16
v = v + 1
pow2ceil(1000)`,
  'SWAR popcount': `x = 0xF0F0A5A5
x = x - ((x >> 1) & 0x55555555)
x = (x & 0x33333333) + ((x >> 2) & 0x33333333)
x = (x + (x >> 4)) & 0x0F0F0F0F
x = (x * 0x01010101) >> 24
popcount(0xF0F0A5A5)`,
  'Rotate & byte swap': `x = 0x12345678
rotl(x, 8)
rotr(x, 4)
bswap(x)
((x & 0xFF) << 24) | ((x & 0xFF00) << 8) | ((x >> 8) & 0xFF00) | (x >> 24)`,
  'Float bits (32-bit)': `one  = bits(1.0f)
sign = one >> 31
exp  = (one >> 23) & 0xFF
mant = one & 0x7FFFFF
neg  = one | (1 << 31)     // -1.0f
half = one - (1 << 23)     // exponent - 1 → 0.5f`,
  'Signed vs unsigned': `a = -20
b = 3
a / b            // unsigned division
sdiv(a, b)       // signed division
a >> 2           // logical shift
sar(a, 2)        // arithmetic shift
smax(a, b)`,
};

export function mountBits(body, ctx) {
  const st = persisted(ctx.ns, 'bits', {
    code: SNIPPETS['Mask from width & offset'], width: 32, base: 'hex', steps: 'auto',
  }, () => render());

  ctx.settings.append(
    ctlSelect(st, 'width', 'Variable width', [[8, '8-bit'], [16, '16-bit'], [32, '32-bit'], [64, '64-bit']]),
    ctlSelect(st, 'base', 'Show values as', [['hex', 'hex'], ['bin', 'binary'], ['dec', 'decimal'], ['float', 'float bits']]),
    ctlSelect(st, 'steps', 'Op trace', [['auto', 'active line'], ['all', 'every line'], ['none', 'hidden']]),
  );

  const snipSel = h('select', null, h('option', null, 'Examples…'), Object.keys(SNIPPETS).map((k) => h('option', null, k)));
  snipSel.addEventListener('change', () => {
    const k = Object.keys(SNIPPETS)[snipSel.selectedIndex - 1];
    if (k) { ta.value = SNIPPETS[k]; st.set('code', ta.value, true); syncGutter(); render(); }
    snipSel.selectedIndex = 0;
  });

  const ta = h('textarea', { class: 'nk-code-in', spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off', wrap: 'off' });
  ta.value = st.v.code;
  const gutter = h('div', { class: 'nk-gutter' });
  const editorWrap = h('div', { class: 'nk-editor' }, gutter, ta);
  const out = h('div', { class: 'nk-bp-out' });
  const vars = h('div');
  let activeLine = 1;

  const help = h('details', { class: 'nk-help' }, h('summary', null, 'Operators & functions'),
    h('div', { class: 'nk-help-b nk-sub' },
      h('p', null, 'All values are unsigned and wrap at the selected width. Operators: ', h('code', null, '~ ! - + * / % ** << >> & ^ | == != < <= > >= && || ?:'),
        '; compound assignments ', h('code', null, '+= -= &= |= ^= <<= >>='), '. ', h('code', null, '>>'), ' is logical; use ', h('code', null, 'sar(x, n)'), ' for arithmetic shift.'),
      h('p', null, 'Functions: ', h('code', null, 'popcount parity clz ctz bitlen rotl rotr bswap rev bit mask sar sext extract(x,off,w) insert(dst,v,off,w) setbit clrbit togglebit testbit min max smin smax abs sdiv smod lowbit pow2ceil bits(1.5f)'),
        '. Constants: ', h('code', null, 'WIDTH ALL true false'), '. Casts like ', h('code', null, '(u8)x (i16)x'), ' truncate (and sign-extend for signed types).')));

  body.append(h('div', { class: 'nk-row' }, snipSel), editorWrap, help, out, vars);

  function syncGutter() {
    const n = ta.value.split('\n').length;
    clear(gutter);
    for (let i = 1; i <= n; i++) gutter.append(h('div', { class: i === activeLine ? 'nk-gl-on' : '' }, String(i)));
    ta.rows = Math.max(4, Math.min(30, n + 1));
  }
  ta.addEventListener('scroll', () => { gutter.scrollTop = ta.scrollTop; });
  const rerender = debounce(() => render(), 120);
  ta.addEventListener('input', () => { st.set('code', ta.value, true); syncGutter(); rerender(); });
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = ta.selectionStart;
      ta.setRangeText('    ', s, ta.selectionEnd, 'end');
      ta.dispatchEvent(new Event('input'));
    }
  });
  const caretLine = () => ta.value.slice(0, ta.selectionStart).split('\n').length;
  const onCaret = () => {
    const l = caretLine();
    if (l !== activeLine) { activeLine = l; syncGutter(); if (st.v.steps === 'auto') render(); else markActive(); }
  };
  ['keyup', 'click', 'focus'].forEach((ev) => ta.addEventListener(ev, onCaret));

  function markActive() {
    out.querySelectorAll('.nk-bp-card').forEach((c) => c.classList.toggle('nk-active', Number(c.dataset.line) === activeLine));
  }

  const fmtVal = (v, W) => {
    switch (st.v.base) {
      case 'bin': return '0b' + U.group(v.toString(2).padStart(W, '0'), 4, '_');
      case 'dec': return v.toString();
      case 'float': {
        if (W === 16 || W === 32 || W === 64) return U.shortest(U.bitsToFloat(v, W), W) + (W === 32 ? 'f' : '');
        return '0x' + U.padBase(v, 16, W / 4);
      }
      default: return '0x' + U.group(U.padBase(v, 16, W / 4), 4, '_');
    }
  };
  const valueLine = (v, W) => h('span', { class: 'nk-bp-val' }, cp(fmtVal(v, W), fmtVal(v, W).replace(/_/g, '')),
    h('span', { class: 'nk-note' }, `  u ${v}`, `  s ${U.wrap(v, W, true)}`));

  function render() {
    const W = st.v.width;
    const ev = new BitEval(W);
    let results;
    try { results = ev.run(st.v.code); } catch (err) { clear(out).append(h('div', { class: 'nk-err' }, String(err.message || err))); return; }
    clear(out);
    for (const r of results) {
      const card = h('div', { class: ['nk-bp-card', r.error && 'nk-bp-errcard'], dataset: { line: r.line } });
      card.addEventListener('click', () => {
        // jump the caret to this statement
        ta.focus({ preventScroll: true });
        ta.setSelectionRange(r.stmt.e, r.stmt.e);
        onCaret();
      });
      const head = h('div', { class: 'nk-bp-head' }, h('span', { class: 'nk-bp-ln' }, `L${r.line}`), h('code', { class: 'nk-bp-src' }, r.src.trim()));
      card.append(head);
      if (r.error) {
        card.append(h('div', { class: 'nk-err' }, r.error.message));
        out.append(card);
        continue;
      }
      const body2 = h('div', { class: 'nk-bp-body' });
      if (r.name !== undefined && r.before !== undefined) {
        body2.append(h('div', { class: 'nk-bp-line nk-dim' }, h('span', { class: 'nk-bp-tag' }, 'before'), bitGrid(r.before, W, { compact: true, hex: false, labels: false }), valueLine(r.before, W)));
      }
      body2.append(h('div', { class: 'nk-bp-line' }, h('span', { class: 'nk-bp-tag' }, r.name !== undefined ? r.name : '='),
        bitGrid(r.value, W, { compact: true, prev: r.before, hex: false, labels: r.line === activeLine }), valueLine(r.value, W)));
      card.append(body2);
      if (r.warnings.length) card.append(...[...new Set(r.warnings)].map((w) => h('div', { class: 'nk-warn nk-sub' }, '⚠ ', w)));
      const ops = r.steps.filter((s) => s.kind === 'op');
      const showSteps = st.v.steps === 'all' || (st.v.steps === 'auto' && r.line === activeLine);
      if (ops.length >= 1 && st.v.steps !== 'none' && (showSteps || ops.length > 1)) {
        if (showSteps) {
          const src = st.v.code;
          const tb = h('div', { class: 'nk-steps' });
          const seen = new Set();
          for (const s of r.steps) {
            if (s.kind === 'lit' && s.e - s.s < 2) continue;
            const text = src.slice(s.s, s.e);
            if (seen.has(text)) continue;
            seen.add(text);
            tb.append(h('div', { class: ['nk-step', s.kind !== 'op' && 'nk-dim'] },
              h('code', { class: 'nk-step-src', title: text }, text),
              bitGrid(s.v, W, { compact: true, hex: false, labels: false }),
              h('span', { class: 'nk-step-v' }, fmtVal(s.v, W))));
          }
          card.append(h('div', { class: 'nk-sub' }, 'Evaluation order'), tb);
        } else if (st.v.steps !== 'none') {
          card.append(h('div', { class: 'nk-note nk-sub' }, `${ops.length} operation${ops.length > 1 ? 's' : ''} — put the cursor on this line to trace them`));
        }
      }
      out.append(card);
    }
    markActive();

    clear(vars);
    if (ev.env.size) {
      vars.append(h('div', { class: 'nk-pod' }, h('header', { class: 'nk-pod-h' }, h('span', { class: 'nk-pod-t' }, `Variables (${W}-bit)`)),
        h('div', { class: 'nk-pod-b' }, h('table', { class: 'nk-tbl nk-vars' }, h('tbody', null,
          [...ev.env.entries()].map(([k, v]) => h('tr', null, h('th', null, k), h('td', null, bitGrid(v, W, { compact: true, hex: false, labels: false, rowBits: W > 32 ? 32 : 64 })),
            h('td', null, valueLine(v, W)))))))));
    }
  }

  // start with the caret on the first line that has something worth tracing
  try {
    const first = new BitEval(st.v.width).run(st.v.code).find((r) => r.steps.filter((x) => x.kind === 'op').length > 1);
    if (first) activeLine = first.line;
  } catch { /* ignore */ }
  syncGutter();
  render();
}
