import { parseArgs } from "node:util";

export const USAGE = `Usage: npm run news:run -- [--dry-run] [--no-score] [--source=<slug>] [--publish] [--gate] [--rescore]
  --dry-run       fetch, dedupe and print; no DB writes, no claude, no spool
  --no-score      fetch and store items as pending (claude is not called)
  --source=<slug> fetch only that source (even if it is disabled)
  --rescore       score pending items only, no fetching (same as npm run news:rescore)
  --publish       after the run, commit and push the snapshot to the news-snapshots branch
  --gate          scheduled mode: run only at/after 07:00 Asia/Manila and only once a day`;

export interface RunArgs {
  dryRun: boolean;
  noScore: boolean;
  rescoreOnly: boolean;
  sourceSlug: string | null;
  publish: boolean;
  gate: boolean;
}

export type ParsedArgs = { ok: true; args: RunArgs } | { ok: false; message: string };

export function parseRunArgs(argv: readonly string[]): ParsedArgs {
  try {
    const { values, positionals } = parseArgs({
      args: [...argv],
      allowPositionals: true,
      strict: true,
      options: {
        "dry-run": { type: "boolean" },
        "no-score": { type: "boolean" },
        rescore: { type: "boolean" },
        publish: { type: "boolean" },
        gate: { type: "boolean" },
        source: { type: "string" },
      },
    });
    if (positionals.length > 0) return { ok: false, message: `Unexpected argument: ${positionals[0]}\n${USAGE}` };
    const args: RunArgs = {
      dryRun: values["dry-run"] === true,
      noScore: values["no-score"] === true,
      rescoreOnly: values.rescore === true,
      sourceSlug: values.source ?? null,
      publish: values.publish === true,
      gate: values.gate === true,
    };
    if (args.dryRun && args.publish) return { ok: false, message: `--dry-run cannot be combined with --publish\n${USAGE}` };
    if (args.rescoreOnly && args.noScore) return { ok: false, message: `--rescore cannot be combined with --no-score\n${USAGE}` };
    return { ok: true, args };
  } catch (err) {
    return { ok: false, message: `${err instanceof Error ? err.message : "invalid arguments"}\n${USAGE}` };
  }
}
