import type { ReactElement } from "react";
import type { Diagram } from "@/lib/contracts/diagram";
import { DiagramFigure } from "./diagram-figure";
import { parseDiagramYaml, validateDiagramValue } from "./parse";

/**
 * Runtime guard (DG-9): a stored diagram that fails to parse or validate is skipped (no figure, no empty frame) and
 * logged, never thrown, so one bad diagram can never break a page. The log carries the page context, the diagram id or
 * index and the reasons. It never carries diagram text, which could be anything an author typed.
 */
export function logSkippedDiagram(context: string, which: string, reasons: readonly string[]): void {
  console.warn(`[diagram] skipped ${which} on ${context}: ${reasons.join("; ")}`);
}

/** The id an author wrote, for the log line when the diagram itself is invalid. */
function guessId(source: string): string | null {
  return /^id:\s*([a-z0-9-]{1,32})\s*$/m.exec(source)?.[1] ?? null;
}

/** A fenced `diagram` block in lesson markdown. `index` is its 1-based position in the body. */
export function LessonDiagram({
  source,
  index,
  context,
  seenIds,
}: {
  source: string;
  index: number;
  context: string;
  /** Ids already rendered on this page: DOM ids are derived from the diagram id, so a repeat is skipped. */
  seenIds: Set<string>;
}): ReactElement | null {
  const which = `diagram ${guessId(source) ?? `#${index}`}`;
  const result = parseDiagramYaml(source);
  if (!result.ok) {
    logSkippedDiagram(context, which, result.issues.map((i) => `${i.path}: ${i.reason}`));
    return null;
  }
  if (seenIds.has(result.diagram.id)) {
    logSkippedDiagram(context, which, ["duplicate diagram id on this page"]);
    return null;
  }
  seenIds.add(result.diagram.id);
  return <DiagramFigure diagram={result.diagram} />;
}

/** A diagram already parsed from stored data (a workflow's `diagram` column), re-validated at read (DG-9). */
export function validateStoredDiagram(value: unknown, context: string): Diagram | null {
  if (value === null || value === undefined) return null;
  const result = validateDiagramValue(value);
  if (!result.ok) {
    logSkippedDiagram(context, "diagram", result.issues.map((i) => `${i.path}: ${i.reason}`));
    return null;
  }
  return result.diagram;
}
