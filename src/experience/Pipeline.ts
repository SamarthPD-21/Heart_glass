import * as THREE from 'three/webgpu';
import { pass } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';

export class Pipeline {
  readonly pipeline: THREE.RenderPipeline;
  private bloomPass: ReturnType<typeof bloom> | null = null;
  private sceneColor: ReturnType<THREE.PassNode['getTextureNode']>;
  readonly baseBloom = 0.35;

  constructor(renderer: THREE.WebGPURenderer, scene: THREE.Scene, camera: THREE.Camera, withBloom: boolean) {
    this.pipeline = new THREE.RenderPipeline(renderer);
    const scenePass = pass(scene, camera);
    this.sceneColor = scenePass.getTextureNode('output');
    if (withBloom) {
      // Threshold above 1: the pastel scene itself is bright, so only emissive highlights (dust, glints, rims) bloom
      this.bloomPass = bloom(this.sceneColor, this.baseBloom, 0.35, 1.05); // strength, radius, threshold
      this.pipeline.outputNode = this.sceneColor.add(this.bloomPass);
    } else {
      this.pipeline.outputNode = this.sceneColor;
    }
  }

  /** Uniform for tweening bloom swells; null on the low tier. */
  get bloomStrength() {
    return this.bloomPass?.strength ?? null;
  }

  disableBloom() {
    if (!this.bloomPass) return;
    this.pipeline.outputNode = this.sceneColor;
    this.pipeline.needsUpdate = true;
    this.bloomPass.dispose();
    this.bloomPass = null;
  }

  render() {
    this.pipeline.render();
  }
}
