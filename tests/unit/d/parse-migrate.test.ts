import { describe, expect, it } from "vitest";
import { emptyState, migrate, parseImportText, parseProgressText, type Migration } from "@/lib/progress";
import v1Full from "./fixtures/v1-full.json";

const V1 = JSON.stringify(v1Full);

describe("TC-D-28 migrations", () => {
  const identityV1toV2: Migration = { from: 1, to: 2, up: (d) => ({ ...d, version: 2 }) };

  it("runs a registered v1 -> v2 migration as identity on data", () => {
    const out = migrate(v1Full as Record<string, unknown>, { to: 2, registry: [identityV1toV2] });
    expect(out).toEqual({ ...v1Full, version: 2 });
  });

  it("chains steps in order, so v2 -> v3 can be appended without editing v1 -> v2", () => {
    const v2ToV3: Migration = { from: 2, to: 3, up: (d) => ({ ...d, extra: true }) };
    const out = migrate(v1Full as Record<string, unknown>, {
      to: 3,
      registry: [v2ToV3, identityV1toV2],
    });
    expect(out).toMatchObject({ version: 3, extra: true });
  });

  it("returns a current-version doc unchanged with the production registry", () => {
    expect(migrate(v1Full as Record<string, unknown>)).toBe(v1Full);
  });

  it("throws when there is no path", () => {
    expect(() => migrate({ version: 0 })).toThrow();
    expect(() => migrate({ version: 2 })).toThrow();
    expect(() => migrate({ version: "1" })).toThrow();
  });
});

describe("parseProgressText", () => {
  it("treats null as empty and a full v1 fixture as ok", () => {
    expect(parseProgressText(null)).toEqual({ kind: "empty" });
    const res = parseProgressText(V1);
    expect(res.kind).toBe("ok");
    if (res.kind === "ok") expect(res.state).toEqual(v1Full);
  });

  const invalid: [string, string][] = [
    ["invalid JSON", '{"version":1,'],
    ["null", "null"],
    ["number", "42"],
    ["array", "[]"],
    ["string", '"just a string"'],
    ["empty object", "{}"],
    ["wrong lessons type", '{"version":1,"lessons":"nope"}'],
    ["v0", JSON.stringify({ ...v1Full, version: 0 })],
    ["v2 on a v1 app", JSON.stringify({ ...v1Full, version: 2 })],
    ["string version", JSON.stringify({ ...v1Full, version: "1" })],
    ["bad tool", JSON.stringify({ ...v1Full, prefs: { tool: "vim" } })],
    [
      "non-ISO completedAt",
      JSON.stringify({ ...v1Full, lessons: { a: { completedAt: "yesterday" } } }),
    ],
    ["empty string", ""],
    ["5 MB of garbage", "x".repeat(5 * 1024 * 1024)],
  ];
  for (const [name, text] of invalid) {
    it(`rejects ${name}`, () => {
      expect(parseProgressText(text).kind).toBe("invalid");
    });
  }
});

describe("TC-D-42 prototype pollution", () => {
  const payload =
    '{"version":1,"lessons":{"__proto__":{"polluted":true},"constructor":{"prototype":{"x":1}}},"checklists":{},"bookmarks":{"lessons":{},"news":{}},"prefs":{"tool":"claude","__proto__":{"isAdmin":true}},"lastViewed":null}';

  it("never pollutes Object.prototype and leaves no dangerous keys", () => {
    const res = parseProgressText(payload);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(({} as Record<string, unknown>).isAdmin).toBeUndefined();
    expect((Object.prototype as Record<string, unknown>).x).toBeUndefined();
    if (res.kind === "ok") {
      expect(JSON.stringify(res.state)).not.toMatch(/__proto__|constructor|prototype/);
      expect(Object.keys(res.state.lessons)).toEqual([]);
    }
  });

  it("import path behaves the same", () => {
    const res = parseImportText(payload);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    if (res.ok) expect(JSON.stringify(res.state)).not.toMatch(/__proto__|constructor/);
  });
});

describe("parseImportText", () => {
  it("counts lessons and bookmarks as in the file", () => {
    const res = parseImportText(V1);
    expect(res).toMatchObject({ ok: true, lessons: 2, bookmarks: 2 });
  });

  it("names the problem class without echoing content", () => {
    expect(parseImportText('{"version":1,')).toEqual({ ok: false, reason: "invalid JSON" });
    expect(parseImportText('{"lessons":{}}')).toEqual({ ok: false, reason: "missing `version`" });
    expect(parseImportText(JSON.stringify({ ...emptyState(), version: 99 }))).toEqual({
      ok: false,
      reason: "unsupported version 99",
    });
    expect(parseImportText('{"version":1,"lessons":[]}')).toEqual({
      ok: false,
      reason: "not a progress file",
    });
    expect(parseImportText("")).toEqual({ ok: false, reason: "the file is empty" });
  });
});
