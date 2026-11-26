// The simulation and the 3D scene. No DOM beyond the canvas: menus and HUD live in main.ts.
import * as THREE from 'three';
import { character, CHARACTERS, type CharacterId, type Pose } from './art/character';
import { FOG, LANE, lights, sky, streetChunk } from './art/city';
import { MAKE } from './art/obstacles';
import { pie, powerup, slice } from './art/pizza';
import { bake } from './art/util';
import type { Dir } from './input';
import { GRAVITY, JUMP_V, META, spawner, type ObstacleKind, type Pickup, type Row } from './spawn';

const CHUNK = 40; // metres of street per block
const CHUNKS = 5;
const START_SPEED = 11;
const MAX_SPEED = 26;
const ACCEL = 0.12; // m/s gained per second
const SLIDE_TIME = 0.7;
const STUMBLE_TIME = 1.5; // a second hit inside this window ends the run
const MAGNET_TIME = 8;
const X2_TIME = 10;
const STEP = 1 / 120; // fixed physics step, so collisions behave the same at any frame rate

export type State = 'menu' | 'run' | 'dead';
export interface Hooks {
  pickup(kind: Pickup['kind']): void;
  jump(): void;
  slide(): void;
  stumble(): void;
  crash(): void;
}

export function createGame(canvas: HTMLCanvasElement, hooks: Hooks) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  scene.background = sky();
  scene.fog = new THREE.Fog(FOG, 35, 110);
  lights(scene);
  const cam = new THREE.PerspectiveCamera(62, 1, 0.1, 300);
  cam.position.set(1.3, 1.5, 5.2);
  const look = new THREE.Vector3(0, 0.55, 0);
  const want = new THREE.Vector3();
  const wantLook = new THREE.Vector3();

  // The runner stays at z = 0 and the city slides past. `dist` is how far down the road we are;
  // anything at road position s is drawn at z = dist - s.
  const chunks = Array.from({ length: CHUNKS }, (_, i) => {
    const g = bake(streetChunk(CHUNK, 11 + i));
    scene.add(g);
    return { g, k: i - 1 };
  });

  // Models are built once and reused; nothing is allocated while running.
  function pool<K extends string>(make: (k: K) => THREE.Object3D) {
    const free = new Map<K, THREE.Object3D[]>();
    const put = (k: K, g: THREE.Object3D) => {
      g.visible = false;
      const list = free.get(k);
      if (list) list.push(g);
      else free.set(k, [g]);
    };
    const get = (k: K) => {
      let g = free.get(k)?.pop();
      if (!g) scene.add((g = bake(make(k))));
      g.visible = true;
      return g;
    };
    return { get, put };
  }
  const obPool = pool<ObstacleKind>((k) => MAKE[k]());
  const pkPool = pool<Pickup['kind']>((k) => {
    const g = k === 'slice' ? slice() : k === 'pie' ? pie() : powerup(k);
    g.scale.setScalar(k === 'slice' ? 1.3 : 1.2);
    return g;
  });
  // Build one of everything up front so the first bus doesn't cause a hitch.
  for (const k of Object.keys(MAKE) as ObstacleKind[]) obPool.put(k, obPool.get(k));
  for (const k of ['pie', 'magnet', 'x2'] as const) pkPool.put(k, pkPool.get(k));
  Array.from({ length: 60 }, () => pkPool.get('slice')).forEach((g) => pkPool.put('slice', g));

  const runners = new Map(CHARACTERS.map((c) => [c.id, character(c.id)]));
  const tilt = new THREE.Group(); // falls over on a crash
  const turn = new THREE.Group(); // faces the camera in the menu, the road in a run
  tilt.add(turn);
  scene.add(tilt);
  for (const r of runners.values()) turn.add(r.group);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.45, 20), new THREE.MeshBasicMaterial({ color: 0x1c2340, transparent: true, opacity: 0.25 }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  scene.add(shadow);

  interface Ob { g: THREE.Object3D; kind: ObstacleKind; lane: number; s0: number; s1: number; done: boolean }
  interface Pk { g: THREE.Object3D; kind: Pickup['kind']; s: number; x: number; y: number }
  const obs: Ob[] = [];
  const pks: Pk[] = [];

  let state: State = 'menu';
  let paused = false;
  let who: CharacterId = 'rider';
  let next = spawner(1);
  let spawnedTo = 0;
  let dist = 0, speed = START_SPEED;
  let lane = 0, prevLane = 0, x = 0, y = 0, vy = 0;
  let slideT = 0, stumbleT = 0, magnetT = 0, x2T = 0;
  let pizzas = 0;
  let clock = 0, stride = 0, deadT = 0, last = 0, acc = 0;

  function reset() {
    for (const o of obs) obPool.put(o.kind, o.g);
    for (const p of pks) pkPool.put(p.kind, p.g);
    obs.length = pks.length = 0;
    chunks.forEach((c, i) => (c.k = i - 1));
    next = spawner((Math.random() * 2 ** 32) >>> 0);
    spawnedTo = 0;
    dist = 0; speed = START_SPEED;
    lane = prevLane = x = y = vy = 0;
    slideT = stumbleT = magnetT = x2T = 0;
    pizzas = 0; deadT = 0; acc = 0;
    tilt.rotation.x = 0;
    tilt.position.set(0, 0, 0);
  }

  function place(row: Row) {
    row.cells.forEach((kind, i) => {
      if (!kind) return;
      const g = obPool.get(kind);
      g.position.x = (i - 1) * LANE;
      obs.push({ g, kind, lane: i - 1, s0: row.s, s1: row.s + META[kind].len, done: false });
    });
    for (const p of row.pickups) pks.push({ g: pkPool.get(p.kind), kind: p.kind, s: p.s, x: p.lane * LANE, y: p.y });
    spawnedTo = row.s + row.len;
  }

  function die() {
    state = 'dead';
    hooks.crash();
  }

  function step(dt: number) {
    speed = Math.min(MAX_SPEED, speed + ACCEL * dt);
    dist += speed * dt;
    const tx = lane * LANE;
    x += Math.sign(tx - x) * Math.min(Math.abs(tx - x), 15 * dt);
    if (y > 0 || vy > 0) {
      vy -= GRAVITY * dt;
      y += vy * dt;
      if (y <= 0) y = vy = 0;
    }
    slideT -= dt; stumbleT -= dt; magnetT -= dt; x2T -= dt;

    const d = (speed - START_SPEED) / (MAX_SPEED - START_SPEED);
    while (spawnedTo < dist + 130) place(next(d, speed));

    const height = slideT > 0 ? 0.75 : 1.6;
    for (let i = obs.length - 1; i >= 0; i--) {
      const o = obs[i];
      if (o.s1 < dist - 10) {
        obPool.put(o.kind, o.g);
        obs.splice(i, 1);
        continue;
      }
      if (o.done || o.s0 > dist + 0.3 || o.s1 < dist - 0.3 || Math.abs(x - o.lane * LANE) > 1.05) continue;
      const { how, h } = META[o.kind];
      if (how === 'slide' ? y + height < h : y > h) continue; // cleared it
      // Trips (low hurdles, clipping a car's side while changing lanes) cost a stumble; a head-on hit ends the run.
      const sideSwipe = how === 'block' && Math.abs(x - tx) > 0.3 && o.lane === lane && dist - o.s0 > 0.5;
      if ((how === 'block' && !sideSwipe) || stumbleT > 0) return die();
      o.done = true;
      stumbleT = STUMBLE_TIME;
      if (sideSwipe) lane = prevLane;
      hooks.stumble();
    }

    for (let i = pks.length - 1; i >= 0; i--) {
      const p = pks[i];
      const ahead = p.s - dist;
      if (magnetT > 0 && ahead < 9 && ahead > -1 && (p.kind === 'slice' || p.kind === 'pie')) {
        const k = Math.min(1, dt * 10);
        p.x += (x - p.x) * k;
        p.y += (y + 0.9 - p.y) * k;
        p.s -= Math.max(0, ahead) * Math.min(1, dt * 4);
      }
      if (Math.abs(ahead) < 0.7 && Math.abs(p.x - x) < 0.95 && Math.abs(p.y - (y + 0.8)) < 1.1) {
        if (p.kind === 'magnet') magnetT = MAGNET_TIME;
        else if (p.kind === 'x2') x2T = X2_TIME;
        else pizzas += (p.kind === 'pie' ? 10 : 1) * (x2T > 0 ? 2 : 1);
        hooks.pickup(p.kind);
      } else if (ahead > -6) continue;
      pkPool.put(p.kind, p.g);
      pks.splice(i, 1);
    }
  }

  function draw(dt: number) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const pr = renderer.getPixelRatio();
    if (canvas.width !== Math.floor(w * pr) || canvas.height !== Math.floor(h * pr)) {
      renderer.setSize(w, h, false);
      cam.aspect = w / h;
      cam.fov = w > h ? 45 : 62; // phones are tall, desktops are wide
      cam.updateProjectionMatrix();
    }
    clock += dt;
    if (state === 'run') stride += (dt * speed) / START_SPEED;
    if (state === 'dead') deadT += dt;

    for (const c of chunks) {
      if (dist - (c.k + 1) * CHUNK > 12) c.k += CHUNKS; // fully behind the camera: move it to the far end
      c.g.position.z = dist - c.k * CHUNK;
    }
    for (const o of obs) o.g.position.z = dist - (o.s0 + o.s1) / 2;
    for (const p of pks) {
      p.g.position.set(p.x, p.y + Math.sin(clock * 3 + p.s) * 0.06, dist - p.s);
      p.g.rotation.y = clock * 3 + p.s * 0.4;
    }

    const pose: Pose = state === 'menu' ? 'idle' : state === 'dead' || stumbleT > STUMBLE_TIME - 0.35 ? 'stumble' : slideT > 0 ? 'slide' : y > 0 ? 'jump' : 'run';
    for (const [id, r] of runners) {
      r.group.visible = id === who;
      if (id === who) r.animate(pose, state === 'run' ? stride : clock);
    }
    const ease = 1 - Math.exp(-dt * 7);
    turn.rotation.y += ((state === 'menu' ? 0.35 : Math.PI) - turn.rotation.y) * ease;
    tilt.position.set(x, y + (state === 'dead' ? Math.min(deadT * 2, 0.25) : 0), 0);
    tilt.rotation.x += ((state === 'dead' ? 1.35 : 0) - tilt.rotation.x) * ease;
    // blink while a stumble is still dangerous
    turn.visible = state !== 'run' || stumbleT <= 0 || Math.floor(clock * 14) % 2 === 0;
    shadow.position.x = x;
    shadow.scale.setScalar(Math.max(0.4, 1 - y * 0.3));

    if (state === 'menu') {
      want.set(1.3, 1.5, 5.2);
      wantLook.set(0, 0.55, 0);
    } else {
      const shake = state === 'dead' ? Math.max(0, 0.3 - deadT) * Math.sin(clock * 60) : 0;
      want.set(x * 0.6 + shake, 3.6 + y * 0.2, 6.2);
      wantLook.set(x * 0.6, 1.4, -8);
    }
    const camEase = 1 - Math.exp(-dt * 5);
    cam.position.lerp(want, camEase);
    look.lerp(wantLook, camEase);
    cam.lookAt(look);
    renderer.render(scene, cam);
  }

  return {
    get state() { return state; },
    get paused() { return paused; },
    stats: () => ({ pizzas, metres: Math.floor(dist), score: Math.floor(dist) + pizzas * 5, magnet: Math.max(0, magnetT) / MAGNET_TIME, x2: Math.max(0, x2T) / X2_TIME }),
    /** Read-only view of the run, for the dev console and automated play-tests. */
    debug: () => ({ dist, speed, lane, y, stumbling: stumbleT > 0, obs: obs.map((o) => ({ lane: o.lane, s0: o.s0, s1: o.s1, how: META[o.kind].how, kind: o.kind })) }),
    setRunner(id: CharacterId) { who = id; },
    setPaused(p: boolean) { paused = p; },
    start() { reset(); state = 'run'; paused = false; },
    toMenu() { reset(); state = 'menu'; paused = false; },
    input(dir: Dir) {
      if (state !== 'run' || paused) return;
      if (dir === 'left' || dir === 'right') {
        const to = Math.max(-1, Math.min(1, lane + (dir === 'left' ? -1 : 1)));
        if (to !== lane) { prevLane = lane; lane = to; }
      } else if (dir === 'up') {
        if (y > 0) return;
        vy = JUMP_V; slideT = 0;
        hooks.jump();
      } else {
        if (y > 0) vy = -JUMP_V * 1.6; // slide in mid-air = drop fast
        slideT = SLIDE_TIME;
        hooks.slide();
      }
    },
    frame(ms: number) {
      const dt = Math.min(0.05, (ms - last) / 1000 || 0);
      last = ms;
      if (state === 'run' && !paused) {
        acc += dt;
        while (acc >= STEP && state === 'run') { step(STEP); acc -= STEP; }
      }
      draw(paused ? 0 : dt);
    },
  };
}
