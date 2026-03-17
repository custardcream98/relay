# @custardcream/relay

## 0.15.0

### Minor Changes

- 3c06649: Zero-config first run — remove `/relay:init`, auto-generate agent pool

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

## 0.14.0

### Minor Changes

- e3afbd8: Reliability features and API cleanup (27→23 tools)

  **New features:**

  - Derived task provenance with circuit breaker (`parent_task_id`, `depth`, max depth 1, max 3 siblings)
  - Orchestrator state persistence (`save_orchestrator_state` / `get_orchestrator_state`)
  - `validate_prompt` per-agent field for declarative completion validation
  - Completion-check REST endpoint for Stop hook enforcement
  - Hook scripts: orchestrator stop guard, edit guard, session cleanup
  - Optional Planning Phase in relay skill (PM pre-populates task board)

  **API cleanup — removed 4 redundant tools:**

  - `get_my_tasks` → use `get_all_tasks(assignee: agent_id)` instead
  - `get_team_status` → derive from `get_all_tasks` results
  - `get_ready_tasks` → filter `get_all_tasks` by dependency status
  - `get_workflow` → unused, removed

  **Bug fix:**

  - Review workflow now correctly calls `request_review` before `submit_review`

## 0.13.1

### Patch Changes

- 2a15b7a: ## Refactoring: Remove SQLite db layer, improve dashboard styling

  ### Server (`@custardcream/relay`)

  **Remove redundant `db/queries/` pass-through layer**

  - Deleted `db/queries/` (artifacts, events, messages, reviews, sessions, tasks), `db/client.ts`, `db/schema.ts`, and `db/types.ts` — these were zero-value wrappers after the SQLite → in-memory store migration
  - All tools, hono routes, and WebSocket handlers now import directly from `store.ts`
  - Tests migrated from per-test SQLite instances to `_resetStore()` — faster, no native bindings required

  No changes to any MCP tool API or agent configuration format.

  ### Dashboard (`@custardcream/relay-dashboard`, internal)

  **Introduce `cn()` utility (clsx + tailwind-merge)**

  - `src/lib/cn.ts`: `cn(...inputs)` helper for safe, conflict-free Tailwind class composition

  **Maximize Tailwind CSS usage — 84% reduction in inline styles (262 → 41)**

  - All color tokens expressed via CSS-variable arbitrary values (`bg-[var(--color-surface-raised)]`)
  - Animations via arbitrary animation classes (`animate-[blink_1.1s_step-end_infinite]`)
  - Conditional classes composed with `cn()`, replacing JS hover state handlers
  - Added CSS custom properties for warning banner and priority colors to `index.css`
  - Remaining 41 inline styles are all legitimate runtime-dynamic values (hex+alpha agent accents, `color-mix()` backdrop, `WebkitLineClamp`, drag-resize state)

## 0.13.0

### Minor Changes

- c3d995c: ## Clean Code Refactoring — Server, Dashboard, Shared

  Comprehensive clean-code pass across the entire codebase. No breaking changes to MCP tool APIs or agent configuration format.

  ### Server (`@custardcream/relay`)

  **Architecture**

  - `mcp.ts` decomposed from 845 lines into a 61-line thin orchestrator + 7 `registerXxxTools()` files under `src/tools/`
  - `agents/cache.ts` introduced as the single source of truth for agent and pool caching — eliminates the dual-cache bug between `mcp.ts` and `hono.ts`
  - `src/schemas.ts`: `AGENT_ID_SCHEMA` centralizes the Zod agent-id validation that was copy-pasted 18+ times
  - `src/utils/validate.ts`: `isValidId()` centralized (was duplicated in `memory.ts` and `sessions.ts`)
  - `src/utils/broadcast.ts`: `taskToPayload()` eliminates 3 duplicate task broadcast payload constructions

  **Performance**

  - `getTeamStatus`: O(5n) multi-filter replaced with O(n) single-pass accumulator

  **Type Safety**

  - `TaskRow.status` and `TaskRow.priority` now typed as `TaskStatus`/`TaskPriority` union types
  - `buildSessionSnapshot` return value typed as `Extract<RelayEvent, { type: "session:snapshot" }>`

  **Cleanup**

  - Dead `_db: SqliteDatabase` parameter removed from all 17 `db/queries/*.ts` functions (YAGNI)
  - `now()` renamed to `nowSeconds()` for naming clarity
  - `loader.ts` decomposed into `resolveBaseAgents()` + `resolveExtendsAgents()` + `validateAgentId()`
  - `isLocalhostOrigin()` extracted to `dashboard/utils.ts` (3 duplicate inline checks removed)
  - Generic REST error messages in `hono.ts` (no more internal path leakage)
  - `RELAY_DIR` validated as absolute path in `config.ts`
  - Non-`/ws` WebSocket upgrade connections now destroyed in `index.ts`
  - Hook trust boundary documented in `hook-runner.ts`

  **Tests**

  - 176 → 180 passing tests
  - New: `get_messages` self-exclusion filter, `get_all_tasks` status filter, `update_task` no-valid-fields guard
  - Strengthened: weak assertions, env isolation, schema reset coverage

  ### Dashboard (`@custardcream/relay`)

  **React Best Practices**

  - All 4 `Context.Provider` values wrapped in `useMemo` (prevents consumers re-rendering on unrelated App state changes)
  - Both fetch effects (`/api/agents`, `/api/servers`) use `AbortController` with cleanup
  - `PanelResizeContext` value stabilized with `useMemo`

  **Component Architecture**

  - `TaskBoard.tsx`: 605 → 237 lines; `TaskDetailModal`, `TaskCard`, `TaskColumn` extracted
  - `AgentAvatar` and `AgentChip` extracted to `components/shared/` (were duplicated in `ActivityFeed` and `MessageFeed`)
  - `usePanelCollapse` hook extracted from `usePanelResize` (SRP)
  - `applySnapshot()` and `normalizeUrl()` extracted as pure module-level helpers

  **Performance**

  - `React.memo` on 6 sub-components in `ActivityFeed`
  - `useMemo` for `filtered` and `thinkingAgents` computations
  - Inline JSX style objects replaced with stable `useMemo` references in `AgentCard`, `ActivityFeed`

  **Bug Fixes**

  - pm accent color `#a78bfa` → `#c084fc` (was out of sync with CSS `--color-accent-pm`)
  - `AgentAvatar` missing `aria-hidden="true"` (accessibility)
  - `onMouseEnter/Leave` DOM style mutation replaced with CSS `:hover` (React anti-pattern)
  - `rules-of-hooks` violation in `ActivityFeed.MessageDirectEntry` fixed
  - `rgba()` magic strings replaced with CSS custom properties throughout

  ### Shared (`@custardcream/relay-shared`)

  - `TaskStatus` and `TaskPriority` exported as proper union types (previously `string`)

