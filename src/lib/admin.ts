import keystaticConfig from '../../keystatic.config';

/**
 * Whether the Keystatic admin (/keystatic and /api/keystatic/*) is switched on.
 *
 * - `next dev`: always (local mode, editing the files in this checkout).
 * - Any other build (`next build`, every Vercel deployment): only when GitHub
 *   mode is fully configured, i.e. all four Keystatic variables are set and the
 *   build picked GitHub storage (see keystatic.config.ts). Editors then sign in
 *   with GitHub and every save is a commit that only repository collaborators
 *   with write access can make.
 *
 * Otherwise the admin answers 404. Keystatic's local mode has no authentication
 * of its own: served from a production build it would let anyone list, read and
 * write files in the deployment, so it must never run outside `next dev`.
 */
export const adminEnabled =
  process.env.NODE_ENV === 'development' ||
  Boolean(
    keystaticConfig.storage.kind === 'github' &&
      process.env.NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG &&
      process.env.KEYSTATIC_GITHUB_CLIENT_ID &&
      process.env.KEYSTATIC_GITHUB_CLIENT_SECRET &&
      process.env.KEYSTATIC_SECRET,
  );
