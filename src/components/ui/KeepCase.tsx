import type { ReactNode } from 'react';
import { SITE_NAME } from '@/lib/site';

/**
 * TEDx licence rule: the name is always written exactly "TEDxSantaClaraUniversity"
 * and the word exactly "TEDx" (lower-case x). Captions styled `.fine-print` are
 * uppercased by CSS, which would render "TEDXSANTACLARAUNIVERSITY". Anything
 * passed through these helpers keeps its case (and normal letter spacing) inside
 * such captions. Guarded by tests/e2e/naming.spec.ts.
 */
export function KeepCase({ children }: { children: ReactNode }) {
  return <span className="tracking-normal normal-case">{children}</span>;
}

/** The licensed event name, case preserved. */
export function EventName({ name = SITE_NAME }: { name?: string }) {
  return <KeepCase>{name}</KeepCase>;
}

/** The word "TEDx", case preserved. */
export function Tedx() {
  return <KeepCase>TEDx</KeepCase>;
}

/**
 * For editor-written text shown in an uppercased caption: every word starting
 * with "TEDx" (the name, or TEDx itself) keeps its case; the rest is untouched.
 */
export function keepTedxCase(text: string): ReactNode {
  if (!/TEDx/i.test(text)) return text;
  return text.split(/(TEDx\w*)/i).map((part, i) => (i % 2 === 1 ? <KeepCase key={i}>{part}</KeepCase> : part));
}
