---
name: init
description: Run this when using relay for the first time on a project, or when the team needs to re-scan project context. Analyzes the project, suggests an agent pool, and spawns all pool agents in parallel to read the codebase and write .relay/memory/ files.
---

Run this to initialize project memory for your relay team.
If `.relay/memory/` is absent when `/relay:relay` runs, it will automatically suggest running this first.

## Pre-flight Checks

1. Verify the relay MCP server is connected: call `list_pool_agents`.
   - If it returns agents: proceed to Phase 0 (pool confirmation) or Phase 1 directly if pool is already configured.
   - If it returns an empty list: **run Phase 0 (Pool Suggestion)** to help the user set up a pool.
2. Check whether the `.relay/memory/` directory exists.
3. Call `get_server_info` to get the actual dashboard URL (port is auto-selected from 3456–3465).
   - Tell the user: "Dashboard: {dashboardUrl}"

## Phase 0: Pool Suggestion (runs only when no pool is configured)

When `list_pool_agents` returns an empty list, the user has not set up an agent pool yet.
Analyze the project and suggest a pool tailored to it.

### Step 1: Project Analysis

Explore the project directory to understand:
- **Domain**: What kind of project is this? (web app, research, data pipeline, marketing, content, etc.)
- **Tech stack**: What languages, frameworks, tools are in use?
- **Scale**: How many files, how complex?
- **Existing roles**: Are there any hints about team structure? (e.g., README mentions "data scientists", "writers", etc.)

Look at: `README.md`, `package.json`, `pyproject.toml`, `Cargo.toml`, file structure, main source directories.

### Step 2: Generate pool suggestion

Based on the analysis, propose 3–6 agents that fit this project's domain.
Think beyond web development:

| Domain | Example pool |
|--------|-------------|
| Web app | pm, designer, da, fe, be, qa, deployer |
| Research | lead-researcher, researcher, data-analyst, writer, reviewer |
| Marketing | strategist, copywriter, analyst, brand-manager |
| Data pipeline | architect, engineer, data-scientist, qa-engineer |
| Content creation | editor, writer, fact-checker, seo-specialist |
| Legal/compliance | attorney, paralegal, compliance-officer, reviewer |

For each suggested agent, specify:
- `id`: snake_case identifier
- `name`: human-readable name
- `emoji`: fitting emoji
- `description`: one sentence role description
- `tools`: recommended subset from the available tool list
- `systemPrompt`: 2–4 sentences describing how this agent should work in this project

### Step 3: Present suggestion and ask for confirmation

Show the user:
```
Based on your project, I suggest this agent pool:

📋 pm — Product Manager
   Breaks down requirements into tasks and coordinates the team.

🔬 researcher — Researcher
   ...

Do you want me to:
  [1] Create .relay/agents.pool.yml with this pool (recommended)
  [2] Use the example pool (agents.pool.example.yml)
  [3] I'll create agents.pool.yml myself
```

### Step 4: Create .relay/agents.pool.yml (if user chooses 1)

Write `.relay/agents.pool.yml` with the suggested pool entries.
Include helpful comments for each agent.

**Important:** The MCP server auto-reloads the pool file (5-minute TTL cache). After creating the file, tell the user:
> ".relay/agents.pool.yml created. Re-run `/relay:init` to start the codebase scan."

Then stop — do not proceed to Phase 1 in this session.

If the user chooses 2, copy `agents.pool.example.yml` content to `.relay/agents.pool.yml` and give the same instruction.
If the user chooses 3, stop and tell them to create `.relay/agents.pool.yml`, then re-run `/relay:init`.

---

## Phase 1: Parallel Codebase Scan

Spawn **all agents from list_pool_agents simultaneously**.

For each agent, load their persona via `list_pool_agents` and send this common instruction:

> "This is init mode — you are seeing this project for the first time.
>  Your role: {agent.name} — {agent.description}
>
>  1. Explore the codebase from your role's perspective.
>     Focus on what matters most for your responsibilities.
>  2. Use write_memory to store your key findings.
>     Use descriptive keys (e.g. 'tech-stack', 'api-patterns', 'test-setup').
>  3. When done, broadcast: send_message(to: null, content: 'init-done')"

Each agent uses their own judgment about what to scan based on their systemPrompt role.
No need to hardcode scan areas per agent type — the systemPrompt already defines each agent's perspective.

## Phase 2: Collect and Synthesize

Poll `get_messages(agent_id: "orchestrator")` to detect "init-done" broadcasts.
Wait until all agents have broadcast "init-done", or up to 5 minutes (proceed with partial results).

Find the agent whose description or name suggests a coordinator role (look for keywords like
"manager", "coordinator", "lead", "pm", "strategist"). If found, use that agent to synthesize.
Otherwise, use the first agent in the pool list.

The synthesizer agent:
1. Calls `read_memory(agent_id: "{each_agent_id}")` for all agents.
2. Writes a unified summary: `write_memory(key: "summary", content: ...)` → saves to `project.md`.

## Phase 3: Completion Report

Report to the user:
- Agent pool loaded: {list of agents}
- Memory files written: {list of keys}
- Ready to start: `/relay:relay "describe your task"`
