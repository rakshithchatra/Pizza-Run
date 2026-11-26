import * as THREE from 'three';
import { box, C, cyl, mat, sign, sphere } from './util';

const wedge = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, -0.32);
  s.lineTo(0.26, 0.26);
  s.lineTo(-0.26, 0.26);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: false });
  g.translate(0, 0, -0.035);
  return g;
})();

function pepperoni(x: number, y: number, r: number, thick: number) {
  const p = cyl(r, r, thick, C.pepperoni, x, y, 0, 8);
  p.rotation.x = Math.PI / 2;
  return p;
}

/** The pizza point: an upright slice, centred on the origin. Spin it on Y. */
export function slice() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(wedge, mat(C.cheese, true)));
  g.add(box(0.6, 0.12, 0.13, C.crust, 0, 0.3, 0));
  g.add(pepperoni(-0.09, 0.13, 0.06, 0.09), pepperoni(0.09, 0.08, 0.06, 0.09), pepperoni(0, -0.1, 0.05, 0.09));
  return g;
}

/** Rare whole pie, worth 10. Upright, faces +Z and -Z. */
export function pie() {
  const g = new THREE.Group();
  const flat = new THREE.Group();
  flat.add(cyl(0.46, 0.46, 0.07, C.crust, 0, 0, 0, 14), cyl(0.39, 0.39, 0.09, C.cheese, 0, 0, 0, 14, true));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    flat.add(cyl(0.07, 0.07, 0.11, C.pepperoni, Math.cos(a) * 0.24, 0, Math.sin(a) * 0.24, 8));
  }
  flat.add(cyl(0.07, 0.07, 0.11, C.pepperoni, 0, 0, 0, 8));
  flat.rotation.x = Math.PI / 2;
  g.add(flat);
  return g;
}

const ARC = new THREE.TorusGeometry(0.26, 0.1, 8, 14, Math.PI);

/** Power-ups: magnet pulls pizzas in, x2 doubles them. Upright, spin on Y. */
export function powerup(kind: 'magnet' | 'x2') {
  const g = new THREE.Group();
  if (kind === 'magnet') {
    g.add(new THREE.Mesh(ARC, mat(C.tomato, false, true)));
    for (const x of [-0.26, 0.26]) g.add(cyl(0.1, 0.1, 0.26, C.tomato, x, -0.13, 0, 10), cyl(0.1, 0.1, 0.14, C.white, x, -0.33, 0, 10, true));
    g.position.y = 0.05;
  } else {
    const coin = cyl(0.46, 0.46, 0.1, C.basil, 0, 0, 0, 16, true);
    coin.rotation.x = Math.PI / 2;
    g.add(coin, sphere(0.5, C.cream, 0, 0, 0, 1, 1, 0.08));
    for (const side of [1, -1]) {
      const s = sign('2x', 0.7, 0.5, C.basil, 0xffffff);
      s.position.z = side * 0.06;
      s.rotation.y = side > 0 ? 0 : Math.PI;
      g.add(s);
    }
  }
  const out = new THREE.Group(); // wrapper so the offset above survives baking
  out.add(g);
  return out;
}
