---
"@custardcream/relay": minor
---

Add dynamic agent composition and multi-server support.

- `loadPool()` function and `list_pool_agents` MCP tool for agent pool browsing
- `RELAY_SESSION_AGENTS_FILE` env var for per-session team override
- Auto port selection (3456–3465) when default port is occupied
- `RELAY_DB_PATH` / `RELAY_INSTANCE` env vars for DB isolation
- `--port` / `--session` CLI args as alternatives to env vars
- Dashboard: `SessionTeamBadge`, `ServerSwitcher`, instance header
- `agents.pool.example.yml` with 12 personas across web-dev, research, marketing
- Skill: Team Composition pre-flight for conversational team selection
