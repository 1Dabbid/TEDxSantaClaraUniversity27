import type { ReactNode } from 'react';
import type { SectionId } from '@/scene/scrollState';

type Scrim = 'y' | 'left' | 'solid' | 'none';

const scrimClass: Record<Scrim, string> = {
  y: 'scrim-y',
  left: 'scrim-left',
  solid: 'scrim-solid',
  none: '',
};

/**
 * Common <section> wrapper. Renders the id / data-section / aria-labelledby
 * contract that SmoothScroll and the scene rely on, plus a readability scrim
 * so text never depends on what the WebGL canvas happens to show.
 */
export function SectionShell({
  id,
  className = '',
  scrim = 'y',
  children,
}: {
  id: SectionId;
  className?: string;
  scrim?: Scrim;
  children: ReactNode;
}) {
  return (
    <section id={id} data-section={id} aria-labelledby={`${id}-title`} className={`relative isolate ${className}`}>
      {scrim !== 'none' ? (
        <div aria-hidden="true" className={`pointer-events-none absolute inset-0 -z-10 ${scrimClass[scrim]}`} />
      ) : null}
      {children}
    </section>
  );
}

/** Large section heading with consistent sizing. */
export function SectionTitle({ id, children, className = '' }: { id: SectionId; children: ReactNode; className?: string }) {
  return (
    <h2 id={`${id}-title`} className={`mt-6 text-headline font-semibold tracking-[-0.045em] text-balance ${className}`}>
      {children}
    </h2>
  );
}
