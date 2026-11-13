import Link from 'next/link';
import type { Settings } from '@/lib/content';
import { getTedLanguage, paragraphs } from '@/lib/content';
import { partnerCta } from '@/lib/links';
import { CLUB_URL, TED_URL, TEDX_PROGRAM_URL } from '@/lib/site';
import { FooterMotion } from '@/motion/sections/FooterMotion';
import { Logo } from './Logo';
import { EventName, Tedx } from './ui/KeepCase';
import { MotionToggle } from './ui/MotionToggle';
import { footerNavItems, navVisibility } from './nav';

const SOCIAL_LABELS: Record<keyof Settings['socials'], string> = {
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  tiktok: 'TikTok',
};

const ext = { target: '_blank', rel: 'noopener noreferrer' } as const;
// inline-block + py-1 gives every footer link a target at least 24px tall (WCAG 2.5.8).
const linkCls = 'link-draw inline-block py-1 text-mute hover:text-white focus-visible:text-white';
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
export async function Footer({ settings }: { settings: Settings }) {
  // Same visibility rule as the header: never link to a section that is not rendered.
  const [visible, ted] = await Promise.all([navVisibility(), getTedLanguage()]);
  const nav = footerNavItems(visible);
  const socials = (Object.keys(SOCIAL_LABELS) as (keyof Settings['socials'])[]).filter((k) => settings.socials[k]);
  const partner = partnerCta(settings);
  const parts = dateParts(settings.dateISO);

  return (
    <footer id="site-footer" className="relative z-[var(--z-content)] border-t border-white/10 bg-black">
      <FooterMotion />
      <div className="shell pt-16 sm:pt-24">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <Link href="/" aria-label="TEDxSantaClaraUniversity, home" data-cursor="none" className="-m-3 inline-block p-3">
            <Logo className="h-14 sm:h-16" />
          </Link>
          <p className="fine-print text-right text-mute">
            {settings.copy.footerSignoff.split('\n').map((line, i) => (
              <span key={i}>
                {i > 0 ? <br /> : null}
                {line}
              </span>
            ))}
          </p>
        </div>

        {/* The date as a sign-off */}
        {/* Sized to the container so the eight characters always span the full measure. */}
        <p className="@container mt-16 sm:mt-24" aria-hidden="true">
          <span
            data-footer-date
            className="-ml-[0.035em] block leading-[0.8] font-semibold tracking-[-0.065em] whitespace-nowrap tabular-nums"
            style={{ fontSize: 'calc(100cqi / 3.92)' }}
          >
            {parts.map((p, i) => (
              <span key={i}>
                {i > 0 ? (
                  <span data-footer-dot className="text-accent">
                    .
                  </span>
                ) : null}
                {p}
              </span>
            ))}
          </span>
        </p>
        <p className="mt-8 flex flex-col gap-x-4 gap-y-1 border-b border-white/15 pb-6 text-base text-white sm:flex-row sm:flex-wrap">
          <time dateTime={settings.dateISO}>{settings.dateLong}</time>
          <span aria-hidden="true" className="hidden text-subtle sm:inline">
            ·
          </span>
          <span>{settings.venueName}</span>
          {settings.venueCampus ? (
            <>
              <span aria-hidden="true" className="hidden text-subtle sm:inline">
                ·
              </span>
              <span>{settings.venueCampus}</span>
            </>
          ) : null}
        </p>

        <div className="grid grid-cols-2 gap-x-6 gap-y-12 py-14 lg:grid-cols-12 lg:gap-10">
          {/* TED's required language, verbatim from content/ted-language.yaml (Contact & site > Required TED language).
              Left column on desktop; on phones and tablets it follows the links and contacts, so the
              sign-off reads date, where to go, who to write to, then the licence texts. */}
          <div className="col-span-2 space-y-10 max-lg:order-last lg:col-span-5">
            <section aria-labelledby="footer-tedx">
              <h2 id="footer-tedx" className="fine-print text-white">
                About <Tedx />
              </h2>
              {paragraphs(ted.aboutTedx).map((p, i) => (
                <p key={i} data-cursor="loupe" className="mt-4 max-w-xl text-sm leading-relaxed text-mute">
                  {p}
                </p>
              ))}
              <p className="mt-3 text-sm">
                <a href={TEDX_PROGRAM_URL} className={linkCls} {...ext}>
                  Learn about the TEDx program
                  <NewTab />
                </a>
              </p>
            </section>
            <section aria-labelledby="footer-ted">
              <h2 id="footer-ted" className="fine-print text-white">
                About TED
              </h2>
              {paragraphs(ted.aboutTed).map((p, i) => (
                <p key={i} className="mt-4 max-w-xl text-sm leading-relaxed text-mute">
                  {p}
                </p>
              ))}
              <p className="mt-3 text-sm">
                <a href={TED_URL} className={linkCls} {...ext}>
                  Visit TED.com
                  <NewTab />
                </a>
              </p>
            </section>
          </div>

          <nav aria-labelledby="footer-site" className="lg:col-span-2 lg:col-start-7">
            <h2 id="footer-site" className="fine-print text-white">
              Site
            </h2>
            <ul className="mt-3 text-sm">
              {nav.map((i) => (
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

          <div className="col-span-2 sm:col-span-1 lg:col-span-2">
            <h2 className="fine-print text-white">
              Elsewhere
            </h2>
            <ul className="mt-3 text-sm">
              <li>
                <a href={CLUB_URL} className={linkCls} {...ext}>
                  TEDxSantaClaraUniversity club site
                  <NewTab />
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

          <div className="col-span-2 sm:col-span-1 lg:col-span-2">
            <h2 className="fine-print text-white">
              Contact
            </h2>
            <ul className="mt-4 space-y-2 text-sm">
              {settings.contactEmail ? (
                <li>
                  <span className="fine-print block text-mute">General</span>
                  <a href={`mailto:${settings.contactEmail}?subject=${encodeURIComponent(`Question · ${settings.eventName}`)}`} className={`${linkCls} break-all`}>
                    {settings.contactEmail}
                  </a>
                </li>
              ) : null}
              <li>
                <span className="fine-print block text-mute">Partnerships</span>
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
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
            {/* Stops the 3D scene, smooth scroll and every animation; remembered on this device. */}
            <MotionToggle />
            <p className="fine-print text-mute">
              © {new Date().getFullYear()}&nbsp;<EventName />
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
