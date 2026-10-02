// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseRunArgs, USAGE } from "../../../scripts/news/cli-args";
import { gateDecision, recordScheduledRun } from "../../../scripts/news/gate";

describe("parseRunArgs (I-5.5, TC-E-65)", () => {
  it("defaults to a full manual run", () => {
    expect(parseRunArgs([])).toEqual({ ok: true, args: { dryRun: false, noScore: false, rescoreOnly: false, sourceSlug: null, publish: false, gate: false } });
  });
  it("parses every documented flag", () => {
    expect(parseRunArgs(["--no-score", "--source=fx-simon", "--publish", "--gate"])).toEqual({
      ok: true,
      args: { dryRun: false, noScore: true, rescoreOnly: false, sourceSlug: "fx-simon", publish: true, gate: true },
    });
    expect(parseRunArgs(["--dry-run", "--rescore"])).toMatchObject({ ok: true, args: { dryRun: true, rescoreOnly: true } });
  });
  it("accepts --source <slug>", () => {
    const r = parseRunArgs(["--source", "fx-simon"]);
    expect(r.ok && r.args.sourceSlug).toBe("fx-simon");
  });
  it("rejects a typo instead of running a full write run", () => {
    const r = parseRunArgs(["--dryrun"]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain(USAGE.split("\n")[0]);
  });
  it("rejects --dry-run combined with --publish", () => {
    expect(parseRunArgs(["--dry-run", "--publish"]).ok).toBe(false);
  });
  it("rejects --rescore with --no-score", () => {
    expect(parseRunArgs(["--rescore", "--no-score"]).ok).toBe(false);
  });
  it("rejects positional arguments", () => {
    expect(parseRunArgs(["nope"]).ok).toBe(false);
  });
});

describe("schedule gate", () => {
  let tmp: string;
  let marker: string;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "news-gate-"));
    marker = path.join(tmp, "last-scheduled.json");
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it("stays closed before 07:00 Manila", () => {
    expect(gateDecision(marker, new Date("2026-09-30T06:59:00+08:00")).run).toBe(false);
  });
  it("opens at 07:00 Manila and later (late wake)", () => {
    expect(gateDecision(marker, new Date("2026-09-30T07:00:00+08:00")).run).toBe(true);
    expect(gateDecision(marker, new Date("2026-09-30T19:45:00+08:00")).run).toBe(true);
  });
  it("closes once a scheduled run finished today, reopens tomorrow", () => {
    recordScheduledRun(marker, "success", new Date("2026-09-30T07:05:00+08:00"));
    expect(gateDecision(marker, new Date("2026-09-30T09:00:00+08:00")).run).toBe(false);
    expect(gateDecision(marker, new Date("2026-10-01T07:00:00+08:00")).run).toBe(true);
  });
  it("keeps retrying after a failed run", () => {
    recordScheduledRun(marker, "failed", new Date("2026-09-30T07:05:00+08:00"));
    expect(gateDecision(marker, new Date("2026-09-30T09:00:00+08:00")).run).toBe(true);
  });
  it("ignores a corrupt marker", () => {
    fs.writeFileSync(marker, "garbage");
    expect(gateDecision(marker, new Date("2026-09-30T09:00:00+08:00")).run).toBe(true);
  });
});
