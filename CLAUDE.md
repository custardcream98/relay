# relay — CLAUDE.md

## 프로젝트 개요

Claude Code sub-agent들이 각자의 페르소나(PM, Designer, DA, FE, BE, QA, Deployer)로 협업하는 멀티 에이전트 프레임워크.
MCP 서버 + Skills + Hooks 세 레이어로 구성된 Claude Code 플러그인이다.
추가 API 과금 없이 Claude Code의 Agent 툴만 사용하며, MCP 서버가 에이전트 간 통신 인프라를 담당한다.

## 기술 스택 및 컨벤션

- **Runtime**: Bun (Node.js 대신 Bun 사용. `bun:sqlite` 내장 모듈 활용)
- **Language**: TypeScript (strict mode)
- **MCP 서버**: `@modelcontextprotocol/sdk` + `Bun.serve()`
- **API 서버**: Hono (Bun 네이티브, MCP 서버와 같은 프로세스에서 실행)
- **실시간 통신**: Bun 내장 WebSocket
- **프론트엔드**: React + Vite (`packages/dashboard/`)
- **스타일**: Tailwind CSS
- **DB**: `bun:sqlite` (세션 데이터)
- **메모리**: Markdown 파일 (`.relay/memory/`)
- **페르소나 설정**: YAML (`agents.yml` / `agents.default.yml`)
- **패키지 매니저**: bun (npm/yarn/pnpm 사용 금지)
- **주석**: 한국어

## 아키텍처 원칙

### MCP 서버가 통신 인프라
- relay MCP 서버는 Claude API를 직접 호출하지 않는다
- 서버는 메시지 버스, 태스크 보드, 아티팩트 저장소, 메모리 역할만 담당
- 모든 AI 처리는 Claude Code의 Agent 툴이 담당

### 에이전트는 MCP 툴로만 소통
- 에이전트 간 직접 호출 없음
- 반드시 `send_message`, `create_task` 등 MCP 툴을 통해 소통
- 오케스트레이터 없이 peer-to-peer

### 메모리 이중 구조
- **세션 메모리**: SQLite (메시지, 태스크, 아티팩트) — 세션 내 휘발
- **프로젝트 메모리**: `.relay/memory/` Markdown 파일 — 세션 간 영속
- 세션 시작 시 에이전트 system prompt에 메모리 자동 주입
- 세션 종료 시 `write_memory` / `append_memory`로 기억 갱신

### 페르소나는 YAML로 설정
- `agents.default.yml`: 기본 페르소나 (수정 비권장)
- `agents.yml`: 사용자 커스텀 (오버라이드, `extends`, `disabled` 지원)
- `packages/server/src/agents/loader.ts`가 merge 처리

### 설치 방식 (글로벌/로컬)
- 글로벌: `~/.claude/skills/`에 스킬 설치 + `claude mcp add --scope user`
- 로컬: `.claude/skills/`에 스킬 설치 + `claude mcp add --scope local`
- 로컬이 글로벌을 오버라이드

## 디렉토리 구조

