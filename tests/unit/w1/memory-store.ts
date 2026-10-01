import type { StoredWorkflow, WorkflowPayload, WorkflowStore } from "../../../scripts/seed/lib/workflows";

export interface MemoryStore extends WorkflowStore {
  rows(): StoredWorkflow[];
  /** Every write call, in order, so a test can assert that a second run wrote nothing. */
  log: string[];
}

/** An in-memory WorkflowStore with the same semantics as the Supabase adapter. */
export function memoryStore(): MemoryStore {
  const table = new Map<string, StoredWorkflow & { updated_at: string }>();
  const log: string[] = [];
  let n = 0;
  return {
    log,
    rows: () => [...table.values()].sort((a, b) => (a.slug < b.slug ? -1 : 1)),
    async list() {
      return [...table.values()].map((r) => structuredClone(r));
    },
    async insert(p: WorkflowPayload, nowIso: string) {
      log.push(`insert ${p.slug}`);
      n += 1;
      table.set(`id-${n}`, { ...structuredClone(p), id: `id-${n}`, removed_at: null, updated_at: nowIso });
    },
    async update(id: string, p: WorkflowPayload, nowIso: string) {
      log.push(`update ${p.slug}`);
      const row = table.get(id);
      if (!row) throw new Error("no such row");
      table.set(id, { ...structuredClone(p), id, removed_at: null, updated_at: nowIso });
    },
    async setRemoved(id: string, removedAt: string) {
      const row = table.get(id);
      if (!row) throw new Error("no such row");
      log.push(`remove ${row.slug}`);
      row.removed_at = removedAt;
    },
    async deleteByIds(ids: string[]) {
      for (const id of ids) {
        log.push(`delete ${table.get(id)?.slug ?? id}`);
        table.delete(id);
      }
    },
  };
}
