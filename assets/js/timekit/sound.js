// TimeKit — synthesized cue sounds (Web Audio, no audio files).

let ctx = null, master = null;

// Browsers only allow audio after a user gesture: call this from click handlers.
export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(t0, freq, dur, { type = 'sine', gain = 0.3, attack = 0.006, glide } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (glide) o.frequency.exponentialRampToValueAtTime(glide, t0 + dur * 0.5);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

const SOUNDS = {
  chime: (t) => { tone(t, 880, 1.2, { gain: 0.22 }); tone(t + 0.14, 1318.5, 1.4, { gain: 0.18 }); tone(t + 0.28, 1760, 1.7, { gain: 0.1 }); },
  bell: (t) => { [[1, 0.28], [2, 0.11], [2.76, 0.07], [5.4, 0.035]].forEach(([r, g]) => tone(t, 523.25 * r, 2.8 / Math.sqrt(r), { gain: g })); },
  soft: (t) => { tone(t, 392, 1.1, { type: 'triangle', gain: 0.22, attack: 0.05 }); tone(t + 0.2, 587.33, 1.4, { type: 'triangle', gain: 0.18, attack: 0.05 }); },
  beep: (t) => { for (let i = 0; i < 3; i++) tone(t + i * 0.22, 1046.5, 0.12, { type: 'square', gain: 0.07 }); },
  alarm: (t) => { for (let i = 0; i < 8; i++) tone(t + i * 0.16, i % 2 ? 659.25 : 880, 0.13, { type: 'triangle', gain: 0.24 }); },
  rise: (t) => { tone(t, 330, 0.9, { type: 'sine', gain: 0.25, attack: 0.08, glide: 990 }); },
  tick: (t) => { tone(t, 1900, 0.05, { type: 'square', gain: 0.05, attack: 0.002 }); },
};

export const SOUND_OPTIONS = [
  ['chime', 'Chime'], ['bell', 'Bell'], ['soft', 'Soft'], ['rise', 'Rise'],
  ['beep', 'Beep'], ['alarm', 'Alarm'], ['tick', 'Tick'], ['none', 'Silent'],
];

export function play(name, volume = 0.7) {
  if (!SOUNDS[name] || volume <= 0 || !unlock()) return;
  master.gain.setValueAtTime(volume, ctx.currentTime);
  SOUNDS[name](ctx.currentTime + 0.02);
}
