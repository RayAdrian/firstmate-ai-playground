import { REACTIONS, type CommunitySummary } from "@/lib/contracts";
import { compactCounts, reactionSentence, type ReactionCounts } from "@/lib/community/format";
import { NamePrompt } from "./name-prompt";
import { CommunityErrorLine } from "./reactions";
import { StarButton } from "./star-button";

function countsOf(summary: CommunitySummary): ReactionCounts {
  return Object.fromEntries(REACTIONS.map((r) => [r.key, summary.reactions[r.key].count])) as ReactionCounts;
}

/**
 * Read-only reaction counts on a card (CM-2, DESIGN 4.13.4). The visible compact row is `aria-hidden`; the same counts are
 * one comma-separated sentence for screen readers. Zero counts are omitted, and so is the whole row when all are zero.
 */
export function CardCounts({ summary }: { summary: CommunitySummary }) {
  const counts = countsOf(summary);
  const sentence = reactionSentence(counts);
  if (!sentence) return null;
  return (
    <p className="mt-2 text-sm tabular-nums text-fg-muted">
      <span aria-hidden="true">{compactCounts(counts)}</span>
      <span className="sr-only">{sentence}</span>
    </p>
  );
}

/** The card's Star (a client island; the rest of the card stays a Server Component). */
export function CardStar({ summary, title, closed }: { summary: CommunitySummary; title: string; closed: boolean }) {
  return <StarButton slug={summary.slug} title={title} stars={summary.stars} variant="card" closed={closed} />;
}

/** The card's failure line and name prompt, under the footer at full card width. */
export function CardExtras({ slug }: { slug: string }) {
  return (
    <>
      <CommunityErrorLine slug={slug} />
      <NamePrompt slug={slug} />
    </>
  );
}
