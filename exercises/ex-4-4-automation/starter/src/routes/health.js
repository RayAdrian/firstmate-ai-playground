import { ok } from "../http.js";

export const path = "/health";

export async function handler() {
  return ok({ status: "up" });
}
