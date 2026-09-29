import { act, cleanup } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PROGRESS_STORAGE_KEY } from "@/lib/contracts";
import { emptyState, markComplete, useLessonCompletion } from "@/lib/progress";
import * as store from "@/lib/progress/store";

function Row() {
  const { hydrated, completed } = useLessonCompletion("l1-first-session");
  return <p data-testid="row">{!hydrated ? "…" : completed ? "Completed" : "Not started"}</p>;
}

beforeEach(() => {
  window.localStorage.clear();
  store.__resetProgressStoreForTests();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  store.__resetProgressStoreForTests();
});

describe("TC-D-33 hydration safety", () => {
  it("server HTML holds a placeholder, never a not-started or completed state", () => {
    const html = renderToString(<Row />);
    expect(html).toContain("…");
    expect(html).not.toMatch(/Not started|Completed/);
  });

  it("hydrates stored progress without hydration errors", async () => {
    window.localStorage.setItem(
      PROGRESS_STORAGE_KEY,
      JSON.stringify(markComplete(emptyState(), "l1-first-session", "2026-09-29T01:00:00.000Z")),
    );
    const html = renderToString(<Row />);
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await act(async () => {
      hydrateRoot(container, <Row />);
    });
    expect(error).not.toHaveBeenCalled();
    expect(container.textContent).toBe("Completed");
    container.remove();
  });
});
