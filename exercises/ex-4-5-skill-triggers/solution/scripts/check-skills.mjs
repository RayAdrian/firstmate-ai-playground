// Structural check for the release-notes skill. `npm run check` prints every problem; the tests call checkSkills().
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isTruthy, parseFrontmatter } from "./frontmatter.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// The documented project locations: Claude Code reads .claude/skills, Codex reads .agents/skills.
export const LOCATIONS = [".claude/skills", ".agents/skills"];
export const SKILL_NAME = "release-notes";
export const DESCRIPTION_MAX = 400; // Claude Code truncates description + when_to_use at 1,536 characters; shorter is better.

const STOP = new Set(
  "about after also been before does from have into just like make more need only over please some than that them then they this those used uses using want what when where which will with would your user users asks asked ask".split(" "),
);
export const tokens = (s) =>
  [...new Set(String(s).toLowerCase().match(/[a-z0-9]+/g) ?? [])].filter((t) => t.length >= 4 && !STOP.has(t));

const err = (errors, code, message) => errors.push({ code, message });

export function checkSkills(base = root) {
  const errors = [];
  const prompts = JSON.parse(readFileSync(join(base, "tests/prompts.json"), "utf8"));
  const skills = [];

  // 1. Location: the folder must live in a documented location, as <name>/SKILL.md.
  for (const stray of ["skills", ".claude/skill", ".agents/skill"]) {
    if (existsSync(join(base, stray))) {
      err(errors, "location", `${stray}/ is not a skill location. Move the skill folder to .claude/skills/<name>/ (Claude Code) or .agents/skills/<name>/ (Codex).`);
    }
  }
  for (const loc of LOCATIONS) {
    const dir = join(base, loc);
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (!statSync(full).isDirectory()) {
        err(errors, "location", `${loc}/${entry} is a loose file. A skill is a folder: ${loc}/<name>/SKILL.md.`);
        continue;
      }
      if (!readdirSync(full).includes("SKILL.md")) {
        err(errors, "location", `${loc}/${entry}/ has no SKILL.md (the file name is exactly SKILL.md).`);
        continue;
      }
      skills.push({ loc, folder: entry, dir: full });
    }
  }
  if (!skills.length) err(errors, "location", "no skill found in .claude/skills/ or .agents/skills/.");
  // Also inspect a misplaced skills/ folder, so one run shows every problem, not just the first.
  const misplaced = join(base, "skills");
  if (existsSync(misplaced)) {
    for (const entry of readdirSync(misplaced)) {
      const full = join(misplaced, entry);
      if (statSync(full).isDirectory() && readdirSync(full).includes("SKILL.md")) skills.push({ loc: "skills", folder: entry, dir: full });
    }
  }

  for (const s of skills) {
    const where = `${s.loc}/${s.folder}`;
    if (s.folder !== SKILL_NAME) err(errors, "name", `${where}: the skill folder should be named "${SKILL_NAME}".`);

    // 2. Frontmatter must parse; otherwise the skill loads with no metadata.
    const fm = parseFrontmatter(readFileSync(join(s.dir, "SKILL.md"), "utf8"));
    if (!fm.ok) {
      err(errors, "frontmatter", `${where}/SKILL.md: ${fm.error}.`);
      continue;
    }
    const { data, body } = fm;

    if (data.name !== undefined && data.name !== s.folder) {
      err(errors, "name", `${where}/SKILL.md: name "${data.name}" should equal the folder name "${s.folder}" (lowercase, hyphens).`);
    }

    // 3. The description is the trigger: what it does, and when to use it, in words a person would type.
    const d = data.description ?? "";
    if (!d) err(errors, "description", `${where}/SKILL.md: add a description.`);
    else {
      if (d.length < 60) err(errors, "description", `${where}/SKILL.md: the description is ${d.length} characters; say what the skill does AND when to use it (at least 60).`);
      if (d.length > DESCRIPTION_MAX) err(errors, "description", `${where}/SKILL.md: the description is ${d.length} characters; keep it under ${DESCRIPTION_MAX} and put the key use case first.`);
      if (!/use when/i.test(d)) err(errors, "description", `${where}/SKILL.md: the description needs a "Use when ..." clause that names the requests that should load this skill.`);
      if (!/release notes/i.test(d)) err(errors, "description", `${where}/SKILL.md: the description should say "release notes".`);
      const dt = new Set(tokens(d));
      for (const p of prompts.should_trigger) {
        const hits = tokens(p).filter((t) => dt.has(t));
        if (hits.length < 2) err(errors, "triggers", `${where}/SKILL.md: the description shares ${hits.length} word(s) with the request "${p}". Use the words people actually type (need at least 2).`);
      }
      for (const p of prompts.should_not_trigger) {
        const hits = tokens(p).filter((t) => dt.has(t));
        if (hits.length) err(errors, "triggers", `${where}/SKILL.md: the description would also match "${p}" (shared: ${hits.join(", ")}). Make it more specific.`);
      }
    }

    // 4. Nothing may stop the model from loading the skill by itself.
    if (isTruthy(data["disable-model-invocation"])) {
      err(errors, "invocation", `${where}/SKILL.md: disable-model-invocation is on, so Claude never loads this skill by itself. Remove it.`);
    }
    const yamlPath = join(s.dir, "agents/openai.yaml");
    if (existsSync(yamlPath) && /allow_implicit_invocation:\s*false/i.test(readFileSync(yamlPath, "utf8"))) {
      err(errors, "invocation", `${where}/agents/openai.yaml: allow_implicit_invocation is false, so Codex only runs this skill when you type $${s.folder}. Remove it or set it to true.`);
    }

    // 5. Supporting files: the body must point at template.md, and the file must sit next to SKILL.md.
    const lines = body.split("\n").length;
    if (lines > 500) err(errors, "supporting", `${where}/SKILL.md: the body is ${lines} lines; keep it under 500 and move detail into supporting files.`);
    if (!/\]\(template\.md\)|`template\.md`/.test(body)) err(errors, "supporting", `${where}/SKILL.md: the body should point at template.md so the agent knows when to read it.`);
    if (!existsSync(join(s.dir, "template.md"))) err(errors, "supporting", `${where}/template.md is missing: the supporting file must travel with the skill folder.`);
  }
  return { errors, skills };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { errors, skills } = checkSkills();
  for (const e of errors) console.error(`[${e.code}] ${e.message}`);
  if (errors.length) {
    console.error(`\n${errors.length} problem(s).`);
    process.exit(1);
  }
  console.log(`OK: ${skills.map((s) => `${s.loc}/${s.folder}`).join(", ")}`);
}
