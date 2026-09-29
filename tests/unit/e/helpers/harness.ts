import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ClaudeResult, ClaudeRunner } from "../../../../scripts/news/claude";
import { FetchError } from "../../../../scripts/news/http";
import type { RawFeedItem } from "../../../../scripts/news/feed";
import { silentLogger } from "../../../../scripts/news/log";
import { runPipeline, type PipelineDeps, type PipelineOptions, type PipelineResult } from "../../../../scripts/news/pipeline";
import type { SourceConfig } from "../../../../scripts/news/sources";
import type { Logger } from "../../../../scripts/news/types";
import { MemoryStore } from "./memory-store";

export const NOW = new Date("2026-09-30T08:00:00+08:00");

export function src(slug: string, extra: Partial<SourceConfig> = {}): SourceConfig {
  return { name: slug, slug, url: `https://${slug}.example/feed.xml`, type: "rss", enabled: true, filters: {}, ...extra };
}

export function raw(n: number, over: Partial<RawFeedItem> = {}, prefix = "p"): RawFeedItem {
  return {
    guid: `${prefix}-guid-${n}`,
    link: `https://site.example/${prefix}/${n}`,
    title: `Item ${prefix} ${n}`,
    author: null,
    published: "2026-09-29T00:00:00Z",
    excerpt: `Excerpt ${n}`,
    ...over,
  };
}

export const rawMany = (count: number, prefix = "p", over: Partial<RawFeedItem> = {}) => Array.from({ length: count }, (_, i) => raw(i + 1, over, prefix));

export type FeedMap = Record<string, RawFeedItem[] | Error>;

export function fetcher(feeds: FeedMap) {
  const calls: string[] = [];
  const fn = async (s: SourceConfig): Promise<RawFeedItem[]> => {
    calls.push(s.slug);
    const v = feeds[s.slug];
    if (v === undefined) return [];
    if (v instanceof Error) throw v;
    return v;
  };
  return { fn, calls };
}

export const httpError = (code: number) => new FetchError(`http ${code}` as `http ${number}`);

export interface FakeClaude {
  run: ClaudeRunner;
  calls: Array<{ system: string; user: string; ids: string[] }>;
}

/** A scripted ClaudeRunner: `respond` gets the batch ids and the 1-based call number. */
export function fakeClaude(respond: (ids: string[], call: number) => ClaudeResult): FakeClaude {
  const calls: FakeClaude["calls"] = [];
  const run: ClaudeRunner = async (prompt) => {
    const ids = [...prompt.user.matchAll(/<<<BEGIN_ITEM_[0-9a-f]+ id="([^"]+)">>>/g)].map((m) => m[1]);
    calls.push({ ...prompt, ids });
    return respond(ids, calls.length);
  };
  return { run, calls };
}

export const okResult = (ids: string[], over: (id: string, i: number) => Record<string, unknown> = () => ({})): ClaudeResult => ({
  kind: "ok",
  model: "test-model",
  text: JSON.stringify(ids.map((id, i) => ({ id, score: 60 + (i % 30), tags: ["tooling"], why: "Relevant.", ...over(id, i) }))),
});

export const goodClaude = () => fakeClaude((ids) => okResult(ids));

export interface Harness {
  store: MemoryStore;
  spoolDir: string;
  tmp: string;
  notes: string[];
  logs: string[];
  fetch: ReturnType<typeof fetcher>;
  claude: FakeClaude;
  feeds: FeedMap;
  cleanup: () => void;
  run: (opts?: Partial<PipelineOptions>, deps?: Partial<PipelineDeps>) => Promise<PipelineResult>;
}

export function harness(defaults: { sources: SourceConfig[]; feeds: FeedMap; claude?: FakeClaude }): Harness {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "news-pipe-"));
  const store = new MemoryStore();
  const notes: string[] = [];
  const logs: string[] = [];
  const log: Logger = {
    info: (m) => logs.push(`INFO ${m}`),
    warn: (m) => logs.push(`WARN ${m}`),
    error: (m) => logs.push(`ERROR ${m}`),
  };
  void silentLogger;
  const feeds = defaults.feeds;
  const fetch = fetcher(feeds);
  const claude = defaults.claude ?? goodClaude();
  const spoolDir = path.join(tmp, "spool");
  const h = {
    store,
    spoolDir,
    tmp,
    notes,
    logs,
    fetch,
    claude,
    feeds,
    cleanup: () => fs.rmSync(tmp, { recursive: true, force: true }),
    run: (opts: Partial<PipelineOptions> = {}, deps: Partial<PipelineDeps> = {}) =>
      runPipeline(
        { trigger: "manual", dryRun: false, noScore: false, rescoreOnly: false, sourceSlug: null, ...opts },
        {
          store,
          sources: defaults.sources,
          fetchSource: (s) => fetch.fn(s),
          claude: claude.run,
          profile: "PROFILE",
          spoolDir,
          now: NOW,
          log,
          snapshot: null,
          notify: (m) => notes.push(m),
          env: {},
          ...deps,
        },
      ),
  };
  return h;
}
