import type { Settings } from './content';
import { normalizeLink } from './content-checks';

/**
 * FAQ answers as text: the placeholders that follow Tickets & speaker
 * applications and Event basics (so an answer can never contradict the rest of
 * the site), and the few things an answer may link to. Pure functions with no
 * Next.js, Keystatic or Node imports: the loader (src/lib/content.ts), the FAQ
 * list (components/sections/FaqList.tsx), the structured data (src/lib/jsonld.ts)
 * and the tests all use them.
 */

// ---------------------------------------------------------------------------
// Placeholders that follow the settings
// ---------------------------------------------------------------------------

type StatusSettings = Pick<
  Settings,
  | 'ticketState'
  | 'ticketUrl'
  | 'ticketEmbedUrl'
  | 'ticketSaleExpected'
  | 'ticketPriceNote'
  | 'speakerApplicationsState'
  | 'speakerApplicationsUrl'
  | 'speakerApplicationsDeadline'
  | 'doorsTime'
  | 'talksTime'
  | 'endTime'
  | 'timesNote'
  | 'contactEmail'
  | 'interestUrl'
>;

const sentence = (t: string) => t.trim().replace(/[.\s]+$/, '');

/**
 * {ticketStatus}: the answer to "Are tickets on sale?", from Ticket status, the
 * ticket link and Expected on-sale month. The same facts as the Tickets section,
 * as sentences. "On sale" with neither a ticket link nor an embedded checkout
 * gives visitors nothing to buy from (the Tickets section says "Ticket link
 * going live shortly."), so the answer says that too instead of "on sale now".
 */
export function ticketStatusText(s: Pick<Settings, 'ticketState' | 'ticketUrl' | 'ticketEmbedUrl' | 'ticketSaleExpected'>): string {
  switch (s.ticketState) {
    case 'on-sale':
      return s.ticketUrl || s.ticketEmbedUrl
        ? 'Yes, tickets are on sale now. Use the Tickets button at the top of any page.'
        : 'Almost. Tickets are about to go on sale: the ticket link is going live shortly. Join the mailing list to hear the moment it does.';
    case 'sold-out':
      return 'Tickets are sold out. Join the mailing list in case seats are released.';
    case 'closed':
      return 'Ticket sales are closed.';
    default: {
      const month = sentence(s.ticketSaleExpected);
      return `Not yet. ${month ? `Tickets are expected to go on sale in ${month}. ` : ''}Join the mailing list to hear the moment they go on sale.`;
    }
  }
}

/**
 * {applicationsStatus}: the answer to "How can I apply to speak?", from Speaker
 * applications, the application link and the deadline. "Open" without a link
 * counts as not open yet, exactly as in the Speakers section (no button to press).
 *
 * The promise to "hear first when applications open" belongs to the not-open
 * state only, so it lives here and not in the hand-typed answer, where it would
 * still be said once applications are open or closed. It is left out while there
 * is no interest form to register with.
 */
export function applicationsStatusText(
  s: Pick<Settings, 'speakerApplicationsState' | 'speakerApplicationsUrl' | 'speakerApplicationsDeadline' | 'interestUrl'>,
): string {
  if (s.speakerApplicationsState === 'closed') return 'Speaker applications for this event are closed.';
  if (s.speakerApplicationsState === 'open' && s.speakerApplicationsUrl) {
    const deadline = sentence(s.speakerApplicationsDeadline);
    return `Speaker applications are open. ${deadline ? `The deadline is ${deadline}. ` : ''}Apply here: ${s.speakerApplicationsUrl}.`;
  }
  const hearFirst = s.interestUrl
    ? ' Those who register their interest get an early look at pitching a talk and hear first when applications open.'
    : '';
  return `Formal speaker applications are not open yet.${hearFirst}`;
}

/** Shown where an answer uses a time that is still blank in Event basics. */
export const TIME_TO_BE_ANNOUNCED = 'a time to be announced';

