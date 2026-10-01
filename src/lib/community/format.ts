import { REACTIONS, type ReactionKey } from "@/lib/contracts";

/** Visible label below md. Each short form is a PREFIX of its full label (DESIGN 4.13.2, WCAG 2.5.3 Label in Name). */
export const REACTION_SHORT: Readonly<Record<ReactionKey, string>> = {
  worked: "Worked",
  learned: "Learned",
  saved_time: "Saved",
  game_changer: "Game-changer",
};

export type ReactionCounts = Readonly<Record<ReactionKey, number>>;

export const ZERO_COUNTS: ReactionCounts = { worked: 0, learned: 0, saved_time: 0, game_changer: 0 };

export type ReactorPart = { kind: "name"; text: string } | { kind: "text"; text: string };

/**
 * The "who reacted" sentence as parts, so the page can render names as plain, truncated text nodes (CM-3, CM-4).
 * `names` are the most recent named reactors (at most 2 are used); `total` counts every reaction, anonymous or not.
 */
export function reactorParts(names: readonly string[], total: number): ReactorPart[] {
  if (!Number.isFinite(total) || total <= 0) return [];
  const shown = names.slice(0, Math.min(2, total));
  if (shown.length === 0) return [{ kind: "text", text: total === 1 ? "1 person" : `${total} people` }];
  const others = total - shown.length;
  const out: ReactorPart[] = [];
  shown.forEach((name, i) => {
    if (i > 0) out.push({ kind: "text", text: others > 0 ? ", " : " and " });
    out.push({ kind: "name", text: name });
  });
  if (others > 0) out.push({ kind: "text", text: ` and ${others} ${others === 1 ? "other" : "others"}` });
  return out;
}

/** CM-3: "Rafael, Ana and 3 others", "Rafael and Ana", "Rafael", "4 people", "1 person"; "" when there are none. */
export function formatReactors(names: readonly string[], total: number): string {
  return reactorParts(names, total)
    .map((p) => p.text)
    .join("");
}

/** The card's one-sentence reading of the counts, in the fixed order, zeros omitted: "3 worked for me, 2 game-changer". */
export function reactionSentence(counts: ReactionCounts): string {
  return REACTIONS.filter((r) => counts[r.key] > 0)
    .map((r) => `${counts[r.key]} ${r.label.toLowerCase()}`)
    .join(", ");
}

/** The card's compact visible row: "🙌 4 · 🔥 2", zeros omitted. */
export function compactCounts(counts: ReactionCounts): string {
  return REACTIONS.filter((r) => counts[r.key] > 0)
    .map((r) => `${r.emoji} ${counts[r.key]}`)
    .join(" · ");
}

export function starsLabel(count: number): string {
  return `${count} ${count === 1 ? "star" : "stars"}`;
}
