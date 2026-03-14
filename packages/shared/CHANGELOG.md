# @custardcream/relay-shared

## 0.1.1

### Patch Changes

- 2b9f81c: feat: dashboard enhancement — message feed, session replay, event filter, reconnect UI, auto session ID

  - Add MessageFeed panel with Slack-style thread view (TaskBoard ↔ Messages tab)
  - Add session replay UI with playback controls (GET /api/sessions)
  - Add EventTimeline type filter (7 toggles: messages/tasks/artifacts/thinking/status/memory/review)
  - Add reconnect progress UI (offline banner, countdown, retry button)
  - Add TaskBoard description preview (2-line clamp + hover tooltip)
  - Fix getAgentAccent() applied consistently across all components
  - Fix session:snapshot type safety (unknown[] → concrete types)
  - Fix session isolation: auto-generate unique session ID per server startup instead of defaulting to "default"
  - Add GET /api/sessions endpoint for session list
  - Add instanceId/port/agents to WebSocket snapshot payload
