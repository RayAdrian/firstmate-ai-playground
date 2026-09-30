// Part A. See SPEC.md.

const CONVENTIONAL = /^([A-Za-z]+)(?:\(([^)]+)\))?(!)?:\s+(.+)$/;

export function parseCommit(line) {
  const trimmed = line.trim();
  if (trimmed === "") return null;
  const m = CONVENTIONAL.exec(trimmed);
  if (!m) return { type: "other", scope: null, breaking: false, subject: trimmed };
  return {
    type: m[1].toLowerCase(),
    scope: m[2] ?? null,
    breaking: m[3] === "!",
    subject: m[4].trim(),
  };
}

export function parseCommits(text) {
  return text
    .split("\n")
    .map(parseCommit)
    .filter((commit) => commit !== null);
}
