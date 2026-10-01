// @vitest-environment node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { REPO_URL } from "../../../src/lib/contracts/workflow";
import { main, type Ctx, type Deps } from "../../../scripts/workflows/share";
import { sampleDraft } from "./helpers";

/**
 * Dry-run/integration tests for `workflows:share` with a fake `gh` on PATH and a local bare remote.
 * No real PR can be opened: `gh` is a script that records its argv. The validator and scanner are W1's
 * CLIs, so they are injected here.
 */

let tmp: string;
let work: string;
let remote: string;
let bin: string;
let ghLog: string;
let out: string[];
let err: string[];

const git = (cwd: string, ...a: string[]) =>
  execFileSync("git", a, { cwd, encoding: "utf8", env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" } }).trim();

const okDeps: Deps = { validate: async () => [], scan: async () => [] };

function mkCtx(over: Partial<Ctx> = {}, env: Record<string, string> = {}): Ctx {
  return {
    cwd: work,
    env: {
      ...process.env,
      PATH: `${bin}${path.delimiter}${process.env.PATH}`,
      GH_LOG: ghLog,
      GIT_AUTHOR_NAME: "T",
      GIT_AUTHOR_EMAIL: "t@example.com",
      GIT_COMMITTER_NAME: "T",
      GIT_COMMITTER_EMAIL: "t@example.com",
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_SYSTEM: "/dev/null",
      ...env,
    },
    deps: okDeps,
    out: (s) => out.push(s),
    err: (s) => err.push(s),
    ...over,
  };
}

function writeAnswers(over = {}, name = "answers.json") {
  const p = path.join(tmp, name);
  const w = sampleDraft(over);
  fs.writeFileSync(p, JSON.stringify({ answers: { problem: "p", change: "c", files: ["AGENTS.md"] }, workflow: w }));
  return p;
}

const wfFile = (slug: string) => path.join(work, "content/workflows", `${slug}.md`);
const SLUG = "serialise-the-shared-test-database";
const ghCalls = () => (fs.existsSync(ghLog) ? fs.readFileSync(ghLog, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as string[]) : []);

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "w3-"));
  remote = path.join(tmp, "remote.git");
  work = path.join(tmp, "work");
  bin = path.join(tmp, "bin");
  ghLog = path.join(tmp, "gh.log");
  out = [];
  err = [];
  git(tmp, "init", "-q", "--bare", "-b", "main", remote);
  git(tmp, "clone", "-q", remote, work);
  fs.mkdirSync(path.join(work, ".github/PULL_REQUEST_TEMPLATE"), { recursive: true });
  fs.writeFileSync(path.join(work, ".github/PULL_REQUEST_TEMPLATE/workflow.md"), "body\n");
  fs.writeFileSync(path.join(work, "README.md"), "x\n");
  git(work, "add", "-A");
  const env = { GIT_AUTHOR_NAME: "T", GIT_AUTHOR_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "T", GIT_COMMITTER_EMAIL: "t@example.com" };
  execFileSync("git", ["commit", "-q", "-m", "init"], { cwd: work, env: { ...process.env, ...env, GIT_CONFIG_GLOBAL: "/dev/null" } });
  git(work, "branch", "-M", "main");
  git(work, "push", "-q", "-u", "origin", "main");
  fs.mkdirSync(bin);
  // Fake gh: records argv as one JSON line; `gh auth status` fails when GH_AUTH_FAIL=1; `pr create` fails when GH_PR_FAIL=1.
  const gh = path.join(bin, "gh");
  fs.writeFileSync(
    gh,
    `#!/usr/bin/env node
const fs = require("fs");
const a = process.argv.slice(2);
fs.appendFileSync(process.env.GH_LOG, JSON.stringify(a) + "\\n");
if (a[0] === "auth" && process.env.GH_AUTH_FAIL === "1") { console.error("not logged in"); process.exit(1); }
if (a[0] === "pr" && process.env.GH_PR_FAIL === "1") { console.error("boom"); process.exit(1); }
if (a[0] === "pr") console.log("https://github.com/example/repo/pull/999");
`,
  );
  fs.chmodSync(gh, 0o755);
});

afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe("preflight (WF-16)", () => {
  it("fails when origin is not this repo, and prints the fix", async () => {
    expect(await main(["preflight"], mkCtx())).toBe(1);
    expect(err.join("\n")).toMatch(/origin is not .*git clone/);
  });
  it("passes when everything holds (origin set to the canonical URL, fetch via insteadOf)", async () => {
    git(work, "remote", "set-url", "origin", `${REPO_URL}.git`);
    git(work, "config", `url.${remote}.insteadOf`, `${REPO_URL}.git`);
    expect(await main(["preflight"], mkCtx())).toBe(0);
  });
  describe("with a canonical origin", () => {
    beforeEach(() => {
      git(work, "remote", "set-url", "origin", `${REPO_URL}.git`);
      git(work, "config", `url.${remote}.insteadOf`, `${REPO_URL}.git`);
    });
    it("fails on a dirty tree", async () => {
      fs.writeFileSync(path.join(work, "dirty.txt"), "x");
      expect(await main(["preflight"], mkCtx())).toBe(1);
      expect(err.join("\n")).toMatch(/not clean.*git stash/);
    });
    it("fails when gh is not signed in", async () => {
      expect(await main(["preflight"], mkCtx({}, { GH_AUTH_FAIL: "1" }))).toBe(1);
      expect(err.join("\n")).toContain("gh auth login");
    });
    it("fails when origin/main cannot be fetched", async () => {
      git(work, "config", `url.${path.join(tmp, "nowhere.git")}.insteadOf`, `${REPO_URL}.git`);
      git(work, "config", "--unset", `url.${remote}.insteadOf`);
      expect(await main(["preflight"], mkCtx())).toBe(1);
      expect(err.join("\n")).toContain("git fetch origin main");
    });
  });
});

describe("read (WF-16)", () => {
  it("prints allowed files and refuses denied ones with exit 2", async () => {
    fs.writeFileSync(path.join(work, "AGENTS.md"), "hello agents");
    fs.writeFileSync(path.join(work, ".env.local"), "TOKEN=abc");
    expect(await main(["read", "AGENTS.md"], mkCtx())).toBe(0);
    expect(out.join("\n")).toContain("hello agents");
    out.length = 0;
    expect(await main(["read", "AGENTS.md", ".env.local"], mkCtx())).toBe(2);
    expect(out.join("\n")).not.toContain("TOKEN=abc");
    expect(err.join("\n")).toMatch(/DENIED \.env\.local/);
  });
  it("applies the allow rule and refuses case variants of ~/.ssh", async () => {
    const home = path.join(tmp, "home");
    fs.mkdirSync(path.join(home, ".ssh"), { recursive: true });
    fs.writeFileSync(path.join(home, ".ssh/id_ed25519"), "PRIVATE-KEY");
    fs.writeFileSync(path.join(home, "notes.md"), "notes");
    for (const p of ["~/.ssh/id_ed25519", "~/.SSH/id_ed25519", "~/.Ssh/id_ed25519", "~/notes.md", "../home/.ssh/id_ed25519"]) {
      out.length = 0;
      expect(await main(["read", p], mkCtx({}, { HOME: home })), p).toBe(2);
      expect(out.join("\n")).not.toContain("PRIVATE-KEY");
    }
  });
  it("refuses a symlink that points at a denied file", async () => {
    fs.writeFileSync(path.join(work, "prod.pem"), "KEY");
    fs.symlinkSync(path.join(work, "prod.pem"), path.join(work, "innocent.txt"));
    expect(await main(["read", "innocent.txt"], mkCtx())).toBe(2);
    expect(out.join("\n")).not.toContain("KEY");
  });
});

