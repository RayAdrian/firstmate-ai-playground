// @vitest-environment node
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { useLessonCompletion } from "@/lib/progress";
import { getSnapshot, updateProgress } from "@/lib/progress/store";

function Row() {
  const { hydrated, completed } = useLessonCompletion("l1-first-session");
  return <p>{hydrated ? (completed ? "done" : "todo") : "placeholder"}</p>;
}

describe("TC-D-24 server environment", () => {
  it("has no window", () => {
    expect(typeof window).toBe("undefined");
  });

  it("renders the placeholder without touching localStorage", () => {
    expect(renderToString(<Row />)).toContain("placeholder");
  });

  it("ignores mutations on the server", () => {
    expect(() => updateProgress((s) => s)).not.toThrow();
    expect(getSnapshot().hydrated).toBe(false);
  });
});
