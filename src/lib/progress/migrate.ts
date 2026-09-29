import { PROGRESS_VERSION } from "@/lib/contracts";

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
 * Ordered registry of production migrations, keyed by from-version. Append the v1 -> v2
 * step here when the schema changes; existing entries never need editing.
 * Empty while the current version is 1.
 */
export const MIGRATIONS: readonly Migration[] = [];

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
