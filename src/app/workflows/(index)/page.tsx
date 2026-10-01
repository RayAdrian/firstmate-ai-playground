import type { Metadata } from "next";
import { TITLE_SUFFIX } from "@/components/lesson/inline-text";
import { facetOptions, WorkflowsIndexView } from "@/components/workflows/index-view";
import { getCommunitySummaries } from "@/lib/community/server";
import { parseWorkflowParams, type RawSearchParams } from "@/lib/workflows/params";
import { getWorkflowIndex } from "@/lib/workflows/queries";

// Content routes render dynamically so seeded changes show without a rebuild (S-3).
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Workflows · ${TITLE_SUFFIX}` };

export default async function WorkflowsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const { rows, today } = await getWorkflowIndex();
  const community = await getCommunitySummaries(rows.map((r) => r.slug));
  const { useCases, stacks } = facetOptions(rows);
  const params = parseWorkflowParams(await searchParams, { useCases, stacks });
  return <WorkflowsIndexView rows={rows} params={params} today={today} useCases={useCases} stacks={stacks} community={community} />;
}
