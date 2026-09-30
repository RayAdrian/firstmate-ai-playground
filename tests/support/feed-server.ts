import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";

export type FeedRoute = { status?: number; delayMs?: number; contentType?: string };

/**
 * Tiny local HTTP server serving files from `dir` (for example tests/fixtures/feeds).
 * Per-path status, delay and content type via `set(path, route)`. Random port unless
 * `port` is given. Always `await close()` in teardown.
 */
export async function startFeedServer(dir: string, port = 0) {
  const root = path.resolve(dir);
  const routes = new Map<string, FeedRoute>();
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0]);
    const route = routes.get(urlPath) ?? {};
    const file = path.join(root, path.normalize(urlPath));
    const send = () => {
      const ok = file.startsWith(root) && fs.existsSync(file) && fs.statSync(file).isFile();
      if (!ok) {
        res.writeHead(route.status ?? 404).end();
        return;
      }
      res.writeHead(route.status ?? 200, { "content-type": route.contentType ?? "application/xml" });
      res.end(fs.readFileSync(file));
    };
    if (route.delayMs) setTimeout(send, route.delayMs);
    else send();
  });
  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    set: (p: string, route: FeedRoute) => void routes.set(p, route),
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
