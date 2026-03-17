---
"@custardcream/relay": minor
---

Reliability features and API cleanup (27→23 tools)

**New features:**
- Derived task provenance with circuit breaker (`parent_task_id`, `depth`, max depth 1, max 3 siblings)
- Orchestrator state persistence (`save_orchestrator_state` / `get_orchestrator_state`)
- `validate_prompt` per-agent field for declarative completion validation
- Completion-check REST endpoint for Stop hook enforcement
- Hook scripts: orchestrator stop guard, edit guard, session cleanup
- Optional Planning Phase in relay skill (PM pre-populates task board)

**API cleanup — removed 4 redundant tools:**
- `get_my_tasks` → use `get_all_tasks(assignee: agent_id)` instead
- `get_team_status` → derive from `get_all_tasks` results
- `get_ready_tasks` → filter `get_all_tasks` by dependency status
- `get_workflow` → unused, removed

**Bug fix:**
- Review workflow now correctly calls `request_review` before `submit_review`
