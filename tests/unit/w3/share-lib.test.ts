// @vitest-environment node
import matter from "gray-matter";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildWorkflowFrontmatterSchema } from "../../../src/lib/contracts/workflow";
import {
  buildGitPlan,
  isDeniedPath,
  originMatches,
  redactDraft,
  redactText,
  renderDraft,
  slugify,
  withClientSafe,
} from "../../../scripts/workflows/share-lib";
import { sampleDraft } from "./helpers";

const HOME = "/home/tester";

describe("isDeniedPath (WF-16)", () => {
  const denied = [
    ".env",
    ".env.local",
    "apps/web/.env.production",
    "~/.ssh/id_ed25519",
    "~/.ssh/config",
    "~/.aws/credentials",
    "certs/server.pem",
    "certs/Server.PEM",
    "tls/private.key",
    "config/my-secrets.json",
    "SECRET.txt",
    "gcp-Credentials.json",
    "docs/credential-rotation.md",
  ];
  const allowed = ["CLAUDE.md", "AGENTS.md", ".claude/settings.json", "scripts/gate.sh", "~/.claude/skills/x/SKILL.md", "environment.md", "monkey.ts"];

  it.each(denied)("denies %s", (p) => {
    const r = isDeniedPath(p, { cwd: "/work/repo", home: HOME });
    expect(r.denied).toBe(true);
    expect(r.reason).toBeTruthy();
  });
  it.each(allowed)("allows %s", (p) => {
    expect(isDeniedPath(p, { cwd: "/work/repo", home: HOME }).denied).toBe(false);
  });
  it("denies the absolute form of ~/.ssh and ~/.aws, but not lookalike directories", () => {
    expect(isDeniedPath(`${HOME}/.ssh/known_hosts`, { home: HOME }).denied).toBe(true);
    expect(isDeniedPath(`${HOME}/.aws/config`, { home: HOME }).denied).toBe(true);
    expect(isDeniedPath(`${HOME}/.sshx/a`, { home: HOME }).denied).toBe(false);
  });
  it("uses os.homedir() by default", () => {
    expect(isDeniedPath(path.join(os.homedir(), ".ssh", "id_rsa")).denied).toBe(true);
  });
});

describe("redactText (WF-16)", () => {
  it("rewrites emails outside example.com", () => {
    const r = redactText("ping jane.doe@acme.io and ok@example.com");
    expect(r.text).toBe("ping user@example.com and ok@example.com");
    expect(r.redactions).toEqual([{ rule: "email", from: "jane.doe@acme.io", to: "user@example.com" }]);
  });
  it("rewrites hostnames except allowlisted ones", () => {
    const r = redactText("see https://git.corp.internal/x and https://docs.github.com/a and api.example.com and npmjs.com");
    expect(r.text).toBe("see https://example.com/x and https://docs.github.com/a and api.example.com and npmjs.com");
    expect(r.redactions.map((x) => x.rule)).toEqual(["hostname"]);
  });
  it("leaves file names alone", () => {
    const s = "edit settings.json, package.json, README.md and next.config.ts";
    expect(redactText(s).text).toBe(s);
  });
  it("rewrites absolute home paths to ~/", () => {
    const r = redactText("cat /Users/alice/repos/app/CLAUDE.md and /home/bob/x");
    expect(r.text).toBe("cat ~/repos/app/CLAUDE.md and ~/x");
    expect(r.redactions).toHaveLength(2);
  });
  it("rewrites IPv4 addresses", () => {
    const r = redactText("host 10.1.2.3 and 192.168.0.7, also 203.0.113.10 and version 2.1.119");
    expect(r.text).toBe("host 203.0.113.10 and 203.0.113.10, also 203.0.113.10 and version 2.1.119");
    expect(r.redactions.filter((x) => x.rule === "ipv4")).toHaveLength(2);
  });
  it("is idempotent", () => {
    const once = redactText("a@b.io 10.0.0.1 /Users/x/y git.acme.internal").text;
    expect(redactText(once)).toEqual({ text: once, redactions: [] });
  });
  it("never auto-redacts secret shapes", () => {
    const key = "sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789";
    expect(redactText(`key=${key}`).text).toContain(key);
  });
});

