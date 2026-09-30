// @vitest-environment node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.setConfig({ testTimeout: 30_000 }); // process-spawning tests can be slow on a busy machine

const OPS = path.resolve(__dirname, "../../../ops/launchd");
const LABEL = "tech.firstmate.playground.news";
const isMac = process.platform === "darwin";

let home: string;
let bin: string;
let stubLog: string;

function makeBin(name: string, body: string) {
  const p = path.join(bin, name);
  fs.writeFileSync(p, `#!/bin/bash\n${body}\n`, { mode: 0o755 });
}

function run(script: string, opts: { withNode?: boolean; withClaude?: boolean; args?: string[] } = {}) {
  const { withNode = true, withClaude = true, args = [] } = opts;
  const dirs = [bin];
  const stubs = path.join(home, "stubs");
  fs.mkdirSync(stubs, { recursive: true });
  const link = (name: string, real: string) => {
    fs.rmSync(path.join(stubs, name), { force: true });
    fs.symlinkSync(real, path.join(stubs, name));
  };
  if (withNode) link("node", process.execPath);
  if (withClaude) makeBin("claude", "echo fake");
  const npmDir = path.join(home, "npmdir");
  fs.mkdirSync(npmDir, { recursive: true });
  fs.writeFileSync(path.join(npmDir, "npm"), "#!/bin/bash\necho fake\n", { mode: 0o755 });
  dirs.push(stubs, npmDir, "/usr/bin", "/bin", "/usr/sbin", "/sbin");
  return spawnSync("/bin/bash", [path.join(OPS, script), ...args], {
    env: { HOME: home, PATH: dirs.join(":"), FM_LAUNCHCTL: path.join(bin, "launchctl"), TMPDIR: os.tmpdir(), NODE_ENV: "test" },
    encoding: "utf8",
  });
}

const plistPath = () => path.join(home, "Library/LaunchAgents", `${LABEL}.plist`);
const stubCalls = () => (fs.existsSync(stubLog) ? fs.readFileSync(stubLog, "utf8").split("\n").filter(Boolean) : []);

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "news-launchd-"));
  bin = path.join(home, "bin");
  fs.mkdirSync(bin, { recursive: true });
  stubLog = path.join(home, "launchctl.log");
  makeBin("launchctl", `echo "$@" >> "${stubLog}"`);
});
afterEach(() => fs.rmSync(home, { recursive: true, force: true }));

describe.skipIf(!isMac)("launchd install/uninstall (I-5, TC-E-51..54)", () => {
  it("writes a valid plist with absolute PATH, hourly gated schedule and log paths", () => {
    const res = run("install.sh");
    expect(res.status, res.stderr).toBe(0);
    expect(spawnSync("plutil", ["-lint", plistPath()]).status).toBe(0);
    const json = JSON.parse(spawnSync("plutil", ["-convert", "json", "-o", "-", plistPath()], { encoding: "utf8" }).stdout) as Record<string, unknown>;
    expect(json.Label).toBe(LABEL);
    const args = json.ProgramArguments as string[];
    expect(path.isAbsolute(args[0])).toBe(true);
    expect(args.slice(1)).toEqual(["run", "news:run", "--", "--gate", "--publish"]);
    expect(path.isAbsolute(json.WorkingDirectory as string)).toBe(true);
    expect(fs.existsSync(path.join(json.WorkingDirectory as string, "package.json"))).toBe(true);
    expect(json.StartCalendarInterval).toEqual({ Minute: 0 });
    expect(json.RunAtLoad).toBe(true);
    const env = json.EnvironmentVariables as Record<string, string>;
    expect(env.NEWS_TRIGGER).toBe("schedule");
    const dirs = env.PATH.split(":");
    expect(dirs.every((d) => path.isAbsolute(d))).toBe(true);
    expect(env.PATH).not.toMatch(/[~$]/);
    expect(dirs).toContain(bin); // claude's directory
    expect(dirs).toContain(path.join(home, "stubs")); // node's directory
    expect(json.StandardOutPath).toBe(path.join(home, "Library/Logs/fm-playground/news.log"));
    expect(json.StandardErrorPath).toBe(path.join(home, "Library/Logs/fm-playground/news.log"));
    expect(fs.existsSync(path.join(home, "Library/Logs/fm-playground"))).toBe(true);
    expect(stubCalls().some((c) => c.startsWith("bootstrap gui/") && c.endsWith(`${LABEL}.plist`))).toBe(true);
  });

  it.each([
    ["claude", { withClaude: false }, /claude not found on PATH/],
    ["node", { withNode: false }, /node not found on PATH/],
  ])("fails loudly when %s is missing, writing nothing", (_n, opts, message) => {
    const res = run("install.sh", opts);
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(message);
    expect(fs.existsSync(plistPath())).toBe(false);
    expect(stubCalls()).toEqual([]);
  });

  it("names both when neither is available", () => {
    const res = run("install.sh", { withNode: false, withClaude: false });
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/node not found/);
    expect(res.stderr).toMatch(/claude not found/);
  });

  it("is idempotent (bootout precedes each bootstrap) and uninstall is safe", () => {
    expect(run("install.sh").status).toBe(0);
    expect(run("install.sh").status).toBe(0);
    const calls = stubCalls();
    expect(calls.map((c) => c.split(" ")[0])).toEqual(["bootout", "bootstrap", "bootout", "bootstrap"]);
    expect(fs.readdirSync(path.join(home, "Library/LaunchAgents"))).toEqual([`${LABEL}.plist`]);

    fs.writeFileSync(path.join(home, "Library/Logs/fm-playground/news.log"), "keep me\n");
    const u1 = run("uninstall.sh");
    expect(u1.status).toBe(0);
    expect(fs.existsSync(plistPath())).toBe(false);
    expect(fs.existsSync(path.join(home, "Library/Logs/fm-playground/news.log"))).toBe(true);
    const u2 = run("uninstall.sh");
    expect(u2.status).toBe(0);
    expect(u2.stdout).toMatch(/not installed/);
  });

  it("install --dry-run prints the plist, paths and commands and changes nothing", () => {
    const res = run("install.sh", { args: ["--dry-run"] });
    expect(res.status, res.stderr).toBe(0);
    expect(res.stdout).toContain("[dry-run]");
    expect(res.stdout).toContain(plistPath());
    expect(res.stdout).toMatch(/bootstrap gui\/\d+/);
    expect(res.stdout).toContain("<key>StartCalendarInterval</key>");
    expect(fs.existsSync(path.join(home, "Library"))).toBe(false);
    expect(stubCalls()).toEqual([]);
  });

  it("uninstall --dry-run removes nothing", () => {
    expect(run("install.sh").status).toBe(0);
    const calls = stubCalls().length;
    const res = run("uninstall.sh", { args: ["--dry-run"] });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("[dry-run]");
    expect(fs.existsSync(plistPath())).toBe(true);
    expect(stubCalls()).toHaveLength(calls);
  });

  it("rejects unknown flags", () => {
    expect(run("install.sh", { args: ["--dryrun"] }).status).not.toBe(0);
    expect(fs.existsSync(path.join(home, "Library"))).toBe(false);
  });

  it("uninstall on a clean HOME succeeds", () => {
    const res = run("uninstall.sh");
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/not installed/);
  });
});
