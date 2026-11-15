import { expect, test, type Page } from '@playwright/test';

/*
 * The end of Tickets (src/scene/choreography.ts, endKeys): the camera stands
 * behind the microphone while the seat counter (two big numerals, a ruler, a
 * caption) scrolls up through the frame. With the page at rest in the held
 * speaker's view the grille sits in the empty space under the counter's
 * caption, never on the numerals, the ruler's numbers or the caption, and
 * above the end of the section. Also: a window narrower than the desktop
 * layout gets the portrait framing. Uses the debug simulator
 * (?scene-debug=1) with the page's real copy boxes.
 */

type Box = [number, number, number, number, 't' | 'h' | 'p', number?];
type Motion = {
  fails: string[];
  speakerCopy: { J: number; airPx: number; grille: number[] }[];
};
type Sim = {
  copyBoxes: () => Box[];
  ticketsEnd: () => number;
  motion: (o: { copy?: Record<string, Box[]>; edge?: Record<string, number> }) => Motion;
  place: (js: number[]) => { J: number; head: number[]; barrel: number[]; house: number[] }[];
};

const ORDER = ['hero', 'theme', 'speakers', 'schedule', 'venue', 'tickets'];
const ready = async (page: Page) => {
  await page.goto('/?quality=low&perf=off&scene-debug=1');
  await page.waitForFunction(() => !!(window as unknown as { __sceneSim?: unknown }).__sceneSim, null, { timeout: 60_000 });
};
/** Scrolls so that the viewport's centre is at journey position J (section k = floor(J), fraction through it). */
const scrollToJ = (page: Page, J: number) =>
  page.evaluate(
    ([J, order]) => {
      const k = Math.min(5, Math.floor(J as number));
      const r = document.querySelector(`[data-section="${(order as string[])[k]}"]`)!.getBoundingClientRect();
      const y = Math.max(0, r.top + window.scrollY + ((J as number) - k) * r.height - window.innerHeight / 2);
      const l = (window as unknown as { __fpPerf?: { lenis?: { scrollTo: (y: number, o: object) => void } } }).__fpPerf?.lenis;
      if (l) l.scrollTo(y, { immediate: true, force: true });
      else window.scrollTo(0, y);
    },
    [J, ORDER] as const,
  );

/** The copy on screen and the end of the Tickets section at each J, then the simulator's verdict. */
async function speakerView(page: Page, js: number[]) {
  // Let every reveal play once, so the copy is in its final place.
  for (let J = 4.5; J <= 6.01; J += 0.25) {
    await scrollToJ(page, J);
    await page.waitForTimeout(150);
  }
  const copy: Record<string, Box[]> = {};
  const edge: Record<string, number> = {};
  for (const J of js) {
    await scrollToJ(page, J);
    await page.waitForTimeout(400);
    const key = J.toFixed(3);
    [copy[key], edge[key]] = await page.evaluate(() => {
      const sim = (window as unknown as { __sceneSim: Sim }).__sceneSim;
      return [sim.copyBoxes(), sim.ticketsEnd()] as [Box[], number];
    });
  }
  return page.evaluate(([copy, edge]) => (window as unknown as { __sceneSim: Sim }).__sceneSim.motion({ copy, edge }), [copy, edge] as const);
}

test.describe("the speaker's view and the seat counter", () => {
  test.describe.configure({ timeout: 180_000 });

  for (const size of [
    { name: 'desktop 1440x900', width: 1440, height: 900, js: [5.75, 5.8, 5.85, 5.9] },
    { name: 'desktop 1920x1080', width: 1920, height: 1080, js: [5.75, 5.8, 5.85, 5.9] },
    { name: 'phone 390x844', width: 390, height: 844, js: [5.85, 5.9, 5.95] },
    { name: 'phone 360x780', width: 360, height: 780, js: [5.85, 5.9, 5.95] },
  ]) {
    test(`${size.name}: the grille rides under the counter's caption, clear of the copy`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await ready(page);
      const m = await speakerView(page, size.js);
      expect(m.speakerCopy.map((r) => r.J)).toEqual(size.js);
      for (const r of m.speakerCopy) expect(r.airPx, `J${r.J}: air between the grille and the copy (grille at ${r.grille})`).toBeGreaterThanOrEqual(6);
      // In frame, in the foreground, the seats behind it, above the page below Tickets.
      expect(m.fails.filter((f) => f.startsWith("speaker's view") || f.startsWith('frame'))).toEqual([]);
    });
  }

  test('a window narrower than the desktop layout gets the portrait framing; a phone on its side keeps the landscape one', async ({ page }) => {
    const barrelX = async (width: number, height: number) => {
      await page.setViewportSize({ width, height });
      await ready(page);
      return page.evaluate(() => (window as unknown as { __sceneSim: Sim }).__sceneSim.place([3.5])[0].barrel[0]);
    };
    // Over Schedule the portrait move keeps the subject in the middle of the width; the landscape move at the right.
    for (const [w, h] of [
      [1000, 900],
      [960, 600],
      [768, 1024],
    ]) {
      const x = await barrelX(w, h);
      expect(x, `${w}x${h}`).toBeGreaterThan(0.42);
      expect(x, `${w}x${h}`).toBeLessThan(0.58);
    }
    for (const [w, h] of [
      [1440, 900],
      [1024, 768],
      [844, 390],
    ])
      expect(await barrelX(w, h), `${w}x${h}`).toBeGreaterThan(0.6);
  });
});
