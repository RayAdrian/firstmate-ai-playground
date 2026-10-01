import type { Env } from "./env";
import type { ClaudeRunner } from "./claude";
import { FetchError } from "./http";
import { isConnectionFailure } from "./store-supabase";
import { FeedParseError, type RawFeedItem } from "./feed";
import { matchesKeywords } from "./prefilter";
import { normalizeItems, type Candidate } from "./normalize";
import { summarizeErrors } from "./sanitize";
import { scoreItems, type FinalStatus } from "./score";
import type { SourceConfig } from "./sources";
import { listSpoolFiles, readSpoolFile, rejectSpoolLines, removeSpoolFile, writeSpool } from "./spool";
import { buildSnapshotFiles, writeSnapshotFiles } from "./snapshot";
import { publishSnapshots } from "./publish";
import { digestDate, isOlderThanBackfillWindow } from "./time";
import { MAX_SCORED_PER_RUN, type Logger, type NewItemRecord, type NewsStore, type RunFinish } from "./types";

export interface PipelineOptions {
  trigger: "schedule" | "manual";
  dryRun: boolean;
  noScore: boolean;
  /** Score pending items only: no fetching (news:rescore). */
  rescoreOnly: boolean;
  /** Restrict the fetch to one source slug (even a disabled one). */
  sourceSlug: string | null;
}

export interface SnapshotConfig {
  /** Local staging directory for the exported JSON files. */
  stageDir: string;
  /** When set, commit + push to the news-snapshots branch (`--publish`). */
  publish: { repoDir: string; remote: string } | null;
}

export interface PipelineDeps {
  store: NewsStore;
  sources: readonly SourceConfig[];
  fetchSource: (source: SourceConfig) => Promise<RawFeedItem[]>;
  claude: ClaudeRunner;
  profile: string;
  spoolDir: string;
  now: Date;
  log: Logger;
  snapshot: SnapshotConfig | null;
  /** Called with a short message on a failed run or the 3rd consecutive partial. Failures are ignored. */
  notify: ((message: string) => void) | null;
  env?: Env;
}

export interface RunCounts {
  fetched: number;
  new: number;
  scored: number;
  pending: number;
  failed: number;
  skipped: number;
}

export interface PipelineResult {
  status: "success" | "partial" | "failed";
  /** 0 success/partial, 1 failed or bad input, 2 Supabase unreachable (I-4.4). */
  exitCode: 0 | 1 | 2;
  counts: RunCounts;
  errors: string[];
  runId: string | null;
  spooledTo: string | null;
}

const EMPTY: RunCounts = { fetched: 0, new: 0, scored: 0, pending: 0, failed: 0, skipped: 0 };

export class UnknownSourceError extends Error {
  constructor(slug: string, valid: readonly string[]) {
    super(`Unknown source: ${slug}. Valid sources: ${valid.join(", ")}`);
    this.name = "UnknownSourceError";
  }
}

function failureReason(err: unknown): string {
  if (err instanceof FetchError) return err.reason;
  if (err instanceof FeedParseError) return `parse (${err.message})`;
  return "unexpected error";
}

interface FetchPhase {
  candidates: Candidate[];
  errors: string[];
  attempted: number;
  succeeded: number;
}

async function fetchAll(sources: readonly SourceConfig[], deps: PipelineDeps): Promise<FetchPhase> {
  const results = await Promise.all(
    sources.map(async (source) => {
      try {
        const raw = await deps.fetchSource(source);
        const { items, dropped } = normalizeItems(raw, { sourceSlug: source.slug, baseUrl: source.url, now: deps.now });
        for (const d of dropped) deps.log.info(`dropped item: ${d}`);
        const keywords = source.filters.keywords ?? [];
        const kept = keywords.length > 0 ? items.filter((i) => matchesKeywords(i, keywords)) : items;
        return { source, items: kept, error: null as string | null };
      } catch (err) {
        const reason = failureReason(err);
        deps.log.error(`source ${source.slug} failed: ${reason}`);
        return { source, items: [] as Candidate[], error: `${source.slug}: ${reason}` };
      }
    }),
  );

  // Cross-source dedupe in yaml order: first source wins (AMB-E8). Also by (source, guid).
  const seenUrl = new Set<string>();
  const seenGuid = new Set<string>();
  const candidates: Candidate[] = [];
  for (const r of results) {
    for (const item of r.items) {
      const guidKey = item.guid ? `${item.source_slug}\u0000${item.guid}` : null;
      if (seenUrl.has(item.canonical_url) || (guidKey && seenGuid.has(guidKey))) continue;
      seenUrl.add(item.canonical_url);
      if (guidKey) seenGuid.add(guidKey);
      candidates.push(item);
    }
  }
  return {
    candidates,
    errors: results.flatMap((r) => (r.error ? [r.error] : [])),
    attempted: sources.length,
    succeeded: results.filter((r) => !r.error).length,
  };
}

