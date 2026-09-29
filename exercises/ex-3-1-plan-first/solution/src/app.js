import http from "node:http";
import { items } from "./items.js";

const MAX_LIMIT = 100;

function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, { "content-type": "application/json", ...headers });
  res.end(JSON.stringify(body));
}

/** Parses a strictly positive integer query value. Returns null when it is not one. */
function parsePositiveInt(value) {
  return /^\d+$/.test(value) && Number(value) >= 1 ? Number(value) : null;
}

/**
 * Pagination applies only when `limit` is present, so existing callers that send no query
 * keep getting the full bare array. Returns { error } or { page, limit } (or null for "no pagination").
 */
function parsePagination(params) {
  if (!params.has("limit")) {
    return params.has("page") ? { error: "`page` requires `limit`" } : null;
  }
  const limit = parsePositiveInt(params.get("limit"));
  if (limit === null || limit > MAX_LIMIT) {
    return { error: `limit must be an integer between 1 and ${MAX_LIMIT}` };
  }
  const page = params.has("page") ? parsePositiveInt(params.get("page")) : 1;
  if (page === null) return { error: "page must be an integer >= 1" };
  return { page, limit };
}

export function createServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");

    if (req.method === "GET" && url.pathname === "/items") {
      const pagination = parsePagination(url.searchParams);
      if (pagination === null) return sendJson(res, 200, items);
      if ("error" in pagination) return sendJson(res, 400, { error: pagination.error });

      const { page, limit } = pagination;
      const start = (page - 1) * limit;
      return sendJson(res, 200, items.slice(start, start + limit), {
        "x-total-count": String(items.length),
        "x-total-pages": String(Math.ceil(items.length / limit)),
      });
    }

    const match = url.pathname.match(/^\/items\/(\d+)$/);
    if (req.method === "GET" && match) {
      const item = items.find((i) => i.id === Number(match[1]));
      return item ? sendJson(res, 200, item) : sendJson(res, 404, { error: "not found" });
    }

    return sendJson(res, 404, { error: "not found" });
  });
}
