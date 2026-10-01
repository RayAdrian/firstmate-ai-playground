// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(path.resolve(__dirname, "../../..", p), "utf8");

describe("CI wiring for the content lane (WF-20)", () => {
  const content = parse(read(".github/workflows/workflows-content.yml"));
  const ci = parse(read(".github/workflows/ci.yml"));
  const text = read(".github/workflows/workflows-content.yml");

  it("runs on workflows PRs and on push to main, with only validate and gitleaks jobs", () => {
    expect(content.on.pull_request.paths).toEqual(["content/workflows/**"]);
    expect(content.on.push.branches).toEqual(["main"]);
    expect(Object.keys(content.jobs).sort()).toEqual(["gitleaks", "validate"]);
  });

  it("validate runs workflows:validate", () => {
    expect(JSON.stringify(content.jobs.validate.steps)).toContain("npm run workflows:validate");
  });

  it("gitleaks uses a pinned CLI binary over the commit range, not the Action, and has no client-name denylist", () => {
    expect(text).toMatch(/GITLEAKS_VERSION: \d+\.\d+\.\d+/);
    expect(text).not.toMatch(/gitleaks\/gitleaks-action/);
    expect(text).toContain("fetch-depth: 0");
    expect(text).toContain("--log-opts");
    expect(text).toContain("sha256sum -c");
    expect(text.toLowerCase()).not.toMatch(/denylist|client[-_ ]names?\.txt/);
  });

  it("ci.yml ignores workflows-only PRs but still runs on push to main", () => {
    expect(ci.on.pull_request["paths-ignore"]).toEqual(["content/workflows/**"]);
    expect(ci.on.push.branches).toEqual(["main"]);
    expect(ci.on.push["paths-ignore"]).toBeUndefined();
  });

  it("ci.yml checks that the two skill copies are byte-identical (WF-14)", () => {
    expect(JSON.stringify(ci.jobs.checks.steps)).toContain("cmp ");
  });
});

describe("package.json workflow scripts", () => {
  const scripts = JSON.parse(read("package.json")).scripts as Record<string, string>;
  it.each(["workflows:validate", "workflows:scan", "workflows:share"])("defines %s", (name) => {
    expect(scripts[name]).toMatch(/^tsx scripts\/workflows\//);
  });
});
