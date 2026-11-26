// NumKit — calculator evaluator.
// Values: { k: 'i', v: BigInt }  (exact, arbitrary precision)
//         { k: 'f', v: number, p: 16|32|64 }  (IEEE float; p tracks C-style float/double promotion)

import { NkError, parseProgram } from './expr.js';
import * as U from './numutil.js';

export const I = (v) => ({ k: 'i', v });
export const F = (v, p = 64) => ({ k: 'f', v: U.roundTo(v, p), p });
const num = (x) => (x.k === 'i' ? Number(x.v) : x.v);
const precOf = (...xs) => Math.max(0, ...xs.map((x) => (x.k === 'f' ? x.p : 0))) || 64;

export const CTYPES = {
  'half': 'f16', 'f16': 'f16', 'float': 'f32', 'f32': 'f32', 'double': 'f64', 'f64': 'f64', 'long double': 'f64', 'bool': 'bool',
  'char': [8, 1], 'signed char': [8, 1], 'schar': [8, 1], 'sbyte': [8, 1], 'i8': [8, 1], 'int8_t': [8, 1],
  'unsigned char': [8, 0], 'uchar': [8, 0], 'byte': [8, 0], 'u8': [8, 0], 'uint8_t': [8, 0], 'char8_t': [8, 0],
  'short': [16, 1], 'short int': [16, 1], 'signed short': [16, 1], 'i16': [16, 1], 'int16_t': [16, 1],
  'unsigned short': [16, 0], 'ushort': [16, 0], 'u16': [16, 0], 'uint16_t': [16, 0],
  'wchar': [16, 0], 'wchar_t': [16, 0], 'char16_t': [16, 0],
  'int': [32, 1], 'signed': [32, 1], 'signed int': [32, 1], 'i32': [32, 1], 'int32_t': [32, 1],
  'unsigned': [32, 0], 'unsigned int': [32, 0], 'uint': [32, 0], 'u32': [32, 0], 'uint32_t': [32, 0], 'char32_t': [32, 0],
  'long': [64, 1], 'long int': [64, 1], 'long long': [64, 1], 'long long int': [64, 1], 'i64': [64, 1], 'int64_t': [64, 1], 'ssize_t': [64, 1], 'ptrdiff_t': [64, 1],
  'unsigned long': [64, 0], 'unsigned long long': [64, 0], 'ulong': [64, 0], 'u64': [64, 0], 'uint64_t': [64, 0], 'size_t': [64, 0],
};

const CONSTS = {
  pi: () => F(Math.PI), e: () => F(Math.E), tau: () => F(2 * Math.PI), phi: () => F((1 + Math.sqrt(5)) / 2),
  inf: () => F(Infinity), infinity: () => F(Infinity), nan: () => F(NaN),
  true: () => I(1n), false: () => I(0n),
  INT8_MAX: () => I(127n), INT8_MIN: () => I(-128n), UINT8_MAX: () => I(255n),
  INT16_MAX: () => I(32767n), INT16_MIN: () => I(-32768n), UINT16_MAX: () => I(65535n),
  INT32_MAX: () => I(2147483647n), INT32_MIN: () => I(-2147483648n), UINT32_MAX: () => I(4294967295n),
  INT64_MAX: () => I((1n << 63n) - 1n), INT64_MIN: () => I(-(1n << 63n)), UINT64_MAX: () => I((1n << 64n) - 1n),
  FLT_MAX: () => F(3.4028234663852886e38, 32), FLT_MIN: () => F(1.1754943508222875e-38, 32), FLT_EPSILON: () => F(2 ** -23, 32),
  DBL_MAX: () => F(Number.MAX_VALUE), DBL_MIN: () => F(2.2250738585072014e-308), DBL_EPSILON: () => F(Number.EPSILON),
};

