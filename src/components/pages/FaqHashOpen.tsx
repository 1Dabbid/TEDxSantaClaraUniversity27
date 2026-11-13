'use client';

import { useEffect } from 'react';

/** The <details> a URL hash points at (the question's own element or one inside it). */
function targetDetails(): HTMLDetailsElement | null {
  const raw = location.hash.slice(1);
  if (!raw) return null;
  let id = raw;
  try {
    id = decodeURIComponent(raw);
  } catch {
    // A malformed escape: look the hash up as written.
  }
  const el = document.getElementById(id);
  if (!el) return null;
  return el instanceof HTMLDetailsElement ? el : el.querySelector('details');
}

/**
 * Progressive enhancement for /faq#<question>: opens the linked question on load,
 * on hash changes and after in-page anchor clicks (the motion engine scrolls with
 * pushState, which fires no hashchange). Without JavaScript the link still lands
 * on the question as a normal anchor. Scrolling and focus are the browser's or
 * the navigation engine's (header offset included); opening a question only adds
 * height below its summary, so the landing position does not move. Renders nothing.
 */
export function FaqHashOpen() {
  useEffect(() => {
    const open = () => {
      const d = targetDetails();
      if (d && !d.open) d.open = true;
    };
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href*="#"]');
      if (a) requestAnimationFrame(open);
    };
    open();
    window.addEventListener('hashchange', open);
    window.addEventListener('popstate', open);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('hashchange', open);
      window.removeEventListener('popstate', open);
      document.removeEventListener('click', onClick);
    };
  }, []);
  return null;
}
