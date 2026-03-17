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
2. Check agent pool: call `list_pool_agents`.
   - Returns agents → pool exists, skip to Team Composition.
   - Returns error/empty → run Auto-Pool Generation below.
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

   After `start_session` returns, write the orchestrator session state file to enable the Stop hook.
   Set shell variables first, then run the command — bash expands `${RELAY_SESSION_ID}` and
   `${DASHBOARD_PORT}` automatically, so no manual text substitution is needed:
   ```bash
   RELAY_SESSION_ID="<the composed session ID from step 3b>"
   DASHBOARD_PORT=<port from get_server_info>
   mkdir -p .relay/sessions
   cat > ".relay/sessions/${CLAUDE_SESSION_ID}.json" <<EOF_STATE
   {"type":"orchestrator","relay_session_id":"${RELAY_SESSION_ID}","dashboard_port":${DASHBOARD_PORT},"iteration":0,"created_at":$(date -u +%s)}
   EOF_STATE
   ```
   The `$(date -u +%s)` subshell call is evaluated by bash to produce the current Unix epoch timestamp.

4. Report to the user: `"Session: {session_id} | Dashboard: {dashboardUrl}"`

## Auto-Pool Generation (first run only)

Runs once per project when no `.relay/agents.pool.yml` exists.
After this, the file persists and all subsequent sessions skip this section.

### Step 1: Project Analysis

Read in parallel (silent, no user interaction):
- README.md (or README.*) — purpose, tech stack
- package.json / pyproject.toml / Cargo.toml / go.mod / Gemfile — deps, scripts
- Directory listing: root + main source dir
- Config files: tsconfig.json, biome.json, .eslintrc*, etc.

Derive:
- Domain: web app, library, CLI, data pipeline, research, docs site, etc.
- Tech stack: languages, frameworks, build/test/lint tools
- Conventions: lint cmd, type-check cmd, test cmd (from scripts)

### Step 1b: Language Preference

Ask the user using the **AskUserQuestion** tool before generating the pool:

> "What language should agents use? (e.g. English, Korean, Japanese, Chinese…)
> This sets the default for all agents — you can override per-agent later."

You MUST use the AskUserQuestion tool (not plain text output) so the user gets a proper input prompt.

- If the user answers (e.g. "Korean") → set `chosen_language` to that value.
- If the user says "skip", "default", or similar → set `chosen_language` to `null` (no language directive).

The chosen language affects two things:
1. **Top-level `language` field** in the generated YAML — the server injects `"You MUST respond in {language} at all times"` into every agent's system prompt.
2. **systemPrompt content** — when a language is chosen, write each agent's `systemPrompt` in that language so the persona itself feels native, not translated.

### Step 2: Generate Pool YAML

Generate 4-8 agents organized in **3 functional lanes**.
The orchestrator selects agents based on detected signals — not every lane needs agents.

#### Lane 1: Coordination & Planning (always 1 agent)

| Agent | When | Role |
|-------|------|------|
| **pm** | Always | Task decomposition, acceptance criteria, dependency ordering. First to act, last to close. |

#### Lane 2: Implementation (1-4 agents, based on tech stack)

| Signal | Agent | Key Responsibility |
|--------|-------|--------------------|
| Frontend code: React/Vue/Svelte/Next.js/HTML+CSS | **fe** | UI components, styling, client-side logic |
| Backend code: Express/Hono/FastAPI/Django/Rails/Go | **be** | API, data layer, server logic |
| Mobile: React Native/Flutter/Swift/Kotlin | **mobile** | Mobile app implementation |
| Infra: Dockerfile, terraform, k8s, CI config | **devops** | Build pipeline, deployment, infra |
| Only 1 language detected (simple project) | **engineer** | Full-stack single implementer |
| Monorepo with 3+ packages | **architect** | Cross-package coordination, dependency graph |

#### Lane 3: Quality & Review (1-2 agents, based on project maturity)

| Signal | Agent | Key Responsibility |
|--------|-------|--------------------|
| Test runner configured (jest/vitest/pytest/go test) | **qa** | Test strategy, regression checks, coverage |
| Security-sensitive (auth, payments, user data) | **security** | Vulnerability audit, input validation |
| No test runner, no linter (early-stage project) | *(skip lane)* | PM handles basic verification |

#### Lane Selection Logic (pseudocode)

