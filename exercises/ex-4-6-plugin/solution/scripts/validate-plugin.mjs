// Validates the plugin you build in plugin/ (and, if you add one, the marketplace.json beside it).
// `npm run validate` prints every problem; the tests call validatePlugin() and validateMarketplace().
// This mirrors the rules in the Claude Code plugin docs. The authoritative check is `claude plugin validate`.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFrontmatter } from "./frontmatter.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export const PLUGIN_NAME = "fm-team-kit"; // the exercise fixes the names so the checks can be specific
export const SKILL_NAME = "pr-description";
export const COMMAND_NAME = "changelog";

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED_PREFIX = ["claude-", "anthropic-", "anthropics-", "cc-plugin-"];
const RESERVED_NAME = ["claude", "anthropic", "anthropics", "claude-code", "claude-mods"];

const err = (errors, code, message) => errors.push({ code, message });
const readJson = (file, errors, code, label) => {
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    err(errors, code, `${label} is not valid JSON: ${e.message}`);
    return null;
  }
};
const isDir = (p) => existsSync(p) && statSync(p).isDirectory();

export function nameProblem(name, label) {
  if (typeof name !== "string" || !name) return `${label}: "name" is required`;
  if (!KEBAB.test(name)) return `${label}: name "${name}" must be kebab-case (lowercase letters, digits, hyphens; no spaces)`;
  if (RESERVED_NAME.includes(name) || RESERVED_PREFIX.some((p) => name.startsWith(p))) {
    return `${label}: name "${name}" is reserved: it passes as one of Anthropic's own`;
  }
  return null;
}

export function validatePlugin(dir = join(root, "plugin")) {
  const errors = [];
  if (!isDir(dir)) {
    err(errors, "manifest", "plugin/ is missing");
    return { errors, manifest: null };
  }

  // 1. The manifest: .claude-plugin/plugin.json, and nothing else inside .claude-plugin/.
  const metaDir = join(dir, ".claude-plugin");
  const manifestPath = join(metaDir, "plugin.json");
  const manifest = readJson(manifestPath, errors, "manifest", ".claude-plugin/plugin.json");
  if (!existsSync(manifestPath)) err(errors, "manifest", "plugin/.claude-plugin/plugin.json is missing");
  if (manifest) {
    const np = nameProblem(manifest.name, "plugin.json");
    if (np) err(errors, "manifest", np);
    else if (manifest.name !== PLUGIN_NAME) err(errors, "manifest", `plugin.json: name should be "${PLUGIN_NAME}" for this exercise, got "${manifest.name}"`);
    if (typeof manifest.version !== "string" || !/^\d+\.\d+\.\d+/.test(manifest.version)) {
      err(errors, "manifest", 'plugin.json: set "version" to a string like "1.0.0" (team rule: we pin versions, so an update only reaches people when you bump it)');
    }
    if (typeof manifest.description !== "string" || manifest.description.trim().length < 10) err(errors, "manifest", 'plugin.json: add a "description" (it is what /plugin shows)');
    if (!manifest.author || typeof manifest.author.name !== "string" || !manifest.author.name) err(errors, "manifest", 'plugin.json: add "author": { "name": "..." }');
  }
  if (isDir(metaDir)) {
    for (const entry of readdirSync(metaDir)) {
      if (entry !== "plugin.json") {
        err(errors, "layout", `plugin/.claude-plugin/${entry} will not load. Only plugin.json goes in .claude-plugin/; put skills/, commands/ and hooks/ at the plugin root.`);
      }
    }
  }
  if (existsSync(join(dir, "CLAUDE.md"))) {
    err(errors, "layout", "plugin/CLAUDE.md is not loaded as context in a plugin. Put instructions in a skill instead.");
  }

  // 2. One skill: skills/<name>/SKILL.md with a description that says when to use it.
  const skillsDir = join(dir, "skills");
  const skillDirs = isDir(skillsDir) ? readdirSync(skillsDir).filter((e) => isDir(join(skillsDir, e))) : [];
  for (const e of isDir(skillsDir) ? readdirSync(skillsDir) : []) {
    if (!isDir(join(skillsDir, e))) err(errors, "skill", `plugin/skills/${e} is a loose file. A skill is a folder: skills/<name>/SKILL.md.`);
  }
  if (!skillDirs.length) err(errors, "skill", `no skill found. Add plugin/skills/${SKILL_NAME}/SKILL.md.`);
  if (skillDirs.length && !skillDirs.includes(SKILL_NAME)) err(errors, "skill", `add the skill folder plugin/skills/${SKILL_NAME}/ (found: ${skillDirs.join(", ")})`);
  for (const s of skillDirs) {
    const file = join(skillsDir, s, "SKILL.md");
    if (!existsSync(file)) {
      err(errors, "skill", `plugin/skills/${s}/ has no SKILL.md`);
      continue;
    }
    const fm = parseFrontmatter(readFileSync(file, "utf8"));
    if (!fm.ok) {
      err(errors, "skill", `plugin/skills/${s}/SKILL.md: ${fm.error}`);
      continue;
    }
    if (fm.data.name !== undefined && fm.data.name !== s) err(errors, "skill", `plugin/skills/${s}/SKILL.md: name "${fm.data.name}" should equal the folder name "${s}"`);
    const d = fm.data.description ?? "";
    if (d.length < 40) err(errors, "skill", `plugin/skills/${s}/SKILL.md: the description is ${d.length} characters; say what the skill does and when to use it (at least 40)`);
    if (!/use when/i.test(d)) err(errors, "skill", `plugin/skills/${s}/SKILL.md: the description needs a "Use when ..." clause`);
    if (fm.body.trim().split("\n").length < 3) err(errors, "skill", `plugin/skills/${s}/SKILL.md: the body is too thin to be useful instructions`);
  }

  // 3. One command: commands/<name>.md with a description, taking an argument.
  const cmdDir = join(dir, "commands");
  const cmdFiles = isDir(cmdDir) ? readdirSync(cmdDir).filter((e) => e.endsWith(".md")) : [];
  if (!cmdFiles.length) err(errors, "command", `no command found. Add plugin/commands/${COMMAND_NAME}.md.`);
  if (cmdFiles.length && !cmdFiles.includes(`${COMMAND_NAME}.md`)) err(errors, "command", `add plugin/commands/${COMMAND_NAME}.md (found: ${cmdFiles.join(", ")})`);
  for (const f of cmdFiles) {
    const fm = parseFrontmatter(readFileSync(join(cmdDir, f), "utf8"));
    if (!fm.ok) {
      err(errors, "command", `plugin/commands/${f}: ${fm.error}`);
      continue;
    }
    if (!fm.data.description) err(errors, "command", `plugin/commands/${f}: add a "description" to the frontmatter (it shows in the / menu)`);
    if (!fm.body.includes("$ARGUMENTS")) err(errors, "command", `plugin/commands/${f}: the body should use $ARGUMENTS so what the user types after the command reaches the prompt`);
  }

  // 4. Hooks are optional. If you add them, the file needs a top-level "hooks" key.
  const hooksFile = join(dir, "hooks", "hooks.json");
  if (existsSync(hooksFile)) {
    const hooks = readJson(hooksFile, errors, "hooks", "hooks/hooks.json");
    if (hooks && (typeof hooks.hooks !== "object" || hooks.hooks === null)) err(errors, "hooks", 'hooks/hooks.json needs a top-level "hooks" object, the same shape as "hooks" in settings.json');
  }
  return { errors, manifest };
}

