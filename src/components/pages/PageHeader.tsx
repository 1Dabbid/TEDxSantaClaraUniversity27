import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Settings } from '@/lib/content';
import { EventName } from '@/components/ui/KeepCase';
import { Tba } from '@/components/print/Print';

export type Fact = { k: string; v: ReactNode };

/**
 * The evening's times as facts (/venue, /schedule). While all three are blank they
 * collapse into one "Times" fact instead of three identical markers; once any is
 * set, each gets its own fact and the rest show as to be announced.
 */
export function timeFacts(s: Settings): Fact[] {
  const times: [string, string][] = [
    ['Doors open', s.doorsTime],
    ['Talks start', s.talksTime],
    ['Event ends', s.endTime],
  ];
  if (times.every(([, t]) => !t)) return [{ k: 'Times', v: <Tba>Doors and talk times to follow</Tba> }];
  return times.map(([k, t]) => ({ k, v: t || <Tba /> }));
}

/**
 * The page wrapper of every topic page (/speakers, /schedule, /venue, /partners,
 * /team, /faq): a near-black ground of its own, so the page is complete on plain
 * black (no live 3D on a cold load) and still readable when the home page's
 * paused canvas is behind it.
 */
export function TopicPage({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <div id={id} className="relative isolate">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-black/85" />
      {children}
    </div>
  );
}

/** "Home / Venue": the way back, first in the page. */
export function Breadcrumb({ trail }: { trail: { name: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="fine-print text-mute">
      <ol className="-my-1.5 flex flex-wrap items-center gap-x-2">
        <li>
          <Link href="/" className="tap inline-flex min-h-11 items-center hover:text-white focus-visible:text-white pointer-fine:min-h-0 pointer-fine:py-1.5">
            Home
          </Link>
        </li>
        {trail.map((c) => (
          <li key={c.name} className="flex items-center gap-x-2">
            <span aria-hidden="true">/</span>
            {c.href ? (
              <Link
                href={c.href}
                className="tap inline-flex min-h-11 items-center hover:text-white focus-visible:text-white pointer-fine:min-h-0 pointer-fine:py-1.5"
              >
                {c.name}
              </Link>
            ) : (
              <span aria-current="page" className="text-white">
                {c.name}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * The shared page header: breadcrumb, a caption line (topic, event name, date),
 * one big short title (the page's only h1), a one-sentence introduction, optional
 * actions, and a row of key facts over a hairline.
 */
export function PageHeader({
  settings,
  label,
  titleId,
  title,
  intro,
  facts = [],
  factsNote,
  children,
}: {
  settings: Settings;
  /** The topic, as in the breadcrumb and the caption: "Venue". */
  label: string;
  titleId: string;
  title: ReactNode;
  intro: ReactNode;
  facts?: Fact[];
  /** One small line under the facts, e.g. that the times are approximate. */
  factsNote?: ReactNode;
  /** Actions under the introduction. */
  children?: ReactNode;
}) {
  return (
    <div className="shell pt-12 pb-16 sm:pt-16 sm:pb-24">
      <Breadcrumb trail={[{ name: label }]} />
      <p data-reveal="fade" className="fine-print mt-14 flex flex-wrap items-center gap-x-3 gap-y-1 sm:mt-24">
        <span aria-hidden="true" className="h-px w-8 bg-accent" />
        <span className="text-white">{label}</span>
        <span aria-hidden="true">·</span>
        {/* The event name is never uppercased. */}
        <EventName name={settings.eventName} />
        <span aria-hidden="true">·</span>
        <time dateTime={settings.dateISO}>{settings.dateLong}</time>
      </p>
      <h1
        id={titleId}
        data-reveal="lines"
        className="mt-6 max-w-[14ch] text-[clamp(3rem,9vw,8.25rem)] leading-[0.88] font-semibold tracking-[-0.055em] text-balance [overflow-wrap:anywhere]"
      >
        {title}
      </h1>
      <p data-reveal="fade" className="mt-8 max-w-2xl text-lg text-pretty text-mute sm:mt-10 sm:text-xl">
        {intro}
      </p>
      {children ? <div className="mt-10 flex flex-wrap gap-3">{children}</div> : null}
      {facts.length ? (
        <dl
          data-reveal="stagger"
          className={`mt-14 grid grid-cols-1 gap-x-6 gap-y-7 border-t border-white/15 pt-6 min-[22rem]:grid-cols-2 sm:mt-20 ${
            facts.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'
          }`}
        >
          {facts.map((f) => (
            <div key={f.k} className="min-w-0">
              <dt className="fine-print text-mute">{f.k}</dt>
              <dd className="mt-2 text-base text-balance text-white [overflow-wrap:anywhere] sm:text-lg">{f.v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {factsNote ? (
        <p data-reveal="fade" data-times-note className="mt-6 max-w-2xl text-sm text-mute">
          {factsNote}
        </p>
      ) : null}
    </div>
  );
}

/** The times note (Event basics), only while at least one time is shown. */
export function timesNoteOf(s: Settings): string {
  return s.timesNote && (s.doorsTime || s.talksTime || s.endTime) ? s.timesNote : '';
}
