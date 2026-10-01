// Seed `content/workflows/` into the `workflows` table (PRD §16.7 WF-42, WF-43). Same archive idea as lessons, with two
// differences the PRD asks for: a bad file never blocks the seed (it is skipped and its row left alone), and a takedown hash
// hard-deletes the row (the only hard delete in the system).
import { existsSync } from "node:fs";
import path from "node:path";
import type { WorkflowRow } from "../../../src/lib/contracts";
import type { Database } from "../../../src/lib/db/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatWorkflowIssue, loadWorkflows, readTakedownHashes } from "../../workflows/load";
import type { ParsedWorkflow } from "../../workflows/parse";
import { createGitMeta, type GitMetaProvider } from "./git-meta";
import type { SeedIssue } from "./issues";
import { workflowsClient } from "./workflows-db";

export type { GitMetaProvider } from "./git-meta";

/** The columns the seed owns. `id`, timestamps and `removed_at` are managed by the database and the removal rule. */
export type WorkflowPayload = Omit<WorkflowRow, "id" | "created_at" | "updated_at" | "removed_at">;

export interface StoredWorkflow extends WorkflowPayload {
  id: string;
  removed_at: string | null;
}

/** The narrow surface the seed needs, so the logic is testable without a database. */
export interface WorkflowStore {
  list(): Promise<StoredWorkflow[]>;
  insert(payload: WorkflowPayload, nowIso: string): Promise<void>;
  /** Writes the payload and clears `removed_at` (an update also restores a removed row). */
  update(id: string, payload: WorkflowPayload, nowIso: string): Promise<void>;
  setRemoved(id: string, removedAt: string, nowIso: string): Promise<void>;
  deleteByIds(ids: string[]): Promise<void>;
}

export interface WorkflowSeedResult {
  inserted: number;
  updated: number;
  removed: number;
  restored: number;
  purged: number;
  /** Files that failed validation (or structure/taxonomy checks). Their rows are untouched. */
  skipped: SeedIssue[];
  warnings: string[];
}

export interface WorkflowSeedOptions {
  contentDir: string;
  now: Date;
  /** Defaults to git history (createGitMeta). Fixtures pass fixed values. */
  meta?: GitMetaProvider;
}

const PAYLOAD_KEYS = [
  "slug", "title", "problem", "tools", "setup", "setup_kinds", "prompt", "result_before", "result_after", "steps", "why_md",
  "use_cases", "stacks", "related_lesson_slug", "level", "tool_versions", "verified_on", "author_name", "reviewed_on", "content_hash",
] as const satisfies readonly (keyof WorkflowPayload)[];

