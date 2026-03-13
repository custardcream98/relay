---
name: init
description: Run this when using relay for the first time on a project, or when the team needs to re-scan project context. If no agents.yml exists, analyzes the project and suggests a team. Spawns all configured agents in parallel to read the codebase and write .relay/memory/ files.
---

Run this to initialize project memory for your relay team.
If `.relay/memory/` is absent when `/relay:relay` runs, it will automatically suggest running this first.

## Pre-flight Checks

1. Verify the relay MCP server is connected: call `list_agents`.
   - If list_agents returns agents: proceed to Phase 1.
   - If list_agents returns an empty list: **run Phase 0 (Team Suggestion)** instead of stopping.
2. Check whether the `.relay/memory/` directory exists.
3. Tell the user: "Dashboard: http://localhost:3456"
4. Show the user the loaded agent list: "{emoji} {name}" for each agent.

## Phase 0: Team Suggestion (runs only when no agents are defined)

When `list_agents` returns an empty list, the user has not set up `agents.yml` yet.
Analyze the project and suggest a team tailored to it.

### Step 1: Project Analysis

Explore the project directory to understand:
- **Domain**: What kind of project is this? (web app, research, data pipeline, marketing, content, etc.)
- **Tech stack**: What languages, frameworks, tools are in use?
- **Scale**: How many files, how complex?
- **Existing roles**: Are there any hints about team structure? (e.g., README mentions "data scientists", "writers", etc.)

Look at: `README.md`, `package.json`, `pyproject.toml`, `Cargo.toml`, file structure, main source directories.

### Step 2: Generate team suggestion

Based on the analysis, propose 3–6 agents that fit this project's domain.
Think beyond web development:

| Domain | Example team |
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
Based on your project, I suggest this team:

📋 pm — Product Manager
   Breaks down requirements into tasks and coordinates the team.

🔬 researcher — Researcher
   ...

Do you want me to:
  [1] Create agents.yml with this team (recommended)
  [2] Use the web-dev example (agents.example.yml)
  [3] I'll create agents.yml myself
```

### Step 4: Create agents.yml (if user chooses 1)

Write `agents.yml` to the project root with the suggested team.
Include helpful comments for each agent.

**Important:** The MCP server loads `agents.yml` once at startup. After creating the file, tell the user:
> "agents.yml created. Please restart Claude Code (or the MCP server) for the new team to take effect,
>  then re-run `/relay:init` to scan your codebase."

Then stop — do not proceed to Phase 1 in this session.

If the user chooses 2, copy `agents.example.yml` content to `agents.yml` and give the same restart instruction.
If the user chooses 3, stop and tell them to create `agents.yml`, then re-run `/relay:init`.

---

## Phase 1: Parallel Codebase Scan

Spawn **all agents from list_agents simultaneously**.

For each agent, load their persona via `list_agents` and send this common instruction:

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
Otherwise, use the first agent in the list.

The synthesizer agent:
1. Calls `read_memory(agent_id: "{each_agent_id}")` for all agents.
2. Writes a unified summary: `write_memory(key: "summary", content: ...)` → saves to `project.md`.

## Phase 3: Completion Report

Report to the user:
- Agent team loaded: {list of agents}
- Memory files written: {list of keys}
- Ready to start: `/relay:relay "describe your task"`
