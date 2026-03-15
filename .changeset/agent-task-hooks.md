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

- `update_task` hook failure now returns `{ success: false, hook_failed: true, error }` — agents can distinguish "fix and retry" from "task not found"
- `claim_task` and `update_task` tool descriptions now document hook behavior for agents reading the schema
- `runHook()` guards against `exec()` throwing synchronously (e.g. empty command) — never rejects
- Fix: `exitCode` extraction now correctly handles POSIX string codes (e.g. `"ENOENT"`) vs numeric exit codes — string codes are mapped to `null` instead of `NaN`
- Fix: SIGKILL escalation timer now guards against killing a recycled PID via `child.exitCode` check

**New files**
- `tools/hook-runner.ts` — `runHook()` / `runHooks()` utilities
- `tools/hook-runner.test.ts` — 11 tests (truncation, env var injection, empty command guard)
- New hook tests in `tools/tasks.test.ts` and `agents/loader.test.ts` (including `hook_failed` discriminator assertion and after-revert retry path)