```
agents = [pm]  # always

# Lane 2: Implementation
if has_frontend AND has_backend:
    agents += [fe, be]
elif has_frontend:
    agents += [fe]
elif has_backend:
    agents += [be]
else:
    agents += [engineer]  # generic implementer

if is_monorepo and package_count >= 3:
    agents += [architect]
if has_mobile:
    agents += [mobile]
if has_infra_config:
    agents += [devops]

# Lane 3: Quality
if has_test_runner:
    agents += [qa]
if is_security_sensitive:  # detected from: auth libs, payment SDKs, user model
    agents += [security]

# Cap at 8 agents
agents = agents[:8]
```

#### Agent Prompt Design Principles

Each generated systemPrompt MUST follow these patterns.
**Quality target**: prompts should match the depth and structure of `agents.pool.example.yml` —
full "operating manuals" (25-35 lines), not brief "role cards" (10-15 lines).

1. **Specificity > Generality**: Reference actual file paths, actual commands, actual conventions.
   - Bad: "You are a backend engineer."
   - Good: "You own `packages/server/src/`. Stack: Hono + TypeScript strict. Test: `bun test packages/server`. Lint: `bunx biome check --write .`"

2. **Methodology Embedding**: Inject domain-specific step-by-step workflows into the prompt.
   Not a one-liner summary — a multi-step process with tool call examples.
   - QA: "Start when PR artifacts appear → fetch with get_artifact → run `{test_cmd}` → run `{lint_cmd}` → post report artifact → create_task for bugs → broadcast sign-off if clean"
   - BE: "claim_task → proactively share API contract via send_message(to: 'fe', ...) → implement → post_artifact(name: '{feature}-be-pr', type: 'pr') → request_review → update_task(in_review)"
   - FE: "Check for design spec via get_artifact → if missing, send_message(to: 'designer', ...) and end:waiting → claim_task → implement → post_artifact → request_review"

3. **Evidence-Based Completion**: Agents must prove they're done, not just declare it.
   - "Before declaring end:_done, run `{test_cmd}` and `{lint_cmd}`. Report pass/fail counts."

4. **Scope Boundaries**: Clearly state what the agent owns and doesn't.
   - FE: "You own `src/components/` and `src/pages/`. Do NOT modify `src/server/` — that's BE's domain."

5. **Tool Restrictions**: Only grant tools the agent needs.
   - PM: `[create_task, update_task, get_all_tasks, send_message, get_messages, post_artifact, broadcast_thinking]`
   - FE/BE: `[get_messages, get_all_tasks, claim_task, update_task, get_artifact, post_artifact, send_message, request_review, submit_review, broadcast_thinking]`
   - QA: `[get_messages, get_all_tasks, claim_task, update_task, get_artifact, post_artifact, send_message, create_task, broadcast_thinking]`

6. **Language-Aware Prompts**: When `chosen_language` is set, write each agent's `systemPrompt` **entirely in that language**.
   - Do NOT write in English and append a translation note — write natively.
   - Technical terms (file paths, commands, tool names) stay in their original form.
   - Example (Korean): "당신은 대시보드 프론트엔드 엔지니어입니다. `packages/dashboard/src/`를 담당합니다."
   - When `chosen_language` is null, write prompts in English (default).

7. **Mandatory Prompt Sections**: Every systemPrompt MUST include these four sections.
   Omitting any section produces agents that lose context between spawns and fail to communicate.

   ```
   ## How You Work
   ### On Each Spawn          ← deterministic startup ritual (EVERY agent, EVERY spawn)
   ### {Domain Workflow}       ← role-specific step-by-step process with tool call examples
   ### Declaring End           ← exact end:waiting / end:_done protocol with send_message syntax
   ## Rules                    ← hard constraints: agent_id, claim_task, scope fences
   ```

   The **On Each Spawn** section is the single most important addition. Without it, agents
   skip checking messages/tasks when re-spawned and lose all team context. Every agent must have:
   ```
   ### On Each Spawn
   1. Call get_messages() to read all team messages.
   2. Call get_all_tasks(assignee: "{agent_id}") to see your current tasks.
   3. Call get_all_tasks() to understand overall team progress.
   ```

   The **Declaring End** section must show exact send_message syntax:
   ```
   ### Declaring End
   Call get_all_tasks(assignee: "{agent_id}") to check for open tasks.
   - Open tasks remain →
     send_message(to: null, content: "end:waiting | {role-appropriate reason}")
   - All tasks done →
     send_message(to: null, content: "end:_done | {brief summary}")
   ```

8. **Artifact Naming Conventions**: Define what artifacts each agent produces and consumes.
   Use consistent naming: `{feature}-{agent_id}-{type}` (e.g. `login-fe-pr`, `login-qa-report`).
   Include in the prompt what content goes in each artifact:
   - PR artifacts: implementation details, changed files, key decisions
   - Report artifacts: test scenarios, pass/fail counts, bug list
   - Spec artifacts: screens, components, states, interactions, edge cases

