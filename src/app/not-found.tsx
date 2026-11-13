import type { Metadata } from 'next';
import Link from 'next/link';
import { getFaq, getSettings } from '@/lib/content';
import { Button } from '@/components/ui/Button';
import { SiteShell } from '@/components/SiteShell';
import { SITE_NAME } from '@/lib/site';

export const metadata: Metadata = {
  // Plain wording, on the page and in the tab.
  title: 'Page not found (404)',
  description: 'This page does not exist.',
  robots: { index: false, follow: true },
  // No canonical (the layout's would point at the home page) and a plain share title.
  alternates: { canonical: null },
  openGraph: { title: `${SITE_NAME} · Page not found (404)`, description: 'This page does not exist.', url: null },
  twitter: { title: `${SITE_NAME} · Page not found (404)`, description: 'This page does not exist.' },
};

/**
 * Every 404 (unknown URLs, unknown speaker slugs, the switched-off admin) is
 * rendered by the root layout alone, outside the (site) route group, so the page
 * brings the site's header and footer itself.
 */
export default async function NotFound() {
  // Never point at a section that is not rendered.
  const [settings, faq] = await Promise.all([getSettings(), getFaq()]);
  const showFaq = settings.sections.showFaq && faq.length > 0;
  const links = [
    { href: '/#speakers', label: 'Speakers' },
    { href: '/#tickets', label: 'Tickets' },
    { href: '/#venue', label: 'Venue' },
    { href: '/partners', label: 'Partners' },
    ...(showFaq ? [{ href: '/#faq', label: 'FAQ' }] : []),
  ];
  return (
    <SiteShell>
      <section aria-labelledby="nf-title" className="relative isolate">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-black/85" />
        <div className="shell flex min-h-[calc(100svh-var(--header-h))] flex-col justify-between gap-16 py-16 sm:py-24">
          <div className="flex items-baseline justify-between gap-6">
            <p className="fine-print text-mute">Error 404</p>
          </div>

          <div>
            <p
              aria-hidden="true"
              className="text-[clamp(6rem,30vw,26rem)] leading-[0.78] font-semibold tracking-[-0.07em] text-white/10 tabular-nums"
            >
              §&thinsp;404
            </p>
            <h1
              id="nf-title"
              data-reveal="lines"
              className="mt-8 max-w-[14ch] text-headline font-semibold tracking-[-0.045em] text-balance"
            >
              This page does not exist.
            </h1>
            <p className="mt-8 max-w-lg text-lg text-mute">
              The link may be out of date, or the page may have moved.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button href="/" size="lg">
                Back to the event
              </Button>
              {showFaq ? (
                <Button href="/#faq" variant="ghost" size="lg">
                  Read the FAQ
                </Button>
              ) : null}
            </div>
          </div>

          <div className="grid gap-6 border-t border-white/15 pt-6 sm:grid-cols-[1fr_auto]">
            <p className="fine-print max-w-md text-mute">
              Or go straight to:
            </p>
            <ul className="-my-2.5 flex flex-wrap gap-x-6 text-base">
              {links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="link-draw inline-block py-2.5 text-mute hover:text-white focus-visible:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
