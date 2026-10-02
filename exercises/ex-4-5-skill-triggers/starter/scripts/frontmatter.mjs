// A deliberately strict reader for SKILL.md frontmatter: single-line `key: value` pairs between two `---` lines.
// Real YAML allows more, but a skill that stays inside this subset parses in every tool.
// The mistakes it exists to catch (all verified with `claude plugin validate`, which reports
// "YAML frontmatter failed to parse ... this skill loads with empty metadata"): an unclosed quote, and a quote
// inside a quoted value, such as description: "Draft "release notes" for the team".
// An unquoted ": " is also invalid in strict YAML but Claude Code tolerates it, so it is not flagged here.

export function parseFrontmatter(text) {
  const lines = String(text).replace(/\r\n/g, "\n").split("\n");
  if (lines[0] !== "---") {
    return { ok: false, error: "the file must start with --- on line 1 (no blank line or BOM before it)", data: {}, body: lines.join("\n") };
  }
  const end = lines.indexOf("---", 1);
  if (end === -1) return { ok: false, error: "the frontmatter has no closing --- line", data: {}, body: "" };

  const data = {};
  for (let i = 1; i < end; i++) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const m = line.match(/^([A-Za-z][A-Za-z0-9_-]*):(?:[ \t]+(.*))?$/);
    if (!m) return { ok: false, error: `line ${i + 1}: expected "key: value", got "${line}"`, data, body: "" };
    const key = m[1];
    let value = (m[2] ?? "").trim();
    if (value.startsWith('"') || value.startsWith("'")) {
      const q = value[0];
      if (value.length < 2 || !value.endsWith(q)) {
        return { ok: false, error: `line ${i + 1}: the quoted value for "${key}" is not closed`, data, body: "" };
      }
      value = value.slice(1, -1);
      const inner = q === '"' ? value.replace(/\\./g, "") : value.replace(/''/g, "");
      if (inner.includes(q)) {
        return { ok: false, error: `line ${i + 1}: the value for "${key}" has a ${q} inside a ${q}-quoted string; use the other quote character outside, or drop the inner quotes`, data, body: "" };
      }
    }
    data[key] = value;
  }
  return { ok: true, data, body: lines.slice(end + 1).join("\n") };
}

export const isTruthy = (v) => ["true", "yes", "on", "1"].includes(String(v ?? "").trim().toLowerCase());
