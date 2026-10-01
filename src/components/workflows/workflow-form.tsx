"use client";

import type { FormEvent, ReactNode } from "react";

export const WORKFLOW_FORM_ID = "workflow-filters";

// Shared with the news archive so ResultsHeading (which reads it) takes focus after a submit.
const FOCUS_FLAG = "fm-news-focus-results";

function setFocusFlag(): void {
  try {
    window.sessionStorage.setItem(FOCUS_FLAG, "1");
  } catch {
    // sessionStorage blocked: the focus handoff is a nicety, skip it.
  }
}

/**
 * GET form for /workflows. A real form, so it works before hydration and the URL is the only state (WF-31).
 * On submit it leaves empty fields out of the URL. The search box lives outside this element (above the grid)
 * and joins it through its `form` attribute, so `form.elements` includes it.
 */
export function WorkflowForm({ children }: { children: ReactNode }) {
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    setFocusFlag();
    const skipped: (HTMLInputElement | HTMLSelectElement)[] = [];
    for (const el of Array.from(e.currentTarget.elements)) {
      if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement)) continue;
      if (el.type !== "checkbox" && el.value === "" && !el.disabled) {
        el.disabled = true;
        skipped.push(el);
      }
    }
    // Disabled controls are left out of the submission; restore them right after (bfcache-safe).
    setTimeout(() => skipped.forEach((el) => (el.disabled = false)), 0);
  };
  return (
    <form
      id={WORKFLOW_FORM_ID}
      method="get"
      action="/workflows"
      aria-label="Filters"
      autoComplete="off"
      onSubmit={onSubmit}
    >
      {children}
    </form>
  );
}
