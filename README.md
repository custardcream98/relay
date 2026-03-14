<br />

<p align="center">
  <img src="https://custardcream98.github.io/relay/favicon.svg" width="72" height="72" alt="relay icon" />
</p>

<h1 align="center">relay</h1>
<p align="center">
  <strong>A multi-agent collaboration framework built on Claude Code.</strong>
  <br />
  <span>One task. A full team. Any role, any domain.</span>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@custardcream/relay"><img src="https://img.shields.io/npm/v/%40custardcream%2Frelay?style=flat-square&color=C17F24&label=npm" alt="npm version" /></a>
  &nbsp;
  <img src="https://img.shields.io/badge/license-MIT-C17F24?style=flat-square" alt="MIT license" />
  &nbsp;
  <img src="https://img.shields.io/badge/Claude%20Code-Plugin-E8A83A?style=flat-square&logo=anthropic&logoColor=white" alt="Claude Code Plugin" />
  &nbsp;
  <img src="https://img.shields.io/badge/runtime-Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js" />
</p>

<p align="center">
  <a href="./README.ko.md">한국어</a>
  &nbsp;·&nbsp;
  <a href="https://custardcream98.github.io/relay">Docs</a>
</p>

<br />
<br />

## What it does

Most AI coding tools give you one agent doing everything.

relay gives you a team. Each agent has a role, communicates with the others in real time, and only does what that role demands. All agents are alive simultaneously from session start — no phases, no turn-taking. They react to each other's messages and tasks organically, like a Slack-first team.

```
User: "add a shopping cart"

[PM]       breaks down requirements, creates tasks for the team
[Designer] UX flow, component spec
[DA]       event schema, success metrics          ← all running at the same time
[FE]       claims FE tasks, builds UI
[BE]       shares API contract early, builds backend
[FE] [BE]  request peer reviews via broadcast
[QA]       watches for completed PRs, writes test scenarios
[Deployer] waits for QA sign-off, then ships
```

Agents are not limited to web development. Configure any team for any domain — research, marketing, legal, education. Define the roles in `agents.yml` and relay handles the rest. No extra API costs.

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
| Tasks     | `get_all_tasks`       | List all tasks in the session          |
| Tasks     | `claim_task`          | Atomically claim a task (race-safe)    |
| Tasks     | `get_team_status`     | Aggregate task counts by status        |
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
| Visibility| `broadcast_thinking`  | Push agent intent to the dashboard     |

The orchestrator also has access to `list_agents` for reading the active persona configuration at runtime.

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

- [Claude Code](https://claude.ai/download) — CLI must be installed and authenticated
- [Node.js](https://nodejs.org) v18 or later

### 1. Register the MCP server

```bash
claude mcp add --scope user relay -- npx -y --package @custardcream/relay relay
```

This registers relay globally. Skills (`/relay:relay`, `/relay:init`, `/relay:agent`) and hooks are installed automatically when the plugin loads. Restart Claude Code after running this.

> To scope relay to a single project only, use `--scope local` instead.

### 2. Use it in your project

First time on a new project:

```
/relay:init
```

This spawns all agents in parallel to scan your codebase. Each agent reads the parts relevant to their role and writes their findings to `.relay/memory/`. Run it once per project, or again after major changes.

Then just describe what you want:

```
/relay:relay "add a shopping cart"
```

That's it. The team takes it from there.

### Call a single agent directly

```
/relay:agent fe "Refactor the CartItem component"
```

<br />

## Configuring your team

relay ships with no built-in agents. You define your team in `agents.yml`.

```yaml
# agents.yml — define any team for any domain
agents:
  pm:
    name: Project Manager
    emoji: "📋"
    tools: [create_task, get_all_tasks, get_team_status, send_message, get_messages]
    systemPrompt: |
      You are the project manager. Break down requirements into tasks...

  researcher:
    name: Researcher
    emoji: "🔬"
    tools: [send_message, get_messages, get_all_tasks, claim_task, get_team_status, post_artifact]
    systemPrompt: |
      You are a researcher. Investigate topics and post findings as artifacts...

  reviewer:
    extends: researcher     # inherit persona, override fields
    name: Peer Reviewer
    emoji: "🔍"
```

See `agents.example.yml` for a complete web development team (PM, Designer, DA, FE, BE, QA, Deployer). Copy it to `agents.yml` to get started with a web project.

Required fields per agent: `name`, `emoji`, `tools`, `systemPrompt`. Optional: `description`, `language`, `disabled`, `extends`.

<br />

## Project structure

```
relay/
├── .claude-plugin/
│   └── plugin.json              plugin manifest
├── packages/
│   ├── server/                  MCP server + Hono REST + WebSocket
│   ├── shared/                  shared types (AgentId, RelayEvent)
│   ├── dashboard/               React + Vite real-time UI
│   └── docs/                    Astro + Starlight documentation site
├── skills/
│   ├── relay/SKILL.md           /relay:relay — full workflow orchestration
│   ├── init/SKILL.md            /relay:init — parallel project scan
│   └── agent/SKILL.md           /relay:agent — invoke a single agent directly
├── hooks/
│   └── hooks.json               PostToolUse hook → dashboard status push
├── .mcp.json                    MCP server configuration
├── agents.default.yml           framework defaults (empty — no built-in agents)
├── agents.example.yml           example: full web-dev team (copy to agents.yml)
└── agents.yml                   your team definition (required)
```

<br />

## Tech stack

| Layer         | Technology                                          |
|---------------|-----------------------------------------------------|
| Runtime       | Node.js (distributed via npx)                       |
| Language      | TypeScript (strict)                                 |
| MCP server    | `@modelcontextprotocol/sdk` + `@hono/node-server`   |
| API server    | Hono                                                |
| Real-time     | `ws` WebSocket                                      |
| Frontend      | React + Vite                                        |
| Styling       | Tailwind CSS                                        |
| Database      | `better-sqlite3`                                    |
| Memory        | Markdown files (`.relay/memory/`)                   |
| Personas      | YAML (`agents.yml`)                                 |

<br />

## Roadmap

- [x] MCP server + core tools (messaging, tasks)
- [x] Memory tools + `.relay/memory/` structure
- [x] Agent persona YAML system
- [x] Artifact and review tools
- [x] Real-time web dashboard
- [x] Skills (`/relay:relay`, `/relay:init`, `/relay:agent`)
- [x] Init mode (parallel project scan)
- [x] Claude Code Plugin format (marketplace-ready)
- [x] Event-driven collaboration (all agents alive simultaneously)
- [x] Generic agent architecture (any domain, any team)
- [ ] Streaming agent thoughts to dashboard
- [ ] Session replay UI
- [x] Public documentation site
