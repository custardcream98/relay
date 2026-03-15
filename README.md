<br />

<p align="center">
  <img src="https://custardcream98.github.io/relay/favicon.svg" width="72" height="72" alt="relay icon" />
</p>

<h1 align="center">relay</h1>
<p align="center">
  <strong>Stop prompting one agent. Ship with a whole team.</strong>
  <br />
  <span>relay turns Claude Code into a real engineering org — 12+ specialist agents running in parallel, communicating in real time, zero extra API cost.</span>
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

## The problem with one agent

A single AI agent serializes everything. It context-switches constantly, loses track of decisions it made ten steps ago, and turns every task into a single-threaded bottleneck.

You wouldn't build a product with one engineer. Don't ship AI work that way either.

<br />

## What relay does

You describe a goal. relay spins up a full team — each agent with a focused role — and they work in parallel, communicate through a message bus, claim tasks atomically, and hand off to the next agent when their part is done.

```
/relay:relay "add a shopping cart"

[PM]       breaks down requirements → creates tasks for the team
[Designer] writes UX flow + component spec
[DA]       defines event schema, success metrics     ← all running simultaneously
[FE]       claims FE tasks, builds the UI
[BE]       shares API contract early, builds backend
[FE][BE]   request peer reviews via broadcast
[QA]       watches for completed work, writes test scenarios
[Deployer] waits for QA sign-off → ships
```

No phases. No turn-taking. All agents are alive from session start and react to each other organically.

**Not just web dev.** Define any team for any domain — research, marketing, legal, education. You write the personas; relay handles the rest.

**Zero extra API cost.** relay uses Claude Code's Agent tool exclusively. No direct Claude API calls.

<br />

## 30-second install

### Prerequisites

