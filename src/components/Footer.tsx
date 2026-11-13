import Link from 'next/link';
import type { Settings } from '@/lib/content';
import { Logo } from './Logo';
import { NAV_ITEMS } from './nav';

const TEDX_PROGRAM_URL = 'https://www.ted.com/about/programs-initiatives/tedx-program';
const CLUB_URL = 'https://tedxscu.com';

const WHAT_IS_TEDX =
  'In the spirit of discovering and sharing ideas, TED has created a program called TEDx. TEDx is a program of local, self-organized events that bring people together to share a TED-like experience. Our event is called TEDxSantaClaraUniversity, where x = independently organized TED event. At our TEDxSantaClaraUniversity event, TED Talks video and live speakers will combine to spark deep discussion and connection in a small group. The TED Conference provides general guidance for the TEDx program, but individual TEDx events, including ours, are self-organized.';

const SOCIAL_LABELS: Record<keyof Settings['socials'], string> = {
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  tiktok: 'TikTok',
};

const ext = { target: '_blank', rel: 'noopener noreferrer' } as const;
const linkCls = 'text-mute underline-offset-4 transition-colors hover:text-white hover:underline';

/** Solid black footer with the TEDx license line and program description. */
export function Footer({ settings }: { settings: Settings }) {
  const socials = (Object.keys(SOCIAL_LABELS) as (keyof Settings['socials'])[]).filter(
    (k) => settings.socials[k],
  );

  return (
    <footer className="relative z-[var(--z-content)] border-t border-white/10 bg-black">
      <div className="shell grid gap-14 py-20 md:grid-cols-12">
        <div className="md:col-span-4">
          <Link href="/" aria-label="TEDxSantaClaraUniversity, home" className="inline-block p-1">
            <Logo className="h-16" />
          </Link>
          <p className="fine-print mt-8">
            <time dateTime={settings.dateISO}>{settings.dateLong}</time>
            <br />
            {settings.venueName}
          </p>
        </div>

        <section aria-labelledby="footer-tedx" className="md:col-span-5">
          <h2 id="footer-tedx" className="fine-print text-white">
            What is TEDx?
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-mute">{WHAT_IS_TEDX}</p>
          <p className="mt-4 text-sm">
            <a href={TEDX_PROGRAM_URL} className={linkCls} {...ext}>
              Learn about the TEDx program
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </p>
        </section>

        <div className="grid grid-cols-2 gap-8 md:col-span-3">
          <nav aria-label="Footer">
            <h2 className="fine-print text-white">Site</h2>
            <ul className="mt-4 space-y-2 text-sm">
              {NAV_ITEMS.map((i) => (
                <li key={i.href}>
                  <Link href={i.href} className={linkCls}>
                    {i.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/#tickets" className={linkCls}>
                  Tickets
                </Link>
              </li>
            </ul>
          </nav>
          <div>
            <h2 className="fine-print text-white">Elsewhere</h2>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <a href={CLUB_URL} className={linkCls} {...ext}>
                  tedxscu.com<span className="sr-only"> (TEDxSantaClaraUniversity club site, opens in a new tab)</span>
                </a>
              </li>
              {socials.map((k) => (
                <li key={k}>
                  <a href={settings.socials[k]} className={linkCls} {...ext}>
                    {SOCIAL_LABELS[k]}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </li>
              ))}
              {settings.contactEmail ? (
                <li>
                  <a href={`mailto:${settings.contactEmail}`} className={linkCls}>
                    Contact
                  </a>
                </li>
              ) : null}
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="shell flex flex-col gap-3 py-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-white">This independent TEDx event is operated under license from TED.</p>
          <p className="fine-print">
            © {new Date().getFullYear()} <span className="tracking-normal normal-case">TEDxSantaClaraUniversity</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
