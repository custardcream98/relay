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
- Message payload `created_at` sub-field: seconds (Unix epoch)
- Store records timestamps in milliseconds; consumers convert as needed

## Event Flow
1. MCP tool is called by an agent
2. Tool handler calls `broadcast(event)` from `websocket.ts`
3. `broadcast` fans out to all connected WebSocket clients (events are NOT persisted to a DB; WebSocket-only)
4. Dashboard receives event and updates UI in realtime
5. On reconnect / session switch: `GET /api/sessions/:id/snapshot` returns the current in-memory state

## Hook-Triggered Events
- `POST /api/hook/tool-use` (called by Claude Code PostToolUse hook) → broadcasts `agent:status { status: "working" }`
- Only fires `agent:status`; no other event types are hook-generated

## AgentId
- `AgentId = string` (open — custom agents can be added via `agents.pool.yml`)
- No closed union; any string is valid
