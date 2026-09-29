import { ok, badRequest } from "../http.js";

export const path = "/orders";

const ORDERS = [
  { id: "o-1", customer: "c-1", totalCents: 129900 },
  { id: "o-2", customer: "c-1", totalCents: 4500 },
  { id: "o-3", customer: "c-2", totalCents: 80000 },
];

export async function handler(req) {
  const customer = req.query?.customer;
  if (!customer) return badRequest("customer is required");
  return ok(ORDERS.filter((o) => o.customer === customer));
}
