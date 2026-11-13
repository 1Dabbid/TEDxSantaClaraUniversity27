/**
 * Theme copy: the handful of short, theme-specific lines that sit in the page
 * layout (headings, captions, footnotes, empty-state lines). Editors change them
 * in the admin under The event > Theme copy (content/theme-copy.yaml); these are
 * the built-in defaults, used for any field that is blank or missing, and the
 * admin's default values.
 *
 * What is NOT here, on purpose: the design system (clause numbers, mono
 * captions, "§" marks, redaction bars), the licence line, About TEDx / About
 * TED, and the event name (a constant, src/lib/site.ts).
 *
 * Lines marked "placeholders" may use {eventName}, {capacity}, {date}, {venue}
 * and {campus}, filled in from Event basics and Venue like FAQ answers.
 */
export const THEME_COPY_DEFAULTS = {
  /** Hero footnote (after the red "1."). Blank: no footnote marker in the hero or the share image. */
  heroFootnote: 'Terms and conditions apply. They are the whole point.',
  /** Hero scroll cue, bottom right on desktop. */
  heroScrollCue: 'Scroll to read the fine print',
  /** Theme section heading. */
  themeHeading: 'Read the fine print.',
  /** Caption of the 3D engraving in the theme section (after "Fig. 1"; motion only). */
  themeFigureCaption: 'The fine print, engraved. Read it closely.',
  /** Footnote under the theme story (after a red "*"). Blank: hidden. */
  themeFootnote: 'Read in full before proceeding. The details are binding.',
  /** Speakers heading while no speaker is announced (home page and /speakers). */
  speakersEmptyHeading: 'Speakers to be announced.',
  /** Schedule while the running order is not published. */
  scheduleEmptyHeading: 'Running order to follow.',
  scheduleEmptyNote:
    'Doors, talks and intermission times are published here once the speakers are confirmed. The date and venue are final.',
  /** Closing newsletter heading. */
  newsletterHeading: 'Don’t miss the fine print.',
  /** Home page partner band. Body: placeholders. */
  partnerBandHeading: 'Help make the first one happen.',
  partnerBandBody:
    '{eventName} is student-run and this is its first mainstage event: one evening, {capacity} seats, talks recorded and submitted for publication on the TEDx Talks YouTube channel. We are inviting a small number of partners to support it.',
  /** /partners heading. */
  partnersHeading: 'Put your name in the fine print.',
  /** /partners intro, after "Become a partner of TEDxSantaClaraUniversity." Placeholders. */
  partnersIntro:
    'It is the club’s first mainstage event, organized by students at Santa Clara University: one evening of live talks for up to {capacity} guests, recorded and submitted for publication on the TEDx Talks YouTube channel. We are inviting a small number of partners to make it possible.',
  /** /partners search and link-preview description. Placeholders. */
  partnersDescription:
    'Partner with {eventName}: support the first {eventName} mainstage event, up to {capacity} guests; talks are recorded and submitted for publication on the TEDx Talks YouTube channel.',
  /** /partners, first "What your support makes possible" card. Blank title: the card is left out. Body: placeholders. */
  partnersEditionFigure: '1st',
  partnersEditionTitle: 'The first mainstage.',
  partnersEditionBody:
    'This is the first {eventName} mainstage event. Partners who join now are part of it from the start.',
  /** 404 page. */
  notFoundHeading: 'This page does not exist.',
  notFoundBody: 'The link may be out of date, or the page may have moved.',
  /** Footer sign-off, top right (one line per line). */
  footerSignoff: 'End of document\nSigned and dated',
  /** Page-transition caption, between "§" and "…". */
  transitionCaption: 'continuing',
} as const;

export type ThemeCopy = { -readonly [K in keyof typeof THEME_COPY_DEFAULTS]: string };

/** Fields that may use {eventName}, {capacity}, {date}, {venue}, {campus}. */
export const THEME_COPY_PLACEHOLDER_FIELDS = [
  'partnerBandBody',
  'partnersIntro',
  'partnersDescription',
  'partnersEditionBody',
] as const satisfies readonly (keyof ThemeCopy)[];

/** Fields that may be left blank on purpose (the element is then hidden). */
export const THEME_COPY_OPTIONAL_FIELDS = ['heroFootnote', 'themeFootnote', 'partnersEditionTitle'] as const satisfies readonly (keyof ThemeCopy)[];
