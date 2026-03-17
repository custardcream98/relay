// packages/dashboard/src/components/AppLayout.tsx
// Pure layout shell — manages panel geometry only.
// Desktop: 3 panels side-by-side with resize dividers.
// Mobile (<768px): panels stack vertically, no drag-to-resize.

import { usePanelLayout } from "../context/PanelResizeContext";
import { cn } from "../lib/cn";
import { AppHeader } from "./AppHeader";
import { OfflineBanner } from "./OfflineBanner";
import { ActivityPanel } from "./panels/ActivityPanel";
import { AgentArenaPanel } from "./panels/AgentArenaPanel";
import { BottomPanel } from "./panels/BottomPanel";

// Drag resize handle — desktop only
function Divider({
  orientation,
  onMouseDown,
}: {
  orientation: "horizontal" | "vertical";
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  const isH = orientation === "horizontal";

  const dots = [0, 1, 2].map((i) => (
    <span
      key={i}
      className="w-[3px] h-[3px] rounded-full bg-[var(--color-border-default)] shrink-0 transition-colors duration-150 group-hover:bg-[var(--color-text-disabled)]"
    />
  ));

  return (
    <div
      onMouseDown={onMouseDown}
      title="Drag to resize panels"
      className={cn(
        "group shrink-0 items-center justify-center gap-[3px] hidden md:flex",
        "bg-[var(--color-border-subtle)] transition-colors duration-150 hover:bg-[var(--color-border-default)]",
        isH
          ? "w-[6px] self-stretch flex-col cursor-col-resize"
          : "h-[6px] flex-row cursor-row-resize"
      )}
    >
      {dots}
    </div>
  );
}

export function AppLayout() {
  const {
    arenaCollapsed,
    activityRef,
    onHDividerMouseDown,
    onVDividerMouseDown,
    taskBoardCollapsed,
  } = usePanelLayout();

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--color-surface-root)] text-[var(--color-text-primary)]">
      <AppHeader />
      <OfflineBanner />

      {/* Desktop layout: horizontal panels with resize dividers */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        <AgentArenaPanel />

        {!arenaCollapsed && <Divider orientation="horizontal" onMouseDown={onHDividerMouseDown} />}

        <div ref={activityRef} className="flex flex-col flex-1 overflow-hidden">
          <ActivityPanel />

          {!taskBoardCollapsed && (
            <Divider orientation="vertical" onMouseDown={onVDividerMouseDown} />
          )}

          <BottomPanel />
        </div>
      </div>

      {/* Mobile layout: vertical stack */}
      <div className="flex md:hidden flex-col flex-1 overflow-y-auto">
        <div className="shrink-0">
          <AgentArenaPanel />
        </div>
        <div className="flex-1 min-h-0">
          <ActivityPanel />
        </div>
        <div className="shrink-0">
          <BottomPanel />
        </div>
      </div>
    </div>
  );
}
