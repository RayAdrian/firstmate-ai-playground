// Reads a unified diff (what `git diff` prints) and returns the files it touches and how many lines it changes.
// Both sides of every `diff --git a/<old> b/<new>` header count, so a rename is checked against its source too.
export function parseDiff(text) {
  const files = new Set();
  let added = 0;
  let removed = 0;
  let inHunk = false;
  for (const line of String(text).split("\n")) {
    const header = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
    if (header) {
      files.add(header[1]);
      files.add(header[2]);
      inHunk = false;
      continue;
    }
    if (line.startsWith("@@")) {
      inHunk = true;
      continue;
    }
    if (!inHunk) continue;
    if (line.startsWith("+")) added++;
    else if (line.startsWith("-")) removed++;
  }
  return { files: [...files], added, removed };
}
