import { collection, config, fields, singleton } from '@keystatic/core';

/**
 * Keystatic content model.
 *
 * Storage: local files by default. When the Keystatic GitHub App env vars are
 * present (NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG is the one visible to the
 * browser), storage switches to GitHub so editors on the deployed site commit
 * straight to the repo. See README.md.
 */
const useGithub = Boolean(process.env.NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG);

const stateField = <T extends string>(
  label: string,
  options: readonly { label: string; value: T }[],
  defaultValue: T,
) => fields.select({ label, options, defaultValue });

export default config({
  storage: useGithub
    ? { kind: 'github', repo: { owner: '1Dabbid', name: 'TEDxSantaClaraUniversity27' } }
    : { kind: 'local' },
  ui: {
    brand: { name: 'TEDxSantaClaraUniversity' },
    navigation: {
      Event: ['settings', 'schedule', 'faq'],
      People: ['speakers', 'team'],
      Partners: ['sponsors', 'tiers'],
    },
  },
  singletons: {
    settings: singleton({
      label: 'Event settings',
      path: 'content/settings',
      schema: {
        eventName: fields.text({ label: 'Event name', defaultValue: 'TEDxSantaClaraUniversity' }),
        themeName: fields.text({ label: 'Theme name', defaultValue: 'Fine Print' }),
        themeTagline: fields.text({ label: 'Theme tagline' }),
        themeStory: fields.text({
          label: 'Theme story',
          description: 'Longer text. Separate paragraphs with a blank line.',
          multiline: true,
        }),
        dateISO: fields.text({
          label: 'Event date (YYYY-MM-DD)',
          defaultValue: '2027-04-23',
          validation: { pattern: { regex: /^\d{4}-\d{2}-\d{2}$/, message: 'Use YYYY-MM-DD' } },
        }),
        doorsTime: fields.text({ label: 'Doors time (e.g. 5:30 PM). Leave blank until confirmed.' }),
        endTime: fields.text({ label: 'End time (e.g. 9:00 PM). Leave blank until confirmed.' }),
        venueName: fields.text({ label: 'Venue name' }),
        venueAddress: fields.text({ label: 'Venue address', multiline: true }),
        mapUrl: fields.text({ label: 'Map link (URL)' }),
        directionsNotes: fields.text({ label: 'Directions / parking notes', multiline: true }),
        ticketState: stateField(
          'Ticket state',
          [
            { label: 'Coming soon', value: 'coming-soon' },
            { label: 'On sale', value: 'on-sale' },
            { label: 'Sold out', value: 'sold-out' },
            { label: 'Closed', value: 'closed' },
          ] as const,
          'coming-soon',
        ),
        ticketUrl: fields.text({ label: 'Ticket URL' }),
        ticketEmbedUrl: fields.text({ label: 'Ticket embed URL (optional iframe src)' }),
        ticketPriceNote: fields.text({ label: 'Ticket price note' }),
        speakerApplicationsState: stateField(
          'Speaker applications',
          [
            { label: 'Coming soon', value: 'coming-soon' },
            { label: 'Open', value: 'open' },
            { label: 'Closed', value: 'closed' },
          ] as const,
          'coming-soon',
        ),
        speakerApplicationsUrl: fields.text({ label: 'Speaker application URL' }),
        newsletterUrl: fields.text({ label: 'Newsletter signup URL (SendFox form link)' }),
        contactEmail: fields.text({ label: 'Contact email' }),
        partnershipsEmail: fields.text({ label: 'Partnerships email' }),
        livestreamUrl: fields.text({ label: 'Livestream URL (optional)' }),
        socials: fields.object(
          {
            instagram: fields.text({ label: 'Instagram URL' }),
            linkedin: fields.text({ label: 'LinkedIn URL' }),
            youtube: fields.text({ label: 'YouTube URL' }),
            tiktok: fields.text({ label: 'TikTok URL' }),
          },
          { label: 'Social links' },
        ),
        accentColor: fields.text({
          label: 'Accent colour (hex)',
          defaultValue: '#EB0028',
          validation: { pattern: { regex: /^#[0-9a-fA-F]{6}$/, message: 'Use a 6-digit hex colour' } },
        }),
      },
    }),
    schedule: singleton({
      label: 'Schedule',
      path: 'content/schedule',
      schema: {
        published: fields.checkbox({
          label: 'Published',
          description: 'Leave unchecked to show “coming soon” instead of the running order.',
          defaultValue: false,
        }),
        items: fields.array(
          fields.object({
            time: fields.text({ label: 'Time' }),
            title: fields.text({ label: 'Title' }),
            description: fields.text({ label: 'Description', multiline: true }),
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
          { label: 'Items', itemLabel: (props) => props.fields.title.value || 'Item' },
        ),
      },
    }),
    faq: singleton({
      label: 'FAQ',
      path: 'content/faq',
      schema: {
        items: fields.array(
          fields.object({
            question: fields.text({ label: 'Question' }),
            answer: fields.text({ label: 'Answer', multiline: true }),
          }),
          { label: 'Questions', itemLabel: (props) => props.fields.question.value || 'Question' },
        ),
      },
    }),
  },
  collections: {
    speakers: collection({
      label: 'Speakers',
      path: 'content/speakers/*',
      slugField: 'name',
      columns: ['name', 'order'],
      schema: {
        name: fields.slug({ name: { label: 'Name' }, slug: { label: 'Slug (URL)' } }),
        announced: fields.checkbox({
          label: 'Announced',
          description:
            'Unchecked = shown as a “Speaker to be announced” placeholder card (name, photo and bio are hidden).',
          defaultValue: false,
        }),
        role: fields.text({ label: 'Role / affiliation' }),
        talkTitle: fields.text({ label: 'Talk title' }),
        shortBio: fields.text({ label: 'Short bio (1–2 sentences)', multiline: true }),
        bio: fields.text({
          label: 'Bio',
          description: 'Separate paragraphs with a blank line.',
          multiline: true,
        }),
        photo: fields.image({
          label: 'Photo',
          directory: 'public/images/speakers',
          publicPath: '/images/speakers/',
        }),
        order: fields.integer({ label: 'Order', defaultValue: 0 }),
        published: fields.checkbox({ label: 'Published', defaultValue: true }),
      },
    }),
    team: collection({
      label: 'Team',
      path: 'content/team/*',
      slugField: 'role',
      columns: ['role', 'order'],
      schema: {
        role: fields.slug({ name: { label: 'Role' } }),
        name: fields.text({ label: 'Name (optional)' }),
        showName: fields.checkbox({ label: 'Show name publicly', defaultValue: false }),
        photo: fields.image({
          label: 'Photo (optional)',
          directory: 'public/images/team',
          publicPath: '/images/team/',
        }),
        order: fields.integer({ label: 'Order', defaultValue: 0 }),
      },
    }),
    tiers: collection({
      label: 'Partner tiers',
      path: 'content/tiers/*',
      slugField: 'name',
      columns: ['name', 'order'],
      schema: {
        name: fields.slug({ name: { label: 'Tier name' } }),
        description: fields.text({ label: 'Description', multiline: true }),
        amount: fields.text({ label: 'Amount (optional, leave blank while draft)' }),
        slots: fields.integer({ label: 'Slots (optional)' }),
        order: fields.integer({ label: 'Order', defaultValue: 0 }),
      },
    }),
    sponsors: collection({
      label: 'Sponsors',
      path: 'content/sponsors/*',
      slugField: 'name',
      columns: ['name', 'tier'],
      schema: {
        name: fields.slug({ name: { label: 'Name' } }),
        tier: fields.relationship({ label: 'Tier', collection: 'tiers' }),
        logo: fields.image({
          label: 'Logo',
          directory: 'public/images/sponsors',
          publicPath: '/images/sponsors/',
        }),
        url: fields.text({ label: 'Website URL' }),
        published: fields.checkbox({ label: 'Published', defaultValue: false }),
      },
    }),
  },
});
