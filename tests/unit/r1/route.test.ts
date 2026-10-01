// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const server = vi.hoisted(() => {
  class CommunityError extends Error {
    constructor(readonly code: string) {
      super(code);
    }
  }
  return {
    CommunityError,
    writeStar: vi.fn(async () => undefined),
    writeReaction: vi.fn(async () => undefined),
    writeName: vi.fn(async () => undefined),
    readMine: vi.fn(async () => [{ slug: "wf", starred: true, reactions: ["worked"] }]),
    readMyStars: vi.fn(async () => [{ slug: "wf", removed: false }]),
  };
});
vi.mock("@/lib/community/server", () => server);

import { POST } from "@/app/api/community/route";

const CLIENT = "aaaaaaaa-0000-4000-8000-000000000001";
const HOST = "localhost:3000";

function post(body: unknown, headers: Record<string, string> = {}): Promise<Response> {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  return POST(
    new Request(`http://${HOST}/api/community`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: `http://${HOST}`, host: HOST, ...headers },
      body: raw,
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("CM-8 the route is narrow", () => {
  it("rejects a cross-site or origin-less post with 403, before touching the database", async () => {
    expect((await post({ op: "myStars", clientId: CLIENT }, { origin: "https://evil.example" })).status).toBe(403);
    const noOrigin = new Request(`http://${HOST}/api/community`, {
      method: "POST",
      headers: { "content-type": "application/json", host: HOST },
      body: "{}",
    });
    expect((await POST(noOrigin)).status).toBe(403);
    expect(server.readMyStars).not.toHaveBeenCalled();
  });

  it("accepts only application/json (form posts are 415)", async () => {
    const res = await post("op=star", { "content-type": "application/x-www-form-urlencoded" });
    expect(res.status).toBe(415);
    expect(await res.json()).toEqual({ error: "unsupported_media_type" });
  });

  it("refuses a body over 2 KB with 413 before parsing", async () => {
    const res = await post({ op: "name", clientId: CLIENT, displayName: "x".repeat(2100) });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "payload_too_large" });
    expect(server.writeName).not.toHaveBeenCalled();
  });

  it("enforces the cap on a streamed body with no content-length", async () => {
    const chunk = new TextEncoder().encode("x".repeat(1500));
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(chunk);
        c.enqueue(chunk);
        c.close();
      },
    });
    const req = new Request(`http://${HOST}/api/community`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: `http://${HOST}`, host: HOST },
      body: stream,
      // @ts-expect-error duplex is required by undici for stream bodies
      duplex: "half",
    });
    expect((await POST(req)).status).toBe(413);
  });

  it("rejects unknown keys, bad ids and bad json with 400", async () => {
    expect((await post({ op: "star", clientId: CLIENT, slug: "wf", on: true, extra: 1 })).status).toBe(400);
    expect((await post({ op: "star", clientId: "nope", slug: "wf", on: true })).status).toBe(400);
    expect((await post({ op: "react", clientId: CLIENT, slug: "wf", reaction: "boom", on: true })).status).toBe(400);
    expect((await post({ op: "star", clientId: CLIENT, slug: "Not A Slug", on: true })).status).toBe(400);
    expect((await post("{not json")).status).toBe(400);
    expect(server.writeStar).not.toHaveBeenCalled();
  });

  it("calls exactly one function per request with the desired state", async () => {
    expect((await post({ op: "star", clientId: CLIENT, slug: "wf", on: false })).status).toBe(200);
    expect(server.writeStar).toHaveBeenCalledWith("wf", CLIENT, false);

    await post({ op: "react", clientId: CLIENT, slug: "wf", reaction: "worked", on: true, displayName: "  Rafael ​ " });
    expect(server.writeReaction).toHaveBeenCalledWith("wf", CLIENT, "worked", true, "Rafael");

    await post({ op: "name", clientId: CLIENT, displayName: "   " });
    expect(server.writeName).toHaveBeenCalledWith(CLIENT, null);

    const mine = await post({ op: "mine", clientId: CLIENT, slugs: ["wf"] });
    expect(await mine.json()).toEqual({ ok: true, mine: [{ slug: "wf", starred: true, reactions: ["worked"] }] });
    const stars = await post({ op: "myStars", clientId: CLIENT });
    expect(await stars.json()).toEqual({ ok: true, stars: [{ slug: "wf", removed: false }] });

    expect(server.writeStar).toHaveBeenCalledTimes(1);
    expect(server.writeReaction).toHaveBeenCalledTimes(1);
    expect(server.writeName).toHaveBeenCalledTimes(1);
  });

  it("refuses a name over 40 characters and a mine list over 100 slugs", async () => {
    expect((await post({ op: "name", clientId: CLIENT, displayName: "y".repeat(41) })).status).toBe(400);
    const slugs = Array.from({ length: 101 }, () => "a");
    expect((await post({ op: "mine", clientId: CLIENT, slugs })).status).toBe(400);
    expect((await post({ op: "mine", clientId: CLIENT, slugs: slugs.slice(1) })).status).toBe(200);
  });

  it("maps database codes to JSON errors and never echoes the input", async () => {
    server.writeStar.mockRejectedValueOnce(new server.CommunityError("workflow_unavailable"));
    const gone = await post({ op: "star", clientId: CLIENT, slug: "some-slug", on: true });
    expect(gone.status).toBe(404);
    expect(await gone.json()).toEqual({ error: "workflow_unavailable" });

    server.writeReaction.mockRejectedValueOnce(new server.CommunityError("rate_limited"));
    const limited = await post({ op: "react", clientId: CLIENT, slug: "wf", reaction: "worked", on: true, displayName: "<img src=x>" });
    expect(limited.status).toBe(429);
    const text = await limited.text();
    expect(text).toBe('{"error":"rate_limited"}');
    expect(text).not.toContain("img");

    server.writeStar.mockRejectedValueOnce(new Error("connection refused 127.0.0.1"));
    const down = await post({ op: "star", clientId: CLIENT, slug: "wf", on: true });
    expect(down.status).toBe(503);
    expect(await down.json()).toEqual({ error: "unavailable" });
  });

  it("sends no-store JSON on every response", async () => {
    const ok = await post({ op: "myStars", clientId: CLIENT });
    expect(ok.headers.get("content-type")).toContain("application/json");
    expect(ok.headers.get("cache-control")).toBe("no-store");
    const bad = await post("{", { origin: "https://evil.example" });
    expect(bad.headers.get("content-type")).toContain("application/json");
  });
});

describe("CM-9 per-IP limit (production only)", () => {
  it("allows 120 requests a minute per IP, then 429s; another IP is unaffected; skipped outside production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const body = { op: "myStars", clientId: CLIENT };
    const ip = { "x-real-ip": "203.0.113.7" };
    for (let i = 0; i < 120; i++) expect((await post(body, ip)).status).toBe(200);
    const blocked = await post(body, ip);
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: "rate_limited" });
    expect((await post(body, { "x-real-ip": "203.0.113.8" })).status).toBe(200);
    // The body cannot pick the bucket (an `ip` key is not even in the schema): the blocked IP stays blocked.
    expect((await post({ ...body, ip: "203.0.113.9" }, ip)).status).toBe(429);

    vi.stubEnv("NODE_ENV", "test");
    expect((await post(body, ip)).status).toBe(200);
  });
});
