// Legacy monolith: parsing, money formatting and rendering are tangled together.
// The task is to split it into parse.js, format.js and render.js WITHOUT changing
// what generateReport(csv) returns.
export function generateReport(csv) {
  const lines = csv.trim().split("\n").slice(1);
  const rows = [];
  for (const line of lines) {
    const [name, amount] = line.split(",");
    rows.push({ name: name.trim(), amountCents: Number(amount) });
  }

  let totalCents = 0;
  const out = [];
  for (const row of rows) {
    const dollars = Math.floor(row.amountCents / 100);
    const cents = String(row.amountCents % 100).padStart(2, "0");
    out.push(row.name.padEnd(12) + "$" + dollars + "." + cents);
    totalCents += row.amountCents;
  }

  out.push("-".repeat(20));
  const totalDollars = Math.floor(totalCents / 100);
  const totalRest = String(totalCents % 100).padStart(2, "0");
  out.push("TOTAL".padEnd(12) + "$" + totalDollars + "." + totalRest);
  return out.join("\n") + "\n";
}
