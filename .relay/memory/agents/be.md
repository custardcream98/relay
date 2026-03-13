## api-structure

### Entry Point
- `packages/server/src/index.ts`: Bun.serve()로 HTTP+WebSocket 서버(기본 포트 3456) 시작 후 MCP 서버(stdio) 시작
- 두 서버가 동일 프로세스에서 실행됨

### MCP Tools (총 16개, packages/server/src/mcp.ts)
**Messaging**: `send_message`, `get_messages`
**Tasks**: `create_task`, `update_task`, `get_my_tasks`, `claim_task`, `get_team_status`, `get_all_tasks`
**Artifacts**: `post_artifact`, `get_artifact`
**Review**: `request_review`, `submit_review`
**Memory**: `read_memory`, `write_memory`, `append_memory`
**Sessions**: `save_session_summary`, `list_sessions`, `get_session_summary`
**Agents**: `list_agents`, `get_workflow`

### Hono REST API (packages/server/src/dashboard/hono.ts)
- `GET /api/agents` — 에이전트 목록 (캐싱)
- `GET /api/session` — 현재 세션 스냅샷 (tasks + messages + artifacts)
- `GET /api/sessions/:id/events` — 세션 이벤트 (히스토리 리플레이용)
- `GET /api/sessions/:id` — 세션 요약
- `POST /api/hook/tool-use` — PostToolUse 훅 수신 → `agent:status:working` 브로드캐스트
- `GET /*` — React SPA fallback (index.html 서빙)
- Static: `/assets/*` → 빌드된 dashboard 디렉토리

### WebSocket
- `GET /ws` — Bun 네이티브 WebSocket 업그레이드
- 단방향 서버→클라이언트 브로드캐스트 (클라이언트 발신 메시지 미사용)
- broadcast() 함수로 모든 MCP 도구 결과 후 이벤트 전송

### Patterns
- 모든 MCP 도구 핸들러는 `{ success: boolean, data?, error? }` 형식 반환
- 도구마다 `agent_id` 파라미터 필수 (추적용)
- SESSION_ID: `process.env.RELAY_SESSION_ID ?? "default"`
- RELAY_DIR: `process.env.RELAY_DIR ?? cwd()/.relay`

## db-schema

### SQLite (bun:sqlite, WAL 모드)
DB 경로: `process.env.DB_PATH ?? "relay.db"`
싱글턴 패턴 (getDb() in db/client.ts)

### Tables

**messages**
- id TEXT PK, session_id TEXT, from_agent TEXT, to_agent TEXT (nullable = 브로드캐스트), content TEXT, thread_id TEXT (nullable), created_at INTEGER (unixepoch)
- Index: (session_id, to_agent)

**tasks**
- id TEXT PK, session_id TEXT, title TEXT, description TEXT, assignee TEXT (nullable), status TEXT ('todo'|'in_progress'|'in_review'|'done'), priority TEXT ('critical'|'high'|'medium'|'low'), created_by TEXT, created_at/updated_at INTEGER
- Index: (session_id, assignee)
- `claim_task()`: 원자적 UPDATE — status='todo' AND (assignee=agentId OR assignee IS NULL) 조건

**artifacts**
- id TEXT PK, session_id TEXT, name TEXT, type TEXT ('figma_spec'|'pr'|'report'|'analytics_plan'|'design'), content TEXT, created_by TEXT, task_id TEXT (nullable), created_at INTEGER
- Index: (session_id)

**reviews**
- id TEXT PK, session_id TEXT, artifact_id TEXT, reviewer TEXT, requester TEXT, status TEXT ('pending'|'approved'|'changes_requested'), comments TEXT, created_at/updated_at INTEGER
- Index: (session_id, reviewer)
- 권한 검사: submit_review 시 agent_id == reviewer 확인

**events**
- id TEXT PK, session_id TEXT, type TEXT, agent_id TEXT, payload TEXT (JSON), created_at INTEGER
- Index: (session_id, created_at)
- 대시보드 히스토리 리플레이용 이벤트 로그

### Memory (파일 기반, .relay/memory/)
- `project.md` — 공유 프로젝트 메모리 (write_memory로 섹션 단위 upsert)
- `lessons.md` — 공유 회고/교훈 (append_memory로 날짜 스탬프 추가)
- `agents/{id}.md` — 에이전트 개인 메모리 (## key 헤더 섹션 구조)

### Sessions (파일 기반, .relay/sessions/)
- `{session_id}/summary.md`
- `{session_id}/tasks.json`
- `{session_id}/messages.json`

## external-deps

### Runtime & Build
- **Runtime**: Bun (bun:sqlite, Bun.serve, Bun.file, Bun.write)
- **Version**: @types/bun 1.3.10

### Key Dependencies (packages/server/package.json)
- `@modelcontextprotocol/sdk ^1.27.1` — MCP 서버/전송 계층 (McpServer, StdioServerTransport)
- `hono ^4.12.7` — Hono REST API 프레임워크 (serveStatic, Bun 어댑터)
- `js-yaml ^4.1.1` — agents.yml / agents.default.yml 파싱
- `zod ^4.3.6` — MCP 도구 입력 파라미터 유효성 검사

### Security Patterns
- agent_id / session_id: `/^[a-zA-Z0-9_-]+$/` 정규식으로 path traversal 방지
- memory key: 개행 문자 불허
- task update: 허용 컬럼 화이트리스트 (ALLOWED_UPDATE_KEYS)

### Published Package
- `@custardcream/relay` v0.2.1, bin: `relay-server → dist/index.js`
- npx 실행: `npx -y --package @custardcream/relay relay-server`
