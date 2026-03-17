## api-structure

### Entry Point
- `packages/server/src/index.ts`: Node.js HTTP+WebSocket 서버(기본 포트 3456) 시작 후 MCP 서버(stdio) 시작
- 두 서버가 동일 프로세스에서 실행됨

### MCP Tools (총 23개, packages/server/src/mcp.ts)
**Messaging**: `send_message`, `get_messages`
**Tasks**: `create_task`, `update_task`, `claim_task`, `get_all_tasks`
**Artifacts**: `post_artifact`, `get_artifact`
**Review**: `request_review`, `submit_review`
**Memory**: `read_memory`, `write_memory`, `append_memory`
**Sessions**: `save_session_summary`, `list_sessions`, `get_session_summary`, `save_orchestrator_state`, `get_orchestrator_state`
**Agents**: `list_agents`, `list_pool_agents`
**Other**: `broadcast_thinking`, `start_session`, `get_server_info`

### Hono REST API (packages/server/src/dashboard/hono.ts)
- `GET /api/agents` — 에이전트 목록 (캐싱)
- `GET /api/session` — 현재 세션 스냅샷 (tasks + messages + artifacts)
- `GET /api/sessions/:id/events` — 세션 이벤트 (히스토리 리플레이용)
- `GET /api/sessions/:id` — 세션 요약
- `POST /api/hook/tool-use` — PostToolUse 훅 수신 → `agent:status:working` 브로드캐스트
- `GET /*` — React SPA fallback (index.html 서빙)
- Static: `/assets/*` → 빌드된 dashboard 디렉토리

### WebSocket
- `GET /ws` — WebSocket 업그레이드 (`ws` 라이브러리)
- 단방향 서버→클라이언트 브로드캐스트 (클라이언트 발신 메시지 미사용)
- broadcast() 함수로 모든 MCP 도구 결과 후 이벤트 전송

### Patterns
- 모든 MCP 도구 핸들러는 `{ success: boolean, ...fields }` 플랫 구조 반환 (중첩 `data` 필드 없음)
- 도구마다 `agent_id` 파라미터 필수 (추적용)
- SESSION_ID: `process.env.RELAY_SESSION_ID ?? "default"`
- RELAY_DIR: `process.env.RELAY_DIR ?? cwd()/.relay`

## store-schema

### In-Memory Store (store.ts)
SQLite/bun:sqlite 없음. 모든 세션 데이터는 `store.ts`의 배열/Map에 보관됨 — 서버 재시작 시 소멸(ephemeral).
테스트 격리: `_resetStore()` 사용.

### 주요 컬렉션

**messages**: `{ id, session_id, from_agent, to_agent (null=브로드캐스트), content, thread_id, created_at }`

**tasks**: `{ id, session_id, title, description, assignee, status ('todo'|'in_progress'|'in_review'|'done'), priority ('critical'|'high'|'medium'|'low'), created_by, created_at, updated_at }`
- `claim_task()`: 원자적 체크 — status='todo' AND (assignee=agentId OR assignee IS NULL)

**artifacts**: `{ id, session_id, name, type, content, created_by, task_id, created_at }`

**reviews**: `{ id, session_id, artifact_id, reviewer, requester, status ('pending'|'approved'|'changes_requested'), comments, created_at, updated_at }`
- 권한 검사: submit_review 시 agent_id == reviewer 확인

**events**: `{ id, session_id, type, agent_id, payload (object), created_at }`
- 대시보드 히스토리 리플레이용 이벤트 로그

### Memory (파일 기반, .relay/memory/)
- `project.md` — 공유 프로젝트 메모리 (write_memory로 섹션 단위 upsert)
- `agents/{id}.md` — 에이전트 개인 메모리 (## key 헤더 섹션 구조)
- 세션 회고는 save_session_summary로 저장 (lessons.md 폐지됨)

### Sessions (파일 기반, .relay/sessions/)
- `{session_id}/summary.md`

## external-deps

### Runtime & Build
- **Runtime (production)**: Node.js (`node:` 내장 모듈 사용)
- **Dev tooling**: Bun (`bun run`, `bun test` — Bun API는 프로덕션 src/에 사용 금지)
- **Version**: @types/bun (테스트 파일의 bun:test 타입 지원용)

### Key Dependencies (packages/server/package.json)
- `@modelcontextprotocol/sdk ^1.27.1` — MCP 서버/전송 계층 (McpServer, StdioServerTransport)
- `@hono/node-server` — Hono Node.js 어댑터
- `hono ^4.12.7` — Hono REST API 프레임워크
- `ws` — WebSocket 서버
- `js-yaml ^4.1.1` — agents.pool.yml 파싱
- `zod ^4.3.6` — MCP 도구 입력 파라미터 유효성 검사

### Security Patterns
- agent_id / session_id: `/^[a-zA-Z0-9_-]+$/` 정규식으로 path traversal 방지
- memory key: 개행 문자 불허
- task update: 허용 컬럼 화이트리스트 (ALLOWED_UPDATE_KEYS)

### Published Package
- `@custardcream/relay` v0.13.1, bin: `relay → dist/index.js`
- npx 실행: `npx -y --package @custardcream/relay relay`
