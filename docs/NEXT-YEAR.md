# Re-theming the site for next year

This site was built for **Fine Print**, Friday, April 23, 2027. Next year's board can give it a new theme, date and venue almost entirely in the admin (`/keystatic`). This is a checklist: do the steps in order and tick them off. Steps 1 to 3 need no code. Step 4 is a short list of files that still hold this year's theme. Steps 5 to 7 regenerate images and check the result.

Rule of thumb: **facts and theme wording** (theme name, tagline, story, headings, footnotes, dates, venue, seat count, tier names) are content and change in the admin. **The look** (black and red, the "legal document" design system: § clause numbers, mono captions, redaction bars, crop marks) is code and can stay as it is for any theme.

Never change, whatever the theme (TEDx rules; the tests check the first one):

- The event name is always **TEDxSantaClaraUniversity**, in full, in exactly that case. It is fixed in code (`SITE_NAME` in `src/lib/site.ts`), not an admin field, and only changes with a new licence from TED.
- The TEDx logo (`public/brand/`) only sits on solid black (header and footer), unaltered: never recoloured, stretched, re-drawn, placed over the 3D scene or photos, or combined with a theme logo. The share image deliberately carries no logo.
- The footer line "This independent TEDx event is operated under license from TED." and the About TEDx / About TED texts stay.
- Sponsor logos only on `/partners`, smaller than the event logo. Seat capacity at most 100. Ticket price at most $100.

## 1. Archive this year (before changing anything)

- [ ] **Tag the final state** in GitHub: repo > **Releases > Draft a new release** > tag `fine-print-2027` on `main` > Publish.
- [ ] **Leave the old site where it is**: keep this Vercel project and `fineprint.tedxscu.com` untouched (check that the Vercel plan stays active), and turn off its online admin by removing the four Keystatic variables in Vercel and redeploying, so nobody edits the archive by accident.
- [ ] On the archive: **Tickets & speaker applications > Ticket status** to **Closed**, **Contact > Livestream link** emptied. See "Archive mode" at the end for what a finished event page should become.
- [ ] **New home for the new event** (recommended: a new repository per year). Mark this repo as a template (**Settings > General > Template repository**), then **Use this template**; create a new Vercel project from it and a new subdomain (e.g. `seconddraft.tedxscu.com`), following `docs/DEPLOY.md`.
- [ ] In the new Vercel project, set the environment variable **`SITE_URL`** = `https://<new-subdomain>.tedxscu.com` (Production) and redeploy. This is the address used in canonical links, share previews, `robots.txt`, the sitemap and structured data; without it the site still claims `fineprint.tedxscu.com` (the default in `src/lib/site.ts`). See `docs/DEPLOY.md`, "The canonical URL".
- [ ] Set up the Keystatic GitHub App for the new repo (`docs/DEPLOY.md`, section d). The admin's GitHub repo name is in `keystatic.config.ts` (`storage.repo`): change `owner`/`name` there if the new repo has a different name. This is the one code change step 1 needs.

## 2. Content: the facts (admin, no code)

All of these are in the admin; each field explains itself. See `docs/EDITING.md` for details.

| Where in the admin | What to change |
| --- | --- |
| **Event basics** | **Theme name**, **Theme tagline**, **Theme story**, **Event date**, **Doors open at** / **Talks start at** / **Event ends at** (blank until confirmed), **Seat capacity** (1 to 100). The date drives every written-out date, the header and footer dates, the hero caption ("2028 theme") and the share image. |
| **Venue & directions** | **Venue (building) name**, **Campus**, address, **Map link**, coordinates, **Getting there** notes. |
| **Tickets & speaker applications** | Reset both to **Coming soon**; clear the links, price, sale date and deadline. |
| **Contact, newsletter & socials** | Check the emails and links; empty **Livestream link** unless the new event is streamed. |
| **Speakers** | Untick **Announced** on every slot, empty the fields, slugs back to `speaker-01`… |
| **Schedule** | Untick **Show the running order**; clear the items. |
| **Team** | The new board; untick **Show name publicly** until each person agrees. Replace or clear **Major**, **Class year**, **LinkedIn profile** and **Photo** for every role, and delete last year's photo files in `public/images/team/<slug>/` (entries are per role, so a photo left there would appear next to the new person's name). |
| **Partner tiers** | **Tier name** and **Description**: 2027's are theme puns ("Fine Print Supporter", "Bold Print Partner"). The slug (the file name, e.g. `fine-print-supporter`) is never shown to visitors, so it can stay; delete and re-create a tier only if you want it renamed too, then fix the tiers chosen under **Partner benefits** and **Partners**. |
| **Partners (logos)** | Untick **Published** or delete: partnerships are per event. |
| **FAQ** | Read every answer. Use `{date}`, `{venue}`, `{campus}`, `{capacity}`, `{eventName}` instead of typing those facts. 2027's "Who organizes it?" answer says this is "the first {eventName} since 2020": change it (the event is no longer a return). |

