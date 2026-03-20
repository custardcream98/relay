# relay-shared

## 0.2.0

### Minor Changes

- c3d995c: ## Clean Code Refactoring — Server, Dashboard, Shared

  Comprehensive clean-code pass across the entire codebase. No breaking changes to MCP tool APIs or agent configuration format.

  ### Server (`relay-server`)

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

  ### Dashboard (`relay-dashboard`)

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

  ### Shared (`relay-shared`)
  - `TaskStatus` and `TaskPriority` exported as proper union types (previously `string`)

## 0.1.0

### Minor Changes

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
