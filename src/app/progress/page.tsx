import type { Metadata } from "next";
import { dbRead } from "@/lib/db";
import { getReadClient } from "@/lib/db/server";
import { ProgressNotices } from "@/lib/progress";
import { ProgressPanel } from "./progress-panel";

export const metadata: Metadata = { title: "Progress · First Mate AI Playground" };

// Lesson slugs come from the DB, so content edits must show without a rebuild.
export const dynamic = "force-dynamic";

/**
 * Active lesson slugs, used only to make the summary ignore deleted/archived lessons (P-4).
 * /progress works without the DB (it reads localStorage), so any failure degrades to `null`.
 */
async function loadLessonSlugs(): Promise<string[] | null> {
  try {
    const rows = await dbRead(getReadClient().from("lessons").select("slug").is("archived_at", null));
    return rows.map((row) => row.slug);
  } catch {
    return null;
  }
}

export default async function ProgressPage() {
  const lessonSlugs = await loadLessonSlugs();
  return (
    <div className="max-w-[700px] space-y-8">
      <ProgressNotices fallback />
      <header className="space-y-2">
        <h1 className="text-3xl font-bold md:text-4xl">Progress</h1>
        <p className="text-fg-muted">Your progress is saved in this browser only.</p>
      </header>
      <ProgressPanel lessonSlugs={lessonSlugs} />
    </div>
  );
}
