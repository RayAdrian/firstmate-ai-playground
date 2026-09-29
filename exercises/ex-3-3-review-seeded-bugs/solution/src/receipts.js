/** Sends a receipt email (simulated). Rejects when the order has no usable email address. */
export async function sendReceipt(order) {
  if (!order.user_email || !order.user_email.includes("@")) {
    throw new Error(`cannot send receipt for order ${order.id}: bad email`);
  }
  return { sent: true, to: order.user_email };
}
