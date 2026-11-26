// Design sheet: one WebGL canvas behind the page, each card is a scissored viewport.
import * as THREE from 'three';
import { character, CHARACTERS, type Pose } from './art/character';
import { bench, building, cafeTable, cloud, FOG, hydrant, lamp, lights, mailbox, planter, sky, streetChunk, tree, LANE } from './art/city';
import { OBSTACLES, type ObstacleKind } from './art/obstacles';
import { pie, powerup, slice } from './art/pizza';
import { C } from './art/util';

const canvas = document.getElementById('gl') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);

interface View { el: HTMLElement; scene: THREE.Scene; cam: THREE.PerspectiveCamera; tick?: (t: number) => void }
const views: View[] = [];
let pose: Pose = 'run';

function card(sectionId: string, title: string, note: string, obj: THREE.Object3D, opts: { tick?: (t: number) => void; tall?: boolean; tag?: string; sway?: boolean } = {}) {
  const el = document.createElement('div');
  el.className = `card${opts.tall ? ' tall' : ''}`;
  el.innerHTML = `<div class="view"></div><b>${title}${opts.tag ? `<span class="tag ${opts.tag}">${opts.tag}</span>` : ''}</b><small>${note}</small>`;
  document.getElementById(sectionId)!.append(el);

  const scene = new THREE.Scene();
  lights(scene);
  const bounds = new THREE.Box3().setFromObject(obj);
  const c = bounds.getCenter(new THREE.Vector3());
  const r = bounds.getSize(new THREE.Vector3()).length() / 2;
  obj.position.x -= c.x;
  obj.position.z -= c.z;
  const pivot = new THREE.Group();
  pivot.add(obj);
  scene.add(pivot);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 500);
  const dist = (r / Math.sin((15 * Math.PI) / 180)) * 1.05;
  cam.position.set(0, c.y + dist * (opts.sway ? 0.08 : 0.28), dist);
  cam.lookAt(0, c.y, 0);
  views.push({ el: el.querySelector('.view')!, scene, cam, tick: (t) => { pivot.rotation.y = opts.sway ? Math.sin(t * 0.8) * 0.8 : t * 0.7 + 0.5; opts.tick?.(t); } });
}

// ---- palette
const sw = document.getElementById('swatches')!;
for (const [name, hex] of [['Tomato', C.tomato], ['Mozzarella', C.cream], ['Basil', C.basil], ['Crust', C.crust], ['Cheese', C.cheese], ['Asphalt', C.asphalt], ['Night navy', C.navy], ['Window glow', C.lit]] as const) {
  const h = `#${hex.toString(16).padStart(6, '0')}`;
  sw.insertAdjacentHTML('beforeend', `<div class="sw"><i style="background:${h}"></i>${name}<br><span style="opacity:.6">${h}</span></div>`);
}

// ---- hero: a frame of the actual game
{
  const scene = new THREE.Scene();
  scene.background = sky();
  scene.fog = new THREE.Fog(FOG, 35, 110);
  lights(scene);
  for (let i = 0; i < 3; i++) {
    const chunk = streetChunk(40, 7 + i);
    chunk.position.z = 10 - i * 40;
    scene.add(chunk);
  }
  const put = (kind: ObstacleKind, lane: number, z: number) => {
    const o = OBSTACLES[kind].make();
    o.position.set(lane * LANE, 0, z);
    scene.add(o);
  };
  put('barrier', 0, -15); put('taxi', -1, -11); put('bus', 1, -24); put('banner', -1, -22); put('boxes', 1, -8); put('scooter', 0, -32); put('car', -1, -40); put('cart', 1, -42);
  const pizzas: THREE.Object3D[] = [];
  for (let i = 0; i < 7; i++) {
    const p = slice();
    // trail arcs over the barrier
    p.position.set(0, 1 + Math.max(0, 1.3 - Math.abs(-15 - (-4 - i * 2.2)) * 0.35), -4 - i * 2.2);
    scene.add(p); pizzas.push(p);
  }
  const big = pie();
  big.position.set(-LANE, 1.1, -20);
  scene.add(big); pizzas.push(big);
  const runner = character('rider');
  runner.group.rotation.y = Math.PI;
  scene.add(runner.group);
  const cam = new THREE.PerspectiveCamera(62, 1, 0.1, 300);
  cam.position.set(0, 3.6, 6.2);
  cam.lookAt(0, 1.4, -8);
  views.push({ el: document.getElementById('hero')!, scene, cam, tick: (t) => { runner.animate('run', t); pizzas.forEach((p, i) => (p.rotation.y = t * 3 + i * 0.5)); } });
}

