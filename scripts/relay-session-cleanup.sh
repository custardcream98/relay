#!/usr/bin/env bash
# SessionEnd hook: clean up stale orchestrator state files.
# Normal cleanup happens in SKILL.md wrap-up. This is a safety net for abnormal exits.
# Runs asynchronously — failure is silently ignored.

PAYLOAD=$(cat -)
RELAY_DIR="${RELAY_DIR:-.relay}"

# Subagent session ending — do NOT delete orchestrator state
TRANSCRIPT=$(echo "$PAYLOAD" | jq -r '.transcript_path // empty' 2>/dev/null || true)
case "$TRANSCRIPT" in
  */subagents/*) exit 0 ;;
esac

# Clean up stale orchestrator files (older than 6 hours)
NOW=$(date +%s)
for STATE_FILE in "${RELAY_DIR}"/orchestrator-*.json; do
  [ ! -f "$STATE_FILE" ] && continue
  CREATED_AT=$(jq -r '.created_at // 0' "$STATE_FILE" 2>/dev/null || echo "0")
  if ! echo "$CREATED_AT" | grep -qE '^[0-9]{1,10}$'; then
    CREATED_AT="0"
  fi
  if [ "$CREATED_AT" -gt 0 ]; then
    AGE=$((NOW - CREATED_AT))
    [ "$AGE" -gt 21600 ] && rm -f "$STATE_FILE"
  fi
done
exit 0
