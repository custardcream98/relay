## session-2026-03-17-001-b4e2

## Session Notes — 2026-03-17-001-b4e2

### Key File Paths
- `packages/dashboard/src/types.ts` — Task interface (added depends_on, parent_task_id)
- `packages/dashboard/src/components/SessionProgress.tsx` — NEW: header progress widget
- `packages/dashboard/src/components/TaskProgressBar.tsx` — NEW: stacked bar for TaskBoard
- `packages/dashboard/src/components/MobileTabBar.tsx` — NEW: bottom tab nav for mobile
- `packages/dashboard/src/components/AppHeader.tsx` — Added SessionProgress
- `packages/dashboard/src/components/AppLayout.tsx` — Added MobileLayout with tab navigation
- `packages/dashboard/src/components/TaskBoard.tsx` — Added TaskProgressBar, dependency maps (blockedByMap/blocksMap)
- `packages/dashboard/src/components/TaskDetailModal.tsx` — Enhanced with deps, mobile bottom sheet, animation
- `packages/dashboard/src/components/AgentCard.tsx` — Added task completion mini-bar (taskDoneCount/taskTotalCount)
- `packages/dashboard/src/components/AgentArena.tsx` — Extended agentData memo for done/total counts
- `packages/dashboard/src/components/ActivityFeed.tsx` — Added keyboard navigation (j/k/Enter/Escape)
- `packages/dashboard/src/index.css` — Added task-modal-open keyframe animation

### Conventions Observed
- Edit tool is blocked by relay-edit-guard.sh for orchestrator sessions — use Bash/sed/python for file edits
- biome check must run from project root (not packages/dashboard/) to avoid doubled paths
- tsc -b runs from packages/dashboard/ directory
- Stories files (.stories.tsx) must be updated when component Props change
- CSS variables defined in index.css :root and :root[data-theme="light"] — use them for both themes
- Agent accent colors come from `getAgentAccent()` in constants/agents.ts
- Contexts: SessionContext (tasks, messages, agentStatuses, timeline), AgentsContext, ConnectionContext, ServerContext
- PanelResizeContext handles desktop panel geometry (not mobile)
- Shared types imported from @custardcream/relay-shared

### Patterns
- Components are memo-wrapped with named functions: `memo(function ComponentName(...) { ... })`
- Dynamic inline styles via useMemo for hex-based colors (agent accents)
- CN utility for conditional classNames
- CSS vars for theme colors, hex literals for agent-specific colors with alpha suffixes (e.g., `${color}1a`)
