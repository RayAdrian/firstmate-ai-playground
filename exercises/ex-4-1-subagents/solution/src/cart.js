// Cart maths. All money is integer centavos. A line item is { sku, priceCents, qty }.

export function subtotalCents(items) {
  return items.reduce((sum, item) => sum + item.priceCents * item.qty, 0);
}

// Take `percent` off `cents` (10 means 10% off), rounded to the nearest centavo.
export function applyDiscount(cents, percent) {
  return Math.round(cents * (1 - percent / 100));
}

// Orders of PHP 50.00 (5000 centavos) or more ship free. Empty carts ship nothing.
export function shippingCents(subtotal) {
  if (subtotal === 0) return 0;
  return subtotal >= 5000 ? 0 : 499;
}

// Shipping is decided on the discounted subtotal, not the original one.
export function totalCents(items, { discountPercent = 0 } = {}) {
  const sub = subtotalCents(items);
  const discounted = applyDiscount(sub, discountPercent);
  return discounted + shippingCents(discounted);
}

// 123450 -> "₱1,234.50"
export function formatPeso(cents) {
  const pesos = (cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `₱${pesos}`;
}
