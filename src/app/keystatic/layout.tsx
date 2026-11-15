import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { adminEnabled } from '@/lib/admin';
import { NOT_FOUND_METADATA } from '@/lib/page-meta';
import KeystaticApp from './keystatic';

/**
 * "Content admin" only while the admin exists. Switched off, /keystatic is the
 * site's 404 page and carries that page's own title and metadata ("Page not
 * found (404)"), before and after the page has loaded.
 */
export function generateMetadata(): Metadata {
  return adminEnabled ? { title: 'Content admin', robots: { index: false, follow: false } } : NOT_FOUND_METADATA;
}

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
