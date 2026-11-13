'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

type Item = { readonly label: string; readonly href: string };

/** Accessible disclosure menu for small screens. Escape closes; focus returns to the toggle. */
export function MobileMenu({ items, dateLong, dateISO }: { items: readonly Item[]; dateLong: string; dateISO: string }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) toggleRef.current?.focus();
  }, []);

  // Close on route change.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>('a')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      html.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  return (
    <div className="lg:hidden">
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="relative flex size-10 items-center justify-center rounded-full border border-white/20 text-white hover:border-white"
      >
        <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
        <span aria-hidden="true" className="relative block h-3 w-4">
          <span
            className={`absolute left-0 h-px w-4 bg-current transition-transform duration-300 ${open ? 'top-1.5 rotate-45' : 'top-0.5'}`}
          />
          <span
            className={`absolute left-0 h-px w-4 bg-current transition-transform duration-300 ${open ? 'top-1.5 -rotate-45' : 'top-2.5'}`}
          />
        </span>
      </button>

      <div
        ref={panelRef}
        id={panelId}
        hidden={!open}
        data-lenis-prevent
        className="fixed inset-x-0 bottom-0 top-[var(--header-h)] overflow-y-auto border-t border-white/10 bg-black"
      >
        <nav aria-label="Mobile" className="shell flex min-h-full flex-col pb-10 pt-8">
          <ul className="flex flex-col">
            {items.map((item, i) => (
              <li key={item.href} className="border-b border-white/10">
                <Link
                  href={item.href}
                  onClick={() => close(false)}
                  className="flex items-baseline gap-4 py-5 text-3xl font-semibold tracking-tight"
                >
                  <span aria-hidden="true" className="fine-print">
                    §&nbsp;{String(i + 1).padStart(2, '0')}
                  </span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <p className="fine-print mt-auto pt-10">
            <time dateTime={dateISO}>{dateLong}</time>
          </p>
        </nav>
      </div>
    </div>
  );
}
