// Barrel file. It is already wired for both features so that neither branch needs to touch it.
// Editing this file from both worktrees is exactly the kind of overlap this exercise avoids.
export { formatPrice } from "./format-price.js";
export { parseDuration } from "./parse-duration.js";
