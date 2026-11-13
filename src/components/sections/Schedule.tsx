import type { Schedule as ScheduleData, Settings } from '@/lib/content';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { SCHEDULE_KIND_LABEL as KIND_LABEL } from '@/lib/site';
import { ScheduleMotion } from '@/motion/sections/ScheduleMotion';
import { SectionShell, SectionTitle } from './SectionShell';

/**
 * Machine-readable datetime for a running-order time written by editors
 * ("5:00 PM", "7 pm", "17:30"), on the event date. Null for anything else
 * ("TBA"), which then stays plain text.
 */
function timeAttr(dateISO: string, time: string): string | null {
  const t = time.trim();
  const ampm = t.match(/^(\d{1,2})(?:[:.](\d{2}))?\s*([ap])\.?\s*m\.?$/i);
  const h24 = t.match(/^(\d{1,2})[:.](\d{2})$/);
  let h: number;
  let m: number;
  if (ampm) {
    h = Number(ampm[1]) % 12 + (ampm[3].toLowerCase() === 'p' ? 12 : 0);
    m = Number(ampm[2] ?? 0);
    if (Number(ampm[1]) > 12) return null;
  } else if (h24) {
    h = Number(h24[1]);
    m = Number(h24[2]);
  } else return null;
  if (h > 23 || m > 59 || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return null;
  return `${dateISO}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const rowGrid =
  'grid grid-cols-[1.25rem_1fr] gap-x-4 sm:grid-cols-[1.25rem_8rem_1fr_auto] sm:items-baseline sm:gap-x-8 lg:grid-cols-[1.25rem_5rem_1fr_auto] lg:gap-x-6';

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
          <div className="relative mt-16 lg:mt-20 lg:max-w-[32rem]" data-timeline>
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
            <ol data-reveal="stagger" data-reveal-variant="wipe">
              {schedule.items.map((item, i) => (
                <li key={i} className={`${rowGrid} relative py-6`}>
                  <span aria-hidden="true" className="relative mt-2 flex justify-center sm:mt-0">
                    <span className="size-[5px] rounded-full bg-white ring-4 ring-black" />
                  </span>
                  {(() => {
                    const dt = timeAttr(settings.dateISO, item.time);
                    const cls = 'font-mono text-sm text-white tabular-nums';
                    return dt ? (
                      <time dateTime={dt} className={cls}>
                        {item.time}
                      </time>
                    ) : (
                      <span className={cls}>{item.time}</span>
                    );
                  })()}
                  <div className="col-start-2 mt-1 sm:col-start-auto sm:mt-0">
                    <p className="text-xl font-semibold tracking-tight sm:text-2xl">{item.title}</p>
                    {item.description ? <p className="mt-1 max-w-xl text-mute">{item.description}</p> : null}
                  </div>
                  <span className="fine-print col-start-2 mt-2 sm:col-start-auto sm:mt-0">{KIND_LABEL[item.kind]}</span>
                  <span aria-hidden="true" className="absolute inset-x-0 bottom-0 ml-10 h-px bg-white/10" />
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <div className="mt-12 border-t border-white/15 pt-8 lg:max-w-[32rem]">
            <p data-reveal="lines" className="text-title font-semibold tracking-tight text-balance lg:text-[2.25rem]">
              Running order to follow.
            </p>
            <p data-reveal="fade" className="mt-4 text-mute">
              Doors, talks and intermission times are published here once the speakers are confirmed. The date and venue are final.
            </p>
          </div>
        )}
      </div>
      <ScheduleMotion />
    </SectionShell>
  );
}
