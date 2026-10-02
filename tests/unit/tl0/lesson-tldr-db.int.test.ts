// @vitest-environment node
// TL-3: the anon role can select lessons.tldr and cannot write it. Opt-in against the local stack, under the db lock:
//   FM_DB_TESTS=1 npx vitest run tests/unit/tl0/lesson-tldr-db.int.test.ts
import path from "node:path";
import dotenv from "dotenv";
import { Client } from "pg";
import { describe, expect, it, vi } from "vitest";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });
dotenv.config({ path: path.resolve(__dirname, "../../../.env.local"), quiet: true });

const DB_URL = process.env.LOCAL_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";

async function reachable(): Promise<boolean> {
  const c = new Client({ connectionString: DB_URL, connectionTimeoutMillis: 2000 });
  try {
    await c.connect();
    const r = await c.query("select 1 from information_schema.columns where table_name = 'lessons' and column_name = 'tldr'");
    return r.rowCount === 1;
  } catch {
    return false;
  } finally {
    await c.end().catch(() => {});
  }
}
const available = process.env.FM_DB_TESTS === "1" && (await reachable());

describe.skipIf(!available)("lessons.tldr grants (TL-3)", () => {
  const priv = async (p: string) => {
    const c = new Client({ connectionString: DB_URL });
    await c.connect();
    try {
      const r = await c.query("select has_column_privilege('anon', 'public.lessons', 'tldr', $1) as ok", [p]);
      return r.rows[0]?.ok as boolean;
    } finally {
      await c.end();
    }
  };
  it("anon can select the column", async () => expect(await priv("SELECT")).toBe(true));
  it("anon cannot insert or update the column", async () => {
    expect(await priv("INSERT")).toBe(false);
    expect(await priv("UPDATE")).toBe(false);
  });
});
