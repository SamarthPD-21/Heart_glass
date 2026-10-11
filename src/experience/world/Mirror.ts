import * as THREE from 'three/webgpu';
import {
  uniform, mix, color, positionLocal, positionWorld, cameraPosition, vec2, vec3, smoothstep, float,
  mx_noise_float, time, normalView, positionViewDirection,
} from 'three/tsl';
import { createGoldMaterial } from '../materials/environment';
import { rng } from '../../lib/random';

const RX = 1.05, RY = 1.55; // outer oval
const HX = 0.84, HY = 1.32; // glass opening
const CY = 1.95;            // glass center height above the group origin
const TUNNEL = 9;           // depth of the hidden sky tunnel behind the glass

/* ------------------------------------------------------------------ helpers */

function ellipse(rx: number, ry: number, segs = 72): THREE.Vector2[] {
  return Array.from({ length: segs }, (_, i) => {
    const a = (i / segs) * Math.PI * 2;
    return new THREE.Vector2(Math.cos(a) * rx, Math.sin(a) * ry);
  });
}

/** Keep the side of the polygon closer to `a` than to `b` (Sutherland–Hodgman, one half-plane). */
function clipCloser(poly: THREE.Vector2[], a: THREE.Vector2, b: THREE.Vector2): THREE.Vector2[] {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const dir = b.clone().sub(a);
  const side = (p: THREE.Vector2) => p.clone().sub(mid).dot(dir); // <= 0 keeps
  const out: THREE.Vector2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const sp = side(p), sq = side(q);
    if (sp <= 0) out.push(p);
    if ((sp <= 0) !== (sq <= 0)) out.push(p.clone().lerp(q, sp / (sp - sq)));
  }
  return out;
}

/** Voronoi cells of the glass oval, denser around the impact point. */
function fracture(count: number, impact: THREE.Vector2, seed: number): THREE.Vector2[][] {
  const r = rng(seed);
  const sites: THREE.Vector2[] = [];
  while (sites.length < count) {
    const a = r() * Math.PI * 2;
    const d = Math.pow(r(), 1.7); // bias toward the impact
    const p = new THREE.Vector2(impact.x + Math.cos(a) * d * HX * 1.6, impact.y + Math.sin(a) * d * HY * 1.6);
    if ((p.x / HX) ** 2 + (p.y / HY) ** 2 < 0.98) sites.push(p);
  }
  const outline = ellipse(HX + 0.01, HY + 0.01, 64);
  return sites
    .map((s, i) => sites.reduce((poly, o, j) => (i === j || poly.length < 3 ? poly : clipCloser(poly, s, o)), outline))
    .filter((p) => p.length >= 3);
}

function smallHeartShape(w: number) {
  const k = w / 110;
  const s = new THREE.Shape()
    .moveTo(25 * k, 25 * k)
    .bezierCurveTo(25 * k, 25 * k, 20 * k, 0, 0, 0)
    .bezierCurveTo(-30 * k, 0, -30 * k, 35 * k, -30 * k, 35 * k)
    .bezierCurveTo(-30 * k, 55 * k, -10 * k, 77 * k, 25 * k, 95 * k)
    .bezierCurveTo(60 * k, 77 * k, 80 * k, 55 * k, 80 * k, 35 * k)
    .bezierCurveTo(80 * k, 35 * k, 80 * k, 0, 50 * k, 0)
    .bezierCurveTo(35 * k, 0, 25 * k, 25 * k, 25 * k, 25 * k);
  return s;
}

/* ------------------------------------------------------------------ mirror */

interface Shard { mesh: THREE.Mesh; v: THREE.Vector3; w: THREE.Vector3; home: THREE.Vector3 }

/**
 * An ornate oval mirror that is secretly a window: behind the glass, hidden by the frame,
 * sits a tunnel whose walls render an endless pastel sky with a floating heart. From the
 * front it reads as "another world inside the mirror", with correct parallax and no extra
 * render passes. On enter, the glass fractures into Voronoi shards and the camera flies through.
 */
export class Mirror {
  readonly group = new THREE.Group();
  readonly center: THREE.Vector3;
  /** 0 = clear glass, 1 = fully misted. */
  readonly haze = uniform(0.34);
  private glare = uniform(0);
  private glass: THREE.Mesh;
  private shards: Shard[] = [];
  private shardGroup = new THREE.Group();
  private innerHeart: THREE.Mesh;
  private shattering = false;
  private shatterT = 0;
  private disposables: { dispose(): void }[] = [];

