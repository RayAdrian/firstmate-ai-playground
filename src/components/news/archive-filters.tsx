import Link from "next/link";
import { Button } from "@/components/ui";
import { NEWS_TAGS, type NewsTag } from "@/lib/contracts";
import { ArchiveForm, FiltersDisclosure } from "./archive-client";
import { activeFilterCount, MIN_SCORES, type ArchiveParams } from "./archive-params";
import { TAG_LABEL } from "./tag-labels";

const control =
  "h-11 w-full rounded-lg border border-control-border bg-canvas px-3 text-base text-fg";
const label = "mb-1 block text-sm font-bold text-fg-strong";

/**
 * Filter panel for /news/archive. A plain GET form, so it works before hydration and the URL is the
 * state. Explicit Apply button: auto-submitting on every checkbox would navigate on each click.
 */
export function ArchiveFilters({
  params,
  sources,
}: {
  params: ArchiveParams;
  sources: { slug: string; name: string }[];
}) {
  const dateErrorId = "archive-date-error";
  return (
    <FiltersDisclosure activeCount={activeFilterCount(params)} defaultOpen={params.dateError}>
      <h2 className="mb-3 hidden text-xl font-bold text-fg-strong lg:block">Filters</h2>
      <ArchiveForm>
        <div className="space-y-4 rounded-card bg-surface p-4">
          <fieldset>
            <legend className={label}>Tags</legend>
            <div className="flex flex-wrap gap-x-4">
              {NEWS_TAGS.map((tag: NewsTag) => (
                <label key={tag} className="inline-flex min-h-11 items-center gap-2 text-base text-fg">
                  <input
                    type="checkbox"
                    name="tag"
                    value={tag}
                    defaultChecked={params.tags.includes(tag)}
                    className="size-5 accent-primary"
                  />
                  {TAG_LABEL[tag]}
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="archive-min" className={label}>
              Minimum score
            </label>
            <select id="archive-min" name="min" defaultValue={String(params.min)} className={control}>
              {MIN_SCORES.map((m) => (
                <option key={m} value={m}>
                  {m === 0 ? "Any" : `${m}+`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="archive-source" className={label}>
              Source
            </label>
            <select id="archive-source" name="source" defaultValue={params.source} className={control}>
              <option value="">All sources</option>
              {sources.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <div>
              <label htmlFor="archive-from" className={label}>
                From
              </label>
              <input id="archive-from" type="date" name="from" defaultValue={params.from ?? ""} className={control} />
            </div>
            <div>
              <label htmlFor="archive-to" className={label}>
                To
              </label>
              <input
                id="archive-to"
                type="date"
                name="to"
                defaultValue={params.to ?? ""}
                aria-invalid={params.dateError || undefined}
                aria-describedby={params.dateError ? dateErrorId : undefined}
                className={control}
              />
              {params.dateError ? (
                <p id={dateErrorId} className="mt-1 text-sm font-medium text-danger">
                  End date is before start date.
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              className="h-11 rounded-xl bg-primary px-5 text-base font-bold text-primary-fg hover:bg-primary-hover"
            >
              Apply filters
            </Button>
          </div>
        </div>
      </ArchiveForm>
    </FiltersDisclosure>
  );
}

export function ClearFiltersLink() {
  return (
    <Link
      href="/news/archive"
      className="inline-flex min-h-11 items-center font-medium text-link underline underline-offset-2"
    >
      Clear filters
    </Link>
  );
}
