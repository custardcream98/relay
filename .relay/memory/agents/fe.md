## tech-stack

# 프론트엔드 기술 스택 (packages/dashboard/)

## 핵심 라이브러리
- **React 19** + **Vite 8** (SPA)
- **TypeScript** (strict mode, tsconfig.app.json + tsconfig.node.json)
- **Tailwind CSS v4** — `@tailwindcss/vite` 플러그인 방식으로 통합 (별도 설정 파일 없음, `@import "tailwindcss"` 한 줄)

## 빌드 / 번들러
- Vite + `@vitejs/plugin-react`
- 빌드 결과물: `packages/dashboard/dist/` (서버의 `DASHBOARD_DIST` 경로와 일치)

## 개발 서버 Proxy
- `/api` → `http://localhost:3456` (Hono REST)
- `/ws` → `ws://localhost:3456` (Bun WebSocket)

## 공유 타입
- `@custardcream/relay-shared` (workspace:*) — `AgentId`, `RelayEvent` 등 공용 타입 정의
- Vite alias로 `../shared/index.ts`를 직접 참조 (빌드 시 번들 포함)

## 린터
- ESLint 9 + typescript-eslint + eslint-plugin-react-hooks + eslint-plugin-react-refresh
- Biome도 일부 사용 (biome-ignore 주석 존재)
## component-patterns

# 컴포넌트 패턴 (packages/dashboard/src/)

## 디렉토리 구조
```
src/
├── App.tsx              # 루트 컴포넌트 — useReducer로 전체 상태 관리
├── main.tsx             # React 진입점 (StrictMode)
├── index.css            # Tailwind import 한 줄
├── types.ts             # @custardcream/relay-shared 타입 re-export
├── hooks/
│   └── useRelaySocket.ts  # WebSocket 커스텀 훅
└── components/
    ├── AgentStatusBar.tsx  # 에이전트 목록 + 상태 표시 바
    ├── AgentThoughts.tsx   # 선택된 에이전트의 실시간 thinking 스트림
    ├── MessageFeed.tsx     # Slack 스타일 메시지 피드
    └── TaskBoard.tsx       # Kanban 보드 (todo/in_progress/in_review/done)
```

## 상태 관리
- **전역 상태**: `App.tsx`에서 `useReducer` + discriminated union Action 패턴
- 외부 라이브러리(Redux, Zustand 등) 없음 — 순수 React
- WebSocket 이벤트 → `dispatch({ type: "EVENT", event })` 로 상태 갱신

## useRelaySocket 훅 패턴
- `onEvent` 콜백을 `useRef`로 래핑해 stale closure 방지
- 지수 백오프 재연결: `[1000, 2000, 4000, 8000, 16000]ms`
- 컴포넌트 언마운트 시 `activeRef.current = false`로 클린업

## 컴포넌트 설계 원칙
- 함수형 컴포넌트만 사용
- Props 인터페이스를 컴포넌트 파일 상단에 로컬 정의 (공용 타입은 relay-shared에서)
- `useMemo`로 파생 데이터 캐싱 (예: TaskBoard의 tasksByStatus)
- Auto-scroll: `useRef<HTMLDivElement>` + `scrollIntoView` 패턴

## 레이아웃
- 전체 화면: `h-screen flex flex-col` (헤더 고정 + 본문 flex-1)
- 3분할 패널: `w-1/3` 균등 분할, `divide-x divide-gray-800`
- 다크 테마: `bg-gray-950` 베이스, `bg-gray-800/900` 카드/패널
## conventions

# 프론트엔드 코딩 컨벤션

## 언어 / 타입
- TypeScript strict mode 필수
- `interface`로 Props 타입 정의 (로컬 컴포넌트 파일 내 선언)
- 공용 타입은 `@custardcream/relay-shared`에서 import — 대시보드 자체에 타입 중복 금지
- `types.ts`는 shared 타입의 단순 re-export 용도로만 사용

## 스타일링
- Tailwind CSS v4 유틸리티 클래스만 사용 (커스텀 CSS 최소화)
- 다크 테마 기준: gray-950(배경), gray-800(카드), gray-400(서브 텍스트), white(주 텍스트)
- 에이전트별 컬러 코드: pm=purple, designer=pink, da=yellow, fe=blue, be=green, qa/deployer=orange
- 상태 표시: working=green, idle=gray, 연결=green-900, 끊김=red-900

## 파일 명명
- 컴포넌트: PascalCase (`TaskBoard.tsx`)
- 훅: camelCase with `use` prefix (`useRelaySocket.ts`)
- 일반 모듈: camelCase

## 패키지 매니저
- **bun** 전용 (npm/yarn/pnpm 사용 금지)
- 패키지 추가: `bun add <pkg>` (devDependencies: `bun add -d <pkg>`)

## 코멘트
- 소스 파일 최상단에 파일 경로 주석 (예: `// packages/dashboard/src/App.tsx`)
- 인라인 주석은 한국어

## API 통신
- REST: `fetch("/api/...")` (Vite proxy → Hono 서버)
- 실시간: `useRelaySocket` 훅 (WebSocket `/ws` 엔드포인트)
- 에러 처리: `.catch`로 에러 상태 플래그 설정, UI에 에러 메시지 표시

## 빌드 / 개발
- 개발: `bun run dashboard:dev` (루트) 또는 `bun run dev` (패키지 내)
- 빌드: `tsc -b && vite build` (타입 체크 선행 필수)
