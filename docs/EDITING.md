# Editing the site (no code needed)

Everything visitors read on the site (dates, speakers, tickets, FAQ, sponsors, links) is edited in an admin screen called **Keystatic**. You never need to open the code.

Names in **bold** below are exactly what you will see in the admin.

> **Before launch: Compliance must replace both texts with the current official wording from TED's organizer guide.** The **About TEDx** and **About TED** texts in **Contact & site > Required TED language** were filled in from TED's long-standing standard wording, but nobody has checked them against TED's current organizer guide yet. See "Required TED language" below.

## 1. Sign in

1. Go to **https://fineprint.tedxscu.com/keystatic**.
2. Click **Log in with GitHub** and, the first time, approve the Keystatic app GitHub shows you.
3. You need a GitHub account that has **write access** to the repository `1Dabbid/TEDxSantaClaraUniversity27`. If you see "Repo not found", or a message asking you to "fork the repo" when you save, you do not have write access: ask the site owner to add you (GitHub > repository > Settings > Collaborators).

The left-hand menu has four groups: **The event**, **People**, **Partners**, **Contact & site**.

> Working on your own computer instead? Run `npm run dev` and open `http://localhost:3000/keystatic`. Edits then go into files on your computer, which you commit yourself. One local quirk: after you add or change the **Ticket checkout embed link**, the embedded checkout stays blank until you stop `npm run dev` and start it again (the live site picks it up on its own).

## 2. What happens when you press Save

- Each **Save** becomes a commit in the GitHub repository (so every change has a name, a date and can be undone).
- Vercel notices the commit and rebuilds the site. The change is live after **about a minute or two**. Refresh the page (on a phone, close and reopen the tab) if you still see the old version.
- If a change does not appear after five minutes, the build probably failed: see "If the site fails to build after an edit" below.
- Anything you leave blank is shown as a tidy **"To be announced"** (or simply hidden). Never put guesses on the site.
- Lists (schedule items, FAQ questions, venue notes, partner benefits) open each item in a box: click **Add** (new item) or **Done** (existing item) to close the box, then **Save** at the top of the page. Closing the box alone does not save anything.
- The admin checks what you type: links must start with `https://`, times look like `5:30 PM`, page addresses use only lowercase letters, numbers and dashes. A red message under a field says what to change; nothing is saved until it is fixed.
- If something wrong slips through anyway (for example a photo that is really a PDF or an iPhone HEIC file, or a link edited by hand on GitHub), the site does not break: it leaves that photo or link out (a speaker then shows "Portrait to follow") and the build log on Vercel lists a "Content warning" naming the file and the field. Fix it in the admin and save again.

### If the site fails to build after an edit

Almost every mistake is caught by the admin or left out of the page, but a file edited by hand on GitHub can still stop the build. The live site then simply stays as it was before the edit; nothing breaks for visitors.

1. **See the error.** On Vercel open the project > **Deployments**, click the newest deployment marked **Error**, and open **Build Logs**. Search for "Content error": the message names the file (e.g. `content/faq.yaml`), the form in the admin (e.g. "FAQ"), the field by its label and, for a choice field, the allowed values. If you have no Vercel access, the same message is on the commit in GitHub: open the repository, click the red ✗ next to the latest commit, then **Details**.
2. **Fix it** in the admin if the form still opens: correct the field and **Save**.
3. **Or undo the last edit on GitHub.** Open the repository on GitHub > **Commits**, open the commit that broke it, and note the file it changed. Open that file, click **History** (clock icon), open the version before the bad commit, click **…** > **View file**, copy its contents, then go back to the current file, click the pencil (**Edit this file**), paste, and **Commit changes**. (If you are comfortable with it, `git revert <commit>` does the same.) Vercel rebuilds within a couple of minutes.
4. Still stuck? Tell the web team and include the link to the failed deployment.

## 3. What appears when

The home page shows what is true today and grows by itself as you publish. You never switch a section on for an announcement; ticking the content's own box is enough.