  constructor(position: THREE.Vector3, low: boolean) {
    this.group.position.copy(position);
    this.center = position.clone().add(new THREE.Vector3(0, CY, 0.04));
    const gold = createGoldMaterial();
    this.disposables.push(gold);

    this.buildFrame(gold);
    this.buildInnerWorld(low);
    this.innerHeart = this.group.getObjectByName('innerHeart') as THREE.Mesh;

    // Misted glass layer over the opening: haze stronger at the rim, a soft moving glare band
    const glassGeo = new THREE.ShapeGeometry(new THREE.Shape(ellipse(HX + 0.02, HY + 0.02)), 1);
    const glassMat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
    const d = positionLocal.xy.div(vec2(HX, HY)).length();
    const rim = smoothstep(0.5, 1.0, d);
    const band = smoothstep(0.18, 0.0, positionLocal.x.mul(0.8).add(positionLocal.y.mul(0.5)).sub(this.glare).abs());
    glassMat.colorNode = mix(color('#FBF6F4'), color('#FFFFFF'), band);
    glassMat.opacityNode = mix(this.haze, float(0.92), rim).mul(0.85).add(band.mul(0.22)).saturate();
    this.glass = new THREE.Mesh(glassGeo, glassMat);
    this.glass.position.set(0, CY, 0.035);
    this.glass.renderOrder = 2;
    this.group.add(this.glass);
    this.disposables.push(glassGeo, glassMat);

    this.buildShards(low ? 40 : 80);
  }

  private buildFrame(gold: THREE.Material) {
    // Main oval ring with a fat bevel
    const outer = new THREE.Shape(ellipse(RX, RY));
    outer.holes.push(new THREE.Path(ellipse(HX, HY).reverse()));
    const frameGeo = new THREE.ExtrudeGeometry(outer, {
      depth: 0.06, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.06, bevelSegments: 6, curveSegments: 72,
    });
    const frame = new THREE.Mesh(frameGeo, gold);
    frame.position.y = CY;
    this.group.add(frame);

    // Bead rings: pearls along the outer edge, fine gold beads along the inner edge
    const bead = new THREE.SphereGeometry(1, 12, 8);
    const pearlMat = new THREE.MeshPhysicalNodeMaterial({ color: '#F6EEE6', roughness: 0.25, clearcoat: 1, sheen: 0.5 });
    const ring = (rx: number, ry: number, n: number, size: number, mat: THREE.Material, z: number) => {
      const im = new THREE.InstancedMesh(bead, mat, n);
      const m = new THREE.Matrix4();
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        m.makeScale(size, size, size).setPosition(Math.cos(a) * rx, CY + Math.sin(a) * ry, z);
        im.setMatrixAt(i, m);
      }
      this.group.add(im);
    };
    ring(RX + 0.07, RY + 0.07, 64, 0.04, pearlMat, 0.03);
    ring(HX - 0.015, HY - 0.015, 90, 0.018, gold, 0.1);

    // Crest: a small gold heart flanked by two scrolls; a mirrored flourish at the bottom
    const heartGeo = new THREE.ExtrudeGeometry(smallHeartShape(0.32), {
      depth: 0.04, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 4, curveSegments: 24,
    });
    heartGeo.center();
    heartGeo.rotateZ(Math.PI);
    const crest = new THREE.Mesh(heartGeo, gold);
    crest.position.set(0, CY + RY + 0.2, 0.04);
    const scroll = new THREE.TorusGeometry(0.16, 0.022, 8, 32, Math.PI * 1.3);
    for (const sx of [-1, 1]) {
      const s1 = new THREE.Mesh(scroll, gold);
      s1.position.set(sx * 0.27, CY + RY + 0.1, 0.03);
      s1.rotation.set(0, sx < 0 ? Math.PI : 0, 0.5);
      const s2 = new THREE.Mesh(scroll, gold);
      s2.position.set(sx * 0.22, CY - RY - 0.08, 0.03);
      s2.rotation.set(0, sx < 0 ? Math.PI : 0, -2.4);
      this.group.add(s1, s2);
    }
    const foot = new THREE.Mesh(heartGeo, gold);
    foot.scale.setScalar(0.6);
    foot.position.set(0, CY - RY - 0.12, 0.04);
    this.group.add(crest, foot);

