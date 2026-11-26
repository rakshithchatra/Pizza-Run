export type Dir = 'left' | 'right' | 'up' | 'down';

const KEYS: Record<string, Dir> = {
  ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right',
  ArrowUp: 'up', w: 'up', ' ': 'up', ArrowDown: 'down', s: 'down',
};

/** Swipes and arrow keys / WASD become directions; any other key goes to onKey. */
export function listen(onDir: (d: Dir) => void, onKey: (key: string) => void) {
  let sx = 0, sy = 0, live = false;
  addEventListener('pointerdown', (e) => {
    if ((e.target as Element).closest('button')) return;
    sx = e.clientX; sy = e.clientY; live = true;
  });
  // Fire as soon as the finger has travelled far enough, not on release: it feels much snappier.
  addEventListener('pointermove', (e) => {
    if (!live) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    live = false;
    onDir(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
  });
  addEventListener('pointerup', () => (live = false));
  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const dir = KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
    if (dir) { e.preventDefault(); onDir(dir); }
    onKey(e.key);
  });
}
