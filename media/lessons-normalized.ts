// The lessons the TL;DR render script works from, parsed and normalised by the SAME code the seed uses
// (scripts/seed/lib/lesson.ts parseLessonFile: NFC text, the lesson zod schema, trimmed points), so the title and tldr
// that render-tldr.ts hashes are exactly what the seed and the CI walker hash (PRD §19.5). Not a re-implementation.
// Run by render-tldr.ts through the root `tsx` (Node type stripping cannot load the seed's extensionless imports):
//   tsx lessons-normalized.ts [--props draft.json]   prints { "<slug>": { title, tool_versions, tldr | null } } as JSON
import fs from "node:fs";
import path from "node:path";
import { lessonTldrSchema, type LessonTldr } from "../src/lib/contracts";
import { parseLessonFile } from "../scripts/seed/lib/lesson";
import { normalizeText } from "../scripts/seed/lib/text";

export type NormalizedLesson = {
  slug: string;
  title: string;
  tool_versions: { claude_code: string; codex_cli: string };
  tldr: LessonTldr | null;
};

/** One lesson file, through the seed's parser. Throws with the seed's issues if it does not parse. */
export function normalizeLessonFile(raw: string, file: string): NormalizedLesson {
  const r = parseLessonFile(raw, file, { now: new Date() });
  if (!r.value) throw new Error(`${file}: ${r.issues.map((i) => `${i.field}: ${i.reason}`).join("; ")}`);
  const { slug, title, tool_versions, tldr } = r.value;
  return { slug, title, tool_versions, tldr };
}

/** A draft tldr (pilot --props file): same NFC step as the seed, then the lesson zod schema (trims the points). */
export function normalizeDraft(rawJson: string): Record<string, { tldr: LessonTldr; title?: string }> {
  const input = JSON.parse(normalizeText(rawJson)) as Record<string, { tldr: unknown; title?: string }>;
  return Object.fromEntries(
    Object.entries(input).map(([slug, d]) => [
      slug,
      { tldr: lessonTldrSchema.parse(d.tldr), ...(d.title === undefined ? {} : { title: d.title.trim().normalize("NFC") }) },
    ]),
  );
}

export function readLessons(repoRoot: string): Record<string, NormalizedLesson> {
  const dir = path.join(repoRoot, "content/lessons");
  const out: Record<string, NormalizedLesson> = {};
  for (const level of fs.readdirSync(dir)) {
    const levelDir = path.join(dir, level);
    if (!fs.statSync(levelDir).isDirectory()) continue;
    for (const f of fs.readdirSync(levelDir).filter((n) => n.endsWith(".md"))) {
      const file = path.join("content/lessons", level, f);
      const l = normalizeLessonFile(fs.readFileSync(path.join(levelDir, f), "utf8"), file);
      out[l.slug] = l;
    }
  }
  return out;
}

if (require.main === module) {
  const repoRoot = path.resolve(__dirname, "..");
  const i = process.argv.indexOf("--props");
  const drafts = i > 0 ? normalizeDraft(fs.readFileSync(path.resolve(process.argv[i + 1]), "utf8")) : {};
  process.stdout.write(JSON.stringify({ lessons: readLessons(repoRoot), drafts }));
}
