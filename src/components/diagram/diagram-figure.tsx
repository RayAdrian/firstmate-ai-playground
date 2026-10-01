import type { ReactElement } from "react";
import { ChevronRight } from "lucide-react";
import type { Diagram } from "@/lib/contracts/diagram";
import styles from "./diagram.module.css";
import { layoutDiagram } from "./layout";
import { DiagramSvg } from "./svg";
import { DiagramTextBody } from "./text-alternative";

// A server component with no client JS (DG-2): the server cannot see the viewport, so both orientations are emitted
// and CSS shows one. `display:none` removes the hidden SVG from the accessibility tree.

const FRAME = {
  // Lessons: a card in the lesson column.
  card: "my-8 rounded-card border border-border bg-surface p-4 md:p-6",
  // Workflows: an edge-to-edge band inside the "Why it works" callout (DESIGN §6.3.3), never a card in a card.
  band: "-mx-5 my-4 border-y border-border bg-surface px-4 py-4 md:px-6 md:py-6",
} as const;

export function DiagramFigure({ diagram, frame = "card" }: { diagram: Diagram; frame?: keyof typeof FRAME }): ReactElement {
  const horizontal = layoutDiagram(diagram, "horizontal");
  const vertical = layoutDiagram(diagram, "vertical");
  // A horizontal drawing that fell back to the stacked geometry is 280 wide and keeps the narrow cap.
  const hCap = horizontal.drawing.width === 576 ? "max-w-[576px]" : "max-w-[336px]";
  const toggle = `diagram-${diagram.id}-text-toggle`;
  return (
    <figure data-testid="diagram" data-diagram-type={diagram.type} className={`${styles.figure} ${FRAME[frame]}`}>
      <figcaption className="min-w-0">
        <span className="block text-base font-bold text-fg-strong">{diagram.title}</span>
        <span className="mt-1 block text-sm text-fg-muted">{diagram.summary}</span>
      </figcaption>
      <div className="mt-4">
        <DiagramSvg
          drawing={horizontal.drawing}
          diagramId={diagram.id}
          suffix="h"
          title={diagram.title}
          summary={diagram.summary}
          className={`hidden md:block print:block mx-auto h-auto w-full ${hCap}`}
        />
        <DiagramSvg
          drawing={vertical.drawing}
          diagramId={diagram.id}
          suffix="v"
          title={diagram.title}
          summary={diagram.summary}
          className="md:hidden print:hidden mx-auto h-auto w-full max-w-[336px]"
        />
      </div>
      <details className="group mt-4">
        <summary
          id={toggle}
          className="inline-flex h-11 cursor-pointer list-none items-center gap-2 rounded-md font-medium text-link hover:underline focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-focus focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden"
        >
          <ChevronRight
            size={16}
            aria-hidden="true"
            className="transition-transform duration-[var(--fm-duration-base)] group-open:rotate-90 motion-reduce:transition-none"
          />
          Diagram as text
          <span className="sr-only"> for {diagram.title}</span>
        </summary>
        <div
          role="region"
          aria-labelledby={toggle}
          className="mt-2 rounded-lg bg-surface-raised p-4 text-base text-fg dark:border dark:border-border"
        >
          <DiagramTextBody diagram={diagram} />
        </div>
      </details>
    </figure>
  );
}
