---
"@custardcream/relay": patch
---

fix: discover project root via MCP roots/list protocol

- Introduce shared config module (config.ts) with getProjectRoot() / getRelayDir()
- On MCP server start, call server.listRoots() to receive the workspace root from
  the MCP client (Claude Code) — resolves the bunx CWD=/tmp problem without
  requiring any per-project configuration
- All modules (loader, db/client, mcp tools) now use getRelayDir() consistently
- Falls back to RELAY_PROJECT_ROOT env var, then process.cwd() if roots unavailable
