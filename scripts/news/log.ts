import type { Env } from "./env";
import fs from "node:fs";
import path from "node:path";
import { sanitize } from "./sanitize";
import { manilaTimestamp } from "./time";
import type { Logger } from "./types";

/**
 * Console logger with Manila-time ISO stamps. Under launchd, stdout/stderr already go to the log file; when
 * NEWS_LOG_DIR is set (tests, manual use) lines are also appended to `$NEWS_LOG_DIR/news.log`.
 * Everything is sanitised; never pass prompt bodies or item text to it.
 */
export function createLogger(env: Env = process.env, clock: () => Date = () => new Date()): Logger {
  const file = env.NEWS_LOG_DIR ? path.join(env.NEWS_LOG_DIR, "news.log") : null;
  if (file) fs.mkdirSync(path.dirname(file), { recursive: true });

  const write = (level: string, msg: string, stream: NodeJS.WriteStream) => {
    const line = `${manilaTimestamp(clock())} ${level} ${sanitize(msg, env)}\n`;
    stream.write(line);
    if (file) {
      try {
        fs.appendFileSync(file, line);
      } catch {
        // logging must never break a run
      }
    }
  };
  return {
    info: (m) => write("INFO", m, process.stdout),
    warn: (m) => write("WARN", m, process.stderr),
    error: (m) => write("ERROR", m, process.stderr),
  };
}

export const silentLogger: Logger = { info: () => undefined, warn: () => undefined, error: () => undefined };
