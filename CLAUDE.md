# relay — CLAUDE.md

## Overview

A domain-agnostic multi-agent collaboration framework built on Claude Code.
Users define any team via an agent pool in `.relay/agents.pool.yml` (web-dev, research, marketing, legal — anything).
Built as a Claude Code plugin with three layers: MCP server + Skills + Hooks.
Uses only Claude Code's Agent tool — no direct Claude API calls, no extra billing.
The MCP server handles all inter-agent communication infrastructure.

## Tech Stack & Conventions

- **Runtime**: Node.js (production); Bun (dev tooling — `bun run`, `bun test`)
- **Language**: TypeScript (strict mode)
- **MCP server**: `@modelcontextprotocol/sdk` + `@hono/node-server`
- **API server**: Hono (runs in the same process as the MCP server)
- **Realtime**: `ws` WebSocket
- **Frontend**: React + Vite (`packages/dashboard/`)
- **Styling**: Tailwind CSS v4 — always use canonical class forms (e.g. `text-(--color-text-primary)` not `text-[var(--color-text-primary)]`, `py-px` not `py-[1px]`). Run `bunx @tailwindcss/upgrade --force` to auto-fix.
- **DB**: In-memory store (`store.ts`) — ephemeral, no native bindings required. Tests call `_resetStore()` in `beforeEach` for isolation.
- **Memory**: Markdown files (`.relay/memory/`)
- **Persona config**: YAML (`.relay/agents.pool.yml` / `agents.pool.yml`)
- **Package manager**: bun (do not use npm/yarn/pnpm)
- **Comments**: English

## Architecture Principles

### MCP server is the communication infrastructure
- The relay MCP server never calls the Claude API directly
- The server acts only as a message bus, task board, artifact store, and memory layer
- All AI processing is handled by Claude Code's Agent tool

### Agents communicate only through MCP tools
- No direct agent-to-agent calls
- All communication must go through MCP tools: `send_message`, `create_task`, etc.
- Peer-to-peer — no orchestrator

### Dual memory structure
- **Session memory**: in-memory store (messages, tasks, artifacts) — ephemeral within a process
- **Project memory**: `.relay/memory/` Markdown files — persisted across sessions
- Memory is injected into each agent's system prompt at session start
- Agents update memory at session end via `write_memory` / `append_memory`
- **Orchestrator state** (`save_orchestrator_state` / `get_orchestrator_state`): also in-memory — survives context compaction within the same process but is lost on MCP server restart. If the server restarts mid-session, orchestrator state cannot be recovered; agents should start a fresh session.

### Personas are configured in YAML (pool-only)
- Team composition happens per-session from the pool. Every `/relay:relay` invocation selects a task-optimised team.
- `agents.pool.example.yml`: 12+ diverse agent personas across web-dev, research, and marketing domains. Reference for building your own pool.
- `.relay/agents.pool.yml`: project-level pool (takes priority). Copy from `agents.pool.example.yml` and customise.
- `agents.pool.yml` (project root): fallback pool location.
- Pool agents have optional fields: `tags: string[]` (smart team suggestions), `validate_prompt?: string` (declarative validation criteria injected before task completion — agents check all criteria before marking done).
- `list_pool_agents` MCP tool returns pool metadata (no `systemPrompt`) for team selection.
- `session-agents-{sessionId}.yml`: ephemeral per-session team file written by `/relay:relay` Team Composition step. Gitignored. Filename includes session ID to avoid concurrent-session collisions.
- `loadPool()` in `loader.ts`: reads pool file; throws a clear error when no pool is configured (no silent fallback).
- **Multi-instance same agent**: Use `extends` in pool YAML — `fe2: { extends: fe }` inherits fe's full persona with a different agent ID. Supports parallel fe/fe2/fe3 teams.
- `shared_blocks` at pool top level: reusable prompt fragments referenced as `{{block_name}}` in systemPrompt. `{agent_id}` within blocks is substituted at load time. Undefined references throw at load time.
- `review_checklist` at pool top level: default review criteria for all agents; per-agent override via `review_checklist` field in agent config. Exposed in `list_agents` and `list_pool_agents` API responses.

### Install modes (global / local)
- Global (user scope): `/plugin install relay@relay`
- Local (project scope): `/plugin install relay@relay --scope project`
- Local overrides global

### Multi-server support
Run multiple relay instances simultaneously without port or session data conflicts.

Environment variables:
- `DASHBOARD_PORT`: HTTP/WebSocket port (default: auto-selected from 3456–3465)
- `RELAY_INSTANCE`: instance name (e.g. `project-a`). When set, the DB file becomes `.relay/relay-{instance}.db`. The SKILL.md orchestrator prefixes session IDs with the instance name (`project-a-2026-03-14-007-a3f7`).
- `RELAY_SESSION_ID`: session identifier (default: auto-generated `YYYY-MM-DD-HHmmss-XXXX` in UTC on first call, where `XXXX` is 4 random hex digits).

