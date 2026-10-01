// @vitest-environment node
import { writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { seedWorkflows, type GitMetaProvider } from "../../../scripts/seed/lib/workflows";
import { loadWorkflows } from "../../../scripts/workflows/load";
import { FM_NOW, VALID, contentSandbox } from "./helpers";
import { memoryStore } from "./memory-store";

const meta: GitMetaProvider = () => ({ author_name: "Git Author", reviewed_on: "2026-09-25" });
const OTHER = VALID.replace("Gate statuses pinned", "Gate verdicts pinned");
const sandbox = (authors?: string) => {
  const s = contentSandbox({ "listed-flow.md": VALID, "unlisted-flow.md": OTHER });
  if (authors !== undefined) writeFileSync(path.join(s.workflowsDir, "_seed-authors.txt"), authors);
  return s;
};
const authorOf = (store: ReturnType<typeof memoryStore>, slug: string) => store.rows().find((r) => r.slug === slug)?.author_name;

describe("_seed-authors.txt (PRD §16.8 seed attribution override)", () => {
  it("credits a listed slug to First Mate and keeps reviewed_on from git", async () => {
    const { contentDir } = sandbox("# seed workflows\n\nlisted-flow\n");
    const store = memoryStore();
    await seedWorkflows(store, { contentDir, now: FM_NOW, meta });
    expect(authorOf(store, "listed-flow")).toBe("First Mate");
    expect(store.rows().find((r) => r.slug === "listed-flow")?.reviewed_on).toBe("2026-09-25");
  });

  it("keeps the git author for an unlisted slug", async () => {
    const { contentDir } = sandbox("listed-flow\n");
    const store = memoryStore();
    await seedWorkflows(store, { contentDir, now: FM_NOW, meta });
    expect(authorOf(store, "unlisted-flow")).toBe("Git Author");
  });

  it("errors on a slug with no workflow file", () => {
    const { contentDir } = sandbox("listed-flow\nno-such-flow\n");
    const { issues } = loadWorkflows({ contentDir, now: FM_NOW });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ file: "content/workflows/_seed-authors.txt", line: 2, field: "seed-authors" });
    expect(issues[0]?.reason).toContain("no-such-flow");
  });

  it("means no overrides when the file is absent, and the file itself is an allowed config file", async () => {
    const { contentDir } = sandbox();
    const loaded = loadWorkflows({ contentDir, now: FM_NOW });
    expect(loaded.issues).toEqual([]);
    expect(loaded.seedAuthorSlugs.size).toBe(0);
    const store = memoryStore();
    await seedWorkflows(store, { contentDir, now: FM_NOW, meta });
    expect(authorOf(store, "listed-flow")).toBe("Git Author");

    writeFileSync(path.join(contentDir, "workflows", "_seed-authors.txt"), "listed-flow\n");
    expect(loadWorkflows({ contentDir, now: FM_NOW }).issues).toEqual([]);
  });
});
