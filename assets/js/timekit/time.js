// TimeKit — parsing and formatting of durations (milliseconds, may be negative).

const UNIT_RE = /(\d*\.?\d+)\s*(msec|ms|secs?|s|mins?|m|hrs?|h|days?|d)/g;
const unitMs = (u) => (u.startsWith('ms') ? 1 : u[0] === 's' ? 1000 : u[0] === 'm' ? 60000 : u[0] === 'h' ? 3600000 : 86400000);

// Accepts "5:00", "1:02:03.5", "90" (seconds), "1h 30m", "2m10s", "250ms", "-10s", "−1:00".
export function parseDuration(input) {
  let s = String(input).trim().toLowerCase().replace(/[−–—]/g, '-').replace(/,/g, '.');
  let sign = 1;
  if (s[0] === '-' || s[0] === '+') { if (s[0] === '-') sign = -1; s = s.slice(1).trim(); }
  if (!s) return NaN;

  let ms;
  if (s.includes(':')) {
    const parts = s.split(':').map((p) => p.trim());
    if (parts.length > 4) return NaN;
    for (let i = 0; i < parts.length; i++) {
      const ok = i === parts.length - 1 ? /^(\d+\.?\d*|\.\d+)$/.test(parts[i]) : /^\d+$/.test(parts[i]);
      if (!ok) return NaN;
    }
    const mult = [1000, 60000, 3600000, 86400000];
    ms = parts.reverse().reduce((acc, p, i) => acc + Number(p) * mult[i], 0);
  } else if (/^(\d+\.?\d*|\.\d+)$/.test(s)) {
    ms = Number(s) * 1000;
  } else {
    if (s.replace(UNIT_RE, '').trim() !== '') return NaN;
    ms = 0;
    for (const m of s.matchAll(UNIT_RE)) ms += Number(m[1]) * unitMs(m[2]);
  }
  return Number.isFinite(ms) ? sign * ms : NaN;
}

const p2 = (n) => String(n).padStart(2, '0');

// Split into display parts. Values are truncated toward zero at the given precision (0–3 decimals).
export function fmt(ms, prec = 2, forceHours = false) {
  const neg = ms < 0;
  const unit = 10 ** (3 - prec);
  const a = Math.floor(Math.abs(ms) / unit + 1e-9) * unit;
  const hh = Math.floor(a / 3600000), mm = Math.floor(a / 60000) % 60, ss = Math.floor(a / 1000) % 60;
  const f = Math.round(a % 1000);
  return {
    sign: neg && a > 0 ? '−' : '',
    main: (hh || forceHours ? `${hh}:${p2(mm)}` : p2(mm)) + ':' + p2(ss),
    frac: prec ? '.' + String(f).padStart(3, '0').slice(0, prec) : '',
  };
}

// Editable text form: full millisecond precision, trailing zeros dropped ("05:00", "-00:01.25").
export function fmtShort(ms) {
  const p = fmt(ms, 3);
  const frac = p.frac.replace(/0+$/, '').replace(/\.$/, '');
  return (p.sign ? '-' : '') + p.main + frac;
}

// Human countdown text: "45s", "3m 05s", "1h 02m".
export function human(ms) {
  const t = Math.ceil(Math.abs(ms) / 1000);
  const hh = Math.floor(t / 3600), mm = Math.floor(t / 60) % 60, ss = t % 60;
  if (hh) return `${hh}h ${p2(mm)}m`;
  if (mm) return `${mm}m ${p2(ss)}s`;
  return `${ss}s`;
}
