import type { Metadata } from 'next';
import Image from 'next/image';
import type { PartnerBenefit, Sponsor, Tier } from '@/lib/content';
import { getPartnerBenefits, getSettings, getSponsors, getTiers } from '@/lib/content';
import { partnerCta } from '@/lib/links';
import { SITE_NAME } from '@/lib/site';
import { Button } from '@/components/ui/Button';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { ClauseNo, Tba } from '@/components/print/Print';

const DESCRIPTION =
  'Partner with TEDxSantaClaraUniversity: support the first mainstage event at Santa Clara University, up to 100 guests, with talks published on the TEDx YouTube channel.';

export const metadata: Metadata = {
  title: 'Partners',
  description: DESCRIPTION,
  alternates: { canonical: '/partners' },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: `Partners · ${SITE_NAME}`,
    description: DESCRIPTION,
    url: '/partners',
    locale: 'en_US',
  },
  twitter: { card: 'summary_large_image', title: `Partners · ${SITE_NAME}`, description: DESCRIPTION },
};

const REASONS = [
  {
    figure: '1st',
    title: 'The first mainstage event.',
    body: 'This is the first TEDxSantaClaraUniversity mainstage event. Founding partners are there from the very first clause.',
  },
  {
    figure: '100',
    title: 'Up to 100 guests.',
    body: 'One room, one evening, an audience that chose to be there. Small enough that support is noticed.',
  },
  {
    figure: '▶',
    title: 'Talks that travel.',
    body: 'Talks are recorded and published on the TEDx YouTube channel, so the ideas outlast the evening.',
  },
  {
    figure: '12',
    figureNote: 'months',
    title: 'A year-round community.',
    body: 'Beyond the mainstage, TEDxSantaClaraUniversity runs general-meeting events throughout the year.',
  },
];

const RULES = [
  {
    title: 'The stage is not for sale.',
    body: 'Partners cannot speak or present from the stage, and have no say over the programme or the speakers.',
  },
  {
    title: 'Thanks, on one slide.',
    body: 'Partner logos appear on stage only on the thank-you slide, never during talks.',
  },
  {
    title: 'Recognition stays in its place.',
    body: 'Logos appear on this page and on the thank-you slide, always smaller than the event’s own mark.',
  },
  {
    title: 'The list is for event news.',
    body: 'Our mailing list is used only for TEDxSantaClaraUniversity event news, never for partner promotions.',
  },
];

