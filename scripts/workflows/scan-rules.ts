// The built-in scan rules for `workflows:scan` (PRD §16.7 WF-11). Pure functions: W3's share CLI imports `scanText`.
// A finding is only a line number and a rule id. The matched text is never kept, so a report cannot leak a secret.
// There is deliberately no client-name rule: human review at merge is that control (PRD §16, decision 8).
import { EMAIL_RE, HOME_PATH_RE, IPV4_RE, isPrivateEmail, isPrivateIpv4 } from "./patterns";

export interface ScanFinding {
  /** 1-based line. */
  line: number;
  rule: string;
}

export const SCAN_RULE_IDS = [
  "email",
  "ipv4",
  "jwt",
  "anthropic-key",
  "openai-key",
  "aws-key",
  "github-token",
  "supabase-service-key",
  "home-path",
  "private-key",
] as const;
export type ScanRuleId = (typeof SCAN_RULE_IDS)[number];

const JWT_RE = /\beyJ[\w-]{4,}\.eyJ[\w-]{4,}\.[\w-]{10,}/g;

function jwtRole(token: string): string | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const json: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof json === "object" && json !== null && "role" in json && typeof json.role === "string") return json.role;
  } catch {
    // not a decodable JWT payload: the generic jwt rule still reports it
  }
  return null;
}

interface Rule {
  id: ScanRuleId;
  test(line: string): boolean;
}

const some = (re: RegExp, line: string, keep: (m: string) => boolean = () => true): boolean => [...line.matchAll(re)].some((m) => keep(m[0]));

const RULES: readonly Rule[] = [
  { id: "email", test: (l) => some(EMAIL_RE, l, isPrivateEmail) },
  { id: "ipv4", test: (l) => some(IPV4_RE, l, isPrivateIpv4) },
  { id: "jwt", test: (l) => some(JWT_RE, l) },
  { id: "anthropic-key", test: (l) => /\bsk-ant-[A-Za-z0-9_-]{20,}/.test(l) },
  { id: "openai-key", test: (l) => /\bsk-(?!ant-)(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}/.test(l) },
  { id: "aws-key", test: (l) => /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/.test(l) },
  { id: "github-token", test: (l) => /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})/.test(l) },
  {
    id: "supabase-service-key",
    test: (l) => /\bsb_secret_[A-Za-z0-9_-]{20,}/.test(l) || some(JWT_RE, l, (t) => jwtRole(t) === "service_role"),
  },
  { id: "home-path", test: (l) => some(HOME_PATH_RE, l) },
  { id: "private-key", test: (l) => /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(l) },
];

/** Run every built-in rule over `text`. At most one finding per rule per line. */
export function scanText(text: string): ScanFinding[] {
  const findings: ScanFinding[] = [];
  text.split("\n").forEach((line, i) => {
    for (const rule of RULES) {
      if (rule.test(line)) findings.push({ line: i + 1, rule: rule.id });
    }
  });
  return findings;
}

export function formatFinding(f: ScanFinding): string {
  return `${f.line}: ${f.rule}`;
}

/** Map a `gitleaks --report-format json` report to findings. Only RuleID and StartLine are read; `Secret` and `Match` are dropped. */
export function parseGitleaksReport(json: string): ScanFinding[] {
  if (json.trim() === "") return [];
  const data: unknown = JSON.parse(json);
  if (!Array.isArray(data)) throw new Error("unexpected gitleaks report shape");
  return data.map((entry: unknown) => {
    if (typeof entry !== "object" || entry === null) throw new Error("unexpected gitleaks finding");
    const rule = "RuleID" in entry && typeof entry.RuleID === "string" ? entry.RuleID : "unknown";
    const line = "StartLine" in entry && typeof entry.StartLine === "number" ? entry.StartLine : 0;
    return { line, rule: `gitleaks:${rule}` };
  });
}
