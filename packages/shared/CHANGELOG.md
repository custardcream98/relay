# @custardcream/relay-shared

## 0.1.0

### Minor Changes

- d7f5879: Dashboard UX improvements and server feature additions

  **Dashboard**

  - Multi-instance agent disambiguation: AgentCard now shows a monospace ID badge on every card and an `↳ {base}` subtitle for agents created via `extends` (e.g. fe2 extending fe)
  - Task board: empty column states, task detail modal on card click (full description, status/priority/assignee badges, timestamps, Markdown rendering)
  - Message feed: new Slack-style panel with agent avatars, DM/broadcast distinction, thread collapsing, unread badge, copy-to-clipboard, and search
  - Session selector: live session chip in header with dropdown of saved sessions
  - Activity feed: fix empty state detection, add per-type event count badges on filter pills
  - Layout: wider divider grab area with gripper dots, responsive min-width constraint

  **Server**

  - Tasks: optional `depends_on` field — `claim_task` enforces all dependencies are `done` before allowing a claim
  - Messages: optional `metadata` field (`Record<string, string>`) for structured context
  - Agents: `basePersonaId` preserved through loader and exposed in `/api/agents` and `list_agents` for extends-based agents
  - New API endpoints: `GET /api/health`, `GET /api/sessions/live`, `GET /api/sessions/:id/replay`
  - `GET /api/session`: pagination support (`?offset=N&limit=N`) with `total` metadata
  - WebSocket: server-side ping/pong heartbeat (30s interval)
  - `broadcast_thinking`: now also emits `agent:status=working` for dashboard visibility
  - Improved descriptions on all 18 MCP tools for better LLM discoverability

  **Shared types**

  - Add `agent:joined` event to `RelayEvent` union
  - Add `metadata` to `message:new` event payload
  - Add `depends_on` to `task:updated` event payload
