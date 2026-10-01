// @vitest-environment node
// Backlog: install.sh could bake a temporary `claude` shim path into the plist. It must skip or reject those.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const INSTALL = path.resolve(__dirname, "../../../ops/launchd/install.sh");
let home: string;

function stub(dir: string, name: string) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), "#!/bin/bash\necho fake\n", { mode: 0o755 });
}

function dryRun(dirs: string[], extraEnv: Record<string, string> = {}) {
  const stubs = path.join(home, "stubs");
  fs.mkdirSync(stubs, { recursive: true });
  fs.symlinkSync(process.execPath, path.join(stubs, "node"));
  stub(path.join(home, "npmdir"), "npm");
  return spawnSync("/bin/bash", [INSTALL, "--dry-run"], {
    env: { HOME: home, NODE_ENV: "test", PATH: [...dirs, stubs, path.join(home, "npmdir"), "/usr/bin", "/bin"].join(":"), ...extraEnv },
    encoding: "utf8",
  });
}

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "m2-install-"));
});
afterEach(() => fs.rmSync(home, { recursive: true, force: true }));

describe("ops/launchd/install.sh claude resolution", () => {
  it("rejects a claude that only exists in a temporary directory", () => {
    const tmpBin = path.join(fs.realpathSync(os.tmpdir()), `m2-shim-${process.pid}`);
    stub(tmpBin, "claude");
    try {
      const res = dryRun([tmpBin]);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/temporary directory/);
      expect(res.stdout).not.toContain(tmpBin);
    } finally {
      fs.rmSync(tmpBin, { recursive: true, force: true });
    }
  });

  it("skips a temporary shim and uses the real claude later on PATH", () => {
    const tmpBin = path.join(fs.realpathSync(os.tmpdir()), `m2-shim-${process.pid}`);
    stub(tmpBin, "claude");
    // "Real" installs live outside the temp dir: use a directory under the repo checkout.
    const realBin = path.resolve(__dirname, `../../../node_modules/.cache/m2-real-claude-${process.pid}`);
    stub(realBin, "claude");
    try {
      const res = dryRun([tmpBin, realBin]);
      expect(res.status).toBe(0);
      expect(res.stdout).toContain(`claude:      ${realBin}/claude`);
      expect(res.stdout).not.toContain(`${tmpBin}/claude`);
    } finally {
      fs.rmSync(tmpBin, { recursive: true, force: true });
      fs.rmSync(realBin, { recursive: true, force: true });
    }
  });

  it("FM_ALLOW_TEMP_BIN=1 keeps the installer tests' temp shims working", () => {
    const shim = path.join(home, "bin");
    stub(shim, "claude");
    const res = dryRun([shim], { FM_ALLOW_TEMP_BIN: "1" });
    expect(res.status).toBe(0);
  });
});
