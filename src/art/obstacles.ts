import * as THREE from 'three';
import { pie } from './pizza';
import { box, C, cyl, mat, rbox, sign, sphere } from './util';

import { META, type ObstacleKind } from '../spawn';

// Every obstacle sits on the ground, centred in its lane (lane = 2 wide), length along Z,
// and is seen from +Z (the runner comes from there). Sizes and rules live in spawn.ts.
export const MAKE: Record<ObstacleKind, () => THREE.Group> = {
  taxi: () => car(C.taxi, true),
  car: () => car(CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)], false),
  van, bus, scooter, cart, dumpster, barrier, cones, boxes, scaffold, banner,
};
export type { ObstacleKind };
export const OBSTACLES = Object.fromEntries((Object.keys(MAKE) as ObstacleKind[]).map((k) => [k, { ...META[k], make: MAKE[k] }])) as Record<ObstacleKind, (typeof META)[ObstacleKind] & { make: () => THREE.Group }>;
const CAR_COLORS = [0x8fd6b4, 0xf7a8c0, 0x7fc8e8, 0xb7a3e8];

function wheel(g: THREE.Group, x: number, z: number, r: number, w = 0.24) {
  const tyre = cyl(r, r, w, C.dark, x, r, z, 14);
  tyre.rotation.z = Math.PI / 2;
  const hub = cyl(r * 0.45, r * 0.45, w + 0.02, C.cream, x, r, z, 10);
  hub.rotation.z = Math.PI / 2;
  g.add(tyre, hub);
}
function wheels(g: THREE.Group, x: number, z: number, r = 0.3) {
  for (const sx of [-x, x]) for (const sz of [-z, z]) wheel(g, sx, sz, r);
}

// Round headlights read as eyes, which is most of what makes the vehicles friendly.
function lamps(g: THREE.Group, x: number, y: number, z: number, r: number) {
  for (const sx of [-x, x]) g.add(sphere(r, C.cream, sx, y, z, 1, 1, 0.5, true), sphere(r * 0.8, C.tomato, sx, y, -z, 1, 1, 0.5, true));
}

function car(color: number, isTaxi: boolean) {
  const g = new THREE.Group();
  g.add(rbox(1.7, 0.7, 3.2, color, 0, 0.65, 0, 0.3));
  g.add(rbox(1.5, 0.66, 1.8, color, 0, 1.2, -0.1, 0.3));
  g.add(rbox(1.54, 0.34, 1.2, C.glass, 0, 1.24, -0.1, 0.12), rbox(1.2, 0.34, 1.84, C.glass, 0, 1.24, -0.1, 0.12));
  g.add(rbox(1.76, 0.16, 3.26, 0xfffaf0, 0, 0.42, 0, 0.08)); // bumper skirt
  if (isTaxi) {
    g.add(box(1.72, 0.1, 2.2, C.dark, 0, 0.72, 0));
    g.add(rbox(0.5, 0.2, 0.24, C.lit, 0, 1.6, -0.1, 0.08, true));
  }
  lamps(g, 0.5, 0.74, 1.56, 0.16);
  wheels(g, 0.8, 1.0, 0.32);
  return g;
}

function van() {
  const g = new THREE.Group();
  g.add(rbox(1.8, 2.0, 3.8, C.white, 0, 1.35, 0, 0.4));
  g.add(rbox(1.84, 0.3, 3.84, C.tomato, 0, 0.8, 0, 0.14));
  g.add(rbox(1.4, 0.6, 0.12, C.glass, 0, 1.8, 1.86, 0.06));
  lamps(g, 0.55, 1.15, 1.88, 0.17);
  for (const x of [-0.92, 0.92]) {
    const logo = pie();
    logo.scale.setScalar(1.3);
    logo.rotation.y = Math.PI / 2;
    logo.position.set(x, 1.55, -0.2);
    g.add(logo);
  }
  wheels(g, 0.85, 1.2, 0.36);
  return g;
}

