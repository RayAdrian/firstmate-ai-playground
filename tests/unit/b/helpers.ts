import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll } from "vitest";

export const FIXTURES_ROOT = path.resolve(__dirname, "../../fixtures/content");
export const FM_NOW = new Date("2026-09-30T13:00:00+08:00");

const made: string[] = [];
afterAll(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

export interface Sandbox {
  root: string;
  contentDir: string;
  exercisesDir: string;
  /** Rewrite a file relative to the sandbox root. */
  edit(rel: string, fn: (text: string) => string): void;
  write(rel: string, text: string): void;
  remove(rel: string): void;
}

/** Copy tests/fixtures/content/<name>/ into a temp dir. */
export function contentSandbox(name = "content-valid"): Sandbox {
  const root = mkdtempSync(path.join(tmpdir(), "fm-seed-"));
  made.push(root);
  cpSync(path.join(FIXTURES_ROOT, name), root, { recursive: true });
  return {
    root,
    contentDir: path.join(root, "content"),
    exercisesDir: path.join(root, "exercises"),
    edit(rel, fn) {
      const file = path.join(root, rel);
      writeFileSync(file, fn(readFileSync(file, "utf8")));
    },
    write(rel, text) {
      const file = path.join(root, rel);
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, text);
    },
    remove(rel) {
      rmSync(path.join(root, rel), { recursive: true, force: true });
    },
  };
}
