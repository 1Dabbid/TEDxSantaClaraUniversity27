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
      <div className="shell grid grid-cols-1 gap-14 md:grid-cols-12">
        <div className="min-w-0 md:col-span-4">
          <div className="md:sticky md:top-[calc(var(--header-h)+3rem)]">
            <div data-reveal="fade">
              <SectionLabel>FAQ</SectionLabel>
            </div>
            <SectionTitle id="faq" className="text-[clamp(2.75rem,5.4vw,5.25rem)]!">
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

        <FaqList items={items} className="md:col-span-8" />
        <MoreLink href="/faq" label="All questions" className="-mt-6 md:col-span-8 md:col-start-5" />
      </div>
    </SectionShell>
  );
}
