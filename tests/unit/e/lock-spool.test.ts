// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { acquireLock } from "../../../scripts/news/lock";
import { listSpoolFiles, readSpoolFile, removeSpoolFile, writeSpool } from "../../../scripts/news/spool";
import type { Candidate } from "../../../scripts/news/normalize";

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "news-lock-"));
});
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe("acquireLock (I-4.5, TC-E-43/44)", () => {
  it("blocks a second holder and releases cleanly", () => {
    const file = path.join(tmp, "run.lock");
    const a = acquireLock(file);
    expect(a.acquired).toBe(true);
    const b = acquireLock(file);
    expect(b.acquired).toBe(false);
    if (a.acquired) a.release();
    expect(fs.existsSync(file)).toBe(false);
    const c = acquireLock(file);
    expect(c.acquired).toBe(true);
    if (c.acquired) c.release();
  });

  it("removes a lock whose pid is dead", () => {
    const file = path.join(tmp, "run.lock");
    fs.writeFileSync(file, JSON.stringify({ pid: 2 ** 22 + 12345, startedAt: new Date().toISOString() }));
    const lock = acquireLock(file);
    expect(lock.acquired).toBe(true);
    if (lock.acquired) {
      expect(lock.removedStale).toBe(true);
      lock.release();
    }
  });

  it("removes a lock older than the max age even if the pid looks alive", () => {
    const file = path.join(tmp, "run.lock");
    fs.writeFileSync(file, JSON.stringify({ pid: process.pid, startedAt: new Date(Date.now() - 31 * 60_000).toISOString() }));
    const lock = acquireLock(file, { maxAgeMs: 30 * 60_000 });
    expect(lock.acquired).toBe(true);
    if (lock.acquired) lock.release();
  });

  it("release does not remove a lock that another run took over", () => {
    const file = path.join(tmp, "run.lock");
    const a = acquireLock(file, { maxAgeMs: 60_000 });
    fs.writeFileSync(file, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString(), token: "someone-else" }));
    if (a.acquired) a.release();
    expect(fs.existsSync(file)).toBe(true);
  });

  it("treats an unreadable lock as stale", () => {
    const file = path.join(tmp, "run.lock");
    fs.writeFileSync(file, "garbage");
    const lock = acquireLock(file);
    expect(lock.acquired).toBe(true);
    if (lock.acquired) lock.release();
  });
});

const cand = (n: number): Candidate => ({
  source_slug: "s",
  guid: `g${n}`,
  canonical_url: `https://a.com/${n}`,
  url: `https://a.com/${n}`,
  title: `t${n}`,
  author: null,
  published_at: "2026-09-29T00:00:00.000Z",
  first_seen_at: "2026-09-30T00:00:00.000Z",
  digest_date: "2026-09-30",
  excerpt: null,
});

describe("spool (I-4.4, TC-E-39/41/42)", () => {
  it("writes one JSON line per item and reads them back", () => {
    const file = writeSpool(tmp, [cand(1), cand(2)], new Date("2026-09-30T00:00:00Z"));
    expect(path.dirname(file)).toBe(tmp);
    expect(fs.readFileSync(file, "utf8").trim().split("\n")).toHaveLength(2);
    const back = readSpoolFile(file);
    expect(back.items.map((i) => i.canonical_url)).toEqual(["https://a.com/1", "https://a.com/2"]);
    expect(back.bad).toEqual([]);
    expect(listSpoolFiles(tmp)).toEqual([file]);
    removeSpoolFile(file);
    expect(listSpoolFiles(tmp)).toEqual([]);
  });

  it("isolates corrupt lines and reports line numbers", () => {
    const file = path.join(tmp, "2026.jsonl");
    fs.writeFileSync(file, [JSON.stringify(cand(1)), '{"url":', JSON.stringify(cand(3)), JSON.stringify({ url: "javascript:alert(1)" })].join("\n") + "\n");
    const back = readSpoolFile(file);
    expect(back.items).toHaveLength(2);
    expect(back.bad.map((b) => b.line)).toEqual([2, 4]);
  });

  it("does not list rejected files", () => {
    fs.writeFileSync(path.join(tmp, "x.jsonl.rejected"), "x");
    expect(listSpoolFiles(tmp)).toEqual([]);
  });
});
