<br />

<h1 align="center">relay</h1>
<p align="center">
  <strong>Claude Code 위에서 동작하는 멀티 에이전트 협업 프레임워크.</strong>
  <br />
  <span>하나의 태스크. 온 팀이 움직여요. PM, Designer, DA, FE, BE, QA, Deployer.</span>
</p>

<p align="center">
  <a href="./README.md">English</a>
</p>

<br />
<br />

## 개념

일반적인 AI 코딩 툴은 에이전트 하나가 모든 걸 처리해요.

relay는 팀을 만들어요. 각 에이전트는 자신의 역할만 수행하고, MCP 서버를 통해 서로 직접 소통해요. PM이 기획하면 Designer가 설계하고, DA가 측정 계획을 세워요. FE/BE가 개발하고 서로의 코드를 리뷰해요. QA가 검증하고, Deployer가 배포해요.

```
사용자: "쇼핑카트 기능 추가해줘"

[PM]       태스크 분해, 이슈 생성
[Designer] UX 플로우, 컴포넌트 스펙
[DA]       이벤트 스키마, 성과 지표 정의
[FE]       UI 구현
[BE]       API 구현
[FE] [BE]  서로의 코드 크로스 리뷰
[QA]       테스트 시나리오, 버그 리포트
[Deployer] 배포
```

파이프라인이 아니에요. 에이전트들은 MCP 툴을 통해 peer-to-peer로 소통해요 — 중앙 오케스트레이터 없이, 추가 API 과금 없이.

<br />

## 동작 방식

relay는 세 가지 레이어로 구성된 Claude Code 플러그인이에요.

```
relay (plugin)
├── MCP 서버    통신 인프라
├── Skills      오케스트레이션 전략 (.md 파일)
└── Hooks       자동화 트리거
```

**MCP 서버**는 데이터를 저장하고 라우팅만 해요. Claude API 호출도, 의사결정도 없어요. 에이전트들이 읽고 쓰는 메시지 버스, 태스크 보드, 아티팩트 저장소, 리뷰 큐, 메모리 레이어가 전부예요.

**Skills**는 오케스트레이터 역할을 하는 Claude Code 세션에게 sub-agent를 어떻게 띄우고, 어떤 MCP 툴을 쓰고, 결과를 어떻게 해석할지 알려주는 `.md` 파일이에요. 오케스트레이션 전략을 코드가 아닌 텍스트로 관리해요. 동작 방식을 바꾸고 싶으면 파일을 수정하면 돼요 — 서버 재배포 없이.

**Hooks** — `hooks/hooks.json`이 PostToolUse 이벤트를 감지해 에이전트 상태를 대시보드에 실시간으로 push해요.

<br />

## 에이전트 툴

모든 에이전트는 MCP 툴을 통해서만 소통해요.

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
| 세션 | `save_session_summary` | 세션 요약 저장 |
| 세션 | `list_sessions` | 과거 세션 목록 |
| 세션 | `get_session_summary` | 특정 세션 요약 조회 |

오케스트레이터는 추가로 `list_agents`, `get_workflow`를 사용해 런타임에 페르소나 설정과 워크플로 DAG를 읽어요.

<br />

## 메모리 구조

에이전트의 기억은 수명이 다른 두 레이어로 분리돼요.

```
your-project/
└── .relay/
    ├── memory/                  세션 간 영속 기억 (git 커밋 권장)
    │   ├── project.md           아키텍처, 도메인, 기술 스택 요약
    │   ├── lessons.md           반복 실수, 중요 의사결정 히스토리
    │   └── agents/
    │       ├── pm.md
    │       ├── fe.md
    │       ├── be.md
    │       └── ...
    └── sessions/                세션별 감사 로그
        └── 2026-03-13-001/
            ├── messages.json
            ├── tasks.json
            └── summary.md
```

**세션 시작 시** — `project.md`와 각 에이전트 개인 기억이 system prompt에 자동으로 주입돼요.

**세션 종료 시** — 각 에이전트가 `write_memory`로 새로 배운 것과 주요 결정을 기억에 추가해요.

기억은 평범한 Markdown 파일이에요. 직접 편집하거나 git으로 팀 전체가 공유할 수 있어요.

<br />

## 대시보드

MCP 서버는 `http://localhost:3456`에서 실시간 웹 대시보드도 함께 제공해요.