describe("draft --dry-run (WF-16)", () => {
  it("writes the file without client_safe, reports redactions, and runs no git or gh", async () => {
    const answers = writeAnswers({ why: "Mail ops@corp.example.org when the rule matters, because everyone must follow it every time." });
    expect(await main(["draft", "--answers", answers, "--dry-run"], mkCtx())).toBe(0);
    const report = JSON.parse(out.join("\n"));
    expect(report).toMatchObject({ slug: SLUG, dryRun: true, findings: [], validation: [] });
    expect(report.redactions).toEqual([expect.objectContaining({ field: "why", rule: "email" })]);
    const md = fs.readFileSync(wfFile(SLUG), "utf8");
    expect(md).not.toContain("client_safe");
    expect(md).toContain("user@example.com");
    expect(git(work, "branch", "--list").split("\n").map((s) => s.trim().replace("* ", ""))).toEqual(["main"]);
    expect(ghCalls()).toEqual([]);
  });
  it("excuses client_safe problems but reports others and findings with exit 1", async () => {
    const deps: Deps = {
      validate: async (f) => [`${f}: client_safe: must be exactly \`confirmed\``, `${f}: steps: too many`],
      scan: async () => ["12: email-address"],
    };
    const report = async () => JSON.parse(out.join("\n"));
    expect(await main(["draft", "--answers", writeAnswers(), "--dry-run"], mkCtx({ deps }))).toBe(1);
    expect(await report()).toMatchObject({
      findings: ["12: email-address"],
      validation: [`content/workflows/${SLUG}.md: steps: too many`],
    });
  });
  it("rejects a bad answers file and a slug that already exists in git", async () => {
    fs.writeFileSync(path.join(tmp, "bad.json"), JSON.stringify({ nope: 1 }));
    expect(await main(["draft", "--answers", path.join(tmp, "bad.json")], mkCtx())).toBe(1);
    fs.mkdirSync(path.join(work, "content/workflows"), { recursive: true });
    fs.writeFileSync(wfFile(SLUG), "existing");
    git(work, "add", "-A");
    expect(await main(["draft", "--answers", writeAnswers()], mkCtx())).toBe(1);
    expect(err.join("\n")).toContain("already exists in git");
    expect(fs.readFileSync(wfFile(SLUG), "utf8")).toBe("existing");
  });
  it("catches a multi-sentence problem before writing validity claims", async () => {
    const a = writeAnswers({ problem: "First sentence here. Second one follows after it." });
    expect(await main(["draft", "--answers", a, "--dry-run"], mkCtx())).toBe(1);
    expect(JSON.parse(out.join("\n")).validation[0]).toContain("one sentence");
  });
});

describe("confirm (WF-12/WF-16)", () => {
  async function draftIt() {
    await main(["draft", "--answers", writeAnswers(), "--dry-run"], mkCtx());
    out.length = 0;
  }
  it("writes client_safe only for the exact phrase", async () => {
    await draftIt();
    expect(await main(["confirm", SLUG, "--phrase=client-safe"], mkCtx())).toBe(0);
    expect(fs.readFileSync(wfFile(SLUG), "utf8")).toMatch(/^client_safe: confirmed$/m);
  });
  it.each(["yes", "y", "", "Client-Safe", "client-safe ", " client-safe", "client-safe\n"])(
    "deletes the draft and exits 3 for %j, running no git command",
    async (phrase) => {
      await draftIt();
      const before = git(work, "reflog", "-1");
      expect(await main(["confirm", SLUG, `--phrase=${phrase}`], mkCtx())).toBe(3);
      expect(fs.existsSync(wfFile(SLUG))).toBe(false);
      expect(git(work, "reflog", "-1")).toBe(before);
      expect(git(work, "branch", "--list")).not.toContain("workflow/");
      expect(ghCalls()).toEqual([]);
    },
  );
  it("takes the phrase as a separate argument too, and without a phrase or TTY it aborts", async () => {
    await draftIt();
    expect(await main(["confirm", SLUG, "--phrase", "client-safe"], mkCtx())).toBe(0);
    fs.rmSync(wfFile(SLUG));
    await draftIt();
    expect(await main(["confirm", SLUG], mkCtx())).toBe(3);
  });
  it("prompts on stdin when interactive", async () => {
    await draftIt();
    const prompt = async () => "client-safe";
    expect(await main(["confirm", SLUG], mkCtx({ prompt }))).toBe(0);
  });
  it("rejects a traversal slug", async () => {
    expect(await main(["confirm", "../evil", "--phrase=client-safe"], mkCtx())).toBe(1);
  });
});

