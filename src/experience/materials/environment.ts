import * as THREE from 'three/webgpu';
import {
  vertexColor, color, float, mix, normalView, positionViewDirection, positionWorld,
  mx_noise_float, smoothstep, time, uniform, cameraPosition,
} from 'three/tsl';

/** Overall sparkle strength; 0 disables the glints (low tier keeps a gentler value). */
export const uSparkle = uniform(1.6);

const fresnel = (power: number) => float(1).sub(normalView.dot(positionViewDirection).saturate()).pow(power);

/**
 * "Gold dust": high-frequency 3D noise in world space, shifted by the camera position so
 * glints twinkle as the camera moves (like real glitter), thresholded into tiny bright specks.
 */
function glints(scale: number) {
  const p = positionWorld.mul(scale).add(cameraPosition.mul(0.35)).add(time.mul(0.15));
  const n = mx_noise_float(p).mul(0.5).add(0.5);
  return smoothstep(0.7, 0.82, n);
}

/**
 * One shared material for every environment piece.
 * Vertex color channels (set in code by Islands.ts):
 *   R = gold mask (0 plaster, 1 gold)
 *   G = fake ambient occlusion (darker near the bottom)
 */
export function createEnvironmentMaterial() {
  const m = new THREE.MeshStandardNodeMaterial();
  const vc = vertexColor();
  const goldMask = vc.r;
  const ao = vc.g;
  const plaster = color('#F7F0EC');
  const gold = color('#C9A24A');

  m.colorNode = mix(plaster, gold, goldMask).mul(mix(float(0.62), float(1.0), ao));
  m.metalnessNode = goldMask;
  m.roughnessNode = mix(float(0.9), float(0.3), goldMask);

  // Soft rim glow on gold + glints, both caught by bloom
  const sparkle = glints(70).mul(uSparkle).mul(goldMask);
  const plasterDust = glints(110).mul(0.12).mul(float(1).sub(goldMask)); // faint mica in the plaster
  m.emissiveNode = gold.mul(fresnel(3).mul(0.35).mul(goldMask).add(sparkle)).add(color('#FFF2DC').mul(plasterDust));
  return m;
}

/** Plain gold for frames and ornaments (no vertex colors needed). */
export function createGoldMaterial(sparkle = true) {
  const m = new THREE.MeshStandardNodeMaterial({ color: '#C9A24A', metalness: 1, roughness: 0.28 });
  const gold = color('#C9A24A');
  const s = sparkle ? glints(55).mul(uSparkle) : float(0);
  m.emissiveNode = gold.mul(fresnel(3).mul(0.4).add(s));
  return m;
}
