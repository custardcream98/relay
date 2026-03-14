---
"@custardcream/relay": minor
---

Concurrent session isolation, session switcher, and dashboard improvements

- **Concurrent session isolation**: `list_agents` now accepts an optional `session_id` parameter. The server uses a per-session `Map` cache instead of a global singleton, so two relay sessions running simultaneously no longer overwrite each other's agent configuration.
- **Session switcher**: The dashboard header now shows a session dropdown. Select any past session to freeze the Task Board and Message Feed to that session's snapshot; a LIVE badge indicates you're viewing the current session.
- **`GET /api/sessions/:id/snapshot`**: New endpoint returning `{ session_id, tasks, messages, artifacts }` for a given session.
- **Agent thoughts**: Pool agents now include `broadcast_thinking` in their tool lists, completing the loop between the MCP tool and the dashboard Thoughts panel.
- **Fix**: Agent cards now show the most recent task instead of the first task assigned.
- **Remove**: `SessionReplay` component removed (replaced by the session switcher).
