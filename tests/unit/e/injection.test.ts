// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runClaude } from "../../../scripts/news/claude";
import { decodeXml, parseFeed } from "../../../scripts/news/feed";
import { harness, src } from "./helpers/harness";

vi.setConfig({ testTimeout: 30_000 }); // process-spawning tests can be slow on a busy machine

const BIN_DIR = path.resolve(__dirname, "fixtures/bin");
const xml = decodeXml(fs.readFileSync(path.resolve(__dirname, "fixtures/injection.xml")), "application/xml");

let tmp: string;
let log: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "news-inj-"));
  log = path.join(tmp, "claude.log");
});
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

const env = (mode: string) => ({ PATH: `${BIN_DIR}:${path.dirname(process.execPath)}:/usr/bin:/bin`, FAKE_CLAUDE_MODE: mode, FAKE_CLAUDE_LOG: log });

describe("prompt-injection fixture end to end (I-3.3, TC-E-31)", () => {
  it("sends the injection item as delimited data, with no tools, over stdin", async () => {
    const h = harness({ sources: [src("inj")], feeds: { inj: parseFeed(xml) }, claude: undefined });
    await h.run({}, { claude: (p) => runClaude(p, { env: env("ok"), timeoutMs: 10_000 }) });
    const call = JSON.parse(fs.readFileSync(log, "utf8").trim().split("\n")[0]) as { argv: string[]; stdin: string };
    expect(call.argv).toEqual(expect.arrayContaining(["--tools", ""]));
    expect(call.argv.join(" ")).not.toMatch(/Ignore previous/i);
    expect(call.stdin.match(/<<<BEGIN_ITEM_/g)).toHaveLength(5);
    expect(call.stdin.match(/<<<END_ITEM_/g)).toHaveLength(5);
    // The injected item's own attempt to close the block was neutralised.
    expect(call.stdin).not.toContain("<<<END_ITEM_x>>>");
    expect(h.store.items.every((i) => i.scoring_status === "scored")).toBe(true);
    h.cleanup();
  });

  it("a model that gets hijacked cannot move other items: duplicate/extra results are rejected", async () => {
    const h = harness({ sources: [src("inj")], feeds: { inj: parseFeed(xml) } });
    const res = await h.run({}, { claude: (p) => runClaude(p, { env: env("score-injected-100"), timeoutMs: 10_000 }) });
    const scored = h.store.items.filter((i) => i.scoring_status === "scored");
    // Only the id that appeared exactly once is accepted; every duplicated id stays pending with no score.
    expect(scored).toHaveLength(1);
    expect(h.store.items.filter((i) => i.scoring_status === "pending").every((i) => i.score === null && i.attempts === 1)).toBe(true);
    expect(res.status).toBe("partial");
    h.cleanup();
  });
});
