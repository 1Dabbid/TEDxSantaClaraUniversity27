# Re-theming the site for next year

This site was built for one event: **Fine Print**, April 23, 2027. Most of it is reusable as is; the theme lives in a known set of places. This guide lists them so next year's board can give the site a new theme without hunting.

Rule of thumb: **facts** (names, dates, places, links) are content and change in the admin; **the "legal document" voice** (clauses, §-numbers, redactions, signatures, "fine print" puns) is design and lives in code.

## 1. Archive this year first

Do this before changing anything, so the 2027 site stays online as a record.

1. **Tag the final state** in GitHub: repo > **Releases > Draft a new release** > tag `fine-print-2027` on `main` > Publish. That freezes the exact code and content.
2. **Keep the old site on its subdomain.** Easiest: leave this Vercel project and `fineprint.tedxscu.com` exactly as they are (check that the Vercel plan it sits on stays active), and turn off the online admin there by removing the four Keystatic variables in Vercel and redeploying, so nobody edits the archive by accident.
3. **New event, new home.** Either create a new repository from this one (mark this repo as a template under **Settings > General > Template repository**, then **Use this template**; or import/duplicate it) and a new Vercel project with a new subdomain (e.g. `<newtheme>.tedxscu.com`), or keep this repo and point the new subdomain at it after the archive tag. A new repo per year keeps each year's history clean and is recommended.
4. **Talk videos.** After the event, TEDx talks are published on the TEDx YouTube channel. A good archive improvement is a "Talks" section on the old site: a `talkVideoUrl` field on each speaker in `keystatic.config.ts` (and `src/lib/content.ts`), shown as a "Watch the talk" link on `/speakers/<slug>` and on the speaker cards. Link to YouTube rather than embedding (the site's Content-Security-Policy blocks third-party frames, see `next.config.ts`).
5. Switch the archive's **Ticket status** to **Closed** and add a short "Thank you" line to the tagline so visitors know the event happened.

## 2. Content to change in the admin (`/keystatic`)

| Where in the admin | Field | Notes |
| --- | --- | --- |
| Event basics | **Theme name** | the big home-page title, page titles, share image |
| Event basics | **Theme tagline** | under the title; also the search-result and link-preview description |
| Event basics | **Theme story** | the theme section's paragraphs |
| Event basics | **Event date**, **Doors open at**, **Event ends at** | the date drives every written-out date, the footer's big `MM.DD.YY` and the hero caption ("2027 theme") |
| Event basics | **Seat capacity** | the one seat count used by the hero, Venue, the Tickets ruler and counter, `/partners`, the share image, the meta description, JSON-LD and FAQ answers (`{capacity}`). TEDx caps a standard licence at 100, the field's maximum (`TEDX_MAX_CAPACITY` in `src/lib/site.ts`) |
| Event basics | **Accent colour** | keep TEDx red `#EB0028` unless there is a reason |
| Venue & directions | all | if the venue changes |
| Tickets & speaker applications | all | reset to **Coming soon** |
| Contact, newsletter & socials | **Livestream link (optional)** | empty it after the event (the "Watch live" links in the hero and Tickets disappear); fill it in only if next year's event is streamed |
| Speakers | each entry | reset to unticked **Announced**, empty fields, slugs back to `speaker-01`… |
| Schedule | **Show the running order** | untick; clear the items |
| Team | names | new board; untick **Show name publicly** until people agree |
| Partner tiers | **Tier name** | this year's names are theme puns: "Fine Print Supporter", "Bold Print Partner" (`content/tiers/*.yaml`) |
| Partners (logos) | each | untick **Published** or delete; partnerships are per event |
| FAQ | questions | review every answer (dates, venue, ticket price) |

## 3. Theme-specific code (search list)

Search the codebase for `Fine Print`, `fine print`, `2027`, `04.23`, `Locatelli`, `§`, `clause`, `redact`, `signed`, `agreement`, `first mainstage` to find these. File by file:

| File | What is theme-specific |
| --- | --- |
| `src/scene/engraving.ts` | the text etched on the 3D microphone: `THEME = 'FINE PRINT'`, `DATE_LINE = 'FRIDAY · APRIL 23 · 2027'`, `VENUE_LINE = 'LOCATELLI STUDENT ACTIVITY CENTER'`, `SEATS_LINE`, and the nine legal-style `CLAUSES`. Hard-coded, not read from content: **must** be edited by hand. |
| `src/scene/choreography.ts`, `src/scene/*.tsx` | the scene itself (a microphone on a red rug, 100 seats). Theme-neutral for a TEDx talk, but the camera shots are tuned to this page's sections. After any change here, regenerate the still frames shown to visitors without the live scene: `npm run build && npm run stills`, then commit `public/stills/` (see the README, "Still frames"). |
| `src/lib/site.ts` | `SITE_URL` (`https://fineprint.tedxscu.com`), the canonical domain. The share-image alt text is built from content by `ogAlt()` (event name, theme name, long date, venue and campus), so it needs no edit. |
| `src/app/opengraph-image.tsx` | the share image: the theme name, tagline, date and venue come from content, but the seat count is the **Seat capacity** field; the layout copy "§ 01 · The theme" and "fineprint.tedxscu.com" are hard-coded. |
| `src/components/sections/Hero.tsx` | the footnote marker and note "1. Terms and conditions apply. They are the whole point."; "Scroll to read the fine print". (Venue campus and seat count come from content.) |
| `src/components/sections/Theme.tsx` | "Read the fine print."; the caption "Fig. 1 The fine print, engraved. Read it closely."; § 1.x clause numbering of the story. |
| `src/components/sections/Speakers.tsx` | the redacted-dossier voice: `STATUS` ("Clause pending", "Withheld", "Redacted"…), the six `FOOTNOTES` jokes, "§ 2.x" clause numbers, "Names withheld until the…" |
| `src/app/speakers/[slug]/page.tsx` | unannounced page: "Dossier", "Withheld", redaction bars, "Redacted pursuant to § 2 (Speakers)…" |
| `src/components/sections/Schedule.tsx`, `Venue.tsx`, `Tickets.tsx`, `Faq.tsx` | clause numbers (§ 3.x, 4.x, 5.x, 7.xx), "TBC" redaction rows. Seat counts and the Tickets ruler follow **Seat capacity**. |
| `src/components/sections/Team.tsx` | the signature-page voice: "The undersigned.", "…and to read every clause.", "For TEDxSantaClaraUniversity", "Unsigned · name to follow", "NN of NN signed". |
| `src/components/sections/Newsletter.tsx` | "Don't miss the fine print." |
| `src/components/Footer.tsx` | "End of document / Signed and dated", "§ A–§ D" headings; the giant date (`04.23.27`) is computed from the event date. Keep the license line and the "What is TEDx?" text. |
| `src/app/not-found.tsx` | "Error 404 · Clause not found", "Void where prohibited", "This clause does not exist.", "Nothing in the agreement was lost." |
| `src/app/error.tsx`, `src/app/global-error.tsx` | "Error · Clause unreadable" on the error pages (`global-error.tsx` is self-contained with inline styles because it replaces the whole document). |
| `src/app/partners/page.tsx` | the description in `generateMetadata` and copy saying this is "the first mainstage" (true only in 2027), "Put your name in the fine print.", "Party of the first part", "The facts on which this agreement rests.", "The first signature is still open", "Signed so far.", ledger/clause numbering. |
| `src/motion/MotionRoot.tsx` | the page-transition caption "§ continuing…". |
| `src/motion/sections/TeamMotion.tsx`, `ThemeMotion.tsx` | animated "NN of NN signed" counter; theme clause counter "1.x(a)". |
| `src/components/print/Print.tsx`, `src/components/ui/SectionLabel.tsx`, `src/lib/links.ts` (`clause()`) | the reusable "fine print" primitives: clause numbers, TBA marker, redaction bars, crop marks. Keep them if the new design reuses them; otherwise stop using them. |
| `src/app/layout.tsx` | the default meta description template "… presents <theme>: <tagline> <date>, <venue>, <campus>. Limited to <capacity> seats." (all values from content; only the wording is code). |
| `src/lib/content.ts` | fallbacks used only when content is missing: date `2027-04-23`, venue "Locatelli Student Activity Center". |
| `keystatic.config.ts` | defaults and examples shown to editors: `themeName` default "Fine Print", `dateISO` default `2027-04-23`, FAQ description "§ 7.01, § 7.02", the GitHub repo name. |
| `src/app/globals.css` | the look (black, red, Inter, hairlines). `.fine-print` is a utility class name for small uppercase labels; it is not visible text and can stay. |
| `package.json` (`name`), `README.md`, `docs/*` | names and dates of this edition. |

The seat count is a TEDx licence detail rather than a theme. On the pages it comes from one place, **Event basics > Seat capacity** (default and maximum 100; see `docs/EDITING.md`). Two places do **not** follow the field and stay at 100 on purpose: the 3D scene (`src/scene/Seats.tsx` builds exactly 100 seats, and the camera shots in `choreography.ts` are framed around that room) and the microphone engraving (`SEATS_LINE` in `src/scene/engraving.ts`). Both are decoration; edit them by hand only if the room should visibly change.

## 4. What is theme-agnostic (keep as is)

- The content model and admin (`keystatic.config.ts`, `src/lib/content.ts`), ticket states, speaker announce/redact logic, noindex for unannounced speakers, sitemap and robots.
- Accessibility work: skip link, focus management, mobile menu focus trap, reduced-motion design, native `<details>` FAQ, contrast scrims.
- The quality tiers (`src/lib/quality.ts`), lazy loading of the motion engine and 3D scene, performance budget, inline CSS, security headers and CSP (`next.config.ts`).
- The motion engine (`src/motion/engine/*`): reveals, page transitions, scroll restoration, header behaviour, cursor. Section moments in `src/motion/sections/*` are tied to the current layouts.
- TEDx compliance: full event name, logo placement on solid black, license line, sponsor logos only on `/partners`, $100 ticket cap note.
- The test suite (`tests/e2e`) and CI. Update the strings it checks (`tests/e2e/home-html.spec.ts`: date and venue) when the facts change.

## 5. Suggested order

1. Archive (section 1).
2. New repo + Vercel project + subdomain (see `docs/DEPLOY.md`); set up the Keystatic GitHub App for the new repo (the repo name is in `keystatic.config.ts`).
3. Change content in the admin (section 2).
4. Rewrite the theme copy in code (section 3), starting with `engraving.ts`, `site.ts` (`SITE_URL`), Hero, Theme and the share image.
5. Run `npm run lint`, `npm run typecheck`, `npm run test:e2e`; then the post-deploy checklist in `docs/DEPLOY.md`.
