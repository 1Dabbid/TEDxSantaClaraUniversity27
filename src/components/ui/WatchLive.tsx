/**
 * "Watch live" link to the livestream (Contact & site > Livestream link).
 * Renders nothing while the link is blank. A quiet text link rather than a
 * button: a small red dot (decorative; the words carry the meaning), the label
 * with the site's drawn underline on hover, and an up-right arrow. Opens in a
 * new tab, which screen readers hear.
 *
 * Self-contained on purpose (no Next or app imports) so the e2e suite can
 * render it on its own with a sample URL (tests/e2e/livestream.spec.ts).
 */
export function WatchLive({ url, size = 'md', className = '' }: { url: string; size?: 'md' | 'lg'; className?: string }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      data-watch-live
      data-cursor="link"
      className={`group inline-flex items-center gap-3 font-medium tracking-tight text-white no-underline outline-offset-4 focus-visible:outline-2 focus-visible:outline-white ${
        size === 'lg' ? 'min-h-14 text-base' : 'min-h-11 text-[0.9375rem]'
      } ${className}`}
    >
      <span aria-hidden="true" className="relative flex size-2.5 shrink-0 items-center justify-center">
        {/* Pulses only with motion on (html.motion): never with reduced motion or the site's "Reduce motion" switch. */}
        <span className="absolute inset-0 rounded-full bg-accent/35 motion-safe:[html.motion_&]:animate-ping" />
        <span className="relative size-2 rounded-full bg-accent" />
      </span>
      <span className="link-draw pb-0.5 group-hover:bg-[length:100%_1px] group-focus-visible:bg-[length:100%_1px]">
        Watch live
      </span>
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="square"
        className="inline-block size-[1em] shrink-0 text-mute transition-[color,translate] duration-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white"
      >
        <path d="M4.5 11.5l7-7M5.5 4.5h6v6" />
      </svg>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
