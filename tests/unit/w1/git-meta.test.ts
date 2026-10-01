// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createGitMeta } from "../../../scripts/seed/lib/git-meta";
import { tmpDir } from "./helpers";

function git(cwd: string, args: string[], who?: { name: string; date: string }): string {
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" };
  if (who) {
    Object.assign(env, {
      GIT_AUTHOR_NAME: who.name,
      GIT_AUTHOR_EMAIL: "someone@example.com",
      GIT_COMMITTER_NAME: who.name,
      GIT_COMMITTER_EMAIL: "someone@example.com",
      GIT_AUTHOR_DATE: who.date,
      GIT_COMMITTER_DATE: who.date,
    });
  }
  return execFileSync("git", args, { cwd, env, encoding: "utf8" });
}

function commit(repo: string, file: string, text: string, who: { name: string; date: string }, msg = "change"): void {
  writeFileSync(path.join(repo, file), text);
  git(repo, ["add", "--", file], who);
  git(repo, ["commit", "-q", "-m", msg], who);
}

function makeRepo(branch = "main"): { repo: string; dir: string } {
  const repo = tmpDir("fm-git-");
  git(repo, ["init", "-q", "-b", branch]);
  const dir = path.join(repo, "content", "workflows");
  mkdirSync(dir, { recursive: true });
  return { repo, dir };
}

describe("createGitMeta (WF-42 attribution)", () => {
  it("uses the earliest commit that added the file as author, and the latest commit date as reviewed_on", () => {
    const { repo, dir } = makeRepo();
    commit(repo, "content/workflows/a-flow.md", "v1\n", { name: "Alice Author", date: "2026-09-01T12:00:00+08:00" });
    commit(repo, "content/workflows/a-flow.md", "v2\n", { name: "Bob Editor", date: "2026-09-25T12:00:00+08:00" });
    const g = createGitMeta(dir);
    expect(g.meta("a-flow.md")).toEqual({ author_name: "Alice Author", reviewed_on: "2026-09-25" });
    expect(g.warnings).toEqual([]);
  });

  it("never returns an email", () => {
    const { repo, dir } = makeRepo();
    commit(repo, "content/workflows/a-flow.md", "v1\n", { name: "Alice Author", date: "2026-09-01T12:00:00+08:00" });
    expect(JSON.stringify(createGitMeta(dir).meta("a-flow.md"))).not.toMatch(/@/);
  });

  it("follows a rename back to the commit that first added the content", () => {
    const { repo, dir } = makeRepo();
    commit(repo, "content/workflows/old-name.md", "# body that is long enough to be detected as a rename\n".repeat(5), { name: "Alice Author", date: "2026-09-01T12:00:00+08:00" });
    git(repo, ["mv", "content/workflows/old-name.md", "content/workflows/new-name.md"]);
    git(repo, ["commit", "-q", "-m", "rename"], { name: "Bob Editor", date: "2026-09-02T12:00:00+08:00" });
    expect(createGitMeta(dir).meta("new-name.md").author_name).toBe("Alice Author");
  });

  it("gives Unknown and a null date for a file with no commits, without a warning", () => {
    const { repo, dir } = makeRepo();
    commit(repo, "README.md", "x\n", { name: "Alice Author", date: "2026-09-01T12:00:00+08:00" });
    writeFileSync(path.join(dir, "untracked.md"), "x\n");
    const g = createGitMeta(dir);
    expect(g.meta("untracked.md")).toEqual({ author_name: "Unknown", reviewed_on: null });
    expect(g.warnings).toEqual([]);
  });

  it("reviewed_on is null while the file is on a branch that is not main yet", () => {
    const { repo, dir } = makeRepo();
    commit(repo, "README.md", "x\n", { name: "Alice Author", date: "2026-09-01T12:00:00+08:00" });
    git(repo, ["switch", "-q", "-c", "workflow/a-flow"]);
    commit(repo, "content/workflows/a-flow.md", "v1\n", { name: "Carol", date: "2026-09-10T12:00:00+08:00" });
    expect(createGitMeta(dir).meta("a-flow.md")).toEqual({ author_name: "Carol", reviewed_on: null });
  });

  it("falls back to HEAD for reviewed_on when there is no main branch", () => {
    const { repo, dir } = makeRepo("trunk");
    commit(repo, "content/workflows/a-flow.md", "v1\n", { name: "Alice Author", date: "2026-09-01T12:00:00+08:00" });
    expect(createGitMeta(dir).meta("a-flow.md").reviewed_on).toBe("2026-09-01");
  });

  it("in a shallow clone the author is Unknown, reviewed_on is null, and there is exactly one warning", () => {
    const { repo } = makeRepo();
    commit(repo, "content/workflows/a-flow.md", "v1\n", { name: "Alice Author", date: "2026-09-01T12:00:00+08:00" });
    commit(repo, "content/workflows/b-flow.md", "v1\n", { name: "Bob Editor", date: "2026-09-02T12:00:00+08:00" });
    const clone = tmpDir("fm-shallow-");
    git(clone, ["clone", "-q", "--depth", "1", `file://${repo}`, "c"]);
    const g = createGitMeta(path.join(clone, "c", "content", "workflows"));
    expect(g.meta("a-flow.md")).toEqual({ author_name: "Unknown", reviewed_on: null });
    expect(g.meta("b-flow.md")).toEqual({ author_name: "Unknown", reviewed_on: null });
    expect(g.warnings).toHaveLength(1);
    expect(g.warnings[0]).toMatch(/shallow/i);
  });

  it("outside a git repository it also degrades to Unknown with one warning", () => {
    const dir = tmpDir("fm-nogit-");
    const g = createGitMeta(dir);
    expect(g.meta("a-flow.md")).toEqual({ author_name: "Unknown", reviewed_on: null });
    expect(g.meta("b-flow.md").author_name).toBe("Unknown");
    expect(g.warnings).toHaveLength(1);
  });

  it("passes the file name as one argv entry after --, never through a shell", () => {
    const { repo, dir } = makeRepo();
    commit(repo, "README.md", "x\n", { name: "Alice Author", date: "2026-09-01T12:00:00+08:00" });
    // A name that would be dangerous in a shell is just an unknown path here.
    expect(createGitMeta(dir).meta("$(touch pwned).md")).toEqual({ author_name: "Unknown", reviewed_on: null });
    expect(() => execFileSync("test", ["!", "-e", path.join(dir, "pwned")])).not.toThrow();
  });
});
