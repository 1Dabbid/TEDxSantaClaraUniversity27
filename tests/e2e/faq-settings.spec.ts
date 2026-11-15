import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { FAQ_ONLY_PLACEHOLDERS, FAQ_PLACEHOLDERS, fillPlaceholders } from '../../src/lib/content-checks';
import {
  applicationsStatusText,
  dropBlankPlaceholders,
  faqPlainText,
  faqSegments,
  faqSettingValues,
  staleFaqHints,
  ticketStatusText,
  tidySpaces,
  TIME_TO_BE_ANNOUNCED,
} from '../../src/lib/faq-text';
import { ticketCta, ticketLinkPending, ticketsBuyable } from '../../src/lib/tickets';
import { contentValue, topicRoutes } from './helpers';

/**
 * FAQ answers follow the settings (src/lib/faq-text.ts): the ticket and
 * application status, the on-sale month, the price note, the times and the
 * contact address are placeholders, never typed by hand, so an answer cannot
 * contradict the rest of the site or the FAQPage structured data.
 */

const today = {
  ticketState: 'coming-soon' as const,
  ticketUrl: '',
  ticketEmbedUrl: '',
  ticketSaleExpected: 'February 2027',
  ticketPriceNote: 'Tickets will cost no more than $100.',
  speakerApplicationsState: 'coming-soon' as const,
  speakerApplicationsUrl: '',
  speakerApplicationsDeadline: '',
  doorsTime: '5:00 PM',
  talksTime: '6:00 PM',
  endTime: '9:00 PM',
  timesNote: 'Times are approximate and may shift slightly.',
  contactEmail: 'tedx@scu.edu',
  interestUrl: 'https://example.com/interest',
};
const base = { capacity: '100', date: 'Friday, April 23, 2027', venue: 'Hall', campus: 'Campus', eventName: 'TEDxSantaClaraUniversity' };
const fill = (text: string, s: typeof today | (Omit<typeof today, 'ticketState' | 'speakerApplicationsState'> & { ticketState: string; speakerApplicationsState: string })) =>
  tidySpaces(fillPlaceholders(text, { ...base, ...faqSettingValues(s as typeof today) }).text);

