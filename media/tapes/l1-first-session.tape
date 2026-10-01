# 1.1 l1-first-session: what a working install looks like. NO model calls.
# Recorded by media/tapes/record.sh from the repo root, with a throwaway HOME and CODEX_HOME.
Source media/tapes/common.tape
Output media/tapes/out/l1-first-session.mp4
Output media/tapes/out/l1-first-session.golden.txt

# Setup, hidden: swap to a clean shell on the throwaway HOME. Verified on claude 2.1.286 and
# codex 0.154.0: --version and --help print no first-run, onboarding or trust prompt in a fresh
# HOME, so nothing needs pre-seeding.
Hide
Type "mkdir -p /tmp/fm/home/.codex /tmp/fm/work && cd /tmp/fm/work"
Enter
Type `exec env -i HOME=/tmp/fm/home CODEX_HOME=/tmp/fm/home/.codex PATH="$PATH" TERM=xterm-256color LANG=en_US.UTF-8 bash --noprofile --norc`
Enter
Type `export PS1='$ '`
Enter
Type "clear"
Enter
Sleep 500ms
Show

Sleep 1s
Type "claude --version"
Enter
Wait+Screen@20s /Claude Code/
Wait /^\$\s*$/
Sleep 3s

Hide
Type "clear"
Enter
Show
Sleep 500ms

Type `claude --help | head -4`
Enter
Wait+Screen@20s /non-interactive output/
Wait /^\$\s*$/
Sleep 5s

Hide
Type "clear"
Enter
Show
Sleep 500ms

Type "codex --version"
Enter
Wait+Screen@20s /codex-cli/
Wait /^\$\s*$/
Sleep 3s

Hide
Type "clear"
Enter
Show
Sleep 500ms

Type "codex --help | sed -n 9,13p"
Enter
Wait+Screen@20s /exec/
Wait /^\$\s*$/
Sleep 6s
