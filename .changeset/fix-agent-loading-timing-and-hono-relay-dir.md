---
"@custardcream/relay": patch
---

fix: lazy-load agents in list_agents tool and use getRelayDir() in hono

- list_agents MCP tool now lazy-loads agents on first call instead of at
  createMcpServer() time — fixes the timing bug where agents were loaded
  before setProjectRoot() was called (always returned empty list)
- /api/sessions/:id endpoint now uses getRelayDir() instead of process.cwd()
- db/client.ts uses dirname() for directory extraction instead of string manipulation
