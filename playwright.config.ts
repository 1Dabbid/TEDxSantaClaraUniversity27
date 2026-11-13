import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end smoke tests (tests/e2e). They run against a production build on a
 * fixed port, in Chromium only.
 *
 * Browser:
 * - CI installs its own: `npx playwright install --with-deps chromium`.
 * - Elsewhere, point PW_CHROMIUM_PATH at an existing Chromium binary, e.g.
 *   PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:e2e
 *
 * Server: `npm run build && npm run start` on PORT (default 3100). Set
 * PW_SKIP_BUILD=1 to reuse an existing `.next` build, or start a server yourself
 * on that port: it is reused outside CI.
 */
const PORT = Number(process.env.PORT ?? 3100);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const CI = Boolean(process.env.CI);
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 2 : undefined,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'off',
    screenshot: 'only-on-failure',
    // Same viewport everywhere unless a test overrides it: a laptop with a mouse.
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 800 },
    launchOptions: {
      executablePath,
      // Headless Chromium has no GPU: WebGL runs on SwiftShader. Newer Chromium
      // only allows that fallback with this flag; the site's quality probe then
      // sees a software renderer (and keeps the 3D scene off unless ?quality= forces it).
      args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
    },
  },
  projects: [{ name: 'chromium' }],
  webServer: {
    command: process.env.PW_SKIP_BUILD
      ? `npm run start -- -p ${PORT}`
      : `npm run build && npm run start -- -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !CI,
    timeout: 240_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
