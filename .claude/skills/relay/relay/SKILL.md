---
name: relay
description: Run the full multi-agent workflow from start to finish. Use when the user gives a task that requires the whole team (PM, Designer, DA, FE, BE, QA, Deployer).
---

The startup team processes a task from start to finish.
The workflow is executed dynamically based on the `workflow` section defined in `agents.yml`.

## Pre-flight checks

1. Confirm the relay MCP server is connected (call `list_agents`)
2. Verify `.relay/memory/project.md` exists
   - If absent: suggest "init is required. Would you like to run `/relay:init` first?"
3. Generate a new session ID in `YYYY-MM-DD-NNN` format
4. Tell the user: "Dashboard: http://localhost:3456"

## Workflow execution

### Step 1: Load the workflow
Call `get_workflow` to fetch the full job configuration.

Detect the starting job: the job that does not appear as a destination in any other job's `end` map.
```
const allTargets = new Set(all values listed as keys in every job's end map)
const startJob = the job whose ID is not in allTargets
```

### Step 2: Job execution loop

Repeat from the current job until `_done` is reached:

```
currentJob = startJob

while (currentJob !== "_done"):
  job = workflow.jobs[currentJob]

  # Spawn each agent in the job in parallel
  for each agentId in job.agents:
    spawn agent with:
      - Persona: loaded via list_agents
      - Memory: read_memory(agent_id) + read_memory() combined
      - Additional system prompt injected:
          ## Current Job: {currentJob}
          {job.description}

          ## Completion criteria and next step
          When your work is complete, evaluate the conditions below and declare:
          send_message(to: null, content: "end:{nextJobId} | {reason}")
          {list of job.end conditions}

          ## Failure handling
          If an unrecoverable error occurs (missing required artifact, repeated tool call failures, etc.)
          stop working and declare failure in this format:
          send_message(to: null, content: "end:failed | {detailed failure reason}")
          Do not attempt further work after declaring failure.

  # Collect end declarations from all agents
  # Poll get_messages every ~30 seconds and detect messages starting with "end:"
  # Supported formats:
  #   "end:{nextJobId} | {reason}"  — success, proceed to nextJobId
  #   "end:failed | {reason}"       — agent failure, abort workflow
  #
  # Timeout: wait up to 10 minutes. If not all agent declarations arrive within 10 minutes,
  #   report the unresponsive agents to the user and let the user decide how to proceed.
  #   (The user can continue with partial responses or abort the workflow.)

  expectedAgents = job.agents (+ reviewers list if job has reviewers)
  startTime = now()
  declarations = []

  while declarations count < expectedAgents count:
    if now() - startTime > 10 minutes:
      missingAgents = expectedAgents - agents already represented in declarations
      warn user: "Timeout: {missingAgents} did not respond. Continue with received responses?"
      proceed or abort based on user decision
      break

    check for new messages (get_messages)
    add any newly received "end:"-prefixed messages to declarations

    # Immediately handle failure declarations
    if any declaration matches "end:failed":
      failedAgent = the agent ID in question
      reason = the {reason} part of the declaration message
      immediately report to user: "{failedAgent} failed: {reason}"
      abort workflow (currentJob = "_failed")
      break

    wait ~30 seconds then retry

  # Decide next job (on normal completion)
  if all declarations point to the same nextJob:
    currentJob = nextJob
  else:
    # Diverging opinions → prefer the conservative path (loop back over advance)
    currentJob = decide based on job.end conditions and collected reasons, preferring the most conservative path
```

### Step 3: Session wrap-up (when `_done` is reached)
1. Ask each agent to store session learnings via `append_memory`.
2. Call `append_memory(agent_id: undefined, content: "team retrospective...")` to update `lessons.md`.
   - Omitting `agent_id` writes to the shared project memory `lessons.md`.
3. Call `save_session_summary` to archive the session (tasks + messages included).
4. Report results to the user.

## Agent spawn pattern

For each agent spawn:
1. Load the persona via `list_agents`.
   - If the agentId is not in list_agents results, do a reverse lookup in the reviewers map:
     find agentId in any reviewers value list → use the corresponding key agent's persona
     (e.g. fe2 → reviewers.fe = [fe2] → load fe persona, set agent_id to fe2)
2. Load personal memory via `read_memory(agent_id)`.
3. Load project memory via `read_memory()` (no agent_id) → project.md + lessons.md.
4. Compose: system prompt = persona + memory + current job info.
5. Allowed MCP tools = the agent's `tools` array.

## Handling reviewers

When a job has a `reviewers` field, inject additional context when spawning reviewer agents:
- `reviewers.fe: [fe2]` → when spawning fe2: "Review the artifact written by fe (fetch fe-pr via get_artifact)"
- Reviewers also declare completion with `end:{nextJobId} | {reason}`
- Collect end declarations from all agents (workers + reviewers) before deciding the next job
