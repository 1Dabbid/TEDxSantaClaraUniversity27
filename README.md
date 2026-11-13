# TEDxSantaClaraUniversity · Fine Print

The event site for **TEDxSantaClaraUniversity**, theme **Fine Print**: Friday, April 23, 2027, Locatelli Student Activity Center, Santa Clara University. Live at **https://fineprint.tedxscu.com** (Vercel, from the GitHub repo `1Dabbid/TEDxSantaClaraUniversity27`).

Public pages: the home page (`/`), `/partners`, `/speakers` (all speakers) and one page per speaker (`/speakers/<slug>`). Every word, date, link and photo is edited in a content admin at `/keystatic`; nobody needs to touch code to run the event.

| You want to… | Read |
| --- | --- |
| Change words, speakers, tickets, sponsors, FAQ | [docs/EDITING.md](docs/EDITING.md) |
| Put the site on Vercel, connect the domain, turn on the online admin | [docs/DEPLOY.md](docs/DEPLOY.md) |
| Re-theme the site for next year's event | [docs/NEXT-YEAR.md](docs/NEXT-YEAR.md) |
| Work on the code | the rest of this file |

Stack: Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS 4 · Keystatic (content in `/content`) · GSAP (ScrollTrigger, SplitText) + Lenis · three.js via @react-three/fiber, loaded lazily · Playwright + axe-core for tests. Node 22 (`.nvmrc`), npm.

## Quick start

```bash
npm ci             # install exactly what package-lock.json says
npm run dev        # http://localhost:3000 (admin: http://localhost:3000/keystatic)
npm run build      # production build: every public page is statically generated
npm run start      # serve the production build on :3000
npm run lint       # ESLint
npm run typecheck  # next typegen && tsc --noEmit
npm run test:e2e   # Playwright end-to-end suite (see Testing)
```

## The content admin

`/keystatic` is a Keystatic admin generated from `keystatic.config.ts`. Each save writes a YAML file in `content/` (or an image in `public/images/speakers|team|sponsors/`).

- **Local mode** (default): edits write straight to files on your computer. It only runs under `npm run dev`.
- **GitHub mode**: switched on when all four Keystatic variables are set at build time (`KEYSTATIC_GITHUB_CLIENT_ID`, `KEYSTATIC_GITHUB_CLIENT_SECRET`, `KEYSTATIC_SECRET`, `NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG`; see `.env.example` and [docs/DEPLOY.md](docs/DEPLOY.md)). Editors sign in with GitHub on the live site; each save is a commit to the repo, and Vercel rebuilds.
- **Off** everywhere else: a production build (`npm run build`, any Vercel deployment) without all four variables answers **404** on `/keystatic` and `/api/keystatic/*` (`src/lib/admin.ts`). Local mode has no sign-in of its own, so it must never be reachable on a deployed site.

