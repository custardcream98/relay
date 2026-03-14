# @custardcream/relay

## 0.9.0

### Minor Changes

- 1bc8a19: Add `start_session` MCP tool and fix session ID isolation

  - Add `start_session` MCP tool: sets the active session ID on the server and broadcasts `session:started` to reset the live dashboard view
  - Fix frozen `SESSION_ID` bug: all server modules now call `getSessionId()` lazily so `start_session` takes effect
  - Add `session:started` to `RelayEvent` union; dashboard clears stale state on receipt
  - Update `/relay:relay` pre-flight to auto-increment NNN counter from `list_sessions` and call `start_session`
  - Fix `description` field missing from `task:updated` broadcast payloads

## 0.8.0

### Minor Changes

- Migrate to pool-only architecture with branded AgentId type

  - Remove `agents.default.yml`, `agents.example.yml`, and legacy `agents.yml` concept
  - All team composition now goes through `agents.pool.yml` (pool-only workflow)
  - Introduce branded `AgentId` type (`Brand<string, "AgentId">`) with `markAsAgentId()` helper in shared package
  - Fix `get_workflow` MCP tool to load actual pool file instead of returning empty jobs
  - Add comprehensive cross-session isolation tests (messages, tasks, artifacts, reviews)
  - Add `claim_task` race condition safety tests
  - Remove `agents.yml` references from docs, README, and CLAUDE.md

## 0.7.0

### Minor Changes

- 740dadf: Concurrent session isolation, session switcher, and dashboard improvements

  - **Concurrent session isolation**: `list_agents` now accepts an optional `session_id` parameter. The server uses a per-session `Map` cache instead of a global singleton, so two relay sessions running simultaneously no longer overwrite each other's agent configuration.
  - **Session switcher**: The dashboard header now shows a session dropdown. Select any past session to freeze the Task Board and Message Feed to that session's snapshot; a LIVE badge indicates you're viewing the current session.
  - **`GET /api/sessions/:id/snapshot`**: New endpoint returning `{ session_id, tasks, messages, artifacts }` for a given session.
  - **Agent thoughts**: Pool agents now include `broadcast_thinking` in their tool lists, completing the loop between the MCP tool and the dashboard Thoughts panel.
  - **Fix**: Agent cards now show the most recent task instead of the first task assigned.
  - **Remove**: `SessionReplay` component removed (replaced by the session switcher).

## 0.6.1

### Patch Changes

- 11e54b3: Fix dashboard agent card activity display and add broadcast_thinking MCP tool

  - Agent cards now show task title as fallback when agent has no messages yet (fixes "No activity yet")
  - Add `broadcast_thinking` MCP tool — emits `agent:thinking` WebSocket events to fill the Thoughts panel
  - Orchestrator now verifies open tasks before accepting `end:_done` to keep task board accurate
  - All agents receive task discipline + visibility guidance via injected system prompt note

## 0.6.0

### Minor Changes

- 2b9f81c: feat: dashboard enhancement — message feed, session replay, event filter, reconnect UI, auto session ID

  - Add MessageFeed panel with Slack-style thread view (TaskBoard ↔ Messages tab)
  - Add session replay UI with playback controls (GET /api/sessions)
  - Add EventTimeline type filter (7 toggles: messages/tasks/artifacts/thinking/status/memory/review)
  - Add reconnect progress UI (offline banner, countdown, retry button)
  - Add TaskBoard description preview (2-line clamp + hover tooltip)
  - Fix getAgentAccent() applied consistently across all components
  - Fix session:snapshot type safety (unknown[] → concrete types)
  - Fix session isolation: auto-generate unique session ID per server startup instead of defaulting to "default"
  - Add GET /api/sessions endpoint for session list
  - Add instanceId/port/agents to WebSocket snapshot payload

## 0.5.0

### Minor Changes

- ba4b65c: Add dynamic agent composition and multi-server support.

  - `loadPool()` function and `list_pool_agents` MCP tool for agent pool browsing
  - `RELAY_SESSION_AGENTS_FILE` env var for per-session team override
  - Auto port selection (3456–3465) when default port is occupied
  - `RELAY_DB_PATH` / `RELAY_INSTANCE` env vars for DB isolation
  - `--port` / `--session` CLI args as alternatives to env vars
  - Dashboard: `SessionTeamBadge`, `ServerSwitcher`, instance header
  - `agents.pool.example.yml` with 12 personas across web-dev, research, marketing
  - Skill: Team Composition pre-flight for conversational team selection

## 0.4.0

### Minor Changes

- dd59798: Migrate production runtime from Bun to Node.js and rename bin to `relay`

  **Breaking change:** MCP registration command has changed. Re-register with:

  ```
  claude mcp add --scope user relay -- npx -y --package @custardcream/relay relay
  ```

  - Replace Bun runtime with Node.js for production (`better-sqlite3`, `ws`, `@hono/node-server`)
  - Rename bin `relay-server` → `relay` — enables simpler `npx -y --package @custardcream/relay relay`
  - Bun remains as dev tooling only (test runner, build)

## 0.3.6

### Patch Changes

- 3303eb8: Overhaul dashboard UI: collapsible/resizable panels, Focus Mode agent detail, improved event timeline, clean code refactoring, and multiple bug fixes

## 0.3.5

### Patch Changes

- 3e5228d: fix: lazy-load agents in list_agents tool and use getRelayDir() in hono

  - list_agents MCP tool now lazy-loads agents on first call instead of at
    createMcpServer() time — fixes the timing bug where agents were loaded
    before setProjectRoot() was called (always returned empty list)
  - /api/sessions/:id endpoint now uses getRelayDir() instead of process.cwd()
  - db/client.ts uses dirname() for directory extraction instead of string manipulation

## 0.3.4

### Patch Changes

- a6c8440: fix: discover project root via MCP roots/list protocol

  - Introduce shared config module (config.ts) with getProjectRoot() / getRelayDir()
  - On MCP server start, call server.listRoots() to receive the workspace root from
    the MCP client (Claude Code) — resolves the bunx CWD=/tmp problem without
    requiring any per-project configuration
  - All modules (loader, db/client, mcp tools) now use getRelayDir() consistently
  - Falls back to RELAY_PROJECT_ROOT env var, then process.cwd() if roots unavailable

## 0.3.3

### Patch Changes

- ad89b4a: fix: resolve /api/agents 500 error and move DB to .relay directory

  - Add try/catch to /api/agents endpoint to return JSON error instead of generic 500
  - Change default DB path from relay.db (CWD-relative) to .relay/relay.db (RELAY_DIR-relative)
  - Auto-create RELAY_DIR if it doesn't exist when initializing the DB
  - Support RELAY_PROJECT_ROOT env var in both loader and DB client to override CWD
    (needed when running via bunx which sets CWD to /tmp)

## 0.3.2

### Patch Changes

- 6466e81: fix: use bunx instead of npx in .mcp.json to correctly run the Bun-native relay-server binary

## 0.3.1

### Patch Changes

- 4381349: fix: prevent manual server execution and handle port conflicts gracefully

  - Add TTY guard that blocks direct terminal runs with a helpful error message — relay-server must be started via Claude Code MCP (stdio), not directly
  - Wrap dashboard `Bun.serve()` in try-catch so that port 3456 conflicts no longer crash the MCP process; the MCP stdio server will still start even if the dashboard port is already in use

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
