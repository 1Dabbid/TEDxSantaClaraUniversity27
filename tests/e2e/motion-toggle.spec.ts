import { expect, test, type Page } from '@playwright/test';
import { settle } from './helpers';

/*
 * The footer's "Reduce motion" switch (WCAG 2.2.2 / 2.3.3): one keyboard-
 * reachable toggle button that moves the whole site to the static mode used
 * for prefers-reduced-motion, remembers the choice, applies it before first
 * paint on the next load, and turns motion back on.
 */

const html = (page: Page) =>
  page.evaluate(() => ({
    motion: document.documentElement.classList.contains('motion'),
    reduce: document.documentElement.classList.contains('reduce-motion'),
    smooth: document.documentElement.dataset.smoothScroll ?? null,
    stored: localStorage.getItem('fp:reduce-motion'),
  }));

test.describe('reduce motion switch', () => {
  test('turns motion off and on with the keyboard, and is remembered before first paint', async ({ page }) => {
    await page.goto('/');
    await settle(page, 600);
    const toggle = page.getByRole('button', { name: /^Reduce motion/ });
    await expect(toggle).toHaveCount(1);
    await expect(page.locator('footer').getByRole('button', { name: /^Reduce motion/ })).toHaveCount(1);
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(async () => (await html(page)).smooth).toBe('true');
    expect((await html(page)).motion).toBe(true);

    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await html(page)).smooth).toBeNull();
    expect(await html(page)).toMatchObject({ motion: false, reduce: true, stored: '1' });
    // Keyboard focus stays on the switch, in view.
    await expect(toggle).toBeFocused();
    await expect(toggle).toBeInViewport();
    // The stills become per-section plates (no fixed, scroll-linked stack).
    expect(await page.locator('[data-section="hero"]').evaluate((s) => getComputedStyle(s, '::before').display)).toBe('block');
    await expect(page.locator('[data-scene-stills]')).toBeHidden();
    // Nothing is left hidden for an animation.
    for (const h of await page.locator('main h2').all()) await expect(h).toHaveCSS('opacity', '1');

    // Next load: the boot script applies it before anything paints or hydrates.
    await page.goto('/', { waitUntil: 'commit' });
    await page.waitForSelector('main');
    expect(await page.evaluate(() => document.documentElement.className)).toMatch(/\breduce-motion\b/);
    expect(await page.evaluate(() => document.documentElement.classList.contains('motion'))).toBe(false);
    await settle(page, 600);
    expect(await html(page)).toMatchObject({ motion: false, reduce: true, smooth: null });
    await expect(page.locator('canvas')).toHaveCount(0);

    // Off again: motion and smooth scroll come back without a reload.
    const again = page.getByRole('button', { name: /^Reduce motion/ });
    await expect(again).toHaveAttribute('aria-pressed', 'true');
    await again.focus();
    await page.keyboard.press('Space');
    await expect(again).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(async () => (await html(page)).smooth).toBe('true');
    expect(await html(page)).toMatchObject({ motion: true, reduce: false, stored: null });
  });

  test('applies on every page of the site', async ({ page }) => {
    await page.goto('/partners');
    await settle(page, 400);
    await page.getByRole('button', { name: /^Reduce motion/ }).click();
    await page.goto('/speakers');
    await settle(page, 400);
    expect(await html(page)).toMatchObject({ motion: false, reduce: true, smooth: null });
    await expect(page.getByRole('button', { name: /^Reduce motion/ })).toHaveAttribute('aria-pressed', 'true');
  });

  test.describe('with the device setting', () => {
    test.use({ reducedMotion: 'reduce' });

    test('shows as on and says the device set it', async ({ page }) => {
      await page.goto('/');
      await settle(page, 400);
      const toggle = page.getByRole('button', { name: /^Reduce motion/ });
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
      await expect(toggle).toHaveAttribute('aria-disabled', 'true');
      await expect(toggle).toContainText('set by your device');
      await toggle.focus();
      await page.keyboard.press('Enter');
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
      expect(await html(page)).toMatchObject({ motion: false, stored: null });
    });
  });

  test.describe('in the mobile menu', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('is in the menu, inside its focus ring, and follows the footer switch', async ({ page }) => {
      await page.goto('/');
      await settle(page, 400);
      await page.getByRole('button', { name: 'Open menu' }).click();
      const panel = page.locator('[data-menu-panel]');
      const toggle = panel.getByRole('button', { name: /^Reduce motion/ });
      await expect(toggle).toBeVisible();
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');
      // Shift+Tab from the menu toggle wraps to the last item of the ring: the switch.
      await page.getByRole('button', { name: 'Close menu' }).focus();
      await page.keyboard.press('Shift+Tab');
      await expect(toggle).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
      expect(await html(page)).toMatchObject({ motion: false, reduce: true, stored: '1' });
      await page.keyboard.press('Escape');
      await expect(panel).toBeHidden();
      await expect(page.locator('footer').getByRole('button', { name: /^Reduce motion/ })).toHaveAttribute('aria-pressed', 'true');
    });
  });
});
