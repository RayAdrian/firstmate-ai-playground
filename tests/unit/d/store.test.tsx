import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PROGRESS_STORAGE_KEY, progressStateSchema } from "@/lib/contracts";
import {
  ProgressNotices,
  emptyState,
  markComplete,
  useBookmark,
  useChecklist,
  useLessonCompletion,
  useProgressStatus,
  useTrackLastViewed,
  useToolPref,
} from "@/lib/progress";
import * as store from "@/lib/progress/store";

const KEY = PROGRESS_STORAGE_KEY;
const oneComplete = JSON.stringify(markComplete(emptyState(), "l1-first-session", "2026-09-29T01:00:00.000Z"));

function stored() {
  const raw = window.localStorage.getItem(KEY);
  return raw === null ? null : JSON.parse(raw);
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

function Probe({ slug = "l1-first-session" }: { slug?: string }) {
  const c = useLessonCompletion(slug);
  const s = useProgressStatus();
  return (
    <div>
      <span data-testid="state">{c.hydrated ? (c.completed ? "done" : "todo") : "placeholder"}</span>
      <span data-testid="avail">{String(s.storageAvailable)}</span>
      <button onClick={c.markComplete}>complete</button>
      <button onClick={c.undo}>undo</button>
    </div>
  );
}

describe("persistence and no-write-on-read (TC-D-10, TC-D-13)", () => {
  it("reads stored progress after mount and does not write", () => {
    window.localStorage.setItem(KEY, oneComplete);
    const spy = vi.spyOn(Storage.prototype, "setItem");
    render(<Probe />);
    expect(screen.getByTestId("state")).toHaveTextContent("done");
    // Only the transient write probe may write; the progress key itself is untouched.
    expect(spy.mock.calls.filter(([key]) => key === KEY)).toEqual([]);
  });

  it("writes the contract shape on mutation and undo removes the entry", () => {
    render(<Probe />);
    expect(screen.getByTestId("state")).toHaveTextContent("todo");
    act(() => screen.getByText("complete").click());
    expect(progressStateSchema.safeParse(stored()).success).toBe(true);
    expect(stored().lessons["l1-first-session"].completedAt).toMatch(/Z$/);
    act(() => screen.getByText("undo").click());
    expect(stored().lessons).toEqual({});
  });
});

describe("corruption (TC-D-14, 15, 17, 19)", () => {
  const variants = [
    '{"version":1,',
    '{"version":1,"lessons":"nope"}',
    "42",
    "[]",
    '"just a string"',
    "{}",
    JSON.stringify({ ...emptyState(), prefs: { tool: "vim" } }),
    "x".repeat(1024 * 1024),
  ];
  for (const raw of variants) {
    it(`resets ${raw.slice(0, 30)}... and shows the notice`, () => {
      window.localStorage.setItem(KEY, raw);
      render(
        <>
          <ProgressNotices />
          <Probe />
        </>,
      );
      expect(screen.getByRole("status")).toHaveTextContent(
        "Saved progress was unreadable and has been reset",
      );
      expect(screen.getByTestId("state")).toHaveTextContent("todo");
      expect(progressStateSchema.safeParse(stored()).success).toBe(true);
    });
  }

  it("dismisses, and does not show again after a remount", () => {
    window.localStorage.setItem(KEY, "{bad");
    render(
      <>
        <h1>Page</h1>
        <ProgressNotices />
      </>,
    );
    act(() => screen.getByRole("button", { name: "Dismiss" }).click());
    expect(screen.queryByRole("status")).toBeNull();
    cleanup();
    store.__resetProgressStoreForTests();
    render(<ProgressNotices />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("does not raise the notice for a valid write afterwards", () => {
    window.localStorage.setItem(KEY, "{bad");
    render(
      <>
        <ProgressNotices />
        <Probe />
      </>,
    );
    act(() => screen.getByRole("button", { name: "Dismiss" }).click());
    act(() => screen.getByText("complete").click());
    cleanup();
    store.__resetProgressStoreForTests();
    render(
      <>
        <ProgressNotices />
        <Probe />
      </>,
    );
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByTestId("state")).toHaveTextContent("done");
  });
});

describe("storage unavailable (TC-D-20..23)", () => {
  it("survives getItem throwing SecurityError: banner, and controls work in memory", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    render(
      <>
        <ProgressNotices />
        <Probe />
      </>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Progress can't be saved in this browser");
    expect(screen.queryByText(/unreadable/)).toBeNull();
    act(() => screen.getByText("complete").click());
    expect(screen.getByTestId("state")).toHaveTextContent("done");
  });

  it("survives the localStorage getter throwing", () => {
    const desc = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("denied", "SecurityError");
      },
    });
    try {
      render(<Probe />);
      act(() => screen.getByText("complete").click());
      expect(screen.getByTestId("state")).toHaveTextContent("done");
      expect(screen.getByTestId("avail")).toHaveTextContent("false");
    } finally {
      if (desc) Object.defineProperty(window, "localStorage", desc);
    }
  });

  it("survives window.localStorage being undefined", () => {
    const desc = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", { configurable: true, value: undefined });
    try {
      render(<Probe />);
      act(() => screen.getByText("complete").click());
      expect(screen.getByTestId("state")).toHaveTextContent("done");
      expect(store.getSnapshot().storageAvailable).toBe(false);
      expect(store.getState().lessons["l1-first-session"]).toBeDefined();
    } finally {
      if (desc) Object.defineProperty(window, "localStorage", desc);
    }
  });

  it("quota error on write: reads work, session state updates, banner shows, storage unchanged", () => {
    window.localStorage.setItem(KEY, oneComplete);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    render(
      <>
        <ProgressNotices />
        <Probe slug="l2-context-files" />
      </>,
    );
    // A write probe on load detects the full storage up front.
    expect(screen.getByTestId("avail")).toHaveTextContent("false");
    act(() => screen.getByText("complete").click());
    expect(screen.getByTestId("state")).toHaveTextContent("done");
    expect(screen.getByRole("status")).toHaveTextContent("Progress can't be saved in this browser");
    expect(window.localStorage.getItem(KEY)).toBe(oneComplete);
    // A second change must not lose the first (memory is authoritative after a failed write).
    act(() => screen.getByText("undo").click());
    expect(store.getState().lessons["l1-first-session"]).toBeDefined();
  });
});

