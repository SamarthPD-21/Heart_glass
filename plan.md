# plan.md — MVP: a "Valentime-style" immersive 3D story + heart builder

> **Reference:** https://valentime.noomoagency.com/ (Noomo Agency, launched May 2025)
> **Research date:** October 11, 2026. All library advice is checked against **three.js r186** (Sept 8, 2026), **GSAP 3 (100% free)** and **Lenis**.
> **What this document is:** the **MVP** version of the plan. It covers one developer, about **5 weeks**, and **no Blender work needed**. Everything in the MVP is built from code (procedural geometry, a code-defined camera path, vertex colors set in code). The bigger features from the full plan (shatter, heart assembly, portal, stickers, per-heart social previews, Blender-authored world) are listed in [§9 After the MVP](#9-after-the-mvp--upgrade-path) in the order to add them.

---

## Build status (October 11, 2026)

**v0.2 is built** in this folder on **Next.js 16.3.8 + three.js r186** (`npm run dev`; see `README.md`). It goes beyond the MVP. These items from [§9](#9-after-the-mvp--upgrade-path) are done, without Blender:
- **Gold-dust sparkle** (#1).
- **Noise fog** with drifting wisps (#2).
- **Petals and gold dust** (#3).
- **Mirror shatter** (#4): procedural Voronoi fracture.
- **Heart assembly from shards** (#5).
- **Portal into another world** (#6), done as a hidden sky tunnel behind the frame. It needs no render target or stencil, so it renders the same on both backends.
- **Stickers** (#8), projected onto the heart with `DecalGeometry` and stored in the share link.
- **Per-heart social preview images** (#9), via `next/og` and the `?h=` link, so no database is needed.

Also new:
- a "Say ◯ it" hero headline around the mirror;
- a blush and lavender palette with a sky gradient;
- a cloud sea under the islands and flower clusters on them;
- the story revealed word by word;
- a tabbed customizer;
- WhatsApp, X and LinkedIn share links;
- a synthesized glass-shatter sound.

**Verified** in headless Chromium on the WebGL 2 backend, at desktop (both quality tiers) and phone sizes:
- the full flow, from mirror and shatter through journey, assembly and customizer (including placing stickers) to the share link;
- the recipient link;
- the per-heart Open Graph image and metadata.

**Not verified:**
- **WebGPU visuals.** Headless Chromium on the build machine runs the WebGPU backend without errors but draws nothing, even for a bare test scene. Check it in a real browser.
- **Real-device performance.** Software rendering is far slower than a real GPU.

**Deviations from the plan below:**
- Audio is synthesized with Web Audio, not Howler and audio files.
- Lighting uses `RoomEnvironment`, not an HDRI.
- The mirror no longer uses `reflector()`. The glass is a mist layer over the portal, which is cheaper and identical on both backends.
- A vanilla three.js engine runs inside a single client component; React Three Fiber is not used (decision D2).
- "Heartglass", the hero line and the story copy are placeholders. Replace them with your own.

**Still to do:**
- Blender-authored world (§9 #7).
- DOF, grain and 3 quality tiers (#10).
- Real-device QA.
- Analytics.

---

## Table of contents

0. [TL;DR](#0-tldr)
1. [MVP goal & success criteria](#1-mvp-goal--success-criteria)
2. [Scope: in vs. out](#2-scope-in-vs-out)
3. [Ground rules](#3-ground-rules)
4. [Stack & decisions](#4-stack--decisions)
5. [Architecture](#5-architecture)
6. [Week-by-week build plan](#6-week-by-week-build-plan)
   - [Week 1 — Renderer, scroll, camera, 3 islands, story text](#week-1--renderer-scroll-camera-3-islands-story-text)
   - [Week 2 — Look: gold/plaster material, fog, bloom](#week-2--look-goldplaster-material-fog-bloom)
   - [Week 3 — Heart customizer + share link + recipient view](#week-3--heart-customizer--share-link--recipient-view)
   - [Week 4 — Mirror intro (reflection + click-to-enter)](#week-4--mirror-intro-reflection--click-to-enter)
   - [Week 5 — Polish: loader, sound, mobile tier, a11y, deploy](#week-5--polish-loader-sound-mobile-tier-a11y-deploy)
7. [Budgets & quality tiers](#7-budgets--quality-tiers)
8. [MVP checklist](#8-mvp-checklist)
9. [After the MVP — upgrade path](#9-after-the-mvp--upgrade-path)
10. [Risks](#10-risks)
11. [Sources](#11-sources)

---

## 0. TL;DR

- **Experience:** Loader → **mirror** (click "Enter") → crossfade → **scroll-driven camera glide past 3 floating islands** with 3 story lines → **floating heart** → **customizer** (color, 3 materials, 3 frame options, optional message) → **share link** → recipient page shows the same heart.
- **Stack:** Vite + **vanilla TypeScript** · `three@0.186.0` `WebGPURenderer` (falls back to WebGL 2 on its own) · **TSL** shaders · **Lenis + GSAP ScrollTrigger** · Howler.js · Vercel (static).
- **No art pipeline:** islands are merged primitives (cylinders, boxes, icosahedra) with **vertex colors set in code** (R = gold mask, G = fake AO). The heart is an `ExtrudeGeometry` with bevel. The camera path is a `CatmullRomCurve3`.
- **No backend:** the heart config is JSON → base64url in a `?h=` query parameter.
- **Effort:** ~5 weeks solo (~20 working days); each week ends with something you can deploy.

---

## 1. MVP goal & success criteria

**Goal:** prove the core loop (*story → emotion → make something → send it*) with the smallest build that still feels premium.

The MVP is **done** when all of these are true:

1. A first-time visitor can go from the loader to a shared link in **under 2 minutes**, with no instructions.
2. Scrolling down and back up is smooth and fully reversible. It runs at **60 fps on a mid-range laptop** and **at least 30 fps on a mid-range phone**.
3. The same build runs on the **WebGPU** and **WebGL 2** backends (test with `?webgl`).
4. A link made on desktop opens on a phone and shows **the identical heart**: same color, material, frame and message.
5. Total download before the mirror shows: **≤ 3 MB** (no large models in the MVP).
6. You can finish the experience with the **keyboard only** and with **reduced motion** turned on.

---

## 2. Scope: in vs. out

| Feature | MVP | Later (see §9) |
|---|---|---|
| Loader with progress | ✅ simple | custom animation |
| Mirror intro | ✅ `reflector()` + soft glow, click → crossfade | portal view into the world, **shatter** |
| Scroll journey | ✅ 3 islands, code camera path, DOM story lines | 5–7 Blender islands, Blender camera clip, DOF |
| Materials | ✅ plaster ↔ gold from vertex colors | gold-dust sparkle, baked AO from Blender |
| Fog | ✅ one `rangeFogFactor` fog, color tweened per zone | 6 noise-fog variants |
| Post | ✅ bloom | DOF, grain, vignette, chromatic aberration |
| Petals / dust | ❌ | instanced petals, dust sprites |
| Heart | ✅ procedural mesh, idle float + heartbeat glow | Blender heart with baked maps, **shard assembly** |
| Customizer | ✅ color (10 swatches), 3 materials, 3 frame options, message | 5 materials, stickers/decals, undo/redo |
| Sharing | ✅ `?h=` URL, copy link / `navigator.share` | short links + DB + **per-heart OG images** (Next.js) |
| Recipient view | ✅ heart + message + "Make your own" | reveal animation |
| Audio | ✅ ambient loop + 2 SFX + mute toggle | full sound design |
| Microinteractions | ✅ hover/press states | magnetic buttons, sparkle cursor |
| Quality tiers | ✅ 2 tiers (high / low) | 3 tiers + adaptive downgrade |
| Accessibility | ✅ reduced motion, keyboard, skip button | static "read the story" page |

---

## 3. Ground rules

**Recreate the techniques, not the work.**

- ✅ Reuse: the *structure* (mirror → journey → heart → customize → share) and the rendering techniques.
- ❌ Don't reuse: Noomo's models, textures, copy, logo, the "ValenTime" name, story wording, sounds or UI artwork. Don't rip anything from their bundle.
- Write your own 3 story lines + CTA. License fonts (Google Fonts), audio (licensed/CC0) and the HDRI (Poly Haven is CC0).

---

## 4. Stack & decisions

| Layer | MVP choice | Note |
|---|---|---|
| Build | **Vite + TypeScript** (vanilla template) | Fewest moving parts; React can come later if the UI grows |
| Renderer | `three@0.186.0`, `WebGPURenderer` from `three/webgpu` | WebGPU where available, WebGL 2 fallback otherwise |
| Shaders | **TSL** (`three/tsl`) | `ShaderMaterial` / `onBeforeCompile` **don't work** on `WebGPURenderer` |
| Post | `THREE.RenderPipeline` + `bloom()` | `PostProcessing` was renamed `RenderPipeline` in r183; `EffectComposer` doesn't work here |
| Scroll | **Lenis** + **GSAP ScrollTrigger** | |
| Audio | **Howler.js** | |
| Validation | **zod** | For decoding share links |
| Hosting | **Vercel** (static) | HTTPS is needed for WebGPU |
| Debug | `lil-gui` + `stats-gl` behind `?debug` | |

**Decisions recorded**
- **D1 — Vanilla TS, not React/R3F.** The UI is a loader, 3 text lines, a panel of ~20 buttons and a modal. Plain DOM + CSS is enough. Switch to React only if the customizer grows (stickers, undo/redo).
- **D2 — Code-only content.** There's no Blender in the MVP, so art never blocks code. Every procedural asset sits behind a function (`createIsland()`, `createHeart()`), so a `.glb` can replace it later without touching the rest.
- **D3 — Camera path in code.** A `CatmullRomCurve3` for position plus a second curve for the look-at target. Later it can be swapped for a Blender `CameraPath` clip (full-plan Phase 4.2) with the same `progress → pose` interface.
- **D4 — Share = URL only.** `?h=<base64url JSON>`. Use a query parameter, not a `#hash`, so moving to server-side previews later needs no format change.
- **D5 — Story text is DOM.** It stays crisp and accessible, and needs no 3D text.

---

## 5. Architecture

### 5.1 State machine

```
BOOT ─► LOADING ─► MIRROR ──(click "Enter" / Enter key)──► JOURNEY (scroll 0→1)
                                                              │ progress ≥ 0.97
                                                              ▼
                                                           HEART (float in, ~1.5 s)
                                                              ▼
                                                           CUSTOMIZER ─► SHARE (modal)

?h=... ─► LOADING ─► RECIPIENT (heart + message) ─► "Make your own" → /
```

A hand-rolled FSM (`go(state)`, `onEnter`/`onExit`) is enough. Each state decides: whether scroll is on, which UI is shown, and which systems update.

### 5.2 Folder structure

```
/src
  main.ts                    # boot: read ?h, pick main flow vs recipient
  /experience
    Experience.ts            # renderer, scene, camera, loop, FSM
    Renderer.ts              # WebGPURenderer init, backend detection, resize, DPR
    Pipeline.ts              # RenderPipeline: scene pass + bloom
    Scroll.ts                # Lenis + ScrollTrigger + damped progress
    CameraPath.ts            # curves → camera pose; mouse parallax
    Quality.ts               # high / low tier
    /world
      Islands.ts             # procedural islands (merged primitives + vertex colors)
      Mirror.ts              # frame + reflector() glass
      Fog.ts                 # fog uniforms, per-zone color/density
      Heart.ts               # heart mesh, frames, materials, idle + heartbeat
    /materials
      environment.ts         # plaster ↔ gold from vertex color
      heart.ts               # gold / glass / velvet presets
  /ui
    loader.ts  story.ts  customizer.ts  share.ts  recipient.ts  sound.ts
    styles.css
  /lib
    fsm.ts  heartConfig.ts  audio.ts
/public
  /audio  ambient.mp3  enter.mp3  tick.mp3
  /env    studio_1k.hdr
  og.jpg                     # one static 1200×630 social image
```

### 5.3 Frame loop

```ts
import * as THREE from 'three/webgpu';

const timer = new THREE.Timer();          // Clock is deprecated since r183
renderer.setAnimationLoop((t) => {
  timer.update(t);
  const dt = timer.getDelta();
  scroll.update(dt);                      // damped progress 0..1
  fsm.update(dt);
  cameraPath.update(scroll.progress, dt); // pose from curves + parallax
  world.update(dt, scroll.progress, camera);
  pipeline.render();                      // RenderPipeline, not renderer.render
});
```

---

## 6. Week-by-week build plan

Each week ends with a **deployable build** on a Vercel preview URL. Test it on a real phone that same week.

---

### Week 1 — Renderer, scroll, camera, 3 islands, story text

**Day 1 — Bootstrap**
```bash
npm create vite@latest valentime-mvp -- --template vanilla-ts
cd valentime-mvp
npm i three@0.186.0 gsap lenis howler zod
npm i -D @types/three @types/howler lil-gui stats-gl
```
Pin `three` exactly; `npm ls three` must show one copy.

**Day 1 — Renderer with fallback**
```ts
import * as THREE from 'three/webgpu';

const forceWebGL = new URLSearchParams(location.search).has('webgl');
const renderer = new THREE.WebGPURenderer({ antialias: true, forceWebGL });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.querySelector('#app')!.appendChild(renderer.domElement);

try { await renderer.init(); } catch { showStaticFallback(); }
const isWebGPU = renderer.backend.isWebGPUBackend === true; // only valid AFTER init
```
`renderer.isWebGPURenderer` is true on **both** backends, so don't use it to detect WebGPU. Calling `render()` before `init()` throws.

**Day 2 — Procedural islands** (`Islands.ts`)
- Each island = a flattened, rough **base rock** (`IcosahedronGeometry(r, 2)`, squashed on Y, vertices jittered with a seeded random) + **4–10 broken columns** (`CylinderGeometry` with random heights, some tilted or lying down) + **1 hero prop** per island (e.g., an arch made of boxes, a sphere on a plinth, a ring). Design your own.
- Give every piece a `color` attribute: **R = gold mask** (0 plaster, 1 gold; e.g. column capitals and the hero prop are gold), **G = fake AO** (darker toward the bottom: `0.55 + 0.45 * smoothstep(minY, maxY, y)`).
- Merge each island into **one geometry** (`mergeGeometries` from `three/addons/utils/BufferGeometryUtils.js`) → 1 draw call per island.
- Place 3 islands roughly 25–35 m apart along a gentle S-curve, at different heights. The fog (week 2) will hide the next island until you get close.

```ts
function paint(geo: THREE.BufferGeometry, gold: number) {
  geo.computeBoundingBox();
  const { min, max } = geo.boundingBox!;
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const h = (pos.getY(i) - min.y) / (max.y - min.y || 1);
    col[i * 3] = gold;                  // R: gold mask
    col[i * 3 + 1] = 0.55 + 0.45 * h;   // G: fake AO
    col[i * 3 + 2] = 0;                 // B: free
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
```
(Before merging, make sure every piece has the same attributes: `position`, `normal`, `uv`, `color`, and is either all indexed or all non-indexed.)

**Day 3 — Scroll + camera path**
```ts
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);

const lenis = new Lenis({ smoothWheel: true });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

let target = 0;
ScrollTrigger.create({
  trigger: '#journey', start: 'top top', end: 'bottom bottom',
  onUpdate: (self) => { target = self.progress; },
});
// in the loop:
progress = THREE.MathUtils.damp(progress, target, 4, dt);
```
- Canvas: `position: fixed; inset: 0`. `#journey` is a spacer of ~`600vh` (tune by feel).
- `lenis.stop()` in MIRROR / HEART / CUSTOMIZER, `lenis.start()` in JOURNEY.

```ts
// CameraPath.ts
const posCurve  = new THREE.CatmullRomCurve3([/* 6–8 points weaving past the islands */], false, 'centripetal');
const lookCurve = new THREE.CatmullRomCurve3([/* points on/near each hero prop, ending at the heart spot */], false, 'centripetal');

export function update(p: number, dt: number) {
  const e = easeInOutSine(p);                    // gentle start/end
  camera.position.copy(posCurve.getPointAt(e));
  lookTarget.lerp(lookCurve.getPointAt(e), 1 - Math.exp(-6 * dt)); // damped look
  camera.lookAt(lookTarget);
  // mouse parallax on top (never fight the path)
  camera.position.addScaledVector(right, mouse.x * 0.15);
  camera.position.addScaledVector(up,   -mouse.y * 0.10);
}
```
- Draw both curves with `Line` behind `?debug` to tune them.
- **Portrait screens:** widen FOV, e.g. `camera.fov = aspect < 1 ? 60 : 45`.
- No camera roll; keep turns gentle (motion sickness).

**Day 4 — Story overlay**
- 3 lines + 1 CTA line as DOM in a fixed overlay. Each has `{ start, peak, end }` in progress units:

  | Progress | Beat | Line |
  |---|---|---|
  | 0.05–0.30 | Island 1 | Line 1 (your copy, ≤ 20 words) |
  | 0.35–0.60 | Island 2 | Line 2 |
  | 0.65–0.88 | Island 3 | Line 3 |
  | 0.90–0.97 | Heart spot | CTA line |
- Each frame: `opacity = smoothstep(start, peak, p) * (1 - smoothstep(peak, end, p))`, plus a little `translateY` and `blur`. Plain math, no timeline needed.
- A thin progress bar at the bottom.

**Day 5 — Debug + deploy**
- `?debug`: lil-gui (progress slider, fog, bloom, tier), `stats-gl`, backend label.
- Push to GitHub → Vercel. Test on a phone.

**Done when:** scrolling glides the camera past 3 grey islands with the story lines fading in and out; reversing works; it runs on WebGPU and with `?webgl`.

---

### Week 2 — Look: gold/plaster material, fog, bloom

**Environment material** (`materials/environment.ts`)
```ts
import * as THREE from 'three/webgpu';
import { vertexColor, color, float, mix, normalView, positionViewDirection } from 'three/tsl';

export function createEnvironmentMaterial() {
  const m = new THREE.MeshStandardNodeMaterial();
  const vc = vertexColor();
  const goldMask = vc.r, ao = vc.g;
  const plaster = color('#F4EFE8'), gold = color('#C9A24A');

  m.colorNode = mix(plaster, gold, goldMask).mul(mix(float(0.55), float(1.0), ao));
  m.metalnessNode = goldMask;
  m.roughnessNode = mix(float(0.92), float(0.32), goldMask);

  // cheap "sacred glow" on gold edges, picked up by bloom
  const fresnel = float(1).sub(normalView.dot(positionViewDirection).saturate()).pow(3);
  m.emissiveNode = gold.mul(fresnel.mul(0.35)).mul(goldMask);
  return m;
}
```

**Lighting**
- `scene.environment` = a soft CC0 studio/overcast HDRI at 1k (`HDRLoader`, or `RGBELoader` if your r186 build still ships it; check `three/addons/loaders/`), intensity 0.4–0.8.
- One `DirectionalLight` for gold highlights. **Shadows off.**

**Fog** (`world/Fog.ts`)
```ts
import { fog, rangeFogFactor, uniform } from 'three/tsl';

export const fogColor = uniform(new THREE.Color('#F6F2EC'));
export const fogNear = uniform(8), fogFar = uniform(55);
scene.fogNode = fog(fogColor, rangeFogFactor(fogNear, fogFar));
scene.backgroundNode = fogColor;      // seamless horizon
```
- `rangeFog()` / `densityFog()` were removed. Use `fog(color, rangeFogFactor(...))` as above.
- **Per-zone mood:** each island gets a slightly different fog tint/near/far. Blend between them by scroll progress (lerp the uniform values in the loop). This is the MVP stand-in for the 6 noise-fog variants.
- Set `camera.far` just past `fogFar`, so anything the fog hides isn't drawn at all.

**Bloom** (`Pipeline.ts`)
```ts
import { pass } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';

const pipeline = new THREE.RenderPipeline(renderer);
const scenePass = pass(scene, camera);
const sceneColor = scenePass.getTextureNode('output');
pipeline.outputNode = sceneColor.add(bloom(sceneColor, 0.5, 0.4, 0.85)); // strength, radius, threshold
```

**Idle life (cheap):** slowly bob each island (`sin(time)` on Y, ±5 cm, different phases) and turn the hero props slowly.

**Done when:** the islands read as white plaster with gold accents in soft fog; each zone feels slightly different; the frame glows without washing out; still 60 fps on desktop.

> **Timebox:** look-dev is the classic rabbit hole. Give it 2 days max, lock "good enough", and polish in week 5.

---

### Week 3 — Heart customizer + share link + recipient view

**Heart mesh** (`world/Heart.ts`): an extruded 2D heart shape.
```ts
const s = new THREE.Shape()
  .moveTo(25, 25)
  .bezierCurveTo(25, 25, 20, 0, 0, 0)
  .bezierCurveTo(-30, 0, -30, 35, -30, 35)
  .bezierCurveTo(-30, 55, -10, 77, 25, 95)
  .bezierCurveTo(60, 77, 80, 55, 80, 35)
  .bezierCurveTo(80, 35, 80, 0, 50, 0)
  .bezierCurveTo(35, 0, 25, 25, 25, 25);

const geo = new THREE.ExtrudeGeometry(s, {
  depth: 20, bevelEnabled: true, bevelSegments: 12, bevelSize: 14, bevelThickness: 14, curveSegments: 48,
});
geo.center();
geo.rotateZ(Math.PI);        // the classic shape is upside-down
geo.scale(0.01, 0.01, 0.01); // ~1 m tall
geo.computeVertexNormals();
```
A big bevel makes it look puffy rather than like a cookie-cutter shape. Tune `bevelSize`/`bevelThickness` by eye.

**Arrival:** when progress ≥ 0.97 → `fsm.go('HEART')` → `lenis.stop()`, GSAP the heart from scale 0 / y −1 to its place (1.5 s, `expo.out`) with a short bloom-strength swell → then `CUSTOMIZER`.

**Idle + heartbeat:** gentle bob and slow yaw in code. The emissive intensity follows a two-pulse "lub-dub" curve at ~65 bpm (a small function of time, either in TSL or as a uniform set from JS).

**Config schema** (`lib/heartConfig.ts`)
```ts
import { z } from 'zod';

export const HeartSchema = z.object({
  v: z.literal(1),                              // schema version
  m: z.enum(['gold', 'glass', 'velvet']),       // material
  c: z.string().regex(/^#[0-9a-fA-F]{6}$/),     // color
  f: z.number().int().min(-1).max(1),           // frame: -1 none, 0 ring, 1 beads
  to: z.string().max(30).optional(),
  from: z.string().max(30).optional(),
  msg: z.string().max(140).optional(),
}).strict();
export type HeartConfig = z.infer<typeof HeartSchema>;

const toB64Url = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64Url = (s: string) => new TextDecoder().decode(
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (ch) => ch.charCodeAt(0)));

export const encodeHeart = (c: HeartConfig) => toB64Url(JSON.stringify(c));
export const decodeHeart = (s: string) => HeartSchema.safeParse(JSON.parse(fromB64Url(s)));
```
Wrap `decodeHeart` in try/catch (bad base64/JSON). Treat names/messages as **text only**: use `textContent`, never `innerHTML`.

**Materials** (`materials/heart.ts`): 3 presets on `MeshPhysicalNodeMaterial`, all using one shared color uniform:

| Preset | Settings |
|---|---|
| Gold | metalness 1, roughness 0.25 |
| Glass | transmission 1, thickness 0.5, ior 1.45, roughness 0.05 (**low tier:** fake it with metalness 0.1, roughness 0.05, opacity 0.6 + fresnel emissive) |
| Velvet | sheen 1, sheenRoughness 0.5, roughness 0.9 |

```ts
import { uniform } from 'three/tsl';
export const uColor = uniform(new THREE.Color('#B3263A'));
// each preset: mat.colorNode = uColor;
// color change = gsap.to(uColor.value, { r, g, b, duration: 0.4 })  — no recompile
```
Swapping presets compiles a new pipeline. **Build all 3 materials at startup and `await renderer.compileAsync(...)` with each one during the journey**, so swaps are instant. Hide the swap with a quick 0.95 → 1 scale pulse.

**Frames:** `-1` none, `0` = thin gold `TorusGeometry` ring around the heart, `1` = a ring of ~24 small gold spheres (`InstancedMesh`). Both use the environment material with goldMask = 1 (or a plain gold `MeshStandardNodeMaterial`). Animate in with scale 0 → 1 (0.4 s, `back.out`).

**Customizer UI** (`ui/customizer.ts`)
- `OrbitControls` (`three/addons/controls/OrbitControls.js`): damping on, pan off, distance and polar angle clamped, slow auto-rotate after 4 s idle.
- Panel with 4 groups: **Material** (3 buttons) · **Color** (10 swatches) · **Frame** (3 buttons) · **Message** (to / from / message inputs with character counters). Plus **Randomize** and **Reset**.
- Desktop: side panel. Mobile: bottom sheet ≤ 40% of the screen; shift the orbit target so the heart sits above it.
- All controls are real `<button>` / `<input>` elements with labels.

**Share** (`ui/share.ts`)
```ts
const url = `${location.origin}/?h=${encodeHeart(config)}`;
if (navigator.share) await navigator.share({ title: 'A heart for you', url });
else { await navigator.clipboard.writeText(url); toast('Link copied'); }
```

**Recipient view** (`ui/recipient.ts`): `main.ts` sees `?h=` → skips the mirror and journey → light loader → fog clears → heart scales in → "To / From / message" types in → button "Make one for someone" → `/`. On an invalid link: a friendly message + the same button.

**Done when:** every option updates in under 100 ms with no hitch; save → open link → identical heart; it works with touch; an invalid link shows the fallback.

---

### Week 4 — Mirror intro (reflection + click-to-enter)

**Mirror** (`world/Mirror.ts`), built from code:
- **Frame:** a `Shape` of an arched or oval outline with a hole (`shape.holes.push(...)`) → `ExtrudeGeometry` with bevel → gold material. Add a few small spheres/tori as ornaments.
- **Glass:** a `PlaneGeometry` (or `ShapeGeometry` of the hole) facing +Z.

```ts
import { reflector, uniform, mix, color } from 'three/tsl';

const reflection = reflector({ resolutionScale: 0.5 });   // low tier: 0.25
glass.add(reflection.target);
const haze = uniform(0.25);                                // 0 = clear reflection, 1 = milky
const glassMat = new THREE.MeshBasicNodeMaterial();
glassMat.colorNode = mix(reflection, color('#F6F2EC'), haze);
```
The old `Reflector` addon is **WebGL-only**; on `WebGPURenderer` use the `reflector()` node.

- Place the mirror in its own small "intro" area in front of island 1, in dense fog.
- Hover/mouse near → lower `haze` slightly + subtle camera push-in. This sells the idea that the mirror is alive.
- **Enter** (button + Enter key + click on the mirror) → audio unlock + ambient fade-in → GSAP: camera dollies toward the glass while a full-screen **white fade** rises (DOM overlay or a bloom/exposure swell) → under the white, hide the mirror and move to progress 0 of the journey → fade out → `JOURNEY`, `lenis.start()`.
- Only render the reflector while in `MIRROR`. Afterwards, remove the mirror from the scene and `dispose()` its geometry, materials and render target.

**Pre-compile:** behind the loader, `await renderer.compileAsync(scene, camera)` with the mirror, islands, heart and all 3 heart materials present, so nothing hitches on first appearance.

**Done when:** the mirror reflects its surroundings, reacts to the mouse, and the white-fade transition into the journey is seamless on both backends.

---

### Week 5 — Polish: loader, sound, mobile tier, a11y, deploy

**Loader**
- Progress = HDRI + audio via `LoadingManager` (most of the bar) + `compileAsync` (the last 10–20%).
- Shown for at least ~1 s so it doesn't flash. Your own copy and a small animation (pulsing gold dot or line).

**Audio** (`lib/audio.ts`)
```ts
import { Howl, Howler } from 'howler';
const ambient = new Howl({ src: ['/audio/ambient.mp3'], loop: true, volume: 0 });
const enterSfx = new Howl({ src: ['/audio/enter.mp3'] });
const tick = new Howl({ src: ['/audio/tick.mp3'], volume: 0.4 });
// start ONLY from the Enter click (autoplay rules)
```
- Sound toggle → `Howler.mute(bool)`, remembered in `localStorage` (wrapped in try/catch).
- Pause on `visibilitychange`. Never rely on audio for meaning (iOS silent switch).

**Quality tiers** (`experience/Quality.ts`, see §7): pick high/low at startup; apply DPR, bloom, reflector resolution and the glass fallback.

**Accessibility**
- `prefers-reduced-motion`: no parallax or bob, a plain crossfade instead of the dolly, shorter scroll spacer, no bloom swell.
- **"Skip to the heart"** button, always reachable by keyboard.
- Canvas gets `aria-hidden="true"`; story lines are real text; an `aria-live` region announces state changes ("Your heart is ready to customize").
- Visible focus rings; WCAG AA contrast for text over bright fog (dark text, or a soft backdrop).
- **No WebGPU and no WebGL 2:** a static poster + the story text + "your browser can't show this experience".

**Microinteractions (minimal):** hover/press states on every button, UI tick sound, a small scale pulse on the heart on each change.

**Deploy (Vercel)**
- Long cache (`Cache-Control: public, max-age=31536000, immutable`) on hashed assets (Vite hashes JS/CSS; put audio/HDRI under `/public` with versioned names).
- Meta: title, description, **static** OG image `og.jpg` (1200×630), canonical URL.
- Optional: privacy-friendly analytics events `enter`, `journey_complete`, `heart_created`, `link_shared`, `recipient_opened`, with `backend=webgpu|webgl2` and `tier`.

**Done when:** every item in §8 is checked.

---

## 7. Budgets & quality tiers

| Metric | Desktop | Mobile |
|---|---|---|
| Download before mirror | ≤ 3 MB | ≤ 3 MB |
| Draw calls | ≤ 60 | ≤ 40 |
| Frame time | 16.6 ms | ≤ 33 ms worst case |
| App JS (gzip, excl. three) | ≤ 100 KB | same |

A minimal `three/webgpu` bundle was measured at ~220 KB gzipped (r186). **Don't** also import `WebGLRenderer` from `three`, which bloats the bundle.

| Setting | High | Low |
|---|---|---|
| Pixel ratio | min(dpr, 2) | 1 – 1.25 |
| Bloom | on | off (emissive only) |
| Reflector `resolutionScale` | 0.5 | 0.25 |
| Heart glass | real transmission | faked |
| Island idle bob | on | on |

- **Start tier:** WebGPU on desktop → High. WebGL 2 backend, mobile (`matchMedia('(pointer: coarse)')`), or `navigator.deviceMemory ≤ 4` → Low.
- Optional: after the reveal, average the frame time over 90 frames; if it's > 22 ms on High, drop to Low once (never switch back up).

---

## 8. MVP checklist

**Build**
- [ ] Runs on WebGPU **and** `?webgl`
- [ ] No `ShaderMaterial` / `onBeforeCompile` / `EffectComposer` anywhere
- [ ] `compileAsync` covers the mirror, islands, heart and all 3 heart materials
- [ ] Reverse scroll, resize and tab-switch pause all work
- [ ] Mirror reflector disposed after the intro; `renderer.info.memory` stable

**Experience**
- [ ] Loader → mirror → journey → heart → customizer → share in under 2 min, no instructions needed
- [ ] 3 story lines + CTA written by you, appear at the right beats
- [ ] Color / material / frame / message all update instantly
- [ ] Share link round-trips: desktop → phone → identical heart
- [ ] Invalid `?h=` shows a friendly fallback

**Devices** (minimum)
- [ ] Chrome desktop (WebGPU) · Safari macOS 26 (WebGPU)
- [ ] iPhone on iOS 26 (WebGPU) · older iPhone / iOS < 26 (WebGL 2)
- [ ] Mid-range Android Chrome (check after 2–3 min for thermal throttling)
- [ ] Firefox on Linux/Android (WebGL 2)

**Accessibility & launch**
- [ ] Keyboard-only run-through; reduced-motion run-through
- [ ] Sound off by default until Enter; toggle remembered
- [ ] Static OG image + meta tags; HTTPS; licenses for font/audio/HDRI noted in the README

---

## 9. After the MVP — upgrade path

Add features in order of **"wow per hour"**. Each one plugs into an interface the MVP already has.

| # | Upgrade | Plugs into | Needs |
|---|---|---|---|
| 1 | **Gold-dust sparkle** (view-dependent noise glints, masked to gold) | `environment.ts` `emissiveNode` | code only, ~1 day |
| 2 | **Noise fog variants** per zone (`triNoise3D` wisps, height falloff, screen-edge mask; start from `webgpu_custom_fog*` examples) | `Fog.ts` | code only, 2–3 days |
| 3 | **Petals** (`InstancedMesh` + TSL drift on `positionGeometry`) + dust sprites | new `Petals.ts` | code only, 2 days |
| 4 | **Mirror shatter** (Blender Cell Fracture + rigid body baked to keyframes, played with code offsets on top) | replaces the white-fade in `Mirror.ts` | **Blender**, ~1 week |
| 5 | **Heart assembly** from hand-animated shards | replaces the scale-in in `Heart.ts` | **Blender**, ~1 week |
| 6 | **Portal**: inner scene rendered to a render target from the same camera, sampled by `screenUV` on the glass | `Mirror.ts` glass `colorNode` | code, ~1 week |
| 7 | **Blender world**: islands from Geometry Nodes scattering, vertex-color/`_`-attribute materials, `CameraPath` clip scrubbed by scroll, gltf-transform Meshopt pipeline | replaces `Islands.ts` + `CameraPath.ts` | **Blender**, 3–5 weeks |
| 8 | **Stickers** (`DecalGeometry`, or preset anchor slots) + 2 more materials (pearl/iridescence, porcelain/clearcoat) + undo/redo | `heartConfig` → `v: 2` | code, ~1 week (consider moving UI to React here) |
| 9 | **Short links + per-heart OG images**: Next.js `/h/[id]`, DB table `hearts(id, config, thumb_url)`, `generateMetadata` + `ImageResponse` at 1200×630, rate limiting, abuse report link | `share.ts`, hosting | backend, ~1 week |
| 10 | DOF, grain, vignette; 3 quality tiers + adaptive downgrade; magnetic buttons, sparkle cursor; full sound design | `Pipeline.ts`, `Quality.ts`, UI | ongoing |

Key gotchas to remember when you reach these:
- Blender's glTF exporter only exports custom attributes whose names **start with `_`** (with *Mesh → Attributes* enabled). Test-export early and check with `gltf-transform inspect`.
- Compress geometry **and** animation with **Meshopt** (camera/shard clips are animation-heavy). KTX2 only for the few texture sets (the hero heart).
- Animating FOV/DOF focus via glTF isn't reliable. Export per-frame camera JSON from a Blender script if you need it.
- Microsoft Maquette (Noomo's VR petal-placement tool) is discontinued. Hand-place empties in Blender instead.
- Crawlers never run WebGL and never see `#hash`, so per-heart previews need server-rendered meta tags.

---

## 10. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| WebGPU vs WebGL 2 look differences | High | Medium | Test `?webgl` every week; per-backend tweaks via `renderer.backend.isWebGPUBackend` |
| Procedural art looks "programmer-y" | High | High | Strong palette (off-white `#F6F2EC`, gold `#C9A24A`, red `#B3263A`), fog + bloom do the heavy lifting; keep shapes simple and elegant; one good serif display font |
| Look-dev rabbit hole | High | Schedule | Week 2 timebox (2 days); polish only in week 5 |
| Mobile perf / thermal throttling | High | High | Low tier from day one; real-phone test every Friday |
| Pipeline-compile hitches (material swaps, first appearance) | Medium | Medium | `compileAsync` behind the loader for every state and preset |
| Three.js API churn | Medium | Medium | Pin `three@0.186.0`; read the Migration Guide before upgrading |
| Motion sickness | Medium | Medium | Gentle curves, no roll, reduced-motion mode |
| Abuse in shared messages | Low (URL-only, nothing stored) | Medium | 140-char cap, `textContent` only; add filtering/reporting when moving to a DB (§9 #9) |
| IP concerns | Low (if original) | High | §3 ground rules |

---

## 11. Sources

Primary sources about the reference site:
- Noomo Valentime (live): https://valentime.noomoagency.com/ and /about
- Awwwards case study, "Noomo ValenTime — immersive storytelling about love" (Jun 2025): https://www.awwwards.com/noomo-valentime-immersive-storytelling-about-love.html
- Noomo insights article (May 2025): https://noomoagency.com/insights/noomo-valentime-immersive-storytelling
- Noomo, "The Power of Digital Storytelling: Behind the Scenes" (Aug 2026; KTX vs Draco lessons): https://noomoagency.com/insights/the-power-of-digital-storytelling-website
- Noomo Dribbble: https://dribbble.com/noomoagency

Technical sources (checked Oct 2026):
- three.js `PostProcessing` → `RenderPipeline` (deprecated since r183): https://threejs.org/docs/pages/PostProcessing.html
- three.js WebGPU post-processing manual: https://threejs.org/manual/en/webgpu-postprocessing.html
- three.js `ReflectorNode` docs: https://threejs.org/docs/pages/ReflectorNode.html (and `Reflector` is WebGL-only: https://threejs.org/docs/pages/Reflector.html)
- three.js `VertexColorNode` docs: https://threejs.org/docs/pages/VertexColorNode.html
- three.js TSL wiki: https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language
- three.js releases / migration guide: https://github.com/mrdoob/three.js/releases
- Utsubo, WebGPU + Three.js Migration Guide (r186, Sept 2026): https://www.utsubo.com/blog/webgpu-threejs-migration-guide
- Utsubo, What's New in Three.js (2026): https://www.utsubo.com/blog/threejs-2026-what-changed
- web.dev, "WebGPU is now supported in major browsers": https://web.dev/blog/webgpu-supported-major-browsers
- gpuweb implementation status: https://github.com/gpuweb/gpuweb/wiki/Implementation-Status
- Blender Cell Fracture extension (for §9): https://extensions.blender.org/add-ons/cell-fracture/
- Blender glTF exporter: custom attributes must start with `_`: https://developer.blender.org/rBAd5732014b103c7dd28e79bdc8e4bffc8201ba260 ; community notes: https://discourse.threejs.org/t/gltf-export-custom-attributes/12443
- glTF Transform CLI (for §9): https://gltf-transform.dev/cli
- GSAP is free incl. all plugins: https://classic.yarnpkg.com/en/package/gsap
- Lenis (GSAP integration): https://github.com/darkroomengineering/lenis
- Portal technique discussion (for §9): https://discourse.threejs.org/t/how-to-create-a-portal-effect-or-how-to-fake-it/57752
- Codrops, dual-scene reveal with TSL/WebGPU (Mar 2026): https://tympanus.net/codrops/2026/03/23/building-a-dual-scene-fluid-x-ray-reveal-effect-in-three-js/
- Microsoft Maquette discontinued: https://mixed-news.com/en/microsoft-discontinues-3d-tool-maquette-for-vr-creation/
- Vercel OG image generation (for §9): https://vercel.com/docs/og-image-generation

---

*Version 2.0-MVP — October 11, 2026. Condensed from the full v1.0 plan. Re-check the three.js Migration Guide before upgrading past r186.*
