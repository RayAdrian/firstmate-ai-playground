import { createHash } from "node:crypto";
import type { LessonTldr } from "./lesson";

/**
 * The staleness hash of a lesson's TL;DR video (PRD §19.5). The one implementation: the MD-6 walker,
 * the lesson page's runtime check and media/remotion/render.ts all call this. It imports only node:crypto
 * (plus a type) so Node type stripping can load it.
 */
export function tldrSourceHash(input: { templateVersion: number; title: string; tldr: LessonTldr }): string {
  const { templateVersion, title, tldr } = input;
  const t = tldr.try_this;
  // Fixed key order, so the order of keys in the YAML cannot change the hash.
  const tryThis =
    "all" in t
      ? { all: { kind: t.all.kind, text: t.all.text } }
      : {
          claude: { kind: t.claude.kind, text: t.claude.text },
          codex: { kind: t.codex.kind, text: t.codex.text },
        };
  return createHash("sha256")
    .update(JSON.stringify(["fm-tldr", templateVersion, title, tldr.points, tryThis]), "utf8")
    .digest("hex");
}
