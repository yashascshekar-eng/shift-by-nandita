import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';
import { currentRole } from '@/lib/supabase/server';
import { signOut } from './login/actions';

export const metadata: Metadata = {
  title: { default: 'SHIFT by Nandita', template: '%s · SHIFT by Nandita' },
  description: 'Fitness and nutrition coaching with Nandita Rao. Shift your habits. Transform your life.',
  manifest: '/manifest.webmanifest',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://shiftbynandita.com'),
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#2c5a40' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const me = await currentRole().catch(() => null);
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=Figtree:wght@400;500;600;700&display=swap" />
      </head>
      <body>
        <nav className="nav">
          <Link className="mark" href="/">SHIFT<small>by Nandita</small></Link>
          <div className="navlinks">
            <Link href="/tools">Calculators</Link>
            {me?.role === 'coach' && <Link href="/coach">Clients</Link>}
            {me ? <Link href="/me">My plan</Link> : <Link href="/login">Log in</Link>}
            {me && <form action={signOut}><button type="submit">Log out</button></form>}
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
