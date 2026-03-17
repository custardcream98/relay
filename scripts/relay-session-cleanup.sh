#!/usr/bin/env bash
# SessionEnd hook: clean up the orchestrator state file when a Claude Code session ends.
# Runs asynchronously — failure is silently ignored.

PAYLOAD=$(cat -)
SESSION_ID=$(echo "$PAYLOAD" | jq -r '.session_id // empty' 2>/dev/null || true)
[ -z "$SESSION_ID" ] && exit 0

# Validate session_id to prevent path traversal (must be alphanumeric, dash, underscore only)
if ! echo "$SESSION_ID" | grep -qE '^[a-zA-Z0-9_-]+$'; then
  exit 0
fi

STATE_FILE=".relay/sessions/${SESSION_ID}.json"
[ -f "$STATE_FILE" ] && rm -f "$STATE_FILE" 2>/dev/null || true
exit 0
