import Link from "next/link";
import { ArrowLeft, ArrowRight, Info } from "lucide-react";
import { verifiedLine, isOutdated, type ToolVersions } from "./format";
import { OutdatedBadge } from "./curriculum-list";
import { BookmarkToggle, HeaderCompletion } from "./lesson-actions";
import { Markdown } from "./markdown";
import type { PrevNext } from "./navigation";
import { TOOL_LABEL, type Tool } from "./tool";

export function LessonHeader({
  slug,
  number,
  title,
  objective,
  minutes,
  lastVerifiedOn,
  toolVersions,
  today,
  level,
}: {
  slug: string;
  number: string;
  title: string;
  objective: string;
  minutes: number;
  lastVerifiedOn: string | null;
  toolVersions: ToolVersions;
  today: string;
  level: { number: number; title: string };
}) {
  const line = verifiedLine(lastVerifiedOn, toolVersions);
  return (
    <header>
      <nav aria-label="Breadcrumb" className="text-sm text-fg-muted">
        <ol className="flex flex-wrap items-center gap-x-2">
          <li>
            <Link href="/curriculum" className="text-link underline underline-offset-2">
              Curriculum
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page">
            Level {level.number}: {level.title}
          </li>
        </ol>
      </nav>
      <p className="mt-6 text-xs font-medium uppercase tracking-eyebrow text-fg-muted">Lesson {number}</p>
      <h1 className="mt-1 text-3xl font-bold text-fg-strong md:text-4xl">{title}</h1>
      <p className="mt-3 text-lg text-fg">{objective}</p>
      <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-muted">
        <span>{minutes} min</span>
        {line && <span>· {line}</span>}
        {isOutdated(lastVerifiedOn, today) && <OutdatedBadge />}
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-h-6">
          <HeaderCompletion slug={slug} />
        </div>
        <BookmarkToggle slug={slug} />
      </div>
    </header>
  );
}

/** One tool's tab body: its markdown, or the no-native-equivalent notice plus the workaround (L-3.2). */
export function ToolPanelContent({
  tool,
  body,
  noEquivalent,
  workaround,
  version,
}: {
  tool: Tool;
  body: string | null;
  noEquivalent: boolean;
  workaround: string | null;
  version: string | undefined;
}) {
  if (noEquivalent) {
    return (
      <>
        <div className="flex gap-3 rounded-lg border border-border bg-surface p-4">
          <Info size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-link" />
          <p className="font-bold text-fg-strong">
            No native equivalent in {TOOL_LABEL[tool]}
            {version ? ` (as of v${version})` : ""}
          </p>
        </div>
        {workaround && (
          <>
            <h4 className="mt-6 mb-2 text-lg font-bold text-fg-strong">Closest workaround</h4>
            <Markdown source={workaround} />
          </>
        )}
      </>
    );
  }
  if (body && body.trim().length > 0) return <Markdown source={body} />;
  return <p className="text-base text-fg-muted">No {TOOL_LABEL[tool]} instructions for this lesson yet.</p>;
}

/** Key differences (L-3.1): a labelled region outside the tabs, always visible. Plain text only. */
export function Differences({ items }: { items: readonly string[] }) {
  return (
    <section
      aria-labelledby="differences"
      className="my-8 rounded-card border-l-4 border-link bg-accent-soft p-5"
    >
      <h2 id="differences" className="text-xl font-bold text-fg-strong">
        Key differences
      </h2>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-prose text-fg">
        {items.map((d, i) => (
          <li key={i}>{d}</li>
        ))}
      </ul>
    </section>
  );
}

const NAV_LINK =
  "flex min-h-11 flex-col rounded-xl bg-surface p-4 hover:bg-accent-subtle dark:border dark:border-border";

export function PrevNextNav({ prevNext }: { prevNext: PrevNext }) {
  const { previous, next } = prevNext;
  return (
    <nav aria-label="Lesson" className="mt-8 grid gap-3 sm:grid-cols-2">
      {previous ? (
        <Link href={`/lessons/${previous.slug}`} className={NAV_LINK}>
          <span className="inline-flex items-center gap-1 text-sm text-fg-muted">
            <ArrowLeft size={16} aria-hidden="true" />
            Previous:{" "}
          </span>
          <span className="font-bold text-fg-strong">
            {previous.number} {previous.title}
          </span>
        </Link>
      ) : (
        <span />
      )}
      {"kind" in next ? (
        <Link href="/curriculum" className={`${NAV_LINK} sm:items-end sm:text-right`}>
          <span className="inline-flex items-center gap-1 font-bold text-fg-strong">
            Back to curriculum
            <ArrowRight size={16} aria-hidden="true" />
          </span>
        </Link>
      ) : (
        <Link href={`/lessons/${next.slug}`} className={`${NAV_LINK} sm:items-end sm:text-right`}>
          <span className="inline-flex items-center gap-1 text-sm text-fg-muted">
            Next:{" "}
            <ArrowRight size={16} aria-hidden="true" />
          </span>
          <span className="font-bold text-fg-strong">
            {next.number} {next.title}
          </span>
        </Link>
      )}
    </nav>
  );
}

export function LessonRail({ hasExercise }: { hasExercise: boolean }) {
  const links: [string, string][] = [
    ["#concept", "Concept"],
    ["#tools", "Claude Code / Codex CLI"],
    ["#differences", "Key differences"],
  ];
  if (hasExercise) links.push(["#exercise", "Exercise"]);
  return (
    <nav aria-label="On this lesson" className="hidden lg:sticky lg:top-[76px] lg:block lg:self-start">
      <p className="mb-2 text-xs font-medium uppercase tracking-eyebrow text-fg-muted">On this lesson</p>
      <ul className="space-y-1">
        {links.map(([href, label]) => (
          <li key={href}>
            <a href={href} className="inline-flex min-h-6 items-center py-1 text-sm text-link underline underline-offset-2">
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
