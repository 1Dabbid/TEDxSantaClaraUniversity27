/** Superscript footnote marker linking to a fine-print note, e.g. ¹. */
export function FootnoteMark({ n, href }: { n: number; href?: string }) {
  const cls = 'ml-[0.1em] align-super font-mono text-[0.3em] font-normal tracking-normal text-accent';
  const inner = (
    <>
      <span aria-hidden="true">{n}</span>
      <span className="sr-only"> (see note {n})</span>
    </>
  );
  return href ? (
    <a href={href} className={`${cls} no-underline hover:text-white`}>
      {inner}
    </a>
  ) : (
    <span className={cls}>{inner}</span>
  );
}
