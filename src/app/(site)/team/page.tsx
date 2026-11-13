import type { Metadata } from 'next';
import { Portrait } from '@/components/ui/Portrait';
import { notFound } from 'next/navigation';
import type { TeamMember } from '@/lib/content';
import { getSettings, getTeam } from '@/lib/content';
import { groupTeam, type TeamGroup } from '@/lib/team';
import { jsonLdString, pageJsonLd } from '@/lib/jsonld';
import { topicPageMetadata } from '@/lib/page-meta';
import { SITE_NAME } from '@/lib/site';
import { Arrow, JsonLd } from '@/components/print/Print';
import { ClosingBand } from '@/components/pages/ClosingBand';
import { PageHeader, TopicPage } from '@/components/pages/PageHeader';

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return topicPageMetadata({
    title: 'Team',
    description: `${SITE_NAME} is organized by students: the board that plans and runs ${SITE_NAME}: ${s.themeName}, ${s.dateLong}.`,
    path: '/team',
  });
}

/** Rendered widths of the portrait frames below (next/image picks the file). */
const SIZES_LEAD = '(min-width: 640px) 26rem, calc(100vw - 2.5rem)';
const SIZES_CARD = '(min-width: 1408px) 300px, (min-width: 1024px) 22vw, (min-width: 640px) 30vw, 45vw';

/**
 * Name, role, major and class year, then LinkedIn: the same lines on every card.
 * In the grid each line is a row shared across the cards beside it (subgrid), so
 * a role that wraps to two lines never knocks its neighbours' hairlines out of
 * line; a missing line keeps its (empty) place.
 */
