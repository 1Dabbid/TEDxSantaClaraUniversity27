import type { Metadata } from 'next';
import Link from 'next/link';
import { getFaq, getSettings } from '@/lib/content';
import { Button } from '@/components/ui/Button';
import { SITE_NAME } from '@/lib/site';

export const metadata: Metadata = {
  // Plain wording for the tab and history; the visible page keeps the clause conceit.
  title: 'Page not found (404)',
  description: 'This page does not exist.',
  robots: { index: false, follow: true },
  // No canonical (the layout's would point at the home page) and a plain share title.
  alternates: { canonical: null },
  openGraph: { title: `${SITE_NAME} · Page not found (404)`, description: 'This page does not exist.', url: null },
  twitter: { title: `${SITE_NAME} · Page not found (404)`, description: 'This page does not exist.' },
};

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
    <section aria-labelledby="nf-title" className="relative isolate">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-black/85" />
      <div className="shell flex min-h-[calc(100svh-var(--header-h))] flex-col justify-between gap-16 py-16 sm:py-24">
        <div className="flex items-baseline justify-between gap-6">
          <p className="fine-print text-mute">Error 404 · Clause not found</p>
          <p className="fine-print hidden sm:block text-mute">Void where prohibited</p>
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
            This clause does not exist.
            <span aria-hidden="true" className="ml-[0.08em] align-super font-mono text-[0.3em] font-normal tracking-normal text-accent">
              *
            </span>
          </h1>
          <p className="mt-8 max-w-lg text-lg text-mute">
            The link may be out of date, or the page may have moved. Nothing in the agreement was lost.
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
            <span aria-hidden="true" className="text-accent">
              *
            </span>{' '}
            See instead, in order of appearance:
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
  );
}
