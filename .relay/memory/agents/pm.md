## domain

relay는 Claude Code 기반의 도메인-범용 멀티에이전트 협업 프레임워크다.
사용자가 `.relay/agents.pool.yml`에 팀을 정의하면 (웹개발, 리서치, 마케팅, 법률 등 무엇이든) relay가 나머지를 처리한다.
Claude Code 플러그인으로 배포됨: MCP Server + Skills + Hooks 세 레이어.
Claude API를 직접 호출하지 않음 — Claude Code의 Agent 툴만 사용 (추가 비용 없음).
npm 패키지명: `@custardcream/relay` (bin: `relay`)
GitHub: https://github.com/custardcream98/relay
현재 버전: 0.13.1

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
  - `src/agents/` — types.ts, loader.ts (agents.pool.yml 풀 로드 + 병합 + 메모리 주입)
  - `src/store.ts` — in-memory store (배열/Map 기반, ephemeral)
  - `src/dashboard/` — Hono REST API, WebSocket, events
- `packages/shared/` — @custardcream/relay-shared: 공유 타입 (AgentId, RelayEvent)
- `packages/dashboard/` — @custardcream/relay-dashboard: React + Vite 실시간 UI
- `packages/docs/` — @custardcream/relay-docs: Astro + Starlight 문서 사이트

**에이전트 통신:**
- 에이전트 간 직접 호출 없음 — 모든 통신은 MCP 툴 경유
- Peer-to-peer, 오케스트레이터 없음
- `claim_task`으로 레이스 컨디션 안전하게 태스크 획득

**메모리 이중 구조:**
- Session 메모리: in-memory store (`store.ts` — 배열/Map) — 서버 재시작 시 소멸(ephemeral)
- Project 메모리: `.relay/memory/` Markdown — 세션 간 영구 보존

**대시보드** (http://localhost:3456): Task Board (Kanban) + Message Feed (Slack 스타일) + Agent Thoughts (실시간 스트림)

**팀 구성**: `.relay/agents.pool.yml`에서 세션마다 task-최적화 팀 선발. 예시 풀: pm, designer, da, fe, be, qa, deployer + 리서치/마케팅 페르소나

## team-conventions

**기술 스택:**
- Runtime: Node.js (프로덕션); Bun (dev 툴링 — `bun run`, `bun test`)
- Language: TypeScript strict mode
- Package manager: bun (npm/yarn/pnpm 사용 금지)
- Frontend: React + Vite + Tailwind CSS
- Backend: Hono + `@hono/node-server`
- WebSocket: `ws` 라이브러리
- Linter/Formatter: Biome
- Git hooks: Husky

**코딩 컨벤션:**
- 코멘트: 영어 (English)
- MCP 툴명: snake_case
- 모든 툴은 `agent_id` 파라미터 포함 (호출자 추적)
- 모든 툴 응답: `{ success: boolean, ...fields }` 플랫 구조 (중첩 `data` 필드 없음)
- 프로덕션 코드에서 Bun API 사용 금지 (`node:` 내장 모듈 사용)
- Claude API 직접 호출 절대 금지

**페르소나 설정:**
- `.relay/agents.pool.yml`: 프로젝트 레벨 에이전트 풀 (우선 적용)
- `agents.pool.yml`: 프로젝트 루트 폴백 풀 위치
- `agents.pool.example.yml`: 12+ 페르소나 예시 (웹개발, 리서치, 마케팅)
- extends, tags, validate_prompt, hooks 지원

**워크플로우:**
1. `/relay:relay "task"` — 첫 실행 시 에이전트 풀 자동 생성; 전체 팀 동시 스폰; 이벤트 드리븐 협업
2. `/relay:agent {id} "task"` — 단일 에이전트 독립 실행

**릴리즈:**
- changeset 워크플로우 사용 (`bunx changeset` → PR → CI 자동 npm 배포)
- `bun run publish:server` 직접 실행 금지

**설치:**
- Claude Code 마켓플레이스 플러그인으로 설치 (skills + MCP 자동 등록)
- `.mcp.json`의 npx args에 반드시 `--package <pkg> <bin>` 명시

**메모리 관리:**
- `.relay/memory/` 파일을 git에 커밋하여 팀 공유
- 세션 시작 시 project.md + 개인 메모리 → 시스템 프롬프트 자동 주입
- 세션 종료 시 `write_memory` / `append_memory`로 학습 내용 기록

**로드맵 현황 (완료):**
MCP 서버 + 핵심 툴 (27개), 메모리 툴, 페르소나 YAML 풀 시스템, 아티팩트/리뷰 툴, 실시간 대시보드, Skills, Auto-Pool Generation (제로 컨피그 첫 실행), Claude Code Plugin 형식, 이벤트 드리븐 협업, 범용 에이전트 아키텍처, Agent Task Hooks, 에이전트 thoughts 스트리밍, 세션 리플레이 UI, idempotency_key 지원, 멀티 인스턴스 지원
