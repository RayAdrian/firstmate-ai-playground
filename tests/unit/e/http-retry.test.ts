// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { fetchBytesWithRetry, FetchError } from "../../../scripts/news/http";
import { fetchSource } from "../../../scripts/news/fetch-source";
import type { SourceConfig } from "../../../scripts/news/sources";

const ok = () => new Response("<rss/>", { status: 200, headers: { "content-type": "application/xml" } });
const status = (n: number) => () => new Response("no", { status: n });

function setup(responses: Array<() => Response>) {
  const calls: string[] = [];
  const fetchImpl = vi.fn(async (input: string | URL | Request) => {
    calls.push(String(input));
    const next = responses[Math.min(calls.length - 1, responses.length - 1)]!;
    return next();
  }) as unknown as typeof fetch;
  const sleeps: number[] = [];
  const infos: string[] = [];
  return {
    calls,
    sleeps,
    infos,
    fetchImpl,
    deps: { sleep: async (ms: number) => void sleeps.push(ms), log: { info: (m: string) => void infos.push(m) } },
  };
}

const YT = "https://www.youtube.com/feeds/videos.xml?channel_id=UC123";
const OTHER = "https://example.com/feed.xml";

describe("fetchBytesWithRetry", () => {
  it("succeeds on the 2nd attempt after a YouTube 404, logging one INFO retry", async () => {
    const t = setup([status(404), ok]);
    const res = await fetchBytesWithRetry(YT, { fetchImpl: t.fetchImpl }, t.deps);
    expect(Buffer.from(res.bytes).toString()).toBe("<rss/>");
    expect(t.calls).toHaveLength(2);
    expect(t.sleeps).toEqual([1000]);
    expect(t.infos).toHaveLength(1);
    expect(t.infos[0]).toContain("http 404");
  });

  it("retries a 5xx on any host", async () => {
    const t = setup([status(503), ok]);
    await fetchBytesWithRetry(OTHER, { fetchImpl: t.fetchImpl }, t.deps);
    expect(t.calls).toHaveLength(2);
  });

  it("does not retry a 404 on a non-YouTube host", async () => {
    const t = setup([status(404), ok]);
    await expect(fetchBytesWithRetry(OTHER, { fetchImpl: t.fetchImpl }, t.deps)).rejects.toMatchObject({ reason: "http 404" });
    expect(t.calls).toHaveLength(1);
    expect(t.sleeps).toEqual([]);
    expect(t.infos).toEqual([]);
  });

  it("does not retry other 4xx on YouTube", async () => {
    const t = setup([status(403), ok]);
    await expect(fetchBytesWithRetry(YT, { fetchImpl: t.fetchImpl }, t.deps)).rejects.toBeInstanceOf(FetchError);
    expect(t.calls).toHaveLength(1);
  });

  it("gives up after 3 attempts with backoff 1s then 3s", async () => {
    const t = setup([status(500)]);
    await expect(fetchBytesWithRetry(YT, { fetchImpl: t.fetchImpl }, t.deps)).rejects.toMatchObject({ reason: "http 500" });
    expect(t.calls).toHaveLength(3);
    expect(t.sleeps).toEqual([1000, 3000]);
    expect(t.infos).toHaveLength(2);
  });
});

describe("fetchSource retry wiring", () => {
  it("rejects after 3 failures so the pipeline logs the ERROR once", async () => {
    const t = setup([status(404)]);
    const source = { slug: "yt", type: "rss", url: YT } as unknown as SourceConfig;
    await expect(fetchSource(source, { fetchImpl: t.fetchImpl }, t.deps)).rejects.toMatchObject({ reason: "http 404" });
    expect(t.calls).toHaveLength(3);
  });
});
