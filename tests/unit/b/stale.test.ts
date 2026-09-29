import { describe, expect, it } from "vitest";
import { findStale, isBehind, latestVersionsFromReleases, manilaDate } from "../../../scripts/seed/lib/stale";

const lessons = [
  { slug: "l1-permissions", last_verified_on: "2026-07-31", tool_versions: { claude_code: "2.1.0", codex_cli: "0.40.0" } },
  { slug: "l2-context-files", last_verified_on: "2026-08-01", tool_versions: { claude_code: "2.1.0", codex_cli: "0.40.0" } },
];

describe("manilaDate", () => {
  it("uses the Asia/Manila calendar date, not UTC", () => {
    expect(manilaDate(new Date("2026-09-30T00:30:00+08:00"))).toBe("2026-09-30");
    expect(manilaDate(new Date("2026-09-30T23:59:00+08:00"))).toBe("2026-09-30");
    expect(manilaDate(new Date("2026-09-29T16:30:00Z"))).toBe("2026-09-30");
  });
});

describe("findStale age (TC-B-45)", () => {
  for (const at of ["2026-09-30T13:00:00+08:00", "2026-09-30T23:59:00+08:00", "2026-09-30T00:30:00+08:00"]) {
    it(`lists 61 days but not 60 days at ${at}`, () => {
      const r = findStale({ lessons, now: new Date(at), latest: {} });
      expect(r.map((x) => x.slug)).toEqual(["l1-permissions"]);
      expect(r[0]?.reasons[0]).toMatchObject({ kind: "age", days: 61 });
    });
  }

  it("treats a never-verified lesson as stale", () => {
    const r = findStale({ lessons: [{ slug: "x", last_verified_on: null, tool_versions: {} }], now: new Date(), latest: {} });
    expect(r[0]?.reasons[0]).toMatchObject({ kind: "never" });
  });
});

describe("isBehind (TC-B-46)", () => {
  it("compares numerically and strips prefixes", () => {
    expect(isBehind("2.1.0", "2.1.0")).toBe(false);
    expect(isBehind("2.1.0", "2.1.1")).toBe(true);
    expect(isBehind("2.1.9", "2.1.10")).toBe(true);
    expect(isBehind("2.1.10", "2.1.9")).toBe(false);
    expect(isBehind("v2.1.0", "2.1.0")).toBe(false);
    expect(isBehind("rust-v0.40.0", "0.41.0")).toBe(true);
  });

  it("ignores a newer prerelease (AMB-B19)", () => {
    expect(isBehind("2.1.0", "2.2.0-beta.1")).toBe(false);
  });

  it("returns false for unparseable versions", () => {
    expect(isBehind("latest", "2.1.0")).toBe(false);
  });
});

describe("findStale versions", () => {
  it("names the lesson, tool and both versions", () => {
    const r = findStale({
      lessons: [lessons[1]!],
      now: new Date("2026-09-30T13:00:00+08:00"),
      latest: { claude_code: "2.1.1", codex_cli: "0.40.0" },
    });
    expect(r).toHaveLength(1);
    expect(r[0]?.reasons).toEqual([{ kind: "version", tool: "claude_code", lesson: "2.1.0", latest: "2.1.1" }]);
  });
});

describe("latestVersionsFromReleases", () => {
  it("picks the highest stable version per source", () => {
    const latest = latestVersionsFromReleases([
      { source_slug: "claude-code-releases", title: "v2.1.9" },
      { source_slug: "claude-code-releases", title: "v2.1.10" },
      { source_slug: "claude-code-releases", title: "v2.2.0-beta.1" },
      { source_slug: "codex-cli-releases", title: "rust-v0.41.0" },
      { source_slug: "hacker-news", title: "9.9.9 released" },
    ]);
    expect(latest).toEqual({ claude_code: "2.1.10", codex_cli: "0.41.0" });
  });

  it("returns an empty map when there is no release data", () => {
    expect(latestVersionsFromReleases([])).toEqual({});
  });
});