describe("open-pr (WF-13/WF-16)", () => {
  async function confirmed() {
    await main(["draft", "--answers", writeAnswers(), "--dry-run"], mkCtx());
    await main(["confirm", SLUG, "--phrase=client-safe"], mkCtx());
    out.length = 0;
    err.length = 0;
  }

  it("refuses an unconfirmed draft", async () => {
    await main(["draft", "--answers", writeAnswers(), "--dry-run"], mkCtx());
    expect(await main(["open-pr", SLUG], mkCtx())).toBe(1);
    expect(err.join("\n")).toContain("not confirmed");
    expect(ghCalls()).toEqual([]);
    expect(git(work, "branch", "--list")).not.toContain("workflow/");
  });
  it("refuses on a validation problem or a scan finding, re-running both here", async () => {
    await confirmed();
    expect(await main(["open-pr", SLUG], mkCtx({ deps: { validate: async (f) => [`${f}: steps: too many`], scan: async () => [] } }))).toBe(1);
    expect(await main(["open-pr", SLUG], mkCtx({ deps: { validate: async () => [], scan: async () => ["3: aws-access-key"] } }))).toBe(1);
    expect(ghCalls()).toEqual([]);
    expect(git(work, "branch", "--list")).not.toContain("workflow/");
  });
  it("commits exactly one file to workflow/<slug>, pushes it and calls gh with the exact args", async () => {
    await confirmed();
    fs.writeFileSync(path.join(work, "unrelated.txt"), "must not be staged");
    expect(await main(["open-pr", SLUG], mkCtx())).toBe(0);
    expect(out.join("\n")).toContain("https://github.com/example/repo/pull/999");
    expect(git(work, "show", "--name-status", "--format=%s", `workflow/${SLUG}`).split("\n")).toEqual([
      "workflow: Serialise the shared test database",
      "",
      `A\tcontent/workflows/${SLUG}.md`,
    ]);
    expect(git(work, "rev-parse", `workflow/${SLUG}^`)).toBe(git(work, "rev-parse", "origin/main"));
    expect(git(remote, "branch", "--list").replace(/[* ]/g, "").split("\n")).toContain(`workflow/${SLUG}`);
    expect(ghCalls()).toEqual([
      ["pr", "create", "--head", `workflow/${SLUG}`, "--title", "Workflow: Serialise the shared test database", "--body-file", ".github/PULL_REQUEST_TEMPLATE/workflow.md", "--label", "workflow"],
    ]);
    // The user's checkout, index and untracked files are untouched.
    expect(git(work, "branch", "--show-current")).toBe("main");
    expect(git(work, "diff", "--cached", "--name-only")).toBe("");
  });
  it("never publishes what the user already staged (pre-staged .env.local, review B2)", async () => {
    await confirmed();
    fs.writeFileSync(path.join(work, ".env.local"), "SERVICE_ROLE_KEY=not-a-real-key");
    git(work, "add", "-f", ".env.local");
    git(work, "add", "-f", `content/workflows/${SLUG}.md`);
    expect(await main(["open-pr", SLUG], mkCtx())).toBe(0);
    const files = git(remote, "diff", "--name-only", "main", `workflow/${SLUG}`);
    expect(files).toBe(`content/workflows/${SLUG}.md`);
    expect(git(remote, "ls-tree", "-r", "--name-only", `workflow/${SLUG}`)).not.toContain(".env.local");
  });
  it("keeps the user's staged files staged afterwards", async () => {
    await confirmed();
    fs.writeFileSync(path.join(work, "staged.txt"), "mine");
    git(work, "add", "staged.txt");
    expect(await main(["open-pr", SLUG], mkCtx())).toBe(0);
    expect(git(work, "diff", "--cached", "--name-only")).toBe("staged.txt");
  });
  it("on gh failure exits 1, keeps branch and commit, and prints the finishing command", async () => {
    await confirmed();
    expect(await main(["open-pr", SLUG], mkCtx({}, { GH_PR_FAIL: "1" }))).toBe(1);
    expect(git(work, "branch", "--list")).toContain(`workflow/${SLUG}`);
    expect(git(work, "log", "-1", "--format=%s", `workflow/${SLUG}`)).toContain("workflow:");
    expect(err.join("\n")).toMatch(/To finish: gh pr create --head workflow\/\S+ --title 'Workflow: Serialise the shared test database'/);
  });
  it("on push failure exits 1 and prints the push and gh commands", async () => {
    await confirmed();
    git(work, "remote", "set-url", "origin", path.join(tmp, "missing.git"));
    // origin/main still exists locally as a tracking ref.
    expect(await main(["open-pr", SLUG], mkCtx())).toBe(1);
    expect(err.join("\n")).toContain(`To finish: git push -u origin workflow/${SLUG} && gh pr create`);
    expect(ghCalls()).toEqual([]);
  });
});

describe("CLI entry", () => {
  it("prints usage for an unknown command", async () => {
    expect(await main(["bogus"], mkCtx())).toBe(1);
    expect(err.join("\n")).toContain("usage:");
  });
});