function toInt(x, what = 'value') {
  if (x.k === 'i') return x.v;
  if (!Number.isFinite(x.v)) throw new NkError(`Cannot convert ${x.v} to an integer (${what})`);
  return BigInt(Math.trunc(x.v));
}

function needInt(x, fname) {
  if (x.k !== 'i') {
    if (Number.isInteger(x.v)) return BigInt(x.v);
    throw new NkError(`${fname}() needs an integer — wrap with trunc() or (int)`);
  }
  return x.v;
}

const floatFn = (fn) => ({ n: [1, 1], f: ([a]) => F(fn(num(a)), a.k === 'f' ? a.p : 64) });
const float2 = (fn) => ({ n: [2, 2], f: ([a, b]) => F(fn(num(a), num(b)), precOf(a, b)) });
const roundFn = (fn) => ({
  n: [1, 1],
  f: ([a]) => {
    if (a.k === 'i') return a;
    const r = fn(a.v);
    return Number.isFinite(r) ? I(BigInt(r)) : F(r, a.p);
  },
});

function factorial(n) {
  if (n < 0n) throw new NkError('Factorial of a negative number');
  if (n > 5000n) throw new NkError('Factorial argument too large (max 5000)');
  let r = 1n;
  for (let i = 2n; i <= n; i++) r *= i;
  return r;
}

