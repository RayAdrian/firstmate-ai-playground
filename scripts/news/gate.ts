import fs from "node:fs";
import path from "node:path";
import { digestDate, manilaHour } from "./time";

/** Manila hour at which the daily digest gate opens. Changed from 08:00 by the owner on 2026-10-02. */
export const GATE_OPEN_HOUR_MANILA = 7;
const GATE_LABEL = `${String(GATE_OPEN_HOUR_MANILA).padStart(2, "0")}:00`;

/** Local marker: the Manila date and status of the last completed scheduled run. */
interface Marker {
  digest_date: string;
  status: "success" | "partial" | "failed";
}

/**
 * The launchd agent fires hourly and every firing asks this gate whether to run. It opens at or after 07:00
 * Asia/Manila once per Manila day, and keeps retrying each hour until a run ends success or partial (so a
 * mid-morning `supabase start` or a late wake still produces today's digest). See ops/launchd/README.md.
 */
export function gateDecision(markerPath: string, at: Date): { run: boolean; reason: string } {
  if (manilaHour(at) < GATE_OPEN_HOUR_MANILA) return { run: false, reason: `before ${GATE_LABEL} Asia/Manila` };
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
