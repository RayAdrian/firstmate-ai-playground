"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button, Card, Notice, Skeleton } from "@/components/ui";
import {
  announce,
  exportFilename,
  getState,
  pluralize,
  readImportFile,
  replaceProgress,
  resetProgress,
  serializeProgress,
  summarize,
  useProgressState,
} from "@/lib/progress";
import type { ProgressState } from "@/lib/contracts";

const RESET_WORD = "reset";

function downloadText(text: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function copyHint(): string {
  const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  return mac ? "Press ⌘C to copy" : "Press Ctrl+C to copy";
}

/** A wrapper that takes focus when it mounts (used for result notices). */
function FocusOnMount({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div ref={ref} tabIndex={-1}>
      {children}
    </div>
  );
}

export function ProgressPanel({ lessonSlugs }: { lessonSlugs: string[] | null }) {
  const { hydrated, state } = useProgressState();
  return (
    <>
      <Summary hydrated={hydrated} state={state} lessonSlugs={lessonSlugs} />
      <ExportSection hydrated={hydrated} />
      <ImportSection />
      <ResetSection />
    </>
  );
}

function Summary({
  hydrated,
  state,
  lessonSlugs,
}: {
  hydrated: boolean;
  state: ProgressState;
  lessonSlugs: string[] | null;
}) {
  if (!hydrated) {
    return (
      <Card>
        <div data-testid="progress-placeholder" aria-busy="true" className="space-y-2">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="w-1/2" />
        </div>
      </Card>
    );
  }
  const counts = summarize(state, lessonSlugs ?? undefined);
  const lessons =
    lessonSlugs === null
      ? `${pluralize(counts.lessons, "lesson")} complete`
      : `${counts.lessons} of ${lessonSlugs.length} lessons complete`;
  return (
    <Card>
      <h2 className="text-lg font-bold">Saved in this browser</h2>
      <p>{lessons}</p>
      <p className="text-fg-muted">
        {pluralize(counts.checklistItems, "checklist item")} · {pluralize(counts.bookmarks, "bookmark")}
      </p>
    </Card>
  );
}

function ExportSection({ hydrated }: { hydrated: boolean }) {
  const [result, setResult] = useState<{ copied: boolean; text: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const textareaId = useId();

  useEffect(() => {
    if (result && !result.copied) textareaRef.current?.select();
  }, [result]);

  async function onExport() {
    const text = serializeProgress(getState());
    downloadText(text, exportFilename());
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      copied = false;
    }
    setResult({ copied, text });
    announce(copied ? "Progress exported and copied" : "Progress exported");
  }

  return (
    <section aria-labelledby="export-heading" id="export" className="space-y-3">
      <h2 id="export-heading" className="text-xl font-bold">
        Export
      </h2>
      <p className="text-fg-muted">Download a JSON backup, or share it for the team report.</p>
      <Button onClick={onExport} disabled={!hydrated}>
        Export progress
      </Button>
      {result && (
        <Notice tone="info">
          <p>
            {result.copied
              ? "Downloaded and copied to clipboard."
              : "Downloaded. Copy to clipboard was blocked."}
          </p>
        </Notice>
      )}
      {result && !result.copied && (
        <div className="space-y-1">
          <label htmlFor={textareaId} className="text-sm text-fg-muted">
            Exported progress (JSON). {copyHint()}
          </label>
          <textarea
            id={textareaId}
            ref={textareaRef}
            readOnly
            value={result.text}
            rows={6}
            className="w-full rounded border p-2 font-mono text-sm"
          />
        </div>
      )}
    </section>
  );
}

type ImportState =
  | { kind: "idle" }
  | { kind: "error"; reason: string }
  | { kind: "preview"; next: ProgressState; lessons: number; bookmarks: number }
  | { kind: "done"; lessons: number; bookmarks: number };

function ImportSection() {
  const [status, setStatus] = useState<ImportState>({ kind: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    const result = await readImportFile(file);
    // Allow choosing the same file again after an error or cancel.
    input.value = "";
    if (!result.ok) {
      setStatus({ kind: "error", reason: result.reason });
      return;
    }
    setStatus({ kind: "preview", next: result.state, lessons: result.lessons, bookmarks: result.bookmarks });
  }

  function cancel() {
    setStatus({ kind: "idle" });
    if (inputRef.current) inputRef.current.value = "";
    inputRef.current?.focus();
  }

  function confirm() {
    if (status.kind !== "preview") return;
    replaceProgress(status.next);
    setStatus({ kind: "done", lessons: status.lessons, bookmarks: status.bookmarks });
    announce("Progress imported");
  }

  return (
    <section aria-labelledby="import-heading" className="space-y-3">
      <h2 id="import-heading" className="text-xl font-bold">
        Import
      </h2>
      <div className="space-y-1">
        <label htmlFor={inputId} className="block font-medium">
          Import progress file
        </label>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          onChange={onFile}
        />
      </div>
      {status.kind === "error" && (
        <Notice tone="error">
          <p>
            <strong>This file isn&apos;t a valid progress export.</strong> Reason: {status.reason}.
            Nothing was changed.
          </p>
        </Notice>
      )}
      {status.kind === "preview" && (
        <Notice tone="info">
          <p>
            This file has {pluralize(status.lessons, "lesson")}, {pluralize(status.bookmarks, "bookmark")}.
            Importing replaces everything saved in this browser.
          </p>
          <div className="mt-2 flex gap-2">
            <Button onClick={confirm}>Replace my progress</Button>
            <Button onClick={cancel}>Cancel</Button>
          </div>
        </Notice>
      )}
      {status.kind === "done" && (
        <FocusOnMount>
          <Notice tone="info">
            <p>
              Progress imported: {pluralize(status.lessons, "lesson")},{" "}
              {pluralize(status.bookmarks, "bookmark")}.
            </p>
          </Notice>
        </FocusOnMount>
      )}
    </section>
  );
}

function ResetSection() {
  const [value, setValue] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [done, setDone] = useState(false);
  const inputId = useId();
  const errorId = useId();
  const matches = value.trim() === RESET_WORD;

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!matches) {
      setAttempted(true);
      return;
    }
    resetProgress();
    setValue("");
    setAttempted(false);
    setDone(true);
    announce("All progress has been reset");
  }

  return (
    <section
      aria-labelledby="reset-heading"
      className="space-y-3 rounded border border-danger p-4"
    >
      <h2 id="reset-heading" className="text-xl font-bold">
        Reset all progress
      </h2>
      <p>
        Deletes lessons, checklists and bookmarks saved in this browser. This can&apos;t be undone.{" "}
        <a href="#export" className="underline">
          Export a backup first.
        </a>
      </p>
      <form onSubmit={onSubmit} className="space-y-2" noValidate>
        <label htmlFor={inputId} className="block font-medium">
          Type reset to confirm
        </label>
        <input
          id={inputId}
          type="text"
          value={value}
          autoComplete="off"
          onChange={(e) => {
            setValue(e.target.value);
            setAttempted(false);
            setDone(false);
          }}
          aria-describedby={attempted ? errorId : undefined}
          aria-invalid={attempted ? true : undefined}
          className="rounded border px-2 py-1"
        />
        {attempted && (
          <p id={errorId} className="text-sm text-danger">
            Type reset exactly to confirm.
          </p>
        )}
        <div>
          <Button type="submit" aria-disabled={!matches} className="border-danger text-danger">
            Reset all progress
          </Button>
        </div>
      </form>
      {done && (
        <FocusOnMount>
          <Notice tone="info">
            <p>All progress has been reset.</p>
          </Notice>
        </FocusOnMount>
      )}
    </section>
  );
}
