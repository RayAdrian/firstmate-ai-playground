#!/bin/bash
# Fake agent: fixes the bug properly.
cat > src/slugify.js <<'JS'
export function slugify(text) {
  return text.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-");
}
JS
echo "I changed src/slugify.js to use hyphens and drop punctuation."