describe("buildGitPlan (WF-16)", () => {
  const plan = buildGitPlan("my-flow", "My flow title");
  it("is the exact sequence", () => {
    expect(plan).toEqual([
      { cmd: "git", args: ["switch", "-c", "workflow/my-flow", "origin/main"] },
      { cmd: "git", args: ["add", "--", "content/workflows/my-flow.md"] },
      { cmd: "git", args: ["commit", "-m", "workflow: My flow title"] },
      { cmd: "git", args: ["push", "-u", "origin", "workflow/my-flow"] },
      {
        cmd: "gh",
        args: ["pr", "create", "--title", "Workflow: My flow title", "--body-file", ".github/PULL_REQUEST_TEMPLATE/workflow.md", "--label", "workflow"],
      },
    ]);
  });
  it("contains no forbidden flag or verb", () => {
    for (const s of plan) {
      for (const bad of ["-A", "-a", ".", "--all", "--no-verify", "--force", "-f", "--force-with-lease", "merge", "--approve", "--admin"]) {
        expect(s.args).not.toContain(bad);
      }
      expect(s.args.join(" ")).not.toMatch(/review --approve/);
    }
  });
});

describe("originMatches", () => {
  const url = "https://github.com/RayAdrian/firstmate-ai-playground";
  it.each([url, `${url}.git`, "git@github.com:RayAdrian/firstmate-ai-playground.git", "HTTPS://GITHUB.COM/rayadrian/firstmate-ai-playground/"])(
    "accepts %s",
    (u) => expect(originMatches(u, url)).toBe(true),
  );
  it.each(["https://github.com/other/firstmate-ai-playground", "/tmp/bare.git", ""])("rejects %s", (u) => expect(originMatches(u, url)).toBe(false));
});

describe("renderDraft", () => {
  it("round-trips through the contract schema once client_safe is added", () => {
    const md = renderDraft(sampleDraft());
    expect(md).not.toMatch(/client_safe/);
    const fm = matter(withClientSafe(md)).data;
    const schema = buildWorkflowFrontmatterSchema({
      useCases: ["parallel-work", "testing"],
      stacks: ["supabase"],
      today: "2026-10-02",
    });
    expect(schema.safeParse({ ...fm, verified_on: String(fm.verified_on) }).success).toBe(true);
  });
  it("emits section order and the setup info string", () => {
    const md = renderDraft(sampleDraft({ setup: [{ lang: "bash", path: "scripts/x.sh", kind: "script", tool: "codex", code: "echo ```" }] }));
    const headings = md.split("\n").filter((l) => /^## /.test(l));
    expect(headings).toEqual(["## Result", "## Setup", "## Prompt", "## Steps", "## Why it works"]);
    expect(md).toContain("bash path=scripts/x.sh kind=script tool=codex");
    expect(md).toContain("````bash"); // fence lengthened around inner backticks
  });
  it("writes prose for zero setup blocks and per-tool prompt subsections", () => {
    const md = renderDraft(sampleDraft({ setup: [], prompt: { claude: "a", codex: "b" } }));
    expect(md).toContain("No setup files.");
    expect(md).toContain("### Claude Code");
    expect(md).toContain("### Codex CLI");
  });
  it("withClientSafe refuses to run twice", () => {
    const once = withClientSafe(renderDraft(sampleDraft()));
    expect(() => withClientSafe(once)).toThrow();
  });
});

describe("redactDraft + slugify", () => {
  it("redacts every field and names it in the report", () => {
    const d = sampleDraft({ why: "Mail ops@corp.internal about 10.0.0.9 because the rule matters for everyone here, honestly." });
    const r = redactDraft(d);
    expect(r.draft.why).toContain("user@example.com");
    expect(r.redactions.some((x) => x.field === "why" && x.rule === "ipv4")).toBe(true);
  });
  it("slugifies titles", () => {
    expect(slugify("  Serialise the DB: shared!  ")).toBe("serialise-the-db-shared");
    expect(slugify("x".repeat(90)).length).toBeLessThanOrEqual(60);
  });
});
