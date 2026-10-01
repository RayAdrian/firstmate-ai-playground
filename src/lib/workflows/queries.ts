import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { workflowRowSchema, type WorkflowRow } from "@/lib/contracts";
import { dbRead } from "@/lib/db";
import { getReadClient } from "@/lib/db/server";
import { getNow, manilaDate } from "@/lib/time/now";
import { freshnessOf, sortWorkflows, type WorkflowCardData } from "./filter";

// src/lib/db/types.ts (M0-owned, frozen) does not list `workflows` yet, so the read client is typed here
// with a read-only schema for the one table this module reads. Delete this and use getReadClient() directly
// once `workflows: ReadOnlyTable<WorkflowRow>` is added to ReadOnlyDatabase.
type WorkflowsReadDb = {
  public: {
    Tables: { workflows: { Row: WorkflowRow; Insert: never; Update: never; Relationships: [] } };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

function workflowsClient(): SupabaseClient<WorkflowsReadDb> {
  return getReadClient() as unknown as SupabaseClient<WorkflowsReadDb>;
}

const CARD_COLUMNS =
  "slug, title, problem, tools, setup_kinds, use_cases, stacks, related_lesson_slug, level, verified_on, author_name, reviewed_on";

const cardSchema = workflowRowSchema.pick({
  slug: true,
  title: true,
  problem: true,
  tools: true,
  setup_kinds: true,
  use_cases: true,
  stacks: true,
  related_lesson_slug: true,
  level: true,
  verified_on: true,
  author_name: true,
  reviewed_on: true,
});

export type WorkflowIndexData = { rows: WorkflowCardData[]; today: string };

/** Every non-removed workflow, in card shape. A row that fails the contract is skipped, not fatal. */
export const getWorkflowIndex = cache(async (): Promise<WorkflowIndexData> => {
  const [raw, now] = await Promise.all([
    dbRead<unknown[]>(workflowsClient().from("workflows").select(CARD_COLUMNS).is("removed_at", null)),
    getNow(),
  ]);
  const rows: WorkflowCardData[] = [];
  for (const r of raw) {
    const parsed = cardSchema.safeParse(r);
    if (parsed.success) rows.push(parsed.data);
  }
  return { rows, today: manilaDate(now) };
});

/** Cheap existence check for the route layout (a real HTTP 404 needs it above the loading boundary). */
export const workflowExists = cache(async (slug: string): Promise<boolean> => {
  const row = await dbRead<{ slug: string } | null>(
    workflowsClient().from("workflows").select("slug").eq("slug", slug).is("removed_at", null).maybeSingle(),
  );
  return row !== null;
});

export type WorkflowPageData = { workflow: WorkflowRow; today: string };

/** One non-removed workflow with today's Manila date. null for an unknown or removed slug, or a row that fails the contract. */
export const getWorkflowPage = cache(async (slug: string): Promise<WorkflowPageData | null> => {
  const [raw, now] = await Promise.all([
    dbRead<unknown>(workflowsClient().from("workflows").select("*").eq("slug", slug).is("removed_at", null).maybeSingle()),
    getNow(),
  ]);
  if (raw === null) return null;
  const parsed = workflowRowSchema.safeParse(raw);
  if (!parsed.success) return null;
  return { workflow: parsed.data, today: manilaDate(now) };
});

export type LessonWorkflows = { items: WorkflowCardData[]; total: number };

/** Non-archived workflows whose related_lesson is `lessonSlug`: newest verified first, at most `limit` (WF-39a). */
export async function getWorkflowsForLesson(lessonSlug: string, limit = 3): Promise<LessonWorkflows> {
  const { rows, today } = await getWorkflowIndex();
  const live = sortWorkflows(
    rows.filter((r) => r.related_lesson_slug === lessonSlug && freshnessOf(r.verified_on, today) !== "archived"),
  );
  return { items: live.slice(0, limit), total: live.length };
}
