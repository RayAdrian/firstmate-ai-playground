# ex-4-3: A browser MCP finds a visual bug

`app/page.jsx` is a small pricing page with three visual bugs. Some only show on a phone-width viewport. You will not find them by skimming the CSS. Give your agent a browser instead.

## Setup

```bash
cp -r exercises/ex-4-3-mcp-browser/starter ~/fm-ex/ex-4-3-mcp-browser
cd ~/fm-ex/ex-4-3-mcp-browser
npm i
npm run dev        # http://localhost:3474
```

The first `npx @playwright/mcp@latest` run may download a browser build. Allow a minute.

## Add the Playwright MCP server

Claude Code (local scope by default; `--scope project` writes `.mcp.json`):

```bash
claude mcp add playwright -- npx @playwright/mcp@latest --isolated
claude mcp list
```

Codex CLI (writes to `~/.codex/config.toml`):

```bash
codex mcp add playwright -- npx @playwright/mcp@latest --isolated
codex mcp list
```

Then start your tool and run `/mcp` to confirm the server is connected.

## What to do

1. Ask the agent to open the page at 375x812, screenshot it and report layout problems with numbers.
2. Write what it found to `REPRO.md` before touching any CSS.
3. Fix `app/pricing.module.css`.
4. Ask the agent to re-check at 375, 768 and 1440 wide.

## Verify

Do not run `npm test` until `REPRO.md` is written: its failure messages spell out the fixes.

```bash
npm test
```

The tests check the three bug fixes in the stylesheet and that `REPRO.md` exists with a real reproduction. They do not open a browser. The browser check is yours, and the checklist asks for it.
