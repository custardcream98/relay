---
name: relay
description: Run the full multi-agent workflow from start to finish. Use when the user gives a task that should be handled by a team assembled from the agent pool.
---

The team collaborates event-driven — all agents are alive from session start and
react to messages and tasks organically, like a Slack-first team.

## Pre-flight Checks

1. Confirm the relay MCP server is connected by calling `list_agents` (do **not** pass `session_id` here — the session-specific file has not been written yet; `session_id` is passed only in Session Startup step 1).
   - Note: `list_agents` is used here only to verify MCP connectivity. Pool browsing uses `list_pool_agents` (Team Composition step 1) — that tool returns metadata without `systemPrompt` and does not require a session file.
   - `list_agents` will return 0 agents when no pool-based session file is configured — this is expected. Proceed to Team Composition.
2. Verify the agent pool is configured: check that `.relay/agents.pool.yml` or `agents.pool.yml` exists.
   - If absent: suggest running `/relay:init` first to set up the pool.
3. In parallel, call `list_sessions` and `get_server_info` to determine the correct session ID and dashboard URL.

   **3a. Compute the next NNN counter** using `list_sessions` result:
   - Today's date prefix: `YYYY-MM-DD` (current date).
   - If `instanceId` is non-null (from `get_server_info`), filter for sessions whose IDs start with `{instanceId}-YYYY-MM-DD-`; otherwise filter for sessions starting with `YYYY-MM-DD-`.
   - For each matching session ID, strip the `{instanceId}-` prefix if present
     (i.e. `sessionId.slice(instanceId.length + 1)` — `+1` accounts for the `-` separator),
     then split by `-` and parse the **segment at index 3** as an integer (that is the NNN counter).
     Example: `project-a-2026-03-14-007-a3f7` → strip `project-a-` → `2026-03-14-007-a3f7` → index 3 = `007`.
   - Next NNN = max of all parsed counters + 1, or 1 if no sessions match today.
   - Format NNN as a 3-digit zero-padded integer (e.g. `001`, `007`).

   **3b. Compose the session ID:**
   - Base: `YYYY-MM-DD-NNN-XXXX` where `XXXX` is 4 random hex digits (collision guard for same-second starts).
   - If `instanceId` is non-null: `{instanceId}-YYYY-MM-DD-NNN-XXXX`.
   - Example (no instance): `2026-03-14-007-a3f7`
   - Example (with instance `project-a`): `project-a-2026-03-14-007-a3f7`

   **3c. Register the session:** Call `start_session(agent_id: "orchestrator", session_id: "{composedId}")`.
   This activates the session ID on the server and resets the live dashboard view.

4. Report to the user: `"Session: {session_id} | Dashboard: {dashboardUrl}"`

## Team Composition (Dynamic Agent Selection)

This step runs **before** spawning any agents. Every session assembles a purpose-built team
from the agent pool — the team is assembled fresh each session.

> **Note**: The Pre-flight `list_agents` call does not pass `session_id` — the
> session-specific file has not been written yet. `session_id` is passed only in
> Session Startup step 1, after Team Composition writes the session-specific file.

Go directly to pool selection below.

### Pool Selection Conversation

1. Call `list_pool_agents` to fetch all available pool entries.
   - If it returns 0 entries, tell the user: "No agent pool configured. Create
     `.relay/agents.pool.yml` (see `agents.pool.example.yml`)." and stop.

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
   - **"Add N of the same agent"** (e.g. "add 3 FE engineers") → include that many instances
     with auto-numbered IDs: `fe`, `fe2`, `fe3`. Each gets the same pool persona but a
     distinct name (e.g. "Frontend Engineer 1", "Frontend Engineer 2", "Frontend Engineer 3").

5. Once confirmed, write the selected team to `.relay/session-agents-{session_id}.yml`:
   - Use the fields returned by `list_pool_agents`: `name`, `emoji`, `description`, `tools`.
   - Do NOT include `systemPrompt` — `list_pool_agents` intentionally omits it. The server
     resolves `systemPrompt` directly from the pool file at load time when `list_agents` is called.
   - For **single instances**, write the agent entry directly:
     ```yaml
     agents:
       fe:
         name: Frontend Engineer
         emoji: "🎨"
         description: "Builds UI components"
         tools: [...]
     ```
   - For **multiple instances of the same pool agent**, use the `extends` pattern so the
     session file stays compact:
     ```yaml
     agents:
       fe:
         extends: fe
         name: "Frontend Engineer 1"
       fe2:
         extends: fe
         name: "Frontend Engineer 2"
       fe3:
         extends: fe
         name: "Frontend Engineer 3"
     ```
     The `extends` value is the pool agent ID. The server merges the pool persona with the
     overrides (`name`, `emoji`, etc.) at load time.
   - Write the file at `.relay/session-agents-{session_id}.yml` (use the session ID generated
     in Pre-flight step 3).
   - Do NOT set `RELAY_SESSION_AGENTS_FILE` — pass `session_id` directly to `list_agents` instead.

