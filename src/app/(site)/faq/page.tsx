import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getFaq, getSettings } from '@/lib/content';
import { faqIds } from '@/lib/faq-ids';
import { faqPageJsonLd, jsonLdString, pageJsonLd } from '@/lib/jsonld';
import { topicPageMetadata } from '@/lib/page-meta';
import { SITE_NAME, venueLine } from '@/lib/site';
import { JsonLd } from '@/components/print/Print';
import { FaqList } from '@/components/sections/FaqList';
import { ClosingBand } from '@/components/pages/ClosingBand';
import { FaqHashOpen } from '@/components/pages/FaqHashOpen';
import { PageHeader, TopicPage } from '@/components/pages/PageHeader';

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return topicPageMetadata({
    title: 'FAQ',
    description: `Questions about ${SITE_NAME}: ${s.themeName}, answered: tickets, seats, the venue, the talks and how to take part. ${s.dateLong}, ${venueLine(s)}.`,
    path: '/faq',
  });
}

/**
 * /faq: every question, each with its own address (`/faq#tickets-on-sale`) so a
 * single answer can be sent to someone; the linked question opens on arrival.
 * The FAQPage structured data is emitted here, and the home page's FAQ section
 * keeps its own (the two are never on one page). Switched off with the FAQ
 * switch, or with no questions: a 404, linked from nowhere.
 */
export default async function FaqPage() {
  const [settings, items] = await Promise.all([getSettings(), getFaq()]);
  if (!settings.sections.showFaq || items.length === 0) notFound();
  const ids = faqIds(items.map((i) => i.question));
  const mail = settings.contactEmail
    ? `mailto:${settings.contactEmail}?subject=${encodeURIComponent(`Question · ${settings.eventName}`)}`
    : '';

  return (
    <TopicPage>
      <JsonLd
        json={jsonLdString(
          pageJsonLd(
            [
              { name: 'Home', path: '/' },
              { name: 'FAQ', path: '/faq' },
            ],
            faqPageJsonLd(items, ids),
          ),
        )}
      />
      <FaqHashOpen />
      <section aria-labelledby="faq-page-title">
        <PageHeader
          settings={settings}
          label="FAQ"
          titleId="faq-page-title"
          title="Questions, answered."
          intro="Short answers, in plain language. Each question has its own link, so you can send someone straight to the answer."
          facts={[
            { k: 'Questions', v: String(items.length) },
            { k: 'Date', v: <time dateTime={settings.dateISO}>{settings.dateLong}</time> },
            { k: 'Venue', v: venueLine(settings) },
            ...(settings.contactEmail ? [{ k: 'Contact', v: <a href={mail}>{settings.contactEmail}</a> }] : []),
          ]}
        />
      </section>

      <section aria-labelledby="questions-title" className="shell pb-24 sm:pb-32">
        <h2 id="questions-title" className="fine-print flex items-center gap-3 text-white">
          <span aria-hidden="true" className="h-px w-8 bg-accent" />
          All questions
        </h2>
        <FaqList items={items} ids={ids} className="mt-8 max-w-5xl" />
      </section>

      {mail ? (
        <ClosingBand
          current="/faq"
          heading="Still have a question?"
          body="One address for questions about the event."
          action={{ label: settings.contactEmail, href: mail }}
        />
      ) : (
        <ClosingBand current="/faq" />
      )}
    </TopicPage>
  );
}
