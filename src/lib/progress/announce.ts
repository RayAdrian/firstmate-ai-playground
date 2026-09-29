/**
 * Announce a message through the single polite live region (`#fm-live`, DESIGN §4/§11).
 * TEMPORARY SHIM: the app shell (WS-A) owns `announce()`; swap this for theirs once it lands.
 * The app shell renders that element; if it is missing (for example on an isolated
 * page) a visually hidden one is created so the announcement is still spoken.
 */
export function announce(message: string): void {
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
  // Clear first so repeating the same message is announced again.
  region.textContent = "";
  window.setTimeout(() => {
    if (region) region.textContent = message;
  }, 30);
}
