---
name: init
description: Run this when using relay for the first time on a project, or when the team needs to re-scan project context. Spawns all agents in parallel to read the codebase and write .relay/memory/ files.
---

Run this when using relay for the first time on a project, or when the team needs to re-scan project context.
If `.relay/memory/` is absent when `/relay:relay` runs, it will automatically suggest running this skill first.

## Pre-flight checks

1. Verify the relay MCP server is connected (call the `list_agents` tool)
2. Check whether the `.relay/memory/` directory exists
3. Tell the user: "Dashboard: http://localhost:3456"

## Phase 1: Parallel project scan

Spawn the agents below **simultaneously** (dispatching-parallel-agents pattern).
Load each agent's system prompt via the `list_agents` tool.

Common instruction to send each agent:
> "This is init mode — you are seeing the project for the first time.
>  Explore the codebase and use the `write_memory` tool to store important information from your role's perspective.
>  When done, send: `send_message(to: null, content: 'init-done')`"
>  (to: null is broadcast — delivered to all agents)

**PM** — areas to scan:
- README.md, CLAUDE.md, package.json
- Overall directory structure
- Existing issues/PR context (if any)
- Memory keys: `domain`, `architecture`, `team-conventions`

**FE** — areas to scan:
- Frontend code structure (`src/`, `app/`, `components/`, etc.)
- Framework, state management, and styling approach in use
- Memory keys: `tech-stack`, `component-patterns`, `conventions`

**BE** — areas to scan:
- Backend code structure
- API routes, DB schema, external service dependencies
- Memory keys: `api-structure`, `db-schema`, `external-deps`

**DA** — areas to scan:
- Existing analytics/metrics code, logging configuration
- Memory keys: `existing-events`, `metrics-setup`

**Designer** — areas to scan:
- UI component library usage, design tokens
- Memory keys: `design-system`, `ui-patterns`

**QA** — areas to scan:
- Test file coverage, CI/CD configuration, coverage reports
- Memory keys: `test-setup`, `ci-config`, `coverage`

## Phase 2: Cross-validation

Collect init-done messages from all agents:
- Repeatedly call `get_messages()` to detect messages where `content === "init-done"`.
- Proceed once init-done messages from all agents (per list_agents results) are received.
- After a maximum wait of 5 minutes, proceed even if some agents have not responded.

PM reads each agent's memory and writes a unified project summary:
- `read_memory(agent_id: "fe")`, `read_memory(agent_id: "be")`, ... collect each agent's memory.
- `write_memory(key: "summary", content: ...)` to save the integrated summary to `project.md`.

## Phase 3: Completion report

Report init results to the user:
- Identified tech stack
- Notable findings
- Ready to start with `/relay:relay "task description"`