```
packages/
├── server/               # @relay/server — MCP + Hono 서버
│   └── src/
│       ├── index.ts      # 진입점: MCP + Hono 서버 동시 기동
│       ├── mcp.ts        # MCP 서버 인스턴스 및 툴 등록
│       ├── tools/        # MCP 툴 구현
│       │   ├── messaging.ts   # send_message, get_messages
│       │   ├── tasks.ts       # create_task, update_task, get_my_tasks
│       │   ├── artifacts.ts   # post_artifact, get_artifact
│       │   ├── review.ts      # request_review, submit_review
│       │   ├── memory.ts      # read_memory, write_memory, append_memory
│       │   └── sessions.ts    # save_session_summary, list_sessions, get_session_summary
│       ├── agents/
│       │   ├── types.ts       # AgentId, AgentPersona, AgentConfig 타입
│       │   └── loader.ts      # agents.yml 로드 + merge + 메모리 주입
│       ├── db/
│       │   ├── client.ts      # DB 싱글톤
│       │   ├── schema.ts      # 테이블 DDL
│       │   └── queries/       # 테이블별 CRUD
│       └── dashboard/
│           ├── hono.ts        # Hono REST API
│           ├── websocket.ts   # WebSocket 브로드캐스터
│           └── events.ts      # RelayEvent 유니온 타입
├── shared/               # @relay/shared — 공유 타입
│   └── index.ts          # AgentId, RelayEvent discriminated union
├── dashboard/            # @relay/dashboard — React + Vite 실시간 UI
└── docs/                 # @relay/docs — Astro + Starlight 문서 사이트

skills/                   # Claude Code Plugin 스킬 파일
├── relay/SKILL.md        # /relay:relay - 전체 워크플로
├── init/SKILL.md         # /relay:init - 프로젝트 파악
└── agent/SKILL.md        # /relay:agent - 단일 에이전트 호출

hooks/
└── hooks.json            # PostToolUse 훅: MCP 툴 호출 → 대시보드 상태 갱신

.claude-plugin/
└── plugin.json           # 플러그인 매니페스트

.mcp.json                 # MCP 서버 설정 (${CLAUDE_PLUGIN_ROOT} 사용)
```

## MCP 툴 스키마 원칙

- 툴 이름: `snake_case`
- 파라미터에 `agent_id` 항상 포함 (누가 호출하는지 추적)
- 모든 툴은 `{ success: boolean, data?, error? }` 형태로 응답
- 메모리 툴은 `RELAY_DIR` 환경변수 경로를 사용 (기본값: `cwd()/.relay`)

## 워크플로 순서

1. `/relay:init` — 최초 1회, 팀이 프로젝트 병렬 스캔 후 `.relay/memory/` 초기화
2. `/relay:relay "태스크"` — PM → Designer/DA → FE/BE → 코드리뷰 → QA → Deployer → 배포
3. `/relay:agent {id} "태스크"` — 특정 에이전트 단독 호출
4. 각 세션 종료 시 에이전트가 기억 갱신, 세션 아카이브 저장

## 대시보드 요구사항

### 세 가지 패널
1. **Task Board (Kanban)**: 태스크 상태 변경 시 즉시 업데이트
2. **Message Feed**: 에이전트 간 메시지를 Slack 스레드 형태로 표시
3. **Agent Thoughts**: 선택한 에이전트의 추론 과정(툴 호출 전 텍스트)을 실시간 스트리밍

### WebSocket 이벤트 타입
모든 이벤트는 `{ type, payload, timestamp, agentId }` 구조를 따른다.

```typescript
type RelayEvent =
  | { type: "agent:thinking"; agentId: string; chunk: string }
  | { type: "agent:status"; agentId: string; status: "idle" | "working" | "waiting" }
  | { type: "message:new"; message: Message }
  | { type: "task:updated"; task: Task }
  | { type: "artifact:posted"; artifact: Artifact }
  | { type: "review:requested"; review: ReviewRequest }
  | { type: "memory:updated"; agentId: string }
```

### 히스토리 재생
- 모든 이벤트를 SQLite에 타임스탬프와 함께 저장
- 대시보드에서 세션 선택 후 전체 과정을 재생(replay) 가능

## 개발 명령어

```bash
bun run dev              # 개발 서버 (hot reload)
bun run build            # 빌드
bun test                 # 테스트
bun run install:local    # 로컬 설치 (스킬 + MCP 등록)
bun run install:global   # 글로벌 설치
bun run dashboard:dev    # 프론트엔드 개발 서버
bun run dashboard:build  # 프론트엔드 빌드
```

## 주의사항

- Claude API 직접 호출 코드를 추가하지 않는다 (추가 과금 발생)
- `node:` prefix 모듈보다 Bun 내장 API 우선 사용
- 에이전트 페르소나 system prompt는 한국어/영어 모두 가능하나 일관성 유지
- `.relay/memory/` 파일들은 git에 커밋하여 팀이 공유하는 것을 권장
- `agents.default.yml`은 수정하지 않는다. 커스텀은 `agents.yml`에서
