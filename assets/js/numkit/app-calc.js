// NumKit — calculator & translator sub-app.

import { h, clear, pod, kv, table, cp, bitGrid, byteRow, ctlSelect, ctlNum, persisted, debounce, sup } from './ui.js';
import { CalcEval, FUNCTION_NAMES } from './calc-eval.js';
import { printAst } from './expr.js';
import * as U from './numutil.js';

const EXAMPLES = [
  'sqrt(0xFF12BC - 0.123f + 0b1101)', '0xFF1232', '0.1f', "'A'", '-42', '360360', '2**61 - 1',
  'asfloat(0x3F800000)', 'bits(-0.0)', '(i8)0xC8', "'ABCD'", 'x = 0b1011; x << 4 | 3',
];

const NBSP = '\u202F';
const fmtDec = (v) => U.group(v.toString(), 3, NBSP);
const hexU = (v, digits = 0) => '0x' + U.padBase(v, 16, digits);
const hexG = (v, digits = 0) => '0x' + U.group(U.padBase(v, 16, digits), 4, '_');
const binG = (v, digits = 0) => '0b' + U.group(v.toString(2).padStart(digits, '0'), 4, ' ');
const FLOAT_FN = { 16: 'ashalf', 32: 'asfloat', 64: 'asdouble' };

