import type { Metadata } from 'next';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { ComingSoonBadge } from '@/components/ui/ComingSoon';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { getSettings, getSponsors, getTiers } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Partners',
  description:
    'Partner with TEDxSantaClaraUniversity: support an evening of ideas at Santa Clara University, limited to 100 seats.',
  alternates: { canonical: '/partners' },
};

const REASONS = [
  {
    title: 'A room that listens.',
    body: 'One evening, 100 seats, an audience that chose to be there. Small enough that your support is noticed.',
  },
  {
    title: 'Ideas from Santa Clara University.',
    body: 'Talks drawn from the university community and beyond, organized independently under license from TED.',
  },
  {
    title: 'Recognition with restraint.',
    body: 'Partners are acknowledged on this site and at the event, in line with TEDx brand and sponsorship guidelines.',
  },
];

export default async function PartnersPage() {
  const [settings, tiers, sponsors] = await Promise.all([getSettings(), getTiers(), getSponsors()]);
  const contactHref = settings.partnershipsEmail
    ? `mailto:${settings.partnershipsEmail}?subject=Partnering%20with%20TEDxSantaClaraUniversity`
    : settings.contactEmail
      ? `mailto:${settings.contactEmail}?subject=Partnering%20with%20TEDxSantaClaraUniversity`
      : 'https://tedxscu.com';

  return (
    <div className="relative isolate">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 scrim-y" />

      <section aria-labelledby="partners-title" className="shell pb-24 pt-24 sm:pt-36">
        <p className="fine-print">Partners · {settings.themeName}</p>
        <h1 id="partners-title" className="mt-6 max-w-5xl text-headline font-semibold tracking-[-0.045em] text-balance">
          Put your name to the details that matter.
        </h1>
        <p className="mt-8 max-w-2xl text-lg text-mute sm:text-xl">
          {settings.eventName} is an independently organized evening of ideas on{' '}
          <time dateTime={settings.dateISO}>{settings.dateLong}</time> at the {settings.venueName}, Santa Clara
          University. We are inviting a small number of partners to make it possible.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Button href={contactHref} size="lg">
            Become a partner
          </Button>
          <Button href="#tiers" variant="ghost" size="lg">
            See partnership tiers
          </Button>
        </div>
      </section>

      <section aria-labelledby="why-title" className="shell py-24">
        <SectionLabel index={1}>Why partner</SectionLabel>
        <h2 id="why-title" className="sr-only">
          Why partner with us
        </h2>
        <ul className="mt-10 grid gap-px border border-white/10 bg-white/10 md:grid-cols-3">
          {REASONS.map((r) => (
            <li key={r.title} className="bg-black p-8">
              <h3 className="text-xl font-semibold tracking-tight">{r.title}</h3>
              <p className="mt-3 text-mute">{r.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section id="tiers" aria-labelledby="tiers-title" className="shell py-24">
        <SectionLabel index={2}>Tiers</SectionLabel>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
          <h2 id="tiers-title" className="text-title font-semibold tracking-tight">
            Partnership tiers
          </h2>
          <ComingSoonBadge>Packages in draft · details on request</ComingSoonBadge>
        </div>
        <ol className="mt-12 border-t border-white/15">
          {tiers.map((tier, i) => {
            const tierSponsors = sponsors.filter((s) => s.tier === tier.slug);
            return (
              <li key={tier.slug} className="grid gap-6 border-b border-white/15 py-10 md:grid-cols-12">
                <span aria-hidden="true" className="fine-print text-white md:col-span-1">
                  §&nbsp;2.{i + 1}
                </span>
                <div className="md:col-span-5">
                  <h3 className="text-2xl font-semibold tracking-tight">{tier.name}</h3>
                  <p className="mt-2 text-mute">{tier.description}</p>
                </div>
                <dl className="grid grid-cols-2 gap-4 md:col-span-3">
                  <div>
                    <dt className="fine-print">Contribution</dt>
                    <dd className="mt-1 text-white">{tier.amount || 'On request'}</dd>
                  </div>
                  <div>
                    <dt className="fine-print">Slots</dt>
                    <dd className="mt-1 text-white">{tier.slots ?? 'Limited'}</dd>
                  </div>
                </dl>
                <div className="md:col-span-3">
                  {tierSponsors.length ? (
                    <ul className="flex flex-wrap items-center gap-6" aria-label={`${tier.name}s`}>
                      {tierSponsors.map((s) => {
                        const logo = s.logo ? (
                          // Sponsor logos are capped well below the event logo's header size.
                          <Image
                            src={s.logo}
                            alt={s.name}
                            width={120}
                            height={32}
                            className="h-8 max-h-8 w-auto max-w-[7.5rem] object-contain"
                          />
                        ) : (
                          <span className="text-white">{s.name}</span>
                        );
                        return (
                          <li key={s.slug}>
                            {s.url ? (
                              <a href={s.url} target="_blank" rel="noopener noreferrer">
                                {logo}
                                <span className="sr-only"> (opens in a new tab)</span>
                              </a>
                            ) : (
                              logo
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="fine-print">Partner slots open</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="partner-cta-title" className="shell py-28">
        <div className="border border-white/10 bg-black p-8 sm:p-14">
          <p className="fine-print">Become a partner</p>
          <h2 id="partner-cta-title" className="mt-4 max-w-3xl text-title font-semibold tracking-tight">
            Let’s talk about what your support makes possible.
          </h2>
          <p className="mt-4 max-w-xl text-mute">
            Tell us a little about your organization and we will send the partnership details.
          </p>
          <div className="mt-8">
            <Button href={contactHref} size="lg">
              Start the conversation
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
