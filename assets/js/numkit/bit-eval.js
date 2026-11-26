// NumKit — fixed-width unsigned evaluator for the bit playground.
// Every value is a BigInt in [0, 2^W). Each operator application is recorded as a "step".

import { NkError, parseProgram, lineOf } from './expr.js';
import * as U from './numutil.js';

export class BitEval {
  constructor(width = 32) {
    this.W = width;
    this.BW = BigInt(width);
    this.M = U.mask(width);
    this.env = new Map();
    this.steps = null;
    this.warnings = null;
  }

  w(v) { return v & this.M; }
  signed(v) { return U.wrap(v, this.W, true); }

  record(n, v, kind) {
    if (this.steps) this.steps.push({ s: n.s, e: n.e, v, kind });
    return v;
  }

  shiftCount(y, n) {
    if (y >= this.BW) {
      this.warnings?.push(`shift by ${y} ≥ width ${this.W} (undefined in C; shown as 0 here)`);
      return null;
    }
    return y;
  }

  binop(op, x, y, n) {
    switch (op) {
      case '+': return this.w(x + y);
      case '-': return this.w(x - y);
      case '*': return this.w(x * y);
      case '/': if (!y) throw new NkError('Division by zero', n?.s, n?.e); return x / y;
      case '%': if (!y) throw new NkError('Modulo by zero', n?.s, n?.e); return x % y;
      case '**': {
        let r = 1n, b = x, e = y;
        while (e > 0n) { if (e & 1n) r = this.w(r * b); b = this.w(b * b); e >>= 1n; }
        return r;
      }
      case '&': return x & y;
      case '|': return x | y;
      case '^': return x ^ y;
      case '<<': { const k = this.shiftCount(y, n); return k === null ? 0n : this.w(x << k); }
      case '>>':
      case '>>>': { const k = this.shiftCount(y, n); return k === null ? 0n : x >> k; }
      case '==': return x === y ? 1n : 0n;
      case '!=': return x !== y ? 1n : 0n;
      case '<': return x < y ? 1n : 0n;
      case '<=': return x <= y ? 1n : 0n;
      case '>': return x > y ? 1n : 0n;
      case '>=': return x >= y ? 1n : 0n;
      case '&&': return x && y ? 1n : 0n;
      case '||': return x || y ? 1n : 0n;
    }
    throw new NkError(`Unknown operator ${op}`, n?.s, n?.e);
  }

  rot(v, k) {
    const W = this.BW;
    k = ((k % W) + W) % W;
    return k ? this.w((v << k) | (v >> (W - k))) : v;
  }

  call(n) {
    const name = n.name;
    // bits(<float literal>) — the only place floats are allowed
    if (name === 'bits' || name === 'fbits') {
      const a = n.args[0];
      let x;
      if (a?.t === 'num' && a.v.kind === 'float') x = a.v;
      else if (a?.t === 'un' && a.op === '-' && a.a.t === 'num' && a.a.v.kind === 'float') x = { ...a.a.v, v: -a.a.v.v };
      else throw new NkError('bits() takes a float literal, e.g. bits(1.5f)', n.s, n.e);
      const p = this.W >= 64 ? (x.prec === 32 ? 32 : 64) : this.W >= 32 ? 32 : 16;
      return this.w(U.floatToBits(x.v, p));
    }
    const args = n.args.map((x) => this.eval(x));
    const need = (lo, hi = lo) => {
      if (args.length < lo || args.length > hi) {
        throw new NkError(`${name}() takes ${lo === hi ? lo : `${lo}–${hi}`} argument(s)`, n.s, n.e);
      }
    };
    const [a, b, c, d] = args;
    switch (name) {
      case 'popcount': need(1); return BigInt(U.popcount(a));
      case 'parity': need(1); return BigInt(U.popcount(a) & 1);
      case 'clz': need(1); return BigInt(this.W - U.bitLength(a));
      case 'ctz': need(1); return a === 0n ? this.BW : BigInt(U.ctz(a));
      case 'bitlen': need(1); return BigInt(U.bitLength(a));
      case 'rotl': need(2); return this.rot(a, b);
      case 'rotr': need(2); return this.rot(a, -b);
      case 'bswap': {
        need(1);
        const bytes = U.toBytes(a, this.W / 8, true);
        return bytes.reduce((acc, x) => (acc << 8n) | BigInt(x), 0n);
      }
      case 'rev': {
        need(1);
        return BigInt('0b' + [...a.toString(2).padStart(this.W, '0')].reverse().join(''));
      }
      case 'bit': need(1); return a < this.BW ? 1n << a : 0n;
      case 'mask': need(1); return a >= this.BW ? this.M : U.mask(Number(a));
      case 'sar': {
        need(2);
        const k = b >= this.BW ? this.BW - 1n : b;
        return this.w(this.signed(a) >> k);
      }
      case 'sext': need(2); return this.w(U.wrap(a, Number(b), true));
      case 'extract': need(3); return (a >> b) & U.mask(Number(c));
      case 'insert': {
        need(4); // insert(dst, value, offset, width)
        const m = U.mask(Number(d)) << c;
        return this.w((a & ~m) | ((b << c) & m));
      }
      case 'setbit': need(2); return this.w(a | (1n << b));
      case 'clrbit': need(2); return this.w(a & ~(1n << b));
      case 'togglebit': need(2); return this.w(a ^ (1n << b));
      case 'testbit': need(2); return (a >> b) & 1n;
      case 'min': need(2, 99); return args.reduce((m, x) => (x < m ? x : m));
      case 'max': need(2, 99); return args.reduce((m, x) => (x > m ? x : m));
      case 'smin': need(2, 99); return args.reduce((m, x) => (this.signed(x) < this.signed(m) ? x : m));
      case 'smax': need(2, 99); return args.reduce((m, x) => (this.signed(x) > this.signed(m) ? x : m));
      case 'abs': need(1); return this.w(U.absBig(this.signed(a)));
      case 'sdiv': need(2); if (!b) throw new NkError('Division by zero', n.s, n.e); return this.w(this.signed(a) / this.signed(b));
      case 'smod': need(2); if (!b) throw new NkError('Modulo by zero', n.s, n.e); return this.w(this.signed(a) % this.signed(b));
      case 'lowbit': need(1); return a & this.w(-a);
      case 'pow2ceil': {
        need(1);
        if (a <= 1n) return 1n;
        const k = U.bitLength(a - 1n);
        return k >= this.W ? 0n : 1n << BigInt(k);
      }
    }
    throw new NkError(`Unknown function '${name}'`, n.s, n.s + name.length);
  }