CLI args (alternative to env vars):
- `relay --port 3457` — set dashboard port
- `relay --instance project-b` — set instance name (equivalent to RELAY_INSTANCE)

Auto port selection: if `DASHBOARD_PORT` is not set and 3456 is occupied, the server tries 3457–3465 before falling back.

Example `.mcp.json` for two instances (plugin sets this automatically via `${CLAUDE_PLUGIN_ROOT}`):
```json
{
  "mcpServers": {
    "relay": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/packages/server/dist/index.js"],
      "env": { "DASHBOARD_PORT": "3456", "RELAY_INSTANCE": "project-a" }
    },
    "relay-b": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/packages/server/dist/index.js"],
      "env": { "DASHBOARD_PORT": "3457", "RELAY_INSTANCE": "project-b" }
    }
  }
}
```

## Directory Structure

```
packages/
├── server/               # relay-server — MCP + Hono server
│   └── src/
│       ├── index.ts      # entry point: starts MCP + Hono servers together
│       ├── mcp.ts        # MCP server instance and tool registration
│       ├── tools/        # MCP tool implementations
│       │   ├── messaging.ts        # send_message, get_messages (handlers)
│       │   ├── tasks.ts            # create_task, update_task, claim_task, get_all_tasks (handlers)
│       │   ├── artifacts.ts        # post_artifact, get_artifact (handlers)
│       │   ├── review.ts           # request_review, submit_review (handlers)
│       │   ├── memory.ts           # read_memory, write_memory, append_memory (handlers)
│       │   ├── sessions.ts         # save_session_summary, list_sessions, get_session_summary, save_orchestrator_state, get_orchestrator_state (handlers)
│       │   ├── register-messaging.ts   # MCP tool registration for messaging tools
│       │   ├── register-tasks.ts       # MCP tool registration for task tools
│       │   ├── register-artifacts.ts   # MCP tool registration for artifact tools
│       │   ├── register-review.ts      # MCP tool registration for review tools
│       │   ├── register-memory.ts      # MCP tool registration for memory tools
│       │   ├── register-sessions.ts    # MCP tool registration for session tools
│       │   ├── register-agents.ts      # MCP tool registration for get_server_info, list_agents, list_pool_agents, broadcast_thinking
│       │   └── hook-runner.ts          # runHook / runHooks — executes per-agent before_task / after_task shell hooks
│       ├── store.ts         # in-memory data store (tasks, messages, artifacts, reviews, events, orchestrator state)
│       ├── config.ts        # project root, session ID, port, instance ID singletons
│       ├── schemas.ts       # shared Zod schemas (AGENT_ID_SCHEMA)
│       ├── agents/
│       │   ├── types.ts       # AgentId, AgentPersona, AgentConfig types
│       │   ├── loader.ts      # load pool + session-agents file + inject memory
│       │   └── cache.ts       # centralized agent/pool cache
│       ├── utils/
│       │   ├── broadcast.ts   # taskToPayload — strips internal fields for WS/REST
│       │   └── validate.ts    # isValidId — alphanumeric ID validation
│       └── dashboard/
│           ├── hono.ts        # Hono REST API + completion-check endpoint
│           ├── websocket.ts   # WebSocket broadcaster
│           ├── events.ts      # RelayEvent union type (server-side)
│           └── utils.ts       # isLocalhostOrigin helper
├── shared/               # relay-shared — shared types
│   └── index.ts          # AgentId, RelayEvent discriminated union
├── dashboard/            # relay-dashboard — React + Vite realtime UI
└── docs/                 # relay-docs — Astro + Starlight docs site

skills/                   # Claude Code Plugin skill files
├── relay/SKILL.md        # /relay:relay - full workflow (includes auto-pool generation)
└── agent/SKILL.md        # /relay:agent - single agent invocation

hooks/
└── hooks.json            # Plugin-level hooks: PostToolUse (MCP tool call → dashboard state update),
                          #   PreToolUse (Edit|Write|MultiEdit → relay-edit-guard.sh),
                          #   Stop → relay-orchestrator-stop.sh,
                          #   SessionEnd (async) → relay-session-cleanup.sh

.claude-plugin/
├── plugin.json           # plugin manifest
└── marketplace.json      # marketplace metadata

.mcp.json                 # MCP server config (uses ${CLAUDE_PLUGIN_ROOT})

agents.pool.example.yml   # Example pool with 12+ personas (web-dev, research, marketing)
```

## MCP Tool Schema Principles

