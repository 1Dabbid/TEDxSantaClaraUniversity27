import { expect, test, type Page } from '@playwright/test';

/*
 * The end of Tickets (src/scene/choreography.ts, endKeys): the camera stands
 * behind the microphone while the seat counter (two big numerals, a ruler, a
 * caption) scrolls up through the frame. With the page at rest in the held
 * speaker's view the grille sits in the empty space under the counter's
 * caption, never on the numerals, the ruler's numbers or the caption, and
 * above the end of the section. On phones the counter runs the full width, so
 * the grille has to cross its ruler and caption on the way down: while it
 * does, the microphone's own light is down (a dark shape behind the text).
 * Also: a window narrower than the desktop layout gets the portrait framing,
 * and where its copy is laid out wide (not taller than wide) the hero's
 * microphone stands at the right, clear of the headline and the facts row.
 * Uses the debug simulator (?scene-debug=1) with the page's real copy boxes.
 */

type Box = [number, number, number, number, 't' | 'h' | 'p', number?];
type Motion = {
  fails: string[];
  speakerCopy: { J: number; airPx: number; grille: number[]; lit: number; dim: boolean }[];
};
type Sim = {
  copyBoxes: () => Box[];
  ticketsEnd: () => number;
  motion: (o: { copy?: Record<string, Box[]>; edge?: Record<string, number> }) => Motion;
  place: (js: number[]) => { J: number; head: number[]; barrel: number[]; house: number[]; headM: number; fov: number }[];
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

  // Phones: with the page at rest anywhere from J 5.6 to the fade, the grille is either clear of
  // every line of text or taken down (its own light off) while it crosses the ruler and the caption.
  for (const size of [
    { name: 'phone 390x844', width: 390, height: 844 },
    { name: 'phone 360x780', width: 360, height: 780 },
  ]) {
    test(`${size.name}: at rest from J 5.6 the grille is clear of the copy, or dark while it crosses the counter`, async ({ page }) => {
      const js = [5.6, 5.65, 5.7, 5.75, 5.8, 5.85, 5.9, 5.95];
      await page.setViewportSize({ width: size.width, height: size.height });
      await ready(page);
      const m = await speakerView(page, js);
      expect(m.speakerCopy.map((r) => r.J)).toEqual(js);
      for (const r of m.speakerCopy) {
        const clear = r.airPx >= 6;
        expect(clear || r.dim, `J${r.J}: grille ${r.airPx} px from the copy with its light at ${r.lit} (grille at ${r.grille})`).toBe(true);
        // Taken down means really down: at most a fifth of the light it has in the held view.
        if (!clear) expect(r.lit, `J${r.J}: light while crossing`).toBeLessThanOrEqual(0.2);
      }
      // The held view: under the caption, clear of the copy, and lit again.
      for (const r of m.speakerCopy.filter((r) => r.J >= 5.85)) {
        expect(r.airPx, `J${r.J}: air between the grille and the copy (grille at ${r.grille})`).toBeGreaterThanOrEqual(6);
        expect(r.lit, `J${r.J}: the microphone is lit in the held view`).toBeGreaterThan(1);
      }
      expect(m.fails.filter((f) => f.startsWith("speaker's view") || f.startsWith('frame'))).toEqual([]);
    });
  }

  // A window narrower than the desktop layout but not taller than wide: the hero copy is laid out
  // wide (headline, then three facts side by side), and the microphone stands right of it.
  for (const size of [
    { width: 1000, height: 900 },
    { width: 900, height: 600 },
    { width: 1023, height: 768 },
    { width: 960, height: 600 },
  ]) {
    test(`${size.width}x${size.height}: the hero's microphone stands clear of the headline and the facts`, async ({ page }) => {
      await page.setViewportSize(size);
      await ready(page);
      for (const J of [0, 0.25, 0.5, 0.75]) {
        await scrollToJ(page, J);
        await page.waitForTimeout(400);
        const r = await page.evaluate((J) => {
          const sim = (window as unknown as { __sceneSim: Sim }).__sceneSim;
          const pl = sim.place([J])[0];
          // The grille's radius on screen (26.2 mm at its distance), and the barrel as a narrower disc.
          const rPx = (0.0262 / (pl.headM * 2 * Math.tan((pl.fov * Math.PI) / 360))) * window.innerHeight;
          const lines = sim.copyBoxes().filter((b) => b[4] !== 'p');
          const air = (pt: number[], rad: number) =>
            Math.min(...lines.map((b) => Math.hypot(Math.max(b[0] - pt[0], 0, pt[0] - b[2]) * window.innerWidth, Math.max(b[1] - pt[1], 0, pt[1] - b[3]) * window.innerHeight) - rad));
          return { head: pl.head, headAir: air(pl.head, rPx), barrelAir: air(pl.barrel, rPx * 0.6), rPx };
        }, J);
        const where = `J${J}: grille at ${r.head}, radius ${r.rPx.toFixed(0)} px`;
        // At the right of the frame, not under the headline (the phone's hero has it at 0.46).
        expect(r.head[0], where).toBeGreaterThan(0.6);
        expect(r.headAir, `${where}: air between the grille and the copy`).toBeGreaterThanOrEqual(J <= 0.5 ? 24 : 12);
        expect(r.barrelAir, `${where}: air between the barrel and the copy`).toBeGreaterThanOrEqual(J <= 0.5 ? 24 : 12);
      }
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
    // A tablet held upright keeps the phone's hero: the microphone in the lower middle, under the stacked copy.
    await page.setViewportSize({ width: 768, height: 1024 });
    await ready(page);
    const head = await page.evaluate(() => (window as unknown as { __sceneSim: Sim }).__sceneSim.place([0])[0].head);
    expect(head[0]).toBeGreaterThan(0.38);
    expect(head[0]).toBeLessThan(0.55);
    expect(head[1]).toBeGreaterThan(0.55);
  });
});
