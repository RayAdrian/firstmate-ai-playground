// @vitest-environment node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { seedWorkflows, type GitMetaProvider } from "../../../scripts/seed/lib/workflows";
import { findStaleWorkflows, formatWorkflowStale } from "../../../scripts/seed/lib/workflows-stale";
import { answersSchema, renderDraft } from "../../../scripts/workflows/share-lib";
import { formatWorkflowIssue, loadWorkflows, readMediaIds } from "../../../scripts/workflows/load";
import { runValidate } from "../../../scripts/workflows/run-validate";
import { FM_NOW, REPO_ROOT, VALID, contentSandbox } from "../w1/helpers";
import { memoryStore } from "../w1/memory-store";
import { sampleDraft } from "../w3/helpers";
import { readFileSync } from "node:fs";

const meta: GitMetaProvider = () => ({ author_name: "First Mate Stewards", reviewed_on: "2026-09-25" });

const DIAGRAM = `diagram:
  type: flow
  id: gate-flow
  title: Gate verdicts follow the commit
  summary: A verdict posted on one commit never carries to the next.
  steps:
    - id: review
      label: Review
    - id: post
      label: Post status
      emphasis: true
  exits:
    - from: post
      label: head moved
      text: Re-gate
      style: risk`;

/** Insert extra frontmatter lines before the closing fence. */
const withFm = (extra: string, base = VALID): string => base.replace(/\n---\n/, `\n${extra}\n---\n`);

/** A sandbox with a valid media manifest `l1-first-session/watch-me` beside content/. */
function sandbox(files: Record<string, string>, manifest: unknown = validManifest("watch-me", "l1-first-session")) {
  const sb = contentSandbox(files);
  if (manifest !== null) {
    const dir = path.join(sb.root, "public", "media", "lessons", "l1-first-session");
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "watch-me.media.json"), typeof manifest === "string" ? manifest : JSON.stringify(manifest));
  }
  return sb;
}
const validManifest = (id: string, lesson: string) => ({
  id,
  lesson_slug: lesson,
  kind: "animation",
  title: "Watch me",
  duration_s: 10,
  width: 1280,
  height: 720,
  tool_versions: { claude_code: "2.1.0" },
  made_on: "2026-09-20",
  model_calls: false,
  source_hash: "abc",
});

function validate(files: Record<string, string>, manifest?: unknown) {
  const sb = sandbox(files, manifest);
  const r = runValidate([], { contentDir: sb.contentDir, now: FM_NOW });
  return { ...r, text: r.stderr.join("\n") };
}

