<br />

<h1 align="center">relay</h1>
<p align="center">
  <strong>A multi-agent collaboration framework built on Claude Code.</strong>
  <br />
  <span>One task. A full team. PM, Designer, DA, Frontend, Backend, QA, Deployer.</span>
</p>

<p align="center">
  <a href="./README.ko.md">한국어</a>
</p>

<br />
<br />

## What it does

Most AI coding tools give you one agent doing everything.

relay gives you a team. Each agent has a role, communicates with the others through an MCP server, and only does what that role demands. The PM plans. The designer specs. Engineers build and review each other's work. QA validates. Deployer ships.

```
User: "add a shopping cart"

[PM]       breaks down requirements, creates tasks
[Designer] UX flow, component spec
[DA]       event schema, success metrics
[FE]       UI implementation
[BE]       API implementation
[FE] [BE]  cross-review each other's work
[QA]       test scenarios, bug reports
[Deployer] deployment
```

This is not a pipeline. Agents communicate peer-to-peer through shared MCP tools — no central orchestrator, no hardcoded sequence. No extra API costs.

<br />

## How it works

relay is a Claude Code plugin with three layers:

```
relay (plugin)
├── MCP Server    communication infrastructure
├── Skills        orchestration strategy (.md files)
└── Hooks         automation triggers
```

**MCP Server** stores and routes data. No Claude API calls, no decision-making. Just a message bus, task board, artifact store, review queue, and memory layer that agents write to and read from.

**Skills** are `.md` files that tell the orchestrating Claude Code session how to spawn sub-agents, which MCP tools to use, and how to interpret results. The orchestration strategy lives in text, not code. Change behavior by editing a file — no server restart.

**Hooks** — `post-tool-use.sh` fires on every MCP tool call and pushes agent status updates to the dashboard in real time.

<br />

## Agent tools

Every agent communicates exclusively through MCP tools:

| Category  | Tool                  | Description                            |
|-----------|-----------------------|----------------------------------------|
| Messaging | `send_message`        | Send a message to another agent        |
| Messaging | `get_messages`        | Read incoming messages                 |
| Tasks     | `create_task`         | Open a new issue                       |
| Tasks     | `update_task`         | Update status or add a comment         |
| Tasks     | `get_my_tasks`        | List tasks assigned to this agent      |
| Artifacts | `post_artifact`       | Share output (spec, PR, report, ...)   |
| Artifacts | `get_artifact`        | Retrieve an artifact                   |
| Review    | `request_review`      | Request a code or design review        |
| Review    | `submit_review`       | Submit review feedback                 |
| Memory    | `read_memory`         | Read cross-session memory              |
| Memory    | `write_memory`        | Overwrite a memory file                |
| Memory    | `append_memory`       | Append to a memory file                |
| Sessions  | `save_session_summary`| Save a session summary                 |
| Sessions  | `list_sessions`       | List past sessions                     |
| Sessions  | `get_session_summary` | Retrieve a session summary             |

The orchestrator also has access to `list_agents` and `get_workflow` for reading the active persona configuration and workflow DAG at runtime.

<br />

## Memory

Agent memory is split into two layers with different lifetimes:

```
your-project/
└── .relay/
    ├── memory/                    persistent across sessions (commit to git)
    │   ├── project.md             architecture, domain, tech stack
    │   ├── lessons.md             repeated mistakes, key decisions
    │   └── agents/
    │       ├── pm.md
    │       ├── fe.md
    │       ├── be.md
    │       └── ...
    └── sessions/                  per-session audit log
        └── 2026-03-13-001/
            ├── messages.json
            ├── tasks.json
            └── summary.md
```

At session start, `project.md` and each agent's personal memory file are injected into the system prompt automatically. At session end, agents write what they learned back to memory. Memory is plain Markdown — edit it directly, commit it, share it with your team.

<br />

## Dashboard

The MCP server serves a real-time web dashboard at `http://localhost:3456`.

```
+----------------------------------------------------------+
|  [PM  ]  [Designer -]  [DA -]  [FE  ]  [BE  ]  [QA -]   |
+-------------------+------------------+-------------------+
|    Task Board     |   Message Feed   |   Agent Thoughts  |
|    (Kanban)       |   (Slack-style)  |   (live stream)   |
+-------------------+------------------+-------------------+
```

