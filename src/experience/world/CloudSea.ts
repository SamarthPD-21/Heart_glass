import * as THREE from 'three/webgpu';
import { mx_noise_float, positionWorld, time, smoothstep, color, mix, float, vec3 } from 'three/tsl';
import type { Fog } from './Fog';

/**
 * Two huge translucent layers below the islands whose alpha is drifting noise:
 * a cheap "sea of clouds" that gives the floating world a floor and depth.
 */
export class CloudSea {
  readonly group = new THREE.Group();

  constructor(fog: Fog, low: boolean) {
    const layers = low ? [{ y: -4.5, scale: 0.035, speed: 0.012, alpha: 0.85 }] : [
      { y: -4.5, scale: 0.035, speed: 0.012, alpha: 0.8 },
      { y: -2.8, scale: 0.06, speed: -0.02, alpha: 0.45 },
    ];
    const geo = new THREE.PlaneGeometry(400, 400, 1, 1);
    geo.rotateX(-Math.PI / 2);

    for (const l of layers) {
      const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
      const p = positionWorld.xz.mul(l.scale).add(time.mul(l.speed));
      const n = mx_noise_float(vec3(p.x, p.y, time.mul(0.02))).mul(0.5).add(0.5);
      const n2 = mx_noise_float(vec3(p.x.mul(2.7), p.y.mul(2.7), float(3.1))).mul(0.5).add(0.5);
      const density = smoothstep(0.35, 0.75, n.mul(0.7).add(n2.mul(0.3)));
      m.colorNode = mix(color('#FFFFFF'), fog.color, 0.35);
      m.opacityNode = density.mul(l.alpha);
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.y = l.y;
      mesh.renderOrder = -1;
      this.group.add(mesh);
    }
  }

  /** Keep the (finite) planes centered under the camera. */
  update(camera: THREE.Camera) {
    this.group.position.x = camera.position.x;
    this.group.position.z = camera.position.z;
  }
}
