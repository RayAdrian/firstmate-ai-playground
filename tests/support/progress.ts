import type { Page } from "@playwright/test";
import {
  createEmptyProgress,
  PROGRESS_STORAGE_KEY,
  type ProgressState,
} from "../../src/lib/contracts/progress";

/** Build a progress doc from the contract's empty doc, so fixtures track the schema. */
export function progressDoc(overrides: Partial<ProgressState> = {}): ProgressState {
  return { ...createEmptyProgress(), ...overrides };
}

/**
 * Seed `fm-playground:v1` before any app script runs (init script). Pass a raw string to
 * seed corrupt data. Call before `page.goto`. Seeds once per tab, so app writes and
 * reloads are not overwritten.
 */
export async function seedProgress(page: Page, doc: ProgressState | string): Promise<void> {
  const raw = typeof doc === "string" ? doc : JSON.stringify(doc);
  await page.addInitScript(
    ([key, value]) => {
      if (!sessionStorage.getItem("__fm_seeded")) {
        localStorage.setItem(key, value);
        sessionStorage.setItem("__fm_seeded", "1");
      }
    },
    [PROGRESS_STORAGE_KEY, raw] as const,
  );
}

/** Read the stored progress doc (parsed), or null if the key is absent. */
export async function readProgress(page: Page): Promise<unknown> {
  const raw = await page.evaluate((key) => localStorage.getItem(key), PROGRESS_STORAGE_KEY);
  return raw === null ? null : JSON.parse(raw);
}

/** Make localStorage unusable (the getter throws SecurityError). Call before `page.goto`. */
export async function blockStorage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("The operation is insecure.", "SecurityError");
      },
    });
  });
}
