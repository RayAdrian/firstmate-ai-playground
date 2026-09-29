import type {
  ExerciseRow,
  IngestRunRow,
  LessonRow,
  LevelRow,
  NewsItemRow,
  NewsSourceRow,
} from "@/lib/contracts";

type Table<R> = {
  Row: R;
  Insert: Partial<R>;
  Update: Partial<R>;
  Relationships: [];
};

type ReadOnlyTable<R> = {
  Row: R;
  Insert: never;
  Update: never;
  Relationships: [];
};

type Schema<T extends Record<string, unknown>> = {
  public: {
    Tables: T;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

/** Full read/write schema, for the service-role client used by scripts. */
export type Database = Schema<{
  levels: Table<LevelRow>;
  lessons: Table<LessonRow>;
  exercises: Table<ExerciseRow>;
  news_sources: Table<NewsSourceRow>;
  news_items: Table<NewsItemRow>;
  ingest_runs: Table<IngestRunRow>;
}>;

/** Insert/Update are `never`, so writes through the anon client fail to compile. */
export type ReadOnlyDatabase = Schema<{
  levels: ReadOnlyTable<LevelRow>;
  lessons: ReadOnlyTable<LessonRow>;
  exercises: ReadOnlyTable<ExerciseRow>;
  news_sources: ReadOnlyTable<NewsSourceRow>;
  news_items: ReadOnlyTable<NewsItemRow>;
  ingest_runs: ReadOnlyTable<IngestRunRow>;
}>;
