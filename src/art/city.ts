import * as THREE from 'three';
import { pie } from './pizza';
import { box, C, cyl, ico, rbox, rng, sign, sphere } from './util';

import { LANE } from '../spawn';
export { LANE };
const ROAD_HALF = 3.3;
const WALK = 2.5;

export type BuildingKind = 'brownstone' | 'shop' | 'pizzeria' | 'tower' | 'cafe' | 'apartment';
const WIDTH: Record<BuildingKind, number> = { brownstone: 6, shop: 6, pizzeria: 7, tower: 7, cafe: 6, apartment: 6 };
const DEPTH = 6;
const TRIM = 0xfffaf0;

function windows(g: THREE.Group, r: () => number, cols: number, rows: number, w: number, y0: number, dy: number, ww: number, wh: number, flowers = true) {
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      const on = r() < 0.5;
      const x = (col - (cols - 1) / 2) * (w / cols);
      g.add(box(ww + 0.16, wh + 0.16, 0.06, TRIM, x, y0 + row * dy, DEPTH / 2)); // frame
      g.add(box(ww, wh, 0.1, on ? C.lit : C.glass, x, y0 + row * dy, DEPTH / 2, on));
      if (flowers && r() < 0.35) {
        const y = y0 + row * dy - wh / 2 - 0.12;
        g.add(rbox(ww + 0.2, 0.18, 0.26, 0x9a6a45, x, y, DEPTH / 2 + 0.12, 0.06));
        for (const dx of [-0.3, 0, 0.3]) g.add(ico(0.12, dx ? 0xff8fb0 : C.cheese, x + dx, y + 0.16, DEPTH / 2 + 0.14));
      }
    }
}

function awning(g: THREE.Group, w: number, y: number, colors: number[]) {
  const a = new THREE.Group();
  const n = Math.round(w / 0.5);
  for (let i = 0; i < n; i++) a.add(box(w / n, 0.1, 1.2, colors[i % colors.length], (i - (n - 1) / 2) * (w / n), 0, 0));
  a.position.set(0, y, DEPTH / 2 + 0.5);
  a.rotation.x = 0.4;
  g.add(a);
}

