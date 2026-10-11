import * as THREE from 'three/webgpu';
import { easeInOutSine } from '../lib/random';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Where the camera flies. Tune with ?debug (the curves are drawn as lines). */
const POSITIONS = [
  V(0, 2.2, -6), V(2, 2.8, -18), V(3.5, 3.0, -30), V(1.5, 4.0, -44), V(-1.5, 4.8, -58),
  V(-1, 4.6, -70), V(2, 3.8, -84), V(4, 3.4, -95), V(2, 4.0, -106), V(0, 4.3, -113.5),
];
/** What it looks at (hero props, then the heart). */
const TARGETS = [
  V(-2, 1.5, -30), V(-6, 2.0, -30), V(-5, 2.2, -36), V(4, 3.8, -60), V(7, 4.6, -63),
  V(2, 3.2, -80), V(-4, 2.6, -94), V(-2, 3.2, -104), V(0, 4.1, -120), V(0, 4.1, -120),
];

export class CameraPath {
  readonly posCurve = new THREE.CatmullRomCurve3(POSITIONS, false, 'centripetal');
  readonly lookCurve = new THREE.CatmullRomCurve3(TARGETS, false, 'centripetal');
  private look = new THREE.Vector3();
  private initialized = false;
  private right = new THREE.Vector3();
  private up = new THREE.Vector3();

  constructor(private camera: THREE.PerspectiveCamera) {}

  /** Pose for progress p without parallax (used for jumps). */
  snap(p: number) {
    const e = easeInOutSine(p);
    this.camera.position.copy(this.posCurve.getPointAt(e));
    this.look.copy(this.lookCurve.getPointAt(e));
    this.camera.lookAt(this.look);
    this.initialized = true;
  }

  update(p: number, dt: number, mouse: THREE.Vector2, parallax: boolean) {
    if (!this.initialized) this.snap(p);
    const e = easeInOutSine(p);
    this.camera.position.copy(this.posCurve.getPointAt(e));
    this.look.lerp(this.lookCurve.getPointAt(e), 1 - Math.exp(-6 * dt)); // damped look
    this.camera.lookAt(this.look);

    if (parallax) {
      // Small offsets on top of the path; never fight it
      this.camera.updateMatrixWorld();
      this.right.setFromMatrixColumn(this.camera.matrixWorld, 0);
      this.up.setFromMatrixColumn(this.camera.matrixWorld, 1);
      this.camera.position.addScaledVector(this.right, mouse.x * 0.15);
      this.camera.position.addScaledVector(this.up, -mouse.y * 0.1);
    }
  }

  debugLines() {
    const g = new THREE.Group();
    const line = (c: THREE.Curve<THREE.Vector3>, col: string) =>
      new THREE.Line(new THREE.BufferGeometry().setFromPoints(c.getSpacedPoints(200)), new THREE.LineBasicMaterial({ color: col }));
    g.add(line(this.posCurve, '#b3263a'), line(this.lookCurve, '#2f6e8e'));
    return g;
  }
}
