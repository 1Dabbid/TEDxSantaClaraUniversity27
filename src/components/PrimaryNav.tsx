'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navCurrent, type NavItem } from './nav-links';

/**
 * The header's desktop links. They always open the topic pages; client-side only
 * to read the pathname, so the current one is marked (rule at the top of nav.ts).
 */
export function PrimaryNav({ items }: { items: readonly NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="ml-auto hidden lg:block">
      <ul className="flex items-center gap-1">
        {items.map((item) => {
          const current = navCurrent(item, pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current}
                className={`group block rounded-full px-3 py-2 text-sm transition-colors duration-300 hover:text-white focus-visible:text-white ${
                  current ? 'text-white' : 'text-mute'
                }`}
              >
                <span
                  className={`link-draw pb-0.5 group-focus-visible:bg-[length:100%_1px] ${current ? 'bg-[length:100%_1px]' : ''}`}
                >
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