export function makeFunctions(cfg) {
  const W = () => cfg.width;
  const uw = (v) => U.wrap(v, W());
  return {
    sqrt: floatFn(Math.sqrt), cbrt: floatFn(Math.cbrt), exp: floatFn(Math.exp), exp2: floatFn((x) => 2 ** x),
    ln: floatFn(Math.log), log2: floatFn(Math.log2), log10: floatFn(Math.log10),
    log: { n: [1, 2], f: ([a, b]) => (b ? F(Math.log(num(a)) / Math.log(num(b)), precOf(a, b)) : F(Math.log(num(a)), precOf(a))) },
    sin: floatFn(Math.sin), cos: floatFn(Math.cos), tan: floatFn(Math.tan),
    asin: floatFn(Math.asin), acos: floatFn(Math.acos), atan: floatFn(Math.atan),
    sinh: floatFn(Math.sinh), cosh: floatFn(Math.cosh), tanh: floatFn(Math.tanh),
    atan2: float2(Math.atan2), hypot: float2(Math.hypot), fmod: float2((a, b) => a % b),
    deg: floatFn((x) => (x * 180) / Math.PI), rad: floatFn((x) => (x * Math.PI) / 180),
    pow: { n: [2, 2], f: ([a, b], ev) => ev.binop('**', a, b) },
    floor: roundFn(Math.floor), ceil: roundFn(Math.ceil), trunc: roundFn(Math.trunc),
    round: roundFn((x) => Math.sign(x) * Math.round(Math.abs(x))),
    abs: { n: [1, 1], f: ([a]) => (a.k === 'i' ? I(U.absBig(a.v)) : F(Math.abs(a.v), a.p)) },
    sign: { n: [1, 1], f: ([a]) => (a.k === 'i' ? I(a.v > 0n ? 1n : a.v < 0n ? -1n : 0n) : F(Math.sign(a.v), a.p)) },
    min: { n: [1, 99], f: (xs) => xs.reduce((m, x) => (num(x) < num(m) ? x : m)) },
    max: { n: [1, 99], f: (xs) => xs.reduce((m, x) => (num(x) > num(m) ? x : m)) },
    gcd: { n: [2, 99], f: (xs) => I(xs.map((x) => needInt(x, 'gcd')).reduce(U.gcd)) },
    lcm: {
      n: [2, 99],
      f: (xs) => I(xs.map((x) => needInt(x, 'lcm')).reduce((a, b) => (a === 0n || b === 0n ? 0n : U.absBig(a * b) / U.gcd(a, b)))),
    },
    isqrt: { n: [1, 1], f: ([a]) => I(U.isqrt(needInt(a, 'isqrt'))) },
    fact: { n: [1, 1], f: ([a]) => I(factorial(needInt(a, 'fact'))) },
    factorial: { n: [1, 1], f: ([a]) => I(factorial(needInt(a, 'factorial'))) },
    ncr: {
      n: [2, 2],
      f: ([a, b]) => {
        const n = needInt(a, 'ncr'), k = needInt(b, 'ncr');
        if (k < 0n || k > n) return I(0n);
        let r = 1n;
        const kk = k < n - k ? k : n - k;
        for (let i = 1n; i <= kk; i++) r = (r * (n - kk + i)) / i;
        return I(r);
      },
    },
    isprime: { n: [1, 1], f: ([a]) => I(U.isPrime(needInt(a, 'isprime')) ? 1n : 0n) },
    // ---- bit helpers (use the configured integer width) ----
    popcount: { n: [1, 1], f: ([a]) => I(BigInt(U.popcount(uw(needInt(a, 'popcount'))))) },
    clz: { n: [1, 2], f: ([a, w]) => { const ww = w ? Number(needInt(w, 'clz')) : W(); return I(BigInt(ww - U.bitLength(U.wrap(needInt(a, 'clz'), ww)))); } },
    ctz: { n: [1, 1], f: ([a]) => { const v = uw(needInt(a, 'ctz')); return I(v === 0n ? BigInt(W()) : BigInt(U.ctz(v))); } },
    bitlen: { n: [1, 1], f: ([a]) => I(BigInt(U.bitLength(needInt(a, 'bitlen')))) },
    bit: { n: [1, 1], f: ([a]) => I(1n << needInt(a, 'bit')) },
    mask: { n: [1, 1], f: ([a]) => I(U.mask(Number(needInt(a, 'mask')))) },
    bswap: {
      n: [1, 2],
      f: ([a, b]) => {
        const nb = b ? Number(needInt(b, 'bswap')) : W() / 8;
        const bytes = U.toBytes(U.wrap(needInt(a, 'bswap'), nb * 8), nb, true);
        return I(bytes.reduce((acc, x) => (acc << 8n) | BigInt(x), 0n));
      },
    },
    rotl: { n: [2, 3], f: ([a, n, w]) => I(rot(needInt(a, 'rotl'), needInt(n, 'rotl'), w ? Number(needInt(w, 'rotl')) : W())) },
    rotr: { n: [2, 3], f: ([a, n, w]) => I(rot(needInt(a, 'rotr'), -needInt(n, 'rotr'), w ? Number(needInt(w, 'rotr')) : W())) },
    rev: {
      n: [1, 2],
      f: ([a, w]) => {
        const ww = w ? Number(needInt(w, 'rev')) : W();
        const s = U.wrap(needInt(a, 'rev'), ww).toString(2).padStart(ww, '0');
        return I(BigInt('0b' + [...s].reverse().join('')));
      },
    },
    sext: { n: [2, 2], f: ([a, b]) => I(U.wrap(needInt(a, 'sext'), Number(needInt(b, 'sext')), true)) },
    extract: {
      n: [3, 3],
      f: ([a, off, w]) => I((needInt(a, 'extract') >> needInt(off, 'extract')) & U.mask(Number(needInt(w, 'extract')))),
    },
    // ---- reinterpretation ----
    bits: {
      n: [1, 1],
      f: ([a]) => {
        if (a.k === 'i') throw new NkError('bits() expects a float, e.g. bits(1.5f) or bits(0.1)');
        return I(U.floatToBits(a.v, a.p));
      },
    },
    asfloat: { n: [1, 1], f: ([a]) => F(U.bitsToF32(U.wrap(needInt(a, 'asfloat'), 32)), 32) },
    asdouble: { n: [1, 1], f: ([a]) => F(U.bitsToF64(U.wrap(needInt(a, 'asdouble'), 64)), 64) },
    ashalf: { n: [1, 1], f: ([a]) => F(U.bitsToF16(U.wrap(needInt(a, 'ashalf'), 16)), 16) },
    float: { n: [1, 1], f: ([a]) => F(num(a), 32) },
    double: { n: [1, 1], f: ([a]) => F(num(a), 64) },
    half: { n: [1, 1], f: ([a]) => F(num(a), 16) },
    int: { n: [1, 1], f: ([a]) => I(toInt(a)) },
  };
}

