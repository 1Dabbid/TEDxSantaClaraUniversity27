import { collection, config, fields, singleton } from '@keystatic/core';
import { HTTPS_URL_MESSAGE, HTTPS_URL_PATTERN, SLUG_MESSAGE, SLUG_PATTERN, TIME_PATTERN } from './src/lib/content-checks';
import {
  BENEFIT_GROUP_LABEL,
  CLASS_YEAR_MAX,
  CLASS_YEAR_MIN,
  EMAIL_PATTERN,
  SCHEDULE_KIND_LABEL,
  SITE_NAME,
  TED_TEXT_MIN_LENGTH,
  TEDX_MAX_CAPACITY,
} from './src/lib/site';
import { TEAM_LEVEL_OPTIONS } from './src/lib/team';
import { THEME_COPY_DEFAULTS as COPY } from './src/lib/theme-copy';

/**
 * Keystatic content model: what student editors see at /keystatic.
 *
 * Every label and description here is written for someone who has never seen
 * the code. Each save writes a YAML file under /content (or an image under
 * public/images/...). Pages read content only through src/lib/content.ts.
 *
 * Storage: local files by default, which only ever run under `npm run dev`
 * (src/lib/admin.ts switches the admin off everywhere else). GitHub storage is
 * used only when all four Keystatic variables are set at build time
 * (KEYSTATIC_GITHUB_CLIENT_ID, KEYSTATIC_GITHUB_CLIENT_SECRET, KEYSTATIC_SECRET,
 * NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG); editors on the deployed site then sign
 * in with GitHub and commit straight to the repo. The secrets are not visible to
 * the browser, so next.config.ts turns "all four present" into the build-time
 * flag KEYSTATIC_GITHUB_MODE, which both the server and the admin UI read. A
 * slug on its own keeps local storage, except under `npm run dev`, where it opens
 * Keystatic's GitHub App setup flow (/keystatic/setup). See docs/DEPLOY.md.
 */
const useGithub = process.env.KEYSTATIC_GITHUB_MODE === '1';

const LEAVE_BLANK = 'Leave blank until it is confirmed. The site shows “to be announced” instead.';
const TIME = new RegExp(`^$|${TIME_PATTERN.source}`, 'i');

/**
 * Every link field. A text field with a pattern rather than Keystatic's URL field,
 * which accepts "www.example.com" or "@handle" and would make broken relative links.
 * The loader (src/lib/content.ts) also normalises or drops bad values defensively.
 */
const urlField = (label: string, description: string) =>
  fields.text({
    label,
    description: `${description} Paste the full address starting with https://.`,
    validation: { pattern: { regex: HTTPS_URL_PATTERN, message: HTTPS_URL_MESSAGE } },
  });

/** The "slug" (page address / file name) part of every collection's name field. */
const slugPart = (label: string, description: string) => ({
  label,
  description: `${description} ${SLUG_MESSAGE}`,
  validation: { pattern: { regex: SLUG_PATTERN, message: SLUG_MESSAGE } },
});

/** TED's required texts: never blank or only spaces, and long enough to be the real wording. */
const TED_TEXT_VALIDATION = {
  isRequired: true,
  length: { min: TED_TEXT_MIN_LENGTH },
  pattern: { regex: /\S/, message: 'Paste TED’s official text here. It cannot be empty or only spaces.' },
};

const emailField = (label: string, description: string) =>
  fields.text({
    label,
    description,
    validation: { pattern: { regex: EMAIL_PATTERN, message: 'Use a full email address, like name@example.com, or leave it blank.' } },
  });

const PLACEHOLDERS = `You can write {eventName} (always shown as ${SITE_NAME}), {capacity}, {date}, {venue} and {campus}; the site fills them in from Event basics and Venue.`;
const BLANK_RESTORES = 'Leave it blank to go back to the original wording.';
const BLANK_HIDES = 'Leave it blank to hide it.';

/** One "Theme copy" line: a short plain-text field whose default is the built-in wording. */
const copyField = (key: keyof typeof COPY, label: string, description: string, opts: { multiline?: boolean } = {}) =>
  fields.text({
    label,
    description,
    defaultValue: COPY[key],
    multiline: opts.multiline,
    validation: { length: { max: 400 } },
  });

