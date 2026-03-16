// packages/dashboard/src/hooks/usePanelCollapse.ts
// Manages collapse/expand state for the two collapsible panels (AgentArena + TaskBoard).
// Intentionally separate from usePanelResize — collapse has no relationship to drag/resize logic.

import { useCallback, useState } from "react";

export interface PanelCollapseState {
  arenaCollapsed: boolean;
  taskBoardCollapsed: boolean;
  onToggleCollapse: () => void;
  onToggleTaskBoard: () => void;
}

export function usePanelCollapse(): PanelCollapseState {
  const [arenaCollapsed, setArenaCollapsed] = useState(false);
  const [taskBoardCollapsed, setTaskBoardCollapsed] = useState(false);

  const onToggleCollapse = useCallback(() => setArenaCollapsed((v) => !v), []);
  const onToggleTaskBoard = useCallback(() => setTaskBoardCollapsed((v) => !v), []);

  return { arenaCollapsed, taskBoardCollapsed, onToggleCollapse, onToggleTaskBoard };
}
