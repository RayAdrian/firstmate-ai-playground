import { AlertTriangle, Archive, Asterisk, Hexagon } from "lucide-react";
import { Badge } from "@/components/ui";
import type { WorkflowFreshness, WorkflowTool } from "@/lib/contracts";
import { facetLabel, kindLabel, WORKFLOW_TOOL_LABEL } from "@/lib/workflows/labels";

// Small presentational pieces shared by the index card, the page header and the rail. Server-safe.

const TOOL_ICON: Record<WorkflowTool, React.ReactNode> = {
  "claude-code": <Asterisk />,
  codex: <Hexagon />,
};

/** One text badge per tool ("Claude Code", "Codex CLI"). Identity is the words, never the icon. */
export function ToolBadges({ tools }: { tools: readonly WorkflowTool[] }) {
  return (
    <>
      {tools.map((t) => (
        <Badge key={t} variant="accent" icon={TOOL_ICON[t]}>
          {WORKFLOW_TOOL_LABEL[t]}
        </Badge>
      ))}
    </>
  );
}

/** One badge per distinct setup kind, or "Prompt only" when there are none. */
export function KindBadges({ kinds }: { kinds: readonly string[] }) {
  if (kinds.length === 0) return <Badge variant="neutral">Prompt only</Badge>;
  return (
    <>
      {kinds.map((k) => (
        <Badge key={k} variant="neutral">
          {kindLabel(k)}
        </Badge>
      ))}
    </>
  );
}

export function StackChips({ stacks }: { stacks: readonly string[] }) {
  return (
    <>
      {stacks.map((s) => (
        <Badge key={s} variant="tag">
          {facetLabel(s)}
        </Badge>
      ))}
    </>
  );
}

export function OutdatedWorkflowBadge() {
  return (
    <Badge
      variant="warning"
      icon={<AlertTriangle />}
      title="Last verified more than 60 days ago; the setup may have changed."
    >
      May be outdated
    </Badge>
  );
}

export function ArchivedBadge() {
  return (
    <Badge variant="neutral" icon={<Archive />} title="Not verified for more than 180 days.">
      Archived
    </Badge>
  );
}

/** "May be outdated" for the middle band, "Archived" for the oldest; nothing when fresh. */
export function FreshnessBadge({ freshness }: { freshness: WorkflowFreshness }) {
  if (freshness === "outdated") return <OutdatedWorkflowBadge />;
  if (freshness === "archived") return <ArchivedBadge />;
  return null;
}
