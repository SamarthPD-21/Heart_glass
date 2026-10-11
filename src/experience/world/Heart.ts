import * as THREE from 'three/webgpu';
import gsap from 'gsap';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { createHeartMaterials, uBeat, uColor } from '../materials/heart';
import { createGoldMaterial } from '../materials/environment';
import { drawSticker } from '../../lib/stickers';
import { rng } from '../../lib/random';
import type { HeartConfig, MaterialId, Sticker, StickerId } from '../../lib/heartConfig';

function heartGeometry() {
  // Classic bezier heart (upside-down in shape space; flipped below)
  const s = new THREE.Shape()
    .moveTo(25, 25)
    .bezierCurveTo(25, 25, 20, 0, 0, 0)
    .bezierCurveTo(-30, 0, -30, 35, -30, 35)
    .bezierCurveTo(-30, 55, -10, 77, 25, 95)
    .bezierCurveTo(60, 77, 80, 55, 80, 35)
    .bezierCurveTo(80, 35, 80, 0, 50, 0)
    .bezierCurveTo(35, 0, 25, 25, 25, 25);

  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 14, bevelEnabled: true, bevelSegments: 14, bevelSize: 13, bevelThickness: 16, curveSegments: 48,
  });
  geo.center();
  geo.rotateZ(Math.PI);
  geo.scale(0.0105, 0.0105, 0.0105); // ~1.2 m tall
  geo.computeVertexNormals();
  return geo;
}

/** Two-pulse "lub-dub" at ~65 bpm, 0..1. */
function beat(t: number) {
  const period = 60 / 65;
  const ph = (t % period) / period;
  const g = (c: number, w: number) => Math.exp(-(((ph - c) / w) ** 2));
  return g(0.06, 0.05) + 0.55 * g(0.26, 0.05);
}

const STICKER_SIZE = 0.24;

interface Piece { from: THREE.Vector3; ctrl: THREE.Vector3; to: THREE.Vector3; delay: number; spin: THREE.Euler; scale: number }

export class Heart {
  readonly group = new THREE.Group(); // placed at the heart position; scaled for reveals
  private float = new THREE.Group();  // idle bob; stickers live in this space
  private meshes: Record<MaterialId, THREE.Mesh>;
  private ring: THREE.Mesh;
  private pearls: THREE.InstancedMesh;
  private frames: THREE.Group;
  private stickers = new THREE.Group();
  private stickerTextures = new Map<StickerId, THREE.CanvasTexture>();
  private stickerKey = '';
  private current: HeartConfig | null = null;
  private pieces: THREE.InstancedMesh;
  private pieceData: Piece[] = [];
  private assembleT = -1;
  private assembleDur = 0;
  private onAssembled: (() => void) | null = null;
  private idleWeight = 1;

