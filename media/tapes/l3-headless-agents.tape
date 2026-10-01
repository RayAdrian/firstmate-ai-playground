# 3.4 l3-headless-agents: the shape of headless JSON output from each CLI. MODEL-CALLING (two
# one-word calls). Maintainer-only: `ANTHROPIC_API_KEY=... OPENAI_API_KEY=... npm run media:record -- l3-headless-agents`.
# Never run in CI, and never by `media:record` without an argument (PRD 15, MD-5).
#
# Credentials: both keys come from the recorder's env. Every step that touches a key sits inside
# Hide/Show and refers to it only by variable NAME. The tape never types, echoes or printenv's a
# value into view, and the throwaway CODEX_HOME holding the login is deleted by record.sh.
# Prompt: asks for the one word "pong". record.sh fails and writes nothing to public/ unless
# both replies are exactly that word (the Wait lines below also time out on any other reply).
# Verified flags on claude 2.1.286 / codex 0.154.0: `claude -p --output-format json --tools ""`,
# `codex login --with-api-key` (key on stdin), `codex exec --json --sandbox read-only`.
# Not verified without a key: the exact `item.completed` event shape the codex jq filter selects;
# the maintainer's first recording confirms it (the Wait line fails if it is wrong).
Source media/tapes/common.tape
Set TypingSpeed 35ms
# The two commands below are long by nature (flags + jq filter), so this tape uses a slightly
# smaller font than common.tape and lets them wrap.
Set FontSize 26
Output media/tapes/out/l3-headless-agents.mp4
Output media/tapes/out/l3-headless-agents.golden.txt

Hide
Type "mkdir -p /tmp/fm/home/.codex /tmp/fm/work && cd /tmp/fm/work"
Enter
Type `exec env -i HOME=/tmp/fm/home CODEX_HOME=/tmp/fm/home/.codex PATH="$PATH" TERM=xterm-256color LANG=en_US.UTF-8 ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" OPENAI_API_KEY="$OPENAI_API_KEY" bash --noprofile --norc`
Enter
Type `export PS1='$ '`
Enter
Type `printenv OPENAI_API_KEY | codex login --with-api-key > /dev/null 2>&1; unset OPENAI_API_KEY`
Enter
Sleep 2s
Type "clear"
Enter
Sleep 500ms
Show

Sleep 1s
Type `claude -p "Reply with only the word pong." --output-format json --tools "" --no-session-persistence | jq '{type, is_error, result}'`
Enter
Wait+Screen@60s /"result": "pong"/
Sleep 3s

Hide
Type "clear"
Enter
Show
Sleep 500ms

Type `codex exec --json --sandbox read-only --skip-git-repo-check --ephemeral "Reply with only the word pong. Do not run commands." | jq -c 'select(.item.type == "agent_message") | .item | {type, text}'`
Enter
Wait+Screen@60s /"text":"pong"/
Sleep 4s
