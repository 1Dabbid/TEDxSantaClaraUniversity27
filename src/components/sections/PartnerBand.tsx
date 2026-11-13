import type { Settings } from '@/lib/content';
import { partnerCta } from '@/lib/links';
import { seatsLabel } from '@/lib/site';
import { Button } from '@/components/ui/Button';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Arrow } from '@/components/print/Print';

/**
 * Partner invitation on the home page. Text only, by TEDx rule: no sponsor
 * logos or names on the home page, ever (tests/e2e/home-html.spec.ts). It
 * invites; the pitch itself lives on /partners.
 *
 * Not a scene section (no data-section): it sits on solid black after Tickets,
 * where the 3D journey is already fading out, so the camera simply holds.
 */
export function PartnerBand({ settings }: { settings: Settings }) {
  const cta = partnerCta(settings);
  const mail =
    cta.kind === 'email'
      ? `mailto:${settings.partnershipsEmail}?subject=${encodeURIComponent(`Partnering with ${settings.eventName}`)}`
      : null;
  return (
    <section aria-labelledby="partner-band-title" className="relative isolate bg-black py-24 sm:py-32">
      <div className="shell">
        <div className="grid gap-10 border-y border-white/15 py-12 sm:py-16 md:grid-cols-12 md:items-end">
          <div className="md:col-span-7">
            <SectionLabel>For organizations</SectionLabel>
            <h2
              id="partner-band-title"
              data-reveal="lines"
              className="mt-6 text-title font-semibold tracking-tight text-balance"
            >
              Help make the first one happen.
            </h2>
            <p data-reveal="fade" className="mt-5 max-w-xl text-lg text-mute">
              {settings.eventName} is student-run and this is its first mainstage event: one evening,{' '}
              {seatsLabel(settings.capacity)}, talks recorded and submitted for publication on the TEDx Talks YouTube
              channel. We are inviting a small number of partners to support it.
            </p>
          </div>
          <div className="flex flex-col items-start gap-4 md:col-span-5 md:items-end">
            <Button href="/partners" size="lg">
              Partnership details
              <Arrow className="transition-transform duration-500 ease-[var(--ease-cinema)] group-hover:translate-x-0.5" />
            </Button>
            {mail ? (
              <a href={mail} className="link-draw inline-block py-1.5 text-mute hover:text-white [overflow-wrap:anywhere]">
                or write to {settings.partnershipsEmail}
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
