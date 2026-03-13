# Test Setup

## Test Runner
- **Runner**: Bun's built-in test runner (`bun:test`)
- **No vitest.config** — Bun test is configured via `package.json` scripts only
- **Command**: `bun test` (root) → delegates to `bun run --filter @custardcream/relay test`

## Test File Locations
All tests reside in `packages/server/src/`:

### DB layer (`packages/server/src/db/`)
- `db/schema.test.ts` — verifies all 5 tables are created by `runMigrations`
- `db/queries/artifacts.test.ts`
- `db/queries/events.test.ts`
- `db/queries/messages.test.ts`
- `db/queries/reviews.test.ts`
- `db/queries/tasks.test.ts`

### MCP tools (`packages/server/src/tools/`)
- `tools/artifacts.test.ts`
- `tools/memory.test.ts`
- `tools/messaging.test.ts` — send_message / get_messages
- `tools/review.test.ts`
- `tools/sessions.test.ts`
- `tools/tasks.test.ts` — create/update/claim/get_my_tasks/get_team_status/get_all_tasks

### Agents (`packages/server/src/agents/`)
- `agents/loader.test.ts` — loadAgents, extends, disabled, language setting, workflow loader

## Test Patterns
- Each test file uses `beforeEach` to create an in-memory SQLite DB and run migrations
- `afterEach` closes the DB — clean isolation between tests
- Tests are written in Korean (test description strings)
- No mocking of external dependencies; all tests use real `bun:sqlite` in-memory DBs

## Areas with NO tests
- `packages/dashboard/` (React frontend) — no test files found
- `packages/docs/` — no test files
- `packages/server/src/index.ts` (entrypoint, MCP+Hono startup) — no integration test
- `packages/server/src/dashboard/` (Hono API, WebSocket) — no test files
- `packages/server/src/mcp.ts` — no test file (tool registration layer)
- Skill files (`skills/`) — no automated tests
- Hook logic (`hooks/`) — no automated tests
