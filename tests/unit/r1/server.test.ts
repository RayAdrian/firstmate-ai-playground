// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommunityError, codeForPgError, writeStar } from "@/lib/community/server";

afterEach(() => vi.unstubAllEnvs());

describe("codeForPgError maps the migration's SQLSTATEs to route codes", () => {
  it("CM001, CM002 and CM003", () => {
    expect(codeForPgError({ code: "CM001" })).toBe("workflow_unavailable");
    expect(codeForPgError({ code: "CM002" })).toBe("rate_limited");
    expect(codeForPgError({ code: "CM003" })).toBe("invalid_request");
  });

  it("anything else (a dead connection, a permission error, junk) is just unavailable and carries no detail", () => {
    expect(codeForPgError({ code: "ECONNREFUSED" })).toBe("unavailable");
    expect(codeForPgError({ code: "42501" })).toBe("unavailable");
    expect(codeForPgError(new Error("password authentication failed for user community_writer"))).toBe("unavailable");
    expect(codeForPgError(null)).toBe("unavailable");
  });
});

describe("the writer credential", () => {
  it("fails closed, as `unavailable`, when COMMUNITY_DATABASE_URL is not set", async () => {
    vi.stubEnv("COMMUNITY_DATABASE_URL", "");
    await expect(writeStar("wf", "aaaaaaaa-0000-4000-8000-000000000001", true)).rejects.toBeInstanceOf(CommunityError);
    await expect(writeStar("wf", "aaaaaaaa-0000-4000-8000-000000000001", true)).rejects.toMatchObject({ code: "unavailable" });
  });
});
