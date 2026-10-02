import { ArrowDown, ChevronDown, ChevronRight, Play } from "lucide-react";
import type { LessonTldr } from "@/lib/contracts";
import { CommandLine } from "@/components/ui";
import { InlineText } from "./inline-text";
import type { LessonMediaItem } from "./server/media";
import styles from "./watch-block.module.css";

type TryEntry = { kind: "command" | "prompt"; text: string };

const RING =
  "focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-focus focus-visible:outline-offset-2";

/** 30.6 -> "0:31" */
function formatDuration(totalSeconds: number): string {
  const s = Math.round(totalSeconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const TERMINAL_LEAD = "run it in your terminal";
const AGENT_LEAD = "type it into the agent";

/** The one-line lead under "Try this", generated from the kinds and never authored (DESIGN §6.3.4). */
function leadLine(tryThis: LessonTldr["try_this"]): string {
  if ("all" in tryThis) {
    return tryThis.all.kind === "command" ? "Run it in your terminal, in any repo." : "Type it into your agent.";
  }
  const { claude, codex } = tryThis;
  if (claude.kind === codex.kind) {
    return claude.kind === "command" ? "Run it in your terminal, in any repo." : "Type it into your agent.";
  }
  const how = (e: TryEntry) => (e.kind === "command" ? TERMINAL_LEAD : AGENT_LEAD);
  return `Claude Code: ${how(claude)}. Codex CLI: ${how(codex)}.`;
}

function blocks(tryThis: LessonTldr["try_this"]): { label: string; entry: TryEntry }[] {
  if ("all" in tryThis) {
    return [{ label: tryThis.all.kind === "command" ? "Terminal" : "Prompt", entry: tryThis.all }];
  }
  return [
    { label: "Claude Code", entry: tryThis.claude },
    { label: "Codex CLI", entry: tryThis.codex },
  ];
}

/**
 * The lesson TL;DR card (PRD §19, TL-5 to TL-9, TL-14, TL-15; DESIGN §6.3.4). A server component: the video row and the
 * transcript are `<details>`, so the player works without JS; only the Copy buttons are client islands.
 * `video` is the fresh TL;DR video, or null (missing, invalid or stale), in which case there is no video row at all.
 */
export function TldrCard({ title, tldr, video }: { title: string; tldr: LessonTldr; video: LessonMediaItem | null }) {
  return (
    <section
      aria-labelledby="tldr"
      data-testid="tldr-card"
      className="mt-8 rounded-card bg-surface p-5 md:p-6 dark:border dark:border-border print:break-inside-avoid"
    >
      <h2 id="tldr" className="text-xl font-bold text-fg-strong">
        TL;DR
      </h2>

      {video && <VideoRow title={title} video={video} />}

      <ul id="tldr-points" tabIndex={-1} className="mt-4 scroll-mt-[76px] space-y-3 rounded-lg">
        {tldr.points.map((point, i) => (
          <li key={i} className="grid grid-cols-[1.5rem_1fr] gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 inline-flex size-6 items-center justify-center rounded-full bg-accent-soft text-xs font-bold tabular-nums text-link"
            >
              {i + 1}
            </span>
            <span className="min-w-0 text-base text-fg md:text-prose [overflow-wrap:anywhere]">
              <InlineText text={point} />
            </span>
          </li>
        ))}
      </ul>

      <h3 className="mt-5 text-base font-bold text-fg-strong">Try this</h3>
      <p className="mt-1 text-sm text-fg-muted">{leadLine(tldr.try_this)}</p>
      <div className="mt-3 space-y-3">
        {blocks(tldr.try_this).map(({ label, entry }) => (
          <CommandLine key={label} label={label} command={entry.text} wrap={entry.kind === "prompt"} />
        ))}
      </div>
    </section>
  );
}

function VideoRow({ title, video }: { title: string; video: LessonMediaItem }) {
  const { manifest, videoUrl, posterUrl, captionsUrl, transcript } = video;
  const seconds = Math.round(manifest.duration_s);
  return (
    <details className="group/video mt-3 print:hidden">
      <summary
        id="tldr-video-toggle"
        className={`flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-xl border border-border bg-canvas p-2 pr-3 hover:bg-accent-subtle [&::-webkit-details-marker]:hidden ${RING}`}
      >
        <span className="relative shrink-0 overflow-hidden rounded-lg border border-border group-open/video:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element -- a fixed 80x45 poster, at most 30 KiB; next/image adds nothing */}
          <img
            src={posterUrl}
            alt=""
            width={80}
            height={45}
            decoding="async"
            className="block h-[45px] w-20 md:h-[54px] md:w-24"
          />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-fg">
              <Play size={14} aria-hidden="true" className="fill-current" />
            </span>
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-link">TL;DR video</span>
          <span className="block text-sm text-fg-muted">
            <time dateTime={`PT${seconds}S`}>{formatDuration(manifest.duration_s)}</time> · No sound
          </span>
        </span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className="shrink-0 text-link transition-transform group-open/video:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <video
        controls
        preload="none"
        playsInline
        poster={posterUrl}
        src={videoUrl}
        width={manifest.width}
        height={manifest.height}
        aria-label={`TL;DR video: ${title}`}
        style={{ aspectRatio: `${manifest.width} / ${manifest.height}` }}
        className={`-mx-5 mt-3 block h-auto w-[calc(100%+2.5rem)] max-w-none border-y border-border bg-code-bg md:mx-0 md:w-full md:rounded-xl md:border ${RING} ${styles.video}`}
      >
        <track kind="captions" srcLang="en" label="English" src={captionsUrl} default />
      </video>
      <p className="mt-2">
        <a href="#tldr-points" className={`inline-flex h-11 items-center gap-2 font-medium text-link hover:underline ${RING}`}>
          <ArrowDown size={16} aria-hidden="true" />
          Read instead
        </a>
      </p>
      <details className="group/transcript">
        <summary
          id="tldr-transcript-toggle"
          className={`inline-flex h-11 cursor-pointer list-none items-center gap-2 rounded-md font-medium text-link hover:underline [&::-webkit-details-marker]:hidden ${RING}`}
        >
          <ChevronRight
            size={16}
            aria-hidden="true"
            className="transition-transform group-open/transcript:rotate-90 motion-reduce:transition-none"
          />
          Transcript
          <span className="sr-only"> for TL;DR video</span>
        </summary>
        <div
          role="region"
          aria-labelledby="tldr-transcript-toggle"
          className="mt-2 whitespace-pre-line rounded-lg bg-canvas p-4 text-base text-fg dark:border dark:border-border"
        >
          {transcript}
        </div>
      </details>
    </details>
  );
}