## 3. Content: the theme wording (admin, no code)

**The event > Theme copy (headings and short lines)** holds every theme-specific line that sits in the page layout. Rewrite each for the new theme (or leave a field blank to keep 2027's wording; a blank hero caption, theme footnote or Partners first-card title hides it):

- Home: caption under the hero, scroll hint, theme section heading, caption of the engraved microphone, footnote under the theme story, closing mailing-list heading, partner invitation heading and text.
- Speakers heading and Schedule lines shown while nothing is announced.
- Partners page: heading, introduction, search description, first card ("2020 / The first since 2020." in 2027, about the club's return: rewrite it, it will not be true again). The theme footnote also mentions the return ("Returning to campus for the first time since 2020"), and so does the partner invitation text.
- 404 page heading and text, footer sign-off ("End of document / Signed and dated"), page-change caption ("§ continuing…").

The share image, page titles, search descriptions, structured data (JSON-LD), sitemap, the share image's alt text and the home-screen manifest are all built from Event basics, Venue and Theme copy: nothing else to edit for them.

## 4. Code: what still holds the 2027 theme

Only these files. Each is optional except the first.

| File | What | Who |
| --- | --- | --- |
| `src/scene/engraving.ts` | The text etched on the 3D microphone: `THEME`, `DATE_LINE`, `VENUE_LINE`, `SEATS_LINE` (write them in capitals like the existing ones, e.g. `'SATURDAY · APRIL 15 · 2028'`), and the legal-voice `CLAUSES` and `FILLER` lines (rewrite them only if the new theme drops the "fine print" idea). Visible in the live 3D scene and in the still frames. Until the scene reads these from content (planned: see `engravingLines()` in `src/lib/site.ts`), edit them by hand, then do step 5. | anyone (one file, four strings) |
| `src/app/icon.svg` | The site icon: a white "§" on black, the 2027 design motif. Keep it, or replace it with another outlined glyph (no TEDx logo or imitation of it), then do step 6. | designer |
| `src/app/(site)/error.tsx`, `src/app/global-error.tsx` | "Error · Clause unreadable" on the rare crash pages (kept in code so they work even when content cannot load). | optional |
| `src/lib/theme-copy.ts` | 2027's Theme copy wording, used only for a Theme copy field left blank. Optional: replace with the new wording so a blank field falls back to this year's lines. | optional |
| `src/lib/site.ts` | `DEFAULT_SITE_URL` (`https://fineprint.tedxscu.com`), used only when the `SITE_URL` variable is not set (step 1). | optional |
| `src/lib/content.ts`, `keystatic.config.ts` | Fallbacks only, never seen while content is valid: `DEFAULT_DATE = '2027-04-23'` and the venue fallback in `content.ts`; the default **Theme name**, date and venue and the "e.g." examples in admin descriptions in `keystatic.config.ts`. | optional tidy-up |
| `package.json` (`name: tedx-santa-clara-university-27`, also at the top of `package-lock.json`), `README.md`, `docs/*` | This edition's name and dates. The package name has no effect on the site; rename it (`-28`) with `npm pkg set name=…` then `npm install` so the lock file follows, or leave it. | optional |

What is **not** theme-specific and stays: the § clause numbers, mono captions and redaction bars (`src/components/print/Print.tsx`, `SectionLabel`, `clause()` in `src/lib/links.ts`), the `.fine-print` CSS class (a utility name for small uppercase labels, not visible text), the 3D scene itself (a microphone on a red rug in a room of 100 seats: `src/scene/Seats.tsx` always builds 100 seats, decoration that does not follow **Seat capacity**), the motion engine, accessibility work, quality tiers and the TEDx compliance rules above.

## 5. Regenerate the still frames (after changing `src/scene/**`)

Visitors without the live 3D scene see still frames from `public/stills/`; the hero and theme frames show the engraving, so after step 4's engraving edit they still show 2027's text until regenerated. It takes about 5 minutes per shot on a machine without a GPU (about 15 to 25 minutes for all five).

```bash
npm run build
PW_CHROMIUM_PATH=/path/to/chromium npm run stills          # all shots; or STILLS_ONLY=hero,theme npm run stills
git add public/stills && git commit -m "Regenerate still frames"
```

(`npx playwright install chromium` downloads a Chromium if you have none. Details: README, "Still frames".)

## 6. Regenerate the icons (only after changing `src/app/icon.svg`)

```bash
npm run icons        # writes src/app/favicon.ico, src/app/apple-icon.png, public/icons/icon-192.png and icon-512.png
git add src/app public/icons && git commit -m "Regenerate icons"
```

## 7. Check

- [ ] `npm run check:content` (every content warning; fix them in the admin).
- [ ] `npm run lint`, `npm run typecheck`, `npm run build`.
- [ ] `npm run test:e2e` (or `PW_CHROMIUM_PATH=… npm run test:e2e`). The tests read the theme name, date and venue from `content/`, so they need no edit for a new theme.
- [ ] Search for leftovers; every hit should be in the "optional" rows of step 4, in a code comment, or in a test fixture:
  `grep -rniE "fine print|fineprint|2027|04\.23|april 23|locatelli" src content public docs tests keystatic.config.ts package.json`
- [ ] Look at `/`, `/partners`, `/speakers`, a missing page (e.g. `/nope`) and `/opengraph-image` on a phone and a laptop.
- [ ] After deploying, the post-deploy checklist in `docs/DEPLOY.md`.

## Archive mode (design note, not built yet)

After the event, the site should become a record of it instead of an invitation:

- **Tickets become talks.** Ticket status **Closed** already hides every "Get tickets" button. Add an optional **Talk video link** per speaker (`keystatic.config.ts` and `Speaker` in `src/lib/content.ts`), validated as a YouTube link from the official TEDx Talks channel, shown as "Watch the talk" on the speaker card and `/speakers/<slug>`. Link out, never embed (the Content-Security-Policy in `next.config.ts` blocks third-party frames, and TEDx talks are published through TED's uploader).
- **One switch.** An **Event status: Upcoming / Happened** field in Event basics that, when set to Happened: changes the hero buttons to "Watch the talks" and "Partners", replaces the Tickets section with a short "Thank you" and the talks list, past-tenses the Theme copy lines that say "will" (or lets the board rewrite them in Theme copy), sets `eventStatus` in the JSON-LD to a completed event, and hides speaker applications and the mailing-list "hear first" panel.
- **Frozen.** The archive keeps its own Vercel project and subdomain with the admin switched off (step 1), so later years never change it.

## Prompt for an AI coding assistant

Copy everything in the box into the assistant, filled in, from the root of the new repository.

```text
You are re-theming the TEDxSantaClaraUniversity event website (Next.js, content in /content edited with Keystatic) for a new year. Read docs/NEXT-YEAR.md, docs/EDITING.md and README.md first and follow docs/NEXT-YEAR.md in order.

New event:
- Theme name: <THEME>
- Tagline (one sentence): <TAGLINE>
- Theme story (2-3 short paragraphs): <STORY>
- Date: <YYYY-MM-DD>; doors/talks/end times: <or "not confirmed">
- Venue building: <VENUE>; campus: <CAMPUS>; address and map link: <...>
- Seat capacity (1-100): <N>
- Site address: https://<subdomain>.tedxscu.com
- Tone of the theme wording: <a few words>

Do:
1. Make every change you can as content: edit the YAML files in /content that the admin writes (settings.yaml, theme-copy.yaml, venue.yaml, tickets.yaml, faq.yaml, tiers/*.yaml, speakers/*.yaml, schedule.yaml) exactly as docs/NEXT-YEAR.md steps 2 and 3 describe. Keep the YAML structure; only change values. Rewrite every line in content/theme-copy.yaml for the new theme, keeping each about as long as the original.
2. Then only the code touchpoints in docs/NEXT-YEAR.md step 4 (the engraving lines in src/scene/engraving.ts, in capitals; nothing else in src/scene). Do not touch other code, styles, motion or tests.
3. Run npm run check:content, npm run lint, npm run typecheck, npm run build and npm run test:e2e, and the leftover search from step 7. Report every remaining hit and whether it is intentional.
4. If src/scene changed, run npm run stills (step 5) and commit public/stills.
5. Commit on a new branch with clear messages. Do not push or deploy.

Rules you must not break (TEDx licence):
- Write the event name exactly "TEDxSantaClaraUniversity": never shortened ("TEDxSCU"), split ("TEDx Santa Clara"), translated or restyled in case. It is not part of the theme name.
- Never edit, recolour, redraw, move or combine the TEDx logo (public/brand/), never put it over images or the 3D scene, never add it to the share image or the icon, and never design a theme logo that includes it.
- Keep the line "This independent TEDx event is operated under license from TED." and the About TEDx / About TED texts exactly as they are.
- Sponsor names and logos only on /partners. Seat capacity at most 100. Ticket price at most $100. No partner may speak or influence the programme.
- Do not invent facts (speakers, times, prices, partners): leave fields blank so the site shows "to be announced".
```