/** JSON with sorted object keys, so jsonb round-trips compare equal regardless of key order. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

const same = (a: WorkflowPayload, b: WorkflowPayload): boolean => PAYLOAD_KEYS.every((k) => stable(a[k]) === stable(b[k]));

function toPayload(w: ParsedWorkflow, level: number | null, git: { author_name: string; reviewed_on: string | null }): WorkflowPayload {
  return {
    slug: w.slug,
    title: w.title,
    problem: w.problem,
    tools: w.tools,
    setup: w.setup,
    setup_kinds: w.setup_kinds,
    prompt: w.prompt,
    result_before: w.result_before,
    result_after: w.result_after,
    steps: w.steps,
    why_md: w.why_md,
    use_cases: w.use_cases,
    stacks: w.stacks,
    related_lesson_slug: w.related_lesson_slug,
    level,
    tool_versions: w.tool_versions,
    verified_on: w.verified_on,
    author_name: git.author_name,
    reviewed_on: git.reviewed_on,
    content_hash: w.content_hash,
  };
}

export async function seedWorkflows(store: WorkflowStore, opts: WorkflowSeedOptions): Promise<WorkflowSeedResult> {
  const nowIso = opts.now.toISOString();
  const result: WorkflowSeedResult = { inserted: 0, updated: 0, removed: 0, restored: 0, purged: 0, skipped: [], warnings: [] };
  const workflowsDir = path.join(opts.contentDir, "workflows");
  // No workflows folder at all (for example a CONTENT_DIR that points elsewhere): do nothing rather than mark every row removed.
  if (!existsSync(workflowsDir)) return result;

  const loaded = loadWorkflows({ contentDir: opts.contentDir, now: opts.now });
  result.skipped = loaded.issues;
  result.warnings.push(...loaded.warnings.map((w) => `warning: ${formatWorkflowIssue(w)}`));
  const takedown = readTakedownHashes(opts.contentDir);
  result.warnings.push(...takedown.warnings);

  const existing = await store.list();

  // ---- takedown: hard-delete every row whose content_hash is listed (WF-43)
  const purge = existing.filter((r) => r.content_hash !== "" && takedown.hashes.has(r.content_hash));
  if (purge.length > 0) await store.deleteByIds(purge.map((r) => r.id));
  result.purged = purge.length;
  const purged = new Set(purge.map((r) => r.id));
  const bySlug = new Map(existing.filter((r) => !purged.has(r.id)).map((r) => [r.slug, r]));

  // ---- upsert by slug
  const git = opts.meta ? { meta: opts.meta, warnings: [] as string[] } : createGitMeta(workflowsDir);
  for (const w of loaded.workflows) {
    if (takedown.hashes.has(w.content_hash)) {
      result.warnings.push(`${w.file}: matches a takedown hash in _takedowns.txt; not seeded`);
      continue;
    }
    const level = w.related_lesson_slug ? (loaded.levelBySlug.get(w.related_lesson_slug) ?? null) : null;
    const payload = toPayload(w, level, git.meta(path.basename(w.file)));
    const row = bySlug.get(w.slug);
    if (!row) {
      await store.insert(payload, nowIso);
      result.inserted++;
    } else if (row.removed_at !== null || !same(row, payload)) {
      await store.update(row.id, payload, nowIso);
      if (row.removed_at !== null) result.restored++;
      else result.updated++;
    }
  }

  // ---- a deleted file marks its row removed (kept, never deleted). A file that exists but is invalid keeps its row as it was.
  for (const row of bySlug.values()) {
    if (!loaded.presentSlugs.has(row.slug) && row.removed_at === null) {
      await store.setRemoved(row.id, nowIso, nowIso);
      result.removed++;
    }
  }

  result.warnings.push(...git.warnings);
  return result;
}

// ---------------------------------------------------------------- Supabase adapter

function fail(what: string, message: string): never {
  throw new Error(`database error while ${what}: ${message}`);
}

export function supabaseWorkflowStore(db: SupabaseClient<Database>): WorkflowStore {
  const wf = workflowsClient(db);
  return {
    async list() {
      const { data, error } = await wf.from("workflows").select("*");
      if (error) fail("reading workflows", error.message);
      return data.map((row) => {
        const { created_at, updated_at, ...rest } = row;
        void created_at;
        void updated_at;
        return rest;
      });
    },
    async insert(payload, nowIso) {
      const { error } = await wf.from("workflows").insert({ ...payload, updated_at: nowIso });
      if (error) fail(`inserting workflow ${payload.slug}`, error.message);
    },
    async update(id, payload, nowIso) {
      const { error } = await wf.from("workflows").update({ ...payload, removed_at: null, updated_at: nowIso }).eq("id", id);
      if (error) fail(`updating workflow ${payload.slug}`, error.message);
    },
    async setRemoved(id, removedAt, nowIso) {
      const { error } = await wf.from("workflows").update({ removed_at: removedAt, updated_at: nowIso }).eq("id", id);
      if (error) fail("marking a workflow removed", error.message);
    },
    async deleteByIds(ids) {
      const { error } = await wf.from("workflows").delete().in("id", ids);
      if (error) fail("purging workflows named in _takedowns.txt", error.message);
    },
  };
}
