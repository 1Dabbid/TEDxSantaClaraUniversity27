import Link from 'next/link';
import type { Settings } from '@/lib/content';
import { partnerCta } from '@/lib/links';
import { CLUB_URL, TEDX_PROGRAM_URL } from '@/lib/site';
import { Logo } from './Logo';
import { NAV_ITEMS } from './nav';

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
const NewTab = () => <span className="sr-only"> (opens in a new tab)</span>;

/** "2027-04-23" -> ["04", "23", "27"] */
function dateParts(iso: string) {
  const [y, m, d] = iso.split('-');
  return [m, d, y?.slice(2)].filter(Boolean);
}

/**
 * Solid black sign-off. The logo only ever sits here (and in the header) on
 * pure black with clear space around it, unaltered.
 */
export function Footer({ settings }: { settings: Settings }) {
  const socials = (Object.keys(SOCIAL_LABELS) as (keyof Settings['socials'])[]).filter((k) => settings.socials[k]);
  const partner = partnerCta(settings);
  const parts = dateParts(settings.dateISO);

  return (
    <footer className="relative z-[var(--z-content)] border-t border-white/10 bg-black">
      <div className="shell pt-16 sm:pt-24">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <Link href="/" aria-label="TEDxSantaClaraUniversity, home" className="-m-3 inline-block p-3">
            <Logo className="h-14 sm:h-16" />
          </Link>
          <p className="fine-print text-right">
            End of document
            <br />
            Signed and dated
          </p>
        </div>

        {/* The date as a sign-off */}
        <p className="mt-16 sm:mt-24" aria-hidden="true">
          <span className="block text-[clamp(4.5rem,19vw,19rem)] leading-[0.8] font-semibold tracking-[-0.065em] tabular-nums">
            {parts.map((p, i) => (
              <span key={i}>
                {i > 0 ? <span className="text-accent">.</span> : null}
                {p}
              </span>
            ))}
          </span>
        </p>
        <p className="mt-6 flex flex-wrap gap-x-4 gap-y-1 border-b border-white/15 pb-6 text-sm text-white sm:text-base">
          <time dateTime={settings.dateISO}>{settings.dateLong}</time>
          <span aria-hidden="true" className="text-subtle">
            /
          </span>
          <span>{settings.venueName}</span>
          {settings.venueCampus ? (
            <>
              <span aria-hidden="true" className="text-subtle">
                /
              </span>
              <span>{settings.venueCampus}</span>
            </>
          ) : null}
        </p>

        <div className="grid gap-12 py-14 sm:grid-cols-2 lg:grid-cols-12 lg:gap-10">
          <section aria-labelledby="footer-tedx" className="sm:col-span-2 lg:col-span-5">
            <h2 id="footer-tedx" className="fine-print text-white">
              <span aria-hidden="true">§ A · </span>What is TEDx?
            </h2>
            <p data-cursor="loupe" className="mt-4 max-w-xl text-sm leading-relaxed text-mute">
              {WHAT_IS_TEDX}
            </p>
            <p className="mt-4 text-sm">
              <a href={TEDX_PROGRAM_URL} className={linkCls} {...ext}>
                Learn about the TEDx program
                <NewTab />
              </a>
            </p>
          </section>

          <nav aria-labelledby="footer-site" className="lg:col-span-2 lg:col-start-7">
            <h2 id="footer-site" className="fine-print text-white">
              <span aria-hidden="true">§ B · </span>Site
            </h2>
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

          <div className="lg:col-span-2">
            <h2 className="fine-print text-white">
              <span aria-hidden="true">§ C · </span>Elsewhere
            </h2>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <a href={CLUB_URL} className={linkCls} {...ext}>
                  tedxscu.com
                  <span className="sr-only"> (TEDxSantaClaraUniversity club site, opens in a new tab)</span>
                </a>
              </li>
              {socials.map((k) => (
                <li key={k}>
                  <a href={settings.socials[k]} className={linkCls} {...ext}>
                    {SOCIAL_LABELS[k]}
                    <NewTab />
                  </a>
                </li>
              ))}
              {settings.newsletterUrl ? (
                <li>
                  <a href={settings.newsletterUrl} className={linkCls} {...ext}>
                    Mailing list
                    <NewTab />
                  </a>
                </li>
              ) : null}
            </ul>
          </div>

          <div className="lg:col-span-2">
            <h2 className="fine-print text-white">
              <span aria-hidden="true">§ D · </span>Contact
            </h2>
            <ul className="mt-4 space-y-3 text-sm">
              {settings.contactEmail ? (
                <li>
                  <span className="fine-print block">General</span>
                  <a href={`mailto:${settings.contactEmail}`} className={`${linkCls} break-all`}>
                    {settings.contactEmail}
                  </a>
                </li>
              ) : null}
              <li>
                <span className="fine-print block">Partnerships</span>
                {partner.kind === 'email' ? (
                  <a href={partner.href} className={`${linkCls} break-all`}>
                    {partner.display}
                  </a>
                ) : (
                  <Link href="/partners" className={linkCls}>
                    Become a partner
                  </Link>
                )}
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="shell flex flex-col gap-3 py-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-white">This independent TEDx event is operated under license from TED.</p>
          <p className="fine-print">
            © {new Date().getFullYear()}<span className="tracking-normal normal-case">TEDxSantaClaraUniversity</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
