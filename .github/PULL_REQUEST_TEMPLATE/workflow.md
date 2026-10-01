## Problem this workflow solves
<!-- One sentence. It must match the `problem` field of the file. -->

## Contributor checklist (client safety)
> **Human review at merge is the only check for client names, client code, internal URLs and people. CI checks secrets and format, nothing else.**

- [ ] No client or prospect names
- [ ] No client code copied verbatim
- [ ] No internal URLs, hostnames or ticket IDs
- [ ] No secrets or tokens
- [ ] No names of people outside First Mate
- [ ] This applies to every commit message on the branch, the branch name and this PR body

## Merger review
**This review is the confidentiality control.** No automated check looks for client names. Tick every box before running `npm run gate:merge -- <pr#>`, including when you are the author. Do not merge until 1 to 3 hold; comment only for 4 and 5.

- [ ] **1. Client-safe (required):** no client or prospect names, code, URLs, ticket IDs or people, in the file, every commit message on the branch, the branch name and the PR body
- [ ] **2. Real:** the setup was actually run; `verified_on` and `tool_versions` are plausible; it is not a generic tip with no concrete setup
- [ ] **3. Specific:** a reader could reproduce it from Setup plus Steps without asking the author
- [ ] **4. Not a duplicate:** no existing workflow is already the same thing (if one is, suggest editing that one)
- [ ] **5. Safe to copy:** risky flags carry a `Warning:` line, and nothing turns off permissions without saying so
- [ ] **6. Diagram (only if this PR changes it):** If this PR adds or changes `diagram`: open the workflow at 360px and confirm the diagram matches the prose.
