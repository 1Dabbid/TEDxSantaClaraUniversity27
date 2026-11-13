import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

/**
 * Known application bugs. Each test describes the correct behaviour and is
 * marked `test.fixme` until the application code is fixed; remove the marker
 * together with the fix.
 */

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.(tsx?|css)$/.test(name) ? [p] : [];
  });
}

// keystatic.config.ts offers "Livestream link (optional)" (contact.livestreamUrl) and
// src/lib/content.ts passes it on as settings.livestreamUrl, but no page or component
// reads it: an editor can fill it in and nothing appears on the site.
test.fixme('the Keystatic livestream link is rendered somewhere on the site', () => {
  const users = sourceFiles(join(process.cwd(), 'src')).filter(
    (f) => !f.endsWith(join('lib', 'content.ts')) && readFileSync(f, 'utf8').includes('livestreamUrl'),
  );
  expect(users, 'files that render settings.livestreamUrl').not.toEqual([]);
});
