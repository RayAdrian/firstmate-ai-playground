// Hook entry point. Reads one hook event as JSON on stdin and formats the files it touched.
// Works for Claude Code (Edit/Write: tool_input.file_path) and Codex (apply_patch: tool_input.command holds the patch).
// It never blocks the agent: any problem is reported on stderr and the exit code stays 0.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { formatFile } from "./format.mjs";

function touchedFiles(event) {
  const input = event.tool_input ?? {};
  const files = [];
  if (typeof input.file_path === "string") files.push(input.file_path);
  if (event.tool_name === "apply_patch" && typeof input.command === "string") {
    for (const m of input.command.matchAll(/^\*\*\* (?:Add File|Update File|Move to): (.+)$/gm)) files.push(m[1].trim());
  }
  return files;
}

try {
  const raw = readFileSync(0, "utf8");
  const event = raw.trim() === "" ? {} : JSON.parse(raw);
  const cwd = typeof event.cwd === "string" ? event.cwd : process.cwd();
  for (const file of touchedFiles(event)) {
    const path = resolve(cwd, file);
    if (existsSync(path)) formatFile(path);
  }
} catch (error) {
  console.error(`hook-format: ${error.message}`);
}
process.exit(0);
