// `npm run content:stale [-- --strict]`: list lessons verified more than 60 days ago, or whose tool_versions are behind
// the latest Claude Code / Codex CLI release seen in the news feed (PRD S-6). Reports only; --strict exits 1 when any are stale.
import path from "node:path";
import { getServiceClient } from "../../src/lib/db/service";
import { loadLocalEnv, requireServiceEnv } from "./lib/env";
import { describeMediaReason, findStaleMedia, hashSourceFromDisk, loadManifests, type LessonInfo } from "./lib/media-stale";
import { RELEASE_SOURCE_SLUGS, describeReason, findStale, latestVersionsFromReleases, type StaleLessonInput } from "./lib/stale";
import { reportWorkflowStale } from "./lib/workflows-stale";

async function main(): Promise<number> {
  const strict = process.argv.includes("--strict");
  const now = process.env.FM_NOW ? new Date(process.env.FM_NOW) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error("FM_NOW is not a valid ISO timestamp.");

  loadLocalEnv();
  requireServiceEnv();
  const db = getServiceClient();

  const { data: lessons, error } = await db
    .from("lessons")
    .select("slug, last_verified_on, tool_versions, sort")
    .is("archived_at", null)
    .order("slug");
  if (error) throw new Error(`cannot read lessons: ${error.message}`);

  const { data: sources, error: sourcesError } = await db.from("news_sources").select("id, slug").in("slug", RELEASE_SOURCE_SLUGS);
  if (sourcesError) throw new Error(`cannot read news sources: ${sourcesError.message}`);

  let latest: ReturnType<typeof latestVersionsFromReleases> = {};
  if (sources.length > 0) {
    const slugById = new Map(sources.map((s) => [s.id, s.slug]));
    const { data: items, error: itemsError } = await db
      .from("news_items")
      .select("source_id, title")
      .in("source_id", sources.map((s) => s.id));
    if (itemsError) throw new Error(`cannot read release items: ${itemsError.message}`);
    latest = latestVersionsFromReleases(items.map((i) => ({ source_slug: slugById.get(i.source_id) ?? "", title: i.title })));
  }

  const input: StaleLessonInput[] = lessons.map((l) => ({
    slug: l.slug,
    last_verified_on: l.last_verified_on,
    tool_versions: l.tool_versions,
  }));
  const stale = findStale({ lessons: input, now, latest });

  if (!latest.claude_code && !latest.codex_cli) {
    console.log("content:stale: version check skipped (no Claude Code / Codex release data in the database; run `npm run news:run` or `npm run news:import`).");
  } else {
    console.log(`content:stale: latest releases seen: Claude Code ${latest.claude_code ?? "unknown"}, Codex CLI ${latest.codex_cli ?? "unknown"}.`);
  }

  // Lesson media (PRD §15 MD-7). Reads all lessons, archived included, so archived ones can be reported.
  const { data: allLessons, error: allError } = await db.from("lessons").select("slug, archived_at, tool_versions");
  if (allError) throw new Error(`cannot read lessons: ${allError.message}`);
  const lessonInfo = new Map<string, LessonInfo>(
    allLessons.map((l) => [l.slug, { archived: l.archived_at !== null, tool_versions: l.tool_versions }]),
  );
  const repoRoot = path.resolve(__dirname, "../..");
  const manifests = loadManifests(repoRoot);
  const staleMedia = findStaleMedia({ manifests, lessons: lessonInfo, sourceHash: hashSourceFromDisk(repoRoot) });

  if (stale.length === 0) {
    console.log(`content:stale: no stale lessons (${lessons.length} checked).`);
  } else {
    console.log(`content:stale: ${stale.length} of ${lessons.length} lesson(s) need re-verification:`);
    for (const s of stale) console.log(`  ${s.slug}: ${s.reasons.map(describeReason).join("; ")}`);
  }
  if (staleMedia.length === 0) {
    console.log(`content:stale: no stale media (${manifests.length} checked).`);
  } else {
    console.log(`content:stale: ${staleMedia.length} of ${manifests.length} media item(s) need re-rendering:`);
    for (const m of staleMedia) console.log(`  ${m.label}: ${m.reasons.map(describeMediaReason).join("; ")}`);
  }
  await reportWorkflowStale(db, now, latest); // PRD §16 WF-41: reports only, never affects the exit code
  return strict && (stale.length > 0 || staleMedia.length > 0) ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(`content:stale: ${err instanceof Error ? err.message : "unexpected error"}`);
    process.exit(1);
  },
);
