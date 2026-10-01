// Pure helpers for the VHS recording pipeline (PRD 15, MD-5). No I/O except sha256File.
// Used by finalize.mjs and unit-tested from tests/unit/v2/.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

/** Seconds -> "HH:MM:SS.mmm" (WebVTT timestamp). */
export function vttTime(seconds) {
  const ms = Math.round(seconds * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const r = ms % 1000;
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(h)}:${p(m)}:${p(s)}.${p(r, 3)}`;
}

/** Returns a list of problems with the cue list (empty when valid). */
export function validateCues(cues, durationS) {
  const problems = [];
  if (!Array.isArray(cues) || cues.length === 0) return ["captions: expected a non-empty array"];
  let prevEnd = 0;
  cues.forEach((c, i) => {
    const where = `cue ${i + 1}`;
    if (typeof c.text !== "string" || c.text.trim() === "") problems.push(`${where}: empty text`);
    if (typeof c.start !== "number" || typeof c.end !== "number") {
      problems.push(`${where}: start and end must be numbers`);
      return;
    }
    if (c.end <= c.start) problems.push(`${where}: end must be after start`);
    if (c.start < prevEnd) problems.push(`${where}: overlaps the previous cue`);
    if (durationS !== undefined && c.end > durationS + 0.001) {
      problems.push(`${where}: ends at ${c.end}s, after the video (${durationS}s)`);
    }
    prevEnd = c.end;
  });
  return problems;
}

export function buildVtt(cues) {
  const body = cues
    .map((c, i) => `${i + 1}\n${vttTime(c.start)} --> ${vttTime(c.end)}\n${c.text}`)
    .join("\n\n");
  return `WEBVTT\n\n${body}\n`;
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/;

/**
 * Looks for personal data in a text output. `user` and `home` are the recorder's $USER and
 * $HOME; `secrets` are optional literal values to look for. Never matches a bare "@" (npm scopes and --help
 * text contain it legitimately). Returns human-readable findings that never include a secret.
 */
export function scanForLeaks(text, { user, home, secrets = [] } = {}) {
  const findings = [];
  if (EMAIL.test(text)) findings.push("an email address");
  if (/\bsk-ant-/.test(text)) findings.push("an sk-ant- key prefix");
  if (/\bsk-[A-Za-z0-9_-]/.test(text)) findings.push("an sk- key prefix");
  if (/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i.test(text)) findings.push("a session, thread or account id");
  if (/\beyJ[A-Za-z0-9_-]{10,}/.test(text) || /\bBearer\s+\S{8,}/.test(text)) findings.push("a token");
  // The throwaway recording home is /tmp/fm/home, which is fine to show.
  if (/\/(?:Users|home)\/[^\s/]+/.test(text.replaceAll("/tmp/fm/home", ""))) findings.push("a user home path");
  if (user && user.length > 2 && text.includes(user)) findings.push("the recorder's $USER");
  if (home && home.length > 1 && home !== "/" && text.includes(home)) findings.push("the recorder's $HOME");
  for (const s of secrets) {
    if (s && s.length >= 8 && text.includes(s)) findings.push("a literal secret value");
  }
  return findings;
}

export function sha256Bytes(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

export function sha256File(path) {
  return sha256Bytes(readFileSync(path));
}

/** "2.1.286 (Claude Code)" -> "2.1.286"; "codex-cli 0.154.0" -> "0.154.0". */
export function parseVersion(output) {
  const m = /(\d+\.\d+\.\d+(?:[-+][\w.]+)?)/.exec(output);
  return m ? m[1] : null;
}
