import type { ChecklistItem } from "../../../src/lib/contracts";
import type { SeedIssue } from "./issues";
import { normalizeText } from "./text";

const ID = /^[a-z0-9_-]{1,64}$/;
const ITEM = /^\s*[-*+]\s+\[[ xX]\]\s+(.*\S)\s*$/;

/**
 * CHECKLIST.md item syntax. Ids are explicit so rewording never changes them (PRD E-2):
 *   - [ ] {#c1} Test is green            (canonical)
 *   - [ ] Test is green {#c1}
 *   - [ ] c1: Test is green              (id must contain a digit, - or _)
 */
export function parseChecklist(md: string, file: string): { items: ChecklistItem[]; issues: SeedIssue[] } {
  const items: ChecklistItem[] = [];
  const issues: SeedIssue[] = [];
  const seen = new Map<string, number>();

  normalizeText(md)
    .split("\n")
    .forEach((line, i) => {
      const m = ITEM.exec(line);
      if (!m) return;
      const lineNo = i + 1;
      const rest = m[1] ?? "";

      let id: string | undefined;
      let text = rest;
      const prefix = /^\{#([^}]*)\}\s+(.+)$/.exec(rest);
      const suffix = /^(.+?)\s+\{#([^}]*)\}$/.exec(rest);
      const colon = /^([a-z0-9_-]{1,64}):\s+(.+)$/.exec(rest);
      if (prefix) {
        id = prefix[1];
        text = prefix[2] ?? "";
      } else if (suffix) {
        text = suffix[1] ?? "";
        id = suffix[2];
      } else if (colon && /[\d_-]/.test(colon[1] ?? "")) {
        id = colon[1];
        text = colon[2] ?? "";
      }

      if (id === undefined) {
        issues.push({
          file,
          line: lineNo,
          field: "checklist",
          reason: "item needs an explicit id, e.g. `- [ ] {#c1} Test is green` (ids stay stable when the text is reworded)",
        });
        return;
      }
      if (!ID.test(id)) {
        issues.push({ file, line: lineNo, field: "checklist", reason: `invalid id '${id}' (allowed: a-z 0-9 _ -, 1-64 chars)` });
        return;
      }
      const first = seen.get(id);
      if (first !== undefined) {
        issues.push({ file, line: lineNo, field: "checklist", reason: `duplicate id '${id}' (first used on line ${first})` });
        return;
      }
      seen.set(id, lineNo);
      items.push({ id, text: text.trim() });
    });

  if (items.length === 0 && issues.length === 0) {
    issues.push({ file, line: 1, field: "checklist", reason: "checklist needs at least one `- [ ] {#id} text` item" });
  }
  return { items, issues };
}
