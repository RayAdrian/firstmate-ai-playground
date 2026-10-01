import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MEDIA_CAPS, mediaManifestSchema } from "@/lib/contracts";

const root = path.resolve(__dirname, "../../../public/media/lessons");

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

describe("committed lesson media (MD-6)", () => {
  const files = walk(root);

  it("every manifest matches the contract and its folder, and references existing files", () => {
    for (const f of files.filter((f) => f.endsWith(".media.json"))) {
      const rel = path.relative(root, f);
      const parsed = mediaManifestSchema.safeParse(JSON.parse(fs.readFileSync(f, "utf8")));
      expect(parsed.success, `${rel}: ${parsed.success ? "" : parsed.error.message}`).toBe(true);
      if (!parsed.success) continue;
      const dir = path.dirname(f);
      expect(parsed.data.lesson_slug, `${rel}: lesson_slug must match folder`).toBe(path.basename(dir));
      expect(path.basename(f), rel).toBe(`${parsed.data.id}.media.json`);
      for (const ext of ["mp4", "webp", "vtt", "txt"]) {
        expect(fs.existsSync(path.join(dir, `${parsed.data.id}.${ext}`)), `${rel}: missing .${ext}`).toBe(true);
      }
    }
  });

  it("enforces size caps", () => {
    let total = 0;
    for (const f of files) {
      const size = fs.statSync(f).size;
      total += size;
      const rel = path.relative(root, f);
      if (f.endsWith(".mp4")) expect(size, rel).toBeLessThanOrEqual(MEDIA_CAPS.mp4);
      if (f.endsWith(".webp")) expect(size, rel).toBeLessThanOrEqual(MEDIA_CAPS.poster);
    }
    expect(total).toBeLessThanOrEqual(MEDIA_CAPS.total);
  });
});
