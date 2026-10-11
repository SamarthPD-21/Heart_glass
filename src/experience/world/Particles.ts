import * as THREE from 'three/webgpu';
import { color, float, normalView, positionViewDirection } from 'three/tsl';
import { rng } from '../../lib/random';

/**
 * Petals and gold dust that live in a box around the camera and wrap around it,
 * so a few hundred instances read as endless. Updated on the CPU: simple, identical
 * on both backends, and cheap at these counts.
 */

function petalGeometry() {
  // A small curved, slightly cupped petal
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.05, 0.02, 0.06, 0.08, 0, 0.11);
  s.bezierCurveTo(-0.06, 0.08, -0.05, 0.02, 0, 0);
  const g = new THREE.ShapeGeometry(s, 6);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    p.setZ(i, x * x * 6 - y * 0.25); // cup + curl
  }
  g.translate(0, -0.055, 0);
  g.computeVertexNormals();
  return g;
}

interface Item { p: THREE.Vector3; v: THREE.Vector3; rot: THREE.Euler; spin: THREE.Vector3; phase: number; scale: number }

class Swarm {
  readonly mesh: THREE.InstancedMesh;
  private items: Item[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();

  constructor(
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    count: number,
    private box: THREE.Vector3,
    fall: number,
    seed: number,
    colors?: THREE.Color[],
  ) {
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const r = rng(seed);
    for (let i = 0; i < count; i++) {
      this.items.push({
        p: new THREE.Vector3((r() - 0.5) * box.x, (r() - 0.5) * box.y, (r() - 0.5) * box.z),
        v: new THREE.Vector3((r() - 0.5) * 0.15, -fall * (0.6 + r() * 0.8), (r() - 0.5) * 0.15),
        rot: new THREE.Euler(r() * 6, r() * 6, r() * 6),
        spin: new THREE.Vector3((r() - 0.5) * 2, (r() - 0.5) * 2, (r() - 0.5) * 2),
        phase: r() * 10,
        scale: 1 + r() * 1.2,
      });
      if (colors) this.mesh.setColorAt(i, colors[Math.floor(r() * colors.length)]);
    }
  }

  update(dt: number, time: number, center: THREE.Vector3, wind: number) {
    const half = this.box.clone().multiplyScalar(0.5);
    this.items.forEach((it, i) => {
      it.p.addScaledVector(it.v, dt);
      it.p.x += Math.sin(time * 0.8 + it.phase) * 0.25 * dt + wind * dt;
      it.p.z += Math.cos(time * 0.6 + it.phase) * 0.15 * dt;
      it.rot.x += it.spin.x * dt;
      it.rot.y += it.spin.y * dt;
      it.rot.z += it.spin.z * dt;
      // Wrap into the box around the camera
      for (const k of ['x', 'y', 'z'] as const) {
        const d = it.p[k] - center[k];
        if (d > half[k]) it.p[k] -= this.box[k];
        else if (d < -half[k]) it.p[k] += this.box[k];
      }
      this.q.setFromEuler(it.rot);
      const near = Math.min(1, Math.max(0, (it.p.distanceTo(center) - 0.8) / 1.6)); // shrink away near the camera
      this.s.setScalar(it.scale * near);
      this.m.compose(it.p, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Place everything around a point right away (avoids an empty first frame). */
  recenter(center: THREE.Vector3) {
    for (const it of this.items) it.p.add(center);
  }
}

export class Particles {
  readonly group = new THREE.Group();
  private petals: Swarm;
  private dust: Swarm;
  private centered = false;

  constructor(low: boolean) {
    const petalMat = new THREE.MeshStandardNodeMaterial({ roughness: 0.55, side: THREE.DoubleSide });
    // Cheap subsurface look: petals glow a little when lit from behind
    petalMat.emissiveNode = color('#B3263A').mul(float(1).sub(normalView.dot(positionViewDirection).abs()).mul(0.35));
    const reds = ['#B3263A', '#C8324A', '#E0475B', '#F28FA2', '#9E1E33'].map((c) => new THREE.Color(c));
    this.petals = new Swarm(petalGeometry(), petalMat, low ? 160 : 420, new THREE.Vector3(26, 16, 34), 0.35, 5, reds);

    const dustMat = new THREE.MeshBasicNodeMaterial({ color: '#FFE3A3' });
    dustMat.colorNode = color('#FFE9B5').mul(2.2); // > 1 so bloom catches it
    this.dust = new Swarm(new THREE.IcosahedronGeometry(0.012, 0), dustMat, low ? 120 : 360, new THREE.Vector3(16, 10, 20), 0.03, 9);

    this.group.add(this.petals.mesh, this.dust.mesh);
  }

  update(dt: number, time: number, camera: THREE.Camera, wind = 0) {
    if (!this.centered) {
      this.petals.recenter(camera.position);
      this.dust.recenter(camera.position);
      this.centered = true;
    }
    this.petals.update(dt, time, camera.position, wind);
    this.dust.update(dt, time, camera.position, wind * 0.3);
  }
}
