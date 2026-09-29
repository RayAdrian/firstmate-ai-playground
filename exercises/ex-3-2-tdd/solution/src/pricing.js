const VAT_PERCENT = 12;
const FREE_SHIPPING_MIN_NET_CENTS = 5000;
const SHIPPING_CENTS = 499;
const COUPONS = { WELCOME500: { offCents: 500, minNetCents: 2000 } };
const TIER_PERCENT = { standard: 0, gold: 5 };

/** Integer percent of an integer cent amount, rounded half up. */
function percentOf(cents, percent) {
  return Math.round((cents * percent) / 100);
}

function volumePercent(qty) {
  if (qty >= 50) return 20;
  if (qty >= 10) return 10;
  return 0;
}

function validate(items, tier) {
  if (!(tier in TIER_PERCENT)) throw new RangeError(`Unknown tier: ${tier}`);
  for (const item of items) {
    if (!Number.isInteger(item.unitPriceCents) || item.unitPriceCents < 0) {
      throw new RangeError(`unitPriceCents must be a non-negative integer (sku ${item.sku})`);
    }
    if (!Number.isInteger(item.qty) || item.qty < 1) {
      throw new RangeError(`qty must be an integer >= 1 (sku ${item.sku})`);
    }
  }
}

/**
 * Prices an order. All amounts are integer cents.
 * @param {{ sku: string, unitPriceCents: number, qty: number }[]} items
 * @param {{ tier?: "standard" | "gold", coupon?: string }} [options]
 */
export function priceOrder(items, options = {}) {
  const { tier = "standard", coupon } = options;
  validate(items, tier);

  let subtotalCents = 0;
  let volumeDiscountCents = 0;
  for (const { unitPriceCents, qty } of items) {
    const lineTotal = unitPriceCents * qty;
    subtotalCents += lineTotal;
    volumeDiscountCents += percentOf(lineTotal, volumePercent(qty));
  }

  const afterVolume = subtotalCents - volumeDiscountCents;
  const tierDiscountCents = percentOf(afterVolume, TIER_PERCENT[tier]);
  const beforeCoupon = afterVolume - tierDiscountCents;

  let couponDiscountCents = 0;
  if (coupon !== undefined) {
    const rule = COUPONS[coupon];
    if (!rule) throw new Error(`Unknown coupon: ${coupon}`);
    if (beforeCoupon >= rule.minNetCents) couponDiscountCents = rule.offCents;
  }

  const netCents = beforeCoupon - couponDiscountCents;
  const shippingCents = items.length === 0 || netCents >= FREE_SHIPPING_MIN_NET_CENTS ? 0 : SHIPPING_CENTS;
  const vatCents = percentOf(netCents, VAT_PERCENT);

  return {
    subtotalCents,
    volumeDiscountCents,
    tierDiscountCents,
    couponDiscountCents,
    netCents,
    shippingCents,
    vatCents,
    totalCents: netCents + shippingCents + vatCents,
  };
}
