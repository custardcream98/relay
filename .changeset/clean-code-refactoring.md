---
"@custardcream/relay": minor
"@custardcream/relay-shared": minor
---

## Clean Code Refactoring — Server, Dashboard, Shared

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
