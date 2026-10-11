import * as THREE from 'three/webgpu';
import gsap from 'gsap';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { createRenderer } from './Renderer';
import { detectTier, settingsFor, type QualitySettings } from './Quality';
import { Pipeline } from './Pipeline';
import { Scroll } from './Scroll';
import { CameraPath } from './CameraPath';
import { Islands, ISLANDS, HEART_POSITION } from './world/Islands';
import { Fog, INTRO_FOG } from './world/Fog';
import { Mirror } from './world/Mirror';
import { Heart } from './world/Heart';
import { CloudSea } from './world/CloudSea';
import { Particles } from './world/Particles';
import { uSparkle } from './materials/environment';

import { FSM } from '../lib/fsm';
import { audio } from '../lib/audio';
import { DEFAULT_HEART, shareUrl, type HeartConfig } from '../lib/heartConfig';
import { prefersReducedMotion } from '../lib/random';

import { $, show, announce } from '../ui/dom';
import { setLoaderProgress, finishLoader } from '../ui/loader';
import { Story } from '../ui/story';
import { Customizer } from '../ui/customizer';
import { openShare } from '../ui/share';
import { showRecipient } from '../ui/recipient';

export type Mode = { kind: 'main' } | { kind: 'recipient'; config: HeartConfig | null };

const HEART_TRIGGER = 0.97;