  constructor(position: THREE.Vector3, lowTier: boolean) {
    this.group.position.copy(position);
    this.group.add(this.float);

    const geo = heartGeometry();
    const mats = createHeartMaterials(lowTier);
    // One mesh per preset, sharing geometry: switching = toggling visibility, and every
    // pipeline is compiled up front, so swaps never hitch.
    this.meshes = {
      gold: new THREE.Mesh(geo, mats.gold),
      glass: new THREE.Mesh(geo, mats.glass),
      velvet: new THREE.Mesh(geo, mats.velvet),
    };
    Object.values(this.meshes).forEach((m) => {
      m.visible = false;
      this.float.add(m);
    });
    this.float.add(this.stickers);

    this.frames = new THREE.Group();
    this.float.add(this.frames);

    const gold = createGoldMaterial();
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.035, 12, 96), gold);

    const pearlMat = new THREE.MeshPhysicalNodeMaterial({ color: '#F4EDE2', roughness: 0.25, clearcoat: 1, sheen: 0.4 });
    const count = 28;
    this.pearls = new THREE.InstancedMesh(new THREE.SphereGeometry(0.055, 16, 12), pearlMat, count);
    const m = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      m.makeTranslation(Math.cos(a) * 1.0, Math.sin(a) * 1.0, 0);
      this.pearls.setMatrixAt(i, m);
    }
    this.ring.visible = this.pearls.visible = false;
    this.frames.add(this.ring, this.pearls);

    // Shards that fly in and assemble the heart (same color uniform as the heart)
    this.pieces = this.buildPieces(geo, mats.gold, lowTier ? 50 : 110);

    this.group.visible = false;
  }

  /* ---------------------------------------------------------------- assembly */

  private buildPieces(heartGeo: THREE.BufferGeometry, mat: THREE.Material, n: number) {
    const shardGeo = new THREE.TetrahedronGeometry(0.11, 0);
    const im = new THREE.InstancedMesh(shardGeo, mat, n);
    im.frustumCulled = false;
    im.visible = false;
    const r = rng(21);
    const pos = heartGeo.attributes.position;
    for (let i = 0; i < n; i++) {
      const to = new THREE.Vector3().fromBufferAttribute(pos, Math.floor(r() * pos.count)).multiplyScalar(0.92);
      const a = r() * Math.PI * 2, e = (r() - 0.3) * 1.2, d = 3 + r() * 3;
      const from = new THREE.Vector3(Math.cos(a) * Math.cos(e) * d, Math.sin(e) * d - 1.5, Math.sin(a) * Math.cos(e) * d);
      const ctrl = from.clone().lerp(to, 0.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), 1.4).add(new THREE.Vector3(0, 1.2, 0));
      // Outer pieces first, the core last
      const delay = (1 - Math.min(1, to.length() / 0.75)) * 0.55 + r() * 0.25;
      this.pieceData.push({ from, ctrl, to, delay, spin: new THREE.Euler(r() * 9, r() * 9, r() * 9), scale: 0.5 + r() * 0.9 });
    }
    this.float.add(im);
    return im;
  }

  /** Shards swirl in and lock into place, then the solid heart appears under a glow. */
  assemble(duration: number, onDone: () => void) {
    this.group.visible = true;
    this.group.scale.setScalar(1);
    Object.values(this.meshes).forEach((m) => (m.visible = false));
    this.frames.visible = this.stickers.visible = false;
    this.pieces.visible = true;
    this.assembleT = 0;
    this.assembleDur = duration;
    this.onAssembled = onDone;
  }

  private updatePieces(dt: number) {
    if (this.assembleT < 0) return;
    this.assembleT += dt;
    const k = this.assembleT / this.assembleDur; // 0..1 overall
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const e = new THREE.Euler();
    const ease = (x: number) => 1 - Math.pow(1 - x, 3);
    this.pieceData.forEach((d, i) => {
      const t = THREE.MathUtils.clamp((k - d.delay * 0.7) / 0.55, 0, 1);
      const u = ease(t);
      // Quadratic bezier from -> ctrl -> to
      p.copy(d.from).multiplyScalar((1 - u) * (1 - u))
        .addScaledVector(d.ctrl, 2 * (1 - u) * u)
        .addScaledVector(d.to, u * u);
      e.set(d.spin.x * (1 - u), d.spin.y * (1 - u), d.spin.z * (1 - u));
      q.setFromEuler(e);
      s.setScalar(d.scale * (0.35 + 0.65 * (1 - u * 0.6)));
      m.compose(p, q, s);
      this.pieces.setMatrixAt(i, m);
    });
    this.pieces.instanceMatrix.needsUpdate = true;

    if (k >= 1) {
      this.assembleT = -1;
      this.pieces.visible = false;
      this.frames.visible = this.stickers.visible = true;
      if (this.current) this.apply(this.current, true);
      gsap.fromTo(this.float.scale, { x: 0.9, y: 0.9, z: 0.9 }, { x: 1, y: 1, z: 1, duration: 0.9, ease: 'elastic.out(1, 0.5)' });
      const done = this.onAssembled;
      this.onAssembled = null;
      done?.();
    }
  }

  /* ---------------------------------------------------------------- config */

  /** Everything visible at once (used only for pre-compiling pipelines). */
  showAllForCompile(on: boolean) {
    Object.values(this.meshes).forEach((m) => (m.visible = on));
    this.ring.visible = this.pearls.visible = this.pieces.visible = on;
    if (!on && this.current) this.apply(this.current, true);
  }

  apply(cfg: HeartConfig, instant = false) {
    const prev = this.current;
    this.current = { ...cfg };

    const c = new THREE.Color(cfg.c);
    if (instant || !prev) uColor.value.copy(c);
    else gsap.to(uColor.value, { r: c.r, g: c.g, b: c.b, duration: 0.4, ease: 'power2.out' });

    if (this.assembleT < 0) {
      (Object.keys(this.meshes) as MaterialId[]).forEach((k) => (this.meshes[k].visible = k === cfg.m));
    }
    if (!instant && prev && prev.m !== cfg.m) {
      gsap.fromTo(this.float.scale, { x: 0.94, y: 0.94, z: 0.94 }, { x: 1, y: 1, z: 1, duration: 0.5, ease: 'back.out(3)' });
    }

    const showFrame = (obj: THREE.Object3D, on: boolean) => {
      if (on && !obj.visible) {
        obj.visible = true;
        if (!instant) gsap.fromTo(obj.scale, { x: 0.01, y: 0.01, z: 0.01 }, { x: 1, y: 1, z: 1, duration: 0.45, ease: 'back.out(1.7)' });
      } else if (!on) obj.visible = false;
    };
    showFrame(this.ring, cfg.f === 0);
    showFrame(this.pearls, cfg.f === 1);

    const key = JSON.stringify(cfg.st ?? []);
    if (key !== this.stickerKey) {
      this.stickerKey = key;
      this.rebuildStickers(cfg.st ?? []);
    }
  }

  /** Reveal: grow in from nothing (used by the recipient view and reduced motion). */
  reveal(duration: number) {
    this.group.visible = true;
    gsap.fromTo(this.group.scale, { x: 0.001, y: 0.001, z: 0.001 }, { x: 1, y: 1, z: 1, duration, ease: 'expo.out' });
    gsap.from(this.group.position, { y: this.group.position.y - 1, duration, ease: 'expo.out' });
  }

  /* ---------------------------------------------------------------- stickers */

  private texture(id: StickerId) {
    let t = this.stickerTextures.get(id);
    if (!t) {
      t = new THREE.CanvasTexture(drawSticker(id, 256));
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      this.stickerTextures.set(id, t);
    }
    return t;
  }

  /** Runs `fn` with the heart in its neutral pose so projections are exact. */
  private atRest<T>(fn: () => T): T {
    const p = this.float.position.clone(), r = this.float.rotation.clone(), s = this.float.scale.clone();
    const gs = this.group.scale.clone();
    this.float.position.set(0, 0, 0);
    this.float.rotation.set(0, 0, 0);
    this.float.scale.setScalar(1);
    this.group.scale.setScalar(1);
    this.group.updateMatrixWorld(true);
    try {
      return fn();
    } finally {
      this.float.position.copy(p);
      this.float.rotation.copy(r);
      this.float.scale.copy(s);
      this.group.scale.copy(gs);
      this.group.updateMatrixWorld(true);
    }
  }

  private makeDecal(st: Sticker) {
    const target = this.meshes.gold; // all presets share one geometry
    const pWorld = this.float.localToWorld(new THREE.Vector3(...st.p));
    const nWorld = new THREE.Vector3(...st.n).transformDirection(this.float.matrixWorld);
    const helper = new THREE.Object3D();
    helper.position.copy(pWorld);
    helper.lookAt(pWorld.clone().add(nWorld));
    helper.rotation.z += st.r;
    const geo = new DecalGeometry(target, pWorld, helper.rotation, new THREE.Vector3(STICKER_SIZE, STICKER_SIZE, 0.3));
    geo.applyMatrix4(this.float.matrixWorld.clone().invert()); // world → heart-local
    const mat = new THREE.MeshStandardNodeMaterial({
      map: this.texture(st.id), transparent: true, alphaTest: 0.05, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -4, roughness: 0.45,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 3;
    return mesh;
  }

  private rebuildStickers(list: Sticker[]) {
    this.stickers.children.slice().forEach((c) => {
      const m = c as THREE.Mesh;
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
      this.stickers.remove(m);
    });
    this.atRest(() => list.forEach((st) => this.stickers.add(this.makeDecal(st))));
  }

  /** Raycast the heart; returns a sticker in heart-local space, or null on a miss. */
  pickSticker(raycaster: THREE.Raycaster, id: StickerId): Sticker | null {
    const visible = Object.values(this.meshes).find((m) => m.visible);
    if (!visible) return null;
    const hit = raycaster.intersectObject(visible, false)[0];
    if (!hit?.face) return null;
    const p = this.float.worldToLocal(hit.point.clone());
    const n = hit.face.normal.clone(); // geometry space == float space (meshes have identity transforms)
    return { id, p: [p.x, p.y, p.z], n: [n.x, n.y, n.z], r: (Math.random() - 0.5) * 0.8 };
  }

  update(time: number, dt: number, still: boolean) {
    uBeat.value = beat(time);
    this.updatePieces(dt);
    if (still) return;
    this.float.position.y = Math.sin(time * 1.1) * 0.06 * this.idleWeight;
    this.float.rotation.y = Math.sin(time * 0.35) * 0.12 * this.idleWeight;
    this.frames.rotation.z = time * 0.15;
  }

  /** Calm the idle motion while placing stickers so the target doesn't drift. */
  setCalm(on: boolean) {
    gsap.to(this, { idleWeight: on ? 0.15 : 1, duration: 0.6 });
  }
}
