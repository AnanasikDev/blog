// NumKit — number utilities: BigInt helpers, fixed-width wrapping, primes/factorization, IEEE-754.

export const mask = (bits) => (1n << BigInt(bits)) - 1n;

/** Wrap an arbitrary BigInt into `bits` bits, optionally reinterpreting as signed two's complement. */
export function wrap(v, bits, signed = false) {
  const b = BigInt(bits);
  let u = v & mask(bits);
  if (signed && b > 0n && u >> (b - 1n)) u -= 1n << b;
  return u;
}

export const absBig = (v) => (v < 0n ? -v : v);

/** Number of bits needed for a non-negative value (0 -> 0). */
export function bitLength(v) {
  if (v < 0n) v = -v;
  return v === 0n ? 0 : v.toString(2).length;
}

/** Minimal two's-complement width for a signed value (including the sign bit). */
export function signedBits(v) {
  return v < 0n ? bitLength(~v) + 1 : bitLength(v) + 1;
}

export function popcount(v) {
  let c = 0;
  for (const ch of v.toString(2)) if (ch === '1') c++;
  return c;
}

export function ctz(v) {
  if (v === 0n) return -1;
  let n = 0;
  while (!(v & 1n)) { v >>= 1n; n++; }
  return n;
}

export function group(str, n, sep = ' ') {
  if (n <= 0) return str;
  let neg = '';
  if (str[0] === '-') { neg = '-'; str = str.slice(1); }
  const out = [];
  for (let i = str.length; i > 0; i -= n) out.unshift(str.slice(Math.max(0, i - n), i));
  return neg + out.join(sep);
}

export function padBase(v, base, digits) {
  return v.toString(base).toUpperCase().padStart(digits, '0');
}

