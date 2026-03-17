#!/usr/bin/env bash
# PreToolUse hook for Edit and Write tools: block the orchestrator from directly editing
# code files. The orchestrator must delegate file changes to worker agents via create_task.
# Reads the tool input JSON payload from stdin (Claude Code PreToolUse hook format).

# Read stdin payload
PAYLOAD=$(cat -)
SESSION_ID=$(echo "$PAYLOAD" | jq -r '.session_id // empty' 2>/dev/null || true)
[ -z "$SESSION_ID" ] && exit 0

# Validate session_id to prevent path traversal (must be alphanumeric, dash, underscore only)
if ! echo "$SESSION_ID" | grep -qE '^[a-zA-Z0-9_-]+$'; then
  exit 0
fi

STATE_FILE=".relay/sessions/${SESSION_ID}.json"
[ ! -f "$STATE_FILE" ] && exit 0

TYPE=$(jq -r '.type // empty' "$STATE_FILE" 2>/dev/null || true)
[ "$TYPE" != "orchestrator" ] && exit 0

# Extract the file path from the tool input
FILE_PATH=$(echo "$PAYLOAD" | jq -r '.tool_input.file_path // empty' 2>/dev/null || true)
[ -z "$FILE_PATH" ] && exit 0

# Canonicalize FILE_PATH to eliminate path traversal sequences (e.g. "/../", symlinks).
# Tries python3 os.path.realpath first (most portable on macOS), then realpath, then readlink -f.
# Falls back to simple absolute-path expansion only if all are unavailable.
if command -v python3 >/dev/null 2>&1; then
  FILE_PATH=$(python3 -c "import os,sys; print(os.path.realpath(sys.argv[1]))" "$FILE_PATH" 2>/dev/null || echo "$FILE_PATH")
elif command -v realpath >/dev/null 2>&1; then
  FILE_PATH=$(realpath -m "$FILE_PATH" 2>/dev/null || echo "$FILE_PATH")
elif readlink -f / >/dev/null 2>&1; then
  FILE_PATH=$(readlink -f "$FILE_PATH" 2>/dev/null || echo "$FILE_PATH")
elif [ "${FILE_PATH#/}" = "$FILE_PATH" ]; then
  FILE_PATH="$(pwd)/${FILE_PATH}"
fi

# Project root anchored allowlists
PROJECT_ROOT="$(pwd)"

# Allow writes to .relay/ directory (orchestrator metadata files)
case "$FILE_PATH" in
  "${PROJECT_ROOT}/.relay/"*) exit 0 ;;
esac

# Allow writes to .claude/plans/ directory (plan mode files) — anchored to project root
case "$FILE_PATH" in
  "${PROJECT_ROOT}/.claude/plans/"*) exit 0 ;;
esac

# Block all other file edits by the orchestrator
# Use jq to ensure FILE_PATH is properly JSON-escaped (handles paths with quotes or backslashes)
jq -n --arg fp "$FILE_PATH" \
  '{"decision":"block","reason":("Orchestrator must not directly edit files. Assign implementation work to agents via create_task. Blocked path: " + $fp)}'
