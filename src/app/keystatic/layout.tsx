import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { adminEnabled } from '@/lib/admin';
import KeystaticApp from './keystatic';

export const metadata: Metadata = {
  title: 'Content admin',
  robots: { index: false, follow: false },
};

// Decided per request from the deployment's variables, never prerendered.
export const dynamic = 'force-dynamic';

/**
 * The admin exists only under `next dev` or with a complete GitHub setup (see
 * src/lib/admin.ts); otherwise /keystatic is a plain 404 and the Keystatic UI is
 * never rendered, so its client bundle is not sent.
 */
export default function KeystaticLayout() {
  if (!adminEnabled) notFound();
  return (
    <div className="keystatic-root">
      <KeystaticApp />
    </div>
  );
}
