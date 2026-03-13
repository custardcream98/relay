# Existing WebSocket Event Types

Source: `packages/shared/index.ts` (canonical definition), re-exported from `packages/server/src/dashboard/events.ts`

## RelayEvent Union Type

All events carry a `timestamp: number` field (milliseconds, `Date.now()`).

| Event Type | Key Fields | Purpose |
|---|---|---|
| `agent:thinking` | `agentId`, `chunk: string` | Streams agent reasoning text in realtime |
| `agent:status` | `agentId`, `status: "idle" \| "working" \| "waiting"` | Agent lifecycle state changes |
| `message:new` | `message: { id, from_agent, to_agent, content, thread_id, created_at }` | Inter-agent messages |
| `task:updated` | `task: { id, title, assignee, status, priority }` | Task board state changes |
| `artifact:posted` | `artifact: { id, name, type, created_by }` | New artifact published |
| `review:requested` | `review: { id, artifact_id, reviewer, requester }` | Code review requested |
| `session:snapshot` | `tasks: unknown[]`, `messages: unknown[]`, `artifacts: unknown[]` | Initial dashboard hydration |
| `memory:updated` | `agentId` | Agent wrote to project memory |

## Timestamp Conventions
- Outer envelope `timestamp`: milliseconds (`Date.now()`)
- Message payload `created_at` sub-field: seconds (Unix epoch, matching SQLite `unixepoch()`)
- DB `insertEvent` converts ms → seconds via `Math.floor(event.timestamp / 1000)`

## Event Flow
1. MCP tool is called by an agent
2. Tool handler calls `broadcast(event)` from `websocket.ts`
3. `broadcast` persists event to `events` table (SQLite) AND fans out to all connected WebSocket clients
4. Dashboard receives event and updates UI in realtime
5. On reconnect / session switch: `GET /api/sessions/:id/events` replays all stored events in chronological order

## Hook-Triggered Events
- `POST /api/hook/tool-use` (called by Claude Code PostToolUse hook) → broadcasts `agent:status { status: "working" }`
- Only fires `agent:status`; no other event types are hook-generated

## AgentId
- `AgentId = string` (open — custom agents can be added via `agents.yml`)
- No closed union; any string is valid
