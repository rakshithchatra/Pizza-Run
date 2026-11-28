// The rules of a run: movement, spawning, collisions, pickups. Pure, so a bot can play it in a test.
// Rendering lives in game.ts and attaches a "view" (a 3D model) to each obstacle and pickup.
import type { Dir } from './input';
import { GRAVITY, JUMP_V, LANE, META, spawner, type Lesson, type ObstacleKind, type Pickup, type Row } from './spawn';

export const START_SPEED = 11;
export const MAX_SPEED = 24;
const ACCEL = 0.12; // m/s gained per second
const SLIDE_TIME = 0.7;
export const STUMBLE_TIME = 1.5; // a second hit inside this window ends the run
export const MAGNET_TIME = 8;
export const X2_TIME = 10;
const JUMP_BUFFER = 0.15; // a jump pressed just before landing still counts
export const STEP = 1 / 120; // fixed physics step, so collisions behave the same at any frame rate

export interface Ob<V> { view: V; kind: ObstacleKind; lane: number; s0: number; s1: number; done: boolean }
export interface Pk<V> { view: V; kind: Pickup['kind']; s: number; x: number; y: number }
/** How the renderer supplies and reclaims models. A test passes no-ops. */
export interface Views<V> { ob(kind: ObstacleKind): V; pk(kind: Pickup['kind']): V; free(kind: string, view: V): void }
export interface Hooks {
  pickup(kind: Pickup['kind']): void;
  jump(): void;
  slide(): void;
  stumble(): void;
  crash(): void;
}

