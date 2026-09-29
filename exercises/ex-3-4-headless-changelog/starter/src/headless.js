import { spawn } from "node:child_process";

/** Runs a command, feeds `input` to stdin, and resolves with { code, stdout, stderr }. Provided for you. */
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

// TODO: call `claude` headlessly and return the parsed structured result.
//   opts is { instructions, input, schema, cwd, timeoutMs }.
//   - Non-interactive print mode, JSON output, and the schema passed with --json-schema (a string).
//   - Disable all tools: this job is classification, so the model needs none.
//   - Don't write a session to disk.
//   - Send `instructions` as the prompt argument and `input` (untrusted data) on stdin.
//   - Throw on a non-zero exit code, on stdout that isn't JSON, on `is_error`, or when the
//     answer is missing. Return the `structured_output` field.
async function runClaude(opts) {
  void [run, opts];
  throw new Error("TODO: implement runClaude");
}

// TODO: call `codex` headlessly and return the parsed result. (Same opts.)
//   - Use the exec subcommand, ephemeral (no session file), in a read-only sandbox.
//   - The schema must be a FILE for --output-schema: write it to a temp dir.
//   - Have Codex write its final message to a file with -o, then read and parse that file.
//   - Send `instructions` as the prompt argument and `input` on stdin.
//   - Throw on a non-zero exit code or unparseable output. Clean up the temp dir.
async function runCodex(opts) {
  void opts;
  throw new Error("TODO: implement runCodex");
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
