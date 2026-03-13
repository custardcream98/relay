# relay — Project Memory

> Last updated: 2026-03-13 (PM agent synthesis)

## Overview

relay는 Claude Code 기반의 도메인-범용 멀티에이전트 협업 프레임워크다.
사용자가 `agents.yml`에 팀을 정의하면(웹 개발, 리서치, 마케팅, 법률 등 무엇이든) relay가 나머지를 처리한다.

- **npm 패키지**: `@custardcream/relay` v0.2.1, bin: `relay`
- **GitHub**: https://github.com/custardcream98/relay
- **대시보드**: http://localhost:3456
- **문서 사이트**: https://custardcream98.github.io/relay

## Architecture

Claude Code 플러그인으로 배포됨. 세 레이어로 구성:

```
relay (plugin)
├── MCP Server    통신 인프라 (메시지 버스, 태스크 보드, 아티팩트 저장소, 메모리 레이어)
├── Skills        오케스트레이션 전략 (.md 파일, 코드 아님)
└── Hooks         자동화 트리거 (PostToolUse → 대시보드 상태 업데이트)
```

**핵심 원칙:**
- MCP 서버는 Claude API를 직접 호출하지 않음 — Claude Code의 Agent 툴만 사용 (추가 비용 없음)
- 에이전트 간 직접 호출 없음 — 모든 통신은 MCP 툴 경유 (`send_message`, `create_task` 등)
- Peer-to-peer 구조 — 중앙 오케스트레이터 없음
- `claim_task`으로 레이스 컨디션 안전하게 태스크 획득 (원자적 UPDATE)

**패키지 구조:**
```
packages/
├── server/       @custardcream/relay — MCP + Hono 서버 (유일하게 npm 배포됨)
│   └── src/
│       ├── index.ts            진입점: Bun.serve(HTTP+WebSocket, :3456) + MCP stdio 서버 동시 구동
│       ├── mcp.ts              MCP 서버 인스턴스 및 16개 툴 등록
│       ├── tools/              messaging, tasks, artifacts, review, memory, sessions
│       ├── agents/             types.ts + loader.ts (agents.yml 로드 + 병합 + 메모리 주입)
│       ├── db/                 bun:sqlite (client, schema, queries)
│       └── dashboard/          hono.ts (REST API) + websocket.ts + events.ts
├── shared/       @custardcream/relay-shared — 공유 타입 (AgentId, RelayEvent)
├── dashboard/    @custardcream/relay-dashboard — React + Vite 실시간 UI
└── docs/         @custardcream/relay-docs — Astro + Starlight 문서 사이트

skills/           Claude Code Plugin 스킬 파일 (.md)
├── relay/SKILL.md    /relay:relay — 전체 워크플로우
├── init/SKILL.md     /relay:init — 프로젝트 스캔
└── agent/SKILL.md    /relay:agent — 단일 에이전트 실행

hooks/hooks.json  PostToolUse 훅 → /api/hook/tool-use → agent:status:working 브로드캐스트
.claude-plugin/plugin.json  플러그인 매니페스트
.mcp.json         MCP 서버 설정
```

**메모리 이중 구조:**
- Session 메모리: SQLite (messages, tasks, artifacts, reviews, events) — 세션 내 임시
- Project 메모리: `.relay/memory/` Markdown 파일 — 세션 간 영구 보존; git에 커밋하여 팀 공유

## Tech Stack

| 영역 | 기술 |
|---|---|
| Runtime | Bun (Node.js 대신 사용; `bun:sqlite`, `Bun.serve`, `Bun.file`, `Bun.build` 내장 활용) |
| Language | TypeScript strict mode |
| Package manager | bun (npm/yarn/pnpm 사용 금지) |
| MCP | `@modelcontextprotocol/sdk ^1.27.1` (McpServer + StdioServerTransport) |
| HTTP/API | Hono `^4.12.7` (Bun-native) |
| Validation | Zod `^4.3.6` (MCP 툴 입력 파라미터) |
| Config | `js-yaml ^4.1.1` (agents.yml 파싱) |
| Frontend | React 19.2.4 + Vite 8.x + Tailwind CSS v4 |
| Linter/Formatter | Biome `^2.4.6` |
| Git hooks | Husky `^9.1.7` |
| DB | `bun:sqlite` (WAL 모드, 싱글턴 패턴) |

