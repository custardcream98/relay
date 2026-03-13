# relay — Architecture

## What it is

relay is a **Claude Code plugin** that turns a single Claude Code session into a team of specialized AI agents. Each agent has a persona (PM, Designer, DA, FE, BE, QA, Deployer), and they collaborate by passing messages through a shared MCP server — without any extra API calls.

```
User: "Add a shopping cart"
  ↓
[PM]       → breaks down requirements, creates tasks
[Designer] → UX flow, component spec
[DA]       → event schema, success metrics
[FE]       → UI implementation
[BE]       → API implementation
[FE2]      → FE code review
[BE2]      → BE code review
[QA]       → test scenarios, bug reports
[Deployer] → deploy
```

---

## Three-layer architecture

```
relay (Claude Code plugin)
├── MCP Server        communication infrastructure
├── Skills            orchestration strategy
└── Hooks             automation triggers
```

### Layer 1 — MCP Server

The MCP server is **infrastructure only**. It stores and routes data between agents. It does not call Claude API, make decisions, or orchestrate anything.

```
Agent A ──┐
Agent B ──┼──▶ MCP Server (relay)
Agent C ──┘        │
                   ├── Message bus   (send_message, get_messages)
                   ├── Task board    (create_task, update_task, get_my_tasks)
                   ├── Artifact store(post_artifact, get_artifact)
                   ├── Review queue  (request_review, submit_review)
                   ├── Memory        (read_memory, write_memory, append_memory)
                   └── Sessions      (save_session_summary, list_sessions)
```

The server runs two transports in the same process:

| Transport | Purpose |
|-----------|---------|
| `StdioServerTransport` | MCP protocol — Claude Code connects here |
| `Bun.serve()` on port 3456 | HTTP REST + WebSocket for the dashboard |

### Layer 2 — Skills

Skills are `.md` files in `skills/`. Claude Code reads them when a slash command is invoked.

| Skill | Command | What it does |
|-------|---------|--------------|
| `relay.md` | `/relay "task"` | Runs the full multi-agent workflow |
| `relay-init.md` | `/relay-init` | Parallel project scan → writes `.relay/memory/` |
| `relay-agent.md` | `/relay-agent pm "..."` | Invokes a single agent directly |

Skills contain **no code** — they are plain English instructions that tell the orchestrating Claude Code session how to spawn sub-agents, what MCP tools to use, and how to interpret results.

### Layer 3 — Hooks

`hooks/post-tool-use.sh` is a Claude Code PostToolUse hook. Every time an agent calls an MCP tool, the hook fires and POSTs to `/api/hook/tool-use`. The server parses which agent called which tool and broadcasts an `agent:status` event to the dashboard WebSocket.

---

## Repository structure

```
relay/
├── packages/
│   ├── server/          @relay/server   — MCP + Hono server
│   │   └── src/
│   │       ├── index.ts              entry point: starts both servers
│   │       ├── mcp.ts                MCP server + all tool registrations
│   │       ├── tools/                tool handler functions
│   │       │   ├── messaging.ts      send_message, get_messages
│   │       │   ├── tasks.ts          create_task, update_task, get_my_tasks
│   │       │   ├── artifacts.ts      post_artifact, get_artifact
│   │       │   ├── review.ts         request_review, submit_review
│   │       │   ├── memory.ts         read_memory, write_memory, append_memory
│   │       │   └── sessions.ts       save_session_summary, list_sessions, get_session_summary
│   │       ├── db/                   SQLite layer
│   │       │   ├── client.ts         singleton Database instance
│   │       │   ├── schema.ts         DDL + migrations + indexes
│   │       │   └── queries/          per-table CRUD functions
│   │       ├── agents/
│   │       │   ├── types.ts          AgentPersona, AgentConfig, WorkflowJob types
│   │       │   └── loader.ts         YAML merge + memory injection
│   │       └── dashboard/
│   │           ├── hono.ts           REST API routes
│   │           ├── websocket.ts      WebSocket broadcaster
│   │           └── events.ts         RelayEvent type re-export
│   ├── shared/          @relay/shared  — types shared between server and dashboard
│   │   └── index.ts                  AgentId, RelayEvent discriminated union
│   ├── dashboard/       @relay/dashboard — React + Vite real-time UI
│   │   └── src/
│   │       ├── App.tsx               useReducer state machine, WebSocket consumer
│   │       ├── hooks/useRelaySocket.ts  callback-based WS hook with reconnect
│   │       └── components/
│   │           ├── AgentStatusBar    agent presence indicators
│   │           ├── TaskBoard         Kanban (todo / in-progress / review / done)
│   │           ├── MessageFeed       Slack-like agent conversation
│   │           └── AgentThoughts     real-time streaming thinking panel
│   └── docs/            @relay/docs    — Astro + Starlight documentation site
├── skills/              Claude Code slash commands (.md)
├── hooks/               post-tool-use.sh
├── scripts/             install.ts (global/local install)
├── agents.default.yml   default personas + workflow DAG
├── agents.yml           user overrides (extends, disabled, custom)
├── biome.json           lint + format config
└── package.json         Bun workspace root
```

---

## Data flow: a single `/relay` session

