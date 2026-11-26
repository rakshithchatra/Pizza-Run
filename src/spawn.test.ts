import { expect, test } from 'vitest';
import { META, spawner, TIERS } from './spawn';

test('every pattern leaves a lane that is not blocked', () => {
  for (const p of TIERS.flat()) expect(p).toMatch(/^[BJS.]{3}$/), expect(p).toMatch(/[^B]/);
});

test('rows are always passable, never overlap, and trails avoid blocked lanes', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const next = spawner(seed);
    let end = 0;
    for (let i = 0; i < 1000; i++) {
      const d = i / 1000;
      const row = next(d, 11 + 15 * d);
      expect(row.cells.some((k) => !k || META[k].how !== 'block')).toBe(true);
      expect(row.s - end).toBeGreaterThanOrEqual(9);
      end = row.s + row.len;
      for (const p of row.pickups) {
        expect([-1, 0, 1]).toContain(p.lane);
        const cell = row.cells[p.lane + 1];
        const inRow = p.s >= row.s && p.s <= row.s + row.len;
        if (inRow && cell) expect(META[cell].how).not.toBe('block');
      }
    }
  }
});
