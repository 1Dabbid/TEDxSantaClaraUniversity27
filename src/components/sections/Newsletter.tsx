import Link from 'next/link';
import type { Settings } from '@/lib/content';
import { Button } from '@/components/ui/Button';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { SectionShell, SectionTitle } from './SectionShell';

function instagramHandle(url: string): string | null {
  const m = url.match(/instagram\.com\/([A-Za-z0-9._]+)/);
  return m ? `@${m[1]}` : null;
}

/** The closing call to action: a signature line you sign by joining the list. */
export function Newsletter({ settings }: { settings: Settings }) {
  const open = Boolean(settings.newsletterUrl);
  const ig = settings.socials.instagram;
  const handle = ig ? instagramHandle(ig) : null;

  return (
    <SectionShell id="newsletter" scrim="solid" className="py-32 sm:py-48">
      <div className="shell">
        <div data-reveal="fade">
          <SectionLabel index={8}>Stay informed</SectionLabel>
        </div>
        <SectionTitle id="newsletter" className="max-w-[14ch] text-[clamp(3rem,10vw,9.5rem)]! leading-[0.9]!">
          <span data-reveal="lines" className="block">
            Don’t miss the fine print.
            <a
              href="#newsletter-note"
              className="ml-[0.08em] align-super font-mono text-[0.22em] font-normal tracking-normal text-accent no-underline hover:text-white"
            >
              <span aria-hidden="true">1</span>
              <span className="sr-only"> (see note 1)</span>
            </a>
          </span>
        </SectionTitle>
        <p data-reveal="fade" className="mt-8 max-w-xl text-lg text-mute sm:text-xl">
          Ticket releases, speaker announcements and applications go to the mailing list first.
        </p>

        {/* Signature line */}
        <div className="mt-16 sm:mt-24">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:gap-10">
            <div className="flex-1">
              <div className="flex items-end gap-4 pb-3">
                <span aria-hidden="true" className="font-mono text-sm text-subtle">
                  ✕
                </span>
                <p className="text-xl font-light tracking-tight text-white sm:text-3xl">
                  {open ? 'Your name here.' : 'The list opens soon.'}
                </p>
              </div>
              <div data-reveal="rule" aria-hidden="true" className="h-px bg-white/50" />
              <p className="fine-print mt-3">
                {open ? 'Sign up · one form, no account' : 'Mailing list · not yet open'}
              </p>
            </div>
            <div className="shrink-0">
              {open ? (
                <Button href={settings.newsletterUrl} size="lg">
                  Join the mailing list
                  <span aria-hidden="true">↗</span>
                </Button>
              ) : (
                <p className="fine-print max-w-[16rem] border border-dashed border-white/30 px-5 py-4 text-white">
                  Sign-up opens here shortly.
                  {settings.contactEmail ? (
                    <>
                      {' '}
                      Until then, write to{' '}
                      <a href={`mailto:${settings.contactEmail}?subject=Mailing%20list`} className="tracking-normal normal-case underline underline-offset-4">
                        {settings.contactEmail}
                      </a>
                      .
                    </>
                  ) : null}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-20 grid gap-8 border-t border-white/15 pt-6 sm:grid-cols-2 sm:mt-28">
          <p id="newsletter-note" data-cursor="loupe" className="fine-print max-w-md">
            <span className="text-accent">1.</span> The list is only used for TEDxSantaClaraUniversity event news. You can
            unsubscribe at any time.
          </p>
          <ul className="fine-print flex flex-wrap gap-x-6 gap-y-2 sm:justify-end">
            {ig ? (
              <li>
                <a href={ig} target="_blank" rel="noopener noreferrer" className="text-white hover:text-mute">
                  Instagram {handle ? <span className="tracking-normal normal-case">{handle}</span> : null}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
            ) : null}
            <li>
              <Link href="/partners" className="text-white hover:text-mute">
                Organizations: partner with us
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </SectionShell>
  );
}
