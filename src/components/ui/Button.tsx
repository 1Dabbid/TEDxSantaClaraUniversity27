import Link from 'next/link';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

type Variant = 'primary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

const base =
  'group relative inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-tight whitespace-nowrap ' +
  // No CSS transition on transform: the magnetic hover drives it from JS.
  'transition-[background-color,color,border-color] duration-300 ease-[var(--ease-cinema)] ' +
  'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-white hover:text-black',
  ghost: 'border border-white/30 text-white hover:border-white hover:bg-white/5',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-11 px-6 text-[0.9375rem]',
  lg: 'h-14 px-8 text-base',
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  className?: string;
  /** Disable the magnetic hover hook for this button. */
  magnetic?: boolean;
};

type ButtonAsLink = CommonProps & { href: string; external?: boolean } & Omit<
    ComponentPropsWithoutRef<'a'>,
    'href' | 'className' | 'children'
  >;

/**
 * Primary (red) or ghost button. Renders a Next <Link> for internal hrefs and
 * a plain <a> for external ones. `data-magnetic` opts it into the magnetic hover
 * of the motion engine (fine pointers only, off in static quality).
 */
export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  magnetic = true,
  href,
  external,
  children,
  ...rest
}: ButtonAsLink) {
  const cls = `${base} ${variants[variant]} ${sizes[size]} ${className}`;
  const magneticProps = magnetic ? { 'data-magnetic': '' } : {};
  const isExternal = external ?? /^(https?:|mailto:|tel:)/.test(href);
  if (isExternal) {
    const newTab = /^https?:/.test(href);
    return (
      <a
        href={href}
        className={cls}
        {...magneticProps}
        {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        {...rest}
      >
        {children}
        {newTab ? <span className="sr-only"> (opens in a new tab)</span> : null}
      </a>
    );
  }
  return (
    <Link href={href} className={cls} {...magneticProps} {...rest}>
      {children}
    </Link>
  );
}
