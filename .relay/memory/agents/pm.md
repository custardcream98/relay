## domain

relay는 Claude Code 기반의 도메인-범용 멀티에이전트 협업 프레임워크다.
사용자가 `agents.yml`에 팀을 정의하면 (웹개발, 리서치, 마케팅, 법률 등 무엇이든) relay가 나머지를 처리한다.
Claude Code 플러그인으로 배포됨: MCP Server + Skills + Hooks 세 레이어.
Claude API를 직접 호출하지 않음 — Claude Code의 Agent 툴만 사용 (추가 비용 없음).
npm 패키지명: `@custardcream/relay` (bin: `relay-server`)
GitHub: https://github.com/custardcream98/relay
현재 버전: 0.1.0 (changeset 0.2.0 준비 중)

## architecture

```
relay (plugin)
├── MCP Server    통신 인프라 (메시지 버스, 태스크 보드, 아티팩트 저장소, 메모리 레이어)
├── Skills        오케스트레이션 전략 (.md 파일, 코드 아님)
└── Hooks         자동화 트리거 (PostToolUse → 대시보드 상태 업데이트)
```

**패키지 구조:**
- `packages/server/` — @custardcream/relay: MCP + Hono 서버 (메인 패키지)
  - `src/index.ts` — 진입점: MCP + Hono 서버 동시 구동
  - `src/mcp.ts` — MCP 서버 인스턴스 및 툴 등록
  - `src/tools/` — messaging, tasks, artifacts, review, memory, sessions
  - `src/agents/` — types.ts, loader.ts (agents.yml 로드 + 병합 + 메모리 주입)
  - `src/db/` — bun:sqlite (client, schema, queries)
  - `src/dashboard/` — Hono REST API, WebSocket, events
- `packages/shared/` — @custardcream/relay-shared: 공유 타입 (AgentId, RelayEvent)
- `packages/dashboard/` — @custardcream/relay-dashboard: React + Vite 실시간 UI
- `packages/docs/` — @custardcream/relay-docs: Astro + Starlight 문서 사이트

**에이전트 통신:**
- 에이전트 간 직접 호출 없음 — 모든 통신은 MCP 툴 경유
- Peer-to-peer, 오케스트레이터 없음
- `claim_task`으로 레이스 컨디션 안전하게 태스크 획득

**메모리 이중 구조:**
- Session 메모리: SQLite (메시지, 태스크, 아티팩트) — 세션 내 임시
- Project 메모리: `.relay/memory/` Markdown — 세션 간 영구 보존

**대시보드** (http://localhost:3456): Task Board (Kanban) + Message Feed (Slack 스타일) + Agent Thoughts (실시간 스트림)

**현재 팀 구성** (agents.yml): pm, designer, da, fe, be, qa, deployer (표준 웹개발팀)

## team-conventions

**기술 스택:**
- Runtime: Bun (Node.js 대신 Bun 사용; `bun:sqlite` 내장 활용)
- Language: TypeScript strict mode
- Package manager: bun (npm/yarn/pnpm 사용 금지)
- Frontend: React + Vite + Tailwind CSS
- Backend: Hono (Bun-native)
- Linter/Formatter: Biome
- Git hooks: Husky

**코딩 컨벤션:**
- 코멘트: 한국어
- MCP 툴명: snake_case
- 모든 툴은 `agent_id` 파라미터 포함 (호출자 추적)
- 모든 툴 응답: `{ success: boolean, data?, error? }`
- Bun 내장 API 우선 (`node:` 접두사 모듈 지양)
- Claude API 직접 호출 절대 금지

**페르소나 설정:**
- `agents.default.yml`: 프레임워크 기본값 (수정 금지, agents: {} 빈 상태로 배포)
- `agents.example.yml`: 완전한 웹개발팀 예시 (참고용)
- `agents.yml`: 사용자 팀 정의 (필수; 최소 1개 에이전트)
- extends, disabled 지원

**워크플로우:**
1. `/relay:init` — 최초 1회; 전체 에이전트 병렬 코드베이스 스캔 → `.relay/memory/` 초기화
2. `/relay:relay "task"` — 전체 팀 동시 스폰; 이벤트 드리븐 협업
3. `/relay:agent {id} "task"` — 단일 에이전트 독립 실행

**릴리즈:**
- changeset 워크플로우 사용 (`bunx changeset` → PR → CI 자동 npm 배포)
- `bun run publish:server` 직접 실행 금지

**설치:**
- `bun run install:local` — 로컬 설치 (skills + MCP 등록)
- `bun run install:global` — 글로벌 설치
- `.mcp.json`의 npx args에 반드시 `--package <pkg> <bin>` 명시

**메모리 관리:**
- `.relay/memory/` 파일을 git에 커밋하여 팀 공유
- 세션 시작 시 project.md + 개인 메모리 → 시스템 프롬프트 자동 주입
- 세션 종료 시 `write_memory` / `append_memory`로 학습 내용 기록

**로드맵 현황 (완료):**
MCP 서버 + 핵심 툴, 메모리 툴, 페르소나 YAML 시스템, 아티팩트/리뷰 툴, 실시간 대시보드, Skills, Init 모드, Claude Code Plugin 형식, 이벤트 드리븐 협업, 범용 에이전트 아키텍처

**로드맵 미완료:**
- 대시보드에 에이전트 thoughts 스트리밍
- 세션 리플레이 UI
- 공개 문서 사이트
