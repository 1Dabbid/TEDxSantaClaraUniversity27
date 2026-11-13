import type { ReactNode } from 'react';

/**
 * Small typographic building blocks for the "fine print" motif, shared by the
 * Venue, Tickets, Team, FAQ, Newsletter, Partners and Speaker pages.
 * All server components, no client JS.
 */

/** Inline "to be announced" marker: fine print with a dotted rule, reads as a blank to be filled in. */
export function Tba({ children = 'To be announced' }: { children?: ReactNode }) {
  return (
    <span className="fine-print inline-block border-b border-dotted border-white/40 pb-0.5 text-mute">{children}</span>
  );
}

/** Clause number in the margin, e.g. "§ 4.1". Decorative; the content carries the meaning. */
export function ClauseNo({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span aria-hidden="true" className={`fine-print whitespace-nowrap text-white tabular-nums ${className}`}>
      §&nbsp;{children}
    </span>
  );
}

/** Solid redaction bars standing in for withheld text. Pair with a visible or sr-only explanation. */
export function Redaction({ widths, className = '', bar = 'h-[0.9em]' }: { widths: string[]; className?: string; bar?: string }) {
  return (
    <span aria-hidden="true" className={`flex flex-col gap-[0.35em] ${className}`}>
      {widths.map((w, i) => (
        <span key={i} className={`block ${bar} bg-white/[0.16]`} style={{ width: w }} />
      ))}
    </span>
  );
}

type RegisterOption<T extends string> = { value: T; label: string };

/**
 * A row of tick boxes, like a status field on a form. The current option is
 * marked with a cross (shape, not colour) and announced as current.
 *
 * Screen readers hear the answer first ("Ticket status: Coming soon"), then
 * the full list of stages with the current one marked, so the form metaphor
 * never has to be decoded visually.
 */
export function StatusRegister<T extends string>({
  label,
  options,
  value,
  className = '',
}: {
  label: string;
  options: readonly RegisterOption<T>[];
  value: T;
  className?: string;
}) {
  const currentLabel = options.find((o) => o.value === value)?.label;
  return (
    <div className={className}>
      <p className="fine-print text-mute">
        {label}
        {currentLabel ? <span className="sr-only">: {currentLabel}.</span> : null}
      </p>
      <ul
        aria-label={`${label}, all stages`}
        className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:flex sm:flex-wrap"
      >
        {options.map((o) => {
          const current = o.value === value;
          return (
            <li
              key={o.value}
              aria-current={current ? 'true' : undefined}
              className={`fine-print flex items-center gap-2 ${current ? 'text-white' : 'text-mute'}`}
            >
              <span
                aria-hidden="true"
                className={`relative inline-block size-3 shrink-0 border ${current ? 'border-white' : 'border-white/50'}`}
              >
                {current ? (
                  <svg viewBox="0 0 12 12" className="absolute inset-0 size-full text-accent" fill="none">
                    <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                ) : null}
              </span>
              {o.label}
              {current ? <span className="sr-only"> (current status)</span> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type ArrowDir = 'right' | 'left' | 'up-right' | 'down';
const ARROW_PATH: Record<ArrowDir, string> = {
  right: 'M2 8h11M9 4l4 4-4 4',
  left: 'M14 8H3M7 4L3 8l4 4',
  'up-right': 'M4.5 11.5l7-7M5.5 4.5h6v6',
  down: 'M8 2v11M4 9l4 4 4-4',
};

/**
 * The one arrow used across the content pages: a 1.25px hairline stroke in a
 * 16-unit box, sized in em so it follows the text it sits in. Decorative.
 */
export function Arrow({ dir = 'right', className = '' }: { dir?: ArrowDir; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="square"
      className={`inline-block size-[1em] shrink-0 ${className}`}
    >
      <path d={ARROW_PATH[dir]} />
    </svg>
  );
}

/** Four corner crop marks around a figure, as on a printer's proof. Decorative. */
export function CropMarks({ className = '' }: { className?: string }) {
  const c = 'absolute size-3 border-white/40';
  return (
    <span aria-hidden="true" className={`pointer-events-none absolute inset-0 ${className}`}>
      <span className={`${c} left-0 top-0 border-l border-t`} />
      <span className={`${c} right-0 top-0 border-r border-t`} />
      <span className={`${c} bottom-0 left-0 border-b border-l`} />
      <span className={`${c} bottom-0 right-0 border-b border-r`} />
    </span>
  );
}

/** Renders a JSON-LD <script>. `json` must already be escaped with jsonLdString(). */
export function JsonLd({ json }: { json: string }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
