import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });

/** The fixed test clock (same as the other workstreams): 30 Sep 2026, Manila. */
export const NOW = "2026-09-30T13:00:00+08:00";
export const TODAY = "2026-09-30";

/** Every fixture slug starts with this, so seeding and cleanup touch only these rows (the DB is shared). */
export const PREFIX = "w2fx-";
/** Every fixture title contains this, so `?q=w2fx` isolates them from any other workflow rows. */
export const MARK = "W2FX";

export function serviceClient() {
  return createClient(process.env.SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** ISO date `days` before TODAY. */
export function ago(days: number): string {
  const d = new Date(`${TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export type FixtureLesson = { slug: string; title: string; number: string; level: number };

/** The last active lesson in reading order (least likely to be used by another spec), with its "X.Y" number. */
export async function pickLessons(): Promise<{ related: FixtureLesson; unrelated: FixtureLesson }> {
  const db = serviceClient();
  const { data: levels, error: le } = await db.from("levels").select("id, number").is("archived_at", null);
  if (le || !levels) throw new Error(`levels: ${le?.message}`);
  const { data: lessons, error } = await db
    .from("lessons")
    .select("slug, title, level_id, sort")
    .is("archived_at", null);
  if (error || !lessons) throw new Error(`lessons: ${error?.message}`);
  const levelNo = new Map<string, number>(levels.map((l: { id: string; number: number }) => [l.id, l.number]));
  const active = lessons
    .filter((l: { level_id: string }) => levelNo.has(l.level_id))
    .map((l: { slug: string; title: string; level_id: string; sort: number }) => ({ ...l, level: levelNo.get(l.level_id)! }))
    .sort((a, b) => a.level - b.level || a.sort - b.sort);
  const perLevel = new Map<number, number>();
  const numbered: FixtureLesson[] = active.map((l) => {
    const pos = (perLevel.get(l.level) ?? 0) + 1;
    perLevel.set(l.level, pos);
    return { slug: l.slug, title: l.title, level: l.level, number: `${l.level}.${pos}` };
  });
  const { data: used } = await db.from("workflows").select("related_lesson_slug").not("related_lesson_slug", "is", null);
  const taken = new Set((used ?? []).map((r: { related_lesson_slug: string }) => r.related_lesson_slug));
  const related = numbered[numbered.length - 1]!;
  const unrelated = numbered.find((l) => l.slug !== related.slug && !taken.has(l.slug));
  if (!unrelated) throw new Error("no lesson without workflows to use as the empty case");
  return { related, unrelated };
}

type Block = { path: string; kind: string; lang: string; tool: "claude-code" | "codex" | null; code: string };

export type Fixture = {
  slug: string;
  title: string;
  problem: string;
  tools: ("claude-code" | "codex")[];
  setup: Block[];
  prompt: { shared?: string; claude?: string; codex?: string };
  use_cases: string[];
  stacks: string[];
  related_lesson_slug: string | null;
  level: number | null;
  tool_versions: { claude_code?: string; codex_cli?: string };
  verified_on: string;
  reviewed_on: string | null;
  author_name: string;
  why_md: string;
  removed_at?: string | null;
};

const WHY = "A written plan makes the agent's assumptions visible before any file changes, so review happens early.";

function base(over: Partial<Fixture> & Pick<Fixture, "slug" | "title">): Fixture {
  return {
    problem: "The agent starts editing before it understands the change you asked for.",
    tools: ["claude-code"],
    setup: [],
    prompt: { shared: "```text\nPlan the change first, then wait for approval.\n```" },
    use_cases: ["planning"],
    stacks: ["nextjs"],
    related_lesson_slug: null,
    level: null,
    tool_versions: { claude_code: "2.1.0" },
    verified_on: ago(5),
    reviewed_on: ago(4),
    author_name: "Ada Lovelace",
    why_md: WHY,
    ...over,
  };
}

export function buildFixtures(related: FixtureLesson): Fixture[] {
  const rel = { related_lesson_slug: related.slug, level: related.level };
  const both = { tools: ["claude-code", "codex"] as Fixture["tools"], tool_versions: { claude_code: "2.1.0", codex_cli: "0.40.0" } };
  const aged = (days: number) =>
    base({
      slug: `${PREFIX}aged-${days}`,
      title: `${MARK} Aged ${days} days`,
      problem: `A fixture workflow verified exactly ${days} days ago, for the boundary tests.`,
      verified_on: ago(days),
      reviewed_on: ago(1),
    });
  return [
    base({
      slug: `${PREFIX}both`,
      title: `${MARK} Plan before code`,
      ...both,
      ...rel,
      use_cases: ["planning", "review"],
      stacks: ["nextjs", "typescript"],
      setup: [
        { path: "AGENTS.md", kind: "context-file", lang: "markdown", tool: null, code: "# Rules\nPlan first." },
        { path: ".claude/settings.json", kind: "config", lang: "json", tool: "claude-code", code: '{ "permissions": {} }' },
        { path: ".codex/config.toml", kind: "config", lang: "toml", tool: "codex", code: 'approval_policy = "on-request"' },
      ],
      prompt: { shared: "```text\nPlan the change first, then wait for approval.\n```", codex: "```text\nCODEX ONLY: plan, then stop.\n```" },
      verified_on: ago(5),
    }),
    base({
      slug: `${PREFIX}claude`,
      title: `${MARK} Hook guard`,
      problem: "Edits to protected files slip through because nothing checks them before they land.",
      ...rel,
      use_cases: ["testing", "security"],
      stacks: ["react"],
      setup: [
        { path: ".claude/hooks/guard.sh", kind: "hook", lang: "bash", tool: "claude-code", code: "#!/usr/bin/env bash\nexit 0" },
        { path: ".claude/skills/guard/SKILL.md", kind: "skill", lang: "markdown", tool: "claude-code", code: "# Guard" },
      ],
      verified_on: ago(10),
    }),
    base({
      slug: `${PREFIX}codex`,
      title: `${MARK} Prompt only review`,
      problem: "Reviews skip the risky parts of a diff because the reviewer prompt is too vague.",
      tools: ["codex"],
      tool_versions: { codex_cli: "0.40.0" },
      ...rel,
      use_cases: ["review"],
      stacks: ["any"],
      setup: [],
      verified_on: ago(15),
    }),
    base({
      slug: `${PREFIX}extra`,
      title: `${MARK} Extra related`,
      problem: "Long tasks lose their thread because nothing records where the last session stopped.",
      ...both,
      ...rel,
      use_cases: ["automation"],
      stacks: ["node"],
      verified_on: ago(20),
    }),
    aged(60),
    aged(61),
    aged(180),
    aged(181),
    base({
      slug: `${PREFIX}script`,
      title: `${MARK} Script body`,
      problem: "A fixture whose body contains raw HTML that must render as escaped text only.",
      why_md: "Because <script>window.__w2xss = 1</script> never runs, the plan stays visible to every reviewer.",
      verified_on: ago(25),
    }),
    base({
      slug: `${PREFIX}removed`,
      title: `${MARK} Removed one`,
      problem: "A removed fixture that must not be listed and must 404 at its URL.",
      removed_at: "2026-09-01T00:00:00+08:00",
    }),
  ];
}

export async function seedFixtures(fixtures: Fixture[]): Promise<void> {
  const db = serviceClient();
  await clearFixtures();
  const rows = fixtures.map((f) => ({
    slug: f.slug,
    title: f.title,
    problem: f.problem,
    tools: f.tools,
    setup: f.setup,
    setup_kinds: [...new Set(f.setup.map((b) => b.kind))],
    prompt: f.prompt,
    result_before: "The agent edits files straight away and you review a large diff.",
    result_after: "The agent writes a plan first and waits for your approval.",
    steps: ["Add the setup files.", "Run the prompt.", "Review the plan before it edits."],
    why_md: f.why_md,
    use_cases: f.use_cases,
    stacks: f.stacks,
    related_lesson_slug: f.related_lesson_slug,
    level: f.level,
    tool_versions: f.tool_versions,
    verified_on: f.verified_on,
    author_name: f.author_name,
    reviewed_on: f.reviewed_on,
    content_hash: `w2fx-${f.slug}`,
    removed_at: f.removed_at ?? null,
  }));
  const { error } = await db.from("workflows").insert(rows);
  if (error) throw new Error(`could not seed workflow fixtures: ${error.message}`);
}

/** Delete only this spec's rows. */
export async function clearFixtures(): Promise<void> {
  const { error } = await serviceClient().from("workflows").delete().like("slug", `${PREFIX}%`);
  if (error) throw new Error(`could not clear workflow fixtures: ${error.message}`);
}
