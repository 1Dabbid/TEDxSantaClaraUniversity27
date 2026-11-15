import { expect, test, type Page } from '@playwright/test';

/*
 * After Tickets the lights go down and stay down (src/scene/choreography.ts,
 * DARK_FROM): under Team, FAQ, Newsletter and the footer the scene is black
 * and the render loop sleeps, so nothing lit shows through the page and
 * nothing is drawn for a reader at the foot of it. Uses the debug simulator
 * (?scene-debug=1) for the exact exposure and the live page for the loop.
 */

type Frame = { J: number; exp: number };
type Sim = { run: (o: { js: number[] }) => Frame[] };
type Live = { J: number; frame: number; exposure: number };

const settled = (page: Page, J: number) =>
  page.evaluate((J) => (window as unknown as { __sceneSim: Sim }).__sceneSim.run({ js: Array(900).fill(J) }).at(-1)!.exp, J);
const live = (page: Page) => page.evaluate(() => (window as unknown as { __scene?: Live }).__scene ?? null);
const scrollTo = (page: Page, y: number | 'end') =>
  page.evaluate((y) => {
    const top = y === 'end' ? document.documentElement.scrollHeight : y;
    const l = (window as unknown as { __fpPerf?: { lenis?: { scrollTo: (y: number, o: object) => void } } }).__fpPerf?.lenis;
    if (l) l.scrollTo(top, { immediate: true, force: true });
    else window.scrollTo(0, top);
  }, y);

for (const size of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'phone', width: 390, height: 844 },
]) {
  test.describe(`darkness after Tickets (${size.name})`, () => {
    test.describe.configure({ timeout: 120_000 });
    test.use({ viewport: { width: size.width, height: size.height } });

    test('the exposure reaches zero at the end of Tickets and stays there to the foot of the page', async ({ page }) => {
      await page.goto('/?quality=low&perf=off&scene-debug=1');
      await page.waitForFunction(() => !!(window as unknown as { __sceneSim?: unknown }).__sceneSim, null, { timeout: 60_000 });
      // The speaker's view is still lit just before the fade.
      expect(await settled(page, 5.85), 'J5.85 lit').toBeGreaterThan(0.9);
      // Team, FAQ, Newsletter, the footer: exactly dark.
      for (const J of [6, 6.25, 6.5, 7, 8, 9, 9.5]) expect(await settled(page, J), `J${J} exposure`).toBe(0);
    });

    test('at the foot of the page the scene is dark and stops drawing; scrolling back up wakes it', async ({ page }) => {
      await page.goto('/?quality=low&perf=off&scene-debug=1');
      await expect(page.locator('canvas')).toHaveCount(1, { timeout: 30_000 });
      await expect.poll(async () => (await live(page))?.frame ?? 0, { timeout: 60_000 }).toBeGreaterThan(2);
      await scrollTo(page, 'end');
      await expect.poll(async () => (await live(page))?.J ?? 0, { timeout: 30_000 }).toBeGreaterThan(8.5);
      await expect.poll(async () => (await live(page))?.exposure ?? 1, { timeout: 60_000 }).toBeLessThan(0.004);
      // The loop sleeps: the frame counter stands still.
      await expect
        .poll(
          async () => {
            const a = (await live(page))!.frame;
            await page.waitForTimeout(1500);
            return (await live(page))!.frame - a;
          },
          { timeout: 60_000 },
        )
        .toBe(0);
      const asleep = (await live(page))!.frame;
      // Back to the top: the scene draws again and comes back up.
      await scrollTo(page, 0);
      await expect.poll(async () => (await live(page))?.frame ?? 0, { timeout: 60_000 }).toBeGreaterThan(asleep + 2);
      await expect.poll(async () => (await live(page))?.exposure ?? 0, { timeout: 60_000 }).toBeGreaterThan(0.3);
    });
  });
}