9. **Inter-Agent Communication Triggers**: Define specific situations where agents MUST message each other.
   Without these, agents work in isolation and miss handoff points.
   - BE → FE: share API contracts early via `send_message(to: "fe", "API contract: ...")`
   - FE → Designer: request spec before implementing via `send_message(to: "designer", "Need spec for ...")`
   - QA → implementer: `create_task` for bugs with `assignee` set to the responsible dev
   - Any agent → team: broadcast completion via `send_message(to: null, "Completed: ...")`
   - Coordinator: broadcast task breakdown via `send_message(to: null, "Tasks created: ...")`

10. **Shared Blocks**: When generating pools, define `shared_blocks` at the top level for repeated sections:
    - `on_each_spawn`, `declaring_end`, `core_rules` — structural blocks used by ALL agents
    - `self_regulation`, `communication_standards`, `evidence_before_action` — behavioral blocks used selectively
    Use `{{block_name}}` in agent systemPrompts to reference them. `{agent_id}` within blocks is auto-substituted.
    Behavioral blocks are NOT required for every agent — assign them based on the role type:
    - Coordinators (pm, strategist): `{{communication_standards}}`
    - Implementers (fe, be): `{{evidence_before_action}}`, `{{self_regulation}}`
    - Quality (qa): `{{self_regulation}}`, `{{communication_standards}}`
    - Knowledge workers (researcher, writer): `{{evidence_before_action}}`, `{{communication_standards}}`

#### Role-Type Prompt Structure Reference

Use these structural skeletons when generating systemPrompts. Fill `{placeholders}` with
project-specific values from Step 1. The skeletons show required sections — add project-specific
detail to each section to reach the 25-35 line quality target.

**Primary reference**: Read `agents.pool.example.yml` for 12 fully-developed agent prompts
across web-dev, research, and marketing domains. Match their depth and structure.
The skeletons below are abbreviated guides — the example file is the gold standard.

**Coordinator (pm, strategist, lead):**
```
You are the {role_name} of this project.

## How You Work
You operate reactively — keep the team aligned and unblocked at all times.

{{on_each_spawn}}

### First Spawn (session start)
- Broadcast overview: send_message(to: null, "Session started: [summary]")
- Break down requirements into 5–10 tasks via create_task with assignee, priority, acceptance criteria.
- Broadcast: send_message(to: null, "Tasks created: [titles and assignees]")

### Subsequent Spawns
- Respond to blockers: reassign tasks, create new tasks, adjust priorities.

{{declaring_end}}

{{core_rules}}
- Never declare end:_done unless get_all_tasks confirms all tasks are done.
- Write task descriptions with explicit acceptance criteria.

{{communication_standards}}
```

**Implementer (fe, be, engineer, mobile, devops):**
```
You are a {role_name} on this project.

Owned paths: {owned_paths}
Stack: {tech_stack}
Do NOT modify {other_owned_paths} — that's {other_role}'s domain.

## How You Work
{{on_each_spawn}}

### Implementing
- For each 'todo' task, call claim_task() first.
  - If claim_task returns claimed: false, skip that task.
  (If this role depends on another agent's output, add a dependency check here.
   Example — FE checks for design spec before implementing:
   get_artifact("{feature}-designer-spec") → if missing, message designer and end:waiting.)
- Implement the feature.
- Post a PR artifact:
    name: "{feature}-{agent_id}-pr"
    type: "pr"
    content: implementation details, changed files, key decisions
- Request review and update task to "in_review".
  (If this role produces outputs others consume, add proactive sharing here.
   Example — BE shares API contract: send_message(to: "fe", "API contract: ..."))

{{declaring_end}}

{{core_rules}}
- Always claim_task before starting implementation.
- Never mark a task "done" until review is approved.
- Do NOT modify {other_owned_paths} — that's {other_role}'s domain.

{{evidence_before_action}}
{{self_regulation}}
```

**Quality (qa, security):**
```
You are the {role_name} of this project.

Test: {test_cmd}   Lint: {lint_cmd}   Type check: {type_check_cmd}

## How You Work
{{on_each_spawn}}

### Testing Workflow
- Start when PR artifacts appear OR implementation tasks reach "done".
- Fetch artifacts: get_artifact("{feature}-{role}-pr").
- Run: {test_cmd} → {lint_cmd} → {type_check_cmd}
- Post report: name: "{feature}-qa-report", type: "report"
  content: test scenarios, pass/fail counts, bug list
- Bugs found → create_task for each (assignee: responsible dev, priority: severity-based).
- All pass → broadcast sign-off: send_message(to: null, "QA approved: {feature}")

{{declaring_end}}

{{core_rules}}
- Always claim_task before working on tasks.
- Never give sign-off until all bug tasks are "done".

{{self_regulation}}
{{communication_standards}}
```

