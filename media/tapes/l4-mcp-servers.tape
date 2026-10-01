# 4.3 l4-mcp-servers: add and list one local stdio MCP server in each CLI. NO model calls, no network.
# The server is @modelcontextprotocol/server-filesystem, version-pinned in media/tapes/mcp-server/
# (package.json + lockfile, installed by record.sh with `npm ci`).
Source media/tapes/common.tape
Output media/tapes/out/l4-mcp-servers.mp4
Output media/tapes/out/l4-mcp-servers.golden.txt

# Setup, hidden: a clean shell on a throwaway HOME. `fs-server.js` is a symlink to the pinned
# server's entry point (record.sh exports FM_MCP_SERVER_JS) so the typed command stays short.
# Verified on claude 2.1.286 and codex 0.154.0: `mcp add` and `mcp list` print no first-run,
# onboarding or trust prompt in a fresh HOME, so nothing needs pre-seeding.
Hide
Type "mkdir -p /tmp/fm/home/.codex /tmp/fm/work && cd /tmp/fm/work && ln -s $FM_MCP_SERVER_JS fs-server.js"
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
Type "claude mcp add docs -- node fs-server.js ."
Enter
Sleep 4s

Type "claude mcp list"
Enter
Sleep 5s

Hide
Type "clear"
Enter
Show
Sleep 500ms

Type "codex mcp add docs -- node fs-server.js ."
Enter
Sleep 3s

Type "codex mcp list"
Enter
Sleep 4s

Hide
Type "clear"
Enter
Show
Sleep 500ms

Type "cat ~/.codex/config.toml"
Enter
Sleep 5s
