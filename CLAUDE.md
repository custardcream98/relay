# relay — CLAUDE.md

## Overview

A domain-agnostic multi-agent collaboration framework built on Claude Code.
Users define any team in `agents.yml` (web-dev, research, marketing, legal — anything).
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
- **Styling**: Tailwind CSS
- **DB**: `better-sqlite3` (production); `bun:sqlite` (tests only — injected via `_setDb()`)
- **Memory**: Markdown files (`.relay/memory/`)
- **Persona config**: YAML (`agents.yml` / `agents.default.yml`)
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
- **Session memory**: SQLite (messages, tasks, artifacts) — ephemeral within a session
- **Project memory**: `.relay/memory/` Markdown files — persisted across sessions
- Memory is injected into each agent's system prompt at session start
- Agents update memory at session end via `write_memory` / `append_memory`

### Personas are configured in YAML
- `agents.default.yml`: framework skeleton — ships as `agents: {}` (empty). Do not modify.
- `agents.example.yml`: complete web-dev team example (pm, designer, da, fe, be, qa, deployer + workflow). Copy to `agents.yml` to get started.
- `agents.yml`: user's team definition — required; must have at least one agent
- `packages/server/src/agents/loader.ts` handles merging; throws if 0 agents are loaded

### Install modes (global / local)
- Global: install skills to `~/.claude/skills/` + `claude mcp add --scope user`
- Local: install skills to `.claude/skills/` + `claude mcp add --scope local`
- Local overrides global

## Directory Structure

```
packages/
├── server/               # @custardcream/relay — MCP + Hono server
│   └── src/
│       ├── index.ts      # entry point: starts MCP + Hono servers together
│       ├── mcp.ts        # MCP server instance and tool registration
│       ├── tools/        # MCP tool implementations
│       │   ├── messaging.ts   # send_message, get_messages
│       │   ├── tasks.ts       # create_task, update_task, get_my_tasks
│       │   ├── artifacts.ts   # post_artifact, get_artifact
│       │   ├── review.ts      # request_review, submit_review
│       │   ├── memory.ts      # read_memory, write_memory, append_memory
│       │   └── sessions.ts    # save_session_summary, list_sessions, get_session_summary
│       ├── agents/
│       │   ├── types.ts       # AgentId, AgentPersona, AgentConfig types
│       │   └── loader.ts      # load agents.yml + merge + inject memory
│       ├── db/
│       │   ├── client.ts      # DB singleton
│       │   ├── schema.ts      # table DDL
│       │   └── queries/       # per-table CRUD
│       └── dashboard/
│           ├── hono.ts        # Hono REST API
│           ├── websocket.ts   # WebSocket broadcaster
│           └── events.ts      # RelayEvent union type
├── shared/               # @custardcream/relay-shared — shared types
│   └── index.ts          # AgentId, RelayEvent discriminated union
├── dashboard/            # @custardcream/relay-dashboard — React + Vite realtime UI
└── docs/                 # @custardcream/relay-docs — Astro + Starlight docs site

skills/                   # Claude Code Plugin skill files
├── relay/SKILL.md        # /relay:relay - full workflow
├── init/SKILL.md         # /relay:init - project scan
└── agent/SKILL.md        # /relay:agent - single agent invocation

hooks/
└── hooks.json            # PostToolUse hook: MCP tool call → dashboard state update

.claude-plugin/
└── plugin.json           # plugin manifest

.mcp.json                 # MCP server config (uses ${CLAUDE_PLUGIN_ROOT})
```

## MCP Tool Schema Principles

- Tool names: `snake_case`
- Always include `agent_id` in parameters (to track who called)
- All tools respond with `{ success: boolean, data?, error? }`
- Memory tools use the `RELAY_DIR` env var path (default: `cwd()/.relay`)

## Workflow

1. `/relay:init` — run once; all configured agents scan in parallel and initialize `.relay/memory/`
2. `/relay:relay "task"` — all agents spawn simultaneously; react to messages/tasks event-driven; orchestrator re-spawns dormant agents when new work arrives
3. `/relay:agent {id} "task"` — invoke a single agent in isolation
4. At session end, agents update memory and archive the session

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
- All events are stored in SQLite with timestamps
- The dashboard supports selecting a session and replaying the entire process

## Dev Commands

```bash
bun run dev              # dev server (hot reload)
bun run build            # build
bun test                 # run tests
bun run dashboard:dev    # frontend dev server
bun run dashboard:build  # frontend build
```

## Release

**Use the changeset workflow. Do not run `bun run publish:server` directly.**

```bash
# 1. Create a changeset file (select patch/minor/major)
bunx changeset

# 2. Commit & push → CI auto-creates a "Version Packages" PR
git add .changeset/
git commit -m "chore: add changeset"
git push

# 3. Merge the "Version Packages" PR → CI publishes to npm automatically
```

## Notes

- Never add code that calls the Claude API directly (incurs extra billing)
- Use `node:` built-ins for production code; Bun APIs are only for dev tooling (test runner, build)
  - `tsconfig.json` includes `"bun"` in `types` to support `bun:test` / `bun:sqlite` in test files — do NOT use Bun APIs in `src/` production code
- All code comments must be in English
- Agent persona system prompts may be Korean or English, but keep them consistent
- Commit `.relay/memory/` files to git so the team shares memory
- Never modify `agents.default.yml`; define your team in `agents.yml` (use `agents.example.yml` as reference)
- The bin name in `.mcp.json` must be specified explicitly with `--package`:
  - Correct: `["npx", "-y", "--package", "@custardcream/relay", "relay"]`
  - This ensures npx finds the `relay` binary even when the package name differs from the bin name
