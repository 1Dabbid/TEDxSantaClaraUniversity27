import type { Metadata } from 'next';
import { TeamMark } from '@/components/ui/TeamMark';
import { notFound } from 'next/navigation';
import type { TeamMember } from '@/lib/content';
import { getSettings, getTeam } from '@/lib/content';
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

/**
 * One board member. Every card has the same shape, so the board reads as one
 * list and rows line up: the mark (photo, or initials until it arrives) and the
 * clause number, the name, the role, then major, class year and LinkedIn when
 * given. Someone not yet named (People > Team > Show name publicly) is only
 * their role: no mark, no "to be announced" line.
 */
function BoardMember({ member, index }: { member: TeamMember; index: number }) {
  const no = String(index + 1).padStart(2, '0');
  if (!member.name) {
    return (
      <li className="min-w-0 border-t border-white/15 pt-5 pb-10">
        <p aria-hidden="true" className="fine-print text-mute tabular-nums">
          §&nbsp;{no}
        </p>
        <h3 className="mt-4 text-xl leading-snug font-medium tracking-tight text-balance text-white wrap-anywhere">{member.role}</h3>
      </li>
    );
  }
  return (
    <li data-team-member className="flex min-w-0 flex-col border-t border-white/15 pt-6 pb-10">
      <div className="flex items-start justify-between gap-4">
        <TeamMark member={member} />
        <p aria-hidden="true" className="fine-print pt-1 text-mute tabular-nums">
          §&nbsp;{no}
        </p>
      </div>
      <h3 className="mt-6 text-[1.75rem] leading-tight font-light tracking-tight text-balance text-white wrap-anywhere">
        {member.name}
      </h3>
      <p className="mt-1 text-lg leading-snug font-medium tracking-tight text-balance text-white wrap-anywhere">{member.role}</p>
      {member.major || member.classYear ? (
        <p className="mt-4 leading-relaxed text-mute">
          {member.major ? <span className="block">{member.major}</span> : null}
          {member.classYear ? <span className="block">Class of {member.classYear}</span> : null}
        </p>
      ) : null}
      {member.linkedin ? (
        <p className="mt-auto pt-5">
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
      ) : null}
    </li>
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

      <section aria-labelledby="board-title" className="shell pb-24 sm:pb-32">
        <h2 id="board-title" className="fine-print flex items-center gap-3 text-white">
          <span aria-hidden="true" className="h-px w-8 bg-accent" />
          The board
        </h2>
        <ul className="mt-8 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-16">
          {team.map((m, i) => (
            <BoardMember key={m.slug} member={m} index={i} />
          ))}
        </ul>
      </section>

      {/* Get involved (the interest form) first; the contact address beside it. */}
      {settings.interestUrl ? (
        <ClosingBand
          current="/team"
          heading="Get involved."
          body="One short form to help organize the event, join the club’s contact list, or register your interest in speaking."
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
