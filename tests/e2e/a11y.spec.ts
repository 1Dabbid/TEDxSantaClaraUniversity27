import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { publishedSpeakers, settle, topicRoutes } from './helpers';

/** axe-core (WCAG 2.x A/AA rules) on the reduced-motion design, which is also the server HTML. */
test.use({ reducedMotion: 'reduce' });

const speaker = publishedSpeakers()[0]?.slug;
const routes = ['/', ...topicRoutes(), ...(speaker ? [`/speakers/${speaker}`] : [])];

for (const route of routes) {
  test(`axe: ${route}`, async ({ page }) => {
    await page.goto(route);
    await settle(page, 300);
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const summary = violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).slice(0, 5).join(', ')}`);
    expect(summary).toEqual([]);
  });
}
