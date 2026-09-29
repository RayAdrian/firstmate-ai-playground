/** Structured logger. Writes one JSON line to stderr. */
export function log(level, message, fields = {}) {
  process.stderr.write(JSON.stringify({ level, message, ...fields }) + "\n");
}
