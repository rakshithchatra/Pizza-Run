import * as THREE from 'three';
import { box, C, capsule, cyl, mat, rbox, sphere } from './util';

export type CharacterId = 'rider' | 'chef' | 'skater';
export type Pose = 'idle' | 'run' | 'jump' | 'slide' | 'stumble';

export const CHARACTERS: { id: CharacterId; name: string; blurb: string }[] = [
  { id: 'rider', name: 'Rico', blurb: 'Delivery rider. Never late, rarely careful.' },
  { id: 'chef', name: 'Nonna Bea', blurb: 'Left the kitchen to chase a runaway order.' },
  { id: 'skater', name: 'Slice', blurb: 'Skater kid. Will run for free pizza.' },
];

export interface Character {
  /** Feet at the origin, facing +Z. */
  group: THREE.Group;
  animate(pose: Pose, t: number): void;
}

const SMILE = new THREE.TorusGeometry(0.06, 0.016, 6, 10, Math.PI);

// Toy proportions: big soft head, small body, stubby limbs.
export function character(id: CharacterId): Character {
  const look = {
    rider: { skin: 0xf0b98a, top: C.tomato, pants: 0x3b4a8a, shoes: C.cream, hair: 0x4a2f22 },
    chef: { skin: 0xa86a3d, top: C.white, pants: 0x5a6088, shoes: 0x3a3d5c, hair: 0xd8d8e4 },
    skater: { skin: 0xffd3a8, top: C.basil, pants: 0x6a5f8f, shoes: C.tomato, hair: 0x8a5a2e },
  }[id];

  const group = new THREE.Group();
  const body = new THREE.Group(); // pivots at the feet
  group.add(body);

  const torso = new THREE.Group(); // pivots at the hips
  torso.position.y = 0.5;
  body.add(torso);
  torso.add(rbox(0.56, 0.52, 0.4, look.top, 0, 0.28, 0, 0.16));

  const head = new THREE.Group();
  head.position.y = 0.5;
  torso.add(head);
  head.add(rbox(0.72, 0.64, 0.64, look.skin, 0, 0.32, 0, 0.24));
  // the beanie covers the skater's hair, so he only gets a fringe
  head.add(id === 'skater' ? rbox(0.5, 0.14, 0.1, look.hair, 0, 0.5, 0.3, 0.05) : rbox(0.76, 0.3, 0.68, look.hair, 0, 0.54, -0.03, 0.14));
  for (const x of [-0.15, 0.15]) {
    head.add(sphere(0.065, 0x2a2140, x, 0.3, 0.32, 1, 1.4, 0.4));
    head.add(sphere(0.022, 0xffffff, x + 0.02, 0.34, 0.345, 1, 1, 1, true));
    head.add(sphere(0.06, 0xff8f85, x * 1.7, 0.19, 0.31, 1, 0.7, 0.3)); // cheek
  }
  const smile = new THREE.Mesh(SMILE, mat(0x2a2140, true));
  smile.position.set(0, 0.19, 0.325);
  smile.rotation.z = Math.PI;
  head.add(smile);

  const limb = (parent: THREE.Group, x: number, y: number, parts: THREE.Mesh[]) => {
    const g = new THREE.Group();
    g.position.set(x, y, 0);
    g.add(...parts);
    parent.add(g);
    return g;
  };
  const arm = (x: number) => limb(torso, x, 0.44, [capsule(0.085, 0.24, look.top, 0, -0.2, 0), sphere(0.1, look.skin, 0, -0.44, 0)]);
  const leg = (x: number) => limb(body, x, 0.5, [capsule(0.11, 0.26, look.pants, 0, -0.22, 0), rbox(0.24, 0.16, 0.38, look.shoes, 0, -0.42, 0.06, 0.07)]);
  const armL = arm(-0.37), armR = arm(0.37), legL = leg(-0.15), legR = leg(0.15);

  if (id === 'rider') {
    head.add(rbox(0.78, 0.24, 0.72, C.tomato, 0, 0.6, 0, 0.11), rbox(0.5, 0.06, 0.3, C.tomato, 0, 0.52, 0.44, 0.03));
    head.add(sphere(0.07, C.cheese, 0, 0.62, 0.35, 1, 1, 0.4, true)); // cap badge
    // insulated delivery bag
    torso.add(rbox(0.54, 0.5, 0.3, C.tomato, 0, 0.3, -0.36, 0.08), rbox(0.56, 0.1, 0.32, C.cream, 0, 0.34, -0.36, 0.04));
  } else if (id === 'chef') {
    head.add(cyl(0.27, 0.27, 0.2, C.white, 0, 0.72, 0, 14));
    head.add(sphere(0.24, C.white, 0, 0.95, 0), sphere(0.2, C.white, -0.18, 0.9, 0), sphere(0.2, C.white, 0.18, 0.9, 0), sphere(0.2, C.white, 0, 0.9, 0.16), sphere(0.2, C.white, 0, 0.9, -0.16));
    head.add(sphere(0.16, look.hair, 0, 0.4, -0.38)); // bun
    torso.add(rbox(0.5, 0.1, 0.42, C.tomato, 0, 0.5, 0, 0.05)); // neckerchief
    torso.add(box(0.4, 0.34, 0.03, C.cream, 0, 0.2, 0.2)); // apron
  } else {
    head.add(sphere(0.41, C.crust, 0, 0.5, 0, 1, 0.75, 0.9), sphere(0.1, C.tomato, 0, 0.83, 0)); // beanie + pompom
    torso.add(rbox(0.44, 0.26, 0.2, C.basil, 0, 0.5, -0.26, 0.09)); // hood
    const board = new THREE.Group(); // skateboard strapped on the back
    board.add(rbox(0.24, 0.9, 0.06, C.crust, 0, 0, 0, 0.03));
    for (const x of [-0.08, 0.08]) for (const y of [-0.3, 0.3]) board.add(sphere(0.05, C.dark, x, y, -0.06));
    board.position.set(0, 0.3, -0.26);
    board.rotation.z = 0.35;
    torso.add(board);
  }

  function animate(pose: Pose, t: number) {
    body.position.y = 0;
    body.rotation.set(0, 0, 0);
    head.rotation.z = 0;
    let lean = 0, aL = 0, aR = 0, lL = 0, lR = 0; // limb angles: + swings back, - forward
    if (pose === 'run') {
      const s = Math.sin(t * 11);
      lL = s * 0.95; lR = -lL; aL = -s * 0.9; aR = -aL;
      body.position.y = Math.abs(Math.cos(t * 11)) * 0.07;
      head.rotation.z = s * 0.05;
      lean = 0.14;
    } else if (pose === 'jump') {
      lL = -1.0; lR = 0.6; aL = aR = -2.6;
    } else if (pose === 'slide') {
      body.rotation.x = -1.2; body.position.y = 0.2;
      lL = -0.1; lR = -0.55; aL = aR = 0.5;
    } else if (pose === 'stumble') {
      body.rotation.z = Math.sin(t * 30) * 0.15;
      aL = -1.6; aR = -1.2; lL = 0.3; lR = -0.3; lean = -0.2;
    } else {
      aL = Math.sin(t * 2) * 0.06; aR = -aL;
      head.rotation.z = Math.sin(t * 1.5) * 0.04;
    }
    torso.rotation.x = lean;
    armL.rotation.x = aL; armR.rotation.x = aR;
    legL.rotation.x = lL; legR.rotation.x = lR;
  }
  animate('idle', 0);
  return { group, animate };
}
