---
name: agent
description: Invoke a single relay agent in isolation. Use when you want one specific agent (e.g. fe, be, qa) to work on a focused task without running the full workflow.
---

Invoke a single agent in isolation.
Example: `/relay:agent fe "Refactor the CartItem component"`

## Execution

1. Call `list_agents` to see the available agents.
2. Tell the user: "Dashboard: http://localhost:3456"
2. Load the specified agent's persona + memory.
3. Spawn that agent alone.
   - Restrict tools to those listed in the agent's `tools` array from `list_agents`.
   - Exclude all other tools to avoid granting unnecessary permissions.
4. After completion, call `append_memory` to persist learnings.

## Unknown agent handling

If the specified agent ID is not found in `list_agents` results:
- Show the user the list of available agents.
- Ask the user to select an agent again.

## Memory load pattern

In step 2, load memory in two passes:
1. `read_memory(agent_id: "{agentId}")` — the agent's personal memory
2. `read_memory()` (omit agent_id) — project.md + lessons.md shared project memory

Combine both results and prepend them to the agent's system prompt.
