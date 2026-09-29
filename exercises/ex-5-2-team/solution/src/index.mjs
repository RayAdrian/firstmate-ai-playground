// Glue. Owned by the orchestrator. See SPEC.md.
import { parseCommits } from "./parse.mjs";
import { groupByType } from "./group.mjs";
import { renderMarkdown } from "./render.mjs";

export function releaseNotes(text, meta) {
  return renderMarkdown(groupByType(parseCommits(text)), meta);
}
