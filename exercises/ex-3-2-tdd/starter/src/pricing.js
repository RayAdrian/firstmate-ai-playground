/**
 * Prices an order. All amounts are integer cents. See README.md for the rules.
 * @param {{ sku: string, unitPriceCents: number, qty: number }[]} items
 * @param {{ tier?: "standard" | "gold", coupon?: string }} [options]
 * @returns {{
 *   subtotalCents: number, volumeDiscountCents: number, tierDiscountCents: number,
 *   couponDiscountCents: number, netCents: number, shippingCents: number,
 *   vatCents: number, totalCents: number
 * }}
 */
export function priceOrder(items, options = {}) {
  void items;
  void options;
  throw new Error("not implemented");
}
