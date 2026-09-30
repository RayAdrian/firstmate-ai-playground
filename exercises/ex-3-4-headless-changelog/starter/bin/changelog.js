#!/usr/bin/env node
// Usage: changelog --tool claude|codex [--from-file <commits.txt>] [--range <git range>] [--format json|md]
// Exit codes: 0 ok, 1 generation failed (nothing is printed to stdout), 2 bad usage.
import { readCommits } from "../src/git.js";
import { generate, renderMarkdown } from "../src/generate.js";

function usage(message) {
  if (message) console.error(`changelog: ${message}`);
  console.error("usage: changelog --tool claude|codex [--from-file <commits.txt>] [--range <git range>] [--format json|md]");
  process.exit(2);
}

const opts = { format: "md" };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const flag = argv[i];
  const value = argv[i + 1];
  if (!["--tool", "--from-file", "--range", "--format"].includes(flag)) usage(`unknown argument ${flag}`);
  if (value === undefined) usage(`${flag} needs a value`);
  opts[flag.slice(2).replace("-f", "F")] = value;
  i++;
}
if (!["claude", "codex"].includes(opts.tool)) usage("--tool must be claude or codex");
if (!["json", "md"].includes(opts.format)) usage("--format must be json or md");

try {
  const commits = readCommits({ fromFile: opts.fromFile, range: opts.range });
  const changelog = await generate({ tool: opts.tool, commits });
  process.stdout.write(opts.format === "json" ? JSON.stringify(changelog, null, 2) + "\n" : renderMarkdown(changelog));
} catch (err) {
  console.error(`changelog: ${err.message}`);
  process.exit(1);
}
