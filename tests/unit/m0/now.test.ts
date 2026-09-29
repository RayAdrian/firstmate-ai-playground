import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const cookieStore = { get: vi.fn() };
const connection = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("next/server", () => ({ connection }));
vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));

import { getNow, manilaDate } from "@/lib/time/now";

afterEach(() => {
  vi.unstubAllEnvs();
  cookieStore.get.mockReset();
  connection.mockClear();
});

describe("getNow", () => {
  it("returns the real time and ignores the cookie without FM_TEST_MODE", async () => {
    cookieStore.get.mockReturnValue({ value: "2020-01-01T00:00:00Z" });
    const before = Date.now();
    const now = await getNow();
    expect(now.getTime()).toBeGreaterThanOrEqual(before);
    expect(cookieStore.get).not.toHaveBeenCalled();
  });

  it("always opts into dynamic rendering (connection), with or without the flag", async () => {
    await getNow();
    vi.stubEnv("FM_TEST_MODE", "1");
    cookieStore.get.mockReturnValue(undefined);
    await getNow();
    expect(connection).toHaveBeenCalledTimes(2);
  });

  it("uses the fm_test_now cookie under FM_TEST_MODE=1", async () => {
    vi.stubEnv("FM_TEST_MODE", "1");
    cookieStore.get.mockReturnValue({ value: "2026-09-30T08:03:00+08:00" });
    expect((await getNow()).toISOString()).toBe("2026-09-30T00:03:00.000Z");
    expect(cookieStore.get).toHaveBeenCalledWith("fm_test_now");
  });

  it("falls back to real time on a missing or invalid cookie", async () => {
    vi.stubEnv("FM_TEST_MODE", "1");
    cookieStore.get.mockReturnValue(undefined);
    expect(Math.abs((await getNow()).getTime() - Date.now())).toBeLessThan(5000);
    cookieStore.get.mockReturnValue({ value: "garbage" });
    expect(Math.abs((await getNow()).getTime() - Date.now())).toBeLessThan(5000);
  });
});

describe("manilaDate", () => {
  it("formats in Asia/Manila", () => {
    expect(manilaDate(new Date("2026-09-30T00:03:00Z"))).toBe("2026-09-30");
  });
  it("crosses Manila midnight: 16:00Z is already the next day", () => {
    expect(manilaDate(new Date("2026-09-29T15:59:59Z"))).toBe("2026-09-29");
    expect(manilaDate(new Date("2026-09-29T16:00:00Z"))).toBe("2026-09-30");
  });
});