function bus() {
  const g = new THREE.Group();
  g.add(rbox(1.9, 2.3, 7, 0x6fb8f0, 0, 1.6, 0, 0.45));
  g.add(rbox(1.94, 0.7, 6.0, C.glass, 0, 2.0, 0, 0.2));
  for (let z = -2.4; z <= 2.4; z += 1.2) g.add(box(1.96, 0.72, 0.14, 0x6fb8f0, 0, 2.0, z)); // window pillars
  g.add(rbox(1.94, 0.26, 7.04, C.cheese, 0, 0.85, 0, 0.12), rbox(1.6, 0.2, 6.2, 0xfffaf0, 0, 2.78, 0, 0.1));
  g.add(rbox(1.5, 0.8, 0.12, C.glass, 0, 1.9, 3.46, 0.06));
  const dest = sign('PIZZA ST', 1.2, 0.3, C.dark, C.lit);
  dest.position.set(0, 2.5, 3.51);
  g.add(dest);
  lamps(g, 0.6, 1.0, 3.48, 0.18);
  wheels(g, 0.9, 2.3, 0.42);
  return g;
}

function scooter() {
  const g = new THREE.Group();
  g.add(rbox(0.42, 0.3, 1.3, C.tomato, 0, 0.5, 0, 0.14), rbox(0.36, 0.9, 0.3, C.tomato, 0, 0.85, 0.55, 0.14));
  g.add(rbox(0.8, 0.08, 0.08, C.dark, 0, 1.36, 0.55, 0.04), sphere(0.13, C.cream, 0, 1.1, 0.7, 1, 1, 0.5, true));
  g.add(rbox(0.4, 0.16, 0.6, C.dark, 0, 0.82, -0.2, 0.07), rbox(0.44, 0.4, 0.5, C.tomato, 0, 0.62, -0.3, 0.14));
  g.add(rbox(0.66, 0.56, 0.6, C.white, 0, 1.2, -0.62, 0.1), rbox(0.68, 0.12, 0.62, C.tomato, 0, 1.44, -0.62, 0.05)); // delivery box
  const logo = pie();
  logo.scale.setScalar(0.5);
  logo.position.set(0, 1.18, -0.3);
  g.add(logo);
  wheel(g, 0, 0.62, 0.27, 0.16);
  wheel(g, 0, -0.62, 0.27, 0.16);
  return g;
}

function cart() {
  const g = new THREE.Group();
  g.add(rbox(1.5, 0.9, 1.0, 0xfffaf0, 0, 0.95, 0, 0.16), rbox(1.54, 0.26, 1.04, 0xf7a8c0, 0, 0.8, 0, 0.1));
  g.add(rbox(1.6, 0.08, 1.1, C.wood, 0, 1.42, 0, 0.04));
  const s = sign('SLICES', 1.0, 0.28, 0xfffaf0, C.tomato);
  s.position.set(0, 1.12, 0.51);
  g.add(s);
  g.add(cyl(0.04, 0.04, 1.6, 0xaab0cc, 0.5, 2.2, 0, 6));
  for (let i = 0; i < 8; i++) { // striped umbrella, one wedge per colour
    const wedge = new THREE.Mesh(new THREE.ConeGeometry(1.1, 0.5, 2, 1, false, (i / 8) * Math.PI * 2, Math.PI / 4), mat(i % 2 ? C.tomato : 0xfffaf0, false, true));
    wedge.position.set(0.5, 3.0, 0);
    g.add(wedge);
  }
  g.add(sphere(0.09, C.tomato, 0.5, 3.28, 0));
  wheel(g, -0.78, 0.2, 0.34, 0.14);
  wheel(g, 0.78, 0.2, 0.34, 0.14);
  g.add(cyl(0.05, 0.05, 0.5, 0xaab0cc, 0, 0.25, -0.4, 6));
  return g;
}

function dumpster() {
  const g = new THREE.Group();
  g.add(rbox(1.7, 1.1, 1.2, 0x4fb08a, 0, 0.72, 0, 0.16), rbox(1.76, 0.1, 0.4, 0x3d9474, 0, 0.9, 0.56, 0.05));
  const lid = rbox(1.78, 0.14, 1.3, 0x3d9474, 0, 1.34, 0, 0.07);
  lid.rotation.x = -0.12;
  g.add(lid);
  wheels(g, 0.75, 0.45, 0.13);
  return g;
}

