import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PROGRESS_STORAGE_KEY,
  PROGRESS_VERSION,
  communitySchema,
  createEmptyProgress,
  isUuidV4,
  newClientId,
  progressStateSchema,
  type ProgressState,
} from "@/lib/contracts";
import {
  ProgressNotices,
  emptyState,
  migrate,
  parseImportText,
  parseProgressText,
  serializeProgress,
  useBookmark,
  useChecklist,
  useLessonCompletion,
} from "@/lib/progress";
import * as store from "@/lib/progress/store";
import v1Full from "../d/fixtures/v1-full.json";

const KEY = PROGRESS_STORAGE_KEY;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const OTHER_ID = "11111111-2222-4333-8444-555555555555";
const NEWER_NOTICE =
  "This browser has progress from a newer version of the Playground. It's shown read-only here. Reload to get the latest version.";

describe("P-1 v2 contract (PRD 18.3)", () => {
  it("is version 2 and an empty doc carries a fresh community object", () => {
    expect(PROGRESS_VERSION).toBe(2);
    const a = createEmptyProgress();
    const b = createEmptyProgress();
    expect(a.version).toBe(2);
    expect(a.community).toMatchObject({ displayName: null, namePrompted: false });
    expect(a.community.clientId).toMatch(UUID_V4);
    expect(a.community.clientId).not.toBe(b.community.clientId);
    expect(progressStateSchema.safeParse(a).success).toBe(true);
  });

  it("community requires a UUID v4 clientId and a name of at most 40 characters", () => {
    const ok = { clientId: OTHER_ID, displayName: "Rafael", namePrompted: true };
    expect(communitySchema.safeParse(ok).success).toBe(true);
    expect(communitySchema.safeParse({ ...ok, clientId: "nope" }).success).toBe(false);
    expect(communitySchema.safeParse({ ...ok, clientId: "11111111-2222-1333-8444-555555555555" }).success).toBe(false);
    expect(communitySchema.safeParse({ ...ok, displayName: "x".repeat(41) }).success).toBe(false);
    expect(communitySchema.safeParse({ ...ok, namePrompted: "yes" }).success).toBe(false);
  });

  it("generates a v4 UUID from getRandomValues when randomUUID is unavailable (http over a LAN IP)", () => {
    const original = globalThis.crypto.randomUUID;
    Object.defineProperty(globalThis.crypto, "randomUUID", { value: undefined, configurable: true });
    try {
      const ids = new Set(Array.from({ length: 50 }, () => newClientId()));
      expect(ids.size).toBe(50);
      for (const id of ids) {
        expect(id).toMatch(UUID_V4);
        expect(isUuidV4(id)).toBe(true);
      }
    } finally {
      Object.defineProperty(globalThis.crypto, "randomUUID", { value: original, configurable: true });
    }
  });
});

describe("v1 -> v2 migration", () => {
  it("adds community with a valid v4 UUID and leaves every other field identical", () => {
    const out = migrate(v1Full as Record<string, unknown>);
    const { community, version, ...rest } = out;
    const v1Rest: Record<string, unknown> = { ...v1Full };
    delete v1Rest.version;
    expect(version).toBe(2);
    expect(rest).toEqual(v1Rest);
    expect(community).toMatchObject({ displayName: null, namePrompted: false });
    expect((community as { clientId: string }).clientId).toMatch(UUID_V4);
  });

  it("parseProgressText turns a stored v1 doc into a valid v2 state", () => {
    const res = parseProgressText(JSON.stringify(v1Full));
    expect(res.kind).toBe("ok");
    if (res.kind === "ok") {
      expect(res.state.version).toBe(2);
      expect(res.state.lessons).toEqual(v1Full.lessons);
      expect(res.state.community.clientId).toMatch(UUID_V4);
    }
  });
});

describe("newer-version docs (R-H forward compatibility)", () => {
  it("parse reports `newer` for a version above the code's, never `invalid`", () => {
    const v3 = JSON.stringify({ ...emptyState(), version: 3, futureField: { x: 1 } });
    const res = parseProgressText(v3);
    expect(res.kind).toBe("newer");
    if (res.kind === "newer") expect(res.version).toBe(3);
  });

  it("import of a newer file is refused with an unsupported-version reason", () => {
    const v9 = JSON.stringify({ ...emptyState(), version: 9 });
    expect(parseImportText(v9)).toEqual({ ok: false, reason: "unsupported version 9" });
  });

  it("older and malformed versions are still invalid", () => {
    expect(parseProgressText(JSON.stringify({ ...emptyState(), version: 0 })).kind).toBe("invalid");
    expect(parseProgressText(JSON.stringify({ ...emptyState(), version: "3" })).kind).toBe("invalid");
  });
});

describe("export and import never carry community (P-6)", () => {
  const state: ProgressState = {
    ...createEmptyProgress(),
    community: { clientId: OTHER_ID, displayName: "Rafael Secret", namePrompted: true },
  };

  it("the exported text has no community key, clientId or display name", () => {
    const text = serializeProgress(state);
    expect(text).not.toContain("community");
    expect(text).not.toContain(OTHER_ID);
    expect(text).not.toContain("Rafael Secret");
    expect(JSON.parse(text).version).toBe(2);
  });

  it("an exported file imports back (no community needed)", () => {
    const res = parseImportText(serializeProgress(state));
    expect(res.ok).toBe(true);
  });

  it("a community key in an import file is ignored", () => {
    const evil = "99999999-9999-4999-8999-999999999999";
    const hand = JSON.stringify({ ...state, community: { clientId: evil, displayName: "Evil", namePrompted: true } });
    const res = parseImportText(hand);
    expect(res.ok).toBe(true);
    if (res.ok) expect(JSON.stringify(res.state)).not.toContain(evil);
  });

  it("a v1 export imports too", () => {
    expect(parseImportText(JSON.stringify(v1Full)).ok).toBe(true);
  });
});

