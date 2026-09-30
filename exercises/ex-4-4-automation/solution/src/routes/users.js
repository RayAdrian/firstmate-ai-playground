import { ok, badRequest, notFound } from "../http.js";

export const path = "/users";

const USERS = [
  { id: "u-1", name: "Ana Reyes" },
  { id: "u-2", name: "Ben Cruz" },
];

export async function handler(req) {
  const id = req.query?.id;
  if (!id) return badRequest("id is required");
  const user = USERS.find((u) => u.id === id);
  if (!user) return notFound(`no user ${id}`);
  return ok(user);
}
