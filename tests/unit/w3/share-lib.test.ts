// @vitest-environment node
import matter from "gray-matter";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildWorkflowFrontmatterSchema } from "../../../src/lib/contracts/workflow";
import {
  buildCommitPlan,
  buildPublishPlan,
  checkReadable,
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
  it("leaves file names and public libraries alone (review N1)", () => {
    const s = "edit .claude/settings.local.json, CLAUDE.local.md, package.json, README.md, foo.test.ts, next.config.ts and socket.io";
    expect(redactText(s).text).toBe(s);
  });
  it("rewrites absolute home paths to ~/", () => {
    const r = redactText("cat /Users/alice/repos/app/CLAUDE.md and /home/bob/x");
    expect(r.text).toBe("cat ~/repos/app/CLAUDE.md and ~/x");
    expect(r.redactions).toHaveLength(2);
  });
  it("catches more internal hosts, home-path forms and IPv6 (review N2)", () => {
    const r = redactText('portal.acme.de jira.acme.sg db01.acme-internal; "/Users/alice" and /Users/alice; C:\\Users\\bob\\x; fe80:0:0:0:1:2:3:4');
    expect(r.text).toBe('example.com example.com example.com; "~" and ~; ~\\x; 2001:db8::1');
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

describe("open-pr plans (WF-16, review B2)", () => {
  const commit = buildCommitPlan("my-flow", "My flow title", "abc123", "tree456");
  const publish = buildPublishPlan("my-flow", "My flow title", "def789");
  it("builds the commit from origin/main plus exactly one file", () => {
    expect(commit).toEqual([
      { cmd: "git", args: ["read-tree", "abc123"] },
      { cmd: "git", args: ["add", "--", "content/workflows/my-flow.md"] },
      { cmd: "git", args: ["write-tree"] },
      { cmd: "git", args: ["commit-tree", "tree456", "-p", "abc123", "-m", "workflow: My flow title"] },
    ]);
  });
  it("publishes without a checkout", () => {
    expect(publish).toEqual([
      { cmd: "git", args: ["branch", "workflow/my-flow", "def789"] },
      { cmd: "git", args: ["push", "-u", "origin", "workflow/my-flow"] },
      {
        cmd: "gh",
        args: ["pr", "create", "--head", "workflow/my-flow", "--title", "Workflow: My flow title", "--body-file", ".github/PULL_REQUEST_TEMPLATE/workflow.md", "--label", "workflow"],
      },
    ]);
  });
  it("contains no forbidden flag or verb", () => {
    for (const s of [...commit, ...publish]) {
      for (const bad of ["-A", "-a", ".", "--all", "--no-verify", "--force", "-f", "--force-with-lease", "merge", "--approve", "--admin", "switch", "commit"]) {
        expect(s.args).not.toContain(bad);
      }
      expect(s.args.join(" ")).not.toMatch(/review --approve/);
    }
  });
});

describe("isDeniedPath case-insensitivity and extra locations (review B1)", () => {
  const opts = { cwd: "/work/repo", home: HOME };
  it.each([
    "~/.SSH/id_ed25519",
    "~/.Ssh/config",
    "~/.AWS/credentials",
    "~/.gnupg/private-keys-v1.d/x",
    "~/.GnuPG/pubring.kbx",
    "~/.config/gh/hosts.yml",
    "~/.Config/GH/hosts.yml",
    "~/.claude/.credentials.json",
    "~/.CLAUDE/.Credentials.json",
    "~/.codex/auth.json",
    "~/.Codex/Auth.JSON",
    "~/.npmrc",
    "~/.netrc",
    "~/.docker/config.json",
    "~/Library/Keychains/login.keychain-db",
    "work/id_rsa",
    "work/ID_ED25519",
    "work/login.keychain",
    "~/notes/../.ssh/id_rsa",
    "../../../home/tester/.ssh/id_rsa",
  ])("denies %s", (p) => expect(isDeniedPath(p, opts).denied).toBe(true));
  it("does not deny ordinary agent config", () => {
    expect(isDeniedPath("~/.claude/settings.json", opts).denied).toBe(false);
    expect(isDeniedPath("~/.codex/config.toml", opts).denied).toBe(false);
  });
});

describe("checkReadable: realpath first, deny list, then allow rule (review B1)", () => {
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "w3-read-")));
  const home = path.join(tmp, "home");
  const repo = path.join(tmp, "repo");
  fs.mkdirSync(path.join(home, ".ssh"), { recursive: true });
  fs.mkdirSync(path.join(home, ".claude/skills/x"), { recursive: true });
  fs.mkdirSync(path.join(home, "Documents"), { recursive: true });
  fs.mkdirSync(repo, { recursive: true });
  fs.writeFileSync(path.join(home, ".ssh/id_ed25519"), "PRIVATE");
  fs.writeFileSync(path.join(home, "Documents/notes.md"), "notes");
  fs.writeFileSync(path.join(home, ".claude/skills/x/SKILL.md"), "skill");
  fs.writeFileSync(path.join(repo, "AGENTS.md"), "agents");
  fs.writeFileSync(path.join(repo, "innocent.md"), "x");
  fs.rmSync(path.join(repo, "innocent.md"));
  fs.symlinkSync(path.join(home, ".ssh/id_ed25519"), path.join(repo, "innocent.md"));
  fs.symlinkSync(path.join(home, ".ssh"), path.join(repo, "sshdir"));
  const o = { cwd: repo, home, repoRoot: repo };
  const caseInsensitiveFs = fs.existsSync(path.join(home, ".SSH"));

  it("allows files inside the repo and the agent-config locations", () => {
    expect(checkReadable("AGENTS.md", o).denied).toBe(false);
    expect(checkReadable("~/.claude/skills/x/SKILL.md", o).denied).toBe(false);
  });
  it("refuses a symlink in the repo that points at a private key", () => {
    expect(checkReadable("innocent.md", o).denied).toBe(true);
    expect(checkReadable("sshdir/id_ed25519", o).denied).toBe(true);
  });
  it("refuses case variants of ~/.ssh (also via a case-insensitive filesystem)", () => {
    for (const p of ["~/.ssh/id_ed25519", "~/.SSH/id_ed25519", "~/.Ssh/id_ed25519"]) {
      expect(checkReadable(p, o).denied).toBe(true);
    }
    if (caseInsensitiveFs) expect(checkReadable("~/.SSH/id_ed25519", o).reason).toMatch(/denied|id_/);
  });
  it("refuses .. traversal into denied and out-of-bounds locations", () => {
    expect(checkReadable("../home/.ssh/id_ed25519", o).denied).toBe(true);
    expect(checkReadable("../home/Documents/notes.md", o).reason).toMatch(/outside the repo/);
    expect(checkReadable("AGENTS.md/../../home/.ssh/id_ed25519", o).denied).toBe(true);
  });
  it("applies the allow rule: other files outside the repo are refused", () => {
    expect(checkReadable("~/Documents/notes.md", o).denied).toBe(true);
    expect(checkReadable("/etc/hosts", o).denied).toBe(true);
  });
  it("reports missing files as refused", () => {
    expect(checkReadable("nope.md", o)).toMatchObject({ denied: true, reason: "not found" });
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
