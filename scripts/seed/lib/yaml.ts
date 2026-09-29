import { LineCounter, parseDocument, type Document } from "yaml";

export interface ParsedYaml {
  data: unknown;
  errors: { line: number; message: string }[];
  /** 1-based file line of a key path (nearest existing ancestor when the key is missing). */
  lineOf(path: ReadonlyArray<string | number>): number;
}

/**
 * Safe YAML parse: core schema (no timestamps, no custom tags), alias-count limit, duplicate keys rejected.
 * Unresolved tags (e.g. `!!js/function`) are reported as errors, never executed.
 * `firstLine` is the file line on which `text` starts.
 */
export function parseYamlSafe(text: string, firstLine: number): ParsedYaml {
  const lineCounter = new LineCounter();
  let doc: Document.Parsed;
  try {
    doc = parseDocument(text, { lineCounter, uniqueKeys: true, version: "1.2" });
  } catch (err) {
    return { data: undefined, errors: [{ line: firstLine, message: errMessage(err) }], lineOf: () => firstLine };
  }

  const toLine = (offset: number | undefined) =>
    offset === undefined ? firstLine : firstLine + lineCounter.linePos(offset).line - 1;

  const errors: { line: number; message: string }[] = [];
  for (const e of [...doc.errors, ...doc.warnings]) {
    errors.push({ line: toLine(e.pos[0]), message: e.message.split("\n")[0] ?? e.message });
  }

  let data: unknown;
  if (errors.length === 0) {
    try {
      data = doc.toJS({ maxAliasCount: 20 });
    } catch (err) {
      errors.push({ line: firstLine, message: errMessage(err) });
    }
  }

  const lineOf = (path: ReadonlyArray<string | number>): number => {
    for (let n = path.length; n >= 0; n--) {
      const node = n === 0 ? doc.contents : doc.getIn(path.slice(0, n) as (string | number)[], true);
      const range = node && typeof node === "object" && "range" in node ? (node.range as number[] | null | undefined) : null;
      if (range) return toLine(range[0]);
    }
    return firstLine;
  };
  return { data, errors, lineOf };
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message.split("\n")[0] ?? err.message : "invalid YAML";
}
