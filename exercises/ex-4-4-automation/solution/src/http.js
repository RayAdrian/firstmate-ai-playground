// Response helpers. Every route handler returns one of these, never a bare object.
export const ok = (body) => ({ status: 200, body });
export const created = (body) => ({ status: 201, body });
export const badRequest = (message) => ({ status: 400, body: { error: message } });
export const notFound = (message = "Not found") => ({ status: 404, body: { error: message } });
