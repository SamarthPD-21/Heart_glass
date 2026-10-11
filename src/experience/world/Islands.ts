import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, smoothstep } from '../../lib/random';
import { createEnvironmentMaterial } from '../materials/environment';

/**
 * Procedural floating islands: a faceted rock base + broken columns + one hero prop,
 * merged into a single geometry (1 draw call per island). Materials come from
 * vertex colors: R = gold mask, G = fake AO.
 */

export type HeroKind = 'intro' | 'arch' | 'orb' | 'hourglass' | 'pedestal';

export interface IslandDef {
  position: THREE.Vector3;
  radius: number;
  seed: number;
  hero: HeroKind;
  columns: number;
}

export const ISLANDS: IslandDef[] = [
  { position: new THREE.Vector3(0, 0, 20), radius: 6, seed: 7, hero: 'intro', columns: 6 },
  { position: new THREE.Vector3(-6, 0, -30), radius: 5, seed: 11, hero: 'arch', columns: 7 },
  { position: new THREE.Vector3(7, 2.5, -62), radius: 5.5, seed: 23, hero: 'orb', columns: 9 },
  { position: new THREE.Vector3(-4, 1, -94), radius: 5, seed: 37, hero: 'hourglass', columns: 8 },
  { position: new THREE.Vector3(0, 1.4, -120), radius: 3, seed: 41, hero: 'pedestal', columns: 0 },
];

/** Where the heart floats (above the pedestal island). */
export const HEART_POSITION = new THREE.Vector3(0, 4.1, -120);

const Y_MIN = -3;
const Y_MAX = 4;

/** Normalize a piece for merging (non-indexed, same attribute set) and paint its vertex colors. */
function paint(geo: THREE.BufferGeometry, gold: number): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const h = smoothstep(Y_MIN, Y_MAX, pos.getY(i));
    col[i * 3] = gold;
    col[i * 3 + 1] = 0.35 + 0.65 * h;
    col[i * 3 + 2] = 0;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2));
  return g;
}

/** Deterministic per-position noise so duplicated (non-indexed) vertices move together. */
function hash3(x: number, y: number, z: number) {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return s - Math.floor(s);
}

function rock(radius: number) {
  const geo = new THREE.IcosahedronGeometry(radius, 3);
  const p = geo.attributes.position;
  const top = radius * 0.12;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = hash3(Math.round(x * 100), Math.round(y * 100), Math.round(z * 100));
    const k = 0.85 + n * 0.3;
    x *= k;
    z *= k;
    y = y * (y < 0 ? 0.65 : 0.4) * k;
    if (y > top) y = top; // flat top to stand things on
    p.setXYZ(i, x, y - top, z);
  }
  geo.computeVertexNormals();
  return paint(geo, 0);
}

function column(r: () => number, x: number, z: number, maxH: number): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  const radius = 0.22 + r() * 0.12;
  const lying = r() < 0.25;
  const h = lying ? 1.2 + r() * 1.4 : 0.6 + r() * maxH;

  const shaft = new THREE.CylinderGeometry(radius, radius * 1.05, h, 14, 1);
  const base = new THREE.BoxGeometry(radius * 2.8, 0.18, radius * 2.8);
  base.translate(0, -h / 2 + 0.09, 0);

  const m = new THREE.Matrix4();
  if (lying) {
    m.makeRotationZ(Math.PI / 2).premultiply(new THREE.Matrix4().makeRotationY(r() * Math.PI));
    m.setPosition(x, radius, z);
    shaft.applyMatrix4(m);
    out.push(paint(shaft, 0));
    return out;
  }

  const tilt = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler((r() - 0.5) * 0.12, r() * Math.PI, (r() - 0.5) * 0.12));
  m.copy(tilt).setPosition(x, h / 2, z);
  shaft.applyMatrix4(m);
  base.applyMatrix4(m);
  out.push(paint(shaft, 0), paint(base, 0));

  // Tall, intact columns get a gold capital
  if (h > maxH * 0.55) {
    const cap = new THREE.BoxGeometry(radius * 2.9, 0.22, radius * 2.9);
    cap.translate(0, h / 2 + 0.11, 0);
    cap.applyMatrix4(m);
    out.push(paint(cap, 1));
  }
  return out;
}