test.describe('FAQ placeholders that follow the settings', () => {
  test('{ticketStatus} says what the Ticket status says', () => {
    expect(ticketStatusText(today)).toBe(
      'Not yet. Tickets are expected to go on sale in February 2027. Join the mailing list to hear the moment they go on sale.',
    );
    expect(ticketStatusText({ ...today, ticketSaleExpected: '' })).toBe('Not yet. Join the mailing list to hear the moment they go on sale.');
    expect(ticketStatusText({ ...today, ticketSaleExpected: 'March 2027.' })).toContain('go on sale in March 2027. Join');
    const onSale = ticketStatusText({ ...today, ticketState: 'on-sale', ticketUrl: 'https://tickets.example.com/e' });
    expect(onSale).toBe('Yes, tickets are on sale now. Use the Tickets button at the top of any page.');
    expect(onSale).not.toMatch(/not yet|February/i);
    // An embedded checkout in the Tickets section is a way to buy too.
    expect(ticketStatusText({ ...today, ticketState: 'on-sale', ticketEmbedUrl: 'https://tickets.example.com/embed' })).toBe(onSale);
    expect(ticketStatusText({ ...today, ticketState: 'sold-out' })).toMatch(/^Tickets are sold out\./);
    expect(ticketStatusText({ ...today, ticketState: 'closed' })).toBe('Ticket sales are closed.');
  });

  test('{ticketStatus}: “On sale” without a ticket link agrees with the Tickets section', () => {
    // The Tickets section then shows "Ticket link going live shortly." and no buy button.
    const noLink = ticketStatusText({ ...today, ticketState: 'on-sale' });
    expect(noLink).toBe('Almost. Tickets are about to go on sale: the ticket link is going live shortly. Join the mailing list to hear the moment it does.');
    expect(noLink).not.toMatch(/on sale now|Tickets button|February/i);
    const section = readFileSync(join(process.cwd(), 'src/components/sections/Tickets.tsx'), 'utf8');
    expect(section).toContain('Ticket link going live shortly.');
    expect(noLink.toLowerCase()).toContain('ticket link is going live shortly');
  });

  test('“On sale” means on sale only once there is somewhere to buy: one test for the whole site', () => {
    const none = { ticketState: 'on-sale' as const, ticketUrl: '', ticketEmbedUrl: '' };
    const link = { ...none, ticketUrl: 'https://tickets.example.com/e' };
    const embed = { ...none, ticketEmbedUrl: 'https://tickets.example.com/embed' };
    expect(ticketLinkPending(none)).toBe(true);
    expect(ticketsBuyable(none)).toBe(false);
    for (const s of [link, embed]) {
      expect(ticketsBuyable(s)).toBe(true);
      expect(ticketLinkPending(s)).toBe(false);
    }
    // Only "On sale" can be waiting for its link.
    for (const ticketState of ['coming-soon', 'sold-out', 'closed'] as const) {
      expect(ticketLinkPending({ ...none, ticketState })).toBe(false);
      expect(ticketsBuyable({ ...link, ticketState })).toBe(false);
    }
    // The Tickets button is announced the same way, and only leaves the site for a ticket link.
    expect(ticketCta(none).ariaLabel).toBe('Tickets, on sale shortly');
    expect(ticketCta(none).href).toBe('/#tickets');
    expect(ticketCta(embed).ariaLabel).toBe('Tickets, on sale now');
    expect(ticketCta(embed).href).toBe('/#tickets');
    expect(ticketCta(link).ariaLabel).toBe('Tickets, on sale now (opens in a new tab)');
    expect(ticketCta(link).href).toBe(link.ticketUrl);
    // Every place that says "on sale" asks the shared test, never the status field alone.
    const src = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');
    expect(src('src/lib/faq-text.ts')).toContain('ticketLinkPending(s)');
    expect(src('src/lib/jsonld.ts')).toContain('ticketLinkPending(s)');
    expect(src('src/components/sections/Tickets.tsx')).toContain('ticketLinkPending(settings)');
    expect(src('src/components/pages/ClosingBand.tsx')).toContain('ticketsBuyable(s)');
    // The section's "going live shortly" line is the last resort: not printed above an embedded checkout.
    const section = src('src/components/sections/Tickets.tsx');
    expect(section.indexOf('if (settings.ticketEmbedUrl)')).toBeGreaterThan(-1);
    expect(section.indexOf('if (settings.ticketEmbedUrl)')).toBeLessThan(section.lastIndexOf('Ticket link going live shortly.'));
    expect(section).toContain('"Almost on sale."');
  });

  test('{applicationsStatus} says what Speaker applications says', () => {
    const notOpen =
      'Formal speaker applications are not open yet. People on the interest list get an early look at pitching a talk and hear first when applications open.';
    expect(applicationsStatusText(today)).toBe(notOpen);
    // No interest form to register with: no promise about it.
    expect(applicationsStatusText({ ...today, interestUrl: '' })).toBe('Formal speaker applications are not open yet.');
    // "Open" without a link shows no Apply button, so the answer does not claim applications are open.
    expect(applicationsStatusText({ ...today, speakerApplicationsState: 'open' })).toBe(notOpen);
    expect(
      applicationsStatusText({ ...today, speakerApplicationsState: 'open', speakerApplicationsUrl: 'https://example.com/apply', speakerApplicationsDeadline: 'January 15, 2027' }),
    ).toBe('Speaker applications are open. The deadline is January 15, 2027. Apply here: https://example.com/apply.');
    // The full stop after the address is not part of the link.
    expect(faqSegments('Apply here: https://example.com/apply. Next.').find((seg) => seg.kind === 'web')).toEqual({
      kind: 'web',
      href: 'https://example.com/apply',
      label: 'example.com/apply',
    });
    expect(applicationsStatusText({ ...today, speakerApplicationsState: 'closed', speakerApplicationsUrl: 'https://example.com/apply' })).toBe(
      'Speaker applications for this event are closed.',
    );
  });

  test('the speaker-application answer is true while applications are not open, open and closed', () => {
    const yaml = readFileSync(join(process.cwd(), 'content/faq.yaml'), 'utf8');
    const raw = [...yaml.matchAll(/answer: \|-\n((?: {6}.*\n?)+)/g)].map((m) => m[1].replace(/^ {6}/gm, '').trim()).find((a) => a.includes('{applicationsStatus}'));
    test.skip(!raw, 'no answer uses {applicationsStatus}');
    // Nothing about hearing first or getting an early look is typed by hand: that is only true before applications open.
    expect(raw).not.toMatch(/hear first|early look|not open/i);
    const open = fill(raw!, { ...today, speakerApplicationsState: 'open', speakerApplicationsUrl: 'https://example.com/apply', speakerApplicationsDeadline: 'March 1, 2027' });
    const closed = fill(raw!, { ...today, speakerApplicationsState: 'closed' });
    const notOpen = fill(raw!, today);
    expect(notOpen).toMatch(/^Formal speaker applications are not open yet\. .*hear first when applications open\./);
    expect(open).toMatch(/^Speaker applications are open\. The deadline is March 1, 2027\. Apply here: https:\/\/example\.com\/apply\./);
    expect(closed).toMatch(/^Speaker applications for this event are closed\./);
    for (const text of [open, closed]) expect(text, text).not.toMatch(/hear first|early look|not open|when applications open/i);
    for (const text of [notOpen, open, closed]) expect(text, text).toContain(today.interestUrl);
  });

  test('the answers in content/faq.yaml never contradict a changed setting', () => {
    const yaml = readFileSync(join(process.cwd(), 'content/faq.yaml'), 'utf8');
    const answers = [...yaml.matchAll(/answer: \|-\n((?: {6}.*\n?)+)/g)].map((m) => m[1].replace(/^ {6}/gm, '').trim());
    expect(answers.length).toBeGreaterThan(0);
    const scenario = {
      ...today,
      ticketState: 'on-sale',
      ticketUrl: 'https://tickets.example.com/e',
      ticketSaleExpected: 'March 2027',
      ticketPriceNote: 'Tickets cost $25.',
      speakerApplicationsState: 'open',
      speakerApplicationsUrl: 'https://example.com/apply',
      doorsTime: '4:30 PM',
      talksTime: '5:30 PM',
      endTime: '8:30 PM',
      timesNote: '',
    };
    for (const answer of answers) {
      // Nothing a placeholder covers is typed by hand (with today's settings)...
      expect(staleFaqHints(answer, today), answer).toEqual([]);
      // ...and with other settings no answer keeps the old facts.
      const r = fillPlaceholders(answer, { ...base, ...faqSettingValues(scenario as unknown as typeof today) });
      expect(r.unknown, answer).toEqual([]);
      const text = tidySpaces(r.text);
      expect(text, answer).not.toMatch(/not yet|not open yet|February 2027|no more than \$100|5:00 PM|6:00 PM|9:00 PM|may shift slightly/i);
      expect(text, answer).not.toMatch(/ {2}|[{}]/);
    }
    const all = answers.map((a) => fill(a, scenario)).join('\n');
    expect(all).toContain('Yes, tickets are on sale now.');
    expect(all).toContain('Tickets cost $25.');
    expect(all).toContain('Speaker applications are open.');
    expect(all).toContain('4:30 PM');
  });

  test('a blank setting leaves no gap or double space', () => {
    expect(fill('{ticketStatus} {ticketPriceNote}', { ...today, ticketPriceNote: '' })).toBe(
      'Not yet. Tickets are expected to go on sale in February 2027. Join the mailing list to hear the moment they go on sale.',
    );
    expect(fill('Doors at {doorsTime}. {timesNote}', { ...today, doorsTime: '', timesNote: '' })).toBe(`Doors at ${TIME_TO_BE_ANNOUNCED}.`);
    expect(fill('Line one. {timesNote}\n\nLine two.', { ...today, timesNote: '' })).toBe('Line one.\n\nLine two.');
  });

  test('a blank contact email or interest link takes the words that depend on it along', () => {
    const blank = ['contactEmail', 'interestUrl'];
    const drop = (text: string) => tidySpaces(dropBlankPlaceholders(text, blank));
    expect(drop('contact the team at {contactEmail} and we will do our best.')).toBe('contact the team and we will do our best.');
    expect(drop('If you have questions, contact the team at {contactEmail}.')).toBe('If you have questions, contact the team.');
    // Too little is left to be a sentence: it goes.
    expect(drop('Write to {contactEmail}.')).toBe('');
    expect(drop('Questions? Email {contactEmail}.')).toBe('Questions?');
    expect(drop('We reply within a week. Our address is {contactEmail}.')).toBe('We reply within a week.');
    // Never "()" or "[words]()" on the page.
    expect(drop('Write to us ({contactEmail}) any time.')).toBe('Write to us any time.');
    expect(drop('You can [email the team]({contactEmail}) any time.')).toBe('You can email the team any time.');
    // No form to send visitors to: the whole sentence that points at it goes, not just the link.
    expect(drop('Applications are not open yet. To register your interest, use the form: {interestUrl}.')).toBe('Applications are not open yet.');
    expect(drop('Fill in the form: {interestUrl}. Seats are limited.')).toBe('Seats are limited.');
    expect(drop('Use [the interest form]({interestUrl}) to sign up. Seats are limited.')).toBe('Seats are limited.');
    expect(drop('To volunteer, go to {interestUrl} and sign up. Thank you!')).toBe('Thank you!');
    expect(drop('Seats are limited. Sign up ({interestUrl}).\n\nSee you there.')).toBe('Seats are limited.\n\nSee you there.');
    // A placeholder that stands for whole sentences is not part of the sentence after it.
    expect(drop('{applicationsStatus} To register, use the form: {interestUrl}.')).toBe('{applicationsStatus}');
    // A period that only ends an abbreviation does not end the sentence: no fragment such as "If you want to help (e.g. Thanks."
    expect(drop('If you want to help (e.g. as a volunteer), use the form: {interestUrl}. Thanks.')).toBe('Thanks.');
    expect(drop('See Dr. Smith or use {interestUrl}. Thanks.')).toBe('Thanks.');
    expect(drop('Parking is on Franklin St. Use the form: {interestUrl}.')).toBe('Parking is on Franklin St.');
    expect(drop('Doors open early. Use {interestUrl} (e.g. to volunteer or i.e. to help). Thanks.')).toBe('Doors open early. Thanks.');
    expect(drop('Come at 5 p.m. sharp or sign up: {interestUrl}. Thanks.')).toBe('Thanks.');
    expect(drop('Talks end at 9 p.m. Sign up at {interestUrl} for news. Thanks.')).toBe('Talks end at 9 p.m. Thanks.');
    expect(drop('Tell us. The form: {interestUrl}. Thanks.')).toBe('Tell us. Thanks.');
    expect(drop('Email Dr. Lee at {contactEmail}.')).toBe('');
    expect(drop('Ask us anything, e.g. about parking: {contactEmail}.')).toBe('Ask us anything, e.g. about parking.');
    expect(drop('{ticketStatus} {ticketPriceNote} Questions go to {contactEmail}.')).toBe('{ticketStatus} {ticketPriceNote}');
    for (const text of ['Write to us ({contactEmail}) any time.', 'Use [the form]({interestUrl}) now. Bye.', 'Email [us]({contactEmail}).', 'Form ({interestUrl}).']) {
      expect(drop(text), text).not.toMatch(/\(\)|\]\(|[{}]/);
    }
    // A filled-in field is not in the list: the sentence is untouched.
    expect(dropBlankPlaceholders('contact the team at {contactEmail} and we will', ['interestUrl'])).toBe('contact the team at {contactEmail} and we will');
    // Every answer in content/faq.yaml reads as a whole sentence with both fields blank.
    const yaml = readFileSync(join(process.cwd(), 'content/faq.yaml'), 'utf8');
    const answers = [...yaml.matchAll(/answer: \|-\n((?: {6}.*\n?)+)/g)].map((m) => m[1].replace(/^ {6}/gm, '').trim());
    for (const answer of answers) {
      const text = tidySpaces(
        fillPlaceholders(dropBlankPlaceholders(answer, blank), { ...base, ...faqSettingValues({ ...today, contactEmail: '', interestUrl: '' }) }).text,
      );
      expect(text, answer).not.toMatch(/\b(?:at|to|via) (?:and|or|but)\b|\b(?:at|to|via)[.,;]|:\s*(?:\.|$)| [.,;]| {2}|[{}]|\(\)|\]\(\)/);
      // With no interest form, no answer tells visitors to use one or lists things only the form could do.
      expect(text, answer).not.toMatch(/interest form|contact list|ways to take part|register/i);
      // An answer that was nothing but the pointer to the form is empty (its question is not shown); none starts mid-thought.
      if (text === '') {
        expect(answer, answer).toContain('{interestUrl}');
        continue;
      }
      expect(text.length, answer).toBeGreaterThan(20);
      expect(text, answer).toMatch(/^[A-Z“].*[.!?]$/s);
    }
    // Today's two answers that use the form, with the link blank.
    const blankFill = (answer: string) =>
      tidySpaces(fillPlaceholders(dropBlankPlaceholders(answer, blank), { ...base, ...faqSettingValues({ ...today, contactEmail: '', interestUrl: '' }) }).text);
    const speak = answers.find((a) => a.includes('{applicationsStatus}'));
    expect(speak).toBe('{applicationsStatus} To register your interest in giving a talk, use the club’s interest form: {interestUrl}.');
    expect(blankFill(speak ?? '')).toBe('Formal speaker applications are not open yet.');
    // "How can I get involved?" is one sentence that ends in the form's address: with the link it names
    // what the form is for, and without it nothing is left (no list of things with no way to do them),
    // so the loader leaves the question out, with a content warning.
    const involved = answers.find((a) => a.includes('{interestUrl}') && a !== speak);
    expect(involved).toBe(
      'Use the club’s interest form to help organize {eventName}, join its contact list or register your interest in speaking: {interestUrl}.',
    );
    expect(blankFill(involved ?? 'x')).toBe('');
    expect(fill(involved ?? '', today)).toBe(
      `Use the club’s interest form to help organize TEDxSantaClaraUniversity, join its contact list or register your interest in speaking: ${today.interestUrl}.`,
    );
    const loader = readFileSync(join(process.cwd(), 'src/lib/content.ts'), 'utf8');
    expect(loader).toContain('nothing is left of it once the blank fields are taken out, so the question is not shown.');
  });

  test('facts typed by hand are reported, so they cannot go stale unnoticed', () => {
    expect(staleFaqHints('Not yet. Tickets are expected to go on sale in February 2027.', today).join(' ')).toContain('{ticketStatus}');
    expect(staleFaqHints('Tickets will cost no more than $100.', today).join(' ')).toContain('{ticketPriceNote}');
    expect(staleFaqHints('Doors open at about 5:00 PM.', today).join(' ')).toContain('{doorsTime}');
    expect(staleFaqHints('Tickets are not on sale yet.', { ...today, ticketState: 'on-sale' }).join(' ')).toContain('{ticketStatus}');
    expect(
      staleFaqHints('Formal speaker applications are not open yet.', { ...today, speakerApplicationsState: 'closed' }).join(' '),
    ).toContain('{applicationsStatus}');
    expect(staleFaqHints('{ticketStatus} {ticketPriceNote} Doors at {doorsTime}.', today)).toEqual([]);
  });

  test('the admin hint and the editing guide name every placeholder', () => {
    const config = readFileSync(join(process.cwd(), 'keystatic.config.ts'), 'utf8');
    const guide = readFileSync(join(process.cwd(), 'docs/EDITING.md'), 'utf8');
    for (const name of [...FAQ_PLACEHOLDERS, ...FAQ_ONLY_PLACEHOLDERS]) {
      expect(config, `keystatic.config.ts mentions {${name}}`).toContain(`{${name}}`);
      expect(guide, `docs/EDITING.md mentions {${name}}`).toContain(`{${name}}`);
    }
    expect(Object.keys(faqSettingValues(today)).sort()).toEqual([...FAQ_ONLY_PLACEHOLDERS].sort());
  });

  test('the admin hints say what a blank field or a missing ticket link does', () => {
    const config = readFileSync(join(process.cwd(), 'keystatic.config.ts'), 'utf8');
    const guide = readFileSync(join(process.cwd(), 'docs/EDITING.md'), 'utf8');
    // Ticket status: "On sale" with no ticket link yet.
    expect(config).toContain('With “On sale” and no ticket link yet, the site and the {ticketStatus} answer say tickets are about to go on sale, not “on sale now”.');
    expect(ticketStatusText({ ...today, ticketState: 'on-sale' })).toContain('Tickets are about to go on sale');
    expect(guide).toContain('On sale with no ticket link yet: "Almost. Tickets are about to go on sale');
    // Interest form link, blank.
    expect(config).toContain('While this is blank, the whole sentence that contains {interestUrl} is left out of the answer, and a question with nothing left to say is not shown.');
    expect(guide).toContain('the whole sentence that contains it is left out');
    // Contact email, blank.
    expect(config).toContain('While this is blank, those answers are shown without the address (and without the “at”, “to” or “:” before it), so read them on the page.');
    expect(guide).toContain('the address is left out together with the "at", "to" or ":" before it');
    // The guide tells the owner what today's two answers do with the link blank.
    expect(guide).toContain('**How can I get involved?** is not shown at all');
  });
});

