import { cpSync, existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { automationCoverage, verifyExercises } from "../../../scripts/exercises/lib";
import { contentSandbox } from "./helpers";

describe("verifyExercises", () => {
  it("passes when starters fail and solutions pass (TC-B-37)", async () => {
    const sb = contentSandbox();
    const before = readFileSync(path.join(sb.exercisesDir, "ex-fx-auto/starter/add.js"), "utf8");
    const r = await verifyExercises({ exercisesDir: sb.exercisesDir, timeoutMs: 30_000 });
    expect(r.ok).toBe(true);
    const auto = r.results.find((x) => x.slug === "ex-fx-auto");
    expect(auto).toMatchObject({ status: "ok", starter: "fail", solution: "pass" });
    expect(r.results.find((x) => x.slug === "ex-fx-manual")).toMatchObject({ status: "manual" });
    expect(r.lines.join("\n")).toContain("ex-fx-auto: starter FAIL (expected), solution PASS");
    expect(r.lines.join("\n")).toContain("ex-fx-manual: manual (skipped)");
    // ran in a temp copy: the source tree is untouched and left no node_modules/tmp files
    expect(readFileSync(path.join(sb.exercisesDir, "ex-fx-auto/starter/add.js"), "utf8")).toBe(before);
    expect(readdirSync(path.join(sb.exercisesDir, "ex-fx-auto/starter")).sort()).toEqual(["add.js", "package.json", "test.js"]);
  }, 60_000);

  it("fails when a starter already passes but keeps checking others (TC-B-38)", async () => {
    const sb = contentSandbox();
    cpSync(path.join(sb.exercisesDir, "ex-fx-auto/solution"), path.join(sb.exercisesDir, "ex-fx-auto/starter"), { recursive: true });
    const r = await verifyExercises({ exercisesDir: sb.exercisesDir, timeoutMs: 30_000 });
    expect(r.ok).toBe(false);
    expect(r.results.find((x) => x.slug === "ex-fx-auto")).toMatchObject({ status: "error", starter: "pass" });
    expect(r.lines.join("\n")).toMatch(/ex-fx-auto: starter exited 0 but must fail/);
    expect(r.results.find((x) => x.slug === "ex-fx-manual")?.status).toBe("manual");
  }, 60_000);

  it("fails when a solution fails and prints the output tail (TC-B-39)", async () => {
    const sb = contentSandbox();
    sb.write("exercises/ex-fx-auto/solution/test.js", 'throw new Error("solution is broken");\n');
    const r = await verifyExercises({ exercisesDir: sb.exercisesDir, timeoutMs: 30_000 });
    expect(r.ok).toBe(false);
    const text = r.lines.join("\n");
    expect(text).toMatch(/ex-fx-auto: solution failed/);
    expect(text).toContain("solution is broken");
  }, 60_000);

  it("times out a hanging command (TC-B-40)", async () => {
    const sb = contentSandbox();
    sb.edit("exercises/ex-fx-auto/exercise.json", (t) =>
      t.replace('"verify": "npm test"', `"verify": "node -e \\"setInterval(()=>{},1000)\\""`),
    );
    const started = Date.now();
    const r = await verifyExercises({ exercisesDir: sb.exercisesDir, timeoutMs: 1500 });
    expect(Date.now() - started).toBeLessThan(15_000);
    expect(r.ok).toBe(false);
    expect(r.results.find((x) => x.slug === "ex-fx-auto")).toMatchObject({ status: "error", starter: "timeout" });
    expect(r.lines.join("\n")).toMatch(/timed out/);
  }, 30_000);

  it("treats a starter install failure as an error, not the expected failure (B2)", async () => {
    const sb = contentSandbox();
    sb.write(
      "exercises/ex-fx-auto/starter/package.json",
      JSON.stringify({ name: "x", private: true, dependencies: { "fm-nonexistent-pkg-zzz": "9.9.9" }, scripts: { test: "true" } }),
    );
    sb.edit("exercises/ex-fx-auto/exercise.json", (t) => t.replace('"verify": "npm test"', '"verify": "true"'));
    const r = await verifyExercises({ exercisesDir: sb.exercisesDir, timeoutMs: 60_000, only: ["ex-fx-auto"] });
    expect(r.ok).toBe(false);
    expect(r.results[0]).toMatchObject({ status: "error" });
    expect(r.lines.join("\n")).toMatch(/starter setup failed/);
    expect(r.lines.join("\n")).not.toMatch(/starter FAIL \(expected\)/);
  }, 90_000);

  it("runs verify without *_API_KEY variables (TC-B-43)", async () => {
    const sb = contentSandbox();
    sb.write("exercises/ex-fx-auto/solution/test.js", 'if (Object.keys(process.env).some((k) => k.endsWith("_API_KEY"))) throw new Error("key leaked");\n');
    sb.write("exercises/ex-fx-auto/starter/test.js", "throw new Error('starter fails');\n");
    const r = await verifyExercises({
      exercisesDir: sb.exercisesDir,
      timeoutMs: 30_000,
      env: { ...process.env, OPENAI_API_KEY: "sk-test", ANTHROPIC_API_KEY: "sk-test" },
    });
    expect(r.results.find((x) => x.slug === "ex-fx-auto")).toMatchObject({ status: "ok" });
  }, 60_000);

  it("tolerates a missing exercises directory", async () => {
    const r = await verifyExercises({ exercisesDir: "/nonexistent/exercises", timeoutMs: 1000 });
    expect(r.ok).toBe(true);
    expect(r.results).toEqual([]);
  });

  it("can be limited to named slugs", async () => {
    const sb = contentSandbox();
    const r = await verifyExercises({ exercisesDir: sb.exercisesDir, timeoutMs: 30_000, only: ["ex-fx-manual"] });
    expect(r.results.map((x) => x.slug)).toEqual(["ex-fx-manual"]);
    expect(existsSync(sb.exercisesDir)).toBe(true);
  });
});

describe("automationCoverage (TC-B-42)", () => {
  const make = (auto: number, total: number) =>
    Array.from({ length: total }, (_, i) => (i < auto ? "npm test" : "manual"));

  it("fails at 11/19, passes at 12/19 and 19/19", () => {
    expect(automationCoverage(make(11, 19)).ok).toBe(false);
    expect(automationCoverage(make(12, 19)).ok).toBe(true);
    expect(automationCoverage(make(19, 19)).ok).toBe(true);
  });

  it("only warns before all 19 exercises exist", () => {
    const c = automationCoverage(make(2, 6));
    expect(c.ok).toBe(true);
    expect(c.enforced).toBe(false);
    expect(c.message).toMatch(/2 of 6/);
  });
});