    this.disposables.push(frameGeo, bead, pearlMat, heartGeo, scroll);
  }

  private buildInnerWorld(low: boolean) {
    // Sky by view direction, so the tunnel walls read as an endless sky, not a tube
    const dir = positionWorld.sub(cameraPosition).normalize();
    const up = dir.y.mul(2.2).add(0.15).saturate();
    const sky = mix(mix(color('#F9D7DF'), color('#F1E4F4'), smoothstep(0.0, 0.45, up)), color('#C8D2F3'), smoothstep(0.45, 1.0, up));
    const cloudN = mx_noise_float(vec3(dir.x.mul(4.5).add(time.mul(0.03)), dir.y.mul(7), float(1.7)))
      .mul(0.6)
      .add(mx_noise_float(vec3(dir.x.mul(11), dir.y.mul(15).sub(time.mul(0.02)), float(4.2))).mul(0.4));
    const clouds = smoothstep(0.05, 0.6, cloudN.mul(0.5).add(0.5)).mul(smoothstep(0.85, 0.2, up));
    const skyMat = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, fog: false });
    skyMat.colorNode = mix(sky, color('#FFFFFF'), clouds.mul(low ? 0.6 : 0.85));

    const tunnel = new THREE.CylinderGeometry(1, 1, TUNNEL, 48, 1, false);
    tunnel.rotateX(Math.PI / 2);
    tunnel.scale(HX + 0.04, HY + 0.04, 1);
    const tube = new THREE.Mesh(tunnel, skyMat);
    tube.position.set(0, CY, -TUNNEL / 2 - 0.01);
    this.group.add(tube);

    // The floating heart inside the mirror: soft, cloud-like stone
    const shape = smallHeartShape(1.0);
    const hGeo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.15, bevelEnabled: true, bevelSegments: 10, bevelSize: 0.12, bevelThickness: 0.14, curveSegments: 40,
    });
    hGeo.center();
    hGeo.rotateZ(Math.PI);
    hGeo.computeVertexNormals();
    const hMat = new THREE.MeshStandardNodeMaterial({ color: '#F7ECEA', roughness: 0.85, fog: false });
    const rimLight = float(1).sub(normalView.dot(positionViewDirection).saturate()).pow(2);
    hMat.emissiveNode = mix(color('#F6C9D3'), color('#FFFFFF'), rimLight).mul(rimLight.mul(0.7).add(0.15));
    const heart = new THREE.Mesh(hGeo, hMat);
    heart.name = 'innerHeart';
    heart.position.set(0, CY, -3.6);
    this.group.add(heart);

    this.disposables.push(skyMat, tunnel, hGeo, hMat);
  }

  private buildShards(count: number) {
    const mat = new THREE.MeshPhysicalNodeMaterial({
      color: '#FCEFF2', metalness: 0.35, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.75, side: THREE.DoubleSide,
    });
    const edge = float(1).sub(normalView.dot(positionViewDirection).abs()).pow(3);
    mat.emissiveNode = color('#FFE9EE').mul(edge.mul(1.4));
    const cells = fracture(count, new THREE.Vector2(0.05, 0.1), 77);
    for (const cell of cells) {
      const c = cell.reduce((a, p) => a.add(p), new THREE.Vector2()).divideScalar(cell.length);
      const shape = new THREE.Shape(cell.map((p) => p.clone().sub(c)));
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.014, bevelEnabled: false });
      const mesh = new THREE.Mesh(geo, mat);
      const home = new THREE.Vector3(c.x, CY + c.y, 0.03);
      mesh.position.copy(home);
      this.shardGroup.add(mesh);
      this.shards.push({ mesh, v: new THREE.Vector3(), w: new THREE.Vector3(), home });
      this.disposables.push(geo);
    }
    this.disposables.push(mat);
    this.shardGroup.visible = false;
    this.group.add(this.shardGroup);
  }

  /** Break the glass. `impact` is in glass-local units (0,0 = center). */
  shatter(impact = new THREE.Vector2()) {
    if (this.shattering) return;
    this.shattering = true;
    this.shatterT = 0;
    this.glass.visible = false;
    this.shardGroup.visible = true;
    const r = rng(5);
    for (const s of this.shards) {
      const radial = new THREE.Vector2(s.home.x - impact.x, s.home.y - CY - impact.y);
      const dist = radial.length();
      radial.normalize().multiplyScalar((1.6 + r() * 2.2) / (0.4 + dist));
      s.v.set(radial.x, radial.y + 0.4, 2.2 + r() * 3.2 + (1 - Math.min(dist, 1)) * 2); // out and toward the viewer
      s.w.set((r() - 0.5) * 9, (r() - 0.5) * 9, (r() - 0.5) * 6);
    }
  }

  update(mouse: THREE.Vector2, dt: number, t: number) {
    // Mist clears a little as the cursor approaches the center; glare follows the cursor
    const target = 0.34 - 0.22 * Math.max(0, 1 - mouse.length());
    this.haze.value = THREE.MathUtils.damp(this.haze.value, target, 3, dt);
    this.glare.value = THREE.MathUtils.damp(this.glare.value, -0.9 + mouse.x * 1.2 + Math.sin(t * 0.4) * 0.3, 2, dt);

    this.innerHeart.position.y = CY + Math.sin(t * 0.9) * 0.08;
    this.innerHeart.rotation.y = Math.sin(t * 0.5) * 0.35;

    if (this.shattering) {
      this.shatterT += dt;
      // Impact, then slow motion
      const scale = this.shatterT < 0.18 ? 1 : THREE.MathUtils.lerp(1, 0.28, Math.min(1, (this.shatterT - 0.18) / 0.5));
      const sdt = dt * scale;
      for (const s of this.shards) {
        s.mesh.position.addScaledVector(s.v, sdt);
        s.v.y -= 0.6 * sdt; // a hint of gravity
        s.mesh.rotation.x += s.w.x * sdt;
        s.mesh.rotation.y += s.w.y * sdt;
        s.mesh.rotation.z += s.w.z * sdt;
      }
    }
  }

  dispose() {
    this.group.removeFromParent();
    this.disposables.forEach((d) => d.dispose());
  }
}
