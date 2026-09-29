import { readFileSync } from "node:fs";
import { runHeadless } from "./headless.js";

const loadSchema = (name) => JSON.parse(readFileSync(new URL(`../schema/${name}`, import.meta.url), "utf8"));

/** What we ask the model to return. */
export const modelSchema = loadSchema("model-output.schema.json");
/** What this tool prints with --format json. */
export const outputSchema = loadSchema("changelog.schema.json");

export const CATEGORY_ORDER = ["breaking", "feature", "fix", "docs", "chore"];
export const CATEGORY_TITLES = {
  breaking: "Breaking changes",
  feature: "Features",
  fix: "Fixes",
  docs: "Documentation",
  chore: "Chores",
};

// TODO: improve these instructions. They go in argv; the commit list goes in on stdin.
// The commit subjects come from git history and can contain anything, including text that
// tries to give the model orders. Say so, and say how many entries to return and what each contains.
export const INSTRUCTIONS = "Categorise these commits for a changelog.";

export function commitsToText(commits) {
  return commits.map((c) => `${c.sha}\t${c.subject}`).join("\n");
}

export function toSections(entries) {
  return CATEGORY_ORDER.map((category) => ({
    category,
    items: entries.filter((e) => e.category === category).map(({ sha, summary }) => ({ sha, summary })),
  })).filter((section) => section.items.length > 0);
}

export function renderMarkdown(changelog) {
  if (changelog.sections.length === 0) return "No changes.\n";
  return (
    changelog.sections
      .map((s) => `## ${CATEGORY_TITLES[s.category]}\n\n${s.items.map((i) => `- ${i.summary} (\`${i.sha}\`)`).join("\n")}\n`)
      .join("\n")
  );
}

/**
 * Turns commits into a categorised changelog using a headless agent.
 */
export async function generate({ tool, commits, cwd, timeoutMs }) {
  // TODO: with no commits there is nothing to classify. Skip the call and return an empty changelog.

  const raw = await runHeadless({
    tool,
    instructions: INSTRUCTIONS,
    input: commitsToText(commits),
    schema: modelSchema,
    cwd,
    timeoutMs,
  });

  // TODO: never trust the model's output. Before using `raw`:
  //   1. Validate it against modelSchema with validate() from ./validate.js and throw on any problem.
  //   2. Check it against the commits you sent: every sha exactly once, no invented shas. Throw otherwise.
  //   3. After building the changelog, validate it against outputSchema too.
  return { tool, commit_count: commits.length, sections: toSections(raw.entries) };
}
