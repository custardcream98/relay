
---
_2026-03-15_

Session 2026-03-16-001-b4f2: Dashboard usability overhaul — Storybook 검증 + FE/BE/MCP 전 레이어 개선. 팀: pm, designer, fe, fe2, be, mcp-architect, qa (7명). 155 tests pass, 0 fail. 주요 변경사항: (1) AgentCard lastActivityTs 타임스탬프, ActivityFeed 필터 배지 + 빈 상태 수정, (2) TaskBoard 빈 컬럼 상태 + 태스크 상세 팝오버 + 드래그 핸들 개선, (3) SessionSelector 컴포넌트 (헤더에 세션 전환 드롭다운), (4) MessageFeed 전면 개편 (아바타, DM/브로드캐스트 구분, 스레드 접기, 읽지않음 배지, 클립보드, 타임스탬프 툴팁), (5) BE: /api/health, /api/sessions/live, /api/sessions/:id/replay, 페이지네이션, WS 핑/퐁 하트비트, (6) MCP: send_message metadata 필드, create_task depends_on 필드, get_all_tasks status 필터, broadcast_thinking → agent:status=working 자동 emit, 18개 툴 설명 개선. Bug M2: claim_task에서 depends_on 미이행 시 차단 로직 추가.

---
_2026-03-15_

Session 2026-03-16-002-c7e3: Multi-instance agent disambiguation UX + task card detail modal.

Key lessons:
- When agents use `extends` in session YAML, `loader.ts` was discarding the base persona ID (`extends: undefined`). Fix: capture `basePersonaId: config.extends` before clearing.
- `getAgentAccent()` uses djb2 hash — fe2 already gets a different color from fe automatically. No palette changes needed.
- AgentCard disambiguation: monospace ID badge (always visible) + `↳ {basePersonaId}` italic subtitle (extends agents only). Clean and minimal.
- Task card detail modal was already partially implemented from a previous session (click handler, Escape, click-outside). This session added MarkdownContent rendering + color-coded status badges.
- When two FE tasks overlap the same file, assign both to one engineer for a single implementation pass — avoids merge conflicts.
- Designer's hue-rotate CSS filter approach (fe2 = base color + hue-rotate(25deg)) is a scalable pattern for N instances without needing explicit palette entries.
