import { ToolProvider, ToolTabs } from "@/components/lesson/tool-tabs";
import type { Tool } from "@/components/lesson/tool";
import type { CommunitySummary, WorkflowFreshness, WorkflowRow } from "@/lib/contracts";
import { AtAGlance, type RelatedLesson } from "./at-a-glance";
import { WorkflowHeader } from "./workflow-header";
import {
  PromptBody,
  ResultSection,
  Section,
  SetupBlocks,
  StepsSection,
  WhySection,
} from "./workflow-sections";

/**
 * The whole /workflows/[slug] body (PRD WF-33 to WF-38). Both tools covered: Setup and Prompt each get the shared
 * Claude Code / Codex CLI tabs (same ?tool= param and saved preference as lessons). One tool: no tabs at all.
 */
export function WorkflowDetail({
  workflow,
  freshness,
  lesson,
  urlTool,
  community = null,
}: {
  workflow: WorkflowRow;
  freshness: WorkflowFreshness;
  lesson: RelatedLesson | null;
  /** The valid ?tool value, or null. */
  urlTool: Tool | null;
  /** Stars and reaction counts (PRD 18); null when the community read failed. */
  community?: CommunitySummary | null;
}) {
  const bothTools = workflow.tools.length > 1;
  const onlyTool: Tool | null = bothTools ? null : workflow.tools[0] === "codex" ? "codex" : "claude";

  const body = (
    <>
      <ResultSection before={workflow.result_before} after={workflow.result_after} />

      <Section id="setup" title="Setup">
        {bothTools ? (
          <ToolTabs
            scope="setup"
            label="Setup tool"
            panels={{
              claude: <SetupBlocks blocks={workflow.setup} tool="claude" />,
              codex: <SetupBlocks blocks={workflow.setup} tool="codex" />,
            }}
          />
        ) : (
          <SetupBlocks blocks={workflow.setup} tool={onlyTool} />
        )}
      </Section>

      <Section id="prompt" title="Prompt">
        {bothTools ? (
          <ToolTabs
            scope="prompt"
            label="Prompt tool"
            panels={{
              claude: <PromptBody prompt={workflow.prompt} tool="claude" />,
              codex: <PromptBody prompt={workflow.prompt} tool="codex" />,
            }}
          />
        ) : (
          <PromptBody prompt={workflow.prompt} tool={onlyTool} />
        )}
      </Section>

      <StepsSection steps={workflow.steps} />
      <WhySection why={workflow.why_md} diagram={workflow.diagram ?? null} watch={workflow.watch ?? null} slug={workflow.slug} />
    </>
  );

  const page = (
    <div className="lg:grid lg:grid-cols-12 lg:gap-8">
      <article className="min-w-0 lg:col-span-8">
        <WorkflowHeader workflow={workflow} freshness={freshness} community={community} />
        <AtAGlance workflow={workflow} lesson={lesson} variant="inline" />
        {body}
      </article>
      <div className="lg:col-span-4">
        <AtAGlance workflow={workflow} lesson={lesson} variant="rail" />
      </div>
    </div>
  );

  return bothTools ? (
    <ToolProvider initialTool={urlTool ?? "claude"} hasUrlTool={urlTool !== null}>
      {page}
    </ToolProvider>
  ) : (
    page
  );
}