  eval(n) {
    switch (n.t) {
      case 'num': {
        if (n.v.kind === 'float') throw new NkError('Floats are not values here — use bits(1.5f) for IEEE bits', n.s, n.e);
        return this.record(n, this.w(n.v.v), 'lit');
      }
      case 'var': {
        if (this.env.has(n.name)) return this.record(n, this.env.get(n.name), 'var');
        const c = { true: 1n, false: 0n, WIDTH: this.BW, ALL: this.M }[n.name];
        if (c !== undefined) return this.record(n, c, 'lit');
        throw new NkError(`Unknown variable '${n.name}'`, n.s, n.e);
      }
      case 'un': {
        const a = this.eval(n.a);
        let v;
        if (n.op === '~') v = this.w(~a);
        else if (n.op === '-') v = this.w(-a);
        else if (n.op === '+') v = a;
        else v = a ? 0n : 1n;
        return this.record(n, v, 'op');
      }
      case 'post': throw new NkError('Factorial is not available in the bit playground', n.s, n.e);
      case 'bin': {
        if (n.op === '&&' || n.op === '||') {
          const a = this.eval(n.a);
          if (n.op === '&&' && !a) return this.record(n, 0n, 'op');
          if (n.op === '||' && a) return this.record(n, 1n, 'op');
          return this.record(n, this.eval(n.b) ? 1n : 0n, 'op');
        }
        const a = this.eval(n.a), b = this.eval(n.b);
        return this.record(n, this.binop(n.op, a, b, n), 'op');
      }
      case 'tern': {
        const c = this.eval(n.c);
        return this.record(n, c ? this.eval(n.a) : this.eval(n.b), 'op');
      }
      case 'cast': {
        const a = this.eval(n.a);
        const m = /(8|16|32|64)/.exec(n.type);
        const bits = m ? Number(m[1]) : { char: 8, uchar: 8, byte: 8, short: 16, ushort: 16, int: 32, uint: 32, unsigned: 32, long: 64, ulong: 64, size_t: 64 }[n.type.split(' ').pop()];
        if (!bits) throw new NkError(`Cast to '${n.type}' not supported here`, n.s, n.e);
        const signed = !/^(u|unsigned|uchar|ushort|uint|ulong|size_t|byte)/.test(n.type);
        return this.record(n, this.w(U.wrap(a, bits, signed)), 'op');
      }
      case 'call': return this.record(n, this.call(n), 'op');
      case 'error': throw new NkError(n.msg, n.pos, n.e);
    }
    throw new NkError(`Cannot evaluate ${n.t}`, n.s, n.e);
  }

  /** Run a program; one result per statement, with before/after values and the op trace. */
  run(src) {
    const stmts = parseProgram(src);
    const out = [];
    for (const st of stmts) {
      const res = { stmt: st, line: lineOf(src, st.s), src: src.slice(st.s, st.e), steps: [], warnings: [] };
      this.steps = res.steps;
      this.warnings = res.warnings;
      try {
        if (st.t === 'error') throw new NkError(st.msg, st.pos, st.e);
        if (st.t === 'assign') {
          res.name = st.name;
          res.before = this.env.get(st.name);
          let v = this.eval(st.a);
          if (st.op !== '=') {
            if (res.before === undefined) throw new NkError(`'${st.name}' is not defined yet`, st.s, st.s + st.name.length);
            v = this.binop(st.op.slice(0, -1), res.before, v, st);
          }
          this.env.set(st.name, v);
          res.value = v;
        } else {
          res.value = this.eval(st);
        }
      } catch (err) {
        if (!(err instanceof NkError)) throw err;
        res.error = err;
      }
      out.push(res);
    }
    this.steps = this.warnings = null;
    return out;
  }
}