## MCP Tools (16개)

| 카테고리 | 툴 |
|---|---|
| Messaging | `send_message`, `get_messages` |
| Tasks | `create_task`, `update_task`, `get_my_tasks`, `claim_task`, `get_team_status`, `get_all_tasks` |
| Artifacts | `post_artifact`, `get_artifact` |
| Review | `request_review`, `submit_review` |
| Memory | `read_memory`, `write_memory`, `append_memory` |
| Sessions | `save_session_summary`, `list_sessions`, `get_session_summary` |
| Agents | `list_agents`, `get_workflow` |

## Hono REST API

| 엔드포인트 | 용도 |
|---|---|
| `GET /api/agents` | 에이전트 목록 (캐싱) |
| `GET /api/session` | 현재 세션 스냅샷 (tasks + messages + artifacts) |
| `GET /api/sessions/:id/events` | 세션 이벤트 (히스토리 리플레이용) |
| `GET /api/sessions/:id` | 세션 요약 |
| `POST /api/hook/tool-use` | PostToolUse 훅 수신 → `agent:status:working` 브로드캐스트 |
| `GET /*` | React SPA fallback (index.html) |

## WebSocket Events (RelayEvent)

모든 이벤트는 `{ type, payload, timestamp: number (ms), agentId }` 구조를 따름.

| 이벤트 타입 | 용도 |
|---|---|
| `agent:thinking` | 에이전트 추론 텍스트 실시간 스트리밍 (`chunk: string`) |
| `agent:status` | 에이전트 상태 변경 (`idle \| working \| waiting`) |
| `message:new` | 에이전트 간 메시지 |
| `task:updated` | 태스크 보드 상태 변경 |
| `artifact:posted` | 새 아티팩트 게시 |
| `review:requested` | 코드 리뷰 요청 |
| `session:snapshot` | 대시보드 초기 하이드레이션 |
| `memory:updated` | 에이전트가 프로젝트 메모리 기록 |

이벤트 흐름: MCP 툴 호출 → `broadcast()` → SQLite `events` 테이블 저장 + WebSocket 팬아웃

## DB Schema (SQLite)

DB 경로: `process.env.DB_PATH ?? "relay.db"`

- **messages**: id, session_id, from_agent, to_agent (nullable=브로드캐스트), content, thread_id, created_at
- **tasks**: id, session_id, title, description, assignee, status, priority, created_by, created_at, updated_at
- **artifacts**: id, session_id, name, type, content, created_by, task_id, created_at
- **reviews**: id, session_id, artifact_id, reviewer, requester, status, comments, created_at, updated_at
- **events**: id, session_id, type, agent_id, payload (JSON), created_at

환경 변수:
- `RELAY_SESSION_ID` (default: `"default"`)
- `RELAY_DIR` (default: `cwd()/.relay`)
- `DB_PATH` (default: `"relay.db"`)

## Dashboard (Frontend)

다크 테마 전용 3패널 레이아웃:
1. **Task Board** (Kanban): todo / in_progress / in_review / done 4컬럼
2. **Message Feed**: Slack 스타일, MarkdownContent 렌더링
3. **Agent Thoughts**: 선택된 에이전트의 추론 실시간 스트리밍

**핵심 구현 특징:**
- 외부 컴포넌트/아이콘/마크다운 라이브러리 없음 — 모두 직접 구현
- 전역 상태: `App.tsx`의 `useReducer` (라이브러리 없음)
- WebSocket 드리븐 상태 업데이트 — 폴링 없음
- `useRelaySocket`: 지수 백오프 재연결 (1s→2s→4s→8s→16s)
- `useResizablePanels`: 드래그로 패널 너비 조정 (최소 12%)
- Tailwind v4 (CSS import 방식, `tailwind.config.js` 없음)
- 폰트: Inter (sans) + JetBrains Mono (mono)

