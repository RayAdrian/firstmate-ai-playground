// @vitest-environment node
// Database tests for PRD 18.4 / CM-7 / CM-9. Opt-in against the local stack:
//   FM_DB_TESTS=1 npx vitest run tests/unit/r0/community-db.int.test.ts
// The DB is shared between worktrees: run them under the lock (scratchpad db-lock.sh).
// Fixture workflows use slugs r0-test-*; every test cleans up its own rows.
import { readFileSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import vectors from "./name-vectors.json";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });
dotenv.config({ path: path.resolve(__dirname, "../../../.env.local"), quiet: true });

const DB_URL = process.env.LOCAL_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";

async function reachable(): Promise<boolean> {
  const c = new Client({ connectionString: DB_URL, connectionTimeoutMillis: 2000 });
  try {
    await c.connect();
    const r = await c.query("select to_regclass('public.workflow_stars') as t");
    return r.rows[0]?.t !== null;
  } catch {
    return false;
  } finally {
    await c.end().catch(() => {});
  }
}
const available = process.env.FM_DB_TESTS === "1" && (await reachable());

type Row = Record<string, unknown>;
type PgErr = { code?: string; message?: string };

const uuid = (n: number) => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, "0")}`;
const WRITE_FNS = ["community_set_star", "community_set_reaction", "community_set_name"];
const READ_FNS = ["community_summary", "community_mine", "community_my_stars"];
const TABLES = ["workflow_stars", "workflow_reactions", "community_rate", "community_budget"];
const UPDATE_COLUMN: Record<string, string> = {
  workflow_stars: "created_at",
  workflow_reactions: "created_at",
  community_rate: "tokens",
  community_budget: "writes",
};

describe.skipIf(!available)("community database layer", () => {
  let db: Client;
  /** workflow slug by purpose */
  const wf: Record<string, string> = {};
  const extraSlugs: string[] = [];

  /** Run one statement in its own transaction as `role` (SET LOCAL ROLE), like a separate request. */
  async function as(role: string | null, sql: string, params: unknown[] = []): Promise<{ rows: Row[]; fields: string[] }> {
    await db.query("begin");
    try {
      if (role) await db.query(`set local role ${role}`);
      const r = await db.query(sql, params);
      await db.query("commit");
      return { rows: r.rows as Row[], fields: r.fields.map((f) => f.name) };
    } catch (e) {
      await db.query("rollback");
      throw e;
    }
  }
  const writer = (sql: string, params: unknown[] = []) => as("community_writer", sql, params);
  const star = (slug: string, client: string, on: boolean) => writer("select public.community_set_star($1, $2, $3)", [slug, client, on]);
  const react = (slug: string, client: string, reaction: string, on: boolean, name: string | null = null) =>
    writer("select public.community_set_reaction($1, $2, $3, $4, $5)", [slug, client, reaction, on, name]);
  const setName = (client: string, name: string | null) => writer("select public.community_set_name($1, $2)", [client, name]);
  const rejects = async (p: Promise<unknown>, message: string | RegExp) => {
    const e = await p.then(
      () => null,
      (err: PgErr) => err,
    );
    expect(e, "expected the call to be rejected").not.toBeNull();
    expect(e?.message).toMatch(message);
  };
  const count = async (table: string, where = "true") =>
    Number(((await db.query(`select count(*)::int as n from public.${table} where ${where}`)).rows[0] as { n: number }).n);

  async function insertWorkflow(slug: string, verifiedOffsetDays: number, removed = false): Promise<void> {
    await db.query(
      `insert into public.workflows (slug, title, problem, tools, result_before, result_after, steps, why_md, verified_on, author_name, removed_at)
       values ($1, $1, 'p', array['claude-code'], 'b', 'a', array['s'], 'w',
               ((now() at time zone 'Asia/Manila')::date - $2::int), 'tester', case when $3 then now() else null end)`,
      [slug, verifiedOffsetDays, removed],
    );
  }
  async function cleanup(): Promise<void> {
    await db.query("delete from public.workflows where slug like 'r0-test-%'");
    await db.query("delete from public.community_rate");
    await db.query("delete from public.community_budget");
  }

  beforeAll(async () => {
    db = new Client({ connectionString: DB_URL });
    await db.connect();
    // The local postgres user is not a superuser: let it SET ROLE community_writer for the duration of this file.
    await db.query("grant community_writer to postgres with set true");
    await cleanup();
    wf.fresh = "r0-test-fresh";
    wf.edge180 = "r0-test-age-180";
    wf.old181 = "r0-test-age-181";
    wf.removed = "r0-test-removed";
    wf.other = "r0-test-other";
    await insertWorkflow(wf.fresh, 0);
    await insertWorkflow(wf.edge180, 180);
    await insertWorkflow(wf.old181, 181);
    await insertWorkflow(wf.removed, 0, true);
    await insertWorkflow(wf.other, 5);
  });
  afterAll(async () => {
    await cleanup();
    await db.query("revoke community_writer from postgres");
    await db.end();
  });
  beforeEach(async () => {
    await db.query("delete from public.workflow_stars where workflow_id in (select id from public.workflows where slug like 'r0-test-%')");
    await db.query("delete from public.workflow_reactions where workflow_id in (select id from public.workflows where slug like 'r0-test-%')");
    await db.query("delete from public.community_rate");
    await db.query("delete from public.community_budget");
  });

  describe("tables are closed (CM-7)", () => {
    for (const role of ["anon", "authenticated", "community_writer"]) {
      for (const table of TABLES) {
        it(`${role} cannot select, insert, update or delete ${table}`, async () => {
          await rejects(as(role, `select * from public.${table} limit 1`), /permission denied/);
          await rejects(as(role, `insert into public.${table} select * from public.${table} limit 0`), /permission denied/);
          await rejects(as(role, `update public.${table} set ${UPDATE_COLUMN[table]} = ${UPDATE_COLUMN[table]}`), /permission denied/);
          await rejects(as(role, `delete from public.${table}`), /permission denied/);
        });
      }
    }

    it("RLS is enabled on all four tables, with no policies", async () => {
      const r = await db.query(
        `select c.relname, c.relrowsecurity, (select count(*) from pg_policy p where p.polrelid = c.oid)::int as policies
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relname = any($1)`,
        [TABLES],
      );
      expect(r.rows).toHaveLength(4);
      for (const row of r.rows as { relrowsecurity: boolean; policies: number }[]) {
        expect(row.relrowsecurity).toBe(true);
        expect(row.policies).toBe(0);
      }
    });
  });

  describe("functions and grants (CM-7)", () => {
    it("every community function is SECURITY DEFINER with a fixed search_path and no PUBLIC grant", async () => {
      const r = await db.query(
        `select p.proname, p.prosecdef, p.proconfig, p.proacl::text[] as proacl, pg_get_userbyid(p.proowner) as owner
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname like 'community\\_%'`,
      );
      const names = (r.rows as { proname: string }[]).map((x) => x.proname);
      for (const fn of [...WRITE_FNS, ...READ_FNS]) expect(names).toContain(fn);
      for (const row of r.rows as { proname: string; prosecdef: boolean; proconfig: string[] | null; proacl: string[] | null; owner: string }[]) {
        expect(row.prosecdef, row.proname).toBe(true);
        expect(row.owner, row.proname).toBe("postgres");
        expect(row.proconfig ?? [], row.proname).toContain("search_path=\"\"");
        // proacl null means the built-in default, which grants EXECUTE to PUBLIC.
        expect(row.proacl, row.proname).not.toBeNull();
        expect((row.proacl ?? []).some((a) => a.startsWith("=")), `${row.proname} granted to PUBLIC`).toBe(false);
      }
    });

    it("no function in public is executable by PUBLIC", async () => {
      const r = await db.query(
        `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and (p.proacl is null or exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0))`,
      );
      expect(r.rows).toEqual([]);
    });

    it("anon and authenticated cannot execute the write functions", async () => {
      for (const role of ["anon", "authenticated"]) {
        await rejects(as(role, "select public.community_set_star($1, $2, true)", [wf.fresh, uuid(1)]), /permission denied for function/);
        await rejects(as(role, "select public.community_set_reaction($1, $2, 'worked', true, null)", [wf.fresh, uuid(1)]), /permission denied for function/);
        await rejects(as(role, "select public.community_set_name($1, 'x')", [uuid(1)]), /permission denied for function/);
      }
      expect(await count("workflow_stars")).toBe(0);
    });

    it("a PostgREST /rpc call with the anon key is refused and writes nothing", async () => {
      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_ANON_KEY;
      if (!url || !key) return;
      const res = await fetch(`${url}/rest/v1/rpc/community_set_star`, {
        method: "POST",
        headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_slug: wf.fresh, p_client_id: uuid(1), p_on: true }),
      });
      expect([401, 403, 404]).toContain(res.status);
      expect(await count("workflow_stars")).toBe(0);
    });

    it("community_writer can execute exactly the three write functions and nothing else in public", async () => {
      const r = await db.query(
        `select p.proname, has_function_privilege('community_writer', p.oid, 'EXECUTE') as can
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'`,
      );
      const can = (r.rows as { proname: string; can: boolean }[]).filter((x) => x.can).map((x) => x.proname).sort();
      expect(can).toEqual([...WRITE_FNS].sort());
    });

    it("anon can execute exactly the three read functions", async () => {
      const r = await db.query(
        `select p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') as can
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'`,
      );
      const can = (r.rows as { proname: string; can: boolean }[]).filter((x) => x.can).map((x) => x.proname).sort();
      expect(can).toEqual([...READ_FNS].sort());
    });

    it("community_writer is NOINHERIT, has no other privileges, and is a member of no role", async () => {
      const r = await db.query(
        `select rolinherit, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls,
                (select count(*) from pg_auth_members m where m.member = r.oid)::int as memberships
         from pg_roles r where rolname = 'community_writer'`,
      );
      expect(r.rows[0]).toEqual({
        rolinherit: false,
        rolsuper: false,
        rolcreatedb: false,
        rolcreaterole: false,
        rolreplication: false,
        rolbypassrls: false,
        memberships: 0,
      });
    });

    it("the migration's role statement creates a NOLOGIN role with no stored secret (before seed.sql)", async () => {
      const dir = path.resolve(__dirname, "../../../supabase/migrations");
      const file = (await import("node:fs")).readdirSync(dir).find((f) => f.endsWith("_community.sql")) ?? "";
      const sql = readFileSync(path.join(dir, file), "utf8");
      const block = sql.match(/do \$\$[\s\S]*?create role community_writer[\s\S]*?\$\$;/i)?.[0];
      expect(block, "role DO block").toBeDefined();
      await db.query("begin");
      try {
        await db.query((block ?? "").replaceAll("community_writer", "community_writer_scratch"));
        const r = await db.query(`select rolcanlogin, rolpassword, rolinherit from pg_authid where rolname = 'community_writer_scratch'`);
        expect(r.rows).toEqual([{ rolcanlogin: false, rolpassword: null, rolinherit: false }]);
      } finally {
        await db.query("rollback");
      }
    });

    it("the real login works once db:local-roles / seed.sql has run (skipped when the role cannot log in yet)", async () => {
      const r = await db.query(`select rolcanlogin from pg_roles where rolname = 'community_writer'`);
      if (!(r.rows[0] as { rolcanlogin: boolean }).rolcanlogin) return;
      const { LOCAL_COMMUNITY_DATABASE_URL } = await import("../../../scripts/db/local-roles");
      const c = new Client({ connectionString: LOCAL_COMMUNITY_DATABASE_URL });
      await c.connect();
      try {
        await c.query("select public.community_set_star($1, $2, true)", [wf.fresh, uuid(7)]);
        await rejects(c.query("select * from public.workflow_stars"), /permission denied/);
      } finally {
        await c.end();
      }
      expect(await count("workflow_stars")).toBe(1);
    });
  });

  describe("another client cannot change yours (CM-7)", () => {
    it("a star survives client B switching it off", async () => {
      await star(wf.fresh, uuid(1), true);
      await star(wf.fresh, uuid(2), false);
      expect(await count("workflow_stars", `client_id = '${uuid(1)}'`)).toBe(1);
      const s = await as("anon", "select * from public.community_summary($1)", [[wf.fresh]]);
      expect(s.rows[0]).toMatchObject({ slug: wf.fresh, stars: 1 });
    });

    it("a reaction survives client B switching it off, and A's count is unchanged", async () => {
      await react(wf.fresh, uuid(1), "worked", true, "Ana");
      await react(wf.fresh, uuid(2), "worked", false);
      expect(await count("workflow_reactions", `client_id = '${uuid(1)}'`)).toBe(1);
      const s = await as("anon", "select * from public.community_summary($1)", [[wf.fresh]]);
      expect((s.rows[0] as { reactions: { worked: { count: number } } }).reactions.worked.count).toBe(1);
    });

    it("renaming as client B leaves A's name alone", async () => {
      await react(wf.fresh, uuid(1), "worked", true, "Ana");
      await react(wf.fresh, uuid(2), "worked", true, "Ben");
      await setName(uuid(2), "Bea");
      const r = await db.query("select client_id, display_name from public.workflow_reactions order by client_id");
      expect(r.rows).toEqual([
        { client_id: uuid(1), display_name: "Ana" },
        { client_id: uuid(2), display_name: "Bea" },
      ]);
    });

    it("set_name renames or removes the name on every reaction row of that client", async () => {
      await react(wf.fresh, uuid(1), "worked", true, "Ana");
      await react(wf.other, uuid(1), "learned", true, "Ana");
      await setName(uuid(1), "  Anna   Maria ");
      expect((await db.query("select distinct display_name from public.workflow_reactions")).rows).toEqual([{ display_name: "Anna Maria" }]);
      await setName(uuid(1), null);
      expect((await db.query("select distinct display_name from public.workflow_reactions")).rows).toEqual([{ display_name: null }]);
    });

    it("a write function never says whether a client_id exists", async () => {
      const known = await setName(uuid(1), "x");
      const unknown = await setName(uuid(99), "x");
      expect(known.rows).toEqual(unknown.rows);
      const a = await star(wf.fresh, uuid(1), false);
      const b = await star(wf.fresh, uuid(98), false);
      expect(a.rows).toEqual(b.rows);
    });

    it("writes are desired-state and idempotent", async () => {
      await star(wf.fresh, uuid(1), true);
      await star(wf.fresh, uuid(1), true);
      await react(wf.fresh, uuid(1), "learned", true);
      await react(wf.fresh, uuid(1), "learned", true);
      expect(await count("workflow_stars")).toBe(1);
      expect(await count("workflow_reactions")).toBe(1);
      await react(wf.fresh, uuid(1), "learned", false);
      await react(wf.fresh, uuid(1), "learned", false);
      expect(await count("workflow_reactions")).toBe(0);
    });

    it("any subset of the four reactions can be on for one client", async () => {
      for (const k of ["worked", "learned", "saved_time", "game_changer"]) await react(wf.fresh, uuid(1), k, true);
      expect(await count("workflow_reactions")).toBe(4);
    });
  });

  describe("no read returns a client_id (CM-7)", () => {
    it("summary, mine and my_stars expose no client_id column or value", async () => {
      await star(wf.fresh, uuid(1), true);
      await react(wf.fresh, uuid(1), "worked", true, "Ana");
      await react(wf.fresh, uuid(2), "worked", true);
      const outputs = [
        await as("anon", "select * from public.community_summary($1)", [[wf.fresh, wf.other]]),
        await as("anon", "select * from public.community_mine($1, $2)", [uuid(1), [wf.fresh, wf.other]]),
        await as("anon", "select * from public.community_my_stars($1)", [uuid(1)]),
      ];
      for (const out of outputs) {
        expect(out.rows.length).toBeGreaterThan(0);
        for (const f of out.fields) expect(f).not.toMatch(/client/);
        const text = JSON.stringify(out.rows);
        expect(text).not.toContain(uuid(1));
        expect(text).not.toContain(uuid(2));
      }
    });

    it("summary has the counts and the 2 most recent names per reaction", async () => {
      await star(wf.fresh, uuid(1), true);
      await star(wf.fresh, uuid(2), true);
      for (const [i, name] of [[1, "Ana"], [2, "Ben"], [3, "Cy"], [4, null], [5, null]] as const) {
        await react(wf.fresh, uuid(i), "worked", true, name);
        await db.query("update public.workflow_reactions set created_at = now() + ($1 || ' seconds')::interval where client_id = $2", [i, uuid(i)]);
      }
      const s = await as("anon", "select * from public.community_summary($1)", [[wf.fresh, wf.other, "r0-test-missing"]]);
      expect(s.rows.map((r) => r.slug).sort()).toEqual([wf.fresh, wf.other].sort());
      const fresh = s.rows.find((r) => r.slug === wf.fresh) as { stars: number; reactions: Record<string, { count: number; names: string[] }> };
      expect(fresh.stars).toBe(2);
      expect(fresh.reactions.worked).toEqual({ count: 5, names: ["Cy", "Ben"] });
      expect(fresh.reactions.learned).toEqual({ count: 0, names: [] });
      expect(Object.keys(fresh.reactions).sort()).toEqual(["game_changer", "learned", "saved_time", "worked"]);
    });

    it("summary leaves out removed workflows and archived ones still show their counts", async () => {
      const s = await as("anon", "select slug from public.community_summary($1)", [[wf.removed, wf.old181]]);
      expect(s.rows).toEqual([{ slug: wf.old181 }]);
    });

    it("mine returns booleans for the caller only", async () => {
      await star(wf.fresh, uuid(1), true);
      await react(wf.fresh, uuid(1), "worked", true);
      await react(wf.fresh, uuid(1), "game_changer", true);
      await react(wf.fresh, uuid(2), "learned", true);
      const m = await as("anon", "select * from public.community_mine($1, $2)", [uuid(1), [wf.fresh, wf.other]]);
      const byslug = Object.fromEntries((m.rows as { slug: string; starred: boolean; reactions: string[] }[]).map((r) => [r.slug, r]));
      expect(byslug[wf.fresh]).toMatchObject({ starred: true });
      expect([...(byslug[wf.fresh] as { reactions: string[] }).reactions].sort()).toEqual(["game_changer", "worked"]);
      expect(byslug[wf.other]).toMatchObject({ starred: false, reactions: [] });
    });

    it("my_stars lists the caller's stars newest first", async () => {
      await star(wf.fresh, uuid(1), true);
      await star(wf.other, uuid(1), true);
      await db.query(
        "update public.workflow_stars set created_at = now() - interval '1 hour' where client_id = $1 and workflow_id = (select id from public.workflows where slug = $2)",
        [uuid(1), wf.fresh],
      );
      const r = await as("anon", "select slug from public.community_my_stars($1)", [uuid(1)]);
      expect(r.rows.map((x) => x.slug)).toEqual([wf.other, wf.fresh]);
    });

    it("reads reject more than 100 slugs", async () => {
      const slugs = Array.from({ length: 101 }, (_, i) => `r0-test-s${i}`);
      await rejects(as("anon", "select * from public.community_summary($1)", [slugs]), /too_many_slugs/);
      await rejects(as("anon", "select * from public.community_mine($1, $2)", [uuid(1), slugs]), /too_many_slugs/);
    });
  });

  describe("validation (CM-7)", () => {
    it("rejects an unknown slug, a removed workflow and one aged 181 days with workflow_unavailable", async () => {
      for (const slug of ["r0-test-nope", wf.removed, wf.old181]) {
        await rejects(star(slug, uuid(1), true), /workflow_unavailable/);
        await rejects(react(slug, uuid(1), "worked", true), /workflow_unavailable/);
      }
      expect(await count("workflow_stars")).toBe(0);
      expect(await count("workflow_reactions")).toBe(0);
    });

    it("accepts a workflow aged exactly 180 days", async () => {
      await star(wf.edge180, uuid(1), true);
      await react(wf.edge180, uuid(1), "worked", true);
      expect(await count("workflow_stars")).toBe(1);
      expect(await count("workflow_reactions")).toBe(1);
    });

    it("rejects a reaction outside the four keys, here and in the table", async () => {
      await rejects(react(wf.fresh, uuid(1), "clap", true), /invalid_reaction/);
      await rejects(react(wf.fresh, uuid(1), "WORKED", true), /invalid_reaction/);
      await rejects(
        db.query("insert into public.workflow_reactions (workflow_id, client_id, reaction) select id, $1, 'clap' from public.workflows where slug = $2", [uuid(1), wf.fresh]),
        /violates check constraint/,
      );
    });

    it("rejects a client_id that is not a UUID v4", async () => {
      for (const bad of ["nope", "", "11111111-2222-1333-8444-555555555555", uuid(1) + "0"]) {
        await rejects(star(wf.fresh, bad, true), /invalid_client_id/);
        await rejects(setName(bad, "x"), /invalid_client_id/);
        await rejects(as("anon", "select * from public.community_mine($1, $2)", [bad, [wf.fresh]]), /invalid_client_id/);
        await rejects(as("anon", "select * from public.community_my_stars($1)", [bad]), /invalid_client_id/);
      }
    });

    it("rejects null arguments", async () => {
      await rejects(writer("select public.community_set_star($1, $2, null)", [wf.fresh, uuid(1)]), /invalid_/);
      await rejects(writer("select public.community_set_star(null, $1, true)", [uuid(1)]), /workflow_unavailable|invalid_/);
      await rejects(writer("select public.community_set_star($1, null, true)", [wf.fresh]), /invalid_client_id/);
    });

    it("rejects a 41-character name, and stores the sanitised name otherwise", async () => {
      await rejects(react(wf.fresh, uuid(1), "worked", true, "x".repeat(41)), /invalid_name/);
      await rejects(setName(uuid(1), "x".repeat(41)), /invalid_name/);
      await react(wf.fresh, uuid(1), "worked", true, "  Ra\u200bfael\u202e  ");
      expect((await db.query("select display_name from public.workflow_reactions")).rows).toEqual([{ display_name: "Rafael" }]);
    });

    it("a name made only of invisible characters is stored as NULL (anonymous)", async () => {
      await react(wf.fresh, uuid(1), "worked", true, "\u200b\u200d\ufeff");
      expect((await db.query("select display_name from public.workflow_reactions")).rows).toEqual([{ display_name: null }]);
    });

    it("the table refuses a name that breaks the rules even for the service role", async () => {
      const id = ((await db.query("select id from public.workflows where slug = $1", [wf.fresh])).rows[0] as { id: string }).id;
      for (const bad of ["", " lead", "double  space", "zero\u200bwidth", "ctl\u0007", "x".repeat(41)]) {
        await rejects(
          db.query("insert into public.workflow_reactions (workflow_id, client_id, reaction, display_name) values ($1, $2, 'worked', $3)", [id, uuid(1), bad]),
          /violates check constraint|invalid_name/,
        );
      }
    });

    it("the SQL name rule gives the same output as the JS rule on every shared vector", async () => {
      for (const v of vectors) {
        if ("invalid" in v && v.invalid) {
          await rejects(as(null, "select public.community_normalize_name($1) as n", [v.input]), /invalid_name/);
        } else {
          const r = await as(null, "select public.community_normalize_name($1) as n", [v.input]);
          expect(r.rows[0]?.n, v.name).toBe(v.output);
        }
      }
    });
  });

  describe("rate limits (CM-9)", () => {
    it("global: the 301st write in a minute from 301 different clients is rate_limited and writes nothing", async () => {
      const slugs: string[] = [];
      for (let i = 0; i < 6; i++) {
        const s = `r0-test-bulk-${i}`;
        await insertWorkflow(s, 0);
        slugs.push(s);
        extraSlugs.push(s);
      }
      for (let i = 0; i < 300; i++) await star(slugs[i % 6] as string, uuid(1000 + i), true);
      expect(await count("workflow_stars")).toBe(300);
      await rejects(star(slugs[0] as string, uuid(5000), true), /rate_limited/);
      expect(await count("workflow_stars")).toBe(300);
      // Reads are not limited.
      const s = await as("anon", "select * from public.community_summary($1)", [slugs]);
      expect(s.rows).toHaveLength(6);
      // After the window passes, writes succeed again.
      await db.query("update public.community_budget set window_start = now() - interval '2 minutes'");
      await star(slugs[0] as string, uuid(5000), true);
      expect(await count("workflow_stars")).toBe(301);
    });

    it("per workflow: the 61st write to one workflow from 61 different clients is rate_limited", async () => {
      for (let i = 0; i < 60; i++) await star(wf.fresh, uuid(2000 + i), true);
      await rejects(star(wf.fresh, uuid(2999), true), /rate_limited/);
      expect(await count("workflow_stars")).toBe(60);
      // Another workflow is unaffected.
      await star(wf.other, uuid(2999), true);
      // After the window passes, writes to the workflow succeed again.
      await db.query("update public.community_budget set window_start = now() - interval '2 minutes'");
      await star(wf.fresh, uuid(2999), true);
    });

    it("per client: the 31st burst write from one client is rate_limited, and it refills over time", async () => {
      for (let i = 0; i < 30; i++) await star(wf.fresh, uuid(1), i % 2 === 0);
      await rejects(star(wf.fresh, uuid(1), true), /rate_limited/);
      await db.query("update public.community_rate set refilled_at = now() - interval '10 seconds'");
      await star(wf.fresh, uuid(1), true); // 10s at 1 token per 2s = 5 tokens back
      for (let i = 0; i < 4; i++) await star(wf.fresh, uuid(1), true);
      await rejects(star(wf.fresh, uuid(1), true), /rate_limited/);
    });

    it("set_name is charged to the global budget and the client bucket, not a workflow's", async () => {
      for (let i = 0; i < 30; i++) await setName(uuid(1), "Ana");
      await rejects(setName(uuid(1), "Ana"), /rate_limited/);
      const scopes = (await db.query("select scope from public.community_budget")).rows as { scope: string }[];
      expect(scopes.map((r) => r.scope)).toEqual(["global"]);
    });

    it("charges in order global, then workflow, then client, and a rejected write charges nothing", async () => {
      for (let i = 0; i < 30; i++) await star(wf.fresh, uuid(1), true);
      const before = (await db.query("select scope, writes from public.community_budget order by scope")).rows;
      await rejects(star(wf.fresh, uuid(1), true), /rate_limited/);
      expect((await db.query("select scope, writes from public.community_budget order by scope")).rows).toEqual(before);
    });

    it("rejected invalid input does not consume budget", async () => {
      await rejects(star("r0-test-nope", uuid(1), true), /workflow_unavailable/);
      await rejects(star(wf.fresh, "nope", true), /invalid_client_id/);
      expect(await count("community_budget")).toBe(0);
      expect(await count("community_rate")).toBe(0);
    });

    it("growth is bounded: idle rate rows and past-window workflow budgets are pruned by the next write", async () => {
      await star(wf.fresh, uuid(1), true);
      await star(wf.other, uuid(2), true);
      await db.query("update public.community_rate set refilled_at = now() - interval '11 minutes' where client_id = $1", [uuid(1)]);
      await db.query("update public.community_budget set window_start = now() - interval '5 minutes' where scope like 'workflow:%'");
      await star(wf.fresh, uuid(3), true);
      const rate = (await db.query("select client_id from public.community_rate order by client_id")).rows as { client_id: string }[];
      expect(rate.map((r) => r.client_id)).toEqual([uuid(2), uuid(3)]);
      const scopes = (await db.query("select scope from public.community_budget")).rows as { scope: string }[];
      expect(scopes.filter((s) => s.scope === "global")).toHaveLength(1);
      expect(scopes.filter((s) => s.scope.startsWith("workflow:"))).toHaveLength(1);
    });

    it("concurrent writers cannot overshoot the global cap", async () => {
      await db.query("insert into public.community_budget (scope, window_start, writes) values ('global', now(), 298)");
      const clients = Array.from({ length: 6 }, () => new Client({ connectionString: DB_URL }));
      await Promise.all(clients.map((c) => c.connect()));
      try {
        const results = await Promise.allSettled(
          clients.map(async (c, i) => {
            await c.query("begin");
            try {
              await c.query("set local role community_writer");
              await c.query("select public.community_set_star($1, $2, true)", [i % 2 ? wf.fresh : wf.other, uuid(3000 + i)]);
              await c.query("commit");
            } catch (e) {
              await c.query("rollback");
              throw e;
            }
          }),
        );
        expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
        expect(await count("workflow_stars")).toBe(2);
      } finally {
        await Promise.all(clients.map((c) => c.end()));
      }
    });
  });

  describe("takedown (WF-43)", () => {
    it("hard-deleting a workflow cascades to its stars and reactions", async () => {
      await insertWorkflow("r0-test-takedown", 0);
      await star("r0-test-takedown", uuid(1), true);
      await react("r0-test-takedown", uuid(1), "worked", true);
      expect(await count("workflow_stars")).toBe(1);
      await db.query("delete from public.workflows where slug = 'r0-test-takedown'");
      expect(await count("workflow_stars")).toBe(0);
      expect(await count("workflow_reactions")).toBe(0);
    });
  });

  describe("indexes (PRD 18.6)", () => {
    it("has the three documented indexes", async () => {
      const r = await db.query(
        `select tablename, indexdef from pg_indexes where schemaname = 'public' and tablename in ('workflow_stars', 'workflow_reactions')`,
      );
      const defs = (r.rows as { tablename: string; indexdef: string }[]).map((x) => `${x.tablename}: ${x.indexdef}`).join("\n");
      expect(defs).toMatch(/workflow_stars.*\(client_id, created_at DESC\)/);
      expect(defs).toMatch(/workflow_reactions.*\(workflow_id, reaction, created_at DESC\)/);
      expect(defs).toMatch(/workflow_reactions.*\(client_id\)/);
    });
  });
});
