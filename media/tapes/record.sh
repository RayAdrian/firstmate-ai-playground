#!/usr/bin/env bash
# Re-records the VHS items (PRD 15, MD-5). Run from anywhere; it works from the repo root.
#   npm run media:record                      records the no-model items (l1-first-session, l4-mcp-servers)
#   npm run media:record -- <id>              records one item
#   ANTHROPIC_API_KEY=... OPENAI_API_KEY=... npm run media:record -- l3-headless-agents
#       the model tape: a maintainer-only manual step, never run in CI or without its id.
# Needs: vhs (brew install vhs, which brings ttyd), cwebp (brew install webp), ffmpeg, jq, node, and claude + codex on PATH.
set -euo pipefail

cd "$(dirname "$0")/../.."
ROOT="$PWD"
ALL_NO_MODEL=(l1-first-session l4-mcp-servers)
MODEL_TAPE=l3-headless-agents

if [ "$#" -gt 1 ]; then echo "usage: record.sh [item-id]" >&2; exit 2; fi
if [ "$#" -eq 1 ]; then ITEMS=("$1"); else ITEMS=("${ALL_NO_MODEL[@]}"); fi

for tool in vhs cwebp ffmpeg ffprobe jq node npm claude codex; do
  command -v "$tool" >/dev/null || { echo "media:record: '$tool' not found (brew install vhs for the VHS toolchain)" >&2; exit 1; }
done

# A shim dir (for example a terminal app's claude wrapper) must not sit in front of the real CLI.
CLEAN_PATH="$(printf '%s' "$PATH" | tr ':' '\n' | grep -v 'cmux-cli-shims' | paste -sd: -)"

cleanup() { rm -rf /tmp/fm; }
trap cleanup EXIT

for id in "${ITEMS[@]}"; do
  tape="media/tapes/$id.tape"
  [ -f "$tape" ] || { echo "media:record: no tape for '$id' ($tape)" >&2; exit 1; }
  # Fixed throwaway HOME/CODEX_HOME for every tape (the tape itself switches the shell to them).
  cleanup
  extra=()
  if [ "$id" = "$MODEL_TAPE" ]; then
    if [ -z "${ANTHROPIC_API_KEY:-}" ] || [ -z "${OPENAI_API_KEY:-}" ]; then
      echo "media:record: $id calls two models. Export ANTHROPIC_API_KEY and OPENAI_API_KEY in your own shell first." >&2
      exit 1
    fi
    extra=(ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" OPENAI_API_KEY="$OPENAI_API_KEY")
  fi
  if [ "$id" = l4-mcp-servers ]; then
    (cd media/tapes/mcp-server && npm ci --ignore-scripts --no-audit --no-fund >/dev/null)
    extra+=(FM_MCP_SERVER_JS="$ROOT/media/tapes/mcp-server/node_modules/@modelcontextprotocol/server-filesystem/dist/index.js")
  fi
  echo "recording $id ..."
  # env -i: nothing from the recorder's environment reaches the recording, except the keys above.
  # vhs keeps the real HOME only for its own browser cache.
  mkdir -p media/tapes/out
  # If VHS fails (for example a Wait times out on an unexpected reply), delete what it wrote.
  env -i HOME="$HOME" PATH="$CLEAN_PATH" TERM=xterm-256color LANG=en_US.UTF-8 ${extra[@]+"${extra[@]}"} vhs "$tape" \
    || { rm -f "media/tapes/out/$id".*; echo "media:record: vhs failed for $id. Nothing written." >&2; exit 1; }
  node media/tapes/finalize.mjs "$id"
done
