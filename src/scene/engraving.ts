/**
 * Copy laser-etched around the microphone barrel.
 *
 * Edit freely. Rows are listed from the top of the engraved band (nearest the
 * grille) to the bottom (nearest the knurled grip). Each row wraps the full
 * circumference: its phrases are laid out left to right, repeated until the
 * ring is full, and justified so the seam falls between two phrases.
 *
 * Rules: always spell the name in full ("TEDxSantaClaraUniversity"), no logo
 * lockups, no claims or invented facts. Filler lines are neutral legalese
 * about ideas and details.
 */

export type EngravingRow =
  | { kind: 'rule' }
  | {
      kind: 'text';
      /** 'title' large spaced caps, 'label' medium caps, 'body' small monospace. */
      style: 'title' | 'label' | 'body';
      phrases: readonly string[];
    };

export const EVENT_NAME = 'TEDxSantaClaraUniversity';
export const THEME = 'FINE PRINT';
export const DATE_LINE = 'FRIDAY · APRIL 23 · 2027';
export const VENUE_LINE = 'LOCATELLI STUDENT ACTIVITY CENTER';
export const SEATS_LINE = '100 SEATS';
export const LICENSE_LINE = 'THIS INDEPENDENT TEDx EVENT IS OPERATED UNDER LICENSE FROM TED';

/** Numbered clauses. Neutral filler: ideas, details, attention. */
export const CLAUSES: readonly string[] = [
  '§ 01  THE SPEAKER AGREES THAT EVERY IDEA IS PRESENTED AS IS, WITH ALL OF ITS DETAILS INCLUDED.',
  '§ 02  THE LISTENER RESERVES THE RIGHT TO REREAD ANY CLAUSE, AT ANY TIME, FOR ANY REASON.',
  '§ 03  NOTHING SET IN SMALL TYPE IS SMALL BY NATURE. SIZE IS NOT A MEASURE OF CONSEQUENCE.',
  '§ 04  ASSUMPTIONS SHALL BE STATED PLAINLY, EXAMINED CAREFULLY AND, WHERE NECESSARY, REVISED.',
  '§ 05  THE ATTENDEE ACKNOWLEDGES THAT OUTCOMES ARE OFTEN DECIDED IN THE FOOTNOTES.',
  '§ 06  QUESTIONS ARE WELCOME AND DO NOT VOID OR OTHERWISE AMEND THIS AGREEMENT.',
  '§ 07  EACH DETAIL REMAINS IN FULL FORCE UNTIL SOMEONE TAKES THE TIME TO NOTICE IT.',
  '§ 08  ATTENTION IS THE ONLY CONSIDERATION REQUIRED FROM EITHER PARTY.',
  '§ 09  CURIOSITY SURVIVES THE TERM OF THIS EVENING AND ANY RENEWAL THEREOF.',
];

const FILLER: readonly string[] = [
  'TERMS AND CONDITIONS APPLY. THEY ARE THE WHOLE POINT.',
  'READ CAREFULLY BEFORE SPEAKING. READ AGAIN AFTER LISTENING.',
  'THE ASTERISK IS PART OF THE SENTENCE.',
  'SMALL DECISIONS, REPEATED, BECOME LARGE ONES.',
  'WHAT IS OVERLOOKED IS NOT THEREBY WAIVED.',
  'HEADINGS ARE FOR CONVENIENCE ONLY. THE DETAIL GOVERNS.',
  'AN IDEA MAY BE SHARED WITHOUT LIMIT AND IS NOT DIMINISHED BY SHARING.',
  'IN CASE OF DOUBT, LOOK CLOSER.',
];

const body = (...phrases: string[]): EngravingRow => ({ kind: 'text', style: 'body', phrases });

/** Content facts engraved on the barrel; every field defaults to the constants above. */
export type EngravingFacts = {
  eventName: string;
  theme: string;
  dateLine: string;
  venueLine: string;
  seatsLine: string;
  licenseLine: string;
};

export const DEFAULT_FACTS: EngravingFacts = {
  eventName: EVENT_NAME,
  theme: THEME,
  dateLine: DATE_LINE,
  venueLine: VENUE_LINE,
  seatsLine: SEATS_LINE,
  licenseLine: LICENSE_LINE,
};

/** The engraved rows for a set of facts (missing fields use the defaults above). */
export function engravingRows(facts: Partial<EngravingFacts> = {}): readonly EngravingRow[] {
  const f = { ...DEFAULT_FACTS, ...facts };
  return [
    { kind: 'rule' },
    { kind: 'text', style: 'title', phrases: [f.eventName, f.theme] },
    { kind: 'rule' },
    { kind: 'text', style: 'label', phrases: [f.dateLine, f.venueLine, f.seatsLine] },
    body(CLAUSES[0], FILLER[0]),
    body(CLAUSES[1], FILLER[1]),
    body(CLAUSES[2], FILLER[2]),
    body(CLAUSES[3], FILLER[3]),
    body(CLAUSES[4], FILLER[4]),
    { kind: 'text', style: 'label', phrases: [f.licenseLine, f.eventName] },
    body(CLAUSES[5], FILLER[5]),
    body(CLAUSES[6], FILLER[6]),
    body(CLAUSES[7], FILLER[7]),
    body(CLAUSES[8], FILLER[0]),
    body(FILLER[1], CLAUSES[0]),
    { kind: 'text', style: 'label', phrases: [f.theme, f.dateLine, f.venueLine] },
    body(FILLER[3], CLAUSES[2]),
    body(FILLER[5], CLAUSES[4]),
    body(FILLER[6], CLAUSES[6]),
    body(FILLER[7], CLAUSES[8]),
    { kind: 'rule' },
    { kind: 'text', style: 'title', phrases: [f.theme, f.eventName] },
    { kind: 'rule' },
  ];
}

export const ENGRAVING_ROWS: readonly EngravingRow[] = engravingRows();

/** Separator drawn between repeated phrases. */
export const ENGRAVING_SEPARATOR = '   ·   ';
