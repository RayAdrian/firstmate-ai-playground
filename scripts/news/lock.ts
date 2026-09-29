import fs from "node:fs";
import path from "node:path";

export const LOCK_MAX_AGE_MS = 30 * 60_000;

export type LockResult = { acquired: true; removedStale: boolean; release: () => void } | { acquired: false; holderPid: number | null };

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

function isStale(file: string, maxAgeMs: number): boolean {
  try {
    const info = JSON.parse(fs.readFileSync(file, "utf8")) as { pid?: unknown; startedAt?: unknown };
    if (typeof info.pid !== "number" || typeof info.startedAt !== "string") return true;
    if (Date.now() - new Date(info.startedAt).getTime() > maxAgeMs) return true;
    return !pidAlive(info.pid);
  } catch {
    return true;
  }
}

/**
 * Exclusive run lock (I-4.5). Created with O_EXCL so two processes cannot both win. A lock whose pid is dead,
 * older than the max age, or unreadable is stale and is taken over, otherwise every future run would be skipped.
 */
export function acquireLock(file: string, options: { maxAgeMs?: number } = {}): LockResult {
  const maxAgeMs = options.maxAgeMs ?? LOCK_MAX_AGE_MS;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let removedStale = false;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = fs.openSync(file, "wx");
      fs.writeSync(fd, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
      fs.closeSync(fd);
      let released = false;
      return {
        acquired: true,
        removedStale,
        release: () => {
          if (released) return;
          released = true;
          try {
            fs.unlinkSync(file);
          } catch {
            // already gone
          }
        },
      };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      if (attempt === 0 && isStale(file, maxAgeMs)) {
        try {
          fs.unlinkSync(file);
          removedStale = true;
        } catch {
          // someone else removed it; retry the create
        }
        continue;
      }
      let holderPid: number | null = null;
      try {
        holderPid = (JSON.parse(fs.readFileSync(file, "utf8")) as { pid?: number }).pid ?? null;
      } catch {
        // ignore
      }
      return { acquired: false, holderPid };
    }
  }
  return { acquired: false, holderPid: null };
}
