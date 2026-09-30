// npm run news:import: fetch the `news-snapshots` branch and upsert its snapshots into local Supabase (PRD section 14, Q1).
import type { Env } from "./env";
import { isConnectionFailure } from "@/lib/db/errors";
import { getServiceClient } from "@/lib/db/service";
import { newsPaths } from "./config";
import { ImportError, importSnapshots } from "./import-lib";
import { createLogger } from "./log";
import { SourcesConfigError, loadSources, sourcesPath } from "./sources";
import { createSupabaseStore } from "./store-supabase";

export async function main(env: Env = process.env): Promise<number> {
  const log = createLogger(env);
  const paths = newsPaths(env);
  try {
    const store = createSupabaseStore(getServiceClient());
    // Source rows must exist locally before items can reference them (matched by slug).
    await store.upsertSources(loadSources(sourcesPath(env)));
    const { snapshots, result } = await importSnapshots({ store, repoDir: paths.repoDir, remote: paths.remote, env });
    for (const w of result.warnings) log.warn(w);
    log.info(`Imported ${snapshots} snapshot${snapshots === 1 ? "" : "s"}: ${result.itemsInserted} new, ${result.itemsUpdated} updated (${result.runsUpserted} new run${result.runsUpserted === 1 ? "" : "s"})`);
    return 0;
  } catch (err) {
    if (err instanceof ImportError || err instanceof SourcesConfigError) {
      log.error(err.message);
      return 1;
    }
    if (isConnectionFailure(err)) {
      log.error("Can't reach the local database. Run `supabase start` first.");
      return 2;
    }
    log.error(`import failed: ${err instanceof Error ? err.message : "unexpected error"}`);
    return 1;
  }
}

if (require.main === module) {
  main().then(
    (code) => process.exit(code),
    () => process.exit(1),
  );
}
