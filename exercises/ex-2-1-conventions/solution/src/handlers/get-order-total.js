import { AppError } from "../errors.js";
import { log } from "../log.js";

/**
 * @param {{ priceCents: number, qty: number }[]} items
 * @returns {number} total in integer cents
 */
export function getOrderTotalCents(items) {
  let totalCents = 0;
  for (const item of items) {
    if (!Number.isInteger(item.qty) || item.qty < 1) {
      throw new AppError("E_INVALID_QTY", `Invalid quantity: ${item.qty}`);
    }
    totalCents += item.priceCents * item.qty;
  }
  log("info", "order total computed", { totalCents });
  return totalCents;
}
