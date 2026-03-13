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
    "hero.headline1": "A whole team.",
    "hero.headlineEm": "One YAML file.",
    "hero.subheadline":
      "Write a YAML file. Get a collaborating team of Claude agents — peer-to-peer, event-driven, no orchestrator code. Works inside Claude Code. No new API keys. No extra billing.",
    "hero.cta": "Get started",

    // HowItWorks
    "how.label": "// how it works",
    "how.title1": "Three commands.",
    "how.title2": "From install to running.",
    "how.subtitle": "No orchestrator. No extra billing. Just Claude Code's built-in Agent tool.",
    "how.step1.title": "Install",
    "how.step1.desc":
      "Add the relay MCP server to Claude Code with one command. Optionally customise agent personas in agents.yml.",
    "how.step2.title": "Init",
    "how.step2.desc":
      "Run /relay:init once. All agents scan the codebase in parallel and write shared memory to .relay/memory/.",
    "how.step3.title": "Ship",
    "how.step3.desc":
      "Describe the feature. All agents start simultaneously, claim tasks via MCP, and collaborate peer-to-peer until the work is done.",

    // AgentRoster
    "roster.label": "// bring your own team",
    "roster.title1": "Any team.",
    "roster.title2": "Any domain.",
    "roster.subtitle":
      "Define agents in agents.yml — give each one a persona and relay handles the rest. Web dev, research, marketing, legal — any workflow you can describe.",
    "roster.infoLead":
      "Each agent gets its own Claude Code session, persona, and access to the shared MCP tool set. Agents collaborate peer-to-peer — no orchestrator.",
    "roster.examplesLabel": "example team (agents.example.yml)",
    "roster.browseLink": "Browse agents.example.yml",

    // Features
    "features.label": "// why relay",
    "features.title1": "Transparent, lean,",
    "features.title2": "and composable.",
    "features.A.title": "MCP-native communication",
    "features.A.desc":
      "Agents communicate exclusively through MCP tools — send_message, create_task, post_artifact. Every interaction is auditable and replayable.",
    "features.A.detail": "Peer-to-peer. No orchestrator bottleneck.",
    "features.B.title": "Zero extra billing",
    "features.B.desc":
      "relay uses only Claude Code's built-in Agent tool. No direct Claude API calls, no additional token costs beyond what Claude Code already charges.",
    "features.B.detail": "Runs entirely on your existing Claude Code subscription.",
    "features.C.title": "Persistent shared memory",
    "features.C.desc":
      "Each session writes Markdown notes to .relay/memory/. Agents start the next session fully aware of prior decisions and patterns.",
    "features.C.detail": "Commit .relay/memory/ to git — your whole team shares context.",
    "features.D.title": "Realtime dashboard",
    "features.D.desc":
      "A WebSocket-powered Kanban board and message feed shows task state changes and inter-agent messages as they happen.",
    "features.D.detail": "Full session replay included. Review every task and message.",

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
    "hero.headline1": "하나의 YAML 파일.",
    "hero.headlineEm": "완전한 팀.",
    "hero.subheadline":
      "YAML 파일 하나로 충분합니다. Claude 에이전트들이 P2P로 협업합니다 — 이벤트 기반, 오케스트레이터 불필요. Claude Code 안에서 동작하며, 새 API 키도 추가 요금도 없습니다.",
    "hero.cta": "시작하기",

    // HowItWorks
    "how.label": "// 작동 방식",
    "how.title1": "세 가지 명령어.",
    "how.title2": "설치부터 실행까지.",
    "how.subtitle":
      "오케스트레이터도, 추가 요금도 없습니다. Claude Code 내장 Agent 툴만 사용합니다.",
    "how.step1.title": "설치",
    "how.step1.desc":
      "한 줄의 명령어로 relay MCP 서버를 Claude Code에 추가합니다. agents.yml로 에이전트 페르소나를 자유롭게 설정할 수 있습니다.",
    "how.step2.title": "초기화",
    "how.step2.desc":
      "/relay:init을 한 번 실행합니다. 모든 에이전트가 코드베이스를 병렬로 스캔하고 .relay/memory/에 공유 메모리를 기록합니다.",
    "how.step3.title": "배포",
    "how.step3.desc":
      "기능을 설명하면 됩니다. 모든 에이전트가 동시에 시작해 MCP로 작업을 분담하고, 작업이 완료될 때까지 P2P로 협업합니다.",

    // AgentRoster
    "roster.label": "// 나만의 팀을 구성하세요",
    "roster.title1": "어떤 팀이든.",
    "roster.title2": "어떤 도메인이든.",
    "roster.subtitle":
      "agents.yml에 에이전트와 페르소나를 정의하면 나머지는 relay가 알아서 합니다. 웹 개발, 리서치, 마케팅, 법무 — 어떤 워크플로든 설명할 수 있으면 됩니다.",
    "roster.infoLead":
      "각 에이전트는 독립적인 Claude Code 세션과 페르소나, 공유 MCP 툴셋을 가집니다. 에이전트끼리 P2P로 협업하며, 오케스트레이터가 필요 없습니다.",
    "roster.examplesLabel": "예시 팀 (agents.example.yml)",
    "roster.browseLink": "agents.example.yml 보기",

    // Features
    "features.label": "// relay를 선택하는 이유",
    "features.title1": "투명하고, 가볍고,",
    "features.title2": "유연하게 조합됩니다.",
    "features.A.title": "MCP 네이티브 통신",
    "features.A.desc":
      "에이전트는 MCP 툴만을 통해 통신합니다 — send_message, create_task, post_artifact. 모든 상호작용이 감사 가능하고 재현 가능합니다.",
    "features.A.detail": "P2P 구조로 오케스트레이터 병목이 없습니다.",
    "features.B.title": "추가 요금 없음",
    "features.B.desc":
      "relay는 Claude Code의 내장 Agent 툴만 사용합니다. Claude API를 직접 호출하지 않으므로 기존 Claude Code 구독 외에 추가 비용이 발생하지 않습니다.",
    "features.B.detail": "기존 Claude Code 구독으로 완전히 동작합니다.",
    "features.C.title": "세션 간 공유 메모리",
    "features.C.desc":
      "각 세션은 .relay/memory/에 Markdown 노트를 작성합니다. 에이전트들은 다음 세션에서 이전 결정과 패턴을 완전히 파악한 상태로 시작합니다.",
    "features.C.detail": ".relay/memory/를 git에 커밋해두면 팀 전원이 같은 컨텍스트를 공유합니다.",
    "features.D.title": "실시간 대시보드",
    "features.D.desc":
      "WebSocket 기반의 Kanban 보드와 메시지 피드로 작업 상태 변화와 에이전트 간 메시지를 실시간으로 확인할 수 있습니다.",
    "features.D.detail": "전체 세션 리플레이 기능 포함. 모든 작업과 메시지를 검토할 수 있습니다.",

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
    const enMap = ui["en"] as Record<string, string>;
    return langMap[key] ?? enMap[key];
  };
}
