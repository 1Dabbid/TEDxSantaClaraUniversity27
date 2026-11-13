/**
 * npm run check:content: reads everything in /content through the same loader
 * the site uses (src/lib/content.ts) and prints every problem it finds.
 *
 * - Warnings: things the site works around (a link without https://, a photo of
 *   the wrong type or over 2 MB, an invalid slug, an impossible date…). The page
 *   still builds; the value is fixed or left out.
 * - Errors: things that stop the build (a file that is not valid YAML, a value
 *   the admin cannot produce).
 *
 * Exit code: 1 when there is any warning or error. With --errors-only, 1 only
 * for errors (CI runs that variant as a blocking step and the full check as a
 * non-blocking one).
 *
 * Run with: node --conditions=react-server scripts/check-content.mjs
 */
import { register } from 'node:module';

register('./lib/ts-hooks.mjs', import.meta.url);

const errorsOnly = process.argv.includes('--errors-only');

// The loader prints each warning as it is found; collect them quietly and print a summary instead.
const originalWarn = console.warn;
console.warn = (...args) => {
  if (typeof args[0] === 'string' && args[0].startsWith('Content warning:')) return;
  originalWarn(...args);
};

const content = await import('../src/lib/content.ts');
const { contentWarnings } = await import('../src/lib/content-checks.ts');

const loaders = ['getSettings', 'getSpeakers', 'getSchedule', 'getFaq', 'getTeam', 'getTiers', 'getSponsors', 'getPartnerBenefits', 'getPartnerNotes', 'getTedLanguage'];
const errors = [];
for (const name of loaders) {
  try {
    await content[name]();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!errors.includes(message)) errors.push(message);
  }
}
console.warn = originalWarn;

const warnings = contentWarnings();
for (const e of errors) console.log(`ERROR (the site will not build until this is fixed)\n${e}\n`);
if (warnings.length) {
  console.log(`${warnings.length} warning${warnings.length === 1 ? '' : 's'} (the site still builds; the value is fixed or left out):`);
  for (const w of warnings) console.log(`- ${w.file} › ${w.field}: ${w.message}`);
}
if (!errors.length && !warnings.length) console.log('Content check: no problems found.');

process.exitCode = errors.length || (!errorsOnly && warnings.length) ? 1 : 0;
