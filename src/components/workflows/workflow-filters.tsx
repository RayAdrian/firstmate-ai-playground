import Link from "next/link";
import { FiltersDisclosure } from "@/components/news/archive-client";
import { Button } from "@/components/ui";
import { facetLabel } from "@/lib/workflows/labels";
import { activeFilterCount, type WorkflowParams } from "@/lib/workflows/params";
import { WorkflowForm, WORKFLOW_FORM_ID } from "./workflow-form";

const control = "h-11 w-full rounded-lg border border-control-border bg-canvas px-3 text-base text-fg";
const label = "mb-1 block text-sm font-bold text-fg-strong";

export const LEVEL_OPTIONS = [1, 2, 3, 4, 5] as const;

/** The search box (above the grid, always visible). It belongs to the filter form through `form=`. */
export function WorkflowSearch({ q }: { q: string }) {
  return (
    <div className="flex max-w-xl items-end gap-2">
      <div className="min-w-0 flex-1">
        <label htmlFor="workflow-search" className={label}>
          Search workflows
        </label>
        <input
          id="workflow-search"
          type="search"
          name="q"
          form={WORKFLOW_FORM_ID}
          defaultValue={q}
          maxLength={100}
          placeholder="Title or problem"
          autoComplete="off"
          className={control}
        />
      </div>
      <Button type="submit" form={WORKFLOW_FORM_ID} variant="secondary">
        Search
      </Button>
    </div>
  );
}

function CheckboxGroup({
  legend,
  name,
  options,
  checked,
}: {
  legend: string;
  name: string;
  options: readonly string[];
  checked: readonly string[];
}) {
  if (options.length === 0) return null;
  return (
    <fieldset>
      <legend className={label}>{legend}</legend>
      <div className="flex flex-wrap gap-x-4">
        {options.map((value) => (
          <label key={value} className="inline-flex min-h-11 items-center gap-2 text-base text-fg">
            <input
              type="checkbox"
              name={name}
              value={value}
              defaultChecked={checked.includes(value)}
              className="size-5 accent-primary"
            />
            {facetLabel(value)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Filter panel for /workflows (PRD WF-31): the /news/archive pattern. A plain GET form with an explicit
 * Apply button, behind a "Filters (N)" disclosure below lg and a left column from lg.
 */
export function WorkflowFilters({
  params,
  useCases,
  stacks,
}: {
  params: WorkflowParams;
  useCases: readonly string[];
  stacks: readonly string[];
}) {
  return (
    <FiltersDisclosure activeCount={activeFilterCount(params)} defaultOpen={false}>
      <h2 className="mb-3 hidden text-2xl font-bold text-fg-strong lg:block">Filters</h2>
      <WorkflowForm>
        {/* Carried through an Apply so a lesson-scoped or archived view does not silently widen. */}
        {params.lesson ? <input type="hidden" name="lesson" value={params.lesson} /> : null}
        {params.archived ? <input type="hidden" name="archived" value="1" /> : null}
        <div className="space-y-4 rounded-card bg-surface p-4">
          <div>
            <label htmlFor="workflow-tool" className={label}>
              Tool
            </label>
            <select id="workflow-tool" name="tool" defaultValue={params.tool ?? ""} className={control}>
              <option value="">Any tool</option>
              <option value="claude">Claude Code</option>
              <option value="codex">Codex CLI</option>
            </select>
          </div>

          <CheckboxGroup legend="Use case" name="use" options={useCases} checked={params.use} />

          <div>
            <label htmlFor="workflow-level" className={label}>
              Level
            </label>
            <select id="workflow-level" name="level" defaultValue={params.level ? String(params.level) : ""} className={control}>
              <option value="">Any level</option>
              {LEVEL_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  Level {n}
                </option>
              ))}
            </select>
          </div>

          <CheckboxGroup legend="Stack" name="stack" options={stacks} checked={params.stack} />

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="primary">
              Apply filters
            </Button>
          </div>
        </div>
      </WorkflowForm>
    </FiltersDisclosure>
  );
}

export function ClearWorkflowFiltersLink() {
  return (
    <Link
      href="/workflows"
      className="inline-flex min-h-11 items-center font-medium text-link underline underline-offset-2"
    >
      Clear filters
    </Link>
  );
}
