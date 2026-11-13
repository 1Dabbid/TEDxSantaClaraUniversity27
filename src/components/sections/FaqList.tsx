import type { ReactNode } from 'react';
import type { FaqItem } from '@/lib/content';

/**
 * The FAQ clauses: native <details>/<summary>, so they work without JavaScript,
 * are keyboard operable (Enter/Space) and are announced as expandable. Shared by
 * the home FAQ section and /faq.
 *
 * `ids` (on /faq only): each question gets its own address (`/faq#<id>`, ids from
 * lib/faq-ids.ts) and a "Link to this question" anchor under its answer. The home
 * section leaves them out, so the page never has two elements with one id. The
 * linked question is marked with `data-linked` (FaqHashOpen), not `:target`, which
 * the motion engine's pushState navigation never updates.
 */
const answer = (text: string) => (
  <p className="min-w-0 max-w-2xl leading-relaxed whitespace-pre-line text-mute [overflow-wrap:anywhere] sm:text-lg">{linkify(text)}</p>
);

/** A full https:// address in an answer, minus trailing punctuation that ends the sentence. */
const URL_IN_TEXT = /(https:\/\/[^\s<>"]+[^\s<>".,;:!?)\]])/;

/**
 * Answers are plain text; a full https:// address typed in one becomes a link
 * (new tab, announced), shown without the https:// prefix. Nothing else is
 * interpreted, and only https links are ever made.
 */
export function linkify(text: string): ReactNode {
  const parts = text.split(URL_IN_TEXT);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        data-faq-link
        className="text-white underline decoration-white/40 underline-offset-[0.2em] hover:decoration-white focus-visible:decoration-white"
      >
        {part.replace(/^https:\/\//, '').replace(/\/$/, '')}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    ) : (
      part
    ),
  );
}

export function FaqList({ items, ids, className = '' }: { items: FaqItem[]; ids?: string[]; className?: string }) {
  return (
    <ol data-reveal="stagger" className={`min-w-0 border-t border-white/15 ${className}`}>
      {items.map((item, i) => {
        const id = ids?.[i];
        return (
          <li key={i} id={id} className="min-w-0 border-b border-white/15 data-linked:border-b-accent">
            <details className="faq-clause group">
              <summary
                className="group/q grid min-h-11 cursor-pointer list-none grid-cols-[2.5rem_minmax(0,1fr)_2rem] items-baseline gap-2 py-6 text-lg font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-[-2px] sm:grid-cols-[4rem_minmax(0,1fr)_2.5rem] sm:text-2xl sm:tracking-tight [&::-webkit-details-marker]:hidden"
              >
                <span
                  aria-hidden="true"
                  className="fine-print text-mute tabular-nums transition-colors duration-300 group-hover/q:text-white group-open:text-white"
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                {/* overflow-wrap: the long event name must not push the page sideways at 320px. */}
                <span className="min-w-0 text-balance [overflow-wrap:anywhere] transition-transform duration-500 ease-[var(--ease-cinema)] pointer-fine:group-hover/q:translate-x-1">
                  {item.question}
                </span>
                {/* Plus that turns into a minus: shape change, not colour. */}
                <span
                  aria-hidden="true"
                  className="relative ml-auto block size-4 self-center text-mute transition-colors duration-300 group-hover/q:text-white group-open:text-white"
                >
                  <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-current" />
                  <span className="faq-icon-v absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-current" />
                </span>
              </summary>
              <div className="faq-answer grid grid-cols-[2.5rem_minmax(0,1fr)_2rem] gap-2 pb-8 sm:grid-cols-[4rem_minmax(0,1fr)_2.5rem]">
                <span aria-hidden="true" />
                {id ? (
                  <div className="min-w-0">
                    {answer(item.answer)}
                    <a
                      href={`#${id}`}
                      data-faq-permalink
                      className="fine-print link-draw tap mt-4 inline-flex min-h-11 items-center text-mute hover:text-white focus-visible:text-white pointer-fine:min-h-0 pointer-fine:py-1"
                    >
                      Link to this question<span className="sr-only tracking-normal normal-case">: {item.question}</span>
                    </a>
                  </div>
                ) : (
                  answer(item.answer)
                )}
              </div>
            </details>
          </li>
        );
      })}
    </ol>
  );
}
