"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronRight } from "lucide-react";
import { Badge, ProgressBar } from "@/components/ui";
import { EYEBROW_CLASS, InlineText } from "@/components/lesson/inline-text";
import { CommandLine, PlainCodeBlock } from "@/components/ui/command-line";
import { ToolTabs } from "@/components/lesson/tool-tabs";
import type { Tool } from "@/components/lesson/tool";
import { announce, useChecklist } from "@/lib/progress";

export type ExercisePanelData = {
  slug: string;
  title: string;
  goal: string;
  repoPath: string;
  setupCmd: string;
  /** null means manual verification. */
  verifyCmd: string | null;
  prompts: Partial<Record<Tool, string>>;
  checklist: { id: string; text: string }[];
  solutionNotes: string[];
};

function StepHeading({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h4 className="mt-6 mb-1 text-lg font-bold text-fg-strong">
      <span aria-hidden="true">{n}. </span>
      {children}
    </h4>
  );
}

export function solutionPathFor(repoPath: string, slug: string): string {
  return /\/starter\/?$/.test(repoPath)
    ? repoPath.replace(/\/starter\/?$/, "/solution")
    : `exercises/${slug}/solution`;
}

/** Exercise panel (E-1 to E-3): goal, commands, starting prompts, persisted checklist, reference solution. */
export function ExercisePanel({ exercise }: { exercise: ExercisePanelData }) {
  const ids = exercise.checklist.map((c) => c.id);
  const { hydrated, checked, doneCount, total, allDone, setChecked } = useChecklist(exercise.slug, ids);
  const [open, setOpen] = useState(false);
  const solutionId = useId();

  // Announce "Exercise complete" on the transition only, never on page load.
  const wasDone = useRef<boolean | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    if (wasDone.current === false && allDone) announce("Exercise complete");
    wasDone.current = allDone;
  }, [hydrated, allDone]);

  const solutionPath = solutionPathFor(exercise.repoPath, exercise.slug);
  const prompt = (tool: Tool, name: string) => {
    const text = exercise.prompts[tool];
    return text ? (
      <PlainCodeBlock code={text} title="Prompt" wrap />
    ) : (
      <p className="text-base text-fg-muted">No {name} starting prompt for this exercise.</p>
    );
  };

  return (
    <section
      aria-labelledby="exercise exercise-title"
      className="my-8 rounded-card bg-surface p-5 md:p-6 dark:border dark:border-border"
    >
      <h2 id="exercise" className={EYEBROW_CLASS}>
        Exercise
      </h2>
      <h3 id="exercise-title" className="mt-1 text-2xl font-bold text-fg-strong">
        {exercise.title}
      </h3>
      <p className="mt-2 text-base text-fg">
        <span className="font-bold">Goal:</span> {exercise.goal}
      </p>
      <p className="mt-2 text-sm text-fg-muted">
        Repo <code className="font-mono">{exercise.repoPath}</code>
      </p>

      <StepHeading n={1}>Set up</StepHeading>
      <CommandLine label="Setup" command={exercise.setupCmd} />

      <StepHeading n={2}>Start your agent with</StepHeading>
      <ToolTabs
        scope="prompt"
        label="Starting prompt"
        panels={{ claude: prompt("claude", "Claude Code"), codex: prompt("codex", "Codex CLI") }}
      />

      <StepHeading n={3}>Verify</StepHeading>
      {exercise.verifyCmd ? (
        <CommandLine label="Verify" command={exercise.verifyCmd} />
      ) : (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-base text-fg">
          <Badge variant="neutral">Manual verification</Badge>
          Use the checklist below.
        </p>
      )}

      <fieldset className="mt-6 min-w-0">
        <legend className="mb-1 text-lg font-bold text-fg-strong">
          <span aria-hidden="true">4. </span>Checklist
        </legend>
        <div className="mb-2 flex items-center gap-3">
          {hydrated ? (
            allDone ? (
              <Badge variant="success" icon={<Check />}>
                Exercise complete
              </Badge>
            ) : (
              <span className="text-sm tabular-nums text-fg-muted">
                {doneCount} of {total} done
              </span>
            )
          ) : (
            <span className="inline-block h-5 w-20" aria-hidden="true" />
          )}
          {hydrated && (
            <div className="max-w-40 flex-1">
              <ProgressBar
                value={doneCount}
                max={total}
                label="Checklist"
                valueText={`${doneCount} of ${total} done`}
              />
            </div>
          )}
        </div>
        <div aria-busy={!hydrated}>
          {exercise.checklist.map((item) => (
            <label key={item.id} className="flex min-h-11 cursor-pointer items-start gap-3 py-2.5">
              <input
                type="checkbox"
                className="mt-0.5 size-5 shrink-0 accent-primary dark:accent-link"
                disabled={!hydrated}
                checked={hydrated && checked[item.id] === true}
                onChange={(e) => setChecked(item.id, e.target.checked)}
              />
              <span className="min-w-0 text-base text-fg [overflow-wrap:anywhere]">
                <InlineText text={item.text} />
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-4">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={solutionId}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-11 items-center gap-2 font-medium text-link"
        >
          <ChevronRight
            size={16}
            aria-hidden="true"
            className={"transition-transform motion-reduce:transition-none " + (open ? "rotate-90" : "")}
          />
          Compare with reference solution
        </button>
        <div id={solutionId} hidden={!open} className="mt-2">
          <p className="text-sm text-fg-muted">
            Solution: <code className="font-mono">{solutionPath}</code>
          </p>
          <CommandLine label="Terminal" command={`git diff --no-index ${exercise.repoPath} ${solutionPath}`} />
          {exercise.solutionNotes.length > 0 && (
            <>
              <p className="mt-2 font-bold text-fg-strong">What the reference solution does differently</p>
              <ul className="mt-2 list-disc space-y-1 pl-6 text-base text-fg">
                {exercise.solutionNotes.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
