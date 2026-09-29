## Summary
<!-- What and why. Link PRD acceptance criteria IDs (e.g. L-2, P-1). -->

## Workstream and owned paths
Workstream: <!-- e.g. ws-c -->

Paths this PR touches (must all be owned by the workstream, PRD §11):
-

- [ ] I edited no files outside my owned paths

## Merge gates (PRD §12)
Each gate is recorded as a commit status (`scripts/gate-status.sh`, contexts `gate/browser|review|uiux`) on the head SHA plus the matching label. Any new push invalidates earlier approvals. Merge only with `npm run gate:merge -- <pr#>`.

- [ ] **Browser E2E** (`gate:browser-green`): Playwright + axe pass against fixtures; manual check at 360 / 768 / 1440px, screenshots attached below
- [ ] **Code review agent** (`gate:review-green`): no unresolved blocking findings
- [ ] **UI/UX agent** (`gate:uiux-green`): hierarchy, states, a11y, brand (or "N/A: no UI changes")

### Screenshots
| 360 | 768 | 1440 |
|---|---|---|
| | | |

## Test evidence
<!-- Commands run and results. P0 ACs need a test in this PR. -->
