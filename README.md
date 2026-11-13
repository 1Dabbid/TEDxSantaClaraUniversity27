# TEDxSantaClaraUniversity · Fine Print

Event site for **TEDxSantaClaraUniversity**, theme **Fine Print**, on Friday, April 23, 2027 at the Locatelli Student Activity Center, Santa Clara University. Deploys to `fineprint.tedxscu.com`.

Stack: Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4 · three / @react-three/fiber / drei · GSAP (ScrollTrigger, SplitText) + Lenis · Keystatic CMS. Node 22, npm.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build (all public pages are statically generated)
npm run start      # serve the production build
npm run lint       # ESLint (flat config, next/core-web-vitals + typescript)
npm run typecheck  # next typegen && tsc --noEmit
```

## Editing content (Keystatic)

Open **`/keystatic`** while running `npm run dev`. Every edit is written as a file under `/content` (YAML) or `public/images/*` (uploads), so content is versioned in git along with the code.

| Where in Keystatic | File(s) | Notes |
| --- | --- | --- |
| Event settings | `content/settings.yaml` | Date, venue, ticket state (`coming-soon`, `on-sale`, `sold-out`, `closed`), ticket URL / embed, speaker application state, newsletter link, emails, socials, accent colour |
| Schedule | `content/schedule.yaml` | Shows “coming soon” until **Published** is ticked |
| FAQ | `content/faq.yaml` | |
| Speakers | `content/speakers/*.yaml` | A speaker with **Announced** unticked shows as a “Speaker to be announced” card (name, photo and bio hidden, page is `noindex`). To reveal one: fill in the details, set the slug, tick Announced |
| Team | `content/team/*.yaml` | Names appear only when **Show name publicly** is ticked |
| Partner tiers | `content/tiers/*.yaml` | Amounts stay blank (shown as “On request”) while packages are in draft |
| Sponsors | `content/sponsors/*.yaml` | Shown on `/partners` only, never on the home page |

Pages read content only through `src/lib/content.ts` (the Keystatic reader API, at build time). Components never import Keystatic directly.

**Placeholders to confirm before launch:** `contactEmail`, `partnershipsEmail`, `newsletterUrl` (SendFox form) and socials are blank, so their links are hidden. The partner CTA falls back to tedxscu.com until `partnershipsEmail` is set. The venue street address (500 El Camino Real) also appears in the JSON-LD in `src/lib/jsonld.ts`.

## Architecture: the scene and scroll contracts

```
src/
  app/                    routes: /, /speakers/[slug], /partners, /keystatic, api/keystatic, sitemap, robots, OG image
  components/sections/    Hero, Theme, Speakers, Schedule, Venue, Tickets, Team, Faq, Newsletter
  components/ui/          Button, SectionLabel, ComingSoon, VisuallyHidden, FootnoteMark
  components/             Header, Footer, MobileMenu, Logo
  lib/content.ts          typed content loader
  lib/quality.ts          quality tier store + useQuality()
  motion/                 SmoothScroll (Lenis + ScrollTrigger), gsap.ts (plugin registration), lenisRef
  scene/                  scrollState, SceneLoader, SceneCanvas, Experience (placeholder)
```

### `src/scene/scrollState.ts`
A plain mutable singleton. Read it freely in `useFrame` or GSAP callbacks; it never triggers React renders.

- `progress`: whole page, 0 to 1.
- `sections[id]`: one value per entry in `SECTION_IDS` (`hero, theme, speakers, schedule, venue, tickets, team, faq, newsletter`). 0 when the section top reaches the viewport bottom, 1 when its bottom reaches the viewport top. Sections not on the current route stay 0.
- `pointer.{x,y}`: -1 to 1, y up (three.js NDC convention). Mouse/pen only.
- `velocity`: signed px per frame (Lenis velocity), positive when scrolling down.

`src/motion/SmoothScroll.tsx` is the only writer. Section elements are found by `[data-section="<id>"]` and measured on mount, route change, resize and document size changes (not every frame).

### `src/lib/quality.ts`
`Quality = 'high' | 'low' | 'static'`, read with `useQuality()`.
- `static`: prefers-reduced-motion, Save-Data, or no WebGL. No canvas, no Lenis, native scroll. The server always renders `static`, so the HTML *is* the reduced-motion design.
- `low`: coarse pointer, viewport under 768px wide (or under 600px on the short side), `deviceMemory <= 4` or `hardwareConcurrency <= 4`.
- `high`: everything else.

### Canvas
`SceneLoader` (in the root layout) mounts `SceneCanvas` via `next/dynamic({ ssr: false })` only when quality is not `static`, after `load` + `requestIdleCallback`. three.js is therefore never in the initial bundle. `SceneCanvas` is fixed, full viewport, `aria-hidden`, `pointer-events: none`, at `z-index: var(--z-canvas)` (0). Page content sits at `var(--z-content)` (10) and the header at `var(--z-header)` (50). DPR is `[1,2]` on high and `[1,1.5]` on low. `Experience.tsx` is a placeholder: replace it, keeping the default export and the `quality` prop.

Readability never depends on the canvas: each section has its own gradient scrim (`scrim-y`, `scrim-left`, `scrim-solid` in `globals.css`).

### Motion
- Always import GSAP from `@/motion/gsap` (registers ScrollTrigger and SplitText once). `@gsap/react` (`useGSAP`) is installed.
- `SmoothScroll` dynamically imports gsap and Lenis, so they load only when motion is on. Lenis runs on the GSAP ticker and calls `ScrollTrigger.update` on scroll.
- `lenisRef.current` gives programmatic scrolling (null in `static` mode).
- Gate every animation on `useQuality() !== 'static'`. Animate from the static layout (e.g. `gsap.from`) so the no-JS and reduced-motion look stays correct.
- `[data-magnetic]` on buttons is a hook for a magnetic hover effect. It does nothing yet.
- The Theme section is 250vh tall on md+ with a sticky inner panel: the runway for the macro push-in.

## Brand rules baked in
- Always write **TEDxSantaClaraUniversity** in full.
- The logo (`public/brand/logo-on-black.png`, `logo-on-white.png`) only sits on solid black (header, footer, OG image) with clear space. Never place it over the canvas, recolour, distort it or combine it with other marks. The favicon is a plain black square on purpose.
- The footer includes the required line: “This independent TEDx event is operated under license from TED.”
- Sponsor logos appear only on `/partners` and are capped at 32px tall, smaller than the header logo.
- Accent red `#EB0028` (overridable in settings) is used sparingly.

## Deploying on Vercel
1. Import the repo. Framework: Next.js. Node 22. No build settings to change.
2. Point `fineprint.tedxscu.com` at the project.
3. **Keystatic GitHub mode** (so editors can use `/keystatic` on the live site): create a Keystatic GitHub App for `1Dabbid/TEDxSantaClaraUniversity27` (open `/keystatic` locally once in GitHub mode and follow the setup flow, or see the Keystatic docs), then set these environment variables on Vercel:
   - `KEYSTATIC_GITHUB_CLIENT_ID`
   - `KEYSTATIC_GITHUB_CLIENT_SECRET`
   - `KEYSTATIC_SECRET`
   - `NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG`

   When `NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG` is set, `keystatic.config.ts` switches storage from `local` to `github`. Each save commits to the repo, and Vercel rebuilds the static site. Without these variables, `/keystatic` only works in local dev. See `.env.example`, and never commit real values.
4. `robots.txt` disallows `/keystatic` and `/api/`.

The public site makes no runtime requests to third parties: fonts are self-hosted and there is no analytics. The Keystatic admin UI loads its own fonts from Google Fonts, which affects editors only.