- [Claude Code](https://claude.ai/download) installed and authenticated
- [Node.js](https://nodejs.org) v18+

### Register the plugin

```bash
claude mcp add --scope user relay -- npx -y --package @custardcream/relay relay
```

The `--` separates `claude mcp add` flags from the relay server command and its arguments.

Restart Claude Code (or run `/reload-plugins` inside Claude Code). Skills (`/relay:relay`, `/relay:init`, `/relay:agent`) and hooks install automatically.

> Scope to a single project instead: use `--scope local`.

### Run it

```bash
# First time on a new project — agents scan your codebase in parallel
/relay:init

# Then just describe what you want
/relay:relay "add a shopping cart"
```

That's it. The team takes it from there.

<br />

## How it works

relay is a Claude Code plugin with three layers:

```
relay (plugin)
├── MCP Server    message bus · task board · artifact store · memory layer
├── Skills        orchestration strategy (plain .md files — edit to change behavior)
└── Hooks         PostToolUse → real-time dashboard push
```

**MCP Server** — stores and routes data only. No AI, no decisions. Agents read and write to it exclusively through MCP tools.

**Skills** — `.md` files that tell the orchestrating Claude Code session how to spawn agents, which tools to use, and how to interpret results. Change orchestration behavior by editing a file, no restart required.

**Hooks** — `post-tool-use.sh` fires on every MCP tool call and pushes live status updates to the dashboard.

<br />

## Configure your team

relay ships with no built-in agents. You own the personas entirely.

```yaml
# .relay/agents.pool.yml
agents:
  pm:
    name: Project Manager
    emoji: "📋"
    tags: [planning, coordination]
    tools: [create_task, get_all_tasks, get_team_status, send_message, get_messages]
    systemPrompt: |
      You are the project manager. Break down requirements into tasks...

  researcher:
    name: Researcher
    emoji: "🔬"
    tags: [research, analysis]
    tools: [send_message, get_messages, get_all_tasks, claim_task, post_artifact]
    systemPrompt: |
      You are a researcher. Investigate topics and post findings as artifacts...

  researcher2:
    extends: researcher   # inherit full persona, just change the ID
    name: Senior Researcher
    emoji: "🔭"
```

Copy `agents.pool.example.yml` — 12 pre-built personas spanning web-dev, research, and marketing — to `.relay/agents.pool.yml` to get started immediately.

Required fields: `name`, `emoji`, `tools`, `systemPrompt`. Optional: `description`, `tags`, `language`, `disabled`, `extends`.

<br />

## Real-time dashboard

The MCP server serves a live dashboard. The URL is printed at session start (default `http://localhost:3456`, auto-selects `3457–3465` if already in use). Watch your team work.

![relay dashboard](./packages/docs/public/screenshots/dashboard-en.png)

Three panels update in real time:

**Task Board** — full Kanban. Watch tasks move from todo → in_progress → done as agents claim and complete them.

**Message Feed** — every inter-agent conversation in a Slack-style thread view. See who said what, when, and why.

**Agent Thoughts** — live stream of whichever agent's reasoning you want to follow. Know what the agent is about to do before it does it.

All events are persisted to SQLite — replay any session in full after the fact. Use the session switcher in the dashboard to browse and replay past sessions.

<br />

## Persistent memory

Agents remember what they learn. Memory is split across two layers:

```
your-project/
└── .relay/
    ├── memory/                    persists across sessions (commit to git)
    │   ├── project.md             architecture, domain, tech stack
    │   └── agents/
    │       ├── pm.md
    │       ├── fe.md
    │       └── ...
    └── sessions/                  per-session audit log
        └── 2026-03-14-001/
            └── summary.md
```

At session start, `project.md` and each agent's personal memory file are injected into their system prompt. At session end, agents write what they learned back. Memory is plain Markdown — edit it directly, commit it, share it with your team.

<br />

## Agent tools

Every agent communicates exclusively through MCP tools:

| Category   | Tool                   | What it does                         |
| ---------- | ---------------------- | ------------------------------------ |
| Messaging  | `send_message`         | Send a message to another agent      |
| Messaging  | `get_messages`         | Read incoming messages               |
| Tasks      | `create_task`          | Open a new task                      |
| Tasks      | `update_task`          | Update status or add a comment       |
| Tasks      | `get_my_tasks`         | List tasks assigned to this agent    |
| Tasks      | `get_all_tasks`        | List all tasks in the session        |
| Tasks      | `claim_task`           | Atomically claim a task (race-safe)  |
| Tasks      | `get_team_status`      | Aggregate task counts by status      |
| Artifacts  | `post_artifact`        | Share output — spec, PR, report, ... |
| Artifacts  | `get_artifact`         | Retrieve an artifact                 |
| Review     | `request_review`       | Request a code or design review      |
| Review     | `submit_review`        | Submit review feedback               |
| Memory     | `read_memory`          | Read cross-session memory            |
| Memory     | `write_memory`         | Overwrite a memory file              |
| Memory     | `append_memory`        | Append to a memory file              |
| Sessions   | `save_session_summary` | Save a session summary               |
| Sessions   | `list_sessions`        | List past sessions                   |
| Sessions   | `get_session_summary`  | Retrieve a session summary           |
| Visibility | `broadcast_thinking`   | Push agent intent to the dashboard   |

The orchestrator also has access to `list_agents` for reading the active persona configuration at runtime.

<br />

## Multi-instance support

Run multiple relay instances simultaneously — separate ports, separate databases, no conflicts.

```json
{
  "mcpServers": {
    "relay": {
      "command": "npx",
      "args": ["-y", "--package", "@custardcream/relay", "relay"],
      "env": { "DASHBOARD_PORT": "3456", "RELAY_INSTANCE": "project-a" }
    },
    "relay-b": {
      "command": "npx",
      "args": ["-y", "--package", "@custardcream/relay", "relay"],
      "env": { "DASHBOARD_PORT": "3457", "RELAY_INSTANCE": "project-b" }
    }
  }
}
```

<br />

## Call a single agent directly

No need to spin up the full team for focused work:

```bash
/relay:agent fe "Refactor the CartItem component"
```

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
├── .mcp.json                    MCP server config
└── agents.pool.example.yml      starter pool: 12 personas (copy to .relay/agents.pool.yml)
```

<br />

---

<p align="center">
  <strong>One command. A full team. Your next feature ships faster.</strong>
  <br /><br />
  <a href="https://custardcream98.github.io/relay"><strong>Read the docs →</strong></a>
</p>
