export class InvalidUrlError extends Error {
  constructor(input: string) {
    super(`Invalid or unsupported url: ${input.slice(0, 200)}`);
    this.name = "InvalidUrlError";
  }
}

/** Exact query parameter names that are tracking noise (utm_* handled by prefix). */
const STRIP_PARAMS = new Set(["ref", "fbclid", "gclid"]);

/**
 * PRD I-2.1 canonical form: lowercase (punycode) host, default port dropped, `utm_*`/`ref`/`fbclid`/`gclid`
 * stripped, fragment dropped, trailing slash dropped (including the root). Param order is preserved;
 * scheme and `www.` are kept as-is. Pure and idempotent.
 */
export function canonicalize(input: string): string {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new InvalidUrlError(input);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new InvalidUrlError(input);

  url.hash = "";
  url.username = "";
  url.password = "";
  // Filter the raw pairs so untouched params keep their original encoding and order.
  const keptRaw = url.search
    .replace(/^\?/, "")
    .split("&")
    .filter(Boolean)
    .filter((pair) => {
      const key = decodeSafe(pair.split("=")[0]);
      return !(key.startsWith("utm_") || STRIP_PARAMS.has(key));
    });
  const search = keptRaw.length > 0 ? `?${keptRaw.join("&")}` : "";

  let path = url.pathname.replace(/\/+$/, "");
  if (path === "/") path = "";
  return `${url.protocol}//${url.host}${path}${search}`;
}

function decodeSafe(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, " "));
  } catch {
    return s;
  }
}
