## api-structure

## MCP Server (stdio transport)
- Entry: `packages/server/src/index.ts`
- MCP 서버는 stdio 전송 방식 사용 (`StdioServerTransport`)
- Hono HTTP + Bun WebSocket 서버는 동일 프로세스에서 실행 (기본 포트: `DASHBOARD_PORT` env, 기본값 3456)

## MCP Tools (총 14개)
모두 `packages/server/src/mcp.ts`에서 등록됨. 각 도구는 `agent_id`를 필수 파라미터로 받음.

### Messaging
- `send_message(agent_id, to, content, thread_id?)` — 에이전트 간 메시지 전송 (null이면 broadcast)
- `get_messages(agent_id)` — 해당 에이전트의 수신 메시지 조회

### Tasks
- `create_task(agent_id, title, description?, assignee?, priority)` — 태스크 생성
- `update_task(agent_id, task_id, status?, assignee?)` — 태스크 상태/담당자 업데이트
- `get_my_tasks(agent_id)` — 내 담당 태스크 조회

### Artifacts
- `post_artifact(agent_id, name, type, content, task_id?)` — artifact 저장 (type: figma_spec|pr|report|analytics_plan|design)
- `get_artifact(agent_id, name)` — artifact 이름으로 조회

### Review
- `request_review(agent_id, artifact_id, reviewer)` — 리뷰 요청
- `submit_review(agent_id, review_id, status, comments?)` — 리뷰 결과 제출 (approved|changes_requested)

### Memory
- `read_memory(agent_id?)` — agent_id 없으면 project.md + lessons.md 반환, 있으면 해당 에이전트 파일
- `write_memory(agent_id?, key, content)` — 메모리 섹션 작성/갱신
- `append_memory(agent_id?, content)` — agent_id 없으면 lessons.md에 추가, 있으면 에이전트 파일에 추가

### Sessions
- `save_session_summary(agent_id, session_id, summary, tasks, messages)` — 세션 요약 저장
- `list_sessions(agent_id)` — 전체 세션 목록 조회
- `get_session_summary(agent_id, session_id)` — 특정 세션 요약 조회

### Agents
- `list_agents(agent_id)` — 활성화된 에이전트 목록 반환
- `get_workflow(agent_id)` — 워크플로우 설정 반환

