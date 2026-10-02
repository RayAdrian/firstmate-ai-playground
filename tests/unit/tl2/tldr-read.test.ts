import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readMediaIds } from "../../../scripts/workflows/load";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/db", () => ({ dbRead: async (x: unknown) => x }));
vi.mock("@/lib/db/server", () => ({ getReadClient: () => ({}) }));
vi.mock("@/lib/time/now", () => ({ getNow: async () => new Date(), manilaDate: () => "2026-10-01" }));

import { parseStoredTldr } from "@/components/lesson/server/queries";

describe("parseStoredTldr (TL-3)", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => errorSpy.mockRestore());

  const valid = {
    points: ["Point number one is here.", "Point number two is here.", "Point number three is here."],
    try_this: { all: { kind: "command", text: "claude --version" } },
  };

  it("passes a valid value through and null as null, silently", () => {
    expect(parseStoredTldr("l1-x", valid)?.points).toHaveLength(3);
    expect(parseStoredTldr("l1-x", null)).toBeNull();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("reads an invalid stored value as null and logs the slug", () => {
    expect(parseStoredTldr("l1-bad", { ...valid, points: ["only one point here"] })).toBeNull();
    expect(parseStoredTldr("l1-bad2", "not an object")).toBeNull();
    expect(String(errorSpy.mock.calls[0]![0])).toContain("l1-bad");
    expect(errorSpy).toHaveBeenCalledTimes(2);
  });
});

describe("readMediaIds excludes kind tldr (TL-16, workflow watch links)", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), "fm-tldr-ids-"));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("lists the section 15 item and not the tldr", () => {
    const dir = path.join(root, "l1-first-session");
    mkdirSync(dir, { recursive: true });
    const base = {
      lesson_slug: "l1-first-session",
      duration_s: 5,
      width: 1280,
      height: 720,
      tool_versions: { claude_code: "2.1.0" },
      made_on: "2026-10-01",
      model_calls: false,
      source_hash: "h",
    };
    writeFileSync(
      path.join(dir, "demo.media.json"),
      JSON.stringify({ ...base, id: "demo", kind: "animation", title: "Demo" }),
    );
    writeFileSync(
      path.join(dir, "tldr.media.json"),
      JSON.stringify({ ...base, id: "tldr", kind: "tldr", title: "TL;DR: x", template_version: 1 }),
    );
    expect(readMediaIds(root, new Set(["l1-first-session"]))).toEqual(["l1-first-session/demo"]);
  });
});