// The marketplace is optional in this exercise: if .claude-plugin/marketplace.json exists, it must be valid.
export function validateMarketplace(base = root) {
  const errors = [];
  const file = join(base, ".claude-plugin", "marketplace.json");
  if (!existsSync(file)) return { errors, present: false };
  const m = readJson(file, errors, "marketplace", ".claude-plugin/marketplace.json");
  if (!m) return { errors, present: true };
  const np = nameProblem(m.name, "marketplace.json");
  if (np) err(errors, "marketplace", np);
  if (!m.owner || typeof m.owner.name !== "string" || !m.owner.name) err(errors, "marketplace", 'marketplace.json: "owner": { "name": "..." } is required');
  if (!Array.isArray(m.plugins) || !m.plugins.length) err(errors, "marketplace", 'marketplace.json: "plugins" must list at least one plugin');
  for (const [i, p] of (Array.isArray(m.plugins) ? m.plugins : []).entries()) {
    const label = `plugins[${i}]`;
    if (typeof p.name !== "string" || !p.name) {
      err(errors, "marketplace", `${label}: "name" is required`);
      continue;
    }
    if (typeof p.source !== "string") continue; // object sources (github, git-subdir, ...) are fetched, not checked here
    if (!p.source.startsWith("./") || p.source.includes("..")) {
      err(errors, "marketplace", `${label} (${p.name}): a relative source starts with ./ and never contains ..; write it from the marketplace root`);
      continue;
    }
    const pluginDir = join(base, p.source);
    const manifest = readJson(join(pluginDir, ".claude-plugin", "plugin.json"), errors, "marketplace", `${p.source}/.claude-plugin/plugin.json`);
    if (!manifest) err(errors, "marketplace", `${label} (${p.name}): ${p.source} has no .claude-plugin/plugin.json`);
    else if (manifest.name !== p.name) err(errors, "marketplace", `${label}: the entry name "${p.name}" must equal the plugin's own name "${manifest.name}", or installs by name fail`);
    if (manifest && manifest.version !== undefined && p.version !== undefined) {
      err(errors, "marketplace", `${label} (${p.name}): set "version" in plugin.json OR in the entry, not both`);
    }
  }
  return { errors, present: true };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const a = validatePlugin();
  const b = validateMarketplace();
  for (const e of [...a.errors, ...b.errors]) console.error(`[${e.code}] ${e.message}`);
  const n = a.errors.length + b.errors.length;
  if (n) {
    console.error(`\n${n} problem(s).`);
    process.exit(1);
  }
  console.log(`OK: plugin ${a.manifest.name}@${a.manifest.version}${b.present ? ", marketplace valid" : " (no marketplace.json: optional)"}`);
}
