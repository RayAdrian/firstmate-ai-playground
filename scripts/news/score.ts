import type { ClaudeRunner } from "./claude";
import { buildPrompt } from "./prompt";
import { parseScoringOutput } from "./score-parse";
import { BATCH_SIZE, MAX_ATTEMPTS, type Logger, type NewsStore, type StoredItem } from "./types";

export type FinalStatus = "pending" | "scored" | "failed";

export interface ScoreOutcome {
  /** Final status of every item this call touched. */
  statuses: Map<string, FinalStatus>;
  /** Items whose result was missing or failed validation. */
  invalid: number;
  /** Human-readable, sanitised-later failure reasons (one per failed batch / condition). */
  errors: string[];
}

export interface ScoreDeps {
  store: NewsStore;
  claude: ClaudeRunner;
  profile: string;
  now: () => Date;
  log: Logger;
  batchSize?: number;
  defaultModel?: string;
}

/**
 * Score items in batches with headless claude (I-3). Nothing is ever lost: any item that does not get a valid
 * result stays `pending` with attempts+1, and becomes `failed` once attempts reach MAX_ATTEMPTS (I-4.1-4.3).
 * If claude is unavailable (missing / not logged in) the remaining batches are not attempted but their items
 * still count the attempt, per the PRD.
 */
export async function scoreItems(items: readonly StoredItem[], deps: ScoreDeps): Promise<ScoreOutcome> {
  const batchSize = deps.batchSize ?? BATCH_SIZE;
  const statuses = new Map<string, FinalStatus>();
  const errors: string[] = [];
  let invalid = 0;
  let unavailable: string | null = null;

  const failAttempt = async (item: StoredItem) => {
    const attempts = item.attempts + 1;
    const status = attempts >= MAX_ATTEMPTS ? "failed" : "pending";
    await deps.store.markUnscored(item.id, attempts, status);
    statuses.set(item.id, status);
  };

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    if (unavailable) {
      for (const item of batch) await failAttempt(item);
      continue;
    }

    const prompt = buildPrompt(
      batch.map((it) => ({ id: it.id, title: it.title, source: it.source_slug, published_at: it.published_at, excerpt: it.excerpt, url: it.url })),
      { profile: deps.profile },
    );
    const result = await deps.claude(prompt);

    if (result.kind === "unavailable") {
      unavailable = result.reason;
      errors.push(result.reason);
      deps.log.error(`scoring unavailable: ${result.reason}`);
      for (const item of batch) await failAttempt(item);
      continue;
    }
    if (result.kind === "error") {
      errors.push(`scoring batch ${Math.floor(i / batchSize) + 1} failed: ${result.reason}`);
      deps.log.error(`scoring batch failed: ${result.reason}`);
      for (const item of batch) await failAttempt(item);
      continue;
    }

    const parsed = parseScoringOutput(result.text, batch.map((b) => b.id));
    if (parsed.parseError) errors.push(`scoring batch ${Math.floor(i / batchSize) + 1}: could not parse JSON from claude`);
    const scoredIds = new Set(parsed.scored.map((s) => s.id));
    const at = deps.now().toISOString();
    for (const s of parsed.scored) {
      await deps.store.markScored(s.id, { score: s.score, tags: s.tags, why: s.why, model: result.model ?? deps.defaultModel ?? "claude", at });
      statuses.set(s.id, "scored");
    }
    for (const item of batch) {
      if (scoredIds.has(item.id)) continue;
      invalid++;
      await failAttempt(item);
    }
    if (!parsed.parseError && parsed.unscored.length > 0) {
      errors.push(`${parsed.unscored.length} item(s) failed validation in batch ${Math.floor(i / batchSize) + 1}`);
    }
  }
  return { statuses, invalid, errors };
}
