# relay

> Claude Code 위에서 동작하는 멀티 에이전트 협업 프레임워크.
> PM, Designer, DA, FE, BE, QA 등 각자의 페르소나를 가진 AI 에이전트들이 실제 스타트업처럼 협업하여 태스크를 완수한다.

## 개념

일반적인 AI 에이전트 툴은 하나의 에이전트가 모든 걸 처리한다. relay는 다르다.

각 에이전트는 자신의 역할만 수행하고, MCP 서버를 통해 서로 직접 소통한다.
PM이 기획하면 Designer가 설계하고, DA가 측정 계획을 세우고, FE/BE가 개발하고, 서로 코드리뷰하고, QA가 검증한다.
모든 이슈가 해결되면 배포까지 — 추가 API 과금 없이, Claude Code 안에서.

```
사용자: "쇼핑카트 기능 추가해줘"
  ↓
[PM]       → 태스크 분해, 이슈 생성
[Designer] → UX 플로우, 컴포넌트 스펙
[DA]       → 이벤트 설계, 성과 지표 정의
[BE]       → API 설계 및 구현
[FE]       → UI 구현
[FE2]      → FE 코드 리뷰
[BE2]      → BE 코드 리뷰
[QA]       → 테스트 시나리오 및 버그 리포트
[BE/FE]    → QA 티켓 수정
[Deployer] → 배포
```

## Plugin 구조

relay는 MCP 서버 단독이 아니라 **세 가지 레이어**로 구성된 Claude Code 플러그인이다.

```
relay (plugin)
├── MCP 서버       → 에이전트 간 통신 인프라 (메시지 버스, 태스크 보드, 메모리)
├── Skills         → 오케스트레이션 전략 ("어떻게 쓰는가")
│   ├── /relay       → 새 세션 시작, 전체 워크플로 실행
│   ├── /relay-init  → 최초 1회: 팀이 프로젝트 전체를 파악
│   └── /relay-agent → 특정 에이전트 단독 호출
└── Hooks          → 자동화 트리거
    └── PostToolUse  → MCP 툴 호출 시 대시보드에 에이전트 상태 실시간 push
```

### 설치 방식

같은 플러그인 구조로 글로벌/로컬 양쪽 지원. 로컬이 글로벌을 오버라이드한다.

```bash
# 글로벌 설치 (모든 프로젝트에서 /relay 사용 가능)
bun run install --global
# → ~/.claude/skills/relay*.md 설치
# → claude mcp add --global relay

# 로컬 설치 (현재 프로젝트만)
bun run install
# → .claude/skills/relay*.md 설치
# → claude mcp add relay
```

## 동작 방식

### MCP 서버 = 통신 인프라

relay는 MCP(Model Context Protocol) 서버로 동작한다. 각 sub-agent는 MCP 툴을 통해 서로 직접 소통한다 — 중앙 오케스트레이터 없이.

```
[PM agent] ──┐
[FE agent] ──┤── MCP tools ──→ relay MCP Server
[BE agent] ──┤                  (메시지 버스 + 태스크 보드 + 메모리)
[QA agent] ──┘
```

### 에이전트가 사용하는 툴

| 카테고리 | 툴 | 설명 |
|---|---|---|
| 메시징 | `send_message` | 특정 에이전트에게 메시지 전송 |
| 메시징 | `get_messages` | 수신 메시지 조회 |
| 태스크 | `create_task` | 새 이슈 생성 |
| 태스크 | `update_task` | 태스크 상태/코멘트 업데이트 |
| 태스크 | `get_my_tasks` | 내 담당 태스크 조회 |
| 아티팩트 | `post_artifact` | 산출물 공유 (디자인 스펙, PR, 리포트 등) |
| 아티팩트 | `get_artifact` | 산출물 조회 |
| 리뷰 | `request_review` | 리뷰 요청 |
| 리뷰 | `submit_review` | 리뷰 결과 제출 |
| 메모리 | `read_memory` | 이전 세션 기억 조회 |
| 메모리 | `write_memory` | 기억 갱신 |
| 메모리 | `append_memory` | 기억에 누적 추가 |
| 세션 | `list_sessions` | 과거 세션 목록 |
| 세션 | `get_session_summary` | 특정 세션 요약 조회 |

## 메모리 구조

에이전트의 기억은 **세션 메모리**와 **프로젝트 메모리** 두 레이어로 분리된다.

```
my-project/
└── .relay/
    ├── memory/                  # 세션 간 영속 기억 (git 커밋 권장)
    │   ├── project.md           # 아키텍처, 도메인, 기술 스택 요약
    │   ├── lessons.md           # 반복 실수, 중요 의사결정 히스토리
    │   └── agents/
    │       ├── pm.md            # PM 전용 기억
    │       ├── fe.md            # FE: 컴포넌트 구조, 컨벤션
    │       ├── be.md            # BE: API 패턴, DB 스키마
    │       ├── da.md            # DA: 이벤트/지표 체계
    │       ├── designer.md      # Designer: UI 패턴, 디자인 시스템
    │       ├── qa.md            # QA: 반복 버그 패턴, 취약 영역
    │       └── deployer.md      # Deployer: 배포 히스토리, 주의사항
    └── sessions/                # 세션별 감사 로그
        ├── 2026-03-13-001/
        │   ├── messages.json
        │   ├── tasks.json
        │   └── summary.md
        └── ...
```

**세션 시작 시** — `project.md` + 에이전트 개인 기억이 system prompt에 자동 주입된다.

**세션 종료 시** — 각 에이전트가 `write_memory`로 새로 배운 것, 주요 결정을 기억에 추가한다.

