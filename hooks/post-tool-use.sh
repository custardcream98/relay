#!/usr/bin/env bash
# PostToolUse hook: forwards agent status to the dashboard in real time when an MCP tool is called

DASHBOARD_URL="${RELAY_DASHBOARD_URL:-http://localhost:3456}"

# Pipe stdin directly (--data-raw can hit ARG_MAX limits)
cat | curl -s -X POST "${DASHBOARD_URL}/api/hook/tool-use" \
  -H "Content-Type: application/json" \
  --data-binary @- \
  > /dev/null 2>&1 || true
