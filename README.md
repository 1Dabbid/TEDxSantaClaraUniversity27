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

## Editing content (a guide for non-coders)

You never need to touch code to change what the site says. All words, dates, links and photos live in an admin screen called **Keystatic**.

### Opening the editor
- **On the live site** (once the GitHub app is set up, see “Deploying” below): go to `https://fineprint.tedxscu.com/keystatic`, sign in with GitHub, edit, press **Save**. The site rebuilds itself within a few minutes.
- **On your own computer**: run `npm install` once, then `npm run dev`, and open `http://localhost:3000/keystatic`.

Every save writes a small text file in the `content/` folder (or a photo in `public/images/...`), so there is always a history of who changed what, and anything can be undone.

### What is where
The left-hand menu is grouped the same way the site is.

**The event**
| Menu item | What it controls |
| --- | --- |
| Event basics | Event name (always the full TEDxSantaClaraUniversity), theme name, tagline, theme story, date, doors and end time, accent colour. Leave times blank until confirmed: the site shows “To be announced”. |
| Venue & directions | Building name, campus, the address (with a short label saying what it is, currently “University main address”), the map link, optional coordinates for the design, and the **Getting there** notes (Directions, Parking, Accessibility). A note with empty details shows “To be announced”. This is the only place the address is stored: search engines read it from here too. |
| Tickets & speaker applications | The ticket status switch (**Coming soon / On sale / Sold out / Closed**), the ticket link, an optional checkout embed link, the price note, and the speaker-application status, link and deadline. Changing the status updates every Tickets button on the site. |
| Schedule | The running order. Hidden (“schedule coming soon”) until **Show the running order** is ticked. |
| FAQ | Questions and answers. Drag to reorder; they are numbered automatically. |

**People**
| Menu item | What it controls |
| --- | --- |
| Speakers | One entry per speaker slot. While **Announced** is unticked the slot shows as “To be announced” everywhere, with a redacted page that search engines ignore. To announce someone: fill in name, role, talk title, bios, portrait (4:5, at least 1200×1500 px) and optional link, set the page address (slug) once, then tick **Announced**. |
| Team | The nine board roles. A name (and photo) only appears when **Show name publicly** is ticked and a name is filled in. Ask the person first. |

**Partners**
| Menu item | What it controls |
| --- | --- |
| Partner tiers | Tier names and descriptions on `/partners`. Contribution and number of slots stay hidden while blank. |
| Partner benefits | Rows of the benefits comparison table. Tick which tiers include each benefit. While empty, the page says the schedule of benefits is being finalized. Only list benefits TEDx rules allow (no stage time, no say over the programme). |
| Partners (logos) | Signed partners. Shown on `/partners` only (never on the home page), always smaller than the event logo. Only tick **Published** once the partnership is signed and the logo approved. Upload a white or light logo on a transparent background. |

**Contact & site**
| Menu item | What it controls |
| --- | --- |
| Contact, newsletter & socials | The SendFox newsletter link, the general contact email, the partnerships email (used by every “Become a partner” button; falls back to tedxscu.com when blank) and social links. Blank links are simply hidden. |
| Show / hide sections | Switch the Team section, FAQ section and the speaker-applications band on or off. If you hide Team or FAQ, also tell the web team so the menu link can be removed. |

### Rules of thumb
- Always write the name in full: **TEDxSantaClaraUniversity**.
- If something is not confirmed, leave it blank. The site is designed to show a tidy “To be announced” instead. Never put guesses on the site.
- Tickets may not cost more than $100 (TEDx rule).
- Sponsor logos never go on the home page, and partners never speak from the stage.

### For developers
Pages read content only through `src/lib/content.ts` (the Keystatic reader API, at build time); components never import Keystatic directly. In the admin, settings are split across the *Event basics*, *Venue*, *Tickets*, *Contact* and *Sections* singletons; `getSettings()` merges them into the single `Settings` object components receive. The content model lives in `keystatic.config.ts`.

## Architecture: the scene and scroll contracts

