import http from "node:http";
import { items } from "./items.js";

function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

export function createServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");

    if (req.method === "GET" && url.pathname === "/items") {
      // Today: returns every item as a bare JSON array. Existing clients rely on this.
      return sendJson(res, 200, items);
    }

    const match = url.pathname.match(/^\/items\/(\d+)$/);
    if (req.method === "GET" && match) {
      const item = items.find((i) => i.id === Number(match[1]));
      return item ? sendJson(res, 200, item) : sendJson(res, 404, { error: "not found" });
    }

    return sendJson(res, 404, { error: "not found" });
  });
}