function rot(v, n, w) {
  const W = BigInt(w);
  const u = U.wrap(v, w);
  let k = ((n % W) + W) % W;
  if (k === 0n) return u;
  return U.wrap((u << k) | (u >> (W - k)), w);
}

export class CalcEval {
  constructor(cfg = {}) {
    this.cfg = { width: 32, intDiv: 'exact', ...cfg };
    this.env = new Map();
    this.fns = makeFunctions(this.cfg);
  }

  binop(op, a, b) {
    if (a.k === 'i' && b.k === 'i') {
      const x = a.v, y = b.v;
      switch (op) {
        case '+': return I(x + y);
        case '-': return I(x - y);
        case '*': return I(x * y);
        case '/':
          if (y === 0n) throw new NkError('Integer division by zero');
          if (this.cfg.intDiv === 'c' || x % y === 0n) return I(x / y);
          return F(Number(x) / Number(y));
        case '%':
          if (y === 0n) throw new NkError('Integer modulo by zero');
          return I(x % y);
        case '**':
          if (y < 0n) return F(Number(x) ** Number(y));
          if (U.bitLength(x) * Number(y) > 2_000_000) throw new NkError('Result too large');
          return I(x ** y);
        case '&': return I(x & y);
        case '|': return I(x | y);
        case '^': return I(x ^ y);
        case '<<':
          if (y > 100_000n) throw new NkError('Shift too large');
          return I(y < 0n ? x >> -y : x << y);
        case '>>': return I(y < 0n ? x << -y : x >> y);
        case '>>>': return I(U.wrap(x, this.cfg.width) >> y);
        case '==': return I(x === y ? 1n : 0n);
        case '!=': return I(x !== y ? 1n : 0n);
        case '<': return I(x < y ? 1n : 0n);
        case '<=': return I(x <= y ? 1n : 0n);
        case '>': return I(x > y ? 1n : 0n);
        case '>=': return I(x >= y ? 1n : 0n);
      }
    }
    if (['&', '|', '^', '<<', '>>', '>>>'].includes(op)) {
      throw new NkError(`Bitwise '${op}' needs integers — use (int)x, trunc(x) or bits(x)`);
    }
    const p = precOf(a, b);
    const x = U.roundTo(num(a), p), y = U.roundTo(num(b), p);
    switch (op) {
      case '+': return F(x + y, p);
      case '-': return F(x - y, p);
      case '*': return F(x * y, p);
      case '/': return F(x / y, p);
      case '%': return F(x % y, p);
      case '**': return F(x ** y, p);
      case '==': return I(x === y ? 1n : 0n);
      case '!=': return I(x !== y ? 1n : 0n);
      case '<': return I(x < y ? 1n : 0n);
      case '<=': return I(x <= y ? 1n : 0n);
      case '>': return I(x > y ? 1n : 0n);
      case '>=': return I(x >= y ? 1n : 0n);
    }
    throw new NkError(`Unknown operator ${op}`);
  }

  cast(type, a) {
    const t = CTYPES[type];
    if (!t) throw new NkError(`Unknown type '${type}'`);
    if (t === 'f16') return F(num(a), 16);
    if (t === 'f32') return F(num(a), 32);
    if (t === 'f64') return F(num(a), 64);
    if (t === 'bool') return I(num(a) !== 0 ? 1n : 0n);
    return I(U.wrap(toInt(a, `(${type}) cast`), t[0], !!t[1]));
  }

