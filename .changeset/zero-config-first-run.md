---
"@custardcream/relay": minor
---

Zero-config first run — remove `/relay:init`, auto-generate agent pool

**BREAKING: `/relay:init` skill removed.**
When `/relay:relay` runs with no `.relay/agents.pool.yml`, it now auto-analyzes the project and generates a tailored agent pool (4-8 agents across 3 functional lanes: Coordination, Implementation, Quality). Existing pools are unaffected.

**Auto-Pool Generation:**
- Project analysis: reads README, package manifests, config files, directory structure
- 3-lane agent architecture: PM (always), Implementation (fe/be/mobile/devops/engineer/architect based on tech stack), Quality (qa/security based on project maturity)
- Hook auto-detection: biome, tsconfig, eslint, ruff, mypy, clippy, golangci-lint
- Agent prompts reference actual file paths, commands, and conventions
- First-session memory bootstrapping: agents discover and persist project knowledge

**Dashboard UX improvements:**
- Error boundary: catches uncaught render errors with fallback UI and reload button
- WebSocket max-retries UI: persistent "Unable to connect" banner after 5 failed reconnect attempts
- New agent highlight: 3-second glow animation when agents join mid-session
- Mobile responsive layout: panels stack vertically below 768px, drag-to-resize disabled on touch devices