function Details({ member, lead = false }: { member: TeamMember; lead?: boolean }) {
  if (!member.name) {
    return (
      <h3 className="mt-5 text-lg leading-snug font-medium tracking-tight text-balance text-white wrap-anywhere">{member.role}</h3>
    );
  }
  return (
    <>
      <h3
        className={`text-balance text-white wrap-anywhere ${
          lead
            ? 'text-[2.25rem] leading-[1.02] font-light tracking-tight sm:text-5xl'
            : 'mt-5 text-xl leading-tight font-light tracking-tight sm:text-[1.625rem]'
        }`}
      >
        {member.name}
      </h3>
      <p className={`mt-1.5 leading-snug font-medium tracking-tight text-balance text-white wrap-anywhere ${lead ? 'text-xl' : 'sm:text-lg'}`}>
        {member.role}
      </p>
      {member.major || member.classYear ? (
        <p className={`mt-3 border-t border-white/15 pt-3 leading-relaxed text-mute ${lead ? 'text-lg' : 'text-[0.9375rem] sm:text-base'}`}>
          {member.major ? <span className="block">{member.major}</span> : null}
          {member.classYear ? <span className="block">Class of {member.classYear}</span> : null}
        </p>
      ) : lead ? null : (
        <span />
      )}
      {member.linkedin ? (
        <p className={lead ? 'mt-6' : 'pt-3'}>
          <a
            href={member.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${member.name} on LinkedIn (opens in a new tab)`}
            data-cursor="link"
            className="group tap inline-flex min-h-11 items-center gap-2 text-white pointer-fine:min-h-0 pointer-fine:py-1.5"
          >
            <span className="fine-print link-draw text-white group-hover:bg-[length:100%_1px] group-focus-visible:bg-[length:100%_1px]">
              LinkedIn
            </span>
            <Arrow
              dir="up-right"
              className="transition-transform duration-500 ease-[var(--ease-cinema)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          </a>
        </p>
      ) : lead ? null : (
        <span />
      )}
    </>
  );
}

/**
 * One board member: the portrait (photo, initials until it arrives, or a blank
 * frame for someone not yet named), then the details. The card is the hover
 * area for the colour; only the portrait itself is the tap target, so the
 * LinkedIn link is always one tap away.
 */
function BoardMember({ member }: { member: TeamMember }) {
  return (
    <li
      data-team-member={member.name ? '' : undefined}
      data-portrait-card
      className="row-span-5 grid min-w-0 grid-rows-subgrid content-start gap-y-0 pb-12 sm:pb-14"
    >
      <Portrait member={member} sizes={SIZES_CARD} />
      <Details member={member} />
    </li>
  );
}

/** The president: alone, larger, the details beside the portrait from small tablets up. */
function LeadMember({ member }: { member: TeamMember }) {
  return (
    <li
      data-team-member={member.name ? '' : undefined}
      data-portrait-card
      className="flex min-w-0 flex-col gap-6 sm:flex-row sm:items-end sm:gap-10"
    >
      <Portrait member={member} sizes={SIZES_LEAD} className="max-w-[26rem] shrink-0 sm:w-[min(26rem,55%)]" />
      <div className="flex min-w-0 flex-col sm:pb-2">
        <Details member={member} lead />
      </div>
    </li>
  );
}

/**
 * A level of the board (President, Executive board, Operations: src/lib/team.ts):
 * its clause number and name in the margin, the people beside it.
 */
function BoardGroup({ group, index }: { group: TeamGroup<TeamMember>; index: number }) {
  const id = `board-${group.level}`;
  const lead = group.level === 'president' && group.members.length === 1;
  return (
    <section aria-labelledby={id} className="grid gap-y-8 border-t border-white/15 pt-6 lg:grid-cols-12 lg:gap-x-10">
      <h2 id={id} className="fine-print flex items-baseline gap-3 text-white lg:col-span-3">
        <span aria-hidden="true" className="text-mute tabular-nums">
          §&nbsp;{index + 1}
        </span>
        {group.label}
      </h2>
      <ul
        data-reveal="stagger"
        data-reveal-variant="wipe"
        className={
          lead
            ? 'lg:col-span-9'
            : 'grid grid-cols-2 gap-x-4 gap-y-0 sm:grid-cols-3 sm:gap-x-8 lg:col-span-9'
        }
      >
        {lead ? <LeadMember member={group.members[0]} /> : group.members.map((m) => <BoardMember key={m.slug} member={m} />)}
      </ul>
    </section>
  );
}

/**
 * /team: who runs the event. Every board role is listed (the home section waits
 * until a name is public and then lists named people only; this page is the
 * full board). Switched off with the Team switch, or with no entries: then a 404,
 * linked from nowhere.
 */
export default async function TeamPage() {
  const [settings, team] = await Promise.all([getSettings(), getTeam()]);
  // An empty team counts as switched off (same rule as the header, footer and sitemap: nav.ts, sitemap.ts).
  if (!settings.sections.showTeam || team.length === 0) notFound();
  const named = team.filter((m) => m.name).length;
  // From content only: a blank Campus field leaves the campus out rather than guessing it.
  const campus = settings.venueCampus;
  const mail = settings.contactEmail
    ? `mailto:${settings.contactEmail}?subject=${encodeURIComponent(`Question · ${settings.eventName}`)}`
    : '';

  return (
    <TopicPage>
      <JsonLd
        json={jsonLdString(
          pageJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Team', path: '/team' },
          ]),
        )}
      />
      <section aria-labelledby="team-page-title">
        <PageHeader
          settings={settings}
          label="Team"
          titleId="team-page-title"
          title="Organized by students."
          intro={
            <>
              {settings.eventName} is planned and run by a student board{campus ? ` at ${campus}` : ''}. The club went
              dormant after its 2020 event; this board brought it back.
              {named < team.length ? ' Names appear here as each member agrees to be listed.' : null}
            </>
          }
          facts={[
            { k: 'Organizer', v: 'Student-run' },
            {
              k: 'Board',
              v: named === team.length ? `${named} ${named === 1 ? 'member' : 'members'}` : `${team.length} ${team.length === 1 ? 'role' : 'roles'}`,
            },
            ...(campus ? [{ k: 'Campus', v: campus }] : []),
          ]}
        />
      </section>

      <div className="shell flex flex-col gap-16 pb-24 sm:gap-20 sm:pb-32">
        <p className="fine-print flex items-center gap-3 text-white">
          <span aria-hidden="true" className="h-px w-8 bg-accent" />
          The board
        </p>
        {team.some((m) => m.photo) ? (
          <p className="-mt-12 max-w-md text-sm leading-relaxed text-subtle sm:-mt-16">
            Portraits are shown in black and white. Hover over one, tab to it or tap it to see it in colour.
          </p>
        ) : null}
        {groupTeam(team).map((g, i) => (
          <BoardGroup key={g.level} group={g} index={i} />
        ))}
      </div>

      {/* Get involved (the interest form) first; the contact address beside it. */}
      {settings.interestUrl ? (
        <ClosingBand
          current="/team"
          heading="Get involved."
          body="One form to help organize the event, join the club’s contact list, or register your interest in speaking."
          action={{ label: 'Get involved', href: settings.interestUrl }}
          secondary={mail ? { label: settings.contactEmail, href: mail } : undefined}
        />
      ) : mail ? (
        <ClosingBand
          current="/team"
          heading="Write to the team."
          body="One address for questions about the event."
          action={{ label: settings.contactEmail, href: mail }}
        />
      ) : (
        <ClosingBand current="/team" />
      )}
    </TopicPage>
  );
}
