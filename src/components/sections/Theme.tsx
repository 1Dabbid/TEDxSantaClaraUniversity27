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
 * - Motion, md+: a 250vh runway with a sticky stage. The clauses shrink to a 9px
 *   contract footer and, as you scroll, each phrase of the definition grows out
 *   of its exact spot in the small type until it fills the screen, then settles
 *   (ThemeMotion). A clause counter ticks in the corner. The loupe cursor reads
 *   the small type.
 * - Motion, mobile: natural height, masked line reveals.
 */
export function Theme({ settings }: { settings: Settings }) {
  const paras = paragraphs(settings.themeStory);
  const phrases = phrasesOf(settings.themeTagline);
  const defIndex = paras.length + 1;

  return (
    <SectionShell id="theme" scrim="none" className="theme-runway">
      <div data-theme-stage data-def-index={defIndex} className="theme-stage relative">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 scrim-left" />
        <div
          aria-hidden="true"
          data-theme-scrim
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_40%_50%,rgb(0_0_0/0.82),rgb(0_0_0/0.55)_70%)] opacity-0"
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
              Read the <span className="whitespace-nowrap">fine print.</span>
            </SectionTitle>
          </div>

          <p aria-hidden="true" data-theme-stack className="theme-stack my-16 md:my-20">
            {phrases.map((p, i) => (
              <span key={i} className="theme-line" data-theme-line>
                <span className="theme-line-inner" data-theme-line-inner>
                  {p}
                </span>
              </span>
            ))}
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
              <li className="mb-3">
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
            <p data-theme-foot className="fine-print mt-2 text-[0.5625rem] tracking-[0.18em]">
              <span className="text-accent">*</span> Read in full before proceeding. The details are binding.
            </p>
          </div>
        </div>
      </div>
      <ThemeMotion />
    </SectionShell>
  );
}
