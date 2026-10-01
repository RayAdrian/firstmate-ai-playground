/**
 * Finds `diagram` fences in a lesson body and validates them for the seed (PRD §17.4, DG-7). Pure and React-free, so
 * `scripts/seed/lib/lesson.ts` can import it. Fence tracking matches CommonMark: a fence opens with 3+ backticks or
 * tildes and closes with the same character, at least as long, and nothing after it.
 */
import { DIAGRAM_MAX_PER_LESSON } from "@/lib/contracts/diagram";
import { parseDiagramYamlValue, validateDiagramValue } from "./parse";

export interface DiagramFence {
  /** 1-based position among the diagram fences of the body. */
  index: number;
  /** The `## ` heading the fence sits under, or null before the first one. */
  section: string | null;
  source: string;
  /** Absolute file line of the opening fence. */
  line: number;
}

export function extractDiagramFences(body: string, startLine: number): DiagramFence[] {
  const out: DiagramFence[] = [];
  let section: string | null = null;
  let fence: { char: string; len: number; diagram: boolean; open: number; buf: string[] } | null = null;
  body.split("\n").forEach((line, i) => {
    const f = /^ {0,3}(`{3,}|~{3,})\s*(.*)$/.exec(line);
    if (fence) {
      if (f && f[1]![0] === fence.char && f[1]!.length >= fence.len && f[2]!.trim() === "") {
        if (fence.diagram) {
          out.push({ index: out.length + 1, section, source: fence.buf.join("\n"), line: startLine + fence.open });
        }
        fence = null;
      } else fence.buf.push(line);
      return;
    }
    if (f && !(f[1]![0] === "`" && f[2]!.includes("`"))) {
      const lang = (f[2] ?? "").trim().split(/\s+/)[0]?.toLowerCase() ?? "";
      fence = { char: f[1]![0]!, len: f[1]!.length, diagram: lang === "diagram", open: i, buf: [] };
      return;
    }
    const h = /^## (.+?)\s*$/.exec(line);
    if (h) section = h[1] ?? null;
  });
  return out;
}

export interface DiagramFenceIssue {
  line: number;
  /** `diagram <id or #n>: <field>` */
  field: string;
  reason: string;
}

export interface DiagramFenceReport {
  issues: DiagramFenceIssue[];
  /** Non-failing notes (a horizontal drawing that fell back to the stacked form). */
  notes: DiagramFenceIssue[];
}

/** Every DG-7 rule for one lesson body. */
export function validateLessonDiagrams(body: string, startLine: number): DiagramFenceReport {
  const issues: DiagramFenceIssue[] = [];
  const notes: DiagramFenceIssue[] = [];
  const seen = new Set<string>();
  for (const fence of extractDiagramFences(body, startLine)) {
    const yaml = parseDiagramYamlValue(fence.source);
    const raw = yaml.ok && typeof yaml.value === "object" && yaml.value !== null ? (yaml.value as { id?: unknown }).id : undefined;
    const id = typeof raw === "string" && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(raw) && raw.length <= 32 ? raw : `#${fence.index}`;
    const at = (field: string, reason: string) => issues.push({ line: fence.line + 1, field: `diagram ${id}: ${field}`, reason });

    if (fence.section !== "Concept") at("fence", `a diagram fence is only allowed inside ## Concept (found ${fence.section ? `under ## ${fence.section}` : "before any section"})`);
    if (fence.index > DIAGRAM_MAX_PER_LESSON) at("fence", `at most ${DIAGRAM_MAX_PER_LESSON} diagrams per lesson`);

    if (!yaml.ok) {
      for (const i of yaml.issues) at(i.path, i.reason);
      continue;
    }
    const result = validateDiagramValue(yaml.value);
    if (!result.ok) {
      for (const i of result.issues) at(i.path, i.reason);
      continue;
    }
    if (seen.has(result.diagram.id)) at("id", `duplicate diagram id "${result.diagram.id}" in this lesson`);
    seen.add(result.diagram.id);
    for (const note of result.notes) {
      notes.push({ line: fence.line + 1, field: `diagram ${id}`, reason: note.replace(/^diagram [^:]+: /, "") });
    }
  }
  return { issues, notes };
}
