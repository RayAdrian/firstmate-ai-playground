// @vitest-environment node
import { writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NO_GITLEAKS_WARNING, scanFile } from "../../../scripts/workflows/scan-file";
import { tmpDir } from "./helpers";

function fileWith(text: string): string {
  const f = path.join(tmpDir(), "draft.md");
  writeFileSync(f, text);
  return f;
}

describe("scanFile", () => {
  it("warns and falls back to the built-in rules when gitleaks is not installed", async () => {
    const r = await scanFile(fileWith("fine\nbob@acme.io\n"), { gitleaks: async () => ({ status: "missing" }) });
    expect(r.warnings).toEqual([NO_GITLEAKS_WARNING]);
    expect(r.findings).toEqual([{ line: 2, rule: "email" }]);
  });

  it("merges gitleaks findings with the built-in ones, sorted by line", async () => {
    const report = JSON.stringify([{ RuleID: "generic-api-key", StartLine: 1 }]);
    const r = await scanFile(fileWith("a\nbob@acme.io\n"), { gitleaks: async () => ({ status: "ok", report }) });
    expect(r.warnings).toEqual([]);
    expect(r.findings).toEqual([
      { line: 1, rule: "gitleaks:generic-api-key" },
      { line: 2, rule: "email" },
    ]);
  });

  it("reports a gitleaks failure as a warning and still runs the built-in rules", async () => {
    const r = await scanFile(fileWith("10.1.1.1\n"), { gitleaks: async () => ({ status: "error", message: "gitleaks failed (2)" }) });
    expect(r.warnings[0]).toMatch(/gitleaks failed/);
    expect(r.findings).toEqual([{ line: 1, rule: "ipv4" }]);
  });

  it("can skip gitleaks entirely", async () => {
    const r = await scanFile(fileWith("clean\n"), { gitleaks: "off" });
    expect(r).toEqual({ findings: [], warnings: [] });
  });
});
