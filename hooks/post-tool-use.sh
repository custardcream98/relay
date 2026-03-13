#!/usr/bin/env bash
# PostToolUse 훅: MCP 툴 호출 시 대시보드에 에이전트 상태를 실시간으로 전달

DASHBOARD_URL="${RELAY_DASHBOARD_URL:-http://localhost:3456}"

# stdin을 직접 파이프로 전달 (--data-raw는 ARG_MAX 제한에 걸릴 수 있음)
cat | curl -s -X POST "${DASHBOARD_URL}/api/hook/tool-use" \
  -H "Content-Type: application/json" \
  --data-binary @- \
  > /dev/null 2>&1 || true
