import type { Schedule as ScheduleData, Settings } from '@/lib/content';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { ScheduleMotion } from '@/motion/sections/ScheduleMotion';
import { MoreLink } from '@/components/pages/MoreLink';
import { ScheduleTimeline } from './ScheduleTimeline';
import { SectionShell, SectionTitle } from './SectionShell';

/**
 * § 03 · Schedule. Over the slow orbit of the rug: on desktop the timeline is a
 * column on the left (scrim behind that column only), the rest of the frame is
 * left to the stage.
 *
 * Content-driven (The event > Schedule > Show the running order):
 * - Published: a timeline whose hairline draws as you scroll (ScheduleMotion)
 *   and whose rows rise from masks one after another (global data-reveal).
 * - Not published: a short, plain statement of what is fixed (date, place) and
 *   when the rest arrives. No draft rows, no redaction: the section stays in
 *   the page (the 3D orbit keys off it) but takes little more than a screen.
 */
export function Schedule({ schedule, settings }: { schedule: ScheduleData; settings: Settings }) {
  const published = schedule.published && schedule.items.length > 0;
  const times = [
    settings.doorsTime ? `Doors ${settings.doorsTime}` : '',
    settings.talksTime ? `Talks ${settings.talksTime}` : '',
    settings.endTime ? `Ends ${settings.endTime}` : '',
  ].filter(Boolean);
  return (
    <SectionShell id="schedule" scrim="none" className={published ? 'py-24 sm:py-36' : 'py-24 sm:py-32'}>
      <div aria-hidden="true" className="schedule-scrim pointer-events-none absolute inset-0 -z-10" />
      <div className="shell">
        <SectionLabel index={3}>Schedule</SectionLabel>
        <SectionTitle id="schedule">One evening.</SectionTitle>
        <p data-reveal="fade" data-reveal-delay="0.15" className="mt-6 text-lg text-mute lg:max-w-[32rem]">
          <time dateTime={settings.dateISO}>{settings.dateLong}</time>
          {times.map((t) => (
            <span key={t}> · {t}</span>
          ))}
        </p>

        {published ? (
          <ScheduleTimeline items={schedule.items} dateISO={settings.dateISO} className="mt-16 lg:mt-20 lg:max-w-[32rem]" />
        ) : (
          <div className="mt-12 border-t border-white/15 pt-8 lg:max-w-[32rem]">
            <p data-reveal="lines" className="text-title font-semibold tracking-tight text-balance lg:text-[2.25rem]">
              {settings.copy.scheduleEmptyHeading}
            </p>
            <p data-reveal="fade" className="mt-4 text-mute">
              {settings.copy.scheduleEmptyNote}
            </p>
          </div>
        )}
        {published && settings.timesNote ? (
          <p data-reveal="fade" data-times-note className="mt-8 text-sm text-mute lg:max-w-[32rem]">
            {settings.timesNote}
          </p>
        ) : null}
        {published ? <MoreLink href="/schedule" label="Full schedule" /> : null}
      </div>
      <ScheduleMotion />
    </SectionShell>
  );
}
