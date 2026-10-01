# 3.4 l3-headless-agents: the shape of headless JSON output from each CLI. MODEL-CALLING (two
# one-word calls). Maintainer-only: `npm run media:record -- l3-headless-agents`.
# Never run in CI, and never by `media:record` without an argument (PRD 15, MD-5).
#
# Auth: this is the ONLY tape that runs with the maintainer's real HOME, so `claude` and `codex`
# use their existing logins (Keychain, ~/.claude, ~/.codex). There are no API keys. The recording
# is safe because: the commands run in an empty temp directory; Claude runs with --safe-mode and
# no tools; Codex runs read-only with the user config and rules ignored; and only stable fields
# are shown (jq), never session ids, accounts, costs or token counts. finalize.mjs then scans every
# frame's text for usernames, home paths, emails, ids and tokens, and writes nothing on a hit.
# record.sh fails early, with a "log in first" message, if either CLI is not logged in.
# Prompt: asks for the one word "pong". finalize.mjs writes nothing to public/ unless both replies
# are exactly that word (the Wait lines below also time out on any other reply).
# Verified on claude 2.1.286 / codex 0.154.0: `claude -p --safe-mode --output-format json --tools ""`,
# `codex exec --json --sandbox read-only --skip-git-repo-check --ephemeral --ignore-user-config --ignore-rules`.
Source media/tapes/common.tape
Set TypingSpeed 35ms
# The two commands below are long by nature (flags + jq filter), so they wrap onto 3 to 4 rows
# at the shared font size. The JSON results are short and fit on one line each.
Output media/tapes/out/l3-headless-agents.mp4
Output media/tapes/out/l3-headless-agents.golden.txt

# Hidden setup: an empty temp directory and a clean shell that keeps the real HOME (record.sh
# passes it in the environment) and nothing else. Nothing about HOME is ever printed.
Hide
Type "mkdir -p /tmp/fm/work && cd /tmp/fm/work"
Enter
Type `exec env -i HOME="$HOME" USER="$USER" LOGNAME="$USER" TMPDIR="$TMPDIR" PATH="$PATH" TERM=xterm-256color LANG=en_US.UTF-8 bash --noprofile --norc`
Enter
Type `export PS1='$ '`
Enter
Type "clear"
Enter
Sleep 500ms
Show

Sleep 1s
Type `claude -p "Reply with only the word pong." --safe-mode --output-format json --tools "" --no-session-persistence | jq '{type, is_error, result}'`
Enter
Wait+Screen@90s /"result": "pong"/
Wait@10s /^\$\s*$/
Sleep 7s

Hide
Type "clear"
Enter
Show
Sleep 500ms

Type `codex exec --json --sandbox read-only --skip-git-repo-check --ephemeral --ignore-user-config --ignore-rules "Reply with only the word pong. Do not run commands." 2>/dev/null | jq -c 'select(.item.type == "agent_message") | .item | {type, text}'`
Enter
Wait+Screen@90s /"text":"pong"/
Wait@10s /^\$\s*$/
Sleep 7s
