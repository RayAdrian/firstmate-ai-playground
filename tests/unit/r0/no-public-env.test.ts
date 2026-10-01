import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe("server-only Supabase and database settings (PRD 18.4)", () => {
  it("src/ references no NEXT_PUBLIC_SUPABASE* or NEXT_PUBLIC_*DATABASE* variable", () => {
    const offenders = walk(path.resolve(__dirname, "../../../src"))
      .filter((f) => /\.(ts|tsx|js|jsx|mjs)$/.test(f))
      .filter((f) => /NEXT_PUBLIC_(SUPABASE|[A-Z0-9_]*DATABASE)/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
