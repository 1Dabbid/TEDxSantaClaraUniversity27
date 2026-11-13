import Link from 'next/link';
import type { Settings } from '@/lib/content';
import { Arrow } from '@/components/print/Print';
import styles from './Newsletter.module.css';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { EventName } from '@/components/ui/KeepCase';
import { NewsletterMotion } from '@/motion/sections/NewsletterMotion';
import { SectionShell, SectionTitle } from './SectionShell';

function instagramHandle(url: string): string | null {
  const m = url.match(/instagram\.com\/([A-Za-z0-9._]+)/);
  return m ? `@${m[1]}` : null;
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/** The closing call to action: a signature line you sign by joining the list. */
export function Newsletter({ settings }: { settings: Settings }) {
  const open = Boolean(settings.newsletterUrl);
  const ig = settings.socials.instagram;
  const handle = ig ? instagramHandle(ig) : null;
  const host = hostOf(settings.newsletterUrl);
  const appsOpen =
    settings.sections.showSpeakerApplications &&
    settings.speakerApplicationsState === 'open' &&
    Boolean(settings.speakerApplicationsUrl);

  return (
    <SectionShell id="newsletter" scrim="solid" className="py-24 sm:py-36">
      <NewsletterMotion />
      <div className="shell">
        <div data-reveal="fade">
          <SectionLabel>Stay informed</SectionLabel>
        </div>
        {/* A fade, not a line split: the heading holds the note link, and a split is
            reverted by replacing its markup, which would drop keyboard focus from the
            link if it lands there mid-reveal. */}
        <SectionTitle id="newsletter" reveal={false} className="max-w-[14ch] text-[clamp(3rem,10vw,9.5rem)]! leading-[0.9]!">
          <span data-reveal="fade" className="block">
            Don’t miss the fine print.
            <a
              href="#newsletter-note"
              className="relative ml-[0.08em] align-super font-mono text-[0.22em] font-normal tracking-normal text-accent no-underline after:absolute after:-inset-3 after:content-[''] hover:text-white"
            >
              <span aria-hidden="true">1</span>
              <span className="sr-only"> (see note 1)</span>
            </a>
          </span>
        </SectionTitle>
        <p data-reveal="fade" className="mt-8 max-w-xl text-lg text-mute sm:text-xl">
          Ticket releases, speaker announcements and applications go to the mailing list first.
        </p>

        {/* Signature line: the line itself is the call to action. */}
        <div className="mt-12 sm:mt-20">
          {open ? (
            <a
              href={settings.newsletterUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-cursor="link"
              className={`${styles.line} group block`}
            >
              <span className="flex items-end gap-4 pb-4 sm:gap-6">
                <span aria-hidden="true" className="pb-[0.3em] font-mono text-sm leading-none text-subtle transition-colors duration-300 group-hover:text-accent group-focus-visible:text-accent">
                  ✕
                </span>
                <span className="flex-1 text-[clamp(1.75rem,4.4vw,3.75rem)] leading-[1.05] font-light tracking-[-0.035em] text-balance text-white">
                  Sign here to join the list.
                </span>
                <span
                  aria-hidden="true"
                  className="mb-1 grid size-12 shrink-0 place-items-center rounded-full bg-accent text-white transition-colors duration-300 group-hover:bg-white group-hover:text-black sm:size-16"
                >
                  <Arrow dir="up-right" className="text-lg transition-transform duration-500 ease-[var(--ease-cinema)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 sm:text-xl" />
                </span>
              </span>
              <span aria-hidden="true" className={styles.rule} data-sign-rule />
              <span className="fine-print mt-3 flex flex-wrap justify-between gap-x-6 gap-y-1 text-mute">
                <span>Mailing list · one form, no account</span>
                {host ? <span className="text-subtle">Opens {host} in a new tab</span> : null}
              </span>
              {host ? null : <span className="sr-only"> (opens in a new tab)</span>}
            </a>
          ) : (
            <div>
              <div className="flex items-end gap-4 pb-4 sm:gap-6">
                <span aria-hidden="true" className="pb-[0.3em] font-mono text-sm leading-none text-subtle">
                  ✕
                </span>
                <p className="text-[clamp(1.75rem,4.4vw,3.75rem)] leading-[1.05] font-light tracking-[-0.035em] text-balance text-mute">
                  The list opens soon.
                </p>
              </div>
              <div data-sign-rule aria-hidden="true" className="h-px bg-white/30" />
              <p className="fine-print mt-3 text-mute">
                Mailing list · not yet open
                {settings.contactEmail ? (
                  <>
                    {' '}
                    · until then, write to{' '}
                    <a
                      href={`mailto:${settings.contactEmail}?subject=Mailing%20list`}
                      className="link-draw inline-block py-1.5 tracking-normal text-white normal-case"
                    >
                      {settings.contactEmail}
                    </a>
                  </>
                ) : null}
              </p>
            </div>
          )}
        </div>

        <div className="mt-16 grid gap-8 border-t border-white/15 pt-6 sm:grid-cols-2 sm:mt-24">
          <p id="newsletter-note" data-cursor="loupe" className="fine-print max-w-md text-mute">
            <span className="text-accent">1.</span> The list is only used for <EventName /> event news. You can
            unsubscribe at any time.
          </p>
          <ul className="fine-print -my-1.5 flex flex-wrap gap-x-6 sm:justify-end text-mute">
            {ig ? (
              <li>
                <a href={ig} target="_blank" rel="noopener noreferrer" className="link-draw inline-block py-1.5 text-white">
                  Instagram {handle ? <span className="tracking-normal normal-case">{handle}</span> : null}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
            ) : null}
            {appsOpen ? (
              <li>
                <a href={settings.speakerApplicationsUrl} target="_blank" rel="noopener noreferrer" className="link-draw inline-block py-1.5 text-white">
                  Apply to speak
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
            ) : null}
            <li>
              <Link href="/partners" className="link-draw inline-block py-1.5 text-white">
                Organizations: partner with us
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </SectionShell>
  );
}
