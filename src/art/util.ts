import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const C = {
  tomato: 0xe23d28,
  cream: 0xfff1d0,
  basil: 0x4faa5c,
  crust: 0xe0a440,
  cheese: 0xffc94a,
  pepperoni: 0xb8261a,
  navy: 0x1c2340,
  asphalt: 0x525b82,
  sidewalk: 0xd9d3e3,
  glass: 0x4a5fa8,
  lit: 0xfff0a8,
  brick: 0x9c4a3a,
  white: 0xf7f4ec,
  dark: 0x2a2d4a,
  wood: 0xb9854a,
  taxi: 0xf5b82e,
  orange: 0xf07a1f,
};

// One material per colour, one geometry per shape: every mesh is a scaled
// instance of these, so the whole city shares a handful of GPU buffers.
const mats = new Map<string, THREE.Material>();
export function mat(color: number, glow = false, smooth = false): THREE.Material {
  const key = `${color}${glow ? 'g' : smooth ? 's' : ''}`;
  let m = mats.get(key);
  if (!m) {
    m = glow
      ? new THREE.MeshBasicMaterial({ color })
      : new THREE.MeshLambertMaterial({ color, flatShading: !smooth });
    mats.set(key, m);
  }
  return m;
}

const BOX = new THREE.BoxGeometry(1, 1, 1);
export function box(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0, glow = false) {
  const m = new THREE.Mesh(BOX, mat(color, glow));
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  return m;
}

const cyls = new Map<string, THREE.CylinderGeometry>();
/** Cylinder along Y. rTop/rBot are radii. */
export function cyl(rTop: number, rBot: number, h: number, color: number, x = 0, y = 0, z = 0, seg = 10, glow = false) {
  const key = `${(rTop / rBot).toFixed(3)}:${seg}`;
  let g = cyls.get(key);
  if (!g) cyls.set(key, (g = new THREE.CylinderGeometry(rTop / rBot, 1, 1, seg)));
  const m = new THREE.Mesh(g, mat(color, glow));
  m.scale.set(rBot, h, rBot);
  m.position.set(x, y, z);
  return m;
}

// Soft shapes: the look is rounded and toy-like, so most solid parts use these.
const rboxes = new Map<string, THREE.BufferGeometry>();
export function rbox(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0, r = Math.min(w, h, d) * 0.3, glow = false) {
  const key = `${w},${h},${d},${r}`;
  let g = rboxes.get(key);
  if (!g) rboxes.set(key, (g = new RoundedBoxGeometry(w, h, d, 2, r)));
  const m = new THREE.Mesh(g, mat(color, glow, true));
  m.position.set(x, y, z);
  return m;
}

const SPHERE = new THREE.SphereGeometry(1, 12, 8);
export function sphere(r: number, color: number, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, glow = false) {
  const m = new THREE.Mesh(SPHERE, mat(color, glow, true));
  m.scale.set(r * sx, r * sy, r * sz);
  m.position.set(x, y, z);
  return m;
}

const capsules = new Map<string, THREE.BufferGeometry>();
/** Capsule along Y; len is the straight part, so total height is len + 2r. */
export function capsule(r: number, len: number, color: number, x = 0, y = 0, z = 0) {
  const key = `${r},${len}`;
  let g = capsules.get(key);
  if (!g) capsules.set(key, (g = new THREE.CapsuleGeometry(r, len, 4, 10)));
  const m = new THREE.Mesh(g, mat(color, false, true));
  m.position.set(x, y, z);
  return m;
}

const ICO = new THREE.IcosahedronGeometry(1, 0);
export function ico(r: number, color: number, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(ICO, mat(color));
  m.scale.setScalar(r);
  m.position.set(x, y, z);
  return m;
}

/** Flat text sign, facing +Z. */
export function sign(text: string, w: number, h: number, bg: number, fg: number) {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = Math.round((256 * h) / w);
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = `#${bg.toString(16).padStart(6, '0')}`;
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = `#${fg.toString(16).padStart(6, '0')}`;
  ctx.font = `900 ${cv.height * 0.72}px ui-rounded, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cv.width / 2, cv.height / 2 + cv.height * 0.04, cv.width * 0.9);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
}

export { rng } from '../rng';

/**
 * Collapse a model into one mesh per material. A street block is ~700 small meshes;
 * baked it is ~30 draw calls, which is what keeps phones at 60fps.
 * Call before positioning: the model's own transform is baked in too.
 */
export function bake(src: THREE.Object3D) {
  src.updateMatrixWorld(true);
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  src.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    g.applyMatrix4(m.matrixWorld);
    const list = byMat.get(m.material as THREE.Material);
    if (list) list.push(g);
    else byMat.set(m.material as THREE.Material, [g]);
  });
  const out = new THREE.Group();
  for (const [material, geos] of byMat) out.add(new THREE.Mesh(mergeGeometries(geos), material));
  return out;
}
