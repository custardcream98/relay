---
"@custardcream/relay": minor
---

Optimize agent memory loading by removing lessons.md

`read_memory()` (without agent_id) now returns only `project.md` instead of merging `project.md` + `lessons.md`. Session retrospectives should use `save_session_summary` instead of `append_memory`.

`append_memory` now requires `agent_id` — calling it without one returns an error. Use `save_session_summary` for session-level notes.

This reduces the token cost of `read_memory` MCP calls, which were growing unboundedly as `lessons.md` accumulated entries across sessions.
