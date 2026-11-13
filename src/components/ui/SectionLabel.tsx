type Props = {
  /**
   * Clause number, e.g. 1 renders "§ 01". Only the five sections of the event
   * itself (theme to tickets) are numbered; the closing sections on black
   * (partners, team, FAQ, mailing list) carry a plain caption.
   */
  index?: number;
  children: React.ReactNode;
  className?: string;
  /** Fade in through the global reveal system (default true). */
  reveal?: boolean;
};

/** The fine-print caption that opens each section: "§ 01 — Speakers". */
export function SectionLabel({ index, children, className = '', reveal = true }: Props) {
  return (
    <p data-reveal={reveal ? 'fade' : undefined} className={`fine-print flex items-center gap-3 ${className}`}>
      {index !== undefined ? (
        <>
          <span aria-hidden="true" className="text-white">
            §&nbsp;{String(index).padStart(2, '0')}
          </span>
          <span aria-hidden="true" className="h-px w-8 bg-current opacity-50" />
        </>
      ) : (
        <span aria-hidden="true" className="h-px w-8 bg-accent" />
      )}
      <span>{children}</span>
    </p>
  );
}