function hero(kind: HeroKind): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, gold: number, x = 0, y = 0, z = 0) => {
    g.translate(x, y, z);
    parts.push(paint(g, gold));
  };

  switch (kind) {
    case 'arch': {
      add(new THREE.BoxGeometry(0.5, 2.6, 0.5), 0, -1.3, 1.3, 0);
      add(new THREE.BoxGeometry(0.5, 2.6, 0.5), 0, 1.3, 1.3, 0);
      const arc = new THREE.TorusGeometry(1.3, 0.2, 12, 32, Math.PI);
      add(arc, 1, 0, 2.6, 0);
      add(new THREE.BoxGeometry(3.4, 0.2, 1.2), 0, 0, 0.1, 0);
      break;
    }
    case 'orb': {
      add(new THREE.CylinderGeometry(0.7, 0.9, 1.6, 20), 0, 0, 0.8, 0);
      add(new THREE.SphereGeometry(0.75, 32, 20), 1, 0, 2.4, 0);
      const ring = new THREE.TorusGeometry(1.25, 0.04, 8, 64);
      ring.rotateX(Math.PI / 2.4);
      add(ring, 1, 0, 2.4, 0);
      break;
    }
    case 'hourglass': {
      const top = new THREE.ConeGeometry(0.75, 1.2, 24, 1, true);
      top.rotateX(Math.PI);
      add(top, 1, 0, 2.3, 0);
      add(new THREE.ConeGeometry(0.75, 1.2, 24, 1, true), 1, 0, 1.1, 0);
      add(new THREE.CylinderGeometry(0.95, 0.95, 0.15, 24), 0, 0, 3.0, 0);
      add(new THREE.CylinderGeometry(0.95, 0.95, 0.15, 24), 0, 0, 0.42, 0);
      for (const a of [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3]) {
        add(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 8), 1, Math.cos(a) * 0.85, 1.7, Math.sin(a) * 0.85);
      }
      add(new THREE.CylinderGeometry(1.2, 1.3, 0.35, 24), 0, 0, 0.18, 0);
      break;
    }
    case 'pedestal': {
      add(new THREE.CylinderGeometry(1.1, 1.3, 1.1, 32), 0, 0, 0.55, 0);
      const rim = new THREE.TorusGeometry(1.12, 0.06, 10, 48);
      rim.rotateX(Math.PI / 2);
      add(rim, 1, 0, 1.1, 0);
      break;
    }
    case 'intro': {
      // A low dais in front of where the mirror stands
      add(new THREE.CylinderGeometry(2.2, 2.4, 0.25, 40), 0, 0, 0.12, 0);
      const rim = new THREE.TorusGeometry(2.2, 0.05, 8, 64);
      rim.rotateX(Math.PI / 2);
      add(rim, 1, 0, 0.25, 0);
      break;
    }
  }
  return parts;
}

function buildIsland(def: IslandDef): THREE.BufferGeometry {
  const r = rng(def.seed);
  const parts: THREE.BufferGeometry[] = [rock(def.radius), ...hero(def.hero)];

  const clear = def.hero === 'intro' ? 2.8 : 2.2; // keep the hero area free
  let placed = 0, tries = 0;
  while (placed < def.columns && tries++ < 200) {
    const a = r() * Math.PI * 2;
    const d = clear + r() * (def.radius * 0.8 - clear);
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    // On the intro island, leave the camera's side (+z) open
    if (def.hero === 'intro' && z > 1 && Math.abs(x) < 3) continue;
    // ...and keep the space behind the mirror clear (its hidden sky tunnel lives there)
    if (def.hero === 'intro' && z < 0 && Math.abs(x) < 1.8) continue;
    parts.push(...column(r, x, z, 3.6));
    placed++;
  }

  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  if (!merged) throw new Error('Island merge failed: attribute sets differ');
  return merged;
}

const BLOSSOM_COLORS = ['#B3263A', '#C8324A', '#E0475B', '#F28FA2', '#F6D3DA', '#FFFFFF'].map((c) => new THREE.Color(c));

/** Clusters of tiny blossoms around an island's edge: one InstancedMesh (1 draw call) per island. */
function flowers(def: IslandDef, material: THREE.Material, density: number): THREE.InstancedMesh | null {
  if (def.hero === 'intro' || def.hero === 'pedestal' || density === 0) return null;
  const r = rng(def.seed * 13 + 1);
  const clusters = Math.round(8 * density);
  const per = 34;
  const geo = new THREE.IcosahedronGeometry(0.05, 1);
  const mesh = new THREE.InstancedMesh(geo, material, clusters * per);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  let i = 0;
  for (let c = 0; c < clusters; c++) {
    const a = r() * Math.PI * 2;
    const d = def.radius * (0.55 + r() * 0.3);
    const cx = Math.cos(a) * d, cz = Math.sin(a) * d;
    for (let k = 0; k < per; k++) {
      const ra = r() * Math.PI * 2, rd = Math.sqrt(r()) * 0.9;
      p.set(cx + Math.cos(ra) * rd, 0.06 + r() * 0.32 * (1 - rd), cz + Math.sin(ra) * rd);
      s.setScalar(0.6 + r() * 0.9);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, BLOSSOM_COLORS[Math.floor(r() * BLOSSOM_COLORS.length)]);
      i++;
    }
  }
  return mesh;
}

export class Islands {
  readonly group = new THREE.Group();
  readonly material = createEnvironmentMaterial();
  private items: { mesh: THREE.Mesh; base: THREE.Vector3; phase: number; def: IslandDef }[] = [];

  constructor(skipIntro: boolean, flowerDensity: number) {
    const blossomMat = new THREE.MeshStandardNodeMaterial({ roughness: 0.6 });
    for (const def of ISLANDS) {
      if (skipIntro && def.hero === 'intro') continue;
      const mesh = new THREE.Mesh(buildIsland(def), this.material);
      mesh.position.copy(def.position); // hero props face +Z, toward the approaching camera
      const f = flowers(def, blossomMat, flowerDensity);
      if (f) mesh.add(f);
      this.group.add(mesh);
      this.items.push({ mesh, base: def.position.clone(), phase: def.seed * 1.7, def });
    }
  }

  update(time: number, still: boolean) {
    if (still) return;
    for (const it of this.items) {
      if (it.def.hero === 'intro') continue;
      it.mesh.position.y = it.base.y + Math.sin(time * 0.4 + it.phase) * 0.06;
    }
  }

  removeIntro() {
    const i = this.items.findIndex((it) => it.def.hero === 'intro');
    if (i < 0) return;
    const { mesh } = this.items[i];
    this.group.remove(mesh);
    mesh.geometry.dispose();
    this.items.splice(i, 1);
  }
}
