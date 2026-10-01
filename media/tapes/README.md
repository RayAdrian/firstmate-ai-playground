# VHS recordings (PRD section 15, MD-5)

Three terminal recordings, scripted with [VHS](https://github.com/charmbracelet/vhs).

| id (= lesson slug) | Shows | Model calls |
|---|---|---|
| `l1-first-session` | `--version` and a `--help` excerpt for both CLIs | no |
| `l4-mcp-servers` | `mcp add` and `mcp list` for both CLIs against a pinned local stdio server, and where each stores it | no |
| `l3-headless-agents` | `claude -p --output-format json` and `codex exec --json` on a one-word prompt | **yes** (maintainer only, logged-in CLIs) |

## Prerequisites

`brew install vhs webp` (vhs brings ttyd and ffmpeg), plus `jq`, Node, and `claude` and `codex` on PATH. Recording happens on an engineer's Mac. CI only checks the committed output.

## Record

```bash
npm run media:record                      # the no-model items (1.1 and 4.3)
npm run media:record -- l4-mcp-servers    # one item
```

`record.sh` runs each tape under `env -i` (nothing from your environment reaches the recording), with a throwaway `HOME` and `CODEX_HOME` in `/tmp/fm` (deleted afterwards). Your real `~/.claude*` and `~/.codex` are never read or written. Then `finalize.mjs` checks the result and, only if everything passes, writes `public/media/lessons/<slug>/<id>.{mp4,webp,vtt,txt,media.json}`:

- duration cap, caption timing (`<id>.captions.json`) against the real duration;
- leak scan of the golden, VTT and transcript: email addresses, your `$USER` and `$HOME`, `sk-` and `sk-ant-` prefixes, and literal key values;
- MP4 at most 4MB and poster at most 60KB;
- `source_hash` is the sha256 of the `.tape` file.

`media/tapes/out/<id>.golden.txt` is the terminal's final screen, reduced from VHS's per-frame text capture (mid-print frames are not deterministic). `out/` is gitignored and cleared on any failure. Re-recording a no-model tape on the same CLI versions gives an identical golden and VTT (checked 3 times) and a duration within 1s. Diff it to check.

`<id>.captions.json` (cue text and times) and `<id>.transcript.txt` (describes what is on screen) are hand-written. When you change a tape's timing, re-check the cue times against the new video.

## Pinned MCP server (4.3)

`mcp-server/` pins `@modelcontextprotocol/server-filesystem` with `package.json` and a lockfile. `record.sh` runs `npm ci --ignore-scripts` there (the only network step), and the recording itself uses no network.

## Recording 3.4 (maintainer, manual)

```bash
npm run media:record -- l3-headless-agents
```

No API keys. This tape uses your logged-in `claude` and `codex`, so it is the only tape that runs with your real `HOME`.

- Log in first (`claude`, then `/login`; `codex login`). The script exits non-zero with a "log in to claude/codex first" message otherwise.
- Never run in CI, and never by `media:record` with no argument.
- It runs in an empty temp directory, in a clean shell that keeps only `HOME`, `USER` and `PATH`. Claude runs with `--safe-mode --tools "" --no-session-persistence`. Codex runs with `--sandbox read-only --ephemeral --ignore-user-config --ignore-rules`, and the prompt tells it not to run commands. `jq` keeps only stable fields.
- The prompt asks for the word `pong`. `finalize.mjs` fails, and writes nothing to `public/`, unless both replies are exactly that.
- The leak guard scans every frame's text, the VTT and the transcript for your username, home path, emails, ids and tokens. It is mandatory: a hit deletes the render and writes nothing.
- Codex has no deterministic latency, so cue 3 and 4 times in `l3-headless-agents.captions.json` can drift by a few seconds. Check them against the new video.
- After recording, open the MP4 and check no frame shows a home path, account or id.

## Files

`common.tape` (shared size, font, theme from `docs/design/tokens.css`), `*.tape`, `*.captions.json`, `*.transcript.txt`, `items.json` (manifest metadata), `lib.mjs` (pure helpers, unit-tested in `tests/unit/v2/`), `finalize.mjs`, `record.sh`.