function toRecord(c: Candidate): NewItemRecord {
  // I-2.3: strictly older than 7 days at first fetch is stored `skipped` and never scored.
  const skipped = isOlderThanBackfillWindow(c.published_at, new Date(c.first_seen_at));
  return { ...c, scoring_status: skipped ? "skipped" : "pending" };
}

/** One full pipeline run (I-1..I-4, section 14 Q1). The caller holds the run lock. */
export async function runPipeline(opts: PipelineOptions, deps: PipelineDeps): Promise<PipelineResult> {
  const { store, log } = deps;
  const env = deps.env ?? process.env;
  const errors: string[] = [];

  let toFetch: SourceConfig[] = [];
  if (!opts.rescoreOnly) {
    if (opts.sourceSlug) {
      const one = deps.sources.find((s) => s.slug === opts.sourceSlug);
      if (!one) throw new UnknownSourceError(opts.sourceSlug, deps.sources.map((s) => s.slug));
      toFetch = [one];
    } else {
      toFetch = deps.sources.filter((s) => s.enabled);
    }
  }

  const fetchPhase: FetchPhase = opts.rescoreOnly ? { candidates: [], errors: [], attempted: 0, succeeded: 0 } : await fetchAll(toFetch, deps);
  errors.push(...fetchPhase.errors);
  const counts: RunCounts = { ...EMPTY, fetched: fetchPhase.candidates.length };
  log.info(`fetched ${fetchPhase.candidates.length} item(s) from ${fetchPhase.succeeded}/${fetchPhase.attempted} source(s)`);

  if (opts.dryRun) {
    let known: Set<string> | null = null;
    try {
      known = await store.existingCanonicals(fetchPhase.candidates.map((c) => c.canonical_url));
    } catch {
      log.warn("database not reachable: duplicate status unknown");
    }
    for (const c of fetchPhase.candidates) {
      const marker = known === null ? "unknown" : known.has(c.canonical_url) ? "duplicate" : "new";
      log.info(`[${marker}] ${c.canonical_url} (${c.source_slug})`);
    }
    return { status: fetchPhase.errors.length > 0 ? "partial" : "success", exitCode: 0, counts, errors, runId: null, spooledTo: null };
  }

  // Connect: everything up to the run row must succeed or we spool (I-4.4).
  let runId: string;
  try {
    await store.upsertSources(deps.sources);
    await store.closeOpenRuns(deps.now.toISOString());
    runId = await store.startRun({ started_at: deps.now.toISOString(), trigger: opts.trigger });
  } catch (err) {
    if (!isConnectionFailure(err)) throw err;
    let spooledTo: string | null = null;
    if (fetchPhase.candidates.length > 0) {
      spooledTo = writeSpool(deps.spoolDir, fetchPhase.candidates, deps.now);
      log.error(`Supabase unreachable: spooled ${fetchPhase.candidates.length} item(s) to spool file ${spooledTo.split("/").pop()}. Start it with \`supabase start\`.`);
    } else {
      log.error("Supabase unreachable. Start it with `supabase start`.");
    }
    return { status: "failed", exitCode: 2, counts, errors: [...errors, "Supabase unreachable"], runId: null, spooledTo };
  }

  const statuses = new Map<string, FinalStatus>();
  const digestDates = new Set<string>([digestDate(deps.now)]);
  let skipped = 0;
  let newCount = 0;
  let exitCode: 0 | 1 | 2 = 0;
  let status: RunFinish["status"] = "success";
  let invalid = 0;

  try {
    const insertRecords = async (records: readonly NewItemRecord[]): Promise<number> => {
      const inserted = await store.insertCandidates(records);
      const statusByUrl = new Map(records.map((r) => [r.canonical_url, r.scoring_status]));
      for (const it of inserted) {
        digestDates.add(it.digest_date);
        if (statusByUrl.get(it.canonical_url) === "skipped") skipped++;
        else statuses.set(it.id, "pending");
      }
      return inserted.length;
    };

    if (!opts.rescoreOnly) {
      // 1. Replay spooled items first; delete a file only after its rows are committed.
      const knownSlugs = new Set(deps.sources.map((s) => s.slug));
      for (const file of listSpoolFiles(deps.spoolDir)) {
        const { items, bad } = readSpoolFile(file);
        const name = file.split("/").pop() ?? file;
        for (const b of bad) log.warn(`spool ${name} line ${b.line}: ${b.reason}`);
        if (bad.length > 0) rejectSpoolLines(file, bad.map((b) => b.line));
        const n = await insertRecords(items.filter((i) => knownSlugs.has(i.source_slug)).map(toRecord));
        removeSpoolFile(file);
        newCount += n;
        log.info(`replayed spool ${name}: ${n} new item(s)`);
      }

      // 2. Insert this run's fetched items.
      newCount += await insertRecords(fetchPhase.candidates.map(toRecord));
    }

    // 3. Score: carried-over pending first (oldest first_seen_at), capped per run. Skipped items are never pending.
    if (!opts.noScore) {
      const scorable = await store.listScorable(MAX_SCORED_PER_RUN);
      for (const it of scorable) {
        digestDates.add(it.digest_date);
        if (!statuses.has(it.id)) statuses.set(it.id, "pending");
      }
      if (scorable.length > 0) {
        const outcome = await scoreItems(scorable, {
          store,
          claude: deps.claude,
          profile: deps.profile,
          now: () => deps.now,
          log,
          defaultModel: env.NEWS_CLAUDE_MODEL,
        });
        for (const [id, s] of outcome.statuses) statuses.set(id, s);
        errors.push(...outcome.errors);
        invalid = outcome.invalid;
      }
    }
  } catch (err) {
    if (isConnectionFailure(err)) {
      log.error("Supabase became unreachable mid-run. Unprocessed spool files are kept; start it with `supabase start`.");
      errors.push("Supabase unreachable mid-run");
      exitCode = 2;
    } else {
      log.error(`run aborted: ${err instanceof Error ? err.message : "unexpected error"}`);
      errors.push(`run aborted: ${err instanceof Error ? err.message : "unexpected error"}`);
      exitCode = 1;
    }
    status = "failed";
  }

  const tally = (want: FinalStatus) => [...statuses.values()].filter((s) => s === want).length;
  counts.new = newCount;
  counts.scored = tally("scored");
  counts.pending = tally("pending");
  counts.failed = tally("failed");
  counts.skipped = skipped;

  if (status !== "failed") {
    const allSourcesFailed = toFetch.length > 0 && fetchPhase.succeeded === 0;
    if (allSourcesFailed) status = "failed";
    else if (errors.length > 0 || invalid > 0) status = "partial";
  }

  const finish = async (s: RunFinish["status"], errs: readonly string[]) => {
    const patch: RunFinish = {
      finished_at: new Date().toISOString(),
      status: s,
      fetched: counts.fetched,
      new: counts.new,
      scored: counts.scored,
      pending: counts.pending,
      failed: counts.failed,
      skipped: counts.skipped,
      error_summary: summarizeErrors(errs, env),
    };
    await store.finishRun(runId, patch);
  };

  try {
    await finish(status, errors);
  } catch (err) {
    log.error(`could not record run result: ${err instanceof Error ? err.message : "unknown"}`);
    return { status: "failed", exitCode: isConnectionFailure(err) ? 2 : 1, counts, errors, runId, spooledTo: null };
  }

  // Snapshot export + optional publish (section 14 Q1). A failure never loses DB data; it downgrades to partial.
  if (deps.snapshot && exitCode === 0) {
    try {
      const files = await buildSnapshotFiles(store, [...digestDates], new Date());
      writeSnapshotFiles(deps.snapshot.stageDir, files);
      if (deps.snapshot.publish) {
        const res = await publishSnapshots({ ...deps.snapshot.publish, files, message: `news: snapshot ${[...digestDates].sort().join(", ")}`, env });
        log.info(res.pushed ? "snapshot pushed to news-snapshots" : "snapshot unchanged, nothing pushed");
      }
    } catch (err) {
      const msg = `snapshot publish failed: ${err instanceof Error ? err.message : "unknown"}`;
      log.error(msg);
      errors.push(msg);
      if (status === "success") status = "partial";
      await finish(status, errors).catch(() => undefined);
    }
  }

  // Notifications (I-6): failed run, or the third consecutive partial.
  if (deps.notify) {
    try {
      if (status === "failed") {
        deps.notify("First Mate news run failed. See ~/Library/Logs/fm-playground/news.log");
      } else if (status === "partial") {
        const prior = await store.recentRunStatuses(3, runId);
        if (prior.length >= 2 && prior[0] === "partial" && prior[1] === "partial" && prior[2] !== "partial") {
          deps.notify("First Mate news: 3 partial runs in a row. See ~/Library/Logs/fm-playground/news.log");
        }
      }
    } catch {
      // notifications are best effort
    }
  }

  return { status, exitCode: status === "failed" && exitCode === 0 ? 1 : exitCode, counts, errors, runId, spooledTo: null };
}
