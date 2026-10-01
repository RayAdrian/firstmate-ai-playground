// Deterministic redactions for a drafted workflow (PRD §16.7 WF-16). Pure functions: W3's share CLI imports `redactText`.
// Secret shapes are NOT handled here: they are reported by the scan (scan-rules.ts), never auto-redacted.
import { BARE_HOST_RE, EMAIL_RE, HOME_PATH_RE, IPV4_RE, URL_HOST_RE, isAllowedHost, isPrivateEmail, isPrivateIpv4 } from "./patterns";

export type RedactionRule = "email" | "ipv4" | "home-path" | "hostname";

export interface Redaction {
  /** 1-based line in the input. */
  line: number;
  rule: RedactionRule;
  from: string;
  to: string;
}

export const REDACTED_EMAIL = "user@example.com";
export const REDACTED_HOST = "example.com";
export const REDACTED_IPV4 = "203.0.113.10";
export const REDACTED_HOME = "~/";

/** Apply `replace` to every match of `re` in `line`, recording each change. `replace` returns null to keep the match. */
function rewrite(line: string, lineNo: number, re: RegExp, rule: RedactionRule, out: Redaction[], replace: (m: RegExpExecArray) => { from: string; to: string; start: number; end: number } | null): string {
  let result = "";
  let cursor = 0;
  for (const m of line.matchAll(re)) {
    const hit = replace(m as RegExpExecArray);
    if (!hit) continue;
    result += line.slice(cursor, hit.start) + hit.to;
    cursor = hit.end;
    out.push({ line: lineNo, rule, from: hit.from, to: hit.to });
  }
  return result + line.slice(cursor);
}

/** Order matters: emails first (so their domain is not rewritten twice), hostnames last. */
export function redactText(text: string): { text: string; redactions: Redaction[] } {
  const redactions: Redaction[] = [];
  const lines = text.split("\n").map((original, idx) => {
    const n = idx + 1;
    let line = original;

    line = rewrite(line, n, EMAIL_RE, "email", redactions, (m) =>
      isPrivateEmail(m[0]) ? { from: m[0], to: REDACTED_EMAIL, start: m.index, end: m.index + m[0].length } : null,
    );
    line = rewrite(line, n, IPV4_RE, "ipv4", redactions, (m) =>
      isPrivateIpv4(m[0]) ? { from: m[0], to: REDACTED_IPV4, start: m.index, end: m.index + m[0].length } : null,
    );
    line = rewrite(line, n, HOME_PATH_RE, "home-path", redactions, (m) => ({ from: m[0], to: REDACTED_HOME, start: m.index, end: m.index + m[0].length }));
    line = rewrite(line, n, URL_HOST_RE, "hostname", redactions, (m) => {
      const host = m[1] ?? "";
      if (isAllowedHost(host)) return null;
      const start = m.index + m[0].length - host.length;
      return { from: host, to: REDACTED_HOST, start, end: start + host.length };
    });
    line = rewrite(line, n, BARE_HOST_RE, "hostname", redactions, (m) =>
      isAllowedHost(m[0]) ? null : { from: m[0], to: REDACTED_HOST, start: m.index, end: m.index + m[0].length },
    );
    return line;
  });
  return { text: lines.join("\n"), redactions };
}