```
src/
  app/                    routes: /, /speakers/[slug], /partners, /keystatic, api/keystatic, sitemap, robots, OG image
  components/sections/    Hero, Theme, Speakers, Schedule, Venue, Tickets, Team, Faq, Newsletter
  components/ui/          Button, SectionLabel, ComingSoon, VisuallyHidden, FootnoteMark
  components/             Header, Footer, MobileMenu, Logo
  components/print/       fine-print primitives: clause numbers, TBA marker, redaction bars, status register, JSON-LD
  lib/content.ts          typed content loader
  lib/jsonld.ts           Event, FAQPage and speaker Person/Event JSON-LD
  lib/links.ts            partner CTA, coordinate and clause formatting
  lib/quality.ts          quality tier store + useQuality()
  motion/                 MotionRoot, SmoothScroll (Lenis + ScrollTrigger), SceneGate, gsap.ts, lenisRef
  motion/engine/          reveal, cursor, magnetic, navigation, chrome, focus (the global motion engine)
  motion/sections/        Hero, Theme, Schedule, Venue, Tickets, Team, Faq, Newsletter, Footer, Partners
                          moments (*Motion.tsx) and kit.ts (shared masks, fold checks)
  scene/                  scrollState, SceneLoader, SceneCanvas, Experience
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
`SceneGate` (in the root layout) decides whether the scene exists on the current route: it is mounted on `/`; on `/partners`, `/speakers/*` and the 404 page it is not mounted, unless the home page was already shown in this browsing session, in which case the live canvas is kept hidden and paused (R3F `frameloop: 'never'`) so returning home is instant. A cold load of a secondary page never downloads three.js. Inside the gate, `SceneLoader` mounts `SceneCanvas` via `next/dynamic({ ssr: false })` only when quality is not `static`, after `load` + `requestIdleCallback`. three.js is therefore never in the initial bundle. `SceneCanvas` is fixed, full viewport, `aria-hidden`, `pointer-events: none`, at `z-index: var(--z-canvas)` (0). Page content sits at `var(--z-content)` (10) and the header at `var(--z-header)` (50). DPR is `[1,2]` on high and `[1,1.5]` on low. `Experience.tsx` holds the scene; keep its default export and the `quality` prop.

Readability never depends on the canvas: each section has its own gradient scrim (`scrim-y`, `scrim-left`, `scrim-solid` in `globals.css`).

### Motion
- Always import GSAP from `@/motion/gsap` (registers ScrollTrigger and SplitText once). `@gsap/react` (`useGSAP`) is installed.
- `SmoothScroll` dynamically imports gsap and Lenis, so they load only when motion is on. Lenis runs on the GSAP ticker and calls `ScrollTrigger.update` on scroll. `lenisRef.current` gives programmatic scrolling (null in `static` mode).
- `html.motion` is set by an inline script before first paint (JS on, no reduced motion, no Save-Data) and removed again by `MotionRoot` if quality resolves to `static`. All pre-reveal CSS is scoped to it, so the server HTML is the complete, fully visible design.
- `MotionRoot` loads the engine (`src/motion/engine/index.ts`) on demand, never in the first-load bundle:
  - `reveal.ts`: the attribute API for entrance animations, scanned on every route.
    - `data-reveal="lines"` (SplitText lines, masked; `data-reveal-variant="shear"` for display headlines), `"chars"` (per character), `"fade"`, `"rule"` (a hairline drawn left to right), `"stagger"` (direct children one after another; add `data-reveal-variant="wipe"` for a clip-path wipe). `data-reveal-delay="0.2"` delays in seconds.
    - Nested reveals: the outermost owns the animation. Splits are reverted when done, and keyboard focus landing inside a pending reveal finishes it at once. A CSS failsafe shows everything after 3s if the engine never arrives.
  - `cursor.ts`: custom dot + ring for fine pointers. `data-cursor="link"` gives the link state to non-link elements (e.g. a whole row); `data-cursor="loupe"` (optionally `data-cursor-zoom="2.4"`) turns the cursor into a magnifying glass over fine print.
  - `magnetic.ts`: elements with `data-magnetic` lean toward the pointer (fine pointers only). `Button` opts in by default (`magnetic={false}` to opt out).
  - `navigation.ts`: smooth in-page anchors with header offset, a curtain transition between routes, focus moved to the target or `#main`.
  - `chrome.ts`: the header hides on scroll down and returns on scroll up or focus; the red hairline tracks reading progress.
  - `focus.ts`: keyboard focus cancels any Lenis glide in flight and nudges the focused element clear of the header.
- Plain CSS link style: `link-draw` draws a 1px underline from the left on hover/focus. Bare `<a>` inside running text (`p`, `li`, `dd`) gets a resting underline automatically.
- Gate any new animation on `useQuality() !== 'static'` and animate from the static layout (e.g. `gsap.from`) so the no-JS and reduced-motion look stays correct.
- Theme: on viewports at least 768px wide and 44rem tall it is a 250vh runway with a sticky stage (the phrase scrub in `ThemeMotion`); smaller or shorter viewports get a natural-height section with masked line reveals.
- Section moments: each lower section has one scroll-linked moment in `src/motion/sections/*Motion.tsx`, mounted inside its section and run through `useSectionMotion` (lazy gsap, scoped `gsap.context`, reverted on route change). Mouse/trackpad at 768px+ gets the scrubbed version (`FULL` in `kit.ts`); touch and small screens get a shorter one played once (`COMPACT`).
  - Venue: crop marks draw from their corners, the plate settles, the coordinates resolve digit by digit (odometer wheels); the reticle's bezel turns a few degrees with scroll.
  - Tickets: the seat ruler prints tick by tick (scrubbed) while "001 – 100" counts the seats on detented counter wheels; the status cross is stamped.
  - Team: signature lines draw in sequence (scrubbed) and the "00 of 09 signed" register ticks with them (visual copy; screen readers get the final count).
  - FAQ: pure CSS. `::details-content` + `interpolate-size` ease the height open and shut (instant where unsupported or with reduced motion); the plus turns into a minus. `FaqMotion` only refreshes triggers after a toggle.
  - Newsletter: the signature line inks across as it reaches mid-viewport; the headline scales up to full size as it enters.
  - Footer: the date's figures rise from masks, the red points are set last; a small parallax settles it on the last pixel of scroll.
  - /partners: the hero headline rises with a shear (`data-reveal-variant="shear"`), the tier ledger is ruled row by row, the address is set character by character.
  - Rules they share: nothing is hidden unless it is still below the fold at setup (a deep link or reload mid-section just shows the static design); splits are visual `aria-hidden` copies with an sr-only twin, removed when the moment ends; masks clip with `clip-path` on glyph-sized inline-blocks, so baselines and widths never move; keyboard focus inside a pending moment finishes it.

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

The public site makes no runtime requests to third parties: fonts are self-hosted and there is no analytics. The OG image is rendered at build time in Inter from OTF copies in `src/app/_og/` (the renderer cannot read woff2; SIL OFL, license alongside). The Keystatic admin UI loads its own fonts from Google Fonts, which affects editors only.
