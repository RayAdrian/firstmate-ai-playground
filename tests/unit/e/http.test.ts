// @vitest-environment node
import http from "node:http";
import type { AddressInfo } from "node:net";
import zlib from "node:zlib";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { fetchBytes, FetchError } from "../../../scripts/news/http";

vi.setConfig({ testTimeout: 30_000 }); // process-spawning tests can be slow on a busy machine

let server: http.Server;
let base: string;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const url = req.url ?? "/";
    if (url === "/ok") {
      res.writeHead(200, { "content-type": "application/xml" });
      res.end("<rss/>");
    } else if (url === "/500") {
      res.writeHead(500).end("no");
    } else if (url === "/404") {
      res.writeHead(404).end("no");
    } else if (url === "/slow") {
      setTimeout(() => res.writeHead(200).end("late"), 3000);
    } else if (url === "/loop-a") {
      res.writeHead(302, { location: "/loop-b" }).end();
    } else if (url === "/loop-b") {
      res.writeHead(302, { location: "/loop-a" }).end();
    } else if (url === "/big") {
      res.writeHead(200);
      res.end(Buffer.alloc(3 * 1024 * 1024, 65));
    } else if (url === "/bomb") {
      const gz = zlib.gzipSync(Buffer.alloc(64 * 1024 * 1024, 0));
      res.writeHead(200, { "content-encoding": "gzip" });
      res.end(gz);
    } else if (url === "/empty") {
      res.writeHead(200).end();
    } else {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => {
  server.closeAllConnections();
  server.close();
});

const opts = { timeoutMs: 1000, maxBytes: 1024 * 1024 };

describe("fetchBytes (I-1.3, TC-E-06/07)", () => {
  it("returns the body and content type", async () => {
    const res = await fetchBytes(`${base}/ok`, opts);
    expect(Buffer.from(res.bytes).toString()).toBe("<rss/>");
    expect(res.contentType).toContain("xml");
  });

  it.each([
    ["/500", "http 500"],
    ["/404", "http 404"],
    ["/slow", "timeout"],
    ["/loop-a", "redirect"],
    ["/big", "too large"],
    ["/bomb", "too large"],
  ])("%s fails with a %s class error", async (p, klass) => {
    const started = Date.now();
    await expect(fetchBytes(`${base}${p}`, opts)).rejects.toMatchObject({ name: "FetchError", reason: klass });
    expect(Date.now() - started).toBeLessThan(5000);
  });

  it("passes an empty 200 through (the parser reports it)", async () => {
    const res = await fetchBytes(`${base}/empty`, opts);
    expect(res.bytes.byteLength).toBe(0);
  });

  it("refuses non-http schemes", async () => {
    await expect(fetchBytes("file:///etc/passwd", opts)).rejects.toBeInstanceOf(FetchError);
  });
});
