export interface DateRange {
  /** Inclusive, YYYY-MM-DD. */
  start: string;
  /** Inclusive, YYYY-MM-DD. */
  end: string;
}

export function parseDateRange(input: string, today: string): DateRange {
  throw new Error(`not implemented: parseDateRange(${JSON.stringify(input)}, ${JSON.stringify(today)})`);
}