/** Building on the ground, centred on its footprint, shopfront facing +Z. Pastel and soft-cornered. */
export function building(kind: BuildingKind, seed = 1) {
  const r = rng(seed);
  const g = new THREE.Group();
  const w = WIDTH[kind];
  const front = DEPTH / 2;
  if (kind === 'brownstone') {
    const wall = [0xf08a7b, 0xf6cf7a, 0x8fd6b4][Math.floor(r() * 3)];
    g.add(rbox(w, 9, DEPTH, wall, 0, 4.5, 0, 0.4), rbox(w + 0.3, 0.5, DEPTH + 0.3, TRIM, 0, 9.1, 0, 0.2));
    windows(g, r, 3, 3, w, 3.6, 2.1, 0.9, 1.3);
    g.add(rbox(1.0, 2.0, 0.14, 0x8a5a4a, -1.9, 1.5, front, 0.07), box(0.9, 1.3, 0.1, C.lit, 0.9, 1.5, front, true));
    g.add(rbox(1.6, 0.25, 0.9, TRIM, -1.9, 0.125, front + 0.45, 0.08), rbox(1.6, 0.25, 0.45, TRIM, -1.9, 0.375, front + 0.22, 0.08));
    for (const x of [-1.8, -0.6, 1.4]) g.add(sphere(0.55 + r() * 0.2, 0x6fcb78, x, 9.6, 1.6 - r())); // roof garden
  } else if (kind === 'shop') {
    const wall = [0x7fc8e8, 0xf7a8c0, 0xb7a3e8][Math.floor(r() * 3)];
    g.add(rbox(w, 5, DEPTH, wall, 0, 2.5, 0, 0.4), rbox(w + 0.2, 0.4, DEPTH + 0.2, TRIM, 0, 5.1, 0, 0.18));
    g.add(box(3.6, 1.8, 0.1, C.lit, -0.8, 1.3, front, true), rbox(1.0, 2.0, 0.14, 0x8a5a4a, 2.2, 1.0, front, 0.07));
    awning(g, w - 0.6, 2.6, [TRIM, wall]);
    windows(g, r, 3, 1, w, 4.0, 0, 0.9, 0.9);
  } else if (kind === 'pizzeria') {
    g.add(rbox(w, 5.5, DEPTH, 0xfff1d0, 0, 2.75, 0, 0.4), rbox(w + 0.2, 0.4, DEPTH + 0.2, C.tomato, 0, 5.6, 0, 0.18));
    g.add(box(4.0, 1.8, 0.1, C.lit, -1.0, 1.3, front, true), rbox(1.0, 2.0, 0.14, 0x8a3a2a, 2.4, 1.0, front, 0.07));
    awning(g, w - 0.6, 2.6, [C.basil, TRIM, C.tomato]);
    const s = sign('PIZZA', 3.6, 0.9, C.tomato, C.cream);
    s.position.set(-0.9, 4.1, front + 0.06);
    g.add(s);
    const p = pie();
    p.scale.setScalar(1.6);
    p.position.set(2.3, 4.2, front + 0.2);
    g.add(p);
  } else if (kind === 'cafe') {
    g.add(rbox(w, 5, DEPTH, 0x8fdcd0, 0, 2.5, 0, 0.4), rbox(w + 0.2, 0.4, DEPTH + 0.2, TRIM, 0, 5.1, 0, 0.18));
    g.add(box(3.4, 1.8, 0.1, C.lit, -0.9, 1.3, front, true), rbox(1.0, 2.0, 0.14, 0x8a5a4a, 2.2, 1.0, front, 0.07));
    awning(g, w - 0.6, 2.6, [0xf7a8c0, TRIM]);
    const s = sign('CAFE', 2.4, 0.8, 0xf7a8c0, 0xfffaf0);
    s.position.set(-0.9, 4.0, front + 0.06);
    g.add(s);
    // giant coffee cup on the roof
    g.add(cyl(0.75, 0.6, 1.1, TRIM, 1.6, 5.85, 0.6, 16), cyl(0.66, 0.66, 0.06, 0x8a5a4a, 1.6, 6.4, 0.6, 16), rbox(0.2, 0.6, 0.5, TRIM, 2.42, 5.85, 0.6, 0.1));
    for (const [dx, dy] of [[0, 0.5], [0.15, 0.95], [-0.1, 1.4]]) g.add(sphere(0.22 - dy * 0.06, 0xffffff, 1.6 + dx, 6.4 + dy, 0.6)); // steam
  } else if (kind === 'apartment') {
    const wall = [0xf7b0a0, 0xa8d8f0, 0xd8c0f0][Math.floor(r() * 3)];
    g.add(rbox(w, 12, DEPTH, wall, 0, 6, 0, 0.4), rbox(w + 0.3, 0.5, DEPTH + 0.3, TRIM, 0, 12.1, 0, 0.2));
    windows(g, r, 3, 4, w, 3.6, 2.2, 0.9, 1.2);
    for (let row = 0; row < 4; row++) g.add(rbox(1.5, 0.5, 0.7, TRIM, 0, 2.8 + row * 2.2, front + 0.3, 0.12)); // balconies
    g.add(rbox(1.0, 2.0, 0.14, 0x8a5a4a, -1.9, 1.0, front, 0.07), box(1.6, 1.3, 0.1, C.lit, 1.2, 1.3, front, true));
    // water tank
    for (const [x, z] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) g.add(cyl(0.05, 0.05, 0.8, 0x5a6088, 1.2 + x, 12.7, z, 5));
    g.add(cyl(0.8, 0.8, 1.2, C.wood, 1.2, 13.7, 0, 12), cyl(0.05, 0.9, 0.5, 0x9a6a45, 1.2, 14.55, 0, 12));
  } else {
    g.add(rbox(w, 18, DEPTH, 0x8f9fe0, 0, 9, 0, 0.5), rbox(w - 1.5, 1.4, DEPTH - 1.5, 0x7486d0, 0, 18.5, 0, 0.4), cyl(0.06, 0.06, 2.2, TRIM, 1.5, 20.2, 0, 6), sphere(0.16, C.tomato, 1.5, 21.4, 0, 1, 1, 1, true));
    windows(g, r, 4, 9, w, 2.6, 1.75, 1.0, 1.0, false);
    g.add(box(2.4, 2.0, 0.1, C.lit, 0, 1.0, front, true));
  }
  return g;
}

