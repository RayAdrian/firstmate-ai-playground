import { describe, expect, it } from "vitest";
import { isNavActive, NAV_ITEMS } from "../../../src/components/ui/nav";

describe("WF-39 nav", () => {
  it("puts Workflows between Exercises and News", () => {
    const labels = NAV_ITEMS.map((i) => i.label);
    expect(labels).toEqual(["Curriculum", "Exercises", "Workflows", "News", "Bookmarks", "Progress"]);
    expect(NAV_ITEMS.find((i) => i.label === "Workflows")?.href).toBe("/workflows");
  });

  it("is active for /workflows and /workflows/*, and only there", () => {
    expect(isNavActive("/workflows", "/workflows")).toBe(true);
    expect(isNavActive("/workflows", "/workflows/plan-before-code")).toBe(true);
    expect(isNavActive("/workflows", "/workflowsx")).toBe(false);
    expect(isNavActive("/workflows", "/news")).toBe(false);
    expect(isNavActive("/news", "/workflows")).toBe(false);
    expect(isNavActive("/workflows", null)).toBe(false);
  });
});
