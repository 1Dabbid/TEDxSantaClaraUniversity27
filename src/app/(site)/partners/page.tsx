import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Image from 'next/image';
import type { PartnerBenefit, Settings, Sponsor, Tier } from '@/lib/content';
import { getPartnerBenefits, getSettings, getSponsors, getTiers } from '@/lib/content';
import { partnerCta } from '@/lib/links';
import { SITE_NAME, venueLine } from '@/lib/site';
import { Button } from '@/components/ui/Button';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { keepTedxCase } from '@/components/ui/KeepCase';
import { Arrow, ClauseNo, Tba } from '@/components/print/Print';
import { PartnersMotion } from '@/motion/sections/PartnersMotion';

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  const description = s.copy.partnersDescription;
  // Share image: the root opengraph-image.tsx (file convention, hashed URL), never set here.
  return {
    title: 'Partners',
    description,
    alternates: { canonical: '/partners' },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      title: `${SITE_NAME} · Partners`,
      description,
      url: '/partners',
      locale: 'en_US',
    },
    twitter: { card: 'summary_large_image', title: `${SITE_NAME} · Partners`, description },
  };
}

/** Play mark and loop mark for the reasons: drawn, so they match the arrow set. */
function PlayMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="mb-[0.06em] h-[0.72em] w-auto" fill="currentColor">
      <path d="M8 4l36 20L8 44z" />
    </svg>
  );
}
function LoopMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 48 48"
      className="mb-[0.04em] h-[0.76em] w-auto"
      fill="none"
      stroke="currentColor"
      strokeWidth="5.5"
      strokeLinecap="square"
    >
      <path d="M40 24a16 16 0 1 1-4.7-11.3" />
      <path d="M37 4v9.5h-9.5" />
    </svg>
  );
}

/** The year-round card only shows when Show / hide sections > showYearRound is ticked (default off). */
/** The first card is Theme copy (left out while its title is blank). */
const reasons = (
  capacity: number,
  showYearRound: boolean,
  copy: Settings['copy'],
): { figure: ReactNode; title: string; body: string }[] => [
  ...(copy.partnersEditionTitle
    ? [{ figure: copy.partnersEditionFigure, title: copy.partnersEditionTitle, body: copy.partnersEditionBody }]
    : []),
  {
    figure: String(capacity),
    title: `A room of ${capacity}.`,
    body: 'One evening, an audience that chose to be there. Small enough that support is noticed.',
  },
  {
    figure: <PlayMark />,
    title: 'Talks that travel.',
    body: 'Talks are recorded and submitted for publication on the TEDx Talks YouTube channel.',
  },
  ...(showYearRound
    ? [
        {
          figure: <LoopMark />,
          title: 'All year, not one night.',
          body: 'Beyond the mainstage, TEDxSantaClaraUniversity runs general-meeting events throughout the year.',
        },
      ]
    : []),
];