## Hono HTTP API (Dashboard용)
경로: `packages/server/src/dashboard/hono.ts`

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/agents` | 에이전트 목록 |
| GET | `/api/session` | 현재 세션 스냅샷 (tasks, messages, artifacts) |
| GET | `/api/sessions/:id/events` | 세션 이벤트 이력 (히스토리 재생용) |
| GET | `/api/sessions/:id` | 세션 요약 |
| POST | `/api/hook/tool-use` | PostToolUse 훅 수신 → `agent:status` broadcast |
| GET | `*` | React SPA fallback (index.html) |

## WebSocket
- 경로: `/ws` (Bun 내장 WebSocket)
- `broadcast()` 함수로 모든 연결된 클라이언트에 RelayEvent 전송
- 브로드캐스트 시 SQLite events 테이블에 이벤트 영구 저장

## 응답 형식
모든 MCP 도구: `{ success: boolean, data?, error? }`
모든 Hono API: JSON
## db-schema

## DB 엔진
- `bun:sqlite` (Bun 내장), WAL 모드 활성화
- DB 파일: `DB_PATH` env (기본값: `relay.db`)
- 싱글턴 패턴 (`getDb()`), 최초 호출 시 마이그레이션 자동 실행
- 클라이언트: `packages/server/src/db/client.ts`
- 스키마 + 마이그레이션: `packages/server/src/db/schema.ts`

## 테이블

### messages
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | TEXT PK | UUID |
| session_id | TEXT | 세션 식별자 |
| from_agent | TEXT | 발신 에이전트 ID |
| to_agent | TEXT NULL | 수신 에이전트 ID (null = broadcast) |
| content | TEXT | 메시지 내용 |
| thread_id | TEXT NULL | 스레드 그룹핑용 |
| created_at | INTEGER | unixepoch() |

인덱스: `(session_id, to_agent)`

### tasks
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | TEXT PK | UUID |
| session_id | TEXT | 세션 식별자 |
| title | TEXT | 태스크 제목 |
| description | TEXT NULL | 상세 설명 |
| assignee | TEXT NULL | 담당 에이전트 ID |
| status | TEXT | todo / in_progress / in_review / done |
| priority | TEXT | critical / high / medium / low |
| created_by | TEXT | 생성 에이전트 ID |
| created_at | INTEGER | unixepoch() |
| updated_at | INTEGER | unixepoch() |

인덱스: `(session_id, assignee)`
업데이트 가능 컬럼: `status`, `assignee`, `description` (화이트리스트로 SQL injection 방지)

### artifacts
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | TEXT PK | UUID |
| session_id | TEXT | 세션 식별자 |
| name | TEXT | artifact 이름 |
| type | TEXT | figma_spec / pr / report / analytics_plan / design |
| content | TEXT | JSON 또는 Markdown |
| created_by | TEXT | 생성 에이전트 ID |
| task_id | TEXT NULL | 연관 태스크 ID |
| created_at | INTEGER | unixepoch() |

인덱스: `(session_id)`

### reviews
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | TEXT PK | UUID |
| session_id | TEXT | 세션 식별자 |
| artifact_id | TEXT | 대상 artifact ID |
| reviewer | TEXT | 리뷰어 에이전트 ID |
| requester | TEXT | 요청자 에이전트 ID |
| status | TEXT | pending / approved / changes_requested |
| comments | TEXT NULL | 리뷰 코멘트 |
| created_at | INTEGER | unixepoch() |
| updated_at | INTEGER | unixepoch() |

인덱스: `(session_id, reviewer)`

### events
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | TEXT PK | UUID |
| session_id | TEXT | 세션 식별자 |
| type | TEXT | RelayEvent type |
| agent_id | TEXT NULL | 관련 에이전트 ID |
| payload | TEXT | JSON 직렬화된 이벤트 전체 |
| created_at | INTEGER | unixepoch() |

인덱스: `(session_id, created_at)`
용도: 대시보드 히스토리 재생 (broadcast 시마다 자동 저장)

## 쿼리 모듈
`packages/server/src/db/queries/` 하위에 테이블별 파일 분리:
- `messages.ts`, `tasks.ts`, `artifacts.ts`, `reviews.ts`, `events.ts`

## 세션 메모리 (파일 기반)
SQLite 세션 데이터와 별개로 `.relay/memory/` 디렉토리에 Markdown 파일로 영구 저장:
- `project.md` — 프로젝트 공유 메모리
- `lessons.md` — 팀 회고/의사결정 이력
- `agents/{agent_id}.md` — 에이전트별 개인 메모리
경로: `RELAY_DIR` env (기본값: `cwd()/.relay`)
## external-deps

## Runtime & 패키지 관리
- **Bun** — 런타임, 패키지 매니저, 내장 SQLite, 내장 WebSocket 모두 활용
- npm 패키지명: `@custardcream/relay` (bin: `relay-server`)

## 주요 프로덕션 의존성
| 패키지 | 버전 | 용도 |
|--------|------|------|
| `@modelcontextprotocol/sdk` | ^1.27.1 | MCP 서버 (`McpServer`, `StdioServerTransport`) |
| `hono` | ^4.12.7 | HTTP API 서버 (Bun-native, `serveStatic` 포함) |
| `js-yaml` | ^4.1.1 | `agents.default.yml` / `agents.yml` 파싱 |
| `zod` | ^4.3.6 | MCP 도구 파라미터 스키마 검증 |

## Bun 내장 모듈 (외부 패키지 아님)
- `bun:sqlite` — SQLite DB
- `Bun.serve()` — HTTP + WebSocket 서버
- `Bun.file()` / `Bun.write()` — 메모리 파일 I/O

## 외부 서비스 의존성
- **없음** — Claude API 직접 호출 없음. 모든 AI 처리는 Claude Code의 Agent 도구로 위임
- **없음** — 외부 DB, 캐시(Redis 등), 메시지 브로커 없음. 모든 상태는 로컬 SQLite + 파일 시스템

## 환경 변수
| 변수 | 기본값 | 설명 |
|------|--------|------|
| `DASHBOARD_PORT` | `3456` | HTTP/WS 서버 포트 |
| `RELAY_SESSION_ID` | `"default"` | 현재 세션 ID |
| `DB_PATH` | `"relay.db"` | SQLite DB 파일 경로 |
| `RELAY_DIR` | `cwd()/.relay` | 메모리 파일 루트 디렉토리 |
| `RELAY_DASHBOARD_DIR` | 번들 내 `dashboard/` | React 빌드 결과물 경로 (개발 시 override) |

## 에이전트 설정 파일
- `agents.default.yml` — 빌드 시 번들에 embed (파일 시스템 접근 불필요)
- `agents.yml` — 사용자 커스터마이징 (PROJECT_ROOT = cwd() 기준)
- 파서: `js-yaml` + `packages/server/src/agents/loader.ts`
