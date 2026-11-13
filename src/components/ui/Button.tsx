import Link from 'next/link';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

type Variant = 'primary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

const base =
  'btn group relative inline-flex items-center justify-center gap-2 rounded-full text-center font-medium leading-tight tracking-tight text-balance ' +
  // No CSS transition on transform: the magnetic hover drives it from JS (fine
  // pointers). Touch gets a pressed state instead (.btn in globals.css).
  'transition-[background-color,color,border-color] duration-300 ease-[var(--ease-cinema)] ' +
  'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-white hover:text-black',
  ghost: 'border border-white/30 text-white hover:border-white hover:bg-white/5',
};

const sizes: Record<Size, string> = {
  // 44px tall on touch screens, compact for mouse and trackpad.
  sm: 'min-h-11 px-5 py-2 text-sm pointer-fine:min-h-9 pointer-fine:px-4 pointer-fine:py-1.5',
  md: 'min-h-11 px-6 py-2.5 text-[0.9375rem]',
  lg: 'min-h-14 px-8 py-3 text-base',
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
 * Protocol-relative URLs (`//host/path`; browsers read `/\\host` the same way) leave
 * the site even though they start with a slash.
 */
const PROTOCOL_RELATIVE = /^[/\\]{2}/;

/**
 * Primary (red) or ghost button. Renders a Next <Link> for internal hrefs and
 * a plain <a> for external ones (http(s), mailto, tel and protocol-relative `//host`
 * links; web links open in a new tab). `data-magnetic` opts it into the magnetic hover
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
  const offSite = PROTOCOL_RELATIVE.test(href);
  // A protocol-relative href is external even if a caller passed external={false}.
  const isExternal = offSite || (external ?? /^(https?:|mailto:|tel:)/i.test(href));
  if (isExternal) {
    const newTab = offSite || /^https?:/i.test(href);
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
