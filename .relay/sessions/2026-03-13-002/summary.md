# Session Summary: 2026-03-13-002

Session 2026-03-13-002: Docs overhaul — landing page redesign, full English translation, accuracy fixes, install script consistency.

Accomplishments:
- AgentRoster.astro: replaced "Seven specialists. One codebase." hardcoded 7-agent grid with "Any team. Any domain." + agents.yml snippet + example-team chips clearly labelled as examples
- Hero.astro: subheadline changed from listing 7 specific agents to "whatever team you define in agents.yml"; stat changed from "7 agents" to "∞ agent types"
- All 13 docs MDX files translated from Korean to English (titles, descriptions, all prose)
- installation.mdx: removed non-existent /plugin marketplace add and /plugin install relay commands; replaced with correct Global/Local install tabs using proper claude mcp add command
- Footer.astro: updated to show full consistent install command (was showing incomplete bunx-only command)
- All docs build: 15 pages, 0 errors, 0 warnings
