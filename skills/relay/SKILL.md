---
name: relay
description: Run the full multi-agent workflow from start to finish. Use when the user gives a task that should be handled by the full team defined in agents.yml.
---

The team collaborates event-driven — all agents are alive from session start and
react to messages and tasks organically, like a Slack-first team.

## Pre-flight Checks

1. Confirm the relay MCP server is connected by calling `list_agents`.
   - If no agents are returned: tell the user "No agents defined. Create agents.yml first. See agents.example.yml for reference." and stop.
2. Verify `.relay/memory/project.md` exists.
   - If absent: suggest running `/relay:init` first.
3. Generate a new session ID in `YYYY-MM-DD-NNN` format.
   - If the `RELAY_INSTANCE` environment variable is set, prefix the session ID:
     `{RELAY_INSTANCE}-YYYY-MM-DD-NNN` (e.g. `project-a-2026-03-14-001`).
4. Determine the dashboard URL:
   - Check if `DASHBOARD_PORT` env var is available; if so use `http://localhost:{DASHBOARD_PORT}`.
   - Otherwise use `http://localhost:3456` as the default.
   - Tell the user: "Dashboard: {url}"

## Team Composition (Dynamic Agent Selection)

This step runs **before** spawning any agents. It lets you assemble a purpose-built team
for the session rather than always using the static `agents.yml` roster.

### Step 0: Check for an existing team

Call `list_agents` (already done in Pre-flight step 1).

- **If `list_agents` returned ≥ 1 agent** — ask the user:
  > "Use your configured team from `agents.yml`? Or would you like to pick a custom team
  > from the agent pool for this specific task?"
  - If the user says **use configured** → skip the rest of this section and proceed to
    [Session Startup](#session-startup) with the agents from `list_agents`.
  - If the user says **custom** → proceed to pool selection below.

- **If `list_agents` returned 0 agents** (no `agents.yml`) → go directly to pool selection.

### Pool Selection Conversation

1. Call `list_pool_agents` to fetch all available pool entries.
   - If it returns 0 entries, tell the user: "No agent pool configured. Create
     `.relay/agents.pool.yml` (see `agents.pool.example.yml`). Falling back to agents.yml."
     Then proceed with whatever `list_agents` returned.

2. Ask the user:
   > "What kind of task is this? (e.g. 'build a web feature', 'conduct market research',
   > 'write a legal contract review')"

3. Based on the user's response, use your own reasoning to suggest a team:
   - Match the task description to agent `tags` and `description` fields.
   - Aim for 3–6 agents unless the task clearly needs more or fewer.
   - Show the suggested team in a concise list:
     ```
     Suggested team:
     - 📋 pm — Product Manager (coordinates tasks)
     - ⚙️ be — Backend Engineer (API + DB work)
     - 🔍 qa — QA Engineer (testing + sign-off)
     ```
   - Explain briefly **why** each agent was selected.

4. Let the user refine:
   - "Looks good" or "yes" → confirm and proceed.
   - "Remove X, add Y" → adjust the team and re-show.
   - "Start over" → go back to step 2.

5. Once confirmed, write the selected team to `.relay/session-agents.yml`:
   - Format is identical to `agents.yml` (an `agents:` map with only the selected entries).
   - To build the file, call `list_agents` — it returns full personas including `systemPrompt`.
     Map each selected agent ID to its full persona config.
   - Write the file at `.relay/session-agents.yml`.
   - Set the `RELAY_SESSION_AGENTS_FILE` environment variable to the absolute path of this
     file so the server picks it up on its next `list_agents` call.

> **Fallback**: if no pool is configured and no `agents.yml` exists, the session cannot
> start. Prompt the user to create one.

> **Pool fallback**: when `list_pool_agents` is called and no pool file exists, it returns
> the same agents as `list_agents` (the configured team). This means the pool selection
> conversation still works — you are just selecting a subset of the configured team.

## Session Startup

### Step 1: Load all agents

Call `list_agents` to get the active roster (reflects any `session-agents.yml` override).
Cache the result — it will be referenced throughout.

Separate agents into:
- **Base agents**: all agents returned by list_agents
- **Reviewer agents**: spawned on demand when a "Review requested: {id}" broadcast is detected

### Step 2: Spawn all base agents in parallel

