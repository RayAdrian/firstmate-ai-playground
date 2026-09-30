/** @param {number} cents integer cents @returns {string} e.g. "$49.99" */
export function formatMoney(cents) {
  const dollars = Math.floor(cents / 100);
  const rest = String(cents % 100).padStart(2, "0");
  return "$" + dollars + "." + rest;
}
