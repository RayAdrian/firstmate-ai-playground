// @vitest-environment node
import { describe, expect, it } from "vitest";
import { redactText } from "../../../scripts/workflows/redact";

const redact = (s: string) => redactText(s);

describe("redactText (WF-16 deterministic redactions)", () => {
  it("rewrites emails outside example.com to user@example.com", () => {
    const r = redact("ask jane.doe+ops@acme-corp.io or bob@example.com");
    expect(r.text).toBe("ask user@example.com or bob@example.com");
    expect(r.redactions).toEqual([{ line: 1, rule: "email", from: "jane.doe+ops@acme-corp.io", to: "user@example.com" }]);
  });

  it("keeps conventional addresses at allowed hosts, such as an ssh remote or a vendor noreply", () => {
    const keep = "git clone git@github.com:First-Mate/app.git; Co-Authored-By: Tool <noreply@anthropic.com>";
    expect(redact(keep)).toEqual({ text: keep, redactions: [] });
  });

  it("rewrites hostnames in URLs but keeps scheme, path and allowlisted hosts", () => {
    const r = redact("see https://git.internal.acme.corp/team/app/pull/3 and https://github.com/RayAdrian/x and https://docs.anthropic.com/en/docs");
    expect(r.text).toBe("see https://example.com/team/app/pull/3 and https://github.com/RayAdrian/x and https://docs.anthropic.com/en/docs");
    expect(r.redactions.map((x) => [x.rule, x.from, x.to])).toEqual([["hostname", "git.internal.acme.corp", "example.com"]]);
  });

  it("rewrites bare hostnames with a known TLD, and leaves file names and versions alone", () => {
    const r = redact("ssh into build.acme-corp.internal then edit config.json, README.md, scripts/run.sh and v2.1.0");
    expect(r.text).toBe("ssh into example.com then edit config.json, README.md, scripts/run.sh and v2.1.0");
  });

  it("allowlists github.com, npmjs.com, example.com and vendor docs, including subdomains", () => {
    const keep = [
      "https://github.com/a/b",
      "https://api.github.com/repos",
      "https://www.npmjs.com/package/x",
      "https://example.com/x",
      "https://docs.anthropic.com/a",
      "https://code.claude.com/docs",
      "https://developers.openai.com/codex",
    ].join(" ");
    expect(redact(keep).text).toBe(keep);
    expect(redact(keep).redactions).toEqual([]);
  });

  it("does not treat a lookalike of an allowed host as allowed", () => {
    expect(redact("https://github.com.evil.io/x").text).toBe("https://example.com/x");
    expect(redact("https://notgithub.com/x").text).toBe("https://example.com/x");
  });

  it("rewrites absolute home paths to ~/", () => {
    const r = redact("cp /Users/jane/work/app/.env.example /home/ci-bot/app/x");
    expect(r.text).toBe("cp ~/work/app/.env.example ~/app/x");
    expect(r.redactions.map((x) => x.rule)).toEqual(["home-path", "home-path"]);
  });

  it("rewrites IPv4 addresses to 203.0.113.10, but leaves loopback and the documentation range", () => {
    const r = redact("connect to 10.4.22.7 and 192.168.1.20, not 127.0.0.1 or 203.0.113.55");
    expect(r.text).toBe("connect to 203.0.113.10 and 203.0.113.10, not 127.0.0.1 or 203.0.113.55");
    expect(r.redactions).toHaveLength(2);
  });

  it("reports the line of every replacement", () => {
    const r = redact("one\ntwo bob@acme.io\nthree 10.0.0.1");
    expect(r.redactions.map((x) => x.line)).toEqual([2, 3]);
  });

  it("is idempotent", () => {
    const once = redact("bob@acme.io https://x.acme.corp/a /Users/bob/a 10.0.0.9").text;
    const twice = redact(once);
    expect(twice.text).toBe(once);
    expect(twice.redactions).toEqual([]);
  });

  it("never touches secret shapes (they are reported by the scan, not auto-redacted)", () => {
    const key = `sk-ant-${"a1B2".repeat(10)}`;
    expect(redact(`token ${key}`).text).toBe(`token ${key}`);
  });
});