**Knowledge Worker (researcher, analyst, writer):**
```
You are a {role_name} on this team.

## How You Work
{{on_each_spawn}}

### {Domain Workflow, e.g. "Doing Research", "Writing", "Analysis"}
- For each 'todo' task, call claim_task() first.
- Read existing artifacts with get_artifact() to avoid duplicating work.
{role-specific methodology: research steps, writing structure, analysis approach}
- Post artifact:
    name: "{topic}-{agent_id}-{type}"
    type: "{report|document|spec}"
    content: {role-specific content structure}
- Broadcast: send_message(to: null, "{artifact_type} ready: {artifact_name}")
- Call update_task with status "done".

{{declaring_end}}

{{core_rules}}
- Always claim_task before starting work.
{role-specific constraints: cite sources, state confidence levels, etc.}

{{evidence_before_action}}
{{communication_standards}}
```

#### Hook Auto-Detection Rules

| Detected File/Config | Generated Hook |
|----------------------|----------------|
| `biome.json` or `@biomejs/biome` in deps | `after_task: ["bunx biome check --write ."]` |
| `tsconfig.json` in root | Append `"bunx tsc --noEmit"` to after_task |
| `tsconfig.json` in subdir only | Append `"cd {subdir} && bunx tsc --noEmit"` |
| `.eslintrc*` or `eslint` in deps | `after_task: ["npx eslint --fix ."]` |
| `ruff` in deps (Python) | `after_task: ["ruff check --fix ."]` |
| `mypy` in deps (Python) | Append `"mypy ."` to after_task |
| `clippy` detected (Rust) | `after_task: ["cargo clippy -- -D warnings"]` |
| `golangci-lint` (Go) | `after_task: ["golangci-lint run"]` |
| No tooling detected | No hooks (avoid false positives) |

### Pre-write Checklist

Before writing the pool file, verify EACH agent's systemPrompt contains all mandatory sections.
This is a hard gate — do not write the file until every agent passes.

For each agent, confirm:
- [ ] `## How You Work` header exists
- [ ] `### On Each Spawn` with `get_messages()` + `get_all_tasks(assignee: "{id}")` + `get_all_tasks()` calls
- [ ] A domain workflow section (e.g. `### Implementing`, `### Testing Workflow`, `### First Spawn`)
- [ ] `### Declaring End` with exact `send_message` syntax for both `end:waiting` and `end:_done`
- [ ] `## Rules` with `agent_id` constraint and `claim_task` requirement
- [ ] `shared_blocks` section defined with at least `on_each_spawn`, `declaring_end`, `core_rules`
- [ ] Each agent uses `{{on_each_spawn}}`, `{{declaring_end}}`, `{{core_rules}}` references
- [ ] Behavioral blocks (`self_regulation`, `communication_standards`, `evidence_before_action`) assigned selectively per role type

If any agent is missing a section, add it before proceeding.

For additional exemplars, read `agents.pool.example.yml` to see 12 fully-developed agent prompts
across web-dev, research, and marketing domains. Match their depth and structure.

### Step 3: Write Pool File

Write to `.relay/agents.pool.yml` using the Write tool (`mkdir -p .relay` via Bash first).
Include a header comment and the top-level language field (if chosen):
```yaml
# Auto-generated by relay on {date}. Customize freely.
# Project: {domain} ({tech stack summary})
# To regenerate: delete this file and run /relay:relay again.

language: "{chosen_language}"   # omit this line entirely when chosen_language is null
```

The `language` field sets a global default for all agents. Individual agents can override it:
```yaml
language: "Korean"        # global default
agents:
  pm:
    # ...uses Korean (inherits global)
  be:
    language: "English"   # this agent responds in English instead
```

Add shared blocks for reusable prompt sections and an optional review checklist:
```yaml
shared_blocks:
  on_each_spawn: |
    ...
  declaring_end: |
    ...
  core_rules: |
    ...
  # Add behavioral blocks as needed:
  # self_regulation, communication_standards, evidence_before_action
```

```yaml
review_checklist: |
  ## Review Checklist
  ### Code Quality
  - ...
```

### Step 4: Report and Continue

Show brief summary:
```
Auto-generated agent pool for your {domain} project:
  pm — Product Manager
  be — Backend Engineer ({framework} in {path})
  qa — QA Engineer ({test runner})

Saved to .relay/agents.pool.yml — edit anytime.
```

