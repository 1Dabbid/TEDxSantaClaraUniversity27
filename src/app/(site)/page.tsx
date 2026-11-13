import { SceneStills } from '@/components/SceneStills';
import { Faq, Hero, Newsletter, PartnerBand, Schedule, Speakers, Team, Theme, Tickets, Venue } from '@/components/sections';
import { getFaq, getSchedule, getSettings, getSpeakers, getTeam } from '@/lib/content';
import { eventJsonLd, jsonLdString } from '@/lib/jsonld';

export default async function HomePage() {
  const [settings, speakers, schedule, team, faq] = await Promise.all([
    getSettings(),
    getSpeakers(),
    getSchedule(),
    getTeam(),
    getFaq(),
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(eventJsonLd(settings, speakers)) }}
      />
      <SceneStills />
      {/* Order must match SECTION_IDS in src/scene/scrollState.ts. Sections follow
          content state: Speakers and Schedule shrink to one short "to be
          announced" beat until content is published; Team renders nothing until
          a name is public (its scroll progress then stays 0). PartnerBand is not
          a scene section. See docs/EDITING.md, "What appears when". */}
      <Hero settings={settings} speakersAnnounced={speakers.some((s) => s.announced)} />
      <Theme settings={settings} />
      <Speakers speakers={speakers} settings={settings} />
      <Schedule schedule={schedule} settings={settings} />
      <Venue settings={settings} />
      <Tickets settings={settings} />
      <PartnerBand settings={settings} />
      <Team team={team} settings={settings} />
      <Faq items={faq} settings={settings} />
      <Newsletter settings={settings} />
    </>
  );
}
