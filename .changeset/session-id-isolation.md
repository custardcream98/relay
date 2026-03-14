---
"@custardcream/relay": minor
---

Add `start_session` MCP tool and fix session ID isolation

- Add `start_session` MCP tool: sets the active session ID on the server and broadcasts `session:started` to reset the live dashboard view
- Fix frozen `SESSION_ID` bug: all server modules now call `getSessionId()` lazily so `start_session` takes effect
- Add `session:started` to `RelayEvent` union; dashboard clears stale state on receipt
- Update `/relay:relay` pre-flight to auto-increment NNN counter from `list_sessions` and call `start_session`
- Fix `description` field missing from `task:updated` broadcast payloads
