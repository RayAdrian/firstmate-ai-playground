import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// DESIGN.md §9 rubric checks that are cheap to enforce as text rules over src/ (B-3 and friends).
const SRC = path.resolve(__dirname, "../../../src");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return files(full);
    return /\.(tsx?|css)$/.test(name) ? [full] : [];
  });
}

const sources = files(SRC).map((file) => ({ file: path.relative(SRC, file), text: readFileSync(file, "utf8") }));

describe("design rubric text rules", () => {
  it("no arbitrary colours or Tailwind default palette in components and pages", () => {
    const offenders = sources.filter(
      ({ text, file }) => file !== "app/globals.css" && /(?:text|bg|border|ring|fill|stroke)-\[#[0-9a-fA-F]{3,8}\]/.test(text),
    );
    expect(offenders.map((o) => o.file)).toEqual([]);
  });

  it("never uses font-semibold (only 400/500/700 are loaded)", () => {
    expect(sources.filter(({ text }) => /font-semibold/.test(text)).map((o) => o.file)).toEqual([]);
  });

  it("never uses outline-none on interactive elements (the global :focus-visible ring owns focus)", () => {
    expect(
      sources.filter(({ text }) => /(?<![:\w-])outline-none/.test(text.replace(/focus-visible:outline-none/g, ""))).map((o) => o.file),
    ).toEqual([]);
  });

  it("globals.css imports the shared tokens and does not redefine the palette", () => {
    const css = sources.find((s) => s.file === "app/globals.css")?.text ?? "";
    expect(css).toContain('@import "../../docs/design/tokens.css"');
    expect(css).not.toMatch(/--fm-canvas\s*:/);
  });
});