export function gcd(a, b) {
  a = absBig(a); b = absBig(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

export function isqrt(n) {
  if (n < 0n) throw new RangeError('isqrt of negative');
  if (n < 2n) return n;
  let x = BigInt(Math.floor(Math.sqrt(Number(n))));
  // Newton refine (handles values beyond double precision)
  for (;;) {
    const y = (x + n / x) >> 1n;
    if (y >= x) {
      while (x * x > n) x--;
      while ((x + 1n) * (x + 1n) <= n) x++;
      return x;
    }
    x = y;
  }
}

export function modpow(b, e, m) {
  let r = 1n;
  b %= m;
  while (e > 0n) {
    if (e & 1n) r = (r * b) % m;
    b = (b * b) % m;
    e >>= 1n;
  }
  return r;
}

const SMALL_PRIMES = (() => {
  const lim = 10000, sieve = new Uint8Array(lim + 1), out = [];
  for (let i = 2; i <= lim; i++) {
    if (sieve[i]) continue;
    out.push(BigInt(i));
    for (let j = i * i; j <= lim; j += i) sieve[j] = 1;
  }
  return out;
})();

const MR_BASES = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n, 41n];

/** Miller–Rabin. Deterministic below 3.3e24; beyond that it's a (very strong) probable-prime test. */
export function isPrime(n) {
  if (n < 2n) return false;
  for (const p of SMALL_PRIMES.slice(0, 40)) {
    if (n === p) return true;
    if (n % p === 0n) return false;
  }
  let d = n - 1n, s = 0;
  while (!(d & 1n)) { d >>= 1n; s++; }
  outer: for (const a of MR_BASES) {
    let x = modpow(a, d, n);
    if (x === 1n || x === n - 1n) continue;
    for (let r = 1; r < s; r++) {
      x = (x * x) % n;
      if (x === n - 1n) continue outer;
    }
    return false;
  }
  return true;
}
export const PRIME_CERTAIN_BELOW = 3317044064679887385961981n;

function rho(n, deadline) {
  if (!(n & 1n)) return 2n;
  for (let c = 1n; c < 50n; c++) {
    // Brent's variant
    let y = 2n, r = 1n, q = 1n, g = 1n, x = 0n, ys = 0n;
    const m = 64n;
    const f = (v) => (v * v + c) % n;
    while (g === 1n) {
      x = y;
      for (let i = 0n; i < r; i++) y = f(y);
      let k = 0n;
      while (k < r && g === 1n) {
        ys = y;
        const lim = m < r - k ? m : r - k;
        for (let i = 0n; i < lim; i++) {
          y = f(y);
          q = (q * absBig(x - y)) % n;
        }
        g = gcd(q, n);
        k += m;
      }
      r <<= 1n;
      if (Date.now() > deadline) return null;
    }
    if (g === n) {
      do { ys = f(ys); g = gcd(absBig(x - ys), n); } while (g === 1n);
    }
    if (g !== n) return g;
  }
  return null;
}

/**
 * Prime factorization of |n|. Returns { factors: [[p, e], ...] sorted, complete, leftover }.
 * `leftover` is an unfactored composite when the time budget ran out.
 */
export function factorize(n, budgetMs = 250) {
  n = absBig(n);
  const map = new Map();
  const add = (p, e = 1) => map.set(p, (map.get(p) || 0) + e);
  let leftover = [];
  if (n < 2n) return { factors: [], complete: true, leftover };
  for (const p of SMALL_PRIMES) {
    if (p * p > n) break;
    if (n % p === 0n) {
      let e = 0;
      while (n % p === 0n) { n /= p; e++; }
      add(p, e);
    }
  }
  const deadline = Date.now() + budgetMs;
  const stack = n > 1n ? [n] : [];
  while (stack.length) {
    const m = stack.pop();
    if (m === 1n) continue;
    if (isPrime(m)) { add(m); continue; }
    const s = isqrt(m);
    if (s * s === m) { stack.push(s, s); continue; }
    const d = rho(m, deadline);
    if (!d) { leftover.push(m); continue; }
    stack.push(d, m / d);
  }
  const factors = [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  return { factors, complete: leftover.length === 0, leftover };
}

export function divisorStats(factors) {
  let count = 1n, sigma = 1n;
  for (const [p, e] of factors) {
    count *= BigInt(e + 1);
    sigma *= (p ** BigInt(e + 1) - 1n) / (p - 1n);
  }
  return { count, sigma };
}

export function listDivisors(factors, limit = 4096) {
  const { count } = divisorStats(factors);
  if (count > BigInt(limit)) return null;
  let divs = [1n];
  for (const [p, e] of factors) {
    const next = [];
    for (const d of divs) {
      let pk = 1n;
      for (let k = 0; k <= e; k++) { next.push(d * pk); pk *= p; }
    }
    divs = next;
  }
  return divs.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

// ---- IEEE-754 ----------------------------------------------------------------

const dv = new DataView(new ArrayBuffer(8));

export function f32ToBits(x) { dv.setFloat32(0, x); return BigInt(dv.getUint32(0)); }
export function f64ToBits(x) { dv.setFloat64(0, x); return dv.getBigUint64(0); }
export function bitsToF32(b) { dv.setUint32(0, Number(b & 0xffffffffn)); return dv.getFloat32(0); }
export function bitsToF64(b) { dv.setBigUint64(0, b & mask(64)); return dv.getFloat64(0); }

export function bitsToF16(b) {
  const h = Number(b & 0xffffn);
  const s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 0x1f, m = h & 0x3ff;
  if (e === 0) return s * m * 2 ** -24;
  if (e === 31) return m ? NaN : s * Infinity;
  return s * (1 + m / 1024) * 2 ** (e - 15);
}

export function f16ToBits(x) {
  // round-to-nearest-even conversion via float32 bits
  const f = Number(f32ToBits(x));
  const sign = (f >>> 16) & 0x8000;
  const exp = (f >>> 23) & 0xff;
  let mant = f & 0x7fffff;
  if (exp === 0xff) return BigInt(sign | 0x7c00 | (mant ? 0x200 : 0));
  let e = exp - 127 + 15;
  if (e >= 31) return BigInt(sign | 0x7c00);
  if (e <= 0) {
    if (e < -10) return BigInt(sign);
    mant |= 0x800000;
    const shift = 14 - e;
    let hm = mant >> shift;
    const rem = mant & ((1 << shift) - 1), half = 1 << (shift - 1);
    if (rem > half || (rem === half && (hm & 1))) hm++;
    return BigInt(sign | hm);
  }
  let hm = mant >> 13;
  const rem = mant & 0x1fff;
  if (rem > 0x1000 || (rem === 0x1000 && (hm & 1))) hm++;
  let out = sign | (e << 10);
  out += hm; // carry into exponent is correct behaviour
  return BigInt(out);
}

export const FMT = {
  16: { bits: 16, eBits: 5, mBits: 10, bias: 15, name: 'half (binary16)' },
  32: { bits: 32, eBits: 8, mBits: 23, bias: 127, name: 'float (binary32)' },
  64: { bits: 64, eBits: 11, mBits: 52, bias: 1023, name: 'double (binary64)' },
};

export function floatToBits(x, p) { return p === 16 ? f16ToBits(x) : p === 32 ? f32ToBits(x) : f64ToBits(x); }
export function bitsToFloat(b, p) { return p === 16 ? bitsToF16(b) : p === 32 ? bitsToF32(b) : bitsToF64(b); }
export function roundTo(x, p) { return p === 16 ? bitsToF16(f16ToBits(x)) : p === 32 ? Math.fround(x) : x; }

export function decompose(bits, p) {
  const f = FMT[p];
  const sign = Number(bits >> BigInt(f.bits - 1)) & 1;
  const exp = Number((bits >> BigInt(f.mBits)) & mask(f.eBits));
  const mant = bits & mask(f.mBits);
  const emax = (1 << f.eBits) - 1;
  let cls;
  if (exp === emax) cls = mant ? (mant >> BigInt(f.mBits - 1) ? 'quiet NaN' : 'signaling NaN') : 'infinity';
  else if (exp === 0) cls = mant ? 'subnormal' : 'zero';
  else cls = 'normal';
  const unbiased = exp === 0 ? 1 - f.bias : exp - f.bias;
  return { sign, exp, mant, cls, unbiased, ...f };
}

/** Shortest decimal string that round-trips to x in the given precision. */
export function shortest(x, p = 64) {
  if (Number.isNaN(x)) return 'NaN';
  if (!Number.isFinite(x)) return x < 0 ? '-Infinity' : 'Infinity';
  if (Object.is(x, -0)) return '-0';
  if (p === 64) return String(x);
  for (let d = 1; d <= 17; d++) {
    const s = x.toPrecision(d);
    if (roundTo(Number(s), p) === x) return String(Number(s));
  }
  return String(x);
}

export function fmtFloat(x, p, digits) {
  if (!digits || !Number.isFinite(x)) return shortest(x, p);
  const s = x.toPrecision(Math.min(100, digits));
  return s;
}

/** C99 %a style hex-float string. */
export function hexFloat(x, p = 64) {
  if (Number.isNaN(x)) return 'nan';
  if (!Number.isFinite(x)) return x < 0 ? '-inf' : 'inf';
  const d = decompose(floatToBits(x, p), p);
  const sign = d.sign ? '-' : '';
  if (d.cls === 'zero') return `${sign}0x0p+0`;
  const nibbles = Math.ceil(d.mBits / 4);
  const m = d.mant << BigInt(nibbles * 4 - d.mBits);
  let hex = m.toString(16).padStart(nibbles, '0').replace(/0+$/, '');
  const lead = d.cls === 'subnormal' ? '0' : '1';
  const e = d.unbiased;
  return `${sign}0x${lead}${hex ? '.' + hex : ''}p${e >= 0 ? '+' : ''}${e}`;
}

/** Exact decimal expansion of the stored binary value. */
export function exactDecimal(x, p = 64) {
  if (!Number.isFinite(x)) return shortest(x, p);
  const d = decompose(floatToBits(x, p), p);
  if (d.cls === 'zero') return d.sign ? '-0' : '0';
  let m = d.mant;
  if (d.cls === 'normal') m |= 1n << BigInt(d.mBits);
  let e = d.unbiased - d.mBits; // value = m * 2^e
  let intStr, fracStr = '';
  if (e >= 0) intStr = (m << BigInt(e)).toString();
  else {
    const k = -e;
    const scaled = m * 5n ** BigInt(k); // m*2^-k = m*5^k / 10^k
    let s = scaled.toString().padStart(k + 1, '0');
    intStr = s.slice(0, s.length - k);
    fracStr = s.slice(s.length - k).replace(/0+$/, '');
  }
  return (d.sign ? '-' : '') + intStr + (fracStr ? '.' + fracStr : '');
}

export function nextFloat(x, p, dir) {
  if (Number.isNaN(x)) return NaN;
  const f = FMT[p];
  let b = floatToBits(x, p);
  if (x === 0) return dir > 0 ? bitsToFloat(1n, p) : -bitsToFloat(1n, p);
  const neg = x < 0;
  if ((dir > 0) !== neg) b += 1n; else b -= 1n;
  return bitsToFloat(b & mask(f.bits), p);
}

/** Best rational approximation with bounded denominator (continued fractions). */
export function toFraction(x, maxDen = 1e6) {
  if (!Number.isFinite(x) || Number.isInteger(x)) return null;
  let h1 = 1, h0 = 0, k1 = 0, k0 = 1, v = x;
  for (let i = 0; i < 40; i++) {
    const a = Math.floor(v);
    const h2 = a * h1 + h0, k2 = a * k1 + k0;
    if (k2 > maxDen) break;
    h0 = h1; h1 = h2; k0 = k1; k1 = k2;
    if (Math.abs(x - h1 / k1) <= Math.abs(x) * 1e-15) break;
    const frac = v - a;
    if (frac < 1e-12) break;
    v = 1 / frac;
  }
  return { num: h1, den: k1, err: x - h1 / k1 };
}

// ---- characters ----------------------------------------------------------------

export function cpName(cp) {
  const ctl = ['NUL', 'SOH', 'STX', 'ETX', 'EOT', 'ENQ', 'ACK', 'BEL', 'BS', 'TAB', 'LF', 'VT', 'FF', 'CR', 'SO', 'SI',
    'DLE', 'DC1', 'DC2', 'DC3', 'DC4', 'NAK', 'SYN', 'ETB', 'CAN', 'EM', 'SUB', 'ESC', 'FS', 'GS', 'RS', 'US'];
  if (cp < 32) return ctl[cp];
  if (cp === 32) return 'SP';
  if (cp === 127) return 'DEL';
  if (cp >= 0x80 && cp < 0xa0) return 'C1 control';
  if (cp >= 0xd800 && cp <= 0xdfff) return 'surrogate';
  return null;
}

export function printableChar(cp) {
  if (cp < 0 || cp > 0x10ffff) return null;
  if (cpName(cp) && cp !== 32) return null;
  if (cp === 32) return '␠';
  return String.fromCodePoint(cp);
}

export function cEscape(cp) {
  const map = { 0: '\\0', 7: '\\a', 8: '\\b', 9: '\\t', 10: '\\n', 11: '\\v', 12: '\\f', 13: '\\r', 39: "\\'", 92: '\\\\' };
  if (map[cp]) return `'${map[cp]}'`;
  if (cp >= 32 && cp < 127) return `'${String.fromCharCode(cp)}'`;
  if (cp < 0x100) return `'\\x${cp.toString(16).padStart(2, '0')}'`;
  if (cp < 0x10000) return `u'\\u${cp.toString(16).padStart(4, '0')}'`;
  return `U'\\U${cp.toString(16).padStart(8, '0')}'`;
}

export function utf8Bytes(cp) {
  if (cp < 0x80) return [cp];
  if (cp < 0x800) return [0xc0 | (cp >> 6), 0x80 | (cp & 63)];
  if (cp < 0x10000) return [0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63)];
  return [0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63)];
}

export function utf16Units(cp) {
  if (cp < 0x10000) return [cp];
  const v = cp - 0x10000;
  return [0xd800 | (v >> 10), 0xdc00 | (v & 0x3ff)];
}

/** Bytes of an unsigned value (already wrapped) in memory order. */
export function toBytes(u, nBytes, littleEndian) {
  const out = [];
  for (let i = 0; i < nBytes; i++) out.push(Number((u >> BigInt(8 * i)) & 0xffn));
  return littleEndian ? out : out.reverse();
}

export const hex2 = (b) => b.toString(16).toUpperCase().padStart(2, '0');
