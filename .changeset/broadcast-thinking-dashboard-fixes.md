---
"@custardcream/relay": patch
---

Fix dashboard agent card activity display and add broadcast_thinking MCP tool

- Agent cards now show task title as fallback when agent has no messages yet (fixes "No activity yet")
- Add `broadcast_thinking` MCP tool — emits `agent:thinking` WebSocket events to fill the Thoughts panel
- Orchestrator now verifies open tasks before accepting `end:_done` to keep task board accurate
- All agents receive task discipline + visibility guidance via injected system prompt note
