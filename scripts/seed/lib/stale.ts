import { manilaDate } from "./text";

export { manilaDate };

export const STALE_AFTER_DAYS = 60;

export type ToolKey = "claude_code" | "codex_cli";

export interface StaleLessonInput {
  slug: string;
  last_verified_on: string | null;
  tool_versions: Partial<Record<ToolKey, string>>;
}

export type StaleReason =
  | { kind: "age"; days: number }
  | { kind: "never" }
  | { kind: "version"; tool: ToolKey; lesson: string; latest: string };

export interface StaleFinding {
  slug: string;
  reasons: StaleReason[];
}

interface ParsedVersion {
  nums: [number, number, number];
  prerelease: boolean;
}

function parseVersion(v: string): ParsedVersion | null {
  const m = /^(?:rust-)?v?(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z.-]+)?(?:\+.*)?$/.exec(v.trim());
  if (!m) return null;
  return { nums: [Number(m[1]), Number(m[2]), Number(m[3])], prerelease: m[4] !== undefined };
}

function compare(a: ParsedVersion, b: ParsedVersion): number {
  for (let i = 0; i < 3; i++) {
    const d = (a.nums[i] ?? 0) - (b.nums[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** True when the lesson's version is older than the latest STABLE release. Prereleases and unparseable strings never count. */
export function isBehind(lessonVersion: string, latestSeen: string): boolean {
  const lesson = parseVersion(lessonVersion);
  const latest = parseVersion(latestSeen);
  if (!lesson || !latest || latest.prerelease) return false;
  return compare(lesson, latest) < 0;
}

const RELEASE_SOURCES: Record<string, ToolKey> = {
  "claude-code-releases": "claude_code",
  "codex-cli-releases": "codex_cli",
};
export const RELEASE_SOURCE_SLUGS = Object.keys(RELEASE_SOURCES);

/** Highest stable version per tool found in release-feed item titles. */
export function latestVersionsFromReleases(items: { source_slug: string; title: string }[]): Partial<Record<ToolKey, string>> {
  const best: Partial<Record<ToolKey, { text: string; v: ParsedVersion }>> = {};
  for (const item of items) {
    const tool = RELEASE_SOURCES[item.source_slug];
    if (!tool) continue;
    const m = /(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/.exec(item.title);
    const text = m?.[1];
    const v = text ? parseVersion(text) : null;
    if (!text || !v || v.prerelease) continue;
    const cur = best[tool];
    if (!cur || compare(v, cur.v) > 0) best[tool] = { text, v };
  }
  const out: Partial<Record<ToolKey, string>> = {};
  for (const tool of Object.keys(best) as ToolKey[]) out[tool] = best[tool]?.text;
  return out;
}

function dayNumber(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1) / 86_400_000;
}

export function findStale(input: {
  lessons: StaleLessonInput[];
  now: Date;
  latest: Partial<Record<ToolKey, string>>;
}): StaleFinding[] {
  const today = dayNumber(manilaDate(input.now));
  const findings: StaleFinding[] = [];
  for (const lesson of input.lessons) {
    const reasons: StaleReason[] = [];
    if (!lesson.last_verified_on) {
      reasons.push({ kind: "never" });
    } else {
      const days = today - dayNumber(lesson.last_verified_on);
      if (days > STALE_AFTER_DAYS) reasons.push({ kind: "age", days });
    }
    for (const tool of ["claude_code", "codex_cli"] as const) {
      const mine = lesson.tool_versions[tool];
      const latest = input.latest[tool];
      if (mine && latest && isBehind(mine, latest)) reasons.push({ kind: "version", tool, lesson: mine, latest });
    }
    if (reasons.length > 0) findings.push({ slug: lesson.slug, reasons });
  }
  return findings;
}

export function describeReason(r: StaleReason): string {
  switch (r.kind) {
    case "age":
      return `last verified ${r.days} days ago (limit ${STALE_AFTER_DAYS})`;
    case "never":
      return "never verified";
    case "version":
      return `${r.tool === "claude_code" ? "Claude Code" : "Codex CLI"} ${r.lesson}, latest release seen ${r.latest}`;
  }
}
