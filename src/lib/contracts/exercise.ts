import { z } from "zod";

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "expected kebab-case slug");

/**
 * exercises/<slug>/exercise.json (PRD S-1, E-4).
 * `verify` is a shell command run in starter/ (must fail) and solution/ (must pass), or "manual".
 * Display fields are optional here so WS-B may derive them from README.md / CHECKLIST.md.
 */
export const exerciseJsonSchema = z.object({
  slug,
  verify: z.union([z.literal("manual"), z.string().min(1)]),
  required_tool_features: z.array(z.string().min(1)),
  title: z.string().min(1).optional(),
  goal: z.string().min(1).optional(),
  setup_cmd: z.string().min(1).optional(),
  starter_prompts: z.object({ claude: z.string().min(1), codex: z.string().min(1) }).optional(),
  /** 2-5 notes for "What the reference solution does differently" (E-3). */
  solution_notes: z.array(z.string().min(1)).min(2).max(5).optional(),
});
export type ExerciseJson = z.infer<typeof exerciseJsonSchema>;

/** A checklist item; ids are stable across rewordings (E-2). */
export const checklistItemSchema = z.object({ id: z.string().min(1), text: z.string().min(1) });
export type ChecklistItem = z.infer<typeof checklistItemSchema>;
