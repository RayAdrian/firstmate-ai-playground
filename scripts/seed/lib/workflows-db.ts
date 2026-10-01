import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkflowRow } from "../../../src/lib/contracts";
import type { Database } from "../../../src/lib/db/types";

type Table<R> = {
  Row: R;
  Insert: Partial<R>;
  Update: Partial<R>;
  Relationships: [];
};

/**
 * Typing for `public.workflows` (PRD §16.8). `src/lib/db/types.ts` is frozen after M0 and does not list this table yet, so the
 * seed and `content:stale` view the service client through this schema instead. Once the M0-owned `Database` type gains
 * `workflows`, delete this file and use the client as it is.
 */
export type WorkflowsDatabase = {
  public: {
    Tables: { workflows: Table<WorkflowRow> };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type WorkflowsClient = SupabaseClient<WorkflowsDatabase>;

/** The same connection, typed for the workflows table. */
export function workflowsClient(db: SupabaseClient<Database>): WorkflowsClient {
  return db as unknown as WorkflowsClient;
}
