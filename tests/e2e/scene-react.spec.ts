import { devices, expect, test, type Page } from '@playwright/test';

/*
 * The scene reacts to the visitor (src/scene/rig.ts, REACT): the pointer orbits
 * the camera a little round the subject (more on the wide shots than in the
 * macro), the view has a little weight on fast moves, the subject keeps its
 * authored place (least room in the speaker's view), and none of it exists
 * when motion is off (no canvas at all). Uses the debug simulator
 * (?scene-debug=1), which steps the real rig with a fixed clock.
 */

type Corner = { orbitDeg: number; viewDeg: number; clr: number; finite: boolean };
type ReactResult = { J: number; dist: number; corners: Record<'left' | 'right' | 'top' | 'bottom', Corner> };
type Fling = { maxLagDeg: number; maxBankDeg: number; bankLimitDeg: number; minClr: number; finite: boolean };
type Phone = { J: number; swingDeg: number; meanDeg: number; minClr: number; finite: boolean };
type Sim = {
  react: (o: { J: number; react?: number; hold?: number }) => ReactResult;
  fling: (o: { from: number; to: number }) => Fling;
  phone: (o: { J: number; seconds?: number; portrait?: boolean; kick?: number }) => Phone;
};

const react = (page: Page, J: number, r = 1, hold = 2.5) =>
  page.evaluate(([J, r, hold]) => (window as unknown as { __sceneSim: Sim }).__sceneSim.react({ J, react: r, hold }), [J, r, hold] as const);
const fling = (page: Page, from: number, to: number) =>
  page.evaluate(([from, to]) => (window as unknown as { __sceneSim: Sim }).__sceneSim.fling({ from, to }), [from, to] as const);

const phone = (page: Page, J: number, portrait: boolean, kick = 0) =>
  page.evaluate(
    ([J, portrait, kick]) => (window as unknown as { __sceneSim: Sim }).__sceneSim.phone({ J, portrait, kick, seconds: 30 }),
    [J, portrait, kick] as const,
  );

type Shift = { J: number; headPx: number; maxPx: number; housePx: number; headIn: boolean; headRest: number[]; headBox: number[] };
const shift = (page: Page, J: number, sway = false) =>
  page.evaluate(
    ([J, sway]) =>
      (window as unknown as { __sceneSim: { subjectShift: (o: { J: number; sway?: boolean; seconds?: number }) => Shift } }).__sceneSim.subjectShift({ J, sway, seconds: 30 }),
    [J, sway] as const,
  );
const placeFails = (page: Page, pointer: [number, number]) =>
  page.evaluate(
    (pointer) => (window as unknown as { __sceneSim: { motion: (o: { pointer: [number, number] }) => { placeFails: string[] } } }).__sceneSim.motion({ pointer }).placeFails,
    pointer,
  );

const live = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __scene?: { frame: number; react: { px: number; py: number; kick: number } } }).__scene ?? null,
  );

