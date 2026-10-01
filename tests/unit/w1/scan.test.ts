// @vitest-environment node
import { describe, expect, it } from "vitest";
import { SCAN_RULE_IDS, formatFinding, parseGitleaksReport, scanText } from "../../../scripts/workflows/scan-rules";

// Secret-shaped strings are assembled at runtime so no secret-looking literal sits in this file (gitleaks scans history).
const pad = (n: number, ch = "a1B2c3") => ch.repeat(Math.ceil(n / ch.length)).slice(0, n);
const b64url = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (payload: object) => [b64url({ alg: "HS256", typ: "JWT" }), b64url(payload), pad(30, "sig")].join(".");

const positives: Record<string, string> = {
  email: "contact jane@acme-corp.io today",
  ipv4: "host 10.20.30.40 is up",
  jwt: `Authorization: Bearer ${jwt({ sub: "1" })}`,
  "anthropic-key": `ANTHROPIC_API_KEY=${"sk-ant-" + pad(40)}`,
  "openai-key": `OPENAI_API_KEY=${"sk-" + pad(40)}`,
  "aws-key": `aws_access_key_id=${"AKIA" + pad(16, "Q7Z")}`,
  "github-token": `token ${"ghp_" + pad(36)}`,
  "supabase-service-key": `SUPABASE_SERVICE_ROLE_KEY=${"sb_secret_" + pad(30)}`,
  "home-path": "open /Users/jane/work/app",
  "private-key": `${"-----BEGIN"} RSA PRIVATE KEY-----`,
};

const negatives: Record<string, string> = {
  email: "contact user@example.com or the @claude handle",
  ipv4: "version 2.1.0, loopback 127.0.0.1 and the documentation address 203.0.113.9",
  jwt: "three.dotted.words and a.b.c are not tokens",
  "anthropic-key": "set ANTHROPIC_API_KEY to your key, which starts with sk-ant-",
  "openai-key": "keys look like sk-xxxx, so never commit one",
  "aws-key": "AKIA is the prefix, followed by sixteen characters",
  "github-token": "tokens start with ghp_ followed by 36 characters",
  "supabase-service-key": "the service key starts with sb_secret_ and must stay on the server",
  "home-path": "open ~/work/app or ./Users/readme",
  "private-key": "a PRIVATE KEY block starts with five dashes",
};

describe("scanText: one positive and one negative fixture per rule id (WF-11)", () => {
  it("has a fixture pair for every rule id", () => {
    expect(Object.keys(positives).sort()).toEqual([...SCAN_RULE_IDS].sort());
    expect(Object.keys(negatives).sort()).toEqual([...SCAN_RULE_IDS].sort());
  });

  for (const id of Object.keys(positives)) {
    it(`${id}: flags the positive`, () => {
      expect(scanText(positives[id] ?? "").map((f) => f.rule)).toContain(id);
    });
    it(`${id}: ignores the negative`, () => {
      expect(scanText(negatives[id] ?? "").map((f) => f.rule)).not.toContain(id);
    });
  }

  it("flags a JWT whose payload is a service_role as a Supabase service key too", () => {
    const rules = scanText(`key=${jwt({ role: "service_role" })}`).map((f) => f.rule);
    expect(rules).toEqual(expect.arrayContaining(["jwt", "supabase-service-key"]));
  });

  it("does not flag an anon-role JWT as a service key", () => {
    expect(scanText(`key=${jwt({ role: "anon" })}`).map((f) => f.rule)).not.toContain("supabase-service-key");
  });

  it("reports 1-based line numbers", () => {
    const f = scanText(`fine\nfine\n${positives["ipv4"]}`);
    expect(f).toEqual([{ line: 3, rule: "ipv4" }]);
  });

  it("does not report an Anthropic key as an OpenAI key as well", () => {
    expect(scanText(positives["anthropic-key"] ?? "").map((f) => f.rule)).toEqual(["anthropic-key"]);
  });

  it("returns nothing for clean text", () => {
    expect(scanText("# A workflow\n\nRun `npm test` and see user@example.com.\n")).toEqual([]);
  });
});

describe("report never echoes a matched secret", () => {
  it("findings carry only line and rule id", () => {
    const secret = "sk-ant-" + pad(40);
    const findings = scanText(`key=${secret}`);
    const report = findings.map(formatFinding).join("\n");
    expect(report).toBe("1: anthropic-key");
    expect(JSON.stringify(findings)).not.toContain(secret);
    expect(report).not.toContain(pad(12));
  });
});

describe("parseGitleaksReport", () => {
  it("maps findings to gitleaks:<rule> with no secret material", () => {
    const report = JSON.stringify([
      { RuleID: "generic-api-key", StartLine: 7, Secret: "REDACTED", Match: "REDACTED" },
      { RuleID: "aws-access-token", StartLine: 12 },
    ]);
    expect(parseGitleaksReport(report)).toEqual([
      { line: 7, rule: "gitleaks:generic-api-key" },
      { line: 12, rule: "gitleaks:aws-access-token" },
    ]);
  });

  it("treats an empty report as no findings and a garbled one as an error", () => {
    expect(parseGitleaksReport("")).toEqual([]);
    expect(parseGitleaksReport("[]")).toEqual([]);
    expect(() => parseGitleaksReport("{not json")).toThrow();
  });
});