function stripes(g: THREE.Group, w: number, h: number, d: number, y: number, z: number, a: number, b: number) {
  const n = 6;
  for (let i = 0; i < n; i++) g.add(box(w / n, h, d, i % 2 ? a : b, (i - (n - 1) / 2) * (w / n), y, z));
}

function barrier() {
  const g = new THREE.Group();
  for (const x of [-0.78, 0.78]) g.add(rbox(0.12, 0.9, 0.12, C.dark, x, 0.45, 0, 0.05), rbox(0.14, 0.1, 0.5, C.dark, x, 0.05, 0, 0.05), sphere(0.11, C.orange, x, 1.0, 0, 1, 1, 1, true));
  stripes(g, 1.8, 0.22, 0.1, 0.74, 0, C.tomato, C.cream);
  stripes(g, 1.8, 0.22, 0.1, 0.4, 0, C.cream, C.tomato);
  return g;
}

function cones() {
  const g = new THREE.Group();
  for (const x of [-0.6, 0, 0.6]) {
    g.add(rbox(0.44, 0.07, 0.44, C.orange, x, 0.035, 0, 0.03), cyl(0.05, 0.19, 0.55, C.orange, x, 0.33, 0, 12), cyl(0.095, 0.125, 0.1, C.white, x, 0.36, 0, 12), sphere(0.055, C.orange, x, 0.6, 0));
  }
  return g;
}

/** Two stacks of pizza boxes someone left in the road. */
function boxes() {
  const g = new THREE.Group();
  for (const [x, n, turn] of [[-0.45, 4, 0.2], [0.48, 3, -0.15]] as const) {
    const stack = new THREE.Group();
    for (let i = 0; i < n; i++) {
      const b = rbox(0.82, 0.16, 0.82, i === n - 1 ? C.tomato : 0xfffaf0, 0, 0.08 + i * 0.17, 0, 0.04);
      b.rotation.y = i * 0.12;
      stack.add(b);
    }
    const top = pie();
    top.scale.setScalar(0.6);
    top.rotation.x = -Math.PI / 2;
    top.position.y = n * 0.17 + 0.02;
    stack.add(top);
    stack.position.x = x;
    stack.rotation.y = turn;
    g.add(stack);
  }
  return g;
}

function scaffold() {
  const g = new THREE.Group();
  for (const x of [-0.95, 0.95]) for (const z of [-0.6, 0.6]) g.add(cyl(0.06, 0.06, 2.6, 0xaab0cc, x, 1.3, z, 8), sphere(0.09, 0xaab0cc, x, 2.6, z));
  g.add(rbox(2.0, 0.14, 1.4, C.wood, 0, 1.56, 0, 0.06));
  stripes(g, 2.0, 0.3, 0.1, 1.36, 0.7, C.taxi, C.dark); // the beam you slide under
  g.add(box(2.0, 0.06, 0.06, 0xaab0cc, 0, 2.5, 0.6), box(2.0, 0.06, 0.06, 0xaab0cc, 0, 2.5, -0.6));
  g.add(rbox(0.5, 0.4, 0.4, C.tomato, 0.4, 1.83, 0, 0.1)); // toolbox
  return g;
}

/** A street banner strung low between two poles. */
function banner() {
  const g = new THREE.Group();
  for (const x of [-0.95, 0.95]) g.add(cyl(0.06, 0.08, 2.5, 0xaab0cc, x, 1.25, 0, 8), sphere(0.12, C.cheese, x, 2.55, 0));
  g.add(rbox(1.9, 0.8, 0.08, C.tomato, 0, 1.78, 0, 0.04));
  const s = sign('FRESH PIZZA', 1.76, 0.6, C.tomato, C.cream);
  s.position.set(0, 1.78, 0.045);
  g.add(s);
  for (let i = 0; i < 7; i++) g.add(sphere(0.07, [C.cheese, C.basil, 0xfffaf0][i % 3], -0.78 + i * 0.26, 2.26, 0)); // bunting
  return g;
}
