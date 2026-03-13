#!/usr/bin/env bash
# hooks/post-tool-use.sh
# MCP 메시지/태스크/아티팩트 툴 호출 시 대시보드에 agent:status 이벤트 push
# Claude Code는 stdin으로 JSON 주입: { tool_name, tool_input, tool_response, ... }
# MCP 툴의 tool_name 형식: "mcp__relay__send_message" (install.ts의 matcher와 일치해야 함)

RELAY_DASHBOARD_PORT="${RELAY_DASHBOARD_PORT:-3456}"

# stdin에서 페이로드 읽기
PAYLOAD=$(cat)

# 대시보드가 실행 중이면 상태 갱신 요청 (페이로드 그대로 전달)
curl -s -X POST "http://localhost:${RELAY_DASHBOARD_PORT}/api/hook/tool-use" \
  --header "Content-Type: application/json" \
  --data "$PAYLOAD" \
  > /dev/null 2>&1 || true  # 대시보드 미실행 시 무시
