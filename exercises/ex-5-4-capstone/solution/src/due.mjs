/** Validate a due date. Returns the same "YYYY-MM-DD" string, or throws RangeError. */
export function parseDue(input) {
  if (typeof input !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    throw new RangeError(`due date must look like YYYY-MM-DD, got ${JSON.stringify(input)}`);
  }
  const date = new Date(`${input}T00:00:00Z`);
  // Date rolls "2026-02-30" over to March, so compare the round trip.
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input) {
    throw new RangeError(`not a real calendar date: ${input}`);
  }
  return input;
}
