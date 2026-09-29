// @vitest-environment node
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const run = (sha: string) =>
  spawnSync("bash", ["scripts/gate-status.sh", "1", "review", "failure", sha, "d"], {
    encoding: "utf8",
  });

describe("scripts/gate-status.sh sha validation", () => {
  it.each(["main", "feat/x", "abc1234", "A".repeat(40), "a".repeat(39), "a".repeat(41), "g".repeat(40)])(
    "rejects %s before touching GitHub",
    (sha) => {
      const r = run(sha);
      expect(r.status).toBe(2);
      expect(r.stderr).toMatch(/40-character lowercase hex/);
    },
  );
});
