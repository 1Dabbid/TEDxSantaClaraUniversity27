'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { lenisRef } from '@/motion/lenisRef';
import { MotionToggle } from './ui/MotionToggle';

type Item = { readonly label: string; readonly href: string };

/**
 * Accessible disclosure menu for small screens. Escape closes; focus returns to
 * the toggle; Tab cycles between the toggle, the menu links and the Reduce
 * motion switch while it is open
 * (the panel covers the page). With motion on, the panel wipes down and the
 * clauses rise in (CSS, see globals.css).
 */
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
      if (e.key === 'Escape') {
        close();
        return;
      }
      if (e.key !== 'Tab') return;
      const links = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('a[href], button') ?? []);
      const toggle = toggleRef.current;
      if (!toggle || links.length === 0) return;
      const ring = [toggle, ...links];
      const i = ring.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && i <= 0) {
        e.preventDefault();
        ring[ring.length - 1].focus();
      } else if (!e.shiftKey && (i === ring.length - 1 || i === -1)) {
        e.preventDefault();
        ring[0].focus();
      }
    };
    const html = document.documentElement;
    const prev = html.style.overflow;
    // The panel covers main and the footer: take them out of the tab order and the
    // accessibility tree while it is open (the wrapper holds both).
    const page = document.getElementById('main')?.parentElement ?? null;
    page?.setAttribute('inert', '');
    html.style.overflow = 'hidden';
    html.setAttribute('data-menu-open', '');
    lenisRef.current?.stop();
    document.addEventListener('keydown', onKey);
    // The panel and its toggle are hidden from `lg` up (`lg:hidden`): a rotated tablet or
    // a widened window would otherwise keep the page locked with nothing left to close it.
    const wide = window.matchMedia('(min-width: 64rem)');
    const onWide = () => {
      if (wide.matches) close(false);
    };
    // Restored from the back/forward cache with the menu still open: start closed.
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) close(false);
    };
    wide.addEventListener('change', onWide);
    window.addEventListener('pageshow', onShow);
    return () => {
      html.style.overflow = prev;
      page?.removeAttribute('inert');
      html.removeAttribute('data-menu-open');
      lenisRef.current?.start();
      document.removeEventListener('keydown', onKey);
      wide.removeEventListener('change', onWide);
      window.removeEventListener('pageshow', onShow);
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
        className="tap relative flex size-11 items-center justify-center rounded-full border border-white/20 text-white transition-colors duration-300 hover:border-white pointer-fine:size-10"
      >
        <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
        <span aria-hidden="true" className="relative block h-3 w-4">
          <span
            className={`absolute left-0 h-px w-4 bg-current transition-transform duration-500 ease-[var(--ease-cinema)] ${open ? 'top-1.5 rotate-45' : 'top-0.5'}`}
          />
          <span
            className={`absolute left-0 h-px w-4 bg-current transition-transform duration-500 ease-[var(--ease-cinema)] ${open ? 'top-1.5 -rotate-45' : 'top-2.5'}`}
          />
        </span>
      </button>

      <div
        ref={panelRef}
        id={panelId}
        hidden={!open}
        data-lenis-prevent
        data-menu-panel
        className="menu-panel fixed inset-x-0 bottom-0 top-[var(--header-h)] overflow-y-auto overscroll-contain border-t border-white/10 bg-black"
      >
        <nav aria-label="Mobile" className="shell flex min-h-full flex-col pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-8">
          <p data-menu-item style={{ '--i': 0 } as CSSProperties} className="fine-print mb-4 text-subtle">
            Contents
          </p>
          <ul className="flex flex-col">
            {items.map((item, i) => (
              <li
                key={item.href}
                data-menu-item
                style={{ '--i': i + 1 } as CSSProperties}
                className="border-b border-white/10"
              >
                <Link
                  href={item.href}
                  onClick={() => close(false)}
                  className="menu-link flex min-h-14 items-baseline gap-4 py-5 text-3xl font-semibold tracking-tight"
                >
                  <span aria-hidden="true" className="fine-print w-10">
                    §&nbsp;{String(i + 1).padStart(2, '0')}
                  </span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          {/* Same switch as in the footer: stops the 3D scene, smooth scroll and animation. */}
          <div data-menu-item style={{ '--i': items.length + 1 } as CSSProperties} className="mt-8">
            <MotionToggle />
          </div>
          <p
            data-menu-item
            style={{ '--i': items.length + 2 } as CSSProperties}
            className="fine-print mt-auto pt-10"
          >
            <time dateTime={dateISO}>{dateLong}</time>
          </p>
        </nav>
      </div>
    </div>
  );
}
