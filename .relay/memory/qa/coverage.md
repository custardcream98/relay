# Test Coverage Assessment

## Well-Covered Areas

### MCP Tool handlers (`packages/server/src/tools/`)
- **messaging**: send_message, get_messages — happy path + isolation checks
- **tasks**: create, update, claim_task (happy + edge cases), get_all_tasks (with assignee filter) — session isolation verified
- **review**, **artifacts**, **memory**, **sessions** — test files exist (content not fully read, but present)

### In-memory store (`packages/server/src/store.ts`)
- All session data lives in `store.ts` (arrays/Map) — no SQLite/db/ layer in production
- Test isolation via `_resetStore()` called in `beforeEach`/`afterEach`
- Store collections verified: messages, tasks, artifacts, reviews, events

### Agent loader (`packages/server/src/agents/loader.ts`)
- Empty agents error
- Normal load
- `extends` inheritance
- `disabled` exclusion
- `extends` from disabled → error
- Missing required fields → error
- Per-agent `language` setting
- Global `language` setting
- Agent language overrides global
- `buildSystemPromptWithMemory` language injection
- Workflow loader: empty + override

## Not Covered / Gaps

| Area | Gap |
|---|---|
| `packages/dashboard/` (React) | Zero tests — UI behavior untested |
| `packages/server/src/dashboard/hono.ts` | REST API endpoints not tested |
| `packages/server/src/dashboard/websocket.ts` | WebSocket broadcast logic not tested |
| `packages/server/src/mcp.ts` | MCP tool registration wiring not tested |
| `packages/server/src/index.ts` | Server startup not tested |
| `skills/*.md` | Skill prompt correctness not verifiable via automated tests |
| `hooks/hooks.json` | Hook behavior not tested |
| Integration / E2E | No end-to-end test: agent flow → MCP → DB → WebSocket event |
| Test coverage metrics | No `--coverage` in CI; actual line coverage unknown |

## Recommendations
1. Add Hono API route tests (can use `hono/testing` or direct `fetch` against in-memory server)
2. Add WebSocket event tests for `agent:thinking`, `task:updated`, etc.
3. Enable `bun test --coverage` in CI and set a minimum threshold
4. Consider smoke-test for MCP tool registration (ensure all tools are registered on startup)
