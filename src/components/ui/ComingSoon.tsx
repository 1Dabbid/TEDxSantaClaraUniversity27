import type { ReactNode } from 'react';

/** Small pill: a red dot and a fine-print label. */
export function ComingSoonBadge({ children = 'Coming soon' }: { children?: ReactNode }) {
  return (
    <span className="fine-print inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/70 px-3 py-1 text-mute">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
      {children}
    </span>
  );
}

/** A bordered empty state: badge, heading-level text and an optional action. */
export function ComingSoonState({
  title,
  children,
  action,
  badge,
}: {
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div className="relative border-t border-line pt-8">
      <ComingSoonBadge>{badge}</ComingSoonBadge>
      <p className="mt-6 max-w-2xl text-title font-semibold tracking-tight text-balance">{title}</p>
      {children ? <div className="mt-4 max-w-xl text-mute">{children}</div> : null}
      {action ? <div className="mt-8">{action}</div> : null}
    </div>
  );
}