**에이전트 액센트 컬러:**
- pm: #a78bfa, designer: #f472b6, da: #fbbf24, fe: #60a5fa, be: #34d399, qa: #fb923c, deployer: #f97316

## Persona Configuration

- `agents.default.yml`: 프레임워크 기본값 — **절대 수정 금지**, `agents: {}` 빈 상태로 배포
- `agents.example.yml`: 완전한 웹개발팀 예시 (참고용)
- `agents.yml`: 사용자 팀 정의 (필수; 최소 1개 에이전트; `extends`, `disabled` 지원)
- `packages/server/src/agents/loader.ts`: agents.yml 로드 + 병합 + 메모리 주입

## Key Patterns & Conventions

**코딩 컨벤션:**
- 코멘트: 한국어
- MCP 툴명: snake_case
- 모든 툴에 `agent_id` 파라미터 필수 (호출자 추적)
- 모든 툴 응답: `{ success: boolean, data?, error? }`
- Bun 내장 API 우선 (`node:` 접두사 모듈 지양)
- Claude API 직접 호출 절대 금지

**보안 패턴:**
- `agent_id` / `session_id`: `/^[a-zA-Z0-9_-]+$/` 정규식으로 path traversal 방지
- memory key: 개행 문자 불허
- task update: 허용 컬럼 화이트리스트 (`ALLOWED_UPDATE_KEYS`)
- `submit_review` 시 `agent_id == reviewer` 권한 검사

**각 파일 최상단에 `// path/to/file.ts` 헤더 코멘트 추가**

## Team Structure

현재 릴리즈된 `agents.default.yml` 기준 팀:
- **pm**: 프로젝트 매니저 — 태스크 분배, 진행 모니터링
- **fe**: 프론트엔드 엔지니어 — React/Vite/Tailwind
- **be**: 백엔드 엔지니어 — MCP 서버, Hono API, SQLite
- **qa**: QA 엔지니어 — 테스트, CI/CD
- **deployer**: 배포 담당 — 빌드, 릴리즈, 설치

> **참고**: designer, da 에이전트는 `agents.yml` 커스텀 설정으로 존재하나,
> 순수 개발 도구인 relay의 기본 팀에서는 불필요하다고 판단됨.

## Workflow

1. `/relay:init` — 최초 1회; 전체 에이전트 병렬 코드베이스 스캔 → `.relay/memory/` 초기화
2. `/relay:relay "task"` — 전체 팀 이벤트 드리븐 협업
3. `/relay:agent {id} "task"` — 단일 에이전트 독립 실행

세션 시작 시: `project.md` + 개인 메모리 → 시스템 프롬프트 자동 주입
세션 종료 시: `write_memory` / `append_memory`로 학습 내용 기록

## Build & Release

**빌드 순서:**
1. `bun run dashboard:build` (dashboard → `packages/dashboard/dist/`)
2. `bun run build:server` (server → `packages/server/dist/index.js` + dashboard 복사)
3. `bun run build:release` = dashboard:build + build:server (combined)

**서버 빌드 특징:**
- `Bun.build()` (target: "bun"), `bun:sqlite` externalize
- `#!/usr/bin/env bun` shebang + chmod 755
- 단일 번들 파일 (`dist/index.js`)

**릴리즈 워크플로우 (changeset 사용):**
```bash
bunx changeset        # patch/minor/major 선택 (dev tooling — Bun 필요)
git add .changeset/
git commit -m "chore: add changeset"
git push
# CI가 "Version Packages" PR 생성 → 머지 → CI가 npm 자동 배포
```
`bun run publish:server` 직접 실행 금지.

