<br />

<p align="center">
  <img src="https://custardcream98.github.io/relay/favicon.svg" width="72" height="72" alt="relay icon" />
</p>

<h1 align="center">relay</h1>
<p align="center">
  <strong>Claude Code 위에서 동작하는 멀티 에이전트 협업 프레임워크.</strong>
  <br />
  <span>하나의 태스크. 온 팀이 움직여요. 어떤 역할이든, 어떤 도메인이든.</span>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@custardcream/relay"><img src="https://img.shields.io/npm/v/%40custardcream%2Frelay?style=flat-square&color=C17F24&label=npm" alt="npm version" /></a>
  &nbsp;
  <img src="https://img.shields.io/badge/license-MIT-C17F24?style=flat-square" alt="MIT license" />
  &nbsp;
  <img src="https://img.shields.io/badge/Claude%20Code-Plugin-E8A83A?style=flat-square&logo=anthropic&logoColor=white" alt="Claude Code Plugin" />
  &nbsp;
  <img src="https://img.shields.io/badge/runtime-Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js" />
</p>

<p align="center">
  <a href="./README.md">English</a>
  &nbsp;·&nbsp;
  <a href="https://custardcream98.github.io/relay/ko-KR">문서</a>
</p>

<br />
<br />

## 개념

일반적인 AI 코딩 툴은 에이전트 하나가 모든 걸 처리해요.

relay는 팀을 만들어요. 각 에이전트는 자신의 역할만 수행하고, 세션 시작부터 모든 에이전트가 동시에 살아있어요. 순서를 기다리지 않고, 메시지와 태스크에 반응하며 유기적으로 협업해요 — 슬랙에서 일하듯.

```
사용자: "쇼핑카트 기능 추가해줘"

[PM]       태스크 분해, 이슈 생성
[Designer] UX 플로우, 컴포넌트 스펙
[DA]       이벤트 스키마, 성과 지표 정의   ← 모두 동시에 실행
[FE]       FE 태스크 클레임 후 UI 구현
[BE]       API 계약 먼저 공유 후 구현
[FE] [BE]  브로드캐스트로 피어 리뷰 요청
[QA]       PR 완료 감지 → 테스트 시나리오 작성
[Deployer] QA 승인 메시지 확인 후 배포
```

웹개발팀에만 쓸 필요 없어요. 연구팀, 마케팅팀, 법무팀, 교육팀 — `agents.pool.yml`에 풀을 정의하면 매 세션마다 최적화된 팀을 자동으로 구성할 수 있어요. 추가 API 과금 없음.

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

| 카테고리 | 툴                     | 설명                                     |
| -------- | ---------------------- | ---------------------------------------- |
| 메시징   | `send_message`         | 특정 에이전트에게 메시지 전송            |
| 메시징   | `get_messages`         | 수신 메시지 조회                         |
| 태스크   | `create_task`          | 새 이슈 생성                             |
| 태스크   | `update_task`          | 태스크 상태/코멘트 업데이트              |
| 태스크   | `get_my_tasks`         | 내 담당 태스크 조회                      |
| 태스크   | `get_all_tasks`        | 세션 전체 태스크 조회                    |
| 태스크   | `claim_task`           | 태스크 원자적 클레임 (경쟁 조건 방지)    |
| 태스크   | `get_team_status`      | 상태별 태스크 집계                       |
| 아티팩트 | `post_artifact`        | 산출물 공유 (디자인 스펙, PR, 리포트 등) |
| 아티팩트 | `get_artifact`         | 산출물 조회                              |
| 리뷰     | `request_review`       | 리뷰 요청                                |
| 리뷰     | `submit_review`        | 리뷰 결과 제출                           |
| 메모리   | `read_memory`          | 이전 세션 기억 조회                      |
| 메모리   | `write_memory`         | 기억 갱신                                |
| 메모리   | `append_memory`        | 기억에 누적 추가                         |
| 세션     | `save_session_summary` | 세션 요약 저장                           |
| 세션     | `list_sessions`        | 과거 세션 목록                           |
| 세션     | `get_session_summary`  | 특정 세션 요약 조회                      |
| 가시성   | `broadcast_thinking`   | 에이전트 의도를 대시보드에 실시간 전송   |
| 세션     | `get_server_info`      | 대시보드 URL 및 세션 ID 조회            |
| 세션     | `start_session`        | 새 세션 초기화                          |
| 세션     | `list_agents`          | 활성 세션의 에이전트 목록 조회          |
| 세션     | `list_pool_agents`     | 풀 에이전트 목록 조회 (팀 구성용)       |
| 세션     | `get_workflow`         | 풀 파일의 워크플로 설정 조회            |

