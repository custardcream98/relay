---
"@custardcream/relay": patch
---

fix: resolve /api/agents 500 error and move DB to .relay directory

- Add try/catch to /api/agents endpoint to return JSON error instead of generic 500
- Change default DB path from relay.db (CWD-relative) to .relay/relay.db (RELAY_DIR-relative)
- Auto-create RELAY_DIR if it doesn't exist when initializing the DB
- Support RELAY_PROJECT_ROOT env var in both loader and DB client to override CWD
  (needed when running via bunx which sets CWD to /tmp)
