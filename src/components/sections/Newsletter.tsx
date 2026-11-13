import type { Settings } from '@/lib/content';
import { Button } from '@/components/ui/Button';
import { ComingSoonBadge } from '@/components/ui/ComingSoon';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { SectionShell, SectionTitle } from './SectionShell';

export function Newsletter({ settings }: { settings: Settings }) {
  return (
    <SectionShell id="newsletter" scrim="solid" className="py-32 sm:py-48">
      <div className="shell">
        <SectionLabel index={8}>Stay informed</SectionLabel>
        <SectionTitle id="newsletter" className="max-w-5xl">
          Don’t miss the fine print.
        </SectionTitle>
        <p className="mt-6 max-w-xl text-lg text-mute">
          Ticket releases, speaker announcements and applications go to the mailing list first.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          {settings.newsletterUrl ? (
            <Button href={settings.newsletterUrl} size="lg">
              Join the mailing list
            </Button>
          ) : (
            <>
              <ComingSoonBadge>Mailing list opens soon</ComingSoonBadge>
              {settings.contactEmail ? (
                <Button href={`mailto:${settings.contactEmail}?subject=Mailing%20list`} variant="ghost">
                  Email us to be added
                </Button>
              ) : null}
            </>
          )}
        </div>

        <div className="mt-24 grid gap-px border border-white/10 bg-white/10 md:grid-cols-2">
          <div className="bg-black p-8 sm:p-10">
            <p className="fine-print">For speakers</p>
            <h3 className="mt-4 text-title font-semibold tracking-tight">Take the stage.</h3>
            <p className="mt-3 text-mute">
              {settings.speakerApplicationsState === 'open'
                ? 'Applications are open now.'
                : settings.speakerApplicationsState === 'closed'
                  ? 'Applications are closed for this event.'
                  : 'Applications open soon.'}
            </p>
            {settings.speakerApplicationsState === 'open' && settings.speakerApplicationsUrl ? (
              <div className="mt-6">
                <Button href={settings.speakerApplicationsUrl} variant="ghost">
                  Apply to speak
                </Button>
              </div>
            ) : null}
          </div>
          <div className="bg-black p-8 sm:p-10">
            <p className="fine-print">For partners</p>
            <h3 className="mt-4 text-title font-semibold tracking-tight">Support the details.</h3>
            <p className="mt-3 text-mute">Founding partnerships are now open to a small number of organizations.</p>
            <div className="mt-6">
              <Button href="/partners" variant="ghost">
                Become a partner
              </Button>
            </div>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