/**
 * The values of the FAQ-only placeholders (FAQ_ONLY_PLACEHOLDERS in
 * content-checks.ts), all from the settings. {ticketSaleMonth}, {ticketPriceNote},
 * {timesNote}, {interestUrl} and {contactEmail} are '' while their field is blank.
 */
export function faqSettingValues(s: StatusSettings) {
  return {
    interestUrl: s.interestUrl,
    contactEmail: s.contactEmail,
    ticketStatus: ticketStatusText(s),
    ticketSaleMonth: sentence(s.ticketSaleExpected),
    ticketPriceNote: s.ticketPriceNote.trim(),
    applicationsStatus: applicationsStatusText(s),
    doorsTime: s.doorsTime || TIME_TO_BE_ANNOUNCED,
    talksTime: s.talksTime || TIME_TO_BE_ANNOUNCED,
    endTime: s.endTime || TIME_TO_BE_ANNOUNCED,
    timesNote: s.timesNote.trim(),
  };
}

/**
 * {contactEmail} and {interestUrl} are '' while their field is blank. Before the
 * placeholders are filled, this takes the words that lead up to a blank one out
 * with it, so no sentence is left dangling:
 * "contact the team at {contactEmail} and we will" becomes "contact the team and we will",
 * "use the interest form: {interestUrl}." becomes "use the interest form."
 * `blank` lists the placeholder names whose field is empty.
 */
export function dropBlankPlaceholders(text: string, blank: readonly string[]): string {
  let out = text;
  for (const name of blank) {
    out = out.replace(new RegExp(String.raw`(?:[ \t]+(?:at|to|via|on|by)|[ \t]*:)?[ \t]*\{${name}\}`, 'g'), '');
  }
  return out;
}

/** After placeholders are filled: no double spaces or dangling spaces where a blank one was. */
export function tidySpaces(text: string): string {
  return text
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+$/gm, '')
    .replace(/^[ \t]+/gm, '')
    .trim();
}

/**
 * Facts typed by hand into an FAQ item that a placeholder would keep up to date.
 * Returns one hint per problem (for a content warning); [] when there is none.
 * `raw` is the question or answer as typed, before placeholders are filled.
 */
export function staleFaqHints(raw: string, s: StatusSettings): string[] {
  const hints: string[] = [];
  const has = (needle: string) => needle.trim().length > 0 && raw.includes(needle.trim());
  const says = (re: RegExp) => re.test(raw);

  if (has(sentence(s.ticketSaleExpected))) {
    hints.push(`the on-sale month “${sentence(s.ticketSaleExpected)}” is typed by hand; write {ticketStatus} (or {ticketSaleMonth}) so it follows Tickets & speaker applications`);
  } else if (s.ticketState !== 'coming-soon' && says(/expected to go on sale|not on sale yet|tickets are not on sale|go(?:es)? on sale in\b/i)) {
    hints.push('it still says tickets are not on sale, but Ticket status says otherwise; write {ticketStatus} so the answer follows the status');
  }
  if (has(s.ticketPriceNote)) {
    hints.push('the price note is typed by hand; write {ticketPriceNote} so it follows Tickets & speaker applications › Price note');
  }
  const applicationsOpen = s.speakerApplicationsState === 'open' && Boolean(s.speakerApplicationsUrl);
  if ((applicationsOpen || s.speakerApplicationsState === 'closed') && says(/applications are not open|applications are not yet open|not open yet/i)) {
    hints.push('it still says speaker applications are not open, but Speaker applications says otherwise; write {applicationsStatus} so the answer follows the status');
  }
  for (const [value, name, label] of [
    [s.doorsTime, 'doorsTime', 'Doors open at'],
    [s.talksTime, 'talksTime', 'Talks start at'],
    [s.endTime, 'endTime', 'Event ends at'],
  ] as const) {
    if (has(value)) hints.push(`the time “${value}” is typed by hand; write {${name}} so it follows Event basics › ${label}`);
  }
  return hints;
}

