"use client";

import { Fragment } from "react";
import { cn } from "@/components/ui/cn";
import { REACTIONS, type CommunitySummary, type ReactionKey } from "@/lib/contracts";
import { reactorParts, REACTION_SHORT } from "@/lib/community/format";
import { useCommunityEntry, useCommunityError, useCommunityIdentity } from "@/lib/community/hooks";
import { displayCount, press, type Flag } from "@/lib/community/store";
import { NameControl, NamePrompt, NameText } from "./name-prompt";
import { CLOSED_NOTE_ID } from "./star-button";

const reactorsId = (key: ReactionKey) => `reactors-${key}`;

/** The visible, optional-to-hear failure line (CM-5): the same text `#fm-live` announced. */
export function CommunityErrorLine({ slug }: { slug: string }) {
  const error = useCommunityError(slug);
  if (!error) return null;
  return <p className="relative z-10 mt-2 text-sm text-danger">{error.text}</p>;
}

function ReactionButton({
  slug,
  reaction,
  serverCount,
  flag,
  loaded,
  closed,
}: {
  slug: string;
  reaction: (typeof REACTIONS)[number];
  serverCount: number;
  flag: Flag;
  loaded: boolean;
  closed: boolean;
}) {
  const count = displayCount(serverCount, flag);
  const pressed = flag.desired;
  const disabled = !loaded || closed;
  const describedBy = [count > 0 ? reactorsId(reaction.key) : null, closed ? CLOSED_NOTE_ID : null].filter(Boolean).join(" ");
  return (
    <button
      type="button"
      aria-label={`${reaction.label} ${count}`}
      aria-pressed={pressed}
      aria-disabled={disabled || undefined}
      aria-describedby={describedBy || undefined}
      data-community={reaction.key}
      onClick={(e) => {
        if (disabled) return;
        press(slug, reaction.key, e.currentTarget);
      }}
      className={cn(
        "inline-flex h-11 w-full items-center justify-start gap-1.5 whitespace-nowrap rounded-full border px-3 text-sm font-medium transition-colors md:gap-2 md:px-3.5 duration-[var(--fm-duration-fast)] md:w-auto",
        "focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-focus focus-visible:outline-offset-2",
        pressed
          ? "border-transparent bg-accent-soft text-fg-strong ring-2 ring-inset ring-link"
          : "border-border bg-canvas text-fg hover:bg-surface",
        closed ? "cursor-not-allowed opacity-60" : !loaded ? "cursor-progress" : "",
      )}
    >
      <span aria-hidden="true">{reaction.emoji}</span>
      <span aria-hidden="true" className="md:hidden">
        {REACTION_SHORT[reaction.key]}
      </span>
      <span aria-hidden="true" className="hidden md:inline">
        {reaction.label}
      </span>
      <span className={cn("ml-auto tabular-nums md:ml-0", pressed ? "text-fg-strong" : "text-fg-muted")}>
        {count > 0 ? count : <span className="sr-only">0</span>}
      </span>
    </button>
  );
}

/** One "who reacted" line. Names are text nodes, never HTML or markdown (CM-4). */
function ReactorLine({
  reaction,
  names,
  total,
}: {
  reaction: (typeof REACTIONS)[number];
  names: readonly string[];
  total: number;
}) {
  return (
    <li id={reactorsId(reaction.key)}>
      <span aria-hidden="true">{reaction.emoji}</span> <span className="sr-only">{reaction.label}: </span>
      {reactorParts(names, total).map((p, i) => (
        <Fragment key={i}>{p.kind === "name" ? <NameText name={p.text} /> : p.text}</Fragment>
      ))}
    </li>
  );
}

/**
 * The reaction bar, the failure line, the name prompt, the reactor lines and the "Your name" control (CM-2 to CM-5,
 * DESIGN 4.13.2 to 4.13.7). Counts and names come from the server render; this browser's own state applies after hydration.
 */
export function ReactionsBlock({ slug, summary, closed }: { slug: string; summary: CommunitySummary; closed: boolean }) {
  const entry = useCommunityEntry(slug);
  const { community } = useCommunityIdentity();
  const totals = Object.fromEntries(
    REACTIONS.map((r) => [r.key, displayCount(summary.reactions[r.key].count, entry.reactions[r.key])]),
  ) as Record<ReactionKey, number>;
  const lines = REACTIONS.filter((r) => totals[r.key] > 0);

  /** The server's 2 most recent names are the source of truth. The one local adjustment: un-reacting removes my own name. */
  function namesFor(key: ReactionKey): string[] {
    const names = [...summary.reactions[key].names];
    const flag = entry.reactions[key];
    if (flag.base && !flag.desired && community.displayName) {
      const i = names.indexOf(community.displayName);
      if (i >= 0) names.splice(i, 1);
    }
    return names;
  }

  return (
    <div>
      <div role="group" aria-label="Reactions" className="mt-5 grid grid-cols-2 gap-2 md:flex md:flex-wrap md:items-center">
        {REACTIONS.map((r) => (
          <ReactionButton
            key={r.key}
            slug={slug}
            reaction={r}
            serverCount={summary.reactions[r.key].count}
            flag={entry.reactions[r.key]}
            loaded={entry.loaded}
            closed={closed}
          />
        ))}
      </div>
      {closed ? (
        <p id={CLOSED_NOTE_ID} className="mt-3 text-sm text-fg-muted">
          Reactions are closed on archived workflows.
        </p>
      ) : null}
      <CommunityErrorLine slug={slug} />
      <NamePrompt slug={slug} />
      {lines.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm text-fg-muted">
          {lines.map((r) => (
            <ReactorLine key={r.key} reaction={r} names={namesFor(r.key)} total={totals[r.key]} />
          ))}
        </ul>
      ) : null}
      {closed ? null : <NameControl />}
    </div>
  );
}
