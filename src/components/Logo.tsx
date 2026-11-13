import Image from 'next/image';
import logoOnBlack from '../../public/brand/logo-on-black.png';

/**
 * The approved TEDxSantaClaraUniversity lockup (white text, for black).
 * Only place it on a solid black surface with clear space around it. Never
 * recolour, distort, crop, overlay on the 3D canvas, or combine with other marks.
 */
export function Logo({ className = '', priority = false }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src={logoOnBlack}
      alt="TEDxSantaClaraUniversity"
      priority={priority}
      sizes="160px"
      className={`w-auto ${className}`}
    />
  );
}
