import { expect, test } from '@playwright/test';
import { counterSeats, houseSeatsLit } from '../../src/scene/houseLights';
import { STRIKE, createStrike, stepStrike } from '../../src/scene/lampStrike';
import { HOUSE_SEATS, SEATING, SEAT_ORDER, seatIndex, seatOrder } from '../../src/scene/layout';

/**
 * The 3D scene's pure logic for the Tickets house lights and the lamp strike
 * (src/scene/houseLights.ts, layout.ts, lampStrike.ts), tested directly. No
 * browser is used.
 */

test.describe('seat lighting order', () => {
  test('is a permutation of every seat in the house', () => {
    expect(HOUSE_SEATS).toBe(100);
    expect(SEAT_ORDER.length).toBe(HOUSE_SEATS);
    expect([...SEAT_ORDER].sort((a, b) => a - b)).toEqual(Array.from({ length: HOUSE_SEATS }, (_, i) => i));
  });

  test('build indices cover every seat once', () => {
    const seen = new Set<number>();
    SEATING.rows.forEach((n, row) => {
      for (const side of [-1, 1]) for (let k = 0; k < n / 2; k++) seen.add(seatIndex(row, side, k));
    });
    expect(seen.size).toBe(HOUSE_SEATS);
  });

  test('starts at the front row, far left seen from the back', () => {
    expect(seatOrder(0, -1, SEATING.rows[0] / 2 - 1)).toBe(0);
  });

  test('runs left to right along every row', () => {
    SEATING.rows.forEach((n, row) => {
      const along: number[] = [];
      for (let k = n / 2 - 1; k >= 0; k--) along.push(seatOrder(row, -1, k));
      for (let k = 0; k < n / 2; k++) along.push(seatOrder(row, 1, k));
      for (let i = 1; i < along.length; i++) expect(along[i]).toBeGreaterThan(along[i - 1]);
    });
  });

  test('keeps the front three rows lighting over the whole count', () => {
    // The rows the desktop Tickets camera shows: their seats are spread from the first figures to the last.
    const front: number[] = [];
    for (let row = 0; row < 3; row++) {
      for (const side of [-1, 1]) for (let k = 0; k < SEATING.rows[row] / 2; k++) front.push(seatOrder(row, side, k));
    }
    expect(Math.min(...front)).toBeLessThan(5);
    expect(Math.max(...front)).toBeGreaterThan(80);
  });
});

test.describe('seats lit by the counter', () => {
  test('lights as many seats as the counter shows, up to the capacity', () => {
    expect(houseSeatsLit(0, 100, 100)).toBe(0);
    expect(houseSeatsLit(37.5, 100, 100)).toBe(37.5);
    expect(houseSeatsLit(60, 60, 100)).toBe(60);
    expect(houseSeatsLit(150, 60, 100)).toBe(60);
    expect(houseSeatsLit(10, 0, 100)).toBe(0);
  });

  test('maps a capacity above the house onto it in proportion', () => {
    expect(houseSeatsLit(200, 200, 100)).toBe(100);
    expect(houseSeatsLit(100, 200, 100)).toBe(50);
  });

  test('the counter value runs from 0 (not started) through 1 to the capacity', () => {
    expect(counterSeats(0, 100)).toBe(0);
    expect(counterSeats(1e-6, 100)).toBeCloseTo(1, 3);
    expect(counterSeats(0.5, 100)).toBeCloseTo(50.5, 6);
    expect(counterSeats(1, 100)).toBe(100);
    expect(counterSeats(1, 60)).toBe(60);
    // A room of one: its single seat lights as soon as the count starts.
    expect(counterSeats(0.3, 1)).toBe(1);
    expect(houseSeatsLit(counterSeats(0.3, 1), 1, 100)).toBe(1);
  });
});

test.describe('lamp strike', () => {
  const run = (st: ReturnType<typeof createStrike>, path: [number, number][], dt = 1 / 60) => {
    // path: [time, J] keyframes, J held between them; returns the clock times at which a strike began.
    const starts: number[] = [];
    let t = path[0][0];
    let i = 0;
    const end = path[path.length - 1][0];
    while (t <= end) {
      while (i + 1 < path.length && path[i + 1][0] <= t) i++;
      const before = st.t0;
      stepStrike(st, path[i][1], t, dt);
      if (st.t0 !== before) starts.push(t);
      t += dt;
    }
    return starts;
  };

  test('does not strike when the page opens past the reveal', () => {
    const st = createStrike();
    expect(run(st, [[0, 4.2], [2, 4.2]])).toEqual([]);
    expect(st.on).toBe(1);
    expect(st.env).toBe(0);
  });

  test('strikes once on the way down, and again only after scrolling back above the re-arm point', () => {
    const st = createStrike();
    const starts = run(st, [[0, 1.5], [1, 2.4], [2, 2.6], [5, 1.9], [6, 2.5], [8, 2.5]]);
    expect(starts.length).toBe(2);
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(STRIKE.refractory);
  });

  test('strikes at most once per lockout however fast the reveal is crossed', () => {
    const st = createStrike();
    const path: [number, number][] = [[0, 1.5]];
    // Wiggle across the reveal four times a second for six seconds.
    for (let k = 0; k < 48; k++) path.push([0.5 + k * 0.125, k % 2 ? 2.0 : 2.4]);
    const starts = run(st, path);
    expect(starts.length).toBeGreaterThan(0);
    for (let i = 1; i < starts.length; i++) expect(starts[i] - starts[i - 1]).toBeGreaterThanOrEqual(STRIKE.refractory);
    expect(starts.length).toBeLessThanOrEqual(Math.floor(6 / STRIKE.refractory) + 1);
  });

  test('inside the lockout the lamp comes back up slowly, without the strike snap', () => {
    const st = createStrike();
    run(st, [[0, 1.5], [0.5, 2.4], [1.5, 2.0], [2.5, 2.4], [2.52, 2.4]]);
    // Re-crossed at t = 2.5 s, within 3 s of the strike at 0.5 s: soft rise, no overshoot.
    expect(st.soft).toBe(true);
    const at = st.on;
    stepStrike(st, 2.4, 2.6, 0.07);
    // One rise time constant later the lamp has come up well under the snap's 63% of the way.
    expect(st.on - at).toBeLessThan((1 - at) * 0.3);
  });
});
