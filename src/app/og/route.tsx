import { ImageResponse } from 'next/og';
import { decodeHeart, DEFAULT_HEART } from '@/lib/heartConfig';

/**
 * 1200×630 social preview. With ?h=<heart> it draws that heart's color, material
 * and names; without it, the generic site card. Crawlers never run WebGL, so this is
 * what people see when a link is pasted into a chat.
 */
export function GET(req: Request) {
  const h = new URL(req.url).searchParams.get('h');
  const cfg = (h && decodeHeart(h)) || null;
  const heart = cfg ?? DEFAULT_HEART;

  // [offset, color] stops per material, drawn as an SVG gradient (Satori renders SVG reliably)
  const stops: [number, string][] =
    heart.m === 'gold'
      ? [[0, '#F6E3A8'], [0.45, heart.c], [1, '#7A5A1E']]
      : heart.m === 'glass'
        ? [[0, '#FFFFFF'], [0.55, heart.c], [1, heart.c]]
        : [[0, '#FFFFFF'], [0.25, heart.c], [1, '#2B0A12']];
  const heartPath =
    'M180 320 C 80 250, 0 190, 0 105 C 0 45, 45 0, 100 0 C 140 0, 168 22, 180 50 C 192 22, 220 0, 260 0 C 315 0, 360 45, 360 105 C 360 190, 280 250, 180 320 Z';

  const title = cfg ? (cfg.to ? `For ${cfg.to}` : 'Someone made you a heart') : 'Heartglass';
  const sub = cfg ? (cfg.msg ?? 'Open it to see it in 3D.') : 'Step through the mirror. Make a heart for someone you love.';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          background: 'linear-gradient(180deg, #F1ECF6 0%, #F7EFEF 55%, #F9F1E7 100%)',
          padding: '0 90px',
          gap: 70,
        }}
      >
        <svg width="360" height="330" viewBox="0 0 360 330">
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
              {stops.map(([o, c]) => (
                <stop key={o} offset={o} stopColor={c} stopOpacity={heart.m === 'glass' && o === 0 ? 0.8 : 1} />
              ))}
            </linearGradient>
          </defs>
          <path d={heartPath} fill="url(#g)" />
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 18 }}>
          <div style={{ fontSize: 26, letterSpacing: 6, color: '#9C7A2C', textTransform: 'uppercase' }}>Heartglass</div>
          <div style={{ fontSize: 72, lineHeight: 1.05, color: '#2B2420' }}>{title}</div>
          <div style={{ fontSize: 32, lineHeight: 1.3, color: '#5E534B' }}>{sub}</div>
          {cfg?.from ? <div style={{ fontSize: 28, color: '#B3263A' }}>{`with love, ${cfg.from}`}</div> : null}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
