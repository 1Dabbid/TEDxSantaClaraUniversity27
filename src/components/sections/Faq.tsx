import type { FaqItem, Settings } from '@/lib/content';
import { faqJsonLd, jsonLdString } from '@/lib/jsonld';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { JsonLd } from '@/components/print/Print';
import { FaqMotion } from '@/motion/sections/FaqMotion';
import { MoreLink } from '@/components/pages/MoreLink';
import { FaqList } from './FaqList';
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

        <FaqList items={items} className="lg:col-span-8" />
        <MoreLink href="/faq" label="All questions" className="-mt-6 lg:col-span-8 lg:col-start-5" />
      </div>
    </SectionShell>
  );
}
