import type { ReactNode } from 'react';
import { SiteShell } from '@/components/SiteShell';

/**
 * Layout of every public page (home, /partners, /speakers/*). The admin
 * (/keystatic) and the API are outside this route group and only get the
 * minimal root layout.
 */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
