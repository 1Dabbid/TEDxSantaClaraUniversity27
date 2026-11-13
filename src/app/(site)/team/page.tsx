import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { TeamMember } from '@/lib/content';
import { getSettings, getTeam } from '@/lib/content';
import { jsonLdString, pageJsonLd } from '@/lib/jsonld';
import { topicPageMetadata } from '@/lib/page-meta';
import { SITE_NAME } from '@/lib/site';
import { JsonLd } from '@/components/print/Print';
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
 * One board role. Every card has the same shape, so the board reads as one list
 * and rows line up: the number, then the role (always the same slot and style),
 * then the person's name (and photo) only when they agreed to be named (People >
 * Team > Show name publicly). No "to be announced" line for an unnamed role.
 */
function BoardRole({ member, index }: { member: TeamMember; index: number }) {
  return (
    <li className="min-w-0 border-t border-white/15 pt-5 pb-9">
      <p aria-hidden="true" className="fine-print text-mute tabular-nums">
        §&nbsp;{String(index + 1).padStart(2, '0')}
      </p>
      <p className="mt-4 text-xl leading-snug font-medium tracking-tight text-balance text-white wrap-anywhere">{member.role}</p>
      {member.name ? (
        <div className="mt-3 flex items-center gap-3">
          {member.photo ? (
            <Image src={member.photo} alt="" width={80} height={80} className="size-10 shrink-0 rounded-full object-cover grayscale" />
          ) : null}
          <p className="min-w-0 text-lg leading-snug font-light text-balance text-mute wrap-anywhere">{member.name}</p>
        </div>
      ) : null}
    </li>
  );
}

/**
 * /team: who runs the event. Every board role is listed (the home section waits
 * until a name is public and then lists named people only; this page is the
 * full board). Switched off with the Team switch: then a 404, linked from nowhere.
 */
export default async function TeamPage() {
  const [settings, team] = await Promise.all([getSettings(), getTeam()]);
  if (!settings.sections.showTeam) notFound();
  const named = team.filter((m) => m.name).length;
  const campus = settings.venueCampus || 'Santa Clara University';
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
              {settings.eventName} is planned and run by a student board at {campus}.
              {named < team.length ? ' Names appear here as each member agrees to be listed.' : null}
            </>
          }
          facts={[
            { k: 'Organizer', v: 'Student-run' },
            { k: 'Board', v: `${team.length} ${team.length === 1 ? 'role' : 'roles'}` },
            { k: 'Campus', v: campus },
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
            <BoardRole key={m.slug} member={m} index={i} />
          ))}
        </ul>
      </section>

      {mail ? (
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
