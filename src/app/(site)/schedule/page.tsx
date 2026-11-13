import type { Metadata } from 'next';
import { getSchedule, getSettings } from '@/lib/content';
import { jsonLdString, pageJsonLd } from '@/lib/jsonld';
import { topicPageMetadata } from '@/lib/page-meta';
import { SITE_NAME, venueLine } from '@/lib/site';
import { Button } from '@/components/ui/Button';
import { ClauseNo, JsonLd } from '@/components/print/Print';
import { ScheduleTimeline } from '@/components/sections/ScheduleTimeline';
import { TicketsClosingBand } from '@/components/pages/ClosingBand';
import { PageHeader, TopicPage, timeFacts, timesNoteOf } from '@/components/pages/PageHeader';

export async function generateMetadata(): Promise<Metadata> {
  const [s, schedule] = await Promise.all([getSettings(), getSchedule()]);
  const published = schedule.published && schedule.items.length > 0;
  return topicPageMetadata({
    title: 'Schedule',
    description: published
      ? `The running order of ${SITE_NAME}: ${s.themeName}, ${s.dateLong}, ${venueLine(s)}.`
      : `${SITE_NAME}: ${s.themeName} takes place on ${s.dateLong}, ${venueLine(s)}. The running order is published here once the speakers are confirmed.`,
    path: '/schedule',
  });
}

/**
 * /schedule. Published: the evening's times at the top, then the running order
 * (the same timeline as the home page, drawn in full). Not published: a short,
 * confident page with what is fixed (the date and place), what will be listed,
 * and the mailing list. No redacted placeholder rows.
 */
export default async function SchedulePage() {
  const [settings, schedule] = await Promise.all([getSettings(), getSchedule()]);
  const published = schedule.published && schedule.items.length > 0;
  const listHref = settings.newsletterUrl || '/#newsletter';

  return (
    <TopicPage>
      <JsonLd
        json={jsonLdString(
          pageJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Schedule', path: '/schedule' },
          ]),
        )}
      />
      <section aria-labelledby="schedule-page-title">
        <PageHeader
          settings={settings}
          label="Schedule"
          titleId="schedule-page-title"
          title={published ? 'The evening, in order.' : 'One evening.'}
          intro={
            <>
              Live talks at the {settings.venueName} on <time dateTime={settings.dateISO}>{settings.dateLong}</time>
              {published
                ? ', from doors to close.'
                : '. The running order is published here once the speakers are confirmed.'}
            </>
          }
          facts={[
            { k: 'Date', v: <time dateTime={settings.dateISO}>{settings.dateLong}</time> },
            ...timeFacts(settings),
          ]}
          factsNote={timesNoteOf(settings)}
        />
      </section>

      <section aria-labelledby="running-order-title" className="shell pb-24 sm:pb-32">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <h2 id="running-order-title" className="flex items-baseline gap-4 text-2xl font-semibold tracking-tight sm:text-3xl">
              <ClauseNo>1</ClauseNo>
              Running order
            </h2>
            {published ? (
              <p className="mt-4 max-w-xs text-mute">Every moment of the evening, in order.</p>
            ) : null}
          </div>
          <div className="md:col-span-8">
            {published ? (
              <ScheduleTimeline items={schedule.items} dateISO={settings.dateISO} drawn className="border-t border-white/15 lg:max-w-[40rem]" />
            ) : (
              <div className="border-t border-white/15 pt-8">
                <p className="text-title font-semibold tracking-tight text-balance">{settings.copy.scheduleEmptyHeading}</p>
                <p className="mt-4 max-w-xl text-lg text-mute">{settings.copy.scheduleEmptyNote}</p>
                <div className="mt-10">
                  <p className="fine-print text-mute">Hear it first</p>
                  <div className="mt-4">
                    <Button href={listHref} size="lg">
                      Join the mailing list
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <TicketsClosingBand current="/schedule" settings={settings} />
    </TopicPage>
  );
}
