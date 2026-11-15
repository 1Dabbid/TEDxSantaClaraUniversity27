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
 * and where it is not taller than wide the hero's microphone stands at the
 * right, clear of the headline and the facts row (under 640 px wide: under
 * the end of the headline where it runs most of the width, beside it, as
 * from 640 px, where the window is clearly wider than tall), and stays dim
 * until the scroll hint and the clause counter have passed over it. A phone on its side gets the phone's dimming
 * while the grille crosses the counter.
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
  place: (js: number[]) => { J: number; head: number[]; barrel: number[]; house: number[]; headM: number; fov: number; exp: number }[];
  hero: () => { heroX?: number; heroY?: number; wideCopy: boolean };
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
    { width: 640, height: 480 },
    // Small near-square windows: the headline is set at the phone's size and runs most of the
    // width, so the grille stands under its end, right of the tagline, the buttons and the facts.
    { width: 520, height: 540, under: true },
    { width: 560, height: 600, under: true },
    { width: 600, height: 560, under: true },
    // Under 640 px wide but clearly wider than tall: the headline stops short of the right edge and
    // there is no room under it, so the grille stands beside it, as from 640 px (not in the lower
    // middle, on the tagline, as on a phone).
    { width: 639, height: 480 },
    { width: 600, height: 400 },
    { width: 560, height: 500, air: 20 },
    // Between the two shapes neither place fits as measured: the grille is held under the end of
    // the headline, a little lower than elsewhere, with what air the frame leaves.
    { width: 480, height: 500, under: true, air: 20 },
    { width: 440, height: 460, under: true, air: 16 },
  ]) {
    test(`${size.width}x${size.height}: the hero's microphone stands clear of the headline and the facts`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await ready(page);
      // In the small windows the hero's last line (a faint 9px legal line, wider than the column) passes
      // over the barrel late in the scroll-out, when the scene is already down to a dark shape: the
      // check there stops at J 0.5.
      for (const J of size.under ? [0, 0.25, 0.5] : [0, 0.25, 0.5, 0.75]) {
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
          const words = [...document.querySelectorAll('#hero-title [data-hero-word]')].map((w) => w.getBoundingClientRect());
          const headline = { right: Math.max(...words.map((w) => w.right)) / window.innerWidth, bottom: Math.max(...words.map((w) => w.bottom)) / window.innerHeight };
          return { head: pl.head, headAir: air(pl.head, rPx), barrelAir: air(pl.barrel, rPx * 0.6), rPx, headline };
        }, J);
        const where = `J${J}: grille at ${r.head}, radius ${r.rPx.toFixed(0)} px`;
        // At the right of the frame, not under the headline (the phone's hero has it at 0.46).
        expect(r.head[0], where).toBeGreaterThan(0.56);
        // Beside the headline, or (small windows) under it: never on its last letters.
        if (size.under) expect(r.head[1] - r.rPx / size.height, `${where}: under the headline (to ${r.headline.bottom.toFixed(3)})`).toBeGreaterThan(r.headline.bottom);
        else if (J === 0) expect(r.head[0] - r.rPx / size.width, `${where}: right of the headline (to ${r.headline.right.toFixed(3)})`).toBeGreaterThan(r.headline.right);
        expect(r.headAir, `${where}: air between the grille and the copy`).toBeGreaterThanOrEqual(J <= 0.5 ? (size.air ?? 24) : 12);
        expect(r.barrelAir, `${where}: air between the barrel and the copy`).toBeGreaterThanOrEqual(J <= 0.5 ? (size.air ?? 24) : 12);
      }
      // As the hero scrolls out, the scroll hint and the Theme stage's clause counter pass over the
      // barrel at the right: the engraving keeps the push in's dim light until they have (J 1.1),
      // then takes the macro's.
      const exp = await page.evaluate(() => (window as unknown as { __sceneSim: Sim }).__sceneSim.place([0.95, 1.0, 1.05, 1.1, 1.4]).map((p) => p.exp));
      for (const e of exp.slice(0, 4)) expect(e, `exposure while the labels pass: ${exp}`).toBeLessThanOrEqual(0.82);
      expect(exp[4], 'the macro is lit').toBeGreaterThan(1);
    });
  }

  // The layout changes at 640 px (the headline's size, the facts row); the microphone's place does
  // not jump there in a window clearly wider than tall: beside the headline on both sides of it.
  test("639x480 and 640x480: the hero's microphone stands in the same place, beside the headline", async ({ page }) => {
    const at = async (width: number) => {
      await page.setViewportSize({ width, height: 480 });
      await ready(page);
      return page.evaluate(() => {
        const sim = (window as unknown as { __sceneSim: Sim }).__sceneSim;
        return { hero: sim.hero(), head: sim.place([0])[0].head };
      });
    };
    const narrow = await at(639);
    const wide = await at(640);
    for (const r of [narrow, wide]) {
      expect(r.hero.wideCopy).toBe(true);
      // Beside the headline: the move's own height, not a measured one under the headline.
      expect(r.hero.heroY).toBeUndefined();
    }
    expect(narrow.head[1]).toBeCloseTo(wide.head[1], 3);
    expect(Math.abs(narrow.head[0] - wide.head[0]), `grille x ${narrow.head[0]} at 639 px, ${wide.head[0]} at 640 px`).toBeLessThan(0.05);
  });

  // A phone on its side keeps the landscape move, but under 768 px wide its counter is laid out
  // like a phone's: while the grille crosses the numerals, the ruler and the caption it is taken down.
  for (const size of [
    { width: 667, height: 375 },
    { width: 740, height: 360 },
  ]) {
    test(`phone on its side ${size.width}x${size.height}: the grille is clear of the copy, or dark while it crosses the counter`, async ({ page }) => {
      const js = [5.5, 5.55, 5.6, 5.65, 5.7, 5.75, 5.8, 5.85, 5.9, 5.95];
      await page.setViewportSize(size);
      await ready(page);
      const m = await speakerView(page, js);
      expect(m.speakerCopy.map((r) => r.J)).toEqual(js);
      for (const r of m.speakerCopy) {
        const clear = r.airPx >= 6;
        expect(clear || r.dim, `J${r.J}: grille ${r.airPx} px from the copy with its light at ${r.lit} (grille at ${r.grille})`).toBe(true);
        if (!clear) expect(r.lit, `J${r.J}: light while crossing`).toBeLessThanOrEqual(0.2);
      }
      // It does cross there (so the dimming is doing something), and is lit again in the held view.
      expect(m.speakerCopy.some((r) => r.airPx < 6)).toBe(true);
      for (const r of m.speakerCopy.filter((r) => r.J >= 5.9)) {
        expect(r.airPx, `J${r.J}: air between the grille and the copy`).toBeGreaterThanOrEqual(6);
        expect(r.lit, `J${r.J}: the microphone is lit in the held view`).toBeGreaterThan(1);
      }
      expect(m.fails.filter((f) => f.startsWith("speaker's view"))).toEqual([]);
    });
  }

  // From 768 px wide a phone on its side has the desktop's counter: the grille keeps clear of it, lit.
  test('phone on its side 844x390: the grille keeps clear of the counter, lit', async ({ page }) => {
    const js = [5.75, 5.8, 5.85, 5.9, 5.95];
    await page.setViewportSize({ width: 844, height: 390 });
    await ready(page);
    const m = await speakerView(page, js);
    expect(m.speakerCopy.map((r) => r.J)).toEqual(js);
    for (const r of m.speakerCopy) {
      expect(r.airPx, `J${r.J}: air between the grille and the copy (grille at ${r.grille})`).toBeGreaterThanOrEqual(6);
      expect(r.lit, `J${r.J}: lit`).toBeGreaterThan(1);
    }
    expect(m.fails.filter((f) => f.startsWith("speaker's view"))).toEqual([]);
  });

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
