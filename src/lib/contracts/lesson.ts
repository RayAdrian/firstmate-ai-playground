import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "expected kebab-case slug");

export const toolVersionsSchema = z.object({
  claude_code: z.string().min(1),
  codex_cli: z.string().min(1),
});

/** Caps for the lesson TL;DR (PRD §19.3). Characters are counted after trim, in UTF-16 code units (zod's .max). */
export const TLDR_CAPS = { points: 3, pointMin: 10, pointMax: 100, tryMax: 120 } as const;

const oneLine = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((s) => !/[\r\n]/.test(s), "one line only");

const tldrTry = z
  .object({
    /** command: a shell line; prompt: text to type into the agent. */
    kind: z.enum(["command", "prompt"]),
    text: oneLine(1, TLDR_CAPS.tryMax),
  })
  .strict();

export const lessonTldrSchema = z
  .object({
    points: z
      .array(oneLine(TLDR_CAPS.pointMin, TLDR_CAPS.pointMax))
      .length(TLDR_CAPS.points)
      .refine((p) => new Set(p).size === p.length, "points must be distinct"),
    try_this: z.union([
      // The same for both tools.
      z.object({ all: tldrTry }).strict(),
      // Per tool: both keys required.
      z.object({ claude: tldrTry, codex: tldrTry }).strict(),
    ]),
  })
  .strict();
export type LessonTldr = z.infer<typeof lessonTldrSchema>;

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
  /**
   * Lesson TL;DR (PRD §19.3). Optional until TL0b makes it required, once all 22 lessons
   * on main carry one. TL0b is a one-line change here (drop `.optional()`).
   */
  tldr: lessonTldrSchema.optional(),
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