test.describe('links in FAQ answers', () => {
  test('addresses, emails and labelled links become links; nothing else does', () => {
    expect(faqSegments('Plain text only.')).toEqual([{ kind: 'text', text: 'Plain text only.' }]);
    expect(faqSegments('Form: https://example.com/form. Thanks')).toEqual([
      { kind: 'text', text: 'Form: ' },
      { kind: 'web', href: 'https://example.com/form', label: 'example.com/form' },
      { kind: 'text', text: '. Thanks' },
    ]);
    expect(faqSegments('Write to tedx@scu.edu.')).toEqual([
      { kind: 'text', text: 'Write to ' },
      { kind: 'email', href: 'mailto:tedx@scu.edu', label: 'tedx@scu.edu' },
      { kind: 'text', text: '.' },
    ]);
    expect(faqSegments('The [Partners page](/partners) explains.')).toEqual([
      { kind: 'text', text: 'The ' },
      { kind: 'page', href: '/partners', label: 'Partners page' },
      { kind: 'text', text: ' explains.' },
    ]);
    expect(faqSegments('[the form](https://example.com/f?x=1)')).toEqual([{ kind: 'web', href: 'https://example.com/f?x=1', label: 'the form' }]);
  });

  test('unsafe or foreign targets stay plain text', () => {
    for (const text of [
      '[click](javascript:alert(1))',
      '[click](//evil.example.com/x)',
      '[click](/\\evil.example.com)',
      '[click](http://example.com)',
      '[click](data:text/html,x)',
      '[click](mailto:a@b.co?bcc=x@evil.com)',
      '<a href="https://example.com">x</a><script>alert(1)</script>',
    ]) {
      for (const seg of faqSegments(text)) {
        if (seg.kind === 'text') continue;
        // Whatever is linked is an https address, a plain mailto or a path on this site: never a script or another scheme.
        expect(seg.href, text).toMatch(/^(https:\/\/[^\s"<>]+|mailto:[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+|\/(?![/\\])[A-Za-z0-9\-._~/#?=&%+]*)$/);
        expect(seg.href, text).not.toMatch(/javascript|data:|[?&](bcc|cc|subject|body)=/i);
      }
    }
    expect(faqSegments('[click](javascript:alert(1))').every((seg) => seg.kind === 'text')).toBe(true);
    expect(faqSegments('[click](//evil.example.com/x)').every((seg) => seg.kind === 'text')).toBe(true);
    expect(faqSegments('[click](http://example.com)').every((seg) => seg.kind === 'text')).toBe(true);
    // An address with mail headers is never linked whole: only the plain address before the "?".
    expect(faqSegments('a@b.co?bcc=x@evil.com').flatMap((seg) => (seg.kind === 'email' ? [seg.href] : []))).toEqual(['mailto:a@b.co', 'mailto:x@evil.com']);
  });

  test('structured data gets plain text with the full address', () => {
    expect(faqPlainText('The [Partners page](/partners) explains. Mail tedx@scu.edu or see https://example.com/form.', 'https://site.example')).toBe(
      'The Partners page (https://site.example/partners) explains. Mail tedx@scu.edu or see https://example.com/form.',
    );
  });
});

test.describe('the FAQ as served', () => {
  test.skip(!topicRoutes().includes('/faq'), 'FAQ switched off');

  test('/faq: the ticket and application answers are the ones the settings produce', async ({ page }) => {
    const s = {
      ...today,
      ticketState: (contentValue('tickets.yaml', 'ticketState') || 'coming-soon') as typeof today.ticketState,
      ticketUrl: contentValue('tickets.yaml', 'ticketUrl'),
      ticketEmbedUrl: contentValue('tickets.yaml', 'ticketEmbedUrl'),
      ticketSaleExpected: contentValue('tickets.yaml', 'ticketSaleExpected'),
      interestUrl: contentValue('tickets.yaml', 'interestUrl'),
      speakerApplicationsState: (contentValue('tickets.yaml', 'speakerApplicationsState') || 'coming-soon') as typeof today.speakerApplicationsState,
      speakerApplicationsUrl: contentValue('tickets.yaml', 'speakerApplicationsUrl'),
      speakerApplicationsDeadline: contentValue('tickets.yaml', 'speakerApplicationsDeadline'),
    };
    await page.goto('/faq');
    const main = page.locator('main');
    await expect(main).toContainText(ticketStatusText(s));
    // The application sentence ends with a link when applications are open: compare up to it.
    await expect(main).toContainText(applicationsStatusText(s).split(' https://')[0]);
    const price = contentValue('tickets.yaml', 'ticketPriceNote');
    if (price) await expect(main).toContainText(price);
    for (const key of ['doorsTime', 'talksTime', 'endTime'] as const) {
      const time = contentValue('settings.yaml', key);
      if (time) await expect(main).toContainText(time);
    }
    // No placeholder or link syntax is ever shown as typed.
    const text = (await main.innerText()).replace(/\s+/g, ' ');
    expect(text).not.toMatch(/\{[A-Za-z]+\}/);
    expect(text).not.toMatch(/\]\(\//);
  });

  test('/faq: the partner answer links to /partners and the accessibility answer gives the contact address', async ({ page }) => {
    await page.goto('/faq');
    const partners = page.locator('main a[data-faq-page-link][href="/partners"]');
    await expect(partners).toHaveCount(1);
    await expect(partners).toHaveText('Partners page');
    await expect(partners).not.toHaveAttribute('target', '_blank');
    const email = contentValue('contact.yaml', 'contactEmail');
    test.skip(!email, 'no contact email set');
    const mail = page.locator(`main a[data-faq-email][href="mailto:${email}"]`);
    await expect(mail).toHaveCount(1);
    await expect(mail).toHaveText(email);
  });

  test('the FAQPage structured data carries the same, filled-in answers on / and /faq', async ({ request }) => {
    const expected = ticketStatusText({
      ticketState: (contentValue('tickets.yaml', 'ticketState') || 'coming-soon') as typeof today.ticketState,
      ticketUrl: contentValue('tickets.yaml', 'ticketUrl'),
      ticketEmbedUrl: contentValue('tickets.yaml', 'ticketEmbedUrl'),
      ticketSaleExpected: contentValue('tickets.yaml', 'ticketSaleExpected'),
    });
    for (const route of ['/', '/faq']) {
      const html = await (await request.get(route)).text();
      const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]) as Record<string, unknown>);
      const nodes = blocks.flatMap((b) => (Array.isArray(b['@graph']) ? (b['@graph'] as Record<string, unknown>[]) : [b]));
      const faq = nodes.find((n) => n['@type'] === 'FAQPage') as { mainEntity: { name: string; acceptedAnswer: { text: string } }[] } | undefined;
      expect(faq, `${route} FAQPage`).toBeTruthy();
      const answers = faq!.mainEntity.map((q) => q.acceptedAnswer.text);
      expect(answers.some((a) => a.includes(expected)), `${route}: ticket answer follows the status`).toBe(true);
      for (const a of answers) {
        expect(a, route).not.toMatch(/\{[A-Za-z]+\}/);
        expect(a, route).not.toMatch(/\]\(/);
      }
      // The home page lists only its first questions; /faq has them all.
      if (route === '/faq') {
        expect(answers.some((a) => /Partners page \(https:\/\/[^)]+\/partners\)/.test(a)), 'the partner answer names the page address').toBe(true);
      }
    }
  });
});
