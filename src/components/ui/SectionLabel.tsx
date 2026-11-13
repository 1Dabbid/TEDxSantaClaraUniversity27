type Props = {
  /** Clause number, e.g. 1 renders "§ 01". */
  index: number;
  children: React.ReactNode;
  className?: string;
};

/** The fine-print caption that opens each section: "§ 01 — Speakers". */
export function SectionLabel({ index, children, className = '' }: Props) {
  return (
    <p className={`fine-print flex items-center gap-3 ${className}`}>
      <span aria-hidden="true" className="text-white">
        §&nbsp;{String(index).padStart(2, '0')}
      </span>
      <span aria-hidden="true" className="h-px w-8 bg-current opacity-50" />
      <span>{children}</span>
    </p>
  );
}
