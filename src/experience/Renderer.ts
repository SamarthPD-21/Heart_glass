import * as THREE from 'three/webgpu';

export interface RendererInfo {
  renderer: THREE.WebGPURenderer;
  isWebGPU: boolean;
}

export async function createRenderer(container: HTMLElement, pixelRatio: number): Promise<RendererInfo> {
  const forceWebGL = new URLSearchParams(location.search).has('webgl');
  const renderer = new THREE.WebGPURenderer({ antialias: true, forceWebGL });
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.NeutralToneMapping; // keeps the off-white fog from going grey
  renderer.toneMappingExposure = 1.0;

  await renderer.init(); // throws if neither WebGPU nor WebGL 2 is available
  container.appendChild(renderer.domElement);

  // Only valid after init(); renderer.isWebGPURenderer is true on both backends.
  const isWebGPU = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend === true;
  return { renderer, isWebGPU };
}