**설치:**
- Claude Code 마켓플레이스 플러그인으로 설치 (skills + MCP 자동 등록)
- `.mcp.json` npx args: `["npx", "-y", "--package", "@custardcream/relay", "relay"]`
  - `--package` 명시 필수 — 패키지명과 bin명이 다를 때 npx가 바이너리를 찾지 못하는 문제 방지
  - 프로덕션 런타임은 Node.js (Bun 불필요)
- 설치 후 `/reload-plugins` 실행 필요

## CI/CD

**GitHub Actions 워크플로우 3개:**
1. `ci.yml` (push to main + 모든 PR): Lint+Format(Biome) / Test(bun test) / Type Check(tsc) / Dashboard Build — 4개 병렬 job
2. `release.yml` (push to main): changesets/action → npm 배포. `GITHUB_TOKEN` + `NPM_TOKEN` 필요
3. `deploy-docs.yml` (push to main, `packages/docs/**` 변경 시): Astro 빌드 → GitHub Pages 배포. Node.js 22 필요 (Astro v5)

## Test Coverage

**커버리지 있는 영역 (bun:test):**
- DB 레이어: 5개 테이블 스키마 마이그레이션, 전체 CRUD 쿼리
- MCP 툴 핸들러: messaging, tasks, artifacts, review, memory, sessions
- Agent loader: extends/disabled/language 설정, 워크플로우 로더

**테스트 없는 영역 (주의):**
| 영역 | 갭 |
|---|---|
| `packages/dashboard/` (React) | 테스트 파일 없음 |
| `packages/server/src/dashboard/hono.ts` | REST API 엔드포인트 미테스트 |
| `packages/server/src/dashboard/websocket.ts` | WebSocket 브로드캐스트 미테스트 |
| `packages/server/src/mcp.ts` | 툴 등록 와이어링 미테스트 |
| `packages/server/src/index.ts` | 서버 스타트업 미테스트 |
| `skills/*.md` | 자동화 테스트 불가 |
| Integration / E2E | 에이전트 플로우 → MCP → DB → WebSocket 전체 흐름 없음 |
| 커버리지 측정 | CI에 `--coverage` 없음 |

**권장 개선:**
1. Hono API 라우트 테스트 추가 (`hono/testing` 또는 in-memory fetch)
2. WebSocket 이벤트 테스트 추가 (`agent:thinking`, `task:updated` 등)
3. CI에 `bun test --coverage` 활성화 + 최소 임계값 설정
4. MCP 툴 등록 스모크 테스트 추가

## Known Gaps & Roadmap

**미완료 기능:**
- 대시보드 에이전트 thoughts 스트리밍 (UI 측 `agent:thinking` 핸들러 구현 필요)
- 세션 리플레이 UI
- 공개 문서 사이트 (deploy-docs.yml은 있으나 콘텐츠 미완성)

**데이터 측정 갭:**
- `agent:thinking` 청크 미영속 — 라이브 스트리밍만 가능, 세션 후 유실
- 태스크 상태별 전환 타임스탬프 없음 — 사이클 타임 계산 불가
- `review:updated` 이벤트 없음 — 리뷰 결과가 WebSocket으로 전파 안 됨
- `session:snapshot` 페이로드가 `unknown[]` — 타입 검증 없음

**CI 개선 필요:**
- `bun-version: latest` → 핀 버전으로 고정 권장 (Bun 브레이킹 체인지 방어)
- 커버리지 리포트 단계 없음

## Critical Rules

1. **Claude API 직접 호출 절대 금지** — 항상 Claude Code Agent 툴 사용
2. **`agents.default.yml` 수정 금지** — 커스터마이징은 `agents.yml`에만
3. **릴리즈는 changeset 워크플로우만 사용** — `bun run publish:server` 직접 실행 금지
4. **`.mcp.json`에 `--package <pkg> <bin>` 명시** — bin명 ≠ 패키지명일 때 npx 실패 방지
5. **`.relay/memory/` 파일을 git에 커밋** — 팀 간 프로젝트 메모리 공유
6. **패키지 매니저는 bun만** — npm/yarn/pnpm 사용 금지
7. **Bun 내장 API 우선** — `node:` 접두사 모듈 지양
