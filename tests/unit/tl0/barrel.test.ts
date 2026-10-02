// @vitest-environment node
// The contracts barrel is imported by client components, so no module it re-exports may import a node: module
// (node:crypto alone pulled a ~231 KB gzip polyfill into every page). Server-only helpers are imported directly.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const dir = path.resolve(__dirname, "../../../src/lib/contracts");

describe("src/lib/contracts barrel", () => {
  const reexports = [...fs.readFileSync(path.join(dir, "index.ts"), "utf8").matchAll(/from\s+"\.\/([\w-]+)"/g)].map(
    (m) => m[1]!,
  );

  it("re-exports at least the known modules", () => {
    expect(reexports).toContain("lesson");
  });

  it.each(reexports)("%s imports no node: module and no node builtin", (name) => {
    const src = fs.readFileSync(path.join(dir, `${name}.ts`), "utf8");
    expect(src).not.toMatch(/from\s+["']node:/);
    expect(src).not.toMatch(/from\s+["'](fs|path|crypto|os|child_process)["']/);
  });

  it("does not re-export tldr-hash", () => {
    expect(reexports).not.toContain("tldr-hash");
  });
});
