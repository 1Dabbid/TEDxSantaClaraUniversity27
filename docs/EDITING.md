# Editing the site (no code needed)

Everything visitors read on the site (dates, speakers, tickets, FAQ, sponsors, links) is edited in an admin screen called **Keystatic**. You never need to open the code.

Names in **bold** below are exactly what you will see in the admin.

## 1. Sign in

1. Go to **https://fineprint.tedxscu.com/keystatic**.
2. Click **Log in with GitHub** and, the first time, approve the Keystatic app GitHub shows you.
3. You need a GitHub account that has **write access** to the repository `1Dabbid/TEDxSantaClaraUniversity27`. If you see "Repo not found", ask the site owner to add you (GitHub > repository > Settings > Collaborators).

The left-hand menu has four groups: **The event**, **People**, **Partners**, **Contact & site**.

> Working on your own computer instead? Run `npm run dev` and open `http://localhost:3000/keystatic`. Edits then go into files on your computer, which you commit yourself.

## 2. What happens when you press Save

- Each **Save** becomes a commit in the GitHub repository (so every change has a name, a date and can be undone).
- Vercel notices the commit and rebuilds the site. The change is live after **about a minute or two**. Refresh the page (on a phone, close and reopen the tab) if you still see the old version.
- If a change does not appear after five minutes, the build probably failed: tell the web team, or check the Vercel dashboard (Deployments).
- Anything you leave blank is shown as a tidy **"To be announced"** (or simply hidden). Never put guesses on the site.

## 3. Recipes

### Announce a speaker

1. **People > Speakers**, open the entry for the slot (they start as "Speaker to be announced").
2. Fill in **Name**, **Role / affiliation**, **Talk title** (only once confirmed), **Short bio** (one or two sentences, max 300 characters) and **Full bio** (separate paragraphs with an empty line).
3. **Portrait**: upload the photo (see image sizes below). It is shown in black and white.
4. Optional: **Personal link (optional)** and **Link label** (e.g. "Website", "LinkedIn").
5. **Page address (slug)**: set it once to the person's name, e.g. `jane-doe`, so the page becomes `/speakers/jane-doe`. Do not change it again after the announcement (old links would break).
6. **Order**: lower numbers come first.
7. Tick **Announced** and press **Save**. Until it is ticked, the name, photo and bio stay hidden everywhere and the page is hidden from search engines.

Every speaker is also listed on **/speakers** (announced speakers first). That page is hidden from search engines until at least one speaker is announced. Each announced speaker gets their own share image (name, talk title, portrait in black and white) automatically, and the **Short bio** is used in their search description.

To remove a slot entirely, untick **Published**.

### Publish the schedule

1. **The event > Schedule**.
2. Under **Running order**, add one item per moment: **Time** (e.g. 5:30 PM), **Title**, **Description (optional)**, **Kind** (Talk, Break, Doors, Other). Drag items to reorder.
3. Tick **Show the running order** and **Save**. While it is unticked, the site shows "schedule coming soon".

Doors, talks and end time for the whole evening are in **The event > Event basics**: **Doors open at**, **Talks start at**, **Event ends at** (written like 5:30 PM). Search engines are given the evening's start (**Talks start at**, or **Doors open at** while that is blank) and end time in California time; while no time is set they only see the date.

### Put tickets on sale

1. **The event > Tickets & speaker applications**.
2. **Ticket link**: the ticketing page (must start with `https://`).
3. Optional: **Ticket checkout embed link (optional)**, only if the ticketing service gives you an "embed" link. Leave blank if unsure. If the embedded checkout stays blank on the live site, tell the web team: some services need one more allowed address (`CSP_FRAME_SRC` on Vercel).
4. **Price note**: one short sentence, shown on the site. TEDx rules cap tickets at **$100**.
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
4. Set **Speaker applications** to **Open** and **Save**. The "Apply to speak" button only appears when the status is Open and the link is filled in.
5. The band itself can be switched off in **Contact & site > Show / hide sections > Show the speaker applications band (under Tickets)**.

### Add a sponsor (partner)

Tiers and benefits first, then the partner:

1. **Partners > Partner tiers**: each tier has **Tier name**, **Description**, **Contribution (optional)** (e.g. $2,500; hidden while blank), **Number of slots (optional)** and **Order**.
2. **Partners > Partner benefits > Benefits comparison**: one row per **Benefit**, and tick the tiers under **Included in these tiers**. While the list is empty the page says the schedule of benefits is being finalized. Only benefits TEDx allows (no stage time, no say over the programme).
3. **Partners > Partners (logos)** > create: **Organization name**, **Tier**, **Logo**, **Website**.
4. Tick **Published** only once the partnership is signed and the logo approved, then **Save**. Partners appear on `/partners` only, never on the home page.