describe("DG-8: workflows:validate checks diagram and watch", () => {
  it("a valid diagram and watch pass, and are carried into the parsed value", () => {
    const sb = sandbox({ "gate-flow.md": withFm(`${DIAGRAM}\nwatch: l1-first-session/watch-me`) });
    const r = loadWorkflows({ contentDir: sb.contentDir, now: FM_NOW });
    expect(r.issues.map(formatWorkflowIssue)).toEqual([]);
    expect(r.workflows[0]?.diagram?.id).toBe("gate-flow");
    expect(r.workflows[0]?.watch).toBe("l1-first-session/watch-me");
  });

  it("files without the fields stay valid and carry null", () => {
    const sb = sandbox({ "plain.md": VALID });
    const r = loadWorkflows({ contentDir: sb.contentDir, now: FM_NOW });
    expect(r.issues).toEqual([]);
    expect(r.workflows[0]).toMatchObject({ diagram: null, watch: null });
  });

  it("an invalid diagram exits 1 and names the field", () => {
    const bad = DIAGRAM.replace("id: post", "id: review");
    const r = validate({ "gate-flow.md": withFm(bad) });
    expect(r.exitCode).toBe(1);
    expect(r.text).toMatch(/gate-flow\.md: diagram\.steps\.1\.id: duplicate id "review"/);
  });

  it("a label-fit or height failure exits 1 and names the field", () => {
    const step = (i: number) => `    - {id: s${i}, label: "${"a".repeat(24)}\\n${"b".repeat(24)}", sub: "${"c".repeat(28)}", next: edge}`;
    const tall = `diagram:\n  type: flow\n  id: tall\n  title: T\n  summary: S\n  steps:\n${[0, 1, 2, 3, 4, 5].map(step).join("\n")}`;
    const r = validate({ "tall.md": withFm(tall) });
    expect(r.exitCode).toBe(1);
    expect(r.text).toMatch(/tall\.md: diagram\.layout: height \d+ is over the 560 maximum/);
  });

  it("a diagram fence in the body exits 1", () => {
    const body = VALID.replace("## Why it works\n", "## Why it works\n\n```diagram\ntype: stack\n```\n");
    const r = validate({ "fenced.md": body });
    expect(r.exitCode).toBe(1);
    expect(r.text).toMatch(/fenced\.md: body: a diagram fence is not allowed in a workflow body/);
  });

  it("a malformed watch exits 1", () => {
    const r = validate({ "w.md": withFm("watch: Not A Slug") });
    expect(r.exitCode).toBe(1);
    expect(r.text).toMatch(/w\.md: watch: expected <lesson-slug>\/<media-id>/);
  });

  it("a watch that resolves to no manifest exits 1", () => {
    const r = validate({ "w.md": withFm("watch: l1-first-session/nope") });
    expect(r.exitCode).toBe(1);
    expect(r.text).toMatch(/w\.md: watch: "l1-first-session\/nope" matches no valid media manifest/);
  });

  it("a watch that resolves to an invalid manifest exits 1", () => {
    const r = validate({ "w.md": withFm("watch: l1-first-session/watch-me") }, { id: "watch-me", lesson_slug: "l1-first-session" });
    expect(r.exitCode).toBe(1);
    expect(r.text).toMatch(/w\.md: watch: /);
  });

  it("a watch whose manifest folder and lesson_slug disagree is not resolvable", () => {
    const r = validate({ "w.md": withFm("watch: l1-first-session/watch-me") }, validManifest("watch-me", "l2-context-files"));
    expect(r.exitCode).toBe(1);
  });

  it("a watch on a missing or archived lesson exits 1", () => {
    const sb = sandbox({ "w.md": withFm("watch: l9-gone/watch-me") }, null);
    const dir = path.join(sb.root, "public", "media", "lessons", "l9-gone");
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "watch-me.media.json"), JSON.stringify(validManifest("watch-me", "l9-gone")));
    const r = runValidate([], { contentDir: sb.contentDir, now: FM_NOW });
    expect(r.exitCode).toBe(1);
    expect(r.stderr.join("\n")).toMatch(/w\.md: watch: /);
  });

  it("readMediaIds lists only valid manifests on lessons it is given", () => {
    const sb = sandbox({}, validManifest("watch-me", "l1-first-session"));
    const root = path.join(sb.root, "public", "media", "lessons");
    expect(readMediaIds(root, new Set(["l1-first-session"]))).toEqual(["l1-first-session/watch-me"]);
    expect(readMediaIds(root, new Set(["other"]))).toEqual([]);
    expect(readMediaIds(path.join(sb.root, "nowhere"), new Set(["l1-first-session"]))).toEqual([]);
  });
});

describe("DG-6: anchors, aliases and tags in a workflow's diagram subtree", () => {
  it("an anchor, an alias and a custom tag each fail workflows:validate", () => {
    const anchored = DIAGRAM.replace("id: gate-flow", "id: &a gate-flow");
    const aliased = DIAGRAM.replace("title: Gate verdicts follow the commit", "title: &t Gate verdicts follow the commit\n  extra: *t");
    const tagged = DIAGRAM.replace("title: Gate verdicts follow the commit", "title: !custom Gate verdicts follow the commit");
    for (const bad of [anchored, aliased, tagged]) {
      const r = validate({ "a.md": withFm(bad) });
      expect(r.exitCode).toBe(1);
      expect(r.text).toMatch(/a\.md: (diagram|frontmatter): /);
    }
    expect(validate({ "a.md": withFm(anchored) }).text).toMatch(/YAML anchors are not allowed in a diagram/);
  });
});

