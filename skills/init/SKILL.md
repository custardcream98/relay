---
name: init
description: Run this when using relay for the first time on a project, or when the team needs to re-scan project context. Spawns all configured agents in parallel to read the codebase and write .relay/memory/ files.
---

Run this to initialize project memory for your relay team.
If `.relay/memory/` is absent when `/relay:relay` runs, it will automatically suggest running this first.

## Pre-flight Checks

1. Verify the relay MCP server is connected: call `list_agents`.
   - If list_agents returns an empty array or error: tell the user
     "No agents defined. Create agents.yml first. See agents.example.yml for reference."
     and stop.
2. Check whether the `.relay/memory/` directory exists.
3. Tell the user: "Dashboard: http://localhost:3456"
4. Show the user the loaded agent list: "{emoji} {name}" for each agent.

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
