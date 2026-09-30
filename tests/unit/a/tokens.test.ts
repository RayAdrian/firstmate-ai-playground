import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// DESIGN.md §2.4 contrast ledger as a regression gate: parses docs/design/tokens.css and asserts every pair.
const css = readFileSync(path.resolve(__dirname, "../../../docs/design/tokens.css"), "utf8");

function block(source: string, startMarker: string): string {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`marker not found: ${startMarker}`);
  let depth = 0;
  for (let i = source.indexOf("{", start); i < source.length; i++) {
    if (source[i] === "{") depth++;
    if (source[i] === "}" && --depth === 0) return source.slice(source.indexOf("{", start) + 1, i);
  }
  throw new Error("unbalanced braces");
}

function vars(section: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of section.matchAll(/--fm-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\b/g)) out[m[1]] = m[2].toLowerCase();
  return out;
}

const light = vars(block(css, ":root {"));
const dark = { ...light, ...vars(block(block(css, "@media (prefers-color-scheme: dark)"), ":root {")) };

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(fg: string, bg: string): number {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

type Row = [fg: string, bg: string, ratio: number, need: number];

// [foreground token, background token, ratio (2 dp) from the ledger, minimum]
const LIGHT: Row[] = [
  ["fg", "canvas", 14.11, 4.5],
  ["fg", "surface", 13.4, 4.5],
  ["fg", "accent-soft", 12.13, 4.5],
  ["fg-strong", "canvas", 18.58, 4.5],
  ["fg-muted", "canvas", 6.22, 4.5],
  ["fg-muted", "surface", 5.91, 4.5],
  ["fg-muted", "accent-soft", 5.35, 4.5],
  ["fg-muted", "border-subtle", 5.46, 4.5],
  ["link", "canvas", 6.65, 4.5],
  ["link", "surface", 6.31, 4.5],
  ["link", "accent-soft", 5.72, 4.5],
  ["link", "accent-subtle", 6.17, 4.5],
  ["primary-fg", "primary", 6.65, 4.5],
  ["primary-fg", "primary-hover", 8.66, 4.5],
  ["canvas", "danger", 6.24, 4.5],
  ["success", "success-soft", 5.48, 4.5],
  ["success", "surface", 5.84, 4.5],
  ["warning", "warning-soft", 5.76, 4.5],
  ["danger", "danger-soft", 5.44, 4.5],
  ["danger", "canvas", 6.24, 4.5],
  ["fg", "success-soft", 12.57, 4.5],
  ["fg", "warning-soft", 12.98, 4.5],
  ["fg", "danger-soft", 12.31, 4.5],
  ["accent-2", "canvas", 3.33, 3],
  ["code-fg", "code-bg", 15.13, 4.5],
  ["code-muted", "code-bg", 7.09, 4.5],
  ["code-muted", "code-header-bg", 6.4, 4.5],
  ["code-fg", "code-header-bg", 13.65, 4.5],
  ["control-border", "canvas", 3.27, 3],
  ["control-border", "surface", 3.11, 3],
  ["focus", "canvas", 6.65, 3],
  ["focus", "surface", 6.31, 3],
  ["code-focus", "code-bg", 7.92, 3],
  ["code-focus", "code-header-bg", 7.14, 3],
  ["progress-fill", "progress-track", 5.23, 3],
];

const DARK: Row[] = [
  ["fg", "canvas", 15.82, 4.5],
  ["fg", "surface", 14.43, 4.5],
  ["fg", "surface-raised", 12.89, 4.5],
  ["fg", "accent-soft", 13.69, 4.5],
  ["fg-strong", "canvas", 18.44, 4.5],
  ["fg-muted", "canvas", 7.68, 4.5],
  ["fg-muted", "surface", 7.01, 4.5],
  ["fg-muted", "surface-raised", 6.26, 4.5],
  ["fg-muted", "accent-soft", 6.64, 4.5],
  ["link", "canvas", 8.17, 4.5],
  ["link", "surface", 7.45, 4.5],
  ["link", "surface-raised", 6.66, 4.5],
  ["link", "accent-soft", 7.07, 4.5],
  ["primary-fg", "primary", 6.65, 4.5],
  ["primary-fg", "primary-hover", 4.93, 4.5],
  ["success", "success-soft", 8.44, 4.5],
  ["success", "surface", 9.19, 4.5],
  ["warning", "warning-soft", 8.77, 4.5],
  ["danger", "danger-soft", 7.89, 4.5],
  ["danger", "canvas", 8.92, 4.5],
  ["fg", "success-soft", 13.27, 4.5],
  ["fg", "warning-soft", 13.45, 4.5],
  ["fg", "danger-soft", 13.99, 4.5],
  ["accent-2", "canvas", 7.62, 3],
  ["code-fg", "code-bg", 16.17, 4.5],
  ["code-muted", "code-bg", 7.57, 4.5],
  ["code-muted", "code-header-bg", 6.85, 4.5],
  ["code-fg", "code-header-bg", 14.63, 4.5],
  ["code-focus", "code-header-bg", 7.66, 3],
  ["link", "accent-subtle", 7.53, 4.5],
  ["fg-muted", "border-subtle", 6.31, 4.5],
  ["control-border", "canvas", 4.68, 3],
  ["control-border", "surface", 4.27, 3],
  ["control-border", "surface-raised", 3.82, 3],
  ["focus", "canvas", 8.17, 3],
  ["focus", "surface", 7.45, 3],
  ["focus", "surface-raised", 6.66, 3],
  ["progress-fill", "progress-track", 5.8, 3],
];

describe("tokens.css brand values", () => {
  it("keeps the PRD brand colours", () => {
    expect(light.fg).toBe("#282943");
    expect(light["fg-strong"]).toBe("#131313");
    expect(light.link).toBe("#424bd1");
    expect(light["accent-2"]).toBe("#ec612a");
    expect(light.surface).toBe("#f9f9f9");
    expect(light["border-subtle"]).toBe("#f0f0f0");
    expect(light.border).toBe("#e4e4e4");
    expect(light.divider).toBe("#e8e8e8");
  });

  it("never uses the brand date grey (#8e8e8f) as a text colour", () => {
    expect(light["fg-muted"]).not.toBe("#8e8e8f");
    expect(dark["fg-muted"]).not.toBe("#8e8e8f");
    // It survives only as the non-text control boundary.
    expect(light["control-border"]).toBe("#8e8e8f");
  });
});

describe("contrast ledger (DESIGN.md §2.4)", () => {
  for (const [scheme, tokens, rows] of [
    ["light", light, LIGHT],
    ["dark", dark, DARK],
  ] as const) {
    describe(scheme, () => {
      it.each(rows)("%s on %s = %s (needs %s)", (fg, bg, expected, need) => {
        const ratio = contrastRatio(tokens[fg], tokens[bg]);
        expect(ratio).toBeGreaterThanOrEqual(need);
        expect(Math.abs(ratio - expected)).toBeLessThan(0.011);
      });
    });
  }

  it("syntax colours (github-dark, comment overridden) pass 4.5:1 on both code backgrounds", () => {
    const syntax = ["#f97583", "#9ecbff", "#b392f0", "#79b8ff", "#e1e4e8", "#ffab70", "#85e89d", "#9aa4b2"];
    for (const tokens of [light, dark]) {
      for (const color of syntax) expect(contrastRatio(color, tokens["code-bg"])).toBeGreaterThanOrEqual(4.5);
    }
    // The stock github-dark comment colour is what the override exists to avoid.
    expect(contrastRatio("#6a737d", light["code-bg"])).toBeLessThan(4.5);
  });
});
