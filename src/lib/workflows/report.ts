import { REPO_URL, WORKFLOW_OUTDATED_ISSUE_TEMPLATE } from "@/lib/contracts";

/**
 * The prefilled GitHub issue behind "Report outdated" (PRD WF-37). The repo URL and the template name come
 * from the contract, so a later org transfer is a one-line change there.
 */
export function reportOutdatedUrl(slug: string): string {
  const q = new URLSearchParams({
    template: WORKFLOW_OUTDATED_ISSUE_TEMPLATE,
    labels: "workflow-outdated",
    title: `Outdated: ${slug}`,
    workflow: slug,
  });
  return `${REPO_URL}/issues/new?${q.toString()}`;
}
