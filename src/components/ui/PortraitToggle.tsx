'use client';

import { useState, type ReactNode } from 'react';

/**
 * The portrait as a toggle button: black and white until it is pressed, then in
 * colour until it is pressed again. This is what a tap does on a phone, where
 * there is no hover; with a mouse, hovering the card already shows the colour
 * (and a click keeps it). Keyboard focus shows the colour too (globals.css,
 * "Team portraits").
 *
 * Only the image is the button. The name, role and LinkedIn link sit outside
 * it, so a tap on the photo never gets in the way of reaching the link. The
 * accessible name stays the same ("<name> in colour"); aria-pressed carries the
 * state, and the frame's crop marks show it without relying on colour.
 * Before hydration (or without JavaScript) hover and focus still work.
 */
export function PortraitToggle({ name, className = '', children }: { name: string; className?: string; children: ReactNode }) {
  const [on, setOn] = useState(false);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={`${name} in colour`}
      data-portrait-toggle
      data-cursor="link"
      onClick={() => setOn((v) => !v)}
      className={`portrait cursor-pointer ${className}`}
    >
      {children}
    </button>
  );
}