### Show team names

1. **People > Team**: one entry per board role (**Role**).
2. Fill in **Name (optional)** and optionally **Photo (optional)**.
3. Tick **Show name publicly** (ask the person first) and **Save**. Without the tick only the role is shown.

The whole section can be hidden in **Contact & site > Show / hide sections > Show the Team section on the home page**.

### Edit the FAQ

1. **The event > FAQ > Questions**: each item has a **Question** and an **Answer** (plain text, line breaks are kept). Write `{capacity}` for the seat count so it always matches **Seat capacity**.
2. Drag to reorder; numbering is automatic.
3. Hide the section with **Show / hide sections > Show the FAQ section on the home page**.

### Change contact links

**Contact & site > Contact, newsletter & socials**:

- **Newsletter sign-up link (SendFox)**: while blank, the site shows "list opening soon".
- **Contact email**: shown in the footer and FAQ.
- **Partnerships email**: used by every "Become a partner" button (falls back to tedxscu.com while blank).
- **Social links**: **Instagram**, **LinkedIn**, **YouTube**, **TikTok** (full links; blank ones are hidden).
- **Livestream link (optional)**: see "Add the livestream link" below.

### Add the livestream link

Only if the event is streamed.

1. **Contact & site > Contact, newsletter & socials > Livestream link (optional)**: paste the full link to the stream page (e.g. the YouTube live page; it must start with `https://`).
2. **Save**. A small **Watch live** link (with a red dot) appears in two places: next to the buttons at the top of the home page, and next to the main button in the Tickets section. It opens the stream in a new tab.
3. After the event, empty the field and **Save**: the link disappears. While the field is blank, nothing is shown.

### Change the number of seats

**The event > Event basics > Seat capacity** (a number, 100 by default). TEDx rules cap a standard licence at **100 attendees**, so the admin will not accept more than 100; lower it only if the room is smaller. This one number drives every seat count on the site: the hero, Venue, the Tickets ruler and counter (one tick per seat), the Partners page, the share image and search descriptions. In FAQ answers, write `{capacity}` where the number belongs (e.g. "Attendance is limited to {capacity} people") and the site fills it in. (The 3D room behind the page always shows 100 seats; that is decoration and does not change.)

### Other places

- **The event > Event basics**: **Event name**, **Theme name**, **Theme tagline** (also used in search results and link previews), **Theme story**, **Event date** (YYYY-MM-DD), times (**Doors open at**, **Talks start at**, **Event ends at**), **Seat capacity**, **Accent colour**. The description of the share image (read aloud by screen readers when the link is shared) is written automatically from the theme name, date and venue.
- **The event > Venue & directions**: building, **Campus** (shown under the building name in the hero and wherever the venue is written out), address, **Map link**, coordinates, and **Getting there (directions, parking, accessibility)** notes.

## 4. Image sizes

| Image | Size | Format |
| --- | --- | --- |
| Speaker **Portrait** | 4:5 portrait, at least 1200 × 1500 px | JPG, under ~1 MB |
| Team **Photo (optional)** | square, at least 600 × 600 px | JPG, under ~500 KB |
| Partner **Logo** | white or light version on a transparent background, wide rather than tall; it is shown at most 32 px tall | SVG (best) or PNG at least 320 px wide |

Use plain file names without spaces (e.g. `jane-doe.jpg`). The site resizes and compresses photos automatically; a huge file only slows down saving.

## 5. TEDx rules: what NOT to do

- Always write the name in full: **TEDxSantaClaraUniversity**. Never "TEDxSCU", "TEDx Santa Clara" or similar.
- Never alter, recolour, stretch or re-create the TEDx logo, and never put it next to another logo. The site already places it correctly.
- **Sponsor logos only on the Partners page.** Never in speaker bios, the FAQ, the home page or the theme story.
- Keep the line **"This independent TEDx event is operated under license from TED."** (it is in the footer; do not ask for it to be removed).
- Partners never speak from the stage and have no say over the programme; do not list such benefits.
- No prohibited sponsors (TED's rules exclude, among others, tobacco, firearms, political parties and religious organizations as sponsors). The current list is in TED's TEDx sponsorship rules; when in doubt, ask the license holder before publishing.
- Tickets may not cost more than $100.
- Do not put unconfirmed facts on the site. Leave the field blank instead.