> **Fallback**: if no pool is configured, the session cannot start. Prompt the user to
> create `.relay/agents.pool.yml` (see `agents.pool.example.yml`).

## Session Startup

### Step 1: Load all agents

Call `list_agents(agent_id: "orchestrator", session_id: "{session_id}")` to get the active roster.
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

## Mandatory Communication Protocol
You MUST call send_message at key moments — this is not optional. Without these messages,
the orchestrator cannot detect your completion and the team loses visibility into your work.

**After completing significant work** (before declaring end:):
  send_message(to: null, content: "Completed: {summary of what you did}")

**When blocked or waiting on another agent:**
  send_message(to: null, content: "Blocked: waiting for {agent} to complete {task}")

**When handing off work to a specific agent:**
  send_message(to: "{agentId}", content: "Handoff: {what was done}, {what you need from them}")

**End declarations are send_message calls — always send them:**
  send_message(to: null, content: "end:waiting | {reason}")   ← when you have more work to do later
  send_message(to: null, content: "end:_done | {summary}")    ← when all your tasks are complete
  NEVER skip these. The orchestrator detects your state ONLY through these messages.
  Skipping them causes the session to stall or your work to be silently lost.
```

### Step 3: Collect first-round declarations

After all agent spawns return, **immediately** call `get_messages(agent_id: "orchestrator")`.

For each base agent, determine their state:
- Message starts with `end:waiting` → add to `dormant_agents` with reason
- Message starts with `end:_done` → add to `done_agents` with summary
- Message starts with `end:failed` → report failure to user
- **No `end:` message found** → treat as implicitly `end:waiting | no declaration` (the agent
  completed its Agent call without broadcasting — assume it needs a follow-up)

Then immediately enter the Main Event Loop below.

## Main Event Loop

```
dormant_agents = {}        # agentId → reason (declared end:waiting)
done_agents = {}           # agentId → summary (declared end:_done)
spawned_reviewers = []     # reviewer agent IDs spawned on demand
last_seen_msg_id = None    # tracks last processed message to avoid reprocessing
agent_last_seen = {}       # agentId → last message ID seen at their last spawn

while len(done_agents) < len(base_agents) + len(spawned_reviewers):

  # 1. Re-spawn dormant agents that have actionable conditions
  all_tasks = get_all_tasks(agent_id: "orchestrator")
  for each dormant_agent, reason in dormant_agents.items():

    # 1a. New todo tasks assigned to this agent
    my_tasks = [t for t in all_tasks if t.assignee == dormant_agent AND t.status == 'todo']
    if my_tasks:
      re-spawn dormant_agent (see Re-spawn Pattern)
      remove dormant_agent from dormant_agents
      continue

    # 1b. Agent is waiting on a question or ambiguity — re-spawn immediately with "proceed" answer
    # Heuristics for question-type waits (apply ANY):
    # - reason contains "?" (explicit question mark)
    # - reason contains words like "proceed", "confirm", "should", "approve", "진행", "확인", "수정"
    # - reason is very short (< 20 chars) and not a well-known wait reason like "waiting for review"
    is_question_wait = ("?" in reason
                        OR any(kw in reason.lower() for kw in
                               ["proceed", "confirm", "should", "approve", "진행", "확인", "수정"])
                        OR (len(reason) < 20 AND "review" not in reason.lower()
                                             AND "team" not in reason.lower()))
    if is_question_wait:
      re-spawn dormant_agent with context:
        "Your previous run ended with: '{reason}'.
         Yes — proceed with the implementation. Do not ask for further confirmation.
         Check get_messages() for full context, then complete your work."
      remove dormant_agent from dormant_agents
      continue

    # 1c. Agent declared no end: at all (implicit waiting) — re-spawn with a communication reminder
    if reason == "no declaration":
      re-spawn dormant_agent with context:
        "Your previous run ended without sending any end: declaration via send_message.
         This means the team has no visibility into what you did or whether you finished.
         REQUIRED steps upon re-spawn:
         1. Call get_messages() and get_my_tasks() to review full context.
         2. Call send_message(to: null, content: 'Summary: {what you completed in your previous run}')
            so the team knows what was done.
         3. Complete any remaining work.
         4. Call send_message(to: null, content: 'end:_done | {summary}') or
            send_message(to: null, content: 'end:waiting | {reason}').
         Do NOT skip send_message — these calls are mandatory."
      remove dormant_agent from dormant_agents
      continue

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
2. Archive: `save_session_summary(session_id, summary)`.
3. Clean up: delete `.relay/session-agents-{session_id}.yml` — it is ephemeral and gitignored.
4. Report results to the user.

## Multi-Instance Notes

When running multiple relay servers simultaneously (e.g. two projects in separate terminals):

- Each server instance should have a unique `DASHBOARD_PORT` (e.g. 3456 and 3457).
- Use `RELAY_INSTANCE` to give each instance a name (e.g. `project-a`, `project-b`).
  Session IDs will be automatically prefixed: `project-a-2026-03-14-007-a3f7`.
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
