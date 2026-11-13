import type { Schedule as ScheduleData, Settings } from '@/lib/content';
import { ComingSoonState } from '@/components/ui/ComingSoon';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { SectionShell, SectionTitle } from './SectionShell';

const KIND_LABEL = { talk: 'Talk', break: 'Break', doors: 'Doors', other: 'Program' } as const;

export function Schedule({ schedule, settings }: { schedule: ScheduleData; settings: Settings }) {
  const published = schedule.published && schedule.items.length > 0;
  return (
    <SectionShell id="schedule" className="py-32 sm:py-44">
      <div className="shell">
        <SectionLabel index={3}>Schedule</SectionLabel>
        <SectionTitle id="schedule">One evening.</SectionTitle>
        <p className="mt-6 text-lg text-mute">
          <time dateTime={settings.dateISO}>{settings.dateLong}</time>
          {settings.doorsTime ? <> · Doors {settings.doorsTime}</> : null}
          {settings.endTime ? <> · Ends {settings.endTime}</> : null}
        </p>

        <div className="mt-16">
          {published ? (
            <ol className="border-t border-white/15">
              {schedule.items.map((item, i) => (
                <li
                  key={i}
                  className="grid gap-2 border-b border-white/15 py-6 sm:grid-cols-[9rem_1fr_auto] sm:items-baseline sm:gap-8"
                >
                  <span className="font-mono text-sm text-white tabular-nums">{item.time}</span>
                  <div>
                    <p className="text-xl font-semibold tracking-tight">{item.title}</p>
                    {item.description ? <p className="mt-1 text-mute">{item.description}</p> : null}
                  </div>
                  <span className="fine-print">{KIND_LABEL[item.kind]}</span>
                </li>
              ))}
            </ol>
          ) : (
            <ComingSoonState title="The running order is still in draft." badge="Schedule coming soon">
              <p>Doors, sessions and intermission times will be published here once speakers are confirmed.</p>
            </ComingSoonState>
          )}
        </div>
      </div>
    </SectionShell>
  );
}
