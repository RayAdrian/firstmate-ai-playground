import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DIR = path.resolve(__dirname, "../../../supabase/migrations");
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();

describe("migrations carry no credentials (PRD 18.4)", () => {
  it("finds the migrations", () => expect(files.length).toBeGreaterThanOrEqual(4));

  for (const file of files) {
    const sql = readFileSync(path.join(DIR, file), "utf8");
    it(`${file}: no PASSWORD anywhere`, () => {
      expect(sql).not.toMatch(/password/i);
    });
    it(`${file}: no LOGIN in a create role / alter role statement (NOLOGIN is fine)`, () => {
      const statements = sql.match(/\b(?:create|alter)\s+role\b[^;]*;/gi) ?? [];
      for (const s of statements) expect(s).not.toMatch(/\bLOGIN\b/i);
    });
  }

  it("the scan itself tells NOLOGIN from LOGIN", () => {
    const bad = "create role x with login;";
    const good = "create role x nologin noinherit;";
    expect(/\bLOGIN\b/i.test(bad)).toBe(true);
    expect(/\bLOGIN\b/i.test(good)).toBe(false);
  });

  it("the community migration creates community_writer NOLOGIN", () => {
    const file = files.find((f) => f.endsWith("_community.sql"));
    expect(file).toBeDefined();
    const sql = readFileSync(path.join(DIR, file ?? ""), "utf8");
    expect(sql).toMatch(/create role community_writer\s+nologin\s+noinherit/i);
  });

  it("the community migration sorts after the diagrams migration (G0)", () => {
    const file = files.find((f) => f.endsWith("_community.sql")) ?? "";
    expect(file > "20261002000000_workflow_diagrams.sql").toBe(true);
  });
});
