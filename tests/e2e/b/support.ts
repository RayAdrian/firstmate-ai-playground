import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });

export const REPO = process.cwd();
export const FIXTURE = path.join(REPO, "tests/fixtures/content/content-valid");

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Run an npm script (so package.json wiring is exercised too). Extra env wins over process.env. */
export function npmRun(script: string, args: string[] = [], env: Record<string, string> = {}): RunResult {
  const r = spawnSync("npm", ["run", "--silent", script, ...(args.length > 0 ? ["--", ...args] : [])], {
    cwd: REPO,
    env: { ...process.env, ...env },
    encoding: "utf8",
    timeout: 120_000,
  });
  return { code: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

export function serviceClient() {
  return createClient(process.env.SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function anonClient() {
  return createClient(process.env.SUPABASE_URL ?? "", process.env.SUPABASE_ANON_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const TABLES = ["levels", "lessons", "exercises", "news_sources", "news_items", "ingest_runs"] as const;
export type TableName = (typeof TABLES)[number];

export async function countRows(): Promise<Record<TableName, number>> {
  const db = serviceClient();
  const out = {} as Record<TableName, number>;
  for (const t of TABLES) {
    const { count, error } = await db.from(t).select("*", { count: "exact", head: true });
    if (error) throw new Error(`count ${t}: ${error.message}`);
    out[t] = count ?? 0;
  }
  return out;
}

const ORDER: Record<TableName, string> = {
  levels: "slug",
  lessons: "slug",
  exercises: "slug",
  news_sources: "slug",
  news_items: "canonical_url",
  ingest_runs: "started_at",
};

/** Every column of every table, ordered stably, as JSON. Pass `dropIds` to ignore generated uuids. */
export async function dumpTables(opts: { dropIds?: boolean; tables?: readonly TableName[] } = {}): Promise<string> {
  const db = serviceClient();
  const out: Record<string, unknown> = {};
  for (const t of opts.tables ?? TABLES) {
    const { data, error } = await db.from(t).select("*").order(ORDER[t]);
    if (error) throw new Error(`dump ${t}: ${error.message}`);
    out[t] = opts.dropIds
      ? data.map((row: Record<string, unknown>) => {
          const copy: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(row)) if (k !== "id" && !k.endsWith("_id")) copy[k] = v;
          return copy;
        })
      : data;
  }
  return JSON.stringify(out, null, 1);
}

export interface Sandbox {
  root: string;
  env: Record<string, string>;
  edit(rel: string, fn: (text: string) => string): void;
  remove(rel: string): void;
  cleanup(): void;
}

export function contentSandbox(): Sandbox {
  const root = mkdtempSync(path.join(tmpdir(), "fm-seed-e2e-"));
  cpSync(FIXTURE, root, { recursive: true });
  return {
    root,
    env: { CONTENT_DIR: path.join(root, "content"), EXERCISES_DIR: path.join(root, "exercises") },
    edit(rel, fn) {
      const file = path.join(root, rel);
      writeFileSync(file, fn(readFileSync(file, "utf8")));
    },
    remove(rel) {
      rmSync(path.join(root, rel), { recursive: true, force: true });
    },
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}
