// 랜딩 페이지 전용 번역 파일
// Astro 컴포넌트에서 useTranslations(lang)으로 사용

export type Lang = "en" | "ko-KR";

const ui = {
  en: {
    // Nav
    "nav.docs": "Docs",
    "nav.langToggle": "한국어",
    "nav.langHref.suffix": "/ko-KR/",

    // Hero
    "hero.headline1": "You think it.",
    "hero.headlineEm": "Your team builds it.",
    "hero.subheadline":
      "Write a YAML file. Get a collaborating team of Claude agents — peer-to-peer, event-driven, no orchestrator code. Works inside Claude Code. No new API keys. No extra billing.",
    "hero.cta": "Get started in 2 min",

    // HowItWorks
    "how.label": "// how it works",
    "how.title1": "Three commands.",
    "how.title2": "From install to running.",
    "how.subtitle": "No orchestrator. No extra billing. Just Claude Code's built-in Agent tool.",
    "how.step1.title": "Install",
    "how.step1.desc":
      "Register the relay MCP server with one command. Pick agents from the pool — any role, any domain.",
    "how.step2.title": "Init",
    "how.step2.desc":
      "Run /relay:init once per project. Every agent scans the codebase in parallel and writes shared context to .relay/memory/. Commit it to git.",
    "how.step3.title": "Ship",
    "how.step3.desc":
      "Describe what you want built. All agents start simultaneously, claim tasks, and collaborate peer-to-peer — no phases, no waiting.",
    "how.step4.title": "Watch it run",
    "how.step4.desc":
      "Open the realtime dashboard while agents are running. Kanban board, message feed, and live agent reasoning — all updating via WebSocket.",

    // AgentRoster
    "roster.label": "// bring your own team",
    "roster.title1": "Any team.",
    "roster.title2": "Any domain.",
    "roster.subtitle":
      "Define agents in the pool — give each one a persona and relay handles the rest. Web dev, research, marketing, legal — any workflow you can describe.",
    "roster.infoLead":
      "Each agent gets its own Claude Code session, persona, and access to the shared MCP tool set. Agents collaborate peer-to-peer — no orchestrator.",
    "roster.examplesLabel": "example team (agents.pool.example.yml)",
    "roster.domainNote":
      "This is a web-dev team — one example. Build a research team, marketing team, legal team, or any combination. Any role you can describe in a system prompt.",
    "roster.browseLink": "Browse agents.pool.example.yml",

    // Features
    "features.label": "// why relay",
    "features.title1": "Transparent, lean,",
    "features.title2": "and composable.",
    "features.A.title": "Peer-to-peer, no orchestrator",
    "features.A.desc":
      "Agents communicate directly through MCP tools — send_message, create_task, post_artifact. No central bottleneck. Every interaction is auditable and replayable.",
    "features.A.detail": "claim_task is atomic. Race conditions handled.",
    "features.B.title": "No extra billing",
    "features.B.desc":
      "relay uses only Claude Code's built-in Agent tool. No direct Claude API calls — you pay exactly what Claude Code charges, nothing more.",
    "features.B.detail": "Runs on your existing Claude Code subscription.",
    "features.C.title": "Memory that persists across sessions",
    "features.C.desc":
      "Agents write Markdown notes to .relay/memory/ after each session. The next session starts with full context — decisions made, patterns learned, mistakes noted.",
    "features.C.detail": "Plain Markdown. Commit to git. Editable by anyone.",
    "features.D.title": "Realtime dashboard",
    "features.D.desc":
      "A live Kanban board, Slack-style message feed, and per-agent reasoning stream — all updating via WebSocket as work happens. Full session replay included.",
    "features.D.detail": "Open http://localhost:3456 while agents are running.",

    // QuickStart
    "qs.label": "// quick start",
    "qs.title1": "Up and running",
    "qs.title2": "in two minutes.",
    "qs.desc":
      "Three commands take you from installation to a running multi-agent team working through your feature collaboratively.",
    "qs.link": "Full installation guide",
    "qs.step1.label": "Install the MCP server",
    "qs.step1.comment": "# registers relay MCP server globally",
    "qs.step2.label": "Initialise project memory",
    "qs.step2.comment": "# agents scan the codebase in parallel",
    "qs.step3.label": "Ship a feature",
    "qs.step3.comment": "# all agents start simultaneously, peer-to-peer",
    "qs.prereqNote":
      "Note: Copy agents.pool.example.yml to .relay/agents.pool.yml before running /relay:init.",

    // DashboardPreview
    "dashboard.label": "// live dashboard",
    "dashboard.title1": "Watch the team",
    "dashboard.title2": "work in real time.",
    "dashboard.subtitle": "Every task, message, and thought — visible as it happens.",
    "dashboard.panel.tasks": "Task Board",
    "dashboard.panel.messages": "Messages",
    "dashboard.panel.thoughts": "Agent Thoughts",
    "dashboard.col.todo": "TODO",
    "dashboard.col.inprogress": "IN PROGRESS",
    "dashboard.col.inreview": "IN REVIEW",
    "dashboard.col.done": "DONE",

    // Footer
    "footer.tagline": "Multi-agent framework for Claude Code.",
    "footer.docs": "Docs",
    "footer.github": "GitHub",
    "footer.npm": "npm",
  },
  "ko-KR": {
    // Nav
    "nav.docs": "문서",
    "nav.langToggle": "English",
    "nav.langHref.suffix": "/",

    // Hero
    "hero.headline1": "지시 한 번.",
    "hero.headlineEm": "완전한 팀으로.",
    "hero.subheadline":
      "YAML 파일 하나로 충분합니다. Claude 에이전트들이 P2P로 협업합니다 — 이벤트 기반, 오케스트레이터 불필요. Claude Code 안에서 동작하며, 새 API 키도 추가 요금도 없습니다.",
    "hero.cta": "2분 만에 시작하기",

    // HowItWorks
    "how.label": "// 작동 방식",
    "how.title1": "세 가지 명령어.",
    "how.title2": "설치부터 실행까지.",
    "how.subtitle":
      "오케스트레이터도, 추가 요금도 없습니다. Claude Code 내장 Agent 툴만 사용합니다.",
    "how.step1.title": "설치",
    "how.step1.desc":
      "명령어 한 줄로 relay MCP 서버를 등록합니다. 풀에서 에이전트를 선택하세요 — 어떤 역할, 어떤 도메인이든 가능합니다.",
    "how.step2.title": "초기화",
    "how.step2.desc":
      "프로젝트당 한 번 /relay:init을 실행합니다. 모든 에이전트가 병렬로 코드베이스를 스캔하고 .relay/memory/에 공유 컨텍스트를 기록합니다. git에 커밋하세요.",
    "how.step3.title": "배포",
    "how.step3.desc":
      "만들고 싶은 것을 설명하면 됩니다. 모든 에이전트가 동시에 시작해 작업을 클레임하고 P2P로 협업합니다 — 단계도 없고 대기도 없습니다.",
    "how.step4.title": "실시간으로 확인",
    "how.step4.desc":
      "에이전트가 실행되는 동안 실시간 대시보드를 열어보세요. Kanban 보드, 메시지 피드, 에이전트별 추론 스트림이 WebSocket으로 업데이트됩니다.",

    // AgentRoster
    "roster.label": "// 나만의 팀을 구성하세요",
    "roster.title1": "어떤 팀이든.",
    "roster.title2": "어떤 도메인이든.",
    "roster.subtitle":
      "풀에 에이전트와 페르소나를 정의하면 나머지는 relay가 알아서 합니다. 웹 개발, 리서치, 마케팅, 법무 — 어떤 워크플로든 설명할 수 있으면 됩니다.",
    "roster.infoLead":
      "각 에이전트는 독립적인 Claude Code 세션과 페르소나, 공유 MCP 툴셋을 가집니다. 에이전트끼리 P2P로 협업하며, 오케스트레이터가 필요 없습니다.",
    "roster.examplesLabel": "예시 팀 (agents.pool.example.yml)",
    "roster.domainNote":
      "이것은 웹 개발 팀의 예시입니다. 리서치 팀, 마케팅 팀, 법무 팀 등 어떤 조합이든 구성할 수 있습니다. 시스템 프롬프트로 설명할 수 있는 역할이라면 모두 가능합니다.",
    "roster.browseLink": "agents.pool.example.yml 보기",

    // Features
    "features.label": "// relay를 선택하는 이유",
    "features.title1": "투명하고, 가볍고,",
    "features.title2": "유연하게 조합됩니다.",
    "features.A.title": "P2P 통신, 오케스트레이터 불필요",
    "features.A.desc":
      "에이전트는 MCP 툴로만 통신합니다 — send_message, create_task, post_artifact. 중앙 병목이 없습니다. 모든 상호작용이 감사 가능하고 재현 가능합니다.",
    "features.A.detail": "claim_task는 원자적입니다. 레이스 컨디션 방지.",
    "features.B.title": "추가 요금 없음",
    "features.B.desc":
      "relay는 Claude Code의 내장 Agent 툴만 사용합니다. Claude API를 직접 호출하지 않아 기존 Claude Code 구독 요금 외 추가 비용이 없습니다.",
    "features.B.detail": "기존 Claude Code 구독으로 완전히 동작합니다.",
    "features.C.title": "세션을 넘는 공유 메모리",
    "features.C.desc":
      "에이전트는 세션 종료 후 .relay/memory/에 Markdown 노트를 작성합니다. 다음 세션은 이전 결정, 학습된 패턴, 기록된 실수를 모두 파악한 채로 시작합니다.",
    "features.C.detail": "일반 Markdown. git에 커밋. 누구나 편집 가능.",
    "features.D.title": "실시간 대시보드",
    "features.D.desc":
      "실시간 Kanban 보드, Slack 스타일 메시지 피드, 에이전트별 추론 스트림 — 작업이 진행되는 동안 WebSocket으로 모두 업데이트됩니다. 전체 세션 리플레이 포함.",
    "features.D.detail": "에이전트 실행 중 http://localhost:3456을 열어보세요.",

    // QuickStart
    "qs.label": "// 빠른 시작",
    "qs.title1": "2분이면",
    "qs.title2": "시작할 수 있습니다.",
    "qs.desc":
      "명령어 세 줄로 설치부터 멀티 에이전트 팀이 함께 기능을 구현하는 단계까지 바로 진입할 수 있습니다.",
    "qs.link": "전체 설치 가이드",
    "qs.step1.label": "MCP 서버 설치",
    "qs.step1.comment": "# relay MCP 서버를 전역으로 등록합니다",
    "qs.step2.label": "프로젝트 메모리 초기화",
    "qs.step2.comment": "# 에이전트들이 코드베이스를 병렬로 스캔합니다",
    "qs.step3.label": "기능 출시",
    "qs.step3.comment": "# 모든 에이전트가 동시에 시작, P2P 협업",
    "qs.prereqNote":
      "참고: /relay:init 실행 전에 agents.pool.example.yml을 .relay/agents.pool.yml로 복사해서 시작하세요.",

    // DashboardPreview
    "dashboard.label": "// 실시간 대시보드",
    "dashboard.title1": "팀이 일하는 모습을",
    "dashboard.title2": "실시간으로 지켜보세요.",
    "dashboard.subtitle": "모든 태스크, 메시지, 추론 — 발생하는 즉시 확인할 수 있습니다.",
    "dashboard.panel.tasks": "태스크 보드",
    "dashboard.panel.messages": "메시지",
    "dashboard.panel.thoughts": "에이전트 추론",
    "dashboard.col.todo": "할 일",
    "dashboard.col.inprogress": "진행 중",
    "dashboard.col.inreview": "검토 중",
    "dashboard.col.done": "완료",

    // Footer
    "footer.tagline": "Claude Code를 위한 멀티 에이전트 프레임워크.",
    "footer.docs": "문서",
    "footer.github": "GitHub",
    "footer.npm": "npm",
  },
} as const;

export type UIKeys = keyof (typeof ui)["en"];

export function useTranslations(lang: Lang) {
  return function t(key: UIKeys): string {
    const langMap = ui[lang] as Record<string, string>;
    const enMap = ui.en as Record<string, string>;
    return langMap[key] ?? enMap[key];
  };
}
