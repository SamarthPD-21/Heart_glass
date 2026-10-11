import { z } from 'zod';

export const MATERIALS = ['gold', 'glass', 'velvet'] as const;
export type MaterialId = (typeof MATERIALS)[number];

export const SWATCHES = [
  '#B3263A', '#E0475B', '#F28FA2', '#8E1B2E', '#C9A24A',
  '#F3E3C3', '#6B4E9B', '#2F6E8E', '#3E7F5B', '#1F1A1A',
] as const;

export const STICKER_IDS = ['heart', 'star', 'spark', 'flower', 'xo', 'moon', 'letter', 'love'] as const;
export type StickerId = (typeof STICKER_IDS)[number];
export const MAX_STICKERS = 8;

const coord = z.number().finite().min(-3).max(3);
export const StickerSchema = z
  .object({
    id: z.enum(STICKER_IDS),
    p: z.tuple([coord, coord, coord]), // position in heart-local space
    n: z.tuple([coord, coord, coord]), // surface normal in heart-local space
    r: z.number().finite().min(-7).max(7), // spin around the normal, radians
  })
  .strict();
export type Sticker = z.infer<typeof StickerSchema>;

export const HeartSchema = z
  .object({
    v: z.literal(1), // schema version: bump when the format changes
    m: z.enum(MATERIALS),
    c: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    f: z.number().int().min(-1).max(1), // -1 none, 0 ring, 1 pearls
    to: z.string().max(30).optional(),
    from: z.string().max(30).optional(),
    msg: z.string().max(140).optional(),
    st: z.array(StickerSchema).max(MAX_STICKERS).optional(),
  })
  .strict();

export type HeartConfig = z.infer<typeof HeartSchema>;

export const DEFAULT_HEART: HeartConfig = { v: 1, m: 'velvet', c: '#B3263A', f: 0 };

const toB64Url = (s: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(s)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const fromB64Url = (s: string) =>
  new TextDecoder().decode(
    Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (ch) => ch.charCodeAt(0)),
  );

/** Drops empty optional strings so links stay short. */
function compact(c: HeartConfig): HeartConfig {
  const out: HeartConfig = { v: 1, m: c.m, c: c.c, f: c.f };
  const to = c.to?.trim(), from = c.from?.trim(), msg = c.msg?.trim();
  if (to) out.to = to;
  if (from) out.from = from;
  if (msg) out.msg = msg;
  if (c.st?.length) {
    const q = (v: number) => Math.round(v * 1000) / 1000; // 3 decimals keeps links short
    out.st = c.st.map((s) => ({
      id: s.id,
      p: [q(s.p[0]), q(s.p[1]), q(s.p[2])],
      n: [q(s.n[0]), q(s.n[1]), q(s.n[2])],
      r: q(s.r),
    }));
  }
  return out;
}

export const encodeHeart = (c: HeartConfig) => toB64Url(JSON.stringify(compact(c)));

export function decodeHeart(s: string): HeartConfig | null {
  try {
    const r = HeartSchema.safeParse(JSON.parse(fromB64Url(s)));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

export function shareUrl(c: HeartConfig) {
  return `${location.origin}${location.pathname}?h=${encodeHeart(c)}`;
}

export function randomHeart(prev: HeartConfig): HeartConfig {
  const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];
  return { ...prev, m: pick(MATERIALS), c: pick(SWATCHES), f: pick([-1, 0, 1]) };
}
