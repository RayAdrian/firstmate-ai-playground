// @vitest-environment node
// The TL;DR render script must hash what the seed and the CI walker hash: NFC title, trimmed points (PRD §19.5).
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { tldrSourceHash } from "@/lib/contracts/tldr-hash";
import { parseLessonFile } from "../../../scripts/seed/lib/lesson";
import { normalizeDraft, normalizeLessonFile, readLessons } from "../../../media/lessons-normalized";

const repo = path.resolve(__dirname, "../../..");
const file = "content/lessons/l1/01-first-session.md";
const base = fs.readFileSync(path.join(repo, file), "utf8");
const nfcTitle = "Your first agent session é";
const nfdTitle = "Your first agent session é"; // not NFC

/** The lesson file with a non-NFC title and a point padded with whitespace. */
function messy(): string {
  const withTitle = base.replace(/^title: .*$/m, `title: "${nfdTitle}"`);
  const withPoint = withTitle.replace(/^(\s+- )"(Give the agent a check)/m, '$1"   $2').replace(/(not its summary\.)"/, '$1   "');
  expect(withPoint).not.toBe(withTitle);
  return withPoint;
}
const clean = () => base.replace(/^title: .*$/m, `title: "${nfcTitle}"`);

describe("render script hash input equals the seed's", () => {
  it("messy and clean files give the same normalised lesson and the same hash as the seed", () => {
    const m = normalizeLessonFile(messy(), file);
    const c = normalizeLessonFile(clean(), file);
    expect(m.title).toBe(nfcTitle);
    expect(m.title.normalize("NFC")).toBe(m.title);
    expect(m.tldr).toEqual(c.tldr);
    expect(m.tldr!.points[0]).toBe(m.tldr!.points[0].trim());

    const seed = parseLessonFile(messy(), file, { now: new Date() }).value!;
    const hash = (title: string, tldr: typeof seed.tldr) => tldrSourceHash({ templateVersion: 1, title, tldr: tldr! });
    expect(hash(m.title, m.tldr)).toBe(hash(seed.title, seed.tldr));
    expect(hash(m.title, m.tldr)).toBe(hash(c.title, c.tldr));
  });

  it("the raw (un-normalised) values would hash differently, which is the bug this prevents", () => {
    const m = normalizeLessonFile(messy(), file);
    expect(tldrSourceHash({ templateVersion: 1, title: nfdTitle, tldr: m.tldr! })).not.toBe(
      tldrSourceHash({ templateVersion: 1, title: m.title, tldr: m.tldr! }),
    );
  });

  it("a draft --props tldr is normalised the same way", () => {
    const draft = normalizeDraft(JSON.stringify({ s: { title: ` ${nfdTitle} `, tldr: { points: ["  Point one is here.  ", "Point two is here.", "Point three is here."], try_this: { all: { kind: "command", text: " ls " } } } } }));
    expect(draft.s.title).toBe(nfcTitle);
    expect(draft.s.tldr.points[0]).toBe("Point one is here.");
    expect(draft.s.tldr.try_this).toEqual({ all: { kind: "command", text: "ls" } });
  });

  it("reads every lesson on main through the seed parser", () => {
    const all = readLessons(repo);
    expect(all["l1-first-session"].title).toBe("Your first agent session");
    expect(Object.keys(all).length).toBeGreaterThanOrEqual(22);
  });
});
