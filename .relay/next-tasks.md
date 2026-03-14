# 팀 세션 후 작업 목록

> 세션 2026-03-14-003 완료 후 처리할 대시보드 버그/개선 사항

## 1. 버그: 에이전트 카드 "No activity yet" (task 이벤트 미반영)

**현상**: 에이전트에게 태스크가 배정됐는데도 왼쪽 패널에 "No activity yet" 표시.
에이전트 카드의 마지막 활동 텍스트가 `message:new` 이벤트에서만 업데이트됨.
`task:updated` 이벤트(assignee 기준)는 카드에 반영 안 됨.

**수정 방향**: `App.tsx`의 `EVENT` 액션 핸들러에서 `task:updated` 수신 시
해당 task의 `assignee` 에이전트 카드 lastMessage도 업데이트.
예: "Task assigned: [태스크 제목]" 또는 "1 task in progress"

---

## 2. 구조 문제: 태스크 보드가 source of truth로 존중 안 됨

**현상**: 에이전트들이 실제 작업은 다 하는데 태스크 보드는 거의 비워지지 않음.
일이 끝났다고 선언해도 TODO 6개 남아있는 상태. 보드가 장식에 가깝다.

**진짜 원인**:
1. **에이전트 discipline**: `claim_task` → 작업 → `update_task(done)` 흐름을 안 지킴.
   marketer가 8개 파일 수정했는데 자기 태스크는 todo 그대로.
2. **오케스트레이터 로직**: `end:_done` 수락 조건이 "QA 사인오프 메시지" 기반.
   실제 `get_all_tasks()` 결과와 무관하게 세션 종료 선언.

**해결 방향**:

A. **skill/SKILL.md 수정** — `end:_done` 수락 조건에 태스크 검증 추가:
   ```
   end:_done 수락 전: get_all_tasks()로 todo/in_progress 태스크가 0인지 확인.
   남아있으면 해당 에이전트 재스폰하여 update_task 하도록 지시.
   ```

B. **에이전트 system prompt 강화** — agents.yml의 각 에이전트 prompt에:
   ```
   작업 완료 = 파일 수정 + update_task(status: "done") 두 가지 모두.
   end:_done/end:waiting 선언 직전에 반드시 get_my_tasks()로 미완 태스크 확인.
   ```

---

## 3. 미구현: Thoughts 패널 ("Waiting for reasoning..." 고정)

**현상**: `agent:thinking` WebSocket 이벤트가 정의되어 있고 UI도 핸들링하지만
아무도 이 이벤트를 emit하지 않아 항상 "Waiting for reasoning..." 상태.

**구현 방향 (방안 A — `broadcast_thinking` MCP 툴 추가)**:
1. `packages/server/src/tools/` 에 `broadcast_thinking(agent_id, content)` MCP 툴 추가
2. 서버에서 `agent:thinking` WebSocket 이벤트로 broadcast
3. 각 에이전트 system prompt에 작업 전 호출 권장 추가
   예: "Before each significant operation, call broadcast_thinking with what you're about to do"

**제약**: 실시간 토큰 스트리밍은 아니고 에이전트가 명시적으로 호출해야 함.
그래도 "지금 X를 분석 중입니다" 정도의 visibility는 제공 가능.
