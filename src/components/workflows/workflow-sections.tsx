import type { ReactNode } from "react";
import { DiagramFigure } from "@/components/diagram/diagram-figure";
import { WatchLine } from "@/components/diagram/watch-line";
import { InlineText } from "@/components/lesson/inline-text";
import { Markdown } from "@/components/lesson/markdown";
import { TOOL_LABEL, type Tool } from "@/components/lesson/tool";
import { Badge, Card } from "@/components/ui";
import { CodeBlock } from "@/components/ui/code-block";
import type { WorkflowPrompt, WorkflowSetupBlock } from "@/lib/contracts";
import type { Diagram } from "@/lib/contracts/diagram";
import { kindLabel } from "@/lib/workflows/labels";

const H2 = "mb-3 scroll-mt-24 text-2xl font-bold text-fg-strong";

/** Setup and Prompt are tool-scoped; `Tool` here is the lesson-style `claude` | `codex`. */
const TOOL_OF: Record<Tool, WorkflowSetupBlock["tool"]> = { claude: "claude-code", codex: "codex" };

export function ResultSection({ before, after }: { before: string; after: string }) {
  return (
    <section aria-labelledby="result" className="mt-10">
      <h2 id="result" className={H2}>
        Result
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        <Card as="div">
          <h3 className="text-lg font-bold text-fg-strong">Before</h3>
          <div className="[&>p:first-child]:mt-2">
            <Markdown source={before} />
          </div>
        </Card>
        <Card as="div" className="border-l-4 border-link dark:border-l-4">
          <h3 className="text-lg font-bold text-fg-strong">After</h3>
          <div className="[&>p:first-child]:mt-2">
            <Markdown source={after} />
          </div>
        </Card>
      </div>
    </section>
  );
}

/** The setup blocks that apply to one tool: blocks tagged for it, plus blocks with no tool tag (both). */
export function setupFor(blocks: readonly WorkflowSetupBlock[], tool: Tool | null): WorkflowSetupBlock[] {
  if (tool === null) return [...blocks];
  return blocks.filter((b) => b.tool === null || b.tool === TOOL_OF[tool]);
}

/** The prompt for one tool: its own subsection when the prompts differ, else the shared one. */
export function promptFor(prompt: WorkflowPrompt, tool: Tool | null): string {
  if (tool === "claude") return prompt.claude ?? prompt.shared ?? "";
  if (tool === "codex") return prompt.codex ?? prompt.shared ?? "";
  return prompt.shared ?? prompt.claude ?? prompt.codex ?? "";
}

export function SetupBlocks({ blocks, tool }: { blocks: readonly WorkflowSetupBlock[]; tool: Tool | null }) {
  const shown = setupFor(blocks, tool);
  if (shown.length === 0) {
    return (
      <p className="text-base text-fg-muted">
        {tool ? `No setup files for ${TOOL_LABEL[tool]}.` : "No setup files. This workflow is prompt only."}
      </p>
    );
  }
  return (
    <div className="space-y-6">
      {shown.map((b, i) => (
        <div key={`${b.path}-${i}`}>
          <p className="mb-2">
            <Badge variant="neutral">{kindLabel(b.kind)}</Badge>
          </p>
          <CodeBlock code={b.code} language={b.lang} title={b.path} />
        </div>
      ))}
    </div>
  );
}

export function PromptBody({ prompt, tool }: { prompt: WorkflowPrompt; tool: Tool | null }) {
  const source = promptFor(prompt, tool);
  if (source.trim().length === 0) {
    return <p className="text-base text-fg-muted">No prompt for {tool ? TOOL_LABEL[tool] : "this workflow"}.</p>;
  }
  return <Markdown source={source} />;
}

/** A labelled page section; the id is an anchor target for the rail's "On this page" list. */
export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-10">
      <h2 id={id} className={H2}>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function StepsSection({ steps }: { steps: readonly string[] }) {
  return (
    <Section id="steps" title="Steps">
      <ol className="list-decimal space-y-2 pl-6 text-prose text-fg [overflow-wrap:anywhere]">
        {steps.map((s, i) => (
          <li key={i} className="max-w-[var(--fm-measure)] pl-1">
            <InlineText text={s} />
          </li>
        ))}
      </ol>
    </Section>
  );
}

/** "Why it works" as a callout, like a lesson's Key differences. Markdown, so `<script>` shows as text (L-7). */
export function WhySection({
  why,
  diagram = null,
  watch = null,
  slug = "",
}: {
  why: string;
  /** Validated at read (src/lib/workflows/queries.ts); null when absent or invalid. Renders first (PRD §17.5, DG-10). */
  diagram?: Diagram | null;
  /** `<lesson-slug>/<media-id>`; renders the Watch line after the diagram (DG-11). */
  watch?: string | null;
  /** For the log line when a `watch` no longer resolves. */
  slug?: string;
}) {
  return (
    <section aria-labelledby="why-it-works" className="mt-10 rounded-card border-l-4 border-link bg-accent-soft p-5">
      <h2 id="why-it-works" className="scroll-mt-24 text-xl font-bold text-fg-strong">
        Why it works
      </h2>
      {diagram && <DiagramFigure diagram={diagram} frame="band" />}
      {watch && <WatchLine watch={watch} context={`workflow ${slug}`} />}
      <Markdown source={why} />
    </section>
  );
}