export function lamp() {
  const g = new THREE.Group();
  g.add(cyl(0.07, 0.1, 4.2, 0x5a6088, 0, 2.1, 0, 8), cyl(0.16, 0.2, 0.25, 0x5a6088, 0, 0.12, 0, 8), rbox(1.0, 0.1, 0.1, 0x5a6088, 0.45, 4.2, 0, 0.05), sphere(0.24, C.lit, 0.9, 4.02, 0, 1, 1, 1, true));
  return g;
}

export function hydrant() {
  const g = new THREE.Group();
  g.add(cyl(0.15, 0.17, 0.46, C.tomato, 0, 0.23, 0, 12), sphere(0.16, C.tomato, 0, 0.46, 0), sphere(0.06, C.cheese, 0, 0.63, 0), cyl(0.19, 0.19, 0.06, C.tomato, 0, 0.03, 0, 12));
  for (const x of [-0.19, 0.19]) g.add(sphere(0.07, C.cheese, x, 0.3, 0));
  return g;
}

export function tree() {
  const g = new THREE.Group();
  g.add(cyl(0.13, 0.17, 1.6, 0x9a6a45, 0, 0.8, 0, 8));
  g.add(sphere(0.95, 0x5cbf6a, 0, 2.3, 0), sphere(0.7, 0x7fd685, 0.5, 2.9, 0.2), sphere(0.6, 0x6fcb78, -0.5, 2.8, -0.25));
  g.add(cyl(0.6, 0.6, 0.08, 0x8a6a55, 0, 0.19, 0, 12)); // soil bed
  return g;
}

/** Faces +Z. */
export function bench() {
  const g = new THREE.Group();
  g.add(rbox(1.5, 0.1, 0.5, C.wood, 0, 0.48, 0, 0.05), rbox(1.5, 0.45, 0.1, C.wood, 0, 0.85, -0.22, 0.05));
  for (const x of [-0.6, 0.6]) g.add(rbox(0.1, 0.48, 0.44, 0x5a6088, x, 0.24, 0, 0.04));
  return g;
}

export function mailbox() {
  const g = new THREE.Group();
  g.add(cyl(0.06, 0.06, 0.5, 0x5a6088, 0, 0.25, 0, 6), rbox(0.5, 0.75, 0.45, 0x5aa0e8, 0, 0.85, 0, 0.2), box(0.3, 0.05, 0.02, C.dark, 0, 0.98, 0.23), box(0.2, 0.14, 0.02, TRIM, 0, 0.74, 0.23));
  return g;
}

export function planter() {
  const g = new THREE.Group();
  g.add(rbox(0.9, 0.45, 0.9, 0xe08a60, 0, 0.22, 0, 0.12), sphere(0.5, 0x6fcb78, 0, 0.7, 0, 1, 0.8, 1));
  for (const [x, z] of [[0.25, 0.2], [-0.25, 0.15], [0, -0.3], [0.1, 0.35], [-0.3, -0.2]]) g.add(sphere(0.11, x > 0 ? 0xff8fb0 : C.cheese, x, 1.0 - Math.abs(x) * 0.5, z));
  return g;
}

export function cafeTable() {
  const g = new THREE.Group();
  g.add(cyl(0.45, 0.45, 0.06, TRIM, 0, 0.75, 0, 14), cyl(0.05, 0.05, 2.3, 0x5a6088, 0, 1.15, 0, 6), cyl(0.25, 0.25, 0.05, 0x5a6088, 0, 0.03, 0, 10));
  g.add(cyl(0.04, 1.05, 0.45, C.tomato, 0, 2.4, 0, 10), cyl(1.05, 1.05, 0.08, TRIM, 0, 2.16, 0, 10), sphere(0.09, TRIM, 0, 2.66, 0));
  for (const x of [-0.75, 0.75]) g.add(cyl(0.2, 0.2, 0.08, 0xf7a8c0, x, 0.48, 0, 10), cyl(0.04, 0.04, 0.45, 0x5a6088, x, 0.22, 0, 6));
  return g;
}

