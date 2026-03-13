## test-setup

# 테스트 셋업

## 테스트 러너
- **Bun test** (`bun:test`) — Jest 호환 API (`describe`, `test`, `expect`, `beforeEach`, `afterEach`)
- 루트 `bun test` 명령은 `@custardcream/relay` (packages/server) 패키지의 `bun test`를 실행

## 테스트 파일 위치
모든 테스트 파일은 `packages/server/src/` 하위에 소스 파일과 나란히 위치 (co-located):

### DB 레이어
- `packages/server/src/db/schema.test.ts` — 마이그레이션: 5개 테이블(messages, tasks, artifacts, reviews, events) 생성 검증
- `packages/server/src/db/queries/artifacts.test.ts`
- `packages/server/src/db/queries/events.test.ts`
- `packages/server/src/db/queries/messages.test.ts`
- `packages/server/src/db/queries/reviews.test.ts`
- `packages/server/src/db/queries/tasks.test.ts`

### MCP 툴 레이어
- `packages/server/src/tools/messaging.test.ts` — send_message / get_messages
- `packages/server/src/tools/tasks.test.ts` — create_task / update_task / get_my_tasks
- `packages/server/src/tools/artifacts.test.ts`
- `packages/server/src/tools/memory.test.ts`
- `packages/server/src/tools/review.test.ts` — request_review / submit_review
- `packages/server/src/tools/sessions.test.ts`

### 에이전트 레이어
- `packages/server/src/agents/loader.test.ts` — YAML 로딩, extends, disabled, workflow 검증

## 테스트 패턴
- 모든 DB 연동 테스트는 `new Database(":memory:")` 인메모리 SQLite 사용
- `beforeEach`에서 `runMigrations(db)` 호출, `afterEach`에서 `db.close()`
- 핸들러 함수(`handleXxx`)를 직접 임포트해 단위 테스트

## 미커버 영역 (테스트 없음)
- `packages/server/src/index.ts` (엔트리 포인트 통합 테스트 없음)
- `packages/server/src/mcp.ts` (MCP 서버 등록 테스트 없음)
- `packages/server/src/dashboard/` (Hono API, WebSocket 테스트 없음)
- `packages/dashboard/` (React 프론트엔드 테스트 전무)
- `packages/shared/` (타입 파일만 존재, 테스트 불필요)
## ci-config

# CI/CD 구성

## GitHub Actions 워크플로우 파일
위치: `.github/workflows/`

### ci.yml — 주 CI 파이프라인
트리거: `push` to `main`, 모든 `pull_request`

병렬 실행되는 4개 job:
| Job | 내용 |
|-----|------|
| `check` | `bun run check` — Biome lint + format |
| `test` | `bun test` — 전체 단위 테스트 |
| `typecheck` | `bunx tsc --noEmit` — TypeScript 타입 검사 |
| `build-dashboard` | `bun run --filter @custardcream/relay-dashboard build` — React 빌드 검증 |

공통: `oven-sh/setup-bun@v2` (latest), `bun install --frozen-lockfile`

### release.yml — 릴리즈 자동화
트리거: `push` to `main`
- `changesets/action@v1` 사용
- 변경셋 있으면 "Version Packages" PR 자동 생성
- PR merge 시 `bun run release` (`build:release + changeset publish`) 실행 → npm 자동 배포
- 필요 시크릿: `GITHUB_TOKEN`, `NPM_TOKEN`

### deploy-docs.yml — 문서 배포
트리거: `push` to `main` (단, `packages/docs/**` 변경 시에만)
- Astro + Starlight 빌드 후 GitHub Pages에 배포

## 코드 품질 도구
- **Biome** (`@biomejs/biome`) — lint + format (ESLint/Prettier 대체)
- **Husky** — pre-commit hook (`bun run prepare`)
- **TypeScript strict mode** — 타입 안전성
## coverage

# 테스트 커버리지 현황

## 커버리지 도구
- **커버리지 설정 없음** — `bun test --coverage` 플래그 미사용
- CI `ci.yml`에 커버리지 리포트 수집/업로드 단계 없음
- Codecov, Coveralls 등 외부 커버리지 서비스 미연동

## 커버된 영역 (단위 테스트 존재)
- DB 스키마 마이그레이션 (5개 테이블)
- DB 쿼리 CRUD: artifacts, events, messages, reviews, tasks
- MCP 툴 핸들러: messaging, tasks, artifacts, memory, review, sessions
- 에이전트 loader: YAML 파싱, extends 상속, disabled 처리, workflow 로딩

## 미커버 영역 (테스트 공백)
- **통합 테스트** — MCP 서버 전체 실행 흐름
- **Hono REST API** — `packages/server/src/dashboard/hono.ts`
- **WebSocket** — `packages/server/src/dashboard/websocket.ts`
- **React 프론트엔드** — `packages/dashboard/` 전체 (컴포넌트, 훅, 상태관리)
- **E2E 테스트** — 에이전트 간 실제 통신 시나리오
- **훅(hooks)** — `hooks/hooks.json` PostToolUse 훅 동작

## QA 권고사항
1. `bun test --coverage` 추가하여 커버리지 수치 측정 시작
2. Hono API 엔드포인트 통합 테스트 작성
3. WebSocket 이벤트 브로드캐스트 테스트 작성
4. 대시보드 React 컴포넌트 테스트 도입 (vitest + testing-library 검토)
5. CI에 커버리지 임계값(threshold) 게이트 추가
