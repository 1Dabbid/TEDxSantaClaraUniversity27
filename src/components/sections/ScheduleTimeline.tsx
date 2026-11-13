import type { ScheduleItem } from '@/lib/content';
import { SCHEDULE_KIND_LABEL as KIND_LABEL } from '@/lib/site';

/**
 * Machine-readable datetime for a running-order time written by editors
 * ("5:00 PM", "7 pm", "17:30"), on the event date. Null for anything else
 * ("TBA"), which then stays plain text.
 */
export function timeAttr(dateISO: string, time: string): string | null {
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
 * The published running order: a hairline (drawn top to bottom by
 * ScheduleMotion on the home page, `data-timeline-line`) with one row per
 * moment, rising one after another (global data-reveal). Shared by the home
 * Schedule section and /schedule.
 */
export function ScheduleTimeline({
  items,
  dateISO,
  className = '',
  drawn = false,
}: {
  items: ScheduleItem[];
  dateISO: string;
  className?: string;
  /** The hairline starts fully drawn (pages without ScheduleMotion). */
  drawn?: boolean;
}) {
  return (
    <div className={`relative ${className}`} data-timeline>
      {/* The hairline: drawn top to bottom by scroll. */}
      <span aria-hidden="true" className="pointer-events-none absolute bottom-0 left-[0.625rem] top-0 w-px bg-white/10" />
      <span
        aria-hidden="true"
        data-timeline-line
        data-armed={drawn ? '' : undefined}
        className="timeline-line pointer-events-none absolute bottom-0 left-[0.625rem] top-0 w-px bg-accent"
      />
      <ol data-reveal="stagger" data-reveal-variant="wipe">
        {items.map((item, i) => (
          <li key={i} className={`${rowGrid} relative py-6`}>
            <span aria-hidden="true" className="relative mt-2 flex justify-center sm:mt-0">
              <span className="size-[5px] rounded-full bg-white ring-4 ring-black" />
            </span>
            {(() => {
              const dt = timeAttr(dateISO, item.time);
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
  );
}