export function mountCalc(body, ctx) {
  const st = persisted(ctx.ns, 'calc', {
    expr: 'sqrt(0xFF12BC - 0.123f + 0b1101)', endian: 'le', width: 32, intDiv: 'exact', digits: 0, history: [],
  }, () => render());

  // ---- settings ----
  ctx.settings.append(
    ctlSelect(st, 'endian', 'Byte order', [['le', 'Little-endian'], ['be', 'Big-endian']], 'Byte order used for memory views'),
    ctlSelect(st, 'width', 'Int width', [[8, '8-bit'], [16, '16-bit'], [32, '32-bit'], [64, '64-bit']],
      "Width for two's complement views, ~/>>>/rotl/bswap/clz"),
    ctlSelect(st, 'intDiv', 'int / int', [['exact', 'exact (→ float if needed)'], ['c', 'C (truncate)']]),
    ctlNum(st, 'digits', 'Float digits', { min: 0, max: 40 }, '0 = shortest round-trip representation'),
  );

  // ---- input ----
  const input = h('textarea', {
    class: 'nk-input', rows: 1, spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off',
    placeholder: 'Type an expression or a value: 0xFF1232, sqrt(2), (u8)-1, \'A\', bits(0.1f) …',
  });
  input.value = st.v.expr;
  const errBox = h('div', { class: 'nk-errbox' });
  const histBox = h('div', { class: 'nk-chips nk-hist' });
  const out = h('div', { class: 'nk-pods' });
  let lastAns = null;

  const autosize = () => { input.style.height = 'auto'; input.style.height = input.scrollHeight + 2 + 'px'; };
  const setExpr = (s, commit) => {
    input.value = s;
    st.set('expr', s, true);
    autosize();
    render();
    if (commit) pushHistory(s);
  };
  const pushHistory = (s) => {
    s = s.trim();
    if (!s) return;
    const hist = [s, ...st.v.history.filter((x) => x !== s)].slice(0, 14);
    st.set('history', hist, true);
    renderHistory();
  };
  const renderHistory = () => {
    clear(histBox);
    if (!st.v.history.length) return;
    histBox.append(h('span', { class: 'nk-chips-l' }, 'History'),
      st.v.history.map((x) => h('button', { type: 'button', class: 'nk-chip', onclick: () => setExpr(x) }, x)),
      h('button', { type: 'button', class: 'nk-chip nk-chip-x', title: 'Clear history', onclick: () => { st.set('history', [], true); renderHistory(); } }, '×'));
  };

  const rerender = debounce(() => render(), 120);
  input.addEventListener('input', () => { st.set('expr', input.value, true); autosize(); rerender(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      pushHistory(input.value);
      if (lastValue) lastAns = lastValue;
    }
  });

  const help = h('details', { class: 'nk-help' }, h('summary', null, 'Syntax'),
    h('div', { class: 'nk-help-b' },
      kv([
        ['Literals', '123  1_000  0xFF  0b1010  0o17  1.5  .5  1e-3  0x1.8p3  \'A\'  \'\\n\'  \'ABCD\''],
        ['Suffixes', 'f → float32 (1.5f)   d → double   u / l / ul → ignored on ints'],
        ['Operators', '+ − * / %  **(power)  & | ^ ~  << >> >>>(logical @ width)  == != < <= > >=  && || !  ?:  n!'],
        ['Casts', '(float) (double) (half) (int) (unsigned) (u8)…(u64) (i8)…(i64) (int16_t) (wchar_t) (unsigned char) …'],
        ['Statements', 'x = 5; y = x << 2; y | 1   (newline or ; separated, compound ops like += work, last value is shown)'],
        ['Constants', 'pi e tau phi inf nan ans  INT32_MAX UINT64_MAX FLT_EPSILON DBL_MAX …'],
        ['Functions', FUNCTION_NAMES.join(' ')],
      ])));

  body.append(
    h('div', { class: 'nk-inrow' }, input),
    errBox,
    h('div', { class: 'nk-chips' }, h('span', { class: 'nk-chips-l' }, 'Try'),
      EXAMPLES.map((x) => h('button', { type: 'button', class: 'nk-chip', onclick: () => setExpr(x, true) }, x))),
    histBox,
    help,
    out,
  );
  requestAnimationFrame(autosize);
  renderHistory();

  let lastValue = null;

  function showError(src, err) {
    clear(errBox);
    const s = Math.max(0, Math.min(err.pos, src.length)), e = Math.max(s + 1, Math.min(err.end, src.length));
    errBox.append(h('div', { class: 'nk-err' }, h('b', null, 'Error: '), err.message),
      err.pos >= 0 ? h('pre', { class: 'nk-errsrc' }, src.slice(0, s), h('mark', null, src.slice(s, e) || ' '), src.slice(e)) : null);
  }

  function render() {
    const src = st.v.expr;
    clear(errBox);
    if (!src.trim()) { clear(out); lastValue = null; return; }
    const ev = new CalcEval({ width: st.v.width, intDiv: st.v.intDiv });
    if (lastAns) ev.env.set('ans', lastAns);
    let r;
    try { r = ev.run(src); } catch (err) { r = { error: { message: String(err.message || err), pos: -1 } }; }
    if (r.error) {
      showError(src, r.error);
      out.classList.add('nk-stale');
      return;
    }
    out.classList.remove('nk-stale');
    clear(out);
    if (!r.value) return;
    lastValue = r.value;
    const fmtLit = (lit) => (lit.kind === 'int' ? (lit.base === 'char' ? `'${charOf(lit.v)}'` : lit.v.toString())
      : U.shortest(lit.v, lit.prec) + (lit.prec === 32 ? 'f' : ''));
    const interp = r.stmts.filter((x) => x.t !== 'error').map((x) => printAst(x, fmtLit)).join(';  ');
    const type = r.value.k === 'i' ? 'integer' : U.FMT[r.value.p].name;
    out.append(pod('Input interpretation', h('div', { class: 'nk-interp' }, interp, h('span', { class: 'nk-arrow' }, ' → '), h('span', { class: 'nk-type' }, type))));
    try {
      if (r.value.k === 'i') intPods(r.value.v).forEach((p) => out.append(p));
      else floatPods(r.value.v, r.value.p).forEach((p) => out.append(p));
    } catch (err) {
      out.append(pod('Internal error', String(err && err.stack || err)));
    }
  }

  // ---------------------------------------------------------------- integers
  function intPods(v) {
    const W = st.v.width, le = st.v.endian === 'le';
    const neg = v < 0n, a = U.absBig(v);
    const fits = v >= -(1n << BigInt(W - 1)) && v < 1n << BigInt(W);
    const needBits = neg ? U.signedBits(v) : Math.max(1, U.bitLength(v));
    const gw = fits ? W : Math.ceil(needBits / 8) * 8;
    const gval = U.wrap(v, gw);
    const pods = [];

    pods.push(pod('Result', h('div', { class: 'nk-big' }, cp(fmtDec(v), v.toString())), { badge: 'exact integer' }));

    const sgn = neg ? '-' : '';
    pods.push(pod('Number systems', kv([
      ['Decimal', cp(fmtDec(v), v.toString())],
      ['Hexadecimal', cp(sgn + hexG(a), sgn + hexU(a))],
      ['Octal', cp(sgn + '0o' + a.toString(8), sgn + '0o' + a.toString(8))],
      ['Binary', cp(sgn + binG(a), sgn + '0b' + a.toString(2), 'nk-wrap')],
      neg && fits ? [`Two's complement (${W}-bit)`, cp(hexG(gval, W / 4), hexU(gval, W / 4)), binG(gval, W)] : null,
      ['Base 36', cp(sgn + a.toString(36).toUpperCase())],
    ])));

    if (gw <= 128) {
      const toggle = (i) => {
        const nv = gval ^ (1n << BigInt(i));
        const lit = hexU(nv, gw / 4);
        setExpr(neg && [8, 16, 32, 64].includes(gw) ? `(i${gw})${lit}` : lit);
      };
      pods.push(pod(`Bits (${gw}-bit${neg ? ", two's complement" : ''})`, [
        bitGrid(gval, gw, { onToggle: toggle }),
        h('div', { class: 'nk-sub' }, `u${gw}: `, cp(fmtDec(gval), gval.toString()), '   ', `i${gw}: `,
          cp(fmtDec(U.wrap(v, gw, true)), U.wrap(v, gw, true).toString()), fits ? null : h('span', { class: 'nk-warn' }, `  — wider than the ${W}-bit setting`)),
      ], { badge: 'click a bit to flip it' }));
    } else {
      pods.push(pod('Bits', h('div', { class: 'nk-sub' }, `${needBits} bits — too wide for a bit grid.`)));
    }

    // fixed-width table
    const rows = [8, 16, 32, 64, 128].map((w) => {
      const u = U.wrap(v, w), s = U.wrap(v, w, true);
      const fu = v >= 0n && v < 1n << BigInt(w), fs = v >= -(1n << BigInt(w - 1)) && v < 1n << BigInt(w - 1);
      const status = fu && fs ? 'fits both' : fu ? 'fits unsigned' : fs ? 'fits signed' : 'truncated';
      return h('tr', { class: w === W ? 'nk-hl' : '' },
        h('td', null, `u${w} / i${w}`), h('td', null, cp(hexG(u, w / 4), hexU(u, w / 4))), h('td', null, cp(fmtDec(u), u.toString())),
        h('td', null, cp(fmtDec(s), s.toString())), h('td', { class: status === 'truncated' ? 'nk-warn' : 'nk-ok' }, status));
    });
    pods.push(pod('Fixed-width integers', table(['Type', 'Hex', 'Unsigned', 'Signed', ''], rows)));

    // memory
    const nb = gw / 8;
    if (nb <= 16) {
      const bl = U.toBytes(gval, nb, true), bb = U.toBytes(gval, nb, false);
      const first = le ? ['Little-endian', bl] : ['Big-endian', bb], second = le ? ['Big-endian', bb] : ['Little-endian', bl];
      const init = (bs) => `{ ${bs.map((b) => '0x' + U.hex2(b)).join(', ')} }`;
      pods.push(pod(`Memory (${nb} byte${nb > 1 ? 's' : ''})`, [
        h('div', { class: 'nk-memrow' }, h('span', { class: 'nk-meml' }, first[0]), byteRow(first[1], { chars: true })),
        h('div', { class: 'nk-memrow nk-dim' }, h('span', { class: 'nk-meml' }, second[0]), byteRow(second[1], { chars: true })),
        kv([
          ['C initializer', cp(init(first[1]))],
          ['Hex string', cp(first[1].map(U.hex2).join(' '))],
        ]),
      ]));
    }

    // reinterpretation as floats
    const frows = [16, 32, 64].filter((w) => w <= Math.max(gw, 16)).map((w) => {
      const bits = U.wrap(v, w);
      const x = U.bitsToFloat(bits, w);
      const d = U.decompose(bits, w);
      return [`${U.FMT[w].name}`, h('span', null, cp(U.shortest(x, w)), ' ',
        h('button', { type: 'button', class: 'nk-mini', onclick: () => setExpr(`${FLOAT_FN[w]}(${hexU(bits, w / 4)})`, true) }, 'inspect')),
      `${d.cls}${w < needBits && !neg ? ' · low ' + w + ' bits' : ''}`];
    });
    pods.push(pod('Bit pattern as float', kv(frows)));

    // characters
    pods.push(pod('Characters', charRows(v, gw, le)));

    // properties
    pods.push(pod('Properties', propRows(v, W)));

    // factorization
    pods.push(factorPod(v));
    return pods;
  }

  function charRows(v, gw, le) {
    const rows = [];
    const cpv = v >= 0n && v <= 0x10ffffn ? Number(v) : null;
    if (cpv !== null) {
      const glyph = U.printableChar(cpv);
      const name = U.cpName(cpv);
      const isSur = cpv >= 0xd800 && cpv <= 0xdfff;
      rows.push(['Code point', h('span', null, glyph ? h('span', { class: 'nk-glyph' }, cp(glyph)) : null,
        ' ', cp('U+' + cpv.toString(16).toUpperCase().padStart(4, '0')), name ? h('span', { class: 'nk-note' }, ` ${name}`) : null)]);
      rows.push(['C literal', cp(U.cEscape(cpv))]);
      if (!isSur) {
        rows.push(['UTF-8', cp(U.utf8Bytes(cpv).map(U.hex2).join(' '))]);
        rows.push(['UTF-16', cp(U.utf16Units(cpv).map((u) => u.toString(16).toUpperCase().padStart(4, '0')).join(' '))]);
      }
    }
    const lo8 = Number(U.wrap(v, 8)), lo16 = Number(U.wrap(v, 16));
    rows.push(['char (low byte)', h('span', null, cp(U.cEscape(lo8)), h('span', { class: 'nk-note' }, ` = ${lo8} / ${U.wrap(v, 8, true)}${lo8 >= 0xa0 ? ', Latin-1 ' + String.fromCharCode(lo8) : ''}`))]);
    const wg = U.printableChar(lo16);
    rows.push(['wchar_t (low 16 bits)', h('span', null, wg ? cp(wg) : '·', ' ', cp(U.cEscape(lo16)), h('span', { class: 'nk-note' }, ' (UTF-16 code unit, Windows wchar_t)'))]);
    const nb = gw / 8;
    if (nb <= 16) {
      const bytes = U.toBytes(U.wrap(v, gw), nb, le);
      const s = bytes.map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '·')).join('');
      rows.push([`char[${nb}] in memory`, h('span', null, cp(`"${s}"`), h('span', { class: 'nk-note' }, ` ${le ? 'little' : 'big'}-endian`))]);
    }
    if (v > 0n && U.bitLength(v) <= 64) {
      const bytes = U.toBytes(v, Math.ceil(U.bitLength(v) / 8), false);
      if (bytes.length > 1 && bytes.every((b) => b >= 32 && b < 127)) {
        rows.push(['Multi-char literal', cp(`'${bytes.map((b) => String.fromCharCode(b)).join('')}'`)]);
      }
    }
    return kv(rows);
  }

  function propRows(v, W) {
    const a = U.absBig(v);
    const bl = U.bitLength(a);
    const sb = U.signedBits(v);
    const yesno = (b) => (b ? 'yes' : 'no');
    const isPow2 = a > 0n && (a & (a - 1n)) === 0n;
    const nextPow2 = a <= 1n ? 1n : 1n << BigInt(U.bitLength(a - 1n));
    const prevPow2 = a === 0n ? 0n : 1n << BigInt(bl - 1);
    const r = U.isqrt(a);
    const tz = a === 0n ? null : U.ctz(a);
    const smallest = (bits, signed) => [8, 16, 32, 64, 128].find((w) => w >= bits) ? `${signed ? 'i' : 'u'}${[8, 16, 32, 64, 128].find((w) => w >= bits)}` : '> 128 bits';
    const digits = (b) => (a === 0n ? 1 : a.toString(b).length);
    return kv([
      ['Parity', v % 2n === 0n ? 'even' : 'odd'],
      ['Sign', v > 0n ? 'positive' : v < 0n ? 'negative' : 'zero'],
      ['Width in digits', h('span', null, `dec ${digits(10)} · hex ${digits(16)} · oct ${digits(8)} · bin ${digits(2)}`)],
      ['Bits needed', h('span', null, v >= 0n ? `${Math.max(1, bl)} unsigned · ` : '', `${sb} signed`,
        h('span', { class: 'nk-note' }, `  smallest type: ${v >= 0n ? smallest(Math.max(1, bl), false) + ' / ' : ''}${smallest(sb, true)}`))],
      ['Bytes needed', String(Math.max(1, Math.ceil((v >= 0n ? bl : sb) / 8)))],
      ['Set bits', v >= 0n ? String(U.popcount(a)) : `${U.popcount(U.wrap(v, W))} (as ${W}-bit)`],
      ['Trailing zeros', tz === null ? '—' : h('span', null, String(tz), h('span', { class: 'nk-note' }, `  divisible by 2${sup(tz)} = ${1n << BigInt(tz)} (alignment)`))],
      ['Power of two', isPow2 ? `yes, 2${sup(bl - 1)}` : h('span', null, 'no', h('span', { class: 'nk-note' }, `  between ${prevPow2} and ${nextPow2}`))],
      ['Perfect square', r * r === a ? `yes, ${v < 0n ? '−' : ''}${r}²` : 'no'],
      ['mod 3 / 7 / 9 / 10', `${v % 3n} / ${v % 7n} / ${v % 9n} / ${v % 10n}`],
      ['Prime', a < 2n ? 'no' : yesno(U.isPrime(a)) + (a >= U.PRIME_CERTAIN_BELOW && U.isPrime(a) ? ' (probable)' : '')],
    ]);
  }

  function factorPod(v) {
    const a = U.absBig(v);
    if (a < 2n) return pod('Prime factorization', h('div', { class: 'nk-sub' }, a === 0n ? '0 has no prime factorization (every integer divides it).' : `${v} is a unit — empty product.`));
    const { factors, complete, leftover } = U.factorize(a, 400);
    const parts = [];
    if (v < 0n) parts.push('−1');
    for (const [p, e] of factors) parts.push(h('span', { class: 'nk-fac' }, cp(p.toString()), e > 1 ? h('sup', null, String(e)) : null));
    for (const l of leftover) parts.push(h('span', { class: 'nk-fac nk-warn', title: 'Could not be factored within the time budget' }, `(${l})`));
    const joined = [];
    parts.forEach((p, i) => { if (i) joined.push(h('span', { class: 'nk-times' }, ' × ')); joined.push(p); });
    const isP = factors.length === 1 && factors[0][1] === 1 && complete;
    const items = [h('div', { class: 'nk-big nk-facs' }, joined)];
    if (complete) {
      const { count, sigma } = U.divisorStats(factors);
      let phi = a;
      for (const [p] of factors) phi = (phi / p) * (p - 1n);
      const raw = factors.map(([p, e]) => (e > 1 ? `${p}^${e}` : String(p))).join(' * ');
      items.push(kv([
        ['As expression', cp(raw)],
        ['Distinct primes', String(factors.length)],
        ['Divisors τ(n)', count.toString()],
        ['Sum of divisors σ(n)', cp(fmtDec(sigma), sigma.toString())],
        ["Euler's totient φ(n)", cp(fmtDec(phi), phi.toString())],
        ['Perfect number', sigma === 2n * a ? 'yes!' : sigma > 2n * a ? 'no (abundant)' : 'no (deficient)'],
      ]));
      const divs = U.listDivisors(factors, 4096);
      if (divs) {
        const box = h('div', { class: 'nk-divs' });
        const show = (n) => {
          clear(box);
          divs.slice(0, n).forEach((d) => box.append(cp(d.toString(), null, 'nk-div')));
          if (divs.length > n) box.append(h('button', { type: 'button', class: 'nk-mini', onclick: () => show(divs.length) }, `show all ${divs.length}`));
        };
        show(96);
        items.push(h('div', { class: 'nk-sub' }, 'Divisors'), box);
      } else {
        items.push(h('div', { class: 'nk-sub' }, `${count} divisors — too many to list.`));
      }
    } else {
      items.push(h('div', { class: 'nk-sub nk-warn' }, 'Partial factorization: the bracketed composite resisted Pollard ρ within the time budget.'));
    }
    return pod('Prime factorization', items, { badge: isP ? (a >= U.PRIME_CERTAIN_BELOW ? 'probable prime' : 'prime') : 'fundamental theorem of arithmetic' });
  }

  // ---------------------------------------------------------------- floats
  function floatPods(x, p) {
    const pods = [];
    const digits = st.v.digits;
    const disp = U.fmtFloat(x, p, digits);
    pods.push(pod('Result', h('div', { class: 'nk-big' }, cp(disp)), { badge: U.FMT[p].name }));

    const fr = U.toFraction(x);
    const rows = [
      ['Decimal (shortest)', cp(U.shortest(x, p))],
      Number.isFinite(x) ? ['Scientific', cp(x.toExponential(Math.max(0, U.shortest(x, p).replace(/^-|[.]|e.*$/g, '').replace(/^0+/, '').length - 1)))] : null,
      ['Hex float (%a)', cp(U.hexFloat(x, p))],
      ['Exact stored value', cp(U.exactDecimal(x, p), null, 'nk-wrap')],
      fr && Math.abs(fr.err) <= Math.abs(x) * 1e-9 ? ['Fraction', h('span', null, cp(`${fr.num}/${fr.den}`), h('span', { class: 'nk-note' }, fr.err === 0 ? '  (exact in this precision)' : `  (≈, error ${fr.err.toExponential(2)})`))] : null,
    ];
    for (const q of [16, 32, 64]) {
      if (q === p) continue;
      const y = U.roundTo(x, q);
      const exact = y === x || (Number.isNaN(x) && Number.isNaN(y));
      rows.push([`As ${U.FMT[q].name.split(' ')[0]}`, h('span', null, cp(U.shortest(y, q)),
        h('span', { class: exact ? 'nk-note nk-ok' : 'nk-note nk-warn' }, exact ? '  exact' : `  rounding error ${(y - x).toExponential(3)}`))]);
    }
    pods.push(pod('Representations', kv(rows)));

    for (const q of p === 16 ? [16, 32, 64] : p === 32 ? [32, 64] : [64, 32]) pods.push(ieeePod(U.roundTo(x, q), q, q === p));

    if (Number.isFinite(x)) {
      const up = U.nextFloat(x, p, 1), dn = U.nextFloat(x, p, -1);
      const eps = { 16: 2 ** -10, 32: 2 ** -23, 64: 2 ** -52 }[p];
      const dec = { 16: 3.31, 32: 7.22, 64: 15.95 }[p];
      pods.push(pod('Precision & neighbours', kv([
        ['Next up', cp(U.shortest(up, p))],
        ['Next down', cp(U.shortest(dn, p))],
        ['ULP here', cp(U.shortest(up - x, 64))],
        ['Machine epsilon', h('span', null, cp(U.shortest(eps, 64)), h('span', { class: 'nk-note' }, `  2${sup(-Math.log2(eps))} · ~${dec} decimal digits`))],
      ])));

      const W = st.v.width;
      const t = BigInt(Math.trunc(x));
      const inRange = t >= -(1n << BigInt(W - 1)) && t < 1n << BigInt(W - 1);
      pods.push(pod('Integer conversion', [kv([
        ['trunc / floor', `${t} / ${BigInt(Math.floor(x))}`],
        ['ceil / round', `${BigInt(Math.ceil(x))} / ${BigInt(Math.sign(x) * Math.round(Math.abs(x)))}`],
        [`(i${W}) cast`, inRange ? cp(t.toString()) : h('span', { class: 'nk-warn' }, `${U.wrap(t, W, true)} — out of range: undefined behaviour in C`)],
      ]), h('button', { type: 'button', class: 'nk-mini', onclick: () => setExpr(`trunc(${st.v.expr.trim()})`, true) }, 'analyze trunc(x) as integer')]));
    }
    return pods;
  }

  function ieeePod(x, p, primary) {
    const bits = U.floatToBits(x, p);
    const d = U.decompose(bits, p);
    const region = (i) => (i === p - 1 ? 's' : i >= d.mBits ? 'e' : 'm');
    const toggle = (i) => setExpr(`${FLOAT_FN[p]}(${hexU(bits ^ (1n << BigInt(i)), p / 4)})`);
    const le = st.v.endian === 'le';
    const sig = d.cls === 'normal' ? 1 + Number(d.mant) / 2 ** d.mBits : d.cls === 'subnormal' ? Number(d.mant) / 2 ** d.mBits : null;
    const formula = sig === null ? d.cls
      : `(−1)${sup(d.sign)} × ${U.shortest(sig, 64)} × 2${sup(d.unbiased)}`;
    const bytes = U.toBytes(bits, p / 8, le);
    return pod(`IEEE 754 ${U.FMT[p].name}`, [
      bitGrid(bits, p, { region, onToggle: toggle, hex: true }),
      h('div', { class: 'nk-legend' }, h('span', { class: 'nk-r-s' }, 'sign'), h('span', { class: 'nk-r-e' }, `exponent ×${d.eBits}`), h('span', { class: 'nk-r-m' }, `mantissa ×${d.mBits}`)),
      kv([
        ['Bits', cp(hexU(bits, p / 4))],
        ['Sign', d.sign ? '1 (negative)' : '0 (positive)'],
        ['Exponent', h('span', null, cp(`${d.exp}`), h('span', { class: 'nk-note' }, `  raw 0x${d.exp.toString(16).toUpperCase()}, bias ${d.bias} → 2${sup(d.unbiased)}`))],
        ['Mantissa', h('span', null, cp(hexU(d.mant, Math.ceil(d.mBits / 4))), sig !== null ? h('span', { class: 'nk-note' }, `  significand ${U.shortest(sig, 64)}`) : null)],
        ['Value', h('span', null, formula, h('span', { class: 'nk-note' }, `  = ${U.shortest(x, p)}`))],
        ['Class', d.cls],
        [`Bytes (${le ? 'LE' : 'BE'})`, cp(bytes.map(U.hex2).join(' '))],
      ]),
    ], { class: primary ? '' : 'nk-pod-secondary', badge: primary ? 'click a bit to flip it' : null });
  }

  render();
  return { focus: () => input.focus(), setExpr: (s) => setExpr(s, true) };
}

function charOf(v) {
  const n = Number(v);
  if (v > 0xffn) return '0x' + v.toString(16);
  return U.cEscape(n).slice(1, -1);
}
