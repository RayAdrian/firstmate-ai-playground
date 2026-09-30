// Verifies the agent guardrail config in this repo. Run: node scripts/check-config.mjs
// Exits 0 when both tools are configured as the exercise asks, 1 otherwise.
import { existsSync, readFileSync } from "node:fs";

const failures = [];
const fail = (tool, msg) => failures.push(`[${tool}] ${msg}`);

// ---------------------------------------------------------------- Claude Code
function bashRuleMatches(rule, command) {
  if (rule === "Bash" || rule === "Bash(*)") return true;
  const m = /^Bash\((.*)\)$/s.exec(rule);
  if (!m) return false;
  let spec = m[1];
  if (spec.endsWith(":*")) spec = `${spec.slice(0, -2)} *`; // "npm:*" means "npm *"
  const escape = (s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  // A lone trailing " *" also matches the bare command ("ls *" matches "ls").
  if (spec.endsWith(" *") && spec.indexOf("*") === spec.length - 1) {
    return new RegExp(`^${escape(spec.slice(0, -2))}( .*)?$`, "s").test(command);
  }
  return new RegExp(`^${spec.split("*").map(escape).join(".*")}$`, "s").test(command);
}

function checkClaude() {
  const path = ".claude/settings.json";
  if (!existsSync(path)) return fail("claude", `${path} is missing`);
  let s;
  try {
    s = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    return fail("claude", `${path} is not valid JSON: ${e.message}`);
  }
  const perms = s.permissions ?? {};
  const allow = perms.allow ?? [];
  const deny = perms.deny ?? [];

  // 1. Tests and lint run without prompts.
  for (const cmd of ["npm test", "npm run lint"]) {
    if (!allow.some((r) => bashRuleMatches(r, cmd))) {
      fail("claude", `permissions.allow has no rule that matches "${cmd}"`);
    }
    if (deny.some((r) => bashRuleMatches(r, cmd))) {
      fail("claude", `a deny rule blocks "${cmd}" (deny always wins over allow)`);
    }
  }

  // 2. Allow list is narrow: nothing that also approves network or destructive commands.
  for (const cmd of ["curl https://example.com", "rm -rf /", "git push origin main"]) {
    const broad = allow.find((r) => bashRuleMatches(r, cmd));
    if (broad) fail("claude", `allow rule ${JSON.stringify(broad)} is too broad: it also approves "${cmd}"`);
  }

  // 3. Network blocked for commands and for the web tool.
  for (const cmd of ["curl https://example.com", "wget https://example.com"]) {
    if (!deny.some((r) => bashRuleMatches(r, cmd))) {
      fail("claude", `permissions.deny has no rule that blocks "${cmd}"`);
    }
  }
  if (!deny.includes("WebFetch")) fail("claude", 'permissions.deny should contain "WebFetch"');
  if ((s.sandbox?.network?.allowedDomains ?? []).length > 0) {
    fail("claude", "sandbox.network.allowedDomains must be empty (no pre-approved hosts)");
  }

  // 4. Secrets unreadable.
  if (!deny.some((r) => /^Read\(.*\.env.*\)$/.test(r))) {
    fail("claude", 'permissions.deny should block reading the env file, for example "Read(./secrets.env)" (in a real repo: "Read(./.env)")');
  }

  // 5. Writes confined to the repo: sandbox on, no escape hatch, no extra writable paths.
  if (s.sandbox?.enabled !== true) fail("claude", "sandbox.enabled must be true");
  if (s.sandbox?.allowUnsandboxedCommands !== false) {
    fail("claude", "sandbox.allowUnsandboxedCommands must be false");
  }
  if ((s.sandbox?.filesystem?.allowWrite ?? []).length > 0) {
    fail("claude", "sandbox.filesystem.allowWrite must be empty (no writes outside the repo)");
  }
  if ((perms.additionalDirectories ?? []).length > 0) {
    fail("claude", "permissions.additionalDirectories must be empty");
  }
  if (perms.defaultMode === "bypassPermissions") {
    fail("claude", "permissions.defaultMode must not be bypassPermissions");
  }
}

// ------------------------------------------------------------------ Codex CLI
// Minimal TOML reader: comments, [tables], and string / boolean / number / one-line array values.
function parseToml(text) {
  const out = {};
  let table = out;
  for (const raw of text.split(/\r?\n/)) {
    let line = "";
    let quote = null;
    for (const ch of raw) {
      if (quote) {
        if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'") quote = ch;
      else if (ch === "#") break;
      line += ch;
    }
    line = line.trim();
    if (!line) continue;
    const t = /^\[([A-Za-z0-9_.\-"]+)\]$/.exec(line);
    if (t) {
      table = out;
      for (const part of t[1].split(".")) table = table[part.replace(/"/g, "")] ??= {};
      continue;
    }
    const kv = /^([A-Za-z0-9_.\-]+)\s*=\s*(.+)$/.exec(line);
    if (!kv) continue;
    const v = kv[2].trim();
    let value;
    if (/^".*"$|^'.*'$/.test(v)) value = v.slice(1, -1);
    else if (v === "true" || v === "false") value = v === "true";
    else if (/^-?\d+(\.\d+)?$/.test(v)) value = Number(v);
    else if (v.startsWith("[")) value = [...v.matchAll(/"([^"]*)"|'([^']*)'/g)].map((x) => x[1] ?? x[2]);
    else value = v;
    // Dotted keys ("sandbox_workspace_write.network_access = true") address nested tables.
    const keys = kv[1].split(".");
    let target = table;
    for (const k of keys.slice(0, -1)) target = target[k] ??= {};
    target[keys.at(-1)] = value;
  }
  return out;
}

function checkCodex() {
  const path = ".codex/config.toml";
  if (!existsSync(path)) return fail("codex", `${path} is missing`);
  const c = parseToml(readFileSync(path, "utf8"));

  if (c.sandbox_mode !== "workspace-write") {
    fail("codex", `sandbox_mode must be "workspace-write" (found ${JSON.stringify(c.sandbox_mode)})`);
  }
  if (c.approval_policy === "untrusted") {
    fail("codex", 'approval_policy "untrusted" is retired and can stop Codex from starting; use "on-request"');
  } else if (c.approval_policy !== "on-request") {
    fail("codex", `approval_policy must be "on-request" (found ${JSON.stringify(c.approval_policy)})`);
  }
  const ws = c.sandbox_workspace_write ?? {};
  if (ws.network_access === true) fail("codex", "sandbox_workspace_write.network_access must not be true");
  if ((ws.writable_roots ?? []).length > 0) {
    fail("codex", "sandbox_workspace_write.writable_roots must be empty (no writes outside the repo)");
  }
  if (c.web_search !== "disabled") {
    fail("codex", `web_search must be "disabled" (found ${JSON.stringify(c.web_search)})`);
  }
  if (c.default_permissions !== undefined || c.permissions !== undefined) {
    fail("codex", "do not mix permission profiles with sandbox_mode; use the sandbox_mode style for this exercise");
  }
}

checkClaude();
checkCodex();

if (failures.length) {
  console.error(`config check: ${failures.length} problem(s)\n`);
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}
console.log("config check: OK (Claude Code and Codex CLI both configured)");