**Task Board** — full Kanban with real-time status updates.

**Message Feed** — agent conversations in a Slack-style thread view.

**Agent Thoughts** — live stream of whichever agent's reasoning you select.

All events are persisted to SQLite. You can replay an entire session after the fact.

<br />

## Getting started

### Prerequisites

- [Claude Code](https://claude.ai/download) — the CLI must be installed and authenticated
- [Bun](https://bun.sh) — relay's runtime

### 1. Clone and install relay

```bash
git clone https://github.com/your-org/relay.git
cd relay
bun install
```

### 2. Install the plugin

**Global install** — makes `/relay` available in every project:

```bash
bun run install:global
```

This installs three things:
- Skills (`/relay`, `/relay-init`, `/relay-agent`) → `~/.claude/skills/`
- MCP server → registered via `claude mcp add --scope user`
- PostToolUse hook → `~/.claude/settings.json`

**Local install** — scoped to one project only (run from your project root):

```bash
bun run --cwd /path/to/relay install:local
```

Local overrides global when both are installed.

### 3. Use it in your project

Open Claude Code in any project and run:

```
/relay-init
```

This spawns all agents in parallel to scan your codebase. Each agent reads the parts relevant to their role and writes their findings to `.relay/memory/`. Takes a few minutes. Run it once per project, or again after major changes.

```
/relay "add a shopping cart"
```

That's it. The team takes it from there.

### Verify the setup

```bash
claude mcp list
# relay: bun run /path/to/relay/packages/server/src/index.ts - ✓ Connected
```

<br />

## Customizing agents

Two YAML files, merged at runtime:

```yaml
# agents.default.yml — do not edit
agents:
  fe:
    name: Frontend Engineer
    systemPrompt: |
      You are a senior frontend engineer...

# agents.yml — yours to edit
agents:
  fe:
    systemPrompt: |          # override default
      You are a React specialist...
  security:                  # add new agents
    name: Security Reviewer
    tools: [get_artifact, send_message]
    systemPrompt: |
      ...
  da:
    disabled: true           # disable agents you don't need
```

<br />

## Project structure

```
relay/
├── packages/
│   ├── server/          MCP server + Hono REST + WebSocket
│   ├── shared/          shared types (AgentId, RelayEvent)
│   ├── dashboard/       React + Vite real-time UI
│   └── docs/            Astro + Starlight documentation site
├── skills/
│   ├── relay.md         /relay — full workflow orchestration
│   ├── relay-init.md    /relay-init — parallel project scan
│   └── relay-agent.md   /relay-agent — invoke a single agent directly
├── hooks/
│   └── post-tool-use.sh PostToolUse hook → dashboard status push
├── scripts/
│   └── install.ts       global/local installer
├── agents.default.yml   built-in agent personas + workflow DAG
└── agents.yml           your customizations (override, extend, disable)
```

<br />

## Tech stack

| Layer         | Technology                                   |
|---------------|----------------------------------------------|
| Runtime       | Bun                                          |
| Language      | TypeScript (strict)                          |
| MCP server    | `@modelcontextprotocol/sdk` + `Bun.serve()`  |
| API server    | Hono (Bun-native)                            |
| Real-time     | Bun built-in WebSocket                       |
| Frontend      | React + Vite                                 |
| Styling       | Tailwind CSS                                 |
| Database      | `bun:sqlite`                                 |
| Memory        | Markdown files (`.relay/memory/`)            |
| Personas      | YAML (`agents.yml`)                          |

<br />

## Roadmap

- [x] MCP server + core tools (messaging, tasks)
- [x] Memory tools + `.relay/memory/` structure
- [x] Agent persona YAML system
- [x] Artifact and review tools
- [x] Real-time web dashboard
- [x] Skills (relay, relay-init, relay-agent)
- [x] Init mode (parallel project scan)
- [x] Install script (global/local)
- [ ] Streaming agent thoughts to dashboard
- [ ] Session replay UI
- [ ] Public documentation site
