import fs from "node:fs";
import path from "node:path";
import { digestDate, manilaHour } from "./time";

/** Local marker: the Manila date and status of the last completed scheduled run. */
interface Marker {
  digest_date: string;
  status: "success" | "partial" | "failed";
}

/**
 * The launchd agent fires hourly and every firing asks this gate whether to run. It opens at or after 08:00
 * Asia/Manila once per Manila day, and keeps retrying each hour until a run ends success or partial (so a
 * mid-morning `supabase start` or a late wake still produces today's digest). See ops/launchd/README.md.
 */
export function gateDecision(markerPath: string, at: Date): { run: boolean; reason: string } {
  if (manilaHour(at) < 8) return { run: false, reason: "before 08:00 Asia/Manila" };
  try {
    const m = JSON.parse(fs.readFileSync(markerPath, "utf8")) as Partial<Marker>;
    if (m.digest_date === digestDate(at) && (m.status === "success" || m.status === "partial")) {
      return { run: false, reason: `already ran today (${m.status})` };
    }
  } catch {
    // no marker or unreadable: run
  }
  return { run: true, reason: "due" };
}

export function recordScheduledRun(markerPath: string, status: Marker["status"], at: Date): void {
  fs.mkdirSync(path.dirname(markerPath), { recursive: true });
  fs.writeFileSync(markerPath, JSON.stringify({ digest_date: digestDate(at), status } satisfies Marker));
}