## 0.12.0

### Minor Changes

- 22a5664: Add git-hook style task lifecycle hooks for agents

  **Server**

  - New `hooks` field on agent pool entries: `before_task` and `after_task` shell commands
  - `before_task` runs before `claim_task` — non-zero exit blocks claiming (no phantom `in_progress`)
  - `after_task` runs after `update_task(status: "done")` — non-zero exit reverts status to `in_review`
  - Accepts `string | string[]`; commands run sequentially in the project root
  - Env vars injected: `RELAY_AGENT_ID`, `RELAY_TASK_ID`, `RELAY_SESSION_ID`
  - Timeouts: 30s (`before_task`) / 120s (`after_task`); SIGTERM → SIGKILL escalation
  - `hooks: false` on extends-based agents explicitly opts out of inherited hooks
  - Fix: `extends` spread no longer overwrites base fields with `undefined` overrides

  - `update_task` hook failure now returns `{ success: false, hook_failed: true, error }` — agents can distinguish "fix and retry" from "task not found"
  - `claim_task` and `update_task` tool descriptions now document hook behavior for agents reading the schema
  - `runHook()` guards against `exec()` throwing synchronously (e.g. empty command) — never rejects
  - Fix: `exitCode` extraction now correctly handles POSIX string codes (e.g. `"ENOENT"`) vs numeric exit codes — string codes are mapped to `null` instead of `NaN`
  - Fix: SIGKILL escalation timer now guards against killing a recycled PID via `child.exitCode` check

  **New files**

  - `tools/hook-runner.ts` — `runHook()` / `runHooks()` utilities
  - `tools/hook-runner.test.ts` — 11 tests (truncation, env var injection, empty command guard)
  - New hook tests in `tools/tasks.test.ts` and `agents/loader.test.ts` (including `hook_failed` discriminator assertion and after-revert retry path)

- d7f5879: Dashboard UX improvements and server feature additions

  **Dashboard**

  - Multi-instance agent disambiguation: AgentCard now shows a monospace ID badge on every card and an `↳ {base}` subtitle for agents created via `extends` (e.g. fe2 extending fe)
  - Task board: empty column states, task detail modal on card click (full description, status/priority/assignee badges, timestamps, Markdown rendering)
  - Message feed: new Slack-style panel with agent avatars, DM/broadcast distinction, thread collapsing, unread badge, copy-to-clipboard, and search
  - Session selector: live session chip in header with dropdown of saved sessions
  - Activity feed: fix empty state detection, add per-type event count badges on filter pills
  - Layout: wider divider grab area with gripper dots, responsive min-width constraint

  **Server**

  - Tasks: optional `depends_on` field — `claim_task` enforces all dependencies are `done` before allowing a claim
  - Messages: optional `metadata` field (`Record<string, string>`) for structured context
  - Agents: `basePersonaId` preserved through loader and exposed in `/api/agents` and `list_agents` for extends-based agents
  - New API endpoints: `GET /api/health`, `GET /api/sessions/live`, `GET /api/sessions/:id/replay`
  - `GET /api/session`: pagination support (`?offset=N&limit=N`) with `total` metadata
  - WebSocket: server-side ping/pong heartbeat (30s interval)
  - `broadcast_thinking`: now also emits `agent:status=working` for dashboard visibility
  - Improved descriptions on all 18 MCP tools for better LLM discoverability

  **Shared types**

  - Add `agent:joined` event to `RelayEvent` union
  - Add `metadata` to `message:new` event payload
  - Add `depends_on` to `task:updated` event payload

