# News schedule (launchd)

`install.sh` writes `~/Library/LaunchAgents/tech.firstmate.playground.news.plist` and loads it with `launchctl bootstrap`. `uninstall.sh` unloads and removes it (the log is kept). Both are idempotent.

```
ops/launchd/install.sh      # npm run news:schedule:install
ops/launchd/uninstall.sh    # npm run news:schedule:uninstall
```

Install from the primary checkout (not a worktree that may be deleted), after `npm ci` and with `.env.local` filled in. The installer resolves absolute paths for `node`, `npm` and `claude` from the shell you run it in and fails loudly if `node` or `claude` is missing. Reinstall if the repo moves or you change where node or claude live (nvm upgrade, etc.).

## Why hourly + a gate, not a fixed 08:00 entry

The PRD wants the digest at 08:00 Asia/Manila. `StartCalendarInterval` is interpreted in the Mac's local time zone, so there are two ways to get Manila 08:00:

1. **Convert 08:00 Manila to local time at install time.** It is correct on the day of install and wrong after any time-zone change, travel or DST shift, and it silently stays wrong until someone reinstalls. It also needs an install-time timezone lookup that varies by macOS version.
2. **Fire every hour and gate on Manila time (chosen).** The agent fires at minute 0 of every hour and runs `news:run -- --gate --publish`. The gate (`scripts/news/gate.ts`) does nothing unless the Manila hour is 08 or later and no scheduled run has finished (success or partial) for today's Manila date. It uses the Manila calendar date, not the Mac's, so a Mac in any time zone produces the same digest date.

Consequences, all wanted:

- No reinstall after a time-zone change; nothing to convert.
- Mac asleep at 08:00: launchd fires the missed interval on wake and the gate opens. Mac powered off at 08:00: `RunAtLoad` evaluates the gate at boot/login.
- Failed run (for example Docker or `supabase start` not up yet): the next hourly firing retries until a run ends `success` or `partial`, so the M5 target (>= 90% of mornings) does not depend on the Mac being ready at exactly 08:00.
- Only one scheduled digest run per Manila day; extra firings exit 0 in milliseconds with a one-line log entry (`gate closed: ...`). `npm run news:run` (no `--gate`) always runs.

The trade-off is 24 short process starts a day (each is a Node start, then an immediate exit when gated), which is negligible.

## Where things live

- Log: `~/Library/Logs/fm-playground/news.log` (stdout and stderr, appended; lines carry Manila timestamps; prompts and item text are never logged).
- Spool and lock: `.news-spool/` in the repo (gitignored): `run.lock`, unreplayed `*.jsonl`, `last-scheduled.json` (the gate marker), and the staged snapshot JSON.
- The plist sets `NEWS_TRIGGER=schedule`, so scheduled runs are recorded with `trigger=schedule`.

## Verify (after the orchestrator installs it)

```
launchctl print gui/$(id -u)/tech.firstmate.playground.news
tail -f ~/Library/Logs/fm-playground/news.log
```

To trigger a gated run immediately: `launchctl kickstart gui/$(id -u)/tech.firstmate.playground.news`.
