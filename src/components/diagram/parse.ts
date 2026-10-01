/**
 * Parse and validate diagram data (PRD §17.3, §17.5). Pure, no React, so the seeds and `workflows:validate` import it.
 *
 *   parseDiagramYaml(text)    a lesson fence body -> YAML (anchors, aliases and tags rejected) -> `diagramSchema`
 *   validateDiagramValue(v)   an already-parsed value (a workflow's `diagram` field) -> `diagramSchema` -> `checkLabelsFit`
 *
 * Every failure is a list of `{ path, reason }` issues; nothing throws.
 */
import { isAlias, parseDocument, visit } from "yaml";
import { DIAGRAM_YAML_OPTIONS, diagramSchema, type Diagram } from "@/lib/contracts/diagram";
import { checkLabelsFit, diagramFitNotes, type DiagramIssue } from "@/lib/diagram/fit";
import { diagramLayout } from "./layout";

export type DiagramParseResult =
  | { ok: true; diagram: Diagram; notes: string[] }
  | { ok: false; issues: DiagramIssue[] };

/** Zod path -> `steps[0].label`. */
export function formatPath(path: readonly PropertyKey[]): string {
  return (
    path
      .map((p, i) => (typeof p === "number" ? `[${p}]` : `${i === 0 ? "" : "."}${String(p)}`))
      .join("") || "diagram"
  );
}

/** Schema check, then the label-fit and height check. */
export function validateDiagramValue(value: unknown): DiagramParseResult {
  const parsed = diagramSchema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map((i) => ({ path: formatPath(i.path), reason: i.message })) };
  }
  const issues = checkLabelsFit(parsed.data, diagramLayout);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, diagram: parsed.data, notes: diagramFitNotes(parsed.data, diagramLayout) };
}

/**
 * YAML text -> a plain value, or issues. Rejects anchors, aliases, explicit tags and anything the `yaml` parser reports
 * as an error or a warning (an unresolved custom tag is only a warning in `yaml`, so warnings count).
 */
export function parseDiagramYamlValue(source: string): { ok: true; value: unknown } | { ok: false; issues: DiagramIssue[] } {
  let doc;
  try {
    doc = parseDocument(source, DIAGRAM_YAML_OPTIONS);
  } catch (err) {
    return { ok: false, issues: [{ path: "diagram", reason: firstLine(err) }] };
  }
  const issues: DiagramIssue[] = [...doc.errors, ...doc.warnings].map((e) => ({
    path: "diagram",
    reason: e.message.split("\n")[0] ?? "invalid YAML",
  }));
  visit(doc, (_key, node) => {
    if (isAlias(node)) issues.push({ path: "diagram", reason: "YAML aliases are not allowed in a diagram" });
    else if (node && typeof node === "object") {
      if ("anchor" in node && node.anchor) issues.push({ path: "diagram", reason: "YAML anchors are not allowed in a diagram" });
      if ("tag" in node && node.tag) issues.push({ path: "diagram", reason: "YAML tags are not allowed in a diagram" });
    }
  });
  if (issues.length > 0) return { ok: false, issues: dedupe(issues) };
  try {
    return { ok: true, value: doc.toJS({ maxAliasCount: 0 }) as unknown };
  } catch (err) {
    return { ok: false, issues: [{ path: "diagram", reason: firstLine(err) }] };
  }
}

export function parseDiagramYaml(source: string): DiagramParseResult {
  const yaml = parseDiagramYamlValue(source);
  if (!yaml.ok) return yaml;
  return validateDiagramValue(yaml.value);
}

function firstLine(err: unknown): string {
  return err instanceof Error ? (err.message.split("\n")[0] ?? "invalid YAML") : "invalid YAML";
}

function dedupe(issues: DiagramIssue[]): DiagramIssue[] {
  const seen = new Set<string>();
  return issues.filter((i) => {
    const k = `${i.path}|${i.reason}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
