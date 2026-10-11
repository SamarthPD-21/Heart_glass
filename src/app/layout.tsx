import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Inter } from 'next/font/google';
import 'lenis/dist/lenis.css';
import './globals.css';

const serif = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
});
const sans = Inter({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  // Absolute base for og:image URLs. Set NEXT_PUBLIC_SITE_URL in production; Vercel's URL is the fallback.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000'),
  ),
  title: 'Heartglass — say it before time runs out',
  description:
    'Step through the mirror, drift through a world of gold and plaster, and make a heart for someone you love.',
  openGraph: {
    title: 'Heartglass',
    description: 'Step through the mirror, then make a heart for someone you love.',
    type: 'website',
    images: ['/og'],
  },
  twitter: { card: 'summary_large_image' },
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cpath fill='%23B3263A' d='M16 28S3 20 3 11a6.5 6.5 0 0 1 13-1 6.5 6.5 0 0 1 13 1c0 9-13 17-13 17z'/%3E%3C/svg%3E",
  },
};

export const viewport: Viewport = {
  themeColor: '#F5EEEE',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
