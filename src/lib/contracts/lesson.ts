import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "expected kebab-case slug");

export const toolVersionsSchema = z.object({
  claude_code: z.string().min(1),
  codex_cli: z.string().min(1),
});

/** Frontmatter of content/lessons/<level>/<slug>.md (PRD S-1). */
export const lessonFrontmatterSchema = z.object({
  slug,
  level: z.number().int().min(1).max(5),
  sort: z.number().int().nonnegative(),
  title: z.string().min(1),
  objective: z.string().min(1),
  est_minutes: z.number().int().positive(),
  tool_versions: toolVersionsSchema,
  last_verified_on: isoDate,
  /** 1-5 bullets rendered in the "Key differences" callout (L-3). */
  differences: z.array(z.string().min(1)).min(1).max(5),
  /** Slug of the lesson's exercise, matching exercises/<slug>/exercise.json. */
  exercise: slug,
  /** Set when a tool has no native equivalent (S-4); its body may then be a workaround note. */
  claude_no_equivalent: z.boolean().default(false),
  codex_no_equivalent: z.boolean().default(false),
});
export type LessonFrontmatter = z.infer<typeof lessonFrontmatterSchema>;

/** One entry of content/levels.yaml. */
export const levelContentSchema = z.object({
  number: z.number().int().min(1).max(5),
  slug,
  title: z.string().min(1),
  summary: z.string().min(1),
});
export type LevelContent = z.infer<typeof levelContentSchema>;
export const levelsFileSchema = z.object({ levels: z.array(levelContentSchema).min(1).max(5) });
export type LevelsFile = z.infer<typeof levelsFileSchema>;
