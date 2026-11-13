import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { expect, test } from '@playwright/test';

/**
 * The "Watch live" link (Contact & site > Livestream link). The committed
 * content normally leaves the link blank, so the component is rendered on its
 * own here with a sample URL (no content change, no rebuild), and the built
 * home page is checked against whatever content/contact.yaml says.
 */
const SAMPLE = 'https://www.youtube.com/live/example';

type WatchLiveProps = { url: string; size?: 'md' | 'lg'; className?: string };

/**
 * Loads the real component. Playwright rewrites JSX in files it imports (for
 * its component-testing mode), so the source is compiled here with the
 * project's TypeScript instead, against the real react/jsx-runtime.
 */
function loadWatchLive(): ComponentType<WatchLiveProps> {
  const file = join(process.cwd(), 'src/components/ui/WatchLive.tsx');
  const { outputText } = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const mod: { exports: Record<string, unknown> } = { exports: {} };
  new Function('require', 'module', 'exports', outputText)(createRequire(file), mod, mod.exports);
  return mod.exports.WatchLive as ComponentType<WatchLiveProps>;
}
const render = (props: WatchLiveProps) => renderToStaticMarkup(createElement(loadWatchLive(), props));

/** contact.yaml's livestreamUrl ('' when absent or blank). */
function contentLivestreamUrl(): string {
  const yaml = readFileSync(join(process.cwd(), 'content/contact.yaml'), 'utf8');
  const m = yaml.match(/^livestreamUrl:\s*['"]?([^'"\s]*)['"]?\s*$/m);
  return m ? m[1] : '';
}

test.describe('Watch live link', () => {
  test('renders a new-tab link with a live dot and an announced label when a URL is given', async ({ page }) => {
    const html = render({ url: SAMPLE, size: 'lg' });
    await page.setContent(`<!doctype html><html lang="en"><body>${html}</body></html>`);
    const link = page.getByRole('link', { name: 'Watch live (opens in a new tab)' });
    await expect(link).toHaveCount(1);
    await expect(link).toHaveAttribute('href', SAMPLE);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
    // The dot is decorative: the visible words carry the meaning, not the colour.
    await expect(link.locator('[aria-hidden="true"]').first()).toBeAttached();
    expect(await link.innerText()).toContain('Watch live');
  });

  test('renders nothing when the URL is blank', () => {
    expect(render({ url: '' })).toBe('');
  });

  test('the home page shows it in the hero and Tickets only when the content sets a link', async ({ page }) => {
    const url = contentLivestreamUrl();
    await page.goto('/');
    const links = page.locator('[data-watch-live]');
    if (!url) {
      await expect(links).toHaveCount(0);
      return;
    }
    await expect(page.locator('#hero [data-watch-live]')).toHaveAttribute('href', url);
    await expect(page.locator('#tickets [data-watch-live]')).toHaveAttribute('href', url);
  });
});
