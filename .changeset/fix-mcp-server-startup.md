---
"@custardcream/relay": patch
---

fix: prevent manual server execution and handle port conflicts gracefully

- Add TTY guard that blocks direct terminal runs with a helpful error message — relay-server must be started via Claude Code MCP (stdio), not directly
- Wrap dashboard `Bun.serve()` in try-catch so that port 3456 conflicts no longer crash the MCP process; the MCP stdio server will still start even if the dashboard port is already in use
