'use client';

import { useEffect } from 'react';

/** The element a URL hash points at. */
function hashTarget(): HTMLElement | null {
  const raw = location.hash.slice(1);
  if (!raw) return null;
  let id = raw;
  try {
    id = decodeURIComponent(raw);
  } catch {
    // A malformed escape: look the hash up as written.
  }
  return document.getElementById(id);
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
    // Opens the linked question and marks it (data-linked, styled in FaqList) in place
    // of :target, which pushState does not update.
    const open = () => {
      const el = hashTarget();
      for (const prev of document.querySelectorAll('[data-linked]')) if (prev !== el) prev.removeAttribute('data-linked');
      if (!el) return;
      const d = el instanceof HTMLDetailsElement ? el : el.querySelector('details');
      if (!d) return;
      el.setAttribute('data-linked', '');
      if (!d.open) d.open = true;
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
