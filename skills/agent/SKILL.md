---
name: agent
description: Invoke a single relay agent in isolation. Use when you want one specific agent (e.g. fe, be, qa) to work on a focused task without running the full workflow.
---

Invoke a single agent in isolation.
Example: `/relay:agent fe "Refactor the CartItem component"`

## Execution

1. Call `list_pool_agents` to see the available agents from the pool.
2. In parallel, call `get_server_info` and `list_sessions` to get the dashboard URL and compute a new session ID.
   - **Compute session ID** (same pattern as `/relay:relay`):
     - Today's date prefix: `YYYY-MM-DD`.
     - If `instanceId` is non-null (from `get_server_info`), filter sessions starting with `{instanceId}-YYYY-MM-DD-`; else filter for `YYYY-MM-DD-`.
     - For each match, parse the segment at index 3 as an integer (the NNN counter).
     - Next NNN = max of all parsed counters + 1, or 1 if none match today.
     - Format: `YYYY-MM-DD-NNN-XXXX` (XXXX = 4 random hex digits). Prefix with `{instanceId}-` if set.
   - Call `start_session(agent_id: "orchestrator", session_id: "{composedId}")`.
     This clears the live dashboard and scopes all subsequent MCP tool calls to the new session.
   - Tell the user: "Session: {session_id} | Dashboard: {dashboardUrl}"
3. Load the specified agent's persona + memory.
   - Use the persona returned by `list_pool_agents` for the matching agent ID.
4. Spawn that agent alone.
   - Restrict tools to those listed in the agent's `tools` array from `list_pool_agents`.
   - Exclude all other tools to avoid granting unnecessary permissions.
   - Append the following communication reminder to the agent's system prompt:
     ```
     ## Communication Protocol
     - After completing significant work, call send_message(to: null, content: "Completed: {summary}")
       so any observers or orchestrators can see what was done.
     - When finished, call send_message(to: null, content: "end:_done | {summary}").
       This is mandatory — do not skip it.
     ```
5. After completion:
   - Always call `save_session_summary(agent_id: "{agentId}", session_id: "{session_id}", summary: "{what you did and key decisions}")` to archive this session.
   - If you discovered reusable patterns or conventions (e.g. API shape, test setup, component structure), persist them with `write_memory(agent_id: "{agentId}", key: "conventions", content: "...")`. Use descriptive keys (e.g. `api-patterns`, `test-setup`, `component-structure`). Skip if nothing new was learned.

## Unknown agent handling

If the specified agent ID is not found in `list_pool_agents` results:
- Show the user the list of available agents.
- Ask the user to select an agent again.

## Memory load pattern

In step 3, load memory in two passes:
1. `read_memory(agent_id: "{agentId}")` — the agent's personal memory
2. `read_memory()` (omit agent_id) — project.md (shared project state)

Combine both results and prepend them to the agent's system prompt.

For recent session history, call `list_sessions` then `get_session_summary` on the last 1–2 sessions
only when the task explicitly requires historical context.
