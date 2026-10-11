import type { Metadata } from 'next';
import HeartglassApp from '@/components/HeartglassApp';
import { decodeHeart } from '@/lib/heartConfig';

type Props = { searchParams: Promise<{ h?: string | string[] }> };

/** Shared links (?h=...) get their own title and a per-heart social preview image. */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { h } = await searchParams;
  if (typeof h !== 'string') return {};
  const cfg = decodeHeart(h);
  if (!cfg) return {};
  const title = cfg.to ? `A heart for ${cfg.to}` : 'Someone made you a heart';
  const image = `/og?h=${encodeURIComponent(h)}`;
  return {
    title,
    description: cfg.msg ?? 'Open it to see the heart they made for you.',
    openGraph: { title, description: cfg.msg ?? 'Open it to see the heart they made for you.', images: [image] },
    twitter: { card: 'summary_large_image', title, images: [image] },
  };
}

export default function Page() {
  return <HeartglassApp />;
}
