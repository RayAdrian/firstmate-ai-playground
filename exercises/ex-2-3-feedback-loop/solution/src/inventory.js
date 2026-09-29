// @ts-check

/** @typedef {{ sku: string, qty: number }} Item */

/**
 * @param {Item[]} items
 * @param {string} sku
 * @returns {Item | undefined}
 */
export function findItem(items, sku) {
  return items.find((i) => i.sku === sku);
}

/** @param {Item[]} items @returns {number} */
export function totalQty(items) {
  let total = 0;
  for (const item of items) {
    total += item.qty;
  }
  return total;
}
