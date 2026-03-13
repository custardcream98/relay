// packages/dashboard/src/hooks/usePanelResize.ts
// Custom hook encapsulating panel resize state and drag handlers

import { useCallback, useRef, useState } from "react";

const ARENA_DEFAULT_WIDTH = 320;
const ARENA_MIN_WIDTH = 180;
const ARENA_MAX_WIDTH = 520;
const TIMELINE_DEFAULT_PCT = 55;
const TIMELINE_MIN_PCT = 20;
const TIMELINE_MAX_PCT = 80;

export function usePanelResize() {
  const [arenaWidth, setArenaWidth] = useState(ARENA_DEFAULT_WIDTH);
  const [arenaCollapsed, setArenaCollapsed] = useState(false);
  const [isDraggingArena, setIsDraggingArena] = useState(false);
  const [timelinePct, setTimelinePct] = useState(TIMELINE_DEFAULT_PCT);
  const activityRef = useRef<HTMLDivElement>(null);

  // Horizontal (left-right) drag handler
  const onHDividerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDraggingArena(true);
      const startX = e.clientX;
      const startW = arenaWidth;
      const onMove = (ev: MouseEvent) => {
        setArenaWidth(
          Math.max(ARENA_MIN_WIDTH, Math.min(ARENA_MAX_WIDTH, startW + ev.clientX - startX))
        );
      };
      const onUp = () => {
        setIsDraggingArena(false);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [arenaWidth]
  );

  // Vertical (top-bottom) drag handler
  const onVDividerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startY = e.clientY;
      const startPct = timelinePct;
      const activityH = activityRef.current?.clientHeight ?? 600;
      const onMove = (ev: MouseEvent) => {
        const nextPx = (startPct / 100) * activityH + ev.clientY - startY;
        setTimelinePct(
          Math.max(TIMELINE_MIN_PCT, Math.min(TIMELINE_MAX_PCT, (nextPx / activityH) * 100))
        );
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [timelinePct]
  );

  const onToggleCollapse = useCallback(() => setArenaCollapsed((v) => !v), []);

  return {
    arenaWidth,
    arenaCollapsed,
    isDraggingArena,
    timelinePct,
    activityRef,
    onHDividerMouseDown,
    onVDividerMouseDown,
    onToggleCollapse,
  };
}
