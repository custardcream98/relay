#!/usr/bin/env bash
# PreToolUse hook for Edit and Write tools: block the orchestrator from directly editing
# code files. The orchestrator must delegate file changes to worker agents via create_task.
# Subagents (spawned via Agent tool) are allowed — detected by /subagents/ in transcript_path.

PAYLOAD=$(cat -)
RELAY_DIR="${RELAY_DIR:-.relay}"

# Check for active orchestrator session (any orchestrator-*.json file)
ORCH_FILES=("${RELAY_DIR}"/orchestrator-*.json)
[ ! -f "${ORCH_FILES[0]}" ] && exit 0

# Allow subagents — their transcript_path contains /subagents/
TRANSCRIPT=$(echo "$PAYLOAD" | jq -r '.transcript_path // empty' 2>/dev/null || true)
case "$TRANSCRIPT" in
  */subagents/*) exit 0 ;;
esac

# Extract the file path from the tool input
FILE_PATH=$(echo "$PAYLOAD" | jq -r '.tool_input.file_path // empty' 2>/dev/null || true)
[ -z "$FILE_PATH" ] && exit 0

# Canonicalize FILE_PATH to eliminate path traversal sequences
if command -v python3 >/dev/null 2>&1; then
  FILE_PATH=$(python3 -c "import os,sys; print(os.path.realpath(sys.argv[1]))" "$FILE_PATH" 2>/dev/null || echo "$FILE_PATH")
elif command -v realpath >/dev/null 2>&1; then
  FILE_PATH=$(realpath -m "$FILE_PATH" 2>/dev/null || echo "$FILE_PATH")
elif readlink -f / >/dev/null 2>&1; then
  FILE_PATH=$(readlink -f "$FILE_PATH" 2>/dev/null || echo "$FILE_PATH")
elif [ "${FILE_PATH#/}" = "$FILE_PATH" ]; then
  FILE_PATH="$(pwd)/${FILE_PATH}"
fi

PROJECT_ROOT="$(pwd)"

# Allow writes to relay directory (orchestrator metadata files)
case "$FILE_PATH" in
  "${PROJECT_ROOT}/${RELAY_DIR}/"*) exit 0 ;;
esac

# Allow writes to .claude/plans/ directory (plan mode files)
case "$FILE_PATH" in
  "${PROJECT_ROOT}/.claude/plans/"*) exit 0 ;;
esac

# Block all other file edits by the orchestrator
jq -n --arg fp "$FILE_PATH" \
  '{"decision":"block","reason":("Orchestrator must not directly edit files. Assign implementation work to agents via create_task. Blocked path: " + $fp)}'