test.describe('the scene reacts to the visitor', () => {
  test.describe.configure({ timeout: 120_000 });

  test('pointer moves the camera within bounds, more on wide shots than in the macro; zero without react', async ({ page }) => {
    await page.goto('/?quality=low&perf=off&scene-debug=1');
    await page.waitForFunction(() => !!(window as unknown as { __sceneSim?: unknown }).__sceneSim, null, { timeout: 60_000 });
    const orbit: Record<number, number> = {};
    for (const J of [0.5, 1.3, 3.0, 5.0]) {
      const r = await react(page, J);
      for (const [name, c] of Object.entries(r.corners)) {
        expect(c.finite, `J${J} ${name} finite`).toBe(true);
        // Clearly visible, but a few degrees at most.
        expect(c.orbitDeg, `J${J} ${name} orbit`).toBeGreaterThan(0.3);
        expect(c.orbitDeg, `J${J} ${name} orbit`).toBeLessThan(5);
        expect(c.viewDeg, `J${J} ${name} view`).toBeLessThan(5);
        // The near plane never reaches a surface.
        expect(c.clr, `J${J} ${name} clearance`).toBeGreaterThan(1);
      }
      orbit[J] = r.corners.right.orbitDeg;
      const off = await react(page, J, 0, 1);
      for (const c of Object.values(off.corners)) expect(c.orbitDeg + c.viewDeg).toBe(0);
    }
    // The macro stays controlled; the wide shots move more.
    expect(orbit[3.0]).toBeGreaterThan(orbit[1.3]);
    expect(orbit[5.0]).toBeGreaterThan(orbit[1.3]);
  });

  test('fast flings: weight and bank stay bounded and finite, the lens stays clear', async ({ page }) => {
    await page.goto('/?quality=low&perf=off&scene-debug=1');
    await page.waitForFunction(() => !!(window as unknown as { __sceneSim?: unknown }).__sceneSim, null, { timeout: 60_000 });
    for (const [from, to] of [
      [0.3, 1.6],
      [1.6, 3.2],
      [0, 6],
    ]) {
      const f = await fling(page, from, to);
      expect(f.finite, `${from}->${to}`).toBe(true);
      expect(f.maxLagDeg, `${from}->${to} lag`).toBeLessThan(1.8);
      // The bank into the move (the rig's own roll, not the shot's authored horizon) stays in its limit.
      expect(f.maxBankDeg, `${from}->${to} bank`).toBeLessThanOrEqual(f.bankLimitDeg + 1e-3);
      expect(f.minClr, `${from}->${to} clearance`).toBeGreaterThan(1);
    }
  });

  test('the live pointer reaches the camera', async ({ page }) => {
    await page.goto('/?quality=low&perf=off&scene-debug=1');
    await expect(page.locator('canvas')).toHaveCount(1, { timeout: 30_000 });
    await expect.poll(async () => (await live(page))?.frame ?? 0, { timeout: 60_000 }).toBeGreaterThan(2);
    const { width, height } = page.viewportSize()!;
    await page.mouse.move(width - 4, height / 2, { steps: 5 });
    await expect.poll(async () => (await live(page))?.react.px ?? 0, { timeout: 60_000 }).toBeGreaterThan(0.3);
    await page.mouse.move(4, height / 2, { steps: 5 });
    await expect.poll(async () => (await live(page))?.react.px ?? 0, { timeout: 60_000 }).toBeLessThan(-0.3);
  });

  test('phones without tilt: the sway is a visible swing, scrolling swings the room further, all bounded', async ({ page }) => {
    await page.goto('/?quality=low&perf=off&scene-debug=1');
    await page.waitForFunction(() => !!(window as unknown as { __sceneSim?: unknown }).__sceneSim, null, { timeout: 60_000 });
    for (const J of [0.5, 3.0, 5.0]) {
      const p = await phone(page, J, true);
      expect(p.finite, `J${J} finite`).toBe(true);
      expect(p.minClr, `J${J} clearance`).toBeGreaterThan(1);
      // Wide shots: a few degrees from side to side within half a minute (was about one). The
      // speaker's view (J 5.65 on) is damped on purpose and has its own test below.
      if (J >= 3) expect(p.swingDeg, `J${J} sway swing`).toBeGreaterThan(2.5);
      expect(p.swingDeg, `J${J} sway swing`).toBeLessThan(9);
      // A held scroll kick moves the whole swing to one side.
      const k = await phone(page, J, true, 0.8);
      expect(k.finite).toBe(true);
      expect(k.minClr).toBeGreaterThan(1);
      expect(Math.abs(k.meanDeg - p.meanDeg), `J${J} kick`).toBeGreaterThan(J >= 3 ? 1 : 0.3);
    }
  });

  test("the speaker's view holds its framing: the pointer never carries the grille off", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?quality=low&perf=off&scene-debug=1');
    await page.waitForFunction(() => !!(window as unknown as { __sceneSim?: unknown }).__sceneSim, null, { timeout: 60_000 });
    // Behind the microphone the grille is under a metre from the lens: with the pointer held at any
    // side or corner it stays in frame and within a few pixels of where the shot put it (it used to
    // leave the frame), while the house still slides a little behind it.
    for (const J of [5.5, 5.6, 5.7, 5.8, 5.9]) {
      const r = await shift(page, J);
      expect(r.headIn, `J${J} grille in frame`).toBe(true);
      expect(r.headPx, `J${J} grille moves`).toBeLessThan(12);
      expect(r.housePx, `J${J} house slides`).toBeGreaterThan(4);
      expect(r.housePx, `J${J} house slides`).toBeLessThan(60);
    }
    // Over Venue the stand rides in a narrow gutter beside the location plate: it keeps its place too.
    for (const J of [4.375, 4.5, 4.625]) expect((await shift(page, J)).maxPx, `J${J} subject moves`).toBeLessThan(8);
    // The whole journey with the pointer held in a corner: the subject stays in frame and the
    // speaker's view keeps to its rules.
    for (const p of [
      [-1, 1],
      [1, -1],
    ] as [number, number][])
      expect(await placeFails(page, p), `pointer ${p}`).toEqual([]);
  });

  test("phones: the automatic sway and the scroll kick leave the speaker's view in place", async ({ browser }) => {
    const ctx = await browser.newContext({ ...devices['Pixel 5'], viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    try {
      await page.goto('/?quality=low&perf=off&scene-debug=1');
      await page.waitForFunction(() => !!(window as unknown as { __sceneSim?: unknown }).__sceneSim, null, { timeout: 60_000 });
      for (const J of [5.6, 5.7, 5.8, 5.9]) {
        // Half a minute of sway (it used to carry the microphone off screen and back across the counter).
        const r = await shift(page, J, true);
        expect(r.headIn, `J${J} grille in frame`).toBe(true);
        expect(r.headPx, `J${J} grille moves`).toBeLessThan(8);
        // The swing is deliberately damped here: the wide shots keep theirs (the test above).
        const p = await phone(page, J, true);
        expect(p.finite).toBe(true);
        expect(p.swingDeg, `J${J} sway swing`).toBeLessThan(1);
        // A held scroll kick does not carry it off either.
        const k = await page.evaluate(
          (J) =>
            (window as unknown as { __sceneSim: { subjectShift: (o: { J: number; sway?: boolean; seconds?: number; kick?: number }) => Shift } }).__sceneSim.subjectShift({ J, sway: true, seconds: 10, kick: 0.85 }),
          J,
        );
        expect(k.headIn, `J${J} kick: grille in frame`).toBe(true);
        expect(k.headPx, `J${J} kick: grille moves`).toBeLessThan(8);
      }
    } finally {
      await ctx.close();
    }
  });

  test('on a touch screen, scrolling kicks the camera', async ({ browser }) => {
    const ctx = await browser.newContext({ ...devices['Pixel 5'] });
    const page = await ctx.newPage();
    try {
      await page.goto('/?quality=low&perf=off&scene-debug=1');
      await expect(page.locator('canvas')).toHaveCount(1, { timeout: 30_000 });
      await expect.poll(async () => (await live(page))?.frame ?? 0, { timeout: 60_000 }).toBeGreaterThan(2);
      // A steady scroll down for a second: the kick follows the scroll speed.
      // The strongest kick seen while scrolling (the software renderer draws few frames, so the last frame alone is not reliable).
      const k = await page.evaluate(
        () =>
          new Promise<number>((done) => {
            const t0 = performance.now();
            let max = 0;
            const read = () => (window as unknown as { __scene?: { react?: { kick?: number } } }).__scene?.react?.kick ?? 0;
            const step = () => {
              window.scrollBy(0, 40);
              max = Math.max(max, Math.abs(read()));
              if (performance.now() - t0 < 2500) requestAnimationFrame(step);
              else done(max);
            };
            requestAnimationFrame(step);
          }),
      );
      expect(k).toBeGreaterThan(0.05);
      expect(k).toBeLessThanOrEqual(1);
      // At rest it settles back.
      await expect.poll(async () => Math.abs((await live(page))?.react.kick ?? 1), { timeout: 30_000 }).toBeLessThan(0.05);
    } finally {
      await ctx.close();
    }
  });

  test('the pointer leaving the window re-centres the scene', async ({ page }) => {
    await page.goto('/?quality=low&perf=off&scene-debug=1');
    await expect(page.locator('canvas')).toHaveCount(1, { timeout: 30_000 });
    await expect.poll(async () => (await live(page))?.frame ?? 0, { timeout: 60_000 }).toBeGreaterThan(2);
    const { width, height } = page.viewportSize()!;
    await page.mouse.move(width - 4, height / 2, { steps: 5 });
    await expect.poll(async () => (await live(page))?.react.px ?? 0, { timeout: 60_000 }).toBeGreaterThan(0.3);
    await page.evaluate(() => document.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: null })));
    await expect.poll(async () => Math.abs((await live(page))?.react.px ?? 1), { timeout: 60_000 }).toBeLessThan(0.1);
  });

  test('reduced motion: no canvas, nothing reacts', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?scene-debug=1');
    await page.waitForTimeout(1500);
    const { width, height } = page.viewportSize()!;
    await page.mouse.move(width - 4, height / 2, { steps: 5 });
    await page.waitForTimeout(500);
    await expect(page.locator('canvas')).toHaveCount(0);
    expect(await live(page)).toBeNull();
  });

  test('the Reduce motion switch stops it', async ({ page }) => {
    await page.goto('/?quality=low&perf=off&scene-debug=1');
    await expect(page.locator('canvas')).toHaveCount(1, { timeout: 30_000 });
    await expect.poll(async () => (await live(page))?.frame ?? 0, { timeout: 60_000 }).toBeGreaterThan(2);
    const toggle = page.getByRole('button', { name: /^Reduce motion/ });
    await toggle.evaluate((b: HTMLElement) => b.click());
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('canvas')).toHaveCount(0, { timeout: 15_000 });
    const a = (await live(page))?.frame ?? 0;
    const { width, height } = page.viewportSize()!;
    await page.mouse.move(width - 4, height / 2, { steps: 5 });
    await page.waitForTimeout(800);
    expect((await live(page))?.frame ?? 0).toBe(a);
  });
});
