import { describe, expect, it } from "vitest";
import { REPO_CLONE_CMD, REPO_URL, exerciseFolderUrl, exercisesTreeUrl } from "@/lib/site";

describe("repo links", () => {
  it("has one repo URL", () => {
    expect(REPO_URL).toBe("https://github.com/RayAdrian/firstmate-ai-playground");
    expect(REPO_CLONE_CMD).toBe("git clone https://github.com/RayAdrian/firstmate-ai-playground.git");
    expect(exercisesTreeUrl()).toBe(`${REPO_URL}/tree/main/exercises`);
  });

  it("builds the exercise folder URL from repo_path, dropping the starter segment", () => {
    const base = `${REPO_URL}/tree/main/exercises/ex-1-1-failing-test`;
    expect(exerciseFolderUrl("exercises/ex-1-1-failing-test/starter")).toBe(base);
    expect(exerciseFolderUrl("exercises/ex-1-1-failing-test/starter/")).toBe(base);
    expect(exerciseFolderUrl("exercises/ex-1-1-failing-test")).toBe(base);
    expect(exerciseFolderUrl("/exercises/ex-1-1-failing-test/starter")).toBe(base);
  });
});
