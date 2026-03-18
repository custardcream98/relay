#!/usr/bin/env bash
# Stop hook: prevent the orchestrator from stopping when the relay session is incomplete.
# Scans all .relay/orchestrator-*.json files. If ANY session has pending tasks, block stop.
# Subagents (spawned via Agent tool) are always allowed to stop.

# Read stdin payload (must consume stdin before any other operations)
PAYLOAD=$(cat -)
RELAY_DIR="${RELAY_DIR:-.relay}"

# Allow subagents — their transcript_path contains /subagents/
TRANSCRIPT=$(echo "$PAYLOAD" | jq -r '.transcript_path // empty' 2>/dev/null || true)
case "$TRANSCRIPT" in
  */subagents/*) exit 0 ;;
esac

# Check for active orchestrator session (any orchestrator-*.json file)
ORCH_FILES=("${RELAY_DIR}"/orchestrator-*.json)
[ ! -f "${ORCH_FILES[0]}" ] && exit 0

# Loop over all orchestrator state files
for STATE_FILE in "${RELAY_DIR}"/orchestrator-*.json; do
  [ ! -f "$STATE_FILE" ] && continue

  # Parse state fields
  DASHBOARD_PORT=$(jq -r '.dashboard_port // 3456' "$STATE_FILE" 2>/dev/null || echo "3456")
  # Validate port — must be a 1-5 digit number to prevent curl argument injection
  if ! echo "$DASHBOARD_PORT" | grep -qE '^[0-9]{1,5}$'; then
    DASHBOARD_PORT="3456"
  fi
  RELAY_SESSION_ID=$(jq -r '.relay_session_id // empty' "$STATE_FILE" 2>/dev/null || true)
  # Validate relay session ID — prevent URL injection in curl request
  if [ -n "$RELAY_SESSION_ID" ] && ! echo "$RELAY_SESSION_ID" | grep -qE '^[a-zA-Z0-9_-]+$'; then
    RELAY_SESSION_ID=""
  fi
  ITERATION=$(jq -r '.iteration // 0' "$STATE_FILE" 2>/dev/null || echo "0")
  # Validate ITERATION is a non-negative integer with a digit cap to prevent bash arithmetic overflow.
  # '^[0-9]+$' would accept 20+ digit values that silently overflow; cap to 10 digits (max ~4 billion).
  if ! echo "$ITERATION" | grep -qE '^[0-9]{1,10}$'; then
    ITERATION="0"
  fi
  CREATED_AT=$(jq -r '.created_at // 0' "$STATE_FILE" 2>/dev/null || echo "0")
  # Validate CREATED_AT is a non-negative integer with digit cap (matches ITERATION pattern)
  if ! echo "$CREATED_AT" | grep -qE '^[0-9]{1,10}$'; then
    CREATED_AT="0"
  fi

  # Circuit breaker: allow stop after 50 iterations to prevent infinite loops.
  # NOTE: This counter is self-managed by this hook — incremented once per block decision.
  # It is independent of the orchestrator event loop's "iteration" counter saved via
  # save_orchestrator_state (which tracks SKILL.md loop iterations, not hook invocations).
  if [ "$ITERATION" -ge 50 ]; then
    continue
  fi

  # Stale guard: allow stop if state file is older than 6 hours (21600 seconds)
  if [ "$CREATED_AT" -gt 0 ]; then
    NOW=$(date +%s)
    AGE=$((NOW - CREATED_AT))
    if [ "$AGE" -gt 21600 ]; then
      continue
    fi
  fi

  # No relay session ID — can't check completion, skip this file
  [ -z "$RELAY_SESSION_ID" ] && continue

  # Query the completion check endpoint (fail-open: allow stop if server unreachable)
  RESPONSE=$(curl -sf --max-time 5 \
    "http://localhost:${DASHBOARD_PORT}/api/sessions/${RELAY_SESSION_ID}/completion-check" \
    2>/dev/null || true)
  [ -z "$RESPONSE" ] && continue

  ALL_DONE=$(echo "$RESPONSE" | jq -r '.all_done // false' 2>/dev/null || echo "false")
  TOTAL=$(echo "$RESPONSE" | jq -r '.total_count // 0' 2>/dev/null || echo "0")
  DONE_COUNT=$(echo "$RESPONSE" | jq -r '.done_count // 0' 2>/dev/null || echo "0")

  # Skip if all tasks are done or no tasks exist
  if [ "$ALL_DONE" = "true" ] || [ "$TOTAL" = "0" ]; then
    continue
  fi

  # Increment iteration counter in state file (temp-write-rename for atomicity)
  NEW_ITERATION=$((ITERATION + 1))
  TMP=$(mktemp "${STATE_FILE}.XXXXXX")
  jq ".iteration = ${NEW_ITERATION}" "$STATE_FILE" > "$TMP" && mv "$TMP" "$STATE_FILE" || true

  # Block the stop with a helpful message
  printf '{"decision":"block","reason":"Session incomplete: %s/%s tasks done. Resume event loop: call get_messages() and get_all_tasks() to find pending work, then continue orchestrating."}\n' \
    "$DONE_COUNT" "$TOTAL"
  exit 0
done

# All sessions are complete (or no active sessions) — allow stop
exit 0