function TierCard({ tier, index, benefits }: { tier: Tier; index: number; benefits: string[] }) {
  const terms = [
    tier.amount ? { k: 'Contribution', v: tier.amount } : null,
    tier.slots ? { k: 'Slots', v: String(tier.slots) } : null,
  ].filter((x): x is { k: string; v: string } => x !== null);

  return (
    <li className="flex flex-col border border-white/15 bg-black/80 p-6 sm:p-8">
      <div className="flex items-baseline justify-between gap-4">
        <ClauseNo>2.{index + 1}</ClauseNo>
        <span className="fine-print">Schedule {String.fromCharCode(65 + index)}</span>
      </div>
      <h3 className="mt-10 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{tier.name}</h3>
      {tier.description ? <p className="mt-4 max-w-md text-mute">{tier.description}</p> : null}
      {benefits.length ? (
        <ul className="mt-6 space-y-2 text-sm text-white">
          {benefits.map((b) => (
            <li key={b} className="flex gap-3">
              <span aria-hidden="true" className="text-subtle">
                —
              </span>
              {b}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-auto pt-10">
        {terms.length ? (
          <dl className="grid grid-cols-2 gap-4 border-t border-white/15 pt-4">
            {terms.map((t) => (
              <div key={t.k}>
                <dt className="fine-print">{t.k}</dt>
                <dd className="mt-1 text-xl font-semibold tracking-tight tabular-nums">{t.v}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="border-t border-white/15 pt-4">
            <Tba>Terms on request</Tba>
          </p>
        )}
      </div>
    </li>
  );
}

function BenefitsComparison({ tiers, benefits }: { tiers: Tier[]; benefits: PartnerBenefit[] }) {
  if (!benefits.length || !tiers.length) {
    return (
      <div className="mt-12 border border-dashed border-white/25 p-6 sm:p-10">
        <p className="text-2xl font-semibold tracking-tight sm:text-3xl">The schedule of benefits is being finalized.</p>
        <p className="mt-3 max-w-xl text-mute">
          Ask us for the current draft and we will walk you through what each tier includes, within TEDx rules.
        </p>
      </div>
    );
  }
  const Yes = () => (
    <>
      <span aria-hidden="true" className="text-white">
        ●
      </span>
      <span className="sr-only">Included</span>
    </>
  );
  const No = () => (
    <>
      <span aria-hidden="true" className="text-subtle">
        —
      </span>
      <span className="sr-only">Not included</span>
    </>
  );
  return (
    <>
      {/* Wide screens: a real table. */}
      <div className="mt-12 hidden md:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Benefits included in each partnership tier</caption>
          <thead>
            <tr className="border-b border-white/30">
              <th scope="col" className="fine-print py-4 pr-6 font-normal">
                Benefit
              </th>
              {tiers.map((t) => (
                <th key={t.slug} scope="col" className="w-[14%] py-4 text-center text-sm font-medium text-white">
                  {t.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {benefits.map((b) => (
              <tr key={b.benefit} className="border-b border-white/10">
                <th scope="row" className="py-5 pr-6 font-normal text-mute">
                  {b.benefit}
                </th>
                {tiers.map((t) => (
                  <td key={t.slug} className="py-5 text-center">
                    {b.tiers.includes(t.slug) ? <Yes /> : <No />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Phones: one row per benefit, listing its tiers. */}
      <ul className="mt-10 border-t border-white/15 md:hidden">
        {benefits.map((b) => {
          const names = tiers.filter((t) => b.tiers.includes(t.slug)).map((t) => t.name);
          return (
            <li key={b.benefit} className="border-b border-white/15 py-5">
              <p className="text-white">{b.benefit}</p>
              <p className="fine-print mt-2">{names.length ? names.join(' · ') : 'Not yet assigned to a tier'}</p>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function SponsorMark({ sponsor }: { sponsor: Sponsor }) {
  const mark = sponsor.logo ? (
    // Capped at 32px tall: always smaller than the event logo in the header.
    <Image
      src={sponsor.logo}
      alt={sponsor.name}
      width={160}
      height={32}
      className="h-8 max-h-8 w-auto max-w-[10rem] object-contain"
    />
  ) : (
    <span className="text-lg font-medium text-white">{sponsor.name}</span>
  );
  return (
    <li data-cursor="loupe" className="flex min-h-28 items-center justify-center border border-white/10 bg-black p-6">
      {sponsor.url ? (
        <a href={sponsor.url} target="_blank" rel="noopener noreferrer" className="inline-flex p-1">
          {mark}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ) : (
        mark
      )}
    </li>
  );
}

function CurrentPartners({ tiers, sponsors, cta }: { tiers: Tier[]; sponsors: Sponsor[]; cta: string }) {
  const groups = tiers
    .map((t) => ({ tier: t, items: sponsors.filter((s) => s.tier === t.slug) }))
    .filter((g) => g.items.length);
  const untiered = sponsors.filter((s) => !tiers.some((t) => t.slug === s.tier));
  const founding = tiers.find((t) => /founding/i.test(t.name))?.name ?? tiers[0]?.name ?? 'Founding Partner';

  if (!groups.length && !untiered.length) {
    return (
      <div className="mt-12 grid gap-px border border-white/10 bg-white/10 sm:grid-cols-3">
        <a
          href={cta}
          data-cursor="link"
          className="group flex min-h-56 flex-col justify-between border border-dashed border-white/30 bg-black p-6 transition-colors hover:bg-white/[0.03] sm:col-span-2 sm:min-h-72 sm:p-10"
        >
          <span className="fine-print">Vacant</span>
          <span className="block text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
            {founding}: this space is open.
          </span>
          <span className="fine-print text-white group-hover:underline">Claim it →</span>
        </a>
        {[0, 1].map((i) => (
          <div key={i} aria-hidden="true" className="hidden min-h-36 flex-col justify-between bg-black p-6 sm:flex">
            <span className="fine-print">Reserved</span>
            <span className="block h-px w-full border-t border-dashed border-white/20" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-12 space-y-14">
      {groups.map((g) => (
        <div key={g.tier.slug}>
          <h3 className="fine-print text-white">{g.tier.name}s</h3>
          <ul className="mt-4 grid grid-cols-2 gap-px bg-white/10 sm:grid-cols-3 lg:grid-cols-4">
            {g.items.map((s) => (
              <SponsorMark key={s.slug} sponsor={s} />
            ))}
          </ul>
        </div>
      ))}
      {untiered.length ? (
        <div>
          <h3 className="fine-print text-white">Partners</h3>
          <ul className="mt-4 grid grid-cols-2 gap-px bg-white/10 sm:grid-cols-3 lg:grid-cols-4">
            {untiered.map((s) => (
              <SponsorMark key={s.slug} sponsor={s} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export default async function PartnersPage() {
  const [settings, tiers, sponsors, benefits] = await Promise.all([
    getSettings(),
    getTiers(),
    getSponsors(),
    getPartnerBenefits(),
  ]);
  const cta = partnerCta(settings);
  const ctaLabel = cta.kind === 'email' ? `Email ${cta.display}` : 'Contact us via tedxscu.com';

  return (
    <div className="relative isolate">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-black/85" />

      {/* Hero */}
      <section aria-labelledby="partners-title" className="shell pb-24 pt-20 sm:pb-32 sm:pt-32">
        <p data-reveal="fade" className="fine-print">
          Partners · Prospectus · {settings.themeName}
        </p>
        <h1
          id="partners-title"
          data-reveal="lines"
          className="mt-8 max-w-[13ch] text-[clamp(3rem,9.5vw,9rem)] leading-[0.9] font-semibold tracking-[-0.055em] text-balance"
        >
          Put your name in the fine print.
        </h1>
        <div className="mt-12 grid gap-10 md:grid-cols-12 md:items-end">
          <p data-reveal="fade" className="max-w-xl text-lg text-mute sm:text-xl md:col-span-7">
            {settings.eventName} is an independently organized evening of ideas on{' '}
            <time dateTime={settings.dateISO}>{settings.dateLong}</time> at the {settings.venueName},{' '}
            {settings.venueCampus || 'Santa Clara University'}. We are inviting a small number of partners to make it
            possible.
          </p>
          <div className="flex flex-wrap gap-3 md:col-span-5 md:justify-end">
            <Button href={cta.href} size="lg">
              Become a partner
            </Button>
            <Button href="#tiers" variant="ghost" size="lg">
              See the tiers
            </Button>
          </div>
        </div>
        <dl data-reveal="stagger" className="mt-16 grid grid-cols-2 gap-6 border-t border-white/15 pt-6 sm:grid-cols-4">
          {[
            ['Party of the first part', settings.eventName],
            ['Date', settings.dateShort],
            ['Venue', settings.venueName],
            ['Capacity', 'Up to 100 guests'],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="fine-print">{k}</dt>
              <dd className="mt-1.5 text-sm text-white break-words sm:text-base">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* § 01 Why partner */}
      <section aria-labelledby="why-title" className="shell py-24 sm:py-32">
        <div data-reveal="fade">
          <SectionLabel index={1}>Why partner</SectionLabel>
        </div>
        <h2 id="why-title" data-reveal="lines" className="mt-6 max-w-3xl text-title font-semibold tracking-tight">
          Recitals.
          <span className="text-mute"> The facts on which this agreement rests.</span>
        </h2>
        <ol data-reveal="stagger" className="mt-14 grid gap-px border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
          {REASONS.map((r, i) => (
            <li key={r.title} className="flex flex-col bg-black p-6 sm:p-8">
              <span className="fine-print">Whereas ({String.fromCharCode(97 + i)})</span>
              <span
                aria-hidden="true"
                className="mt-8 block text-[clamp(3.5rem,6vw,5.5rem)] leading-none font-semibold tracking-[-0.05em] tabular-nums"
              >
                {r.figure}
                {r.figureNote ? <span className="fine-print ml-2 align-top tracking-[0.14em]">{r.figureNote}</span> : null}
              </span>
              <h3 className="mt-8 text-xl font-semibold tracking-tight">{r.title}</h3>
              <p className="mt-3 text-mute">{r.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* § 02 Tiers */}
      <section id="tiers" aria-labelledby="tiers-title" className="shell py-24 sm:py-32">
        <div data-reveal="fade">
          <SectionLabel index={2}>Tiers</SectionLabel>
        </div>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
          <h2 id="tiers-title" data-reveal="lines" className="text-headline font-semibold tracking-[-0.045em]">
            Partnership tiers.
          </h2>
          {tiers.every((t) => !t.amount) ? (
            <p className="fine-print max-w-xs">Packages in draft. Contributions and slots on request.</p>
          ) : null}
        </div>
        {tiers.length ? (
          <ol data-reveal="stagger" className="mt-14 grid gap-4 md:grid-cols-2">
            {tiers.map((tier, i) => (
              <TierCard
                key={tier.slug}
                tier={tier}
                index={i}
                benefits={benefits.filter((b) => b.tiers.includes(tier.slug)).map((b) => b.benefit)}
              />
            ))}
          </ol>
        ) : (
          <p className="mt-12">
            <Tba>Tiers to be announced</Tba>
          </p>
        )}
      </section>

      {/* § 03 Benefits */}
      <section aria-labelledby="benefits-title" className="shell py-24 sm:py-32">
        <div data-reveal="fade">
          <SectionLabel index={3}>Benefits</SectionLabel>
        </div>
        <h2 id="benefits-title" data-reveal="lines" className="mt-6 text-title font-semibold tracking-tight">
          Schedule of benefits.
        </h2>
        <BenefitsComparison tiers={tiers} benefits={benefits} />
      </section>

      {/* § 04 Current partners */}
      <section aria-labelledby="current-title" className="shell py-24 sm:py-32">
        <div data-reveal="fade">
          <SectionLabel index={4}>Current partners</SectionLabel>
        </div>
        <h2 id="current-title" data-reveal="lines" className="mt-6 text-title font-semibold tracking-tight">
          Signed so far.
        </h2>
        <CurrentPartners tiers={tiers} sponsors={sponsors} cta={cta.href} />
      </section>

      {/* § 05 How it works */}
      <section aria-labelledby="rules-title" className="shell py-24 sm:py-32">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-4">
            <div data-reveal="fade">
              <SectionLabel index={5}>Terms</SectionLabel>
            </div>
            <h2 id="rules-title" data-reveal="lines" className="mt-6 text-title font-semibold tracking-tight">
              How TEDx partnerships work.
            </h2>
            <p data-reveal="fade" className="mt-6 max-w-sm text-mute">
              Every TEDx event follows rules set by TED. They protect the talks, and they are the reason partners can
              trust the room.
            </p>
          </div>
          <ol data-reveal="stagger" className="border-t border-white/15 md:col-span-8">
            {RULES.map((r, i) => (
              <li key={r.title} className="grid grid-cols-[3.75rem_1fr] gap-2 border-b border-white/15 py-7 sm:grid-cols-[5rem_1fr]">
                <ClauseNo>5.{i + 1}</ClauseNo>
                <div>
                  <h3 className="text-xl font-semibold tracking-tight">{r.title}</h3>
                  <p className="mt-2 max-w-xl text-mute">{r.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section aria-labelledby="partner-cta-title" className="shell pb-32 pt-12 sm:pb-44">
        <div className="border border-white/15 bg-black p-6 sm:p-14">
          <p className="fine-print">§ 06 · Execution</p>
          <h2
            id="partner-cta-title"
            data-reveal="lines"
            className="mt-6 max-w-4xl text-[clamp(2.5rem,6vw,5.5rem)] leading-[0.95] font-semibold tracking-[-0.045em] text-balance"
          >
            Become a partner.
          </h2>
          <p data-reveal="fade" className="mt-6 max-w-xl text-lg text-mute">
            Tell us a little about your organization and we will send the partnership details.
          </p>
          <div className="mt-14 grid gap-10 sm:grid-cols-2 sm:items-end">
            <div>
              <div className="flex items-end gap-4 pb-3">
                <span aria-hidden="true" className="font-mono text-sm text-subtle">
                  ✕
                </span>
                <span className="text-xl font-light tracking-tight text-mute sm:text-2xl">Your organization</span>
              </div>
              <div data-reveal="rule" aria-hidden="true" className="h-px bg-white/50" />
              <p className="fine-print mt-3">Party of the second part</p>
            </div>
            <div className="flex flex-col gap-3 sm:items-end">
              <Button href={cta.href} size="lg">
                {ctaLabel}
              </Button>
              {cta.kind === 'email' ? (
                <p className="fine-print">Partnerships, sponsorships and corporate enquiries</p>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
