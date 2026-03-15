---
"@custardcream/relay": minor
---

Add git-hook style task lifecycle hooks for agents

**Server**
- New `hooks` field on agent pool entries: `before_task` and `after_task` shell commands
- `before_task` runs before `claim_task` — non-zero exit blocks claiming (no phantom `in_progress`)
- `after_task` runs after `update_task(status: "done")` — non-zero exit reverts status to `in_review`
- Accepts `string | string[]`; commands run sequentially in the project root
- Env vars injected: `RELAY_AGENT_ID`, `RELAY_TASK_ID`, `RELAY_SESSION_ID`
- Timeouts: 30s (`before_task`) / 120s (`after_task`); SIGTERM → SIGKILL escalation
- `hooks: false` on extends-based agents explicitly opts out of inherited hooks
- Fix: `extends` spread no longer overwrites base fields with `undefined` overrides

**New files**
- `tools/hook-runner.ts` — `runHook()` / `runHooks()` utilities
- `tools/hook-runner.test.ts` — 8 tests
- New hook tests in `tools/tasks.test.ts` and `agents/loader.test.ts`