Spawn all base agents simultaneously. For each agent:
1. Load persona from the cached `list_agents` result.
2. Load memory: `read_memory(agent_id)` + `read_memory()` (project + lessons).
3. Build system prompt: persona systemPrompt + memory.
4. Restrict available tools to the agent's `tools` array from `list_agents`.

**The agent whose name or description suggests a coordinator/PM role** receives the user's original request appended to its system prompt:
```
## Current Task
{user's original request}
```

**All other agents** receive:
```
## Session Start
Session {session_id} has begun. The coordinator is analyzing requirements and will broadcast tasks shortly.
Start by calling get_messages() to check for any existing context, then get_all_tasks()
to see if tasks have already been created.
```

If no clear coordinator exists, prepend the task to the first agent alphabetically.

**All agents** also receive this discipline note appended to their system prompt:
```
## Task Board Discipline
- Always claim_task before starting work on a task (marks it in_progress atomically).
- Always update_task(status: "done") immediately after finishing a task — completing a file
  change alone does not close the task.
- Before declaring end:_done or end:waiting, call get_my_tasks() to confirm no open tasks remain.

## Visibility
- Before each significant operation, call broadcast_thinking(content: "what you're about to do").
  This streams your intent to the dashboard so the team can see what you're working on.
```

### Step 3: Collect first-round declarations

After all agents complete their first run, collect their `end:` messages from broadcasts.

Each agent broadcasts one of:
- `end:waiting | {reason}` — no current work, but session continues
- `end:_done | {summary}` — fully done
- `end:failed | {reason}` — unrecoverable error → abort workflow, report to user

## Main Event Loop

```
dormant_agents = {}        # agentId → reason (declared end:waiting)
done_agents = {}           # agentId → summary (declared end:_done)
spawned_reviewers = []     # reviewer agent IDs spawned on demand
last_seen_msg_id = None    # tracks last processed message to avoid reprocessing
agent_last_seen = {}       # agentId → last message ID seen at their last spawn

while len(done_agents) < len(base_agents) + len(spawned_reviewers):

  # 1. Check if any dormant agent has new todo tasks
  all_tasks = get_all_tasks(agent_id: "orchestrator")
  for each dormant_agent in dormant_agents:
    my_tasks = [t for t in all_tasks if t.assignee == dormant_agent AND t.status == 'todo']
    if my_tasks:
      re-spawn dormant_agent (see Re-spawn Pattern)
      remove dormant_agent from dormant_agents

  # 2. Process new broadcast messages
  all_messages = get_messages(agent_id: "orchestrator")  # broadcasts + messages to "orchestrator"
  new_messages = [m for m in all_messages if m.id > last_seen_msg_id]
  if new_messages:
    last_seen_msg_id = max(m.id for m in new_messages)

  for each msg in new_messages:

    # 2a. End declarations
    if msg.content starts with "end:waiting":
      dormant_agents[msg.from_agent] = extract reason after "|"
    elif msg.content starts with "end:_done":
      # Verify the agent's tasks are actually complete before accepting the declaration
      all_tasks = get_all_tasks(agent_id: "orchestrator")
      my_open_tasks = [t for t in all_tasks
                       if t.assignee == msg.from_agent AND t.status in ("todo", "in_progress")]
      if my_open_tasks:
        # Agent has unfinished tasks — re-spawn to close them out
        re-spawn msg.from_agent with context:
          "You declared end:_done but still have open tasks: {my_open_tasks}.
           Call update_task(status: 'done') for each completed task, then re-declare end:_done."
        # Do NOT add to done_agents yet
      else:
        done_agents[msg.from_agent] = extract summary after "|"
    elif msg.content starts with "end:failed":
      report failure to user: "{msg.from_agent} failed: {reason}"
      ask user: abort or continue without this agent?

    # 2b. Reviewer spawn trigger
    # Pattern: "Review requested: {reviewerId}" anywhere in message
    reviewer_match = regex match r"Review requested:\s*([a-zA-Z0-9_-]+)" in msg.content
    if reviewer_match:
      reviewerId = reviewer_match.group(1)
      if reviewerId not in spawned_reviewers AND reviewerId not in done_agents:
        spawn_reviewer(reviewerId, msg.from_agent, all_agents_cache)
        spawned_reviewers.append(reviewerId)

    # 2c. Review completion trigger — re-spawn the implementer
    # Pattern: "Review complete: {implementerId} ..."
    done_match = regex match r"Review complete:\s*([a-zA-Z0-9_-]+)" in msg.content
    if done_match:
      implementerId = done_match.group(1)
      if implementerId in dormant_agents:
        re-spawn implementerId (see Re-spawn Pattern)
        remove implementerId from dormant_agents

  # 3. Deadlock detection
  active_agents = (base_agents + spawned_reviewers) - dormant_agents - done_agents
  if not active_agents AND len(dormant_agents) > 0:
    wait 30 seconds
    re-poll tasks and messages once more
    if still no new work:
      warn user: "Possible deadlock. Dormant agents: {list} — {reasons}. Continue or abort?"
      proceed or abort based on user decision
```

