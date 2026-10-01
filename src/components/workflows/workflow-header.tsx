import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { formatVerifiedDate } from "@/components/lesson/format";
import { EYEBROW_CLASS } from "@/components/lesson/inline-text";
import { Badge, Notice } from "@/components/ui";
import type { WorkflowFreshness, WorkflowRow } from "@/lib/contracts";
import { OutdatedWorkflowBadge } from "./parts";

/** "Claude Code v2.1.0, Codex CLI v0.40.0" (only the tools the workflow covers). */
export function versionsText(versions: WorkflowRow["tool_versions"]): string {
  return [
    versions.claude_code ? `Claude Code v${versions.claude_code}` : null,
    versions.codex_cli ? `Codex CLI v${versions.codex_cli}` : null,
  ]
    .filter((s): s is string => s !== null)
    .join(", ");
}

/**
 * The two trust signals, kept apart on purpose (PRD WF-34).
 * Reviewed = a steward merged this file (ours). Verified = the author's claim that it worked on those versions.
 * The Reviewed element never uses the word "verified".
 */
function MetaLine({ workflow, freshness }: { workflow: WorkflowRow; freshness: WorkflowFreshness }) {
  const reviewed = workflow.reviewed_on ? formatVerifiedDate(workflow.reviewed_on) : null;
  const verified = formatVerifiedDate(workflow.verified_on);
  const versions = versionsText(workflow.tool_versions);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-fg-muted">
      <span className="inline-flex items-center gap-2">
        <Badge variant="success" icon={<BadgeCheck />} title="A steward reviewed and merged this file.">
          Reviewed by stewards
        </Badge>
        {reviewed ? <span>{reviewed}</span> : null}
      </span>
      <span>
        Author-verified on {versions}
        {verified ? ` · ${verified}` : ""}
      </span>
      <span>by {workflow.author_name}</span>
      {freshness === "outdated" ? <OutdatedWorkflowBadge /> : null}
    </div>
  );
}

export function WorkflowHeader({ workflow, freshness }: { workflow: WorkflowRow; freshness: WorkflowFreshness }) {
  const since = formatVerifiedDate(workflow.verified_on) ?? workflow.verified_on;
  return (
    <header>
      <nav aria-label="Breadcrumb" className="text-sm text-fg-muted">
        <ol className="flex flex-wrap items-center gap-x-2">
          <li>
            <Link href="/workflows" className="text-link underline underline-offset-2">
              Workflows
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="[overflow-wrap:anywhere]">
            {workflow.title}
          </li>
        </ol>
      </nav>
      {freshness === "archived" ? (
        <Notice tone="warning" live={false} className="mt-4">
          <p>
            <strong>Archived:</strong> not verified since {since}. Kept for reference; the setup may no longer work.
          </p>
        </Notice>
      ) : null}
      <p className={`mt-6 ${EYEBROW_CLASS}`}>Workflow</p>
      <h1 className="mt-1 text-3xl font-bold text-fg-strong md:text-4xl [overflow-wrap:anywhere]">{workflow.title}</h1>
      <p className="mt-3 text-lg text-fg [overflow-wrap:anywhere]">{workflow.problem}</p>
      <MetaLine workflow={workflow} freshness={freshness} />
    </header>
  );
}
