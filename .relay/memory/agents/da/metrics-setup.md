# Metrics & Measurement Setup

## What Is Tracked (SQLite — session-scoped)

### messages table
- `from_agent`, `to_agent` (nullable = broadcast), `content`, `thread_id`, `created_at`
- Index on `(session_id, to_agent)` — supports per-agent inbox queries

### tasks table
- `title`, `description`, `assignee`, `status` (`todo` / `in_progress` / `in_review` / `done`), `priority`, `created_by`, `created_at`, `updated_at`
- Index on `(session_id, assignee)`
- `getTeamStatus` aggregates counts by status — used by agents to decide when work is complete

### artifacts table
- `name`, `type`, `content`, `created_by`, `task_id` (nullable), `created_at`
- Index on `session_id`

### reviews table
- `artifact_id`, `reviewer`, `requester`, `status` (`pending` / resolved), `comments`, `created_at`, `updated_at`
- Index on `(session_id, reviewer)`

### events table
- Full event log: `type`, `agent_id` (nullable), `payload` (JSON), `created_at`
- Index on `(session_id, created_at)` — supports chronological replay
- Every broadcast event is persisted here

## Session Summary (file-based)
- Saved to `.relay/sessions/{session_id}/summary.md`, `tasks.json`, `messages.json`
- Listed via `GET /api/sessions` → `handleListSessions`

## Gaps in Measurement

1. **No task duration tracking** — `updated_at` exists but transition timestamps per status are not stored; cycle time (todo → done) cannot be computed without parsing event log
2. **No agent workload metrics** — no query for tasks completed per agent; must be derived from event replay
3. **No message volume / response latency** — messages are stored but no aggregation queries exist
4. **`agent:thinking` chunks are not persisted** — only live-streamed; reasoning traces are lost after session
5. **`session:snapshot` uses `unknown[]`** — payload typing is loose; snapshot contents are not validated at the type level
6. **No error/retry tracking** — no events for failed tool calls or retries
7. **Review outcome not surfaced as event** — `review:requested` fires on creation, but review resolution (`status` update) does not emit a separate event to the WebSocket bus
8. **No KPI dashboard or aggregation layer** — all data is raw SQLite; no pre-computed metrics or time-series rollups

## Potential KPIs to Define
- Task throughput per session (total done / session duration)
- Review turnaround time (review created_at → status updated_at)
- Agent utilization (time in `working` vs `idle` status)
- Artifact-to-review ratio
- Message fanout ratio (broadcast vs direct)