## Re-spawn Pattern

When re-spawning a dormant agent:

1. Load their persona + memory (same as initial spawn).
2. Fetch all messages: `get_messages(agent_id: "{agentId}")`.
3. Compute new messages since last spawn:
   - `new_msgs = [m for m in all_msgs if m.id > agent_last_seen.get(agentId, 0)]`
   - Update: `agent_last_seen[agentId] = max(m.id for m in all_msgs)`
4. Inject re-spawn context into their system prompt:
```
## Re-spawn Context
You were waiting. Here is what has happened since your last run:

New events:
{list of new_msgs}

Your current tasks:
{get_my_tasks result — fetched by orchestrator before spawning}

Team status:
{get_team_status result — fetched by orchestrator before spawning}

Resume your work. Call get_messages() first to read the full history.
```
5. Spawn with their allowed tools.
6. Collect their new `end:` declaration.

## Reviewer Spawn Pattern

Triggered when any agent broadcasts "Review requested: {reviewerId}".

1. Look up `reviewerId` in the cached `list_agents` result:
   - **Found**: spawn that agent with their defined persona and agent_id = reviewerId.
   - **Not found**: spawn using the requester's persona (same systemPrompt) but with agent_id = reviewerId.
     This handles the common pattern where a reviewer inherits the implementer's persona.

2. Inject reviewer context into the system prompt:
   ```
   ## Reviewer Role
   You are acting as a peer reviewer (agent_id: {reviewerId}).
   Call get_messages(agent_id: "{reviewerId}") to find the review request.
   Fetch the artifact, review it thoroughly, and call submit_review.
   IMPORTANT: After submit_review, broadcast the result:
     send_message(to: null, "Review complete: {requesterId} artifact {artifact_id} {approved|changes_requested} — {summary}")
   After reviewing, call get_team_status() and declare end:waiting or end:_done.
   ```

3. Allowed tools: same as the base persona's tools array.
4. Collect their `end:` declaration and track in spawned_reviewers.

**Note for teams without explicit reviewer agents:**
Agents can review each other's work by naming any active agent as reviewer.
Example: a research team where `researcher_b` reviews `researcher_a`'s paper:
  send_message(to: null, "Review requested: researcher_b please review paper artifact {id}")

## Session Wrap-up

When `len(done_agents) == len(base_agents) + len(spawned_reviewers)`:

1. Save team retrospective: `append_memory(content: "Session {session_id}: {overall summary}")` (no agent_id → writes to lessons.md).
2. Archive: `save_session_summary(session_id, summary, tasks, messages)`.
3. Clean up: if `.relay/session-agents.yml` was written during Team Composition, delete it
   (it is ephemeral and gitignored).
4. Report results to the user.

## Multi-Instance Notes

When running multiple relay servers simultaneously (e.g. two projects in separate terminals):

- Each server instance should have a unique `DASHBOARD_PORT` (e.g. 3456 and 3457).
- Use `RELAY_INSTANCE` to give each instance a name (e.g. `project-a`, `project-b`).
  Session IDs will be automatically prefixed: `project-a-2026-03-14-001`.
- Each instance uses a separate SQLite DB when `RELAY_INSTANCE` is set:
  `.relay/relay-{instance}.db` (e.g. `.relay/relay-project-a.db`).
- The skill always operates on the MCP server it was invoked from. When Claude Code has
  two relay MCP servers registered, use the correct one's skill invocation.

Example `.mcp.json` for two instances:
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

## Failure Handling

- `end:failed | {reason}` → report to user, ask abort or continue.
- Agent produces no `end:` message within 15 minutes → warn user, ask re-spawn / skip / abort.
