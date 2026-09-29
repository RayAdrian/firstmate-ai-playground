import { formatMoney } from "./format.js";

/** @param {{ name: string, amountCents: number }[]} rows */
export function renderReport(rows) {
  const out = rows.map((row) => row.name.padEnd(12) + formatMoney(row.amountCents));
  const totalCents = rows.reduce((sum, row) => sum + row.amountCents, 0);
  out.push("-".repeat(20));
  out.push("TOTAL".padEnd(12) + formatMoney(totalCents));
  return out.join("\n") + "\n";
}
