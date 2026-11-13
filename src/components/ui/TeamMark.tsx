import Image from 'next/image';
import type { TeamMember } from '@/lib/content';
import { initials } from '@/lib/site';

/**
 * A board member's mark: their headshot (black and white, in a circle) once it is
 * uploaded, and until then their initials in the same circle, set like a seal
 * on a signed page. Same size and place either way, so the roster looks the
 * same before and after the photos arrive. Decorative: the name is always next to it.
 */
export function TeamMark({ member, size = 'md' }: { member: TeamMember; size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'size-11 sm:size-12' : 'size-14 sm:size-16';
  if (member.photo) {
    return (
      <Image
        src={member.photo}
        alt=""
        width={128}
        height={128}
        sizes={size === 'sm' ? '48px' : '64px'}
        className={`${box} shrink-0 rounded-full object-cover grayscale`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      data-team-monogram
      className={`${box} relative grid shrink-0 place-items-center rounded-full border border-white/30 font-mono tracking-[0.08em] text-white ${
        size === 'sm' ? 'text-[0.6875rem] sm:text-xs' : 'text-[0.8125rem] sm:text-sm'
      }`}
    >
      {/* An inner hairline ring: the seal. */}
      <span className="pointer-events-none absolute inset-[3px] rounded-full border border-white/10" />
      {initials(member.name ?? member.role)}
    </span>
  );
}
