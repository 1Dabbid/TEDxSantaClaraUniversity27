import type { FaqItem, Settings } from '@/lib/content';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { SectionShell, SectionTitle } from './SectionShell';

export function Faq({ items, settings }: { items: FaqItem[]; settings: Settings }) {
  return (
    <SectionShell id="faq" scrim="solid" className="py-32 sm:py-44">
      <div className="shell grid gap-12 md:grid-cols-12">
        <div className="md:col-span-4">
          <SectionLabel index={7}>FAQ</SectionLabel>
          <SectionTitle id="faq">Questions, answered.</SectionTitle>
          {settings.contactEmail ? (
            <p className="mt-6 text-mute">
              Something else?{' '}
              <a href={`mailto:${settings.contactEmail}`} className="text-white underline underline-offset-4">
                {settings.contactEmail}
              </a>
            </p>
          ) : null}
        </div>
        <div className="md:col-span-8">
          <ul className="border-t border-white/15">
            {items.map((item, i) => (
              <li key={i} className="border-b border-white/15">
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-baseline gap-4 py-6 text-lg font-medium text-white marker:hidden sm:text-xl [&::-webkit-details-marker]:hidden">
                    <span aria-hidden="true" className="fine-print w-12 shrink-0">
                      §&nbsp;7.{i + 1}
                    </span>
                    <span className="flex-1">{item.question}</span>
                    <span
                      aria-hidden="true"
                      className="text-2xl leading-none text-subtle transition-transform duration-300 group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <div className="pb-8 pl-16 pr-8 leading-relaxed whitespace-pre-line text-mute">{item.answer}</div>
                </details>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </SectionShell>
  );
}
