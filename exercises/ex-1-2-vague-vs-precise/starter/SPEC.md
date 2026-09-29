# parseDateRange spec

`parseDateRange(input: string, today: string): { start: string; end: string }` in `src/parseDateRange.ts`.

## Types and time

- All dates are `YYYY-MM-DD` strings. `start` and `end` are both **inclusive**.
- `today` is passed in as a `YYYY-MM-DD` string. Never read the system clock or the local time zone.
- No new dependencies.

## Accepted inputs

Input is trimmed, matched case-insensitively, and any run of whitespace counts as one space.

| Form | Meaning |
|---|---|
| `<date> to <date>` | that range, e.g. `2026-03-01 to 2026-03-15` |
| `<date>` | a one-day range: `start` equals `end` |
| `last <N> days` (or `last 1 day`) | the `N` days ending today, today included. `last 7 days` on `2026-03-03` is `2026-02-25` to `2026-03-03` |
| `this month` | the first to the last day of the month that contains `today`, leap years included |

## Errors

Every failure throws a `RangeError` with exactly this message:

| Situation | Message |
|---|---|
| A date that does not exist on the calendar (`2026-02-30`, `2026-13-01`, `2027-02-29`) | `invalid date: <the date text>` |
| `start` is after `end` (equal is allowed) | `start is after end` |
| `last 0 days` | `invalid day count: must be at least 1` |
| Anything else, including the empty string | `unrecognized range: <the original input>` |
