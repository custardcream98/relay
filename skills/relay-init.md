<!-- skills/relay-init.md -->
# relay-init

프로젝트에 처음 relay를 사용하거나 팀이 프로젝트 컨텍스트를 새로 파악해야 할 때 실행한다.
`.relay/memory/`가 없으면 `/relay` 실행 시 자동으로 이 스킬 실행을 제안한다.

## 실행 전 확인

1. relay MCP 서버가 연결되어 있는지 확인 (`list_agents` 툴 호출)
2. `.relay/memory/` 디렉토리가 존재하는지 확인

## Phase 1: 병렬 프로젝트 스캔

아래 에이전트들을 **동시에** spawn한다 (dispatching-parallel-agents 패턴).
각 에이전트의 system prompt는 `list_agents` 툴로 로드한다.

각 에이전트에게 전달할 공통 지시:
> "프로젝트를 처음 파악하는 init 모드입니다.
>  코드베이스를 탐색하고 당신의 역할 관점에서 중요한 정보를 `write_memory` 툴로 저장하세요.
>  탐색 완료 후 `send_message(to: null, content: 'init-done')`을 보내세요."
>  (to: null은 브로드캐스트 — 모든 에이전트에게 전달됨)

**PM** — 탐색 대상:
- README.md, CLAUDE.md, package.json
- 전체 디렉토리 구조
- 기존 이슈/PR 컨텍스트 (있다면)
- 저장 키: `domain`, `architecture`, `team-conventions`

**FE** — 탐색 대상:
- 프론트엔드 코드 구조 (`src/`, `app/`, `components/` 등)
- 사용 중인 프레임워크, 상태관리, 스타일링 방식
- 저장 키: `tech-stack`, `component-patterns`, `conventions`

**BE** — 탐색 대상:
- 백엔드 코드 구조
- API 라우트, DB 스키마, 외부 서비스 의존성
- 저장 키: `api-structure`, `db-schema`, `external-deps`

**DA** — 탐색 대상:
- 기존 분석/메트릭 코드, 로깅 설정
- 저장 키: `existing-events`, `metrics-setup`

**Designer** — 탐색 대상:
- UI 컴포넌트 라이브러리 여부, 디자인 토큰
- 저장 키: `design-system`, `ui-patterns`

**QA** — 탐색 대상:
- 테스트 파일 현황, CI/CD 설정, 커버리지
- 저장 키: `test-setup`, `ci-config`, `coverage`

## Phase 2: 교차 검증

모든 에이전트의 init-done 메시지 수신 후:
- PM이 각 에이전트 기억을 읽고 `project.md` 통합 요약 작성
- `write_memory(key: 'summary', content: ...)` 로 프로젝트 전체 요약 저장

## Phase 3: 완료 보고

사용자에게 init 결과 요약:
- 파악된 기술 스택
- 주목할 만한 발견사항
- 이제 `/relay "태스크 설명"` 으로 바로 시작 가능
