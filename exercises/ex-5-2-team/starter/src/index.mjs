// Glue. Owned by the orchestrator. See SPEC.md.

export function releaseNotes(text, meta) {
  throw new Error(`releaseNotes is not implemented (got ${text.length} chars, v${meta.version})`);
}
