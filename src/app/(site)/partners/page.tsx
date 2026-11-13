import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Image from 'next/image';
import type { PartnerBenefit, Settings, Sponsor, Tier } from '@/lib/content';
import { getPartnerBenefits, getPartnerNotes, getSettings, getSponsors, getTiers } from '@/lib/content';
import { partnerCta } from '@/lib/links';
import { BENEFIT_GROUP_LABEL, type BenefitGroup, SITE_NAME, venueLine } from '@/lib/site';
import { Button } from '@/components/ui/Button';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { EventName, keepTedxCase, Tedx } from '@/components/ui/KeepCase';
import { Arrow, ClauseNo, JsonLd, Tba } from '@/components/print/Print';
import { ClosingBand } from '@/components/pages/ClosingBand';
import { Breadcrumb } from '@/components/pages/PageHeader';
import { jsonLdString, pageJsonLd } from '@/lib/jsonld';
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
          body: 'Beyond the event itself, the student club behind it runs a speaker workshop series and general-meeting events through the year.',
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
    title: 'Logos on stage: the thank-you slide only.',
    body: 'In the room, partner logos appear only on the sponsor thank-you slide, never during a talk. Partners are thanked outside the talks, as TEDx rules require.',
  },
  {
    title: 'Recognition stays in its place.',
    body: 'On this website, partner logos appear on this page only, never on the home page, and always smaller than the event’s own mark.',
  },
  {
    title: 'The list is for event news.',
    body: 'Our mailing list is used only for TEDxSantaClaraUniversity event news, never for partner promotions.',
  },
];

/**
 * A tier as an open ledger row, not a boxed card: the name and what it is for,
 * then the contribution and how many are available. What each tier includes is
 * in the comparison below, so the four rows read in a few seconds.
 */