```
+----------------------------------------------------------+
|  [PM  ]  [Designer -]  [DA -]  [FE  ]  [BE  ]  [QA -]   |
+-------------------+------------------+-------------------+
|    Task Board     |   Message Feed   |   Agent Thoughts  |
|    (Kanban)       |   (Slack 스타일)  |   (실시간 스트림)  |
+-------------------+------------------+-------------------+
```

**Task Board** — 전체 이슈 현황 Kanban. 태스크 상태 변경 시 실시간으로 업데이트돼요.

**Message Feed** — 에이전트 간 대화를 Slack 스레드 형태로 보여줘요.

**Agent Thoughts** — 선택한 에이전트의 추론 과정을 실시간으로 스트리밍해요.

모든 이벤트는 SQLite에 저장돼요. 세션 종료 후 전체 과정을 재생(replay)할 수 있어요.

<br />

## 시작하기

### 사전 준비

- [Claude Code](https://claude.ai/download) — CLI가 설치 및 인증된 상태여야 해요
- [Bun](https://bun.sh) — relay의 런타임이에요

### 1. 마켓플레이스 추가

```
/plugin marketplace add https://github.com/custardcream98/relay
```

### 2. 플러그인 설치

```
/plugin install relay
```

다음이 자동으로 설정돼요:
- Skills (`/relay:relay`, `/relay:init`, `/relay:agent`)
- MCP 서버 (`.mcp.json` 기반)
- PostToolUse 훅 (`hooks/hooks.json` 기반)

### 3. 프로젝트에서 사용하기

프로젝트 최초 사용 시:

```
/relay:init
```

전체 에이전트가 병렬로 코드베이스를 스캔해요. 각 에이전트는 자신의 역할에 맞는 부분을 파악하고 `.relay/memory/`에 기록해요. 최초 1회, 또는 프로젝트가 크게 바뀐 후 다시 실행하면 돼요.

이후 태스크 실행:

```
/relay:relay "쇼핑카트 기능 추가해줘"
```

특정 에이전트만 단독 호출:

```
/relay:agent fe "CartItem 컴포넌트 리팩토링해줘"
```

<br />

## 에이전트 커스터마이징

relay는 두 YAML 파일을 런타임에 병합해요.

```yaml
# agents.default.yml — 수정 비권장
agents:
  fe:
    name: Frontend Engineer
    systemPrompt: |
      You are a senior frontend engineer...

# agents.yml — 자유롭게 편집하세요
agents:
  fe:
    systemPrompt: |          # 기본값 오버라이드
      You are a React specialist...
  security:                  # 새 에이전트 추가
    name: Security Reviewer
    tools: [get_artifact, send_message]
    systemPrompt: |
      ...
  da:
    disabled: true           # 에이전트 비활성화
```

<br />

## 프로젝트 구조

```
relay/
├── .claude-plugin/
│   └── plugin.json              플러그인 매니페스트
├── packages/
│   ├── server/                  MCP 서버 + Hono REST + WebSocket
│   ├── shared/                  공유 타입 (AgentId, RelayEvent)
│   ├── dashboard/               React + Vite 실시간 UI
│   └── docs/                    Astro + Starlight 문서 사이트
├── skills/
│   ├── relay/SKILL.md           /relay:relay — 전체 워크플로 오케스트레이션
│   ├── init/SKILL.md            /relay:init — 병렬 프로젝트 스캔
│   └── agent/SKILL.md           /relay:agent — 단일 에이전트 직접 호출
├── hooks/
│   └── hooks.json               PostToolUse 훅 → 대시보드 상태 push
├── .mcp.json                    MCP 서버 설정
├── agents.default.yml           기본 에이전트 페르소나 + 워크플로 DAG
└── agents.yml                   사용자 커스텀 (오버라이드, extends, disabled)
```

<br />

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
| DB | `bun:sqlite` |
| 메모리 | Markdown 파일 (`.relay/memory/`) |
| 페르소나 설정 | YAML (`agents.yml`) |

<br />

## 로드맵

- [x] MCP 서버 + 기본 툴 (messaging, tasks)
- [x] 메모리 툴 + `.relay/memory/` 구조
- [x] 에이전트 페르소나 YAML 시스템
- [x] 아티팩트 및 리뷰 툴
- [x] 실시간 웹 대시보드
- [x] Skills (`/relay:relay`, `/relay:init`, `/relay:agent`)
- [x] Init Mode (병렬 프로젝트 스캔)
- [x] Claude Code Plugin 형식 (마켓플레이스 배포 가능)
- [ ] 에이전트 thinking 대시보드 스트리밍
- [ ] 세션 replay UI
- [ ] 공개 문서 사이트
