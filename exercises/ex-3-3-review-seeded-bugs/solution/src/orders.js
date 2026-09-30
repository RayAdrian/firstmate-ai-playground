import { sendReceipt } from "./receipts.js";

/** All orders placed by one customer, oldest first. */
export function findOrdersByEmail(db, email) {
  return db.prepare("SELECT * FROM orders WHERE user_email = ? ORDER BY id").all(email);
}

/** One page of orders. Pages are 1-based: page 1 is the first `pageSize` orders. */
export function listOrders(db, { page = 1, pageSize = 10 } = {}) {
  if (!Number.isInteger(page) || page < 1) throw new RangeError("page must be an integer >= 1");
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new RangeError("pageSize must be an integer >= 1");
  const offset = (page - 1) * pageSize;
  return db.prepare("SELECT * FROM orders ORDER BY id LIMIT ? OFFSET ?").all(pageSize, offset);
}

/** Total after a percentage discount. Amounts are integer cents. */
export function discountedTotal(totalCents, percent) {
  return Math.round((totalCents * (100 - percent)) / 100);
}

/** Marks an order completed and emails the receipt. A failed email must not undo the order. */
export async function completeOrder(db, id) {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
  if (!order) throw new Error(`order ${id} not found`);

  db.prepare("UPDATE orders SET status = 'completed' WHERE id = ?").run(id);

  try {
    await sendReceipt(order);
  } catch (err) {
    console.error(`receipt failed for order ${id}`, err);
  }
  return { ...order, status: "completed" };
}

/** Refunds part or all of an order. The sum of all refunds may never exceed the order total. */
export function refundOrder(db, id, amountCents) {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
  if (!order) throw new Error(`order ${id} not found`);
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new RangeError("amountCents must be a positive integer");
  }
  const refundable = order.total_cents - order.refunded_cents;
  if (amountCents > refundable) {
    throw new RangeError(`refund exceeds the refundable amount (${refundable} cents)`);
  }

  db.prepare("UPDATE orders SET refunded_cents = refunded_cents + ? WHERE id = ?").run(amountCents, id);
  return db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
}
