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
4. Tell the user: "Dashboard: http://localhost:3456"

## Session Startup

### Step 1: Load all agents

Call `list_agents` to get the full roster. Cache the result — it will be referenced throughout.

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
3. Report results to the user.

## Failure Handling

- `end:failed | {reason}` → report to user, ask abort or continue.
- Agent produces no `end:` message within 15 minutes → warn user, ask re-spawn / skip / abort.
