// packages/dashboard/src/hooks/usePanelResize.ts
// Custom hook encapsulating panel resize state and drag handlers.
// Collapse state is handled separately by usePanelCollapse.

import { useCallback, useEffect, useRef, useState } from "react";

const ARENA_DEFAULT_WIDTH = 320;
const ARENA_MIN_WIDTH = 180;
const ARENA_MAX_WIDTH = 520;
const TIMELINE_DEFAULT_PCT = 55;
const TIMELINE_MIN_PCT = 20;
const TIMELINE_MAX_PCT = 80;

export function usePanelResize() {
  const [arenaWidth, setArenaWidth] = useState(ARENA_DEFAULT_WIDTH);
  const [isDraggingArena, setIsDraggingArena] = useState(false);
  const [isDraggingTimeline, setIsDraggingTimeline] = useState(false);
  const [timelinePct, setTimelinePct] = useState(TIMELINE_DEFAULT_PCT);
  const activityRef = useRef<HTMLDivElement>(null);

  // Refs to track active drag cleanup functions so they can be called on unmount
  const hDragCleanupRef = useRef<(() => void) | null>(null);
  const vDragCleanupRef = useRef<(() => void) | null>(null);

  // Clean up any active drag listeners on unmount
  useEffect(() => {
    return () => {
      hDragCleanupRef.current?.();
      vDragCleanupRef.current?.();
    };
  }, []);

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
        hDragCleanupRef.current = null;
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      // Store cleanup so unmount can remove listeners if drag is in progress
      hDragCleanupRef.current = () => {
        setIsDraggingArena(false);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
    },
    [arenaWidth]
  );

  // Vertical (top-bottom) drag handler
  const onVDividerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDraggingTimeline(true);
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
        setIsDraggingTimeline(false);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        vDragCleanupRef.current = null;
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      // Store cleanup so unmount can remove listeners if drag is in progress
      vDragCleanupRef.current = () => {
        setIsDraggingTimeline(false);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
    },
    [timelinePct]
  );

  return {
    arenaWidth,
    isDraggingArena,
    isDraggingTimeline,
    timelinePct,
    activityRef,
    onHDividerMouseDown,
    onVDividerMouseDown,
  };
}