| Part of the home page | While nothing is published | Once you publish |
| --- | --- | --- |
| **Speakers** | One heading, "Speakers to be announced", and one panel: **Join the mailing list** and how to apply to speak. No placeholder cards. | Ticking **Announced** on a speaker shows their card (linked to their page) and the heading becomes "Meet the speakers". Slots still unannounced appear as a single "More speakers to be announced" card. |
| **Schedule** | A short note: date, "Running order to follow". Not in the menu. | Ticking **Show the running order** shows the full timeline and adds **Schedule** to the menu. |
| **Speaker applications** | Shown in the Speakers section: "Applications are not open yet". | **Open** + a link: an **Apply to speak** button under the Speakers heading and in the closing links at the bottom of the home page (with the deadline, if filled in). **Closed**: "Applications for this event are closed." |
| **Tickets** | "Not on sale yet.", with the mailing list button. | **On sale** + a link: **Get tickets** everywhere. |
| **Team** | Hidden (not on the page, not in the menu). | Appears as soon as one person has **Show name publicly** ticked and a name; only named people are listed. |
| **Partners** | A short text invitation on the home page (never names or logos) linking to `/partners`. On `/partners`, **Current partners** is hidden. | **Published** partners appear on `/partners` only. |
| **Hero buttons** | **Tickets** and **Get updates** (mailing list). | Once a speaker is announced: **Tickets** and **Speakers**. |

### The topic pages

Besides the home page (the scroll story), each topic has its own page with an address you can share: **/speakers**, **/schedule**, **/venue**, **/partners**, **/team** and **/faq**. They read the same content as the home page, so there is nothing extra to fill in.

