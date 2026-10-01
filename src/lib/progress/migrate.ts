import { PROGRESS_VERSION, createCommunity } from "@/lib/contracts";

/**
 * One step of the version migration chain. `up` receives the raw (not yet validated)
 * document at version `from` and returns it at version `to`.
 */
export type Migration = {
  readonly from: number;
  readonly to: number;
  up(doc: Record<string, unknown>): Record<string, unknown>;
};

/**
 * Ordered registry of production migrations, keyed by from-version. Append the next step
 * here when the schema changes; existing entries never need editing.
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    // PRD 18.3: add the anonymous community identity. Every v1 field is carried over untouched.
    from: 1,
    to: 2,
    up: (doc) => ({ ...doc, version: 2, community: createCommunity() }),
  },
];

export class MigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MigrationError";
  }
}

/**
 * Walk a raw document from its own `version` up to `to` (default: the current version)
 * by chaining migrations. A document already at `to` is returned unchanged.
 * Throws MigrationError when no path exists (newer than `to`, or a gap in the chain).
 */
export function migrate(
  doc: Record<string, unknown>,
  options: { to?: number; registry?: readonly Migration[] } = {},
): Record<string, unknown> {
  const to = options.to ?? PROGRESS_VERSION;
  const registry = options.registry ?? MIGRATIONS;
  let current = doc;
  const declared = doc.version;
  if (typeof declared !== "number" || !Number.isInteger(declared)) {
    throw new MigrationError("version is not an integer");
  }
  let version: number = declared;
  if (version > to) throw new MigrationError(`version ${version} is newer than ${to}`);
  while (version < to) {
    const step = registry.find((m) => m.from === version);
    if (!step) throw new MigrationError(`no migration from version ${version}`);
    current = step.up(current);
    version = step.to;
    if (current.version !== version) current = { ...current, version };
  }
  return current;
}
