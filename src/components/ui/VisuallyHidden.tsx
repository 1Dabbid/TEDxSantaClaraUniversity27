import type { ElementType, ReactNode } from 'react';

/** Hidden visually, available to assistive technology. */
export function VisuallyHidden({ as: Tag = 'span', children }: { as?: ElementType; children: ReactNode }) {
  return <Tag className="sr-only">{children}</Tag>;
}
