# Visitor statistics with Google Analytics

The site can report to Google Analytics 4 (GA4): how many people visit, which pages they open, and whether they click the Tickets button. The club's Measurement ID (`G-NH4G85FK73`) is built into the site, so the live site (the Vercel Production deployment) reports to it without any setting. Local copies, tests and preview deployments never report. What is left for you is on the Google side: steps 4, 5 and 8 below. No code, about 10 minutes. Steps 1 to 3 and 6 to 7 are only needed if you ever move to a different Google Analytics property.

Before you start, read "Before you switch it on" at the end: Google Analytics sets cookies, and that comes with a duty to tell visitors.

## Switch it on

1. **Create the Google Analytics account and property.** Go to [analytics.google.com](https://analytics.google.com) and sign in with the Google account the club shares (not a personal one, so next year's team can get in). Choose **Start measuring**. Give the account a name (the club's name), then the property a name (for example the site's address), time zone **United States, Los Angeles time**, currency **US Dollar**. Answer the questions about the organization, choose the objective **Get baseline reports** (the menu names in this guide assume it; if your menu looks different, use the search box at the top of Google Analytics and type the report name), and accept the terms.
2. **Create the web data stream.** When asked for a platform choose **Web**. Enter the site's address (the one visitors use, see docs/DEPLOY.md, "Add the domain") and a stream name such as "Website". Choose **Create stream**.
3. **Copy the Measurement ID.** The stream's page shows a **Measurement ID** at the top right. It looks like `G-AB12CD34EF`. Copy it. (You can find it again later under **Admin** (the gear, bottom left) **> Data streams >** your stream.)
4. **Change two switches on the same page**, under **Enhanced measurement** (the gear icon at the right of that box):
   - Under **Page views**, choose **Show advanced settings** and untick **Page changes based on browser history events**. The site already reports each page itself, exactly once. If this stays ticked, the home page's section links are counted as extra pages.
   - Switch **Form interactions** off. The site has no forms, so it only adds noise.
   - Leave the rest on (Scrolls, Outbound clicks, File downloads). Choose **Save**.
5. **Leave Google signals off.** Under **Admin > Data collection and modification > Data collection**, do not turn on "Google signals". The site asks Google not to use it either way, and it is only for advertising.
6. **Only for a different ID: add it in Vercel.** Open the project in Vercel, then **Settings > Environment Variables**. Key: `NEXT_PUBLIC_GA_MEASUREMENT_ID`. Value: the ID you copied. Under Environments tick **Production only** (untick Preview and Development). Choose **Save**.
7. **Redeploy (only after step 6).** In Vercel open **Deployments**, find the newest Production deployment, open its **…** menu and choose **Redeploy**. The ID is read when the site is built, so nothing changes until this is done.
8. **Check it.** Open the live site in a normal browser window, wait about ten seconds and click around. In Google Analytics open **Reports > Realtime**: you should see yourself within a minute. If you do not, see "If nothing shows up" below. Then click a section link in the site's menu on the home page: the page view count must not go up. If it does, step 4 was missed.
9. **Optional, but worth five minutes: name the details so they appear in reports.** Under **Admin > Data display > Custom definitions > Create custom dimension**, add these four, typing the name in the last column exactly:

   | Dimension name (your choice) | Scope | Event parameter / User property |
   | --- | --- | --- |
   | Place on page | Event | `place` |
   | Ticket status | Event | `ticket_state` |
   | Home page section | Event | `section` |
   | Site version | User | `site_tier` |

   Without this step the events are still counted; you just cannot split them by place, status, section or version in the standard reports. (Realtime shows the details either way.)

## What is measured

Standard reports are filled a day later; **Realtime** shows the last 30 minutes.

| Where to look | What it tells you |
| --- | --- |
| **Reports > Realtime** | Who is on the site right now, and the events as they happen. |
| **Reports > Engagement > Pages and screens** | Visits per page: the home page, Speakers, Schedule, Venue, Partners, Team, FAQ and each speaker's page. |
| **Reports > Engagement > Events** | The events below, with how often each happened. Click an event name for its details. |
| **Reports > Acquisition > Traffic acquisition** | Where visitors came from (Instagram, a search, a link in an email). |

The site's own events:

| Event | When | Details sent with it |
| --- | --- | --- |
| `page_view` | A page is opened. Each page counts once per visit to it. Jumping to a section of the home page is not a new page. | The page's address (without `#section`; of the part after `?` only `utm_…` campaign tags are kept) and its title. |
| `ticket_click` | Someone clicks a **Tickets**, **Get tickets** or **Go to checkout** button. | `place`: `header`, `hero`, `tickets` (the Tickets section), `closing_band` (the end of a topic page) or `page` (a speaker's page). `ticket_state`: `coming_soon`, `on_sale`, `sold_out` or `closed`, as set in the admin at the time. |
| `newsletter_click` | Someone clicks a link to the mailing-list sign-up form. | `place`: `hero`, `speakers`, `tickets`, `newsletter` (the closing section), `footer`, `page`. |
| `interest_form_click` | Someone clicks a link to the interest form. | `place`: `speakers`, `closing_band` (the Team page), `page`. |
| `section_view` | On the home page, a visitor reaches a section and stays about a second. Once per section per visit. | `section`: `theme`, `speakers`, `schedule`, `venue`, `tickets`, `team`, `faq` or `newsletter`. |

Every visitor also carries `site_tier`, the version of the site their device got: `motion_3d` (the full motion design with the live 3D scene), `motion_stills` (motion over still images), `static_stills` (the static design, for slow connections or devices without 3D) or `reduced_motion` (the visitor asked for less motion).

Google Analytics adds some events by itself: `session_start` and `first_visit`, `user_engagement`, `scroll` (reached the bottom of a page), `click` (a link to another website; this covers Instagram, the map and any other outside link) and `file_download`.

Good questions to ask the numbers:

- Do people who reach the Tickets section click through? Compare `section_view` with section `tickets` to `ticket_click`.
- Which Tickets button works? Split `ticket_click` by `place`.
- How far down the home page do people get? Compare the `section_view` counts from `theme` to `newsletter`.

What it cannot tell you: whether someone **finished** signing up for the mailing list, filling in the interest form or buying a ticket. Those happen on other services, which have their own numbers. The site only sees the click that leads there.

The numbers are a little lower than real traffic, on purpose. Visitors whose browser asks not to be tracked (Global Privacy Control or Do Not Track), visitors with an ad blocker, and visits shorter than a few seconds are not counted.

## Switch it off

In Vercel, **Settings > Environment Variables**, add `NEXT_PUBLIC_GA_MEASUREMENT_ID` with the value `off` (Production), then redeploy (step 7). The site then loads nothing from Google and is exactly as it was before. Data already collected stays in Google Analytics until you delete the property there (**Admin > Property details > Move to trash**).

## If nothing shows up

- Did you redeploy after saving the variable (step 7)?
- Is the variable set for **Production**, and is its value only the ID (`G-` followed by capital letters and digits, no spaces or quotes)? A value that is not an ID keeps analytics off, and the build log in Vercel says so in a line starting with "Analytics warning".
- Are you testing on the live address? Preview links (`…vercel.app` test deployments) and `npm run dev` never report.
- Does your browser block it? Brave, Firefox with strict protection, ad blockers, and any browser with "Do Not Track" or Global Privacy Control switched on are not counted, by design. Try Chrome or Safari without extensions.
- Wait ten seconds after the page opens. The site loads analytics last, after everything a visitor sees.

## Before you switch it on

These are your decisions, not technical ones.

- **Google Analytics sets cookies.** With analytics on, each visitor's browser stores two small first-party cookies (`_ga` and `_ga_…`, kept for up to two years) so Google can tell a returning visitor from a new one. Without analytics the site sets no cookies for visitors at all.
- **Google's terms require you to tell visitors.** The Google Analytics Terms of Service require a privacy notice on the site that says you use Google Analytics and cookies and how the data is collected and used. The site does not have such a notice yet. A few plain sentences are enough, for example on the FAQ page (which you can edit in the admin) or on a short privacy page the web team adds. Google's own explanation to link to: "How Google uses information from sites or apps that use our services" (policies.google.com/technologies/partner-sites).
- **Santa Clara University may have its own rules** about analytics and privacy notices on sites that carry its name. Ask before switching on, and use the wording the university prefers.
- **Visitors from Europe.** European and UK rules ask for consent before analytics cookies are set. The site has no consent banner. If you expect and care about visitors from there, ask the web team for one before switching on.

What the site already does to keep this modest: it loads nothing from Google for browsers that send Global Privacy Control or Do Not Track; it tells Google not to use the data for advertising or to link it to Google accounts (Google signals and ad personalization are off); it sends no names, no email addresses and nothing a visitor types; and page addresses are sent without anything after `?` except campaign tags.

## For the web team

- The switch: `src/lib/analytics-id.ts` (valid ID, production build, not a Vercel preview). Without it the analytics code is not in the build at all: the pages and scripts are the same as before analytics existed (`next.config.ts` inlines `GA_MEASUREMENT_ID`, and `SiteShell` only imports the component inside that branch). `next.config.ts` adds the Google Analytics hosts to the public site's Content-Security-Policy only when it is on; the admin's policy never changes.
- Loading, privacy rules, page views, click and section events: `src/components/Analytics.tsx` (rendered by `SiteShell` only when on). Event names and parameters are typed in `src/lib/analytics.ts`; send a new one with `track(name, params)`, which does nothing when analytics is off.
- Click events need no attributes in the markup: a link is recognized by where it leads (the ticket, interest and mailing-list links from the admin) and placed by the landmark it sits in (`header`, `footer`, `[data-section]`, the closing band). The Tickets button is recognized by its `.btn` class and its `#tickets` target while tickets are not on sale.
- `gtag.js` is requested after `load`, after the 3D scene's first frames (`html.scene-live`, at most 8 s), at an idle moment. It is never in the HTML.
- Tests: `tests/e2e/analytics-off.spec.ts` (normal build) and `tests/e2e/analytics-on.spec.ts` (a second build with the made-up ID `G-TEST000000`; requests to Google are answered inside the test and never sent).
- Security note: the online admin keeps the editor's GitHub token in a cookie that script on this origin can read (docs/DEPLOY.md, security checklist). With analytics on, Google's `gtag.js` is such a script on the public pages. It is not loaded on `/keystatic`, but it shares the origin.
