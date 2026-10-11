/** Story copy (placeholder: replace with your own). Timings are in scroll-progress units 0..1. */
export interface StoryLine { text: string; start: number; peak: number; end: number; cta?: boolean }

export const STORY: StoryLine[] = [
  { text: 'Every love story begins with a reflection, the moment you see yourself in someone else.', start: 0.06, peak: 0.16, end: 0.28 },
  { text: 'Some words wait for years, carried quietly like stones in a pocket.', start: 0.33, peak: 0.42, end: 0.53 },
  { text: 'But time is the one thing a heart can never get back.', start: 0.57, peak: 0.64, end: 0.75 },
  { text: "So don't wait. Make something for the one you love.", start: 0.84, peak: 0.91, end: 1.2, cta: true },
];
