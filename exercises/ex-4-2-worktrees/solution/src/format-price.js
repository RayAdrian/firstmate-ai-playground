// Feature A. See tests/format-price.test.js for the spec.
const SYMBOLS = { PHP: "₱", USD: "$" };

export function formatPrice(cents, { currency = "PHP" } = {}) {
  if (!Number.isInteger(cents)) throw new TypeError("cents must be an integer");
  const symbol = SYMBOLS[currency];
  if (symbol === undefined) throw new RangeError(`unsupported currency: ${currency}`);
  const amount = (Math.abs(cents) / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${cents < 0 ? "-" : ""}${symbol}${amount}`;
}
