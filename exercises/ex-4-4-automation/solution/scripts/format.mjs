// A tiny deterministic formatter, standing in for Prettier so this exercise has no dependencies.
// Rules: LF line endings, no trailing whitespace, leading tabs become two spaces,
// at most one blank line in a row, exactly one newline at the end of the file.
// CLI: node scripts/format.mjs <file...>   (rewrites files in place)
import { readFileSync, writeFileSync } from "node:fs";
import { extname } from "node:path";
import { fileURLToPath } from "node:url";

export const FORMATTABLE = new Set([".js", ".mjs", ".json", ".md"]);

export function formatSource(text) {
  const lines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/^\t+/, (tabs) => "  ".repeat(tabs.length)).replace(/\s+$/, ""));
  const out = [];
  for (const line of lines) {
    if (line === "" && out.length > 0 && out[out.length - 1] === "") continue;
    out.push(line);
  }
  while (out.length > 0 && out[out.length - 1] === "") out.pop();
  return out.length === 0 ? "" : out.join("\n") + "\n";
}

export function formatFile(path) {
  if (!FORMATTABLE.has(extname(path))) return false;
  const before = readFileSync(path, "utf8");
  const after = formatSource(before);
  if (after === before) return false;
  writeFileSync(path, after);
  return true;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const file of process.argv.slice(2)) {
    if (formatFile(file)) console.log(`formatted ${file}`);
  }
}
