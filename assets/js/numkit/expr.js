// NumKit — shared tokenizer + Pratt parser.
// One grammar for both the calculator (mixed int/float) and the bit playground (fixed width).
//
// Literals:  123  1_000  1'000  0xFF  0b1010  0o17  1.5  .5  1e3  1.5f  2d  0x1.8p3  'A'  '\n'  'ABCD'
// Suffixes:  u U l L (ignored for ints), f F (float32), d D (float64)
// Operators: C precedence, plus ** (power, right-assoc) and >>> (logical shift at the current width)
// Casts:     (float)x (double)x (u8)x (int16_t)x (unsigned char)x ...
// Statements are separated by newlines or ';'.  Comments: // ...  # ...  /* ... */

export class NkError extends Error {
  constructor(msg, pos = -1, end = -1) {
    super(msg);
    this.pos = pos;
    this.end = end < 0 ? pos + 1 : end;
  }
}

export const TYPE_WORDS = new Set([
  'float', 'double', 'f16', 'half', 'f32', 'f64', 'bool',
  'char', 'schar', 'uchar', 'byte', 'sbyte', 'short', 'ushort', 'int', 'uint', 'long', 'ulong',
  'signed', 'unsigned', 'wchar', 'wchar_t', 'char8_t', 'char16_t', 'char32_t', 'size_t', 'ssize_t', 'ptrdiff_t',
  'i8', 'u8', 'i16', 'u16', 'i32', 'u32', 'i64', 'u64',
  'int8_t', 'uint8_t', 'int16_t', 'uint16_t', 'int32_t', 'uint32_t', 'int64_t', 'uint64_t',
]);

const OPS = [
  '>>>=', '<<=', '>>=', '>>>', '**', '<<', '>>', '<=', '>=', '==', '!=', '&&', '||',
  '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=',
  '+', '-', '*', '/', '%', '&', '|', '^', '~', '!', '(', ')', '<', '>', ',', '=', '?', ':', ';',
];

export const ASSIGN_OPS = new Set(['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=', '>>>=']);

const BIN_PREC = {
  '||': 1, '&&': 2, '|': 3, '^': 4, '&': 5,
  '==': 6, '!=': 6, '<': 7, '<=': 7, '>': 7, '>=': 7,
  '<<': 8, '>>': 8, '>>>': 8, '+': 9, '-': 9, '*': 10, '/': 10, '%': 10,
};