  truthy(x) { return x.k === 'i' ? x.v !== 0n : x.v !== 0 && !Number.isNaN(x.v); }

  eval(n) {
    try {
      return this._eval(n);
    } catch (err) {
      if (err instanceof NkError && err.pos < 0) { err.pos = n.s; err.end = n.e; }
      throw err;
    }
  }

  _eval(n) {
    switch (n.t) {
      case 'num': return n.v.kind === 'int' ? I(n.v.v) : F(n.v.v, n.v.prec);
      case 'var': {
        if (this.env.has(n.name)) return this.env.get(n.name);
        if (CONSTS[n.name]) return CONSTS[n.name]();
        throw new NkError(`Unknown variable '${n.name}'`, n.s, n.e);
      }
      case 'assign': {
        let v = this.eval(n.a);
        if (n.op !== '=') {
          if (!this.env.has(n.name)) throw new NkError(`'${n.name}' is not defined yet`, n.s, n.s + n.name.length);
          v = this.binop(n.op.slice(0, -1), this.env.get(n.name), v);
        }
        this.env.set(n.name, v);
        return v;
      }
      case 'un': {
        const a = this.eval(n.a);
        switch (n.op) {
          case '-': return a.k === 'i' ? I(-a.v) : F(-a.v, a.p);
          case '+': return a;
          case '!': return I(this.truthy(a) ? 0n : 1n);
          case '~':
            if (a.k !== 'i') throw new NkError("'~' needs an integer — use (int)x or bits(x)", n.s, n.e);
            return I(~a.v);
        }
        break;
      }
      case 'post': {
        const a = this.eval(n.a);
        return I(factorial(needInt(a, 'factorial')));
      }
      case 'bin': {
        if (n.op === '&&') return I(this.truthy(this.eval(n.a)) && this.truthy(this.eval(n.b)) ? 1n : 0n);
        if (n.op === '||') return I(this.truthy(this.eval(n.a)) || this.truthy(this.eval(n.b)) ? 1n : 0n);
        const a = this.eval(n.a), b = this.eval(n.b);
        try {
          return this.binop(n.op, a, b);
        } catch (err) {
          if (err instanceof NkError && err.pos < 0) { err.pos = n.s; err.end = n.e; }
          throw err;
        }
      }
      case 'tern': return this.truthy(this.eval(n.c)) ? this.eval(n.a) : this.eval(n.b);
      case 'cast': return this.cast(n.type, this.eval(n.a));
      case 'call': {
        const fn = this.fns[n.name];
        if (!fn) throw new NkError(`Unknown function '${n.name}'`, n.s, n.s + n.name.length);
        const [lo, hi] = fn.n;
        if (n.args.length < lo || n.args.length > hi) {
          throw new NkError(`${n.name}() takes ${lo === hi ? lo : `${lo}–${hi}`} argument${hi > 1 ? 's' : ''}`, n.s, n.e);
        }
        const args = n.args.map((x) => this.eval(x));
        return fn.f(args, this);
      }
      case 'error': throw new NkError(n.msg, n.pos, n.e);
    }
    throw new NkError(`Cannot evaluate node ${n.t}`, n.s, n.e);
  }

  /** Evaluate a whole program; returns { value, last, assigned, error } */
  run(src) {
    const stmts = parseProgram(src);
    let value = null, last = null;
    const assigned = [];
    for (const st of stmts) {
      if (st.t === 'error') return { error: new NkError(st.msg, st.pos, st.e), stmts };
      try {
        value = this.eval(st);
        last = st;
        if (st.t === 'assign') assigned.push(st.name);
      } catch (err) {
        if (err instanceof NkError) return { error: err, stmts };
        throw err;
      }
    }
    if (value) this.env.set('ans', value);
    return { value, last, assigned, stmts };
  }
}

export const FUNCTION_NAMES = Object.keys(makeFunctions({ width: 32 }));
