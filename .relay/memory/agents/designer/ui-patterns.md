## ui-patterns

### 전체 레이아웃 구조 (`App.tsx`)
```
<div h-screen flex flex-col>           -- surface-root 배경, 전체 화면
  <header h-10 (40px)>                 -- surface-base, border-bottom-subtle
    wordmark "relay" + "dashboard" pill badge | connection status dot
  </header>
  <AgentStatusBar h-36px>              -- surface-base, 에이전트 칩 가로 스크롤
  <3-panel resizable layout flex-1>   -- 패널 너비 비율 drag로 조정 (min 12%)
    Panel[0]: Task Board
    Panel[1]: Message Feed
    Panel[2]: Agent Thoughts
  </3-panel>
</div>
```

### 리사이즈 가능 3패널 시스템 (`useResizablePanels.ts`)
- 초기 균등 분할 (100/3 % 씩)
- 드래그 핸들: 패널 경계에 6px 오버레이, col-resize 커서
- 최소 패널 너비: 12%
- hover 시 `blue-500/20` 배경, 수직 선 `blue-500/50`

### 공통 패턴
- **배지/pill**: `surface-overlay` 배경, 3~4px border-radius, 10px font, uppercase/tracking 가능
- **칩**: border-radius 6px, padding 4px 10px, 선택 시 `surface-overlay` + `border-default`
- **hover**: inline style 직접 조작 (`onMouseEnter/Leave`) — 100ms transition
- **패널 헤더**: 32px (패널 내부), 36px (상태바/칸반 컬럼 헤더)
- **카드**: `surface-raised` 배경, `border-subtle`, `shadow-card`, hover 시 `shadow-card-hover`

### AgentStatusBar 컴포넌트
- `/api/agents` REST API로 에이전트 메타(id, name, emoji) 로드
- 각 에이전트: emoji + name + 상태 도트(5px 원) 칩
- 선택된 칩: `surface-overlay` + `border-default` / 미선택: transparent
- idle → opacity-50 emoji, working → accent 텍스트 + glow dot + scale-pulse 애니메이션
- waiting → `text-secondary`

### TaskBoard 컴포넌트 (Kanban)
- 4 컬럼: todo / in_progress / in_review / done
- in_progress: 상단 2px `rgba(96,165,250,0.5)` 액센트 바
- in_review: 상단 2px `rgba(251,191,36,0.5)` 액센트 바
- done: 상단 2px `rgba(52,211,153,0.5)` 액센트 바
- 태스크 카드 왼쪽: 2px 우선순위 액센트 바 (critical=#ef4444, high=#f97316, medium=#eab308)
- done 카드: opacity 0.45 + line-through
- 담당자 칩: `accent hex` 텍스트 + `accent + 1a` (10% opacity) 배경

### MessageFeed 컴포넌트
- Slack 스타일: 28px 원형 아바타(이니셜) + content 컬럼
- 아바타: `accent + 26`(15%) 배경, `accent + 40`(25%) 테두리
- 헤더: from_agent (accent 색) → to_agent (accent 색) 또는 "broadcast" pill
- 타임스탬프: JetBrains Mono, tabular-nums, 오른쪽 끝
- 본문: MarkdownContent 컴포넌트 렌더링
- 최신순(newest first) — 새 메시지 시 topRef로 smooth scroll

### AgentThoughts 컴포넌트
- 에이전트 미선택 시: 채팅버블 SVG 아이콘 + 안내 텍스트
- 선택 시 내부 서브헤더(36px): 에이전트명(accent 색) + 상태 배지(thinking.../waiting/idle)
- 스트림 영역: `surface-inset` 배경, JetBrains Mono, 12px/1.7 lineHeight
- 커서: working=accent색 고정, idle/waiting=text-disabled blink
- 유저 스크롤 감지(60px threshold) → "↓ latest" sticky 버튼

### MarkdownContent 컴포넌트 (의존성 없는 경량 렌더러)
- 지원: `**bold**`, `*italic*`, `` `code` ``, 코드블록(```) , H1/H2/H3, 테이블, 리스트(-/*), 빈줄
- 코드블록: `surface-inset` 배경, 언어 레이블(10px uppercase, disabled 색)
- 인라인 코드: `surface-overlay` 배경, text-primary 색

### UX 흐름
1. 사용자가 AgentStatusBar에서 에이전트 칩 클릭 → selectedAgent 상태 변경
2. AgentThoughts 패널 헤더가 "{agentId} — thoughts"로 업데이트
3. WebSocket으로 실시간 agent:thinking 청크 수신 → 스트림 append
4. agent:status 이벤트로 상태 도트 및 커서 스타일 변경
5. task:updated 이벤트로 TaskBoard 카드 즉시 갱신 (upsert)
6. message:new 이벤트로 MessageFeed 상단에 새 메시지 prepend
