import type { Settings } from '@/lib/content';
import { paragraphs } from '@/lib/content';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { SectionShell, SectionTitle } from './SectionShell';

/**
 * Tall wrapper (250vh on md+) with a sticky inner panel: the scroll runway for
 * the camera's macro push-in to the engraved fine print. Static by default.
 */
export function Theme({ settings }: { settings: Settings }) {
  const paras = paragraphs(settings.themeStory);
  return (
    <SectionShell id="theme" scrim="none" className="md:h-[250vh]">
      <div className="md:sticky md:top-[var(--header-h)] md:flex md:h-[calc(100svh-var(--header-h))] md:items-center">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 scrim-left" />
        <div className="shell grid gap-12 py-28 md:grid-cols-12 md:items-end md:py-12">
          <div className="md:col-span-7">
            <SectionLabel index={1}>The theme</SectionLabel>
            <SectionTitle id="theme">
              Read the <span className="whitespace-nowrap">fine print.</span>
            </SectionTitle>
            <p className="mt-8 max-w-xl text-xl text-balance text-white sm:text-2xl">{settings.themeTagline}</p>
          </div>
          <ol className="space-y-6 md:col-span-5" aria-label="Theme statement">
            {paras.map((p, i) => (
              <li key={i} className="grid grid-cols-[3.25rem_1fr] gap-2 border-t border-white/15 pt-4">
                <span aria-hidden="true" className="fine-print text-white">
                  §&nbsp;1.{i + 1}
                </span>
                <p className="leading-relaxed text-mute">{p}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </SectionShell>
  );
}
