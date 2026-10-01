import type { Diagram } from "@/lib/contracts/diagram";
import { checkLabelsFit, formatDiagramIssues, type DiagramLayoutFn } from "@/lib/diagram/fit";

/** Thin assertion wrapper over `checkLabelsFit` (PRD §17.3). Fails with the issues it returns. */
export function expectLabelsFit(diagram: Diagram, layout: DiagramLayoutFn): void {
  const issues = checkLabelsFit(diagram, layout);
  if (issues.length > 0) {
    throw new Error(
      `diagram "${diagram.id}" does not fit:\n${formatDiagramIssues(issues)
        .map((l) => `  - ${l}`)
        .join("\n")}`,
    );
  }
}
