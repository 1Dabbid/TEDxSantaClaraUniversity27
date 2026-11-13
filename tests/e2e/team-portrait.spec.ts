import { createElement, type ComponentType, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from '@playwright/test';
import { Portrait } from '../../src/components/ui/Portrait';
import type { TeamMember } from '../../src/lib/content';

/**
 * The portrait frame's three states, rendered on their own (no content change,
 * no build): a photo, a named member without a photo (initials), and a role
 * whose holder is not named publicly (a blank frame). All three are the same
 * 4:5 .portrait box, so the board lines up whatever is in it; the CSS shape is
 * checked by the /team tests in owner-content.spec.ts.
 */

const base: TeamMember = {
  slug: 'director-of-creative',
  role: 'Director of Creative',
  name: 'Ella Torseth',
  major: 'Studio Art',
  classYear: 2028,
  linkedin: 'https://www.linkedin.com/in/example',
  photo: null,
  level: 'operations',
  order: 6,
};

/**
 * The test runner compiles the site's .tsx files with its own JSX objects
 * (meant for component testing); turn them back into React elements, and wrap
 * the site's own components so what they return is turned back too. Components
 * from node_modules (next/image) are left as they are.
 */
type PwNode = { __pw_type: 'jsx'; type: unknown; props: Record<string, unknown>; key?: string };
const wrapped = new Map<unknown, ComponentType<Record<string, unknown>>>();
function toReact(node: unknown): ReactNode {
  if (Array.isArray(node)) return node.map(toReact);
  if (!node || typeof node !== 'object' || (node as PwNode).__pw_type !== 'jsx') return node as ReactNode;
  const { type, props, key } = node as PwNode;
  const { children, ...rest } = props;
  let t = type;
  if (typeof type === 'function') {
    if (!wrapped.has(type)) wrapped.set(type, (p: Record<string, unknown>) => toReact((type as (p: unknown) => unknown)(p)) as never);
    t = wrapped.get(type);
  }
  return createElement(t as string, { ...rest, key }, ...(children === undefined ? [] : [toReact(children)].flat()));
}

function html(member: TeamMember, toggle = true) {
  return renderToStaticMarkup(toReact(Portrait({ member, sizes: '300px', toggle })) as never);
}

test.describe('portrait fallbacks', () => {
  test('a named member without a photo: initials in the same frame, hidden from screen readers (the name is printed beside it)', () => {
    const out = html(base);
    expect(out).toContain('data-team-monogram');
    expect(out).toMatch(/class="portrait portrait--monogram/);
    expect(out).toContain('aria-hidden="true"');
    expect(out).toContain('>ET<');
    expect(out).not.toContain('<img');
    expect(out).not.toContain('<button');
  });

  test('a role not named publicly: a blank frame, nothing that identifies the person', () => {
    const out = html({ ...base, name: null, major: '', classYear: null, linkedin: '' });
    expect(out).toContain('data-team-vacant');
    expect(out).toMatch(/class="portrait portrait--vacant/);
    expect(out).not.toContain('ET');
    expect(out).not.toContain('Ella');
    expect(out).not.toContain('<img');
  });

  test('a photo: a toggle button named "<name> in colour" with a decorative image; inside a link, a plain frame', () => {
    const member = { ...base, photo: '/images/team/director-of-creative/photo.jpg' };
    const out = html(member);
    expect(out).toContain('<button');
    expect(out).toContain('aria-pressed="false"');
    expect(out).toContain('aria-label="Ella Torseth in colour"');
    expect(out).toContain('alt=""');
    expect(out).toContain('portrait-marks');
    const plain = html(member, false);
    expect(plain).not.toContain('<button');
    expect(plain).toContain('data-portrait-photo');
    expect(plain).toContain('alt=""');
  });
});