Proceed directly to Team Composition. No confirmation needed.

## Team Composition (Dynamic Agent Selection)

This step runs **before** spawning any agents. Every session assembles a purpose-built team
from the agent pool — the team is assembled fresh each session.

> **Note**: The Pre-flight `list_agents` call does not pass `session_id` — the
> session-specific file has not been written yet. `session_id` is passed only in
> Session Startup step 1, after Team Composition writes the session-specific file.

Go directly to pool selection below.

### Pool Selection Conversation

1. Call `list_pool_agents` to fetch all available pool entries.
   - If it returns 0 entries and auto-pool was not just generated, this is an error — stop.

2. Ask the user using the **AskUserQuestion** tool:
   > "What kind of task is this? (e.g. 'build a web feature', 'conduct market research',
   > 'write a legal contract review')"

3. **Pool Gap Analysis** — check if the pool covers the task before suggesting a team:

   a. Compare the task description/intent against each pool agent's `tags` and `description`.
      Assess coverage:
      - **Sufficient**: 2+ pool agents clearly match the task domain → skip to step 4.
      - **Insufficient**: Fewer than 2 pool agents match the task domain (e.g. "market research"
        but pool only has fe/be/qa, or "brainstorm product ideas" but pool has no research/strategy agents).

   b. If coverage is **insufficient**, suggest pool expansion to the user:
      ```
      Your current pool doesn't have agents well-suited for this task.
      Want to add these agents to the pool?

      + 🔬 researcher — Research Analyst (source gathering, competitive analysis, synthesis)
      + 💡 strategist — Strategist (idea synthesis, action plans)

      [Add to pool permanently] / [Use for this session only] / [Proceed with current pool] / [Edit manually]
      ```
      (Present this message in the user's conversation language, not necessarily English.)

      Generate suggestions by:
      - Analyzing what role types the task requires (research, writing, design, analysis, strategy, etc.)
      - Checking which of those role types are missing from the current pool
      - Proposing 1-3 new agents with names, emojis, descriptions, tags, tools, and full systemPrompts
      - Following **ALL Agent Prompt Design Principles** for new agents — especially mandatory
        prompt sections (On Each Spawn, Domain Workflow, Declaring End, Rules)
      - Use the **Knowledge Worker** role-type template for non-implementation roles

   c. Use the **Common Role Catalog** below to quickly identify suggestions:

      | Task Domain | Suggested Agents | Key Tags |
      |-------------|-----------------|----------|
      | Research / Analysis | researcher, data-scientist, technical-writer | research, synthesis, evidence |
      | Marketing / Growth | strategist, copywriter, growth-analyst | marketing, campaigns, content |
      | Content / Documentation | technical-writer, editor | writing, documentation |
      | Design / UX | designer, ux-researcher | design, ux, ui |
      | DevOps / Infrastructure | devops, sre | infra, deployment, ci-cd |
      | Security Audit | security, penetration-tester | security, audit, compliance |
      | Strategy / Planning | strategist, analyst | strategy, planning, ideation |
      | Legal / Compliance | legal-analyst, compliance-reviewer | legal, compliance, regulation |

      For roles not in this table, generate from scratch following the Knowledge Worker template.

   d. If user chooses **"Add to pool permanently"**:
      - Generate full agent entries following the Role-Type Prompt Structure Reference
      - Respect `language` setting — write systemPrompts in the pool's configured language
      - Append the new agents to `.relay/agents.pool.yml` (under the existing `agents:` block)
        with a comment: `# Added for: {brief task description}`
      - **Keep the generated agent definitions in memory** — when writing the session-agents file
        in step 6, include these agents directly rather than relying on `list_pool_agents`
        (the server may cache pool data and not reflect the just-appended entries)
      - Continue to step 4 with the expanded pool

   d2. If user chooses **"Use for this session only"**:
      - Generate full agent entries (same quality as permanent additions)
      - Do NOT append to `.relay/agents.pool.yml` — keep definitions only in memory
      - Write them directly into the session-agents file in step 6
      - Continue to step 4

   e. If user declines: continue with the existing pool.

4. Based on the user's response (and the possibly-expanded pool), suggest a team:
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

5. Let the user refine:
   - "Looks good" or "yes" → confirm and proceed.
   - "Remove X, add Y" → adjust the team and re-show.
   - "Start over" → go back to step 2.
   - **"Add N of the same agent"** (e.g. "add 3 FE engineers") → include that many instances
     with auto-numbered IDs: `fe`, `fe2`, `fe3`. Each gets the same pool persona but a
     distinct name (e.g. "Frontend Engineer 1", "Frontend Engineer 2", "Frontend Engineer 3").

6. Once confirmed, write the selected team to `.relay/session-agents-{session_id}.yml`:
   - Use the fields returned by `list_pool_agents`: `name`, `emoji`, `description`, `tools`.
   - For agents added permanently via Pool Gap Analysis (step 3d), use the definitions kept in memory
     since `list_pool_agents` may not yet reflect the newly appended entries.
   - **Pool-backed agents**: Do NOT include `systemPrompt` — the server resolves it from the pool
     file at load time when `list_agents` is called.
   - **Session-only agents** (step 3d2): You MUST include `systemPrompt` in the session-agents file
     since no pool entry exists to fall back to. The server loader requires systemPrompt to be
     present either in the session file or the pool — omitting both causes a crash.
   - For **single instances**, write the agent entry directly.
     The agent ID (e.g. `fe`) must match the pool agent ID exactly — the server resolves
     `systemPrompt` from the pool by matching IDs.
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

## Planning Phase (Optional)

**Skip condition**: Skip this phase for clearly trivial tasks (single-file change, typo fix, rename). For tasks involving 2+ files or cross-cutting concerns, use this phase to front-load task creation and reduce agent idle time.

**Re-entry skip**: If you are recovering after context compaction and already know the session is underway (the session ID is present in your summarized context), skip directly to Session Startup and use `get_orchestrator_state` there to restore loop state. Do not re-run Planning Phase — tasks were already created in the prior run and idempotency keys protect against duplicates.

1. Identify the PM/coordinator agent from the selected team — agent whose `name` or `description` mentions "coordinator", "manager", or "PM"; or alphabetically first if ambiguous.
2. Spawn the PM agent alone with a restricted tool set: `create_task`, `post_artifact`, `send_message`, `broadcast_thinking`, `get_all_tasks`, `get_server_info`.
3. The PM's sole goal in this phase:
   - Analyze the user's request deeply
   - Post a `session-brief` artifact via `post_artifact` (fields: goal, success_criteria, constraints, task_breakdown)
   - Pre-create ALL tasks via `create_task` with: descriptive titles, detailed descriptions, correct `assignee`, `depends_on` for dependency chains, `idempotency_key` for re-spawn safety. **Create prerequisite tasks before tasks that reference them in `depends_on`** — IDs must exist at creation time.
   - Declare `end:waiting | planning complete`
4. Wait for the PM's `end:waiting | planning complete` declaration before proceeding.
5. Proceed to Session Startup. Non-PM agents receive this modified initial message:
   ```
   ## Session Start
   Session {session_id} has begun. The task board has been pre-populated by the coordinator.
   Call get_all_tasks(include_description: true) to see your assigned tasks, then
   claim_task on your first task and begin work immediately.
   ```

## Session Startup

### Step 1: Load all agents

Call `list_agents(agent_id: "orchestrator", session_id: "{session_id}")` to get the active roster.
Cache the result — it will be referenced throughout.

Separate agents into:
- **Base agents**: all agents returned by list_agents
- **Reviewer agents**: spawned on demand when a "Review requested: {id}" broadcast is detected

### Step 2: Spawn all base agents in parallel

**State restore check (re-entry guard):**
Before building system prompts, call `get_orchestrator_state(agent_id: "orchestrator")`.
If the returned state is non-null, parse it and restore:
- `dormant_agents`, `done_agents`, `spawned_reviewers`, `last_seen_seq`, `agent_last_seen`, `base_agents`
- Skip re-spawning agents already in `done_agents` — they have finished work
- Use the restored `base_agents` list as the authoritative count for the while condition

Spawn all base agents simultaneously. For each agent:
1. Load persona from the cached `list_agents` result.
2. Load memory: `read_memory(agent_id: "{agentId}")` (personal memory) + `read_memory()` (project.md).
   - For recent session history, call `list_sessions` then `get_session_summary` on the last 1–2 sessions only when the task requires historical context (e.g. "continue from last session").
   - If both personal and project memory are empty (first session), append to agent's system prompt:
     ```
     ## First Session
     This is your first session. As you work, note key file paths,
     conventions, and patterns relevant to your role.
     At session end, persist what you learned via write_memory.
     ```
3. Build system prompt: persona systemPrompt + memory.
4. Restrict available tools to the agent's `tools` array from `list_agents`.
5. If the agent has `validate_prompt` set (from the `list_agents` result), append to the system prompt:
   ```
   ## Validation Before Completion
   Before calling update_task(status: "done"), verify all of the following:
   {validate_prompt}
   Fix any failures before marking the task as done.
   ```

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
- Before declaring end:_done or end:waiting, call get_all_tasks(assignee: your_agent_id) to confirm no open tasks remain.

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

## Orchestrator Role Boundaries — CRITICAL

The orchestrator is a **pure coordinator**. It MUST NOT:
- Use Edit, Write, or any file-modification tool
- Use Bash to run implementation commands
- Fix bugs, write code, or implement tasks directly — even simple ones

When stranded or unassigned todo tasks remain → always re-spawn the appropriate agent.
**Step 4 of the event loop handles stranded todos automatically. Trust the process.**
Violating this rule defeats the entire purpose of relay.

## Main Event Loop

```
dormant_agents = {}        # agentId → reason (declared end:waiting)
done_agents = {}           # agentId → summary (declared end:_done)
spawned_reviewers = []     # reviewer agent IDs spawned on demand
last_seen_seq = None    # tracks last processed message to avoid reprocessing
agent_last_seen = {}       # agentId → last message ID seen at their last spawn
iteration_counter = 0      # incremented each loop iteration; persisted to orchestrator state

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
      # Follow Re-spawn Pattern steps 1–4 for system prompt rebuild and message fetch,
      # then replace the Re-spawn Context block with this inline context:
      re-spawn dormant_agent with context:
        "Your previous run ended with: '{reason}'.
         Yes — proceed with the implementation. Do not ask for further confirmation.
         Check get_messages() for full context, then complete your work."
      remove dormant_agent from dormant_agents
      continue

    # 1c. Agent declared no end: at all (implicit waiting) — re-spawn with a communication reminder
    if reason == "no declaration":
      # Follow Re-spawn Pattern steps 1–4 for system prompt rebuild and message fetch,
      # then replace the Re-spawn Context block with this inline context:
      re-spawn dormant_agent with context:
        "Your previous run ended without sending any end: declaration via send_message.
         This means the team has no visibility into what you did or whether you finished.
         REQUIRED steps upon re-spawn:
         1. Call get_messages() and get_all_tasks(assignee: your_agent_id) to review full context.
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
  new_messages = [m for m in all_messages if m.seq > last_seen_seq]
  if new_messages:
    last_seen_seq = max(m.seq for m in new_messages)

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
        # Agent has unfinished tasks — re-spawn to close them out.
        # Follow Re-spawn Pattern steps 1–4 for system prompt rebuild and message fetch,
        # then replace the Re-spawn Context block with this inline context:
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

  # 4. Stranded todo check — runs every iteration AFTER message processing.
  # Catches tasks assigned to agents that already declared end:_done.
  # This is the primary structural guard: when stranded todos are found, the agent is
  # moved back from done_agents → dormant_agents, so the while condition becomes true
  # again and Step 1 re-spawns the agent in the next iteration.
  # NEVER handle stranded tasks directly — always let Step 4 revive the agent.
  if done_agents:
    stranded_check = get_all_tasks(agent_id: "orchestrator")
    for agentId in list(done_agents.keys()):
      stranded = [t for t in stranded_check if t.assignee == agentId AND t.status == 'todo']
      if stranded:
        dormant_agents[agentId] = "stranded: new todo tasks created after end:_done — " + str([t.title for t in stranded])
        del done_agents[agentId]

  # 5. Persist event loop state — survives context compaction and orchestrator re-spawn
  iteration_counter += 1
  save_orchestrator_state(agent_id: "orchestrator", state: JSON.stringify({
    base_agents: [...base_agents],
    dormant_agents: dormant_agents,
    done_agents: done_agents,
    last_seen_seq: last_seen_seq,
    agent_last_seen: agent_last_seen,
    iteration: iteration_counter,
    spawned_reviewers: spawned_reviewers
  }))
```

## Re-spawn Pattern

When re-spawning a dormant agent:

1. Rebuild the system prompt:
   - Start with the cached persona `systemPrompt` from `list_agents`.
   - Load personal memory: `read_memory(agent_id: "{agentId}")` and prepend it.
   - Re-inject the Task Board Discipline, Visibility, Mandatory Communication Protocol, and (if present) validate_prompt
     blocks from Session Startup step 2.
   - (project.md is intentionally skipped — it was already injected at initial spawn.
     Mid-session project.md updates are communicated via messages to reduce re-spawn context load.)
2. Fetch all messages: `all_msgs = get_messages(agent_id: "{agentId}")`.
3. Compute new messages since last spawn:
   - `new_msgs = [m for m in all_msgs if m.seq > agent_last_seen.get(agentId, 0)]`
   - Update: `agent_last_seen[agentId] = max(m.seq for m in all_msgs)`
4. Fetch current task state for the Re-spawn Context block:
   - `my_tasks = get_all_tasks(agent_id: "orchestrator", assignee: "{agentId}")`
5. Inject re-spawn context into their system prompt:
```
## Re-spawn Context
You were waiting. Here is what has happened since your last run:

New events:
{list of new_msgs}

Your current tasks:
{my_tasks}

Resume your work. Call get_messages() first to read the full history.
```
6. Spawn with their allowed tools.
7. Collect their new `end:` declaration.

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
   Fetch the artifact via get_artifact, then call request_review(artifact_id, reviewer: "{reviewerId}") to create the review record.
   Review thoroughly, then call submit_review(review_id, status: "approved"|"changes_requested", comments: "...").
   IMPORTANT: After submit_review, broadcast the result:
     send_message(to: null, "Review complete: {requesterId} artifact {artifact_id} {approved|changes_requested} — {summary}")
   After reviewing, declare end:waiting or end:_done.
   ```

3. If the reviewee (the agent whose code is being reviewed) has a `review_checklist` field in the `list_agents` cache,
   append to the reviewer's system prompt:
   ```
   ## Review Checklist (Fix-First Framework)
   Apply this checklist to the code under review:

   {review_checklist content}

   ### Fix-First Approach
   For each issue found, classify it as:
   - **AUTO-FIX**: Obvious improvement any senior engineer would apply without discussion
     → Fix it directly and note what you changed.
   - **ASK**: Requires the author's judgment (architecture decisions, tradeoffs, style preferences)
     → Flag it as a question with your recommendation.

   ### Structured Output
   After reviewing, format your submit_review comments as:

   ### Auto-fixed
   - [list of changes made directly]

   ### Requires Discussion
   - [list of questions with context and recommendation]

   ### Summary
   [1-2 sentence overall assessment]
   ```

4. Allowed tools: same as the base persona's tools array.
5. Collect their `end:` declaration and track in spawned_reviewers.

**Note for teams without explicit reviewer agents:**
Agents can review each other's work by naming any active agent as reviewer.
Example: a research team where `researcher_b` reviews `researcher_a`'s paper:
  send_message(to: null, "Review requested: researcher_b please review paper artifact {id}")

## Session Wrap-up

When `len(done_agents) == len(base_agents) + len(spawned_reviewers)`:

> Step 4 guarantees this is only reachable when the task board has no stranded todos.
> If stranded todos existed in the previous iteration, Step 4 moved affected agents back
> to dormant_agents, keeping the while condition true until all work is genuinely done.

1. Archive: `save_session_summary(agent_id: "orchestrator", session_id: "{session_id}", summary: "{overall summary}")`.
1b. Delete orchestrator session state file (disables the Stop hook for this session):
   ```bash
   rm -f ".relay/sessions/${CLAUDE_SESSION_ID}.json"
   ```
1c. If `.relay/memory/project.md` does not exist:
    The PM/coordinator writes project.md summarizing what the team
    learned (via `write_memory` with no `agent_id`, or direct file write).
2. Clean up: delete `.relay/session-agents-{session_id}.yml` — it is ephemeral and gitignored.
3. Report results to the user.

## Multi-Instance Notes

When running multiple relay servers simultaneously (e.g. two projects in separate terminals):

- Each server instance should have a unique `DASHBOARD_PORT` (e.g. 3456 and 3457).
- Use `RELAY_INSTANCE` to give each instance a name (e.g. `project-a`, `project-b`).
  Session IDs will be automatically prefixed: `project-a-2026-03-14-007-a3f7`.
- Session data is in-memory per process — each instance maintains its own isolated in-memory state.
- The skill always operates on the MCP server it was invoked from. When Claude Code has
  two relay MCP servers registered, use the correct one's skill invocation.

Example `.mcp.json` for two instances:
```json
{
  "mcpServers": {
    "relay": {
      "command": "npx",
      "args": ["-y", "--package", "relay-server", "relay"],
      "env": { "DASHBOARD_PORT": "3456", "RELAY_INSTANCE": "project-a" }
    },
    "relay-b": {
      "command": "npx",
      "args": ["-y", "--package", "relay-server", "relay"],
      "env": { "DASHBOARD_PORT": "3457", "RELAY_INSTANCE": "project-b" }
    }
  }
}
```

## Failure Handling

- `end:failed | {reason}` → report to user, ask abort or continue.
- Agent produces no `end:` message within 15 minutes → warn user, ask re-spawn / skip / abort.
