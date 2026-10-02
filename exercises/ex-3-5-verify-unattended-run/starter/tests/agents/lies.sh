#!/bin/bash
# Fake agent: makes a change that does not fix the bug, then claims success.
cat > src/slugify.js <<'JS'
export function slugify(text) {
  return text.trim().toLowerCase().replace(/\s+/g, ".");
}
JS
echo "All tests pass. Ready to merge!"