export class Experience {
  private fsm = new FSM();
  private reduced = prefersReducedMotion();
  private quality!: QualitySettings;
  private renderer!: THREE.WebGPURenderer;
  private isWebGPU = false;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 80);
  private pipeline!: Pipeline;
  private scroll!: Scroll;
  private cameraPath = new CameraPath(this.camera);
  private fog!: Fog;
  private islands!: Islands;
  private clouds!: CloudSea;
  private particles!: Particles;
  private mirror: Mirror | null = null;
  private heart!: Heart;
  private story!: Story;
  private customizer: Customizer | null = null;
  private controls: OrbitControls | null = null;
  private timer = new THREE.Timer();
  private mouse = new THREE.Vector2();
  private mouseTarget = new THREE.Vector2();
  private introCam = new THREE.Vector3();
  private enterLook = new THREE.Vector3();
  private raycaster = new THREE.Raycaster();
  private stats: { update(): void } | null = null;
  private perf = { frames: 0, total: 0, done: false };
  private fade = $('#fade');

  constructor(private mode: Mode) {}

  async init() {
    document.body.classList.toggle('reduced-motion', this.reduced);
    history.scrollRestoration = 'manual';
    scrollTo(0, 0);
    this.fsm.go('LOADING');
    setLoaderProgress(0.1);

    this.quality = settingsFor(detectTier());
    const r = await createRenderer($('#app'), this.quality.pixelRatio);
    this.renderer = r.renderer;
    this.isWebGPU = r.isWebGPU;
    document.body.dataset.backend = this.isWebGPU ? 'webgpu' : 'webgl2';
    document.body.dataset.tier = this.quality.tier;
    setLoaderProgress(0.3);

    this.buildScene();
    setLoaderProgress(0.55);

    this.pipeline = new Pipeline(this.renderer, this.scene, this.camera, this.quality.bloom);
    this.scroll = new Scroll(this.reduced);
    this.story = new Story(() => audio.chime(523.25 * (1 + Math.random() * 0.5)));
    this.bindStates();
    this.bindInput();
    this.onResize();

    await this.precompile();
    setLoaderProgress(0.95);

    if (new URLSearchParams(location.search).has('debug')) await this.initDebug();

    this.timer.connect(document);
    this.renderer.setAnimationLoop((t) => this.frame(t));
    await finishLoader();
    this.fsm.go(this.mode.kind === 'recipient' ? 'RECIPIENT' : 'MIRROR');
  }

  // ---------------------------------------------------------------- scene

  private buildScene() {
    const low = this.quality.tier === 'low';
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.6;

    const sun = new THREE.DirectionalLight('#fff1e6', 1.7);
    sun.position.set(6, 12, 8);
    this.scene.add(sun, new THREE.HemisphereLight('#fff7fb', '#ead8d6', 0.7));

    this.fog = new Fog(this.scene, !low || !this.reduced);
    uSparkle.value = low ? 0.9 : 1.6;
    const main = this.mode.kind === 'main';

    this.islands = new Islands(!main, low ? 0.5 : 1);
    this.clouds = new CloudSea(this.fog, low);
    this.particles = new Particles(low);
    this.scene.add(this.islands.group, this.clouds.group, this.particles.group);

    if (main) {
      const intro = ISLANDS.find((d) => d.hero === 'intro')!;
      this.mirror = new Mirror(intro.position.clone().setY(intro.position.y + 0.25), low);
      this.scene.add(this.mirror.group);
      this.introCam.set(0, this.mirror.center.y - 0.05, this.mirror.center.z + 7.4);
      this.fog.set(INTRO_FOG.color, INTRO_FOG.near, INTRO_FOG.far, INTRO_FOG.wisps);
    }

    this.heart = new Heart(HEART_POSITION, this.quality.fakeGlass);
    this.scene.add(this.heart.group);
  }

  /** Build every pipeline behind the loader so nothing hitches on first appearance. */
  private async precompile() {
    const saved: [THREE.Object3D, boolean, boolean][] = [];
    this.scene.traverse((o) => {
      saved.push([o, o.visible, o.frustumCulled]);
      o.visible = true;
      o.frustumCulled = false;
    });
    this.heart.showAllForCompile(true);
    try {
      await this.renderer.compileAsync(this.scene, this.camera);
    } catch (e) {
      console.warn('Precompile failed; continuing', e);
    }
    saved.forEach(([o, v, f]) => {
      o.visible = v;
      o.frustumCulled = f;
    });
    this.heart.showAllForCompile(false);
  }

  // ---------------------------------------------------------------- states

  private bindStates() {
    const fsm = this.fsm;

    fsm.onEnter('MIRROR', () => {
      this.camera.position.copy(this.introCam);
      this.camera.lookAt(this.mirror!.center);
      show($('#intro'));
      show($('#skip'));
      $('#enter').focus({ preventScroll: true });
      announce('An ornate mirror stands in the fog, with another world inside it. Press Begin the journey.');
    });
    fsm.onExit('MIRROR', () => document.body.classList.add('entered'));

    fsm.onEnter('JOURNEY', () => {
      this.scroll.start();
      show($('#progress'));
      show($('#skip'));
      show($('#scroll-hint'));
      announce('Scroll to walk through the story.');
    });
    fsm.onExit('JOURNEY', () => {
      show($('#progress'), false);
      show($('#scroll-hint'), false);
    });

    fsm.onEnter('HEART', () => {
      this.scroll.stop();
      show($('#skip'), false);
      this.heart.apply(this.customizer?.config ?? DEFAULT_HEART, true);
      audio.duck(0.5, 2);
      if (this.reduced) {
        this.heart.reveal(0.6);
        gsap.delayedCall(0.7, () => fsm.go('CUSTOMIZER'));
        return;
      }
      this.heart.assemble(3.2, () => {
        audio.heart();
        this.bloomSwell(1.6);
        gsap.delayedCall(0.6, () => fsm.go('CUSTOMIZER'));
      });
    });

    fsm.onEnter('CUSTOMIZER', () => {
      this.story.hide();
      this.enableOrbit(false);
      this.ensureCustomizer().open();
      announce('Your heart is ready to customize.');
    });

    fsm.onEnter('RECIPIENT', () => {
      const cfg = this.mode.kind === 'recipient' ? this.mode.config : null;
      this.story.hide();
      this.cameraPath.snap(1);
      this.fog.set(new THREE.Color('#F8EEE8'), 0.5, 4, 0.3);
      gsap.to(this.fog.near, { value: 5, duration: 2.6, ease: 'power2.inOut' });
      gsap.to(this.fog.far, { value: 40, duration: 2.6, ease: 'power2.inOut' });
      if (cfg) {
        this.heart.apply(cfg, true);
        if (this.reduced) this.heart.reveal(0.6);
        else gsap.delayedCall(0.6, () => this.heart.assemble(2.8, () => this.bloomSwell(1.5)));
      }
      this.enableOrbit(true);
      showRecipient(cfg, this.reduced);
    });
  }

  private ensureCustomizer() {
    this.customizer ??= new Customizer(
      (cfg, kind) => {
        this.heart.apply(cfg);
        if (kind !== 'text') audio.tick();
      },
      (cfg) => {
        audio.chime(784);
        openShare(shareUrl(cfg), () => $('#create-link').focus());
      },
      (tab) => this.heart.setCalm(tab === 'stickers'),
    );
    return this.customizer;
  }

  private enableOrbit(autoRotate: boolean) {
    document.body.classList.add('orbiting');
    const c = new OrbitControls(this.camera, this.renderer.domElement);
    // Keep the heart clear of the panel: left of center on desktop, above the bottom sheet on mobile
    const narrow = innerWidth <= 720;
    const offset = this.mode.kind === 'recipient' ? new THREE.Vector3(0, -0.55, 0)
      : narrow ? new THREE.Vector3(0, -0.8, 0) : new THREE.Vector3(0.8, 0, 0);
    c.target.copy(HEART_POSITION).add(offset);
    c.enableDamping = true;
    c.enablePan = false;
    c.minDistance = 3.5;
    c.maxDistance = 9;
    c.minPolarAngle = Math.PI * 0.25;
    c.maxPolarAngle = Math.PI * 0.7;
    c.autoRotateSpeed = 0.6;
    c.autoRotate = autoRotate && !this.reduced;

    let idle = 0;
    const resume = () => {
      clearTimeout(idle);
      idle = window.setTimeout(() => (c.autoRotate = !this.reduced && !this.customizer?.armed), 5000);
    };
    c.addEventListener('start', () => {
      c.autoRotate = false;
      clearTimeout(idle);
    });
    c.addEventListener('end', resume);
    if (!autoRotate) resume();
    this.controls = c;
  }

  private bloomSwell(peak = 1.3) {
    const s = this.pipeline.bloomStrength;
    if (!s || this.reduced) return;
    gsap.fromTo(s, { value: peak }, { value: this.pipeline.baseBloom, duration: 2.2, ease: 'power2.out' });
  }

  /** Mirror → journey (or straight to the heart when skipping): shatter, fly through, flash. */
  private enter(skip: boolean) {
    if (!this.fsm.is('MIRROR')) return;
    const mirror = this.mirror!;
    audio.unlock();
    this.fsm.go('ENTERING');
    show($('#intro'), false);
    show($('#skip'), false);
    this.enterLook.copy(mirror.center);

    const tl = gsap.timeline();
    if (this.reduced) {
      audio.enter();
      tl.to(this.fade, { opacity: 1, duration: 0.5 });
    } else {
      audio.shatter();
      mirror.shatter(new THREE.Vector2(this.mouse.x * 0.3, -this.mouse.y * 0.4));
      this.bloomSwell(1.8);
      tl.to(this.camera.position, { x: 0, y: mirror.center.y, z: mirror.center.z - 5, duration: 2.6, ease: 'power2.inOut' }, 0.25)
        .to(this.enterLook, { z: mirror.center.z - 12, duration: 2.6, ease: 'power2.inOut' }, 0.25)
        .add(() => audio.enter(), 1.2)
        .to(this.fade, { opacity: 1, duration: 0.7, ease: 'power1.in' }, 2.15);
    }
    tl.add(() => {
      mirror.dispose();
      this.mirror = null;
      this.islands.removeIntro();
      const p = skip ? 1 : 0;
      this.scroll.jumpTo(p);
      this.cameraPath.snap(p);
      this.fog.setFromProgress(p);
      this.fsm.go(skip ? 'HEART' : 'JOURNEY');
    });
    tl.to(this.fade, { opacity: 0, duration: this.reduced ? 0.5 : 1.6, ease: 'power1.out' });
  }

  /** Journey → heart immediately, under a quick white fade. */
  private skipToHeart() {
    if (this.fsm.is('MIRROR')) return this.enter(true);
    if (!this.fsm.is('JOURNEY')) return;
    gsap.timeline()
      .to(this.fade, { opacity: 1, duration: 0.4 })
      .add(() => {
        this.scroll.jumpTo(1);
        this.cameraPath.snap(1);
        this.fog.setFromProgress(1);
        this.story.update(1, true);
        this.fsm.go('HEART');
      })
      .to(this.fade, { opacity: 0, duration: 0.8 });
  }

  // ---------------------------------------------------------------- input

  private bindInput() {
    $('#enter').addEventListener('click', () => this.enter(false));
    $('#skip').addEventListener('click', () => this.skipToHeart());
    addEventListener('resize', () => this.onResize());
    if (!this.reduced && matchMedia('(pointer: fine)').matches) {
      addEventListener('pointermove', (e) => {
        this.mouseTarget.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
      });
    }

    // Taps on the canvas: enter the mirror, or place an armed sticker. A drag is not a tap.
    const canvas = this.renderer.domElement;
    let down: { x: number; y: number } | null = null;
    canvas.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
    canvas.addEventListener('pointerup', (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
      down = null;
      if (this.fsm.is('MIRROR')) {
        const ndc = this.toNdc(e);
        const c = this.mirror!.center.clone().project(this.camera);
        if (Math.abs(ndc.x - c.x) < 0.25 && Math.abs(ndc.y - c.y) < 0.45) this.enter(false);
        return;
      }
      const armed = this.customizer?.armed;
      if (this.fsm.is('CUSTOMIZER') && armed) {
        this.raycaster.setFromCamera(this.toNdc(e), this.camera);
        const st = this.heart.pickSticker(this.raycaster, armed);
        if (st) this.customizer!.addSticker(st);
      }
    });
  }

  private toNdc(e: PointerEvent) {
    const r = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }

  private onResize() {
    const w = innerWidth, h = innerHeight;
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 1 ? 62 : 45; // portrait sees less horizontally
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  // ---------------------------------------------------------------- loop

  private frame(t: number) {
    this.timer.update(t);
    const dt = Math.min(this.timer.getDelta(), 0.1);
    const time = this.timer.getElapsed();
    this.mouse.lerp(this.mouseTarget, 1 - Math.exp(-5 * dt));
    this.scroll.update(dt);
    const p = this.scroll.progress;
    let wind = 0;

    switch (this.fsm.state) {
      case 'MIRROR': {
        this.mirror?.update(this.mouse, dt, time);
        this.camera.position.set(
          this.introCam.x + this.mouse.x * 0.3,
          this.introCam.y - this.mouse.y * 0.15 + (this.reduced ? 0 : Math.sin(time * 0.6) * 0.02),
          this.introCam.z,
        );
        this.camera.lookAt(this.mirror!.center);
        break;
      }
      case 'ENTERING':
        this.mirror?.update(this.mouse, dt, time);
        this.camera.lookAt(this.enterLook);
        wind = 1.5;
        break;
      case 'JOURNEY': {
        this.cameraPath.update(p, dt, this.mouse, !this.reduced);
        this.fog.setFromProgress(p);
        this.story.update(p, this.reduced);
        wind = (this.scroll.target - p) * 30; // petals stream past while scrolling
        if (this.scroll.target > 0.01) show($('#scroll-hint'), false);
        if (p >= HEART_TRIGGER && this.scroll.target >= HEART_TRIGGER) this.fsm.go('HEART');
        this.watchPerf(dt);
        break;
      }
      case 'HEART':
        this.cameraPath.update(Math.max(p, HEART_TRIGGER), dt, this.mouse, false);
        this.story.update(Math.max(p, HEART_TRIGGER), this.reduced);
        break;
    }

    this.islands.update(time, this.reduced);
    this.heart.update(time, dt, this.reduced);
    this.clouds.update(this.camera);
    if (!this.reduced) this.particles.update(dt, time, this.camera, wind);
    this.controls?.update(dt);
    this.pipeline.render();
    this.stats?.update();
  }

  /** One-time adaptive downgrade if the journey runs slow on the high tier. */
  private watchPerf(dt: number) {
    if (this.perf.done || this.quality.tier === 'low') return;
    this.perf.frames++;
    if (this.perf.frames < 30) return; // skip warm-up frames
    this.perf.total += dt;
    if (this.perf.frames < 120) return;
    this.perf.done = true;
    const avgMs = (this.perf.total / 90) * 1000;
    if (avgMs > 22) {
      console.info(`[quality] avg ${avgMs.toFixed(1)} ms → dropping to low`);
      this.pipeline.disableBloom();
      this.renderer.setPixelRatio(1);
      this.quality = { ...this.quality, tier: 'low' };
    }
  }

  // ---------------------------------------------------------------- debug

  private async initDebug() {
    const [{ default: GUI }, { default: Stats }] = await Promise.all([import('lil-gui'), import('stats-gl')]);
    const stats = new Stats({ trackGPU: false });
    await stats.init(this.renderer);
    document.body.appendChild(stats.dom);
    this.stats = stats;

    this.scene.add(this.cameraPath.debugLines());
    const gui = new GUI({ title: `debug · ${this.isWebGPU ? 'WebGPU' : 'WebGL 2'} · ${this.quality.tier}` });
    const state = { override: false, progress: 0 };
    gui.add(state, 'override').name('pin progress').onChange((v: boolean) => this.scroll.setOverride(v ? state.progress : null));
    gui.add(state, 'progress', 0, 1, 0.001).onChange((v: number) => state.override && this.scroll.setOverride(v));
    const f = gui.addFolder('fog');
    f.add(this.fog.near, 'value', 0, 30).name('near').listen();
    f.add(this.fog.far, 'value', 5, 120).name('far').listen();
    f.add(this.fog.wisps, 'value', 0, 1).name('wisps').listen();
    gui.add(uSparkle, 'value', 0, 4).name('gold dust');
    const s = this.pipeline.bloomStrength;
    if (s) gui.add(s, 'value', 0, 3).name('bloom');
    gui.add({ state: '' }, 'state').name('state').listen().disable();
    setInterval(() => gui.controllers.at(-1)?.setValue(this.fsm.state), 250);
  }
}
