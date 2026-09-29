"use client";

import { BookmarkCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, EmptyState, Notice, Skeleton } from "@/components/ui";
import { DbUnavailableError } from "@/lib/db/errors";
import { announce, useBookmarks, type BookmarkKind } from "@/lib/progress";
import { resolveNewsBookmarks, type NewsBookmarkItem } from "./actions";

export type BookmarkLesson = {
  slug: string;
  title: string;
  minutes: number;
  level: number | null;
};

const UNDO_MS = 8000;

const manila = new Intl.DateTimeFormat("en-PH", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Manila",
});
const savedFormat = new Intl.DateTimeFormat("en-PH", {
  day: "numeric",
  month: "short",
  timeZone: "Asia/Manila",
});

type Removed = { kind: BookmarkKind; id: string; at: string; label: string };
const removedKey = (kind: BookmarkKind, id: string) => `${kind}:${id}`;

type Resolution = {
  resolved: Readonly<Record<string, NewsBookmarkItem | null>>;
  failure: "error" | "db-unavailable" | null;
  retry: () => void;
};

/** Resolve bookmarked news ids against the DB, fetching only ids not seen yet. */
function useNewsResolution(ids: readonly string[]): Resolution {
  const [resolved, setResolved] = useState<Record<string, NewsBookmarkItem | null>>({});
  const [failure, setFailure] = useState<Resolution["failure"]>(null);
  const [attempt, setAttempt] = useState(0);
  const idsKey = ids.join(",");

  useEffect(() => {
    const need = idsKey === "" ? [] : idsKey.split(",").filter((id) => !(id in resolved));
    if (need.length === 0) return;
    let cancelled = false;
    resolveNewsBookmarks(need)
      .then((result) => {
        if (cancelled) return;
        if (result.status !== "ok") {
          setFailure(result.status);
          return;
        }
        const found = new Map(result.items.map((item) => [item.id, item]));
        setFailure(null);
        setResolved((prev) => ({
          ...prev,
          ...Object.fromEntries(need.map((id) => [id, found.get(id) ?? null])),
        }));
      })
      .catch(() => {
        if (!cancelled) setFailure("error");
      });
    return () => {
      cancelled = true;
    };
    // `resolved` is read only to skip ids that are already known; attempt re-runs after a failure.
  }, [idsKey, resolved, attempt]);

  const retry = useCallback(() => {
    setFailure(null);
    setAttempt((n) => n + 1);
  }, []);
  return { resolved, failure, retry };
}