<br />

## 메모리 구조

에이전트의 기억은 수명이 다른 두 레이어로 분리돼요.

```
your-project/
└── .relay/
    ├── memory/                  세션 간 영속 기억 (git 커밋 권장)
    │   ├── project.md           아키텍처, 도메인, 기술 스택 요약
    │   └── agents/
    │       ├── pm.md
    │       ├── fe.md
    │       ├── be.md
    │       └── ...
    └── sessions/                세션별 감사 로그
        └── 2026-03-13-001/
            └── summary.md
```

**세션 시작 시** — `project.md`와 각 에이전트 개인 기억이 system prompt에 자동으로 주입돼요.

**세션 종료 시** — 각 에이전트가 `write_memory`로 새로 배운 것과 주요 결정을 기억에 추가해요.

기억은 평범한 Markdown 파일이에요. 직접 편집하거나 git으로 팀 전체가 공유할 수 있어요.

<br />

## 대시보드

MCP 서버는 `http://localhost:3456`에서 실시간 웹 대시보드도 함께 제공해요.

![relay 대시보드](./packages/docs/public/screenshots/dashboard-ko.png)

**Task Board** — 전체 이슈 현황 Kanban. 태스크 상태 변경 시 실시간으로 업데이트돼요.

**Message Feed** — 에이전트 간 대화를 Slack 스레드 형태로 보여줘요.

**Agent Thoughts** — 선택한 에이전트의 추론 과정을 실시간으로 스트리밍해요.

모든 이벤트는 SQLite에 저장돼요. 세션 종료 후 전체 과정을 재생(replay)할 수 있어요.

<br />

## 시작하기

### 사전 준비

- [Claude Code](https://claude.ai/download) — CLI가 설치 및 인증된 상태여야 해요
- [Node.js](https://nodejs.org) v18 이상

### 1. 플러그인 설치

```
/plugin marketplace add custardcream98/relay
/plugin install relay@relay
```

Skills (`/relay:relay`, `/relay:init`, `/relay:agent`)와 훅이 자동으로 설치돼요. `/reload-plugins`를 실행하거나 Claude Code를 재시작하세요.

> 특정 프로젝트에만 적용하려면 `--scope project`를 추가하세요.

### 2. 프로젝트에서 사용하기

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

## 팀 구성하기

relay는 기본 에이전트가 없어요. `.relay/agents.pool.yml`에 에이전트 풀을 정의하면 `/relay:relay`가 매 세션마다 태스크에 맞는 최적 팀을 자동으로 선택해요.

```yaml
# .relay/agents.pool.yml — 어떤 도메인이든 원하는 풀을 구성하세요
agents:
  pm:
    name: Project Manager
    emoji: "📋"
    tags: [planning, coordination]
    tools:
      [create_task, get_all_tasks, get_team_status, send_message, get_messages]
    systemPrompt: |
      You are the project manager. Break down requirements into tasks...

  researcher:
    name: Researcher
    emoji: "🔬"
    tags: [research, analysis]
    tools:
      [send_message, get_messages, get_all_tasks, claim_task, post_artifact]
    systemPrompt: |
      You are a researcher. Investigate topics and post findings as artifacts...

  researcher2:
    extends: researcher # 다른 에이전트 상속 후 일부만 오버라이드
    name: Senior Researcher
    emoji: "🔭"
```

`agents.pool.example.yml`을 `.relay/agents.pool.yml`로 복사하면 12개 이상의 페르소나가 포함된 풀로 바로 시작할 수 있어요.

필수 필드: `name`, `emoji`, `tools`, `systemPrompt`. 선택 필드: `description`, `tags`, `language`, `disabled`, `extends`.

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
└── agents.pool.example.yml      예시: 12개 이상의 에이전트 풀 (.relay/agents.pool.yml로 복사해서 사용)

your-project/
└── .relay/
    └── agents.pool.yml          내 팀 풀 정의 (agents.pool.example.yml에서 복사)
```

<br />

---

<p align="center">
  <strong>명령어 두 줄. 팀 전체. 다음 기능을 더 빠르게.</strong>
  <br /><br />
  <a href="https://custardcream98.github.io/relay/ko-KR"><strong>문서 보기 →</strong></a>
</p>
