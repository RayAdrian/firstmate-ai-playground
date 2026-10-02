#!/bin/bash
# Fake agent: does the fix, then dies with a non-zero exit (rate limit, budget, crash).
cat > src/slugify.js <<'JS'
export function slugify(text) {
  return text.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-");
}
JS
echo "Error: budget exceeded" >&2
exit 1
