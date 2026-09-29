import { createHash } from "node:crypto";

/** Strip a UTF-8 BOM, normalise CRLF/CR to LF and unicode to NFC so hashes never depend on the editor. */
export function normalizeText(raw: string): string {
  return raw.replace(/^﻿/, "").replace(/\r\n?/g, "\n").normalize("NFC");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Today-independent calendar check for YYYY-MM-DD (rejects 2026-02-30). */
export function isRealDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/** Calendar date (YYYY-MM-DD) of `now` in Asia/Manila, the timezone the whole product uses. */
export function manilaDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