const RULES = [
  {
    title: 'The stage is not for sale.',
    body: 'Partners cannot speak or present from the stage, and have no say over the program or the speakers.',
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

/** A tier as an open ledger row, not a boxed card. */
function TierRow({ tier, index, benefits, href }: { tier: Tier; index: number; benefits: string[]; href: string }) {
  const terms = [
    tier.amount ? { k: 'Contribution', v: tier.amount } : null,
    tier.slots ? { k: 'Slots', v: String(tier.slots) } : null,
  ].filter((x): x is { k: string; v: string } => x !== null);

  return (
    <li className="grid gap-x-8 gap-y-6 border-b border-white/15 py-10 sm:py-12 md:grid-cols-12 md:items-start">
      <div className="flex items-baseline gap-4 md:col-span-2 md:flex-col md:gap-3">
        <ClauseNo>{`${index + 1}`.padStart(2, '0')}</ClauseNo>
      </div>
      <div className="md:col-span-6">
        <h3 className="text-[clamp(2rem,4vw,3.5rem)] leading-[0.95] font-semibold tracking-[-0.04em] text-balance">
          {tier.name}
        </h3>
        {tier.description ? <p className="mt-4 max-w-md text-lg text-mute">{tier.description}</p> : null}
        {benefits.length ? (
          <ul className="mt-6 space-y-2 text-white">
            {benefits.map((b) => (
              <li key={b} className="grid grid-cols-[1.25rem_1fr]">
                <span aria-hidden="true" className="text-subtle">
                  ·
                </span>
                {b}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="md:col-span-4 md:pt-2">
        {terms.length ? (
          <dl className="grid grid-cols-2 gap-4">
            {terms.map((t) => (
              <div key={t.k}>
                <dt className="fine-print text-mute">{t.k}</dt>
                <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{t.v}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <dl>
            <dt className="fine-print text-mute">Terms</dt>
            <dd className="mt-1 text-2xl font-light tracking-tight text-white">By arrangement</dd>
          </dl>
        )}
        <a
          href={href}
          data-cursor="link"
          className="group tap mt-5 inline-flex min-h-11 items-center gap-2 text-white"
        >
          <span className="link-draw group-hover:bg-[length:100%_1px] group-focus-visible:bg-[length:100%_1px]">
            Request {terms.length ? 'the full terms' : 'terms'}
          </span>
          <Arrow className="transition-transform duration-500 ease-[var(--ease-cinema)] group-hover:translate-x-1" />
          <span className="sr-only"> for {tier.name}</span>
        </a>
      </div>
    </li>
  );
}

function BenefitsComparison({
  tiers,
  benefits,
  draftHref,
}: {
  tiers: Tier[];
  benefits: PartnerBenefit[];
  draftHref: string | null;
}) {
  if (!benefits.length || !tiers.length) {
    return (
      <div className="mt-12 grid gap-6 border-t border-white/15 pt-8 md:grid-cols-12">
        <p className="fine-print text-mute md:col-span-2">
          <span className="border-b border-dotted border-white/40 pb-0.5">To follow</span>
        </p>
        <div className="md:col-span-10">
          <p className="max-w-3xl text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            The benefits for each tier are being finalized.
          </p>
          <p className="mt-3 max-w-xl text-lg text-mute">
            Write to us and we will walk you through what each tier includes, within TEDx rules.
          </p>
          {draftHref ? (
            <a href={draftHref} data-cursor="link" className="group tap mt-6 inline-flex min-h-11 items-center gap-2 text-white">
              <span className="link-draw group-hover:bg-[length:100%_1px] group-focus-visible:bg-[length:100%_1px]">
                Ask for the current list
              </span>
              <Arrow className="transition-transform duration-500 ease-[var(--ease-cinema)] group-hover:translate-x-1" />
            </a>
          ) : null}
        </div>
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
              <th scope="col" className="fine-print py-4 pr-6 font-normal text-mute">
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
              <p className="fine-print mt-2 text-mute">{names.length ? keepTedxCase(names.join(' · ')) : 'Not yet assigned to a tier'}</p>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function SponsorMark({ sponsor }: { sponsor: Sponsor }) {
  const mark = sponsor.logo ? (
    // Capped at 24px tall and 72px wide: always smaller than the event logo (48px tall in the header).
    <Image
      src={sponsor.logo}
      alt={sponsor.name}
      width={72}
      height={24}
      className="h-6 max-h-6 w-auto max-w-[4.5rem] object-contain"
    />
  ) : (
    // Text fallback stays below the size of the event logo's wordmark.
    <span className="text-sm font-medium text-white">{sponsor.name}</span>
  );
  return (
    // No loupe here: it would magnify partner logos beyond the event logo.
    <li className="flex min-h-28 items-center justify-center border border-white/10 bg-black p-6">
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

function CurrentPartners({ tiers, sponsors }: { tiers: Tier[]; sponsors: Sponsor[] }) {
  const groups = tiers
    .map((t) => ({ tier: t, items: sponsors.filter((s) => s.tier === t.slug) }))
    .filter((g) => g.items.length);
  const untiered = sponsors.filter((s) => !tiers.some((t) => t.slug === s.tier));

  // Nothing signed yet: the section is not rendered at all (see the page).
  if (!groups.length && !untiered.length) return null;

  return (
    <div className="mt-12 space-y-14">
      {groups.map((g) => (
        <div key={g.tier.slug}>
          <h3 className="fine-print text-white">{keepTedxCase(`${g.tier.name}s`)}</h3>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {g.items.map((s) => (
              <SponsorMark key={s.slug} sponsor={s} />
            ))}
          </ul>
        </div>
      ))}
      {untiered.length ? (
        <div>
          <h3 className="fine-print text-white">Partners</h3>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
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
  const mail = (subject: string) =>
    cta.kind === 'email'
      ? `mailto:${settings.partnershipsEmail}?subject=${encodeURIComponent(`${subject} · ${settings.eventName}`)}`
      : cta.href;
  const anyTerms = tiers.some((t) => t.amount || t.slots);
  const REASONS = reasons(settings.capacity, settings.sections.showYearRound, settings.copy);
  // Four facts: 2 x 2 then a row of four. Three (year-round card off): one row of three from md up.
  const four = REASONS.length === 4;
  const anyPartners = sponsors.length > 0;
  // Section numbers follow what is rendered (no gaps).
  let n = 0;
  const next = () => ++n;

  return (
    <div id="prospectus" className="relative isolate">
      <PartnersMotion />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-black/85" />

      {/* Hero: who, what, the offer, how to start. */}
      <section aria-labelledby="partners-title" className="shell pb-20 pt-20 sm:pb-28 sm:pt-28">
        <p data-reveal="fade" className="fine-print text-mute">
          Partners · {keepTedxCase(settings.themeName)}
        </p>
        <h1
          id="partners-title"
          data-reveal="lines"
          data-reveal-variant="shear"
          className="mt-8 max-w-[13ch] text-[clamp(3rem,9.5vw,9rem)] leading-[0.9] font-semibold tracking-[-0.055em] text-balance"
        >
          {settings.copy.partnersHeading}
        </h1>
        <div className="mt-12 grid gap-10 md:grid-cols-12 md:items-end">
          <p data-reveal="fade" className="max-w-xl text-lg text-pretty text-mute sm:text-xl md:col-span-7">
            <span className="text-white">Become a partner of {settings.eventName}.</span>{' '}
            {settings.copy.partnersIntro}
          </p>
          <div className="flex flex-wrap gap-3 md:col-span-5 md:justify-end">
            <Button href={cta.href} size="lg">
              Become a partner
            </Button>
            <Button href="#tiers" variant="ghost" size="lg">
              See the tiers
              <Arrow
                dir="down"
                className="transition-transform duration-500 ease-[var(--ease-cinema)] group-hover:translate-y-0.5"
              />
            </Button>
          </div>
        </div>
        <dl
          data-reveal="stagger"
          className="mt-16 grid gap-x-6 gap-y-8 border-t border-white/15 pt-6 sm:grid-cols-2 lg:grid-cols-4"
        >
          {[
            ['Organizer', `${settings.eventName}, student-run`],
            ['Date', settings.dateLong],
            ['Venue', venueLine(settings)],
            ['Audience', `Up to ${settings.capacity} guests`],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="fine-print text-mute">{k}</dt>
              <dd className="mt-2 text-base text-balance text-white [overflow-wrap:anywhere] sm:text-lg">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Why partner */}
      <section aria-labelledby="why-title" className="shell py-20 sm:py-28">
        <div data-reveal="fade">
          <SectionLabel index={next()}>Why partner</SectionLabel>
        </div>
        <h2 id="why-title" data-reveal="lines" className="mt-6 max-w-3xl text-title font-semibold tracking-tight text-balance">
          What your support makes possible.
        </h2>
        <ol
          data-reveal="stagger"
          className={`mt-14 grid border-t border-white/15 ${four ? 'sm:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3'}`}
        >
          {REASONS.map((r, i) => (
            <li
              key={r.title}
              className={`grid grid-cols-[5.25rem_minmax(0,1fr)] content-start gap-x-4 border-b border-white/15 py-8 ${
                four
                  ? `sm:flex sm:flex-col sm:py-10 lg:border-b-0 ${i % 2 === 1 ? 'sm:border-l sm:pl-8' : 'sm:pr-8'} ${
                      i > 0 ? 'lg:border-l lg:pl-8' : ''
                    } ${i < REASONS.length - 1 ? 'lg:pr-8' : 'lg:pr-0'}`
                  : `md:flex md:flex-col md:border-b-0 md:py-10 ${i > 0 ? 'md:border-l md:pl-8' : ''} ${
                      i < REASONS.length - 1 ? 'md:pr-8' : 'md:pr-0'
                    }`
              }`}
            >
              <span
                aria-hidden="true"
                className="row-span-2 flex h-[1em] items-end text-[2.75rem] leading-none font-semibold tracking-[-0.05em] tabular-nums sm:text-[clamp(3.5rem,6vw,5.5rem)]"
              >
                {r.figure}
              </span>
              <h3 className="text-xl font-semibold tracking-tight sm:mt-8">{r.title}</h3>
              <p className="mt-2 max-w-xs text-mute sm:mt-3">{r.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* TEDx rules: before the tiers, so every tier is read in their light. */}
      <section aria-labelledby="rules-title" className="shell py-20 sm:py-28">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-4">
            <div data-reveal="fade">
              <SectionLabel index={next()}>How it works</SectionLabel>
            </div>
            <h2 id="rules-title" data-reveal="lines" className="mt-6 text-title font-semibold tracking-tight text-balance">
              Partnership under TEDx rules.
            </h2>
            <p data-reveal="fade" className="mt-6 max-w-sm text-mute">
              Every TEDx event follows rules set by TED. They keep the talks independent, which is what makes the room
              worth supporting.
            </p>
          </div>
          <ol data-reveal="stagger" className="border-t border-white/15 md:col-span-8">
            {RULES.map((r, i) => (
              <li
                key={r.title}
                className="grid grid-cols-[3.75rem_1fr] gap-2 border-b border-white/15 py-7 sm:grid-cols-[5rem_1fr]"
              >
                <ClauseNo>{String(i + 1).padStart(2, '0')}</ClauseNo>
                <div>
                  <h3 className="text-xl font-semibold tracking-tight">{r.title}</h3>
                  <p className="mt-2 max-w-xl text-mute">{r.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Tiers */}
      <section id="tiers" aria-labelledby="tiers-title" className="shell py-20 sm:py-28">
        <div data-reveal="fade">
          <SectionLabel index={next()}>Tiers</SectionLabel>
        </div>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
          <h2 id="tiers-title" data-reveal="lines" className="text-headline font-semibold tracking-[-0.045em] text-balance">
            Partnership tiers.
          </h2>
          {tiers.length && !anyTerms ? (
            <p className="fine-print max-w-xs text-mute">Contributions and slots are shared on request.</p>
          ) : null}
        </div>
        {tiers.length ? (
          <ol data-ledger className="mt-14 border-t border-white/15">
            {tiers.map((tier, i) => (
              <TierRow
                key={tier.slug}
                tier={tier}
                index={i}
                href={mail(tier.name)}
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

      {/* Benefits */}
      <section aria-labelledby="benefits-title" className="shell py-20 sm:py-28">
        <div data-reveal="fade">
          <SectionLabel index={next()}>Benefits</SectionLabel>
        </div>
        <h2 id="benefits-title" data-reveal="lines" className="mt-6 text-title font-semibold tracking-tight">
          What each tier includes.
        </h2>
        <BenefitsComparison tiers={tiers} benefits={benefits} draftHref={mail('Partner benefits')} />
      </section>

      {/* Current partners: only once one is signed and published. */}
      {anyPartners ? (
        <section aria-labelledby="current-title" className="shell py-20 sm:py-28">
          <div data-reveal="fade">
            <SectionLabel index={next()}>Current partners</SectionLabel>
          </div>
          <h2 id="current-title" data-reveal="lines" className="mt-6 text-title font-semibold tracking-tight">
            With thanks to our partners.
          </h2>
          <CurrentPartners tiers={tiers} sponsors={sponsors} />
        </section>
      ) : null}

      {/* Contact: the address itself is the call to action. */}
      <section aria-labelledby="partner-cta-title" className="shell pb-32 pt-12 sm:pb-44">
        <div className="border-t border-white/15 pt-10 sm:pt-14">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <SectionLabel index={next()}>Contact</SectionLabel>
            <p className="fine-print text-mute">Partnerships, sponsorships and corporate inquiries</p>
          </div>
          <h2
            id="partner-cta-title"
            data-reveal="lines"
            className="mt-8 max-w-4xl text-title font-semibold tracking-tight text-balance"
          >
            Become a partner.
          </h2>
          <p data-reveal="fade" className="mt-4 max-w-xl text-lg text-mute sm:text-xl">
            Tell us a little about your organization and we will send the partnership details.
            {anyPartners ? null : ' Partners are listed on this page once the agreement is signed.'}
          </p>
          <a
            href={cta.href}
            data-cursor="link"
            className="group mt-14 flex items-end justify-between gap-6 border-b border-white/30 pb-5 transition-colors duration-500 hover:border-white focus-visible:border-white sm:mt-20"
          >
            <span className="min-w-0 text-[clamp(1.75rem,6.2vw,6rem)] leading-none font-semibold tracking-[-0.045em] [overflow-wrap:anywhere]">
              <span className="sr-only">{cta.kind === 'email' ? 'Email ' : 'Contact us via '}</span>
              <span data-cta-text>{cta.display}</span>
            </span>
            <span
              aria-hidden="true"
              className="mb-1 grid size-12 shrink-0 place-items-center rounded-full bg-accent text-white transition-colors duration-300 group-hover:bg-white group-hover:text-black sm:size-16"
            >
              <Arrow className="text-lg transition-transform duration-500 ease-[var(--ease-cinema)] group-hover:translate-x-0.5 sm:text-xl" />
            </span>
          </a>
        </div>
      </section>
    </div>
  );
}
