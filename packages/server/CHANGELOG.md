# @custardcream/relay

## 0.3.0

### Minor Changes

- 1d1429b: Event-driven agent collaboration and generic agent system

  ## Breaking Changes

  - `agents.default.yml` now ships empty (`agents: {}`). The built-in web-dev team (pm, designer, da, fe, be, qa, deployer) has been moved to `agents.example.yml`. Users who relied on the default team must copy `agents.example.yml` to `agents.yml` in their project root, or define their own team.

  ## New Features

  - **Event-driven orchestration**: All agents spawn simultaneously and react to messages/tasks. Replaces the previous waterfall/sequential model.
  - **Atomic task claiming**: New `claim_task` MCP tool uses SQLite conditional UPDATE to prevent race conditions when multiple agents compete for the same task.
  - **Team status**: New `get_team_status` MCP tool returns aggregate task counts and a `has_pending_work` flag for orchestrator decision-making.
  - **All-tasks view**: New `get_all_tasks` MCP tool lets any agent see the full task board.
  - **Init team suggestion** (`/relay:init` Phase 0): When no agents are defined, the skill analyzes the project and proposes a tailored team before scanning.
  - **Generic reviewer pattern**: The relay skill now detects any `"Review requested: {agentId}"` broadcast and spawns the appropriate reviewer, instead of hardcoding specific agent IDs.
  - **Graceful server startup**: MCP server starts successfully even when `agents.yml` is missing, enabling Phase 0 of `/relay:init` to function correctly.
  - **`.relay/agents.yml` priority**: The loader now checks `.relay/agents.yml` before the project root `agents.yml`, allowing session-level overrides without touching the committed config.

## 0.2.1

### Patch Changes

- 6e8f3a9: Dashboard redesign: minimal aesthetic, CSS design tokens, Inter + JetBrains Mono fonts, improved visual hierarchy

## 0.2.0

### Minor Changes

- a31b752: Add per-agent language config, dashboard redesign, and agents.yml JSON schema

  - `language` field in `agents.yml`: set response language globally or per-agent
  - Dashboard: minimal redesign with IBM Plex fonts, resizable panels, markdown renderer
  - `agents.schema.json`: IDE autocompletion and validation for `agents.yml`
  - Skills: dashboard URL announcement on startup

## 0.1.0

### Minor Changes

- 148ff43: Support `.relay/agents.yml` as a project-local agent override

  Previously, per-project agent customization required editing `agents.yml` at the project root, which is part of the framework's own source tree. This change adds `.relay/agents.yml` as a higher-priority override path, so users can customize agents without touching framework files. The lookup order is now: `.relay/agents.yml` → `agents.yml` → built-in defaults.

## 0.0.3

### Patch Changes

- 4cfa872: fix: correct npx invocation in .mcp.json to use --package flag with explicit binary name

## 0.0.2

### Patch Changes

- 586776a: fix: specify relay-server bin name explicitly in .mcp.json npx args
