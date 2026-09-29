import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ErrorPage from "@/app/error";
import {
  DB_UNAVAILABLE_MESSAGE,
  DbUnavailableError,
  dbRead,
  isDbUnavailable,
} from "@/lib/db";
import { getReadClient } from "@/lib/db/server";

describe("DB unavailable seam", () => {
  it("uses the exact PRD section 9 message", () => {
    expect(DB_UNAVAILABLE_MESSAGE).toBe(
      "Can't reach the local database. Run `supabase start` then `npm run seed`.",
    );
  });

  it("detects the error by class, name or digest (survives the server/client boundary)", () => {
    expect(isDbUnavailable(new DbUnavailableError())).toBe(true);
    expect(isDbUnavailable({ name: "DbUnavailableError" })).toBe(true);
    expect(isDbUnavailable(Object.assign(new Error("hidden in prod"), { digest: "DB_UNAVAILABLE" }))).toBe(true);
    expect(isDbUnavailable(new Error("boom"))).toBe(false);
    expect(isDbUnavailable(null)).toBe(false);
  });

  it("the read client throws DbUnavailableError when the database is unreachable (ECONNREFUSED)", async () => {
    process.env.SUPABASE_URL = "http://127.0.0.1:1";
    process.env.SUPABASE_ANON_KEY = "anon";
    await expect(dbRead(getReadClient().from("levels").select("slug"))).rejects.toSatisfy(isDbUnavailable);
  });

  it("does not misclassify ordinary query errors", async () => {
    const failing = Promise.resolve({ data: null, error: { message: "relation does not exist" } });
    const err = await dbRead(failing).catch((e: unknown) => e);
    expect(isDbUnavailable(err)).toBe(false);
  });

  it("error boundary shows the message and a copyable command for this error", () => {
    render(<ErrorPage error={new DbUnavailableError()} reset={() => {}} />);
    expect(screen.getByText(DB_UNAVAILABLE_MESSAGE)).toBeVisible();
    expect(screen.getByText("supabase start && npm run seed")).toBeVisible();
    expect(screen.getByRole("button", { name: "Copy command" })).toBeVisible();
  });

  it("error boundary stays generic for other errors", () => {
    render(<ErrorPage error={new Error("boom")} reset={() => {}} />);
    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeVisible();
    expect(screen.queryByText(DB_UNAVAILABLE_MESSAGE)).toBeNull();
  });
});
