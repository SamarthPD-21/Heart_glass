export type Tier = 'high' | 'low';

export interface QualitySettings {
  tier: Tier;
  pixelRatio: number;
  bloom: boolean;
  reflectorScale: number;
  fakeGlass: boolean;
}

/** Tier is decided once at startup, before the backend is known. */
export function detectTier(): Tier {
  const q = new URLSearchParams(location.search).get('tier');
  if (q === 'high' || q === 'low') return q;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const mem = (navigator as { deviceMemory?: number }).deviceMemory;
  const forcedWebGL = new URLSearchParams(location.search).has('webgl');
  const noWebGPU = !('gpu' in navigator);
  if (coarse || forcedWebGL || noWebGPU || (mem !== undefined && mem <= 4)) return 'low';
  return 'high';
}

export function settingsFor(tier: Tier): QualitySettings {
  return tier === 'high'
    ? { tier, pixelRatio: Math.min(devicePixelRatio, 2), bloom: true, reflectorScale: 0.5, fakeGlass: false }
    : { tier, pixelRatio: Math.min(devicePixelRatio, 1.25), bloom: false, reflectorScale: 0.25, fakeGlass: true };
}
