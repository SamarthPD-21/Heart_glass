import * as THREE from 'three/webgpu';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/** Lenis smooth scroll → ScrollTrigger progress → extra damping for a gliding camera. */
export class Scroll {
  readonly lenis: Lenis;
  target = 0;
  progress = 0;
  private override: number | null = null;

  constructor(reducedMotion: boolean) {
    this.lenis = new Lenis({ smoothWheel: !reducedMotion, autoRaf: false });
    this.lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => this.lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);

    ScrollTrigger.create({
      trigger: '#journey',
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        this.target = self.progress;
      },
    });
    this.stop();
  }

  /** Debug: pin progress to a fixed value (null = follow scroll). */
  setOverride(v: number | null) {
    this.override = v;
  }

  update(dt: number) {
    const target = this.override ?? this.target;
    this.progress = THREE.MathUtils.damp(this.progress, target, 4, dt);
    if (Math.abs(this.progress - target) < 1e-4) this.progress = target;
  }

  /** Jump without animation (used under the white fade). */
  jumpTo(p: number) {
    const max = document.documentElement.scrollHeight - innerHeight;
    this.lenis.scrollTo(max * p, { immediate: true, force: true });
    this.target = this.progress = p;
  }

  stop() {
    this.lenis.stop();
  }

  start() {
    this.lenis.start();
  }
}
