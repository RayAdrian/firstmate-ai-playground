import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Runs a command, feeds `input` to stdin, and resolves with { code, stdout, stderr }. */
function run(cmd, args, { input, cwd, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`${cmd} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err.code === "ENOENT" ? new Error(`${cmd} was not found on PATH`) : err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    child.stdin.on("error", () => {}); // the tool may exit before reading all of stdin
    child.stdin.end(input);
  });
}

async function runClaude({ instructions, input, schema, cwd, timeoutMs }) {
  const args = [
    "-p",
    instructions,
    "--output-format",
    "json",
    "--json-schema",
    JSON.stringify(schema),
    "--tools",
    "", // no tools: this is classification, so the model gets nothing it could be tricked into using
    "--no-session-persistence",
  ];
  const { code, stdout, stderr } = await run("claude", args, { input, cwd, timeoutMs });
  if (code !== 0) throw new Error(`claude exited with code ${code}: ${(stderr || stdout).trim()}`);

  let envelope;
  try {
    envelope = JSON.parse(stdout);
  } catch {
    throw new Error("claude did not print a JSON result");
  }
  if (envelope.is_error) throw new Error(`claude reported an error: ${envelope.result}`);
  if (envelope.structured_output === undefined) throw new Error("claude returned no structured_output");
  return envelope.structured_output;
}

async function runCodex({ instructions, input, schema, cwd, timeoutMs }) {
  const dir = mkdtempSync(join(tmpdir(), "changelog-"));
  try {
    const schemaFile = join(dir, "schema.json");
    const outFile = join(dir, "out.json");
    writeFileSync(schemaFile, JSON.stringify(schema));

    const args = [
      "exec",
      "--ephemeral", // don't write a session file for a one-off job
      "--sandbox",
      "read-only", // the default, stated explicitly so the script doesn't depend on it
      "--skip-git-repo-check",
      "--output-schema",
      schemaFile,
      "-o",
      outFile,
      instructions, // stdin is appended to this as a <stdin> block
    ];
    const { code, stderr } = await run("codex", args, { input, cwd, timeoutMs });
    if (code !== 0) throw new Error(`codex exited with code ${code}: ${stderr.trim()}`);

    try {
      return JSON.parse(readFileSync(outFile, "utf8"));
    } catch {
      throw new Error("codex did not write a JSON final message");
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Runs one headless call and returns the parsed JSON the model produced. It does not
 * trust the result: the caller must validate it.
 * @param {{ tool: "claude" | "codex", instructions: string, input: string, schema: object, cwd?: string, timeoutMs?: number }} opts
 */
export async function runHeadless({ tool, instructions, input, schema, cwd = process.cwd(), timeoutMs = 120_000 }) {
  const opts = { instructions, input, schema, cwd, timeoutMs };
  if (tool === "claude") return runClaude(opts);
  if (tool === "codex") return runCodex(opts);
  throw new Error(`unknown tool: ${tool}`);
}
