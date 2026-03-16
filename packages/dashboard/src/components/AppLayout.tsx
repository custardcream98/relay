// packages/dashboard/src/components/AppLayout.tsx
// Pure layout shell — manages panel geometry only.
// Reads PanelResizeContext for divider handlers and ref binding; all data from child panels via context.

import { usePanelLayout } from "../context/PanelResizeContext";
import { cn } from "../lib/cn";
import { AppHeader } from "./AppHeader";
import { OfflineBanner } from "./OfflineBanner";
import { ActivityPanel } from "./panels/ActivityPanel";
import { AgentArenaPanel } from "./panels/AgentArenaPanel";
import { BottomPanel } from "./panels/BottomPanel";

// Drag resize handle — intentionally a div (hr cannot be sized in flex row/column)
// Gripper dots provide a visible affordance for the draggable area.
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
        "group shrink-0 flex items-center justify-center gap-[3px]",
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
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--color-surface-root)] text-[var(--color-text-primary)] min-w-[480px]">
      <AppHeader />
      <OfflineBanner />

      <div className="flex flex-1 overflow-hidden">
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
    </div>
  );
}
