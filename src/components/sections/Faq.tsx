import type { FaqItem, Settings } from '@/lib/content';
import { faqJsonLd, jsonLdString } from '@/lib/jsonld';
import { clause } from '@/lib/links';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { JsonLd } from '@/components/print/Print';
import { SectionShell, SectionTitle } from './SectionShell';

/**
 * Native <details>/<summary> accordion: works without JavaScript, keyboard
 * operable (Enter/Space), and announced as expandable by screen readers.
 */
export function Faq({ items, settings }: { items: FaqItem[]; settings: Settings }) {
  if (!settings.sections.showFaq || items.length === 0) return null;

  return (
    <SectionShell id="faq" scrim="solid" className="py-32 sm:py-44">
      <JsonLd json={jsonLdString(faqJsonLd(items))} />
      <div className="shell grid grid-cols-1 gap-14 md:grid-cols-12">
        <div className="min-w-0 md:col-span-4">
          <div className="md:sticky md:top-[calc(var(--header-h)+3rem)]">
            <div data-reveal="fade">
              <SectionLabel index={7}>FAQ</SectionLabel>
            </div>
            <SectionTitle id="faq" className="text-[clamp(2.75rem,5.4vw,5.25rem)]!">
              <span data-reveal="lines" className="block">
                Questions, answered.
              </span>
            </SectionTitle>
            <p data-reveal="fade" className="mt-8 max-w-xs text-mute [overflow-wrap:anywhere] [&>a]:text-white">
              {items.length} clauses, in plain language.
              {settings.contactEmail ? (
                <>
                  {' '}
                  Anything else:{' '}
                  <a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a>
                </>
              ) : null}
            </p>
          </div>
        </div>

        <ol data-reveal="stagger" className="min-w-0 border-t border-white/15 md:col-span-8">
          {items.map((item, i) => (
            <li key={i} className="min-w-0 border-b border-white/15">
              <details className="group">
                <summary
                  className="group/q grid min-h-11 cursor-pointer list-none grid-cols-[3.75rem_minmax(0,1fr)_2rem] items-baseline gap-2 py-7 text-lg font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-[-2px] sm:grid-cols-[5rem_minmax(0,1fr)_2.5rem] sm:text-2xl sm:tracking-tight [&::-webkit-details-marker]:hidden"
                >
                  <span
                    aria-hidden="true"
                    className="fine-print text-mute tabular-nums transition-colors duration-300 group-hover/q:text-white group-open:text-white"
                  >
                    §&nbsp;{clause(7, i + 1)}
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
                    <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-current transition-transform duration-300 group-open:scale-y-0" />
                  </span>
                </summary>
                <div className="grid grid-cols-[3.75rem_minmax(0,1fr)_2rem] gap-2 pb-9 sm:grid-cols-[5rem_minmax(0,1fr)_2.5rem]">
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
