// npm run news:run: fetch, dedupe, score with `claude -p`, upsert, export snapshot (PRD I-1..I-6, section 14 Q1).
import type { Env } from "./env";
import fs from "node:fs";
import { getServiceClient } from "@/lib/db/service";
import { runClaude, DEFAULT_CLAUDE_TIMEOUT_MS } from "./claude";
import { parseRunArgs, type RunArgs } from "./cli-args";
import { intEnv, newsPaths } from "./config";
import { fetchSource } from "./fetch-source";
import { gateDecision, recordScheduledRun } from "./gate";
import { acquireLock } from "./lock";
import { createLogger } from "./log";
import { macNotify } from "./notify";
import { runPipeline, UnknownSourceError } from "./pipeline";
import { DEFAULT_FETCH_TIMEOUT_MS } from "./http";
import { SourcesConfigError, loadSources, sourcesPath } from "./sources";
import { createSupabaseStore } from "./store-supabase";
import { now } from "./time";

export async function main(argv: readonly string[], env: Env = process.env): Promise<number> {
  const parsed = parseRunArgs(argv);
  if (!parsed.ok) {
    console.error(parsed.message);
    return 1;
  }
  const args: RunArgs = parsed.args;
  const log = createLogger(env);
  const paths = newsPaths(env);
  const at = now(env);
  const trigger = env.NEWS_TRIGGER === "schedule" ? "schedule" : "manual";

  if (args.gate) {
    const gate = gateDecision(paths.gateMarker, at);
    if (!gate.run) {
      log.info(`gate closed: ${gate.reason}`);
      return 0;
    }
  }

  let sources;
  try {
    sources = loadSources(sourcesPath(env));
  } catch (err) {
    log.error(err instanceof SourcesConfigError ? err.message : "cannot load sources");
    return 1;
  }

  let profile: string;
  try {
    profile = fs.readFileSync(paths.profilePath, "utf8");
  } catch {
    log.error(`cannot read the First Mate profile at ${paths.profilePath}`);
    return 1;
  }

  const lock = args.dryRun ? null : acquireLock(paths.lockPath);
  if (lock && !lock.acquired) {
    log.info("news run already running; exiting");
    return 0;
  }
  if (lock?.acquired && lock.removedStale) log.warn("removed stale lock from a previous crashed run");

  try {
    let client;
    try {
      client = getServiceClient();
    } catch (err) {
      log.error(err instanceof Error ? err.message : "Supabase is not configured");
      return 1;
    }
    const store = createSupabaseStore(client);
    const fetchTimeout = intEnv(env, "NEWS_FETCH_TIMEOUT_MS", DEFAULT_FETCH_TIMEOUT_MS);
    const claudeTimeout = intEnv(env, "NEWS_CLAUDE_TIMEOUT_MS", DEFAULT_CLAUDE_TIMEOUT_MS);

    const result = await runPipeline(
      { trigger, dryRun: args.dryRun, noScore: args.noScore, rescoreOnly: args.rescoreOnly, sourceSlug: args.sourceSlug },
      {
        store,
        sources,
        fetchSource: (s) => fetchSource(s, { timeoutMs: fetchTimeout }),
        claude: (p) => runClaude(p, { env, timeoutMs: claudeTimeout }),
        profile,
        spoolDir: paths.spoolDir,
        now: at,
        log,
        snapshot: args.dryRun ? null : { stageDir: paths.stageDir, publish: args.publish ? { repoDir: paths.repoDir, remote: paths.remote } : null },
        notify: args.dryRun ? null : (m) => macNotify(m, env),
        env,
      },
    );

    const c = result.counts;
    log.info(`run ${result.status}: fetched=${c.fetched} new=${c.new} scored=${c.scored} pending=${c.pending} failed=${c.failed} skipped=${c.skipped}`);
    if (args.gate && !args.dryRun && result.exitCode === 0) recordScheduledRun(paths.gateMarker, result.status, at);
    return result.exitCode;
  } catch (err) {
    if (err instanceof UnknownSourceError) {
      log.error(err.message);
      return 1;
    }
    log.error(`run crashed: ${err instanceof Error ? err.message : "unexpected error"}`);
    return 1;
  } finally {
    if (lock?.acquired) lock.release();
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    () => process.exit(1),
  );
}
