import { expect, test } from 'vitest';
import { createSim, MAX_SPEED, STEP } from './sim';
import { META } from './spawn';

const quiet = { pickup() {}, jump() {}, slide() {}, stumble() {}, crash() {} };
const noViews = { ob: () => null, pk: () => null, free() {} };

/**
 * A plain reactive bot: it only looks at the next row once it is `react` seconds away,
 * steps out of blocked lanes, and jumps or slides late. If it can survive, a person has a fair chance.
 */
function play(seed: number, startSpeed: number, metres: number, react: number) {
  let stumbles = 0;
  const sim = createSim(noViews, { ...quiet, stumble: () => stumbles++ });
  sim.reset(seed);
  sim.s.speed = startSpeed;
  while (!sim.s.dead && sim.s.dist < metres) {
    const { s } = sim;
    const ahead = sim.obs.filter((o) => o.s1 > s.dist - 0.2).sort((a, b) => a.s0 - b.s0);
    const row = ahead.filter((o) => Math.abs(o.s0 - ahead[0].s0) < 0.1);
    const gap = row.length ? row[0].s0 - s.dist : Infinity;
    if (gap < s.speed * react) {
      const how = (lane: number) => { const o = row.find((o) => o.lane === lane); return o && META[o.kind].how; };
      const mine = how(s.lane);
      if (mine === 'block' && gap > 0) {
        const to = [-1, 0, 1].filter((l) => how(l) !== 'block').sort((a, b) => Math.abs(a - s.lane) - Math.abs(b - s.lane))[0];
        sim.input(to < s.lane ? 'left' : 'right');
      } else if (mine === 'jump' && gap < s.speed * 0.2 && gap > -0.2 && s.y === 0) sim.input('up');
      else if (mine === 'slide' && gap < s.speed * 0.15 && gap > -0.2 && s.slideT < 0.3) sim.input('down');
    }
    sim.step(STEP);
  }
  return { dead: sim.s.dead, dist: sim.s.dist, stumbles, pizzas: sim.s.pizzas };
}

test('a bot reacting in 0.45s survives 5 km at top speed without a scratch', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const run = play(seed, MAX_SPEED, 5000, 0.45);
    expect(run, `seed ${seed}`).toMatchObject({ dead: false, stumbles: 0 });
  }
});

test('a full run from the start line is survivable and pays out pizzas', () => {
  const run = play(42, 11, 4000, 0.6);
  expect(run.dead).toBe(false);
  expect(run.pizzas).toBeGreaterThan(200);
});
