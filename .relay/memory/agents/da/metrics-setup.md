# Metrics & Measurement Setup

## What Is Tracked (in-memory store — session-scoped, ephemeral)

### messages
- `from_agent`, `to_agent` (nullable = broadcast), `content`, `thread_id`, `created_at`
- Stored as arrays in `store.ts`; supports per-agent inbox queries

### tasks
- `title`, `description`, `assignee`, `status` (`todo` / `in_progress` / `in_review` / `done`), `priority`, `created_by`, `created_at`, `updated_at`
- `getAllTasks` with optional status/assignee filters — agents check open tasks to decide when work is complete

### artifacts
- `name`, `type`, `content`, `created_by`, `task_id` (nullable), `created_at`

### reviews
- `artifact_id`, `reviewer`, `requester`, `status` (`pending` / resolved), `comments`, `created_at`, `updated_at`

### events
- Events are broadcast via WebSocket only (`broadcast()` in `websocket.ts`) — NOT persisted to any DB table
- `agent:thinking` events are fire-and-forget; all other events are also live-only

## Session Summary (file-based)
- Saved to `.relay/sessions/{session_id}/summary.md`
- Listed via `GET /api/sessions` → `handleListSessions`

## Gaps in Measurement

1. **No task duration tracking** — `updated_at` exists but transition timestamps per status are not stored; cycle time (todo → done) cannot be computed without parsing event log
2. **No agent workload metrics** — no query for tasks completed per agent; must be derived from event replay
3. **No message volume / response latency** — messages are stored but no aggregation queries exist
4. **`agent:thinking` chunks are not persisted** — only live-streamed; reasoning traces are lost after session
5. **`session:snapshot` uses `unknown[]`** — payload typing is loose; snapshot contents are not validated at the type level
6. **No error/retry tracking** — no events for failed tool calls or retries
7. ~~**Review outcome not surfaced as event**~~ — RESOLVED: `review:updated` event was added; review resolution now emits to the WebSocket bus
8. **No KPI dashboard or aggregation layer** — all data is in-memory and ephemeral; no pre-computed metrics or time-series rollups

## Potential KPIs to Define
- Task throughput per session (total done / session duration)
- Review turnaround time (review created_at → status updated_at)
- Agent utilization (time in `working` vs `idle` status)
- Artifact-to-review ratio
- Message fanout ratio (broadcast vs direct)
