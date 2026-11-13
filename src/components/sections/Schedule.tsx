import type { Schedule as ScheduleData, Settings } from '@/lib/content';
import { ComingSoonBadge } from '@/components/ui/ComingSoon';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { ScheduleMotion } from '@/motion/sections/ScheduleMotion';
import { SectionShell, SectionTitle } from './SectionShell';

const KIND_LABEL = { talk: 'Talk', break: 'Break', doors: 'Doors', other: 'Program' } as const;

// Draft skeleton widths (no draft content is ever shown before publishing).
const DRAFT = [38, 62, 29, 55, 44];

const rowGrid =
  'grid grid-cols-[1.25rem_1fr] gap-x-4 sm:grid-cols-[1.25rem_8rem_1fr_auto] sm:items-baseline sm:gap-x-8 lg:grid-cols-[1.25rem_5rem_1fr_auto] lg:gap-x-6';

/**
 * § 03 · Schedule. Over the slow orbit of the rug: on desktop the timeline is a
 * column on the left (scrim behind that column only), the rest of the frame is
 * left to the stage. A timeline whose hairline draws as you scroll (ScheduleMotion)
 * and whose rows rise from masks one after another (global data-reveal). Before
 * the running order is published it shows a designed draft: clause-numbered rows
 * with redacted entries and a draft stamp, never the unpublished content itself.
 */
export function Schedule({ schedule, settings }: { schedule: ScheduleData; settings: Settings }) {
  const published = schedule.published && schedule.items.length > 0;
  return (
    <SectionShell id="schedule" scrim="none" className="py-28 sm:py-48">
      <div aria-hidden="true" className="schedule-scrim pointer-events-none absolute inset-0 -z-10" />
      <div className="shell">
        <SectionLabel index={3}>Schedule</SectionLabel>
        <SectionTitle id="schedule">One evening.</SectionTitle>
        <p data-reveal="fade" data-reveal-delay="0.15" className="mt-6 text-lg text-mute">
          <time dateTime={settings.dateISO}>{settings.dateLong}</time>
          {settings.doorsTime ? <> · Doors {settings.doorsTime}</> : null}
          {settings.endTime ? <> · Ends {settings.endTime}</> : null}
        </p>

        <div className="relative mt-16 lg:mt-20 lg:max-w-[36rem]" data-timeline>
          {/* The hairline: drawn top to bottom by scroll. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 left-[0.625rem] top-0 w-px bg-white/10"
          />
          <span
            aria-hidden="true"
            data-timeline-line
            className="timeline-line pointer-events-none absolute bottom-0 left-[0.625rem] top-0 w-px bg-accent"
          />

          {published ? (
            <ol data-reveal="stagger" data-reveal-variant="wipe">
              {schedule.items.map((item, i) => (
                <li key={i} className={`${rowGrid} relative py-7`}>
                  <span aria-hidden="true" className="relative mt-2 flex justify-center sm:mt-0">
                    <span className="size-[5px] rounded-full bg-white ring-4 ring-black" />
                  </span>
                  <span className="font-mono text-sm text-white tabular-nums">{item.time}</span>
                  <div className="col-start-2 mt-1 sm:col-start-auto sm:mt-0">
                    <p className="text-xl font-semibold tracking-tight sm:text-2xl">{item.title}</p>
                    {item.description ? <p className="mt-1 max-w-xl text-mute">{item.description}</p> : null}
                  </div>
                  <span className="fine-print col-start-2 mt-2 sm:col-start-auto sm:mt-0">
                    §&nbsp;3.{i + 1} · {KIND_LABEL[item.kind]}
                  </span>
                  <span aria-hidden="true" className="absolute inset-x-0 bottom-0 ml-10 h-px bg-white/10" />
                </li>
              ))}
            </ol>
          ) : (
            <div>
              <div className={`${rowGrid} pb-8`}>
                <span aria-hidden="true" className="relative flex justify-center pt-1.5">
                  <span className="size-[7px] rounded-full bg-accent ring-4 ring-black" />
                </span>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3 sm:col-span-3">
                  <ComingSoonBadge>Schedule coming soon</ComingSoonBadge>
                  <p className="fine-print">Draft · Rev. 0 · Subject to change without notice</p>
                </div>
              </div>

              <p className={`${rowGrid}`}>
                <span aria-hidden="true" />
                <span
                  data-reveal="lines"
                  className="max-w-3xl text-title font-semibold tracking-tight text-balance sm:col-span-3 lg:text-[2.25rem]"
                >
                  The running order is still in draft. The details are being decided.
                </span>
              </p>

              <ol aria-label="Draft running order" className="mt-10" data-reveal="stagger" data-reveal-variant="wipe">
                {DRAFT.map((w, i) => (
                  <li key={i} className={`${rowGrid} relative py-6 sm:items-center`}>
                    <span aria-hidden="true" className="relative flex justify-center">
                      <span className="size-[5px] rounded-full bg-white/40 ring-4 ring-black" />
                    </span>
                    <span className="font-mono text-sm text-subtle tabular-nums">
                      <span aria-hidden="true">--:--</span>
                      <span className="sr-only">Time to be confirmed</span>
                    </span>
                    <span className="col-start-2 mt-2 block sm:col-start-auto sm:mt-0">
                      <span aria-hidden="true" className="redacted h-5" style={{ width: `${w}%` }} />
                      <span className="sr-only">Entry {i + 1} to be announced</span>
                    </span>
                    <span aria-hidden="true" className="fine-print col-start-2 mt-2 sm:col-start-auto sm:mt-0">
                      §&nbsp;3.{i + 1} · TBC
                    </span>
                    <span aria-hidden="true" className="absolute inset-x-0 bottom-0 ml-10 h-px bg-white/10" />
                  </li>
                ))}
              </ol>

              <p className={`${rowGrid} mt-8`}>
                <span aria-hidden="true" />
                <span data-reveal="fade" className="fine-print max-w-md sm:col-span-3">
                  Doors, sessions and intermission times are published here once speakers are confirmed. The
                  date and venue above are final.
                </span>
              </p>
            </div>
          )}
        </div>
      </div>
      <ScheduleMotion />
    </SectionShell>
  );
}
