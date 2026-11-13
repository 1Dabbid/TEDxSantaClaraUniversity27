import { collection, config, fields, singleton } from '@keystatic/core';
import { TEDX_MAX_CAPACITY } from './src/lib/site';

/**
 * Keystatic content model: what student editors see at /keystatic.
 *
 * Every label and description here is written for someone who has never seen
 * the code. Each save writes a YAML file under /content (or an image under
 * public/images/...). Pages read content only through src/lib/content.ts.
 *
 * Storage: local files by default. When the Keystatic GitHub App env vars are
 * present (NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG is the one visible to the
 * browser), storage switches to GitHub so editors on the deployed site commit
 * straight to the repo. See README.md.
 */
const useGithub = Boolean(process.env.NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG);

const LEAVE_BLANK = 'Leave blank until it is confirmed. The site shows “to be announced” instead.';
const EMAIL = /^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIME = /^$|^\d{1,2}:\d{2}\s?(AM|PM)$/i;

const urlField = (label: string, description: string) => fields.url({ label, description });

const emailField = (label: string, description: string) =>
  fields.text({
    label,
    description,
    validation: { pattern: { regex: EMAIL, message: 'Use a full email address, like name@example.com, or leave it blank.' } },
  });

const timeField = (label: string) =>
  fields.text({
    label,
    description: `Write it like 5:30 PM. ${LEAVE_BLANK}`,
    validation: { pattern: { regex: TIME, message: 'Write the time like 5:30 PM, or leave it blank.' } },
  });

export default config({
  storage: useGithub
    ? { kind: 'github', repo: { owner: '1Dabbid', name: 'TEDxSantaClaraUniversity27' } }
    : { kind: 'local' },
  ui: {
    brand: { name: 'TEDxSantaClaraUniversity' },
    navigation: {
      'The event': ['settings', 'venue', 'tickets', 'schedule', 'faq'],
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
        eventName: fields.text({
          label: 'Event name',
          description: 'Always the full name: TEDxSantaClaraUniversity. Do not shorten it.',
          defaultValue: 'TEDxSantaClaraUniversity',
          validation: { isRequired: true },
        }),
        themeName: fields.text({
          label: 'Theme name',
          description: 'The big title on the home page, e.g. Fine Print. Keep it short.',
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
        dateISO: fields.text({
          label: 'Event date',
          description: 'Year-month-day, e.g. 2027-04-23. The site writes it out as “Friday, April 23, 2027”.',
          defaultValue: '2027-04-23',
          validation: { pattern: { regex: /^\d{4}-\d{2}-\d{2}$/, message: 'Write the date as YYYY-MM-DD, e.g. 2027-04-23.' } },
        }),
        doorsTime: timeField('Doors open at'),
        talksTime: timeField('Talks start at'),
        endTime: timeField('Event ends at'),
        capacity: fields.integer({
          label: 'Seat capacity',
          description:
            'How many guests the event can seat. Shown in the hero, Venue, Tickets (the seat ruler draws one tick per seat), the Partners page, the share image and search descriptions. TEDx rules cap a standard licence at 100 attendees, so it can never be more than 100. Lower it only if the room is smaller.',
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
            'Only turn on if TED has confirmed the club’s year-round events may use the TEDx name. The licence covers the mainstage event; general-meeting events are not automatically TEDx events.',
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
          validation: { isRequired: true },
        }),
        aboutTed: fields.text({
          label: 'About TED',
          description:
            'Shown in the footer of every page under “About TED”. Paste the current official text from TED’s TEDx organizer guide exactly. Do not edit the wording.',
          multiline: true,
          validation: { isRequired: true },
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
            time: fields.text({ label: 'Time', description: 'e.g. 5:30 PM, or TBA' }),
            title: fields.text({ label: 'Title' }),
            description: fields.text({ label: 'Description (optional)', multiline: true }),
            kind: fields.select({
              label: 'Kind',
              options: [
                { label: 'Talk', value: 'talk' },
                { label: 'Break', value: 'break' },
                { label: 'Doors', value: 'doors' },
                { label: 'Other', value: 'other' },
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
                'Plain text. Line breaks are kept. Write {capacity} where the seat count belongs; the site fills in the number from Event basics.',
              multiline: true,
              validation: { isRequired: true },
            }),
          }),
          {
            label: 'Questions',
            description: 'Drag to reorder. Each one is numbered as a clause (§ 7.01, § 7.02 …).',
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
                'One line, e.g. “Logo on the thank-you slide”. Only list benefits allowed by TEDx rules (no stage time, no say over the programme).',
              validation: { isRequired: true },
            }),
            tiers: fields.multiRelationship({
              label: 'Included in these tiers',
              collection: 'tiers',
            }),
          }),
          {
            label: 'Benefits comparison',
            description:
              'Rows of the comparison table on /partners. While this list is empty, the page says the schedule of benefits is being finalized.',
            itemLabel: (props) => props.fields.benefit.value || 'Benefit',
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
          slug: {
            label: 'Page address (slug)',
            description: 'Becomes /speakers/<slug>. Set it once when announcing and avoid changing it afterwards.',
          },
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
          description: 'A portrait photo, ideally 1200×1500 px or larger (4:5). It is shown in black and white.',
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
        role: fields.slug({ name: { label: 'Role', description: 'e.g. VP of Production' } }),
        name: fields.text({ label: 'Name (optional)', description: 'Only shown when “Show name publicly” is ticked.' }),
        showName: fields.checkbox({
          label: 'Show name publicly',
          description: 'Ask the person first. Unticked = only the role is shown.',
          defaultValue: false,
        }),
        photo: fields.image({
          label: 'Photo (optional)',
          description: 'Square headshot. Only shown together with the name.',
          directory: 'public/images/team',
          publicPath: '/images/team/',
        }),
        order: fields.integer({ label: 'Order', description: 'Lower numbers come first.', defaultValue: 0 }),
      },
    }),

    tiers: collection({
      label: 'Partner tiers',
      path: 'content/tiers/*',
      slugField: 'name',
      columns: ['name', 'order'],
      schema: {
        name: fields.slug({ name: { label: 'Tier name', description: 'e.g. Founding Partner' } }),
        description: fields.text({ label: 'Description', description: 'One or two sentences.', multiline: true }),
        amount: fields.text({
          label: 'Contribution (optional)',
          description: 'Written as you want it shown, e.g. $2,500. Leave blank while packages are in draft; the amount is then hidden.',
        }),
        slots: fields.integer({
          label: 'Number of slots (optional)',
          description: 'How many partners this tier can have. Leave blank to hide.',
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
        name: fields.slug({ name: { label: 'Organization name' } }),
        tier: fields.relationship({ label: 'Tier', collection: 'tiers' }),
        logo: fields.image({
          label: 'Logo',
          description:
            'A white or light version on a transparent background (PNG or SVG). Shown on /partners only, at most 24 px tall and 72 px wide, always smaller than the event logo. No tobacco, weapons/ammunition or adult-product companies, and none of TED’s prohibited sponsors. Sponsors can never be speakers.',
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