describe("cross-tab (TC-D-34, 35)", () => {
  it("follows the storage event", () => {
    render(<Probe />);
    expect(screen.getByTestId("state")).toHaveTextContent("todo");
    act(() => {
      window.localStorage.setItem(KEY, oneComplete);
      window.dispatchEvent(new StorageEvent("storage", { key: KEY, newValue: oneComplete }));
    });
    expect(screen.getByTestId("state")).toHaveTextContent("done");
  });

  it("re-reads before writing so another tab's change is kept", () => {
    render(<Probe slug="l2-context-files" />);
    // Another tab writes without this tab hearing about it.
    window.localStorage.setItem(KEY, oneComplete);
    act(() => screen.getByText("complete").click());
    expect(Object.keys(stored().lessons).sort()).toEqual(["l1-first-session", "l2-context-files"]);
  });

  it("ignores unrelated keys", () => {
    render(<Probe />);
    const spy = vi.spyOn(Storage.prototype, "getItem");
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "other", newValue: "x" }));
    });
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("focused hooks", () => {
  function Hooks() {
    const b = useBookmark("news", "n1");
    const t = useToolPref();
    const c = useChecklist("ex", ["a", "b"]);
    return (
      <div>
        <span data-testid="bm">{String(b.bookmarked)}</span>
        <span data-testid="tool">{t.tool}</span>
        <span data-testid="chk">{`${c.doneCount}/${c.total}`}</span>
        <button onClick={b.toggle}>bm</button>
        <button onClick={() => t.setTool("codex")}>codex</button>
        <button onClick={() => c.setChecked("a", true)}>a</button>
      </div>
    );
  }

  it("bookmark, tool pref and checklist round-trip through storage", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ ...emptyState(), checklists: { ex: { zzz: true, a: false } } }),
    );
    render(<Hooks />);
    act(() => screen.getByText("bm").click());
    act(() => screen.getByText("codex").click());
    act(() => screen.getByText("a").click());
    expect(screen.getByTestId("bm")).toHaveTextContent("true");
    expect(screen.getByTestId("tool")).toHaveTextContent("codex");
    expect(screen.getByTestId("chk")).toHaveTextContent("1/2");
    expect(stored().checklists.ex).toEqual({ zzz: true, a: true });
    expect(stored().prefs.tool).toBe("codex");
    expect(Object.keys(stored().bookmarks.news)).toEqual(["n1"]);
  });
});

describe("useTrackLastViewed two-tab (review B1)", () => {
  function Track({ slug }: { slug: string }) {
    useTrackLastViewed(slug);
    return null;
  }

  it("writes once for its own slug and ignores other tabs' lastViewed changes", () => {
    render(<Track slug="a" />);
    expect(stored().lastViewed.slug).toBe("a");
    // Another tab views lesson b.
    const other = JSON.stringify({
      ...emptyState(),
      lastViewed: { slug: "b", at: "2026-09-30T00:00:00.000Z" },
    });
    window.localStorage.setItem(KEY, other);
    const spy = vi.spyOn(Storage.prototype, "setItem");
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: KEY, newValue: other }));
    });
    // Nothing further is written in response; the other tab's value stands.
    expect(spy).not.toHaveBeenCalled();
    expect(stored().lastViewed.slug).toBe("b");
  });

  it("writes again when this tab navigates to another slug", () => {
    const { rerender } = render(<Track slug="a" />);
    rerender(<Track slug="c" />);
    expect(stored().lastViewed.slug).toBe("c");
  });
});
