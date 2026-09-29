import type { Env } from "./env";
import { spawn } from "node:child_process";
import os from "node:os";

export const DEFAULT_CLAUDE_TIMEOUT_MS = 120_000;
const MAX_OUTPUT_BYTES = 5 * 1024 * 1024;

/**
 * Fixed flags for scoring calls (verified against `claude --help`, v2.1):
 * - `-p` headless, `--output-format json` single result envelope
 * - `--tools ""` disables every built-in tool (the model can only emit text)
 * - `--strict-mcp-config` with no `--mcp-config` means no MCP servers
 * - `--disable-slash-commands` disables skills; `--no-session-persistence` writes nothing to disk
 * The prompt goes on stdin, never argv. There is deliberately no permission-bypass flag.
 */
export const CLAUDE_ARGS: readonly string[] = [
  "-p",
  "--output-format",
  "json",
  "--tools",
  "",
  "--strict-mcp-config",
  "--disable-slash-commands",
  "--no-session-persistence",
];

export type ClaudeResult =
  | { kind: "ok"; text: string; model: string | null }
  /** claude cannot run at all (missing or not logged in): retrying other batches this run is pointless. */
  | { kind: "unavailable"; reason: string }
  /** This batch failed (non-zero exit, timeout, unreadable output); the next batch may still work. */
  | { kind: "error"; reason: string };

export type ClaudeRunner = (prompt: { system: string; user: string }) => Promise<ClaudeResult>;

const AUTH_PATTERN = /not logged in|please run \/login|invalid api key|authentication|unauthori[sz]ed|credentials|oauth/i;
const LOGIN_REASON = "claude not logged in (run `claude` once and complete /login)";

export interface RunClaudeOptions {
  env?: Env;
  timeoutMs?: number;
  bin?: string;
}

export async function runClaude(prompt: { system: string; user: string }, options: RunClaudeOptions = {}): Promise<ClaudeResult> {
  const env = options.env ?? process.env;
  const timeoutMs = options.timeoutMs ?? DEFAULT_CLAUDE_TIMEOUT_MS;
  const args = [...CLAUDE_ARGS, "--system-prompt", prompt.system];
  if (env.NEWS_CLAUDE_MODEL) args.push("--model", env.NEWS_CLAUDE_MODEL);

  return new Promise<ClaudeResult>((resolve) => {
    let settled = false;
    const finish = (r: ClaudeResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(r);
    };

    // Run from a neutral directory so no project CLAUDE.md or settings leak into the scoring context.
    const child = spawn(options.bin ?? "claude", args, {
      cwd: os.tmpdir(),
      env: env as NodeJS.ProcessEnv,
      shell: false,
      detached: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const out: Buffer[] = [];
    const err: Buffer[] = [];
    let outBytes = 0;
    let tooBig = false;

    const killTree = () => {
      try {
        if (child.pid) process.kill(-child.pid, "SIGKILL");
      } catch {
        child.kill("SIGKILL");
      }
    };
    const timer = setTimeout(() => {
      killTree();
      finish({ kind: "error", reason: `timeout after ${Math.round(timeoutMs / 1000)}s` });
    }, timeoutMs);

    child.on("error", (e: NodeJS.ErrnoException) => {
      finish(e.code === "ENOENT" ? { kind: "unavailable", reason: "claude not found on PATH" } : { kind: "error", reason: `spawn failed (${e.code ?? "unknown"})` });
    });
    child.stdout.on("data", (c: Buffer) => {
      outBytes += c.length;
      if (outBytes > MAX_OUTPUT_BYTES) {
        tooBig = true;
        killTree();
        return;
      }
      out.push(c);
    });
    child.stderr.on("data", (c: Buffer) => {
      if (err.length < 50) err.push(c);
    });
    child.stdin.on("error", () => {
      // child exited before reading stdin; the close handler reports the outcome
    });
    child.on("close", (code) => {
      const stdout = Buffer.concat(out).toString("utf8");
      const stderr = Buffer.concat(err).toString("utf8");
      if (tooBig) return finish({ kind: "error", reason: "output too large" });
      if (code !== 0) {
        if (AUTH_PATTERN.test(stderr) || AUTH_PATTERN.test(stdout)) return finish({ kind: "unavailable", reason: LOGIN_REASON });
        return finish({ kind: "error", reason: `exit ${code}` });
      }
      finish(parseEnvelope(stdout));
    });

    child.stdin.end(prompt.user);
  });
}

function parseEnvelope(stdout: string): ClaudeResult {
  let env: unknown;
  try {
    env = JSON.parse(stdout);
  } catch {
    return { kind: "error", reason: "unreadable claude output (not JSON)" };
  }
  if (typeof env !== "object" || env === null) return { kind: "error", reason: "unreadable claude output" };
  const e = env as { is_error?: unknown; result?: unknown; modelUsage?: unknown };
  const result = typeof e.result === "string" ? e.result : "";
  if (e.is_error === true) {
    return AUTH_PATTERN.test(result) ? { kind: "unavailable", reason: LOGIN_REASON } : { kind: "error", reason: "claude reported an error" };
  }
  const model = e.modelUsage && typeof e.modelUsage === "object" ? (Object.keys(e.modelUsage)[0] ?? null) : null;
  return { kind: "ok", text: result, model };
}
