# Session Summary: 2026-03-15-001-a3f2

# Session 2026-03-15-001: Sprint A — Dashboard Bug Fixes

## Team
pm, be, fe, fe2, qa

## Completed Items

### 1. review:updated WebSocket Event (BE + FE)
- packages/shared/index.ts: `review:updated` added to RelayEvent union
- packages/server/src/mcp.ts: submit_review broadcasts event after success
- packages/server/src/tools/review.test.ts: integration test added (83 total)
- packages/dashboard/src/App.tsx: reducer handles review:updated (timeline entry)

### 2. AgentCard "No activity yet" Bug Fix (FE)
- packages/dashboard/src/components/AgentArena.tsx: lastActivityByAgent now compares task + message timestamps; most-recent-wins

### 3. ServerSwitcher WebSocket Reconnection (FE2)
- packages/dashboard/src/hooks/useRelaySocket.ts: serverUrl param + toWsUrl() helper
- packages/dashboard/src/App.tsx: activeServer state, handleSwitchServer implemented, TDZ fix

## Final Status
- bun test: 83/83 pass
- bun run dashboard:build: 0 errors

