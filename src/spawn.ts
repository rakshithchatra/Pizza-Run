// Level generator. Pure: no rendering, no DOM, so it can be tested on its own.
import { rng } from './rng';

export type ObstacleKind = 'taxi' | 'car' | 'van' | 'bus' | 'scooter' | 'cart' | 'dumpster' | 'barrier' | 'cones' | 'boxes' | 'scaffold' | 'banner';
export type How = 'block' | 'jump' | 'slide';

/** len: metres along the road. h: top of a block/jump obstacle, or the underside of a slide one. */
export const META: Record<ObstacleKind, { how: How; len: number; h: number }> = {
  taxi: { how: 'block', len: 3.2, h: 1.55 },
  car: { how: 'block', len: 3.2, h: 1.55 },
  van: { how: 'block', len: 3.8, h: 2.4 },
  bus: { how: 'block', len: 7, h: 2.9 },
  scooter: { how: 'block', len: 1.7, h: 1.5 },
  cart: { how: 'block', len: 1.1, h: 1.45 },
  dumpster: { how: 'block', len: 1.2, h: 1.4 },
  barrier: { how: 'jump', len: 0.5, h: 0.85 },
  cones: { how: 'jump', len: 0.5, h: 0.45 },
  boxes: { how: 'jump', len: 0.9, h: 0.6 },
  scaffold: { how: 'slide', len: 1.4, h: 1.2 },
  banner: { how: 'slide', len: 0.3, h: 1.35 },
};

// Shared with the player physics so pizza trails follow the real jump arc.
export const GRAVITY = 26;
export const JUMP_V = 8.8;
const APEX = (JUMP_V * JUMP_V) / (2 * GRAVITY);

export interface Pickup { kind: 'slice' | 'pie' | 'magnet' | 'x2'; s: number; lane: number; y: number }
/** One row of obstacles. s = distance down the road where the row starts; cells are lanes left to right. */
export interface Row { s: number; len: number; cells: (ObstacleKind | null)[]; pickups: Pickup[] }

// B = blocked, J = jump, S = slide, . = free. Each is also used mirrored.
// Every pattern must leave at least one lane that is not B.
export const TIERS = [
  ['B..', '.B.', 'J..', '.J.', 'S..', '.S.'],
  ['BB.', 'B.B', 'BJ.', 'JB.', 'BS.', 'SB.', 'JJJ', 'SSS', 'J.S', 'B.J', 'B.S'],
  ['BJB', 'BSB', 'JBJ', 'SBS', 'BBJ', 'BBS', 'JBB', 'SBB', 'JSJ', 'SJS'],
];
const KINDS: Record<string, ObstacleKind[]> = {
  B: ['taxi', 'car', 'car', 'van', 'scooter', 'cart', 'dumpster'],
  J: ['barrier', 'cones', 'boxes'],
  S: ['scaffold', 'banner'],
};

/**
 * Returns next(difficulty 0..1, speed m/s) -> the next row down the road.
 * Rows never overlap, and the gap between them grows with speed so there is always time to react.
 */
export function spawner(seed: number) {
  const r = rng(seed);
  const pick = <T>(a: T[]) => a[Math.floor(r() * a.length)];
  let cursor = 30; // end of the previous row
  let trail = 1; // lane index the pizza trail is in
  let sincePower = 0;

  return function next(d: number, speed: number): Row {
    const roll = r();
    const tier = d < 0.12 || roll < 0.5 - 0.4 * d ? 0 : roll < 0.9 - 0.3 * d ? 1 : 2;
    let pattern = pick(TIERS[tier]);
    if (r() < 0.5) pattern = [...pattern].reverse().join('');

    const cells = [...pattern].map((c) => {
      if (c === '.') return null;
      if (c === 'B' && d > 0.25 && r() < 0.15) return 'bus' as const;
      return pick(KINDS[c]);
    });
    const len = Math.max(1, ...cells.map((k) => (k ? META[k].len : 0)));
    const gap = Math.max(9, speed * (1.15 - 0.45 * d));
    const s = cursor + gap;
    cursor = s + len;

    const open = [0, 1, 2].filter((i) => pattern[i] !== 'B');
    if (!open.includes(trail) || r() < 0.4) trail = pick(open);

    const pickups: Pickup[] = [];
    if (r() < 0.75) {
      const kind = cells[trail];
      const mid = s + (kind ? META[kind].len / 2 : 0);
      const half = (speed * JUMP_V) / GRAVITY; // ground covered on the way up
      for (let u = s - gap + 3; u <= s + len + 1.5; u += 1.6) {
        let y = 0.9;
        if (kind && META[kind].how === 'jump') y += APEX * Math.max(0, 1 - ((u - mid) / half) ** 2);
        if (kind && META[kind].how === 'slide' && u > s - 2 && u < s + META[kind].len + 2) y = 0.45;
        pickups.push({ kind: 'slice', s: u, lane: trail - 1, y });
      }
    }
    // A pie off the trail: you have to leave the safe line to get it.
    const other = open.filter((i) => i !== trail);
    if (other.length && r() < 0.12) {
      const lane = pick(other);
      const kind = cells[lane];
      const how = kind && META[kind].how;
      pickups.push({ kind: 'pie', s: s + (kind ? META[kind].len / 2 : 0), lane: lane - 1, y: how === 'jump' ? 0.9 + APEX : how === 'slide' ? 0.45 : 0.9 });
    }
    sincePower += gap + len;
    if (sincePower > 260 && r() < 0.5) {
      sincePower = 0;
      pickups.push({ kind: r() < 0.5 ? 'magnet' : 'x2', s: s - gap / 2, lane: Math.floor(r() * 3) - 1, y: 1 }); // mid-gap is always clear
    }
    return { s, len, cells, pickups };
  };
}