export function createSim<V>(views: Views<V>, hooks: Hooks) {
  const obs: Ob<V>[] = [];
  const pks: Pk<V>[] = [];
  // dist = how far down the road the runner is. x/y = runner position; lane = the lane being moved to.
  const s = { dead: false, dist: 0, speed: START_SPEED, lane: 0, prevLane: 0, x: 0, y: 0, vy: 0, slideT: 0, stumbleT: 0, magnetT: 0, x2T: 0, jumpBuf: 0, pizzas: 0 };
  let next = spawner(1);
  let spawnedTo = 0;
  // First-play lesson: a scripted stretch of road where the run freezes at each obstacle until the right move is made.
  let steps: Lesson['steps'] = [];
  let stepAt = 0;
  let lessonFree = 0;
  let lessonEnd = 0;

  function reset(seed: number, lesson?: Lesson) {
    for (const o of obs) views.free(o.kind, o.view);
    for (const p of pks) views.free(p.kind, p.view);
    obs.length = pks.length = 0;
    Object.assign(s, { dead: false, dist: 0, speed: START_SPEED, lane: 0, prevLane: 0, x: 0, y: 0, vy: 0, slideT: 0, stumbleT: 0, magnetT: 0, x2T: 0, jumpBuf: 0, pizzas: 0 });
    steps = lesson?.steps ?? [];
    stepAt = 0;
    lessonFree = lesson?.free ?? 0;
    lessonEnd = lesson?.end ?? 0;
    next = spawner(seed, lesson?.end);
    spawnedTo = 0;
    if (lesson) {
      lesson.rows.forEach(place);
      spawnedTo = lesson.end;
    }
  }

  /** True while the lesson is holding the run still, waiting for a move. */
  const waiting = () => stepAt < steps.length && steps[stepAt].s - s.dist <= steps[stepAt].gap;
  /** The lesson's state, or null once it is over (or there was none). */
  const lessonNow = () => (s.dist < lessonEnd ? { need: stepAt < steps.length ? steps[stepAt].need : null, waiting: waiting() } : null);
  function skipLesson() {
    steps = [];
    lessonFree = lessonEnd = 0;
  }

  function place(row: Row) {
    row.cells.forEach((kind, i) => {
      if (kind) obs.push({ view: views.ob(kind), kind, lane: i - 1, s0: row.s, s1: row.s + META[kind].len, done: false });
    });
    for (const p of row.pickups) pks.push({ view: views.pk(p.kind), kind: p.kind, s: p.s, x: p.lane * LANE, y: p.y });
    spawnedTo = row.s + row.len;
  }

  function die() {
    s.dead = true;
    hooks.crash();
  }

  function step(dt: number) {
    if (s.dead || waiting()) return;
    if (s.dist >= lessonEnd) s.speed = Math.min(MAX_SPEED, s.speed + ACCEL * dt); // the lesson stays at walking pace
    s.dist += s.speed * dt;
    const tx = s.lane * LANE;
    s.x += Math.sign(tx - s.x) * Math.min(Math.abs(tx - s.x), 15 * dt);
    if (s.y > 0 || s.vy > 0) {
      s.vy -= GRAVITY * dt;
      s.y += s.vy * dt;
      if (s.y <= 0) s.y = s.vy = 0;
    }
    s.slideT -= dt; s.stumbleT -= dt; s.magnetT -= dt; s.x2T -= dt; s.jumpBuf -= dt;
    if (s.jumpBuf > 0 && s.y === 0) {
      s.vy = JUMP_V; s.slideT = 0; s.jumpBuf = 0;
      hooks.jump();
    }

    const d = (s.speed - START_SPEED) / (MAX_SPEED - START_SPEED);
    while (spawnedTo < s.dist + 130) place(next(d, s.speed));

    const height = s.slideT > 0 ? 0.75 : 1.6;
    for (let i = obs.length - 1; i >= 0; i--) {
      const o = obs[i];
      if (o.s1 < s.dist - 10) {
        views.free(o.kind, o.view);
        obs.splice(i, 1);
        continue;
      }
      if (o.done || o.s0 > s.dist + 0.3 || o.s1 < s.dist - 0.3 || Math.abs(s.x - o.lane * LANE) > 1.05) continue;
      const { how, h } = META[o.kind];
      if (how === 'slide' ? s.y + height < h : s.y > h) continue; // cleared it
      // Trips (low hurdles, clipping a car's side while changing lanes) cost a stumble; a head-on hit ends the run.
      const sideSwipe = how === 'block' && Math.abs(s.x - tx) > 0.3 && o.lane === s.lane && s.dist - o.s0 > 0.5;
      if ((how === 'block' && !sideSwipe) || s.stumbleT > 0) return die();
      o.done = true;
      s.stumbleT = STUMBLE_TIME;
      if (sideSwipe) s.lane = s.prevLane;
      hooks.stumble();
    }

    for (let i = pks.length - 1; i >= 0; i--) {
      const p = pks[i];
      const ahead = p.s - s.dist;
      if (s.magnetT > 0 && ahead < 9 && ahead > -1 && (p.kind === 'slice' || p.kind === 'pie')) {
        const k = Math.min(1, dt * 10);
        p.x += (s.x - p.x) * k;
        p.y += (s.y + 0.9 - p.y) * k;
        p.s -= Math.max(0, ahead) * Math.min(1, dt * 4);
      }
      if (Math.abs(ahead) < 0.7 && Math.abs(p.x - s.x) < 0.95 && Math.abs(p.y - (s.y + 0.8)) < 1.1) {
        if (p.kind === 'magnet') s.magnetT = MAGNET_TIME;
        else if (p.kind === 'x2') s.x2T = X2_TIME;
        else s.pizzas += (p.kind === 'pie' ? 10 : 1) * (s.x2T > 0 ? 2 : 1);
        hooks.pickup(p.kind);
      } else if (ahead > -6) continue;
      views.free(p.kind, p.view);
      pks.splice(i, 1);
    }
  }

  function input(dir: Dir) {
    if (s.dead) return;
    if (s.dist < lessonFree) {
      if (!waiting() || dir !== steps[stepAt].need) return; // during the lesson only the move being taught counts
      stepAt++;
    }
    if (dir === 'left' || dir === 'right') {
      const to = Math.max(-1, Math.min(1, s.lane + (dir === 'left' ? -1 : 1)));
      if (to !== s.lane) { s.prevLane = s.lane; s.lane = to; }
    } else if (dir === 'up') {
      s.jumpBuf = JUMP_BUFFER;
    } else {
      if (s.y > 0) s.vy = -JUMP_V * 1.6; // slide in mid-air = drop fast
      s.slideT = SLIDE_TIME; s.jumpBuf = 0;
      hooks.slide();
    }
  }

  return { s, obs, pks, reset, step, input, waiting, lesson: lessonNow, skipLesson };
}
