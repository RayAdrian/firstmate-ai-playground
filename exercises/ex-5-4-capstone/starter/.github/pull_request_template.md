## Summary
<!-- What and why. Link the spec's acceptance criteria ids (A-1, A-2, ...). -->

## Workstream and owned paths
Workstream:

Paths this PR touches (must all be owned by the workstream in SPEC.md):
-

- [ ] I edited no files outside my owned paths

## Merge gates
Each gate is a commit status (`scripts/gate-status.sh`, contexts `gate/browser|review|uiux`) on the head SHA, plus the matching label. Any new push invalidates earlier approvals. Merge only with `npm run gate:merge -- <pr#>`.

- [ ] **Browser** (`gate:browser-green`): tests pass (for this repo: `npm test`; "N/A: no UI" is fine for the UI part)
- [ ] **Code review agent** (`gate:review-green`): no unresolved blocking findings
- [ ] **UI/UX** (`gate:uiux-green`): "N/A: no UI changes" is a valid verdict here

Head SHA reviewed:

## Test evidence
<!-- Commands run and real output. -->
