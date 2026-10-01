import { formatVerifiedDate } from "@/components/lesson/format";
import { CardCounts, CardExtras, CardStar } from "@/components/community/card";
import { Card } from "@/components/ui";
import type { CommunitySummary, WorkflowFreshness } from "@/lib/contracts";
import type { WorkflowCardData } from "@/lib/workflows/filter";
import { FreshnessBadge, KindBadges, StackChips, ToolBadges } from "./parts";

/** One card on /workflows (WF-30). The whole card is the link target; the problem is clamped visually but complete in the DOM. */
export function WorkflowCard({
  workflow,
  community = null,
}: {
  workflow: WorkflowCardData & { freshness: WorkflowFreshness };
  /** Stars and reaction counts (PRD 18). null when the community read failed: the card is then as it was, with no Star. */
  community?: CommunitySummary | null;
}) {
  const verified = formatVerifiedDate(workflow.verified_on);
  return (
    <Card as="li" interactive className="flex h-full flex-col">
      <h3 className="text-lg font-bold text-fg-strong [overflow-wrap:anywhere]">
        <Card.Link href={`/workflows/${workflow.slug}`}>{workflow.title}</Card.Link>
      </h3>
      <p className="mt-2 line-clamp-2 text-base text-fg">{workflow.problem}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ToolBadges tools={workflow.tools} />
        <KindBadges kinds={workflow.setup_kinds} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <StackChips stacks={workflow.stacks} />
      </div>
      <div className="mt-auto flex items-end justify-between gap-3 pt-4">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-muted">
            {workflow.freshness === "fresh" ? <span>{verified ? `Verified ${verified}` : "Verified"}</span> : null}
            {workflow.freshness !== "fresh" ? <FreshnessBadge freshness={workflow.freshness} /> : null}
            {workflow.freshness === "archived" && verified ? <span>Verified {verified}</span> : null}
            <span aria-hidden="true">·</span>
            <span>by {workflow.author_name}</span>
          </p>
          {community ? <CardCounts summary={community} /> : null}
        </div>
        {community ? <CardStar summary={community} title={workflow.title} closed={workflow.freshness === "archived"} /> : null}
      </div>
      {community ? <CardExtras slug={workflow.slug} /> : null}
    </Card>
  );
}
