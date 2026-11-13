import type { Settings } from '@/lib/content';
import { paragraphs } from '@/lib/content';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { ThemeMotion } from '@/motion/sections/ThemeMotion';
import { SectionShell, SectionTitle } from './SectionShell';

/** Splits the tagline into (up to) three phrases of near-equal word counts, front-loaded. */
function phrasesOf(tagline: string): string[] {
  const words = tagline.trim().split(/\s+/).filter(Boolean);
  const n = Math.min(3, words.length);
  if (n === 0) return [];
  const out: string[] = [];
  let at = 0;
  for (let i = 0; i < n; i++) {
    const size = Math.ceil((words.length - at) / (n - i));
    out.push(words.slice(at, at + size).join(' '));
    at += size;
  }
  return out;
}

const lowerFirst = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s);
const SUB = ['a', 'b', 'c'];

/**
 * § 01 · The theme. The fine print made literal.
 *
 * Markup is one readable document in every mode: a heading, the theme story as
 * numbered clauses, and a definitions clause containing the tagline. The huge
 * three-line statement is a decorative (aria-hidden) echo of that clause.
 *
 * - Static / no JS: natural height, readable clauses, the statement set large.
 * - Motion, md+: a tall runway with a sticky stage. The clauses shrink to a 9px
 *   contract footer on a locally dark corner. First the DOM text recedes and the
 *   engraved type on the 3D microphone (right ~45% of the frame) is the only fine
 *   print on screen; then each phrase of the definition (set as a defined term,
 *   in the sans) lifts off its exact spot in the small type and grows into the
 *   left/centre column, settling into display weight and tracking. The lines
 *   stay white and stack into the finished sentence (ThemeMotion). A clause
 *   counter ticks in the corner. The loupe cursor reads the small type.
 * - Motion, mobile: natural height, masked line reveals.
 */
export function Theme({ settings }: { settings: Settings }) {
  const paras = paragraphs(settings.themeStory);
  const phrases = phrasesOf(settings.themeTagline);
  const defIndex = paras.length + 1;
  const copy = settings.copy;
  // The heading's last two words never break apart (no one-word last line).
  const headWords = copy.themeHeading.split(/\s+/).filter(Boolean);
  const headEnd = headWords.slice(-2).join(' ');
  const headStart = headWords.length > 2 ? `${headWords.slice(0, -2).join(' ')} ` : '';

  return (
    <SectionShell id="theme" scrim="none" className="theme-runway">
      <div data-theme-stage data-def-index={defIndex} className="theme-stage relative">
        {/* Targeted scrims: one behind the text column (left), one under the
            contract (bottom left). The right ~45% stays open for the engraving. */}
        <div aria-hidden="true" className="theme-scrim pointer-events-none absolute inset-0 -z-10" />
        <div
          aria-hidden="true"
          data-theme-scrim
          className="theme-scrim-stack pointer-events-none absolute inset-0 -z-10"
        />
        <div className="theme-stage-inner shell py-28 md:py-36">
          <div className="flex items-start justify-between gap-6">
            <SectionLabel index={1}>The theme</SectionLabel>
            <div aria-hidden="true" data-theme-counter className="theme-counter fine-print items-baseline gap-3 text-right">
              <span className="text-white tabular-nums">
                §&nbsp;<span data-theme-clause className="normal-case">1.0</span>
              </span>
              <span className="tabular-nums">
                <span data-theme-step>00</span>&nbsp;/&nbsp;{String(phrases.length).padStart(2, '0')}
              </span>
            </div>
          </div>

          <div data-theme-title-wrap>
            <SectionTitle id="theme" reveal={false} className="max-w-4xl">
              {headStart}
              <span className="whitespace-nowrap">{headEnd}</span>
            </SectionTitle>
          </div>

          <p aria-hidden="true" data-theme-stack className="theme-stack my-16 md:my-20">
            {phrases.map((p, i) => (
              <span key={i} className="theme-line" data-theme-line>
                <span className="theme-line-inner" data-theme-line-inner>
                  <span data-theme-text>{p}</span>
                  {/* Take-off copy: set exactly like the small phrase (same family, weight,
                      tracking, text), so the hand-off from the paragraph is seamless. */}
                  <span className="theme-line-ghost" data-theme-ghost>
                    {i === 0 ? lowerFirst(p) : p}
                  </span>
                </span>
              </span>
            ))}
          </p>

          {/* Motion only: a figure caption for the 3D engraving, shown in the beat
              where it is the only fine print on screen. */}
          <p aria-hidden="true" data-theme-fig className="theme-fig fine-print">
            <span className="text-white">Fig.&nbsp;1</span> {copy.themeFigureCaption}
          </p>

          <div
            data-theme-fine
            data-cursor="loupe"
            data-cursor-zoom="2.6"
            className="theme-fine mt-4 md:mt-auto"
          >
            <ol aria-label="Theme statement" className="theme-fine-columns">
              {paras.map((p, i) => (
                <li key={i} className="mb-3">
                  <span aria-hidden="true" className="mr-2 text-white">
                    §&nbsp;1.{i + 1}
                  </span>
                  {p}
                </li>
              ))}
              <li className="theme-def mb-3">
                <span aria-hidden="true" className="mr-2 text-white">
                  §&nbsp;1.{defIndex}
                </span>
                <em className="not-italic text-white">Definitions.</em> “{settings.themeName}” means{' '}
                {phrases.map((p, i) => (
                  <span key={i}>
                    {i > 0 ? ' ' : null}
                    <span aria-hidden="true" className="text-subtle">
                      ({SUB[i]})&nbsp;
                    </span>
                    <span className="theme-phrase" data-theme-phrase>
                      {i === 0 ? lowerFirst(p) : p}
                    </span>
                  </span>
                ))}
              </li>
            </ol>
            {copy.themeFootnote ? (
              <p data-theme-foot className="fine-print mt-2 text-[0.5625rem] tracking-[0.18em]">
                <span className="text-[#ff4d63]">*</span> {copy.themeFootnote}
              </p>
            ) : null}
          </div>
        </div>
      </div>
      <ThemeMotion />
    </SectionShell>
  );
}
