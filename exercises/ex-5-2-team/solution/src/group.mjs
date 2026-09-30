// Part B. See SPEC.md.

const ORDER = ["feat", "fix", "perf", "refactor", "docs", "test", "chore", "other"];

export function groupByType(commits) {
  const buckets = new Map([["breaking", []], ...ORDER.map((type) => [type, []])]);
  for (const commit of commits) {
    const key = commit.breaking ? "breaking" : ORDER.includes(commit.type) ? commit.type : "other";
    buckets.get(key).push(commit);
  }
  return [...buckets]
    .filter(([, list]) => list.length > 0)
    .map(([type, list]) => ({ type, commits: list }));
}
