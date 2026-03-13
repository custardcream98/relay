---
"@custardcream/relay": minor
---

Migrate production runtime from Bun to Node.js and rename bin to `relay`

**Breaking change:** MCP registration command has changed. Re-register with:

```
claude mcp add --scope user relay -- npx -y --package @custardcream/relay relay
```

- Replace Bun runtime with Node.js for production (`better-sqlite3`, `ws`, `@hono/node-server`)
- Rename bin `relay-server` → `relay` — enables simpler `npx -y --package @custardcream/relay relay`
- Bun remains as dev tooling only (test runner, build)
