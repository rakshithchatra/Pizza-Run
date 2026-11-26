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
  pickup(n: number) { tone(660 * 2 ** (Math.min(n, 12) / 12), 0.08, 'triangle', 0.12); },
  pie() { [660, 990, 1320].forEach((f, i) => tone(f, 0.12, 'triangle', 0.14, f, i * 0.08)); },
  power() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, 'square', 0.06, f, i * 0.07)); },
  jump() { tone(280, 0.16, 'sine', 0.12, 620); },
  slide() { tone(240, 0.2, 'sawtooth', 0.05, 90); },
  stumble() { tone(180, 0.22, 'square', 0.09, 70); },
  crash() { tone(220, 0.5, 'sawtooth', 0.16, 40); tone(90, 0.4, 'square', 0.12, 30); },
};
