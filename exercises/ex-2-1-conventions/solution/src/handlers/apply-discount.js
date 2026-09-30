import { AppError } from "../errors.js";
import { log } from "../log.js";

/**
 * @param {number} totalCents integer cents
 * @param {number} percent 0..100
 * @returns {number} discounted total in integer cents
 */
export function applyDiscountCents(totalCents, percent) {
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new AppError("E_INVALID_PERCENT", `Invalid percent: ${percent}`);
  }
  const discountedCents = Math.round(totalCents * (1 - percent / 100));
  log("info", "discount applied", { totalCents, percent, discountedCents });
  return discountedCents;
}
