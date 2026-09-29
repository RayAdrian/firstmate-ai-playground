// Part C. See SPEC.md.

const TITLES = {
  breaking: "Breaking changes",
  feat: "Features",
  fix: "Fixes",
  perf: "Performance",
  refactor: "Refactors",
  docs: "Docs",
  test: "Tests",
  chore: "Chores",
  other: "Other",
};

const bullet = (commit) => (commit.scope ? `- ${commit.scope}: ${commit.subject}` : `- ${commit.subject}`);

export function renderMarkdown(groups, meta) {
  const lines = [`## v${meta.version} (${meta.date})`, ""];
  if (groups.length === 0) {
    lines.push("No user-facing changes.");
  } else {
    for (const group of groups) {
      lines.push(`### ${TITLES[group.type] ?? TITLES.other}`, ...group.commits.map(bullet), "");
    }
  }
  return `${lines.join("\n").trimEnd()}\n`;
}
