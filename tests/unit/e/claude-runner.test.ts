// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CLAUDE_ARGS, DEFAULT_CLAUDE_TIMEOUT_MS, runClaude } from "../../../scripts/news/claude";

const BIN_DIR = path.resolve(__dirname, "fixtures/bin");
let tmp: string;
let log: string;

function env(extra: Record<string, string> = {}): Record<string, string> {
  return { PATH: `${BIN_DIR}:${path.dirname(process.execPath)}:/usr/bin:/bin`, FAKE_CLAUDE_LOG: log, ...extra };
}
const prompt = { system: "SYS", user: 'x\n<<<BEGIN_ITEM_ab12 id="id-1">>>\n<<<END_ITEM_ab12>>>' };

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "news-claude-"));
  log = path.join(tmp, "claude.log");
});
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

const calls = () =>
  fs
    .readFileSync(log, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as { argv: string[]; stdin: string; cwd: string });

describe("runClaude (I-3.3, I-4.1, TC-E-30/34/35/37)", () => {
  it("invokes claude with no tools, prompt on stdin, and no unsafe flags", async () => {
    const res = await runClaude(prompt, { env: env(), timeoutMs: 5000 });
    expect(res.kind).toBe("ok");
    const [call] = calls();
    expect(call.argv[0]).toBe("-p");
    expect(call.argv).toEqual(expect.arrayContaining(["--output-format", "json", "--tools", ""]));
    expect(call.argv).toEqual(expect.arrayContaining([...CLAUDE_ARGS]));
    expect(call.argv.join(" ")).not.toMatch(/dangerously|allowedTools|(^| )--mcp-config/);
    expect(call.argv.join(" ")).not.toContain("BEGIN_ITEM");
    expect(call.stdin).toContain('id="id-1"');
    expect(call.cwd).not.toBe(process.cwd());
  });

  it("returns text and the model name", async () => {
    const res = await runClaude(prompt, { env: env(), timeoutMs: 5000 });
    if (res.kind !== "ok") throw new Error("expected ok");
    expect(res.text).toContain('"id":"id-1"');
    expect(res.model).toBe("fake-model-1");
  });

  it("reports a missing binary as unavailable", async () => {
    const res = await runClaude(prompt, { env: { PATH: "/usr/bin:/bin" }, timeoutMs: 5000 });
    expect(res).toMatchObject({ kind: "unavailable", reason: "claude not found on PATH" });
  });

  it("reports a login problem as unavailable", async () => {
    const res = await runClaude(prompt, { env: env({ FAKE_CLAUDE_MODE: "not-logged-in" }), timeoutMs: 5000 });
    expect(res).toMatchObject({ kind: "unavailable" });
    if (res.kind === "unavailable") expect(res.reason).toMatch(/login|logged in|auth/i);
  });

  it("reports a non-zero exit as a retryable error", async () => {
    const res = await runClaude(prompt, { env: env({ FAKE_CLAUDE_MODE: "nonzero" }), timeoutMs: 5000 });
    expect(res).toMatchObject({ kind: "error" });
    if (res.kind === "error") expect(res.reason).toMatch(/exit 3/);
  });

  it("reports an is_error envelope as an error", async () => {
    const res = await runClaude(prompt, { env: env({ FAKE_CLAUDE_MODE: "is-error" }), timeoutMs: 5000 });
    expect(res.kind).toBe("error");
  });

  it("kills the child on timeout", async () => {
    const started = Date.now();
    const res = await runClaude(prompt, { env: env({ FAKE_CLAUDE_MODE: "timeout" }), timeoutMs: 800 });
    expect(Date.now() - started).toBeLessThan(5000);
    expect(res).toMatchObject({ kind: "error" });
    if (res.kind === "error") expect(res.reason).toMatch(/timeout/);
  });

  it("defaults the timeout to 120s", () => {
    expect(DEFAULT_CLAUDE_TIMEOUT_MS).toBe(120_000);
  });
});
