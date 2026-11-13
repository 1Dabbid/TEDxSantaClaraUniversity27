import Link from 'next/link';
import { Button } from './ui/Button';
import { Logo } from './Logo';
import { MobileMenu } from './MobileMenu';
import { NAV_ITEMS } from './nav';
import type { Settings } from '@/lib/content';
import { ticketCta } from '@/lib/tickets';

/**
 * Sticky, solid black bar. The logo only ever sits on this solid surface.
 */
export function Header({ settings }: { settings: Settings }) {
  const cta = ticketCta(settings);
  return (
    <header
      data-site-header
      className="sticky top-0 z-[var(--z-header)] h-[var(--header-h)] border-b border-white/10 bg-black"
    >
      <div className="shell flex h-full items-center gap-4">
        <Link
          href="/"
          className="-my-1 flex shrink-0 items-center py-1 pr-2"
          aria-label="TEDxSantaClaraUniversity, home"
        >
          <Logo priority className="h-12 lg:h-14" />
        </Link>

        <p className="fine-print hidden border-l border-white/15 pl-4 text-mute sm:block">
          <time dateTime={settings.dateISO}>
            <span className="xl:hidden">{settings.dateShort}</span>
            <span className="hidden xl:inline">{settings.dateLong}</span>
          </time>
        </p>

        <nav aria-label="Primary" className="ml-auto hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="rounded-full px-3 py-2 text-sm text-mute transition-colors hover:text-white"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-2">
          <Button href={cta.href} size="sm" aria-label={cta.ariaLabel}>
            Tickets
          </Button>
          <MobileMenu items={NAV_ITEMS} dateLong={settings.dateLong} dateISO={settings.dateISO} />
        </div>
      </div>
    </header>
  );
}
