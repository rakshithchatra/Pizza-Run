// The 3D scene and the menu/run/dead state. The rules of a run live in sim.ts; menus and HUD in main.ts.
import * as THREE from 'three';
import { character, CHARACTERS, type CharacterId, type Pose } from './art/character';
import { FOG, lights, sky, streetChunk } from './art/city';
import { MAKE } from './art/obstacles';
import { pie, powerup, slice } from './art/pizza';
import { bake } from './art/util';
import type { Dir } from './input';
import { createSim, MAGNET_TIME, MAX_SPEED, START_SPEED, STEP, STUMBLE_TIME, X2_TIME, type Hooks } from './sim';
import { LANE, META, type ObstacleKind, type Pickup } from './spawn';

const CHUNK = 40; // metres of street per block
const CHUNKS = 5;

export type State = 'menu' | 'run' | 'dead';

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

  // The runner stays at z = 0 and the city slides past. Anything at road position p is drawn at z = dist - p.
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
  const tilt = new THREE.Group(); // leans into lane changes, falls over on a crash
  const turn = new THREE.Group(); // faces the camera in the menu, the road in a run
  tilt.add(turn);
  scene.add(tilt);
  for (const r of runners.values()) turn.add(r.group);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.45, 20), new THREE.MeshBasicMaterial({ color: 0x1c2340, transparent: true, opacity: 0.25 }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  scene.add(shadow);

  let state: State = 'menu';
  let paused = false;
  let who: CharacterId = 'rider';
  let clock = 0, stride = 0, deadT = 0, last = 0, acc = 0;

  const sim = createSim<THREE.Object3D>(
    {
      ob: (k) => obPool.get(k),
      pk: (k) => pkPool.get(k),
      free: (k, g) => (k in META ? obPool.put(k as ObstacleKind, g) : pkPool.put(k as Pickup['kind'], g)),
    },
    { ...hooks, crash() { state = 'dead'; hooks.crash(); } },
  );
  const { s, obs, pks } = sim;

  function reset() {
    sim.reset((Math.random() * 2 ** 32) >>> 0);
    chunks.forEach((c, i) => (c.k = i - 1));
    deadT = acc = 0;
    tilt.rotation.x = 0;
  }

  function draw(dt: number) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const pr = renderer.getPixelRatio();
    if (canvas.width !== Math.floor(w * pr) || canvas.height !== Math.floor(h * pr)) {
      renderer.setSize(w, h, false);
      cam.aspect = w / h;
      cam.fov = 0; // force the projection update below
    }
    // phones are tall, desktops are wide; the view also widens a little as you speed up
    const fov = (w > h ? 45 : 62) + (state === 'menu' ? 0 : ((s.speed - START_SPEED) / (MAX_SPEED - START_SPEED)) * 9);
    if (Math.abs(fov - cam.fov) > 0.01) {
      cam.fov = cam.fov ? cam.fov + (fov - cam.fov) * Math.min(1, dt * 4) : fov;
      cam.updateProjectionMatrix();
    }
    clock += dt;
    if (state === 'run') stride += (dt * s.speed) / START_SPEED;
    if (state === 'dead') deadT += dt;

    for (const c of chunks) {
      if (s.dist - (c.k + 1) * CHUNK > 12) c.k += CHUNKS; // fully behind the camera: move it to the far end
      c.g.position.z = s.dist - c.k * CHUNK;
    }
    for (const o of obs) o.view.position.set(o.lane * LANE, 0, s.dist - (o.s0 + o.s1) / 2);
    for (const p of pks) {
      p.view.position.set(p.x, p.y + Math.sin(clock * 3 + p.s) * 0.06, s.dist - p.s);
      p.view.rotation.y = clock * 3 + p.s * 0.4;
    }

    const pose: Pose = state === 'menu' ? 'idle' : state === 'dead' || s.stumbleT > STUMBLE_TIME - 0.35 ? 'stumble' : s.slideT > 0 ? 'slide' : s.y > 0 ? 'jump' : 'run';
    for (const [id, r] of runners) {
      r.group.visible = id === who;
      if (id === who) r.animate(pose, state === 'run' ? stride : clock);
    }
    const ease = 1 - Math.exp(-dt * 7);
    turn.rotation.y += ((state === 'menu' ? 0.35 : Math.PI) - turn.rotation.y) * ease;
    tilt.position.set(s.x, s.y + (state === 'dead' ? Math.min(deadT * 2, 0.25) : 0), 0);
    tilt.rotation.x += ((state === 'dead' ? 1.35 : 0) - tilt.rotation.x) * ease;
    tilt.rotation.z += ((state === 'run' ? (s.x - s.lane * LANE) * 0.14 : 0) - tilt.rotation.z) * ease; // lean into lane changes
    // blink while a stumble is still dangerous
    turn.visible = state !== 'run' || s.stumbleT <= 0 || Math.floor(clock * 14) % 2 === 0;
    shadow.position.x = s.x;
    shadow.scale.setScalar(Math.max(0.4, 1 - s.y * 0.3));

    if (state === 'menu') {
      want.set(1.3, 1.5, 5.2);
      wantLook.set(0, 0.55, 0);
    } else {
      const shake = state === 'dead' ? Math.max(0, 0.3 - deadT) * Math.sin(clock * 60) : 0;
      want.set(s.x * 0.6 + shake, 3.6 + s.y * 0.2, 6.2);
      wantLook.set(s.x * 0.6, 1.4, -8);
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
    stats: () => ({ pizzas: s.pizzas, metres: Math.floor(s.dist), score: Math.floor(s.dist) + s.pizzas * 5, magnet: Math.max(0, s.magnetT) / MAGNET_TIME, x2: Math.max(0, s.x2T) / X2_TIME }),
    /** What is coming up, for the first-run hints. */
    ahead: () => ({ lane: s.lane, dist: s.dist, speed: s.speed, obs: obs.map((o) => ({ lane: o.lane, s0: o.s0, how: META[o.kind].how })) }),
    setRunner(id: CharacterId) { who = id; },
    setPaused(p: boolean) { paused = p; },
    start() { reset(); state = 'run'; paused = false; },
    toMenu() { reset(); state = 'menu'; paused = false; },
    input(dir: Dir) { if (state === 'run' && !paused) sim.input(dir); },
    frame(ms: number) {
      const dt = Math.min(0.05, (ms - last) / 1000 || 0);
      last = ms;
      if (state === 'run' && !paused) {
        acc += dt;
        while (acc >= STEP && state === 'run') { sim.step(STEP); acc -= STEP; }
      }
      draw(paused ? 0 : dt);
    },
  };
}
