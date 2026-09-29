// @ts-check

/** @typedef {{ sku: string, qty: number }} Item */

/**
 * @param {Item[]} items
 * @param {string} sku
 * @returns {Item}
 */
export function findItem(items, sku) {
  return items.find((i) => i.sku === sku);
}

/** @param {any[]} items @returns {number} */
export function totalQty(items) {
  var total = 0;
  for (const item of items) {
    if (item.qty != null) total += item.qty;
  }
  return total;
}
