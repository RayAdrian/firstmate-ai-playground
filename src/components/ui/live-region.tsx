/**
 * The single polite live region (DESIGN.md §4.0). The shell renders <LiveRegion /> once;
 * components call announce(text) instead of creating their own regions.
 */
export function LiveRegion() {
  return <div id="fm-live" role="status" aria-live="polite" aria-atomic="true" className="sr-only" />;
}

const CLEAR_AFTER_MS = 2500;
let clearTimer: number | undefined;

/** Clear the region, then set the text on the next frame so repeating a message is announced again. */
export function announce(text: string): void {
  if (typeof document === "undefined") return;
  let region = document.getElementById("fm-live");
  if (!region) {
    region = document.createElement("div");
    region.id = "fm-live";
    region.setAttribute("role", "status");
    region.setAttribute("aria-live", "polite");
    region.setAttribute("aria-atomic", "true");
    region.className = "sr-only";
    document.body.appendChild(region);
  }
  const target = region;
  target.textContent = "";
  window.clearTimeout(clearTimer);
  window.requestAnimationFrame(() => {
    target.textContent = text;
    clearTimer = window.setTimeout(() => {
      target.textContent = "";
    }, CLEAR_AFTER_MS);
  });
}