// ---- characters
const poses = document.getElementById('poses')!;
for (const p of ['run', 'jump', 'slide', 'stumble', 'idle'] as Pose[]) {
  const b = document.createElement('button');
  b.textContent = p;
  b.className = p === pose ? 'on' : '';
  b.onclick = () => { pose = p; poses.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); };
  poses.append(b);
}
for (const c of CHARACTERS) {
  const ch = character(c.id);
  card('characters', c.name, c.blurb, ch.group, { tall: true, tick: (t) => { ch.animate(pose, t); ch.group.position.y = pose === 'jump' ? Math.abs(Math.sin(t * 3)) * 0.5 : pose === 'slide' ? 0.5 : 0; ch.group.position.z = pose === 'slide' ? 0.8 : 0; } });
}

// ---- pickups
const bob = (o: THREE.Object3D) => (t: number) => { o.position.y = Math.sin(t * 3) * 0.05; };
const s = slice(), p = pie();
card('pickups', 'Slice', '1 pizza point. Laid out in trails that show the safe line.', s, { tick: bob(s) });
card('pickups', 'Whole pie', '10 pizza points. Rare, placed where it is risky to reach.', p, { tick: bob(p) });

card('pickups', 'Magnet', 'Pulls nearby pizzas to you for 8 seconds.', powerup('magnet'));
card('pickups', '2x', 'Doubles every pizza for 10 seconds.', powerup('x2'));

// ---- obstacles
const notes: Record<ObstacleKind, [string, string]> = {
  taxi: ['Taxi', 'Parked in a lane.'],
  car: ['Car', 'Same shape, four pastel colours.'],
  van: ['Delivery van', 'Tall, fills the lane.'],
  bus: ['Bus', 'Very long. Commit to another lane early.'],
  scooter: ['Delivery scooter', 'Narrow but too tall to jump.'],
  cart: ['Slice cart', 'Street vendor with an umbrella.'],
  dumpster: ['Dumpster', 'Short but solid.'],
  barrier: ['Roadworks barrier', 'Jump it.'],
  cones: ['Cones', 'Jump the row.'],
  boxes: ['Pizza boxes', 'Low stacks. Jump them.'],
  scaffold: ['Scaffold', 'Slide under the striped beam.'],
  banner: ['Street banner', 'Hung low. Slide under.'],
};
for (const kind of Object.keys(OBSTACLES) as ObstacleKind[]) card('obstacles', notes[kind][0], notes[kind][1], OBSTACLES[kind].make(), { tag: OBSTACLES[kind].how });

// ---- city kit
card('city', 'Pizzeria', 'The landmark. Later: partner storefronts can live here.', building('pizzeria'), { tall: true, sway: true });
card('city', 'Brownstone', 'Three brick colours, stoop, random lit windows.', building('brownstone', 3), { tall: true, sway: true });
card('city', 'Corner shop', 'Three wall colours with a striped awning.', building('shop', 5), { tall: true, sway: true });
card('city', 'Cafe', 'Pink awning and a giant coffee cup on the roof.', building('cafe', 2), { tall: true, sway: true });
card('city', 'Apartments', 'Balconies, flower boxes, rooftop water tank.', building('apartment', 4), { tall: true, sway: true });
card('city', 'Tower', 'Breaks up the skyline.', building('tower', 9), { tall: true, sway: true });
card('city', 'Street lamp', 'Every 20 m along the kerb.', lamp());
card('city', 'Tree', 'Sidewalk filler.', tree());
card('city', 'Hydrant', 'Sidewalk filler.', hydrant());
card('city', 'Bench', 'Against the shopfronts.', bench());
card('city', 'Mailbox', 'Kerb side.', mailbox());
card('city', 'Planter', 'Kerb side.', planter());
card('city', 'Cafe table', 'Outside the shops.', cafeTable());
card('city', 'Cloud', 'Drifts over the skyline.', cloud());

// ---- render loop
function frame(ms: number) {
  const t = ms / 1000;
  const W = innerWidth, H = innerHeight;
  if (canvas.width !== Math.floor(W * renderer.getPixelRatio()) || canvas.height !== Math.floor(H * renderer.getPixelRatio())) renderer.setSize(W, H, false);
  renderer.setScissorTest(false);
  renderer.clear();
  renderer.setScissorTest(true);
  for (const v of views) {
    const r = v.el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > H || r.width === 0) continue;
    v.tick?.(t);
    renderer.setViewport(r.left, H - r.bottom, r.width, r.height);
    renderer.setScissor(r.left, H - r.bottom, r.width, r.height);
    v.cam.aspect = r.width / r.height;
    v.cam.updateProjectionMatrix();
    renderer.render(v.scene, v.cam);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