const HEX_RE = /^0[xX]((?:[0-9a-fA-F](?:['_]?[0-9a-fA-F])*)?)(?:\.([0-9a-fA-F]*))?(?:[pP]([+-]?\d+))?/;
const BIN_RE = /^0[bB]([01](?:['_]?[01])*)/;
const OCT_RE = /^0[oO]([0-7](?:['_]?[0-7])*)/;
const DEC_RE = /^((?:\d(?:['_]?\d)*)?)(?:\.(\d*))?(?:[eE]([+-]?\d+))?/;

const clean = (s) => s.replace(/['_]/g, '');

function applySuffix(lit, suffix, s, e) {
  if (!suffix) return lit;
  const lower = suffix.toLowerCase();
  if (lower === 'f') {
    const v = lit.kind === 'int' ? Number(lit.v) : lit.v;
    return { kind: 'float', v: Math.fround(v), prec: 32 };
  }
  if (lower === 'd' || (lit.kind === 'float' && lower === 'l')) {
    const v = lit.kind === 'int' ? Number(lit.v) : lit.v;
    return { kind: 'float', v, prec: 64 };
  }
  if (lit.kind === 'int' && /^(u|l|ll|ul|lu|ull|llu|z|uz|zu)$/.test(lower)) {
    return { ...lit, unsigned: lower.includes('u') };
  }
  throw new NkError(`Unknown number suffix '${suffix}'`, s, e);
}

function lexNumber(src, i) {
  const rest = src.slice(i);
  let m, lit, len;
  if ((m = HEX_RE.exec(rest)) && (m[1] || m[2] !== undefined)) {
    len = m[0].length;
    if (m[2] !== undefined || m[3] !== undefined) {
      if (m[3] === undefined) throw new NkError('Hex float needs a p exponent, e.g. 0x1.8p3', i, i + len);
      const intDigits = clean(m[1] || '');
      const frac = m[2] || '';
      const all = (intDigits + frac) || '0';
      const mant = Number(BigInt('0x' + all));
      lit = { kind: 'float', v: mant * Math.pow(2, Number(m[3]) - 4 * frac.length), prec: 64, base: 16 };
    } else {
      lit = { kind: 'int', v: BigInt('0x' + clean(m[1])), base: 16, digits: clean(m[1]).length };
    }
  } else if ((m = BIN_RE.exec(rest))) {
    len = m[0].length;
    lit = { kind: 'int', v: BigInt('0b' + clean(m[1])), base: 2, digits: clean(m[1]).length };
  } else if ((m = OCT_RE.exec(rest))) {
    len = m[0].length;
    lit = { kind: 'int', v: BigInt('0o' + clean(m[1])), base: 8, digits: clean(m[1]).length };
  } else {
    m = DEC_RE.exec(rest);
    len = m[0].length;
    if (!len || m[0] === '.') throw new NkError('Bad number', i, i + 1);
    const ip = clean(m[1] || '');
    if (m[2] !== undefined || m[3] !== undefined) {
      const txt = (ip || '0') + '.' + (m[2] || '0') + (m[3] !== undefined ? 'e' + m[3] : '');
      lit = { kind: 'float', v: Number(txt), prec: 64, base: 10 };
    } else {
      lit = { kind: 'int', v: BigInt(ip), base: 10, digits: ip.length };
    }
  }
  let j = i + len;
  const sm = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(j));
  if (sm) {
    lit = applySuffix(lit, sm[0], i, j + sm[0].length);
    j += sm[0].length;
  }
  if (j < src.length && /[0-9.]/.test(src[j])) throw new NkError(`Invalid digit '${src[j]}' in number`, j, j + 1);
  return { lit, end: j };
}

const SIMPLE_ESC = { n: 10, t: 9, r: 13, '0': 0, a: 7, b: 8, f: 12, v: 11, e: 27, '\\': 92, "'": 39, '"': 34, '?': 63 };

function lexChar(src, i) {
  const start = i;
  let wide = false;
  if (src[i] !== "'") { wide = true; i++; }
  i++; // opening quote
  const cps = [];
  while (i < src.length && src[i] !== "'") {
    if (src[i] === '\n') break;
    if (src[i] === '\\') {
      const c = src[i + 1];
      let m;
      if ((m = /^x([0-9a-fA-F]{1,8})/.exec(src.slice(i + 1)))) { cps.push(parseInt(m[1], 16)); i += 1 + m[0].length; }
      else if ((m = /^u([0-9a-fA-F]{4})/.exec(src.slice(i + 1)))) { cps.push(parseInt(m[1], 16)); i += 1 + m[0].length; }
      else if ((m = /^U([0-9a-fA-F]{8})/.exec(src.slice(i + 1)))) { cps.push(parseInt(m[1], 16)); i += 1 + m[0].length; }
      else if ((m = /^[0-7]{1,3}/.exec(src.slice(i + 1)))) { cps.push(parseInt(m[0], 8)); i += 1 + m[0].length; }
      else if (c in SIMPLE_ESC) { cps.push(SIMPLE_ESC[c]); i += 2; }
      else throw new NkError(`Unknown escape '\\${c}'`, i, i + 2);
    } else {
      const cp = src.codePointAt(i);
      cps.push(cp);
      i += cp > 0xffff ? 2 : 1;
    }
  }
  if (src[i] !== "'") throw new NkError('Unterminated character literal', start, i);
  i++;
  if (!cps.length) throw new NkError('Empty character literal', start, i);
  let v = 0n;
  if (cps.length === 1) v = BigInt(cps[0]);
  else {
    // C multi-character constant: 'ABCD' == 0x41424344 (first char most significant)
    for (const cp of cps) {
      if (cp > 0xff) throw new NkError('Multi-character literal may only contain 8-bit chars', start, i);
      v = (v << 8n) | BigInt(cp);
    }
  }
  return { lit: { kind: 'int', v, base: 'char', wide, chars: cps.length }, end: i };
}

export function tokenize(src) {
  const toks = [];
  let i = 0, depth = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '\n') { if (depth === 0) toks.push({ t: 'nl', s: i, e: i + 1 }); i++; continue; }
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
    if (c === '#' || (c === '/' && src[i + 1] === '/')) { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') {
      const j = src.indexOf('*/', i + 2);
      i = j < 0 ? n : j + 2;
      continue;
    }
    try {
      if ((c >= '0' && c <= '9') || (c === '.' && src[i + 1] >= '0' && src[i + 1] <= '9')) {
        const { lit, end } = lexNumber(src, i);
        toks.push({ t: 'num', v: lit, s: i, e: end });
        i = end;
        continue;
      }
      if (c === "'" || ((c === 'L' || c === 'u' || c === 'U') && src[i + 1] === "'")) {
        const { lit, end } = lexChar(src, i);
        toks.push({ t: 'num', v: lit, s: i, e: end });
        i = end;
        continue;
      }
    } catch (err) {
      if (!(err instanceof NkError)) throw err;
      // recoverable: emit an error token and skip the offending run of characters
      let j = Math.max(err.end, i + 1);
      while (j < n && /[A-Za-z0-9_.']/.test(src[j])) j++;
      toks.push({ t: 'err', v: err.message, s: err.pos, e: j });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_]/.test(src[j])) j++;
      toks.push({ t: 'id', v: src.slice(i, j), s: i, e: j });
      i = j;
      continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (op) {
      if (op === '(') depth++;
      else if (op === ')') depth = Math.max(0, depth - 1);
      toks.push({ t: 'op', v: op, s: i, e: i + op.length });
      i += op.length;
      continue;
    }
    toks.push({ t: 'err', v: `Unexpected character '${c}'`, s: i, e: i + 1 });
    i++;
  }
  toks.push({ t: 'eof', s: n, e: n });
  return toks;
}

// ---- parser ---------------------------------------------------------------

export function parseProgram(src) {
  const toks = tokenize(src);
  let p = 0;
  const peek = (k = 0) => toks[Math.min(p + k, toks.length - 1)];
  const isOp = (v, k = 0) => peek(k).t === 'op' && peek(k).v === v;
  const fail = (tok, msg) => {
    if (tok.t === 'err') throw new NkError(tok.v, tok.s, tok.e);
    throw new NkError(msg, tok.s, Math.max(tok.e, tok.s + 1));
  };
  const expectOp = (v) => {
    if (!isOp(v)) fail(peek(), peek().t === 'eof' ? `Expected '${v}' before end of input` : `Expected '${v}'`);
    return toks[p++];
  };
  const isStmtEnd = () => peek().t === 'nl' || peek().t === 'eof' || isOp(';');

  function parsePrimary() {
    const tok = peek();
    if (tok.t === 'num') { p++; return { t: 'num', v: tok.v, s: tok.s, e: tok.e }; }
    if (tok.t === 'id') {
      p++;
      if (isOp('(')) {
        p++;
        const args = [];
        if (!isOp(')')) {
          for (;;) {
            args.push(parseExpr(0));
            if (isOp(',')) { p++; continue; }
            break;
          }
        }
        const close = expectOp(')');
        return { t: 'call', name: tok.v, args, s: tok.s, e: close.e };
      }
      return { t: 'var', name: tok.v, s: tok.s, e: tok.e };
    }
    if (isOp('(')) {
      // cast?  (type words...)
      let k = 1;
      const words = [];
      while (peek(k).t === 'id' && TYPE_WORDS.has(peek(k).v)) { words.push(peek(k).v); k++; }
      if (words.length && isOp(')', k)) {
        const open = toks[p];
        p += k + 1;
        const a = parseUnary();
        return { t: 'cast', type: words.join(' '), a, s: open.s, e: a.e };
      }
      const open = toks[p++];
      const inner = parseExpr(0);
      const close = expectOp(')');
      return { ...inner, ps: open.s, pe: close.e };
    }
    if (tok.t === 'eof' || tok.t === 'nl') fail(tok, 'Unexpected end of expression');
    fail(tok, `Unexpected '${tok.v ?? tok.t}'`);
  }

  function parsePostfix() {
    let a = parsePrimary();
    while (isOp('!') && !(peek(1).t === 'num' || peek(1).t === 'id' || isOp('(', 1))) {
      const t = toks[p++];
      a = { t: 'post', op: '!', a, s: a.ps ?? a.s, e: t.e };
    }
    return a;
  }

  function parseUnary() {
    const tok = peek();
    if (tok.t === 'op' && (tok.v === '-' || tok.v === '+' || tok.v === '~' || tok.v === '!')) {
      p++;
      const a = parseUnary();
      return { t: 'un', op: tok.v, a, s: tok.s, e: a.pe ?? a.e };
    }
    const base = parsePostfix();
    if (isOp('**')) {
      p++;
      const exp = parseUnary();
      return { t: 'bin', op: '**', a: base, b: exp, s: base.ps ?? base.s, e: exp.pe ?? exp.e };
    }
    return base;
  }

  function parseExpr(minPrec) {
    let a = parseUnary();
    for (;;) {
      const tok = peek();
      if (tok.t !== 'op') break;
      const prec = BIN_PREC[tok.v];
      if (prec === undefined || prec <= minPrec) break;
      p++;
      const b = parseExpr(prec);
      a = { t: 'bin', op: tok.v, a, b, s: a.ps ?? a.s, e: b.pe ?? b.e };
    }
    if (minPrec === 0 && isOp('?')) {
      p++;
      const x = parseExpr(0);
      expectOp(':');
      const y = parseExpr(0);
      a = { t: 'tern', c: a, a: x, b: y, s: a.ps ?? a.s, e: y.pe ?? y.e };
    }
    return a;
  }

  function parseStatement() {
    const tok = peek();
    if (tok.t === 'id' && peek(1).t === 'op' && ASSIGN_OPS.has(peek(1).v)) {
      const op = peek(1).v;
      p += 2;
      const a = parseExpr(0);
      return { t: 'assign', name: tok.v, op, a, s: tok.s, e: a.pe ?? a.e };
    }
    return parseExpr(0);
  }

  const stmts = [];
  while (peek().t !== 'eof') {
    if (peek().t === 'nl' || isOp(';')) { p++; continue; }
    const startTok = peek();
    try {
      const st = parseStatement();
      if (!isStmtEnd()) fail(peek(), `Unexpected '${peek().v ?? peek().t}'`);
      stmts.push(st);
    } catch (err) {
      if (!(err instanceof NkError)) throw err;
      // error recovery: skip to the end of this statement
      let endPos = err.end;
      while (!isStmtEnd()) { endPos = Math.max(endPos, peek().e); p++; }
      stmts.push({ t: 'error', msg: err.message, pos: err.pos, s: startTok.s, e: Math.max(endPos, startTok.e) });
    }
  }
  return stmts;
}

// Re-print an AST in canonical form (used for the "input interpretation" line).
export function printAst(node, fmtLit) {
  const pr = (n, parentPrec = 0) => {
    switch (n.t) {
      case 'num': return fmtLit ? fmtLit(n.v) : String(n.v.v);
      case 'var': return n.name;
      case 'call': return `${n.name}(${n.args.map((x) => pr(x)).join(', ')})`;
      case 'cast': return `(${n.type})${pr(n.a, 11)}`;
      case 'post': return `${pr(n.a, 13)}!`;
      case 'un': return `${n.op === '-' ? '−' : n.op}${pr(n.a, 11)}`;
      case 'assign': return `${n.name} ${n.op} ${pr(n.a)}`;
      case 'tern': {
        const s = `${pr(n.c, 1)} ? ${pr(n.a)} : ${pr(n.b)}`;
        return parentPrec > 0 ? `(${s})` : s;
      }
      case 'bin': {
        const prec = n.op === '**' ? 12 : BIN_PREC[n.op];
        const rightAssoc = n.op === '**';
        const l = pr(n.a, rightAssoc ? prec + 0.5 : prec);
        const r = pr(n.b, rightAssoc ? prec : prec + 0.5);
        const sym = { '*': '×', '-': '−', '/': '÷' }[n.op] || n.op;
        const s = n.op === '**' ? `${l}^${r}` : `${l} ${sym} ${r}`;
        return prec < parentPrec ? `(${s})` : s;
      }
      default: return '?';
    }
  };
  return pr(node);
}

export function lineOf(src, pos) {
  let line = 1;
  for (let i = 0; i < pos && i < src.length; i++) if (src[i] === '\n') line++;
  return line;
}
