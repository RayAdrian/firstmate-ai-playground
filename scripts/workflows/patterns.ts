// Shared patterns for the redaction (redact.ts) and the scan (scan-rules.ts). Pure; no I/O.

/** Hosts a workflow may mention as-is: this repo's host, package registry, reserved example domains and the tool vendors' sites. */
export const ALLOWED_HOSTS = [
  "github.com",
  "githubusercontent.com",
  "npmjs.com",
  "example.com",
  "example.org",
  "example.net",
  "anthropic.com",
  "claude.com",
  "claude.ai",
  "openai.com",
] as const;

/** Host equals an allowed host or is a subdomain of one. `github.com.evil.io` and `notgithub.com` are not. */
export function isAllowedHost(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, "");
  return ALLOWED_HOSTS.some((a) => h === a || h.endsWith(`.${a}`));
}

/** TLDs that make a bare `a.b` token a hostname. Deliberately not file extensions (md, ts, js, json, sh, py, rs...). */
const TLDS = "com|net|org|io|co|dev|app|ai|cloud|internal|corp|local|lan|intranet|xyz|tech|site|online|biz|info|us|uk|ph";

export const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
/** A hostname inside a URL (`scheme://[user@]host`). Group 1 is the host. */
export const URL_HOST_RE = /\b[a-z][a-z0-9+.-]*:\/\/(?:[^\s/@]*@)?([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)/g;
/** A bare hostname with a known TLD, not part of a path, an address or a longer word. */
export const BARE_HOST_RE = new RegExp(String.raw`(?<![\w./@:-])(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+(?:${TLDS})(?![\w-]|\.[A-Za-z0-9])`, "gi");
export const IPV4_RE = /(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?![\d]|\.\d)/g;
/** `/Users/<name>/` or `/home/<name>/`, not preceded by a path character. */
export const HOME_PATH_RE = /(?<![\w.~])\/(?:Users|home)\/[^/\s"'`]+\//g;

/** Emails at an allowed host with these local parts are conventions (`git@github.com:`, `noreply@anthropic.com`), not people. */
const CONVENTIONAL_LOCAL_PARTS = new Set(["git", "noreply", "no-reply"]);

/** True for an email that should be reported or rewritten: any address outside example.com, except conventional ones. */
export function isPrivateEmail(email: string): boolean {
  const at = email.lastIndexOf("@");
  const local = email.slice(0, at).toLowerCase();
  const domain = email.slice(at + 1).toLowerCase();
  if (domain === "example.com") return false;
  if (CONVENTIONAL_LOCAL_PARTS.has(local) && isAllowedHost(domain)) return false;
  return true;
}

/** True for an IPv4 that should be reported or rewritten: valid octets, not loopback, not 0.0.0.0, not the documentation range. */
export function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p > 255)) return false;
  if (parts[0] === 127) return false;
  if (parts.every((p) => p === 0)) return false;
  if (parts[0] === 203 && parts[1] === 0 && parts[2] === 113) return false;
  return true;
}