```
1. User runs /relay "add shopping cart"
   └─▶ Claude Code reads skills/relay.md

2. Orchestrator calls list_agents + get_workflow via MCP
   └─▶ Learns: 7 agents, workflow: planning→design→development→review→qa→deploy

3. Orchestrator spawns PM sub-agent (Claude Code Agent tool)
   └─▶ PM calls create_task × N, send_message to fe/be
   └─▶ PM calls send_message(to: null, content: "end:design | planning complete")

4. Orchestrator detects end:design → spawns Designer + DA in parallel
   └─▶ Each agent reads get_messages, posts artifacts, declares end:

5. ... continues through development → review → qa → deploy

6. Each MCP tool call triggers hooks/post-tool-use.sh
   └─▶ POST /api/hook/tool-use → broadcast agent:status event → dashboard updates

7. Session ends: orchestrator calls save_session_summary
   └─▶ Writes .relay/sessions/YYYY-MM-DD-NNN/summary.md, tasks.json, messages.json
```

---

## Memory system

Two layers, two different lifetimes:

```
.relay/
├── memory/                      persists across sessions (commit to git)
│   ├── project.md               architecture, tech stack, domain
│   ├── lessons.md               recurring mistakes, key decisions
│   └── agents/
│       ├── pm.md                PM-specific memory
│       ├── fe.md                FE: component patterns, conventions
│       ├── be.md                BE: API patterns, DB schema
│       └── ...
└── sessions/                    audit log (one dir per session)
    └── 2026-03-13-001/
        ├── summary.md
        ├── tasks.json
        └── messages.json
```

**Session start**: `loader.ts` reads `project.md` + the agent's personal `.md` and prepends them to its system prompt via `buildSystemPromptWithMemory()`.

**Session end**: each agent calls `write_memory` / `append_memory` to record what it learned.

---

## Agent persona system

Two YAML files, merged at runtime:

```yaml
# agents.default.yml  ← do not edit
agents:
  fe:
    name: Frontend Engineer
    tools: [send_message, get_messages, create_task, ...]
    systemPrompt: |
      You are a senior frontend engineer...

# agents.yml  ← user edits this
agents:
  fe:
    systemPrompt: |   # overrides the default
      You are a React specialist who prefers functional patterns...
  my-custom-agent:    # add new agents
    name: Security Reviewer
    tools: [get_artifact, send_message]
    systemPrompt: |
      ...
  da:
    disabled: true    # remove an agent
```

`loader.ts` deep-merges the two files. `extends` lets a custom agent inherit from a default one and override selectively.

---

## Workflow engine

The workflow is a **named-job DAG** defined in `agents.default.yml`:

```yaml
workflow:
  jobs:
    planning:
      agents: [pm]
      description: "Break down requirements into tasks..."
      end:
        design: "when task breakdown is complete"

    design:
      agents: [designer, da]
      description: "Create UX flow and analytics plan..."
      end:
        development: "when specs are ready"
        planning: "if requirements are unclear"   # loop back

    development:
      agents: [fe, be]
      reviewers:
        fe: [fe2]   # fe2 reviews fe's work
        be: [be2]
      end:
        qa: "when implementation + review is done"
        development: "if review requests changes"

    qa:
      agents: [qa]
      end:
        deploy: "when all tests pass"
        development: "if bugs found"

    deploy:
      agents: [deployer]
      end:
        _done: "always"
```

The orchestrator resolves the DAG at runtime: each agent declares `end:{nextJobId}` when done, and the orchestrator transitions. If agents disagree, the most conservative path (loop back) wins.

---

## Dashboard

The dashboard at `http://localhost:3456` is a React SPA with three panels:

```
┌─────────────────────────────────────────────────────────┐
│ [PM ●]  [Designer ○]  [DA ○]  [FE ●]  [BE ●]  [QA ○]   │
├──────────────────┬─────────────────┬────────────────────┤
│   Task Board     │  Message Feed   │   Agent Thoughts   │
│   (Kanban)       │  (Slack-like)   │   (live stream)    │
└──────────────────┴─────────────────┴────────────────────┘
```

State is managed with `useReducer`. All updates are driven by a single `onEvent` callback from `useRelaySocket`, which handles one `RelayEvent` at a time — no event accumulation, no batching issues.

WebSocket reconnects with exponential backoff (1s → 2s → 4s → 8s → 16s) if the server restarts.

All events are persisted to the `events` SQLite table, enabling full session replay.

---

## Key design decisions

**No extra API cost**: relay uses Claude Code's built-in Agent tool for all AI work. The MCP server stores and routes — it never calls Claude.

**Peer-to-peer, no orchestrator agent**: agents communicate through MCP tools, not through a central coordinator. The orchestrating Claude Code session only reads end declarations and spawns the next job.

**Memory as files**: `.relay/memory/` is plain Markdown. Human-readable, git-committable, team-shareable. No vector DB, no embeddings.

**Bun-native throughout**: `bun:sqlite`, `Bun.serve()`, `Bun.file()`, `Bun.write()` — no Node.js polyfills needed.

**Skills are prompts, not code**: the orchestration strategy lives in `.md` files. Updating how agents collaborate means editing a text file, not redeploying a server.
