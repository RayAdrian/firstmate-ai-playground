// npm run news:sources:check: verify every enabled source is reachable and parses (PRD I-1.2). Needs network.
import { DEFAULT_FETCH_TIMEOUT_MS } from "./http";
import { fetchSource } from "./fetch-source";
import { loadSources, sourcesPath } from "./sources";

async function main(): Promise<number> {
  const sources = loadSources(sourcesPath()).filter((s) => s.enabled);
  let bad = 0;
  for (const s of sources) {
    let lastErr = "";
    let count = -1;
    for (let attempt = 0; attempt < 3 && count < 0; attempt++) {
      try {
        count = (await fetchSource(s, { timeoutMs: DEFAULT_FETCH_TIMEOUT_MS })).length;
      } catch (err) {
        lastErr = err instanceof Error ? err.message : "failed";
        if (!/http 5\d\d|timeout|network/.test(lastErr)) break; // only transient failures are retried
      }
    }
    const ok = count >= 1;
    if (!ok) bad++;
    console.log(`${ok ? "ok  " : "FAIL"} ${s.slug}${ok ? ` (${count} items)` : `: ${lastErr || "0 items"}`}`);
  }
  return bad === 0 ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  () => process.exit(1),
);