export function cloud() {
  const g = new THREE.Group();
  g.add(sphere(1.6, 0xffffff, 0, 0, 0, 1, 0.8, 1), sphere(1.2, 0xffffff, 1.6, -0.2, 0, 1, 0.8, 1), sphere(1.1, 0xffffff, -1.5, -0.25, 0, 1, 0.8, 1), sphere(1.0, 0xffffff, 0.5, 0.6, 0, 1, 0.8, 1));
  return g;
}

/** Road + sidewalks spanning z in [-len, 0]. */
export function road(len: number, crosswalk = true) {
  const g = new THREE.Group();
  g.add(box(ROAD_HALF * 2, 0.1, len, C.asphalt, 0, -0.05, -len / 2));
  for (const x of [-1, 1]) {
    g.add(box(WALK, 0.25, len, C.sidewalk, x * (ROAD_HALF + WALK / 2), 0.025, -len / 2));
    g.add(box(0.14, 0.02, len, C.cheese, x * (ROAD_HALF - 0.2), 0.01, -len / 2)); // kerb line
    for (let z = 1.5; z < len; z += 4) g.add(box(0.16, 0.02, 1.6, C.cream, x * (LANE / 2), 0.01, -z));
  }
  if (crosswalk) for (let i = 0; i < 9; i++) g.add(box(0.42, 0.02, 2.2, C.cream, (i - 4) * 0.7, 0.012, -len + 1.6));
  return g;
}

/** One block of city: road, sidewalks, buildings on both sides, street furniture. Spans z in [-len, 0]. */
export function streetChunk(len: number, seed: number) {
  const r = rng(seed);
  const g = road(len);
  const kinds: BuildingKind[] = ['brownstone', 'shop', 'pizzeria', 'tower', 'cafe', 'apartment', 'shop', 'brownstone'];
  for (const side of [-1, 1]) {
    let z = 0.5;
    for (;;) {
      const kind = kinds[Math.floor(r() * kinds.length)];
      const w = WIDTH[kind];
      if (z + w > len) break;
      const b = building(kind, Math.floor(r() * 1e9));
      b.rotation.y = (-side * Math.PI) / 2; // shopfront faces the road
      b.position.set(side * (ROAD_HALF + WALK + DEPTH / 2), 0.15, -(z + w / 2));
      g.add(b);
      z += w + (r() < 0.25 ? 1.2 : 0.15);
    }
    for (let lz = 5; lz < len; lz += 20) {
      const l = lamp();
      l.rotation.y = side > 0 ? Math.PI : 0; // arm reaches over the road
      l.position.set(side * (ROAD_HALF + 0.4), 0.15, -lz);
      g.add(l);
    }
    for (let pz = 12; pz < len; pz += 9) {
      const pick = r();
      // kerb-side things, then things that sit back against the shopfronts
      const [p, back] = pick < 0.35 ? [tree(), false] : pick < 0.45 ? [hydrant(), false] : pick < 0.55 ? [mailbox(), false] : pick < 0.7 ? [planter(), false] : pick < 0.85 ? [bench(), true] : [cafeTable(), true];
      p.rotation.y = (-side * Math.PI) / 2; // face the road
      p.position.set(side * (ROAD_HALF + (back ? 1.9 : 0.8)), 0.15, -pz - r() * 3);
      g.add(p);
    }
    const c = cloud();
    c.position.set(side * (10 + r() * 14), 22 + r() * 8, -r() * len);
    g.add(c);
  }
  return g;
}

export function sky() {
  const cv = document.createElement('canvas');
  cv.width = 2;
  cv.height = 256;
  const ctx = cv.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#7ec8f5');
  grad.addColorStop(0.5, '#ffc6d9');
  grad.addColorStop(0.75, '#ffe6bf');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export const FOG = 0xffdccf;

export function lights(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0xc9b8e8, 1.7));
  const sun = new THREE.DirectionalLight(0xfff1dd, 1.9);
  sun.position.set(-4, 6, 5);
  scene.add(sun);
}
