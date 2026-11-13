import logo112 from '../../public/brand/logo-on-black-112w.webp';
import logo168 from '../../public/brand/logo-on-black-168w.webp';
import logo224 from '../../public/brand/logo-on-black-224w.webp';
import logo336 from '../../public/brand/logo-on-black-336w.webp';

/**
 * The approved TEDxSantaClaraUniversity lockup (white text, for black).
 * Only place it on a solid black surface with clear space around it. Never
 * recolour, distort, crop, overlay on the 3D canvas, or combine with other marks.
 *
 * A plain <img>, not next/image: the logo needs no runtime optimisation, and
 * this keeps the next/image client component out of every page's first-load JS.
 * The files are pre-sized, lossless WebP downscales of public/brand/logo-on-black.png
 * (1329×778; same pixels, Lanczos resize only), 1×–3× for the 48–64px tall
 * header and footer placements. Imported, so they ship under hashed
 * /_next/static/media URLs with immutable caching. width/height carry the
 * aspect ratio so the box is reserved before the image arrives (no CLS).
 */
const SOURCES = [logo112, logo168, logo224, logo336];
const SRC_SET = SOURCES.map((s) => `${s.src} ${s.width}w`).join(', ');

export function Logo({
  className = '',
  priority = false,
  sizes = '(min-width: 640px) 110px, 96px',
}: {
  className?: string;
  /** Above the fold: load eagerly (it is never the LCP element, so no fetch priority boost). */
  priority?: boolean;
  /** Rendered CSS width; the default covers h-12 to h-16. */
  sizes?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- pre-optimised static asset, see above
    <img
      src={logo224.src}
      srcSet={SRC_SET}
      sizes={sizes}
      width={1329}
      height={778}
      alt="TEDxSantaClaraUniversity"
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      className={`w-auto ${className}`}
    />
  );
}
