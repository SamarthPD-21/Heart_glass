import * as THREE from 'three/webgpu';
import {
  fog, rangeFogFactor, uniform, triNoise3D, positionWorld, time, mix, float, screenUV, smoothstep, color,
} from 'three/tsl';

/**
 * Animated noise fog: a range fog modulated by drifting 3D noise ("wisps") and thickened
 * low down, with color/near/far blended between per-zone moods as the camera travels.
 * The sky is a soft vertical gradient that meets the fog color at the horizon.
 */

interface Mood { at: number; color: THREE.Color; near: number; far: number; wisps: number }

const MOODS: Mood[] = [
  { at: 0.0, color: new THREE.Color('#F6EEEE'), near: 6, far: 46, wisps: 0.35 },
  { at: 0.3, color: new THREE.Color('#F7EEE8'), near: 8, far: 54, wisps: 0.25 },
  { at: 0.55, color: new THREE.Color('#F3EAF0'), near: 7, far: 48, wisps: 0.4 },
  { at: 0.8, color: new THREE.Color('#EFEBF3'), near: 6, far: 44, wisps: 0.45 },
  { at: 1.0, color: new THREE.Color('#F8EEE8'), near: 5, far: 40, wisps: 0.3 },
];

export const INTRO_FOG = { color: new THREE.Color('#F5EEEF'), near: 4, far: 30, wisps: 0.5 };

export class Fog {
  readonly color = uniform(new THREE.Color('#F6EEEE'));
  readonly near = uniform(6);
  readonly far = uniform(46);
  /** How strongly the noise breaks up the fog (0 = plain range fog). */
  readonly wisps = uniform(0.35);

  constructor(scene: THREE.Scene, animated: boolean) {
    const base = rangeFogFactor(this.near, this.far);
    let factor = base;
    if (animated) {
      const n = triNoise3D(positionWorld.mul(0.018), float(0.12), time); // 0..1, drifting
      const heightBoost = smoothstep(4, -3, positionWorld.y).mul(0.25); // denser low down
      factor = base.mul(mix(float(1), n.mul(1.6).add(0.4), this.wisps)).add(heightBoost.mul(base.oneMinus().mul(0.6))).saturate();
    }
    scene.fogNode = fog(this.color, factor);

    // Sky: lavender at the top fading to the fog color at the horizon
    const top = color('#ECE6F2');
    scene.backgroundNode = mix(this.color, top, smoothstep(0.45, 1.0, screenUV.y.oneMinus()));
  }

  set(c: THREE.Color, near: number, far: number, wisps = this.wisps.value) {
    this.color.value.copy(c);
    this.near.value = near;
    this.far.value = far;
    this.wisps.value = wisps;
  }

  /** Blend between the moods around progress p. */
  setFromProgress(p: number) {
    let i = 0;
    while (i < MOODS.length - 2 && p > MOODS[i + 1].at) i++;
    const a = MOODS[i], b = MOODS[i + 1];
    const t = THREE.MathUtils.clamp((p - a.at) / (b.at - a.at), 0, 1);
    this.color.value.copy(a.color).lerp(b.color, t);
    this.near.value = THREE.MathUtils.lerp(a.near, b.near, t);
    this.far.value = THREE.MathUtils.lerp(a.far, b.far, t);
    this.wisps.value = THREE.MathUtils.lerp(a.wisps, b.wisps, t);
  }
}
