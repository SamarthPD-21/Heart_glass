import * as THREE from 'three/webgpu';
import { uniform, float, mix, normalView, positionViewDirection, color } from 'three/tsl';
import type { MaterialId } from '../../lib/heartConfig';

/** Shared by every preset: color changes never recompile a pipeline. */
export const uColor = uniform(new THREE.Color('#B3263A'));
/** Heartbeat glow 0..1, driven from JS each frame. */
export const uBeat = uniform(0);

const fresnel = () => float(1).sub(normalView.dot(positionViewDirection).saturate()).pow(2.5);

export function createHeartMaterials(lowTier: boolean): Record<MaterialId, THREE.Material> {
  const gold = new THREE.MeshPhysicalNodeMaterial({ metalness: 1, roughness: 0.22, clearcoat: 0.3 });
  gold.colorNode = mix(uColor, color('#C9A24A'), 0.35);
  gold.emissiveNode = uColor.mul(uBeat.mul(0.35).add(fresnel().mul(0.25)));

  let glass: THREE.MeshPhysicalNodeMaterial;
  if (lowTier) {
    // Faked glass: no transmission pass, just transparency + strong fresnel rim
    glass = new THREE.MeshPhysicalNodeMaterial({
      metalness: 0.1, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.62, depthWrite: false,
    });
    glass.emissiveNode = uColor.mul(fresnel().mul(0.9).add(uBeat.mul(0.3)));
  } else {
    glass = new THREE.MeshPhysicalNodeMaterial({
      transmission: 1, thickness: 0.6, ior: 1.45, roughness: 0.05, metalness: 0,
    });
    glass.emissiveNode = uColor.mul(fresnel().mul(0.5).add(uBeat.mul(0.25)));
  }
  glass.colorNode = uColor;

  const velvet = new THREE.MeshPhysicalNodeMaterial({ roughness: 0.9, sheen: 1, sheenRoughness: 0.45 });
  velvet.colorNode = uColor.mul(0.8);
  velvet.sheenNode = mix(uColor, color('#ffffff'), 0.45);
  velvet.emissiveNode = uColor.mul(uBeat.mul(0.4));

  return { gold, glass, velvet };
}
