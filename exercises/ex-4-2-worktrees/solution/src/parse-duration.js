// Feature B. See tests/parse-duration.test.js for the spec.
const UNIT_MS = { d: 86_400_000, h: 3_600_000, m: 60_000, s: 1_000 };

export function parseDuration(text) {
  if (typeof text !== "string") throw new TypeError("duration must be a string");
  const trimmed = text.trim();
  if (!/^(\d+[dhms]\s*)+$/.test(trimmed)) throw new RangeError(`invalid duration: "${text}"`);
  let total = 0;
  for (const [, n, unit] of trimmed.matchAll(/(\d+)([dhms])/g)) total += Number(n) * UNIT_MS[unit];
  return total;
}
