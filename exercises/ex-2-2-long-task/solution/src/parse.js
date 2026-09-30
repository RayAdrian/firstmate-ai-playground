/**
 * @param {string} csv header line + "name,amountCents" rows
 * @returns {{ name: string, amountCents: number }[]}
 */
export function parseRows(csv) {
  return csv
    .trim()
    .split("\n")
    .slice(1)
    .map((line) => {
      const [name, amount] = line.split(",");
      return { name: name.trim(), amountCents: Number(amount) };
    });
}
