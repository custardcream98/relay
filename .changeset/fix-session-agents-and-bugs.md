---
"@custardcream/relay": patch
---

Fix session-agents.yml loading and several session isolation bugs

- `getAgents()`: session file not found no longer permanently caches `{}` — returns without caching so the next call can retry after the file is written
- `getAgents()`: load errors no longer permanently cache `{}` — error path returns without caching
- `getPool()`: update `poolCachedAt` on load failure to prevent retry spam on every call
- `getTaskById`: add `session_id` filter to prevent cross-session reads
- `updateReviewStatus`: add `session_id` WHERE clause to prevent cross-session writes
- `append_memory`: use `appendFile` instead of read-then-write to eliminate concurrent write race