// ---------------------------------------------------------------------------
// Links in answers
// ---------------------------------------------------------------------------

export type FaqSegment =
  | { kind: 'text'; text: string }
  /** `page`: a page of this site (same tab). `web`: an https address (new tab). `email`: a mailto link. */
  | { kind: 'page' | 'web' | 'email'; href: string; label: string };

/** A full https:// address, minus trailing punctuation that ends the sentence. */
const BARE_URL = String.raw`https:\/\/[^\s<>"]+[^\s<>".,;:!?)\]]`;
/** A plain email address. No "?", "&" or "#", so it can never add headers to the mailto: link. */
const BARE_EMAIL = String.raw`[A-Za-z0-9][A-Za-z0-9._%+-]*@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}`;
/** [words](/page) or [words](https://…): the only link an editor can label. */
const LABELLED = String.raw`\[([^\[\]\n]+)\]\(([^\s()]+)\)`;
const LINKS = new RegExp(`${LABELLED}|(${BARE_URL})|(${BARE_EMAIL})`, 'g');

/** A page of this site: "/partners", "/faq#tickets". Never "//host", a backslash or a scheme. */
const SITE_PATH = /^\/(?![/\\])[A-Za-z0-9\-._~/#?=&%+]*$/;

/** Where a labelled link may point: a page of this site or a full https address. Anything else is not a link. */
function target(raw: string): { kind: 'page' | 'web'; href: string } | null {
  if (SITE_PATH.test(raw)) return { kind: 'page', href: raw };
  if (/^https:\/\//i.test(raw)) {
    const url = normalizeLink(raw).url;
    if (url) return { kind: 'web', href: url };
  }
  return null;
}

/**
 * Splits an answer into plain text and links. Answers are plain text, never
 * HTML; exactly three things become links, and nothing else is interpreted:
 *
 * - a full https:// address (shown without the https:// prefix, opens in a new tab),
 * - an email address (a mailto: link),
 * - [words](/page) or [words](https://…): the words become the link. A target
 *   that is neither a page of this site nor an https address (javascript:, http:,
 *   //host…) is left exactly as typed, as text.
 */
export function faqSegments(text: string): FaqSegment[] {
  const out: FaqSegment[] = [];
  const push = (t: string) => {
    if (!t) return;
    const last = out[out.length - 1];
    if (last?.kind === 'text') last.text += t;
    else out.push({ kind: 'text', text: t });
  };
  let at = 0;
  for (const m of text.matchAll(LINKS)) {
    const start = m.index ?? 0;
    push(text.slice(at, start));
    at = start + m[0].length;
    const [whole, label, labelTarget, url, email] = m;
    if (label !== undefined) {
      const to = target(labelTarget);
      if (to && label.trim()) out.push({ ...to, label: label.trim() });
      else push(whole);
    } else if (url) {
      const href = normalizeLink(url).url;
      if (href) out.push({ kind: 'web', href, label: url.replace(/^https:\/\//, '').replace(/\/$/, '') });
      else push(whole);
    } else if (email) {
      out.push({ kind: 'email', href: `mailto:${email}`, label: email });
    }
  }
  push(text.slice(at));
  return out;
}

/**
 * An answer as plain text for structured data: bare addresses stay as typed and
 * a labelled link becomes "words (address)", with a page of this site written
 * as its full address.
 */
export function faqPlainText(text: string, siteUrl: string): string {
  return faqSegments(text)
    .map((seg) => {
      if (seg.kind === 'text') return seg.text;
      if (seg.kind === 'email') return seg.label;
      const address = seg.kind === 'page' ? `${siteUrl}${seg.href}` : seg.href;
      // A bare address is its own label (minus the https:// prefix): write it once.
      return address.replace(/^https:\/\//, '').replace(/\/$/, '') === seg.label ? address : `${seg.label} (${address})`;
    })
    .join('');
}
