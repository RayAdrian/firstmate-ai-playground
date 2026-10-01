import { ChevronRight, Clapperboard, SquareTerminal } from "lucide-react";
import { formatVerifiedDate } from "./format";
import styles from "./watch-block.module.css";
import type { LessonMediaItem } from "./server/media";

/** 72.5 -> "1:12" */
function formatDuration(totalSeconds: number): string {
  const s = Math.round(totalSeconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const RING =
  "focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-focus focus-visible:outline-offset-2";

function MetaLine({ manifest }: { manifest: LessonMediaItem["manifest"] }) {
  const isRecording = manifest.kind === "recording";
  const Icon = isRecording ? SquareTerminal : Clapperboard;
  const parts: string[] = [];
  if (isRecording) {
    const v = manifest.tool_versions;
    const versions = [v.claude_code ? `Claude Code ${v.claude_code}` : null, v.codex_cli ? `Codex CLI ${v.codex_cli}` : null]
      .filter((p): p is string => p !== null)
      .join(" / ");
    if (versions) parts.push(versions);
  }
  const made = isRecording ? formatVerifiedDate(manifest.made_on) : null;
  const seconds = Math.round(manifest.duration_s);
  return (
    <p className="mt-1 flex items-start gap-x-2 text-sm text-fg-muted">
      <Icon size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
      <span className="min-w-0">
        {isRecording ? "Terminal recording" : "Animation"} ·{" "}
        <time dateTime={`PT${seconds}S`}>{formatDuration(manifest.duration_s)}</time> · No sound
        {parts.map((p) => ` · ${p}`).join("")}
        {made ? (
          <>
            {" · Recorded "}
            <time dateTime={manifest.made_on}>{made}</time>
          </>
        ) : null}
      </span>
    </p>
  );
}

/**
 * "Watch" block (PRD §15 MD-1/MD-2, DESIGN §6.3.2). Server component: native video, no JS. No autoplay,
 * preload none, captions on by default, aspect ratio reserved from the manifest so nothing shifts.
 * Renders nothing for no items.
 */
export function MediaBlock({ items }: { items: LessonMediaItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-8 space-y-10">
      {items.map(({ manifest, videoUrl, posterUrl, captionsUrl, transcript }) => {
        const headingId = `watch-${manifest.id}`;
        const toggleId = `${headingId}-transcript-toggle`;
        return (
          <section key={manifest.id} aria-labelledby={headingId} data-testid="media-block">
            <h3 id={headingId} aria-label={`Watch: ${manifest.title}`}>
              <span aria-hidden="true" className="block text-sm font-bold uppercase tracking-eyebrow text-link">
                Watch
              </span>
              <span className="mt-1 block text-lg font-bold text-fg-strong md:text-xl">{manifest.title}</span>
            </h3>
            <MetaLine manifest={manifest} />
            <video
              controls
              preload="none"
              playsInline
              poster={posterUrl}
              src={videoUrl}
              width={manifest.width}
              height={manifest.height}
              aria-labelledby={headingId}
              style={{ aspectRatio: `${manifest.width} / ${manifest.height}` }}
              className={`mt-3 block h-auto w-full rounded-xl border border-border bg-code-bg ${RING} ${styles.video}`}
            >
              <track kind="captions" srcLang="en" label="English" src={captionsUrl} default />
            </video>
            <details className="group mt-2">
              <summary
                id={toggleId}
                className={`inline-flex h-11 cursor-pointer list-none items-center gap-2 rounded-md font-medium text-link hover:underline [&::-webkit-details-marker]:hidden ${RING}`}
              >
                <ChevronRight
                  size={16}
                  aria-hidden="true"
                  className="transition-transform group-open:rotate-90 motion-reduce:transition-none"
                />
                Transcript
                <span className="sr-only"> for {manifest.title}</span>
              </summary>
              <div
                role="region"
                aria-labelledby={toggleId}
                className="mt-2 whitespace-pre-line rounded-lg bg-surface p-4 text-base text-fg dark:border dark:border-border"
              >
                {transcript}
              </div>
            </details>
          </section>
        );
      })}
    </div>
  );
}