## 0.11.0

### Minor Changes

- e2dd03a: Optimize agent memory loading by removing lessons.md

  `read_memory()` (without agent_id) now returns only `project.md` instead of merging `project.md` + `lessons.md`. Session retrospectives should use `save_session_summary` instead of `append_memory`.

  `append_memory` now requires `agent_id` — calling it without one returns an error. Use `save_session_summary` for session-level notes.

  This reduces the token cost of `read_memory` MCP calls, which were growing unboundedly as `lessons.md` accumulated entries across sessions.

## 0.10.1

### Patch Changes

- c2d0f19: Fix session-agents.yml loading and several session isolation bugs

  - `getAgents()`: session file not found no longer permanently caches `{}` — returns without caching so the next call can retry after the file is written
  - `getAgents()`: load errors no longer permanently cache `{}` — error path returns without caching
  - `getPool()`: update `poolCachedAt` on load failure to prevent retry spam on every call
  - `getTaskById`: add `session_id` filter to prevent cross-session reads
  - `updateReviewStatus`: add `session_id` WHERE clause to prevent cross-session writes
  - `append_memory`: use `appendFile` instead of read-then-write to eliminate concurrent write race

## 0.10.0

### Minor Changes

- feat: dashboard improvements, security hardening, and orchestrator robustness

  ## Dashboard

  - Task Board collapsible panel (toggle button, same as left AgentArena panel)
  - Session switcher: load any historical session snapshot from the header
  - Dark/light mode toggle
  - ActivityFeed: unified chat-style event feed replacing EventTimeline
  - AgentArena: fixed lastActivity bug (most-recent-wins across tasks and messages)
  - ServerSwitcher: WebSocket reconnects on server URL change; SSRF-safe URL validation
  - Removed dead files: EventTimeline.tsx, MessageFeed.tsx

  ## Bug Fixes

  - Port conflict: `EADDRINUSE` now clears the port so `get_server_info` returns `dashboardUrl: null` + `dashboardAvailable: false` instead of pointing agents at the wrong instance's dashboard
  - `session:snapshot` WebSocket event now includes `sessionId` for multi-server disambiguation
  - `shared/index.ts`: `task:updated` and `session:snapshot` task types now include `created_at`/`updated_at` fields
  - `useRelaySocket`: socket properly closed on `serverUrl` change (ghost-socket leak fixed)
  - `review:updated` event now broadcast on `submit_review` and handled in dashboard reducer
  - API fetches correctly use `activeServer`-prefixed URLs (no more hardcoded relative paths)

  ## Security

  - CORS middleware on all Hono routes (localhost-only)
  - WebSocket origin validation (`socket.destroy()` for non-localhost origins)
  - Content length limits: `send_message` 64KB, `post_artifact` 512KB, memory writes 128KB
  - ServerSwitcher SSRF: `isLocalhostUrl()` validation before connecting

  ## MCP / Server

  - `get_server_info` returns `dashboardAvailable: boolean`
  - `broadcast_thinking` added to pool agent tool lists (be, fe, qa, designer, etc.)
  - `try/catch` added to all MCP tool handlers (was missing system-wide)
  - UTC consistency fix in session ID generation (`getUTCHours` instead of `getHours`)
  - `loader.ts`: two-pass extends resolution bug fixed; per-agent language support

  ## Skills

  - `/relay:relay`: orchestrator now detects question-type `end:waiting` (e.g. "should I proceed?") and re-spawns immediately with a "yes, proceed" answer — prevents agents silently dropping without completing their work
  - `/relay:relay`: agents that complete without broadcasting `end:` are treated as implicit `end:waiting` and re-spawned with a nudge
  - `/relay:agent`: now calls `start_session` before spawning (fixes stale session ID scoping)

  ## Tests

  - 76 → 129 tests (+53): hono.test.ts (new, 14 tests), sessions.test.ts (+7), review.test.ts (+4), loader.test.ts (+3), config.test.ts (+18), websocket.test.ts (new), sessions isolation tests (+11)

### Patch Changes

- fix: /relay:agent now calls start_session before spawning the agent

  Previously, `/relay:agent` did not call `start_session`, causing all MCP tool
  calls from the spawned agent to be scoped to the previous `/relay:relay`
  session's ID. This made the dashboard show stale data from the last full-team
  session instead of starting fresh.

  Now `/relay:agent` computes a new session ID (same YYYY-MM-DD-NNN-XXXX format
  as `/relay:relay`) and calls `start_session` before spawning the agent, which
  clears the dashboard and scopes all MCP data to the new session.

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
