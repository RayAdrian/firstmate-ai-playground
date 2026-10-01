import { describe, expect, it } from "vitest";
import { splitPromptSessions } from "@/components/exercise/prompt-sessions";

describe("splitPromptSessions", () => {
  it("keeps a single-session prompt as one block", () => {
    expect(splitPromptSessions("Do the thing.\n\nThen commit.")).toEqual([
      { title: "Prompt", text: "Do the thing.\n\nThen commit." },
    ]);
  });

  it("splits at 'Then, in a fresh session:' into labelled blocks", () => {
    const out = splitPromptSessions("First prompt.\n\nThen, in a fresh session: Second prompt.");
    expect(out).toEqual([
      { title: "Prompt, session 1 of 2", text: "First prompt." },
      { title: "Prompt, session 2 of 2 (fresh session)", text: "Second prompt." },
    ]);
  });
});
