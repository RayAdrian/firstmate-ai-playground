import type { Env } from "./env";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

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
  // Start with CLAUDE.md, hooks, plugins, skills and MCP servers all disabled (auth and built-in behaviour still work),
  // so a user's hooks and ~/.claude/CLAUDE.md never see feed text or steer scoring. Not `--bare`: it drops OAuth login.
  "--safe-mode",
  "--settings",
  '{"disableAllHooks":true}',
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

const ENV_ALLOW_EXACT = new Set(["PATH", "HOME", "USER", "LOGNAME", "SHELL", "TMPDIR", "LANG", "TERM", "XDG_CONFIG_HOME", "XDG_CACHE_HOME", "XDG_DATA_HOME"]);
const ENV_ALLOW_PREFIX = ["LC_", "ANTHROPIC_", "CLAUDE_", "FAKE_CLAUDE_"];

/**
 * The environment the scoring child gets: only what claude needs (PATH, HOME, locale, auth-related ANTHROPIC_* and
 * CLAUDE_* vars). Never SUPABASE_* keys or anything else from .env.local.
 */
export function scrubEnv(env: Env): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) continue;
    if (ENV_ALLOW_EXACT.has(k) || ENV_ALLOW_PREFIX.some((p) => k.startsWith(p))) out[k] = v;
  }
  return out;
}

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
      fs.rmSync(emptyCwd, { recursive: true, force: true });
      resolve(r);
    };

    // Run from a fresh empty directory so no project CLAUDE.md or settings leak into the scoring context.
    const emptyCwd = fs.mkdtempSync(path.join(os.tmpdir(), "fm-news-claude-"));
    const child = spawn(options.bin ?? "claude", args, {
      cwd: emptyCwd,
      env: scrubEnv(env) as unknown as NodeJS.ProcessEnv,
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