| Page | While nothing is published | Once you publish |
| --- | --- | --- |
| **/venue** | Address, **Open in Maps**, the coordinates, and Directions, Parking and Accessibility with one line saying the details follow (Directions points to the address; Accessibility to the contact email). Times show "To be announced". | Each **Getting there** note you fill in (**Venue & directions**) appears under its title; **Doors open at**, **Talks start at**, **Event ends at** appear at the top. |
| **/schedule** | The date, "Running order to follow" and the mailing list button. | The full running order (**Show the running order**). |
| **/team** | Every board role from **People > Team**, as a plain list of roles. | Names and photos for people with **Show name publicly** ticked. Turning off the Team switch removes the page. |
| **/faq** | Every question. Each has its own link (e.g. `/faq#tickets-on-sale`, made from the question's words): send it to someone and the answer opens. Rewording a question changes its link. Turning off the FAQ switch removes the page. | |

Menus: at the top of the home page the links scroll to the sections; on every other page the same links open the topic pages. The footer always links the pages. Each home section ends with a small link to its page ("Venue details", "Full schedule", "The whole team", "All questions", and "All speakers" once a speaker is announced).

Unannounced speakers still have a page (`/speakers/speaker-01` and so on) so an old link never breaks, but nothing on the site links to it and search engines are told to ignore it.

## 4. Recipes

### Announce a speaker

1. **People > Speakers**, open the entry for the slot (they start as "Speaker to be announced").
2. Type the **Name**. After typing the Name, click **Regenerate** next to **Page address (slug)**: it keeps saying speaker-01 until you do. Use only lowercase letters, numbers and dashes. The page then becomes `/speakers/jane-doe`. Do not change it again after the announcement (old links would break).
3. Fill in **Role / affiliation**, **Talk title** (only once confirmed), **Short bio** (one or two sentences, max 300 characters) and **Full bio** (separate paragraphs with an empty line).
4. **Portrait**: upload the photo (JPG or PNG under 2 MB; see image sizes below). It is shown in black and white.
5. Optional: **Personal link (optional)** (the full address, starting with `https://`) and **Link label** (e.g. "Website", "LinkedIn").
6. **Order**: lower numbers come first.
7. Tick **Announced** and press **Save**. Until it is ticked, the name, photo and bio stay hidden everywhere and the page is hidden from search engines.

Every speaker is also listed on **/speakers** (announced speakers first). That page is hidden from search engines until at least one speaker is announced. Each announced speaker gets their own share image (name, talk title, portrait in black and white) automatically, and the **Short bio** is used in their search description.

To remove a slot entirely, untick **Published**.

### Publish the schedule

1. **The event > Schedule**.
2. Under **Running order**, click **Add** for each moment. A box opens with **Time** (e.g. 5:30 PM, shown as typed), **Title**, **Description (optional)** and **Kind** (Talk, Break, Doors or Program; the site shows the same word next to the item). Click **Add** (or **Done** when editing an existing item) to close the box.
3. To reorder, drag the handle, or focus it and press Enter, then the arrow keys, then Enter.
4. Tick **Show the running order** and **Save**. While it is unticked, the site shows a short "running order to follow" note and the menu has no Schedule link.

Doors, talks and end time for the whole evening are in **The event > Event basics**: **Doors open at**, **Talks start at**, **Event ends at** (written like 5:30 PM). Search engines are given the evening's start (**Talks start at**, or **Doors open at** while that is blank) and end time in California time; while no time is set they only see the date.

### Put tickets on sale

1. **The event > Tickets & speaker applications**.
2. **Ticket link**: the ticketing page. Paste the full address starting with `https://` (the admin rejects `www.…` on its own).
3. Optional: **Ticket checkout embed link (optional)**, only if the ticketing service gives you an "embed" link. Leave blank if unsure. (Editing locally with `npm run dev`? The box stays blank until you restart `npm run dev`.) If the embedded checkout stays blank on the live site, tell the web team: some services need one more allowed address (`CSP_FRAME_SRC` on Vercel). The embedded checkout is never allowed to take over the whole page: if the service wants to switch to its own full page (for a payment step, say), that step opens in a new tab instead, and buyers come back to this tab afterwards.
4. **Price note**: one short sentence, e.g. "Tickets will cost no more than $100." Our cap is **$100**; confirm the limit for our licence tier with the licence holder. Do not call it a TED rule on the site.
5. **Ticket price in US dollars (optional)**: just the number, e.g. `25` (`0` if free). The admin will not accept more than 100. Search engines show it in event listings; visitors read the Price note.
6. **Tickets on sale from (optional)**: the first day of sales (pick the date).
7. Set **Ticket status** to **On sale** and **Save**. Every Tickets button on the site updates. ("On sale" only shows the buy button when a ticket link is filled in.)
8. **The event > FAQ**: update the answer to **Are tickets on sale?** (it still says "Not yet" until you change it), e.g. "Yes. Get them from the Tickets button; they cost $25." and **Save**.
9. Later: switch to **Sold out** or **Closed (sales have ended)**, and update that FAQ answer again.

Search engines only receive ticket details (price, sale start, link) while the status is **On sale** or **Sold out**; while it is "Coming soon" or "Closed" they get none, so never fill in a price you have not confirmed.

### Open speaker applications

1. **The event > Tickets & speaker applications**.
2. **Speaker application link**: the form.
3. **Application deadline (optional)**: written as you want it shown, e.g. January 15, 2027.
4. Set **Speaker applications** to **Open** and **Save**. The "Apply to speak" button (under the Speakers heading, and in the closing links at the bottom of the home page) only appears when the status is Open and the link is filled in.
5. **The event > FAQ**: update the answer to **How can I apply to speak?** (it says applications are coming soon until you change it) and **Save**. Do the same again when applications close.
6. All speaker-application wording can be switched off in **Contact & site > Show / hide sections > Show speaker applications (in the Speakers section)**.

### Add a sponsor (partner)

Tiers and benefits first, then the partner:

1. **Partners > Partner tiers**: each tier has **Tier name**, a **Slug** (made from the name, e.g. `founding-partner`: leave it as generated), **Description**, **Contribution (optional)** (e.g. $2,500; hidden while blank), **Number of slots (optional)** and **Order**. The list of tiers in the admin is sorted by slug; on the site they follow **Order**.
2. **Partners > Partner benefits > Benefits comparison**: click **Add** for each row. In the box, write the **Benefit**, then click into **Included in these tiers** and pick each tier from the list; tiers are listed by their page address (e.g. `founding-partner`), not their name. Click **Add** (or **Done**), then **Save**. While the list is empty the page says the benefits for each tier are being finalized. Only benefits TEDx allows (no stage time, no say over the programme).
3. **Partners > Partners (logos)** > **Add**: **Organization name** (leave the **File name (slug)** under it as generated), **Tier** (again listed by page address, e.g. `founding-partner`), **Logo**, **Website** (full address starting with `https://`). The logo is shown at most 24px tall and 72px wide, always smaller than the event logo. No tobacco, weapons/ammunition or adult-product companies, and none of TED's prohibited sponsors. Sponsors can never be speakers.
4. Tick **Published** only once the partnership is signed and the logo approved, then **Save**. Partners appear on `/partners` only, never on the home page.

### Show team names

1. **People > Team**: one entry per board role (**Role**; leave the **File name (slug)** under it as generated).
2. Fill in **Name (optional)** and optionally **Photo (optional)**.
3. Tick **Show name publicly** (ask the person first) and **Save**.

The Team section stays hidden until at least one person has a public name; then it lists the named people only (with their role), and **Team** appears in the menu. The whole section can also be switched off in **Contact & site > Show / hide sections > Show the Team section on the home page (it appears once at least one name is public)**.

### The "All year, not one night" card (Partners page)

**Contact & site > Show / hide sections > Show the “All year, not one night” card on the Partners page** is off by default. Only turn it on if TED has confirmed the club's year-round events may use the TEDx name: the licence covers the mainstage event, and general-meeting events are not automatically TEDx events.

### Edit the FAQ

1. **The event > FAQ > Questions**: click a question to open it in a box with **Question** and **Answer** (plain text, line breaks are kept), or **Add** for a new one. Close the box with **Done** (or **Add**), then **Save**.
2. Instead of typing details that change, write a placeholder and the site fills it in from **Event basics** and **Venue & directions**: `{date}` (e.g. Friday, April 23, 2027), `{venue}` (the building), `{campus}` (e.g. Santa Clara University), `{capacity}` (the seat count) and `{eventName}` (TEDxSantaClaraUniversity). The "When and where" answer already uses them, so it follows the Event date and venue automatically.
3. To reorder, drag the handle, or focus it and press Enter, then the arrow keys, then Enter. Numbering is automatic.
4. To delete a question, click the bin icon next to it. There is no confirmation, but nothing is gone until you **Save**: reload the page to get it back.
5. Hide the section with **Show / hide sections > Show the FAQ section on the home page**.

### Change contact links

**Contact & site > Contact, newsletter & socials**:

- **Newsletter sign-up link (SendFox)**: while blank, the site shows "list opening soon".
- **Contact email**: shown in the footer and FAQ.
- **Partnerships email**: used by every "Become a partner" button (falls back to tedxscu.com while blank).
- **Social links**: **Instagram**, **LinkedIn**, **YouTube**, **TikTok** (full links starting with `https://`, e.g. `https://www.instagram.com/scutedx`, not `@scutedx`; blank ones are hidden). **YouTube**: club channel only. Full TEDx talks may only be published through TED's uploader, never on this channel.
- **Livestream link (optional)**: see "Add the livestream link" below.

### Add the livestream link

Only if the event is streamed. **The stream must be free. Do not stream if any TED Talk videos are shown in the programme; confirm with the licence holder first.**

1. **Contact & site > Contact, newsletter & socials > Livestream link (optional)**: paste the full link to the stream page (e.g. the YouTube live page; it must start with `https://`).
2. **Save**. A small **Watch live** link (with a red dot) appears in two places: next to the buttons at the top of the home page, and next to the main button in the Tickets section. It opens the stream in a new tab.
3. After the event, empty the field and **Save**: the link disappears. While the field is blank, nothing is shown.

### Required TED language (About TEDx / About TED)

TED requires every TEDx site to show its standard "About TEDx" text (it explains that x = independently organized event) and its "About TED" text. Both are shown in the footer of every page, exactly as typed here.

1. **Contact & site > Required TED language**.
2. **About TEDx** and **About TED**: paste the current official text from TED's TEDx organizer guide **exactly**. Do not shorten, reword or "improve" it. Separate paragraphs with an empty line.
3. **Save**. Neither field can be left empty or only spaces (if one ever is, the footer falls back to the standard wording built into the site).

Only the Director of Compliance (or the licence holder) should change these. The FAQ answer "What is TEDx?" points visitors to these footer texts instead of repeating them; keep it that way.

### Change the theme's headings and short lines (Theme copy)

**The event > Theme copy (headings and short lines)** holds the short lines that belong to this year's theme rather than to the facts: the caption and scroll hint on the first screen, the Theme section heading and its footnote, the caption of the engraved microphone, the "to be announced" lines for Speakers and Schedule, the closing mailing-list heading, the partner invitation on the home page, the Partners page heading, introduction, description and first card, the 404 page, the footer sign-off and the word shown while a page changes. Each field says where it appears.

- Every field starts with this year's wording. Leave a field **blank** to go back to that wording, except the hero caption, the theme footnote and the Partners page's first card, which a blank **hides**.
- In the partner texts you can write `{eventName}`, `{capacity}`, `{date}`, `{venue}` and `{campus}`, as in FAQ answers.
- Write the name as **TEDxSantaClaraUniversity** (or `{eventName}`), never shortened. Keep lines short: they are headings and captions, not paragraphs.

### Change the number of seats

**The event > Event basics > Seat capacity (a whole number from 1 to 100)** (100 by default; it cannot be left empty). TEDx rules cap a standard licence at **100 attendees**, so the admin will not accept more than 100; lower it only if the room is smaller. This one number drives every seat count on the site: the hero, Venue, the Tickets ruler and counter (one tick per seat), the Partners page, the share image and search descriptions. In FAQ answers, write `{capacity}` where the number belongs (e.g. "Attendance is limited to {capacity} people") and the site fills it in. (The 3D room behind the page always shows 100 seats; that is decoration and does not change.)

### Other places

- **The event > Event basics**: **Theme name**, **Theme tagline** (also used in search results and link previews), **Theme story**, **Event date** (pick it in the calendar), times (**Doors open at**, **Talks start at**, **Event ends at**), **Seat capacity**, **Accent colour**. The description of the share image (read aloud by screen readers when the link is shared) is written automatically from the theme name, date and venue. There is no field for the event name: TEDxSantaClaraUniversity is fixed by the licence and set in the site's code.
- **The event > Venue & directions**: building, **Campus** (shown under the building name in the hero and wherever the venue is written out), address, **Map link** (full address starting with `https://`), coordinates, and **Getting there (directions, parking, accessibility)** notes.

## 5. Image sizes

| Image | Size | Format |
| --- | --- | --- |
| Speaker **Portrait** | 4:5 portrait, about 1200 × 1500 px | JPG or PNG, under 2 MB |
| Team **Photo (optional)** | square, about 600 × 600 px | JPG or PNG, under 2 MB |
| Partner **Logo** | white or light version on a transparent background, wide rather than tall; it is shown at most 24px tall and 72px wide; always smaller than the event logo | SVG (best) or PNG at least 216 px wide, under 2 MB |

Keep every photo under 2 MB; JPG or PNG (not HEIC, not PDF). iPhone photos are often HEIC: export or share them as JPG first ("Most Compatible" in the camera settings). A file of the wrong type is left out (the page shows "Portrait to follow") and a file over 2 MB is flagged in the build log. Use plain file names without spaces (e.g. `jane-doe.jpg`). The site resizes and compresses photos for visitors automatically.

## 6. TEDx rules: what NOT to do

- Always write the name in full: **TEDxSantaClaraUniversity**. Never "TEDxSCU", "TEDx Santa Clara" or similar.
- Never alter, recolour, stretch or re-create the TEDx logo, and never put it next to another logo. The site already places it correctly.
- **Sponsor logos only on the Partners page.** Never in speaker bios, the FAQ, the home page or the theme story.
- Keep the line **"This independent TEDx event is operated under license from TED."** (it is in the footer; do not ask for it to be removed).
- Partners never speak from the stage and have no say over the programme; do not list such benefits.
- No prohibited sponsors (TED's rules exclude, among others, tobacco, firearms, political parties and religious organizations as sponsors). The current list is in TED's TEDx sponsorship rules; when in doubt, ask the license holder before publishing.
- Tickets: our cap is $100; confirm the limit for our licence tier with the licence holder.
- Do not put unconfirmed facts on the site. Leave the field blank instead.