- Tool names: `snake_case`
- Always include `agent_id` in parameters (to track who called)
- All tools respond with a flat JSON object where `success: boolean` is always present, followed by tool-specific fields (e.g. `{ success, tasks: [...] }`, `{ success, message: {...} }`, `{ success, artifact_id }`) — there is no nested `data` field. On failure: `{ success: false, error: string }`
- Memory tools use the `RELAY_DIR` env var path (default: `cwd()/.relay`)
- `broadcast_thinking(agent_id, content)` — fire-and-forget; emits `agent:thinking` WebSocket event
  to the dashboard. No DB write. Agents call this before significant operations for visibility.

## Agent Task Hooks

Git-hook style shell commands declared per-agent in the pool YAML. The MCP server executes them in the project root (`getProjectRoot()`). Non-zero exit blocks the operation.

```yaml
hooks:
  before_task: "echo before"          # string or list of strings
  after_task:
    - bunx biome check --write
    - bun tsc --noEmit
```

- **`before_task`**: runs BEFORE `claim_task` atomically claims the task. Non-zero exit returns `claimed: false` (no phantom `in_progress` state).
- **`after_task`**: runs AFTER the store write when `update_task(status: "done")` is called. Non-zero exit reverts status to `in_review` and returns `success: false`.
- Timeouts: 30 s for `before_task`, 120 s for `after_task`.
- Env vars injected into hooks: `RELAY_AGENT_ID`, `RELAY_TASK_ID`, `RELAY_SESSION_ID`.
- `hooks: false` in an `extends`-based agent explicitly opts out of inherited hooks.
- Implementation: `tools/hook-runner.ts` (runHook / runHooks), wired in `tools/tasks.ts` wrapper functions, called from `tools/register-tasks.ts` claim_task / update_task handlers.

## Workflow

1. `/relay:relay "task"` — auto-generates pool on first run, then all agents spawn simultaneously; react to messages/tasks event-driven; orchestrator re-spawns dormant agents when new work arrives
2. `/relay:agent {id} "task"` — invoke a single agent in isolation
3. At session end, agents update memory and archive the session

### Event-driven collaboration model
- All agents start at the same time (no phases)
- Agents use `claim_task` to atomically pick up work (race-condition safe)
- Agents broadcast `end:waiting` or `end:_done` when they have no more work
- Orchestrator re-spawns dormant agents when new tasks or messages appear
- Any agent can trigger a reviewer by broadcasting "Review requested: {reviewerId}"

## Dashboard Requirements

### Three panels
1. **Task Board (Kanban)**: updates instantly on task state changes
2. **Message Feed**: displays inter-agent messages as Slack-style threads
3. **Agent Thoughts**: streams the selected agent's reasoning (text before tool calls) in realtime

### WebSocket event types
All events follow `{ type, payload, timestamp, agentId }` structure.

```typescript
type RelayEvent =
  | { type: "agent:thinking"; agentId: string; chunk: string }
  | { type: "agent:status"; agentId: string; status: "idle" | "working" | "waiting" }
  | { type: "message:new"; message: Message }
  | { type: "task:updated"; task: Task }
  | { type: "artifact:posted"; artifact: Artifact }
  | { type: "review:requested"; review: ReviewRequest }
  | { type: "memory:updated"; agentId: string }
```

### History replay
- All events are stored in-memory with timestamps during the session
- The dashboard supports selecting a session and replaying the entire process

## Dev Commands

```bash
bun run dev              # dev server (hot reload)
bun run build:server     # build server package
bun run build:release    # build dashboard + server → dist/
bun test                 # run tests
bun run dashboard:dev    # frontend dev server
bun run dashboard:build  # frontend build
```

## Release

Distributed as a Claude Code plugin via git — no npm publishing.
CI automatically rebuilds `packages/server/dist/` on push to main and commits the result if changed.

```bash
# Local build (for testing)
bun run build:release
```

## Notes

- Never add code that calls the Claude API directly (incurs extra billing)
- Use `node:` built-ins for production code; Bun APIs are only for dev tooling (test runner, build)
  - `tsconfig.json` includes `"bun"` in `types` for `bun:test` support in test files — do NOT use Bun APIs in `src/` production code
  - Use `node:` built-ins where they provide cleaner APIs (fs, path, etc.) — Bun implements them
- All code comments must be in English
- Agent persona system prompts may be Korean or English, but keep them consistent
- Commit `.relay/memory/` files to git so the team shares memory
- Define your pool in `.relay/agents.pool.yml` (use `agents.pool.example.yml` as reference)
- The MCP server runs from the bundled dist: `node ${CLAUDE_PLUGIN_ROOT}/packages/server/dist/index.js`
  - All dependencies are inlined in the bundle — no `node_modules` required at runtime
