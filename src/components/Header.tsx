import Link from 'next/link';
import { Button } from './ui/Button';
import { Logo } from './Logo';
import { MobileMenu } from './MobileMenu';
import { navItems, navVisibility } from './nav';
import type { Settings } from '@/lib/content';
import { ticketCta } from '@/lib/tickets';

/**
 * Sticky, solid black bar. The logo only ever sits on this solid surface.
 * With motion on, the engine slides the whole bar away on scroll down and back
 * on scroll up (never while it holds focus); the red hairline under it is the
 * reading progress.
 */
export async function Header({ settings }: { settings: Settings }) {
  const cta = ticketCta(settings);
  // Same conditions the sections use to render themselves (Schedule, Team, Faq).
  const items = navItems(await navVisibility());
  return (
    <header
      data-site-header
      className="site-header sticky top-0 z-[var(--z-header)] h-[var(--header-h)] border-b border-white/10 bg-black"
    >
      <div className="shell flex h-full items-center gap-4">
        {/* Clear space: the bar is 80px with a 1px bottom border (79px inside), so a 46px logo keeps at
            least 16px above and below; pr-4 + gap-4 keeps the date divider 32px away. data-cursor="none":
            the custom cursor never draws over the logo. */}
        <Link
          href="/"
          className="-my-1 flex shrink-0 items-center py-1 pr-4"
          aria-label="TEDxSantaClaraUniversity, home"
          data-cursor="none"
        >
          <Logo priority className="h-[2.875rem]" />
        </Link>

        <p className="fine-print hidden border-l border-white/15 pl-4 text-mute sm:block">
          <time dateTime={settings.dateISO}>
            <span className="xl:hidden">{settings.dateShort}</span>
            <span className="hidden xl:inline">{settings.dateLong}</span>
          </time>
        </p>

        <nav aria-label="Primary" className="ml-auto hidden lg:block">
          <ul className="flex items-center gap-1">
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="group block rounded-full px-3 py-2 text-sm text-mute transition-colors duration-300 hover:text-white focus-visible:text-white"
                >
                  <span className="link-draw pb-0.5 group-focus-visible:bg-[length:100%_1px]">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-2">
          <Button href={cta.href} size="sm" aria-label={cta.ariaLabel}>
            Tickets
          </Button>
          <MobileMenu items={items} dateLong={settings.dateLong} dateISO={settings.dateISO} />
        </div>
      </div>
      <span
        aria-hidden="true"
        data-progress
        className="reading-progress pointer-events-none absolute inset-x-0 top-full h-px bg-accent"
      />
    </header>
  );
}