기억은 파일 형태이므로 사람이 직접 편집하거나 git으로 팀 전체가 공유할 수 있다.

## Init Mode

프로젝트에 `.relay/memory/`가 없으면 relay가 init을 제안한다. `/relay-init` 으로도 언제든 재실행 가능.

```
Phase 1: 병렬 프로젝트 스캔
  PM       → README, CLAUDE.md, 전체 디렉토리 구조, 도메인 파악
  FE       → 프론트엔드 코드, 컴포넌트 패턴, 스타일 컨벤션
  BE       → 백엔드 코드, API 구조, DB 스키마, 외부 의존성
  DA       → 기존 분석 코드, 메트릭, 로깅 현황
  Designer → 기존 UI 패턴, 디자인 시스템 여부
  QA       → 테스트 파일, CI/CD 설정, 커버리지 현황

Phase 2: 교차 검증 + 보완
  각 에이전트가 서로의 발견사항을 읽고 누락된 부분 보완

Phase 3: 기억 파일 저장
  → .relay/memory/ 초기화 완료
  → 이후 /relay 세션에서 즉시 컨텍스트 활용 가능
```

### 시각화 대시보드

relay MCP 서버는 웹 대시보드를 함께 서빙한다. 에이전트들이 어떻게 생각하고, 서로 어떻게 소통하는지를 실시간으로 볼 수 있다.

```
┌──────────────────────────────────────────────────────────┐
│  [PM ●]  [Designer ○]  [DA ○]  [FE ●]  [BE ●]  [QA ○]   │  ← 에이전트 상태
├───────────────────┬──────────────────┬───────────────────┤
│    Task Board     │   Message Feed   │   Agent Thoughts  │
│    (Kanban)       │   (Slack-like)   │   (실시간 스트림)  │
│                   │                  │                   │
│  Todo             │  FE → BE:        │  ▶ FE 생각 중...  │
│  ├ #1 API 설계    │  "PR #3 리뷰     │  "BE API 스펙을   │
│  ├ #2 UI 구현     │   부탁해요"      │   보니 auth 헤더  │
│                   │                  │   가 빠져있네.    │
│  In Progress      │  BE → FE:        │   일단 구현하고   │
│  └ #3 로그인 UI   │  "LGTM, 근데     │   리뷰 요청해야   │
│                   │   auth 헤더      │   겠다."          │
│  Done             │   확인해봐요"    │                   │
│  └ #0 기획 완료   │                  │                   │
└───────────────────┴──────────────────┴───────────────────┘
```

- **Task Board**: 전체 이슈 현황 Kanban. 태스크 상태 변경 시 실시간 업데이트.
- **Message Feed**: 에이전트 간 대화를 Slack 스레드 형태로 표시.
- **Agent Thoughts**: 선택한 에이전트의 추론 과정을 실시간 스트리밍.

세션 종료 후에도 히스토리 전체를 재생(replay)할 수 있다.

## 기술 스택

| 레이어 | 기술 |
|---|---|
| Runtime | Bun |
| Language | TypeScript (strict) |
| MCP 서버 | `@modelcontextprotocol/sdk` + `Bun.serve()` |
| API 서버 | Hono (Bun 네이티브) |
| 실시간 통신 | Bun 내장 WebSocket |
| 프론트엔드 | React + Vite |
| 스타일 | Tailwind CSS |
| DB | `bun:sqlite` (세션 데이터) |
| 메모리 | Markdown 파일 (`.relay/memory/`) |
| 페르소나 설정 | YAML (`agents.yml`) |

## 시작하기

```bash
# 의존성 설치
bun install

# 글로벌 설치 (권장)
bun run install --global

# 또는 현재 프로젝트에만 설치
bun run install

# 프로젝트 최초 실행 시 팀이 프로젝트 파악
/relay-init

# 이후 일반 사용
/relay "쇼핑카트 기능 추가해줘"
```

## 프로젝트 구조

```
relay/
├── src/
│   ├── index.ts              # MCP 서버 진입점
│   ├── mcp.ts                # MCP 서버 + 툴 등록
│   ├── tools/                # MCP 툴 (messaging, tasks, artifacts, review, memory)
│   ├── agents/               # 페르소나 로더 (agents.yml 기반)
│   ├── db/                   # SQLite 스키마 및 쿼리
│   └── dashboard/            # Hono API + WebSocket + 이벤트 타입
├── dashboard/                # React + Vite 프론트엔드
├── skills/                   # Claude Code 스킬 (설치 시 .claude/skills/에 복사)
│   ├── relay.md              # /relay 메인 오케스트레이션 전략
│   ├── relay-init.md         # /relay-init 프로젝트 파악 전략
│   └── relay-agent.md        # /relay-agent 단일 에이전트 호출
├── agents.default.yml        # 기본 에이전트 페르소나
├── agents.yml                # 사용자 커스텀 페르소나 (편집 가능)
├── hooks/
│   └── post-tool-use.sh      # PostToolUse 훅 (대시보드 실시간 갱신)
├── scripts/
│   └── install.ts            # 글로벌/로컬 설치 스크립트 (훅 설정 포함)
├── CLAUDE.md
└── README.md
```

## 로드맵

- [ ] MCP 서버 뼈대 + 기본 툴 (messaging, tasks)
- [ ] 메모리 툴 + `.relay/memory/` 구조
- [ ] 에이전트 페르소나 YAML 시스템
- [ ] 아티팩트 및 리뷰 툴
- [ ] 웹 대시보드 (실시간 시각화)
- [ ] Skills 작성 (relay, relay-init, relay-agent)
- [ ] Init Mode (병렬 프로젝트 스캔)
- [ ] 설치 스크립트 (글로벌/로컬)
