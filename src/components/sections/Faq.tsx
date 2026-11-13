import type { FaqItem, Settings } from '@/lib/content';
import { faqJsonLd, jsonLdString } from '@/lib/jsonld';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { JsonLd } from '@/components/print/Print';
import { FaqMotion } from '@/motion/sections/FaqMotion';
import { SectionShell, SectionTitle } from './SectionShell';

/**
 * Native <details>/<summary> accordion: works without JavaScript, keyboard
 * operable (Enter/Space), and announced as expandable by screen readers.
 */
export function Faq({ items, settings }: { items: FaqItem[]; settings: Settings }) {
  if (!settings.sections.showFaq || items.length === 0) return null;

  return (
    <SectionShell id="faq" scrim="solid" className="py-24 sm:py-32">
      <FaqMotion />
      <JsonLd json={jsonLdString(faqJsonLd(items))} />
      {/* Two columns from lg only: at tablet width a third of the measure broke "Questions," mid-word. */}
      <div className="shell grid grid-cols-1 gap-14 lg:grid-cols-12">
        <div className="@container min-w-0 lg:col-span-4">
          <div className="lg:sticky lg:top-[calc(var(--header-h)+3rem)]">
            <div data-reveal="fade">
              <SectionLabel>FAQ</SectionLabel>
            </div>
            {/* Sized to its column: "Questions," is 4.78em wide, so at most a fifth of the
                column. Sized to the viewport alone, it ran a few pixels past the column at some
                widths and the browser broke the comma onto a line of its own. */}
            <SectionTitle id="faq" className="text-[min(100cqi/5,clamp(2.75rem,4.6vw,5.25rem))]!">
              <span data-reveal="lines" className="block">
                Questions, answered.
              </span>
            </SectionTitle>
            <p data-reveal="fade" className="mt-8 max-w-xs text-mute [overflow-wrap:anywhere] [&>a]:text-white">
              Short answers, in plain language.
              {settings.contactEmail ? (
                <>
                  {' '}
                  Anything else:{' '}
                  <a href={`mailto:${settings.contactEmail}?subject=${encodeURIComponent(`Question · ${settings.eventName}`)}`}>{settings.contactEmail}</a>
                </>
              ) : null}
            </p>
          </div>
        </div>

        <ol data-reveal="stagger" className="min-w-0 border-t border-white/15 lg:col-span-8">
          {items.map((item, i) => (
            <li key={i} className="min-w-0 border-b border-white/15">
              <details className="faq-clause group">
                <summary
                  className="group/q grid min-h-11 cursor-pointer list-none grid-cols-[2.5rem_minmax(0,1fr)_2rem] items-baseline gap-2 py-6 text-lg font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-[-2px] sm:grid-cols-[4rem_minmax(0,1fr)_2.5rem] sm:text-2xl sm:tracking-tight [&::-webkit-details-marker]:hidden"
                >
                  <span
                    aria-hidden="true"
                    className="fine-print text-mute tabular-nums transition-colors duration-300 group-hover/q:text-white group-open:text-white"
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {/* overflow-wrap: the long event name must not push the page sideways at 320px. */}
                  <span className="min-w-0 text-balance [overflow-wrap:anywhere] transition-transform duration-500 ease-[var(--ease-cinema)] pointer-fine:group-hover/q:translate-x-1">
                    {item.question}
                  </span>
                  {/* Plus that turns into a minus: shape change, not colour. */}
                  <span
                    aria-hidden="true"
                    className="relative ml-auto block size-4 self-center text-mute transition-colors duration-300 group-hover/q:text-white group-open:text-white"
                  >
                    <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-current" />
                    <span className="faq-icon-v absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-current" />
                  </span>
                </summary>
                <div className="faq-answer grid grid-cols-[2.5rem_minmax(0,1fr)_2rem] gap-2 pb-8 sm:grid-cols-[4rem_minmax(0,1fr)_2.5rem]">
                  <span aria-hidden="true" />
                  <p className="min-w-0 max-w-2xl leading-relaxed whitespace-pre-line text-mute [overflow-wrap:anywhere] sm:text-lg">{item.answer}</p>
                </div>
              </details>
            </li>
          ))}
        </ol>
      </div>
    </SectionShell>
  );
}