function Probe() {
  const c = useLessonCompletion("l1-first-session");
  const k = useChecklist("ex-1", ["a"]);
  const b = useBookmark("lessons", "l1-first-session");
  return (
    <div>
      <ProgressNotices />
      <main>
        <span data-testid="done">{String(c.completed)}</span>
        <button onClick={c.markComplete}>complete</button>
        <button onClick={() => k.setChecked("a", true)}>check</button>
        <button onClick={b.toggle}>bookmark</button>
        <span data-testid="bm">{String(b.bookmarked)}</span>
      </main>
    </div>
  );
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

const V3_EXTRA = JSON.stringify({
  ...createEmptyProgress(),
  version: 3,
  lessons: { "l1-first-session": { completedAt: "2026-09-29T01:00:00.000Z" } },
  futureField: { shape: "unknown" },
});

describe("store: newer docs are read-only and byte-identical (R-H AC)", () => {
  const newerDocs: Record<string, string> = {
    "v3 with an unknown extra field": V3_EXTRA,
    "v99 whose known fields are not valid": JSON.stringify({ version: 99, lessons: "nope", bookmarks: 7 }),
  };

  for (const [name, raw] of Object.entries(newerDocs)) {
    it(`never writes the key: ${name}`, () => {
      window.localStorage.setItem(KEY, raw);
      const setItem = vi.spyOn(Storage.prototype, "setItem");
      const removeItem = vi.spyOn(Storage.prototype, "removeItem");
      render(<Probe />);
      expect(screen.getByText(NEWER_NOTICE)).toBeInTheDocument();
      act(() => screen.getByText("complete").click());
      act(() => screen.getByText("check").click());
      act(() => screen.getByText("bookmark").click());
      // Toggles still work for the session, in memory only.
      expect(screen.getByTestId("done")).toHaveTextContent("true");
      expect(screen.getByTestId("bm")).toHaveTextContent("true");
      expect(window.localStorage.getItem(KEY)).toBe(raw);
      expect(setItem.mock.calls.filter(([k]) => k === KEY)).toEqual([]);
      expect(removeItem.mock.calls.filter(([k]) => k === KEY)).toEqual([]);
    });
  }

  it("renders the fields it knows from a newer doc", () => {
    window.localStorage.setItem(KEY, V3_EXTRA);
    render(<Probe />);
    expect(screen.getByTestId("done")).toHaveTextContent("true");
  });

  it("a storage event delivering a newer doc leaves it byte-identical and shows the Notice", () => {
    render(<Probe />);
    expect(screen.queryByText(NEWER_NOTICE)).toBeNull();
    window.localStorage.setItem(KEY, V3_EXTRA);
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: KEY, newValue: V3_EXTRA }));
    });
    expect(screen.getByText(NEWER_NOTICE)).toBeInTheDocument();
    act(() => screen.getByText("complete").click());
    expect(window.localStorage.getItem(KEY)).toBe(V3_EXTRA);
  });

  it("logs no error", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    window.localStorage.setItem(KEY, V3_EXTRA);
    render(<Probe />);
    act(() => screen.getByText("complete").click());
    expect(error).not.toHaveBeenCalled();
  });

  it("a corrupt doc still resets as before (P-2) and gets a new clientId", () => {
    window.localStorage.setItem(KEY, "{nope");
    render(<Probe />);
    const after = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as ProgressState;
    expect(after.version).toBe(2);
    expect(after.community.clientId).toMatch(UUID_V4);
    expect(screen.queryByText(NEWER_NOTICE)).toBeNull();
  });
});

describe("store: community identity", () => {
  it("keeps one clientId from first read to first write on a fresh browser", () => {
    render(<Probe />);
    const inMemory = store.getState().community.clientId;
    act(() => screen.getByText("complete").click());
    const stored = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as ProgressState;
    expect(stored.community.clientId).toBe(inMemory);
  });

  it("reset (P-7) keeps community", () => {
    render(<Probe />);
    store.updateProgress((s) => ({ ...s, community: { clientId: OTHER_ID, displayName: "Ana", namePrompted: true } }));
    act(() => screen.getByText("complete").click());
    act(() => store.resetProgress());
    const stored = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as ProgressState;
    expect(stored.lessons).toEqual({});
    expect(stored.community).toEqual({ clientId: OTHER_ID, displayName: "Ana", namePrompted: true });
  });

  it("import (replaceProgress) keeps the local community and ignores the file's", () => {
    render(<Probe />);
    store.updateProgress((s) => ({ ...s, community: { clientId: OTHER_ID, displayName: "Ana", namePrompted: true } }));
    const incoming: ProgressState = {
      ...createEmptyProgress(),
      lessons: { x: { completedAt: "2026-09-29T01:00:00.000Z" } },
      community: { clientId: "99999999-9999-4999-8999-999999999999", displayName: "Evil", namePrompted: true },
    };
    act(() => store.replaceProgress(incoming));
    const stored = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as ProgressState;
    expect(stored.lessons).toEqual(incoming.lessons);
    expect(stored.community).toEqual({ clientId: OTHER_ID, displayName: "Ana", namePrompted: true });
  });

  it("with storage unavailable the clientId lives for the session only (P-3)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    render(<Probe />);
    expect(store.getState().community.clientId).toMatch(UUID_V4);
  });
});
