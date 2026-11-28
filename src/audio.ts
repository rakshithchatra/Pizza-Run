// All sound is synthesised, so there are no audio files to ship or license.
let ctx: AudioContext | undefined;
let muted = false;

function tone(from: number, dur: number, type: OscillatorType, vol: number, to = from, delay = 0) {
  if (muted || !ctx) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator(), gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur);
}

export const sfx = {
  /** Browsers only allow audio after a tap or key press, so call this from one. */
  unlock() { ctx ??= new AudioContext(); void ctx.resume(); },
  setMuted(m: boolean) { muted = m; },
  /** n = how many in a row, so a trail climbs in pitch. */
  // Plays several times a second, so it is deliberately soft: quiet, round, and a short pentatonic climb that loops.
  pickup(n: number) { tone(523 * 2 ** ([0, 2, 4, 7, 9][n % 5] / 12), 0.07, 'sine', 0.05); },
  pie() { [660, 990, 1320].forEach((f, i) => tone(f, 0.12, 'triangle', 0.14, f, i * 0.08)); },
  power() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, 'square', 0.06, f, i * 0.07)); },
  jump() { tone(280, 0.14, 'sine', 0.07, 520); },
  slide() { tone(200, 0.16, 'sine', 0.06, 110); },
  stumble() { tone(180, 0.22, 'square', 0.09, 70); },
  crash() { tone(220, 0.3, 'sawtooth', 0.14, 40); tone(90, 0.3, 'square', 0.1, 30); tone(520, 0.9, 'sine', 0.07, 110, 0.95); }, // thud, then a slide whistle as the slice slips down
};