describe("DG-8: the seed writes diagram and watch, and skips a bad file", () => {
  const files = () => ({ "gate-flow.md": withFm(`${DIAGRAM}\nwatch: l1-first-session/watch-me`) });

  it("writes both columns and is idempotent", async () => {
    const sb = sandbox(files());
    const store = memoryStore();
    await seedWorkflows(store, { contentDir: sb.contentDir, now: FM_NOW, meta });
    expect(store.rows()[0]?.watch).toBe("l1-first-session/watch-me");
    expect(store.rows()[0]?.diagram).toMatchObject({ type: "flow", id: "gate-flow", loops: [] });
    const before = store.log.length;
    const second = await seedWorkflows(store, { contentDir: sb.contentDir, now: FM_NOW, meta });
    expect(store.log.length).toBe(before);
    expect(second).toMatchObject({ inserted: 0, updated: 0 });
  });

  it("a diagram edit updates the row", async () => {
    const sb = sandbox(files());
    const store = memoryStore();
    await seedWorkflows(store, { contentDir: sb.contentDir, now: FM_NOW, meta });
    writeFileSync(path.join(sb.workflowsDir, "gate-flow.md"), withFm(`${DIAGRAM.replace("Re-gate", "Gate again")}\nwatch: l1-first-session/watch-me`));
    const r = await seedWorkflows(store, { contentDir: sb.contentDir, now: FM_NOW, meta });
    expect(r.updated).toBe(1);
  });

  it("an invalid diagram is skipped with its row left unchanged", async () => {
    const sb = sandbox(files());
    const store = memoryStore();
    await seedWorkflows(store, { contentDir: sb.contentDir, now: FM_NOW, meta });
    const kept = JSON.stringify(store.rows()[0]);
    writeFileSync(path.join(sb.workflowsDir, "gate-flow.md"), withFm(DIAGRAM.replace("id: post", "id: review")));
    const r = await seedWorkflows(store, { contentDir: sb.contentDir, now: FM_NOW, meta });
    expect(r.skipped.map(formatWorkflowIssue).join("\n")).toMatch(/diagram\.steps\.1\.id/);
    expect(JSON.stringify(store.rows()[0])).toBe(kept);
  });
});

describe("DG-12: /share-workflow never drafts a diagram or watch", () => {
  it("renderDraft emits neither key, even if the answers file carries them", () => {
    const answers = answersSchema.parse({
      answers: { problem: "p", change: "c", files: [] },
      workflow: { ...sampleDraft(), diagram: { type: "flow" }, watch: "l1-first-session/watch-me" },
    });
    const md = renderDraft(answers.workflow);
    expect(md).not.toMatch(/^diagram:/m);
    expect(md).not.toMatch(/^watch:/m);
    expect(Object.keys(answers.workflow)).not.toContain("diagram");
  });
});

describe("DG-13: the merger is prompted to look at a diagram", () => {
  it("the PR template's merger list has the line", () => {
    const t = readFileSync(path.join(REPO_ROOT, ".github/PULL_REQUEST_TEMPLATE/workflow.md"), "utf8");
    const merger = t.slice(t.indexOf("## Merger review"));
    expect(merger).toContain("If this PR adds or changes `diagram`: open the workflow at 360px and confirm the diagram matches the prose.");
  });
});

describe("DG-14: a broken watch is flagged by content:stale", () => {
  const wf = (slug: string, watch: string | null) => ({ slug, verified_on: "2026-09-25", tools: ["claude-code" as const], tool_versions: {}, watch });
  const valid = new Set(["l1-first-session/watch-me"]);

  it("lists a workflow whose watch no longer resolves, and not one that does", () => {
    const f = findStaleWorkflows({ workflows: [wf("ok", "l1-first-session/watch-me"), wf("broken", "l1-first-session/renamed"), wf("none", null)], now: FM_NOW, latest: {}, validMedia: valid });
    expect(f.map((x) => x.slug)).toEqual(["broken"]);
    expect(f[0]?.brokenWatch).toBe("l1-first-session/renamed");
    expect(formatWorkflowStale(f, 3).join("\n")).toContain('watch "l1-first-session/renamed" no longer resolves to a valid media item');
  });

  it("without a media list, watch is not judged (existing callers keep their output)", () => {
    expect(findStaleWorkflows({ workflows: [wf("broken", "l1-first-session/renamed")], now: FM_NOW, latest: {} })).toEqual([]);
  });
});