export function BookmarksView({ lessons }: { lessons: BookmarkLesson[] }) {
  const { hydrated, lessons: lessonEntries, news: newsEntries, restore, remove } = useBookmarks();
  const newsIds = useMemo(() => newsEntries.map((entry) => entry.id), [newsEntries]);
  const { resolved, failure, retry } = useNewsResolution(newsIds);
  const [removed, setRemoved] = useState<Record<string, Removed>>({});
  const timers = useRef<Map<string, number>>(new Map());
  const lessonsHeading = useRef<HTMLHeadingElement>(null);
  const newsHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const active = timers.current;
    return () => {
      for (const timer of active.values()) window.clearTimeout(timer);
      active.clear();
    };
  }, []);

  const lessonBySlug = useMemo(() => new Map(lessons.map((l) => [l.slug, l])), [lessons]);

  // A DB outage must show the app-wide "database unavailable" page, not "no longer available".
  if (failure === "db-unavailable") throw new DbUnavailableError();

  if (!hydrated) {
    return (
      <div data-testid="bookmarks-skeleton" aria-busy="true" className="space-y-6">
        {["Lessons", "News"].map((name) => (
          <div key={name} className="space-y-3">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ))}
      </div>
    );
  }

  const expire = (key: string, kind: BookmarkKind) => {
    timers.current.delete(key);
    const row = document.querySelector(`[data-bookmark-row="${CSS.escape(key)}"]`);
    if (row?.contains(document.activeElement)) {
      (kind === "lessons" ? lessonsHeading : newsHeading).current?.focus();
    }
    setRemoved((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => k !== key)));
  };

  const onRemove = (kind: BookmarkKind, id: string, at: string, label: string) => {
    const key = removedKey(kind, id);
    remove(kind, id);
    setRemoved((prev) => ({ ...prev, [key]: { kind, id, at, label } }));
    window.clearTimeout(timers.current.get(key));
    timers.current.set(key, window.setTimeout(() => expire(key, kind), UNDO_MS));
    announce("Removed from bookmarks");
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-bookmark-row="${CSS.escape(key)}"] button`)?.focus();
    });
  };

  const onUndo = (entry: Removed) => {
    const key = removedKey(entry.kind, entry.id);
    window.clearTimeout(timers.current.get(key));
    timers.current.delete(key);
    restore(entry.kind, entry.id, entry.at);
    setRemoved((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => k !== key)));
    window.requestAnimationFrame(() => {
      document.getElementById(`bookmark-toggle-${key}`)?.focus();
    });
  };

  type Row = { at: string; node: React.ReactNode; key: string };

  const lessonRows: Row[] = [];
  for (const entry of lessonEntries) {
    const lesson = lessonBySlug.get(entry.id);
    if (!lesson) continue; // archived or deleted: kept in storage, not rendered (P-4)
    const key = removedKey("lessons", entry.id);
    lessonRows.push({
      at: entry.at,
      key,
      node: (
        <LessonRow
          key={key}
          rowKey={key}
          lesson={lesson}
          at={entry.at}
          onRemove={() => onRemove("lessons", entry.id, entry.at, lesson.title)}
        />
      ),
    });
  }
  const newsRows: Row[] = [];
  for (const entry of newsEntries) {
    const key = removedKey("news", entry.id);
    const item = resolved[entry.id];
    let node: React.ReactNode;
    if (item === undefined) {
      if (failure) continue;
      node = (
        <li key={key} aria-hidden="true">
          <Skeleton className="h-16 w-full" />
        </li>
      );
    } else if (item === null) {
      node = (
        <li
          key={key}
          data-bookmark-row={key}
          className="flex items-center justify-between gap-3 rounded border border-dashed p-4"
        >
          <span className="text-fg-muted">Item no longer available</span>
          <Button onClick={() => onRemove("news", entry.id, entry.at, "Unavailable item")}>
            Remove bookmark
          </Button>
        </li>
      );
    } else {
      node = (
        <NewsRow
          key={key}
          rowKey={key}
          item={item}
          onRemove={() => onRemove("news", entry.id, entry.at, item.title)}
        />
      );
    }
    newsRows.push({ at: entry.at, key, node });
  }

  for (const entry of Object.values(removed)) {
    const key = removedKey(entry.kind, entry.id);
    const row: Row = {
      at: entry.at,
      key,
      node: (
        <li
          key={key}
          data-bookmark-row={key}
          className="flex items-center justify-between gap-3 rounded border p-4"
        >
          <span>Removed from bookmarks.</span>
          <Button onClick={() => onUndo(entry)}>Undo</Button>
        </li>
      ),
    };
    (entry.kind === "lessons" ? lessonRows : newsRows).push(row);
  }
  const byNewest = (a: Row, b: Row) => (a.at === b.at ? 0 : a.at < b.at ? 1 : -1);
  lessonRows.sort(byNewest);
  newsRows.sort(byNewest);

  if (lessonRows.length === 0 && newsRows.length === 0 && !failure) {
    return (
      <EmptyState title="Nothing bookmarked yet">
        <p className="mt-2 text-fg-muted">
          Use the Bookmark button on any lesson or news item. Bookmarks stay in this browser.
        </p>
        <p className="mt-4 flex justify-center gap-4">
          <Link href="/curriculum" className="underline">
            Browse curriculum
          </Link>
          <Link href="/news" className="underline">
            Today&apos;s digest
          </Link>
        </p>
      </EmptyState>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section aria-labelledby="bookmarks-lessons-heading" className="space-y-3">
        <h2
          id="bookmarks-lessons-heading"
          ref={lessonsHeading}
          tabIndex={-1}
          className="text-xl font-bold"
        >
          Lessons ({lessonRows.filter((r) => !removed[r.key]).length})
        </h2>
        {lessonRows.length === 0 ? (
          <p className="text-fg-muted">No lessons bookmarked.</p>
        ) : (
          <ul className="space-y-3">{lessonRows.map((r) => r.node)}</ul>
        )}
      </section>
      <section aria-labelledby="bookmarks-news-heading" className="space-y-3">
        <h2
          id="bookmarks-news-heading"
          ref={newsHeading}
          tabIndex={-1}
          className="text-xl font-bold"
        >
          News ({newsRows.filter((r) => !removed[r.key]).length})
        </h2>
        {failure === "error" && (
          <Notice tone="error">
            <p>
              Couldn&apos;t load your bookmarked news. Your bookmarks are safe.{" "}
              <Button onClick={retry}>Try again</Button>
            </p>
          </Notice>
        )}
        {newsRows.length === 0 ? (
          failure ? null : <p className="text-fg-muted">No news bookmarked.</p>
        ) : (
          <ul className="space-y-3">{newsRows.map((r) => r.node)}</ul>
        )}
      </section>
    </div>
  );
}

function ToggleButton({
  id,
  title,
  onClick,
}: {
  id: string;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      id={id}
      aria-label={`Bookmark: ${title}`}
      aria-pressed={true}
      onClick={onClick}
      className="rounded p-2"
    >
      <BookmarkCheck aria-hidden="true" className="size-5" />
    </button>
  );
}

function LessonRow({
  rowKey,
  lesson,
  at,
  onRemove,
}: {
  rowKey: string;
  lesson: BookmarkLesson;
  at: string;
  onRemove: () => void;
}) {
  const meta = [
    lesson.level === null ? null : `L${lesson.level}`,
    `${lesson.minutes} min`,
    `saved ${savedFormat.format(new Date(at))}`,
  ].filter(Boolean);
  return (
    <li data-bookmark-row={rowKey} className="flex items-start justify-between gap-3 rounded border p-4">
      <div className="min-w-0">
        <Link href={`/lessons/${lesson.slug}`} className="font-bold underline">
          {lesson.title}
        </Link>
        <p className="text-sm text-fg-muted">{meta.join(" · ")}</p>
      </div>
      <ToggleButton id={`bookmark-toggle-${rowKey}`} title={lesson.title} onClick={onRemove} />
    </li>
  );
}

function NewsRow({
  rowKey,
  item,
  onRemove,
}: {
  rowKey: string;
  item: NewsBookmarkItem;
  onRemove: () => void;
}) {
  const meta = [
    item.sourceName,
    item.publishedAt ? manila.format(new Date(item.publishedAt)) : null,
  ].filter(Boolean);
  return (
    <li data-bookmark-row={rowKey} className="flex items-start justify-between gap-3 rounded border p-4">
      <div className="min-w-0">
        {item.url ? (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold underline"
          >
            {item.title}
            <span className="sr-only"> (opens in new tab)</span>
          </a>
        ) : (
          <span className="font-bold">{item.title}</span>
        )}
        {meta.length > 0 && <p className="text-sm text-fg-muted">{meta.join(" · ")}</p>}
      </div>
      <ToggleButton id={`bookmark-toggle-${rowKey}`} title={item.title} onClick={onRemove} />
    </li>
  );
}

