import { SceneStills } from '@/components/SceneStills';
import { Faq, Hero, Newsletter, Schedule, Speakers, Team, Theme, Tickets, Venue } from '@/components/sections';
import { getFaq, getSchedule, getSettings, getSpeakers, getTeam } from '@/lib/content';
import { eventJsonLd } from '@/lib/jsonld';

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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd(settings, speakers)).replace(/</g, '\\u003c') }}
      />
      <SceneStills />
      {/* Order must match SECTION_IDS in src/scene/scrollState.ts */}
      <Hero settings={settings} />
      <Theme settings={settings} />
      <Speakers speakers={speakers} settings={settings} />
      <Schedule schedule={schedule} settings={settings} />
      <Venue settings={settings} />
      <Tickets settings={settings} />
      <Team team={team} />
      <Faq items={faq} settings={settings} />
      <Newsletter settings={settings} />
    </>
  );
}
