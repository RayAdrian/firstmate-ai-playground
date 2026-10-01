import Link from "next/link";
import { SearchX, Workflow } from "lucide-react";
import { FocusResultsLinks, ResultsHeading } from "@/components/news/archive-client";
import { EmptyState, FilterChip } from "@/components/ui";
import { REPO_URL, type CommunitySummary } from "@/lib/contracts";
import { distinct, listWorkflows, type WorkflowCardData } from "@/lib/workflows/filter";
import { facetLabel, KNOWN_STACKS, KNOWN_USE_CASES, WORKFLOW_TOOL_LABEL } from "@/lib/workflows/labels";
import {
  hasAnyFilter,
  TOOL_PARAM_TO_WORKFLOW_TOOL,
  workflowsHref,
  type WorkflowParams,
} from "@/lib/workflows/params";
import { WorkflowCard } from "./workflow-card";
import { ClearWorkflowFiltersLink, WorkflowFilters, WorkflowSearch } from "./workflow-filters";

export const SHARE_URL = `${REPO_URL}/blob/main/CONTRIBUTING.md#share-a-workflow`;

/** Facet options for the filter form and for validating the URL: the static taxonomy plus anything the data adds. */
export function facetOptions(rows: readonly WorkflowCardData[]): { useCases: string[]; stacks: string[] } {
  const merge = (known: readonly string[], found: string[]) => [...known, ...found.filter((v) => !known.includes(v)).sort()];
  return {
    useCases: merge(KNOWN_USE_CASES, distinct(rows.map((r) => r.use_cases))),
    stacks: merge(KNOWN_STACKS, distinct(rows.map((r) => r.stacks))),
  };
}

function ExternalShareLink({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <a href={SHARE_URL} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
      <span className="sr-only"> (opens in new tab)</span>
    </a>
  );
}

function ActiveChips({ params, hideClear }: { params: WorkflowParams; hideClear: boolean }) {
  const chips: { key: string; text: string; href: string }[] = [];
  if (params.tool) {
    chips.push({
      key: "tool",
      text: WORKFLOW_TOOL_LABEL[TOOL_PARAM_TO_WORKFLOW_TOOL[params.tool]],
      href: workflowsHref({ ...params, tool: null }),
    });
  }
  for (const u of params.use) {
    chips.push({ key: `use-${u}`, text: facetLabel(u), href: workflowsHref({ ...params, use: params.use.filter((v) => v !== u) }) });
  }
  if (params.level !== null) {
    chips.push({ key: "level", text: `Level ${params.level}`, href: workflowsHref({ ...params, level: null }) });
  }
  for (const s of params.stack) {
    chips.push({ key: `stack-${s}`, text: facetLabel(s), href: workflowsHref({ ...params, stack: params.stack.filter((v) => v !== s) }) });
  }
  if (params.lesson) {
    chips.push({ key: "lesson", text: `Lesson ${params.lesson}`, href: workflowsHref({ ...params, lesson: "" }) });
  }
  if (params.q) {
    chips.push({ key: "q", text: `Search: ${params.q}`, href: workflowsHref({ ...params, q: "" }) });
  }
  if (chips.length === 0) return null;
  return (
    <FocusResultsLinks className="mt-2 flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <FilterChip key={c.key} label={c.text} href={c.href} />
      ))}
      {hideClear ? null : <ClearWorkflowFiltersLink />}
    </FocusResultsLinks>
  );
}

/**
 * The whole /workflows page body (PRD WF-30, WF-31, WF-32). Pure of data fetching: the route reads the rows,
 * this lays them out, so it renders in unit tests without a database.
 */
export function WorkflowsIndexView({
  rows,
  params,
  today,
  useCases,
  stacks,
  community = null,
}: {
  rows: readonly WorkflowCardData[];
  params: WorkflowParams;
  today: string;
  useCases: readonly string[];
  stacks: readonly string[];
  /** Stars and reaction counts by slug (PRD 18). null when the community read failed: cards render without them. */
  community?: ReadonlyMap<string, CommunitySummary> | null;
}) {
  const { items, archivedCount } = listWorkflows(rows, params, today);
  const filtered = hasAnyFilter(params);
  const resultKey = workflowsHref(params);
  const noun = items.length === 1 ? "workflow" : "workflows";

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h1 className="text-3xl font-bold text-fg-strong md:text-4xl">Workflows</h1>
        <ExternalShareLink className="inline-flex min-h-11 items-center gap-1 font-medium text-link underline underline-offset-2">
          Share
          <span aria-hidden="true">↗</span>
        </ExternalShareLink>
      </div>
      <p className="mt-2 max-w-[var(--fm-measure)] text-base text-fg-muted">
        Setups engineers got working: the files, the prompt and the steps. Copy one, then adapt it.
      </p>

      <div className="mt-6">
        <WorkflowSearch q={params.q} />
      </div>

      <div className="mt-6 lg:grid lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-3">
          <WorkflowFilters params={params} useCases={useCases} stacks={stacks} />
        </div>

        <div className="mt-6 min-w-0 lg:col-span-9 lg:mt-0">
          <p className="text-base text-fg-muted">
            {items.length} {noun}
          </p>
          <ActiveChips params={params} hideClear={items.length === 0} />

          <div className="mt-4">
            <ResultsHeading key={resultKey}>Results</ResultsHeading>
          </div>

          {items.length === 0 ? (
            <div className="mt-3">
              {filtered ? (
                <EmptyState icon={<SearchX />} title="No workflows match these filters">
                  <p>Try removing a filter or searching for something broader.</p>
                  <ClearWorkflowFiltersLink />
                </EmptyState>
              ) : (
                <EmptyState icon={<Workflow />} title="No workflows yet.">
                  <ExternalShareLink className="inline-flex min-h-11 items-center gap-1 font-medium text-link underline underline-offset-2">
                    Share the first one
                    <span aria-hidden="true">↗</span>
                  </ExternalShareLink>
                </EmptyState>
              )}
            </div>
          ) : (
            <ul className="mt-3 grid gap-3 md:grid-cols-2 md:gap-4">
              {items.map((w) => (
                <WorkflowCard key={w.slug} workflow={w} community={community?.get(w.slug) ?? null} />
              ))}
            </ul>
          )}

          {!params.archived && archivedCount > 0 ? (
            <p className="mt-6">
              <Link
                href={workflowsHref({ ...params, archived: true })}
                className="inline-flex min-h-11 items-center font-medium text-link underline underline-offset-2"
              >
                Show archived ({archivedCount})
              </Link>
            </p>
          ) : null}
          {params.archived ? (
            <p className="mt-6">
              <Link
                href={workflowsHref({ ...params, archived: false })}
                className="inline-flex min-h-11 items-center font-medium text-link underline underline-offset-2"
              >
                Hide archived
              </Link>
            </p>
          ) : null}
        </div>
      </div>
    </>
  );
}
