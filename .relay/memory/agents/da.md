## existing-events

# Relay 이벤트 타입 목록

## RelayEvent (packages/shared/index.ts)

모든 이벤트는 `{ type, timestamp }` 공통 필드를 가짐.
- `timestamp`: 밀리초 단위 (Date.now())

### 이벤트 종류

| type | 주요 필드 | 설명 |
|------|----------|------|
| `agent:thinking` | agentId, chunk | 에이전트 추론 스트림 청크 |
| `agent:status` | agentId, status("idle"\|"working"\|"waiting") | 에이전트 상태 변경 |
| `message:new` | message.{id, from_agent, to_agent, content, thread_id, created_at} | 에이전트 간 메시지 |
| `task:updated` | task.{id, title, assignee, status, priority} | 태스크 상태 변경 |
| `artifact:posted` | artifact.{id, name, type, created_by} | 아티팩트 게시 |
| `review:requested` | review.{id, artifact_id, reviewer, requester} | 리뷰 요청 |
| `session:snapshot` | tasks[], messages[], artifacts[] | 세션 초기 스냅샷 |
| `memory:updated` | agentId | 메모리 파일 변경 |

## 이벤트 저장 방식

- `broadcast()` 호출 시 SQLite `events` 테이블에 자동 persist
- 컬럼: `id, session_id, type, agent_id, payload(JSON), created_at(unixepoch 초)`
- `agent_id` 컬럼: 이벤트에 `agentId` 필드가 있을 때만 저장, 없으면 NULL
- `getEventsBySession(sessionId)`: 세션별 시간순 전체 이벤트 조회 → 히스토리 리플레이용

## 이벤트 발생 경로

- MCP 도구 호출 → `broadcast()` → WebSocket 전파 + DB 저장
- PostToolUse hook → `POST /api/hook/tool-use` → `agent:status: working` broadcast
- 대시보드 초기 로드: `GET /api/session` (스냅샷), 이후 WebSocket으로 실시간 수신

## 분석 관점 주의사항

- `message.created_at`는 **초** 단위 (unixepoch), `event.timestamp`는 **밀리초** 단위 — 비교 시 단위 변환 필요
- `to_agent = NULL`은 브로드캐스트 메시지
- `task.status` 값은 자유 문자열 (enum 미강제) — 실제 사용 값 확인 필요 (`todo`, `in_progress`, `done` 등)
- `task.priority` 값도 자유 문자열 (기본값 `medium`)
## metrics-setup

# 메트릭 및 분석 인프라 현황

## 현재 상태: 전용 분석 레이어 없음

별도 analytics/telemetry 라이브러리나 메트릭 수집 파이프라인은 존재하지 않음.
모든 데이터는 SQLite (런타임 세션) + Markdown 파일 (.relay/memory/) 두 곳에 저장됨.

## 분석 가능한 데이터 소스

### 1. SQLite DB (세션 데이터, 에피메럴)
- **messages**: 에이전트 간 커뮤니케이션 흐름, 스레드, 브로드캐스트
- **tasks**: 태스크 생성/완료 추적, assignee별 분배, priority 분포
- **artifacts**: 산출물 타입·생성자 추적
- **reviews**: 리뷰 요청/완료 현황, reviewer별 부하
- **events**: 전체 이벤트 로그 (히스토리 리플레이 소스)

### 2. 세션 파일 (.relay/sessions/{id}/)
- `summary.md`: 세션 요약 텍스트
- `tasks.json`: 세션 종료 시점 태스크 스냅샷
- `messages.json`: 세션 전체 메시지 스냅샷

### 3. 메모리 파일 (.relay/memory/)
- 에이전트별 Markdown 파일 — 지식 축적 현황

## REST API (대시보드/분석용)

| 엔드포인트 | 설명 |
|-----------|------|
| `GET /api/session` | 현재 세션 tasks/messages/artifacts 스냅샷 |
| `GET /api/sessions/:id/events` | 특정 세션 전체 이벤트 목록 (리플레이) |
| `GET /api/sessions/:id` | 세션 summary.md 조회 |
| `GET /api/agents` | 등록된 에이전트 목록 |

## 도출 가능한 주요 메트릭 (현재 데이터 기반)

- **에이전트별 태스크 완료율**: tasks 테이블 (assignee + status 기준)
- **커뮤니케이션 네트워크**: messages 테이블 (from_agent → to_agent 집계)
- **태스크 사이클 타임**: `created_at` vs `updated_at` (태스크 생성→완료 시간)
- **리뷰 대기 시간**: reviews.created_at → reviews.updated_at
- **이벤트 빈도/에이전트 활성도**: events 테이블 (agent_id + type + created_at 집계)
- **아티팩트 생산성**: artifacts.created_by 기준 산출물 수

## 개선 기회

- 현재 `task.status`, `task.priority`가 자유 문자열 → enum 정의 시 집계 안정성 향상
- `agent:thinking` 이벤트의 chunk 데이터가 DB에 저장되나 분석에 활용되지 않음 (LLM 토큰 사용량 추정 가능)
- 세션 간 비교를 위한 cross-session 집계 API 부재 → 필요 시 추가 개발 필요
- WebSocket 연결/해제 이벤트 미로깅 → 대시보드 사용 패턴 분석 불가
