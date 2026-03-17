# Test Setup

## Test Runner
- **Runner**: Bun's built-in test runner (`bun:test`)
- **No vitest.config** — Bun test is configured via `package.json` scripts only
- **Command**: `bun test` (root) → delegates to `bun run --filter @custardcream/relay test`

## Test File Locations
All tests reside in `packages/server/src/`:

### Store layer (`packages/server/src/`)
- `store.test.ts` (if present) — verifies in-memory store behaviour via `_resetStore()`

### MCP tools (`packages/server/src/tools/`)
- `tools/artifacts.test.ts`
- `tools/memory.test.ts`
- `tools/messaging.test.ts` — send_message / get_messages
- `tools/review.test.ts`
- `tools/sessions.test.ts`
- `tools/tasks.test.ts` — create/update/claim/get_all_tasks (with assignee filter)

### Agents (`packages/server/src/agents/`)
- `agents/loader.test.ts` — loadAgents, extends, disabled, language setting, workflow loader

## Test Patterns
- Each test file uses `beforeEach` / `afterEach` with `_resetStore()` for clean in-memory isolation between tests
- Tests are written in Korean (test description strings)
- No mocking of external dependencies; all tests use the in-memory store (`store.ts`)

## Areas with NO tests
- `packages/dashboard/` (React frontend) — no test files found
- `packages/docs/` — no test files
- `packages/server/src/index.ts` (entrypoint, MCP+Hono startup) — no integration test
- `packages/server/src/dashboard/` — `hono.test.ts` and `websocket.test.ts` now exist
- `packages/server/src/mcp.ts` — no test file (tool registration layer)
- Skill files (`skills/`) — no automated tests
- Hook logic (`hooks/`) — no automated tests
