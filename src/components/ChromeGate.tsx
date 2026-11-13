'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/** Renders site chrome (header, footer, skip link) everywhere except the Keystatic admin. */
export function ChromeGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith('/keystatic')) return null;
  return <>{children}</>;
}
