// @vitest-environment node
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { describeTarget, resolveEnvFile, targetHost } from "../../../scripts/lib/env-profile";
import {
  LOCAL_COMMUNITY_DATABASE_URL,
  applyLocalRoles,
  localRolesSql,
} from "../../../scripts/db/local-roles";
import { scrubEnv } from "../../../scripts/news/claude";
import { loadLocalEnv } from "../../../scripts/seed/lib/env";
import { assertLocalSupabase } from "../../../scripts/seed/lib/local-guard";
import nextConfig from "../../../next.config";

const ROOT = path.resolve(__dirname, "../../..");

describe("DP-5: env profiles", () => {
  it("resolves .env.local by default and FM_ENV_FILE when set", () => {
    expect(resolveEnvFile({}, "/repo")).toBe("/repo/.env.local");
    expect(resolveEnvFile({ FM_ENV_FILE: ".env.hosted.local" }, "/repo")).toBe("/repo/.env.hosted.local");
    expect(resolveEnvFile({ FM_ENV_FILE: "" }, "/repo")).toBe("/repo/.env.local");
  });

  describe("loadLocalEnv", () => {
    const touched: string[] = [];
    afterEach(() => {
      for (const k of touched.splice(0)) delete process.env[k];
      delete process.env.FM_ENV_FILE;
    });

    it("loads the FM_ENV_FILE file instead of .env.local, and the real environment still wins", () => {
      const dir = mkdtempSync(path.join(os.tmpdir(), "fm-env-"));
      writeFileSync(path.join(dir, ".env.local"), "R0_PROFILE_PROBE=from-local\n");
      writeFileSync(path.join(dir, ".env.hosted.local"), "R0_PROFILE_PROBE=from-hosted\nR0_PROFILE_KEPT=file\n");
      touched.push("R0_PROFILE_PROBE", "R0_PROFILE_KEPT");
      process.env.R0_PROFILE_KEPT = "environment";
      process.env.FM_ENV_FILE = ".env.hosted.local";
      loadLocalEnv(dir);
      expect(process.env.R0_PROFILE_PROBE).toBe("from-hosted");
      expect(process.env.R0_PROFILE_KEPT).toBe("environment");
    });

    it("loads .env.local when FM_ENV_FILE is unset", () => {
      const dir = mkdtempSync(path.join(os.tmpdir(), "fm-env-"));
      writeFileSync(path.join(dir, ".env.local"), "R0_PROFILE_PROBE=from-local\n");
      touched.push("R0_PROFILE_PROBE");
      loadLocalEnv(dir);
      expect(process.env.R0_PROFILE_PROBE).toBe("from-local");
    });
  });

  it("names the target host, never the key", () => {
    expect(targetHost("https://abcd.supabase.co")).toBe("abcd.supabase.co");
    expect(targetHost("http://127.0.0.1:54421")).toBe("127.0.0.1");
    expect(targetHost(undefined)).toBe("(SUPABASE_URL not set)");
    expect(targetHost("not a url")).toBe("(invalid SUPABASE_URL)");
    expect(describeTarget("seed", { SUPABASE_URL: "https://abcd.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "secret-key" })).toBe(
      "seed → abcd.supabase.co",
    );
  });

  it("package.json scripts read FM_ENV_FILE and expose db:local-roles", () => {
    const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")) as { scripts: Record<string, string> };
    for (const name of ["seed", "db:reset:test", "news:run", "news:import", "news:rescore"]) {
      expect(pkg.scripts[name]).toContain("${FM_ENV_FILE:-.env.local}");
    }
    expect(pkg.scripts["db:local-roles"]).toContain("scripts/db/local-roles.ts");
  });

  it(".gitignore keeps the hosted profile out of the repo", () => {
    expect(readFileSync(path.join(ROOT, ".gitignore"), "utf8")).toMatch(/^\.env\*\.local$/m);
  });
});

describe("DP-6: destructive commands refuse a hosted database", () => {
  it("assertLocalSupabase accepts only 127.0.0.1, localhost and ::1", () => {
    for (const ok of ["http://127.0.0.1:54421", "http://localhost:54421", "http://[::1]:54421"]) {
      expect(() => assertLocalSupabase(ok)).not.toThrow();
    }
    for (const bad of [
      "https://abcd.supabase.co",
      "http://127.0.0.1.evil.com",
      "http://localhost.evil.com",
      "http://127.0.0.1@evil.com",
      "http://evil.com/127.0.0.1",
      "not a url",
    ]) {
      expect(() => assertLocalSupabase(bad)).toThrow(/local|valid URL/);
    }
    expect(() => assertLocalSupabase(undefined)).toThrow(/SUPABASE_URL/);
  });

  it("`db:reset:test` exits 1 with a message for a hosted SUPABASE_URL, before any write", () => {
    const res = spawnSync(process.execPath, [path.join(ROOT, "node_modules/tsx/dist/cli.mjs"), "scripts/seed/reset-test.ts"], {
      cwd: ROOT,
      encoding: "utf8",
      env: {
        ...({ PATH: process.env.PATH ?? "", NODE_ENV: "test" } as NodeJS.ProcessEnv),
        SUPABASE_URL: "https://abcd.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "not-a-real-key",
      },
      timeout: 60_000,
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/refusing to touch a hosted database/);
  });

  it("`db:local-roles` refuses a hosted SUPABASE_URL before it connects", async () => {
    const connect = vi.fn();
    await expect(applyLocalRoles({ SUPABASE_URL: "https://abcd.supabase.co" }, connect)).rejects.toThrow(/local/);
    expect(connect).not.toHaveBeenCalled();
  });

  it("`db:local-roles` refuses a non-local database URL too", async () => {
    const connect = vi.fn();
    await expect(
      applyLocalRoles({ SUPABASE_URL: "http://127.0.0.1:54421", LOCAL_DB_URL: "postgresql://postgres:x@db.abcd.supabase.co:5432/postgres" }, connect),
    ).rejects.toThrow(/local/);
    expect(connect).not.toHaveBeenCalled();
  });
});

describe("local community_writer login (PRD 18.4)", () => {
  it("db:local-roles sets login and the local-only value, idempotently", () => {
    const sql = localRolesSql();
    expect(sql).toMatch(/alter role community_writer with login/i);
    expect(sql).toContain("community_writer_local_only");
  });

  it("supabase/seed.sql carries the same statement", () => {
    const seed = readFileSync(path.join(ROOT, "supabase/seed.sql"), "utf8");
    expect(seed).toMatch(/alter role community_writer with login/i);
    expect(seed).toContain("community_writer_local_only");
  });

  it(".env.example holds the local COMMUNITY_DATABASE_URL, pointing at local Postgres only", () => {
    const example = readFileSync(path.join(ROOT, ".env.example"), "utf8");
    expect(example).toContain(`COMMUNITY_DATABASE_URL=${LOCAL_COMMUNITY_DATABASE_URL}`);
    expect(LOCAL_COMMUNITY_DATABASE_URL).toMatch(/^postgresql:\/\/community_writer:[^@]+@127\.0\.0\.1:54422\/postgres$/);
  });
});

describe("DP-7: the scorer never sees the Supabase or community credentials", () => {
  const env = {
    PATH: "/usr/bin",
    HOME: "/home/x",
    ANTHROPIC_API_KEY: "sk-ant-x",
    CLAUDE_CODE_OAUTH_TOKEN: "tok",
    SUPABASE_URL: "https://abcd.supabase.co",
    SUPABASE_ANON_KEY: "anon",
    SUPABASE_SERVICE_ROLE_KEY: "service",
    SUPABASE_JWT_SECRET: "jwt",
    COMMUNITY_DATABASE_URL: "postgresql://community_writer:pw@host:6543/postgres",
    FM_ENV_FILE: ".env.hosted.local",
    NEXT_PUBLIC_SUPABASE_URL: "x",
  };

  it("keeps what claude needs", () => {
    const out = scrubEnv(env);
    expect(out.PATH).toBe("/usr/bin");
    expect(out.ANTHROPIC_API_KEY).toBe("sk-ant-x");
    expect(out.CLAUDE_CODE_OAUTH_TOKEN).toBe("tok");
  });

  it("removes SUPABASE_*, COMMUNITY_DATABASE_URL and every other variable", () => {
    const out = scrubEnv(env);
    for (const key of Object.keys(out)) {
      expect(key).not.toMatch(/^SUPABASE_|COMMUNITY_DATABASE_URL|^NEXT_PUBLIC_|^FM_/);
    }
    expect(JSON.stringify(out)).not.toMatch(/service|anon"|community_writer|abcd\.supabase/);
  });

  it("removes them even when a future allowlist prefix would match", () => {
    const out = scrubEnv({ CLAUDE_SUPABASE_SERVICE_ROLE_KEY: "x", ANTHROPIC_COMMUNITY_DATABASE_URL: "y", CLAUDE_OK: "z" });
    expect(out).toEqual({ CLAUDE_OK: "z" });
  });
});

describe("DP-3a: noindex", () => {
  it("next.config sends X-Robots-Tag noindex, nofollow on every path", async () => {
    const rules = await nextConfig.headers?.();
    const rule = rules?.find((r) => r.source === "/:path*");
    expect(rule?.headers).toContainEqual({ key: "X-Robots-Tag", value: "noindex, nofollow" });
  });

  it("robots.txt disallows everything", () => {
    const robots = readFileSync(path.join(ROOT, "public/robots.txt"), "utf8");
    expect(robots.trim().split(/\r?\n/)).toEqual(["User-agent: *", "Disallow: /"]);
  });
});
