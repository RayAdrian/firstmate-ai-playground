---
name: pr-description
description: Write a pull request description from the current branch's diff (Summary, Why, How to test, Risks). Use when the user asks for a PR description, a PR summary, or to write up their changes for review.
---

Write a pull request description for the current branch.

1. Run `git diff main...HEAD --stat`, then read the diff for the files that matter.
2. Write four short sections: **Summary** (what changed), **Why** (the reason, in one or two sentences), **How to test** (commands or clicks a reviewer can follow), **Risks** (what could break, and what you did not test).
3. Write for a reviewer who has not seen the ticket. No ticket numbers without a link.
4. Show the description in chat. Do not open the pull request unless asked.
