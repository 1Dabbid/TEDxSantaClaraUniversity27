import Image from 'next/image';
import type { TeamMember } from '@/lib/content';
import { initials } from '@/lib/site';
import { PortraitToggle } from './PortraitToggle';

/**
 * A board member's portrait: one 4:5 frame with a hairline edge, whatever is
 * in it, so the board reads as one set and rows line up before and after the
 * photos arrive.
 *
 * - Photo: black and white with a slight contrast curve and a low veil (the
 *   three studio backgrounds settle into one family of greys), in colour on
 *   hover, keyboard focus or tap (PortraitToggle, globals.css "Team portraits").
 * - No photo yet: the person's initials, set in the frame like a seal.
 * - Not named publicly (People > Team > Show name publicly): an empty, hatched
 *   frame, a blank on the form. No initials, nothing that identifies them.
 *
 * The image is decorative (alt=""): the name is always printed next to it.
 * `sizes` is the frame's rendered width at each breakpoint; the image fills the
 * frame (no layout shift) and loads lazily.
 */
export function Portrait({ member, sizes, className = '' }: { member: TeamMember; sizes: string; className?: string }) {
  if (!member.name) {
    return (
      <span aria-hidden="true" data-team-vacant className={`portrait portrait--vacant ${className}`}>
        <span className="portrait-frame" />
      </span>
    );
  }
  if (!member.photo) {
    return (
      <span aria-hidden="true" data-team-monogram className={`portrait portrait--monogram ${className}`}>
        <span className="portrait-frame">
          <span className="portrait-initials">{initials(member.name)}</span>
        </span>
      </span>
    );
  }
  return (
    <PortraitToggle name={member.name} className={className}>
      <span className="portrait-frame">
        <Image src={member.photo} alt="" fill sizes={sizes} className="portrait-img object-cover" />
        <span aria-hidden="true" className="portrait-veil" />
      </span>
      <span aria-hidden="true" className="portrait-marks" />
    </PortraitToggle>
  );
}
