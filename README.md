# Heartglass

An immersive 3D story with a heart builder, built with **Next.js 16 + three.js r186 (WebGPU, WebGL 2 fallback)**. It started from the MVP in [`plan.md`](plan.md) and now includes several of that plan's "after the MVP" upgrades.

The visitor sees a mirror with another world inside it. The glass shatters and the camera flies through. They scroll past floating islands of plaster and gold with falling petals, gold dust, flowers and a cloud sea. Shards then swirl together into a heart, which they customize (material, color, frame, stickers, message) and share. A shared link opens the same heart and gets its own social-preview image.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

WebGPU needs a secure context: `localhost` works, and anything else must be served over HTTPS. In production, set `NEXT_PUBLIC_SITE_URL` (e.g. `https://heartglass.example`) so `og:image` URLs are absolute. On Vercel the production URL is used automatically.

## URL flags

| Flag | Effect |
|---|---|
| `?webgl` | Force the WebGL 2 backend |
| `?tier=high` / `?tier=low` | Override the quality tier |
| `?debug` | lil-gui (pin progress, fog, wisps, gold dust, bloom), stats-gl, camera-path lines |
| `?h=<data>` | Recipient view for a shared heart |

## Where things live

| Path | What |
|---|---|
| `src/app/page.tsx` | Page + per-heart `<title>`/Open Graph metadata from `?h=` |
| `src/app/og/route.tsx` | 1200×630 social image (`next/og`), per heart |
| `src/components/HeartglassApp.tsx` | All markup; loads the engine client-side only |
| `src/experience/Experience.ts` | Renderer, scene, state machine, frame loop |
| `src/experience/world/Mirror.ts` | Ornate mirror, hidden sky tunnel "portal", Voronoi shatter |
| `src/experience/world/Heart.ts` | Heart presets, frames, shard assembly, sticker decals |
| `src/experience/world/` | Also islands + flowers, noise fog + sky, cloud sea, petals/dust |
| `src/experience/materials/` | TSL materials: plaster/gold from vertex colors, gold-dust glints, heart presets |
| `src/lib/heartConfig.ts` | Share-link schema (zod) + base64url encode/decode |
| `src/lib/stickers.ts` | Stickers drawn with Canvas 2D (no image files) |
| `src/lib/story.ts` | Story copy and scroll timings |
| `src/lib/audio.ts` | Web Audio–synthesized ambience, chimes and glass shatter |

## Assets & licenses

- Fonts: Cormorant Garamond and Inter via `next/font` (SIL OFL).
- Lighting: three.js `RoomEnvironment` (generated).
- Audio and stickers: generated in code.
- No third-party models or textures.
