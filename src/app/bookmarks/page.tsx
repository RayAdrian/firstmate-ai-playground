import type { Metadata } from "next";
import { dbRead } from "@/lib/db";
import { getReadClient } from "@/lib/db/server";
import { BookmarksView, type BookmarkLesson } from "./bookmarks-view";

export const metadata: Metadata = { title: "Bookmarks · First Mate AI Playground" };

// Lesson titles come from the DB, so content edits must show without a rebuild.
export const dynamic = "force-dynamic";

/**
 * Active lessons only: an archived or deleted slug simply has no entry here, so its bookmark
 * stays in storage but is not rendered (P-4). A DB outage throws DbUnavailableError, which the
 * app-wide error boundary renders; it is never read as "the lessons were deleted".
 */
async function loadLessons(): Promise<BookmarkLesson[]> {
  const db = getReadClient();
  const [lessons, levels] = await Promise.all([
    dbRead(db.from("lessons").select("slug,title,est_minutes,level_id").is("archived_at", null)),
    dbRead(db.from("levels").select("id,number")),
  ]);
  const levelNumber = new Map(levels.map((level) => [level.id, level.number]));
  return lessons.map((lesson) => ({
    slug: lesson.slug,
    title: lesson.title,
    minutes: lesson.est_minutes,
    level: levelNumber.get(lesson.level_id) ?? null,
  }));
}

export default async function BookmarksPage() {
  const lessons = await loadLessons();
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-fg-strong md:text-4xl">Bookmarks</h1>
        <p className="text-fg-muted">Saved in this browser only.</p>
      </header>
      <BookmarksView lessons={lessons} />
    </div>
  );
}
