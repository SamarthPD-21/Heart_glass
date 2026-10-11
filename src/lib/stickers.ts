import type { StickerId } from './heartConfig';

/**
 * Stickers are drawn with the Canvas 2D API, so they need no image files and stay
 * crisp at any size. The same drawing feeds the 3D texture and the button preview.
 */

const GOLD = '#C9A24A';
const CREAM = '#FFF8EC';
const RED = '#B3263A';

type Draw = (c: CanvasRenderingContext2D, s: number) => void;

/** next/font registers the serif under a hashed family name; read it from the CSS variable. */
let serifFamily: string | null = null;
function serif() {
  serifFamily ??= getComputedStyle(document.documentElement).getPropertyValue('--font-serif').trim() || '"Cormorant Garamond"';
  return `${serifFamily}, Georgia, serif`;
}

function heartPath(c: CanvasRenderingContext2D, cx: number, cy: number, w: number) {
  const h = w * 0.9;
  c.beginPath();
  c.moveTo(cx, cy + h * 0.45);
  c.bezierCurveTo(cx - w * 0.7, cy - h * 0.05, cx - w * 0.35, cy - h * 0.62, cx, cy - h * 0.22);
  c.bezierCurveTo(cx + w * 0.35, cy - h * 0.62, cx + w * 0.7, cy - h * 0.05, cx, cy + h * 0.45);
  c.closePath();
}

function star(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, points: number, inner: number) {
  c.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = (i * Math.PI) / points - Math.PI / 2;
    const rr = i % 2 ? r * inner : r;
    c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  c.closePath();
}

/** Every sticker gets a soft cream outline, like a die-cut vinyl sticker. */
function outlined(c: CanvasRenderingContext2D, s: number, fill: string) {
  c.lineJoin = 'round';
  c.lineWidth = s * 0.07;
  c.strokeStyle = CREAM;
  c.stroke();
  c.fillStyle = fill;
  c.fill();
}

const DRAW: Record<StickerId, Draw> = {
  heart: (c, s) => {
    heartPath(c, s / 2, s / 2 + s * 0.04, s * 0.8);
    outlined(c, s, RED);
  },
  star: (c, s) => {
    star(c, s / 2, s / 2 + s * 0.03, s * 0.42, 5, 0.45);
    outlined(c, s, GOLD);
  },
  spark: (c, s) => {
    star(c, s / 2, s / 2, s * 0.44, 4, 0.22);
    outlined(c, s, '#F3E6CC');
    c.fillStyle = GOLD;
    star(c, s / 2, s / 2, s * 0.3, 4, 0.22);
    c.fill();
  },
  flower: (c, s) => {
    const cx = s / 2, cy = s / 2, r = s * 0.15;
    c.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      c.moveTo(cx + Math.cos(a) * r * 1.6 + r, cy + Math.sin(a) * r * 1.6);
      c.arc(cx + Math.cos(a) * r * 1.6, cy + Math.sin(a) * r * 1.6, r, 0, Math.PI * 2);
    }
    outlined(c, s, '#F28FA2');
    c.beginPath();
    c.arc(cx, cy, r * 0.9, 0, Math.PI * 2);
    c.fillStyle = GOLD;
    c.fill();
  },
  xo: (c, s) => {
    c.font = `italic 600 ${s * 0.5}px ${serif()}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineWidth = s * 0.08;
    c.strokeStyle = CREAM;
    c.strokeText('xo', s / 2, s / 2);
    c.fillStyle = RED;
    c.fillText('xo', s / 2, s / 2);
  },
  moon: (c, s) => {
    c.beginPath();
    c.arc(s / 2, s / 2, s * 0.36, Math.PI * 0.35, Math.PI * 1.65, false);
    c.arc(s * 0.62, s * 0.44, s * 0.3, Math.PI * 1.45, Math.PI * 0.6, true);
    c.closePath();
    outlined(c, s, GOLD);
  },
  letter: (c, s) => {
    const x = s * 0.14, y = s * 0.26, w = s * 0.72, h = s * 0.5;
    c.beginPath();
    c.rect(x, y, w, h);
    outlined(c, s, '#F7EEE2');
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(s / 2, y + h * 0.58);
    c.lineTo(x + w, y);
    c.lineWidth = s * 0.03;
    c.strokeStyle = GOLD;
    c.stroke();
    heartPath(c, s / 2, y + h * 0.62, s * 0.18);
    c.fillStyle = RED;
    c.fill();
  },
  love: (c, s) => {
    c.beginPath();
    c.roundRect(s * 0.08, s * 0.3, s * 0.84, s * 0.4, s * 0.2);
    c.lineWidth = s * 0.04;
    c.strokeStyle = GOLD;
    c.stroke();
    c.fillStyle = CREAM;
    c.fill();
    c.font = `italic 600 ${s * 0.3}px ${serif()}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = RED;
    c.fillText('love', s / 2, s / 2 + s * 0.01);
  },
};

export const STICKER_LABELS: Record<StickerId, string> = {
  heart: 'Heart', star: 'Star', spark: 'Sparkle', flower: 'Flower',
  xo: 'XO', moon: 'Moon', letter: 'Love letter', love: 'Love',
};

export function drawSticker(id: StickerId, size = 256): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const c = canvas.getContext('2d')!;
  DRAW[id](c, size);
  return canvas;
}