const timeField = (label: string) =>
  fields.text({
    label,
    description: `Write it like 5:30 PM. ${LEAVE_BLANK}`,
    validation: { pattern: { regex: TIME, message: 'Write the time like 5:30 PM (hours 1 to 12, then AM or PM), or leave it blank.' } },
  });

export default config({
  storage: useGithub
    ? { kind: 'github', repo: { owner: '1Dabbid', name: 'TEDxSantaClaraUniversity27' } }
    : { kind: 'local' },
  ui: {
    brand: { name: 'TEDxSantaClaraUniversity' },
    navigation: {
      'The event': ['settings', 'themeCopy', 'venue', 'tickets', 'schedule', 'faq'],
      People: ['speakers', 'team'],
      Partners: ['tiers', 'benefits', 'sponsors'],
      'Contact & site': ['contact', 'sections', 'tedLanguage'],
    },
  },
  singletons: {
    settings: singleton({
      label: 'Event basics',
      path: 'content/settings',
      schema: {
        themeName: fields.text({
          label: 'Theme name',
          description: `The big title on the home page, e.g. Fine Print. Keep it short. (The event name itself, ${SITE_NAME}, is fixed by the TEDx licence and set in the site's code, so there is no field for it.)`,
          defaultValue: 'Fine Print',
          validation: { isRequired: true, length: { max: 40 } },
        }),
        themeTagline: fields.text({
          label: 'Theme tagline',
          description: 'One sentence under the theme name. Also used in search results and link previews.',
          validation: { length: { max: 140 } },
        }),
        themeStory: fields.text({
          label: 'Theme story',
          description: 'A few short paragraphs about the theme. Separate paragraphs with an empty line.',
          multiline: true,
        }),
        dateISO: fields.date({
          label: 'Event date',
          description: 'Pick the day of the event. The site writes it out as “Friday, April 23, 2027”.',
          defaultValue: '2027-04-23',
          validation: { isRequired: true },
        }),
        doorsTime: timeField('Doors open at'),
        talksTime: timeField('Talks start at'),
        endTime: timeField('Event ends at'),
        timesNote: fields.text({
          label: 'Note about the times (optional)',
          description:
            'One short sentence shown wherever the times appear (Schedule, Venue), e.g. “Times are approximate and may shift slightly.” Leave blank once the times are final.',
          multiline: true,
          validation: { length: { max: 240 } },
        }),
        capacity: fields.integer({
          label: 'Seat capacity (a whole number from 1 to 100)',
          description:
            'Required. How many guests the event can seat, e.g. 100. Shown in the hero, Venue, Tickets (the seat ruler draws one tick per seat), the Partners page, the share image and search descriptions. TEDx rules cap a standard licence at 100 attendees, so it can never be more than 100. Lower it only if the room is smaller.',
          defaultValue: TEDX_MAX_CAPACITY,
          validation: { isRequired: true, min: 1, max: TEDX_MAX_CAPACITY },
        }),
        accentColor: fields.text({
          label: 'Accent colour',
          description: 'The single red used for buttons and small details. Keep the TEDx red #EB0028 unless told otherwise.',
          defaultValue: '#EB0028',
          validation: { pattern: { regex: /^#[0-9a-fA-F]{6}$/, message: 'Use a 6-digit hex colour like #EB0028.' } },
        }),
      },
    }),

    themeCopy: singleton({
      label: 'Theme copy (headings and short lines)',
      path: 'content/theme-copy',
      schema: {
        heroFootnote: copyField('heroFootnote', 'Home: caption under the hero', `A short line in small capitals at the bottom of the first screen. ${BLANK_HIDES}`),
        heroScrollCue: copyField('heroScrollCue', 'Home: scroll hint', `Small text bottom right of the first screen on computers. ${BLANK_RESTORES}`),
        themeHeading: copyField('themeHeading', 'Home: theme section heading', `The big heading above the Theme story. Keep it short (two to five words). ${BLANK_RESTORES}`),
        themeFigureCaption: copyField('themeFigureCaption', 'Home: caption of the engraved microphone', `Shown after “Fig. 1” while the 3D microphone is on screen (only with animations on). ${BLANK_RESTORES}`),
        themeFootnote: copyField('themeFootnote', 'Home: footnote under the theme story', `Shown after a small red “*”. ${BLANK_HIDES}`),
        speakersEmptyHeading: copyField('speakersEmptyHeading', 'Speakers heading while none is announced', `Home page and /speakers. Once a speaker is announced the heading becomes “Meet the speakers.” ${BLANK_RESTORES}`),
        scheduleEmptyHeading: copyField('scheduleEmptyHeading', 'Schedule: line while the running order is hidden', BLANK_RESTORES),
        scheduleEmptyNote: copyField('scheduleEmptyNote', 'Schedule: note while the running order is hidden', BLANK_RESTORES, { multiline: true }),
        newsletterHeading: copyField('newsletterHeading', 'Home: closing mailing-list heading', `The huge heading at the bottom of the home page. ${BLANK_RESTORES}`),
        partnerBandHeading: copyField('partnerBandHeading', 'Home: partner invitation heading', `The “For organizations” block near the bottom of the home page. ${BLANK_RESTORES}`),
        partnerBandBody: copyField('partnerBandBody', 'Home: partner invitation text', `${PLACEHOLDERS} ${BLANK_RESTORES}`, { multiline: true }),
        partnersHeading: copyField('partnersHeading', 'Partners page: heading', BLANK_RESTORES),
        partnersIntro: copyField('partnersIntro', 'Partners page: introduction', `Follows “Become a partner of ${SITE_NAME}.” ${PLACEHOLDERS} ${BLANK_RESTORES}`, { multiline: true }),
        partnersDescription: copyField('partnersDescription', 'Partners page: search and link-preview description', `About 160 characters. ${PLACEHOLDERS} ${BLANK_RESTORES}`, { multiline: true }),
        partnersEditionFigure: copyField('partnersEditionFigure', 'Partners page: first card, big figure', 'A year or a short number, e.g. 2020. Keep it to four or five characters. Only shown with a card title.'),
        partnersEditionTitle: copyField('partnersEditionTitle', 'Partners page: first card, title', `The first card under “What your support makes possible”, e.g. “The first since 2020.” ${BLANK_HIDES}`),
        partnersEditionBody: copyField('partnersEditionBody', 'Partners page: first card, text', PLACEHOLDERS, { multiline: true }),
        notFoundHeading: copyField('notFoundHeading', 'Page not found (404): heading', BLANK_RESTORES),
        notFoundBody: copyField('notFoundBody', 'Page not found (404): text', BLANK_RESTORES),
        footerSignoff: copyField('footerSignoff', 'Footer: sign-off (top right)', `One or two short lines. ${BLANK_RESTORES}`, { multiline: true }),
        transitionCaption: copyField('transitionCaption', 'Page change: caption', `One word shown between “§” and “…” while the page changes (only with animations on). ${BLANK_RESTORES}`),
      },
    }),

    venue: singleton({
      label: 'Venue & directions',
      path: 'content/venue',
      schema: {
        venueName: fields.text({
          label: 'Venue (building) name',
          defaultValue: 'Locatelli Student Activity Center',
          validation: { isRequired: true },
        }),
        campus: fields.text({ label: 'Campus', defaultValue: 'Santa Clara University' }),
        addressLabel: fields.text({
          label: 'Address label',
          description:
            'A short note shown above the address so visitors know what it is. If you only have the university’s main address (not the building’s own), say so here.',
          defaultValue: 'University main address',
        }),
        street: fields.text({ label: 'Street address', description: 'e.g. 500 El Camino Real' }),
        city: fields.text({ label: 'City', defaultValue: 'Santa Clara' }),
        region: fields.text({ label: 'State', description: 'Two letters, e.g. CA', defaultValue: 'CA' }),
        postalCode: fields.text({ label: 'ZIP code' }),
        mapUrl: urlField(
          'Map link',
          'A link that opens the venue in a maps app (for example a Google Maps search link). The site never embeds a map.',
        ),
        latitude: fields.text({
          label: 'Latitude (optional)',
          description: 'Decimal degrees, e.g. 37.3496. Shown as a design detail only. Leave blank to hide the coordinates.',
          validation: { pattern: { regex: /^$|^-?\d{1,2}(\.\d+)?$/, message: 'Use a decimal number like 37.3496, or leave it blank.' } },
        }),
        longitude: fields.text({
          label: 'Longitude (optional)',
          description: 'Decimal degrees, west is negative, e.g. -121.9390.',
          validation: { pattern: { regex: /^$|^-?\d{1,3}(\.\d+)?$/, message: 'Use a decimal number like -121.9390, or leave it blank.' } },
        }),
        coordinatesNote: fields.text({
          label: 'Coordinates caption',
          description: 'Tiny caption under the coordinates, e.g. “Campus, approximate”.',
          defaultValue: 'Campus, approximate',
        }),
        notes: fields.array(
          fields.object({
            title: fields.text({ label: 'Heading', description: 'e.g. Directions, Parking, Accessibility' }),
            body: fields.text({
              label: 'Details',
              description: `What a guest needs to know. ${LEAVE_BLANK}`,
              multiline: true,
            }),
          }),
          {
            label: 'Getting there (directions, parking, accessibility)',
            description: 'Each item is shown as a numbered clause in the Venue section. Leave the details empty to show “To be announced”.',
            itemLabel: (props) => props.fields.title.value || 'Note',
          },
        ),
      },
    }),

    tickets: singleton({
      label: 'Tickets & speaker applications',
      path: 'content/tickets',
      schema: {
        ticketState: fields.select({
          label: 'Ticket status',
          description:
            'Controls the Tickets section and every Tickets button. “On sale” only shows the buy button when a ticket link is filled in below.',
          options: [
            { label: 'Coming soon (not on sale yet)', value: 'coming-soon' },
            { label: 'On sale', value: 'on-sale' },
            { label: 'Sold out', value: 'sold-out' },
            { label: 'Closed (sales have ended)', value: 'closed' },
          ],
          defaultValue: 'coming-soon',
        }),
        ticketUrl: urlField('Ticket link', 'Where the “Get tickets” button goes, e.g. the ticketing page.'),
        ticketEmbedUrl: urlField(
          'Ticket checkout embed link (optional)',
          'Only if the ticketing service gives you an “embed” link. Shown in a box under the button while tickets are on sale. Leave blank if unsure.',
        ),
        ticketPriceNote: fields.text({
          label: 'Price note',
          description: 'One short sentence about price. Our cap is $100; confirm the limit for our licence tier with the licence holder.',
          defaultValue: 'Tickets will cost no more than $100.',
        }),
        ticketPrice: fields.number({
          label: 'Ticket price in US dollars (optional)',
          description:
            'Just the number, e.g. 25 (or 0 for free). TEDx rules cap tickets at $100, so it cannot be more than 100. Used by search engines once tickets are on sale; the visible wording is the Price note above. Leave blank until the price is set.',
          validation: { min: 0, max: 100 },
        }),
        ticketSaleExpected: fields.text({
          label: 'Expected on-sale month (optional)',
          description:
            'While tickets are Coming soon and there is no exact date yet, e.g. February 2027. The site then says “Tickets are expected to go on sale in February 2027.” Leave blank to say nothing. Search engines never see it.',
          validation: { length: { max: 40 } },
        }),
        ticketSaleStart: fields.date({
          label: 'Tickets on sale from (optional)',
          description: 'The first day of ticket sales. Used by search engines once tickets are on sale. Leave blank if unsure.',
        }),
        speakerApplicationsState: fields.select({
          label: 'Speaker applications',
          options: [
            { label: 'Coming soon', value: 'coming-soon' },
            { label: 'Open', value: 'open' },
            { label: 'Closed', value: 'closed' },
          ],
          defaultValue: 'coming-soon',
        }),
        speakerApplicationsUrl: urlField(
          'Speaker application link',
          'The application form. The “Apply to speak” button only appears when applications are Open and this is filled in.',
        ),
        speakerApplicationsDeadline: fields.text({
          label: 'Application deadline (optional)',
          description: `Written as you want it shown, e.g. January 15, 2027. ${LEAVE_BLANK}`,
        }),
        interestUrl: urlField(
          'Interest form link (speak or get involved)',
          'The club’s interest form: register interest in speaking, join the contact list, help organize. While speaker applications are not open, the Speakers section and /speakers show “Want to speak? Register your interest” with this link, and /team shows “Get involved”. It opens in a new tab. If you change it, also update the FAQ answers that mention it.',
        ),
      },
    }),

    contact: singleton({
      label: 'Contact, newsletter & socials',
      path: 'content/contact',
      schema: {
        newsletterUrl: urlField(
          'Newsletter sign-up link (SendFox)',
          'The SendFox form link. While blank, the site shows “list opening soon” instead of a button.',
        ),
        contactEmail: emailField('Contact email', 'General questions. Shown in the footer and FAQ when filled in.'),
        partnershipsEmail: emailField(
          'Partnerships email',
          'Used by every “Become a partner” button. While blank, those buttons link to tedxscu.com.',
        ),
        livestreamUrl: urlField(
          'Livestream link (optional)',
          'Only if the event is streamed, e.g. the YouTube live page. When filled in, a “Watch live” link appears in the hero and the Tickets section (it opens in a new tab). Leave blank to show nothing. The stream must be free. Do not stream if any TED Talk videos are shown in the programme; confirm with the licence holder first.',
        ),
        socials: fields.object(
          {
            instagram: urlField('Instagram', 'Full link, e.g. https://www.instagram.com/…'),
            linkedin: urlField('LinkedIn', 'Full link to the page.'),
            youtube: urlField(
              'YouTube',
              'Full link to the channel. Club channel only. Full TEDx talks may only be published through TED’s uploader, never on this channel.',
            ),
            tiktok: urlField('TikTok', 'Full link to the profile.'),
          },
          { label: 'Social links', description: 'Only filled-in links are shown.' },
        ),
      },
    }),

    sections: singleton({
      label: 'Show / hide sections',
      path: 'content/sections',
      schema: {
        showTeam: fields.checkbox({
          label: 'Show the Team section on the home page (it appears once at least one name is public)',
          defaultValue: true,
        }),
        showFaq: fields.checkbox({
          label: 'Show the FAQ section on the home page',
          defaultValue: true,
        }),
        showSpeakerApplications: fields.checkbox({
          label: 'Show speaker applications (in the Speakers section)',
          defaultValue: true,
        }),
        showYearRound: fields.checkbox({
          label: 'Show the “All year, not one night” card on the Partners page',
          description:
            'Says the student club runs a speaker workshop series and general-meeting events through the year (it never calls them TEDx events). Keep it on while the partner tiers include year-round benefits. The licence covers the April event; general-meeting events are not automatically TEDx events, so check with the Director of Compliance before changing that wording.',
          defaultValue: false,
        }),
      },
    }),

    tedLanguage: singleton({
      label: 'Required TED language',
      path: 'content/ted-language',
      schema: {
        aboutTedx: fields.text({
          label: 'About TEDx',
          description:
            'Shown in the footer of every page under “About TEDx”. Paste the current official text from TED’s TEDx organizer guide exactly. Do not edit the wording.',
          multiline: true,
          validation: TED_TEXT_VALIDATION,
        }),
        aboutTed: fields.text({
          label: 'About TED',
          description:
            'Shown in the footer of every page under “About TED”. Paste the current official text from TED’s TEDx organizer guide exactly. Do not edit the wording.',
          multiline: true,
          validation: TED_TEXT_VALIDATION,
        }),
      },
    }),

    schedule: singleton({
      label: 'Schedule',
      path: 'content/schedule',
      schema: {
        published: fields.checkbox({
          label: 'Show the running order',
          description: 'Leave unticked to show “schedule coming soon” instead of the items below.',
          defaultValue: false,
        }),
        items: fields.array(
          fields.object({
            time: fields.text({ label: 'Time', description: 'Shown as typed, e.g. 5:30 PM, or TBA.' }),
            title: fields.text({ label: 'Title' }),
            description: fields.text({ label: 'Description (optional)', multiline: true }),
            kind: fields.select({
              label: 'Kind',
              description: 'The small label shown next to the item on the site. Use Reception for doors with drinks or food, and Program for anything else (welcome, closing).',
              options: [
                { label: SCHEDULE_KIND_LABEL.talk, value: 'talk' },
                { label: SCHEDULE_KIND_LABEL.break, value: 'break' },
                { label: SCHEDULE_KIND_LABEL.doors, value: 'doors' },
                { label: SCHEDULE_KIND_LABEL.reception, value: 'reception' },
                { label: SCHEDULE_KIND_LABEL.other, value: 'other' },
              ],
              defaultValue: 'talk',
            }),
          }),
          { label: 'Running order', itemLabel: (props) => props.fields.title.value || 'Item' },
        ),
      },
    }),

    faq: singleton({
      label: 'FAQ',
      path: 'content/faq',
      schema: {
        items: fields.array(
          fields.object({
            question: fields.text({ label: 'Question', validation: { isRequired: true } }),
            answer: fields.text({
              label: 'Answer',
              description:
                'Plain text. Line breaks are kept. Instead of typing details that may change, write a placeholder and the site fills it in: {date} (the event date, e.g. Friday, April 23, 2027), {venue} (the building), {campus} (e.g. Santa Clara University), {capacity} (the seat count), {eventName} (TEDxSantaClaraUniversity) and {interestUrl} (the Interest form link under Tickets & applications; it becomes a link). They also work in the question.',
              multiline: true,
              validation: { isRequired: true },
            }),
          }),
          {
            label: 'Questions',
            description:
              'To reorder, drag the handle, or focus it and press Enter, then the arrow keys, then Enter. Each one is numbered as a clause (§ 7.01, § 7.02 …). Answers can use placeholders such as {date}, {venue}, {campus}, {capacity}, {eventName} and {interestUrl}, filled in from Event basics, Venue and Tickets & applications; open a question to see what each one means.',
            itemLabel: (props) => props.fields.question.value || 'Question',
          },
        ),
      },
    }),

    benefits: singleton({
      label: 'Partner benefits',
      path: 'content/benefits',
      schema: {
        items: fields.array(
          fields.object({
            benefit: fields.text({
              label: 'Benefit',
              description:
                'One line, e.g. “Reserved seats” or “Logo on the thank-you slide”. Only list benefits allowed by TEDx rules (no stage time, no say over the programme).',
              validation: { isRequired: true },
            }),
            group: fields.select({
              label: 'Heading',
              description: 'Which heading of the comparison table this benefit sits under. Benefits keep the order of this list within each heading.',
              options: [
                { label: BENEFIT_GROUP_LABEL.web, value: 'web' },
                { label: `${BENEFIT_GROUP_LABEL.event} (the site adds the date, e.g. “At the April 23 event”)`, value: 'event' },
                { label: BENEFIT_GROUP_LABEL.year, value: 'year' },
              ],
              defaultValue: 'event',
            }),
            included: fields.array(
              fields.object({
                tier: fields.relationship({
                  label: 'Tier',
                  description: 'Click the box and pick the tier; tiers are listed by their slug, e.g. cornerstone-partner.',
                  collection: 'tiers',
                }),
                detail: fields.text({
                  label: 'What this tier gets (optional)',
                  description:
                    'A word or two shown in the table for this tier, e.g. “Largest logo”, “Named”, “4”. Leave blank for a plain “included” dot.',
                  validation: { length: { max: 40 } },
                }),
              }),
              {
                label: 'Tiers that include it',
                description:
                  'Click Add once for each tier that gets this benefit. A tier that is not listed shows a dash (not included).',
                itemLabel: (props) =>
                  [props.fields.tier.value ?? 'Tier', props.fields.detail.value].filter(Boolean).join(': '),
              },
            ),
            toBeConfirmed: fields.checkbox({
              label: 'Still to be confirmed',
              description:
                'Tick while the benefit still needs a yes from TED or the venue (ask the Director of Compliance). The table then shows a small “to be confirmed” note next to it.',
              defaultValue: false,
            }),
          }),
          {
            label: 'Benefits comparison',
            description:
              'Rows of the comparison table on /partners. While this list is empty, the page says the schedule of benefits is being finalized.',
            itemLabel: (props) => props.fields.benefit.value || 'Benefit',
          },
        ),
        notes: fields.array(
          fields.text({
            label: 'Line',
            description: 'One short sentence, e.g. “Amounts are per academic year.”',
            multiline: true,
            validation: { length: { max: 300 } },
          }),
          {
            label: 'Small print under the tiers',
            description:
              'Short sentences shown as numbered terms under the partnership tiers on /partners: what the amounts cover, deadlines, in-kind support. Leave the list empty to show none.',
            itemLabel: (props) => props.value || 'Line',
          },
        ),
      },
    }),
  },

  collections: {
    speakers: collection({
      label: 'Speakers',
      path: 'content/speakers/*',
      slugField: 'name',
      columns: ['name', 'announced', 'order'],
      schema: {
        name: fields.slug({
          name: { label: 'Name', description: 'Full name as it should appear on the site.' },
          slug: slugPart(
            'Page address (slug)',
            'Becomes /speakers/<slug>. After typing the Name, click Regenerate; set it once when announcing and avoid changing it afterwards.',
          ),
        }),
        announced: fields.checkbox({
          label: 'Announced',
          description:
            'Unticked = shown as “Speaker to be announced” everywhere (name, photo and bio stay hidden and the page is hidden from search engines). Tick it on announcement day.',
          defaultValue: false,
        }),
        role: fields.text({ label: 'Role / affiliation', description: 'e.g. Professor of Bioengineering, Santa Clara University' }),
        talkTitle: fields.text({ label: 'Talk title', description: 'Leave blank until the title is confirmed.' }),
        shortBio: fields.text({
          label: 'Short bio',
          description: 'One or two sentences. Used on the card and in search results.',
          multiline: true,
          validation: { length: { max: 300 } },
        }),
        bio: fields.text({
          label: 'Full bio',
          description: 'Shown on the speaker’s own page. Separate paragraphs with an empty line.',
          multiline: true,
        }),
        photo: fields.image({
          label: 'Portrait',
          description:
            'A portrait photo: JPG or PNG (WebP also works; not HEIC, not PDF, not SVG), under 2 MB, ideally about 1200×1500 px (4:5). It is shown in black and white. A file of the wrong type is left out and the page shows “Portrait to follow”.',
          directory: 'public/images/speakers',
          publicPath: '/images/speakers/',
        }),
        link: urlField('Personal link (optional)', 'One link, e.g. their website or LinkedIn.'),
        linkLabel: fields.text({
          label: 'Link label',
          description: 'What the link says, e.g. Website, LinkedIn. Defaults to “Website”.',
        }),
        order: fields.integer({
          label: 'Order',
          description: 'Lower numbers come first.',
          defaultValue: 0,
          validation: { min: 0 },
        }),
        published: fields.checkbox({
          label: 'Published',
          description: 'Untick to remove this entry from the site entirely.',
          defaultValue: true,
        }),
      },
    }),

    team: collection({
      label: 'Team',
      path: 'content/team/*',
      slugField: 'role',
      columns: ['role', 'name', 'order'],
      schema: {
        role: fields.slug({
          name: { label: 'Role', description: 'e.g. VP of Production' },
          slug: slugPart('File name (slug)', 'Made from the role. Leave it as generated.'),
        }),
        name: fields.text({ label: 'Name (optional)', description: 'Only shown when “Show name publicly” is ticked.' }),
        showName: fields.checkbox({
          label: 'Show name publicly',
          description:
            'Ask the person first. Unticked = only the role is shown, on /team only. Ticked: the name and the details below appear on the home page and /team.',
          defaultValue: false,
        }),
        major: fields.text({
          label: 'Major (optional)',
          description: 'As it should appear, e.g. Mechanical Engineering. Minors can be left out to keep it short.',
          validation: { length: { max: 80 } },
        }),
        classYear: fields.integer({
          label: 'Class year (optional)',
          description: 'The graduation year as four digits, e.g. 2029. Shown as “Class of 2029”. Leave blank to hide.',
          validation: { min: CLASS_YEAR_MIN, max: CLASS_YEAR_MAX },
        }),
        linkedin: urlField(
          'LinkedIn profile (optional)',
          'The person’s own LinkedIn page, e.g. https://www.linkedin.com/in/their-name. Opens in a new tab. Never add a personal email address or phone number anywhere on the site.',
        ),
        photo: fields.image({
          label: 'Photo (optional)',
          description:
            'Portrait headshot in a 4:5 shape (taller than wide), about 960×1200 px: JPG or PNG under 2 MB (not HEIC, not PDF, not SVG). Head and shoulders, the face in the upper third, so the board lines up. Shown in black and white, in colour on hover or tap, only together with the name. Without a photo the site shows the person’s initials in the same frame.',
          directory: 'public/images/team',
          publicPath: '/images/team/',
        }),
        level: fields.select({
          label: 'Level',
          description:
            'Which group the person appears in on the home page and /team: President (shown first, larger), Executive board, or Operations. Leave it on Automatic: a role called President goes first, “VP of …” or “Vice President …” goes to the executive board, and every other role (the directors) to operations. Pick a level only when the role name says otherwise.',
          options: [...TEAM_LEVEL_OPTIONS],
          defaultValue: 'auto',
        }),
        order: fields.integer({ label: 'Order', description: 'Lower numbers come first within each level.', defaultValue: 0 }),
      },
    }),

    tiers: collection({
      label: 'Partner tiers',
      path: 'content/tiers/*',
      slugField: 'name',
      columns: ['name', 'order'],
      schema: {
        name: fields.slug({
          name: { label: 'Tier name', description: 'e.g. Cornerstone Partner' },
          slug: slugPart(
            'Slug',
            'Made from the tier name. Leave it as generated: partner benefits and logos refer to the tier by it (e.g. cornerstone-partner).',
          ),
        }),
        description: fields.text({ label: 'Description', description: 'One or two sentences.', multiline: true }),
        amount: fields.text({
          label: 'Contribution (optional)',
          description: 'Written as you want it shown, e.g. $2,500. Leave blank while packages are in draft; the amount is then hidden.',
        }),
        slots: fields.integer({
          label: 'Number of slots (optional)',
          description:
            'How many partners this tier can have, shown as “1 available”. Leave blank for no limit: once a Contribution is filled in, the site then shows “Open”.',
          validation: { min: 1 },
        }),
        order: fields.integer({ label: 'Order', description: 'Lower numbers come first.', defaultValue: 0 }),
      },
    }),

    sponsors: collection({
      label: 'Partners (logos)',
      path: 'content/sponsors/*',
      slugField: 'name',
      columns: ['name', 'tier', 'published'],
      schema: {
        name: fields.slug({
          name: { label: 'Organization name' },
          slug: slugPart('File name (slug)', 'Made from the name. Leave it as generated.'),
        }),
        tier: fields.relationship({
          label: 'Tier',
          description: 'Tiers are listed by their slug, e.g. cornerstone-partner for Cornerstone Partner.',
          collection: 'tiers',
        }),
        logo: fields.image({
          label: 'Logo',
          description:
            'A white or light version on a transparent background (PNG or SVG, under 2 MB). Shown on /partners only, at most 24 px tall and 72 px wide, always smaller than the event logo. No tobacco, weapons/ammunition or adult-product companies, and none of TED’s prohibited sponsors. Sponsors can never be speakers.',
          directory: 'public/images/sponsors',
          publicPath: '/images/sponsors/',
        }),
        url: urlField('Website', 'Optional link to their website.'),
        published: fields.checkbox({
          label: 'Published',
          description: 'Only tick once the partnership is signed and the logo is approved.',
          defaultValue: false,
        }),
      },
    }),
  },
});