function TierRow({ tier, index, href }: { tier: Tier; index: number; href: string }) {
  const terms = [
    tier.amount ? { k: 'Contribution', v: tier.amount } : null,
    // No slot limit: "Open" once the tier has an amount (a tier still in draft shows neither).
    tier.slots ? { k: 'Available', v: String(tier.slots) } : tier.amount ? { k: 'Available', v: 'Open' } : null,
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
  dateISO,
}: {
  tiers: Tier[];
  benefits: PartnerBenefit[];
  draftHref: string | null;
  dateISO: string;
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
  const groups = (Object.keys(BENEFIT_GROUP_LABEL) as BenefitGroup[])
    .map((g) => ({ key: g, label: groupLabel(g, dateISO), rows: benefits.filter((b) => b.group === g) }))
    .filter((g) => g.rows.length);
  const anyTbc = benefits.some((b) => b.toBeConfirmed);

  /** One cell: the tier's own wording ("Largest logo", "4"), a dot for a plain yes, a dash for no. */
  const Cell = ({ b, t }: { b: PartnerBenefit; t: Tier }) => {
    if (!b.tiers.includes(t.slug)) {
      return (
        <>
          <span aria-hidden="true" className="text-subtle">
            —
          </span>
          <span className="sr-only">Not included</span>
        </>
      );
    }
    const detail = b.details[t.slug];
    return detail ? (
      <span className="text-white">{detail}</span>
    ) : (
      <>
        <span aria-hidden="true" className="text-white">
          ●
        </span>
        <span className="sr-only">Included</span>
      </>
    );
  };

  return (
    <>
      {/* Wide screens: a real table, one column per tier, rows grouped under the three headings. */}
      <div className="mt-12 hidden md:block">
        <table data-benefits-table className="w-full border-collapse text-left">
          <caption className="sr-only">What each partnership tier includes</caption>
          <thead>
            <tr className="border-b border-white/30 align-bottom">
              <th scope="col" className="fine-print py-4 pr-6 font-normal text-mute">
                Benefit
              </th>
              {tiers.map((t) => (
                <th key={t.slug} scope="col" className="w-[15%] px-2 py-4 text-center font-normal">
                  <span className="block text-sm font-medium text-balance text-white">{t.name}</span>
                  {t.amount ? (
                    <span className="mt-1 block text-sm text-mute tabular-nums">{t.amount}</span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g.key}>
              <tr>
                <th
                  scope="rowgroup"
                  colSpan={tiers.length + 1}
                  className="fine-print pt-10 pb-3 font-normal text-white"
                >
                  <span className="flex items-center gap-3">
                    <span aria-hidden="true" className="h-px w-6 bg-accent" />
                    {g.label}
                  </span>
                </th>
              </tr>
              {g.rows.map((b) => (
                <tr key={b.benefit} className="border-t border-white/10">
                  <th scope="row" className="py-4 pr-6 font-normal text-mute">
                    {b.benefit}
                    {b.toBeConfirmed ? <Tbc /> : null}
                  </th>
                  {tiers.map((t) => (
                    <td key={t.slug} className="px-2 py-4 text-center text-[0.9375rem]">
                      <Cell b={b} t={t} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>

      {/* Phones: the same rows stacked, each listing the tiers that include it and what they get. */}
      <div data-benefits-list className="mt-10 space-y-10 md:hidden">
        {groups.map((g) => (
          <section key={g.key} aria-labelledby={`benefits-${g.key}`}>
            <h3 id={`benefits-${g.key}`} className="fine-print flex items-center gap-3 text-white">
              <span aria-hidden="true" className="h-px w-6 bg-accent" />
              {g.label}
            </h3>
            <ul className="mt-3 border-t border-white/15">
              {g.rows.map((b) => {
                const inTiers = tiers.filter((t) => b.tiers.includes(t.slug));
                return (
                  <li key={b.benefit} className="border-b border-white/15 py-4">
                    <p className="text-white">
                      {b.benefit}
                      {b.toBeConfirmed ? <Tbc /> : null}
                    </p>
                    {inTiers.length ? (
                      <dl className="mt-2.5 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 text-sm">
                        {inTiers.map((t) => (
                          <div key={t.slug} className="contents">
                            <dt className="text-mute">{t.name}</dt>
                            <dd className="text-right text-white">{b.details[t.slug] || 'Included'}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <p className="fine-print mt-2 text-mute">Not yet assigned to a tier</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      {anyTbc ? (
        <p className="fine-print mt-6 max-w-xl text-mute">
          Items marked “to be confirmed” are being checked against <Tedx /> rules and may change.
        </p>
      ) : null}
    </>
  );
}

/** "At the April 23 event" (the date from Event basics); the other headings as in BENEFIT_GROUP_LABEL. */
function groupLabel(g: BenefitGroup, dateISO: string): string {
  if (g !== 'event' || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return BENEFIT_GROUP_LABEL[g];
  const day = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${dateISO}T12:00:00Z`),
  );
  return `At the ${day} event`;
}

/** The small "to be confirmed" note on a benefit that still needs a yes from TED. */
function Tbc() {
  return (
    <span className="fine-print ml-2 inline-block border-b border-dotted border-white/40 align-[0.1em] whitespace-nowrap text-mute">
      To be confirmed
    </span>
  );
}

/** The small print under the tiers (Partner benefits > Small print under the tiers), as lettered terms. */
function SmallPrint({ notes }: { notes: string[] }) {
  if (!notes.length) return null;
  return (
    <div className="mt-12 grid gap-6 md:grid-cols-12">
      <h3 className="fine-print text-white md:col-span-2">The small print</h3>
      <ol className="grid gap-x-10 gap-y-3 text-mute sm:grid-cols-2 md:col-span-10">
        {notes.map((n, i) => (
          <li key={i} className="grid grid-cols-[2rem_minmax(0,1fr)]">
            <span aria-hidden="true" className="fine-print pt-[0.2em] text-white">
              ({'abcdefghijklmnopqrstuvwxyz'[i] ?? i + 1})
            </span>
            <span>{n}</span>
          </li>
        ))}
      </ol>
    </div>
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
  const [settings, tiers, sponsors, benefits, notes] = await Promise.all([
    getSettings(),
    getTiers(),
    getSponsors(),
    getPartnerBenefits(),
    getPartnerNotes(),
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
      <JsonLd
        json={jsonLdString(
          pageJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Partners', path: '/partners' },
          ]),
        )}
      />
      <PartnersMotion />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-black/85" />

      {/* Hero: who, what, the offer, how to start. */}
      <section aria-labelledby="partners-title" className="shell pb-20 pt-12 sm:pb-28 sm:pt-16">
        <Breadcrumb trail={[{ name: 'Partners' }]} />
        <p data-reveal="fade" className="fine-print mt-14 flex flex-wrap items-center gap-x-3 gap-y-1 text-mute sm:mt-24">
          <span aria-hidden="true" className="h-px w-8 bg-accent" />
          <span className="text-white">Partners</span>
          <span aria-hidden="true">·</span>
          <EventName name={settings.eventName} />
          <span aria-hidden="true">·</span>
          {keepTedxCase(settings.themeName)}
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
            <span className="text-white">Become a partner of {settings.eventName}.</span>
            {` ${settings.copy.partnersIntro}`}
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
        <div className="grid grid-cols-1 gap-12 md:grid-cols-12">
          <div className="md:col-span-4">
            <div data-reveal="fade">
              <SectionLabel index={next()}>How it works</SectionLabel>
            </div>
            <h2 id="rules-title" data-reveal="lines" className="mt-6 text-title font-semibold tracking-tight text-balance">
              How partnerships work under TEDx rules.
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
                className="grid grid-cols-[3.75rem_minmax(0,1fr)] gap-2 border-b border-white/15 py-7 sm:grid-cols-[5rem_minmax(0,1fr)]"
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
              />
            ))}
          </ol>
        ) : (
          <p className="mt-12">
            <Tba>Tiers to be announced</Tba>
          </p>
        )}
        <SmallPrint notes={notes} />
      </section>

      {/* Benefits */}
      <section aria-labelledby="benefits-title" className="shell py-20 sm:py-28">
        <div data-reveal="fade">
          <SectionLabel index={next()}>Benefits</SectionLabel>
        </div>
        <h2 id="benefits-title" data-reveal="lines" className="mt-6 text-title font-semibold tracking-tight">
          What each tier includes.
        </h2>
        <BenefitsComparison
          tiers={tiers}
          benefits={benefits}
          draftHref={mail('Partner benefits')}
          dateISO={settings.dateISO}
        />
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
      <section aria-labelledby="partner-cta-title" className="shell pb-24 pt-12 sm:pb-32">
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

      <ClosingBand current="/partners" />
    </div>
  );
}
