// packages/dashboard/src/context/PanelResizeContext.tsx
// Lifts usePanelResize() + usePanelCollapse() state into context so panels own their resize state
// without prop drilling through AppLayout.

import { createContext, type RefObject, useContext, useMemo } from "react";
import { usePanelCollapse } from "../hooks/usePanelCollapse";
import { usePanelResize } from "../hooks/usePanelResize";

interface PanelResizeContextValue {
  arenaWidth: number;
  arenaCollapsed: boolean;
  isDraggingArena: boolean;
  timelinePct: number;
  activityRef: RefObject<HTMLDivElement | null>;
  taskBoardCollapsed: boolean;
  onHDividerMouseDown: (e: React.MouseEvent) => void;
  onVDividerMouseDown: (e: React.MouseEvent) => void;
  onToggleCollapse: () => void;
  onToggleTaskBoard: () => void;
}

const PanelResizeContext = createContext<PanelResizeContextValue | null>(null);

export function PanelResizeProvider({ children }: { children: React.ReactNode }) {
  const resize = usePanelResize();
  const collapse = usePanelCollapse();
  const value = useMemo<PanelResizeContextValue>(
    () => ({ ...resize, ...collapse }),
    [resize, collapse]
  );
  return <PanelResizeContext.Provider value={value}>{children}</PanelResizeContext.Provider>;
}

export function usePanelLayout(): PanelResizeContextValue {
  const ctx = useContext(PanelResizeContext);
  if (!ctx) throw new Error("usePanelLayout must be used inside PanelResizeProvider");
  return ctx;
}