Pages read content only through `src/lib/content.ts` (Keystatic's reader, at build time); components never import Keystatic. The admin splits event settings into five singletons (Event basics, Venue & directions, Tickets & speaker applications, Contact, Show / hide sections) and `getSettings()` merges them into one `Settings` object. The canonical site URL, club URL and the TEDx seat cap are constants in `src/lib/site.ts`, not content; the share-image alt text (`ogAlt()`), venue line and seat label helpers there are built from content. **Event basics > Seat capacity** (`settings.capacity`) is the single seat count for every page; the Tickets ruler draws one tick per seat and passes the count to its scroll moment as `data-seats`. **Livestream link** renders as `WatchLive` (`src/components/ui/WatchLive.tsx`) in the hero and Tickets, and nothing while blank.

## Architecture

```
src/
  app/                  routes: /, /partners, /speakers, /speakers/[slug], /keystatic, /api/keystatic,
                        sitemap.ts, robots.ts (noindex on Vercel previews), manifest.ts, icons (icon.svg,
                        favicon.ico, apple-icon.png; rasters from scripts/generate-icons.mjs),
                        opengraph-image.tsx and speakers/[slug]/opengraph-image.tsx (built at build time), not-found.tsx,
                        error.tsx (page error boundary), global-error.tsx (self-contained, root layout failures)
  components/           Header, Footer, MobileMenu, Logo, SkipLink, ChromeGate (no chrome on /keystatic), nav.ts
  components/sections/  Hero, Theme, Speakers, Schedule, Venue, Tickets, Team, Faq, Newsletter
  components/print/     the "fine print" primitives: clause numbers, TBA marker, redaction bars, crop marks, JSON-LD
  lib/                  content.ts (loader), quality.ts (tiers), site.ts (constants), dates.ts (fixed-timezone dates), jsonld.ts, links.ts, tickets.ts, admin.ts (whether /keystatic exists)
  motion/               MotionRoot, SmoothScroll (Lenis), SceneGate, gsap.ts, lenisRef.ts, useSectionMotion.ts
  motion/engine/        reveal, cursor, magnetic, navigation (page transitions), chrome (header), focus
  motion/sections/      one scroll moment per section (*Motion.tsx) + kit.ts
  scene/                the WebGL scene (see below)
```

**The HTML is the design.** The server always renders the static, reduced-motion version: everything readable and visible without JavaScript. Motion and the 3D scene are layered on top in the browser and never carry content.

### Scene contracts (`src/scene/`)

- `scrollState.ts`: a plain mutable singleton (no React renders): `progress` (page 0..1), `sections[id]` for each entry of `SECTION_IDS` (`hero, theme, speakers, schedule, venue, tickets, team, faq, newsletter`; 0 when the section top meets the viewport bottom, 1 when its bottom meets the viewport top), `pointer` (-1..1, y up), `velocity`. `src/motion/SmoothScroll.tsx` is its only writer; sections are found by `[data-section="<id>"]`. The order of sections in `src/app/page.tsx` must match `SECTION_IDS`.
- `SceneCanvas.tsx`: the single fixed, full-viewport, `aria-hidden`, `pointer-events: none` canvas. DPR `[1,2]` on high, `[1,1.5]` on low. Never import it statically: `SceneLoader` loads it with `next/dynamic({ ssr: false })` after `load` + idle.
- `Experience.tsx`: the scene itself (microphone, rug, spotlight, 100 seats, one scroll-driven camera); keeps its default export and `quality` prop. It steps resolution and post-processing down by itself when the frame rate stays low.
- **Tuning points**: `choreography.ts` is the camera choreography as data (`DESKTOP_SHOTS`, `PORTRAIT_SHOTS`, `AWAY_SHOT`: one shot per point of the scroll journey, where section k spans J = k..k+1). `engraving.ts` is the text laser-etched around the microphone (event name, theme, date, venue, license line, numbered clauses). Both are meant to be edited.
- `SceneGate` (`src/motion/SceneGate.tsx`, in the root layout) decides whether the scene exists: mounted on `/` when `useSceneEnabled()`; on other routes only if the home page was already shown in this visit (then the canvas is hidden and paused, so going back home is instant). A cold load of `/partners` or a speaker page never downloads three.js.
- Readability never depends on the canvas: sections carry their own scrims (`scrim-*`, `hero-scrim`, `theme-scrim`, … in `globals.css`).

### Motion engine (`src/motion/`)

- `html.motion` is set by an inline script before first paint (JS on, no reduced motion, no Save-Data, not on `/keystatic`) and removed by `MotionRoot` if the tier resolves to `static`. All pre-reveal CSS is scoped to `html.motion`.
- `MotionRoot` lazy-loads the engine (`src/motion/engine/index.ts`): `reveal.ts` (the `data-reveal="lines|chars|fade|rule|stagger"` attribute API, CSS failsafe if the engine never arrives), `cursor.ts` (`data-cursor="link|loupe"`), `magnetic.ts` (`data-magnetic`), `navigation.ts` (smooth anchors with header offset, a curtain between routes, focus moved to `#main`, scroll position restored on back/forward), `chrome.ts` (header hides on scroll down; red reading-progress hairline), `focus.ts`.
- `SmoothScroll` dynamically imports GSAP and Lenis only when motion is on; Lenis runs on the GSAP ticker. Always import GSAP from `@/motion/gsap`.
- Section moments live in `src/motion/sections/*Motion.tsx`, run through `useSectionMotion` (lazy GSAP, scoped context, reverted on route change). Gate any new animation on `useQuality() !== 'static'` and animate *from* the static layout.

### Quality tiers (`src/lib/quality.ts`)

`useQuality()` returns `'high' | 'low' | 'static'` (the server and hydration always see `static`).

| Tier | When | What runs |
| --- | --- | --- |
| `static` | `prefers-reduced-motion`, Save-Data, a 2G/slow-2G connection, or no WebGL | no canvas, no Lenis, native scroll, no scroll animation |
| `low` | touch-only pointer, viewport under 768 px wide or under 600 px on its short side, ≤ 2 GB memory or ≤ 2 cores, ≤ 4 GB **and** ≤ 4 cores, a GPU on the weak list, or a software renderer | motion, smooth scroll, cheaper scene |
| `high` | everything else (a 4-core laptop with a real GPU and a mouse) | everything |

Separately, `sceneEnabled()` / `useSceneEnabled()` is **false when WebGL only runs on a software rasterizer** (SwiftShader, llvmpipe, Microsoft Basic Render Driver, or a "major performance caveat"): such a device keeps motion (`low`) but never downloads the scene. The WebGL probe runs at the first idle moment after hydration; until then the scene stays off and the probe may lower the tier.

### Debug switches (query string on the first URL of a visit)

| Switch | Effect |
| --- | --- |
| `?quality=high`, `?quality=low`, `?quality=static` | force the tier; `high`/`low` also force the scene on, even on software WebGL |
| `?perf` | exposes `window.__fpPerf` (`gsap`, `ScrollTrigger`, `lenis`, `refreshes` count) for performance and leak audits |
| `?perf=off` | turns off the scene's automatic quality step-down (also exposes `__fpPerf`) |
| `?post=0` | scene without post-processing |
| `?scene-debug=1` | writes per-frame camera/quality state to `window.__scene`; enables the `envrot` and `keymul` lighting parameters |

Build and environment switches: `ANALYZE=1 npm run build` emits browser source maps so first-load chunks can be attributed per module. `CSP_FRAME_SRC` (space-separated origins) adds extra allowed frame origins for a ticket checkout embed that nests a second frame; the embed URL's own origin is read from `content/tickets.yaml` at build time. See `next.config.ts` for the full Content-Security-Policy and headers.

### Performance budget

- Initial JavaScript on `/`: **≈148 KB gzip** actually downloaded. The framework floor (Next.js + React runtime) is ≈138–140 KB, so the site's own code adds about 10 KB.
- The 3D chunk (three.js, @react-three/fiber and the scene) is **≈260 KB gzip, lazy**: requested only after `load` + idle, only on `/`, only when the scene is enabled.
- GSAP, Lenis and the motion engine load on demand and never in static mode. The stylesheet is inlined into the HTML (`experimental.inlineCss`). Fonts are self-hosted; there is no analytics and no third-party request on public pages.
- To check: `ANALYZE=1 npm run build`, then load the production build with DevTools' network panel (JS filter, "transferred" column).

## Testing

`tests/e2e` holds a Playwright suite (Chromium) that runs against a production build (`npm run build && npm run start` on port 3100, configured in `playwright.config.ts`). It covers: every public route (status 200, exactly one `h1`, a title and description, no console errors or failed requests), the no-JavaScript home page (full event name, date, venue, Tickets link, the TEDx license sentence), no sponsor logos on the home page, anchors that resolve, the mobile menu (focus trap, Escape), reduced motion, the `?quality=` overrides (the canvas mounts with `?quality=low`), scroll restoration across a page transition, the FAQ by keyboard, horizontal overflow at 320/390/768/1440 px, robots.txt, the sitemap, noindex on unannounced speakers, the admin being switched off (404 on `/keystatic` and the Keystatic API, since the suite's build has no GitHub variables), the "Watch live" livestream link (`livestream.spec.ts` renders the component with a sample URL, so no livestream URL is ever committed for testing, and checks the built home page against `content/contact.yaml`), and axe-core accessibility checks on `/`, `/partners` and a speaker page. Record a known bug as a `test.fixme` that describes the correct behaviour, and remove the marker with the fix.

```bash
npm run test:e2e                                         # builds, serves, tests
PW_SKIP_BUILD=1 npm run test:e2e                         # reuse the existing .next build
PW_CHROMIUM_PATH=/path/to/chromium npm run test:e2e      # use a Chromium already on disk
npx playwright install chromium                          # or download the matching browser once
npm run test:e2e:report                                  # open the last HTML report
```

The working admin is not covered by the suite (it would need a second, `next dev` server). Check it by hand after touching `keystatic.config.ts`, `src/lib/admin.ts` or `src/app/keystatic`: run `npm run dev`, open `http://localhost:3000/keystatic`, and check that the sidebar lists **Event basics** and that an entry opens.

CI (`.github/workflows/ci.yml`) runs lint, typecheck and build in one job, and the e2e suite in a second job (`npx playwright install --with-deps chromium`); the HTML report is uploaded as an artifact when it fails.

## Deployment

Vercel builds the production branch (the repo's default branch; rename it to `main` before importing, see the guide) on every push (including every save in the admin in GitHub mode); pull requests and other branches get preview URLs. Step-by-step setup, the domain, the Keystatic GitHub App and rollback are in [docs/DEPLOY.md](docs/DEPLOY.md).

## Brand rules baked in

- Always write **TEDxSantaClaraUniversity** in full.
- The logo (`public/brand/logo-on-black.png`, `logo-on-white.png`) only sits on solid black (header, footer, OG image) with clear space. Never place it over the canvas, recolour, distort or combine it with other marks.
- The footer carries the required line: "This independent TEDx event is operated under license from TED."
- Sponsor logos appear only on `/partners`, capped at 32 px tall (smaller than the event logo).
- Accent red `#EB0028` (editable in Event basics), used sparingly.
