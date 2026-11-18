/**
 * The one switch for Google Analytics: NEXT_PUBLIC_GA_MEASUREMENT_ID, read at build
 * time (docs/ANALYTICS.md). Used by next.config.ts (the Content-Security-Policy, and
 * the GA_MEASUREMENT_ID it inlines for src/components/SiteShell.tsx, which decides
 * whether the analytics component exists at all) and scripts/check-content.mjs (the
 * warning). No imports: next.config.ts loads this
 * file directly.
 *
 * Analytics is off unless all of these hold:
 * - there is an ID: the variable, or SITE_GA_ID below on a Vercel production deployment;
 * - the value looks like a Google Analytics 4 Measurement ID ("G-" and letters/digits);
 * - it is a production build (never under `npm run dev`);
 * - it is not a Vercel preview or development deployment (VERCEL_ENV), so test
 *   deployments never add visits to the real numbers.
 */
export const GA_ID_VAR = 'NEXT_PUBLIC_GA_MEASUREMENT_ID';

/**
 * The club's own Measurement ID. Used on the live site (a Vercel production deployment)
 * when the variable is not set, so nothing has to be typed into Vercel. The ID is not a
 * secret: every page that uses it shows it. Local builds, the tests and preview
 * deployments never use it. The variable overrides it: another ID replaces it, and
 * "off" switches analytics off.
 */
export const SITE_GA_ID = 'G-NH4G85FK73';
const OFF = /^off$/i;
const GA_ID = /^G-[A-Z0-9]{4,}$/;

type Env = Record<string, string | undefined>;

/** The value as typed, trimmed ('' when unset). */
const raw = (env: Env) => (env[GA_ID_VAR] ?? '').trim();

/** A message when the variable is set to something that is not a Measurement ID, else ''. */
export function gaIdProblem(env: Env = process.env): string {
  const value = raw(env);
  if (!value || OFF.test(value) || GA_ID.test(value)) return '';
  return `${GA_ID_VAR} is set to "${value}", which is not a Google Analytics 4 Measurement ID (it looks like G-XXXXXXXXXX: capital letters and digits). Analytics stays off until it is corrected.`;
}

/** The Measurement ID when analytics is on for this build, else null. */
export function gaMeasurementId(env: Env = process.env): string | null {
  const typed = raw(env);
  if (OFF.test(typed)) return null;
  const value = typed || (env.VERCEL_ENV === 'production' ? SITE_GA_ID : '');
  if (!GA_ID.test(value)) return null;
  if (env.NODE_ENV !== 'production') return null;
  if (env.VERCEL_ENV && env.VERCEL_ENV !== 'production') return null;
  return value;
}
