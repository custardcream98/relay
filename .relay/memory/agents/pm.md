## domain

# Domain: relay

## Product Overview
relay is a multi-agent collaboration framework built on Claude Code. It simulates a full startup engineering team — PM, Designer, DA, Frontend, Backend, QA, Deployer — where each agent has a distinct role and communicates peer-to-peer through an MCP server.

## Core Value Proposition
- Most AI coding tools give one agent doing everything; relay gives a full team with role specialization
- No extra API costs — uses only Claude Code's Agent tool, no direct Claude API calls
- Peer-to-peer communication — no central orchestrator, no hardcoded sequence
- Orchestration strategy lives in text (.md files), not code — change behavior by editing files

## Target Users
- Development teams who want AI agents to mirror their actual team structure
- Claude Code users who want parallel, specialized agent workflows

## Key Features (Current State)
- Full workflow: PM → Designer/DA → FE/BE → Code Review → QA → Deploy
- Real-time dashboard at http://localhost:3456 (Kanban + Message Feed + Agent Thoughts)
- Cross-session memory via .relay/memory/ Markdown files (committable to git)
- Session history replay from SQLite
- Claude Code Plugin format (marketplace-ready)

## Roadmap (Pending)
- [ ] Streaming agent thoughts to dashboard
- [ ] Session replay UI
- [ ] Public documentation site (Astro + Starlight site exists in packages/docs but not published)
## architecture

# Architecture: relay

## Three-Layer Plugin Architecture
```
relay (Claude Code Plugin)
├── MCP Server    — communication infrastructure (message bus, task board, artifacts, memory)
├── Skills        — orchestration strategy (.md files that drive agent spawning)
└── Hooks         — PostToolUse automation (hooks/hooks.json → dashboard status push)
```

## Package Structure
```
packages/
├── server/    (@custardcream/relay)          — MCP server + Hono REST + WebSocket
├── shared/    (@custardcream/relay-shared)   — shared types (AgentId, RelayEvent)
├── dashboard/ (@custardcream/relay-dashboard) — React + Vite realtime UI
└── docs/      (@custardcream/relay-docs)     — Astro + Starlight docs site
```

## Key Architectural Decisions
- MCP server NEVER calls Claude API — pure infrastructure only
- All AI reasoning happens in Claude Code's Agent tool
- Agents communicate ONLY via MCP tools (no direct agent-to-agent calls)
- Dual memory: SQLite (session-ephemeral) + .relay/memory/ Markdown (cross-session)
- Persona config via YAML: agents.default.yml (do not edit) + agents.yml (user overrides)

## Agent Workflow (DAG defined in agents.default.yml)
planning → design → development → review → qa → deploy → _done

Each job specifies agents, completion conditions, and next transitions.
Review can loop back to development; qa can loop back to development for bug fixes.

## MCP Tools Available to Agents
- Messaging: send_message, get_messages
- Tasks: create_task, update_task, get_my_tasks
- Artifacts: post_artifact, get_artifact
- Review: request_review, submit_review
- Memory: read_memory, write_memory, append_memory
- Sessions: save_session_summary, list_sessions, get_session_summary
- Orchestrator-only: list_agents, get_workflow

## Tech Stack
- Runtime: Bun (NOT Node.js)
- Language: TypeScript (strict mode)
- DB: bun:sqlite
- API server: Hono
- Frontend: React + Vite + Tailwind CSS
- Linter/Formatter: Biome
- Package manager: bun (monorepo workspaces)

## Install Modes
- Global: skills → ~/.claude/skills/ + MCP scope user
- Local: skills → .claude/skills/ + MCP scope local (local overrides global)
## team-conventions

# Team Conventions: relay

## Code Style
- Language: TypeScript strict mode throughout
- Linter/Formatter: Biome (biome.json at root)
- Comments: Korean (per CLAUDE.md)
- Prefer Bun built-in APIs over `node:` prefix modules

## Git / Release Workflow
- Use changeset workflow for releases — NEVER run `bun run publish:server` directly
  1. `bunx changeset` → select patch/minor/major
  2. Commit .changeset/ and push → CI creates "Version Packages" PR
  3. Merge PR → CI publishes to npm automatically
- Pre-commit hooks managed by husky

## MCP Tool Conventions
- Tool names: snake_case
- Always include `agent_id` in tool call parameters
- All tools respond with `{ success: boolean, data?, error? }`
- Memory tools use RELAY_DIR env var (default: cwd()/.relay)

## Agent / Persona Conventions
- Never modify agents.default.yml — use agents.yml for overrides (supports override, extends, disabled)
- Always set agent_id matching the persona role in every MCP tool call
- Persona system prompts may be Korean or English, but must be internally consistent

## MCP Server Config (.mcp.json)
- Always specify bin name explicitly: `["npx", "-y", "--package", "@custardcream/relay", "relay-server"]`
- If package name differs from bin name, npx cannot find the binary

## Memory Conventions
- Commit .relay/memory/ files to git so the team shares memory
- project.md + lessons.md are injected into every agent's system prompt at session start
- Agents write learned information back to memory at session end via write_memory / append_memory

## Skills (Slash Commands)
- /relay:init — run once per project; parallel codebase scan → initializes .relay/memory/
- /relay:relay "task" — full team workflow (PM → Designer/DA → FE/BE → Review → QA → Deploy)
- /relay:agent {id} "task" — invoke a single agent in isolation

## Dev Commands
- bun run dev               — dev server (hot reload)
- bun run build             — full build
- bun test                  — run tests
- bun run install:local     — install skills + MCP locally
- bun run install:global    — install skills + MCP globally
- bun run dashboard:dev     — frontend dev server
- bun run dashboard:build   — frontend build
