## design-system

### 기술 스택
- Tailwind CSS v4 (`@tailwindcss/vite` 플러그인, `tailwind.config.js` 없음 — CSS import 방식)
- 폰트: Inter (sans, 14..32 가변축, 400/450/500/600), JetBrains Mono (400/500)
- Google Fonts via `@import url(...)` in `index.css`
- CSS 커스텀 프로퍼티(변수) 기반 디자인 토큰 (`index.css` `:root`)
- 외부 컴포넌트 라이브러리 없음 — 모두 직접 구현

### 컬러 토큰 (`:root` in `index.css`)

**Surface (어두운 다크모드, 5단계 깊이)**
- `--color-surface-root`: #0c0c0f (최외곽 배경)
- `--color-surface-base`: #111116 (헤더/상태바)
- `--color-surface-raised`: #17171d (카드)
- `--color-surface-overlay`: #1e1e26 (배지/칩 배경)
- `--color-surface-inset`: #0a0a0e (코드 블록/thoughts 스트림 영역)

**Border (알파 기반)**
- `--color-border-subtle`: rgba(255,255,255,0.08)
- `--color-border-default`: rgba(255,255,255,0.12)
- `--color-border-strong`: rgba(255,255,255,0.18)

**Text (4단계 계층)**
- `--color-text-primary`: #e8e8ed
- `--color-text-secondary`: #9898a8
- `--color-text-tertiary`: #666672
- `--color-text-disabled`: #4a4a55

**에이전트 액센트 (역할별 고유 색상)**
- pm: #a78bfa (보라), designer: #f472b6 (핑크), da: #fbbf24 (노랑)
- fe: #60a5fa (파랑), be: #34d399 (에메랄드), qa: #fb923c (오렌지), deployer: #f97316 (주황)
- `constants/agents.ts`의 `AGENT_ACCENT_HEX` 맵에 동기화됨

**상태/우선순위 색상**
- working: #34d399, waiting: #fbbf24, idle: #2d2d35
- critical: #ef4444, high: #f97316, medium: #eab308
- connection-live: #34d399, connection-dead: #ef4444

**그림자**
- `--shadow-card`: 0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)
- `--shadow-card-hover`: 0 2px 8px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.07)

### 애니메이션
- `scale-pulse` (1.2s ease-in-out infinite): working 상태 도트 pulse
- `blink` (1.2s step-end infinite): idle 커서 깜박임
- 스크롤바: 4px thin, `--color-border-default` thumb
